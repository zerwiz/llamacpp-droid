const { app, BrowserWindow, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Allow running on Linux without setuid chrome-sandbox
app.commandLine.appendSwitch('no-sandbox');

let mainWindow = null;
let logProcess = null;

// ---- Docker run/stop/status ----
function dockerRun(config) {
  const dockerArgs = [
    'run', '-d',
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
  return spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerStop(containerName) {
  return spawn('docker', ['stop', containerName || 'llamacpp'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerRm(containerName) {
  return spawn('docker', ['rm', '-f', containerName || 'llamacpp'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function dockerInspect(containerName) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['inspect', '--format', '{{.State.Running}}', containerName || 'llamacpp'], {
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
  logProcess = spawn('docker', ['logs', '-f', '--tail', '500', name], {
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

ipcMain.handle('find-gguf', () => {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', 'find "$HOME" -name "*.gguf" 2>/dev/null'], {
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
