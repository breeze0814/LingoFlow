import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HELPER_EXECUTABLE = 'lingoflow-helper';
export const HELPER_PACKAGE_RELATIVE_PATH = path.join('platform', 'macos', 'helper');
export const TAURI_BINARIES_RELATIVE_PATH = path.join('src-tauri', 'binaries');

export function shouldBuildMacosHelper(platform = process.platform) {
  return platform === 'darwin';
}

export function helperTargetTriple({
  platform = process.platform,
  arch = process.arch,
} = {}) {
  if (platform !== 'darwin') {
    return null;
  }
  if (arch === 'arm64') {
    return 'aarch64-apple-darwin';
  }
  if (arch === 'x64') {
    return 'x86_64-apple-darwin';
  }
  throw new Error(`[helper-build] unsupported macOS architecture: ${arch}`);
}

export function buildMacosHelper({
  platform = process.platform,
  arch = process.arch,
  cwd = process.cwd(),
  env = process.env,
  spawnSyncImpl = spawnSync,
  fsApi = fs,
  consoleApi = console,
} = {}) {
  if (!shouldBuildMacosHelper(platform)) {
    consoleApi.info(`[helper-build] skipped on ${platform}`);
    return { skipped: true };
  }

  const targetTriple = helperTargetTriple({ platform, arch });
  if (!targetTriple) {
    throw new Error('[helper-build] missing target triple for macOS helper build');
  }

  const helperPackagePath = path.join(cwd, HELPER_PACKAGE_RELATIVE_PATH);
  const helperSourceBinary = path.join(
    helperPackagePath,
    '.build',
    'release',
    HELPER_EXECUTABLE,
  );
  const tauriBinariesDir = path.join(cwd, TAURI_BINARIES_RELATIVE_PATH);
  const helperDistBinary = path.join(
    tauriBinariesDir,
    `${HELPER_EXECUTABLE}-${targetTriple}`,
  );

  fsApi.mkdirSync(tauriBinariesDir, { recursive: true });
  const buildResult = spawnSyncImpl(
    'swift',
    [
      'build',
      '--configuration',
      'release',
      '--product',
      HELPER_EXECUTABLE,
      '--package-path',
      helperPackagePath,
    ],
    { stdio: 'inherit', env },
  );
  if (buildResult.error) {
    throw buildResult.error;
  }
  if (buildResult.status !== 0) {
    throw new Error(
      `[helper-build] swift build failed with exit code ${buildResult.status ?? 'unknown'}`,
    );
  }

  if (!fsApi.existsSync(helperSourceBinary)) {
    throw new Error(
      `[helper-build] expected helper binary not found: ${helperSourceBinary}`,
    );
  }
  fsApi.copyFileSync(helperSourceBinary, helperDistBinary);
  fsApi.chmodSync(helperDistBinary, 0o755);

  consoleApi.info(`[helper-build] built ${helperDistBinary}`);
  return { skipped: false, output: helperDistBinary };
}

export function main({
  processApi = process,
  consoleApi = console,
  buildMacosHelperImpl = buildMacosHelper,
} = {}) {
  try {
    buildMacosHelperImpl({
      platform: processApi.platform,
      arch: processApi.arch,
      cwd: processApi.cwd(),
      env: processApi.env,
      consoleApi,
    });
    processApi.exit(0);
  } catch (error) {
    consoleApi.error(`[helper-build] ${error instanceof Error ? error.message : String(error)}`);
    processApi.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
