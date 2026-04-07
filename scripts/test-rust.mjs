import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 60_000;
const CARGO_ARGS = ['test', '--manifest-path', 'src-tauri/Cargo.toml'];

async function main() {
  const extraArgs = process.argv.slice(2);
  const exitCode = await runCargoTest([...CARGO_ARGS, ...extraArgs], DEFAULT_TIMEOUT_MS);
  process.exit(exitCode);
}

function runCargoTest(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('cargo', args, {
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`cargo test timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timeoutId);
      resolve(code ?? 1);
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
