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
        signal.addEventListener('abort', abort);
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
    if (error) throw error;
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

  // when one part of code uses semaphore, someone deleted it, and created new one with the same name
  // can be confusing that one part of the code has a link to old instances and still can use it
  // but another part of the code has new link to a new semaphore

  // so we introduce global state and allow code to mutate this state
  // if we remove destroy method it leads to potential memory leaks
  // if we remove for method it leads to self construction repository/singleton and providing global access 
  // to it, so the repositories spread around user code.

  static destroy(name) {
    const instance = Semaphore.#repositories.get(name);
    if (instance === undefined) return;
    if (instance.empty) Semaphore.#repositories.delete(name);
    else throw new Error('Semaphore can\'t be deleted due to busy queue');
  }

  static #repositories = new Map();
}

module.exports = Semaphore;
