/* ============================================================
   input.js — Модуль ввода и редактирования данных
   Inline-редактор таблиц: contracts / svod / objects
   Сохранение в localStorage через window.db.save()
   ============================================================ */

window.inputEditor = (() => {

  /* ── Схема полей ─────────────────────────────────────────── */
  const CONTRACT_FIELDS = [
    { key: 'project',            label: 'Объект / Проект',       type: 'text',   required: true,  width: 260 },
    { key: 'contractor',         label: 'Подрядчик',             type: 'text',   required: true,  width: 130 },
    { key: 'contractNo',         label: '№ контракта',           type: 'text',   required: true,  width: 120 },
    { key: 'workType',           label: 'Тип работ',             type: 'select', required: true,  width: 110,
      options: ['СМР', 'СМР+ПИР', 'ПИР'] },
    { key: 'contractValue',      label: 'Сумма контракта, т.р.', type: 'number', required: true,  width: 140 },
    { key: 'advancePlan',        label: 'Аванс план, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'advancePct',         label: 'Аванс план, %',         type: 'pct',    required: false, width: 100 },
    { key: 'advanceIssued',      label: 'Аванс выдан, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'advanceOutstanding', label: 'Аванс остаток, т.р.',   type: 'number', required: false, width: 120 },
    { key: 'paidTotal',          label: 'Оплачено всего, т.р.',  type: 'number', required: false, width: 130 },
    { key: 'paidPct',            label: 'Оплачено, %',           type: 'pct',    required: false, width: 100 },
    { key: 'doneTotal',          label: 'Выполнено, т.р.',       type: 'number', required: false, width: 120 },
    { key: 'donePct',            label: 'Выполнено, %',          type: 'pct',    required: false, width: 100 },
    { key: 'done2025',           label: 'Выполнено 2025, т.р.',  type: 'number', required: false, width: 130 },
    { key: 'paid2025',           label: 'Оплачено 2025, т.р.',   type: 'number', required: false, width: 130 },
    { key: 'limit2026',          label: 'Лимит 2026, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'paid2026',           label: 'Оплачено 2026, т.р.',   type: 'number', required: false, width: 130 },
    { key: 'advance2026',        label: 'Аванс 2026, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'balance2026',        label: 'Баланс 2026, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'limit2027',          label: 'Лимит 2027, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'limit2028',          label: 'Лимит 2028, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'limit2029',          label: 'Лимит 2029, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'ppt',                label: 'ППТ',                   type: 'text',   required: false, width: 80  },
    { key: 'finishPlan',         label: 'Срок завершения',       type: 'text',   required: false, width: 120 },
    { key: 'contractDeadline',   label: 'Срок по договору',      type: 'date',   required: false, width: 130 },
    { key: 'withdrawalPct',      label: 'Возврат аванса, %',     type: 'pct',    required: false, width: 120 },
    { key: 'sgPct',              label: 'СГ, т.р.',              type: 'number', required: false, width: 110 },
  ];

  const SVOD_FIELDS = [
    { key: 'contractor',            label: 'Подрядчик',             type: 'text',   required: true,  width: 160 },
    { key: 'contractsTotal',        label: 'Кол-во контрактов',     type: 'number', required: false, width: 130 },
    { key: 'contractSum',           label: 'Сумма контрактов, т.р.',type: 'number', required: false, width: 140 },
    { key: 'advancePlan',           label: 'Аванс план, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'advancePlanPct',        label: 'Аванс план, %',         type: 'pct',    required: false, width: 110 },
    { key: 'advanceIssued',         label: 'Аванс выдан, т.р.',     type: 'number', required: false, width: 120 },
    { key: 'advanceIssuedPct',      label: 'Аванс выдан, %',        type: 'pct',    required: false, width: 110 },
    { key: 'advanceOutstanding',    label: 'Аванс остаток, т.р.',   type: 'number', required: false, width: 130 },
    { key: 'advanceOutstandingPct', label: 'Аванс остаток, %',      type: 'pct',    required: false, width: 120 },
    { key: 'paidTotal',             label: 'Оплачено всего, т.р.',  type: 'number', required: false, width: 130 },
    { key: 'paidPct',               label: 'Оплачено, %',           type: 'pct',    required: false, width: 100 },
    { key: 'doneTotal',             label: 'Выполнено, т.р.',       type: 'number', required: false, width: 120 },
    { key: 'donePct',               label: 'Выполнено, %',          type: 'pct',    required: false, width: 100 },
    { key: 'limit2026',             label: 'Лимит 2026, т.р.',      type: 'number', required: false, width: 120 },
    { key: 'limit2027',             label: 'Лимит 2027, т.р.',      type: 'number', required: false, width: 120 },
  ];

  const OBJECT_FIELDS = [
    { key: 'object',         label: 'Объект',                        type: 'text',   required: true,  width: 260 },
    { key: 'omsu',           label: 'ОМСУ / Район',                  type: 'text',   required: false, width: 160 },
    { key: 'contractor',     label: 'Подрядчик',                     type: 'text',   required: false, width: 140 },
    { key: 'financeSource',  label: 'Источник финансирования',       type: 'text',   required: false, width: 160 },
    { key: 'readinessNow',   label: 'Готовность тек., %',            type: 'pct',    required: false, width: 120 },
    { key: 'readinessMay22', label: 'Готовность пред., %',           type: 'pct',    required: false, width: 130 },
    { key: 'weekDelta',      label: 'Δ за неделю, %',                type: 'pct',    required: false, width: 110 },
    { key: 'workers',        label: 'Рабочих, чел.',                 type: 'number', required: false, width: 110 },
    { key: 'machines',       label: 'Машин, ед.',                    type: 'number', required: false, width: 100 },
    { key: 'limit2026',      label: 'Лимит 2026, т.р.',              type: 'number', required: false, width: 120 },
    { key: 'finishPlan',     label: 'Срок завершения',               type: 'text',   required: false, width: 130 },
  ];

  const TABS = [
    { id: 'contracts', label: 'Контракты',  icon: 'ri-file-list-3-line', fields: CONTRACT_FIELDS, dataKey: 'contracts' },
    { id: 'svod',      label: 'Подрядчики', icon: 'ri-group-line',        fields: SVOD_FIELDS,     dataKey: 'svod'      },
    { id: 'objects',   label: 'Объекты',    icon: 'ri-building-2-line',   fields: OBJECT_FIELDS,   dataKey: 'objects'   },
  ];

  let activeTab    = 'contracts';
  let editingCell  = null;  // { td, key, type, rowIdx }
  let searchQuery  = '';

  /* ── Данные ──────────────────────────────────────────────── */
  function getData(dataKey) {
    return JSON.parse(JSON.stringify(window.dashboardState?.rawData?.[dataKey] || []));
  }

  function setData(dataKey, arr) {
    if (!window.dashboardState) return;
    window.dashboardState.rawData[dataKey] = arr;
    window.db.save({
      contracts: window.dashboardState.rawData.contracts || [],
      svod:      window.dashboardState.rawData.svod      || [],
      objects:   window.dashboardState.rawData.objects   || [],
    });
    window.app._renderDbStatus();
    window.app.populateFilters(true);
  }

  /* ── Форматирование ──────────────────────────────────────── */
  function fmt(val, type) {
    if (val === null || val === undefined || val === '') return '';
    if (type === 'pct')    return (val * 100).toFixed(1) + '%';
    if (type === 'number') {
      const n = Number(val);
      return isNaN(n) ? String(val) : n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    }
    return String(val);
  }

  function parseVal(str, type) {
    if (str === '' || str === null || str === undefined) return null;
    if (type === 'pct') {
      const n = parseFloat(str.replace(',', '.').replace('%', '').trim());
      if (isNaN(n)) return null;
      return n > 1 ? n / 100 : n;
    }
    if (type === 'number') {
      const n = parseFloat(str.replace(/[\s]/g, '').replace(',', '.'));
      return isNaN(n) ? null : n;
    }
    return str || null;
  }

  function emptyRow(fields) {
    const r = {};
    fields.forEach(f => { r[f.key] = null; });
    return r;
  }

  function filterRows(rows, fields) {
    if (!searchQuery) return rows.map((r, i) => [r, i]);
    const q = searchQuery.toLowerCase();
    return rows
      .map((r, i) => [r, i])
      .filter(([row]) => fields.some(f => {
        const v = row[f.key];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
      }));
  }

  /* ── Главный рендер ──────────────────────────────────────── */
  function render() {
    const container = document.getElementById('tab-input');
    if (!container) return;

    const tabMeta  = TABS.find(t => t.id === activeTab);
    const rows     = getData(tabMeta.dataKey);
    const filtered = filterRows(rows, tabMeta.fields);

    container.innerHTML = buildHTML(tabMeta, rows, filtered);
    attachEvents(tabMeta);
  }

  /* ── HTML ────────────────────────────────────────────────── */
  function buildHTML(tabMeta, rows, filtered) {
    const { fields } = tabMeta;
    const colSpan = fields.length + 2;

    const tabsHTML = TABS.map(t => `
      <button class="ie-tab${t.id === activeTab ? ' active' : ''}" data-section="${t.id}">
        <i class="${t.icon}"></i> ${t.label}
        <span class="ie-tab-count">${getData(t.dataKey).length}</span>
      </button>`).join('');

    const theadHTML = `
      <tr>
        <th class="ie-th ie-th--num">#</th>
        ${fields.map(f =>
          `<th class="ie-th" style="min-width:${f.width}px">${f.label}${f.required ? '<span class="ie-req">*</span>' : ''}</th>`
        ).join('')}
        <th class="ie-th ie-th--act">Действия</th>
      </tr>`;

    const tbodyHTML = filtered.length === 0
      ? `<tr><td colspan="${colSpan}" class="ie-empty"><i class="ri-inbox-line"></i><br>Нет данных — нажмите «+ Добавить строку»</td></tr>`
      : filtered.map(([row, idx]) => buildRow(row, idx, fields)).join('');

    return `
    <div class="input-editor-wrap">
      <div class="ie-header">

        <div class="ie-title-row">
          <h2 class="ie-title"><i class="ri-table-line"></i> Ввод и редактирование данных</h2>
          <div class="ie-actions">
            <button class="ie-btn ie-btn--ghost" id="ie-export-json"><i class="ri-download-2-line"></i> JSON</button>
            <button class="ie-btn ie-btn--ghost" id="ie-export-csv"><i class="ri-file-excel-line"></i> CSV</button>
            <button class="ie-btn ie-btn--danger" id="ie-clear-section"><i class="ri-delete-bin-line"></i> Очистить раздел</button>
          </div>
        </div>

        <div class="ie-tabs">${tabsHTML}</div>

        <div class="ie-toolbar">
          <div class="ie-search-wrap">
            <i class="ri-search-line"></i>
            <input class="ie-search" id="ie-search" type="search"
              placeholder="Поиск по таблице…" value="${escHtml(searchQuery)}">
          </div>
          <span class="ie-count-info">${filtered.length} из ${rows.length} записей</span>
          <button class="ie-btn ie-btn--primary" id="ie-add-row">
            <i class="ri-add-line"></i> Добавить строку
          </button>
        </div>

      </div>

      <div class="ie-table-scroll">
        <table class="ie-table">
          <thead>${theadHTML}</thead>
          <tbody id="ie-tbody">${tbodyHTML}</tbody>
        </table>
      </div>

      <div class="ie-footer">
        <span class="ie-hint">
          <i class="ri-information-line"></i>
          Клик на ячейку — редактировать &nbsp;·&nbsp;
          Enter / Tab — следующая &nbsp;·&nbsp;
          Esc — отмена
        </span>
        <div class="ie-footer-right">
          <button class="ie-btn ie-btn--success" id="ie-save-all">
            <i class="ri-save-line"></i> Сохранить все
          </button>
        </div>
      </div>
    </div>`;
  }

  function buildRow(row, idx, fields) {
    const cells = fields.map(f => {
      const val     = row[f.key];
      const display = fmt(val, f.type);
      const empty   = val === null || val === undefined || val === '';
      const reqCls  = f.required && empty ? ' ie-td--req' : '';
      const emptCls = empty ? ' ie-td--empty' : '';
      const safe    = escHtml(display);
      return `<td class="ie-td${emptCls}${reqCls}"
        data-idx="${idx}" data-key="${f.key}" data-type="${f.type}"
        title="${empty ? escHtml(f.label) : safe}">
        <span class="ie-cell-val">${safe || '<em class="ie-dash">—</em>'}</span>
      </td>`;
    }).join('');

    return `
    <tr class="ie-row" data-idx="${idx}">
      <td class="ie-td ie-td--num">${idx + 1}</td>
      ${cells}
      <td class="ie-td ie-td--act">
        <div class="ie-act-wrap">
          <button class="ie-act-btn ie-act-del" data-action="del" data-idx="${idx}" title="Удалить строку">
            <i class="ri-delete-bin-2-line"></i>
          </button>
          <button class="ie-act-btn ie-act-dup" data-action="dup" data-idx="${idx}" title="Дублировать строку">
            <i class="ri-file-copy-line"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }

  function escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Единый обработчик кликов на tbody ───────────────────── */
  function attachEvents(tabMeta) {
    const { fields, dataKey } = tabMeta;

    /* ----- TBODY: единый делегированный обработчик ----- */
    const tbody = document.getElementById('ie-tbody');
    if (tbody) {
      tbody.addEventListener('click', e => {
        /* 1. Кнопки действий (del / dup) — приоритет */
        const actBtn = e.target.closest('[data-action]');
        if (actBtn) {
          e.stopPropagation();
          const action = actBtn.dataset.action;
          const idx    = parseInt(actBtn.dataset.idx, 10);
          if (action === 'del') handleDelete(idx, dataKey);
          if (action === 'dup') handleDuplicate(idx, dataKey);
          return;
        }
        /* 2. Ячейка данных → inline-edit */
        const td = e.target.closest('td[data-key]');
        if (td) {
          const idx  = parseInt(td.dataset.idx, 10);
          const key  = td.dataset.key;
          const type = td.dataset.type;
          startEdit(td, idx, key, type, fields, dataKey);
        }
      });
    }

    /* ----- Добавить строку ----- */
    document.getElementById('ie-add-row')?.addEventListener('click', () => {
      if (editingCell) commitEdit(fields, dataKey);
      const raw = getData(dataKey);
      raw.push(emptyRow(fields));
      setData(dataKey, raw);
      render();
      requestAnimationFrame(() => {
        const scroll = document.querySelector('.ie-table-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
        const lastTd = document.querySelector('#ie-tbody tr:last-child td[data-key]');
        if (lastTd) lastTd.click();
      });
    });

    /* ----- Поиск ----- */
    document.getElementById('ie-search')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });

    /* ----- Вкладки секций ----- */
    document.querySelectorAll('.ie-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (editingCell) commitEdit(fields, dataKey);
        activeTab   = btn.dataset.section;
        searchQuery = '';
        render();
      });
    });

    /* ----- Сохранить ----- */
    document.getElementById('ie-save-all')?.addEventListener('click', () => {
      if (editingCell) commitEdit(fields, dataKey);
      window.db.save({
        contracts: window.dashboardState.rawData.contracts || [],
        svod:      window.dashboardState.rawData.svod      || [],
        objects:   window.dashboardState.rawData.objects   || [],
      });
      window.app._renderDbStatus();
      window.app.refresh();
      toast('Данные сохранены ✓', 'success');
    });

    /* ----- Экспорт JSON ----- */
    document.getElementById('ie-export-json')?.addEventListener('click', () => window.db.exportToFile());

    /* ----- Экспорт CSV ----- */
    document.getElementById('ie-export-csv')?.addEventListener('click', () => {
      exportCSV(tabMeta, getData(dataKey));
    });

    /* ----- Очистить раздел ----- */
    document.getElementById('ie-clear-section')?.addEventListener('click', () => {
      const tabMeta = TABS.find(t => t.id === activeTab);
      if (!confirm(`Очистить все строки раздела «${tabMeta.label}»?\nДействие нельзя отменить.`)) return;
      setData(tabMeta.dataKey, []);
      render();
      toast(`Раздел «${tabMeta.label}» очищен`, 'warning');
    });
  }

  /* ── Действия строк ──────────────────────────────────────── */
  function handleDelete(idx, dataKey) {
    if (!confirm(`Удалить строку ${idx + 1}?`)) return;
    const raw = getData(dataKey);
    raw.splice(idx, 1);
    setData(dataKey, raw);
    render();
  }

  function handleDuplicate(idx, dataKey) {
    const raw  = getData(dataKey);
    const copy = Object.assign({}, raw[idx]);
    raw.splice(idx + 1, 0, copy);
    setData(dataKey, raw);
    render();
    toast('Строка продублирована', 'info');
  }

  /* ── Inline-редактирование ───────────────────────────────── */
  function startEdit(td, rowIdx, key, type, fields, dataKey) {
    if (editingCell) {
      if (editingCell.td === td) return;  // уже редактируем эту ячейку
      commitEdit(fields, dataKey);
    }

    const raw = getData(dataKey);
    const val = raw[rowIdx]?.[key];
    let input;

    if (type === 'select') {
      const field = fields.find(f => f.key === key);
      input = document.createElement('select');
      input.className = 'ie-cell-input';
      (field.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === val) o.selected = true;
        input.appendChild(o);
      });
    } else if (type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
      input.className = 'ie-cell-input';
      input.value = val || '';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'ie-cell-input';
      if (type === 'pct' && val !== null && val !== undefined) {
        input.value = (val * 100).toFixed(2);
        input.placeholder = 'Введите % (напр. 42.5)';
      } else {
        input.value = val !== null && val !== undefined ? String(val) : '';
      }
    }

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    if (typeof input.select === 'function') input.select();

    editingCell = { td, key, type, rowIdx };

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(fields, dataKey, rowIdx); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitEdit(fields, dataKey);
        // переход к следующей/предыдущей ячейке
        const keys   = fields.map(f => f.key);
        const ci     = keys.indexOf(key);
        const nextKey = e.shiftKey ? keys[ci - 1] : keys[ci + 1];
        if (nextKey) {
          const next = document.querySelector(`td[data-idx="${rowIdx}"][data-key="${nextKey}"]`);
          if (next) next.click();
        }
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => { if (editingCell) commitEdit(fields, dataKey); }, 120);
    });
  }

  function commitEdit(fields, dataKey) {
    if (!editingCell) return;
    const { td, key, type, rowIdx } = editingCell;
    const input = td.querySelector('input,select');
    if (!input) { editingCell = null; return; }

    const parsed = parseVal(input.value, type);
    const raw    = getData(dataKey);
    if (raw[rowIdx]) raw[rowIdx][key] = parsed;
    setData(dataKey, raw);
    editingCell = null;

    // обновляем только эту ячейку
    const field   = fields.find(f => f.key === key);
    const display = fmt(parsed, type);
    const empty   = parsed === null || parsed === undefined;
    td.className  = `ie-td${empty ? ' ie-td--empty' : ''}${field?.required && empty ? ' ie-td--req' : ''}`;
    td.setAttribute('data-type', type);
    td.innerHTML  = `<span class="ie-cell-val">${escHtml(display) || '<em class="ie-dash">—</em>'}</span>`;
  }

  function cancelEdit(fields, dataKey, rowIdx) {
    if (!editingCell) return;
    const { td, key, type } = editingCell;
    const raw     = getData(dataKey);
    const val     = raw[rowIdx]?.[key];
    const display = fmt(val, type);
    const empty   = val === null || val === undefined;
    const field   = fields.find(f => f.key === key);
    td.className  = `ie-td${empty ? ' ie-td--empty' : ''}${field?.required && empty ? ' ie-td--req' : ''}`;
    td.innerHTML  = `<span class="ie-cell-val">${escHtml(display) || '<em class="ie-dash">—</em>'}</span>`;
    editingCell   = null;
  }

  /* ── CSV экспорт ─────────────────────────────────────────── */
  function exportCSV(tabMeta, rows) {
    const { fields, id } = tabMeta;
    const header = fields.map(f => `"${f.label}"`).join(';');
    const body   = rows.map(row =>
      fields.map(f => {
        const v = row[f.key];
        if (v === null || v === undefined) return '';
        if (f.type === 'pct') return (v * 100).toFixed(2);
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(';')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const a    = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(blob),
      download: `${id}-${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click();
    toast('CSV экспортирован ✓', 'success');
  }

  /* ── Toast ───────────────────────────────────────────────── */
  function toast(msg, type = 'info') {
    let wrap = document.getElementById('ie-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ie-toast-wrap';
      Object.assign(wrap.style, { position:'fixed', bottom:'24px', right:'24px',
        zIndex:'9999', display:'flex', flexDirection:'column', gap:'8px' });
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `ie-toast ie-toast--${type}`;
    const icon = type === 'success' ? 'checkbox-circle' : type === 'warning' ? 'alert' : 'information';
    el.innerHTML = `<i class="ri-${icon}-line"></i> ${msg}`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ── Public API ──────────────────────────────────────────── */
  return { render, toast };

})();
