/* ============================================================
   db.js — постоянное хранилище данных дашборда
   Поверх localStorage: хранит правки сделанные в редакторе.
   ============================================================

   Формат в localStorage (ключ DB_KEY):
   {
     version: 1,
     savedAt: '2026-06-03T09:00:00.000Z',
     objects:   [...],   // полный массив объектов
     contracts: [...],   // полный массив контрактов
     svod:      [...],   // полный массив подрядчиков
   }
   ============================================================ */

window.db = (() => {
  const DB_KEY  = 'stroika_dashboard_db';
  const VERSION = 1;

  /* ── Читаем хранилище ────────────────────────────────────── */
  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== VERSION) return null;   // устаревшая схема
      return parsed;
    } catch (e) {
      console.warn('[db] Ошибка чтения localStorage:', e);
      return null;
    }
  }

  /* ── Пишем хранилище ─────────────────────────────────────── */
  function save(data) {
    try {
      const record = {
        version:   VERSION,
        savedAt:   new Date().toISOString(),
        objects:   data.objects   || [],
        contracts: data.contracts || [],
        svod:      data.svod      || [],
      };
      localStorage.setItem(DB_KEY, JSON.stringify(record));
      return true;
    } catch (e) {
      console.error('[db] Ошибка записи localStorage:', e);
      return false;
    }
  }

  /* ── Накладываем сохранённые правки поверх JSON-файла ────── */
  /*  rawData  — данные из dashboard-data.json                 */
  /*  Возвращает итоговый объект, который кладём в rawData      */
  function applyOverrides(rawData) {
    const stored = load();
    if (!stored) return rawData;   // правок нет — оригинал без изменений

    console.info(
      `[db] Загружены правки от ${
        new Date(stored.savedAt).toLocaleString('ru-RU')
      } (объектов: ${stored.objects.length}, контрактов: ${stored.contracts.length}, подрядчиков: ${stored.svod.length})`
    );

    /* Стратегия: если сохранённый массив не пуст — используем его целиком.
       Пустой массив = правок не было для этой секции, берём из JSON.      */
    return {
      ...rawData,
      objects:   stored.objects.length   ? stored.objects   : rawData.objects,
      contracts: stored.contracts.length ? stored.contracts : rawData.contracts,
      svod:      stored.svod.length      ? stored.svod      : rawData.svod,
    };
  }

  /* ── Удалить все правки (сброс к исходному JSON) ─────────── */
  function clear() {
    try {
      localStorage.removeItem(DB_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ── Есть ли сохранённые правки? ─────────────────────────── */
  function hasSaved() {
    return localStorage.getItem(DB_KEY) !== null;
  }

  /* ── Метаинформация о последнем сохранении ───────────────── */
  function meta() {
    const stored = load();
    if (!stored) return null;
    return {
      savedAt:   stored.savedAt,
      objects:   stored.objects.length,
      contracts: stored.contracts.length,
      svod:      stored.svod.length,
    };
  }

  /* ── Экспорт всей БД в JSON-файл ─────────────────────────── */
  function exportToFile() {
    const stored = load();
    if (!stored) { alert('Нет сохранённых правок для экспорта.'); return; }
    const raw    = window.dashboardState.rawData;
    const out    = JSON.stringify({
      meta:      raw.meta || {},
      svod:      stored.svod,
      contracts: stored.contracts,
      objects:   stored.objects,
    }, null, 2);
    const blob = new Blob([out], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `dashboard-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  return { load, save, applyOverrides, clear, hasSaved, meta, exportToFile };
})();
