/* ============================================================
   editor.js — инлайн-редактор + запись в localStorage БД
   ============================================================ */
window.editor = (() => {

  /* ── Конфигурация колонок ───────────────────────────────── */
  const COLS = {
    objects: [
      { key: 'omsu',           label: 'ОМСУ',            type: 'text',   width: '130px' },
      { key: 'object',         label: 'Объект',           type: 'text',   width: '240px', cls: 'col-name' },
      { key: 'contractor',     label: 'Подрядчик',        type: 'text',   width: '140px' },
      { key: 'readinessNow',   label: 'Готовность %',     type: 'number', width: '110px', pct: true },
      { key: 'readinessMay22', label: 'Готовность пред.', type: 'number', width: '110px', pct: true },
      { key: 'workers',        label: 'Рабочих',          type: 'number', width: '90px'  },
      { key: 'machines',       label: 'Техника',          type: 'number', width: '90px'  },
      { key: 'limit2026',      label: 'Лимит 2026',       type: 'number', width: '120px' },
      { key: 'finishPlan',     label: 'Срок ввода',       type: 'text',   width: '110px' },
      { key: 'financeSource',  label: 'Финансирование',   type: 'text',   width: '120px' },
    ],
    contracts: [
      { key: 'contractNo',       label: '№ контракта', type: 'text',   width: '120px' },
      { key: 'project',          label: 'Проект',      type: 'text',   width: '240px', cls: 'col-name' },
      { key: 'contractor',       label: 'Подрядчик',   type: 'text',   width: '140px' },
      { key: 'workType',         label: 'Тип работ',   type: 'select', width: '110px', options: ['СМР', 'СМР+ПИР', 'ПИР'] },
      { key: 'contractValue',    label: 'Сумма ГК',    type: 'number', width: '120px' },
      { key: 'paidTotal',        label: 'Оплачено',    type: 'number', width: '120px' },
      { key: 'doneTotal',        label: 'Выполнено',    type: 'number', width: '120px' },
      { key: 'donePct',          label: '% вып.',      type: 'number', width: '90px',  pct: true },
      { key: 'limit2026',        label: 'Лимит 2026',  type: 'number', width: '120px' },
      { key: 'finishPlan',       label: 'Срок ввода',  type: 'text',   width: '90px'  },
      { key: 'contractDeadline', label: 'Срок ГК',    type: 'text',   width: '110px' },
    ],
    svod: [
      { key: 'contractor',         label: 'Подрядчик',        type: 'text',   width: '180px' },
      { key: 'contractsTotal',     label: 'Контракты',         type: 'number', width: '100px' },
      { key: 'contractSum',        label: 'Сумма ГК',          type: 'number', width: '130px' },
      { key: 'paidTotal',          label: 'Оплачено',          type: 'number', width: '130px' },
      { key: 'doneTotal',          label: 'Выполнено',          type: 'number', width: '130px' },
      { key: 'advanceOutstanding', label: 'Неотраб. аванс',    type: 'number', width: '130px' },
      { key: 'limit2026',          label: 'Лимит 2026',        type: 'number', width: '120px' },
      { key: 'limit2027',          label: 'Лимит 2027',        type: 'number', width: '120px' },
    ],
  };

  /* ── Внутреннее состояние ────────────────────────────────── */
  let activeSection = 'objects';
  let dirtyMap      = {};
  let editedData    = {};
  let activeCell    = null;

  /* ── Инициализация рабочей копии ────────────────────────── */
  function initEditedData() {
    // Берём актуальные данные из rawData
    // (rawData уже содержит правки Из БД, наложенные при старте)
    const raw = window.dashboardState.rawData || {};
    editedData = {
      objects:   (raw.objects   || []).map(r => ({ ...r })),
      contracts: (raw.contracts || []).map(r => ({ ...r })),
      svod:      (raw.svod      || []).map(r => ({ ...r })),
    };
    dirtyMap = {};
  }

  /* ── Форматирование ячейки ───────────────────────────────── */
  function displayVal(col, row) {
    const v = row[col.key];
    if (v == null || v === '') return '—';
    if (col.pct) {
      const n = Number(v);
      return (n <= 1 ? n * 100 : n).toFixed(1).replace('.', ',') + '%';
    }
    if (col.type === 'number') {
      const n = Number(v);
      if (isNaN(n)) return v;
      if (Math.abs(n) >= 1000) return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
      return String(v);
    }
    return String(v);
  }

  /* ── Открытие ячейки ────────────────────────────────────── */
  function openCell(td, col, rowIdx) {
    if (activeCell) commitCell(activeCell);
    const row = editedData[activeSection][rowIdx];
    const rawVal = row[col.key];
    const displayValue = (col.pct && rawVal != null)
      ? (Number(rawVal) <= 1 ? (Number(rawVal) * 100).toFixed(2) : String(rawVal))
      : (rawVal != null ? String(rawVal) : '');

    td.classList.add('cell-editing');

    let input;
    if (col.type === 'select') {
      input = document.createElement('select');
      input.className = 'cell-input';
      col.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = o.textContent = opt;
        if (opt === rawVal) o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.className = 'cell-input';
      input.type  = col.type === 'number' ? 'number' : 'text';
      input.value = displayValue;
      if (col.type === 'number') input.step = 'any';
    }

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    activeCell = { td, input, col, rowIdx };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { commitCell(activeCell); activeCell = null; }
      if (e.key === 'Escape') { cancelCell(activeCell); activeCell = null; }
      if (e.key === 'Tab') {
        e.preventDefault();
        commitCell(activeCell); activeCell = null;
        const cells = [...td.closest('tbody').querySelectorAll('td[data-col]')];
        const next  = cells[cells.indexOf(td) + (e.shiftKey ? -1 : 1)];
        if (next) next.click();
      }
    });
    input.addEventListener('blur', () => {
      if (activeCell && activeCell.td === td) { commitCell(activeCell); activeCell = null; }
    });
  }

  /* ── Применение изменения ячейки ───────────────────────────── */
  function commitCell({ td, input, col, rowIdx }) {
    let newVal = input.value.trim();
    const row  = editedData[activeSection][rowIdx];
    const orig = window.dashboardState.rawData?.[activeSection]?.[rowIdx]?.[col.key];

    if (col.type === 'number' && newVal !== '') {
      let n = parseFloat(newVal.replace(',', '.'));
      if (col.pct) n = n > 1 ? n / 100 : n;
      newVal = isNaN(n) ? '' : n;
    }

    row[col.key] = newVal;
    const dirty = JSON.stringify(newVal) !== JSON.stringify(orig);
    const dk    = `${activeSection}:${rowIdx}:${col.key}`;
    if (dirty) dirtyMap[dk] = true; else delete dirtyMap[dk];

    td.classList.remove('cell-editing');
    td.classList.toggle('cell-dirty', dirty);
    td.innerHTML = displayVal(col, row);
    updateToolbar();
  }

  function cancelCell({ td, col, rowIdx }) {
    td.classList.remove('cell-editing');
    td.innerHTML = displayVal(col, editedData[activeSection][rowIdx]);
  }

  /* ── Тулбар ──────────────────────────────────────────────────── */
  function updateToolbar() {
    const count   = Object.keys(dirtyMap).length;
    const badge   = document.getElementById('editorDirtyBadge');
    const saveBtn = document.getElementById('editorSaveBtn');
    const resetBtn= document.getElementById('editorResetBtn');
    if (!badge) return;
    badge.textContent    = count > 0 ? `${count} изм.` : '';
    badge.style.display  = count > 0 ? 'inline-flex' : 'none';
    saveBtn.disabled     = count === 0;
    resetBtn.disabled    = count === 0;
  }

  /* ── Рендер таблицы ────────────────────────────────────────────── */
  function renderTable() {
    const cols = COLS[activeSection];
    const rows = editedData[activeSection] || [];
    const wrap = document.getElementById('editorTableWrap');
    const q    = (document.getElementById('editorSearch')?.value || '').toLowerCase();

    const visible = q
      ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)))
      : rows;

    const head = cols.map(c =>
      `<th style="min-width:${c.width};max-width:${c.width}">${c.label}</th>`
    ).join('');

    const body = visible.map(row => {
      const rowIdx    = rows.indexOf(row);
      const rowDirty  = Object.keys(dirtyMap).some(k => k.startsWith(`${activeSection}:${rowIdx}:`));
      const cells = cols.map((col, cIdx) => {
        const dk    = `${activeSection}:${rowIdx}:${col.key}`;
        const dirty = !!dirtyMap[dk];
        const cls   = [col.cls, dirty ? 'cell-dirty' : ''].filter(Boolean).join(' ');
        return `<td class="${cls}" data-col="${cIdx}" data-row="${rowIdx}"
                    style="min-width:${col.width};max-width:${col.width}"
                    title="Нажмите для редактирования">${displayVal(col, row)}</td>`;
      }).join('');
      return `<tr class="${rowDirty ? 'row-dirty' : ''}">${cells}</tr>`;
    }).join('') || `<tr><td colspan="${cols.length + 1}" class="empty-state">Нет данных</td></tr>`;

    wrap.innerHTML = `
      <table class="data-table editor-table">
        <thead><tr><th style="width:36px">#</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>`;

    wrap.querySelectorAll('tbody tr').forEach((tr, i) => {
      const numTd = document.createElement('td');
      numTd.textContent = i + 1;
      numTd.className   = 'row-num';
      tr.prepend(numTd);
    });

    wrap.querySelectorAll('td[data-col]').forEach(td => {
      td.addEventListener('click', () => {
        openCell(td, cols[parseInt(td.dataset.col)], parseInt(td.dataset.row));
      });
    });

    updateToolbar();
  }

  /* ── ❤️ ГЛАВНОЕ: СОХРАНИТЬ в БД и перестроить дашборд ──────────── */
  function saveAll() {
    // 1. Апплицируем editedData → rawData (в память)
    const raw = window.dashboardState.rawData;
    editedData.objects.forEach((r, i)   => { if (raw.objects[i])   Object.assign(raw.objects[i],   r); });
    editedData.contracts.forEach((r, i) => { if (raw.contracts[i]) Object.assign(raw.contracts[i], r); });
    editedData.svod.forEach((r, i)      => { if (raw.svod[i])      Object.assign(raw.svod[i],      r); });

    // 2. Записываем в localStorage БД
    const ok = window.db.save({
      objects:   raw.objects,
      contracts: raw.contracts,
      svod:      raw.svod,
    });

    if (!ok) {
      showToast('⚠️ Ошибка записи в БД (возможно переполнен localhost)', 'error');
      return;
    }

    // 3. Очищаем пометки изменений
    dirtyMap = {};
    updateToolbar();
    renderTable();

    // 4. Перестраиваем все вкладки дашборда
    window.renderers.renderAll();

    // 5. Обновляем индикатор БД в сайдбаре
    window.app._renderDbStatus();

    showToast('✅ Сохранено в БД · дашборд обновлён', 'success');
  }

  /* ── Сброс изменений в редакторе (БД НЕ трогается) ──────────────── */
  function resetAll() {
    if (!confirm(`Сбросить ${Object.keys(dirtyMap).length} несохранённых изменений?`)) return;
    initEditedData();
    renderTable();
    showToast('↩️ Несохранённые изменения сброшены', 'warning');
  }

  /* ── Экспорт JSON (выгрузить файл для обновления dashboard-data.json) ───── */
  function exportJSON() {
    window.db.exportToFile();
    showToast('⬇️ Файл скачан. Замените data/dashboard-data.json им чтобы фиксировать навсегда.', 'success');
  }

  /* ── Toast ───────────────────────────────────────────────────── */
  function showToast(msg, type = 'success') {
    let toaster = document.getElementById('editorToaster');
    if (!toaster) {
      toaster = document.createElement('div');
      toaster.id = 'editorToaster';
      document.body.appendChild(toaster);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    toaster.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 350); }, 3500);
  }

  /* ── Рендер вкладки ─────────────────────────────────────────── */
  function render() {
    if (Object.keys(editedData).length === 0) initEditedData();

    const root  = document.getElementById('tab-editor');
    const count = sec => (editedData[sec] || []).length;
    const dbM   = window.db.meta();
    const dbHint = dbM
      ? `<span style="color:var(--color-success);font-size:11px"><i class="ri-database-2-line"></i> БД: сохранено ${new Date(dbM.savedAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>`
      : `<span style="color:var(--color-text-muted);font-size:11px"><i class="ri-database-line"></i> БД пуста (будет заполнена при сохранении)</span>`;

    root.innerHTML = `
      <div class="editor-toolbar card elevated">
        <div class="editor-tabs">
          <button class="etab ${activeSection === 'objects'   ? 'active' : ''}" data-sec="objects">
            <i class="ri-building-2-line"></i> Объекты
            <span class="etab-badge">${count('objects')}</span>
          </button>
          <button class="etab ${activeSection === 'contracts' ? 'active' : ''}" data-sec="contracts">
            <i class="ri-file-list-3-line"></i> Контракты
            <span class="etab-badge">${count('contracts')}</span>
          </button>
          <button class="etab ${activeSection === 'svod'      ? 'active' : ''}" data-sec="svod">
            <i class="ri-group-line"></i> Подрядчики
            <span class="etab-badge">${count('svod')}</span>
          </button>
        </div>
        <div class="editor-actions">
          ${dbHint}
          <span id="editorDirtyBadge" class="dirty-badge" style="display:none">0 изм.</span>
          <input id="editorSearch" class="editor-search" type="search" placeholder="🔍 Поиск по таблице…" />
          <button class="ghost-btn" id="editorResetBtn" disabled title="Сбросить несохранённые изменения">
            <i class="ri-arrow-go-back-line"></i> Сбросить
          </button>
          <button class="primary-btn" id="editorSaveBtn" disabled title="Сохранить в БД и обновить дашборд">
            <i class="ri-save-line"></i> Сохранить в БД
          </button>
          <button class="ghost-btn" id="editorExportBtn" title="Скачать JSON для замены dashboard-data.json">
            <i class="ri-download-2-line"></i> JSON
          </button>
        </div>
      </div>

      <div class="editor-hint">
        <i class="ri-information-line"></i>
        <span>Нажмите на ячейку для редактирования.
          <kbd>Enter</kbd> — подтвердить,
          <kbd>Esc</kbd> — отмена,
          <kbd>Tab</kbd> — следующая ячейка.
          Изменённые ячейки выделены <span style="color:var(--color-warning)">оранжевым</span>.
          <strong>Нажмите «Сохранить в БД» — данные сохранятся навсегда, даже после перезагрузки.</strong>
        </span>
      </div>

      <article class="card section-stack editor-card">
        <div class="table-wrap editor-table-wrap" id="editorTableWrap"></div>
      </article>`;

    renderTable();

    root.querySelectorAll('.etab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (activeCell) { commitCell(activeCell); activeCell = null; }
        activeSection = btn.dataset.sec;
        render();
      });
    });

    document.getElementById('editorSearch').addEventListener('input',  () => renderTable());
    document.getElementById('editorSaveBtn').addEventListener('click',  saveAll);
    document.getElementById('editorResetBtn').addEventListener('click', resetAll);
    document.getElementById('editorExportBtn').addEventListener('click', exportJSON);
  }

  /* ── Добавить строку ────────────────────────────────────────────── */
  function addRow() {
    const cols  = COLS[activeSection];
    const blank = {};
    cols.forEach(c => { blank[c.key] = ''; });
    editedData[activeSection].push(blank);
    renderTable();
    const wrap = document.getElementById('editorTableWrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    showToast('➕ Строка добавлена. Заполните и нажмите «Сохранить в БД»', 'success');
  }

  return { render, initEditedData, addRow };
})();
