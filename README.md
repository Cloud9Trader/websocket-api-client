# @cloud9trader/websocket-api-client

A JavaScript client adaptor for [Cloud9Trader](https://www.cloud9trader.com)'s realtime API for use in web browsers and NodeJS.

Cloud9Trader is a web platform that connects to a growing number of Forex brokers and Cryptocurrency exchanges, providing a single API for pricing and trading to power your interfaces and trading algorithms.

Cloud9Trader's API allows you to stream market data and trade with Binance, Bitfinex, BitMEX, HitBTC, FXCM, OANDA and a growing number of exchanges. We've smoothed over the various implementations to provide a simple to use API so that you can write your application code once to communicate across the multiple exchanges.

If you are developing in languages other than JavaScript you can consume the API directly with native WebSockets. Please visit the [WebSocket API Documentation](https://www.cloud9trader.com/documentation/cloud9trader-api/websocket-api).

## Getting Started

For use in NodeJS or Webpack builds:

```
npm i @cloud9trader/websocket-api-client
```

For use in browser as global:

```
<script src="https://unpkg.com/@cloud9trader/websocket-api-client@^0/dist/global.js"></script>
```

For use in browser with AMD:

```
<script src="https://unpkg.com/@cloud9trader/websocket-api-client@^0/dist/umd.js"></script>
```

## Authentication

Head over to [Cloud9Trader](https://www.cloud9trader.com) and generate an API key and secret. (TODO instructions)

Ensure that you keep your API key secret and **do not serve it on your websites**. Private data will only be served to server side connections. To use public data in your browser applications please supply your domain name when creating your API key. Connections from other domains will be rejected.

## Import

```js
// NodeJS / CommonJS
const Cloud9TraderClient = require("@cloud9trader/websocket-api-client").Client;

// or ES Modules / TypeScript
import Cloud9TraderClient from "@cloud9trader/websocket-api-client";

// Cloud9Trader is available on the global scope in vanilla browser environments, ie.
const Cloud9TraderClient = Cloud9Trader.Client;

// or AMD
define(..., ["@cloud9trader/websocket-api-client"], (Cloud9TraderClient) => {
   ...
});

```

## Initialization

```js
const client = new Cloud9TraderClient({
  key: <API KEY>,
  secret: <API SECRET> // NodeJS only, not for use publicly in browsers
})

client.start()
```

## Class: Cloud9TraderClient

## new Cloud9TraderClient(options)

-   `options` {object}

    -   `key` {string} Public API key
    -   `secret` {string} Optional. Private API secret (NodeJS / server side only)

```js
const client = new Cloud9TraderClient({
  key: <API KEY>,
  secret: <API SECRET> // NodeJS only, not for use publicly in browsers
})
```

## Event: 'connected'

Emitted when the socket becomes connected.

```js
client.on("connected", () => {
    console.info("Cloud9Trader is connected");
});
```

## Event: 'status'

Emits human friendly socket status messages.

```js
client.on("status", status => {
    console.info("Cloud9Trader connection status is:", status);
});
```

## Event: 'error'

Emitted on socket error and error message from server.

-   `error` {Error} | {string}

```js
client.on("error", error => {
    console.error("Cloud9Trader socket error:", error);
});
```

## Event: '<topic>'

Incoming messages for topic subscriptions are emitted as events.

-   `data` {any}

```js
client.on("balances", balances => {
    console.info("Received balances update from Cloud9Trader", balances);
});
```

## Event: 'disconnected'

Emitted when the socket becomes disconnected. The client will attempt to reconnect with exponential backoff. Any subscriptions will be reapplied automatically on reconnect.

```js
client.on("disconnected", () => {
    console.info("Cloud9Trader is disconnected");
});
```

## client.start()

Initiates the socket connection.

```js
client.start();
```

## client.isConnected()

-   `Returns:` {boolean}

## client.request(topic, handler)

Requests a data snapshot for a topic. Visit the [WebSocket API Documentation](https://www.cloud9trader.com/documentation/cloud9trader-api/websocket-api) for available topics.

-   `topic` {string} The data topic
-   `handler` {Function} Callback function

```js
client.request("orders", (error, data) => {
    if (error) return console.warn("Cloud9Trader error fetching orders", error);
    console.info("Received orders from Cloud9Trader", data);
});
```

The `handler` callback has a signature of `handler(error, data)`

-   `error` {string} Error response from server
-   `data` {Object} | {Array} Data snapshot for topic

## client.subscribe(topic, listener)

Subscribes to updates for a topic. Visit the [WebSocket API Documentation](https://www.cloud9trader.com/documentation/cloud9trader-api/websocket-api) for available topics.

-   `topic` {string} The data topic
-   `listener` {Function} Listener function

```js
client.subscribe("balances", data => {
    console.info("Received a balances update from Cloud9Trader", data);
});
```

The `listener` function has a signature of `listener(data)`

-   `data` {Object} | {Array} Data update for topic

## client.fetchInstruments([callback])

Fetches the instruments config list over HTTP. See [REST API - Get Instruments](https://www.cloud9trader.com/documentation/cloud9trader-api/rest-api#get-instruments).

-   `callback` {Function} Optional callback function. If not passed, a promise is returned.

```js
client.fetchInstruments((error, instruments) => {
    if (error) return console.warn("Cloud9Trader error fetching instruments", error);
    console.info("Fetched instruments from Cloud9Trader", instruments);
});
```

The `callback` callback has a signature of `callback(error, instruments)`

-   `error` {string} Error response from server
-   `instruments` {Array} Instruments config

## client.fetchHistoricalPrice(instrumentId, interval, start[, end][, callback])

Fetches historical price bars or ticks. See [REST API - Get Historical Price](https://www.cloud9trader.com/documentation/cloud9trader-api/rest-api#get-historical-price).

-   `instrumentId` {string} Case sensitive instrument ID matching config above
-   `interval` {string} Interval timeframe
-   `start` {string} Range start
-   `end` {string} Optional. Range end. Defaults to now.
-   `callback` {Function} Optional callback function. If not passed, a promise is returned

```js
client.fetchHistoricalPrice("XBTUSD:BitMEX", "H1", "2019-08-01T00:00:00.000Z", "2019-09-01T00:00:00.000Z", (error, price) => {
    if (error) return console.warn("Cloud9Trader error fetching price", error);
    console.info("Fetched price from Cloud9Trader", price);
});
```

The `callback` callback has a signature of `callback(error, price)`

-   `error` {string} Error response from server
-   `price` {Array} Historical price data
