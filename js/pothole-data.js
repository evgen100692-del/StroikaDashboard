/**
 * pothole-data.js — API-клиент для модуля «Ямочный ремонт»
 */

const PotholeData = (() => {
  const BASE = '/api/pothole';

  // Кэш последнезагруженных данных
  let _latest  = null;  // { complaints, regional, municipal }
  let _reports = [];    // метаданные всех отчётов

  // ─ Загрузка ────────────────────────────────────────────────────
  async function loadAll() {
    const [latestRes, reportsRes] = await Promise.all([
      fetch(`${BASE}/latest`),
      fetch(`${BASE}/reports`),
    ]);
    _latest  = await latestRes.json();
    _reports = await reportsRes.json();
  }

  async function loadHistory(type) {
    const res = await fetch(`${BASE}/history?type=${type}`);
    return res.json();
  }

  // ─ Загрузка Excel-файла ──────────────────────────────────────────
  async function uploadReport(file, reportType, reportDate) {
    const form = new FormData();
    form.append('file', file);
    form.append('report_type', reportType);
    form.append('report_date', reportDate);
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Ошибка загрузки');
    }
    const result = await res.json();
    // Обновляем кэш
    await loadAll();
    return result;
  }

  async function deleteReport(id) {
    const res = await fetch(`${BASE}/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Ошибка удаления');
    await loadAll();
  }

  // ─ Геттеры ─────────────────────────────────────────────────────
  function getLatest()  { return _latest; }
  function getReports() { return _reports; }

  // ─ Агрегация — KPI дашборда ───────────────────────────────
  function getKPI() {
    if (!_latest) return null;

    // Региональные: сумма строк
    const reg = _latest.regional?.data_json || [];
    const regRegistered = reg.reduce((s, r) => s + (r.registered || 0), 0);
    const regFixed      = reg.reduce((s, r) => s + (r.fixed      || 0), 0);

    // Муниципальные
    const mun = _latest.municipal?.data_json || [];
    const munRegistered = mun.reduce((s, r) => s + (r.registered || 0), 0);
    const munFixed      = mun.reduce((s, r) => s + (r.fixed      || 0), 0);

    // Жалобы
    const comp = _latest.complaints?.data_json || { total: [], week: [] };
    // Разделяем по ОМС vs МАД (РУАД)
    const compOmsTotal  = _splitComplaints(comp.total, 'oms');
    const compMadTotal  = _splitComplaints(comp.total, 'mad');
    const compOmsWeek   = _splitComplaints(comp.week,  'oms');
    const compMadWeek   = _splitComplaints(comp.week,  'mad');

    return {
      regional:   { registered: regRegistered, fixed: regFixed },
      municipal:  { registered: munRegistered, fixed: munFixed },
      complaints: {
        totalOms: compOmsTotal, totalMad: compMadTotal,
        weekOms:  compOmsWeek,  weekMad:  compMadWeek,
        totalAll: compOmsTotal + compMadTotal,
        weekAll:  compOmsWeek  + compMadWeek,
      },
      reportDates: {
        regional:   _latest.regional?.report_date   || null,
        municipal:  _latest.municipal?.report_date  || null,
        complaints: _latest.complaints?.report_date || null,
      },
    };
  }

  // Разбиваем жалобы на ОМС/МАД по ключевым словам в названии
  function _splitComplaints(list, type) {
    const headerName = type === 'oms' ? 'ОМС' : 'МАД';
    const row = (list || []).find(r => r.name === headerName);
    return row ? (row.count || 0) : 0;
  }

  // ─ Данные для графика динамики по неделям ──────────────────
  // Возвращает массив { label, registered, fixed, complaints }
  // label = "Н1", "Н2", ... (пн-вс)
  async function getWeeklyData(year, month) {
    const [regHistory, munHistory, compHistory] = await Promise.all([
      loadHistory('regional'),
      loadHistory('municipal'),
      loadHistory('complaints'),
    ]);

    // Фильтруем по месяцу
    function filterMonth(arr) {
      return arr.filter(r => {
        const d = new Date(r.report_date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }

    // Номер недели (пн-вс) для даты
    function weekNum(dateStr) {
      const d = new Date(dateStr);
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      // Сдвиг до понедельника
      const firstMon = new Date(firstDay);
      const dow = (firstDay.getDay() + 6) % 7; // 0=Пн
      firstMon.setDate(firstDay.getDate() - dow);
      const diff = Math.floor((d - firstMon) / 86400000);
      return Math.floor(diff / 7) + 1;
    }

    // Группируем по неделе: берём последнее загруженное значение в пределах недели
    function groupByWeek(arr, valueGetter) {
      const weeks = {};
      for (const r of arr) {
        const wn = weekNum(r.report_date);
        if (!weeks[wn]) weeks[wn] = { total: 0, lastDate: r.report_date };
        const val = valueGetter(r);
        if (r.report_date >= weeks[wn].lastDate) {
          weeks[wn].lastDate = r.report_date;
          weeks[wn].total = val;
        }
      }
      return weeks;
    }

    const regFiltered  = filterMonth(regHistory);
    const munFiltered  = filterMonth(munHistory);
    const compFiltered = filterMonth(compHistory);

    // Геттеры значений из записи истории
    const getRegReg   = r => r.data_json.reduce((s, x) => s + (x.registered || 0), 0);
    const getRegFixed = r => r.data_json.reduce((s, x) => s + (x.fixed      || 0), 0);
    const getMunReg   = r => r.data_json.reduce((s, x) => s + (x.registered || 0), 0);
    const getMunFixed = r => r.data_json.reduce((s, x) => s + (x.fixed      || 0), 0);
    const getCompAll  = r => {
      const d = r.data_json;
      return (d.week || []).reduce((s, x) => s + (x.count || 0), 0);
    };

    const regRegByWeek   = groupByWeek(regFiltered,  getRegReg);
    const regFixByWeek   = groupByWeek(regFiltered,  getRegFixed);
    const munRegByWeek   = groupByWeek(munFiltered,  getMunReg);
    const munFixByWeek   = groupByWeek(munFiltered,  getMunFixed);
    const compByWeek     = groupByWeek(compFiltered, getCompAll);

    // Определяем количество недель в месяце
    const allWeeks = new Set([
      ...Object.keys(regRegByWeek),
      ...Object.keys(munRegByWeek),
      ...Object.keys(compByWeek),
    ].map(Number));
    const maxWeek = allWeeks.size ? Math.max(...allWeeks) : 4;
    const weeks   = Array.from({ length: maxWeek }, (_, i) => i + 1);

    return weeks.map(wn => ({
      label:      `Н${wn}`,
      // FIX: суммируем зарегистрированные и устранённые по региональным + муниципальным
      registered: (regRegByWeek[wn]?.total || 0) + (munRegByWeek[wn]?.total || 0),
      fixed:      (regFixByWeek[wn]?.total || 0) + (munFixByWeek[wn]?.total || 0),
      complaints: compByWeek[wn]?.total || 0,
    }));
  }

  return {
    loadAll, uploadReport, deleteReport, loadHistory,
    getLatest, getReports, getKPI, getWeeklyData,
  };
})();
