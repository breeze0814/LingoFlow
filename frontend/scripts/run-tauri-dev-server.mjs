import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEV_PORT = 5173;
const DEV_HOST = '127.0.0.1';
const VITE_CLIENT_MARKER = '/@vite/client';
const APP_TITLE_MARKER = '<title>LingoFlow</title>';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const viteBin = path.resolve(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');

function fetchDevIndex() {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: DEV_HOST,
        port: DEV_PORT,
        path: '/',
        timeout: 1000,
      },
      (response) => {
        const chunks = [];
        response.setEncoding('utf8');
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            ok: response.statusCode === 200,
            body: chunks.join(''),
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => resolve(null));
  });
}

function isProjectViteServer(result) {
  if (!result?.ok) {
    return false;
  }
  return (
    result.body.includes(VITE_CLIENT_MARKER) &&
    result.body.includes(APP_TITLE_MARKER)
  );
}

function startViteDevServer() {
  const child = spawn(
    process.execPath,
    [viteBin, '--host', DEV_HOST, '--port', String(DEV_PORT), '--strictPort'],
    {
      cwd: frontendRoot,
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

const existingServer = await fetchDevIndex();

if (isProjectViteServer(existingServer)) {
  console.log(
    `[tauri-dev-server] Reusing existing Vite dev server at http://${DEV_HOST}:${DEV_PORT}`,
  );
  process.exit(0);
}

if (existingServer?.ok) {
  console.error(
    `[tauri-dev-server] Port ${DEV_PORT} is occupied by another HTTP service. Stop it or change src-tauri/tauri.conf.json devUrl.`,
  );
  process.exit(1);
}

startViteDevServer();
