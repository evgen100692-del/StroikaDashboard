/* ================================================
  POTHOLE MAINTENANCE — Содержание дорог
  Данные загружаются из Excel (лист "МАД Итог") через
  POST /api/maintenance/upload, в БД хранятся записи
  по датам. Отображается последняя загрузка.
================================================ */
const PotholeMaintenance = (() => {
  let _data     = [];  // [{ label, plan, fact, pct }, ...] — текущая загрузка
  let _prevData = [];  // предыдущая загрузка (для дельты)
  let _allDates = [];  // все даты загрузок (отсортированы DESC)
  let _allReports = {}; // { 'YYYY-MM-DD': [{label,plan,fact,pct},...] }
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
     Вычисление pct из plan/fact — округляем до целого
  ================================================ */
  function calcPct(r) {
    if (r.plan > 0) return Math.round((r.fact / r.plan) * 100);
    return r.pct !== undefined ? Math.round(r.pct) : 0;
  }

  /* ================================================
     Округление по условию задачи:
     дробная часть 0-4 → вниз, 5-9 → вверх
  ================================================ */
  function roundHalfUp(val) {
    return Math.floor(val + 0.5);
  }

  /* ================================================
     Получить значение факта по метке из массива отчёта
  ================================================ */
  function getFactByLabel(reportData, label) {
    if (!reportData) return null;
    const row = reportData.find(r => r.label === label);
    return row ? parseFloat(row.fact) : null;
  }

  /* ================================================
     Получить день недели (сокращённо, рус)
  ================================================ */
  const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  function getDayName(dateStr) {
    // dateStr: 'YYYY-MM-DD'
    const d = new Date(dateStr + 'T00:00:00');
    return DAY_NAMES[d.getDay()];
  }

  /* ================================================
     Форматировать дату из YYYY-MM-DD в DD.MM.YYYY
  ================================================ */
  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  }

  /* ================================================
     Получить номер дня недели (0=вс,1=пн,...,4=чт,3=ср)
     Неделя: чт(4) → ср(3), т.е. чт = начало
     Возвращает «позицию» дня в рамках недели (0=чт,...,6=ср)
  ================================================ */
  function weekPos(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay(); // 0=вс,1=пн,2=вт,3=ср,4=чт,5=пт,6=сб
    // Смещение: чт=0, пт=1, сб=2, вс=3, пн=4, вт=5, ср=6
    return (dow + 3) % 7; // чт(4): (4+3)%7=0, пт(5):1, сб(6):2, вс(0):3, пн(1):4, вт(2):5, ср(3):6
  }

  /* ================================================
     Загрузка ВСЕХ дат и данных
  ================================================ */
  async function loadData() {
    try {
      const datesRes = await fetch('/api/maintenance/upload/dates');
      const dates = datesRes.ok ? await datesRes.json() : [];

      _allDates = dates; // [{id, report_date, uploaded_at}, ...]

      if (!dates.length) { _data = []; _prevData = []; _allReports = {}; return; }

      const curDate  = dates[0].report_date;
      const prevDate = dates.length > 1 ? dates[1].report_date : null;

      // Загружаем текущие данные
      const curRes = await fetch('/api/maintenance/upload/by-date?date=' + encodeURIComponent(curDate));
      if (!curRes.ok) throw new Error('HTTP ' + curRes.status);
      const curJson = await curRes.json();
      _data = Array.isArray(curJson.data_json) ? curJson.data_json : [];

      // Загружаем предыдущие данные
      if (prevDate) {
        try {
          const prevRes = await fetch('/api/maintenance/upload/by-date?date=' + encodeURIComponent(prevDate));
          if (prevRes.ok) {
            const prevJson = await prevRes.json();
            _prevData = Array.isArray(prevJson.data_json) ? prevJson.data_json : [];
          } else {
            _prevData = [];
          }
        } catch (e) {
          _prevData = [];
        }
      } else {
        _prevData = [];
      }

      // Загружаем ВСЕ отчёты для таблицы динамики
      _allReports = {};
      // Загружаем параллельно, но не более 20 дат чтобы не перегружать
      const datesToLoad = dates.slice(0, 60);
      await Promise.all(datesToLoad.map(async (d) => {
        try {
          const r = await fetch('/api/maintenance/upload/by-date?date=' + encodeURIComponent(d.report_date));
          if (r.ok) {
            const j = await r.json();
            _allReports[d.report_date] = Array.isArray(j.data_json) ? j.data_json : [];
          }
        } catch (_) {}
      }));

    } catch (e) {
      console.warn('PotholeMaintenance: не удалось загрузить данные', e);
      _data = []; _prevData = []; _allReports = {};
    }
  }

  /* ================================================
     Рендер таблицы видов работ
  ================================================ */
  function renderChart() {
    const CYCLIC = ['Мойка остановок, шт','Покраска остановок, шт','Уборка смета из прибордюрной части, км','Уборка мусора в полосе отвода, км','Мойка ограждений, км','Мойка проезжей части, км','Мойка тротуаров, км','Окос травы, км'];
    const ANNUAL = ['Линейная разметка, км','Разметка пешеходных переходов, шт','Ликвидация борщевика, га'];

    const body = document.querySelector('#maint-wp-body');
    if (!body) return;
    if (!_data.length) {
      body.innerHTML = '<div class="wp-empty">Загрузите Excel-файл через кнопку «Актуализация»</div>';
      renderDynamicsTable();
      return;
    }

    const prevMap = {};
    _prevData.forEach(r => { prevMap[r.label] = calcPct(r); });

    const makeDelta = (label, curPct) => {
      if (!_prevData.length) return '';
      const prev = prevMap[label];
      if (prev === undefined) return '';
      const diff = Math.round(curPct - prev);
      if (diff === 0) return '<span class="maint-delta neu">(0%)</span>';
      const sign = diff > 0 ? '+' : '';
      const cls  = diff > 0 ? 'up' : 'down';
      return `<span class="maint-delta ${cls}">(${sign}${diff}%)</span>`;
    };

    const makeRow = r => {
      const pct  = calcPct(r);
      const fact = Math.round(+r.fact);
      const plan = Math.round(+r.plan);
      return `<div class="wp-row">
        <div class="wp-col wp-col-label"><span class="work-label">${r.label}</span></div>
        <div class="wp-col wp-col-bar">
          <div class="maint-bar-track">
            <div class="maint-bar-fill" style="width:${Math.min(pct, 100)}%;background:${barColor(pct)}"></div>
          </div>
          <span class="maint-bar-values">${fact.toLocaleString('ru')} / ${plan.toLocaleString('ru')}</span>
        </div>
        <div class="wp-col wp-col-pct">
          <span class="maint-pct" style="color:${pctColor(pct)}">${pct}%</span>
          ${makeDelta(r.label, pct)}
        </div>
      </div>`;
    };

    const makeGroup = (title, keys) => {
      const rows = _data.filter(r => keys.includes(r.label));
      if (!rows.length) return '';
      return `<div class="wp-group"><div class="wp-group-header">${title}</div>${rows.map(makeRow).join('')}</div>`;
    };

    const other = _data.filter(r => !CYCLIC.includes(r.label) && !ANNUAL.includes(r.label));
    body.innerHTML =
      makeGroup('Цикличные', CYCLIC) +
      makeGroup('План на год', ANNUAL) +
      (other.length ? `<div class="wp-group">${other.map(makeRow).join('')}</div>` : '');

    // Рендерим таблицу динамики
    renderDynamicsTable();
  }

  /* ================================================
     Рендер таблицы динамики уборки мусора и смёта
  ================================================ */
  function renderDynamicsTable() {
    const LABEL_MUSOR = 'Уборка мусора в полосе отвода, км';
    const LABEL_SMET  = 'Уборка смета из прибордюрной части, км';

    const wrap = document.getElementById('maint-dynamics-wrap');
    if (!wrap) return;

    // Получаем все даты в хронологическом порядке (ASC)
    const sortedDates = Object.keys(_allReports).sort();

    if (sortedDates.length === 0) {
      wrap.innerHTML = '<div class="wp-empty">Нет данных для отображения динамики</div>';
      return;
    }

    // Строим массив строк таблицы
    const rows = [];
    for (let i = 0; i < sortedDates.length; i++) {
      const curDate  = sortedDates[i];
      const prevDate = i > 0 ? sortedDates[i - 1] : null;

      const curMusor  = getFactByLabel(_allReports[curDate],  LABEL_MUSOR);
      const prevMusor = prevDate ? getFactByLabel(_allReports[prevDate], LABEL_MUSOR) : null;
      const curSmet   = getFactByLabel(_allReports[curDate],  LABEL_SMET);
      const prevSmet  = prevDate ? getFactByLabel(_allReports[prevDate], LABEL_SMET) : null;

      let deltaMusor = null;
      if (curMusor !== null && prevMusor !== null) {
        const raw = curMusor - prevMusor;
        deltaMusor = raw >= 0 ? roundHalfUp(raw) : null;
      }

      let deltaSmet = null;
      if (curSmet !== null && prevSmet !== null) {
        const raw = curSmet - prevSmet;
        deltaSmet = raw >= 0 ? roundHalfUp(raw) : null;
      }

      rows.push({
        date:       curDate,
        dayName:    getDayName(curDate),
        deltaMusor,
        deltaSmet,
        weekPos:    weekPos(curDate),
      });
    }

    // Вычисляем суммы за неделю (чт–ср)
    // Проходим по строкам и накапливаем сумму с начала недели (когда weekPos === 0, сбрасываем)
    let weekSumMusor = 0;
    let weekSumSmet  = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // Начало новой недели (четверг)
      if (r.weekPos === 0) {
        weekSumMusor = 0;
        weekSumSmet  = 0;
      }

      if (r.deltaMusor !== null) weekSumMusor += r.deltaMusor;
      if (r.deltaSmet  !== null) weekSumSmet  += r.deltaSmet;

      // Показываем сумму только в конце недели (среда, weekPos===6) или в последний день
      const isLastRow    = i === rows.length - 1;
      const isWeekEnd    = r.weekPos === 6;

      r.weekSumMusor = (isWeekEnd || isLastRow) ? weekSumMusor : null;
      r.weekSumSmet  = (isWeekEnd || isLastRow) ? weekSumSmet  : null;
    }

    // Рендер
    const rowsHtml = rows.map(r => {
      const musorCell  = r.deltaMusor !== null ? r.deltaMusor : '—';
      const smetCell   = r.deltaSmet  !== null ? r.deltaSmet  : '—';
      const weekMusor  = r.weekSumMusor !== null ? r.weekSumMusor : '';
      const weekSmet   = r.weekSumSmet  !== null ? r.weekSumSmet  : '';

      // Подсветка строки-начала недели
      const trClass = r.weekPos === 0 ? ' class="dyn-week-start"' : '';

      return `<tr${trClass}>
        <td class="dyn-td dyn-td-date">${formatDate(r.date)}</td>
        <td class="dyn-td dyn-td-day">${r.dayName}</td>
        <td class="dyn-td dyn-td-num">${musorCell}</td>
        <td class="dyn-td dyn-td-week">${weekMusor}</td>
        <td class="dyn-td dyn-td-num">${smetCell}</td>
        <td class="dyn-td dyn-td-week">${weekSmet}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="dyn-table-scroll">
        <table class="dyn-table">
          <thead>
            <tr>
              <th class="dyn-th" rowspan="2">Дата</th>
              <th class="dyn-th" rowspan="2">День<br>недели</th>
              <th class="dyn-th dyn-th-group" colspan="2">Выполнение уборки мусора</th>
              <th class="dyn-th dyn-th-group" colspan="2">Выполнение уборки смета</th>
            </tr>
            <tr>
              <th class="dyn-th dyn-th-sub">Всего за день</th>
              <th class="dyn-th dyn-th-sub">Всего за неделю</th>
              <th class="dyn-th dyn-th-sub">Всего за день</th>
              <th class="dyn-th dyn-th-sub">Всего за неделю</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
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
    const form = document.getElementById('maint-upload-form');
    if (form) form.reset();
    _setStatus('');
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
      if (!res.ok) {
        const errText = await res.text().catch(() => String(res.status));
        let errMsg = String(res.status);
        try { errMsg = JSON.parse(errText).error || errMsg; } catch (_) { errMsg = errText || errMsg; }
        throw new Error(errMsg);
      }
      const json = await res.json();
      _setStatus(`Загружено ${json.rows} видов работ`);
      await loadData();
      renderChart();
      closeMaintDrawer();
      if (typeof PotholePage !== 'undefined' && PotholePage.refresh) PotholePage.refresh();
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
    const zone   = document.getElementById('maint-drop-zone');
    const input  = document.getElementById('maint-file-input');
    const nameEl = document.getElementById('maint-file-name');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) _setDropFile(file, input, nameEl);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) _setDropFile(input.files[0], input, nameEl);
    });
  }

  function _setDropFile(file, input, nameEl) {
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

    _bindDropZone();

    const drawerEl = document.getElementById('maint-drawer');
    if (drawerEl) drawerEl.addEventListener('click', e => e.stopPropagation());
  }

  return {
    init,
    refresh: renderChart,
    openMaintDrawer,
    closeMaintDrawer,
    reloadFromUpload: async function () { await loadData(); renderChart(); },
  };
})();

// Глобальные обёртки для HTML onclick
function openMaintDrawer()  { PotholeMaintenance.openMaintDrawer(); }
function closeMaintDrawer() { PotholeMaintenance.closeMaintDrawer(); }
