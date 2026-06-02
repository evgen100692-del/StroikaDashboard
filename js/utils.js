window.utils = {
  // Суммы в тыс. ₽ (данные в тысячах рублей)
  formatMoney(value) {
    if (value == null || isNaN(value)) return '—';
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' тыс. ₽';
    }
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value) + ' тыс. ₽';
  },
  formatMoneyFull(value) {
    if (value == null || isNaN(value)) return '—';
    // value в тысячах → умножаем на 1000 и показываем в млн ₽
    const rub = value * 1000;
    if (Math.abs(rub) >= 1_000_000_000) return (rub / 1_000_000_000).toFixed(2).replace('.', ',') + ' млрд ₽';
    if (Math.abs(rub) >= 1_000_000)    return (rub / 1_000_000).toFixed(2).replace('.', ',') + ' млн ₽';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(rub) + ' ₽';
  },
  formatNum(value) {
    if (value == null || isNaN(value)) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  },
  formatPct(value) {
    if (value == null || isNaN(value)) return '—';
    return (value <= 1 ? value * 100 : value).toFixed(1).replace('.', ',') + '%';
  },
  safe(v) { return (v ?? '').toString().trim(); },
  statusClass(v) {
    const n = Number(v || 0) * (Number(v) <= 1 ? 100 : 1);
    if (n >= 70) return 'status-dot';
    if (n >= 35) return 'status-dot warning';
    return 'status-dot danger';
  },
  deltaClass(v) {
    const n = Number(v || 0);
    if (n > 0) return 'delta-up';
    if (n < 0) return 'delta-down';
    return 'delta-zero';
  },
  deltaLabel(v) {
    const n = Number(v || 0);
    const s = (n <= 1 && n >= -1 && n !== 0) ? (n * 100).toFixed(1) : Math.abs(n * 100).toFixed(1);
    if (n > 0) return '▲ +' + s + '%';
    if (n < 0) return '▼ −' + Math.abs(n * 100).toFixed(1) + '%';
    return '—';
  },
  uniq(arr) { return [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ru')); },
  sum(arr, key) { return arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0); },
  avg(arr, key) { return arr.length ? this.sum(arr, key) / arr.length : 0; },
  searchMatch(item, q) {
    if (!q) return true;
    const hay = Object.values(item).join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  },
  el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }
};
