'use strict';

const SLL = require('./SLL.js');

const LOCKED = 0;

// Symbol.dispose | asyncDispose - didn't work with signals
// for now, i don't see any useful way to use this API

// try {} finally {} doesn't work as expected

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
      var result = await callback.apply(null, args);
    } catch (e) {
      var error = e;
    }
    this.leave();
    if (error !== undefined) throw error;
    return result;
  }

  get empty() {
    return this.#queue.length === 0;
  }

  static for(name, options) {
    const instance = Semaphore.#repositories.get(name);
    if (instance === undefined) {
      const semaphore = new Semaphore(options);
      Semaphore.#repositories.set(name, semaphore);
      return semaphore;
    }
    return instance;
  }

  // repositories, methods 'for' and 'destroy' introduce global state for locks
  // it bring over problems when one part of the code deletes the entry
  // hence the code has link to an old semaphore and can still use it.
  // it can lead to confusion when client thinks it uses the same semaphore 
  // and rely on the locks.

  // global state will appear anyway, native and centralized approach can prevent 
  // spreading global state management over user-land code.

  // its user's responsibility to prevent confusion when
  // entry with some name deleted and created again.
  // good idea to remove such factor
  static destroy(name) {
    const instance = Semaphore.#repositories.get(name);
    if (instance === undefined) return;
    if (instance.empty) Semaphore.#repositories.delete(name);
    else throw new Error('Semaphore can\'t be deleted due to busy queue');
  }

  // possibly Weakmap, name -> Symbol.for(name) -> WeakMap
  // possibly get rid of destroy method
  static #repositories = new Map();
}

module.exports = Semaphore;
