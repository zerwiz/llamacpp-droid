const { app, BrowserWindow, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

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
  const dockerArgs = [
    '--name', config.containerName || 'llamacpp',
    '--restart', config.restart || 'always',
    '--gpus', config.gpus || 'all',
    '--network', config.network || 'host',
    '-v', `${config.volumeHost || ''}:/models`,
    '--memory', config.memory || '24g',
    '--memory-swap', config.memorySwap || '32g',
    config.image || 'ghcr.io/ggml-org/llama.cpp:server-cuda',
    '--host', config.host || '0.0.0.0',
    '--port', String(config.port || 8080),
    '--ctx-size', String(config.ctxSize || 12000),
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

ipcMain.handle('log-stream:start', (_, containerName = 'llamacpp') => {
  stopStream();
  const name = String(containerName).trim() || 'llamacpp';
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
  return new Promise((resolve) => {
    const p = dockerStop(containerName || 'llamacpp');
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

ipcMain.handle('app:open-url', (_, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false, error: 'Invalid URL' };
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
