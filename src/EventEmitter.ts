interface Events {
    [event: string]: Set<Function>;
}

class EventEmitter {
    events: Events = {};

    private listEvents(event: string) {
        if (typeof this.events[event] === "undefined") {
            this.events[event] = new Set();
        }
        return this.events[event];
    }

    on(event: string, handler: Function) {
        this.listEvents(event).add(handler);
    }

    once(event: string, handler: Function) {
        const onceFn = (...args: any[]) => {
            this.off(event, onceFn);
            handler(...args);
        };
        this.on(event, onceFn);
    }

    waitFor(event: string, handler: Function, wait: number) {
        const _handler = (...args: any[]) => {
            clearTimeout(timeout);
            handler(...args);
        };
        const timeout = setTimeout(() => {
            this.off(event, _handler);
            handler("timeout");
        }, wait);
        this.once(event, _handler);
    }

    emit(event: string, ...args: any[]) {
        this.listEvents(event).forEach((handler) => {
            handler.apply(this, args);
        });
    }

    off(event: string, handler: Function) {
        this.listEvents(event).delete(handler);
    }
}

export default EventEmitter;
