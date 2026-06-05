// js/pages/pothole.js — дашборд «Ямочный ремонт»
// Зависит от: Chart.js (глобальный), utils.js (toast, closeModal, openModal, fmt)

const PotholePage = (() => {
  // ── состояние ──────────────────────────────────────────────────────────────
  let _reports   = [];   // список из /api/pothole/reports
  let _latest    = {};   // { complaints, regional, municipal } — последние отчёты
  let _history   = {};   // { complaints:[], regional:[], municipal:[] }
  let _charts    = {};   // Chart.js instances
  let _initialized = false;

  // ── цвета ──────────────────────────────────────────────────────────────────
  const C = {
    municipal: { bg: 'rgba(67,122,34,0.75)',  border: '#437a22' },
    regional:  { bg: 'rgba(0,100,148,0.75)',  border: '#006494' },
    oms:       { bg: 'rgba(1,105,111,0.75)',  border: '#01696f' },
    mad:       { bg: 'rgba(209,153,0,0.75)',  border: '#d19900' },
    reg:       { bg: 'rgba(0,100,148,0.75)',  border: '#006494' },
    fix:       { bg: 'rgba(67,122,34,0.75)',  border: '#437a22' },
    comp:      { bg: 'rgba(161,44,123,0.75)', border: '#a12c7b' },
  };

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

      // история по каждому типу для weekly-графика
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
  function _renderDashboard() {
    const hasData = _latest.regional || _latest.municipal || _latest.complaints;
    document.getElementById('ph-no-data').style.display    = hasData ? 'none' : 'flex';
    document.getElementById('ph-data-content').style.display = hasData ? '' : 'none';
    if (!hasData) return;

    _renderKPIs();
    _renderDonuts();
    _renderWeekly();
  }

  // ── KPI ─────────────────────────────────────────────────────────────────────
  function _renderKPIs() {
    // --- Ямы: сумма муниципальных + региональных ---
    const regData = _latest.regional  ? _latest.regional.data_json  : [];
    const munData = _latest.municipal ? _latest.municipal.data_json : [];

    const regTotalReg = regData.reduce((s, r) => s + (r.registered || 0), 0);
    const munTotalReg = munData.reduce((s, r) => s + (r.registered || 0), 0);
    const totalReg = regTotalReg + munTotalReg;

    const regTotalFix = regData.reduce((s, r) => s + (r.fixed || 0), 0);
    const munTotalFix = munData.reduce((s, r) => s + (r.fixed || 0), 0);
    const totalFix = regTotalFix + munTotalFix;

    // --- Жалобы ---
    const compData = _latest.complaints ? _latest.complaints.data_json : null;
    const omsTotal = compData ? compData.total.filter(r => r.type === 'oms').reduce((s,r) => s + r.count, 0) : 0;
    const madTotal = compData ? compData.total.filter(r => r.type === 'mad').reduce((s,r) => s + r.count, 0) : 0;
    // Берём итог по строкам ОМС и МАД (первые записи с name='ОМС'/'МАД')
    const omsRow = compData ? compData.total.find(r => r.name === 'ОМС') : null;
    const madRow = compData ? compData.total.find(r => r.name === 'МАД') : null;
    const totalComp = (omsRow ? omsRow.count : 0) + (madRow ? madRow.count : 0);

    _setKPI('ph-kpi-reg',  totalReg,  _latest.regional  ? _latest.regional.report_date  : null, 'ph-kpi-reg-date',  'ph-kpi-reg-delta',  'regional',  'registered');
    _setKPI('ph-kpi-fix',  totalFix,  _latest.regional  ? _latest.regional.report_date  : null, 'ph-kpi-fix-date',  'ph-kpi-fix-delta',  'regional',  'fixed');
    _setKPI('ph-kpi-comp', totalComp, _latest.complaints ? _latest.complaints.report_date : null, 'ph-kpi-comp-date', 'ph-kpi-comp-delta', 'complaints', null);
  }

  function _setKPI(valId, curVal, date, dateId, deltaId, histType, histField) {
    document.getElementById(valId).textContent = curVal.toLocaleString('ru');
    if (date) document.getElementById(dateId).textContent = 'Дата отчёта: ' + _fmtDate(date);

    // delta: сравниваем с предыдущей записью в истории
    const hist = _history[histType] || [];
    if (hist.length >= 2) {
      const prev = hist[hist.length - 2];
      let prevVal = 0;
      if (histType === 'complaints') {
        const omsR = prev.data_json.total ? prev.data_json.total.find(r => r.name === 'ОМС') : null;
        const madR = prev.data_json.total ? prev.data_json.total.find(r => r.name === 'МАД') : null;
        prevVal = (omsR ? omsR.count : 0) + (madR ? madR.count : 0);
      } else if (histField) {
        prevVal = (prev.data_json || []).reduce((s, r) => s + (r[histField] || 0), 0)
                + (_history.municipal.length >= 2 ? _history.municipal[_history.municipal.length - 2].data_json.reduce((s,r) => s + (r[histField]||0), 0) : 0);
      }
      const diff = curVal - prevVal;
      const el   = document.getElementById(deltaId);
      if (diff > 0) { el.textContent = '+' + diff.toLocaleString('ru'); el.className = 'ph-kpi-delta up'; }
      else if (diff < 0) { el.textContent = diff.toLocaleString('ru'); el.className = 'ph-kpi-delta down'; }
      else { el.textContent = 'без изменений'; el.className = 'ph-kpi-delta neu'; }
    } else {
      const el = document.getElementById(deltaId);
      el.textContent = 'первый отчёт';
      el.className   = 'ph-kpi-delta neu';
    }
  }

  // ── Пончики ─────────────────────────────────────────────────────────────────
  function _renderDonuts() {
    const regData = (_latest.regional  ? _latest.regional.data_json  : []);
    const munData = (_latest.municipal ? _latest.municipal.data_json : []);
    const compData = _latest.complaints ? _latest.complaints.data_json : null;

    const regSum = regData.reduce((s,r) => s + (r.registered||0), 0);
    const munRegSum = munData.reduce((s,r) => s + (r.registered||0), 0);
    const regFixSum = regData.reduce((s,r) => s + (r.fixed||0), 0);
    const munFixSum = munData.reduce((s,r) => s + (r.fixed||0), 0);

    const omsRow = compData ? compData.total.find(r => r.name === 'ОМС') : null;
    const madRow = compData ? compData.total.find(r => r.name === 'МАД') : null;
    const omsC = omsRow ? omsRow.count : 0;
    const madC = madRow ? madRow.count : 0;

    _donut('ph-chart-reg-donut',  ['Муниципальные','Региональные'], [munRegSum, regSum], [C.municipal.bg, C.regional.bg], [C.municipal.border, C.regional.border]);
    _donut('ph-chart-fix-donut',  ['Муниципальные','Региональные'], [munFixSum, regFixSum], [C.municipal.bg, C.regional.bg], [C.municipal.border, C.regional.border]);
    _donut('ph-chart-comp-donut', ['ОМС','МАД'], [omsC, madC], [C.oms.bg, C.mad.bg], [C.oms.border, C.mad.border]);
  }

  function _donut(id, labels, data, bgColors, borderColors) {
    if (_charts[id]) { _charts[id].destroy(); }
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 2, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Satoshi, sans-serif', size: 12 }, padding: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString('ru') } }
        }
      }
    });
  }

  // ── Weekly bar ──────────────────────────────────────────────────────────────
  function _renderWeekly() {
    _buildMonthSelector();
  }

  function _buildMonthSelector() {
    const sel = document.getElementById('ph-week-month');
    if (!sel) return;

    // Собираем все уникальные месяцы из истории
    const months = new Set();
    ['regional','municipal','complaints'].forEach(t => {
      (_history[t] || []).forEach(r => {
        const d = r.report_date ? r.report_date.slice(0,7) : null; // YYYY-MM
        if (d) months.add(d);
      });
    });

    const sorted = Array.from(months).sort().reverse();
    if (!sorted.length) {
      // нет данных — пустой вариант
      sel.innerHTML = '<option value="">Нет данных</option>';
      return;
    }

    const prev = sel.value;
    sel.innerHTML = sorted.map(m => {
      const [y, mo] = m.split('-');
      const name = new Date(+y, +mo - 1, 1).toLocaleDateString('ru', { month:'long', year:'numeric' });
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

    // Недели пн–вс в данном месяце
    const weeks = _getWeeksOfMonth(year, month);

    // Собираем суммы по неделям
    // registered = regional + municipal
    // fixed      = regional + municipal
    // complaints = жалобы за 7 дней (берём запись последней даты в каждой неделе)
    const regWeeks  = weeks.map(w => _sumWeek(_history.regional,   'registered', w));
    const munWeeks  = weeks.map(w => _sumWeek(_history.municipal,  'registered', w));
    const fixRegW   = weeks.map(w => _sumWeek(_history.regional,   'fixed',      w));
    const fixMunW   = weeks.map(w => _sumWeek(_history.municipal,  'fixed',      w));
    const compWeeks = weeks.map(w => _sumCompWeek(_history.complaints, w));

    const labels = weeks.map((w, i) => 'Неделя ' + (i + 1) + '\n' + _fmtDate(w.from) + '–' + _fmtDate(w.to));
    const regTotal  = weeks.map((_, i) => regWeeks[i] + munWeeks[i]);
    const fixTotal  = weeks.map((_, i) => fixRegW[i] + fixMunW[i]);

    if (_charts['ph-chart-weekly']) _charts['ph-chart-weekly'].destroy();
    const ctx = document.getElementById('ph-chart-weekly');
    if (!ctx) return;

    _charts['ph-chart-weekly'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Зарегистрировано ям', data: regTotal,  backgroundColor: C.reg.bg,  borderColor: C.reg.border,  borderWidth: 1.5, borderRadius: 4 },
          { label: 'Устранено ям',        data: fixTotal,  backgroundColor: C.fix.bg,  borderColor: C.fix.border,  borderWidth: 1.5, borderRadius: 4 },
          { label: 'Жалобы',              data: compWeeks, backgroundColor: C.comp.bg, borderColor: C.comp.border, borderWidth: 1.5, borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Satoshi, sans-serif', size: 12 }, padding: 14, usePointStyle: true } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + c.parsed.y.toLocaleString('ru') } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Satoshi, sans-serif', size: 11 } } },
          y: { beginAtZero: true, ticks: { font: { family: 'Satoshi, sans-serif', size: 11 }, callback: v => v.toLocaleString('ru') } }
        }
      }
    });
  }

  // Генерируем список недель пн–вс для месяца
  function _getWeeksOfMonth(year, month) {
    const weeks = [];
    // первый пн месяца или раньше
    let d = new Date(year, month - 1, 1);
    // сдвигаемся назад до понедельника
    while (d.getDay() !== 1) d = new Date(d.getTime() - 86400000);
    // собираем недели пока начало <= конец месяца
    const monthEnd = new Date(year, month, 0);
    while (d <= monthEnd) {
      const from = new Date(d);
      const to   = new Date(d.getTime() + 6 * 86400000);
      weeks.push({ from: _toISO(from), to: _toISO(to) });
      d = new Date(d.getTime() + 7 * 86400000);
    }
    return weeks;
  }

  // Сумма registered/fixed для отчётов в диапазоне недели
  function _sumWeek(history, field, week) {
    if (!history) return 0;
    // Берём все отчёты с report_date в диапазоне [from..to]
    const reports = history.filter(r => r.report_date >= week.from && r.report_date <= week.to);
    if (!reports.length) return 0;
    // Последний отчёт недели
    const last = reports[reports.length - 1];
    return (last.data_json || []).reduce((s, r) => s + (r[field] || 0), 0);
  }

  // Жалобы — берём «Свод за 7 дней» → «Общий итог» строки
  function _sumCompWeek(history, week) {
    if (!history) return 0;
    const reports = history.filter(r => r.report_date >= week.from && r.report_date <= week.to);
    if (!reports.length) return 0;
    const last = reports[reports.length - 1];
    const data = last.data_json;
    if (!data || !data.week) return 0;
    const omsRow = data.week.find(r => r.name === 'ОМС');
    const madRow = data.week.find(r => r.name === 'МАД');
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

    // Группируем по типу
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
        _toast('Отчёт удалён', 'success');
        await _reload();
      });
    });
  }

  async function _showReportDetail(id) {
    const detail = document.getElementById('ph-report-detail');
    detail.innerHTML = '<div style="padding:var(--space-6);color:var(--color-text-muted)">Загрузка...</div>';
    const r = await fetch('/api/pothole/reports/' + id).then(x => x.json());
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
      <thead><tr><th>${col}</th><th>Регистрация за 7 дней</th><th>Устранено за 7 дней</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.name}</td><td>${r.registered.toLocaleString('ru')}</td><td>${r.fixed.toLocaleString('ru')}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function _tableComplaints(d) {
    if (!d) return '<p style="padding:var(--space-4);color:var(--color-text-muted)">Нет данных</p>';
    let html = '<div style="padding:var(--space-4)">';

    // Свод общий
    html += '<h4 style="margin-bottom:var(--space-3);font-weight:700">Свод общий</h4>';
    html += `<div class="data-table-wrap"><table class="data-table">
      <thead><tr><th>Исполнитель</th><th>Тип</th><th>Количество жалоб</th></tr></thead>
      <tbody>${(d.total||[]).map(r => `<tr><td>${r.name}</td><td><span class="ph-report-badge ${r.type}">${r.type==='oms'?'ОМС':'МАД'}</span></td><td>${r.count.toLocaleString('ru')}</td></tr>`).join('')}</tbody>
    </table></div>`;

    // Свод за 7 дней
    html += '<h4 style="margin:var(--space-5) 0 var(--space-3);font-weight:700">Свод за 7 дней</h4>';
    html += `<div class="data-table-wrap"><table class="data-table">
      <thead><tr><th>Исполнитель</th><th>Тип</th><th>Количество жалоб</th></tr></thead>
      <tbody>${(d.week||[]).map(r => `<tr><td>${r.name}</td><td><span class="ph-report-badge ${r.type}">${r.type==='oms'?'ОМС':'МАД'}</span></td><td>${r.count.toLocaleString('ru')}</td></tr>`).join('')}</tbody>
    </table></div>`;

    html += '</div>';
    return html;
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
    // сброс
    document.querySelectorAll('.upload-type-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('upload-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('upload-file-input').value = '';
    document.getElementById('upload-file-name').textContent = '';
    document.getElementById('upload-file-name').classList.remove('visible');
    document.getElementById('upload-submit-btn').disabled = true;
    _uploadState = { type: null, file: null };
    openModal('upload-modal');
  }

  let _uploadState = { type: null, file: null };

  function _bindUploadModal() {
    // тип отчёта
    document.querySelectorAll('.upload-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.upload-type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        _uploadState.type = btn.dataset.type;
        _checkUploadReady();
      });
    });

    // drag & drop
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

    // submit
    document.getElementById('upload-submit-btn').addEventListener('click', _doUpload);
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

  document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('upload-date');
    if (dateInput) dateInput.addEventListener('input', _checkUploadReady);
  });

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
      const res = await fetch('/api/pothole/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка сервера');
      _toast('Отчёт загружен: ' + json.rows + ' строк', 'success');
      closeModal('upload-modal');
      await _reload();
    } catch (e) {
      _toast('Ошибка: ' + e.message, 'error');
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
    const d = iso.slice(0,10).split('-');
    return d[2] + '.' + d[1] + '.' + d[0];
  }
  function _fmtDatetime(iso) {
    if (!iso) return '';
    return _fmtDate(iso) + ' ' + iso.slice(11,16);
  }
  function _toISO(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth()+1).padStart(2,'0') + '-'
      + String(d.getDate()).padStart(2,'0');
  }
  function _typeName(t) {
    return { complaints:'Жалобы', regional:'Региональный ремонт', municipal:'Муниципальный ремонт' }[t] || t;
  }
  function _shortType(t) {
    return { complaints:'Жалобы', regional:'Рег.', municipal:'Мун.' }[t] || t;
  }
  function _toast(msg, type) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type||'info');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  return { init };
})();
