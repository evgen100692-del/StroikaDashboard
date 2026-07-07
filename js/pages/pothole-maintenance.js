/* ================================================
  POTHOLE MAINTENANCE — Содержание дорог
  Данные загружаются из Excel (лист "МАД Итог") через
  POST /api/maintenance/upload, в БД хранятся записи
  по датам. Отображается последняя загрузка.
================================================ */
const PotholeMaintenance = (() => {
  let _data     = [];  // [{ label, plan, fact, pct }, ...]
  let _initialized = false;

  /* ================================================
     Цветовая логика
  ================================================ */
  function barColor(pct) {
    if (pct >= 90) return '#5a8a6a';
    if (pct >= 60) return '#6a9e7f';
    if (pct >= 30) return '#8ab89a';
    return '#a8c9b4';
  }
  function pctColor(pct) {
    if (pct >= 90) return '#2d6a4f';
    if (pct >= 60) return '#40916c';
    if (pct >= 30) return '#52b788';
    return '#74c69d';
  }

  /* ================================================
     Загрузка последних данных
  ================================================ */
  async function loadData() {
    try {
      const res = await fetch('/api/maintenance/latest');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _data = await res.json();
      if (!Array.isArray(_data)) _data = [];
    } catch (e) {
      console.warn('PotholeMaintenance: не удалось загрузить данные', e);
      _data = [];
    }
  }

  /* ================================================
     Рендер таблицы видов работ
  ================================================ */
  function renderChart() {
    const body = document.querySelector('#maint-wp-body');
    if (!body) return;
    if (!_data.length) {
      body.innerHTML = '<div class="wp-empty">Загрузите Excel-файл через кнопку «Актуализация»</div>';
      return;
    }
    body.innerHTML = _data.map(r => {
      const pct = r.pct !== undefined ? r.pct
                 : (r.plan > 0 ? Math.min(100, Math.round(r.fact / r.plan * 100)) : 0);
      return `
        <div class="wp-row">
          <div class="wp-col wp-col-label">
            <span class="work-label">${r.label}</span>
          </div>
          <div class="wp-col wp-col-bar">
            <div class="maint-bar-track">
              <div class="maint-bar-fill" style="width:${pct}%;background:${barColor(pct)}"></div>
            </div>
            <span class="maint-bar-values">${(+r.fact).toLocaleString('ru')} / ${(+r.plan).toLocaleString('ru')}</span>
          </div>
          <div class="wp-col wp-col-pct">
            <span class="maint-pct" style="color:${pctColor(pct)}">${pct}%</span>
          </div>
        </div>`;
    }).join('');
  }

  /* ================================================
     Дравер загрузки Excel
  ================================================ */
  function openMaintDrawer() {
    const overlay = document.getElementById('maint-drawer-overlay');
    const drawer  = document.getElementById('maint-drawer');
    if (overlay) overlay.classList.add('open');
    if (drawer)  { drawer.classList.add('open'); drawer.removeAttribute('aria-hidden'); }
    document.body.classList.add('drawer-open');
  }

  function closeMaintDrawer() {
    const overlay = document.getElementById('maint-drawer-overlay');
    const drawer  = document.getElementById('maint-drawer');
    if (overlay) overlay.classList.remove('open');
    if (drawer)  { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('drawer-open');
    // Сброс формы
    const form = document.getElementById('maint-upload-form');
    if (form) form.reset();
    _setStatus('');
        // Сброс drag-zone
    const nameEl2 = document.getElementById('maint-file-name');
    if (nameEl2) { nameEl2.textContent = ''; nameEl2.classList.remove('visible'); }
  }

  function _setStatus(msg, isErr) {
    const el = document.getElementById('maint-upload-status');
            if (!el) return;
    el.textContent = msg;
    el.className = 'maint-upload-status' + (isErr ? ' error' : msg ? ' ok' : '');
  }

  async function _handleUpload() {
    const form     = document.getElementById('maint-upload-form');
    const dateEl   = document.getElementById('maint-report-date');
    const fileEl   = document.getElementById('maint-file-input');
    const saveBtn  = document.getElementById('maint-upload-save');

    if (!dateEl.value) { _setStatus('Укажите дату', true); return; }
    if (!fileEl.files.length) { _setStatus('Выберите Excel-файл', true); return; }

    const fd = new FormData();
    fd.append('report_date', dateEl.value);
    fd.append('file', fileEl.files[0]);

    saveBtn.disabled = true;
    _setStatus('Загрузка...');

    try {
      const res = await fetch('/api/maintenance/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.status);
      _setStatus(`Загружено ${json.rows} видов работ`);
      await loadData();
      renderChart();
      setTimeout(closeMaintDrawer, 1200);
    } catch (e) {
      _setStatus('Ошибка: ' + e.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  /* ================================================
     Drag-zone для загрузки файла
================================================ */
function _bindDropZone() {
  const zone    = document.getElementById('maint-drop-zone');
  const input   = document.getElementById('maint-file-input');
  const nameEl  = document.getElementById('maint-file-name');
  if (!zone || !input) return;

  // Клик по zone — открываем file picker
  zone.addEventListener('click', () => input.click());

  // Drag over / leave / drop
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) _setDropFile(file, input, nameEl);
  });

  // Смена файла через input
  input.addEventListener('change', () => {
    if (input.files[0]) _setDropFile(input.files[0], input, nameEl);
  });
}

function _setDropFile(file, input, nameEl) {
  // DataTransfer trick: присваиваем файл в input (drag-drop случай)
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;

  if (nameEl) {
    nameEl.textContent = '📄 ' + file.name;
    nameEl.classList.add('visible');
  }
}

  /* ================================================
     Инициализация
  ================================================ */
  async function init() {
    if (_initialized) { renderChart(); return; }
    _initialized = true;
    await loadData();
    renderChart();

    const btn = document.getElementById('maint-actualize-btn');
    if (btn) btn.addEventListener('click', openMaintDrawer);

    const saveBtn = document.getElementById('maint-upload-save');
    if (saveBtn) saveBtn.addEventListener('click', _handleUpload);
    
    // Инициализация drag-zone
    _bindDropZone();
  }

  return { init, refresh: renderChart, openMaintDrawer, closeMaintDrawer };
})();

// Глобальные обёртки для HTML onclick
function openMaintDrawer()  { PotholeMaintenance.openMaintDrawer(); }
function closeMaintDrawer() { PotholeMaintenance.closeMaintDrawer(); }
