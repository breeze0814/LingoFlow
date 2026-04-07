import { execFileSync, spawn } from 'node:child_process';

export const DEV_HTTP_PORT = 61928;
export const DEV_BINARY_NAME = 'target/debug/lingoflow';
export const TAURI_DEV_COMMAND_MARKER = 'tauri dev --config src-tauri/tauri.conf.json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimOutput(output) {
  return output.trim();
}

function parsePidList(output) {
  return trimOutput(output)
    .split('\n')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function parseWindowsProcessList(output) {
  const trimmed = trimOutput(output);
  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed);
  const entries = Array.isArray(parsed) ? parsed : [parsed];

  return entries
    .map((entry) => ({
      pid: Number.parseInt(String(entry.ProcessId ?? ''), 10),
      command: typeof entry.CommandLine === 'string' ? entry.CommandLine.trim() : '',
    }))
    .filter((entry) => Number.isInteger(entry.pid) && entry.pid > 0 && entry.command);
}

function runWindowsCommand(execFileSyncImpl, script) {
  return execFileSyncImpl(
    'powershell',
    ['-NoProfile', '-Command', script],
    { encoding: 'utf8' },
  );
}

export function currentProtectedPids(processApi = process) {
  return new Set([processApi.pid, processApi.ppid].filter((value) => Number.isInteger(value)));
}

export function npmCommand(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function listListenerPids({
  port,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
}) {
  if (platform === 'win32') {
    const output = runWindowsCommand(
      execFileSyncImpl,
      `@(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess) -join "\\n"`,
    );
    return parsePidList(output);
  }

  try {
    const output = execFileSyncImpl(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8' },
    );
    return parsePidList(output);
  } catch {
    return [];
  }
}

export function processCommand({
  pid,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
}) {
  if (platform === 'win32') {
    return trimOutput(
      runWindowsCommand(
        execFileSyncImpl,
        `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine)`,
      ),
    );
  }

  return trimOutput(
    execFileSyncImpl('ps', ['-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
    }),
  );
}

export function listProcesses({
  platform = process.platform,
  execFileSyncImpl = execFileSync,
}) {
  if (platform === 'win32') {
    return parseWindowsProcessList(
      runWindowsCommand(
        execFileSyncImpl,
        'Get-CimInstance Win32_Process | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress',
      ),
    );
  }

  return trimOutput(
    execFileSyncImpl('ps', ['-Ao', 'pid=,command='], {
      encoding: 'utf8',
    }),
  )
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

export function isRepoDevBinary(command) {
  const normalized = command.replace(/\\/g, '/').toLowerCase();
  return (
    normalized === DEV_BINARY_NAME ||
    normalized.endsWith(`/${DEV_BINARY_NAME}`) ||
    normalized.endsWith(`/${DEV_BINARY_NAME}.exe`)
  );
}

export function isRepoTauriDevSupervisor(command) {
  return (
    command.includes(TAURI_DEV_COMMAND_MARKER) || command.includes('scripts/run-tauri-dev.mjs')
  );
}

export async function waitForPortRelease({
  port,
  platform = process.platform,
  listListenerPidsImpl = listListenerPids,
  execFileSyncImpl = execFileSync,
  sleepImpl = sleep,
}) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (listListenerPidsImpl({ port, platform, execFileSyncImpl }).length === 0) {
      return;
    }
    await sleepImpl(100);
  }
  throw new Error(`Timed out waiting for port ${port} to be released`);
}

export async function clearStaleDevProcesses({
  port = DEV_HTTP_PORT,
  platform = process.platform,
  processApi = process,
  protectedPids = currentProtectedPids(processApi),
  listProcessesImpl = listProcesses,
  listListenerPidsImpl = listListenerPids,
  processCommandImpl = processCommand,
  waitForPortReleaseImpl = waitForPortRelease,
  killImpl = (pid, signal) => process.kill(pid, signal),
  execFileSyncImpl = execFileSync,
  sleepImpl = sleep,
} = {}) {
  const staleSupervisors = listProcessesImpl({ platform, execFileSyncImpl }).filter(
    (item) => !protectedPids.has(item.pid) && isRepoTauriDevSupervisor(item.command),
  );
  for (const processInfo of staleSupervisors) {
    killImpl(processInfo.pid, 'SIGTERM');
  }

  const pids = listListenerPidsImpl({ port, platform, execFileSyncImpl });
  if (pids.length === 0) {
    return;
  }

  const occupants = pids.map((pid) => ({
    pid,
    command: processCommandImpl({ pid, platform, execFileSyncImpl }),
  }));
  const external = occupants.find((item) => !isRepoDevBinary(item.command));
  if (external) {
    throw new Error(`Port ${port} is occupied by another process: ${external.command}`);
  }

  for (const occupant of occupants) {
    killImpl(occupant.pid, 'SIGTERM');
  }
  await waitForPortReleaseImpl({
    port,
    platform,
    listListenerPidsImpl,
    execFileSyncImpl,
    sleepImpl,
  });
}

export function runTauriDev({
  platform = process.platform,
  spawnImpl = spawn,
  env = process.env,
}) {
  return spawnImpl(
    npmCommand(platform),
    ['run', 'tauri', '--', 'dev', '--config', 'src-tauri/tauri.conf.json'],
    {
      stdio: 'inherit',
      env,
      shell: platform === 'win32',
    },
  );
}

export async function main({
  processApi = process,
  consoleApi = console,
  execFileSyncImpl = execFileSync,
  spawnImpl = spawn,
} = {}) {
  try {
    await clearStaleDevProcesses({
      platform: processApi.platform,
      processApi,
      execFileSyncImpl,
    });
  } catch (error) {
    consoleApi.error(`[tauri-dev] ${error instanceof Error ? error.message : String(error)}`);
    processApi.exit(1);
    return;
  }

  const child = runTauriDev({
    platform: processApi.platform,
    spawnImpl,
    env: processApi.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      processApi.kill(processApi.pid, signal);
      return;
    }
    processApi.exit(code ?? 0);
  });
}
