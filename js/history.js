/* ============================================================
   history.js — хранение истории изменений объектов
   Формат в localStorage:
   key: 'stroika_history_v1'
   value: [
     { date: '2026-06-02', objects: [ { object, readinessNow, workers, machines, limit2026, contractor, omsu }, ... ] },
     ...
   ]
   Максимум 52 снимка (год)
   ============================================================ */
window.history_db = (() => {
  const KEY     = 'stroika_history_v1';
  const MAX_SNAP = 52;

  /* ── Чтение ────────────────────────────────────────── */
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  /* ── Запись ────────────────────────────────────────── */
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.warn('[history] localStorage full, trimming...'); }
  }

  /* ── Создать снимок текущего состояния ────────────── */
  function takeSnapshot(label) {
    const raw = window.dashboardState.rawData;
    if (!raw || !raw.objects || raw.objects.length === 0) return null;

    const dateStr = label || new Date().toISOString().slice(0, 10);
    const snap = {
      date: dateStr,
      ts:   Date.now(),
      objects: raw.objects.map(o => ({
        object:       o.object       || '',
        omsu:         o.omsu         || '',
        contractor:   o.contractor   || '',
        readinessNow: Number(o.readinessNow) || 0,
        workers:      Number(o.workers)      || 0,
        machines:     Number(o.machines)     || 0,
        limit2026:    Number(o.limit2026)    || 0,
      }))
    };

    const history = load();
    // Удаляем снимок с тем же днём (если есть) и добавляем новый
    const filtered = history.filter(s => s.date !== dateStr);
    filtered.push(snap);
    filtered.sort((a, b) => a.date.localeCompare(b.date));
    // Ограничиваем количество снимков
    if (filtered.length > MAX_SNAP) filtered.splice(0, filtered.length - MAX_SNAP);
    save(filtered);
    return snap;
  }

  /* ── Удалить снимок ─────────────────────────────────── */
  function deleteSnapshot(date) {
    const filtered = load().filter(s => s.date !== date);
    save(filtered);
  }

  /* ── Гет всех объектов из всех снимков ─────────────── */
  function allObjectNames() {
    const names = new Set();
    load().forEach(snap => snap.objects.forEach(o => { if (o.object) names.add(o.object); }));
    return [...names].sort();
  }

  /* ── Серия данных для одного объекта, по периоду ───────── */
  function seriesFor(objectName, field, periodDays) {
    const all = load();
    if (!all.length) return { labels: [], data: [] };
    const cutoff = periodDays
      ? new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10)
      : '1970-01-01';
    const filtered = all.filter(s => s.date >= cutoff);
    const labels = [];
    const data   = [];
    filtered.forEach(snap => {
      const obj = snap.objects.find(o => o.object === objectName);
      if (!obj) return;
      labels.push(snap.date);
      let val = Number(obj[field]) || 0;
      // Приводим readiness к %
      if (field === 'readinessNow' && val <= 1) val = +(val * 100).toFixed(1);
      data.push(val);
    });
    return { labels, data };
  }

  /* ── Серия для группы объектов (фильтр по подрядчику) ────── */
  function seriesMulti(objectNames, field, periodDays) {
    const all = load();
    if (!all.length) return { labels: [], datasets: [] };
    const cutoff = periodDays
      ? new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10)
      : '1970-01-01';
    const snaps = all.filter(s => s.date >= cutoff);
    const labels = [...new Set(snaps.map(s => s.date))].sort();
    const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
    const datasets = objectNames.slice(0, 8).map((name, i) => ({
      label: name,
      data: labels.map(date => {
        const snap = snaps.find(s => s.date === date);
        if (!snap) return null;
        const obj = snap.objects.find(o => o.object === name);
        if (!obj) return null;
        let val = Number(obj[field]) || 0;
        if (field === 'readinessNow' && val <= 1) val = +(val * 100).toFixed(1);
        return val;
      }),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      tension: 0.35,
      pointRadius: 4,
      spanGaps: true,
    }));
    return { labels, datasets };
  }

  /* ── Средняя готовность по всем объектам по датам ───────── */
  function avgReadinessByDate(periodDays) {
    const cutoff = periodDays
      ? new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10)
      : '1970-01-01';
    const snaps = load().filter(s => s.date >= cutoff);
    const labels = snaps.map(s => s.date);
    const data   = snaps.map(snap => {
      const vals = snap.objects.map(o => {
        const v = Number(o.readinessNow) || 0;
        return v <= 1 ? v * 100 : v;
      });
      return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
    });
    return { labels, data };
  }

  /* ── Количество рабочих / техники по датам ───────────── */
  function resourcesByDate(field, periodDays) {
    const cutoff = periodDays
      ? new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10)
      : '1970-01-01';
    const snaps = load().filter(s => s.date >= cutoff);
    return {
      labels: snaps.map(s => s.date),
      data:   snaps.map(snap => snap.objects.reduce((sum, o) => sum + (Number(o[field]) || 0), 0))
    };
  }

  /* ── Импорт / Экспорт ──────────────────────────────── */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stroika-history-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data)) throw new Error('not array');
          save(data);
          resolve(data.length);
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { load, takeSnapshot, deleteSnapshot, allObjectNames, seriesFor, seriesMulti, avgReadinessByDate, resourcesByDate, exportJSON, importJSON, clear };
})();
