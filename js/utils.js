/**
 * utils.js — Formatting helpers, toast, number animation
 */

// ---- Formatting ----
function formatMoney(n, short = false) {
  const v = Number(n) || 0;
  if (short) {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1).replace('.', ',') + ' млрд';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' млн';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + ' тыс';
    return v.toLocaleString('ru-RU');
  }
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₽';
}

function formatMoneyShort(n) { return formatMoney(n, true) + ' ₽'; }

function formatPct(n) {
  const v = Number(n) || 0;
  return v.toFixed(1).replace('.', ',') + '%';
}

function formatDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return s; }
}

function formatNum(n) {
  return (Number(n) || 0).toLocaleString('ru-RU');
}

// ---- Toast ----
const Toast = (() => {
  let container;
  function getContainer() {
    if (!container || !document.contains(container)) {
      container = document.getElementById('toast-container');
      // Если элемент не вставлен в HTML — создаём программно
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }
  function show(message, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const colorVar = type === 'info' ? 'primary' : type;
    el.innerHTML = `<span style="font-weight:700;color:var(--color-${colorVar})">${icons[type]||'•'}</span><span>${message}</span>`;
    getContainer().appendChild(el);
    setTimeout(() => {
      el.classList.add('hiding');
      setTimeout(() => el.remove(), 250);
    }, duration);
  }
  return { show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

// ---- Theme (зафиксирована светлая, переключатель удалён) ----
const Theme = (() => {
  function init() {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  function isDark() { return false; }
  return { init, isDark };
})();

// ---- Number animation ----
function animateCounter(el, from, to, duration = 800, formatter = formatNum) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatter(Math.round(from + (to - from) * ease));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---- Router ----
const Router = (() => {
  const pages = {};
  let active = null;

  function register(id, onActivate) { pages[id] = onActivate; }

  function navigate(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');

    const navItem = document.querySelector(`[data-nav="${id}"]`);
    if (navItem) navItem.classList.add('active');

    const titleMap = {
      dashboard:           'Дашборд',
      contracts:           'Контракты',
      contractors:         'Подрядчики',
      'pothole-dashboard': 'Дашборд',
      'pothole-reports':   'Отчёты',
      'pothole-rating':    'Рейтинг',
    };
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = titleMap[id] || id;

    active = id;
    if (pages[id]) pages[id]();
  }

  return { register, navigate, getActive: () => active };
})();

// ---- Modal helpers ----
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    overlay.querySelector('input, select, textarea')?.focus();
  }
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ---- Confirm dialog ----
function confirmDialog(message, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-message').textContent = message;
  overlay.classList.add('open');
  const yesBtn = document.getElementById('confirm-yes');
  const noBtn  = document.getElementById('confirm-no');
  const cleanup = () => {
    overlay.classList.remove('open');
    yesBtn.replaceWith(yesBtn.cloneNode(true));
    noBtn.replaceWith(noBtn.cloneNode(true));
  };
  document.getElementById('confirm-yes').addEventListener('click', () => { cleanup(); onConfirm(); }, { once: true });
  document.getElementById('confirm-no').addEventListener('click', cleanup, { once: true });
}

// ---- Shared chart helpers ----
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartPalette() {
  return [
    getCSSVar('--chart-1')  || getCSSVar('--color-primary') || '#3b5bdb',
    getCSSVar('--chart-2')  || getCSSVar('--color-success') || '#2a7a3b',
    getCSSVar('--chart-3')  || '#995200',
    getCSSVar('--chart-4')  || getCSSVar('--color-blue')    || '#1265a8',
    getCSSVar('--chart-5')  || '#7048d8',
    getCSSVar('--chart-6')  || getCSSVar('--color-error')   || '#b52a2a',
  ];
}
