/* ============================================================
   input.js — Модуль ввода и редактирования данных
   Полноценная таблица-редактор (inline) для contracts / svod / objects
   Данные сохраняются в localStorage через window.db.save()
   ============================================================ */

window.inputEditor = (() => {

  /* ── Схема полей контракта ─────────────────────────────────────── */
  const CONTRACT_FIELDS = [
    { key: 'project',              label: 'Объект/Проект',        type: 'text',   required: true,  width: 260 },
    { key: 'contractor',           label: 'Подрядчик',            type: 'text',   required: true,  width: 130 },
    { key: 'contractNo',           label: '№ контракта',          type: 'text',   required: true,  width: 120 },
    { key: 'workType',             label: 'Тип работ',            type: 'select', required: true,  width: 110,
      options: ['СМР', 'СМР+ПИР', 'ПИР'] },
    { key: 'contractValue',        label: 'Сумма контракта, т.р.',type: 'number', required: true,  width: 130 },
    { key: 'advancePlan',          label: 'Аванс план, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'advancePct',           label: 'Аванс план, %',        type: 'pct',    required: false, width: 100 },
    { key: 'advanceIssued',        label: 'Аванс выдан, т.р.',    type: 'number', required: false, width: 120 },
    { key: 'advanceOutstanding',   label: 'Аванс остаток, т.р.',  type: 'number', required: false, width: 120 },
    { key: 'paidTotal',            label: 'Оплачено всего, т.р.', type: 'number', required: false, width: 130 },
    { key: 'paidPct',              label: 'Оплачено, %',          type: 'pct',    required: false, width: 100 },
    { key: 'doneTotal',            label: 'Выполнено, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'donePct',              label: 'Выполнено, %',         type: 'pct',    required: false, width: 100 },
    { key: 'done2025',             label: 'Выполнено 2025, т.р.', type: 'number', required: false, width: 130 },
    { key: 'paid2025',             label: 'Оплачено 2025, т.р.',  type: 'number', required: false, width: 130 },
    { key: 'limit2026',            label: 'Лимит 2026, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'paid2026',             label: 'Оплачено 2026, т.р.',  type: 'number', required: false, width: 130 },
    { key: 'advance2026',          label: 'Аванс 2026, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'balance2026',          label: 'Баланс 2026, т.р.',    type: 'number', required: false, width: 120 },
    { key: 'limit2027',            label: 'Лимит 2027, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'limit2028',            label: 'Лимит 2028, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'limit2029',            label: 'Лимит 2029, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'ppt',                  label: 'ППТ',                  type: 'text',   required: false, width: 80  },
    { key: 'finishPlan',           label: 'Срок завершения',      type: 'text',   required: false, width: 120 },
    { key: 'contractDeadline',     label: 'Срок по договору',     type: 'date',   required: false, width: 130 },
    { key: 'withdrawalPct',        label: 'Возврат аванса, %',    type: 'pct',    required: false, width: 120 },
    { key: 'sgPct',                label: 'СГ, т.р.',             type: 'number', required: false, width: 110 },
  ];

  const SVOD_FIELDS = [
    { key: 'contractor',           label: 'Подрядчик',            type: 'text',   required: true,  width: 160 },
    { key: 'contractsTotal',       label: 'Кол-во контрактов',    type: 'number', required: false, width: 130 },
    { key: 'contractSum',          label: 'Сумма контрактов, т.р.',type:'number', required: false, width: 140 },
    { key: 'advancePlan',          label: 'Аванс план, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'advancePlanPct',       label: 'Аванс план, %',        type: 'pct',    required: false, width: 110 },
    { key: 'advanceIssued',        label: 'Аванс выдан, т.р.',    type: 'number', required: false, width: 120 },
    { key: 'advanceIssuedPct',     label: 'Аванс выдан, %',       type: 'pct',    required: false, width: 110 },
    { key: 'advanceOutstanding',   label: 'Аванс остаток, т.р.',  type: 'number', required: false, width: 130 },
    { key: 'advanceOutstandingPct',label: 'Аванс остаток, %',     type: 'pct',    required: false, width: 120 },
    { key: 'paidTotal',            label: 'Оплачено всего, т.р.', type: 'number', required: false, width: 130 },
    { key: 'paidPct',              label: 'Оплачено, %',          type: 'pct',    required: false, width: 100 },
    { key: 'doneTotal',            label: 'Выполнено, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'donePct',              label: 'Выполнено, %',         type: 'pct',    required: false, width: 100 },
    { key: 'limit2026',            label: 'Лимит 2026, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'limit2027',            label: 'Лимит 2027, т.р.',     type: 'number', required: false, width: 120 },
  ];

  const OBJECT_FIELDS = [
    { key: 'object',        label: 'Объект',               type: 'text',   required: true,  width: 260 },
    { key: 'omsu',          label: 'ОМСУ / Район',         type: 'text',   required: false, width: 160 },
    { key: 'contractor',    label: 'Подрядчик',            type: 'text',   required: false, width: 140 },
    { key: 'financeSource', label: 'Источник финансирования',type:'text',  required: false, width: 160 },
    { key: 'readinessNow',  label: 'Готовность тек., %',   type: 'pct',    required: false, width: 120 },
    { key: 'readinessMay22',label: 'Готовность пред., %',  type: 'pct',    required: false, width: 130 },
    { key: 'weekDelta',     label: 'Δ за неделю, %',       type: 'pct',    required: false, width: 110 },
    { key: 'workers',       label: 'Рабочих, чел.',        type: 'number', required: false, width: 110 },
    { key: 'machines',      label: 'Машин, ед.',           type: 'number', required: false, width: 100 },
    { key: 'limit2026',     label: 'Лимит 2026, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'finishPlan',    label: 'Срок завершения',      type: 'text',   required: false, width: 130 },
  ];

  const TABS = [
    { id: 'contracts', label: 'Контракты',   fields: CONTRACT_FIELDS, dataKey: 'contracts' },
    { id: 'svod',      label: 'Подрядчики',  fields: SVOD_FIELDS,     dataKey: 'svod'      },
    { id: 'objects',   label: 'Объекты',     fields: OBJECT_FIELDS,   dataKey: 'objects'   },
  ];

  let activeTab = 'contracts';
  let editingCell = null;   // { row, key, el }
  let searchQuery = '';
  let changesCount = 0;

  /* ── Получить текущие данные секции ──────────────────────── */
  function getData(dataKey) {
    const raw = window.dashboardState?.rawData || {};
    return JSON.parse(JSON.stringify(raw[dataKey] || []));
  }

  function setData(dataKey, arr) {
    if (!window.dashboardState) return;
    window.dashboardState.rawData[dataKey] = arr;
    // Сохраняем все три секции в БД
    window.db.save({
      contracts: window.dashboardState.rawData.contracts || [],
      svod:      window.dashboardState.rawData.svod      || [],
      objects:   window.dashboardState.rawData.objects   || [],
    });
    changesCount++;
    window.app._renderDbStatus();
    window.app.populateFilters(true);
  }

  /* ── Форматирование значений для отображения ─────────────── */
  function fmt(val, type) {
    if (val === null || val === undefined || val === '') return '';
    if (type === 'pct') return (val * 100).toFixed(1) + '%';
    if (type === 'number') {
      const n = Number(val);
      if (isNaN(n)) return val;
      return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    }
    return val;
  }

  /* ── Парсинг ввода ────────────────────────────────────────── */
  function parseVal(str, type) {
    if (str === '' || str === null || str === undefined) return null;
    if (type === 'pct') {
      const clean = str.replace(',', '.').replace('%', '').trim();
      const n = parseFloat(clean);
      if (isNaN(n)) return null;
      return n > 1 ? n / 100 : n;  // автоопределение: 42 → 0.42, 0.42 → 0.42
    }
    if (type === 'number') {
      const clean = str.replace(/\s/g, '').replace(',', '.');
      const n = parseFloat(clean);
      return isNaN(n) ? null : n;
    }
    return str;
  }

  /* ── Создать пустую строку ────────────────────────────────── */
  function emptyRow(fields) {
    const r = {};
    fields.forEach(f => r[f.key] = null);
    return r;
  }

  /* ── Поиск (фильтрация строк) ─────────────────────────────── */
  function filterRows(rows, fields) {
    if (!searchQuery) return rows.map((r, i) => ({ row: r, idx: i }));
    const q = searchQuery.toLowerCase();
    return rows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) =>
        fields.some(f => {
          const v = row[f.key];
          return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
        })
      );
  }

  /* ── Рендер основного контента ────────────────────────────── */
  function render() {
    const container = document.getElementById('tab-input');
    if (!container) return;

    const tabMeta = TABS.find(t => t.id === activeTab);
    const rows    = getData(tabMeta.dataKey);
    const filtered = filterRows(rows, tabMeta.fields);

    container.innerHTML = `
      <div class="input-editor-wrap">
        <!-- Шапка -->
        <div class="ie-header">
          <div class="ie-title-row">
            <h2 class="ie-title"><i class="ri-table-line"></i> Ввод и редактирование данных</h2>
            <div class="ie-actions">
              <button class="ie-btn ie-btn--ghost" id="ie-export-json" title="Экспортировать в JSON">
                <i class="ri-download-2-line"></i> Экспорт JSON
              </button>
              <button class="ie-btn ie-btn--ghost" id="ie-export-csv" title="Экспортировать в CSV">
                <i class="ri-file-excel-line"></i> Экспорт CSV
              </button>
              <button class="ie-btn ie-btn--danger" id="ie-clear-section" title="Очистить секцию">
                <i class="ri-delete-bin-line"></i> Очистить
              </button>
            </div>
          </div>

          <!-- Вкладки секций -->
          <div class="ie-tabs">
            ${TABS.map(t => `
              <button class="ie-tab ${t.id === activeTab ? 'active' : ''}" data-section="${t.id}">
                ${t.id === 'contracts' ? '<i class="ri-file-list-3-line"></i>' : ''}
                ${t.id === 'svod'      ? '<i class="ri-group-line"></i>'       : ''}
                ${t.id === 'objects'   ? '<i class="ri-building-2-line"></i>'  : ''}
                ${t.label}
                <span class="ie-tab-count">${getData(t.dataKey).length}</span>
              </button>
            `).join('')}
          </div>

          <!-- Поиск + кнопка добавить -->
          <div class="ie-toolbar">
            <div class="ie-search-wrap">
              <i class="ri-search-line"></i>
              <input class="ie-search" id="ie-search" type="search"
                placeholder="Поиск по таблице…" value="${searchQuery}" />
            </div>
            <span class="ie-count-info">
              ${filtered.length} из ${rows.length} записей
            </span>
            <button class="ie-btn ie-btn--primary" id="ie-add-row">
              <i class="ri-add-line"></i> Добавить строку
            </button>
          </div>
        </div>

        <!-- Таблица -->
        <div class="ie-table-scroll">
          <table class="ie-table" id="ie-table">
            <thead>
              <tr>
                <th class="ie-th ie-th--num">#</th>
                ${tabMeta.fields.map(f => `
                  <th class="ie-th" style="min-width:${f.width}px">
                    ${f.label}${f.required ? '<span class="ie-req">*</span>' : ''}
                  </th>
                `).join('')}
                <th class="ie-th ie-th--actions">Действия</th>
              </tr>
            </thead>
            <tbody id="ie-tbody">
              ${filtered.length === 0 ? `
                <tr><td colspan="${tabMeta.fields.length + 2}" class="ie-empty">
                  <i class="ri-inbox-line"></i>
                  <span>Нет данных. Нажмите «Добавить строку» чтобы начать ввод.</span>
                </td></tr>
              ` : filtered.map(({ row, idx }) => renderRow(row, idx, tabMeta.fields)).join('')}
            </tbody>
          </table>
        </div>

        <!-- Подвал -->
        <div class="ie-footer">
          <span class="ie-hint"><i class="ri-information-line"></i> Кликните на ячейку для редактирования · Enter или Tab — следующая ячейка · Esc — отмена</span>
          <div class="ie-footer-actions">
            <button class="ie-btn ie-btn--success" id="ie-save-all">
              <i class="ri-save-line"></i> Сохранить все
            </button>
          </div>
        </div>
      </div>
    `;

    bindEvents(tabMeta, rows, filtered);
  }

  /* ── Рендер одной строки ──────────────────────────────────── */
  function renderRow(row, idx, fields) {
    return `
      <tr class="ie-row" data-idx="${idx}" data-new="${row.__new ? 'true' : 'false'}">
        <td class="ie-td ie-td--num">${idx + 1}</td>
        ${fields.map(f => {
          const val = row[f.key];
          const display = fmt(val, f.type);
          const isEmpty = val === null || val === undefined || val === '';
          return `
            <td class="ie-td ${isEmpty ? 'ie-td--empty' : ''} ${f.required && isEmpty ? 'ie-td--required' : ''}"
                data-idx="${idx}" data-key="${f.key}" data-type="${f.type}"
                title="${isEmpty ? f.label : display}">
              <span class="ie-cell-val">${display || '<span class="ie-placeholder">—</span>'}</span>
            </td>
          `;
        }).join('')}
        <td class="ie-td ie-td--actions">
          <button class="ie-row-btn ie-row-btn--del" data-idx="${idx}" title="Удалить строку">
            <i class="ri-delete-bin-2-line"></i>
          </button>
          <button class="ie-row-btn ie-row-btn--dup" data-idx="${idx}" title="Дублировать строку">
            <i class="ri-file-copy-line"></i>
          </button>
        </td>
      </tr>
    `;
  }

  /* ── Inline редактирование ────────────────────────────────── */
  function startEdit(td, row, key, type, fields, dataKey) {
    if (editingCell) commitEdit(fields, dataKey);

    const val = row[key];
    let inputEl;

    if (type === 'select') {
      const field = fields.find(f => f.key === key);
      inputEl = document.createElement('select');
      inputEl.className = 'ie-cell-input';
      (field.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === val) o.selected = true;
        inputEl.appendChild(o);
      });
    } else if (type === 'date') {
      inputEl = document.createElement('input');
      inputEl.type = 'date';
      inputEl.className = 'ie-cell-input';
      inputEl.value = val || '';
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.className = 'ie-cell-input';
      // Для процентов показываем удобный формат
      if (type === 'pct' && val !== null && val !== undefined) {
        inputEl.value = (val * 100).toFixed(2);
        inputEl.title = 'Введите в % (например: 42.5)';
      } else {
        inputEl.value = val !== null && val !== undefined ? val : '';
      }
    }

    td.innerHTML = '';
    td.appendChild(inputEl);
    inputEl.focus();
    if (inputEl.select) inputEl.select();

    editingCell = { td, key, type, row };

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitEdit(fields, dataKey);
        // Переход к следующей ячейке
        const nextKey = nextEditableKey(fields, key, e.shiftKey);
        if (nextKey) {
          const nextTd = document.querySelector(
            `td[data-idx="${row.__idx}"][data-key="${nextKey}"]`
          );
          if (nextTd) nextTd.click();
        }
      }
      if (e.key === 'Escape') {
        cancelEdit(fields, dataKey, row);
      }
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(() => {
        if (editingCell) commitEdit(fields, dataKey);
      }, 100);
    });
  }

  function nextEditableKey(fields, currentKey, reverse) {
    const keys = fields.map(f => f.key);
    const idx  = keys.indexOf(currentKey);
    if (reverse) return idx > 0 ? keys[idx - 1] : null;
    return idx < keys.length - 1 ? keys[idx + 1] : null;
  }

  function commitEdit(fields, dataKey) {
    if (!editingCell) return;
    const { td, key, type, row } = editingCell;
    const input = td.querySelector('input, select');
    if (!input) { editingCell = null; return; }

    const raw    = getData(dataKey);
    const parsed = parseVal(input.value, type);
    raw[row.__idx][key] = parsed;
    setData(dataKey, raw);
    editingCell = null;

    // Обновить только эту ячейку без полного ре-рендера
    const field = fields.find(f => f.key === key);
    const display = fmt(parsed, type);
    const isEmpty = parsed === null;
    td.className = `ie-td ${isEmpty ? 'ie-td--empty' : ''} ${field.required && isEmpty ? 'ie-td--required' : ''}`;
    td.setAttribute('data-type', type);
    td.innerHTML = `<span class="ie-cell-val">${display || '<span class="ie-placeholder">—</span>'}</span>`;
  }

  function cancelEdit(fields, dataKey, row) {
    if (!editingCell) return;
    const { td, key, type } = editingCell;
    const raw = getData(dataKey);
    const val = raw[row.__idx]?.[key];
    const display = fmt(val, type);
    const isEmpty = val === null || val === undefined;
    const field = fields.find(f => f.key === key);
    td.className = `ie-td ${isEmpty ? 'ie-td--empty' : ''} ${field?.required && isEmpty ? 'ie-td--required' : ''}`;
    td.innerHTML = `<span class="ie-cell-val">${display || '<span class="ie-placeholder">—</span>'}</span>`;
    editingCell = null;
  }

  /* ── Привязка событий ─────────────────────────────────────── */
  function bindEvents(tabMeta, rows, filtered) {
    const { fields, dataKey } = tabMeta;

    // Клик по ячейке — начать редактирование
    document.getElementById('ie-tbody')?.addEventListener('click', e => {
      const td = e.target.closest('td[data-key]');
      if (!td) return;
      const idx  = parseInt(td.dataset.idx);
      const key  = td.dataset.key;
      const type = td.dataset.type;
      const rawRows = getData(dataKey);
      const row = { ...rawRows[idx], __idx: idx };
      startEdit(td, row, key, type, fields, dataKey);
    });

    // Удалить строку
    document.getElementById('ie-tbody')?.addEventListener('click', e => {
      const btn = e.target.closest('.ie-row-btn--del');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      if (!confirm(`Удалить строку ${idx + 1}?`)) return;
      const raw = getData(dataKey);
      raw.splice(idx, 1);
      setData(dataKey, raw);
      render();
    });

    // Дублировать строку
    document.getElementById('ie-tbody')?.addEventListener('click', e => {
      const btn = e.target.closest('.ie-row-btn--dup');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      const raw = getData(dataKey);
      const copy = { ...raw[idx], __new: true };
      raw.splice(idx + 1, 0, copy);
      setData(dataKey, raw);
      render();
    });

    // Добавить строку
    document.getElementById('ie-add-row')?.addEventListener('click', () => {
      if (editingCell) commitEdit(fields, dataKey);
      const raw = getData(dataKey);
      raw.push(emptyRow(fields));
      setData(dataKey, raw);
      render();
      // Скролл вниз и фокус на первой ячейке новой строки
      requestAnimationFrame(() => {
        const wrap = document.querySelector('.ie-table-scroll');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
        const lastRow = document.querySelector('#ie-tbody tr:last-child');
        const firstTd = lastRow?.querySelector('td[data-key]');
        if (firstTd) firstTd.click();
      });
    });

    // Поиск
    document.getElementById('ie-search')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });

    // Переключение вкладок секций
    document.querySelectorAll('.ie-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (editingCell) commitEdit(fields, dataKey);
        activeTab = btn.dataset.section;
        searchQuery = '';
        render();
      });
    });

    // Сохранить все (явная кнопка)
    document.getElementById('ie-save-all')?.addEventListener('click', () => {
      if (editingCell) commitEdit(fields, dataKey);
      window.db.save({
        contracts: window.dashboardState.rawData.contracts || [],
        svod:      window.dashboardState.rawData.svod      || [],
        objects:   window.dashboardState.rawData.objects   || [],
      });
      window.app._renderDbStatus();
      window.app.refresh();
      showToast('Данные сохранены в базу данных ✓', 'success');
    });

    // Экспорт JSON
    document.getElementById('ie-export-json')?.addEventListener('click', () => {
      window.db.exportToFile();
    });

    // Экспорт CSV
    document.getElementById('ie-export-csv')?.addEventListener('click', () => {
      exportCSV(tabMeta, getData(dataKey));
    });

    // Очистить секцию
    document.getElementById('ie-clear-section')?.addEventListener('click', () => {
      if (!confirm(`Очистить все записи секции «${tabMeta.label}»? Это действие нельзя отменить.`)) return;
      setData(dataKey, []);
      render();
      showToast(`Секция «${tabMeta.label}» очищена`, 'warning');
    });
  }

  /* ── CSV экспорт ─────────────────────────────────────────── */
  function exportCSV(tabMeta, rows) {
    const { fields } = tabMeta;
    const header = fields.map(f => `"${f.label}"`).join(';');
    const body = rows.map(row =>
      fields.map(f => {
        const v = row[f.key];
        if (v === null || v === undefined) return '';
        if (f.type === 'pct') return (v * 100).toFixed(2);
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(';')
    ).join('\n');
    const csv  = '\uFEFF' + header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${tabMeta.id}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('CSV экспортирован ✓', 'success');
  }

  /* ── Toast-уведомления ───────────────────────────────────── */
  function showToast(msg, type = 'info') {
    let wrap = document.getElementById('ie-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ie-toast-wrap';
      wrap.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
      document.body.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = `ie-toast ie-toast--${type}`;
    toast.innerHTML = `<i class="ri-${type === 'success' ? 'checkbox-circle' : type === 'warning' ? 'alert' : 'information'}-line"></i> ${msg}`;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  /* ── Публичный API ───────────────────────────────────────── */
  return {
    render,
    showToast,
    get activeTab() { return activeTab; },
  };

})();
