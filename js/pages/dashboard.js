/**
 * pages/dashboard.js — Dashboard page logic
 */

const DashboardPage = (() => {
  let currentFilters = { contractor: '', year: '', source: '', search: '' };

  function init() {
    Router.register('dashboard', render);
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

    const contractors = AppData.getContractorNames();
    const years       = AppData.getOpeningYears();
    const sources     = AppData.getFinancingSources();

    function makeOptions(items, current) {
      return items.map(v => {
        const opt = document.createElement('option');
        opt.value    = v;          // DOM-свойство — безопасно для любых символов
        opt.textContent = v;
        opt.selected = String(v) === String(current);
        return opt.outerHTML;
      }).join('');
    }

    contractorSel.innerHTML = '<option value="">Все подрядчики</option>' +
      makeOptions(contractors, currentFilters.contractor);

    yearSel.innerHTML = '<option value="">Все годы</option>' +
      makeOptions(years, currentFilters.year);

    sourceSel.innerHTML = '<option value="">Все источники</option>' +
      makeOptions(sources, currentFilters.source);
  }

  function applyFilters() {
    const filtered   = AppData.filterContracts(currentFilters);
    const analytics  = AppData.getAnalytics(filtered);
    renderKPIs(analytics, filtered);
    renderObjectsList(filtered);
    ChartsManager.renderAll(analytics, filtered);
    setTimeout(observeCards, 50);
  }

  function renderKPIs(a, filtered) {
    const kpis = [
      ['kpi-count',      filtered.length, n => n + ' объ.'],
      ['kpi-total-gk',   a.totalGK,   formatMoneyShort],
      ['kpi-paid',       a.paidTotal, formatMoneyShort],
      ['kpi-completed',  a.completed, formatMoneyShort],
    ];
    kpis.forEach(([id, val, fmt]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = fmt(val);
    });

    setText('kpi-paid-pct',    formatPct(a.paidTotalPct));
    setText('kpi-completed-pct', formatPct(a.completedPct));
    setText('kpi-unworked',    formatMoneyShort(a.unworked));
    setText('kpi-avg-readiness', formatPct(a.avgReadiness));

    setProgress('prog-paid',      a.paidTotalPct);
    setProgress('prog-completed', a.completedPct);
    setProgress('prog-readiness', a.avgReadiness);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setProgress(id, pct) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = Math.min(100, Math.max(0, pct || 0));
    setTimeout(() => { el.style.width = v + '%'; }, 100);
    el.className = 'progress-fill' + (v >= 75 ? ' success' : v >= 40 ? '' : ' warning');
  }

  function renderObjectsList(filtered) {
    const tbody = document.getElementById('objects-tbody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--space-8);color:var(--color-text-muted)">Нет объектов, соответствующих фильтрам</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(c => {
      const ready = AppData.num(c.readinessPct);
      const readyClass = ready >= 75 ? 'success' : ready >= 40 ? '' : 'warning';
      const badge = getStatusBadge(ready);
      return `<tr>
        <td class="wrap">${esc(c.objectName||'—')}</td>
        <td>${esc(c.contractor||'—')}</td>
        <td>${esc(c.financingSource||'—')}</td>
        <td class="num">${formatMoneyShort(c.priceGK)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <div class="progress-wrap" style="width:60px"><div class="progress-fill ${readyClass}" style="width:${ready}%"></div></div>
            <span style="font-size:var(--text-xs);font-weight:600">${ready}%</span>
          </div>
        </td>
        <td>${formatDate(c.plannedOpenDate)}</td>
        <td>${badge}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Редактировать" onclick="ContractsPage.openEdit(${c.id});Router.navigate('contracts')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function getStatusBadge(ready) {
    if (ready >= 90) return '<span class="badge badge-success">Завершается</span>';
    if (ready >= 50) return '<span class="badge badge-primary">В работе</span>';
    if (ready >= 20) return '<span class="badge badge-warning">Начат</span>';
    return '<span class="badge badge-neutral">Планирование</span>';
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
      searchEl.addEventListener('input', e => { clearTimeout(deb); deb = setTimeout(() => { currentFilters.search = e.target.value; applyFilters(); }, 300); });
    }
    const resetBtn = document.getElementById('f-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      currentFilters = { contractor:'', year:'', source:'', search:'' };
      ['f-contractor','f-year','f-source'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      const se = document.getElementById('f-search'); if(se) se.value='';
      applyFilters();
    });
  }

  return { init, render, bindFilters, refresh: applyFilters };
})();
