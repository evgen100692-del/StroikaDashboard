// js/pages/pothole.js — дашборд «Ямочный ремонт»
// Зависит от: Chart.js (глобальный), utils.js (Toast, closeModal, openModal, fmt)
// Зависит от: charts-pothole.js (PotholeCharts) — должен быть подключён ДО этого файла

const PotholePage = (() => {
  // ── состояние ──────────────────────────────────────────────────────────────────
  let _reports     = [];   // список из /api/pothole/reports
  let _latest      = {};   // { complaints, regional, municipal } — последние отчёты
  let _history     = {};   // { complaints:[], regional:[], municipal:[] }
  let _charts      = {};   // Chart.js instances
  let _initialized = false;
  let _filter = { ruad: '', mo: '', org: 'all' };
  let _filterBarBound = false;

  // ── состояние страницы Отчёты ──────────────────────────────────────────────────────
  let _repActiveType = 'complaints';
  let _repTypeBound  = false;

  // ════════════════════════════════════════════════════════════════════════════
  //  PUBLIC: init()
  // ════════════════════════════════════════════════════════════════════════════
  async function init() {
    if (_initialized) {
      await _reload();
      return;
    }
    _initialized = true;
    _bindUploadModal();
    _bindUploadButtons();
    const uploadOverlay = document.getElementById('upload-modal');
    if (uploadOverlay) {
      const observer = new MutationObserver(() => {
        if (!uploadOverlay.classList.contains('open')) {
          _uploadState = { type: null, file: null };
        }
      });
      observer.observe(uploadOverlay, { attributes: true, attributeFilter: ['class'] });
    }
    await _reload();
  }

  // ── загрузка всех данных ────────────────────────────────────────────────────────
  async function _reload() {
    try {
      const [rList, rLatest] = await Promise.all([
        fetch('/api/pothole/reports').then(r => r.json()),
        fetch('/api/pothole/latest').then(r => r.json()),
      ]);
      _reports = rList;
      _latest  = rLatest;

      const [hC, hR, hM] = await Promise.all([
        fetch('/api/pothole/history?type=complaints').then(r => r.json()),
        fetch('/api/pothole/history?type=regional').then(r => r.json()),
        fetch('/api/pothole/history?type=municipal').then(r => r.json()),
      ]);
      _history = { complaints: hC, regional: hR, municipal: hM };

      _renderDashboard();
      _renderReportsPage();
      await refreshRating();
    } catch (e) {
      console.error('[PotholePage] reload error', e);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  HELPERS: работа с датами
  // ════════════════════════════════════════════════════════════════════════════

  function _todayISO() { return _toISO(new Date()); }

  function _daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return _toISO(d);
  }

  function _findLatestBefore(history, targetISO) {
    if (!history || !history.length) return null;
    const sorted = [...history].sort((a, b) => a.report_date > b.report_date ? 1 : -1);
    if (!targetISO) return sorted[sorted.length - 1];
    let best = null;
    for (const r of sorted) {
      if (r.report_date <= targetISO) best = r;
      else break;
    }
    return best;
  }

  function _sumReportField(report, field, nameFilter) {
    if (!report) return 0;
    const rows = nameFilter
      ? (report.data_json || []).filter(r => r.name === nameFilter)
      : (report.data_json || []);
    return rows.reduce((s, r) => s + (r[field] || 0), 0);
  }

  function _sumCompReport(report, useReg, useMun) {
    if (!report) return 0;
    const data = report.data_json;
    if (!data || !data.week) return 0;
    if (_filter.ruad) {
      const row = (data.week || []).find(r => r.name === _filter.ruad);
      return row ? row.count : 0;
    }
    if (_filter.mo) {
      const row = _findCompRowByMo(data.week, _filter.mo);
      return row ? row.count : 0;
    }
    const omsRow = useMun ? data.week.find(r => r.name === 'ОМС') : null;
    const madRow = useReg ? data.week.find(r => r.name === 'МАД') : null;
    return (omsRow ? omsRow.count : 0) + (madRow ? madRow.count : 0);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  DASHBOARD RENDER
  // ════════════════════════════════════════════════════════════════════════════
  function _applyRuadFilter(rows) {
    if (!_filter.ruad) return rows || [];
    return (rows || []).filter(r => r.name === _filter.ruad);
  }

  function _normalizeMoName(name) {
    if (!name) return '';
    return name.trim()
      .toLowerCase()
      .replace(/\s*г\.?о\.?$/i, '')
      .replace(/\s*г\/о$/i, '')
      .trim();
  }

  function _findCompRowByMo(rows, moName) {
    if (!rows || !moName) return null;
    const needle = _normalizeMoName(moName);
    return rows.find(r => _normalizeMoName(r.name) === needle) || null;
  }

  function _getRuadOptions() {
    const names = new Set();
    (_latest.regional?.data_json || []).forEach(r => { if (r.name) names.add(r.name); });
    (_history.regional || []).forEach(report => {
      (report.data_json || []).forEach(r => { if (r.name) names.add(r.name); });
    });
    return Array.from(names).sort();
  }

  function _getMoOptions() {
    const names = new Set();
    (_latest.municipal?.data_json || []).forEach(r => { if (r.name) names.add(r.name); });
    (_history.municipal || []).forEach(report => {
      (report.data_json || []).forEach(r => { if (r.name) names.add(r.name); });
    });
    return Array.from(names).sort();
  }

  function _renderFilterBar() {
    const bar = document.getElementById('ph-filter-bar');
    if (!bar) return;

    const ruadSelect = document.getElementById('ph-filter-ruad');
    if (ruadSelect) {
      const opts = _getRuadOptions();
      const prev = _filter.ruad;
      ruadSelect.innerHTML = '<option value="">Все РУАД</option>'
        + opts.map(n => `<option value="${n}">${n}</option>`).join('');
      ruadSelect.value = (prev && opts.includes(prev)) ? prev : '';
    }

    const moSelect = document.getElementById('ph-filter-mo');
    if (moSelect) {
      const opts = _getMoOptions();
      const prev = _filter.mo;
      moSelect.innerHTML = '<option value="">Все МО</option>'
        + opts.map(n => `<option value="${n}">${n}</option>`).join('');
      moSelect.value = (prev && opts.includes(prev)) ? prev : '';
    }

    const groupRuad = document.getElementById('ph-filter-group-ruad');
    const groupMo   = document.getElementById('ph-filter-group-mo');
    if (groupRuad) groupRuad.style.display = (_filter.org === 'oms') ? 'none' : '';
    if (groupMo)   groupMo.style.display   = (_filter.org === 'mad') ? 'none' : '';

    const hasData = _latest.regional || _latest.municipal || _latest.complaints;
    bar.style.display = hasData ? '' : 'none';
  }

  function _bindFilterBar() {
    const ruadSelect = document.getElementById('ph-filter-ruad');
    const moSelect   = document.getElementById('ph-filter-mo');
    const orgBtns    = document.querySelectorAll('[data-ph-org]');

    orgBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        orgBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter.org  = btn.dataset.phOrg;
        _filter.ruad = '';
        _filter.mo   = '';
        _renderFilterBar();
        _applyFiltersAndRedraw();
      });
    });

    if (ruadSelect) {
      ruadSelect.addEventListener('change', () => {
        _filter.ruad = ruadSelect.value;
        _applyFilter