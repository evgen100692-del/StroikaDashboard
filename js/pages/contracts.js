/**
 * pages/contracts.js — Contracts table + add/edit modal
 */

const ContractsPage = (() => {
  let editingId = null;
  let sortCol = 'objectName', sortDir = 1;
  let tableFilters = { search: '', contractor: '', source: '' };

  function init() {
    Router.register('contracts', render);
    bindModal();
    bindTableFilters();
  }

  function render() {
    renderTable();
    populateTableFilters();
  }

  function populateTableFilters() {
    const cf = document.getElementById('ct-contractor-filter');
    if (cf) {
      cf.innerHTML = '<option value="">Все подрядчики</option>' +
        AppData.getContractorNames().map(n => {
          const opt = document.createElement('option');
          opt.value = n; opt.textContent = n;
          return opt.outerHTML;
        }).join('');
    }
    const sf = document.getElementById('ct-source-filter');
    if (sf) {
      sf.innerHTML = '<option value="">Все источники</option>' +
        AppData.getFinancingSources().map(s => {
          const opt = document.createElement('option');
          opt.value = s; opt.textContent = s;
          return opt.outerHTML;
        }).join('');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;
    let list = AppData.getContracts();
    // Apply filters
    if (tableFilters.search) {
      const q = tableFilters.search.toLowerCase();
      list = list.filter(c => (c.objectName||'').toLowerCase().includes(q) || (c.contractNum||'').toLowerCase().includes(q));
    }
    if (tableFilters.contractor) list = list.filter(c => c.contractor === tableFilters.contractor);
    if (tableFilters.source) list = list.filter(c => c.financingSource === tableFilters.source);

    // Sort
    list = [...list].sort((a,b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'number') return (va - vb) * sortDir;
      return String(va||'').localeCompare(String(vb||''), 'ru') * sortDir;
    });

    // Update sort indicators
    document.querySelectorAll('#contracts-table th[data-col]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.col === sortCol);
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = th.dataset.col===sortCol ? (sortDir===1?'▲':'▼') : '⇅';
    });

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg></div>
        <h3>Контракты не найдены</h3>
        <p>Добавьте первый контракт или измените фильтры</p>
        <button class="btn btn-primary" onclick="ContractsPage.openAdd()">Добавить контракт</button>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => `<tr>
      <td class="wrap" style="min-width:200px"><strong>${esc(c.objectName||'—')}</strong><div style="color:var(--color-text-muted);font-size:var(--text-xs);margin-top:2px">${esc(c.contractNum||'')}</div></td>
      <td>${esc(c.financingSource||'—')}</td>
      <td>${esc(c.contractor||'—')}</td>
      <td class="num">${formatMoneyShort(c.priceGK)}</td>
      <td class="num">${formatMoneyShort(c.advanceGK)}<div class="muted" style="font-size:10px">${formatPct(c.priceGK ? c.advanceGK/c.priceGK*100 : 0)}</div></td>
      <td class="num">${formatMoneyShort(c.paidTotal)}<div class="muted" style="font-size:10px">${formatPct(c.priceGK ? c.paidTotal/c.priceGK*100 : 0)}</div></td>
      <td class="num">${formatMoneyShort(c.completed)}<div class="muted" style="font-size:10px">${formatPct(c.priceGK ? c.completed/c.priceGK*100 : 0)}</div></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="progress-wrap" style="width:52px"><div class="progress-fill ${c.readinessPct>=75?'success':c.readinessPct>=40?'':'warning'}" style="width:${Math.min(c.readinessPct||0,100)}%"></div></div>
          <span style="font-size:var(--text-xs);font-weight:600">${c.readinessPct||0}%</span>
        </div>
      </td>
      <td>${formatDate(c.contractEndDate)}</td>
      <td>${formatDate(c.plannedOpenDate)}</td>
      <td><span style="font-size:var(--text-xs)">${esc(c.dptStatus||'—')}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Редактировать" onclick="ContractsPage.openEdit(${c.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Удалить" onclick="ContractsPage.confirmDelete(${c.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openAdd() {
    editingId = null;
    resetForm();
    document.getElementById('contract-modal-title').textContent = 'Новый контракт';
    updateAutocomplete();
    openModal('contract-modal');
  }

  function openEdit(id) {
    editingId = id;
    const c = AppData.getContractById(id);
    if (!c) return;
    document.getElementById('contract-modal-title').textContent = 'Редактировать контракт';
    fillForm(c);
    updatePercentBadges();
    updateAutocomplete();
    openModal('contract-modal');
  }

  function confirmDelete(id) {
    const c = AppData.getContractById(id);
    confirmDialog(`Удалить контракт "${c?.objectName || id}"? Это действие нельзя отменить.`, async () => {
      try {
        await AppData.deleteContract(id);
        renderTable();
        DashboardPage.render();
        ContractorsPage.render();
        Toast.success('Контракт удалён');
      } catch(e) {
        Toast.error('Ошибка удаления: ' + e.message);
      }
    });
  }

  function fillForm(c) {
    const fields = [
      'objectName','financingSource','contractor','contractNum','contractDate',
      'priceGK','advanceGK','advancePaid','unworkedAdvance','paidTotal','completed',
      'completed2025','paid2025','limit2026was','limit2026cur','completed2026','paid2026',
      'limit2027was','limit2027cur','limit2028was','limit2028cur','limit2029was','limit2029cur',
      'remainder','readinessPct','workers','equipment','moge','dptStatus',
      'landWithdrawalPct','plannedIntroDate','plannedOpenDate','contractEndDate'
    ];
    fields.forEach(f => {
      const el = document.getElementById('cf-' + f);
      if (el) el.value = c[f] ?? '';
    });
  }

  function resetForm() {
    const form = document.getElementById('contract-form');
    if (form) form.reset();
  }

  function getFormData() {
    const fields = [
      'objectName','financingSource','contractor','contractNum','contractDate',
      'priceGK','advanceGK','advancePaid','unworkedAdvance','paidTotal','completed',
      'completed2025','paid2025','limit2026was','limit2026cur','completed2026','paid2026',
      'limit2027was','limit2027cur','limit2028was','limit2028cur','limit2029was','limit2029cur',
      'remainder','readinessPct','workers','equipment','moge','dptStatus',
      'landWithdrawalPct','plannedIntroDate','plannedOpenDate','contractEndDate'
    ];
    const data = {};
    fields.forEach(f => {
      const el = document.getElementById('cf-' + f);
      if (el) data[f] = el.value;
    });
    return data;
  }

  function validateForm(data) {
    if (!data.objectName?.trim()) { Toast.error('Укажите наименование объекта'); return false; }
    if (!data.contractor?.trim()) { Toast.error('Укажите подрядчика'); return false; }
    const pct = parseFloat(data.readinessPct);
    if (data.readinessPct && (isNaN(pct) || pct < 0 || pct > 100)) {
      Toast.error('Стройготовность должна быть от 0 до 100%');
      return false;
    }
    return true;
  }

  async function saveForm() {
    const data = getFormData();
    if (!validateForm(data)) return;
    const btn = document.getElementById('contract-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Сохранение…'; }
    try {
      if (editingId !== null) {
        await AppData.updateContract(editingId, data);
        Toast.success('Контракт обновлён');
      } else {
        await AppData.addContract(data);
        Toast.success('Контракт добавлен');
      }
      closeModal('contract-modal');
      renderTable();
      populateTableFilters();
      DashboardPage.render();
      ContractorsPage.render();
    } catch(e) {
      Toast.error('Ошибка сохранения: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; }
    }
  }

  function updatePercentBadges() {
    const priceGK       = AppData.num(document.getElementById('cf-priceGK')?.value);
    const advanceGK     = AppData.num(document.getElementById('cf-advanceGK')?.value);
    const advancePaid   = AppData.num(document.getElementById('cf-advancePaid')?.value);
    const unworked      = AppData.num(document.getElementById('cf-unworkedAdvance')?.value);
    const paidTotal     = AppData.num(document.getElementById('cf-paidTotal')?.value);
    const completed     = AppData.num(document.getElementById('cf-completed')?.value);

    setBadge('pct-advanceGK',      priceGK     ? AppData.pct(advanceGK, priceGK)     : null);
    setBadge('pct-advancePaid',    advanceGK   ? AppData.pct(advancePaid, advanceGK) : null);
    setBadge('pct-unworkedAdvance',advancePaid ? AppData.pct(unworked, advancePaid)  : null);
    setBadge('pct-paidTotal',      priceGK     ? AppData.pct(paidTotal, priceGK)     : null);
    setBadge('pct-completed',      priceGK     ? AppData.pct(completed, priceGK)     : null);
  }

  function setBadge(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val !== null ? formatPct(val) : '';
    el.style.display = val !== null ? '' : 'none';
  }

  function updateAutocomplete() {
    const input = document.getElementById('cf-contractor');
    const list  = document.getElementById('contractor-autocomplete');
    if (!input || !list) return;
    const names = AppData.getContractorNames();

    function showList(query) {
      const filtered = query
        ? names.filter(n => n.toLowerCase().includes(query.toLowerCase()))
        : names;
      if (filtered.length === 0) { list.classList.remove('open'); return; }
      list.innerHTML = filtered.map(n =>
        `<div class="autocomplete-item" tabindex="-1">${esc(n)}</div>`
      ).join('');
      list.classList.add('open');
    }

    input.addEventListener('input', e => showList(e.target.value));
    input.addEventListener('focus', e => showList(e.target.value));
    list.addEventListener('click', e => {
      const item = e.target.closest('.autocomplete-item');
      if (item) { input.value = item.textContent; list.classList.remove('open'); }
    });
    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !list.contains(e.target)) list.classList.remove('open');
    }, { passive: true });
  }

  function bindTableFilters() {
    const searchEl = document.getElementById('ct-search');
    if (searchEl) {
      let deb;
      searchEl.addEventListener('input', e => {
        clearTimeout(deb);
        deb = setTimeout(() => { tableFilters.search = e.target.value; renderTable(); }, 250);
      });
    }
    const cf = document.getElementById('ct-contractor-filter');
    if (cf) cf.addEventListener('change', e => { tableFilters.contractor = e.target.value; renderTable(); });
    const sf = document.getElementById('ct-source-filter');
    if (sf) sf.addEventListener('change', e => { tableFilters.source = e.target.value; renderTable(); });
  }

  function bindModal() {
    const saveBtn = document.getElementById('contract-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveForm);

    // Percent live-update
    ['cf-priceGK','cf-advanceGK','cf-advancePaid','cf-unworkedAdvance','cf-paidTotal','cf-completed'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePercentBadges);
    });

    // Sort headers
    document.querySelectorAll('#contracts-table th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        if (sortCol === th.dataset.col) sortDir *= -1;
        else { sortCol = th.dataset.col; sortDir = 1; }
        renderTable();
      });
    });
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, render, openAdd, openEdit, confirmDelete, renderTable };
})();
