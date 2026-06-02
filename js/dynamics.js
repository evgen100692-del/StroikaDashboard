/* ============================================================
   dynamics.js — вкладка «Динамика»
   ============================================================ */
window.dynamics = (() => {

  /* ── Текущее состояние UI ────────────────────────────── */
  let state = {
    period:    7,          // дней
    metric:    'readinessNow',
    mode:      'avg',      // 'avg' | 'object' | 'resources'
    objects:   [],         // выбранные объекты
    chartInst: null,
  };

  const METRICS = [
    { value: 'readinessNow', label: 'Готовность %' },
    { value: 'workers',      label: 'Рабочих' },
    { value: 'machines',     label: 'Техника' },
    { value: 'limit2026',    label: 'Лимит 2026' },
  ];

  const PERIODS = [
    { value: 7,   label: '7 дней' },
    { value: 14,  label: '2 недели' },
    { value: 30,  label: '1 месяц' },
    { value: 90,  label: '3 месяца' },
    { value: 180, label: '6 месяцев' },
    { value: 365, label: '1 год' },
    { value: 0,   label: 'Всё время' },
  ];

  /* ── Таблица снимков ─────────────────────────────────── */
  function renderSnapshotTable() {
    const snaps = history_db.load();
    const tbody = document.getElementById('dynSnapTable');
    if (!tbody) return;
    if (!snaps.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Снимков пока нет. Нажмите «Снять снимок».</td></tr>';
      return;
    }
    tbody.innerHTML = [...snaps].reverse().map(s => `
      <tr>
        <td>${s.date}</td>
        <td class="num">${s.objects.length}</td>
        <td>
          <button class="ghost-btn snap-del" data-date="${s.date}" style="min-height:30px;padding:.3rem .7rem;font-size:var(--text-xs)">
            <i class="ri-delete-bin-line"></i>
          </button>
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('.snap-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`Удалить снимок ${btn.dataset.date}?`)) {
          history_db.deleteSnapshot(btn.dataset.date);
          render();
        }
      });
    });
  }

  /* ── Популяция списка объектов ───────────────────────── */
  function populateObjectList() {
    const list = document.getElementById('dynObjectList');
    if (!list) return;
    const names = history_db.allObjectNames();
    list.innerHTML = names.length
      ? names.map(n => {
          const checked = state.objects.includes(n);
          return `<label class="obj-check-item ${checked ? 'checked' : ''}">
            <input type="checkbox" value="${n}" ${checked ? 'checked' : ''} />
            <span>${n}</span>
          </label>`;
        }).join('')
      : '<p class="muted" style="padding:.5rem">Нет объектов в истории</p>';

    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const label = cb.closest('label');
        label.classList.toggle('checked', cb.checked);
        if (cb.checked) {
          if (!state.objects.includes(cb.value)) state.objects.push(cb.value);
        } else {
          state.objects = state.objects.filter(x => x !== cb.value);
        }
        updateChart();
      });
    });
  }

  /* ── Обновление графика ───────────────────────────────── */
  function updateChart() {
    const canvas = document.getElementById('dynChart');
    if (!canvas) return;

    const p   = getComputedStyle(document.documentElement);
    const clr = {
      primary:  p.getPropertyValue('--color-primary').trim(),
      blue:     p.getPropertyValue('--color-blue').trim(),
      success:  p.getPropertyValue('--color-success').trim(),
      text:     p.getPropertyValue('--color-text').trim(),
      muted:    p.getPropertyValue('--color-text-muted').trim(),
      divider:  p.getPropertyValue('--color-divider').trim(),
    };

    const periodDays = state.period > 0 ? state.period : 0;
    let chartData;

    if (state.mode === 'avg') {
      const { labels, data } = history_db.avgReadinessByDate(periodDays);
      chartData = {
        labels,
        datasets: [{
          label: 'Средняя готовность %',
          data,
          borderColor: clr.primary,
          backgroundColor: clr.primary + '22',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        }]
      };
    } else if (state.mode === 'resources') {
      const w = history_db.resourcesByDate('workers',  periodDays);
      const m = history_db.resourcesByDate('machines', periodDays);
      chartData = {
        labels: w.labels,
        datasets: [
          { label: 'Рабочих', data: w.data, borderColor: clr.blue,    backgroundColor: clr.blue    + '22', tension: 0.4, fill: true, pointRadius: 4 },
          { label: 'Техника',  data: m.data, borderColor: clr.success, backgroundColor: clr.success + '22', tension: 0.4, fill: true, pointRadius: 4 },
        ]
      };
    } else {
      // mode === 'object'
      if (!state.objects.length) {
        chartData = { labels: [], datasets: [{ label: 'Выберите объекты', data: [] }] };
      } else {
        chartData = history_db.seriesMulti(state.objects, state.metric, periodDays);
      }
    }

    // Обновляем или создаём данные без пересоздания инстанци
    if (state.chartInst) {
      state.chartInst.data = chartData;
      state.chartInst.update();
    } else {
      state.chartInst = new Chart(canvas, {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: clr.text, font: { family: 'Satoshi' } } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y ?? '—'}`
              }
            }
          },
          scales: {
            x: { ticks: { color: clr.muted, maxRotation: 45 }, grid: { color: clr.divider } },
            y: { ticks: { color: clr.muted }, grid: { color: clr.divider }, beginAtZero: true }
          }
        }
      });
    }

    updateDeltaCards();
  }

  /* ── Карточки «дельта за период» ─────────────────────── */
  function updateDeltaCards() {
    const snaps = history_db.load();
    const container = document.getElementById('dynDeltaCards');
    if (!container || snaps.length < 2) {
      if (container) container.innerHTML = '<p class="muted">Недостаточно снимков для вычисления динамики.</p>';
      return;
    }
    const last  = snaps[snaps.length - 1];
    const prev  = snaps[snaps.length - 2];
    const avgNow  = last.objects.reduce((s, o) => s + (Number(o.readinessNow) <= 1 ? Number(o.readinessNow) * 100 : Number(o.readinessNow)), 0) / (last.objects.length || 1);
    const avgPrev = prev.objects.reduce((s, o) => s + (Number(o.readinessNow) <= 1 ? Number(o.readinessNow) * 100 : Number(o.readinessNow)), 0) / (prev.objects.length || 1);
    const wNow  = last.objects.reduce((s, o) => s + (Number(o.workers)  || 0), 0);
    const wPrev = prev.objects.reduce((s, o) => s + (Number(o.workers)  || 0), 0);
    const mNow  = last.objects.reduce((s, o) => s + (Number(o.machines) || 0), 0);
    const mPrev = prev.objects.reduce((s, o) => s + (Number(o.machines) || 0), 0);

    const card = (label, now, prev, fmt, unit = '') => {
      const d = now - prev;
      const cls = d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : 'delta-zero';
      const sign = d > 0 ? '+' : '';
      return `<article class="card kpi-card">
        <span class="kpi-label">${label}</span>
        <strong class="kpi-value mono">${fmt(now)}${unit}</strong>
        <span class="kpi-sub ${cls}">${sign}${fmt(d)}${unit} vs ${prev.date || ''}</span>
      </article>`;
    };
    const f1 = v => v.toFixed(1).replace('.', ',');
    const f0 = v => Math.round(v).toLocaleString('ru-RU');

    container.innerHTML = `
      <article class="card kpi-card">
        <span class="kpi-label">Средняя готовность</span>
        <strong class="kpi-value mono">${f1(avgNow)}%</strong>
        <span class="kpi-sub ${avgNow - avgPrev > 0 ? 'delta-up' : avgNow - avgPrev < 0 ? 'delta-down' : 'delta-zero'}">
          ${avgNow - avgPrev >= 0 ? '+' : ''}${f1(avgNow - avgPrev)}% vs ${prev.date}
        </span>
      </article>
      <article class="card kpi-card">
        <span class="kpi-label">Рабочих (сейчас)</span>
        <strong class="kpi-value mono">${f0(wNow)}</strong>
        <span class="kpi-sub ${wNow - wPrev > 0 ? 'delta-up' : wNow - wPrev < 0 ? 'delta-down' : 'delta-zero'}">
          ${wNow - wPrev >= 0 ? '+' : ''}${f0(wNow - wPrev)} vs ${prev.date}
        </span>
      </article>
      <article class="card kpi-card">
        <span class="kpi-label">Техника (сейчас)</span>
        <strong class="kpi-value mono">${f0(mNow)}</strong>
        <span class="kpi-sub ${mNow - mPrev > 0 ? 'delta-up' : mNow - mPrev < 0 ? 'delta-down' : 'delta-zero'}">
          ${mNow - mPrev >= 0 ? '+' : ''}${f0(mNow - mPrev)} vs ${prev.date}
        </span>
      </article>
      <article class="card kpi-card">
        <span class="kpi-label">Количество снимков</span>
        <strong class="kpi-value mono">${history_db.load().length}</strong>
        <span class="kpi-sub">Последний: ${last.date}</span>
      </article>`;
  }

  /* ── Главный рендер ────────────────────────────────────── */
  function render() {
    const root = document.getElementById('tab-dynamics');
    if (!root) return;

    if (state.chartInst) { state.chartInst.destroy(); state.chartInst = null; }

    const periodOpts = PERIODS.map(p =>
      `<option value="${p.value}" ${state.period === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');
    const metricOpts = METRICS.map(m =>
      `<option value="${m.value}" ${state.metric === m.value ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    root.innerHTML = `
      <!-- KPI дельта-карточки -->
      <div class="kpi-grid" id="dynDeltaCards"></div>

      <!-- Панель управления -->
      <article class="card elevated">
        <div class="dyn-toolbar">
          <div class="dyn-mode-tabs">
            <button class="etab ${state.mode === 'avg'       ? 'active' : ''}" data-mode="avg">
              <i class="ri-line-chart-line"></i> Средняя готовность
            </button>
            <button class="etab ${state.mode === 'resources' ? 'active' : ''}" data-mode="resources">
              <i class="ri-group-line"></i> Ресурсы
            </button>
            <button class="etab ${state.mode === 'object'    ? 'active' : ''}" data-mode="object">
              <i class="ri-building-2-line"></i> По объектам
            </button>
          </div>
          <div class="dyn-controls">
            <label class="dyn-label">Период
              <select id="dynPeriod">${periodOpts}</select>
            </label>
            <label class="dyn-label" id="dynMetricWrap" ${state.mode !== 'object' ? 'style="display:none"' : ''}>Показатель
              <select id="dynMetric">${metricOpts}</select>
            </label>
          </div>
        </div>

        <!-- График + список объектов -->
        <div class="dyn-chart-area">
          <div class="chart-wrap dyn-chart-wrap"><canvas id="dynChart"></canvas></div>
          <div class="dyn-obj-panel" id="dynObjPanel" ${state.mode !== 'object' ? 'style="display:none"' : ''}>
            <div class="dyn-obj-header">
              <span>Объекты</span>
              <button class="ghost-btn" id="dynSelectAll" style="min-height:30px;padding:.3rem .6rem;font-size:var(--text-xs)">+Все</button>
              <button class="ghost-btn" id="dynClearSel" style="min-height:30px;padding:.3rem .6rem;font-size:var(--text-xs)">Сброс</button>
            </div>
            <div class="dyn-obj-list" id="dynObjectList"></div>
          </div>
        </div>
      </article>

      <!-- Снимки -->
      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title">
            <h2>Снимки истории</h2>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button class="primary-btn" id="dynSnapBtn" style="min-height:36px;padding:.4rem .85rem">
                <i class="ri-camera-line"></i> Снять снимок
              </button>
              <button class="ghost-btn" id="dynExportBtn" style="min-height:36px;padding:.4rem .85rem">
                <i class="ri-download-2-line"></i> JSON
              </button>
              <label class="ghost-btn" style="min-height:36px;padding:.4rem .85rem;cursor:pointer">
                <i class="ri-upload-2-line"></i> Импорт
                <input type="file" id="dynImportFile" accept=".json" style="display:none" />
              </label>
            </div>
          </div>
          <div class="table-wrap" style="max-height:260px">
            <table class="data-table">
              <thead><tr><th>Дата</th><th>Объектов</th><th></th></tr></thead>
              <tbody id="dynSnapTable"></tbody>
            </table>
          </div>
        </article>

        <article class="card section-stack">
          <div class="panel-title"><h2>Как работает динамика?</h2></div>
          <div class="insight-list">
            <div class="insight-item"><i class="ri-camera-line"></i>
              <div><strong>Снимок</strong><div class="muted">Нажмите «Снять снимок» после загрузки данных — дашборд запомнит текущее состояние.</div></div>
            </div>
            <div class="insight-item"><i class="ri-calendar-line"></i>
              <div><strong>Недельная рутина</strong><div class="muted">Каждую неделю обновляйте Excel → загружайте JSON → жмите «Снять снимок». Хранится в браузере.</div></div>
            </div>
            <div class="insight-item"><i class="ri-download-2-line"></i>
              <div><strong>Экспорт / импорт</strong><div class="muted">Историю можно скачать в JSON и загрузить обратно — удобно для переноса между устройствами.</div></div>
            </div>
            <div class="insight-item"><i class="ri-bar-chart-2-line"></i>
              <div><strong>3 режима графика</strong><div class="muted">Средняя готовность, ресурсы (рабочие + техника), по конкретным объектам.</div></div>
            </div>
          </div>
        </article>
      </div>`;

    // Связываем события
    root.querySelector('#dynPeriod').addEventListener('change', e => {
      state.period = Number(e.target.value);
      updateChart();
    });
    root.querySelector('#dynMetric').addEventListener('change', e => {
      state.metric = e.target.value;
      updateChart();
    });
    root.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        const isObj = state.mode === 'object';
        root.querySelector('#dynObjPanel').style.display    = isObj ? '' : 'none';
        root.querySelector('#dynMetricWrap').style.display  = isObj ? '' : 'none';
        root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
        updateChart();
      });
    });
    root.querySelector('#dynSnapBtn').addEventListener('click', () => {
      const snap = history_db.takeSnapshot();
      if (!snap) { alert('Данные ещё не загружены.'); return; }
      renderSnapshotTable();
      populateObjectList();
      updateChart();
      // mini-toast
      const btn = root.querySelector('#dynSnapBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="ri-check-line"></i> Сохранено!';
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1800);
    });
    root.querySelector('#dynExportBtn').addEventListener('click', history_db.exportJSON);
    root.querySelector('#dynImportFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const n = await history_db.importJSON(file);
        alert(`Импортировано ${n} снимков`);
        render();
      } catch { alert('Ошибка импорта. Проверьте формат JSON.'); }
    });
    root.querySelector('#dynSelectAll').addEventListener('click', () => {
      state.objects = history_db.allObjectNames();
      populateObjectList();
      updateChart();
    });
    root.querySelector('#dynClearSel').addEventListener('click', () => {
      state.objects = [];
      populateObjectList();
      updateChart();
    });

    renderSnapshotTable();
    populateObjectList();
    updateChart();
  }

  return { render };
})();
