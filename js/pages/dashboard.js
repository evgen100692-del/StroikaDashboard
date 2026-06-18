/**
 * pages/dashboard.js
 * init()  — привязка слушателей фильтров (один раз), НЕ регистрирует Router.
 * render() — полный рендер: populateFilters + applyFilters + графики.
 * Регистрация роута — только в app.js::registerPages().
 */

const DashboardPage = (() => {
  let currentFilters = { contractor: '', year: '', source: '', search: '' };

  // Состояние сортировки таблицы объектов
  let sortState = { col: null, dir: 'asc' };

  // Колонки таблицы с метаданными для сортировки
  const SORT_COLS = [
    { key: 'objectName',      label: 'Объект',          type: 'str',    align: 'left'   },
    { key: 'contractor',      label: 'Подрядчик',        type: 'str',    align: 'center' },
    { key: 'financingSource', label: 'Источник',          type: 'str',    align: 'center' },
    { key: 'priceGK',         label: 'Стоимость ГК',     type: 'num',    align: 'right'  },
    { key: 'completed',       label: 'Выполнено',         type: 'num',    align: 'right'  },
    { key: 'readinessPct',    label: 'Стройготовность', type: 'num',    align: 'center' },
    { key: 'landWithdrawalPct', label: 'Изъятие ЗУ',       type: 'num',    align: 'center' },
    { key: 'dptStatus',       label: 'Статус ДПТ',       type: 'str',    align: 'center' },
  ];

  const COL_WIDTHS = ['28%','14%','10%','10%','8%','9%','9%','12%'];

  function init() {
    bindFilters();
    bindSortHeaders();
  }

  function render() {
    populateFilters();
    applyFilters();
  }

  function populateFilters() {
    const contractorSel = document.getElementById('f-contractor');
    const yearSel       = document.getElementById('f-year');
    const sourceSel     = document.getElementById('f-source');
    if (!contractorSel) return;

    function makeOptions(items, current) {
      return items.map(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        opt.selected = String(v) === String(current);
        return opt.outerHTML;
      }).join('');
    }
    contractorSel.innerHTML = '<option value="">Все подрядчики</option>' +
      makeOptions(AppData.getContractorNames(), currentFilters.contractor);
    yearSel.innerHTML = '<option value="">Все годы</option>' +
      makeOptions(AppData.getOpeningYears(), currentFilters.year);
    sourceSel.innerHTML = '<option value="">Все источники</option>' +
      makeOptions(AppData.getFinancingSources(), currentFilters.source);
  }

  function applyFilters() {
    const filtered  = AppData.filterContracts(currentFilters);
    const analytics = AppData.getAnalytics(filtered);
    renderKPIs(analytics, filtered);
    renderObjectsList(filtered);
    requestAnimationFrame(() => {
      ChartsManager.renderAll(analytics, filtered);
    });
  }

  function getSorted(list) {
    if (!sortState.col) return list;
    const col = SORT_COLS.find(c => c.key === sortState.col);
    if (!col) return list;
    return [...list].sort((a, b) => {
      let va = a[sortState.col], vb = b[sortState.col];
      if (col.type === 'num') {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
      if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Строим thead таблицы с иконками сортировки
  function renderTableHead() {
    const thead = document.querySelector('#objects-tbody');
    if (!thead) return;
    const table = thead.closest('table');
    if (!table) return;
    const existingThead = table.querySelector('thead');
    if (!existingThead) return;

    existingThead.innerHTML = '<tr>' + SORT_COLS.map((col, i) => {
      const isActive = sortState.col === col.key;
      const dir      = isActive ? sortState.dir : null;

      const iconDefault = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:.35"><path d="M12 5v14M5 9l7-7 7 7"/><path d="M5 15l7 7 7-7"/></svg>`;
      const iconAsc     = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--color-primary)"><path d="M5 9l7-7 7 7"/><path d="M12 2v20" opacity=".3"/></svg>`;
      const iconDesc    = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--color-primary)"><path d="M5 15l7 7 7-7"/><path d="M12 2v20" opacity=".3"/></svg>`;
      const icon = !isActive ? iconDefault : dir === 'asc' ? iconAsc : iconDesc;

      return `<th data-sort-col="${col.key}" style="width:${COL_WIDTHS[i]};text-align:${col.align};cursor:pointer;user-select:none;white-space:nowrap">
        <span style="display:inline-flex;align-items:center;gap:4px">${col.label}${icon}</span>
      </th>`;
    }).join('') + '</tr>';
  }

  function bindSortHeaders() {
    // Событие через делегацию на таблице — работает даже после перерендера
    document.addEventListener('click', e => {
      const th = e.target.closest('th[data-sort-col]');
      if (!th) return;
      // Проверяем, что это таблица дашборда
      if (!th.closest('#objects-tbody')?.closest('table') && !th.closest('table')?.querySelector('#objects-tbody')) return;
      const col = th.dataset.sortCol;
      if (sortState.col === col) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.col = col;
        sortState.dir = 'asc';
      }
      renderTableHead();
      const filtered = AppData.filterContracts(currentFilters);
      renderObjectsList(filtered);
    });
  }

  function renderKPIs(a, filtered) {
    const kpis = [
      ['kpi-count',     filtered.length, n => n + ' объ.'],
      ['kpi-total-gk',  a.totalGK,   formatMoneyShort],
      ['kpi-paid',      a.paidTotal, formatMoneyShort],
      ['kpi-completed', a.completed, formatMoneyShort],
    ];
    kpis.forEach(([id, val, fmt]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = fmt(val);
    });
    setText('kpi-paid-pct',       formatPct(a.paidTotalPct));
    setText('kpi-completed-pct',  formatPct(a.completedPct));
    setText('kpi-unworked',       formatMoneyShort(a.unworked));
    setText('kpi-avg-readiness',  formatPct(a.avgReadiness));
    setProgress('prog-paid',      a.paidTotalPct);
    setProgress('prog-completed', a.completedPct);
    setProgress('prog-readiness', a.avgReadiness);
  }

  function setText(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }
  function setProgress(id, pct) {
    const el = document.getElementById(id); if (!el) return;
    const v = Math.min(100, Math.max(0, pct || 0));
    setTimeout(() => { el.style.width = v + '%'; }, 100);
    el.className = 'progress-fill' + (v >= 75 ? ' success' : v >= 40 ? '' : ' warning');
  }

  function renderReadinessDelta(contractId) {
    const h = AppData.getReadinessDelta(contractId);
    if (!h) return '';
    const delta = Math.round((h.new_value - h.prev_value) * 10) / 10;
    if (delta === 0) return '';
    const up    = delta > 0;
    const color = up ? 'var(--color-success)' : 'var(--color-error)';
    const sign  = up ? '+' : '';
    const arrow = up
      ? '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
      : '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
    const tooltip = `Было: ${h.prev_value}% → Стало: ${h.new_value}%`;
    return `<span title="${tooltip}" style="color:${color};font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:1px;margin-left:3px">${arrow}${sign}${delta}%</span>`;
  }

  function renderObjectsList(filtered) {
    const tbody = document.getElementById('objects-tbody');
    if (!tbody) return;

    // Первый раз — строим заголовки
    renderTableHead();

    if (!tbody._ctxBound) {
      ContextMenu.bind(tbody, [
        {
          key: 'edit', label: 'Изменить',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
          action: (id) => { Router.navigate('contracts'); setTimeout(() => ContractsPage.openEdit(Number(id)), 80); }
        },
        { divider: true },
        {
          key: 'delete', label: 'Удалить', danger: true,
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
          action: (id) => ContractsPage.confirmDelete(Number(id))
        }
      ]);
      tbody._ctxBound = true;
    }
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--space-8);color:var(--color-text-muted)">Нет объектов, соответствующих фильтрам</td></tr>`;
      return;
    }

    const sorted = getSorted(filtered);

    tbody.innerHTML = sorted.map(c => {
      const ready    = AppData.num(c.readinessPct);
      const rc       = ready >= 75 ? 'success' : ready >= 40 ? '' : 'warning';
      const land     = AppData.num(c.landWithdrawalPct);
      const lc       = land  >= 75 ? 'success' : land  >= 40 ? '' : 'warning';
      const hasLand  = c.landWithdrawalPct != null && String(c.landWithdrawalPct).trim() !== '';

      const progressCell = (val, cls, delta) => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div class="progress-wrap" style="width:52px">
            <div class="progress-fill ${cls}" style="width:${Math.min(val,100)}%"></div>
          </div>
          <div style="display:flex;align-items:center;gap:2px">
            <span style="font-size:10px;font-weight:600">${val}%</span>${delta || ''}
          </div>
        </div>`;

      return `<tr data-ctx data-id="${c.id}">
        <td style="text-align:left;overflow:hidden">
          <div style="font-weight:600;font-size:var(--text-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3" title="${esc(c.objectName||'')}">${esc(c.objectName||'—')}</div>
          ${c.contractNum ? `<div style="color:var(--color-text-faint);font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.contractNum)}</div>` : ''}
        </td>
        <td style="text-align:center;overflow:hidden">
          <span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:var(--text-xs)" title="${esc(c.contractor||'')}">${esc(c.contractor||'—')}</span>
        </td>
        <td style="text-align:center;overflow:hidden">
          <span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:var(--text-xs);color:var(--color-text-muted)" title="${esc(c.financingSource||'')}">${esc(c.financingSource||'—')}</span>
        </td>
        <td class="num" style="text-align:right;font-variant-numeric:tabular-nums">${formatMoneyShort(c.priceGK)}</td>
        <td class="num" style="text-align:right;font-variant-numeric:tabular-nums">${formatMoneyShort(c.completed)}</td>
        <td style="text-align:center">${progressCell(ready, rc, renderReadinessDelta(c.id))}</td>
        <td style="text-align:center">${hasLand ? progressCell(land, lc) : '<span style="color:var(--color-text-faint);font-size:var(--text-xs)">—</span>'}</td>
        <td style="text-align:center;font-size:var(--text-xs);color:var(--color-text-muted)">${esc(c.dptStatus||'—')}</td>
      </tr>`;
    }).join('');
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function bindFilters() {
    ['f-contractor','f-year','f-source'].forEach((id, i) => {
      const keys = ['contractor','year','source'];
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', e => { currentFilters[keys[i]] = e.target.value; applyFilters(); });
    });
    const searchEl = document.getElementById('f-search');
    if (searchEl) {
      let deb;
      searchEl.addEventListener('input', e => {
        clearTimeout(deb);
        deb = setTimeout(() => { currentFilters.search = e.target.value; applyFilters(); }, 300);
      });
    }
    const resetBtn = document.getElementById('f-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      currentFilters = { contractor:'', year:'', source:'', search:'' };
      ['f-contractor','f-year','f-source'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      const se = document.getElementById('f-search'); if(se) se.value='';
      applyFilters();
    });
  }

  return { init, render, refresh: render, bindFilters };
})();
