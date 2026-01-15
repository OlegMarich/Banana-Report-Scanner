const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');
const scanBox = require('./scan-to-counter');
const os = require('os');

const app = express();
const PORT = 3000;

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- PATHS ---------------- */

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');
const publicDir = path.join(__dirname, 'public');

/* ---------------- STORAGE ---------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, inputDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/* ---------------- UPLOAD ---------------- */

app.post('/upload', upload.array('files', 2), (req, res) => {
  const userDate = req.query.date;

  if (!userDate || !/^\d{4}-\d{2}-\d{2}$/.test(userDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or missing date parameter',
    });
  }

  const tempDir = path.join(__dirname, 'temp', userDate);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    for (const file of req.files) {
      fs.copyFileSync(file.path, path.join(tempDir, file.originalname));
    }
  } catch (err) {
    console.error('❌ Failed to copy files:', err);
    return res.status(500).json({ success: false });
  }

  const cmd = `node run-all.js ${userDate} "${tempDir}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      cleanupTemp(tempDir);
      return res.status(500).json({ success: false });
    }

    const match = stdout.match(/@@@DONE:(\d{4}-\d{2}-\d{2})/);
    const resultDate = match?.[1];

    if (!resultDate) {
      cleanupTemp(tempDir);
      return res.status(500).json({ success: false });
    }

    exec(`start "" "${path.join(outputDir, resultDate)}"`, () => {});
    cleanupTemp(tempDir);

    res.json({ success: true, date: resultDate });
  });
});

function cleanupTemp(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(err);
  }
}

/* ---------------- SCANNER API ---------------- */

app.get('/api/orders/:date', (req, res) => {
  const filePath = path.join(outputDir, req.params.date, 'data.json');
  if (!fs.existsSync(filePath)) return res.json([]);

  try {
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const clients = rows
      .map(r => r['Odbiorca'])
      .filter(Boolean);

    res.json([...new Set(clients)]);
  } catch {
    res.json([]);
  }
});

app.post('/api/scan', async (req, res) => {
  try {
    const result = await scanBox({
      date: req.body.date,
      client: req.body.client,
      containerNumber: req.body.container,
      quantity: req.body.qty,
    });

    res.json({
      message: `✔ Додано ${req.body.qty}`,
      ...result,
    });
  } catch (err) {
    res.json({ message: '❌ ' + err.message });
  }
});

app.post('/api/finish', (req, res) => {
  if (!req.body.client) return res.status(400).json({ ok: false });
  console.log(`✅ FINISHED: ${req.body.client}`);
  res.json({ ok: true });
});

/* ---------------- STATIC ---------------- */

// 🔥 ФРОНТЕНД
app.use(express.static(publicDir));

// 📁 OUTPUT
app.use('/output', express.static(outputDir));

/* ---------------- IP INFO ---------------- */

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

/* ---------------- START ---------------- */

const LOCAL_IP = getLocalIP();

app.listen(PORT, '0.0.0.0', () => {
  console.log('📡 Server running:');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://${LOCAL_IP}:${PORT}`);
  console.log(`   Scanner → /scanner.html`);
});