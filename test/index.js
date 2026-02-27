'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { misc, async } = require("naughty-util");
const Semaphore = require('../lib/Semaphore');

const raceCondition = async (min, max) => {
  raceCondition.count++;
  await async.pause(misc.random(max, min));
  if (raceCondition.count > COUNT) {
    throw new Error('race condition');
  }
  raceCondition.count--;
};
Object.assign(raceCondition, { count: 0 });

const CONCURRENCY = 2;

describe('Semaphore', async () => {
  const lock = new Semaphore(CONCURRENCY);

  await it('enter - leave', async () => {
    await lock.enter();
    await raceCondition(0, 0);
    lock.leave();
  });

  await it('enter - leave - signal', async () => {
    const errors = [];
    try {
      await lock.enter(AbortSignal.timeout(misc.random(5000, 100)));
      await raceCondition(0, 0);
      lock.leave();
    } catch (e) { }
  });

  await it('isolate', async () => {
    await lock.isolate(raceCondition, { args: [0, 0] });
  });

  await it('isolate - signal', async () => {
    const errors = [];
    try {
      await lock.isolate(raceCondition, {
        args: [0, 0],
        signal: AbortSignal.timeout(misc.random(5000, 100))
      });
    } catch (e) { }
  });
});

