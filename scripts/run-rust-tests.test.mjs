import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  createCargoTestSpec,
  waitForChildExit,
} from './run-rust-tests.mjs';

test('builds the cargo test command against the tauri manifest', () => {
  assert.deepEqual(createCargoTestSpec(), {
    command: 'cargo',
    args: ['test', '--manifest-path', 'src-tauri/Cargo.toml'],
  });
});

test('kills the child when the timeout elapses', async () => {
  const child = new EventEmitter();
  let killedWith = null;
  child.kill = (signal) => {
    killedWith = signal;
    child.emit('exit', null, signal);
  };

  const result = await waitForChildExit(child, {
    timeoutMs: 1,
    setTimeoutImpl: setTimeout,
    clearTimeoutImpl: clearTimeout,
  });

  assert.equal(killedWith, 'SIGKILL');
  assert.deepEqual(result, {
    code: null,
    signal: 'SIGKILL',
    timedOut: true,
  });
});
