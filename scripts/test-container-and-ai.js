#!/usr/bin/env node
/**
 * Create a llama.cpp container, run it, wait for the server, and test that
 * the AI responds to a chat request. Uses the same CLI shape as the app
 * (docker/podman create → start, then GET /health, POST /v1/chat/completions).
 *
 * Usage (from repo root):
 *   CONTAINER_TEST_MODEL=/models/path/to/model.gguf node scripts/test-container-and-ai.js
 *   CONTAINER_TEST_MODEL=/models/model.gguf CONTAINER_TEST_PORT=8081 node scripts/test-container-and-ai.js
 *
 * Optional: CONTAINER_TEST_CLEANUP=0 to leave the container running after the test.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const CONTAINER_NAME = process.env.CONTAINER_TEST_NAME || 'llamacpp-test';
const PORT = parseInt(process.env.CONTAINER_TEST_PORT || '8080', 10);
const MODEL_PATH = process.env.CONTAINER_TEST_MODEL || '';
const VOLUME_HOST = process.env.CONTAINER_TEST_VOLUME || (process.env.HOME || process.env.USERPROFILE || '') + '/.lmstudio/models';
const CLEANUP = process.env.CONTAINER_TEST_CLEANUP !== '0';

function getRuntime() {
  if (spawnSync('docker', ['--version'], { encoding: 'utf8', stdio: 'ignore' }).status === 0) return 'docker';
  if (spawnSync('podman', ['--version'], { encoding: 'utf8', stdio: 'ignore' }).status === 0) return 'podman';
  return null;
}

function run(runtime, args) {
  const r = spawnSync(runtime, args, { encoding: 'utf8' });
  return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function rm(runtime, name) {
  return run(runtime, ['rm', '-f', name]);
}

async function main() {
  console.log('1. Runtime');
  const rt = getRuntime();
  if (!rt) {
    console.error('No docker or podman found.');
    process.exit(1);
  }
  console.log('   Using:', rt);

  if (!MODEL_PATH) {
    console.error('Set CONTAINER_TEST_MODEL to a .gguf path inside the container (e.g. /models/your.gguf).');
    process.exit(1);
  }

  console.log('2. Remove existing container (if any)');
  rm(rt, CONTAINER_NAME);

  const args = [
    '--name', CONTAINER_NAME,
    '--restart', 'no',
    '--gpus', 'all',
    '--network', 'host',
    '-v', `${VOLUME_HOST}:/models`,
    '--memory', '8g',
    '--memory-swap', '8g',
    'ghcr.io/ggml-org/llama.cpp:server-cuda',
    '--host', '0.0.0.0',
    '--port', String(PORT),
    '--ctx-size', '2048',
    '-ngl', '99',
    '-m', MODEL_PATH,
  ];

  console.log('3. Create container');
  let result = run(rt, ['create', ...args]);
  if (!result.ok) {
    console.error('   Create failed:', result.stderr || result.stdout);
    process.exit(1);
  }
  console.log('   Created.');

  console.log('4. Start container');
  result = run(rt, ['start', CONTAINER_NAME]);
  if (!result.ok) {
    console.error('   Start failed:', result.stderr || result.stdout);
    rm(rt, CONTAINER_NAME);
    process.exit(1);
  }
  console.log('   Started.');

  const baseUrl = `http://localhost:${PORT}`;

  console.log('5. Wait for server (up to 120s)');
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(baseUrl + '/health', { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!ready) {
    console.error('   Server did not become ready in time. Check logs: ' + rt + ' logs ' + CONTAINER_NAME);
    if (CLEANUP) {
      run(rt, ['stop', CONTAINER_NAME]);
      rm(rt, CONTAINER_NAME);
    }
    process.exit(1);
  }
  console.log('   Server ready.');

  console.log('6. Test chat completion (POST /v1/chat/completions)');
  let chatOk = false;
  try {
    const res = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json().catch(() => ({}));
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (res.ok && content != null && String(content).trim().length > 0) {
      chatOk = true;
      console.log('   Response:', String(content).trim().slice(0, 80) + (String(content).length > 80 ? '…' : ''));
    } else {
      console.error('   Unexpected response:', res.status, JSON.stringify(data).slice(0, 200));
    }
  } catch (err) {
    console.error('   Request failed:', err.message || err);
  }

  if (CLEANUP) {
    console.log('7. Stop and remove container');
    run(rt, ['stop', CONTAINER_NAME]);
    rm(rt, CONTAINER_NAME);
  } else {
    console.log('7. Leaving container running (CONTAINER_TEST_CLEANUP=0)');
  }

  if (!chatOk) {
    process.exit(1);
  }
  console.log('Done. Container created, run, and AI responded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
