// pamuk81.net - backend
// Icerik data/content.json icinde tutulur. Veritabani yok, tasimasi kolay.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pamuk81';

const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_PATH = path.join(DATA_DIR, 'content.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

/* ---------- basit oturum ---------- */
const sessions = new Set();

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!sessions.has(token)) return res.status(401).json({ error: 'Yetkisiz' });
  next();
}

app.post('/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Sifre yanlis' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  res.json({ token });
});

app.post('/api/logout', auth, (req, res) => {
  sessions.delete((req.headers.authorization || '').replace('Bearer ', ''));
  res.json({ ok: true });
});

/* ---------- icerik ---------- */
function readContent() {
  return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
}

app.get('/api/content', (req, res) => {
  try {
    res.json(readContent());
  } catch (e) {
    res.status(500).json({ error: 'content.json okunamadi: ' + e.message });
  }
});

app.put('/api/content', auth, (req, res) => {
  try {
    // her kayitta yedek al
    if (fs.existsSync(CONTENT_PATH)) {
      fs.copyFileSync(CONTENT_PATH, path.join(DATA_DIR, 'content.backup.json'));
    }
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Kaydedilemedi: ' + e.message });
  }
});

/* ---------- dosya yukleme ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9.]/g, '-');
    cb(null, Date.now() + '-' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image\/|video\/)/.test(file.mimetype);
    cb(ok ? null : new Error('Sadece resim veya video'), ok);
  }
});

app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya yok' });
  res.json({ url: '/uploads/' + req.file.filename });
});

/* ---------- uretimde frontend'i de servis et ---------- */
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log('Backend calisiyor -> http://localhost:' + PORT);
  console.log('Admin sifresi: ' + ADMIN_PASSWORD);
});
