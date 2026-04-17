import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SWIFT_TEST_TIMEOUT_MS = 60_000;

export function createSwiftTestSpec() {
  return {
    command: 'swift',
    args: ['test', '--package-path', 'platform/macos/helper'],
  };
}

export function shouldSkipSwiftTests(platform = process.platform) {
  return platform !== 'darwin';
}

export function waitForChildExit(
  child,
  {
    timeoutMs,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
    killSignal = 'SIGKILL',
  },
) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeoutImpl(() => {
      timedOut = true;
      child.kill(killSignal);
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeoutImpl(timer);
      reject(error);
    });

    child.once('exit', (code, signal) => {
      clearTimeoutImpl(timer);
      resolve({
        code,
        signal,
        timedOut,
      });
    });
  });
}

export async function runSwiftTests({
  processApi = process,
  consoleApi = console,
  spawnImpl = spawn,
  timeoutMs = SWIFT_TEST_TIMEOUT_MS,
} = {}) {
  if (shouldSkipSwiftTests(processApi.platform)) {
    consoleApi.info(
      `[swift-tests] skipped on ${processApi.platform}; platform/macos/helper only runs on macOS`,
    );
    processApi.exit(0);
    return;
  }

  const spec = createSwiftTestSpec();
  const child = spawnImpl(spec.command, spec.args, {
    stdio: 'inherit',
    env: processApi.env,
  });

  try {
    const result = await waitForChildExit(child, { timeoutMs });
    if (result.timedOut) {
      consoleApi.error(`[swift-tests] timed out after ${timeoutMs}ms`);
      processApi.exit(124);
      return;
    }
    if (result.signal) {
      processApi.kill(processApi.pid, result.signal);
      return;
    }
    processApi.exit(result.code ?? 0);
  } catch (error) {
    consoleApi.error(
      `[swift-tests] ${error instanceof Error ? error.message : String(error)}`,
    );
    processApi.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runSwiftTests();
}
