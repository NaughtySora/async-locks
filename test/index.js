'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { misc, async } = require("naughty-util");
const Semaphore = require('../lib/Semaphore');

const CONCURRENCY = 2;
const TEST_COUNT = 10000;
const RACE_CONDITION_MESSAGE = 'race condition';

const raceCondition = async (min, max) => {
  raceCondition.count++;
  const delay = (min + max) === 0 ? 0 : misc.random(max, min);
  await async.pause(delay);
  if (raceCondition.count > CONCURRENCY) {
    throw new Error(RACE_CONDITION_MESSAGE);
  }
  raceCondition.count--;
};
Object.assign(raceCondition, { count: 0 });

describe('Semaphore', async () => {
  await it('enter - leave', async () => {
    const lock = new Semaphore(CONCURRENCY);
    const test = async () => {
      await lock.enter();
      await raceCondition(0, 0);
      lock.leave();
    };
    await Promise.all(Array.from({ length: TEST_COUNT }, test));
  });

  await it('enter - leave - signal', async () => {
    let errors = 0;
    const lock = new Semaphore(CONCURRENCY);
    const test = async () => {
      const delay = misc.random(5000, 100);
      try {
        await lock.enter(AbortSignal.timeout(delay));
        await raceCondition(0, 0);
        lock.leave();
      } catch (e) {
        if (e.message === RACE_CONDITION_MESSAGE) errors++;
      }
    };
    await Promise.all(Array.from({ length: TEST_COUNT }, test));
    assert.equal(errors, 0);
  });

  await it('isolate', async () => {
    const lock = new Semaphore(CONCURRENCY);
    await Promise.all(Array.from(
      { length: TEST_COUNT },
      lock.isolate.bind(lock, raceCondition, { args: [0, 0] }),
    ));
  });

  await it('isolate - signal', async () => {
    const lock = new Semaphore(CONCURRENCY);
    let errors = 0;
    const test = async () => {
      const delay = misc.random(5000, 100);
      const signal = AbortSignal.timeout(delay);
      try {
        return await lock.isolate(raceCondition, { args: [0, 0], signal, });
      } catch (e) {
        if (e.message === RACE_CONDITION_MESSAGE) errors++;
      }
    };
    await Promise.all(Array.from({ length: TEST_COUNT }, test));
    assert.equal(errors, 0);
  });
});

