const { app, BrowserWindow, ipcMain, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

// Non-internal IPv4 (LAN address) for "other devices" URL; re-fetched each call so it stays correct
function getLocalAddresses() {
  const candidates = [];
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      const isLikelyDocker = /^docker|veth|br-|virbr/i.test(name);
      for (const net of nets[name]) {
        const isV4 = net.family === 'IPv4' || (typeof net.family === 'number' && net.family === 4);
        if (!isV4 || net.internal) continue;
        const addr = (net.address || '').trim();
        if (!addr || addr.startsWith('127.')) continue;
        candidates.push({ address: addr, prefer: !isLikelyDocker });
      }
    }
    const preferred = candidates.find((c) => c.prefer);
    const lanIp = (preferred || candidates[0]) ? (preferred || candidates[0]).address : null;
    return { lanIp: lanIp || null };
  } catch (_) {
    return { lanIp: null };
  }
}

// Allow running on Linux without setuid chrome-sandbox
app.commandLine.appendSwitch('no-sandbox');

let mainWindow = null;
let logProcess = null;

// ---- Container runtime: Docker or Podman (auto-detect, prefer Docker) ----
let _containerRuntime = null;
function getContainerRuntime() {
  if (_containerRuntime) return _containerRuntime;
  const hasDocker = spawnSync('docker', ['--version'], { encoding: 'utf8', stdio: 'ignore' }).status === 0;
  const hasPodman = spawnSync('podman', ['--version'], { encoding: 'utf8', stdio: 'ignore' }).status === 0;
  _containerRuntime = hasDocker ? 'docker' : hasPodman ? 'podman' : 'docker';
  return _containerRuntime;
}

// ---- Container run/create/stop/status (same CLI for docker and podman) ----
function buildDockerContainerArgs(config) {
  const network = config.network || 'host';
  const port = Number(config.port) || 8080;
  const dockerArgs = [
    '--name', config.containerName || 'llamacpp',
    '--restart', config.restart || 'always',
    ...(config.gpus == null || String(config.gpus).toLowerCase().trim() !== 'none' ? ['--gpus', (config.gpus && String(config.gpus).toLowerCase().trim() !== 'none') ? config.gpus : 'all'] : []),
    '--network', network,
    '-v', `${config.volumeHost || ''}:/models`,
    '--memory', config.memory || '24g',
    '--memory-swap', config.memorySwap || '32g',
    config.image || 'ghcr.io/ggml-org/llama.cpp:server-cuda',
    '--host', config.host || '0.0.0.0',
    '--port', String(port),
    ...(network === 'bridge' ? ['-p', `${port}:${port}`] : []),
    '--ctx-size', String(config.ctxSize || 32768),
    '-ngl', String(config.ngl ?? 99),
  ];
  if (config.modelPath && String(config.modelPath).trim()) {
    dockerArgs.push('-m', String(config.modelPath).trim());
  }
  if (config.threads != null && config.threads !== '') {
    dockerArgs.push('-t', String(config.threads));
  }
  if (config.threadsBatch != null && config.threadsBatch !== '') {
    dockerArgs.push('-tb', String(config.threadsBatch));
  }
  if (config.batchSize != null && config.batchSize !== '') {
    dockerArgs.push('-b', String(config.batchSize));
  }
  if (config.parallel != null && config.parallel !== '') {
    dockerArgs.push('-np', String(config.parallel));
  }
  if (config.contBatching) {
    dockerArgs.push('-cb');
  }
  if (config.contextShift) {
    dockerArgs.push('--context-shift');
  }
  if (config.cachePrompt === false) {
    dockerArgs.push('--no-cache-prompt');
  }
  if (config.cacheReuse != null && config.cacheReuse !== '' && parseInt(config.cacheReuse, 10) > 0) {
    dockerArgs.push('--cache-reuse', String(config.cacheReuse).trim());
  }
  if (config.cacheTypeK && String(config.cacheTypeK).trim()) {
    dockerArgs.push('--cache-type-k', String(config.cacheTypeK).trim());
  }
  if (config.cacheTypeV && String(config.cacheTypeV).trim()) {
    dockerArgs.push('--cache-type-v', String(config.cacheTypeV).trim());
  }
  if (config.cacheRam != null && config.cacheRam !== '') {
    dockerArgs.push('-cram', String(config.cacheRam).trim());
  }
  if (config.ctxCheckpoints != null && config.ctxCheckpoints !== '' && parseInt(config.ctxCheckpoints, 10) >= 0) {
    dockerArgs.push('--ctx-checkpoints', String(config.ctxCheckpoints).trim());
  }
  if (config.kvUnified === false) {
    dockerArgs.push('--no-kv-unified');
  }
  if (config.sleepIdleSeconds != null && config.sleepIdleSeconds !== '' && parseInt(config.sleepIdleSeconds, 10) > 0) {
    dockerArgs.push('--sleep-idle-seconds', String(config.sleepIdleSeconds).trim());
  }
  return dockerArgs;
}

function dockerRun(config) {
  const rt = getContainerRuntime();
  return spawn(rt, ['run', '-d', ...buildDockerContainerArgs(config)], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerCreate(config) {
  const rt = getContainerRuntime();
  return spawn(rt, ['create', ...buildDockerContainerArgs(config)], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerStop(containerName) {
  const rt = getContainerRuntime();
  return spawn(rt, ['stop', containerName || 'llamacpp'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

// Update container restart policy so it stays stopped (otherwise --restart always restarts it)
function dockerUpdateRestartNo(containerName) {
  const rt = getContainerRuntime();
  return spawn(rt, ['update', '--restart=no', containerName || 'llamacpp'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerRm(containerName) {
  const rt = getContainerRuntime();
  return spawn(rt, ['rm', '-f', containerName || 'llamacpp'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerInspect(containerName) {
  return new Promise((resolve, reject) => {
    const rt = getContainerRuntime();
    const p = spawn(rt, ['inspect', '--format', '{{.State.Running}}', containerName || 'llamacpp'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => {
      if (code === 0) resolve({ running: out.trim() === 'true' });
      else resolve({ running: false, error: err || 'not found' });
    });
    p.on('error', reject);
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty() && (icon.getSize().width !== 256 || icon.getSize().height !== 256)) {
    icon = icon.resize({ width: 256, height: 256 });
  }
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'llamacpp droid',
  });
  if (!icon.isEmpty()) {
    mainWindow.setIcon(icon);
  }

  mainWindow.loadFile('index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    stopStream();
    mainWindow = null;
  });
}

function stopStream() {
  if (logProcess) {
    logProcess.kill('SIGTERM');
    logProcess = null;
  }
}

ipcMain.handle('log-stream:start', async (_, containerName = 'llamacpp') => {
  stopStream();
  const name = String(containerName).trim() || 'llamacpp';
  const inspect = await dockerInspect(name);
  const noContainer = inspect.error && (inspect.error.includes('No such container') || inspect.error.includes('no such container'));
  if (noContainer && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-stream:error', `Container "${name}" does not exist. Create and run it from the Container tab first.`);
    mainWindow.webContents.send('log-stream:closed', { code: 1, signal: null });
    return { ok: false, error: 'no such container' };
  }

  const rt = getContainerRuntime();
  logProcess = spawn(rt, ['logs', '-f', '--tail', '500', name], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  logProcess.stdout.setEncoding('utf8');
  logProcess.stderr.setEncoding('utf8');

  const send = (chunk) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-stream:data', chunk);
    }
  };

  logProcess.stdout.on('data', send);
  logProcess.stderr.on('data', send);

  logProcess.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-stream:error', err.message);
    }
  });

  logProcess.on('close', (code, signal) => {
    logProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-stream:closed', { code, signal });
    }
  });

  return { ok: true };
});

ipcMain.handle('log-stream:stop', () => {
  stopStream();
  return { ok: true };
});

// Remove existing container then run (idempotent start)
ipcMain.handle('docker:run', async (_, config) => {
  const name = config.containerName || 'llamacpp';
  return new Promise((resolve) => {
    const doRun = () => {
      const p = dockerRun(config);
      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (c) => { stdout += c; });
      p.stderr.on('data', (c) => { stderr += c; });
      p.on('close', (code) => {
        if (code === 0) resolve({ ok: true, stdout: stdout.trim() });
        else resolve({ ok: false, error: stderr.trim() || stdout.trim() || 'docker run failed' });
      });
      p.on('error', (err) => resolve({ ok: false, error: err.message }));
    };
    const rm = dockerRm(name);
    let re = '';
    rm.stderr.on('data', (c) => { re += c; });
    rm.on('close', () => doRun());
    rm.on('error', () => doRun());
  });
});

// Remove existing container then create (idempotent create, container not started)
ipcMain.handle('docker:create', async (_, config) => {
  const name = config.containerName || 'llamacpp';
  return new Promise((resolve) => {
    const doCreate = () => {
      const p = dockerCreate(config);
      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (c) => { stdout += c; });
      p.stderr.on('data', (c) => { stderr += c; });
      p.on('close', (code) => {
        if (code === 0) resolve({ ok: true, stdout: stdout.trim() });
        else resolve({ ok: false, error: stderr.trim() || stdout.trim() || 'docker create failed' });
      });
      p.on('error', (err) => resolve({ ok: false, error: err.message }));
    };
    const rm = dockerRm(name);
    rm.on('close', () => doCreate());
    rm.on('error', () => doCreate());
  });
});

ipcMain.handle('docker:stop', async (_, containerName) => {
  const name = containerName || 'llamacpp';
  // First set restart=no so the container stays stopped (default --restart always would restart it)
  const updateDone = new Promise((resolve) => {
    const p = dockerUpdateRestartNo(name);
    let stderr = '';
    p.stderr.on('data', (c) => { stderr += c; });
    p.on('close', (code) => resolve({ ok: code === 0 }));
    p.on('error', () => resolve({ ok: false }));
  });
  await updateDone;
  // Then stop the container
  return new Promise((resolve) => {
    const p = dockerStop(name);
    let stderr = '';
    p.stderr.on('data', (c) => { stderr += c; });
    p.on('close', (code) => {
      resolve({ ok: code === 0, error: code !== 0 ? stderr.trim() : null });
    });
    p.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
});

ipcMain.handle('docker:status', async (_, containerName) => {
  return dockerInspect(containerName || 'llamacpp');
});

ipcMain.handle('container-runtime:get', () => {
  return { runtime: getContainerRuntime() };
});

function presetConfig(containerName, preset, volumeHost, opts = {}) {
  const base = {
    containerName: containerName || 'llamacpp',
    image: 'ghcr.io/ggml-org/llama.cpp:server-cuda',
    volumeHost: volumeHost || '/home/zerwiz/.lmstudio/models',
    host: '0.0.0.0',
    port: 8080,
    memory: '24g',
    memorySwap: '32g',
    restart: 'always',
    network: 'host',
    gpus: 'all',
    contextShift: !!opts.contextShift,
    cachePrompt: true,
    cacheReuse: opts.cacheReuse != null && String(opts.cacheReuse).trim() !== '' ? String(opts.cacheReuse).trim() : undefined,
    cacheRam: opts.cacheRam != null && String(opts.cacheRam).trim() !== '' ? String(opts.cacheRam).trim() : undefined,
  };
  if (preset === 'heavy') {
    const heavyModel = (opts.heavyModelPath && opts.heavyModelPath.trim()) || '/models/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q3_K_S.gguf';
    const cache = (opts.heavyCache && opts.heavyCache.trim()) || 'q4_0';
    return {
      ...base,
      modelPath: heavyModel,
      ctxSize: opts.heavyCtx != null && opts.heavyCtx !== '' ? parseInt(String(opts.heavyCtx), 10) : 20000,
      ngl: opts.heavyNgl != null && opts.heavyNgl !== '' ? parseInt(String(opts.heavyNgl), 10) : 42,
      cacheTypeK: cache,
      cacheTypeV: cache,
    };
  }
  const lightModel = (opts.lightModelPath && opts.lightModelPath.trim()) || '/models/path/to/small-model.gguf';
  return {
    ...base,
    modelPath: lightModel,
    ctxSize: opts.lightCtx != null && opts.lightCtx !== '' ? parseInt(String(opts.lightCtx), 10) : 4096,
    ngl: opts.lightNgl != null && opts.lightNgl !== '' ? parseInt(String(opts.lightNgl), 10) : 99,
  };
}

ipcMain.handle('docker:runPreset', async (_, { containerName, preset, volumeHost, lightModelPath, heavyModelPath, heavyCtx, heavyNgl, heavyCache, lightCtx, lightNgl, contextShift, cacheReuse, cacheRam }) => {
  const name = containerName || 'llamacpp';
  const config = presetConfig(name, preset, volumeHost, {
    lightModelPath,
    heavyModelPath,
    heavyCtx,
    heavyNgl,
    heavyCache,
    lightCtx,
    lightNgl,
    contextShift,
    cacheReuse,
    cacheRam,
  });
  return new Promise((resolve) => {
    const doRun = () => {
      const p = dockerRun(config);
      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (c) => { stdout += c; });
      p.stderr.on('data', (c) => { stderr += c; });
      p.on('close', (code) => {
        if (code === 0) resolve({ ok: true, stdout: stdout.trim() });
        else resolve({ ok: false, error: stderr.trim() || stdout.trim() || 'docker run failed' });
      });
      p.on('error', (err) => resolve({ ok: false, error: err.message }));
    };
    const rm = dockerRm(name);
    rm.on('close', () => doRun());
    rm.on('error', () => doRun());
  });
});

ipcMain.handle('find-gguf', () => {
  return new Promise((resolve) => {
    // Search $HOME and common model locations; only include dirs that exist. -iname for .GGUF/.gguf
    const script = `
      roots="$HOME"
      [ -d /data ] && roots="$roots /data"
      [ -d /mnt ] && roots="$roots /mnt"
      [ -d /media ] && roots="$roots /media"
      [ -d "$HOME/.cache" ] && roots="$roots $HOME/.cache"
      [ -d "$HOME/models" ] && roots="$roots $HOME/models"
      for r in $roots; do find "$r" -type f -iname "*.gguf" 2>/dev/null; done | sort -u
    `;
    const child = spawn('sh', ['-c', script.trim()], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => { out += c; });
    child.on('close', (code) => {
      const paths = out.split('\n').map((p) => p.trim()).filter(Boolean);
      resolve({ paths });
    });
    child.on('error', (err) => resolve({ paths: [], error: err.message }));
  });
});

function runCommand(cmd, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ stdout, stderr, error: 'timeout' });
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, error: code === 0 ? null : (stderr || 'exit ' + code) });
    });
    child.on('error', (err) => {
      clearTimeout(t);
      resolve({ stdout: '', stderr: '', error: err.message });
    });
  });
}

ipcMain.handle('monitor:nvidia-smi', () => runCommand('nvidia-smi', []));
ipcMain.handle('monitor:top', () => runCommand('top', ['-b', '-n', '1']));
ipcMain.handle('monitor:memory', () => runCommand('free', ['-h']));
ipcMain.handle('monitor:disk', () => runCommand('df', ['-h']));
ipcMain.handle('monitor:container-stats', () => {
  const rt = getContainerRuntime();
  return runCommand(rt, ['stats', '--no-stream']);
});
ipcMain.handle('monitor:network', () => runCommand('ss', ['-tuln']));
ipcMain.handle('monitor:gpu-query', () =>
  runCommand('nvidia-smi', [
    '--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw',
    '--format=csv',
  ]));
ipcMain.handle('monitor:health', (_, url) => {
  const base = (url || 'http://localhost:8080').replace(/\/+$/, '');
  const healthUrl = base + '/health';
  return runCommand('curl', ['-s', '--connect-timeout', '2', healthUrl], 3000);
});
ipcMain.handle('monitor:metrics', (_, url) => {
  const base = (url || 'http://localhost:8080').replace(/\/+$/, '');
  const metricsUrl = base + '/metrics';
  return runCommand('curl', ['-s', '--connect-timeout', '2', metricsUrl], 5000);
});
ipcMain.handle('monitor:sensors', () => runCommand('sensors', []));

// Detect which monitor features are available on this system (used to show/hide Monitor tab blocks)
ipcMain.handle('monitor:capabilities', async () => {
  const [nvidiaResult, sensorsResult] = await Promise.all([
    runCommand('nvidia-smi', [], 2000),
    runCommand('sensors', [], 2000),
  ]);
  return {
    nvidiaSmi: !nvidiaResult.error,
    sensors: !sensorsResult.error,
  };
});
ipcMain.handle('monitor:logs-tail', (_, containerName, tail) => {
  const rt = getContainerRuntime();
  const n = Math.min(Math.max(parseInt(tail, 10) || 30, 5), 200);
  return runCommand(rt, ['logs', '--tail', String(n), containerName || 'llamacpp']);
});

// ---- Models: Hugging Face and Ollama ----
function listHfRepoTree(repo, revision = 'main') {
  return new Promise((resolve, reject) => {
    const url = `https://huggingface.co/api/models/${encodeURIComponent(repo)}/tree/${encodeURIComponent(revision)}`;
    const req = https.get(url, { headers: { 'User-Agent': 'llamacpp-droid' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const loc = res.headers.location;
        if (loc) return listHfRepoTreeFromUrl(loc).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tree = Array.isArray(json) ? json : (json.tree || []);
          const files = tree.filter((e) => e.type === 'file' && e.path && e.path.toLowerCase().endsWith('.gguf')).map((e) => ({ path: e.path, size: e.size || (e.lfs && e.lfs.size) || null }));
          resolve({ files, error: null });
        } catch (e) {
          resolve({ files: [], error: e.message || 'Invalid response' });
        }
      });
    });
    req.on('error', (e) => resolve({ files: [], error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ files: [], error: 'Timeout' }); });
  });
}

function listHfRepoTreeFromUrl(fullUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { 'User-Agent': 'llamacpp-droid' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tree = Array.isArray(json) ? json : (json.tree || []);
          const files = tree.filter((e) => e.type === 'file' && e.path && e.path.toLowerCase().endsWith('.gguf')).map((e) => ({ path: e.path, size: e.size || (e.lfs && e.lfs.size) || null }));
          resolve({ files, error: null });
        } catch (e) {
          resolve({ files: [], error: e.message || 'Invalid response' });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

ipcMain.handle('models:list-hf-files', async (_, repo) => {
  const r = (repo || '').trim().replace(/^\/+|\/+$/g, '');
  if (!r) return { files: [], error: 'Repo ID required (e.g. owner/repo)' };
  return listHfRepoTree(r);
});

ipcMain.handle('models:download-hf-file', async (event, repo, filePath, destDir) => {
  const r = (repo || '').trim().replace(/^\/+|\/+$/g, '');
  const fp = (filePath || '').trim();
  const dest = (destDir || '').trim();
  if (!r || !fp || !dest) return { ok: false, error: 'Repo, file path and destination directory required' };
  const webContents = event.sender;
  const sendProgress = (p) => {
    try { webContents.send('models:hf-download-progress', p); } catch (_) {}
  };
  const url = `https://huggingface.co/${r}/resolve/main/${fp.split('/').map((s) => encodeURIComponent(s)).join('/')}`;
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'llamacpp-droid' } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const total = res.headers.get('content-length') ? parseInt(res.headers.get('content-length'), 10) : null;
    const outPath = path.join(dest, path.basename(fp));
    const file = fs.createWriteStream(outPath);
    const reader = res.body.getReader();
    let loaded = 0;
    await new Promise((resolveStream, rejectStream) => {
      const pump = () => {
        reader.read().then(({ value, done }) => {
          if (done) {
            file.end();
            sendProgress({ done: true, path: outPath });
            file.on('finish', () => resolveStream());
            return;
          }
          file.write(Buffer.from(value));
          loaded += value.length;
          sendProgress({ loaded, total, percent: total ? Math.round((loaded / total) * 100) : null });
          pump();
        }).catch(rejectStream);
      };
      file.on('error', rejectStream);
      pump();
    });
    return { ok: true, path: outPath, error: null };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('models:ollama-pull', (event, modelName) => {
  const name = (modelName || '').trim();
  if (!name) return Promise.resolve({ ok: false, error: 'Model name required (e.g. qwen2.5-coder:7b)' });
  return new Promise((resolve) => {
    const child = spawn('ollama', ['pull', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    const webContents = event.sender;
    const send = (chunk) => {
      try { webContents.send('models:ollama-pull-output', chunk); } catch (_) {}
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => send(c));
    child.stderr.on('data', (c) => send(c));
    child.on('close', (code) => {
      resolve({ ok: code === 0, error: code === 0 ? null : `Exit ${code}` });
    });
    child.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
});

ipcMain.handle('dialog:show-open-directory', async () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { path: null, error: 'No window' };
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return { path: null, error: null };
  return { path: result.filePaths[0], error: null };
});

ipcMain.handle('dialog:show-open-files', async (_, opts) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { paths: [], error: 'No window' };
  const filters = (opts && opts.filters) || [{ name: 'Text', extensions: ['txt', 'md', 'json'] }];
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: filters,
  });
  if (result.canceled || !result.filePaths.length) return { paths: [], error: null };
  return { paths: result.filePaths, error: null };
});

ipcMain.handle('app:open-url', (_, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false, error: 'Invalid URL' };
});

ipcMain.handle('app:open-rag-doc', () => {
  const appRoot = path.join(app.getAppPath(), '..', '..');
  const ragDoc = path.join(appRoot, 'docs', 'RAG.md');
  if (!fs.existsSync(ragDoc)) {
    return Promise.resolve({ ok: false, error: 'docs/RAG.md not found' });
  }
  return shell.openPath(ragDoc).then((err) => ({ ok: !err, error: err || null }));
});

ipcMain.handle('app:open-zed-doc', () => {
  const appRoot = path.join(app.getAppPath(), '..', '..');
  const zedDoc = path.join(appRoot, 'docs', 'ZED_IDE.md');
  if (!fs.existsSync(zedDoc)) {
    return Promise.resolve({ ok: false, error: 'docs/ZED_IDE.md not found' });
  }
  return shell.openPath(zedDoc).then((err) => ({ ok: !err, error: err || null }));
});

ipcMain.handle('app:open-help-doc', () => {
  const appRoot = path.join(app.getAppPath(), '..', '..');
  const helpDoc = path.join(appRoot, 'README.md');
  if (!fs.existsSync(helpDoc)) {
    return Promise.resolve({ ok: false, error: 'README.md not found' });
  }
  return shell.openPath(helpDoc).then((err) => ({ ok: !err, error: err || null }));
});

ipcMain.handle('app:get-local-addresses', () => Promise.resolve(getLocalAddresses()));

// RAG plugin (optional): document retrieval uses LangChain + LanceDB; chat works without it
ipcMain.handle('rag:plugin-available', async () => {
  try {
    const rag = require('./rag-service.js');
    const err = rag.loadDeps();
    return { available: !err, error: err || null };
  } catch (e) {
    return { available: false, error: e.message || 'RAG plugin not installed' };
  }
});

function getRagService() {
  const rag = require('./rag-service.js');
  if (rag.loadDeps()) return null;
  return rag;
}

ipcMain.handle('rag:init', async (_, config) => {
  try {
    const rag = getRagService();
    if (!rag) return { ok: false, error: 'RAG plugin not installed' };
    const cfg = config || {};
    if (!cfg.storagePath) cfg.storagePath = path.join(app.getPath('userData'), 'rag');
    return rag.initRag(cfg);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rag:ingest', async (_, opts) => {
  try {
    const rag = getRagService();
    if (!rag) return { ok: false, error: 'RAG plugin not installed' };
    await rag.initRag({ storagePath: path.join(app.getPath('userData'), 'rag') });
    return await rag.ingestDocuments(opts || {});
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('rag:retrieve', async (_, opts) => {
  try {
    const rag = getRagService();
    if (!rag) return { ok: false, chunks: [], error: 'RAG plugin not installed' };
    await rag.initRag({ storagePath: path.join(app.getPath('userData'), 'rag') });
    return await rag.retrieve(opts || {});
  } catch (e) {
    return { ok: false, chunks: [], error: e.message || String(e) };
  }
});

// RAG: chat with optional context and message history (same llama.cpp server as Web UI)
ipcMain.handle('rag:query', async (_, { serverUrl, context, messageHistory, newUserMessage }) => {
  const base = (serverUrl || 'http://localhost:8080').trim().replace(/\/+$/, '');
  const url = base + '/v1/chat/completions';
  const messages = [];
  if (context && String(context).trim()) {
    messages.push({ role: 'system', content: String(context).trim() });
  }
  const history = Array.isArray(messageHistory) ? messageHistory : [];
  history.forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && m.content != null) {
      messages.push({ role: m.role, content: String(m.content).trim() });
    }
  });
  const userContent = String(newUserMessage != null ? newUserMessage : '').trim() || 'Hello';
  messages.push({ role: 'user', content: userContent });
  const body = { model: 'llama', messages, stream: false };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error?.message || data.message || res.statusText || `HTTP ${res.status}`;
      return { ok: false, content: '', error: errMsg };
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    return { ok: true, content, error: null };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out' : (err.message || String(err));
    return { ok: false, content: '', error: msg };
  }
});

ipcMain.handle('app:run-update', () => {
  const appRoot = path.join(app.getAppPath(), '..', '..');
  const updateScript = path.join(appRoot, 'update.sh');
  if (!fs.existsSync(updateScript)) {
    return Promise.resolve({ ok: false, error: 'update.sh not found', stdout: '', stderr: '' });
  }
  return new Promise((resolve) => {
    const child = spawn('bash', [updateScript], {
      cwd: appRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        error: code === 0 ? null : (stderr || `Exit ${code}`),
      });
    });
    child.on('error', (err) => resolve({ ok: false, stdout: '', stderr: '', error: err.message }));
  });
});

// Preview full docker run command for a config (for config/env view)
function getDockerRunCommand(config) {
  const rt = getContainerRuntime();
  const args = buildDockerContainerArgs(config);
  const quoted = args.map((a) => {
    const s = String(a);
    if (/[\s'"\\]/.test(s)) return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "'\\''") + "'";
    return s;
  });
  return rt + ' run -d ' + quoted.join(' ');
}

ipcMain.handle('app:get-docker-run-preview', (_, config) => {
  try {
    const command = getDockerRunCommand(config);
    return { ok: true, command, config };
  } catch (err) {
    return { ok: false, command: '', config: null, error: err && err.message ? err.message : String(err) };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
