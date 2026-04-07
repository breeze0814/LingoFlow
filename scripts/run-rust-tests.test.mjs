import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  createCargoTestSpec,
  runRustTests,
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

test('runs cargo test with an isolated target directory', async () => {
  const spawnCalls = [];
  const child = new EventEmitter();
  child.kill = () => {};

  const processApi = {
    env: { PATH: 'test-path' },
    exitCode: null,
    exit(code) {
      this.exitCode = code;
    },
    kill() {
      throw new Error('kill should not be called');
    },
    pid: 1,
  };

  const spawnImpl = (command, args, options) => {
    spawnCalls.push({ command, args, options });
    queueMicrotask(() => child.emit('exit', 0, null));
    return child;
  };

  await runRustTests({
    processApi,
    consoleApi: console,
    spawnImpl,
    timeoutMs: 100,
  });

  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].command, 'cargo');
  assert.deepEqual(spawnCalls[0].args, ['test', '--manifest-path', 'src-tauri/Cargo.toml']);
  assert.equal(
    spawnCalls[0].options.env.CARGO_TARGET_DIR,
    'src-tauri/target/verify',
  );
  assert.equal(processApi.exitCode, 0);
});
