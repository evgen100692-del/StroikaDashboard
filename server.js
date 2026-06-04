// server.js — Запуск: node server.js
// Доступ по сети: http://<ВАШ_IP>:3000

const http = require('http');
const fs   = require('fs');
const path = require('path');
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Создать папку data и пустую БД если не существует
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ contracts: [], nextId: 1 }));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

function readDB()  { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, data) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── REST API ──────────────────────────────────────────────────────
  if (url === '/api/contracts' && req.method === 'GET') {
    json(res, 200, readDB());
    return;
  }

  if (url === '/api/contracts' && req.method === 'POST') {
    const body = await readBody(req);
    const db = readDB();
    const row = { id: db.nextId++, ...body };
    db.contracts.push(row);
    writeDB(db);
    json(res, 201, row);
    return;
  }

  const editMatch = url.match(/^\/api\/contracts\/(\d+)$/);
  if (editMatch) {
    const id = parseInt(editMatch[1]);

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const db = readDB();
      const idx = db.contracts.findIndex(c => c.id === id);
      if (idx === -1) { json(res, 404, { error: 'Not found' }); return; }
      db.contracts[idx] = { ...db.contracts[idx], ...body, id };
      writeDB(db);
      json(res, 200, db.contracts[idx]);
      return;
    }

    if (req.method === 'DELETE') {
      const db = readDB();
      db.contracts = db.contracts.filter(c => c.id !== id);
      writeDB(db);
      json(res, 200, { ok: true });
      return;
    }
  }

  // ── Статические файлы ─────────────────────────────────────────────
  let filePath = path.join(__dirname, url === '/' ? 'dashboard-construction-analytics.html' : url);
  const ext = path.extname(filePath);
  if (!ext) filePath += '.html';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('404 Not Found'); return;
    }
    cors(res);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // Определяем IP автоматически
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('\n✅  Сервер запущен!');
  console.log(`   Локально:  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`   По сети:   http://${ip}:${PORT}`));
  console.log('\nДанные хранятся в: data/db.json\n');
});