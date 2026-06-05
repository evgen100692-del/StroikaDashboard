/**
 * app.js — Главный файл инициализации:
 *   - Router: навигация между страницами
 *   - DashboardSwitcher: переключение Строительство / Ямочный ремонт
 *   - Theme: переключение темы
 *   - Modal: закрытие по клику на оверлей
 *   - Sidebar: сворачивание боковой панели
 */

(function () {
  'use strict';

  /* ================================================================
     1. ПЕРЕКЛЮЧАТЕЛЬ ДАШБОРДОВ (dropdown в шапке)
  ================================================================ */
  const DashboardSwitcher = (() => {
    let current = 'construction'; // 'construction' | 'pothole'

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
        label.textContent = '\u0421\u0442\u0440\u043e\u0438\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u043e';
        navConstruction.style.display = '';
        navPothole.style.display      = 'none';
        Router.navigate('dashboard');
      } else {
        label.textContent = '\u042f\u043c\u043e\u0447\u043d\u044b\u0439 \u0440\u0435\u043c\u043e\u043d\u0442';
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
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
          closeDropdown();
        }
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeDropdown();
      });
    }

    return { init, switchTo, getCurrent: () => current };
  })();

  /* ================================================================
     2. НАВИГАЦИЯ ПО КЛИКУ НА nav-item
  ================================================================ */
  function initNavigation() {
    document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
      item.addEventListener('click', () => {
        Router.navigate(item.dataset.nav);
      });
    });
  }

  /* ================================================================
     3. ЗАКРЫТИЕ МОДАЛКИ ПО КЛИКУ НА ОВЕРЛЕЙ
  ================================================================ */
  function initModalBackdrop() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
  }

  /* ================================================================
     4. СВОРАЧИВАНИЕ САЙДБАРА
  ================================================================ */
  function initSidebar() {
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const sidebar     = document.getElementById('sidebar');
    if (!collapseBtn || !sidebar) return;

    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });

    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }
  }

  /* ================================================================
     5. РЕГИСТРАЦИЯ СТРАНИЦ В ROUTER
     ВАЖНО: registerPages() регистрирует render — ПОЛНЫЙ рендер
     (заполнить фильтры + отрисовать данные), а не только refresh.
     Это исправляет баг пустых select при первой загрузке.
  ================================================================ */
  function registerPages() {
    // Строительство
    // render() = populateFilters() + applyFilters() — нужен при каждом входе на страницу
    Router.register('dashboard',   () => typeof DashboardPage   !== 'undefined' && DashboardPage.render?.());
    Router.register('contracts',   () => typeof ContractsPage   !== 'undefined' && ContractsPage.refresh?.());
    Router.register('contractors', () => typeof ContractorsPage !== 'undefined' && ContractorsPage.refresh?.());

    // Ямочный ремонт
    Router.register('pothole-dashboard', () => typeof PotholePage !== 'undefined' && PotholePage.refresh?.());
    Router.register('pothole-reports',   () => typeof PotholePage !== 'undefined' && PotholePage.refreshReports?.());
  }

  /* ================================================================
     6. ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
     init() вызывается ПОСЛЕ AppData.load() — данные уже в памяти.
     DashboardPage.init() привязывает слушатели фильтров (один раз).
     Router.register() из модулей УДАЛЁН — регистрация только здесь.
  ================================================================ */
  function initModules() {
    if (typeof DashboardPage   !== 'undefined') DashboardPage.init?.();
    if (typeof ContractsPage   !== 'undefined') ContractsPage.init?.();
    if (typeof ContractorsPage !== 'undefined') ContractorsPage.init?.();
    if (typeof PotholePage     !== 'undefined') PotholePage.init?.();
  }

  /* ================================================================
     7. СТАРТ
  ================================================================ */
  document.addEventListener('DOMContentLoaded', async () => {
    // Тема
    Theme.init();

    // 1. Загружаем данные ПЕРВЫМИ — всё остальное зависит от этого
    if (typeof AppData !== 'undefined') {
      try {
        await AppData.load();
      } catch (e) {
        console.warn('[app] AppData.load() failed:', e);
      }
    }

    // 2. Инициализируем модули (привязка слушателей фильтров и т.д.)
    initModules();

    // 3. Регистрируем страницы в Router
    registerPages();

    // 4. Остальная инициализация UI
    initNavigation();
    DashboardSwitcher.init();
    initModalBackdrop();
    initSidebar();
    observeCards();

    // 5. Открываем первую страницу — данные уже загружены, Router уже знает render
    Router.navigate('dashboard');
  });

  window.DashboardSwitcher = DashboardSwitcher;
})();
