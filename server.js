// server.js — node server.js
// Перед запуском выполните: npm install

const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');
const XLSX     = require('xlsx');

const PORT    = 3000;
const DB_PATH = path.join(__dirname, 'data', 'stroika.db');

// ── Папка data ────────────────────────────────────────────────────
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// ── Открытие / инициализация SQLite ──────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS contracts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    objectName      TEXT,
    financingSource TEXT,
    contractor      TEXT,
    contractNum     TEXT,
    contractDate    TEXT,
    priceGK         REAL DEFAULT 0,
    advanceGK       REAL DEFAULT 0,
    advancePaid     REAL DEFAULT 0,
    unworkedAdvance REAL DEFAULT 0,
    paidTotal       REAL DEFAULT 0,
    completed       REAL DEFAULT 0,
    completed2025   REAL DEFAULT 0,
    paid2025        REAL DEFAULT 0,
    limit2026was    REAL DEFAULT 0,
    limit2026cur    REAL DEFAULT 0,
    completed2026   REAL DEFAULT 0,
    paid2026        REAL DEFAULT 0,
    limit2027was    REAL DEFAULT 0,
    limit2027cur    REAL DEFAULT 0,
    limit2028was    REAL DEFAULT 0,
    limit2028cur    REAL DEFAULT 0,
    limit2029was    REAL DEFAULT 0,
    limit2029cur    REAL DEFAULT 0,
    remainder       REAL DEFAULT 0,
    readinessPct    REAL DEFAULT 0,
    workers         INTEGER DEFAULT 0,
    equipment       INTEGER DEFAULT 0,
    moge            TEXT,
    dptStatus       TEXT,
    landWithdrawalPct REAL DEFAULT 0,
    plannedIntroDate  TEXT,
    plannedOpenDate   TEXT,
    contractEndDate   TEXT
  );

  -- Отчёты ямочного ремонта: каждый загрузенный файл = одна запись с датой
  CREATE TABLE IF NOT EXISTS pothole_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT NOT NULL,   -- 'complaints' | 'regional' | 'municipal'
    report_date TEXT NOT NULL,   -- 'YYYY-MM-DD'
    uploaded_at TEXT NOT NULL,
    data_json   TEXT NOT NULL    -- JSON-строка с парсед данными
  );
`);

// ── MIME ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

// ── Вспомогательные ──────────────────────────────────────────────────
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

// Читаем JSON-тело запроса
async function readBodyJSON(req) {
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

// Читаем raw буффер (для multipart)
async function readBodyRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Парсер multipart/form-data (минимальный, без multer) ──────────────
function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = 0;

  while (start < buffer.length) {
    const bndIdx = buffer.indexOf(boundaryBuf, start);
    if (bndIdx === -1) break;
    const after = bndIdx + boundaryBuf.length;
    // Возможный финальный boundary
    if (buffer.slice(after, after + 2).toString() === '--') break;
    // Пропускаем \r\n
    const headerStart = after + 2;
    const headerEnd   = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;
    const headerStr = buffer.slice(headerStart, headerEnd).toString();
    const bodyStart = headerEnd + 4;
    const nextBnd   = buffer.indexOf(boundaryBuf, bodyStart);
    const bodyEnd   = nextBnd === -1 ? buffer.length : nextBnd - 2;
    const body      = buffer.slice(bodyStart, bodyEnd);

    // Парсим Content-Disposition
    const cdMatch = headerStr.match(/Content-Disposition:[^\r\n]*/i);
    if (cdMatch) {
      const nameMatch = cdMatch[0].match(/name="([^"]*)"/);
      const fileMatch = cdMatch[0].match(/filename="([^"]*)"/);
      parts.push({
        name:     nameMatch ? nameMatch[1] : null,
        filename: fileMatch ? fileMatch[1] : null,
        body,
        text: !fileMatch ? body.toString('utf8') : null,
      });
    }
    start = nextBnd !== -1 ? nextBnd : buffer.length;
  }
  return parts;
}

// ── Парсер Excel-файлов ─────────────────────────────────────────────
function parseExcel(buffer, reportType) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  if (reportType === 'regional') {
    // Лист 1 (первый)
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const result = [];
    for (const row of rows) {
      // Ищем колонки по частичному совпадению названия
      const ruadKey  = Object.keys(row).find(k => /руад/i.test(k));
      const regKey   = Object.keys(row).find(k => /регистрац/i.test(k) && /7/i.test(k));
      const fixKey   = Object.keys(row).find(k => /устран/i.test(k) && /7/i.test(k));
      if (!ruadKey) continue;
      const name = String(row[ruadKey] || '').trim();
      if (!name) continue;
      result.push({
        name:       name,
        registered: toNum(ruadKey ? row[regKey] : 0),
        fixed:      toNum(fixKey  ? row[fixKey]  : 0),
      });
    }
    return result;
  }

  if (reportType === 'municipal') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const result = [];
    for (const row of rows) {
      const moKey  = Object.keys(row).find(k => /муницип/i.test(k));
      const regKey = Object.keys(row).find(k => /регистрац/i.test(k) && /7/i.test(k));
      const fixKey = Object.keys(row).find(k => /устран/i.test(k) && /7/i.test(k));
      if (!moKey) continue;
      const name = String(row[moKey] || '').trim();
      if (!name) continue;
      result.push({
        name:       name,
        registered: toNum(regKey ? row[regKey] : 0),
        fixed:      toNum(fixKey ? row[fixKey]  : 0),
      });
    }
    return result;
  }

  if (reportType === 'complaints') {
    const result = { total: [], week: [] };

    // Лист "Свод общий"
    const totalSheetName = workbook.SheetNames.find(n => /свод.*общ/i.test(n));
    if (totalSheetName) {
      const sheet = workbook.Sheets[totalSheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      for (const row of rows) {
        const execKey  = Object.keys(row).find(k => /исполн/i.test(k));
        const countKey = Object.keys(row).find(k => /колич/i.test(k) || /жалоб/i.test(k) || /поступ/i.test(k));
        if (!execKey) continue;
        const name = String(row[execKey] || '').trim();
        if (!name) continue;
        result.total.push({ name, count: toNum(countKey ? row[countKey] : 0) });
      }
    }

    // Лист "Свод за 7 дней"
    const weekSheetName = workbook.SheetNames.find(n => /7.*дн/i.test(n) || /недел/i.test(n));
    if (weekSheetName) {
      const sheet = workbook.Sheets[weekSheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      for (const row of rows) {
        const execKey  = Object.keys(row).find(k => /исполн/i.test(k));
        const countKey = Object.keys(row).find(k => /колич/i.test(k) || /жалоб/i.test(k) || /поступ/i.test(k));
        if (!execKey) continue;
        const name = String(row[execKey] || '').trim();
        if (!name) continue;
        result.week.push({ name, count: toNum(countKey ? row[countKey] : 0) });
      }
    }
    return result;
  }

  return {};
}

function toNum(v) {
  const n = parseFloat(String(v || 0).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// ── HTTP-сервер ───────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ════════════════════════════════════════════════════════════════
  //  API: КОНТРАКТЫ (Строительство)
  // ════════════════════════════════════════════════════════════════

  if (url === '/api/contracts' && req.method === 'GET') {
    const rows = db.prepare('SELECT * FROM contracts ORDER BY id').all();
    json(res, 200, { contracts: rows, nextId: (rows[rows.length - 1]?.id || 0) + 1 });
    return;
  }

  if (url === '/api/contracts' && req.method === 'POST') {
    const body = await readBodyJSON(req);
    const cols  = Object.keys(body);
    const vals  = Object.values(body);
    const stmt  = db.prepare(
      `INSERT INTO contracts (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    );
    const info = stmt.run(...vals);
    const row  = db.prepare('SELECT * FROM contracts WHERE id = ?').get(info.lastInsertRowid);
    json(res, 201, row);
    return;
  }

  const editMatch = url.match(/^\/api\/contracts\/(\d+)$/);
  if (editMatch) {
    const id = parseInt(editMatch[1]);
    if (req.method === 'PUT') {
      const body  = await readBodyJSON(req);
      const cols  = Object.keys(body);
      const vals  = Object.values(body);
      db.prepare(
        `UPDATE contracts SET ${cols.map(c => c + ' = ?').join(',')} WHERE id = ?`
      ).run(...vals, id);
      const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
      if (!row) { json(res, 404, { error: 'Not found' }); return; }
      json(res, 200, row);
      return;
    }
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM contracts WHERE id = ?').run(id);
      json(res, 200, { ok: true });
      return;
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  API: ЯМОЧНЫЙ РЕМОНТ — ОТЧЁТЫ
  // ════════════════════════════════════════════════════════════════

  // GET /api/pothole/reports — список всех отчётов (без data_json, только мета)
  if (url === '/api/pothole/reports' && req.method === 'GET') {
    const rows = db.prepare(
      'SELECT id, report_type, report_date, uploaded_at FROM pothole_reports ORDER BY report_date DESC, uploaded_at DESC'
    ).all();
    json(res, 200, rows);
    return;
  }

  // GET /api/pothole/reports/:id — полные данные отчёта
  const reportGetMatch = url.match(/^\/api\/pothole\/reports\/(\d+)$/);
  if (reportGetMatch && req.method === 'GET') {
    const row = db.prepare('SELECT * FROM pothole_reports WHERE id = ?').get(parseInt(reportGetMatch[1]));
    if (!row) { json(res, 404, { error: 'Not found' }); return; }
    row.data_json = JSON.parse(row.data_json);
    json(res, 200, row);
    return;
  }

  // DELETE /api/pothole/reports/:id
  const reportDelMatch = url.match(/^\/api\/pothole\/reports\/(\d+)$/);
  if (reportDelMatch && req.method === 'DELETE') {
    db.prepare('DELETE FROM pothole_reports WHERE id = ?').run(parseInt(reportDelMatch[1]));
    json(res, 200, { ok: true });
    return;
  }

  // GET /api/pothole/latest — последние отчёты каждого типа
  if (url === '/api/pothole/latest' && req.method === 'GET') {
    const types = ['complaints', 'regional', 'municipal'];
    const result = {};
    for (const t of types) {
      const row = db.prepare(
        'SELECT * FROM pothole_reports WHERE report_type = ? ORDER BY report_date DESC, uploaded_at DESC LIMIT 1'
      ).get(t);
      if (row) {
        row.data_json = JSON.parse(row.data_json);
        result[t] = row;
      } else {
        result[t] = null;
      }
    }
    json(res, 200, result);
    return;
  }

  // GET /api/pothole/history?type=regional — все отчёты типа для динамики
  if (url.startsWith('/api/pothole/history') && req.method === 'GET') {
    const qtype = new URL('http://x' + req.url).searchParams.get('type') || '';
    const rows = db.prepare(
      'SELECT id, report_type, report_date, data_json FROM pothole_reports WHERE report_type = ? ORDER BY report_date ASC'
    ).all(qtype);
    const parsed = rows.map(r => ({ ...r, data_json: JSON.parse(r.data_json) }));
    json(res, 200, parsed);
    return;
  }

  // POST /api/pothole/upload — загрузка Excel-файла
  if (url === '/api/pothole/upload' && req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=([\S]+)/);
      if (!boundaryMatch) {
        json(res, 400, { error: 'Не передан boundary' }); return;
      }
      const boundary = boundaryMatch[1];
      const rawBody  = await readBodyRaw(req);
      const parts    = parseMultipart(rawBody, boundary);

      const reportTypePart = parts.find(p => p.name === 'report_type');
      const reportDatePart = parts.find(p => p.name === 'report_date');
      const filePart       = parts.find(p => p.filename);

      if (!reportTypePart || !reportDatePart || !filePart) {
        json(res, 400, { error: 'Отсутствуют обязательные поля' }); return;
      }

      const reportType = reportTypePart.text.trim();
      const reportDate = reportDatePart.text.trim();

      const parsed = parseExcel(filePart.body, reportType);

      db.prepare(
        'INSERT INTO pothole_reports (report_type, report_date, uploaded_at, data_json) VALUES (?, ?, ?, ?)'
      ).run(reportType, reportDate, new Date().toISOString(), JSON.stringify(parsed));

      json(res, 200, { ok: true, type: reportType, date: reportDate, rows: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length });
    } catch (e) {
      console.error('[upload] Ошибка:', e);
      json(res, 500, { error: 'Ошибка обработки файла: ' + e.message });
    }
    return;
  }

  // ════════════════════════════════════════════════════════════════
  //  Статические файлы
  // ════════════════════════════════════════════════════════════════
  let filePath = path.join(__dirname, url === '/' ? 'dashboard-construction-analytics.html' : url);
  const ext = path.extname(filePath);
  if (!ext) filePath += '.html';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('404 Not Found'); return; }
    cors(res);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips  = [];
  for (const name of Object.keys(nets))
    for (const net of nets[name])
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);

  console.log('\n✅  Сервер запущен! (БД: SQLite)');
  console.log(`   Локально:  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`   По сети:   http://${ip}:${PORT}`));
  console.log('База данных: data/stroika.db\n');
});
