// js/pages/pothole-rating.js
// Модуль «Рейтинг» — таблицы рейтинга РУАД и МО по данным ямочного ремонта

const PotholeRating = (() => {
  'use strict';

  // ── Состояние ──────────────────────────────────────────────────────────────
  let _latest    = null;   // последний ответ /api/pothole/latest
  let _meta      = [];     // данные из /api/pothole/metadata
  let _ruadNames = [];
  let _moNames   = [];

  // ── Инициализация ──────────────────────────────────────────────────────────
  function init(ruadNames, moNames) {
    _ruadNames = ruadNames || [];
    _moNames   = moNames   || [];
    _bindButtons();
    _renderInPageContent();
  }

  // ── Привязка кнопок ────────────────────────────────────────────────────────
  function _bindButtons() {
    const btnRuad = document.getElementById('ph-rating-btn-ruad');
    const btnMo   = document.getElementById('ph-rating-btn-mo');

    if (btnRuad) {
      btnRuad.onclick = null;
      btnRuad.addEventListener('click', () => _openModal('ruad'));
    }
    if (btnMo) {
      btnMo.onclick = null;
      btnMo.addEventListener('click', () => _openModal('mo'));
    }
  }

  // ── Открыть модальное окно ─────────────────────────────────────────────────
  async function _openModal(type) {
    await _loadData();

    if (type === 'ruad') {
      _renderModalTable('ruad');
      if (typeof openModal === 'function') openModal('rating-ruad-modal');
    } else {
      _renderModalTable('mo');
      if (typeof openModal === 'function') openModal('rating-mo-modal');
    }
  }

  // ── Загрузка данных с сервера ──────────────────────────────────────────────
  async function _loadData() {
    try {
      const [latestRes, metaRes] = await Promise.all([
        fetch('/api/pothole/latest'),
        fetch('/api/pothole/metadata'),
      ]);
      _latest = await latestRes.json();
      _meta   = await metaRes.json();
    } catch (e) {
      _latest = null;
      _meta   = [];
    }
  }

  // ── Встроенный контент на странице рейтинга ────────────────────────────────
  function _renderInPageContent() {
    const container = document.getElementById('ph-rating-content');
    if (!container) return;

    if (!_ruadNames.length && !_moNames.length) {
      container.innerHTML = `
        <div class="ph-no-data" style="display:flex">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Нет данных. Загрузите отчёты ямочного ремонта — тогда здесь появится сводка по РУАД и МО.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="ph-rating-summary">
        <div class="ph-rating-block">
          <div class="ph-rating-block-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            <span>РУАД — ${_ruadNames.length} организаций</span>
          </div>
          ${_buildMiniTable(_ruadNames, 'ruad')}
        </div>
        <div class="ph-rating-block">
          <div class="ph-rating-block-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
            <span>МО — ${_moNames.length} организаций</span>
          </div>
          ${_buildMiniTable(_moNames, 'mo')}
        </div>
      </div>`;
  }

  // ── Компактная таблица для страницы ───────────────────────────────────────
  function _buildMiniTable(names, orgType) {
    const rows = _buildRows(names, orgType);
    if (!rows.length) {
      return `<p class="ph-rating-empty-hint">Нет данных в последних отчётах</p>`;
    }

    const top3 = rows.slice(0, 3);
    return `
      <table class="data-table ph-rating-mini-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${orgType === 'ruad' ? 'РУАД' : 'МО'}</th>
            <th>Зарег.</th>
            <th>Устр.</th>
            <th>% устр.</th>
          </tr>
        </thead>
        <tbody>
          ${top3.map((r, i) => `
            <tr>
              <td class="ph-rating-rank">${i + 1}</td>
              <td class="ph-rating-name">${_esc(r.name)}</td>
              <td class="num">${_fmt(r.registered)}</td>
              <td class="num">${_fmt(r.fixed)}</td>
              <td class="num">${_badge(r.pct)}</td>
            </tr>`).join('')}
          ${rows.length > 3 ? `
            <tr class="ph-rating-more-row">
              <td colspan="5">
                <span class="ph-rating-more-hint">+ ещё ${rows.length - 3} — нажмите кнопку «Рейтинг ${orgType === 'ruad' ? 'РУАД' : 'МО'}»</span>
              </td>
            </tr>` : ''}
        </tbody>
      </table>`;
  }

  // ── Полная таблица для модального окна ────────────────────────────────────
  function _renderModalTable(orgType) {
    const modalBodyId = orgType === 'ruad' ? 'rating-ruad-body' : 'rating-mo-body';
    const body = document.getElementById(modalBodyId);
    if (!body) return;

    const names = orgType === 'ruad' ? _ruadNames : _moNames;

    if (!names.length) {
      body.innerHTML = `
        <div class="ph-meta-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Нет организаций. Загрузите отчёты типа «${orgType === 'ruad' ? 'Региональный' : 'Муниципальный'}».</p>
        </div>`;
      return;
    }

    const rows    = _buildRows(names, orgType);
    const hasMeta = _meta.some(m => m.org_type === orgType);

    body.innerHTML = `
      <div class="ph-rating-modal-hint">
        Данные из последнего загруженного отчёта.
        ${hasMeta ? 'Нормировка по протяжённости сети и населению — из раздела «Метаданные».' : ''}
      </div>
      <div class="data-table-wrap">
        <table class="data-table ph-rating-full-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>${orgType === 'ruad' ? 'РУАД' : 'МО'}</th>
              <th class="num">Зарег. за день</th>
              <th class="num">Зарег. всего</th>
              <th class="num">Устр. за день</th>
              <th class="num">Устр. всего</th>
              <th class="num">% устр.</th>
              ${hasMeta ? '<th class="num">Сеть (км)</th><th class="num">Население</th><th class="num">Зарег./км</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td class="ph-rating-rank">${i + 1}</td>
                <td class="ph-rating-name">${_esc(r.name)}</td>
                <td class="num">${_fmt(r.registeredDay)}</td>
                <td class="num">${_fmt(r.registered)}</td>
                <td class="num">${_fmt(r.fixedDay)}</td>
                <td class="num">${_fmt(r.fixed)}</td>
                <td class="num">${_badge(r.pct)}</td>
                ${hasMeta ? `
                  <td class="num">${r.netLength  !== null ? _fmtDec(r.netLength)  : '<span class="text-muted">—</span>'}</td>
                  <td class="num">${r.population !== null ? _fmt(r.population)    : '<span class="text-muted">—</span>'}</td>
                  <td class="num">${r.perKm      !== null ? _fmtDec(r.perKm)      : '<span class="text-muted">—</span>'}</td>
                ` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ── Сборка строк рейтинга ─────────────────────────────────────────────────
  function _buildRows(names, orgType) {
    const reportKey  = orgType === 'ruad' ? 'regional' : 'municipal';
    const reportData = (_latest && _latest[reportKey] && _latest[reportKey].data_json) || [];

    return names
      .map(name => {
        const d = Array.isArray(reportData)
          ? reportData.find(r => r.name === name)
          : null;

        const registered    = d ? (d.registered    || 0) : 0;
        const registeredDay = d ? (d.registeredDay  || 0) : 0;
        const fixed         = d ? (d.fixed          || 0) : 0;
        const fixedDay      = d ? (d.fixedDay       || 0) : 0;
        const pct           = registered > 0 ? Math.round(fixed / registered * 1000) / 10 : 0;

        const metaRow    = _meta.find(m => m.org_type === orgType && m.name === name) || null;
        const netLength  = metaRow && metaRow.net_length  != null ? parseFloat(metaRow.net_length)  : null;
        const population = metaRow && metaRow.population  != null ? parseFloat(metaRow.population)  : null;
        const perKm      = netLength && netLength > 0 ? Math.round(registered / netLength * 100) / 100 : null;

        return { name, registered, registeredDay, fixed, fixedDay, pct, netLength, population, perKm };
      })
      // Сортировка: % устранения DESC, затем устранено всего DESC
      .sort((a, b) => b.pct - a.pct || b.fixed - a.fixed);
  }

  // ── Утилиты ───────────────────────────────────────────────────────────────
  function _fmt(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('ru-RU');
  }

  function _fmtDec(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function _badge(pct) {
    if (pct === null || pct === undefined) return '—';
    let cls = 'ph-rating-badge';
    if (pct >= 90)      cls += ' ph-rating-badge--green';
    else if (pct >= 70) cls += ' ph-rating-badge--yellow';
    else                cls += ' ph-rating-badge--red';
    return `<span class="${cls}">${pct}%</span>`;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { init };
})();
