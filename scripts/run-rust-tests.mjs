import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RUST_TEST_TIMEOUT_MS = 60_000;
const RUST_TEST_TARGET_DIR = 'src-tauri/target/verify';

export function createCargoTestSpec() {
  return {
    command: 'cargo',
    args: ['test', '--manifest-path', 'src-tauri/Cargo.toml'],
  };
}

export function createCargoTestEnv(env = process.env) {
  return {
    ...env,
    CARGO_TARGET_DIR: env.CARGO_TARGET_DIR ?? RUST_TEST_TARGET_DIR,
  };
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

export async function runRustTests({
  processApi = process,
  consoleApi = console,
  spawnImpl = spawn,
  timeoutMs = RUST_TEST_TIMEOUT_MS,
} = {}) {
  const spec = createCargoTestSpec();
  const child = spawnImpl(spec.command, spec.args, {
    stdio: 'inherit',
    env: createCargoTestEnv(processApi.env),
  });

  try {
    const result = await waitForChildExit(child, { timeoutMs });
    if (result.timedOut) {
      consoleApi.error(`[rust-tests] timed out after ${timeoutMs}ms`);
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
      `[rust-tests] ${error instanceof Error ? error.message : String(error)}`,
    );
    processApi.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runRustTests();
}
