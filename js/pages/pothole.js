// js/pages/pothole.js — дашборд «Ямочный ремонт»
// Зависит от: Chart.js (глобальный), utils.js (Toast, closeModal, openModal, fmt)
// Зависит от: charts-pothole.js (PotholeCharts) — должен быть подключён ДО этого файла

const PotholePage = (() => {
  // ── состояние ──────────────────────────────────────────────────────────────
  let _reports     = [];   // список из /api/pothole/reports
  let _latest      = {};   // { complaints, regional, municipal } — последние отчёты
  let _history     = {};   // { complaints:[], regional:[], municipal:[] }
  let _charts      = {};   // Chart.js instances
  let _initialized = false;
  let _filter = { ruad: '', mo: '', org: 'all' };
  let _filterBarBound = false;

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

  // ── загрузка всех данных ────────────────────────────────────────────────────
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
      _renderReportsSidebar();
    } catch (e) {
      console.error('[PotholePage] reload error', e);
    }
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

  function _applyOrgFilter(compDataJson) {
    if (!compDataJson || _filter.org === 'all') return compDataJson;
    const targetName = _filter.org === 'oms' ? 'ОМС' : 'МАД';
    return {
      total: (compDataJson.total || []).filter(r => r.name === targetName || r.type === _filter.org),
      week:  (compDataJson.week  || []).filter(r => r.name === targetName || r.type === _filter.org),
    };
  }

  function _getRuadOptions() {
    const names = new Set();
    (_latest.regional?.data_json || []).forEach(r => { if (r.name) names.add(r.name); });
    return Array.from(names).sort();
  }

  function _getMoOptions() {
    const names = new Set();
    (_latest.municipal?.data_json || []).forEach(r => { if (r.name) names.add(r.name); });
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
    const sel = document.getElementById('ph-week-month');
    if (sel && sel.value) _drawWeeklyChart(sel.value);
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

  // ── KPI ─────────────────────────────────────────────────────────────────────
  function _renderKPIs() {
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

    const totalReg = regData.reduce((s, r) => s + (r.registered || 0), 0)
                   + munData.reduce((s, r) => s + (r.registered || 0), 0);
    const totalFix = regData.reduce((s, r) => s + (r.fixed || 0), 0)
                   + munData.reduce((s, r) => s + (r.fixed || 0), 0);

    const compData = _latest.complaints ? _latest.complaints.data_json : null;
    let totalComp = 0;
    if (compData) {
      if (_filter.ruad) {
        const row = (compData.week || []).find(r => r.name === _filter.ruad);
        totalComp = row ? row.count : 0;
      } else if (_filter.mo) {
        const row = _findCompRowByMo(compData.week, _filter.mo);
        totalComp = row ? row.count : 0;
      } else {
        const omsRow = (_filter.org !== 'mad') ? (compData.week || []).find(r => r.name === 'ОМС') : null;
        const madRow = (_filter.org !== 'oms') ? (compData.week || []).find(r => r.name === 'МАД') : null;
        totalComp = (omsRow ? omsRow.count : 0) + (madRow ? madRow.count : 0);
      }
    }

    _setKPI('ph-kpi-reg',  totalReg,  _latest.regional   ? _latest.regional.report_date   : null, 'ph-kpi-reg-date',  'ph-kpi-reg-delta',  'registered', false);
    _setKPI('ph-kpi-fix',  totalFix,  _latest.regional   ? _latest.regional.report_date   : null, 'ph-kpi-fix-date',  'ph-kpi-fix-delta',  'fixed',      false);
    _setKPI('ph-kpi-comp', totalComp, _latest.complaints ? _latest.complaints.report_date : null, 'ph-kpi-comp-date', 'ph-kpi-comp-delta', 'complaints', true);
  }

  /**
   * Считает prevVal для дельты с учётом текущих фильтров org/ruad/mo.
   * @param {string}  histField   'registered' | 'fixed' | 'complaints'
   * @param {boolean} invertDelta true — жалобы: рост → красный, падение → зелёный
   */
  function _setKPI(valId, curVal, date, dateId, deltaId, histField, invertDelta) {
    document.getElementById(valId).textContent = curVal.toLocaleString('ru');
    if (date) document.getElementById(dateId).textContent = 'Дата отчёта: ' + _fmtDate(date);

    const useReg = _filter.org !== 'oms';
    const useMun = _filter.org !== 'mad';

    const el = document.getElementById(deltaId);

    if (histField === 'complaints') {
      const hist = _history.complaints || [];
      if (hist.length < 2) { el.textContent = 'первый отчёт'; el.className = 'ph-kpi-delta neu'; return; }
      const weekData = hist[hist.length - 2].data_json?.week || [];
      let prevVal = 0;
      if (_filter.ruad) {
        const row = weekData.find(r => r.name === _filter.ruad);
        prevVal = row ? row.count : 0;
      } else if (_filter.mo) {
        const row = _findCompRowByMo(weekData, _filter.mo);
        prevVal = row ? row.count : 0;
      } else {
        const oR = useReg ? weekData.find(r => r.name === 'МАД') : null;
        const mR = useMun ? weekData.find(r => r.name === 'ОМС') : null;
        prevVal = (oR ? oR.count : 0) + (mR ? mR.count : 0);
      }
      _applyDelta(el, curVal, prevVal, invertDelta);
      return;
    }

    // registered / fixed
    const histReg = _history.regional  || [];
    const histMun = _history.municipal || [];

    const hasPrevReg = useReg && histReg.length >= 2;
    const hasPrevMun = useMun && histMun.length >= 2;
    if (!hasPrevReg && !hasPrevMun) {
      el.textContent = 'первый отчёт';
      el.className   = 'ph-kpi-delta neu';
      return;
    }

    let prevVal = 0;

    if (hasPrevReg) {
      const prevRows = _filter.ruad
        ? (histReg[histReg.length - 2].data_json || []).filter(r => r.name === _filter.ruad)
        : (histReg[histReg.length - 2].data_json || []);
      prevVal += prevRows.reduce((s, r) => s + (r[histField] || 0), 0);
    }

    if (hasPrevMun) {
      const prevRows = _filter.mo
        ? (histMun[histMun.length - 2].data_json || []).filter(r => r.name === _filter.mo)
        : (histMun[histMun.length - 2].data_json || []);
      prevVal += prevRows.reduce((s, r) => s + (r[histField] || 0), 0);
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

  // ── Пончики — используем registeredTotal/fixedTotal (col G/L) ───────────────
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

  // ── Weekly — делегируем в PotholeCharts ─────────────────────────────────────
  function _renderWeekly() {
    _buildMonthSelector();
  }

  function _buildMonthSelector() {
    const sel = document.getElementById('ph-week-month');
    if (!sel) return;

    const months = new Set();
    ['regional', 'municipal', 'complaints'].forEach(t => {
      (_history[t] || []).forEach(r => {
        const d = r.report_date ? r.report_date.slice(0, 7) : null;
        if (d) months.add(d);
      });
    });

    const sorted = Array.from(months).sort().reverse();
    if (!sorted.length) {
      sel.innerHTML = '<option value="">Нет данных</option>';
      return;
    }

    const prev = sel.value;
    sel.innerHTML = sorted.map(m => {
      const [y, mo] = m.split('-');
      const name = new Date(+y, +mo - 1, 1).toLocaleDateString('ru', { month: 'long', year: 'numeric' });
      return `<option value="${m}">${name}</option>`;
    }).join('');

    if (prev && sorted.includes(prev)) sel.value = prev;
    else sel.value = sorted[0];

    sel.onchange = () => _drawWeeklyChart(sel.value);
    _drawWeeklyChart(sel.value);
  }

  function _drawWeeklyChart(ym) {
    if (!ym) return;
    const [year, month] = ym.split('-').map(Number);
    const weeks = _getWeeksOfMonth(year, month);

    const useReg = _filter.org !== 'oms';
    const useMun = _filter.org !== 'mad';

    const weekData = weeks.map((w, i) => ({
      label:      'Нед.' + (i + 1) + ' (' + _fmtDate(w.from) + '–' + _fmtDate(w.to) + ')',
      registered: (useReg ? _sumWeekFiltered(_history.regional,  'registered', w, _filter.ruad) : 0)
                + (useMun ? _sumWeekFiltered(_history.municipal, 'registered', w, _filter.mo)   : 0),
      fixed:      (useReg ? _sumWeekFiltered(_history.regional,  'fixed',      w, _filter.ruad) : 0)
                + (useMun ? _sumWeekFiltered(_history.municipal, 'fixed',      w, _filter.mo)   : 0),
      complaints: _sumCompWeekFiltered(_history.complaints, w),
    }));

    _charts['weekly'] = PotholeCharts.weekly('ph-chart-weekly', weekData, _charts['weekly']);
  }

  function _getWeeksOfMonth(year, month) {
    const weeks = [];
    let d = new Date(year, month - 1, 1);
    while (d.getDay() !== 1) d = new Date(d.getTime() - 86400000);
    const monthEnd = new Date(year, month, 0);
    while (d.getTime() <= monthEnd.getTime()) {
      const from = new Date(d);
      const to   = new Date(d.getTime() + 6 * 86400000);
      weeks.push({ from: _toISO(from), to: _toISO(to) });
      d = new Date(d.getTime() + 7 * 86400000);
    }
    return weeks;
  }

  function _sumWeekFiltered(history, field, week, nameFilter) {
    if (!history) return 0;
    const reports = history.filter(r => r.report_date >= week.from && r.report_date <= week.to);
    if (!reports.length) return 0;
    const last = reports[reports.length - 1];
    const rows = nameFilter
      ? (last.data_json || []).filter(r => r.name === nameFilter)
      : (last.data_json || []);
    return rows.reduce((s, r) => s + (r[field] || 0), 0);
  }

  function _sumCompWeekFiltered(history, week) {
    if (!history) return 0;
    const reports = history.filter(r => r.report_date >= week.from && r.report_date <= week.to);
    if (!reports.length) return 0;
    const last = reports[reports.length - 1];
    const data = last.data_json;
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
  function _renderReportsSidebar() {
    const container = document.getElementById('ph-reports-sidebar');
    if (!container) return;

    if (!_reports.length) {
      container.innerHTML = '<div class="ph-reports-empty">Отчётов пока нет</div>';
      return;
    }

    const groups = {
      complaints: { label: 'Жалобы',               items: [] },
      regional:   { label: 'Региональный ремонт',  items: [] },
      municipal:  { label: 'Муниципальный ремонт', items: [] },
    };
    _reports.forEach(r => { if (groups[r.report_type]) groups[r.report_type].items.push(r); });

    let html = '';
    Object.entries(groups).forEach(([type, g]) => {
      if (!g.items.length) return;
      html += `<div class="ph-report-group">`;
      html += `<div class="ph-report-group-label">${g.label}</div>`;
      g.items.forEach(item => {
        html += `<div class="ph-report-item" data-id="${item.id}">
          <span class="ph-report-date">${_fmtDate(item.report_date)}</span>
          <span class="ph-report-badge ${item.report_type}">${_shortType(item.report_type)}</span>
          <button class="ph-report-del" data-del="${item.id}" aria-label="Удалить" title="Удалить">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>`;
      });
      html += `</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.ph-report-item').forEach(el => {
      el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-del]')) return;
        const id = el.dataset.id;
        container.querySelectorAll('.ph-report-item').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        await _showReportDetail(id);
      });
    });

    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.del;
        if (!confirm('Удалить этот отчёт?')) return;
        await fetch('/api/pothole/reports/' + id, { method: 'DELETE' });
        Toast.success('Отчёт удалён');
        await _reload();
      });
    });
  }

  async function _showReportDetail(id) {
    const detail = document.getElementById('ph-report-detail');
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

    const omsTotal  = d.total ? d.total.filter(r => r.type === 'oms')  : [];
    const madTotal  = d.total ? d.total.filter(r => r.type === 'mad')  : [];
    const omsWeek   = d.week  ? d.week.filter(r => r.type === 'oms')   : [];
    const madWeek   = d.week  ? d.week.filter(r => r.type === 'mad')   : [];

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
  }

  function _openUploadModal() {
    document.querySelectorAll('.upload-type-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('upload-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('upload-file-input').value = '';
    document.getElementById('upload-file-name').textContent = '';
    document.getElementById('upload-file-name').classList.remove('visible');
    document.getElementById('upload-submit-btn').disabled = true;
    _uploadState = { type: null, file: null };
    openModal('upload-modal');
  }

  let _uploadState = { type: null, file: null };

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
    btn.disabled = true;
    btn.textContent = 'Загрузка...';

    const fd = new FormData();
    fd.append('report_type', type);
    fd.append('report_date', date);
    fd.append('file', file);

    try {
      const res  = await fetch('/api/pothole/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      Toast.success('Отчёт загружен: ' + data.rows + ' строк');
      closeModal('upload-modal');
      await _reload();
    } catch (e) {
      Toast.error('Ошибка: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Загрузить';
    }
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
  function _shortType(t) {
    return { complaints: 'Жалобы', regional: 'Рег.', municipal: 'Мун.' }[t] || t;
  }

  function getChart(key) { return _charts[key] || null; }
  function setChart(key, chart) { _charts[key] = chart; }

  return { init, refresh: _reload, refreshReports: _reload, getChart, setChart };
})();
