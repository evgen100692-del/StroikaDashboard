/* ══════════════════════════════════════════════════════════════
   POTHOLE MAINTENANCE — Содержание
   Данные сохраняются в IndexedDB (ключ «maint_data»)
══════════════════════════════════════════════════════════════ */

const PotholeMaintenance = (() => {

  /* ── Виды работ ── */
  const WORK_TYPES = [
    { id: 'wash_stops',    label: 'Мойка остановок',                       unit: 'шт' },
    { id: 'paint_stops',   label: 'Покраска остановок',                     unit: 'шт' },
    { id: 'sweep_curb',    label: 'Уборка смёта из прибордюрной части',    unit: 'км' },
    { id: 'trash_row',     label: 'Уборка мусора в полосе отвода',         unit: 'км' },
    { id: 'wash_barriers', label: 'Мойка ограждений',                       unit: 'км' },
    { id: 'wash_road',     label: 'Мойка проезжей части',                   unit: 'км' },
    { id: 'wash_sidewalk', label: 'Мойка тротуаров',                        unit: 'км' },
    { id: 'mow_grass',     label: 'Окос травы',                             unit: 'км' },
    { id: 'markup_linear', label: 'Линейная разметка',                      unit: 'км' },
    { id: 'markup_cross',  label: 'Разметка пешеходных переходов',          unit: 'шт' },
    { id: 'borsh',         label: 'Ликвидация борщевика',                   unit: 'га' },
  ];

  /* ── In-memory store ── */
  let data = {};
  WORK_TYPES.forEach(w => { data[w.id] = { plan: 0, fact: 0 }; });

  let _initialized = false;
  let _db = null;          // IndexedDB instance
  const DB_NAME    = 'stroiDashDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'maintData';
  const RECORD_KEY = 'current';

  /* ════════════════════════════════════════════════
     IndexedDB helpers
  ════════════════════════════════════════════════ */
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
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = e => resolve(e.target.result ?? null);
      req.onerror   = e => reject(e.target.error);
    }));
  }

  function dbPut(key, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    }));
  }

  /* ════════════════════════════════════════════════
     Загрузка / сохранение
  ════════════════════════════════════════════════ */
  async function loadData() {
    try {
      const saved = await dbGet(RECORD_KEY);
      if (saved && typeof saved === 'object') {
        WORK_TYPES.forEach(w => {
          if (saved[w.id]) data[w.id] = {
            plan: parseFloat(saved[w.id].plan) || 0,
            fact: parseFloat(saved[w.id].fact) || 0,
          };
        });
      }
    } catch (e) {
      console.warn('[PotholeMaintenance] IndexedDB load error:', e);
    }
  }

  async function persistData() {
    try {
      await dbPut(RECORD_KEY, JSON.parse(JSON.stringify(data)));
    } catch (e) {
      console.warn('[PotholeMaintenance] IndexedDB save error:', e);
    }
  }

  /* ════════════════════════════════════════════════
     Рендеринг графика
  ════════════════════════════════════════════════ */
  function barColor(pct) {
    if (pct >= 100) return 'var(--color-success)';
    if (pct >= 60)  return 'var(--color-primary)';
    if (pct >= 30)  return 'var(--color-gold)';
    return 'var(--color-error)';
  }

  function renderChart() {
    const wrap = document.getElementById('maint-chart-wrap');
    if (!wrap) return;
    wrap.innerHTML = WORK_TYPES.map(w => {
      const d   = data[w.id];
      const pct = d.plan > 0 ? Math.min(Math.round((d.fact / d.plan) * 100), 100) : 0;
      const col = barColor(pct);
      return `
        <div class="maint-bar-row">
          <div class="maint-bar-label" title="${w.label} (${w.unit})">${w.label} <span class="maint-bar-unit">(${w.unit})</span></div>
          <div class="maint-bar-track">
            <div class="maint-bar-fill" style="width:${pct}%;background:${col}"></div>
          </div>
          <div class="maint-bar-pct" style="color:${col}">${pct}%</div>
          <div class="maint-bar-nums">${d.fact} / ${d.plan}</div>
        </div>`;
    }).join('');
  }

  /* ════════════════════════════════════════════════
     Модаль актуализации
  ════════════════════════════════════════════════ */
  function renderModalTable() {
    const tbody = document.getElementById('maint-modal-tbody');
    if (!tbody) return;
    tbody.innerHTML = WORK_TYPES.map(w => {
      const d   = data[w.id];
      const pct = d.plan > 0 ? Math.round((d.fact / d.plan) * 100) : 0;
      return `<tr>
        <td>${w.label} (${w.unit})</td>
        <td><input class="maint-input" type="number" min="0" step="any"
             data-id="${w.id}" data-field="plan" value="${d.plan}"></td>
        <td><input class="maint-input" type="number" min="0" step="any"
             data-id="${w.id}" data-field="fact" value="${d.fact}"></td>
        <td class="maint-td-pct">${pct}%</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.maint-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const row     = inp.closest('tr');
        const plan    = parseFloat(row.querySelector('[data-field="plan"]').value) || 0;
        const fact    = parseFloat(row.querySelector('[data-field="fact"]').value) || 0;
        const pct     = plan > 0 ? Math.round((fact / plan) * 100) : 0;
        row.querySelector('.maint-td-pct').textContent = pct + '%';
      });
    });
  }

  async function saveFromModal() {
    const tbody = document.getElementById('maint-modal-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
      const planInp = row.querySelector('[data-field="plan"]');
      const factInp = row.querySelector('[data-field="fact"]');
      if (!planInp) return;
      data[planInp.dataset.id] = {
        plan: parseFloat(planInp.value) || 0,
        fact: parseFloat(factInp.value) || 0,
      };
    });

    await persistData();   // ← сохраняем в IndexedDB
    renderChart();
    closeModal('maint-modal');
  }

  function openMaintModal() {
    renderModalTable();
    openModal('maint-modal');
  }

  /* ════════════════════════════════════════════════
     init / refresh
  ════════════════════════════════════════════════ */
  function init() {
    if (_initialized) return;
    _initialized = true;

    const btn     = document.getElementById('maint-actualize-btn');
    const saveBtn = document.getElementById('maint-modal-save');
    if (btn)     btn.addEventListener('click', openMaintModal);
    if (saveBtn) saveBtn.addEventListener('click', saveFromModal);
  }

  async function refresh() {
    await loadData();   // ← загружаем сохранённые данные
    init();
    renderChart();
  }

  return { init, refresh, openMaintModal, saveFromModal };
})();
