import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HELPER_EXECUTABLE,
  buildMacosHelper,
  helperTargetTriple,
  shouldBuildMacosHelper,
} from './build-macos-helper.mjs';

test('build helper is only enabled on darwin', () => {
  assert.equal(shouldBuildMacosHelper('darwin'), true);
  assert.equal(shouldBuildMacosHelper('linux'), false);
  assert.equal(shouldBuildMacosHelper('win32'), false);
});

test('maps node arch to tauri sidecar target triple', () => {
  assert.equal(
    helperTargetTriple({ platform: 'darwin', arch: 'arm64' }),
    'aarch64-apple-darwin',
  );
  assert.equal(
    helperTargetTriple({ platform: 'darwin', arch: 'x64' }),
    'x86_64-apple-darwin',
  );
  assert.equal(helperTargetTriple({ platform: 'linux', arch: 'x64' }), null);
});

test('build helper skips cleanly on non-macos', () => {
  const messages = [];
  const result = buildMacosHelper({
    platform: 'linux',
    consoleApi: {
      info: (message) => messages.push(message),
    },
  });

  assert.equal(result.skipped, true);
  assert.equal(messages.some((message) => message.includes('[helper-build] skipped')), true);
});

test('build helper invokes swift build with release product settings', () => {
  const spawnCalls = [];
  const createdDirectories = [];
  const copiedFiles = [];
  const chmodCalls = [];
  const logs = [];
  const fakeFs = {
    mkdirSync: (dir) => createdDirectories.push(dir),
    existsSync: () => true,
    copyFileSync: (from, to) => copiedFiles.push({ from, to }),
    chmodSync: (target, mode) => chmodCalls.push({ target, mode }),
  };
  const result = buildMacosHelper({
    platform: 'darwin',
    arch: 'arm64',
    cwd: '/tmp/lingoflow',
    env: { PATH: '/usr/bin' },
    spawnSyncImpl: (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return { status: 0 };
    },
    fsApi: fakeFs,
    consoleApi: {
      info: (message) => logs.push(message),
    },
  });

  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].command, 'swift');
  // Normalize path separators for cross-platform testing
  const actualArgs = spawnCalls[0].args.map((arg) =>
    typeof arg === 'string' ? arg.replace(/\\/g, '/') : arg,
  );
  assert.deepEqual(actualArgs, [
    'build',
    '--configuration',
    'release',
    '--product',
    HELPER_EXECUTABLE,
    '--package-path',
    '/tmp/lingoflow/platform/macos/helper',
  ]);
  assert.equal(createdDirectories.length, 1);
  assert.equal(copiedFiles.length, 1);
  assert.equal(chmodCalls.length, 1);
  assert.equal(chmodCalls[0].mode, 0o755);
  assert.equal(result.skipped, false);
  assert.equal(
    logs.some((message) => message.includes('lingoflow-helper-aarch64-apple-darwin')),
    true,
  );
});
