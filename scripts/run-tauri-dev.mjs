import { execFileSync, spawn } from 'node:child_process';

const DEV_HTTP_PORT = 61928;
const DEV_BINARY_NAME = 'target/debug/lingoflow';
const TAURI_DEV_COMMAND_MARKER = 'tauri dev --config src-tauri/tauri.conf.json';

function currentProtectedPids() {
  return new Set([process.pid, process.ppid]);
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function listListenerPids(port) {
  if (process.platform === 'win32') {
    return [];
  }

  try {
    const output = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8' },
    ).trim();
    if (!output) {
      return [];
    }
    return output
      .split('\n')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function processCommand(pid) {
  return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
    encoding: 'utf8',
  }).trim();
}

function listProcesses() {
  return execFileSync('ps', ['-Ao', 'pid=,command='], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pidText, ...commandParts] = line.split(/\s+/);
      return {
        pid: Number.parseInt(pidText, 10),
        command: commandParts.join(' '),
      };
    })
    .filter((item) => Number.isInteger(item.pid) && item.pid > 0 && item.command);
}

function isRepoDevBinary(command) {
  return command === DEV_BINARY_NAME || command.endsWith(`/${DEV_BINARY_NAME}`);
}

function isRepoTauriDevSupervisor(command) {
  return command.includes(TAURI_DEV_COMMAND_MARKER) || command.includes('scripts/run-tauri-dev.mjs');
}

async function waitForPortRelease(port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (listListenerPids(port).length === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for port ${port} to be released`);
}

async function clearStaleDevProcesses() {
  const protectedPids = currentProtectedPids();
  const staleSupervisors = listProcesses().filter(
    (item) => !protectedPids.has(item.pid) && isRepoTauriDevSupervisor(item.command),
  );
  for (const processInfo of staleSupervisors) {
    process.kill(processInfo.pid, 'SIGTERM');
  }

  const pids = listListenerPids(DEV_HTTP_PORT);
  if (pids.length === 0) {
    return;
  }

  const occupants = pids.map((pid) => ({
    pid,
    command: processCommand(pid),
  }));
  const external = occupants.find((item) => !isRepoDevBinary(item.command));
  if (external) {
    throw new Error(
      `Port ${DEV_HTTP_PORT} is occupied by another process: ${external.command}`,
    );
  }

  for (const occupant of occupants) {
    process.kill(occupant.pid, 'SIGTERM');
  }
  await waitForPortRelease(DEV_HTTP_PORT);
}

function runTauriDev() {
  const child = spawn(
    npmCommand(),
    ['run', 'tauri', '--', 'dev', '--config', 'src-tauri/tauri.conf.json'],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

try {
  await clearStaleDevProcesses();
} catch (error) {
  console.error(`[tauri-dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

runTauriDev();
