const ContextMenu = (() => {
  let menuEl = null, currentId = null, currentRow = null;

  function ensureMenu() {
    if (menuEl) return;
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.setAttribute('role', 'menu');
    document.body.appendChild(menuEl);

    document.addEventListener('click', hideMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });
    document.addEventListener('contextmenu', e => {
      if (!e.target.closest('tr[data-ctx]')) hideMenu();
    });
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu);
  }

  function hideMenu() {
    if (!menuEl) return;
    menuEl.classList.remove('open');
    if (currentRow) { currentRow.classList.remove('ctx-active'); currentRow = null; }
    currentId = null;
  }

  function showMenu(x, y, items, id, row) {
    ensureMenu();
    currentId = id; currentRow = row;
    row.classList.add('ctx-active');

    menuEl.innerHTML = items.map(item => {
      if (item.divider) return '<div class="ctx-menu-divider"></div>';
      return `<button class="ctx-menu-item${item.danger?' danger':''}" role="menuitem" data-action="${item.key}">
        ${item.icon||''}${item.label}
      </button>`;
    }).join('');

    menuEl.style.left = '0'; menuEl.style.top = '0';
    menuEl.classList.add('open');

    const rect = menuEl.getBoundingClientRect();
    let left = x, top = y;
    if (left + rect.width  > window.innerWidth  - 8) left = window.innerWidth  - rect.width  - 8;
    if (top  + rect.height > window.innerHeight - 8) top  = window.innerHeight - rect.height - 8;
    menuEl.style.left = left + 'px';
    menuEl.style.top  = top  + 'px';

    menuEl.querySelectorAll('.ctx-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(i => i.key === btn.dataset.action);
        if (item?.action) item.action(currentId);
        hideMenu();
      });
    });
  }

  function bind(tbody, items, getId) {
    if (!tbody) return;
    tbody.addEventListener('contextmenu', e => {
      const row = e.target.closest('tr[data-ctx]');
      if (!row) return;
      e.preventDefault();
      hideMenu();
      const id = getId ? getId(row) : row.dataset.id;
      showMenu(e.clientX + 2, e.clientY + 2, items, id, row);
    });
  }

  return { bind, hide: hideMenu };
})();