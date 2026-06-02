// Этот скрипт генерирует data/dashboard-data.json из Excel-файла
// Запуск: node scripts/build-data.js <путь_к_xlsx>
// Требует: npm install xlsx

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = process.argv[2] || 'Stroika_-ot-29.05.xlsx';
const outPath = path.join(__dirname, '../data/dashboard-data.json');

function safeFloat(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function fmtDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Excel serial date number
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(v).trim();
}

const wb = XLSX.readFile(xlsxPath, { cellDates: true });

// ===== СВОД =====
const wsСвод = wb.Sheets['СВОД СМР'];
const svodRaw = XLSX.utils.sheet_to_json(wsСвод, { header: 1, defval: null });
const svod = [];
for (const r of svodRaw.slice(4)) {
  if (!r[3] || typeof r[3] !== 'string' || r[3].trim().length < 2) continue;
  const name = r[3].trim();
  if (['ВСЕГО','Итого'].includes(name) || name.startsWith('#')) continue;
  svod.push({
    contractor: name,
    contractsTotal: safeFloat(r[5]),
    contractSum: safeFloat(r[4]),
    paidBefore2026: safeFloat(r[7]),
    advancePlan: safeFloat(r[9]),
    advancePlanPct: safeFloat(r[10]),
    advanceIssued: safeFloat(r[11]),
    advanceIssuedPct: safeFloat(r[12]),
    advanceOutstanding: safeFloat(r[13]),
    advanceOutstandingPct: safeFloat(r[14]),
    paidTotal: safeFloat(r[15]),
    paidPct: safeFloat(r[16]),
    doneTotal: safeFloat(r[17]),
    donePct: safeFloat(r[18]),
    limit2026: safeFloat(r[20]),
    limit2027: safeFloat(r[22]),
  });
}

// ===== КОНТРАКТЫ =====
const wsCon = wb.Sheets['контракты СМР'];
const conRaw = XLSX.utils.sheet_to_json(wsCon, { header: 1, defval: null });
const contracts = [];
let currentContractor = null;
for (const r of conRaw.slice(3)) {
  if (r[0] === null && typeof r[1] === 'string' && r[1].trim().length >= 2) {
    const n = r[1].trim();
    if (!['ВСЕГО','Итого'].includes(n) && !n.startsWith('#')) currentContractor = n;
    continue;
  }
  if (r[0] !== null && typeof r[1] === 'string' && r[1].trim().length > 5) {
    contracts.push({
      project: r[1].trim().replace(/\n/g,' '),
      contractor: currentContractor,
      contractNo: fmtDate(r[2]),
      contractValue: safeFloat(r[3]),
      workType: r[4] ? String(r[4]).trim() : null,
      advancePlan: safeFloat(r[5]),
      advancePct: safeFloat(r[6]),
      advanceIssued: safeFloat(r[7]),
      advanceIssuedPct: safeFloat(r[8]),
      advance2025: safeFloat(r[9]),
      advanceOutstanding: safeFloat(r[10]),
      advanceOutstandingPct: safeFloat(r[11]),
      paidTotal: safeFloat(r[12]),
      paidPct: safeFloat(r[13]),
      doneTotal: safeFloat(r[14]),
      donePct: safeFloat(r[15]),
      done2025: safeFloat(r[16]),
      paid2025: safeFloat(r[17]),
      limit2026: safeFloat(r[21] ?? r[20]),
      paid2026: safeFloat(r[22]),
      advance2026: safeFloat(r[23]),
      balance2026: safeFloat(r[24]),
      limit2027: safeFloat(r[26]),
      limit2028: safeFloat(r[28]),
      limit2029: safeFloat(r[30]),
      sgPct: safeFloat(r[32]),
      withdrawalPct: safeFloat(r[33]),
      ppt: r[34] ? String(r[34]).trim() : null,
      finishPlan: fmtDate(r[35]),
      startPlan: fmtDate(r[36]),
      contractDeadline: fmtDate(r[37]),
    });
  }
}

// ===== ОБЪЕКТЫ СМР =====
const wsSmr = wb.Sheets['СМР'];
const smrRaw = XLSX.utils.sheet_to_json(wsSmr, { header: 1, defval: null });
const objects = [];
for (const r of smrRaw.slice(9)) {
  if (!r[4] || typeof r[4] !== 'string' || r[4].trim().length < 5) continue;
  if (typeof r[0] !== 'number') continue;
  objects.push({
    num: r[0],
    activity: r[2] ? String(r[2]).trim() : null,
    omsu: r[3] ? String(r[3]).trim() : null,
    object: r[4].trim().replace(/\n/g,' '),
    powerKm: safeFloat(r[5]),
    powerM: safeFloat(r[6]),
    contractDate: fmtDate(r[7]),
    contractNo: r[8] ? String(r[8]).trim() : null,
    contractor: r[9] ? String(r[9]).trim() : null,
    readinessMay22: safeFloat(r[10]),
    readinessNow: safeFloat(r[11]),
    weekDelta: safeFloat(r[12]),
    workers: safeFloat(r[13]),
    machines: safeFloat(r[14]),
    mogae: r[15] ? String(r[15]).trim() : null,
    dptStatus: r[16] ? String(r[16]).trim() : null,
    zu: r[17] ? String(r[17]).trim() : null,
    contractValue: safeFloat(r[18]),
    paidTotal: safeFloat(r[19]),
    paidPct: safeFloat(r[20]),
    advanceK: safeFloat(r[21]),
    advancePct: safeFloat(r[22]),
    doneK: safeFloat(r[23]),
    donePct: safeFloat(r[24]),
    advancePlan: safeFloat(r[25]),
    advanceOutstanding: safeFloat(r[26]),
    paidNoAdvance: safeFloat(r[27]),
    paidNoAdvancePct: safeFloat(r[28]),
    paid2026: safeFloat(r[29]),
    advance2026: safeFloat(r[30]),
    advance2026Pct: safeFloat(r[31]),
    paidNoAdv2026: safeFloat(r[32]),
    paidNoAdv2026Pct: safeFloat(r[33]),
    cashGap: r[34] ? String(r[34]).trim() : null,
    contractDeadline: fmtDate(r[35]),
    financeSource: r[36] ? String(r[36]).trim() : null,
    finishPlan: fmtDate(r[37]),
    openingPlan: fmtDate(r[38]),
    objectCost: safeFloat(r[39]),
    fundedBefore2025: safeFloat(r[40]),
    limit2025: safeFloat(r[41]),
    limit2026: safeFloat(r[42]),
    limit2027: safeFloat(r[43]),
    limit2028: safeFloat(r[44]),
    limit2029: safeFloat(r[45]),
    costRemainder: safeFloat(r[46]),
    limit2026balance: safeFloat(r[47]),
  });
}

const output = {
  meta: {
    sourceFile: path.basename(xlsxPath),
    generatedAt: new Date().toISOString(),
    summary: {
      contractors: svod.length,
      contracts: contracts.length,
      objects: objects.length,
    }
  },
  svod,
  contracts,
  objects
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Done: ${svod.length} contractors, ${contracts.length} contracts, ${objects.length} objects → ${outPath}`);
