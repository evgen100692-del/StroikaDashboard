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
  let _maintDates = [];  // список дат загрузок техобслуживания

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
        _applyFiltersAndRedraw();
      });
    }

    if (moSelect) {
      moSelect.addEventListener('change', () => {
        _filter.mo = moSelect.value;
        _applyFiltersAndRedraw();
      });
    }

    const resetBtn = document.getElementById('ph-filter-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        _filter = { ruad: '', mo: '', org: 'all' };
        orgBtns.forEach(b => b.classList.toggle('active', b.dataset.phOrg === 'all'));
        _renderFilterBar();
        _applyFiltersAndRedraw();
      });
    }
  }

  function _applyFiltersAndRedraw() {
    _renderKPIs();
    _renderDonuts();
    _redrawWeeklyChart();
  }

  function _renderDashboard() {
    const hasData = _latest.regional || _latest.municipal || _latest.complaints;
    document.getElementById('ph-no-data').style.display      = hasData ? 'none' : 'flex';
    document.getElementById('ph-data-content').style.display = hasData ? '' : 'none';
    if (!hasData) return;

    _renderFilterBar();

    if (!_filterBarBound) {
      _bindFilterBar();
      _filterBarBound = true;
    }

    _renderKPIs();
    _renderDonuts();
    _renderWeekly();
  }

  function _renderKPIs() {
    const useReg = _filter.org !== 'oms';
    const useMun = _filter.org !== 'mad';

    const today   = _todayISO();
    const weekAgo = _daysAgoISO(7);

    const curRegReport  = useReg ? _findLatestBefore(_history.regional,  today)   : null;
    const prevRegReport = useReg ? _findLatestBefore(_history.regional,  weekAgo) : null;
    const curMunReport  = useMun ? _findLatestBefore(_history.municipal, today)   : null;
    const prevMunReport = useMun ? _findLatestBefore(_history.municipal, weekAgo) : null;

    const curReg  = _sumReportField(curRegReport,  'registered', _filter.ruad)
                  + _sumReportField(curMunReport,  'registered', _filter.mo);
    const prevReg = _sumReportField(prevRegReport, 'registered', _filter.ruad)
                  + _sumReportField(prevMunReport, 'registered', _filter.mo);

    const curFix  = _sumReportField(curRegReport,  'fixed', _filter.ruad)
                  + _sumReportField(curMunReport,  'fixed', _filter.mo);
    const prevFix = _sumReportField(prevRegReport, 'fixed', _filter.ruad)
                  + _sumReportField(prevMunReport, 'fixed', _filter.mo);

    const curCompReport  = _findLatestBefore(_history.complaints, today);
    const prevCompReport = _findLatestBefore(_history.complaints, weekAgo);

    const curComp  = _sumCompReport(curCompReport,  useReg, useMun);
    const prevComp = _sumCompReport(prevCompReport, useReg, useMun);

    const regDate  = curRegReport?.report_date  || curMunReport?.report_date  || null;
    const compDate = curCompReport?.report_date || null;

    _setKPI('ph-kpi-reg',  curReg,  prevReg,  regDate,  'ph-kpi-reg-date',  'ph-kpi-reg-delta',  false);
    _setKPI('ph-kpi-fix',  curFix,  prevFix,  regDate,  'ph-kpi-fix-date',  'ph-kpi-fix-delta',  false);
    _setKPI('ph-kpi-comp', curComp, prevComp, compDate, 'ph-kpi-comp-date', 'ph-kpi-comp-delta', true);
  }

  function _setKPI(valId, curVal, prevVal, date, dateId, deltaId, invertDelta) {
    document.getElementById(valId).textContent = curVal.toLocaleString('ru');

    const dateEl = document.getElementById(dateId);
    if (dateEl) {
      dateEl.textContent = date
        ? 'Отчёт: ' + _fmtDate(date) + ' (Δ 7 дн. от ' + _fmtDate(_daysAgoISO(7)) + ')'
        : '';
    }

    const el = document.getElementById(deltaId);
    if (!el) return;

    if (prevVal === 0 && curVal === 0) {
      el.textContent = 'нет данных';
      el.className   = 'ph-kpi-delta neu';
      return;
    }

    _applyDelta(el, curVal, prevVal, invertDelta);
  }

  function _applyDelta(el, curVal, prevVal, invertDelta) {
    const diff = curVal - prevVal;
    if (diff === 0) {
      el.textContent = 'без изменений';
      el.className   = 'ph-kpi-delta neu';
    } else if (diff > 0) {
      el.textContent = '+' + diff.toLocaleString('ru');
      el.className   = invertDelta ? 'ph-kpi-delta down' : 'ph-kpi-delta up';
    } else {
      el.textContent = diff.toLocaleString('ru');
      el.className   = invertDelta ? 'ph-kpi-delta up' : 'ph-kpi-delta down';
    }
  }

  function _renderDonuts() {
    const useReg = _filter.org !== 'oms';
    const useMun = _filter.org !== 'mad';

    const regData = useReg
      ? (_filter.ruad
          ? (_latest.regional?.data_json || []).filter(r => r.name === _filter.ruad)
          : (_latest.regional?.data_json || []))
      : [];

    const munData = useMun
      ? (_filter.mo
          ? (_latest.municipal?.data_json || []).filter(r => r.name === _filter.mo)
          : (_latest.municipal?.data_json || []))
      : [];

    const compData = _latest.complaints ? _latest.complaints.data_json : null;

    const regSum    = regData.reduce((s, r) => s + (r.registeredTotal ?? r.registered ?? 0), 0);
    const munRegSum = munData.reduce((s, r) => s + (r.registeredTotal ?? r.registered ?? 0), 0);
    const regFixSum = regData.reduce((s, r) => s + (r.fixedTotal      ?? r.fixed      ?? 0), 0);
    const munFixSum = munData.reduce((s, r) => s + (r.fixedTotal      ?? r.fixed      ?? 0), 0);

    let omsC = 0, madC = 0;
    if (compData) {
      if (_filter.ruad) {
        const row = (compData.total || []).find(r => r.name === _filter.ruad);
        madC = row ? row.count : 0;
      } else if (_filter.mo) {
        const row = _findCompRowByMo(compData.total, _filter.mo);
        omsC = row ? row.count : 0;
      } else {
        const omsRow = (useMun && compData) ? compData.total.find(r => r.name === 'ОМС') : null;
        const madRow = (useReg && compData) ? compData.total.find(r => r.name === 'МАД') : null;
        omsC = omsRow ? omsRow.count : 0;
        madC = madRow ? madRow.count : 0;
      }
    }

    _charts['donut-reg']  = PotholeCharts.donut('ph-chart-reg-donut',  [munRegSum, regSum],    ['Муниципальные (ОМС)', 'Региональные (МАД)'], _charts['donut-reg']);
    _charts['donut-fix']  = PotholeCharts.donut('ph-chart-fix-donut',  [munFixSum, regFixSum], ['Муниципальные (ОМС)', 'Региональные (МАД)'], _charts['donut-fix']);
    _charts['donut-comp'] = PotholeCharts.donut('ph-chart-comp-donut', [omsC, madC],           ['ОМС (муниципальные)', 'МАД (региональные)'], _charts['donut-comp']);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  WEEKLY CHART
  // ════════════════════════════════════════════════════════════════════════════

  function _getAnchorDate() {
    const dates = [];
    ['regional', 'municipal', 'complaints'].forEach(key => {
      const h = _history[key];
      if (h && h.length) dates.push(h[h.length - 1].report_date);
    });
    if (!dates.length) return new Date();
    const iso = dates.sort().pop();
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function _getEarliestDate() {
    const dates = [];
    ['regional', 'municipal', 'complaints'].forEach(key => {
      const h = _history[key];
      if (h && h.length) dates.push(h[0].report_date);
    });
    if (!dates.length) return _getAnchorDate();
    const iso = dates.sort()[0];
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function _getRecentWeeks(n) {
    const anchor   = _getAnchorDate();
    const earliest = _getEarliestDate();

    const msPerWeek  = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.floor((anchor - earliest) / msPerWeek) + 1;
    const count      = Math.min(totalWeeks, n);

    const weeks = [];
    for (let i = count - 1; i >= 0; i--) {
      const to = new Date(anchor);
      to.setDate(anchor.getDate() - i * 7);
      const from = new Date(to);
      from.setDate(to.getDate() - 6);
      weeks.push({
        from:  _toISO(from),
        to:    _toISO(to),
        label: _fmtShortWeek(from, to),
      });
    }
    return weeks;
  }

  function _fmtShortWeek(from, to) {
    const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    const sameMonth = from.getMonth() === to.getMonth();
    if (sameMonth) return from.getDate() + '–' + to.getDate() + ' ' + months[from.getMonth()];
    return from.getDate() + ' ' + months[from.getMonth()] + ' – ' + to.getDate() + ' ' + months[to.getMonth()];
  }

  function _renderWeekly() { _redrawWeeklyChart(); }

  function _redrawWeeklyChart() {
    const weeks  = _getRecentWeeks(12);
    const useReg = _filter.org !== 'oms';
    const useMun = _filter.org !== 'mad';

    const weekData = weeks.map(w => ({
      label:      w.label,
      registered: (useReg ? _sumWeekFiltered(_history.regional,  'registered', w, _filter.ruad) : 0)
                + (useMun ? _sumWeekFiltered(_history.municipal, 'registered', w, _filter.mo)   : 0),
      fixed:      (useReg ? _sumWeekFiltered(_history.regional,  'fixed',      w, _filter.ruad) : 0)
                + (useMun ? _sumWeekFiltered(_history.municipal, 'fixed',      w, _filter.mo)   : 0),
      complaints: _sumCompWeekFiltered(_history.complaints, w),
    }));

    _charts['weekly'] = PotholeCharts.weekly('ph-chart-weekly', weekData, _charts['weekly']);
  }

  function _sumWeekFiltered(history, field, week, nameFilter) {
    if (!history || !history.length) return 0;
    const candidates = history.filter(r => r.report_date <= week.to);
    if (!candidates.length) return 0;
    const report = candidates[candidates.length - 1];
    const rows = nameFilter
      ? (report.data_json || []).filter(r => r.name === nameFilter)
      : (report.data_json || []);
    return rows.reduce((s, r) => s + (r[field] || 0), 0);
  }

  function _sumCompWeekFiltered(history, week) {
    if (!history || !history.length) return 0;
    const candidates = history.filter(r => r.report_date <= week.to);
    if (!candidates.length) return 0;
    const report = candidates[candidates.length - 1];
    const data = report.data_json;
    if (!data || !data.week) return 0;

    if (_filter.ruad) {
      const row = data.week.find(r => r.name === _filter.ruad);
      return row ? row.count : 0;
    }
    if (_filter.mo) {
      const row = _findCompRowByMo(data.week, _filter.mo);
      return row ? row.count : 0;
    }
    const omsRow = data.week.find(r => r.name === 'ОМС');
    const madRow = data.week.find(r => r.name === 'МАД');
    if (_filter.org === 'oms') return omsRow ? omsRow.count : 0;
    if (_filter.org === 'mad') return madRow ? madRow.count : 0;
    return (omsRow ? omsRow.count : 0) + (madRow ? madRow.count : 0);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  REPORTS PAGE
  // ════════════════════════════════════════════════════════════════════════════

  function _renderReportsPage() {
    _updateRepCounts();
    fetch('/api/maintenance/upload/dates').then(r=>r.json()).then(dates=>{
      const el = document.getElementById('ph-rep-count-maintenance_upload');
      if (el) el.textContent = Array.isArray(dates) ? dates.length : 0;
    }).catch(()=>{});

    if (!_repTypeBound) {
      _bindRepTypeButtons();
      _bindRepDeleteButton();
      _bindRepUploadEmptyButton();
      _repTypeBound = true;
    }

    _syncRepTypeButtons();
    _updateRepDateSelect(_repActiveType);
  }

  function _syncRepTypeButtons() {
    document.querySelectorAll('.ph-rep-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === _repActiveType);
    });
  }

  function _updateRepCounts() {
    const counts = { complaints: 0, regional: 0, municipal: 0 };
    _reports.forEach(r => {
      if (counts[r.report_type] !== undefined) counts[r.report_type]++;
    });
    ['complaints', 'regional', 'municipal'].forEach(t => {
      const el = document.getElementById('ph-rep-count-' + t);
      if (el) el.textContent = counts[t];
    });
  }

  function _bindRepTypeButtons() {
    document.querySelectorAll('.ph-rep-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ph-rep-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _repActiveType = btn.dataset.type;
        _updateRepDateSelect(_repActiveType);
      });
    });
  }

  function _bindRepDeleteButton() {
    const btn = document.getElementById('ph-rep-delete-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const sel = document.getElementById('ph-rep-date-select');
      if (!sel) return;

      if (_repActiveType === 'maintenance_upload') {
        const opt = sel.selectedOptions[0];
        const id  = opt ? opt.dataset.id : '';
        if (!id) return;
        if (!confirm('Удалить этот отчёт?')) return;
        try {
          await fetch('/api/maintenance/reports/' + id, { method: 'DELETE' });
          Toast.success('Отчёт удалён');
          await _reload();
        } catch (e) {
          Toast.error('Ошибка при удалении: ' + e.message);
        }
        return;
      }

      const id = sel.value;
      if (!id) return;
      if (!confirm('Удалить этот отчёт?')) return;
      try {
        await fetch('/api/pothole/reports/' + id, { method: 'DELETE' });
        Toast.success('Отчёт удалён');
        await _reload();
      } catch (e) {
        Toast.error('Ошибка при удалении: ' + e.message);
      }
    });
  }

  function _bindRepUploadEmptyButton() {
    const btn = document.getElementById('ph-rep-upload-empty-btn');
    if (btn) btn.addEventListener('click', () => _openUploadModal());
  }

  // ============================================================
  //  СОДЕРЖАНИЕ — загрузка дат и отображение данных
  // ============================================================

  async function _updateRepDateSelectMaintenance() {
    const sel    = document.getElementById('ph-rep-date-select');
    const delBtn = document.getElementById('ph-rep-delete-btn');
    if (!sel) return;
    sel.innerHTML = '<option value="">Загрузка...</option>';
    sel.disabled  = true;
    let dates = [];
    try {
      const res = await fetch('/api/maintenance/upload/dates');
      if (res.ok) dates = await res.json();
    } catch(e) {}
    if (!dates.length) {
      sel.innerHTML = '<option value="">Нет загрузок</option>';
      if (delBtn) delBtn.style.display = 'none';
      _showRepEmpty();
      return;
    }
    sel.disabled  = false;
    sel.innerHTML = dates
      .map(r => `<option value="${r.report_date}" data-id="${r.id}">${_fmtDate(r.report_date)}</option>`)
      .join('');
    if (delBtn) delBtn.style.display = '';
    _maintDates = dates;
    sel.onchange = () => { if (sel.value) _showMaintenanceUploadDetail(sel.value); };
    _showMaintenanceUploadDetail(dates[0].report_date);
  }

  async function _showMaintenanceUploadDetail(date) {
    const detail = document.getElementById('ph-rep-detail');
    if (!detail) return;
    detail.innerHTML = '<div style="padding:var(--space-6);color:var(--color-text-muted)">Загрузка...</div>';

    let data;
    try {
      const res = await fetch('/api/maintenance/upload/by-date?date=' + encodeURIComponent(date));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch(e) {
      detail.innerHTML = `<div style="padding:var(--space-6);color:var(--color-error)">Ошибка загрузки: ${e.message}</div>`;
      return;
    }

    const html = `<article class="card"><div class="card-header"><div>
      <div class="card-title">Содержание дорог — ${_fmtDate(data.report_date)}</div>
      <div class="card-subtitle">Загружено: ${_fmtDatetime(data.uploaded_at)}</div>
    </div></div><div class="card-body" style="padding:0">${_tableMaintenance(data.data_json)}</div></article>`;
    detail.innerHTML = html;
  }

  function _tableMaintenance(rows) {
    const CYCLIC = ['Мойка остановок, шт','Покраска остановок, шт','Уборка смета из прибордюрной части, км','Уборка мусора в полосе отвода, км','Мойка ограждений, км','Мойка проезжей части, км','Мойка тротуаров, км','Окос травы, км'];
    const ANNUAL = ['Линейная разметка, км','Разметка пешеходных переходов, шт','Ликвидация борщевика, га'];
    if (!rows || !rows.length) return '<p style="padding:var(--space-4);color:var(--color-text-muted)">Нет данных</p>';

    const getPct = (r) => {
      const plan = r.plan || 0;
      const fact = r.fact || 0;
      return plan > 0 ? Math.round((fact / plan) * 1000) / 10 : (r.pct || 0);
    };

    const bar = (pct) => {
      const color = pct >= 90 ? '#2d6a4f' : pct >= 60 ? '#40916c' : pct >= 30 ? '#52b788' : '#74c69d';
      return `<div style="width:100%;background:#e9ecef;border-radius:4px;height:8px;margin-top:4px"><div style="width:${Math.min(pct, 100)}%;background:${color};height:8px;border-radius:4px"></div></div>`;
    };

    const makeRow = r => {
      const pct = getPct(r);
      return `<tr>
        <td>${r.label || ''}</td>
        <td>${(r.plan || 0).toLocaleString('ru')}</td>
        <td>${(r.fact || 0).toLocaleString('ru')}</td>
        <td><span style="font-weight:600;color:${pct >= 60 ? '#2d6a4f' : '#d62828'}">${pct}%</span>${bar(pct)}</td>
      </tr>`;
    };

    const makeGroup = (title, keys) => {
      const gr = rows.filter(r => keys.includes(r.label));
      if (!gr.length) return '';
      return `<tr class="maint-group-header-row"><td colspan="4" style="background:var(--color-surface-2);font-weight:700;font-size:var(--text-sm);color:var(--color-text-muted);padding:6px 12px;letter-spacing:.05em">${title}</td></tr>${gr.map(makeRow).join('')}`;
    };

    const other = rows.filter(r => !CYCLIC.includes(r.label) && !ANNUAL.includes(r.label));
    return `<div class="data-table-wrap"><table class="data-table">
      <thead><tr><th>Наименование</th><th>План</th><th>Факт</th><th>% выполнения</th></tr></thead>
      <tbody>
        ${makeGroup('Цикличные', CYCLIC)}
        ${makeGroup('План на год', ANNUAL)}
        ${other.length ? other.map(makeRow).join('') : ''}
      </tbody>
    </table></div>`;
  }

  function _updateRepDateSelect(type) {
    if (type === 'maintenance_upload') { _updateRepDateSelectMaintenance(); return; }
    const sel    = document.getElementById('ph-rep-date-select');
    const delBtn = document.getElementById('ph-rep-delete-btn');
    if (!sel) return;

    const filtered = _reports
      .filter(r => r.report_type === type)
      .sort((a, b) => (a.report_date > b.report_date ? -1 : 1));

    if (!filtered.length) {
      sel.innerHTML = '<option value="">Нет отчётов</option>';
      sel.disabled  = true;
      if (delBtn) delBtn.style.display = 'none';
      _showRepEmpty();
      return;
    }

    sel.disabled  = false;
    sel.innerHTML = filtered
      .map(r => `<option value="${r.id}">${_fmtDate(r.report_date)}</option>`)
      .join('');

    if (delBtn) delBtn.style.display = '';

    sel.onchange = () => {
      if (sel.value) _showReportDetail(sel.value);
    };

    _showReportDetail(filtered[0].id);
  }

  function _showRepEmpty() {
    const detail = document.getElementById('ph-rep-detail');
    if (!detail) return;
    detail.innerHTML = `
      <div class="ph-rep-empty">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
        </svg>
        <h3>Нет отчётов</h3>
        <p>Для этого типа отчётов ещё ничего не загружено</p>
        <button class="btn btn-primary" type="button" id="ph-rep-upload-empty-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 1 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Загрузить отчёт
        </button>
      </div>`;
    const btn = document.getElementById('ph-rep-upload-empty-btn');
    if (btn) btn.addEventListener('click', () => _openUploadModal());
  }

  async function _showReportDetail(id) {
    const detail = document.getElementById('ph-rep-detail');
    if (!detail) return;
    detail.innerHTML = '<div style="padding:var(--space-6);color:var(--color-text-muted)">Загрузка...</div>';

    let r;
    try {
      const res = await fetch('/api/pothole/reports/' + id);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      r = await res.json();
    } catch(e) {
      detail.innerHTML = `<div style="padding:var(--space-6);color:var(--color-error)">Ошибка загрузки отчёта: ${e.message}</div>`;
      return;
    }

    const d = r.data_json;
    let html = `<article class="card"><div class="card-header"><div>
      <div class="card-title">${_typeName(r.report_type)} — ${_fmtDate(r.report_date)}</div>
      <div class="card-subtitle">Загружен: ${_fmtDatetime(r.uploaded_at)}</div>
    </div></div><div class="card-body" style="padding:0">`;

    if (r.report_type === 'complaints') {
      html += _tableComplaints(d);
    } else {
      html += _tableRepair(d, r.report_type);
    }
    html += '</div></article>';
    detail.innerHTML = html;
  }

  function _tableRepair(rows, type) {
    if (!rows || !rows.length) return '<p style="padding:var(--space-4);color:var(--color-text-muted)">Нет данных</p>';
    const col = type === 'regional' ? 'РУАД' : 'МО';
    return `<div class="data-table-wrap"><table class="data-table">
      <thead>
        <tr>
          <th>${col}</th>
          <th>Регистрация за сутки</th>
          <th>Регистрация за 7 дней</th>
          <th>Устранено сегодня</th>
          <th>Устранено за 7 дней</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${r.name}</td>
          <td>${(r.registeredDay || 0).toLocaleString('ru')}</td>
          <td>${(r.registered   || 0).toLocaleString('ru')}</td>
          <td>${(r.fixedDay     || 0).toLocaleString('ru')}</td>
          <td>${(r.fixed        || 0).toLocaleString('ru')}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function _tableComplaints(d) {
    if (!d) return '<p style="padding:var(--space-4);color:var(--color-text-muted)">Нет данных</p>';

    const omsTotal = d.total ? d.total.filter(r => r.type === 'oms') : [];
    const madTotal = d.total ? d.total.filter(r => r.type === 'mad') : [];
    const omsWeek  = d.week  ? d.week.filter(r => r.type === 'oms')  : [];
    const madWeek  = d.week  ? d.week.filter(r => r.type === 'mad')  : [];

    const omsTotalSum = (d.total ? d.total.find(r => r.name === 'ОМС') : null)?.count || 0;
    const madTotalSum = (d.total ? d.total.find(r => r.name === 'МАД') : null)?.count || 0;
    const omsWeekSum  = (d.week  ? d.week.find(r  => r.name === 'ОМС') : null)?.count || 0;
    const madWeekSum  = (d.week  ? d.week.find(r  => r.name === 'МАД') : null)?.count || 0;

    function buildTable(rows, sumVal) {
      if (!rows.length) return '<p style="padding:var(--space-3);color:var(--color-text-muted);font-size:var(--text-sm)">Нет данных</p>';
      const bodyRows = rows
        .filter(r => r.name !== 'ОМС' && r.name !== 'МАД')
        .map(r => `<tr>
          <td>${r.name}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${(r.count || 0).toLocaleString('ru')}</td>
        </tr>`).join('');
      return `<div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Исполнитель / МО</th><th style="text-align:right">Жалоб</th></tr></thead>
          <tbody>
            ${bodyRows}
            <tr style="font-weight:700;border-top:2px solid var(--color-border)">
              <td>Итого</td>
              <td style="text-align:right;font-variant-numeric:tabular-nums">${sumVal.toLocaleString('ru')}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    }

    const sectionStyle = `display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);margin-bottom:var(--space-6);`;
    const headerStyle  = `font-size:var(--text-sm);font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-faint);margin-bottom:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--color-divider);`;
    const blockStyle   = `background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;`;

    const titleBarOms     = `<div style="padding:var(--space-3) var(--space-4);background:var(--color-blue-highlight);display:flex;align-items:center;justify-content:space-between;"><span style="font-weight:700;color:var(--color-blue);font-size:var(--text-sm)">ОМС</span><span style="font-size:var(--text-xs);font-weight:700;color:var(--color-blue)">${omsTotalSum.toLocaleString('ru')} жалоб</span></div>`;
    const titleBarMad     = `<div style="padding:var(--space-3) var(--space-4);background:var(--color-success-highlight);display:flex;align-items:center;justify-content:space-between;"><span style="font-weight:700;color:var(--color-success);font-size:var(--text-sm)">МАД</span><span style="font-size:var(--text-xs);font-weight:700;color:var(--color-success)">${madTotalSum.toLocaleString('ru')} жалоб</span></div>`;
    const titleBarOmsWeek = `<div style="padding:var(--space-3) var(--space-4);background:var(--color-blue-highlight);display:flex;align-items:center;justify-content:space-between;"><span style="font-weight:700;color:var(--color-blue);font-size:var(--text-sm)">ОМС — за 7 дней</span><span style="font-size:var(--text-xs);font-weight:700;color:var(--color-blue)">${omsWeekSum.toLocaleString('ru')} жалоб</span></div>`;
    const titleBarMadWeek = `<div style="padding:var(--space-3) var(--space-4);background:var(--color-success-highlight);display:flex;align-items:center;justify-content:space-between;"><span style="font-weight:700;color:var(--color-success);font-size:var(--text-sm)">МАД — за 7 дней</span><span style="font-size:var(--text-xs);font-weight:700;color:var(--color-success)">${madWeekSum.toLocaleString('ru')} жалоб</span></div>`;

    return `<div style="padding:var(--space-4)">
      <div style="${headerStyle}">Свод общий</div>
      <div style="${sectionStyle}">
        <div style="${blockStyle}">${titleBarOms}${buildTable(omsTotal, omsTotalSum)}</div>
        <div style="${blockStyle}">${titleBarMad}${buildTable(madTotal, madTotalSum)}</div>
      </div>
      <div style="${headerStyle}">За 7 дней</div>
      <div style="${sectionStyle}">
        <div style="${blockStyle}">${titleBarOmsWeek}${buildTable(omsWeek, omsWeekSum)}</div>
        <div style="${blockStyle}">${titleBarMadWeek}${buildTable(madWeek, madWeekSum)}</div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  UPLOAD MODAL
  // ════════════════════════════════════════════════════════════════════════════
  function _bindUploadButtons() {
    ['ph-upload-btn', 'ph-upload-btn-2', 'ph-no-data-upload-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => _openUploadModal());
    });
    const maintBtn = document.getElementById('ph-upload-btn-maint');
    if (maintBtn) maintBtn.addEventListener('click', () => {
      _openUploadModal();
      setTimeout(() => { const tb = document.querySelector('.upload-type-btn[data-type="maintenance"]'); if (tb) tb.click(); }, 50);
    });
  }

  function _openUploadModal() {
    document.querySelectorAll('.upload-type-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('upload-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('upload-file-input').value = '';
    document.getElementById('upload-file-name').textContent = '';
    document.getElementById('upload-file-name').classList.remove('visible');

    const btn = document.getElementById('upload-submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Загрузить';

    _uploadState = { type: null, file: null };
    openModal('upload-modal');
  }

  let _uploadState = { type: null, file: null };
  const UPLOAD_TIMEOUT_MS = 55_000;

  function _bindUploadModal() {
    document.querySelectorAll('.upload-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.upload-type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        _uploadState.type = btn.dataset.type;
        _checkUploadReady();
      });
    });

    const zone  = document.getElementById('upload-drop-zone');
    const input = document.getElementById('upload-file-input');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) _setUploadFile(f);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) _setUploadFile(input.files[0]);
    });

    document.getElementById('upload-submit-btn').addEventListener('click', _doUpload);

    const dateInput = document.getElementById('upload-date');
    if (dateInput) dateInput.addEventListener('input', _checkUploadReady);
  }

  function _setUploadFile(f) {
    _uploadState.file = f;
    const nameEl = document.getElementById('upload-file-name');
    nameEl.textContent = '📎 ' + f.name;
    nameEl.classList.add('visible');
    _checkUploadReady();
  }

  function _checkUploadReady() {
    const ok = _uploadState.type && _uploadState.file && document.getElementById('upload-date').value;
    document.getElementById('upload-submit-btn').disabled = !ok;
  }

  async function _doUpload() {
    const { type, file } = _uploadState;
    const date = document.getElementById('upload-date').value;
    if (!type || !file || !date) return;

    const btn = document.getElementById('upload-submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Обработка файла...';

    const controller = new AbortController();
    const timerId    = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    const labels    = ['Обработка файла', 'Обработка файла.', 'Обработка файла..', 'Обработка файла...'];
    let labelIdx    = 0;
    const labelTimer = setInterval(() => {
      labelIdx = (labelIdx + 1) % labels.length;
      if (!btn.disabled) return;
      btn.textContent = labels[labelIdx];
    }, 400);

    const fd = new FormData();
    fd.append('report_type', type);
    fd.append('report_date', date);
    fd.append('file', file);

    try {
      const res  = await fetch('/api/pothole/upload', {
        method: 'POST',
        body:   fd,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');

      if (typeof PotholeRating !== 'undefined') {
        if (type === 'regional')   PotholeRating.resetFilters(['ruad']);
        if (type === 'municipal')  PotholeRating.resetFilters(['mad']);
        if (type === 'complaints') PotholeRating.resetFilters(['ruad', 'mad']);
      }

      Toast.success('Отчёт загружен: ' + (data.rows ?? '?') + ' строк');
      _repActiveType = type;
      closeModal('upload-modal');
      await _reload();

      if (type === 'maintenance') {
        if (typeof PotholeMaintenance !== 'undefined' && PotholeMaintenance.reloadFromUpload) {
          PotholeMaintenance.reloadFromUpload();
        }
        if (_repActiveType === 'maintenance_upload') {
          _updateRepDateSelectMaintenance();
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        Toast.error('Превышено время ожидания (55 с). Попробуйте ещё раз.');
      } else {
        Toast.error('Ошибка: ' + e.message);
      }
    } finally {
      clearTimeout(timerId);
      clearInterval(labelTimer);
      btn.disabled    = !(_uploadState.type && _uploadState.file && document.getElementById('upload-date').value);
      btn.textContent = 'Загрузить';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RATING PAGE
  // ════════════════════════════════════════════════════════════════════════════

  async function refreshRating() {
    if (typeof PotholeRating === 'undefined') return;
    const ruadNames = _getRuadOptions();
    const moNames   = _getMoOptions();
    await PotholeRating.init(
      ruadNames,
      moNames,
      _latest.regional   || null,
      _latest.complaints || null,
      _latest.municipal  || null
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════════════════════════════════════
  function _fmtDate(iso) {
    if (!iso) return '';
    const d = iso.slice(0, 10).split('-');
    return d[2] + '.' + d[1] + '.' + d[0];
  }
  function _fmtDatetime(iso) {
    if (!iso) return '';
    return _fmtDate(iso) + ' ' + iso.slice(11, 16);
  }
  function _toISO(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }
  function _typeName(t) {
    return { complaints: 'Жалобы', regional: 'Региональный ремонт', municipal: 'Муниципальный ремонт' }[t] || t;
  }

  function getChart(key) { return _charts[key] || null; }
  function setChart(key, chart) { _charts[key] = chart; }

  return { init, refresh: _reload, refreshReports: _reload, refreshRating, getChart, setChart };
})();
