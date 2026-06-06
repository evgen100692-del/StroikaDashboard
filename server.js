// server.js — node server.js
// Перед запуском выполните: npm install

const http = require('http');
const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PORT    = 3000;
const DB_PATH = path.join(__dirname, 'data', 'stroika.db');

// ── Папка data ────────────────────────────────────────────────────
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// ── sql.js: синхронная инициализация БД ───────────────────────────
// sql.js — чистый JS (WebAssembly), не требует компилятора C++
const initSqlJs = require('sql.js');

let db;  // будет инициализирован в startServer()

async function initDb() {
  const SQL = await initSqlJs();

  // Загружаем существующую БД или создаём новую
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Включаем WAL через PRAGMA (sql.js поддерживает)
  db.run('PRAGMA foreign_keys = ON;');

  db.run(`
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

    CREATE TABLE IF NOT EXISTS pothole_reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      report_date TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      data_json   TEXT NOT NULL
    );
  `);
}

// ── Сохранение БД на диск (вызывать после каждой записи) ──────────
function saveDb() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] Ошибка сохранения:', e.message);
  }
}

// ── Обёртки для удобной работы с sql.js ──────────────────────────
// sql.js возвращает [{columns:[...], values:[[...],...]}, ...]
// Конвертируем в массив объектов (как better-sqlite3)
function dbAll(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  );
}

function dbGet(sql, params = []) {
  const rows = dbAll(sql, params);
  return rows[0] || null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return db;
}

// Получить lastInsertRowid
function dbInsert(sql, params = [], skipSave = false) {
  db.run(sql, params);
  const row = dbGet('SELECT last_insert_rowid() as id');
  if (!skipSave) saveDb();
  return row ? row.id : null;
}

// ── MIME ─────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

// ── Вспомогательные ──────────────────────────────────────────────
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

async function readBodyRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Парсер multipart/form-data ────────────────────────────────────
function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = 0;

  while (start < buffer.length) {
    const bndIdx = buffer.indexOf(boundaryBuf, start);
    if (bndIdx === -1) break;
    const after = bndIdx + boundaryBuf.length;
    if (buffer.slice(after, after + 2).toString() === '--') break;
    const headerStart = after + 2;
    const headerEnd   = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;
    const headerStr = buffer.slice(headerStart, headerEnd).toString();
    const bodyStart = headerEnd + 4;
    const nextBnd   = buffer.indexOf(boundaryBuf, bodyStart);
    const bodyEnd   = nextBnd === -1 ? buffer.length : nextBnd - 2;
    const body      = buffer.slice(bodyStart, bodyEnd);

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

// ── Парсер Excel ──────────────────────────────────────────────────
function parseExcel(buffer, reportType) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  if (reportType === 'regional' || reportType === 'municipal') {
    return _parseRegMunSheet(workbook.Sheets[workbook.SheetNames[0]]);
  }

  if (reportType === 'complaints') {
    const result = { total: [], week: [] };

    const totalSheetName = workbook.SheetNames.find(n => /свод.*общ/i.test(n));
    if (totalSheetName) {
      const sheet = workbook.Sheets[totalSheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      let inOms = false, inMad = false;
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const name  = String(row[0]).trim();
        const count = toNum(row[1]);
        if (name === 'ОМС')        { inOms = true;  inMad = false; result.total.push({ name: 'ОМС', type: 'oms', count }); continue; }
        if (name === 'МАД')        { inMad = true;  inOms = false; result.total.push({ name: 'МАД', type: 'mad', count }); continue; }
        if (name === 'Общий итог') break;
        if (inOms) result.total.push({ name, type: 'oms', count });
        if (inMad) result.total.push({ name, type: 'mad', count });
      }
    }

    const weekSheetName = workbook.SheetNames.find(n => /7.*дн/i.test(n) || /недел/i.test(n) || /свод за 7/i.test(n));
    if (weekSheetName) {
      const sheet = workbook.Sheets[weekSheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      let inOms = false, inMad = false;
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const name  = String(row[0]).trim();
        const count = toNum(row[row.length - 1]);
        if (name === 'ОМС')        { inOms = true;  inMad = false; result.week.push({ name: 'ОМС', type: 'oms', count }); continue; }
        if (name === 'МАД')        { inMad = true;  inOms = false; result.week.push({ name: 'МАД', type: 'mad', count }); continue; }
        if (name === 'Общий итог') break;
        if (inOms) result.week.push({ name, type: 'oms', count });
        if (inMad) result.week.push({ name, type: 'mad', count });
      }
    }

    return result;
  }

  return {};
}

// Вынесенный парсер для regional и municipal — структура листов одинакова
function _parseRegMunSheet(sheet) {
  const rows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const result = [];
  for (let i = 4; i < rows.length; i++) {
    const row  = rows[i];
    if (!row || row.length < 2) continue;
    const name = String(row[1] || '').trim();
    if (!name) continue;
    result.push({ name, registered: toNum(row[4]), fixed: toNum(row[9]) });
  }
  return result;
}

function toNum(v) {
  const n = parseFloat(String(v || 0).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// ── HTTP-сервер ───────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ════════════════════════════════════════════════════════════
  //  API: КОНТРАКТЫ
  // ════════════════════════════════════════════════════════════

  if (url === '/api/contracts' && req.method === 'GET') {
    const rows = dbAll('SELECT * FROM contracts ORDER BY id');
    const nextId = rows.length ? rows[rows.length - 1].id + 1 : 1;
    json(res, 200, { contracts: rows, nextId });
    return;
  }

    if (url === '/api/contracts' && req.method === 'POST') {
      const body  = await readBodyJSON(req);
      const cols  = Object.keys(body);
      const vals  = Object.values(body);
      const isSeed = body._seed === true;   // флаг из seedDemo
      const newId = dbInsert(
        `INSERT INTO contracts (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        vals,
        isSeed  // skipSave=true при seed — не пишем файл на каждую запись
      );
      if (isSeed) saveDb();  // сохраняем один раз после каждой seed-записи... 
      const row = dbGet('SELECT * FROM contracts WHERE id = ?', [newId]);
      json(res, 201, row);
      return;
    }

  const editMatch = url.match(/^\/api\/contracts\/(\d+)$/);
  if (editMatch) {
    const id = parseInt(editMatch[1]);
    if (req.method === 'PUT') {
      const body = await readBodyJSON(req);
      const cols = Object.keys(body);
      const vals = Object.values(body);
      dbRun(
        `UPDATE contracts SET ${cols.map(c => c + ' = ?').join(',')} WHERE id = ?`,
        [...vals, id]
      );
      const row = dbGet('SELECT * FROM contracts WHERE id = ?', [id]);
      if (!row) { json(res, 404, { error: 'Not found' }); return; }
      json(res, 200, row);
      return;
    }
    if (req.method === 'DELETE') {
      dbRun('DELETE FROM contracts WHERE id = ?', [id]);
      json(res, 200, { ok: true });
      return;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  API: ЯМОЧНЫЙ РЕМОНТ
  // ════════════════════════════════════════════════════════════

  if (url === '/api/pothole/reports' && req.method === 'GET') {
    const rows = dbAll(
      'SELECT id, report_type, report_date, uploaded_at FROM pothole_reports ORDER BY report_date DESC, uploaded_at DESC'
    );
    json(res, 200, rows);
    return;
  }

  const reportMatch = url.match(/^\/api\/pothole\/reports\/(\d+)$/);
  if (reportMatch) {
    const id = parseInt(reportMatch[1]);
    if (req.method === 'GET') {
      const row = dbGet('SELECT * FROM pothole_reports WHERE id = ?', [id]);
      if (!row) { json(res, 404, { error: 'Not found' }); return; }
      row.data_json = JSON.parse(row.data_json);
      json(res, 200, row);
      return;
    }
    if (req.method === 'DELETE') {
      dbRun('DELETE FROM pothole_reports WHERE id = ?', [id]);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (url === '/api/pothole/latest' && req.method === 'GET') {
    const types  = ['complaints', 'regional', 'municipal'];
    const result = {};
    for (const t of types) {
      const row = dbGet(
        'SELECT * FROM pothole_reports WHERE report_type = ? ORDER BY report_date DESC, uploaded_at DESC LIMIT 1',
        [t]
      );
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

  if (url.startsWith('/api/pothole/history') && req.method === 'GET') {
    const qtype  = new URL('http://x' + req.url).searchParams.get('type') || '';
    const rows   = dbAll(
      'SELECT id, report_type, report_date, data_json FROM pothole_reports WHERE report_type = ? ORDER BY report_date ASC',
      [qtype]
    );
    const parsed = rows.map(r => ({ ...r, data_json: JSON.parse(r.data_json) }));
    json(res, 200, parsed);
    return;
  }

  if (url === '/api/pothole/upload' && req.method === 'POST') {
    try {
      const contentType   = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=([\S]+)/);
      if (!boundaryMatch) { json(res, 400, { error: 'Не передан boundary' }); return; }

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
      const parsed     = parseExcel(filePart.body, reportType);
      const rowCount   = Array.isArray(parsed) ? parsed.length : (parsed.total ? parsed.total.length : 0);

      dbInsert(
        'INSERT INTO pothole_reports (report_type, report_date, uploaded_at, data_json) VALUES (?, ?, ?, ?)',
        [reportType, reportDate, new Date().toISOString(), JSON.stringify(parsed)]
      );

      json(res, 200, { ok: true, type: reportType, date: reportDate, rows: rowCount });
    } catch (e) {
      console.error('[upload] Ошибка:', e);
      json(res, 500, { error: 'Ошибка обработки файла: ' + e.message });
    }
    return;
  }

  if (url === '/api/contracts/seed' && req.method === 'POST') {
    const contracts = await readBodyJSON(req);
    db.run('BEGIN TRANSACTION');
    try {
      for (const body of contracts) {
        const cols = Object.keys(body);
        const vals = Object.values(body);
        db.run(
          `INSERT INTO contracts (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          vals
        );
      }
      db.run('COMMIT');
      saveDb();  // ← одна запись на диск вместо шести
    } catch(e) {
      db.run('ROLLBACK');
      json(res, 500, { error: e.message }); return;
    }
    json(res, 200, { ok: true, count: contracts.length });
    return;
  }

  // ════════════════════════════════════════════════════════════
  //  Статические файлы
  // ════════════════════════════════════════════════════════════
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

// ── Запуск ───────────────────────────────────────────────────────
async function startServer() {
  await initDb();
  server.listen(PORT, '0.0.0.0', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ips  = [];
    for (const name of Object.keys(nets))
      for (const net of nets[name])
        if (net.family === 'IPv4' && !net.internal) ips.push(net.address);

    console.log('\n✅  Сервер запущен! (БД: sql.js / SQLite)');
    console.log(`   Локально:  http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`   По сети:   http://${ip}:${PORT}`));
    console.log('   База данных: data/stroika.db\n');
  });
}

startServer().catch(err => {
  console.error('Критическая ошибка запуска:', err);
  process.exit(1);
});
