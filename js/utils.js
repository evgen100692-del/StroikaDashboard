
window.utils = {
  formatMoney(value){ if(value == null || isNaN(value)) return '—'; return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(value) + ' тыс. ₽'; },
  formatNum(value){ if(value == null || isNaN(value)) return '—'; return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(value); },
  formatPct(value){ if(value == null || isNaN(value)) return '—'; return (value <= 1 ? value * 100 : value).toFixed(1).replace('.', ',') + '%'; },
  safe(v){ return (v ?? '').toString().trim(); },
  statusClass(v){ const n = Number(v || 0); if(n >= 70) return 'status-dot'; if(n >= 35) return 'status-dot warning'; return 'status-dot danger'; },
  uniq(arr){ return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ru')); },
  sum(arr, key){ return arr.reduce((acc, item)=> acc + (Number(item[key]) || 0), 0); },
  avg(arr, key){ return arr.length ? this.sum(arr, key) / arr.length : 0; },
  searchMatch(item, q){ if(!q) return true; const hay = Object.values(item).join(' ').toLowerCase(); return hay.includes(q.toLowerCase()); },
  el(tag, cls, html){ const node = document.createElement(tag); if(cls) node.className = cls; if(html !== undefined) node.innerHTML = html; return node; }
};
