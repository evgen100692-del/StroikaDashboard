/**
 * data.js — Хранение данных через REST API (server.js)
 * При открытии напрямую как файл — fallback на localStorage
 */

const AppData = (() => {
  const API = '/api/contracts';

  let state = { contracts: [], nextId: 1 };

  // Определяем: работаем через сервер или открыты как file://
  function isServerMode() {
    return location.protocol !== 'file:';
  }

  // ── Persistence ───────────────────────────────────────────────────
  function saveLocal() {
    try { localStorage.setItem('dashboard_data_v1', JSON.stringify(state)); } catch(e) {}
  }

  async function load() {
    if (isServerMode()) {
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state = await res.json();
      } catch(e) {
        console.warn('[AppData] Сервер недоступен:', e.message);
      }
    } else {
      // Fallback: localStorage (при открытии файла напрямую)
      try {
        const raw = localStorage.getItem('dashboard_data_v1');
        if (raw) state = JSON.parse(raw);
      } catch(e) {}
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  function getContracts() { return state.contracts; }

  async function addContract(data) {
    if (isServerMode()) {
      const res = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Ошибка сохранения: ' + res.status);
      const row = await res.json();
      state.contracts.push(row);
      state.nextId = row.id + 1;
      return row;
    } else {
      const row = { id: state.nextId++, ...sanitize(data) };
      state.contracts.push(row);
      saveLocal();
      return row;
    }
  }

  async function updateContract(id, data) {
    if (isServerMode()) {
      const res = await fetch(`${API}/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Ошибка обновления: ' + res.status);
      const updated = await res.json();
      const idx = state.contracts.findIndex(c => c.id === id);
      if (idx !== -1) state.contracts[idx] = updated;
      return updated;
    } else {
      const idx = state.contracts.findIndex(c => c.id === id);
      if (idx === -1) return null;
      state.contracts[idx] = { ...state.contracts[idx], ...sanitize(data) };
      saveLocal();
      return state.contracts[idx];
    }
  }

  async function deleteContract(id) {
    if (isServerMode()) {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка удаления: ' + res.status);
    } else {
      // FIX: фильтруем массив ДО сохранения, иначе удалённая запись попадает в localStorage
      state.contracts = state.contracts.filter(c => c.id !== id);
      saveLocal();
      return;
    }
    state.contracts = state.contracts.filter(c => c.id !== id);
  }

  function getContractById(id) {
    return state.contracts.find(c => c.id === id) || null;
  }

  // ── Contractors (derived) ─────────────────────────────────────────
  function getContractors() {
    const map = {};
    for (const c of state.contracts) {
      const name = (c.contractor || '').trim();
      if (!name) continue;
      if (!map[name]) {
        map[name] = {
          name,
          totalGK: 0, count: 0,
          advanceGK: 0, advancePaid: 0, unworkedAdvance: 0,
          paidTotal: 0, completed: 0,
          limit2026was: 0, limit2026cur: 0,
          limit2027was: 0, limit2027cur: 0,
          limit2028was: 0, limit2028cur: 0,
          limit2029was: 0, limit2029cur: 0,
        };
      }
      const m = map[name];
      m.totalGK         += num(c.priceGK);
      m.count           += 1;
      m.advanceGK       += num(c.advanceGK);
      m.advancePaid     += num(c.advancePaid);
      m.unworkedAdvance += num(c.unworkedAdvance);
      m.paidTotal       += num(c.paidTotal);
      m.completed       += num(c.completed);
      m.limit2026was    += num(c.limit2026was);
      m.limit2026cur    += num(c.limit2026cur);
      m.limit2027was    += num(c.limit2027was);
      m.limit2027cur    += num(c.limit2027cur);
      m.limit2028was    += num(c.limit2028was);
      m.limit2028cur    += num(c.limit2028cur);
      m.limit2029was    += num(c.limit2029was);
      m.limit2029cur    += num(c.limit2029cur);
    }
    for (const m of Object.values(map)) {
      m.advanceGKPct   = m.totalGK     ? pct(m.advanceGK,      m.totalGK)    : 0;
      m.advancePaidPct = m.advanceGK   ? pct(m.advancePaid,    m.advanceGK)  : 0;
      m.unworkedAdvPct = m.advancePaid ? pct(m.unworkedAdvance,m.advancePaid) : 0;
      m.paidTotalPct   = m.totalGK     ? pct(m.paidTotal,      m.totalGK)    : 0;
      m.completedPct   = m.totalGK     ? pct(m.completed,      m.totalGK)    : 0;
    }
    return Object.values(map).sort((a,b) => b.totalGK - a.totalGK);
  }

  function getContractorNames() {
    return [...new Set(
      state.contracts.map(c => (c.contractor || '').trim()).filter(Boolean)
    )].sort();
  }

  function getFinancingSources() {
    return [...new Set(
      state.contracts.map(c => (c.financingSource || '').trim()).filter(Boolean)
    )].sort();
  }

  function getOpeningYears() {
    return [...new Set(
      state.contracts
        .filter(c => c.plannedOpenDate)
        .map(c => new Date(c.plannedOpenDate).getFullYear())
        .filter(y => !isNaN(y))
    )].sort();
  }

  function filterContracts({ contractor, year, source, search } = {}) {
    const norm = s => String(s || '').trim().toLowerCase();

    return state.contracts.filter(c => {
      if (contractor && norm(c.contractor) !== norm(contractor)) return false;
      if (source && norm(c.financingSource) !== norm(source)) return false;
      if (year) {
        const y = c.plannedOpenDate ? new Date(c.plannedOpenDate).getFullYear() : null;
        if (String(y) !== String(year)) return false;
      }
      if (search) {
        if (!norm(c.objectName).includes(norm(search))) return false;
      }
      return true;
    });
  }

  function getAnalytics(filtered) {
    const list = filtered || state.contracts;
    const totalGK    = list.reduce((s,c) => s + num(c.priceGK),         0);
    const paidTotal  = list.reduce((s,c) => s + num(c.paidTotal),       0);
    const completed  = list.reduce((s,c) => s + num(c.completed),       0);
    const advancePaid= list.reduce((s,c) => s + num(c.advancePaid),     0);
    const unworked   = list.reduce((s,c) => s + num(c.unworkedAdvance), 0);
    const remainder  = list.reduce((s,c) => s + num(c.remainder),       0);

    const limits = {
      2026: { was: 0, cur: 0 }, 2027: { was: 0, cur: 0 },
      2028: { was: 0, cur: 0 }, 2029: { was: 0, cur: 0 },
    };
    for (const c of list) {
      limits[2026].was += num(c.limit2026was); limits[2026].cur += num(c.limit2026cur);
      limits[2027].was += num(c.limit2027was); limits[2027].cur += num(c.limit2027cur);
      limits[2028].was += num(c.limit2028was); limits[2028].cur += num(c.limit2028cur);
      limits[2029].was += num(c.limit2029was); limits[2029].cur += num(c.limit2029cur);
    }

    const byContractor = {};
    for (const c of list) {
      const name = (c.contractor || 'Не указан').trim();
      byContractor[name] = (byContractor[name] || 0) + num(c.priceGK);
    }

    return {
      count: list.length, totalGK, paidTotal, completed,
      advancePaid, unworked, remainder,
      paidTotalPct:  totalGK ? pct(paidTotal, totalGK)  : 0,
      completedPct:  totalGK ? pct(completed, totalGK)  : 0,
      limits, byContractor,
      avgReadiness: list.length
        ? list.reduce((s,c) => s + num(c.readinessPct), 0) / list.length
        : 0,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function num(v) {
    const n = parseFloat(String(v||0).replace(/\s/g,'').replace(',','.'));
    return isNaN(n) ? 0 : n;
  }
  function pct(a, b) { return b === 0 ? 0 : Math.round((a/b) * 1000) / 10; }

  function sanitize(data) {
    const numFields = [
      'priceGK','advanceGK','advancePaid','unworkedAdvance','paidTotal','completed',
      'completed2025','paid2025','limit2026was','limit2026cur','completed2026','paid2026',
      'limit2027was','limit2027cur','limit2028was','limit2028cur','limit2029was','limit2029cur',
      'remainder','readinessPct','workers','equipment','landWithdrawalPct'
    ];
    const result = { ...data };
    for (const f of numFields) {
      if (f in result) result[f] = num(result[f]);
    }
    if (result.readinessPct > 100) result.readinessPct = 100;
    return result;
  }

  // ── Init ──────────────────────────────────────────────────────────
  return {
    load,
    getContracts, addContract, updateContract, deleteContract, getContractById,
    getContractors, getContractorNames, getFinancingSources, getOpeningYears,
    filterContracts, getAnalytics,
    num, pct,
  };
})();
