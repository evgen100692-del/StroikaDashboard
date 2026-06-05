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

  -- Отчёты ямочного ремонта: каждый загруженный файл = одна запись с датой
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

// ── Парсер multipart/form-data ──────────────────────────────────────
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

// ── Парсер Excel-файлов ─────────────────────────────────────────────
// Структура файлов определена по реальным образцам:
//
// РЕГИОНАЛЬНЫЙ (Проект_Региональный_ямочный_ремонт_*):
//   Строка [0] — заголовок файла
//   Строка [1] — дата
//   Строка [2] — пустая
//   Строка [3] — заголовки столбцов:
//     col[1] = «РУАД», col[4] = «Регистрация ям за 7 дней», col[9] = «Устранено ям за 7 дней»
//   Строки [4..N] — данные по каждому РУАД (нет итоговой строки)
//
// МУНИЦИПАЛЬНЫЙ (Проект_Муниципальный_ямочный_ремонт_*):
//   Аналогичная структура:
//     col[1] = «Муниципальное образование», col[4] = «Регистрация ям за 7 дней», col[9] = «Устранено ям за 7 дней»
//   Строки [4..N] — данные (61 МО)
//
// ЖАЛОБЫ (Ямы на *):
//   Лист «Свод общий»:
//     Строка [2] — заголовок таблицы (сводная), строка [3] начало данных
//     col[0] = «Названия строк», col[1] = кол-во
//     Структура: сначала блок ОМС (первая строка = «ОМС» — итог блока, затем районы),
//                потом блок МАД (первая строка = «МАД» — итог, затем РУАД)
//     Берём только строку «ОМС» (итог) и строку «МАД» (итог) — это агрегаты
//
//   Лист «Свод за 7 дней»:
//     Строка [3] — заголовки: col[0]='Названия строк', col[1..7]=даты, col[8]='Общий итог'
//     Строки [4..N] — данные аналогично «Свод общий»
//     Берём «Общий итог» (последний столбец) для каждой строки

function parseExcel(buffer, reportType) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  // ─── РЕГИОНАЛЬНЫЙ ───────────────────────────────────────────────
  if (reportType === 'regional') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Получаем как массив массивов (не объектов) чтобы работать по индексам столбцов
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Строка [3] — заголовки, строки [4..] — данные
    // col[1]=РУАД, col[4]=рег7, col[9]=устранено7
    const result = [];
    for (let i = 4; i < rows.length; i++) {
      const row  = rows[i];
      if (!row || row.length < 2) continue;
      const name = String(row[1] || '').trim();
      if (!name) continue;
      result.push({
        name,
        registered: toNum(row[4]),
        fixed:      toNum(row[9]),
      });
    }
    return result;
  }

  // ─── МУНИЦИПАЛЬНЫЙ ──────────────────────────────────────────────
  if (reportType === 'municipal') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // col[1]=МО, col[4]=рег7, col[9]=устранено7
    const result = [];
    for (let i = 4; i < rows.length; i++) {
      const row  = rows[i];
      if (!row || row.length < 2) continue;
      const name = String(row[1] || '').trim();
      if (!name) continue;
      result.push({
        name,
        registered: toNum(row[4]),
        fixed:      toNum(row[9]),
      });
    }
    return result;
  }

  // ─── ЖАЛОБЫ ─────────────────────────────────────────────────────
  if (reportType === 'complaints') {
    const result = { total: [], week: [] };

    // ── Лист «Свод общий» ──
    // Сводная таблица Excel: строки [2]=мета, [3]=заголовок, [4..N]=данные
    // col[0]=название, col[1]=количество
    // Структура данных: строка «ОМС» = итог ОМС-блока; строка «МАД» = итог МАД-блока
    const totalSheetName = workbook.SheetNames.find(n => /свод.*общ/i.test(n));
    if (totalSheetName) {
      const sheet = workbook.Sheets[totalSheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      let inOms = false;
      let inMad = false;

      for (let i = 3; i < rows.length; i++) {
        const row  = rows[i];
        if (!row || !row[0]) continue;
        const name  = String(row[0]).trim();
        const count = toNum(row[1]);

        if (name === 'ОМС')  { inOms = true;  inMad = false; result.total.push({ name: 'ОМС',  type: 'oms', count }); continue; }
        if (name === 'МАД')  { inMad = true;  inOms = false; result.total.push({ name: 'МАД',  type: 'mad', count }); continue; }
        if (name === 'Общий итог') break;

        if (inOms) result.total.push({ name, type: 'oms', count });
        if (inMad) result.total.push({ name, type: 'mad', count });
      }
    }

    // ── Лист «Свод за 7 дней» ──
    // col[0]=название, col[1..7]=даты, последний столбец=«Общий итог»
    const weekSheetName = workbook.SheetNames.find(n => /7.*дн/i.test(n) || /недел/i.test(n) || /свод за 7/i.test(n));
    if (weekSheetName) {
      const sheet = workbook.Sheets[weekSheetName];
      const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      // Строка [3] — заголовки, данные с [4]
      // Последний не-null столбец = «Общий итог»
      let inOms = false;
      let inMad = false;

      for (let i = 4; i < rows.length; i++) {
        const row  = rows[i];
        if (!row || !row[0]) continue;
        const name = String(row[0]).trim();
        // Последний столбец в строке = «Общий итог»
        const count = toNum(row[row.length - 1]);

        if (name === 'ОМС')  { inOms = true;  inMad = false; result.week.push({ name: 'ОМС',  type: 'oms', count }); continue; }
        if (name === 'МАД')  { inMad = true;  inOms = false; result.week.push({ name: 'МАД',  type: 'mad', count }); continue; }
        if (name === 'Общий итог') break;

        if (inOms) result.week.push({ name, type: 'oms', count });
        if (inMad) result.week.push({ name, type: 'mad', count });
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

  if (url === '/api/pothole/reports' && req.method === 'GET') {
    const rows = db.prepare(
      'SELECT id, report_type, report_date, uploaded_at FROM pothole_reports ORDER BY report_date DESC, uploaded_at DESC'
    ).all();
    json(res, 200, rows);
    return;
  }

  const reportGetMatch = url.match(/^\/api\/pothole\/reports\/(\d+)$/);
  if (reportGetMatch && req.method === 'GET') {
    const row = db.prepare('SELECT * FROM pothole_reports WHERE id = ?').get(parseInt(reportGetMatch[1]));
    if (!row) { json(res, 404, { error: 'Not found' }); return; }
    row.data_json = JSON.parse(row.data_json);
    json(res, 200, row);
    return;
  }

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

  // GET /api/pothole/history?type=regional
  if (url.startsWith('/api/pothole/history') && req.method === 'GET') {
    const qtype = new URL('http://x' + req.url).searchParams.get('type') || '';
    const rows = db.prepare(
      'SELECT id, report_type, report_date, data_json FROM pothole_reports WHERE report_type = ? ORDER BY report_date ASC'
    ).all(qtype);
    const parsed = rows.map(r => ({ ...r, data_json: JSON.parse(r.data_json) }));
    json(res, 200, parsed);
    return;
  }

  // POST /api/pothole/upload
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

      const rowCount = Array.isArray(parsed)
        ? parsed.length
        : (parsed.total ? parsed.total.length : 0);

      db.prepare(
        'INSERT INTO pothole_reports (report_type, report_date, uploaded_at, data_json) VALUES (?, ?, ?, ?)'
      ).run(reportType, reportDate, new Date().toISOString(), JSON.stringify(parsed));

      json(res, 200, { ok: true, type: reportType, date: reportDate, rows: rowCount });
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
