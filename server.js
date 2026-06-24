// server.js — node server.js
// Перед запуском выполните: npm install

const http          = require('http');
const fs            = require('fs');
const path          = require('path');
const XLSX          = require('xlsx');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const PORT    = 3000;
const DB_PATH = path.join(__dirname, 'data', 'stroika.db');

// ── Папка data ────────────────────────────────────────────────────────────────
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// ══════════════════════════════════════════════════════════════════════════════
//  WORKER THREAD: парсинг Excel (не блокирует event loop главного потока)
// ══════════════════════════════════════════════════════════════════════════════
if (!isMainThread) {
  // Этот блок выполняется только внутри воркера
  try {
    const { fileBuffer, reportType } = workerData;
    const buf    = Buffer.from(fileBuffer);
    const result = parseExcelInWorker(buf, reportType);
    parentPort.postMessage({ ok: true, result });
  } catch (e) {
    parentPort.postMessage({ ok: false, error: e.message });
  }

  function toNum(v) {
    const n = parseFloat(String(v || 0).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  function parseExcelInWorker(buffer, reportType) {
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
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const name   = String(row[0]).trim();
          if (name === 'Названия строк') continue;
          const numVal = row.slice(1).find(v => v !== null && v !== '' && !isNaN(parseFloat(v)));
          const count  = toNum(numVal ?? 0);
          if (name === 'ОМС')        { inOms = true;  inMad = false; result.total.push({ name: 'ОМС', type: 'oms', count }); continue; }
          if (name === 'МАД')        { inMad = true;  inOms = false; result.total.push({ name: 'МАД', type: 'mad', count }); continue; }
          if (name === 'Общий итог') break;
          if (inOms) result.total.push({ name, type: 'oms', count });
          if (inMad) result.total.push({ name, type: 'mad', count });
        }
      }

      const weekSheetName = workbook.SheetNames.find(n => /7.*дн/i.test(n) || /недел/i.test(n) || /свод за 7/i.test(n));
      if (weekSheetName) {
        const sheet  = workbook.Sheets[weekSheetName];
        const rows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        let colIdx   = -1;
        for (let i = 0; i < Math.min(rows.length, 6); i++) {
          const hi = (rows[i] || []).findIndex(v => v && String(v).trim() === 'Общий итог');
          if (hi !== -1) { colIdx = hi; break; }
        }
        let inOms = false, inMad = false;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const name  = String(row[0]).trim();
          if (name === 'Названия строк') continue;
          const count = toNum(colIdx !== -1 ? row[colIdx] : row[row.length - 1]);
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

  function _parseRegMunSheet(sheet) {
    const rows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const result = [];
    for (let i = 4; i < rows.length; i++) {
      const row  = rows[i];
      if (!row || row.length < 2) continue;
      const name = String(row[1] || '').trim();
      if (!name) continue;
      result.push({
        name,
        registeredDay:   toNum(row[2]),
        registered:      toNum(row[4]),
        registeredTotal: toNum(row[6]),
        fixedDay:        toNum(row[7]),
        fixed:           toNum(row[9]),
        fixedTotal:      toNum(row[11]),
      });
    }
    return result;
  }

  // Воркер завершает работу сам после postMessage
  return;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ГЛАВНЫЙ ПОТОК
// ══════════════════════════════════════════════════════════════════════════════

// ── sql.js: синхронная инициализация БД ──────────────────────────────────────
const initSqlJs = require('sql.js');

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

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

    CREATE TABLE IF NOT EXISTS readiness_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id   INTEGER NOT NULL,
      prev_value    REAL NOT NULL,
      new_value     REAL NOT NULL,
      changed_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pothole_metadata (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      org_type   TEXT NOT NULL,
      name       TEXT NOT NULL,
      net_length REAL DEFAULT NULL,
      population REAL DEFAULT NULL,
      UNIQUE(org_type, name)
    );
  `);
}

// ── Сохранение БД на диск ─────────────────────────────────────────────────────
let _saveScheduled = false;
function saveDb() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] Ошибка сохранения:', e.message);
  }
}
function saveDbDeferred() {
  if (_saveScheduled) return;
  _saveScheduled = true;
  setImmediate(() => {
    _saveScheduled = false;
    saveDb();
  });
}

// ── Обёртки sql.js ────────────────────────────────────────────────────────────
function dbAll(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  );
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null;
}

function dbRun(sql, params = [], skipSave = false) {
  db.run(sql, params);
  if (!skipSave) saveDbDeferred();
  return db;
}

function dbInsert(sql, params = [], skipSave = false) {
  db.run(sql, params);
  const row = dbGet('SELECT last_insert_rowid() as id');
  if (!skipSave) saveDbDeferred();
  return row ? row.id : null;
}

// ── MIME ──────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

// ── Вспомогательные ───────────────────────────────────────────────────────────
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

// БАГ 2 ИСПРАВЛЕН: лимит тела запроса 50 МБ
const BODY_LIMIT = 50 * 1024 * 1024; // 50 MB

async function readBodyRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > BODY_LIMIT) {
        req.destroy();
        return reject(Object.assign(new Error('Файл слишком большой (макс. 50 МБ)'), { statusCode: 413 }));
      }
      chunks.push(chunk);
    });
    req.on('end',   () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Безопасное преобразование в число ────────────────────────────────────────
function toFloatOrNull(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Парсер multipart/form-data ────────────────────────────────────────────────
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

// БАГ 3 ИСПРАВЛЕН: парсим Excel в отдельном worker_threads потоке
// — XLSX.read() синхронный и блокирует event loop, воркер изолирует это
function parseExcelInWorker(fileBuffer, reportType) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: {
        // Передаём как ArrayBuffer — избегаем лишнего копирования
        fileBuffer: fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        ),
        reportType,
      },
      // Передаём буфер по ссылке (transferList) — не копируем 2 раза
      transferList: [
        fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        ),
      ],
    });

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(Object.assign(new Error('Превышено время обработки файла (30 с)'), { statusCode: 504 }));
    }, 30000);

    worker.on('message', msg => {
      clearTimeout(timeout);
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error));
    });
    worker.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── HTTP-сервер ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Таймаут на весь запрос: 60 секунд
  res.setTimeout(60000, () => {
    if (!res.writableEnded) {
      json(res, 503, { error: 'Превышено время ожидания сервера' });
    }
  });

  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ════════════════════════════════════════════════════════════════════════════
  //  API: КОНТРАКТЫ
  // ════════════════════════════════════════════════════════════════════════════

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
    const isSeed = body._seed === true;
    const newId = dbInsert(
      `INSERT INTO contracts (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      vals,
      isSeed
    );
    if (isSeed) saveDbDeferred();
    const row = dbGet('SELECT * FROM contracts WHERE id = ?', [newId]);
    json(res, 201, row);
    return;
  }

  const editMatch = url.match(/^\/api\/contracts\/(\d+)$/);
  if (editMatch) {
    const id = parseInt(editMatch[1]);
    if (req.method === 'PUT') {
      const body = await readBodyJSON(req);

      if ('readinessPct' in body) {
        const prev    = dbGet('SELECT readinessPct FROM contracts WHERE id = ?', [id]);
        const prevVal = prev ? parseFloat(prev.readinessPct) || 0 : 0;
        const newVal  = parseFloat(body.readinessPct) || 0;
        if (prevVal !== newVal) {
          db.run(
            'INSERT INTO readiness_history (contract_id, prev_value, new_value, changed_at) VALUES (?, ?, ?, ?)',
            [id, prevVal, newVal, new Date().toISOString()]
          );
          saveDbDeferred();
        }
      }

      const KNOWN_COLS = new Set([
        'objectName','financingSource','contractor','contractNum','contractDate',
        'priceGK','advanceGK','advancePaid','unworkedAdvance','paidTotal','completed',
        'completed2025','paid2025','limit2026was','limit2026cur','completed2026','paid2026',
        'limit2027was','limit2027cur','limit2028was','limit2028cur','limit2029was','limit2029cur',
        'remainder','readinessPct','workers','equipment','moge','dptStatus',
        'landWithdrawalPct','plannedIntroDate','plannedOpenDate','contractEndDate'
      ]);
      const filtered = Object.fromEntries(
        Object.entries(body).filter(([k]) => KNOWN_COLS.has(k))
      );

      const cols = Object.keys(filtered);
      const vals = Object.values(filtered);
      if (cols.length === 0) { json(res, 400, { error: 'Нет допустимых полей' }); return; }

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

  // ════════════════════════════════════════════════════════════════════════════
  //  API: ИСТОРИЯ СТРОЙГОТОВНОСТИ
  // ════════════════════════════════════════════════════════════════════════════

  if (url === '/api/readiness-history' && req.method === 'GET') {
    const qid = new URL('http://x' + req.url).searchParams.get('id');
    if (qid) {
      const rows = dbAll(
        'SELECT * FROM readiness_history WHERE contract_id = ? ORDER BY changed_at ASC',
        [parseInt(qid)]
      );
      json(res, 200, rows);
    } else {
      const rows = dbAll(`
        SELECT rh.*
        FROM readiness_history rh
        INNER JOIN (
          SELECT contract_id, MAX(changed_at) AS max_at
          FROM readiness_history
          GROUP BY contract_id
        ) latest ON rh.contract_id = latest.contract_id
                 AND rh.changed_at = latest.max_at
        ORDER BY rh.contract_id
      `);
      json(res, 200, rows);
    }
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  API: ЯМОЧНЫЙ РЕМОНТ
  // ════════════════════════════════════════════════════════════════════════════

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

  // ── UPLOAD ──────────────────────────────────────────────────────────────────
  if (url === '/api/pothole/upload' && req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';

      // БАГ 1 ИСПРАВЛЕН: граница может быть в кавычках или содержать лишние параметры
      // Корректно: обрезаем до первого пробела/;/кавычки после значения
      const boundaryMatch = contentType.match(/boundary=["']?([^"';\s]+)["']?/i);
      if (!boundaryMatch) {
        json(res, 400, { error: 'Не передан boundary в Content-Type' });
        return;
      }
      const boundary = boundaryMatch[1];

      // Читаем тело (с лимитом 50 МБ — см. readBodyRaw)
      const rawBody = await readBodyRaw(req);

      // Парсим multipart синхронно (только буферные операции, быстро)
      const parts = parseMultipart(rawBody, boundary);

      const reportTypePart = parts.find(p => p.name === 'report_type');
      const reportDatePart = parts.find(p => p.name === 'report_date');
      const filePart       = parts.find(p => p.filename);

      if (!reportTypePart || !reportDatePart || !filePart) {
        json(res, 400, { error: 'Отсутствуют обязательные поля (report_type, report_date, file)' });
        return;
      }

      const reportType = reportTypePart.text.trim();
      const reportDate = reportDatePart.text.trim();

      // БАГ 3 ИСПРАВЛЕН: парсим Excel в отдельном worker thread
      // — не блокирует event loop, соединение не рвётся
      const parsed = await parseExcelInWorker(filePart.body, reportType);

      const rowCount = Array.isArray(parsed)
        ? parsed.length
        : (parsed.total ? parsed.total.length : 0);

      dbInsert(
        'INSERT INTO pothole_reports (report_type, report_date, uploaded_at, data_json) VALUES (?, ?, ?, ?)',
        [reportType, reportDate, new Date().toISOString(), JSON.stringify(parsed)]
      );

      json(res, 200, { ok: true, type: reportType, date: reportDate, rows: rowCount });
    } catch (e) {
      console.error('[upload] Ошибка:', e);
      const code = e.statusCode || 500;
      json(res, code, { error: 'Ошибка обработки файла: ' + e.message });
    }
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  API: МЕТАДАННЫЕ (протяжённость сети, население)
  // ════════════════════════════════════════════════════════════════════════════

  if (url === '/api/pothole/metadata' && req.method === 'GET') {
    const orgType = new URL('http://x' + req.url).searchParams.get('org_type') || '';
    const rows = orgType
      ? dbAll('SELECT * FROM pothole_metadata WHERE org_type = ? ORDER BY name', [orgType])
      : dbAll('SELECT * FROM pothole_metadata ORDER BY org_type, name');
    json(res, 200, rows);
    return;
  }

  if (url === '/api/pothole/metadata' && req.method === 'POST') {
    try {
      const body = await readBodyJSON(req);
      const { org_type, name } = body;
      if (!org_type || !name) {
        json(res, 400, { error: 'Обязательные поля: org_type, name' }); return;
      }

      const existing = dbGet(
        'SELECT * FROM pothole_metadata WHERE org_type = ? AND name = ?',
        [org_type, name]
      );

      if (existing) {
        const updates = [];
        const vals    = [];
        if ('net_length' in body) { updates.push('net_length = ?'); vals.push(toFloatOrNull(body.net_length)); }
        if ('population' in body) { updates.push('population = ?'); vals.push(toFloatOrNull(body.population)); }
        if (updates.length) {
          dbRun(
            `UPDATE pothole_metadata SET ${updates.join(', ')} WHERE org_type = ? AND name = ?`,
            [...vals, org_type, name]
          );
        }
      } else {
        dbInsert(
          'INSERT INTO pothole_metadata (org_type, name, net_length, population) VALUES (?, ?, ?, ?)',
          [
            org_type,
            name,
            'net_length' in body ? toFloatOrNull(body.net_length) : null,
            'population' in body ? toFloatOrNull(body.population) : null,
          ]
        );
      }

      const row = dbGet('SELECT * FROM pothole_metadata WHERE org_type = ? AND name = ?', [org_type, name]);
      json(res, 200, row);
    } catch (e) {
      console.error('[metadata] Ошибка:', e);
      json(res, 500, { error: e.message });
    }
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Статические файлы
  // ════════════════════════════════════════════════════════════════════════════
  let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  const ext = path.extname(filePath);
  if (!ext) filePath += '.html';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('404 Not Found'); return; }
    cors(res);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ── Запуск ────────────────────────────────────────────────────────────────────
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
