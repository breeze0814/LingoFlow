import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  createSwiftTestSpec,
  runSwiftTests,
  shouldSkipSwiftTests,
  waitForChildExit,
} from './run-swift-tests.mjs';

test('builds the swift test command against the helper package', () => {
  assert.deepEqual(createSwiftTestSpec(), {
    command: 'swift',
    args: ['test', '--package-path', 'platform/macos/helper'],
  });
});

test('skips helper tests outside macOS with an explicit message', async () => {
  const logs = [];
  const processApi = {
    platform: 'win32',
    exitCode: null,
    exit(code) {
      this.exitCode = code;
    },
  };

  await runSwiftTests({
    processApi,
    consoleApi: {
      info(message) {
        logs.push(message);
      },
      error() {
        throw new Error('error should not be called');
      },
    },
    spawnImpl() {
      throw new Error('spawn should not be called when skipping');
    },
  });

  assert.equal(shouldSkipSwiftTests('win32'), true);
  assert.equal(processApi.exitCode, 0);
  assert.match(logs[0], /skipped on win32/);
});

test('runs swift test on macOS', async () => {
  const spawnCalls = [];
  const child = new EventEmitter();
  child.kill = () => {};
  const processApi = {
    env: { PATH: 'test-path' },
    platform: 'darwin',
    exitCode: null,
    exit(code) {
      this.exitCode = code;
    },
    kill() {
      throw new Error('kill should not be called');
    },
    pid: 1,
  };

  await runSwiftTests({
    processApi,
    consoleApi: console,
    spawnImpl(command, args, options) {
      spawnCalls.push({ command, args, options });
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    },
  });

  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].command, 'swift');
  assert.deepEqual(spawnCalls[0].args, ['test', '--package-path', 'platform/macos/helper']);
  assert.equal(processApi.exitCode, 0);
});

test('kills the swift child when timeout elapses', async () => {
  const child = new EventEmitter();
  let killedWithSignal = null;
  child.kill = (signal) => {
    killedWithSignal = signal;
    child.emit('exit', null, signal);
  };

  const result = await waitForChildExit(child, {
    timeoutMs: 1,
    setTimeoutImpl: setTimeout,
    clearTimeoutImpl: clearTimeout,
  });

  assert.equal(killedWithSignal, 'SIGKILL');
  assert.deepEqual(result, {
    code: null,
    signal: 'SIGKILL',
    timedOut: true,
  });
});
