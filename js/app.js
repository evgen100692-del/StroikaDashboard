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

      // Обновить активный пункт dropdown
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

      // Скрыть дропдаун сразу
      dropdown.style.display = 'none';

      btn.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.style.display === 'none' ? openDropdown() : closeDropdown();
      });

      dropdown.querySelectorAll('.switcher-option').forEach(opt => {
        opt.addEventListener('click', () => switchTo(opt.dataset.dashboard));
      });

      // Закрыть по клику вне
      document.addEventListener('click', e => {
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
          closeDropdown();
        }
      });

      // Escape закрывает дропдаун
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

    // Мобильное меню
    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }
  }

  /* ================================================================
     5. РЕГИСТРАЦИЯ МОДУЛЕЙ В ROUTER
  ================================================================ */
  function registerPages() {
    // Строительство
    Router.register('dashboard',    () => typeof DashboardPage   !== 'undefined' && DashboardPage.refresh?.());
    Router.register('contracts',    () => typeof ContractsPage   !== 'undefined' && ContractsPage.refresh?.());
    Router.register('contractors',  () => typeof ContractorsPage !== 'undefined' && ContractorsPage.refresh?.());

    // Ямочный ремонт
    Router.register('pothole-dashboard', () => typeof PotholePage !== 'undefined' && PotholePage.refresh?.());
    Router.register('pothole-reports',   () => typeof PotholePage !== 'undefined' && PotholePage.refreshReports?.());
  }

  /* ================================================================
     6. ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ ПО СТРАНИЦАМ
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

    // ── ИСПРАВЛЕНИЕ: загружаем данные ПЕРВЫМИ ──────────────────────
    // AppData.load() тянет контракты с /api/contracts.
    // Если БД пустая — внутри load() сработает seedDemo() и заполнит
    // базу демо-данными. Без этого вызова дашборд всегда пустой.
    if (typeof AppData !== 'undefined') {
      try {
        await AppData.load();
      } catch (e) {
        console.warn('[app] AppData.load() failed:', e);
      }
    }

    // Модули (init после загрузки данных)
    initModules();

    // ── ИСПРАВЛЕНИЕ: привязываем фильтры и кнопку «+ Добавить» ────
    // DashboardPage.bindFilters() вешает слушатели на select'ы
    // и на кнопку добавления контракта. Без этого кнопка мёртвая.
    if (typeof DashboardPage !== 'undefined') {
      DashboardPage.bindFilters?.();
    }

    // Router
    registerPages();

    // Навигация
    initNavigation();

    // Свитчер дашбордов
    DashboardSwitcher.init();

    // Модальный фон
    initModalBackdrop();

    // Сайдбар
    initSidebar();

    // Анимация карточек при появлении
    observeCards();

    // Первая страница: дашборд строительства
    Router.navigate('dashboard');
  });

  // Экспорт для отладки
  window.DashboardSwitcher = DashboardSwitcher;
})();
