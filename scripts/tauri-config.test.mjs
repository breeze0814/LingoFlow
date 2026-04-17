import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

test('resolves frontendDist to the built frontend assets directory', () => {
  const resolvedFrontendDist = path.resolve(
    path.dirname(tauriConfigPath),
    tauriConfig.build.frontendDist,
  );

  assert.equal(
    resolvedFrontendDist,
    path.join(repoRoot, 'frontend', 'dist'),
  );
});

test('uses a bundle identifier without the macOS app suffix', () => {
  assert.equal(tauriConfig.identifier.endsWith('.app'), false);
});

test('declares the macOS helper as a bundled external binary', () => {
  assert.deepEqual(tauriConfig.bundle.externalBin, ['binaries/lingoflow-helper']);
});
