'use strict';

const SLL = require('./SLL.js');

const LOCKED = 0;

class Semaphore {
  #channels = LOCKED;
  #queue = new SLL();

  constructor(concurrency = 1) {
    this.#channels = concurrency;
  }

  #next() {
    if (this.#queue.length === 0) return;
    const resolve = this.#queue.shift();
    if (resolve === undefined) return;
    if (resolve()) process.nextTick(() => void this.#next());
  }

  enter(signal) {
    const { promise, resolve, reject } = Promise.withResolvers();
    if (this.#channels === LOCKED) {
      if (signal !== undefined) {
        const abort = () => void reject(new Error('Aborted'));
        signal.addEventListener('abort', abort, { once: true });
        this.#queue.push(() => {
          if (signal.aborted) return true;
          else signal.removeEventListener('abort', abort);
          resolve();
          return false;
        });
      } else {
        this.#queue.push(() => (resolve(), false));
      }
    }
    else (this.#channels--, resolve());
    return promise;
  }

  leave() {
    this.#channels++;
    this.#next();
  }

  async isolate(callback, { args, signal } = {}) {
    await this.enter(signal);
    try {
      return await callback.apply(null, args);
    } catch (e) {
      throw e;
    } finally {
      this.leave();
    }
  }

  get empty() {
    return this.#queue.length === 0;
  }

  get waiting() {
    return this.#queue.length;
  }
}

module.exports = Semaphore;
