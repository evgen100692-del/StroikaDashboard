/**
 * app.js — Главный файл инициализации
 */

(function () {
  'use strict';

  /* ================================================================
     1. ПЕРЕКЛЮЧАТЕЛЬ ДАШБОРДОВ
  ================================================================ */
  const DashboardSwitcher = (() => {
    let current = 'construction';
    const btn      = document.getElementById('switcher-btn');
    const dropdown = document.getElementById('switcher-dropdown');
    const label    = document.getElementById('switcher-label');
    const navConstruction = document.getElementById('nav-construction');
    const navPothole      = document.getElementById('nav-pothole');

    function openDropdown() {
      dropdown.style.display = 'block';
      dropdown.classList.add('open');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
      dropdown.style.display = 'none';
      dropdown.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function switchTo(dashboard) {
      current = dashboard;
      closeDropdown();
      dropdown.querySelectorAll('.switcher-option').forEach(o => {
        o.classList.toggle('active', o.dataset.dashboard === dashboard);
      });
      if (dashboard === 'construction') {
        label.textContent = 'Строительство';
        navConstruction.style.display = '';
        navPothole.style.display      = 'none';
        Router.navigate('dashboard');
      } else {
        label.textContent = 'Ямочный ремонт';
        navConstruction.style.display = 'none';
        navPothole.style.display      = '';
        Router.navigate('pothole-dashboard');
      }
    }
    function init() {
      if (!btn || !dropdown) return;
      dropdown.style.display = 'none';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.style.display === 'none' ? openDropdown() : closeDropdown();
      });
      dropdown.querySelectorAll('.switcher-option').forEach(opt => {
        opt.addEventListener('click', () => switchTo(opt.dataset.dashboard));
      });
      document.addEventListener('click', e => {
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
    }
    return { init, switchTo, getCurrent: () => current };
  })();

  /* ================================================================
     2. НАВИГАЦИЯ
  ================================================================ */
  function initNavigation() {
    document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
      item.addEventListener('click', () => Router.navigate(item.dataset.nav));
    });
  }

  /* ================================================================
     3. МОДАЛЬНЫЙ ФОН
  ================================================================ */
  function initModalBackdrop() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
  }

  /* ================================================================
     4. САЙДБАР
  ================================================================ */
  function initSidebar() {
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const sidebar     = document.getElementById('sidebar');
    if (!collapseBtn || !sidebar) return;
    collapseBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) mobileBtn.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
  }

  /* ================================================================
     5. РЕГИСТРАЦИЯ РОУТОВ
     Единственное место регистрации. Все модули НЕ регистрируют Router самостоятельно.
  ================================================================ */
  function registerPages() {
    // Строительство
    Router.register('dashboard',
      () => typeof DashboardPage   !== 'undefined' && DashboardPage.render());
    Router.register('contracts',
      () => typeof ContractsPage   !== 'undefined' && ContractsPage.render());
    Router.register('contractors',
      () => typeof ContractorsPage !== 'undefined' && ContractorsPage.render());
    // Ямочный ремонт
    Router.register('pothole-dashboard',
      () => typeof PotholePage !== 'undefined' && PotholePage.refresh());
    Router.register('pothole-reports',
      () => typeof PotholePage !== 'undefined' && PotholePage.refreshReports());
  }

  /* ================================================================
     6. ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
     init() каждого модуля — только привязка слушателей, НЕ регистрация Router.
  ================================================================ */
  function initModules() {
    if (typeof DashboardPage   !== 'undefined') DashboardPage.init();
    if (typeof ContractsPage   !== 'undefined') ContractsPage.init();
    if (typeof ContractorsPage !== 'undefined') ContractorsPage.init();
    if (typeof PotholePage     !== 'undefined') PotholePage.init();
  }

  /* ================================================================
     7. СТАРТ
  ================================================================ */
  document.addEventListener('DOMContentLoaded', async () => {
    Theme.init();

    // 1. Данные первыми
    if (typeof AppData !== 'undefined') {
      try { await AppData.load(); }
      catch (e) { console.warn('[app] AppData.load() failed:', e); }
    }

    // 2. Модули (привязка слушателей)
    initModules();

    // 3. Регистрация роутов
    registerPages();

    // 4. UI
    initNavigation();
    DashboardSwitcher.init();
    initModalBackdrop();
    initSidebar();
    // NOTE: observeCards() убран — IntersectionObserver ставил opacity:0 на все
    // карточки пока страницы были display:none, и они никогда не восстанавливались.
    // Анимация появления карточек теперь через CSS transition в layout.css.

    // 5. Первый экран
    Router.navigate('dashboard');
  });

  window.DashboardSwitcher = DashboardSwitcher;
})();
