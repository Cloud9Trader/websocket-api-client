import WebSocket from "isomorphic-ws";
import fetch from "isomorphic-fetch";
import EventEmitter from "./EventEmitter";
import { randomKey, getHMACHeaders } from "./utils";

const readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];

interface ClientOptions {
    readonly key: string;
    readonly secret?: string;
    readonly host?: string;
}

type Interval = "Tick" | "S5" | "S10" | "M2" | "M5" | "M10" | "M15" | "M30" | "H1" | "H2" | "H4" | "H8" | "H12" | "D1";

type Event = "connected" | "status" | "error" | "disconnected" | string;
type Topic = "balances" | "positions" | "orders" | "executions" | "messages" | "logs" | string;

type Subscriptions = Record<Topic, Function[]>;

type Broker = "FXCM" | "OANDA" | "BitMEX" | "Bitfinex" | "Binance" | string;
type Direction = "SHORT" | "LONG";

type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
type OrderSide = "BUY" | "SELL";
type OrderTimeInForce = "GTC" | "DAY" | "IOC" | "FOK" | "OPG";
type OrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED";

interface Instrument {
    id: string;
    broker: string;
    symbol: string;
    displayName: string;
    displaySymbol: string;
    product: string;
    productId: number;
    dealt: string;
    quote: string;
    pip: string;
    precision: number;
    pipPrecision: number;
    maxTradeUnits: number;
    maxQuantity: number;
    pipSize: number;
    marginRate: number;
    maxTrailingStop: number;
    minTrailingStop: number;
    factor: number;
    contractMultiplier: number;
}

interface Balance {
    broker: Broker;
    accountNo?: number;
    currency?: string;
    balance?: number;
    equity?: number;
    availableMargin?: number;
    positionMargin?: number;
    orderMargin?: number;
    usedMargin?: number;
    unrealisedProfit?: number;
}

interface Position {
    accountNo: number;
    broker: Broker;
    direction: Direction;
    instrumentId: string;
    profit: number;
    quantity: number;
    value: number;
    snapshot?: true;
}

interface OrderSubmission {
    broker: Broker;
    instrument: string;
    type: OrderType;
    side: OrderSide;
    quantity: number;
    price?: number;
    timeInForce?: OrderTimeInForce;
    clientOrderId?: string;
}

interface Order {
    broker: Broker;
    id: string;
    brokerOrderId: string;
    clientOrderId?: string;
    accountNo?: string;
    currency: string;
    instrumentId: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    quantityFilled?: number;
    quantityRemaining?: number;
    type: OrderType;
    time: string;
    timeInForce: OrderTimeInForce;
    positionId?: string;
    price: number;
    stopPrice?: number;
    status: OrderStatus;
    detail: string;
    settlementCurrency: string;
    averagePrice: string;
    icebergQuantity: string;
    snapshot?: true;
}

interface Execution {
    broker: Broker;
    accountNo: string;
    id: string;
    symbol: string;
    instrumentId: string;
    time: string;
    orderId: string;
    side: string;
    quantity: string;
    price: number;
    orderType: OrderType;
    orderPrice: number;
    orderStatus?: OrderStatus;
    maker?: boolean;
    fee?: number;
    feeCurrency?: string;
    detail?: string;
    quantityRemaining?: number;
    snapshot?: true;
}

type EmptyHandler = () => void;
type StatusHandler = (status: string) => void;
type ErrorHandler = (error: string) => void;

type InstrumentsCallback = (error?: Error, instruments?: Instrument[]) => void;

type BalancesHandler = (error?: "timeout" | string, balances?: Balance[]) => void;
type PositionsHandler = (error?: "timeout" | string, positions?: Position[]) => void;
type OrdersHandler = (error?: "timeout" | string, orders?: Order[]) => void;
type ExecutionsHandler = (error?: "timeout" | string, executions?: Execution[]) => void;

type BalancesListener = (balances: Balance[]) => void;
type PositionsListener = (positions: Position[]) => void;
type OrdersListener = (orders: Order[]) => void;
type ExecutionsListener = (executions: Execution[]) => void;
type MessagesListener = (message: string) => void;
type LogsListener = (logs: string) => void;

type OrderSubmitCallback = (error: string, order: Order) => void;

class Client extends EventEmitter {
    private key?: string;
    private secret?: string;
    private host?: string;

    connected: boolean = false;

    static Client = Client;

    private socket!: WebSocket;

    private reconnectAttempts: number = 0;

    private requestPrefix: string = randomKey(5) + "/";

    private requestCount: number = 0;

    private subscriptions: Subscriptions = {};

    private autoSubscribed: string[] = ["messages", "logs"];

    constructor(options: ClientOptions) {
        super();
        if (!options) {
            throw "[ERROR] Please pass options object to constructor";
        }
        this.key = options.key;
        this.secret = options.secret;
        this.host = options.host || "wss://sockets.cloud9trader.com";
        if (!this.key) {
            throw "[ERROR] Please provide API key";
        }
        if (this.secret && typeof window === "object" && window.navigator) {
            throw "[ERROR] Cloud9Trader client will not initiate private connections from the browser. Do not share your API keys. Remove the secret from options for public connections";
        }
    }

    start() {
        if (this.socket) return;

        if (this.secret) {
            this.socket = new WebSocket(this.host, {
                headers: {
                    ...getHMACHeaders(this.key, this.secret, "/")
                }
            });
        } else {
            this.socket = new WebSocket(this.host + "?key=" + this.key);
        }

        this.socket.addEventListener("open", this.onConnect.bind(this));
        this.socket.addEventListener("close", this.onDisconnect.bind(this));
        this.socket.addEventListener("message", this.onMessage.bind(this));

        this.socket.addEventListener("error", error => {
            this.emit("status", "Error");
            let message;
            if (error.message === "Unexpected server response: 401") {
                message = "401 Authentication rejected by server. Check that your key and secret are correct";
            }
            this.emit("error", message || error);
            console.error("[ERROR] Cloud9Trader socket error", message || error);
        });
    }

    private onConnect() {
        console.info("[INFO] Cloud9Trader socket connected");

        this.emit("status", "Connected");

        this.setConnected(true);

        this.reconnectAttempts = 0;
    }

    send(...args: any[]): void {
        if (!this.socket) {
            return console.warn("[WARN] Cloud9Trader socket could not send - socket initializing", ...args);
        }
        if (this.socket.readyState !== 1) {
            console.warn("[WARN] Cloud9Trader socket could not send - socket is", readyStates[this.socket.readyState], ...args);
            return this.once("connected", this.send.bind(this, ...args));
        }
        this.socket.send(JSON.stringify(args));
    }

    private setConnected(connected: boolean) {
        const wasConnected = this.connected;
        this.connected = connected;
        if (!wasConnected && connected) {
            this.emit("connected");
        } else if (wasConnected && !connected) {
            this.emit("disconnected");
            this.resetSubscriptions();
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    private onMessage(event: { data: any }) {
        let topic, args;
        try {
            [topic, ...args] = JSON.parse(event.data);
        } catch (error) {
            return console.error("[ERROR] Cloud9Trader socket could not parse incoming message", event.data);
        }
        this.emit(topic, ...args);
    }

    private async fetchHTTP(url: string, callback?: Function) {
        let response, body;
        try {
            response = await fetch(url);
            body = await response.json();
        } catch (error) {
            if (callback) {
                return callback(error);
            } else {
                throw error;
            }
        }
        if (callback) {
            callback(null, body);
        } else {
            return body;
        }
    }

    fetchInstruments(callback?: InstrumentsCallback) {
        return this.fetchHTTP("https://www.cloud9trader.com/api/v1/instruments", callback);
    }

    fetchHistoricalPrice(instrumentId: string, interval: Interval, startDate: Date | string, endDate?: Date | string, callback?: Function) {
        const start = new Date(startDate).toISOString();
        const end = endDate ? new Date(endDate).toISOString() : "";
        return this.fetchHTTP(`https://price.cloud9trader.com/historical?instrumentId=${instrumentId}&interval=${interval}&start=${start}&end=${end}`, callback);
    }

    request(topic: "balances", handler: BalancesHandler): void;
    request(topic: "positions", handler: PositionsHandler): void;
    request(topic: "orders", handler: OrdersHandler): void;
    request(topic: "executions", handler: ExecutionsHandler): void;
    request(topic: Topic, handler: Function): void;
    request(topic: Topic, handler: Function): void {
        if (!this.connected) {
            return this.once("connected", this.request.bind(this, topic, handler));
        }
        const requestId = this.requestPrefix + this.requestCount++;
        this.send("request", topic, requestId);
        this.waitFor(requestId, handler, 3000);
    }

    on(event: "connected", handler: EmptyHandler): void;
    on(event: "status", handler: StatusHandler): void;
    on(event: "error", handler: ErrorHandler): void;
    on(event: "disconnected", handler: EmptyHandler): void;
    on(event: Event, handler: Function): void;
    on(event: Event, handler: Function): void {
        super.on(event, handler);
    }

    subscribe(topic: "balances", listener: BalancesListener): void;
    subscribe(topic: "positions", listener: PositionsListener): void;
    subscribe(topic: "orders", listener: OrdersListener): void;
    subscribe(topic: "executions", listener: ExecutionsListener): void;
    subscribe(topic: "messages", listener: MessagesListener): void;
    subscribe(topic: "logs", listener: LogsListener): void;
    subscribe(topic: Topic, listener: Function): void;
    subscribe(topic: Topic, listener: Function): void {
        if (!this.connected) {
            this.once("connected", this.subscribe.bind(this, topic, listener));
            return;
        }
        if (this.subscriptions[topic]) {
            this.subscriptions[topic].push(listener);
        } else {
            this.subscriptions[topic] = [listener];
            if (!this.autoSubscribed.includes(topic)) {
                this.send("subscribe", topic);
            }
        }
        this.on(topic, listener);
    }

    unsubscribe(topic: string, listener: Function) {
        if (!this.subscriptions[topic]) {
            return console.warn("[WARN] Cloud9Trader socket - No existing subscriptions for " + topic);
        }
        // Beware of listeners on the prototype that will match across instances resulting in one unsubscribe removing all
        // Declare the listener in the constructor, e.g. this.listener = this.listener.bind(this) or use an arrow function assigned to a class property
        this.subscriptions[topic] = this.subscriptions[topic].filter(existing => existing !== listener);
        if (this.subscriptions[topic].length === 0) {
            delete this.subscriptions[topic];
            if (!this.autoSubscribed.includes(topic)) {
                this.send("unsubscribe", topic);
            }
        }
        this.off(topic, listener);
    }

    submit(type: "order", order: OrderSubmission, callback: OrderSubmitCallback): void;

    submit(type: string, item: any, callback: Function) {
        if (!this.connected) {
            return callback("Socket is not connected");
        }
        const requestId = this.requestPrefix + this.requestCount++;
        this.send("submit", type, item, requestId);
        this.waitFor(requestId, callback, 5000);
    }

    private resetSubscriptions() {
        if (this.connected) return;
        Object.entries(this.subscriptions).forEach(([topic, listeners]) => {
            listeners.forEach(listener => {
                this.off(topic, listener);
                this.subscribe(topic, listener);
            });
        });
        this.subscriptions = {};
    }

    private onDisconnect() {
        console.info("[INFO] Cloud9Trader socket disconnected");
        this.emit("status", "Disconnected");
        this.setConnected(false);
        delete this.socket;
        this.reconnect();
    }

    reconnect() {
        let seconds = Math.round(Math.pow(1.9805, Math.floor(Math.min(this.reconnectAttempts / 2, 4)))),
            interval = seconds * 1000;

        console.info(`[INFO] Cloud9Trader socket attempting reconnect ${this.reconnectAttempts} in ${seconds} second${seconds > 1 ? "s" : ""}`);

        this.emit("status", "Waiting for reconnect");

        setTimeout(() => {
            this.reconnectAttempts++;
            this.start();
        }, interval);
    }
}

export { Client };
export { Client as Cloud9TraderClient };
export default Client;
