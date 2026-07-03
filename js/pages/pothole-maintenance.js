/* ══════════════════════════════════════════════════════════════
   POTHOLE MAINTENANCE — Содержание
   Управляет графиком выполнения видов работ и модалью актуализации
══════════════════════════════════════════════════════════════ */

const PotholeMaintenance = (() => {

  /* ── Виды работ (ключ, название, единица измерения) ── */
  const WORK_TYPES = [
    { id: 'wash_stops',      label: 'Мойка остановок',                        unit: 'шт' },
    { id: 'paint_stops',     label: 'Покраска остановок',                      unit: 'шт' },
    { id: 'sweep_curb',      label: 'Уборка смёта из прибордюрной части',     unit: 'км' },
    { id: 'trash_row',       label: 'Уборка мусора в полосе отвода',          unit: 'км' },
    { id: 'wash_barriers',   label: 'Мойка ограждений',                        unit: 'км' },
    { id: 'wash_road',       label: 'Мойка проезжей части',                    unit: 'км' },
    { id: 'wash_sidewalk',   label: 'Мойка тротуаров',                         unit: 'км' },
    { id: 'mow_grass',       label: 'Окос травы',                              unit: 'км' },
    { id: 'markup_linear',   label: 'Линейная разметка',                       unit: 'км' },
    { id: 'markup_cross',    label: 'Разметка пешеходных переходов',           unit: 'шт' },
    { id: 'borsh',           label: 'Ликвидация борщевика',                    unit: 'га' },
  ];

  /* ── Хранилище данных (plan / fact) ── */
  let data = {};
  WORK_TYPES.forEach(w => { data[w.id] = { plan: 0, fact: 0 }; });

  let _initialized = false;

  /* ── Цвет полосы в зависимости от процента ── */
  function barColor(pct) {
    if (pct >= 100) return 'var(--color-success)';
    if (pct >= 60)  return 'var(--color-primary)';
    if (pct >= 30)  return 'var(--color-gold)';
    return 'var(--color-error)';
  }

  /* ── Построение / обновление графика ── */
  function renderChart() {
    const wrap = document.getElementById('maint-chart-wrap');
    if (!wrap) return;

    const rows = WORK_TYPES.map(w => {
      const d = data[w.id];
      const pct = d.plan > 0 ? Math.min(Math.round((d.fact / d.plan) * 100), 100) : 0;
      const color = barColor(pct);
      return `
        <div class="maint-bar-row">
          <div class="maint-bar-label" title="${w.label} (${w.unit})">${w.label} <span class="maint-bar-unit">(${w.unit})</span></div>
          <div class="maint-bar-track">
            <div class="maint-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="maint-bar-pct" style="color:${color}">${pct}%</div>
          <div class="maint-bar-nums">${d.fact} / ${d.plan}</div>
        </div>`;
    }).join('');

    wrap.innerHTML = rows;
  }

  /* ── Построение строк таблицы в модали ── */
  function renderModalTable() {
    const tbody = document.getElementById('maint-modal-tbody');
    if (!tbody) return;
    tbody.innerHTML = WORK_TYPES.map(w => {
      const d = data[w.id];
      const pct = d.plan > 0 ? Math.round((d.fact / d.plan) * 100) : 0;
      return `<tr>
        <td>${w.label} (${w.unit})</td>
        <td><input class="maint-input" type="number" min="0" step="any" data-id="${w.id}" data-field="plan" value="${d.plan}"></td>
        <td><input class="maint-input" type="number" min="0" step="any" data-id="${w.id}" data-field="fact" value="${d.fact}"></td>
        <td class="maint-td-pct">${pct}%</td>
      </tr>`;
    }).join('');

    /* live-пересчёт % при вводе */
    tbody.querySelectorAll('.maint-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const row = inp.closest('tr');
        const planInp = row.querySelector('[data-field="plan"]');
        const factInp = row.querySelector('[data-field="fact"]');
        const plan = parseFloat(planInp.value) || 0;
        const fact = parseFloat(factInp.value) || 0;
        const pct  = plan > 0 ? Math.round((fact / plan) * 100) : 0;
        row.querySelector('.maint-td-pct').textContent = pct + '%';
      });
    });
  }

  /* ── Сохранение данных из модали ── */
  function saveFromModal() {
    const tbody = document.getElementById('maint-modal-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
      const planInp = row.querySelector('[data-field="plan"]');
      const factInp = row.querySelector('[data-field="fact"]');
      if (!planInp) return;
      const id = planInp.dataset.id;
      data[id] = {
        plan: parseFloat(planInp.value) || 0,
        fact: parseFloat(factInp.value) || 0,
      };
    });
    renderChart();
    closeModal('maint-modal');
  }

  /* ── Открыть модаль ── */
  function openModal() {
    renderModalTable();
    const overlay = document.getElementById('maint-modal');
    if (overlay) { overlay.classList.add('active'); overlay.removeAttribute('aria-hidden'); }
  }

  /* ── init: однократная привязка слушателей (вызывается из initModules) ── */
  function init() {
    if (_initialized) return;
    _initialized = true;

    const btn = document.getElementById('maint-actualize-btn');
    if (btn) btn.addEventListener('click', openModal);

    const saveBtn = document.getElementById('maint-modal-save');
    if (saveBtn) saveBtn.addEventListener('click', saveFromModal);
  }

  /* ── refresh: вызывается Router при переходе на страницу ── */
  function refresh() {
    init();       // на случай если страница ещё не была инициализирована
    renderChart();
  }

  return { init, refresh, openModal, saveFromModal };
})();
