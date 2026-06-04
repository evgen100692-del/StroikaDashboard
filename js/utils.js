/**
 * utils.js — Formatting helpers, toast, theme, number animation
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
    if (!container) {
      container = document.getElementById('toast-container');
    }
    return container;
  }
  function show(message, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    el.innerHTML = `<span style="font-weight:700;color:var(--color-${type === 'info' ? 'info' : type})">${icons[type]||'•'}</span><span>${message}</span>`;
    getContainer().appendChild(el);
    setTimeout(() => {
      el.classList.add('hiding');
      setTimeout(() => el.remove(), 250);
    }, duration);
  }
  return { show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

// ---- Theme ----
const Theme = (() => {
  let current;
  function init() {
    current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    apply();
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }
  function apply() {
    document.documentElement.setAttribute('data-theme', current);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = current === 'dark' ? sunIcon() : moonIcon();
    if (typeof ChartsManager !== 'undefined') ChartsManager.updateTheme?.();
  }
  function toggle() {
    current = current === 'dark' ? 'light' : 'dark';
    apply();
  }
  function isDark() { return current === 'dark'; }
  function sunIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`;
  }
  function moonIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`;
  }
  return { init, toggle, isDark };
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
    // Deactivate all
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Activate target
    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');

    const navItem = document.querySelector(`[data-nav="${id}"]`);
    if (navItem) navItem.classList.add('active');

    // Update header title
    const titleMap = {
      dashboard: 'Дашборд',
      contracts: 'Контракты',
      contractors: 'Подрядчики',
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

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Close on Escape
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

// ---- IntersectionObserver for card entry animations ----
function observeCards() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.kpi-card, .card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 400ms ease, transform 400ms cubic-bezier(0.16,1,0.3,1)';
    io.observe(el);
  });
}
