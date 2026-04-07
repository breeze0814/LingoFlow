import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearStaleDevProcesses,
  isRepoDevBinary,
} from './tauri-dev-runner.mjs';

test('recognizes repo dev binaries on windows paths', () => {
  assert.equal(
    isRepoDevBinary('F:\\project\\ai-article-weight-reduction\\LingoFlow\\target\\debug\\lingoflow.exe'),
    true,
  );
  assert.equal(isRepoDevBinary('C:\\Windows\\System32\\notepad.exe'), false);
});

test('clears stale supervisors and repo listeners on windows', async () => {
  const killed = [];

  await clearStaleDevProcesses({
    platform: 'win32',
    protectedPids: new Set([11, 12]),
    listProcessesImpl: () => [
      { pid: 30, command: 'node scripts/run-tauri-dev.mjs' },
      { pid: 11, command: 'node current-process' },
    ],
    listListenerPidsImpl: () => [41],
    processCommandImpl: ({ pid }) =>
      pid === 41
        ? 'F:\\project\\ai-article-weight-reduction\\LingoFlow\\target\\debug\\lingoflow.exe'
        : '',
    killImpl: (pid, signal) => killed.push({ pid, signal }),
    waitForPortReleaseImpl: async () => undefined,
  });

  assert.deepEqual(killed, [
    { pid: 30, signal: 'SIGTERM' },
    { pid: 41, signal: 'SIGTERM' },
  ]);
});

test('fails fast when windows listener belongs to an external process', async () => {
  await assert.rejects(
    clearStaleDevProcesses({
      platform: 'win32',
      protectedPids: new Set(),
      listProcessesImpl: () => [],
      listListenerPidsImpl: () => [77],
      processCommandImpl: () => 'C:\\Windows\\System32\\svchost.exe',
      killImpl: () => undefined,
      waitForPortReleaseImpl: async () => undefined,
    }),
    /Port 61928 is occupied by another process/,
  );
});
