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
  const navConstruction = document.getElementById('nav-construction');
  const navPothole      = document.getElementById('nav-pothole');

  function switchTo(dashboard) {
    current = dashboard;
    if (dashboard === 'construction') {
      navConstruction.style.display = '';
      navPothole.style.display      = 'none';
      Router.navigate('dashboard');
    } else {
      navConstruction.style.display = 'none';
      navPothole.style.display      = '';
      Router.navigate('pothole-dashboard');
    }
  }

  function init() {
    // Нет UI-кнопки — ничего не инициализируем
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
    Router.register('pothole-rating',
      () => typeof PotholePage !== 'undefined' && PotholePage.refreshRating());
    // Содержание
    Router.register('pothole-maintenance',
      () => typeof PotholeMaintenance !== 'undefined' && PotholeMaintenance.init());
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
    initSidebar();

    // 5. Первый экран:
    //    Если перешли с главной с ?dashboard=pothole — открываем ямочный ремонт,
    //    если ?dashboard=construction (или нет параметра) — открываем строительство.
    const urlParams    = new URLSearchParams(window.location.search);
    const dashboardParam = urlParams.get('dashboard');

    if (dashboardParam === 'pothole') {
      DashboardSwitcher.switchTo('pothole');
    } else {
      Router.navigate('dashboard');
    }
  });

  window.DashboardSwitcher = DashboardSwitcher;
})();
