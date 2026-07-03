/* ================================================
  POTHOLE MAINTENANCE — Содержание
  Данные сохраняются в БД сервера через API /api/maintenance
================================================ */

const PotholeMaintenance = (() => {

  const WORK_TYPES = [
    { id: 'wash_stops',    label: 'Мойка остановок',                      unit: 'шт' },
    { id: 'paint_stops',   label: 'Покраска остановок',                    unit: 'шт' },
    { id: 'sweep_curb',    label: 'Уборка смёта из прибордюрной части',    unit: 'км' },
    { id: 'trash_row',     label: 'Уборка мусора в полосе отвода',         unit: 'км' },
    { id: 'wash_barriers', label: 'Мойка ограждений',                      unit: 'км' },
    { id: 'wash_road',     label: 'Мойка проезжей части',                  unit: 'км' },
    { id: 'wash_sidewalk', label: 'Мойка тротуаров',                       unit: 'км' },
    { id: 'mow_grass',     label: 'Окос травы',                            unit: 'км' },
    { id: 'markup_linear', label: 'Линейная разметка',                     unit: 'км' },
    { id: 'markup_cross',  label: 'Разметка пешеходных переходов',         unit: 'шт' },
    { id: 'borsh',         label: 'Ликвидация борщевика',                  unit: 'га' },
  ];

  let data = {};
  WORK_TYPES.forEach(w => { data[w.id] = { plan: 0, fact: 0 }; });

  let _initialized = false;

  /* ================================================
    API helpers
  ================================================ */
  async function loadData() {
    try {
      const res = await fetch('/api/maintenance');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      if (Array.isArray(rows)) {
        rows.forEach(row => {
          if (data[row.work_id] !== undefined) {
            data[row.work_id] = { plan: row.plan || 0, fact: row.fact || 0 };
          }
        });
      }
    } catch (e) {
      console.warn('PotholeMaintenance: не удалось загрузить данные', e);
    }
  }

  async function persistData() {
    try {
      const payload = WORK_TYPES.map(w => ({
        work_id: w.id,
        plan:    data[w.id].plan,
        fact:    data[w.id].fact,
      }));
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('PotholeMaintenance: не удалось сохранить данные', e);
    }
  }

  /* ================================================
    Цвет полосы — стиль Динамика стройготовности
  ================================================ */
  function barColor(pct) {
    if (pct >= 90) return '#5a8a6a'; // тёмно-зелёный
    if (pct >= 60) return '#6a9e7f'; // зелёный
    if (pct >= 30) return '#8ab89a'; // светло-зелёный
    return '#a8c9b4';                // бледно-зелёный
  }

  function pctColor(pct) {
    if (pct >= 90) return '#2d6a4f';
    if (pct >= 60) return '#40916c';
    if (pct >= 30) return '#52b788';
    return '#74c69d';
  }

  /* ================================================
    Рендер графика в стиле «Динамика стройготовности»
  ================================================ */
  function renderChart() {
    const container = document.querySelector('.maint-chart-container');
    if (!container) return;

    const rows = WORK_TYPES.map(w => {
      const d = data[w.id];
      const pct = d.plan > 0 ? Math.min(100, Math.round(d.fact / d.plan * 100)) : 0;
      return { ...w, plan: d.plan, fact: d.fact, pct };
    });

    container.innerHTML = `
      <table class="maint-progress-table">
        <thead>
          <tr>
            <th class="col-label">Вид работ</th>
            <th class="col-bar">Прогресс</th>
            <th class="col-pct">%</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="maint-row">
              <td class="col-label">
                <span class="work-label">${r.label}</span>
                <span class="work-unit">${r.unit}</span>
              </td>
              <td class="col-bar">
                <div class="maint-bar-track">
                  <div class="maint-bar-fill" style="width:${r.pct}%;background:${barColor(r.pct)}"></div>
                </div>
                <span class="maint-bar-values">${r.fact.toLocaleString('ru')} / ${r.plan.toLocaleString('ru')}</span>
              </td>
              <td class="col-pct">
                <span class="maint-pct" style="color:${pctColor(r.pct)}">${r.pct}%</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /* ================================================
    Модальное окно актуализации
  ================================================ */
  function renderModal() {
    const tbody = document.querySelector('#maint-modal-body');
    if (!tbody) return;
    tbody.innerHTML = WORK_TYPES.map(w => {
      const d = data[w.id];
      const pct = d.plan > 0 ? Math.min(100, Math.round(d.fact / d.plan * 100)) : 0;
      return `
        <tr>
          <td>${w.label} <small>(${w.unit})</small></td>
          <td><input type="number" class="maint-input" data-id="${w.id}" data-field="plan"
            value="${d.plan}" min="0" step="1" aria-current="true" /></td>
          <td><input type="number" class="maint-input" data-id="${w.id}" data-field="fact"
            value="${d.fact}" min="0" step="1" /></td>
          <td>${pct}%</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.maint-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const id    = inp.dataset.id;
        const field = inp.dataset.field;
        data[id][field] = parseFloat(inp.value) || 0;
        const row  = inp.closest('tr');
        const d2   = data[id];
        const pct2 = d2.plan > 0 ? Math.min(100, Math.round(d2.fact / d2.plan * 100)) : 0;
        row.querySelector('td:last-child').textContent = pct2 + '%';
      });
    });
  }

  /* ================================================
    Инициализация
  ================================================ */
  async function init(container) {
    if (_initialized) { renderChart(); return; }
    _initialized = true;

    await loadData();
    renderChart();

    // Кнопка «Актуализация»
    const btn = document.getElementById('maint-actualize-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        renderModal();
        const modal = document.getElementById('maint-modal');
        if (modal) modal.classList.add('open');
      });
    }

    // Закрытие модалки
    const closeBtn = document.querySelector('#maint-modal .modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modal = document.getElementById('maint-modal');
        if (modal) modal.classList.remove('open');
      });
    }

    // Кнопка «Отмена»
    const cancelBtn = document.getElementById('maint-modal-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const modal = document.getElementById('maint-modal');
        if (modal) modal.classList.remove('open');
      });
    }

    // Кнопка «Сохранить»
    const saveBtn = document.getElementById('maint-modal-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await persistData();
        const modal = document.getElementById('maint-modal');
        if (modal) modal.classList.remove('open');
        renderChart();
      });
    }
  }

  return { init };

})();
