'use strict';

class SLL {
  #head = null;
  #tail = null;

  push(value) {
    const node = { value, next: null };
    if (this.#tail === null) this.#head = node;
    else this.#tail.next = node;
    this.#tail = node;
    return node;
  }

  shift() {
    if (this.#head === null) return null;
    const head = this.#head;
    this.#head = head.next;
    head.next = null;
    if (this.#head === null) this.#tail = null;
    return head.value;
  }

  get empty() {
    return this.#head === null;
  }
}

module.exports = SLL;