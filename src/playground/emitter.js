const soon = (() => {
    let _soon;
    return () => {
        if (!_soon) {
            _soon = Promise.resolve()
                .then(() => {
                    _soon = null;
                });
        }
        return _soon;
    };
})();

class Emitter {
    constructor() {
        Object.defineProperty(this, '_listeners', {
            value: {},
            enumerable: false
        });
    }
    on(name, listener, context) {
        if (!this._listeners[name]) {
            this._listeners[name] = [];
        }

        this._listeners[name].push(listener, context);
    }
    off(name, listener, context) {
        if (this._listeners[name]) {
            if (listener) {
                for (let i = 0; i < this._listeners[name].length; i += 2) {
                    if (
                        this._listeners[name][i] === listener &&
                        this._listeners[name][i + 1] === context) {
                        this._listeners[name].splice(i, 2);
                        i -= 2;
                    }
                }
            } else {
                for (let i = 0; i < this._listeners[name].length; i += 2) {
                    if (this._listeners[name][i + 1] === context) {
                        this._listeners[name].splice(i, 2);
                        i -= 2;
                    }
                }
            }
        }
    }
    emit(name, ...args) {
        if (this._listeners[name]) {
            for (let i = 0; i < this._listeners[name].length; i += 2) {
                this._listeners[name][i].call(this._listeners[name][i + 1] || this, ...args);
            }
        }
    }
}