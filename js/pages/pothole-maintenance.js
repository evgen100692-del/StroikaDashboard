/* ================================================
  POTHOLE MAINTENANCE — Содержание
  Данные сохраняются в IndexedDB (ключ «maint_data»)
================================================ */

const PotholeMaintenance = (() => {

  /* — Виды работ — */
  const WORK_TYPES = [
    { id: 'wash_stops',    label: 'Мойка остановок',                    unit: 'шт' },
    { id: 'paint_stops',   label: 'Покраска остановок',                  unit: 'шт' },
    { id: 'sweep_curb',    label: 'Уборка смёта из прибордюрной части',  unit: 'км' },
    { id: 'trash_row',     label: 'Уборка мусора в полосе отвода',       unit: 'км' },
    { id: 'wash_barriers', label: 'Мойка ограждений',                    unit: 'км' },
    { id: 'wash_road',     label: 'Мойка проезжей части',                unit: 'км' },
    { id: 'wash_sidewalk', label: 'Мойка тротуаров',                     unit: 'км' },
    { id: 'mow_grass',     label: 'Окос травы',                          unit: 'км' },
    { id: 'markup_linear', label: 'Линейная разметка',                   unit: 'км' },
    { id: 'markup_cross',  label: 'Разметка пешеходных переходов',       unit: 'шт' },
    { id: 'borsh',         label: 'Ликвидация борщевика',                unit: 'га' },
  ];

  /* — In-memory store — */
  let data = {};
  WORK_TYPES.forEach(w => { data[w.id] = { plan: 0, fact: 0 }; });

  let _initialized = false;
  let _db = null;
  const DB_NAME    = 'stroiDashDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'maintData';
  const RECORD_KEY = 'current';

  /* ================================================
    IndexedDB helpers
  ================================================ */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function dbGet(key) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = e => resolve(e.target.result ?? null);
      req.onerror   = e => reject(e.target.error);
    }));
  }

  function dbPut(key, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    }));
  }

  /* ================================================
    Загрузка / сохранение данных
  ================================================ */
  async function loadData() {
    try {
      const saved = await dbGet(RECORD_KEY);
      if (saved && typeof saved === 'object') {
        WORK_TYPES.forEach(w => {
          if (saved[w.id]) data[w.id] = saved[w.id];
        });
      }
    } catch (e) {
      console.warn('PotholeMaintenance: не удалось загрузить данные из IndexedDB', e);
    }
  }

  async function persistData() {
    try {
      await dbPut(RECORD_KEY, { ...data });
    } catch (e) {
      console.warn('PotholeMaintenance: не удалось сохранить данные в IndexedDB', e);
    }
  }

  /* ================================================
    Цвет полосы
  ================================================ */
  function barColor(pct) {
    if (pct >= 100) return 'var(--color-success)';
    if (pct >= 60)  return 'var(--color-primary)';
    if (pct >= 30)  return 'var(--color-gold, #f59e0b)';
    return 'var(--color-error)';
  }

  /* ================================================
    Рендеринг графика
    Классы совпадают с CSS в dashboard-construction-analytics.html:
    .maint-bar-row / .maint-bar-label / .maint-bar-unit /
    .maint-bar-track / .maint-bar-fill / .maint-bar-pct / .maint-bar-nums
  ================================================ */
  function renderChart() {
    const wrap = document.getElementById('maint-chart-wrap');
    if (!wrap) return;

    wrap.innerHTML = WORK_TYPES.map(w => {
      const d   = data[w.id] || { plan: 0, fact: 0 };
      const pct = (d.plan > 0)
        ? Math.min(Math.round((d.fact / d.plan) * 100), 100)
        : 0;
      const col = barColor(pct);

      return `
        <div class="maint-bar-row">
          <div class="maint-bar-label">
            ${w.label} <span class="maint-bar-unit">(${w.unit})</span>
          </div>
          <div class="maint-bar-track">
            <div class="maint-bar-fill" style="width:${pct}%;background:${col};"></div>
          </div>
          <div class="maint-bar-pct" style="color:${col};">${pct}%</div>
          <div class="maint-bar-nums">${d.fact.toLocaleString('ru')} / ${d.plan.toLocaleString('ru')}</div>
        </div>
      `;
    }).join('');
  }

  /* ================================================
    Модаль актуализации
  ================================================ */
  function renderModalTable() {
    const tbody = document.getElementById('maint-modal-tbody');
    if (!tbody) return;

    tbody.innerHTML = WORK_TYPES.map(w => {
      const d   = data[w.id] || { plan: 0, fact: 0 };
      const pct = (d.plan > 0)
        ? Math.min(Math.round((d.fact / d.plan) * 100), 100)
        : 0;
      return `
        <tr data-work-id="${w.id}">
          <td style="padding:var(--space-2) var(--space-4);font-size:var(--text-sm);">
            ${w.label} <span style="color:var(--color-text-muted);font-size:var(--text-xs);">(${w.unit})</span>
          </td>
          <td style="padding:var(--space-2) var(--space-3);">
            <input
              class="maint-input"
              type="number"
              min="0"
              step="any"
              data-id="${w.id}"
              data-field="plan"
              value="${d.plan || ''}"
              placeholder="0"
            />
          </td>
          <td style="padding:var(--space-2) var(--space-3);">
            <input
              class="maint-input"
              type="number"
              min="0"
              step="any"
              data-id="${w.id}"
              data-field="fact"
              value="${d.fact || ''}"
              placeholder="0"
            />
          </td>
          <td class="maint-td-pct" data-pct-id="${w.id}">${pct}%</td>
        </tr>
      `;
    }).join('');

    /* live-пересчёт % при вводе */
    tbody.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const id       = inp.dataset.id;
        const row      = tbody.querySelector(`tr[data-work-id="${id}"]`);
        if (!row) return;
        const planVal  = parseFloat(row.querySelector('[data-field="plan"]').value) || 0;
        const factVal  = parseFloat(row.querySelector('[data-field="fact"]').value) || 0;
        const pctVal   = planVal > 0 ? Math.min(Math.round((factVal / planVal) * 100), 100) : 0;
        const pctCell  = row.querySelector(`[data-pct-id="${id}"]`);
        if (pctCell) pctCell.textContent = pctVal + '%';
      });
    });
  }

  async function saveFromModal() {
    const tbody = document.getElementById('maint-modal-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('tr[data-work-id]').forEach(row => {
      const id      = row.dataset.workId;
      const planInp = row.querySelector('[data-field="plan"]');
      const factInp = row.querySelector('[data-field="fact"]');
      if (!planInp || !factInp) return;
      data[id] = {
        plan: parseFloat(planInp.value) || 0,
        fact: parseFloat(factInp.value) || 0,
      };
    });

    await persistData();
    renderChart();
    if (typeof closeModal === 'function') closeModal('maint-modal');
  }

  /* ================================================
    Публичный API
  ================================================ */
  function init() {
    if (_initialized) return;
    _initialized = true;

    const btn  = document.getElementById('maint-actualize-btn');
    const save = document.getElementById('maint-modal-save');

    if (btn) {
      btn.addEventListener('click', () => {
        renderModalTable();
        if (typeof openModal === 'function') openModal('maint-modal');
      });
    }

    if (save) {
      save.addEventListener('click', saveFromModal);
    }
  }

  async function refresh() {
    init();
    await loadData();
    renderChart();
  }

  return { init, refresh };

})();
