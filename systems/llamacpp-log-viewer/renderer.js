// ---- Tabs ----
const panels = document.querySelectorAll('.panel');
const tabBtns = document.querySelectorAll('.tab');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    panels.forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
  });
});

// ---- Container runner ----
const containerStatusEl = document.getElementById('containerStatus');
const runForm = document.getElementById('runForm');
const btnRun = document.getElementById('btnRun');
const btnStop = document.getElementById('btnStop');
const runMessage = document.getElementById('runMessage');

function setRunMessage(msg, type = '') {
  runMessage.textContent = msg || '';
  runMessage.className = 'runner-message ' + type;
}

async function refreshContainerStatus() {
  const name = runForm.containerName.value.trim() || 'llamacpp';
  try {
    const r = await window.docker.status(name);
    if (r.running) {
      containerStatusEl.textContent = 'Container “‘ + name +’” is running';
      containerStatusEl.className = 'runner-status running';
    } else {
      containerStatusEl.textContent = 'Container “‘ + name +’” is stopped';
      containerStatusEl.className = 'runner-status stopped';
    }
  } catch (_) {
    containerStatusEl.textContent = 'Container “‘ + name +’” not found or error';
    containerStatusEl.className = 'runner-status stopped';
  }
}

runForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const config = getConfig(runForm);
  btnRun.disabled = true;
  setRunMessage('Starting…');
  try {
    const result = await window.docker.run(config);
    if (result.ok) {
      setRunMessage('Container started. Server should be on http://' + config.host + ':' + config.port, 'success');
      refreshContainerStatus();
    } else {
      setRunMessage(result.error || 'Run failed', 'error');
    }
  } catch (err) {
    setRunMessage(err && err.message ? err.message : String(err), 'error');
  }
  btnRun.disabled = false;
});

btnStop.addEventListener('click', async () => {
  const name = runForm.containerName.value.trim() || 'llamacpp';
  btnStop.disabled = true;
  setRunMessage('Stopping…');
  try {
    const result = await window.docker.stop(name);
    if (result.ok) {
      setRunMessage('Container stopped.', 'success');
      refreshContainerStatus();
    } else {
      setRunMessage(result.error || 'Stop failed', 'error');
    }
  } catch (err) {
    setRunMessage(err && err.message ? err.message : String(err), 'error');
  }
  btnStop.disabled = false;
});

// ---- Container 2 ----
const containerStatusEl2 = document.getElementById('containerStatus2');
const runForm2 = document.getElementById('runForm2');
const btnRun2 = document.getElementById('btnRun2');
const btnStop2 = document.getElementById('btnStop2');
const runMessage2 = document.getElementById('runMessage2');

function setRunMessage2(msg, type = '') {
  runMessage2.textContent = msg || '';
  runMessage2.className = 'runner-message ' + type;
}

async function refreshContainerStatus2() {
  const name = runForm2.containerName.value.trim() || 'llamacpp2';
  try {
    const r = await window.docker.status(name);
    if (r.running) {
      containerStatusEl2.textContent = 'Container “‘ + name +’” is running';
      containerStatusEl2.className = 'runner-status running';
    } else {
      containerStatusEl2.textContent = 'Container “‘ + name +’” is stopped';
      containerStatusEl2.className = 'runner-status stopped';
    }
  } catch (_) {
    containerStatusEl2.textContent = 'Container “‘ + name +’” not found or error';
    containerStatusEl2.className = 'runner-status stopped';
  }
}

function getConfig(form) {
  const fd = new FormData(form);
  const get = (name) => (fd.get(name) ?? form.querySelector('[name="' + name + '"]')?.value ?? '').trim();
  const defaultName = form.id === 'runForm2' ? 'llamacpp2' : 'llamacpp';
  return {
    containerName: get('containerName') || defaultName,
    image: get('image') || 'ghcr.io/ggml-org/llama.cpp:server-cuda',
    volumeHost: get('volumeHost') || '/home/zerwiz/.lmstudio/models',
    modelPath: get('modelPath') || '',
    host: get('host') || '0.0.0.0',
    port: parseInt(get('port') || (form.id === 'runForm2' ? '8081' : '8080'), 10),
    ctxSize: parseInt(get('ctxSize') || '12000', 10),
    ngl: parseInt(get('ngl') || '99', 10),
    memory: get('memory') || '24g',
    memorySwap: get('memorySwap') || '32g',
    restart: get('restart') || 'always',
    network: get('network') || 'host',
    gpus: 'all',
  };
}

runForm2.addEventListener('submit', async (e) => {
  e.preventDefault();
  const config = getConfig(runForm2);
  btnRun2.disabled = true;
  setRunMessage2('Starting…');
  try {
    const result = await window.docker.run(config);
    if (result.ok) {
      setRunMessage2('Container started. Server on http://' + config.host + ':' + config.port, 'success');
      refreshContainerStatus2();
    } else {
      setRunMessage2(result.error || 'Run failed', 'error');
    }
  } catch (err) {
    setRunMessage2(err && err.message ? err.message : String(err), 'error');
  }
  btnRun2.disabled = false;
});

btnStop2.addEventListener('click', async () => {
  const name = runForm2.containerName.value.trim() || 'llamacpp2';
  btnStop2.disabled = true;
  setRunMessage2('Stopping…');
  try {
    const result = await window.docker.stop(name);
    if (result.ok) {
      setRunMessage2('Container stopped.', 'success');
      refreshContainerStatus2();
    } else {
      setRunMessage2(result.error || 'Stop failed', 'error');
    }
  } catch (err) {
    setRunMessage2(err && err.message ? err.message : String(err), 'error');
  }
  btnStop2.disabled = false;
});

refreshContainerStatus();
refreshContainerStatus2();

// ---- Logs ----
const logOutput = document.getElementById('logOutput');
const btnToggle = document.getElementById('btnToggle');
const btnClear = document.getElementById('btnClear');
const containerNameInput = document.getElementById('containerName');
const statusEl = document.getElementById('status');

let streaming = false;

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}

function appendLog(chunk) {
  const text = typeof chunk === 'string' ? chunk : String(chunk);
  logOutput.textContent += text;
  if (streaming) {
    logOutput.scrollTop = logOutput.scrollHeight;
  }
}

function clearLog() {
  logOutput.textContent = '';
}

btnToggle.addEventListener('click', async () => {
  if (streaming) {
    await window.logViewer.stopStream();
    streaming = false;
    btnToggle.textContent = 'Start stream';
    btnToggle.classList.remove('streaming');
    setStatus('Stream stopped.', '');
    return;
  }

  const name = containerNameInput.value.trim() || 'llamacpp';
  try {
    await window.logViewer.startStream(name);
    streaming = true;
    btnToggle.textContent = 'Stop stream';
    btnToggle.classList.add('streaming');
    setStatus('Streaming logs from container “‘ + name +’”…', 'live');
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : String(err)), 'error');
  }
});

btnClear.addEventListener('click', () => {
  clearLog();
  if (!streaming) setStatus('Log cleared.');
});

window.logViewer.onData(appendLog);
window.logViewer.onError((msg) => {
  setStatus('Error: ' + msg, 'error');
});
window.logViewer.onClosed((info) => {
  streaming = false;
  btnToggle.textContent = 'Start stream';
  btnToggle.classList.remove('streaming');
  setStatus('Stream ended. (code: ' + (info && info.code) + ')', '');
});
