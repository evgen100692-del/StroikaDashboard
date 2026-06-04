/**
 * pages/contractors.js — Contractors aggregated table
 */

const ContractorsPage = (() => {
  let sortCol = 'totalGK', sortDir = -1;

  function init() {
    Router.register('contractors', render);
    setTimeout(() => {

      // ── Сортировка по клику на заголовок ──
      document.querySelectorAll('#contractors-table th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
          if (sortCol === th.dataset.col) sortDir *= -1;
          else { sortCol = th.dataset.col; sortDir = 1; }
          renderTable();
        });
      });

      // ── Контекстное меню по ПКМ ──
      const tbody = document.getElementById('contractors-tbody');
      ContextMenu.bind(tbody, [
        {
          key: 'contracts',
          label: 'Показать контракты',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
          action: (name) => showContracts(name)
        }
      ], row => row.dataset.name);  // передаём имя подрядчика из атрибута строки

    }, 200);
  }

  function render() {
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('contractors-tbody');
    if (!tbody) return;

    let list = AppData.getContractors();

    list = [...list].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'number') return (va - vb) * sortDir;
      return String(va||'').localeCompare(String(vb||''), 'ru') * sortDir;
    });

    document.querySelectorAll('#contractors-table th[data-col]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.col === sortCol);
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = th.dataset.col===sortCol ? (sortDir===1?'▲':'▼') : '⇅';
    });

    // Было colspan="10" — убрали 1 колонку «Действия», стало 9
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h3>Подрядчики не найдены</h3>
        <p>Добавьте контракты с указанием подрядчика, и они появятся здесь автоматически</p>
        <button class="btn btn-primary" onclick="Router.navigate('contracts');ContractsPage.openAdd()">Добавить контракт</button>
      </div></td></tr>`;
      return;
    }

    // data-ctx — маркер для ContextMenu что строка кликабельна по ПКМ
    // data-name — имя подрядчика, которое передаётся в action контекстного меню
    tbody.innerHTML = list.map(m => `<tr data-ctx data-name="${esc(m.name)}">
      <td title="${esc(m.name)}"><strong>${esc(m.name)}</strong></td>
      <td class="num">${formatMoneyShort(m.totalGK)}</td>
      <td class="num" style="text-align:center">${m.count}</td>
      <td class="num">${formatMoneyShort(m.advanceGK)}<div style="font-size:10px;color:var(--color-text-muted)">${formatPct(m.advanceGKPct)}</div></td>
      <td class="num">${formatMoneyShort(m.advancePaid)}<div style="font-size:10px;color:var(--color-text-muted)">${formatPct(m.advancePaidPct)}</div></td>
      <td class="num">${formatMoneyShort(m.unworkedAdvance)}<div style="font-size:10px;color:var(--color-text-muted)">${formatPct(m.unworkedAdvPct)}</div></td>
      <td class="num">${formatMoneyShort(m.paidTotal)}<div style="font-size:10px;color:var(--color-text-muted)">${formatPct(m.paidTotalPct)}</div></td>
      <td class="num">${formatMoneyShort(m.completed)}<div style="font-size:10px;color:var(--color-text-muted)">${formatPct(m.completedPct)}</div></td>
      <td>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:10px">
          <span style="color:var(--color-text-faint)">2026</span><span class="num">${formatMoneyShort(m.limit2026cur)}</span>
          <span style="color:var(--color-text-faint)">2027</span><span class="num">${formatMoneyShort(m.limit2027cur)}</span>
          <span style="color:var(--color-text-faint)">2028</span><span class="num">${formatMoneyShort(m.limit2028cur)}</span>
          <span style="color:var(--color-text-faint)">2029</span><span class="num">${formatMoneyShort(m.limit2029cur)}</span>
        </div>
      </td>
    </tr>`).join('');
    // ☝️ последняя <td> с кнопкой «Контракты» удалена — теперь это ПКМ
  }

  function showContracts(name) {
    Router.navigate('contracts');
    setTimeout(() => {
      const cf = document.getElementById('ct-contractor-filter');
      if (cf) { cf.value = name; cf.dispatchEvent(new Event('change')); }
    }, 50);
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { init, render, renderTable, showContracts };
})();