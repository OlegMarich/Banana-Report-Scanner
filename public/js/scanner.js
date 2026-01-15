// ===============================
// CONFIG
// ===============================
const SCANNER_URL = `http://${window.location.host}/components/scanner.html`;
const KNOWN_PREFIXES = ['SUDU', 'MNBU', 'MSKU', 'TCLU', 'TEMU', 'FCIU', 'TRHU', 'CAIU'];

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  initQR();
  initScannerUI();
});

// ===============================
// QR INIT
// ===============================
function initQR() {
  const qrBox = document.getElementById('qrBox');
  if (!qrBox) return;

  qrBox.innerHTML = '';

  new QRCode(qrBox, {
    text: SCANNER_URL,
    width: 200,
    height: 200,
  });

  const link = document.createElement('a');
  link.href = SCANNER_URL;
  link.target = '_blank';
  link.textContent = 'Відкрити сканер у браузері';
  link.className = 'button button--primary';
  link.style.display = 'inline-block';
  link.style.marginTop = '12px';

  qrBox.appendChild(link);
}

// ===============================
// SCANNER UI
// ===============================
function initScannerUI() {
  const cameraBtn = document.getElementById('cameraScanBtn');
  const cameraInput = document.getElementById('cameraInput');
  const preview = document.getElementById('preview');
  const scanInput = document.getElementById('scanInput');
  const qtyInput = document.getElementById('qtyInput');
  const logBox = document.getElementById('log');
  const undoBtn = document.getElementById('undoBtn');
  const finishBtn = document.getElementById('finishBtn');
  const loadOrdersBtn = document.getElementById('loadOrders');
  const clientSelect = document.getElementById('clientSelect');

  if (!cameraBtn || !cameraInput) return;

  // Відкрити камеру
  cameraBtn.addEventListener('click', () => {
    cameraInput.click();
  });

  // Обробка вибраного фото
  cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = resizeImage(img);
      preview.src = canvas.toDataURL('image/jpeg');
      preview.style.display = 'block';

      const text = await runOCR(canvas);
      const cleaned = cleanContainerText(text);
      const corrected = autoCorrectPrefix(cleaned);

      scanInput.value = corrected;
      flashSuccess(scanInput);
    };
    img.src = URL.createObjectURL(file);
  });

  // Undo
  undoBtn.addEventListener('click', () => {
    const last = logBox.lastElementChild;
    if (last) logBox.removeChild(last);
  });

  // Завершити клієнта (приклад — просто лог)
  finishBtn.addEventListener('click', () => {
    const client = clientSelect.value || '(без клієнта)';
    const date = document.getElementById('scanDate').value || '(без дати)';
    const entry = document.createElement('div');
    entry.textContent = `✅ Завершено клієнта: ${client}, дата: ${date}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  });

  // Завантажити замовлення (заглушка)
  loadOrdersBtn.addEventListener('click', () => {
    // Тут ти підключиш свій API
    clientSelect.innerHTML = `
      <option value="">— виберіть клієнта —</option>
      <option value="Client A">Client A</option>
      <option value="Client B">Client B</option>
    `;
  });

  // Додавання запису по Enter
  scanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLogEntry(scanInput, qtyInput, logBox);
    }
  });
}

// ===============================
// OCR
// ===============================
async function runOCR(canvas) {
  try {
    const {data} = await Tesseract.recognize(canvas, 'eng', {
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    });
    return data.text || '';
  } catch (err) {
    console.error('OCR error:', err);
    return '';
  }
}

// ===============================
// IMAGE RESIZE
// ===============================
function resizeImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = 1024;
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ===============================
// TEXT CLEANING & CORRECTION
// ===============================
function cleanContainerText(text) {
  return text
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function autoCorrectPrefix(text) {
  if (!text) return '';

  for (let prefix of KNOWN_PREFIXES) {
    if (text.startsWith(prefix.slice(1))) {
      return prefix + text.slice(prefix.length - 1);
    }
  }
  return text;
}

// ===============================
// LOGIC HELPERS
// ===============================
function addLogEntry(scanInput, qtyInput, logBox) {
  const value = scanInput.value.trim();
  const qty = qtyInput.value || '1';
  if (!value) return;

  const entry = document.createElement('div');
  entry.textContent = `+ ${value} x ${qty}`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;

  scanInput.value = '';
  qtyInput.value = '1';
}

function flashSuccess(el) {
  el.classList.add('flash-success');
  setTimeout(() => el.classList.remove('flash-success'), 400);
}
