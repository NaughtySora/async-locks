'use strict';

const SLL = require('./SLL.js');

const LOCKED = 0;
const BINARY = 1;

class Semaphore {
  #channels = LOCKED;
  #queue = new SLL();

  constructor(concurrency = BINARY) {
    this.#channels = concurrency;
  }

  #next() {
    if (this.#queue.empty) return;
    const resolve = this.#queue.shift();
    if (resolve === undefined) return;
    if (resolve()) process.nextTick(() => void this.#next());
  }

  enter(signal) {
    const { promise, resolve, reject } = Promise.withResolvers();
    let leave = this.#leave.bind(this);
    const wrapper = function () {
      const release = () => void (leave && (leave(), leave = null));
      Object.defineProperty(release, Symbol.dispose,
        { value: release, configurable: false, writable: false },
      );
      resolve(release);
    };
    if (this.#channels === LOCKED) {
      if (signal !== undefined) {
        const abort = () => void reject(new Error('Semaphore enter aborted'));
        signal.addEventListener('abort', abort, { once: true });
        this.#queue.push(() => {
          if (signal.aborted) return true;
          else signal.removeEventListener('abort', abort);
          wrapper();
          return false;
        });
      } else {
        this.#queue.push(() => (wrapper(), false));
      }
    }
    else (this.#channels--, wrapper());
    return promise;
  }

  #leave() {
    this.#channels++;
    this.#next();
  }

  async isolate(callback, { args, signal } = {}) {
    using _ = await this.enter(signal);
    return await callback.apply(null, args);
  }

  get empty() {
    return this.#queue.empty;
  }
}

module.exports = Semaphore;