// js/pages/pothole-rating.js
// Модуль «Рейтинг» — таблицы рейтинга РУАД и МАД

const PotholeRating = (() => {
  'use strict';

  let _meta      = [];
  let _ruadNames = [];
  let _moNames   = [];
  let _latestRegional   = null;
  let _latestComplaints = null;
  let _latestMunicipal  = null;

  let _ratingTab = 'ruad';
  let _sortState = { key: 'rating', dir: 'asc' };
  let _netTab = 'ruad';
  let _popTab = 'ruad';

  // Фильтры независимые для каждого таба
  function _emptyFilters() {
    return {
      green:  { min: null, active: false },
      yellow: { min: null, active: false },
      red:    { min: null, active: false },
    };
  }
  let _filtersMap = { ruad: _emptyFilters(), mad: _emptyFilters() };

  // Текущий набор фильтров (ссылка на активный таб)
  function _filters() { return _filtersMap[_ratingTab]; }

  const FILTER_META = {
    green:  { label: 'Зелёный',  color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)'  },
    yellow: { label: 'Жёлтый',  color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)'  },
    red:    { label: 'Красный', color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)'  },
  };

  // ── Инициализация
  function init(ruadNames, moNames, latestRegional, latestComplaints, latestMunicipal) {
    _ruadNames        = ruadNames        || [];
    _moNames          = moNames          || [];
    _latestRegional   = latestRegional   || null;
    _latestComplaints = latestComplaints || null;
    _latestMunicipal  = latestMunicipal  || null;
    _sortState        = { key: 'rating', dir: 'asc' };
    _filtersMap       = { ruad: _emptyFilters(), mad: _emptyFilters() };
    _bindButtons();
    _renderRatingContent();
  }

  // ── Привязка кнопок
  function _bindButtons() {
    const btnNet = document.getElementById('ph-rating-btn-ruad');
    const btnPop = document.getElementById('ph-rating-btn-mo');
    if (btnNet) { btnNet.onclick = null; btnNet.addEventListener('click', () => _openModal('network')); }
    if (btnPop) { btnPop.onclick = null; btnPop.addEventListener('click', () => _openModal('population')); }
    _bindModalEvents('network');
    _bindModalEvents('population');
  }

  // ── Модаль
  async function _openModal(type) {
    try { const r = await fetch('/api/pothole/metadata'); _meta = await r.json(); } catch (e) { _meta = []; }
    if (type === 'network') {
      _netTab = 'ruad'; _renderModalBody('network', _netTab);
      if (typeof openModal === 'function') openModal('rating-ruad-modal');
    } else {
      _popTab = 'ruad'; _renderModalBody('population', _popTab);
      if (typeof openModal === 'function') openModal('rating-mo-modal');
    }
  }

  function _bindModalEvents(type) {
    const modalId = type === 'network' ? 'rating-ruad-modal' : 'rating-mo-modal';
    const modal   = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener('click', e => {
      const tabBtn = e.target.closest('[data-ph-meta-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.phMetaTab;
        if (type === 'network') _netTab = tab; else _popTab = tab;
        _renderModalBody(type, tab); return;
      }
      const saveBtn = e.target.closest('[data-ph-meta-save]');
      if (saveBtn) _saveModal(type);
    });
  }

  function _renderModalBody(type, tab) {
    const modalId  = type === 'network' ? 'rating-ruad-modal' : 'rating-mo-modal';
    const bodyId   = type === 'network' ? 'rating-ruad-body'  : 'rating-mo-body';
    const body     = document.getElementById(bodyId);
    if (!body) return;
    const orgType     = tab;
    const names       = tab === 'ruad' ? _ruadNames : _moNames;
    const field       = type === 'network' ? 'net_length' : 'population';
    const fieldLabel  = type === 'network' ? 'Протяжённость сети (км)' : 'Население (чел.)';
    const placeholder = type === 'network' ? 'например: 123.45' : 'например: 50000';
    const step        = type === 'network' ? '0.01' : '1';
    const colLabel    = tab === 'ruad' ? 'РУАД' : 'МО';
    const tabHtml = `
      <div class="ph-meta-tabs">
        <button class="ph-meta-tab${tab === 'ruad' ? ' active' : ''}" data-ph-meta-tab="ruad" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          РУАД
        </button>
        <button class="ph-meta-tab${tab === 'mo' ? ' active' : ''}" data-ph-meta-tab="mo" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          МО
        </button>
      </div>`;
    let tableHtml;
    if (!names.length) {
      tableHtml = `<div class="ph-meta-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Нет организаций. Загрузите отчёты ямочного ремонта — список ${tab === 'ruad' ? 'РУАД' : 'МО'} заполнится автоматически.</p></div>`;
    } else {
      const rows = names.map(name => {
        const existing = _meta.find(m => m.org_type === orgType && m.name === name);
        const val = (existing && existing[field] != null) ? existing[field] : '';
        return `<tr><td class="ph-meta-name-cell">${_esc(name)}</td><td><input class="ph-meta-input form-input" type="number" min="0" step="${step}" placeholder="${placeholder}" data-org="${_esc(orgType)}" data-name="${_esc(name)}" value="${_esc(String(val))}"/></td></tr>`;
      }).join('');
      tableHtml = `<div class="ph-meta-hint">${fieldLabel}</div><div class="data-table-wrap"><table class="data-table ph-meta-table"><thead><tr><th>${colLabel}</th><th>${fieldLabel}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    body.innerHTML = `
      ${tabHtml}
      <div class="ph-meta-tab-body">${tableHtml}</div>
      <div class="form-actions" style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border)">
        <button class="btn btn-ghost" type="button" onclick="closeModal('${modalId}')">Отмена</button>
        <button class="btn btn-primary" type="button" data-ph-meta-save>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Сохранить
        </button>
      </div>`;
  }

  async function _saveModal(type) {
    const bodyId  = type === 'network' ? 'rating-ruad-body' : 'rating-mo-body';
    const modalId = type === 'network' ? 'rating-ruad-modal' : 'rating-mo-modal';
    const body    = document.getElementById(bodyId);
    if (!body) return;
    const field   = type === 'network' ? 'net_length' : 'population';
    const inputs  = body.querySelectorAll('.ph-meta-input');
    const saveBtn = body.querySelector('[data-ph-meta-save]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Сохранение...'; }
    let errCount = 0;
    await Promise.all(Array.from(inputs).map(async inp => {
      const org_type = inp.dataset.org;
      const name     = inp.dataset.name;
      const rawVal   = inp.value.trim();
      try {
        await fetch('/api/pothole/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_type, name, [field]: rawVal }) });
      } catch (e) { errCount++; }
    }));
    try { const r = await fetch('/api/pothole/metadata'); _meta = await r.json(); } catch (e) {}
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Сохранить'; }
    if (errCount) {
      if (typeof Toast !== 'undefined') Toast.error(`Ошибка при сохранении ${errCount} записей`);
    } else {
      if (typeof Toast !== 'undefined') Toast.success('Данные сохранены');
      if (typeof closeModal === 'function') closeModal(modalId);
      _renderRatingTable();
    }
  }

  // ── Рейтинг — контейнер
  function _renderRatingContent() {
    const container = document.getElementById('ph-rating-content');
    if (!container) return;
    container.innerHTML = `
      <div class="ph-rating-tabs-row">
        <div class="ph-seg" role="group" aria-label="Таблица рейтинга">
          <button class="ph-seg-btn${_ratingTab === 'ruad' ? ' active' : ''}" data-rating-tab="ruad" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span>Рейтинг РУАД</span>
          </button>
          <button class="ph-seg-btn${_ratingTab === 'mad' ? ' active' : ''}" data-rating-tab="mad" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            <span>Рейтинг ОМС</span>
          </button>
        </div>
      </div>
      <div id="ph-rating-table-wrap" style="margin-top:var(--space-4)"></div>`;
    container.querySelectorAll('[data-rating-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        _ratingTab = btn.dataset.ratingTab;
        _sortState = { key: 'rating', dir: 'asc' };
        container.querySelectorAll('[data-rating-tab]').forEach(b =>
          b.classList.toggle('active', b.dataset.ratingTab === _ratingTab));
        _renderRatingTable();
      });
    });
    _loadMetaThenRender();
  }

  async function _loadMetaThenRender() {
    try { const r = await fetch('/api/pothole/metadata'); _meta = await r.json(); } catch (e) { _meta = []; }
    _renderRatingTable();
  }

  function _renderRatingTable() {
    const wrap = document.getElementById('ph-rating-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = _ratingTab === 'ruad' ? _buildRuadTable() : _buildMadTable();
    wrap.querySelectorAll('th[data-sort-key]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        if (_sortState.key === key) _sortState.dir = _sortState.dir === 'asc' ? 'desc' : 'asc';
        else { _sortState.key = key; _sortState.dir = 'asc'; }
        _renderRatingTable();
      });
    });
    _bindFilterEvents(wrap);
  }

  // ── Фильтры (работают с текущим набором)
  function _bindFilterEvents(wrap) {
    const f = _filters();
    ['green', 'yellow', 'red'].forEach(color => {
      const minInput = wrap.querySelector(`[data-filter-min="${color}"]`);
      if (minInput) {
        minInput.addEventListener('input', () => {
          const v = minInput.value.trim();
          f[color].min    = v !== '' ? parseFloat(v) : null;
          f[color].active = f[color].min !== null;
          _applyFilters(wrap);
          _updateClearBtn(wrap, color);
        });
      }
    });
    wrap.querySelectorAll('[data-filter-clear]').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.filterClear;
        _filtersMap[_ratingTab][color] = { min: null, active: false };
        const minI = wrap.querySelector(`[data-filter-min="${color}"]`);
        if (minI) minI.value = '';
        _applyFilters(wrap);
        _updateClearBtn(wrap, color);
      });
    });
    _applyFilters(wrap);
    ['green', 'yellow', 'red'].forEach(color => _updateClearBtn(wrap, color));
  }

  function _updateClearBtn(wrap, color) {
    const btn = wrap.querySelector(`[data-filter-clear="${color}"]`);
    if (!btn) return;
    const active = _filters()[color].active;
    btn.style.opacity = active ? '1' : '0';
    btn.style.pointerEvents = active ? 'auto' : 'none';
  }

  function _applyFilters(wrap) {
    const table = wrap.querySelector('.ph-rating-table');
    if (!table) return;
    const f = _filters();
    const anyActive = Object.values(f).some(v => v.active);
    table.querySelectorAll('tbody tr').forEach(row => {
      const scoreEl = row.querySelector('.ph-rating-score');
      if (!scoreEl) return;
      const val = parseFloat(scoreEl.textContent.replace(',', '.'));
      if (isNaN(val)) return;
      if (!anyActive) { scoreEl.setAttribute('style', _ratingColor(val)); return; }
      let matched = null;
      // Приоритет: green > yellow > red (первый совпавший)
      for (const [color, fc] of Object.entries(f)) {
        if (!fc.active) continue;
        if (fc.min !== null && val >= fc.min) { matched = color; break; }
      }
      if (matched) {
        const m = FILTER_META[matched];
        scoreEl.style.cssText = `color:${m.color};font-weight:700;background:${m.bg};padding:1px 7px;border-radius:9999px;border:1px solid ${m.border};display:inline-block;`;
      } else {
        scoreEl.style.cssText = 'color:var(--color-text-faint);font-weight:400;';
      }
    });
  }

  // ── Блок фильтров (принимает набор фильтров для нужного таба)
  function _buildFiltersHtml(tabFilters) {
    const pills = ['green', 'yellow', 'red'].map(color => {
      const m = FILTER_META[color];
      const f = tabFilters[color];
      const dotStyle   = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color};flex-shrink:0;`;
      const inputStyle = `width:52px;border:none;background:transparent;font-size:11px;color:var(--color-text);outline:none;font-variant-numeric:tabular-nums;padding:0;`;
      const clearStyle = `display:flex;align-items:center;justify-content:center;width:14px;height:14px;padding:0;background:none;border:none;color:var(--color-text-faint);cursor:pointer;border-radius:50%;flex-shrink:0;transition:opacity 0.15s;opacity:${f.active ? '1' : '0'};pointer-events:${f.active ? 'auto' : 'none'};`;
      return `
        <div class="ph-filter-pill" style="display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-full);transition:border-color 0.15s;">
          <span style="${dotStyle}" title="${m.label}"></span>
          <input type="number" step="any" placeholder="от" data-filter-min="${color}" value="${f.min !== null ? f.min : ''}" style="${inputStyle}"/>
          <button data-filter-clear="${color}" type="button" title="Сбросить" style="${clearStyle}"
            onmouseenter="this.style.color='${m.color}'"
            onmouseleave="this.style.color='var(--color-text-faint)'">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/></svg>
          </button>
        </div>`;
    }).join('');
    return `
      <div class="ph-rating-filters" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 16px;border-bottom:1px solid var(--color-border);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2" style="flex-shrink:0"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        ${pills}
      </div>`;
  }

  // ── Таблица РУАД
  function _buildRuadTable() {
    if (!_ruadNames.length) return _emptyCard('Загрузите региональные отчёты ямочного ремонта — список РУАД заполнится автоматически.');
    const regData  = (_latestRegional   && _latestRegional.data_json)  ? _latestRegional.data_json  : [];
    const compData = (_latestComplaints && _latestComplaints.data_json) ? _latestComplaints.data_json : null;
    const compByName = {};
    if (compData && compData.total) {
      compData.total.filter(r => r.type === 'mad' && r.name !== 'МАД').forEach(r => { compByName[r.name] = r.count; });
    }
    const rows = _ruadNames.map(name => {
      const regRow = regData.find(r => r.name === name);
      const meta   = _meta.find(m => m.org_type === 'ruad' && m.name === name);
      const registered = regRow ? (regRow.registeredTotal ?? regRow.registered ?? 0) : 0;
      const repaired   = regRow ? (regRow.fixedTotal       ?? regRow.fixed       ?? 0) : 0;
      const complaints = compByName[name] != null ? compByName[name] : null;
      const netLength  = (meta && meta.net_length  != null) ? meta.net_length  : null;
      const population = (meta && meta.population  != null) ? meta.population  : null;
      const rating     = _calcRating(registered, repaired, complaints, netLength, population);
      return { name, registered, repaired, complaints, netLength, population, rating };
    });
    return _buildTable({ title: 'Рейтинг РУАД', colName: 'Наименование РУАД', rows,
      tabKey:   'ruad',
      regDate:  _latestRegional   ? _latestRegional.report_date   : null,
      compDate: _latestComplaints ? _latestComplaints.report_date : null });
  }

  // ── Таблица МАД
  function _buildMadTable() {
    if (!_moNames.length) return _emptyCard('Загрузите муниципальные отчёты ямочного ремонта — список МАД заполнится автоматически.');
    const munData  = (_latestMunicipal  && _latestMunicipal.data_json)  ? _latestMunicipal.data_json  : [];
    const compData = (_latestComplaints && _latestComplaints.data_json) ? _latestComplaints.data_json : null;
    const compByName = {};
    if (compData && compData.total) {
      compData.total.filter(r => r.type === 'oms' && r.name !== 'ОМС').forEach(r => { compByName[r.name] = r.count; });
    }
    const rows = _moNames.map(name => {
      const munRow = munData.find(r => r.name === name);
      const meta   = _meta.find(m => m.org_type === 'mo' && m.name === name);
      const registered = munRow ? (munRow.registeredTotal ?? munRow.registered ?? 0) : 0;
      const repaired   = munRow ? (munRow.fixedTotal       ?? munRow.fixed       ?? 0) : 0;
      let complaints = compByName[name] != null ? compByName[name] : null;
      if (complaints == null) {
        const normName = _normalizeName(name);
        const found = Object.entries(compByName).find(([k]) => _normalizeName(k) === normName);
        if (found) complaints = found[1];
      }
      const netLength  = (meta && meta.net_length  != null) ? meta.net_length  : null;
      const population = (meta && meta.population  != null) ? meta.population  : null;
      const rating     = _calcRating(registered, repaired, complaints, netLength, population);
      return { name, registered, repaired, complaints, netLength, population, rating };
    });
    return _buildTable({ title: 'Рейтинг ОМС', colName: 'Наименование МАД', rows,
      tabKey:   'mad',
      regDate:  _latestMunicipal  ? _latestMunicipal.report_date  : null,
      compDate: _latestComplaints ? _latestComplaints.report_date : null });
  }

  // ── Построитель таблицы
  function _sortIcon(key) {
    if (_sortState.key !== key) {
      return `<svg class="ph-sort-icon" width="10" height="10" viewBox="0 0 10 14" fill="none"><path d="M5 1L2 5h6L5 1z" fill="currentColor" opacity="0.3"/><path d="M5 13L2 9h6L5 13z" fill="currentColor" opacity="0.3"/></svg>`;
    }
    if (_sortState.dir === 'asc') {
      return `<svg class="ph-sort-icon active" width="10" height="10" viewBox="0 0 10 14" fill="none"><path d="M5 13L2 9h6L5 13z" fill="var(--color-primary)"/><path d="M5 1L2 5h6L5 1z" fill="currentColor" opacity="0.2"/></svg>`;
    }
    return `<svg class="ph-sort-icon active" width="10" height="10" viewBox="0 0 10 14" fill="none"><path d="M5 1L2 5h6L5 1z" fill="var(--color-primary)"/><path d="M5 13L2 9h6L5 13z" fill="currentColor" opacity="0.2"/></svg>`;
  }

  function _buildTable({ title, colName, rows, tabKey, regDate, compDate }) {
    const key = _sortState.key;
    const dir = _sortState.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return a.name.localeCompare(b.name, 'ru');
      if (av == null) return 1;
      if (bv == null) return -1;
      if (key === 'name') return dir * a.name.localeCompare(b.name, 'ru');
      return dir * (av - bv);
    });
    let rank = 1;
    const rowsHtml = rows.map(r => {
      const hasRating = r.rating !== null;
      const rankCell  = hasRating ? `<td class="ph-rating-rank">${rank++}</td>` : `<td class="ph-rating-rank" style="color:var(--color-text-faint)">—</td>`;
      const netLenStr = r.netLength  != null ? _fmtNum(r.netLength,  2) : _missingBadge('Не задано');
      const popStr    = r.population != null ? _fmtNum(r.population, 0) : _missingBadge('Не задано');
      const compStr   = _fmtNum(r.complaints != null ? r.complaints : 0, 0);
      const ratingStr = hasRating
        ? `<span class="ph-rating-score" style="${_ratingColor(r.rating)}">${r.rating.toFixed(4)}</span>`
        : _missingBadge('Недостаточно данных');
      return `<tr>${rankCell}<td>${_esc(r.name)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${netLenStr}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${popStr}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${_fmtNum(r.registered,0)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${_fmtNum(r.repaired,0)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${compStr}</td>
        <td style="text-align:center">${ratingStr}</td></tr>`;
    }).join('');
    const dateLine = [
      regDate  && ('Отчёт по ремонту: ' + _fmtDate(regDate)),
      compDate && ('Жалобы: ' + _fmtDate(compDate)),
    ].filter(Boolean).join(' · ');
    const thRank = `<th style="width:40px;text-align:center;user-select:none">#</th>`;
    const thName = `<th data-sort-key="name" class="ph-th-sort" style="text-align:left">${colName}${_sortIcon('name')}</th>`;
    const thCols = [
      { key: 'netLength',  label: 'Протяжённость сети, км', align: 'right'  },
      { key: 'population', label: 'Население, чел.',        align: 'right'  },
      { key: 'registered', label: 'Зарег. с нач. года',    align: 'right'  },
      { key: 'repaired',   label: 'Отрем. с нач. года',    align: 'right'  },
      { key: 'complaints', label: 'Жалобы с нач. года',    align: 'right'  },
      { key: 'rating',     label: 'Рейтинг',                align: 'center' },
    ].map(c => `<th data-sort-key="${c.key}" class="ph-th-sort" style="text-align:${c.align}">${c.label}${_sortIcon(c.key)}</th>`).join('');
    return `
      <article class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${title}</div>
            ${dateLine ? `<div class="card-subtitle">${dateLine}</div>` : ''}
          </div>
        </div>
        ${_buildFiltersHtml(_filtersMap[tabKey])}
        <div class="card-body" style="padding:0">
          <div class="data-table-wrap">
            <table class="data-table ph-rating-table">
              <thead><tr>${thRank}${thName}${thCols}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </article>`;
  }

  // ── Расчёт рейтинга
  function _calcRating(registered, repaired, complaints, netLength, population) {
    if (netLength == null || netLength === 0) return null;
    if (population == null || population === 0) return null;
    const reg  = registered  != null ? registered  : 0;
    const rep  = repaired    != null ? repaired    : 0;
    const comp = complaints  != null ? complaints  : 0;
    const part1 = (reg  / netLength) * 0.2;
    const part2 = (rep  / netLength) * 0.3;
    const part3 = (1 - (comp / population) * 1000) * 0.5;
    return part1 + part2 + part3;
  }

  function _ratingColor(val) {
    if (val > 0.4)  return 'color:var(--color-success);font-weight:700';
    if (val >= 0.2) return 'color:var(--color-warning);font-weight:700';
    return 'color:var(--color-error);font-weight:700';
  }

  // ── Утилиты
  function _normalizeName(name) {
    if (!name) return '';
    return name.trim().toLowerCase().replace(/\s*г\.?о\.?$/i,'').replace(/\s*г\/о$/i,'').replace(/\s+/g,' ').trim();
  }

  function _emptyCard(msg) {
    return `<article class="card"><div class="card-body"><div class="ph-rep-empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <h3>Нет данных</h3><p>${msg}</p></div></div></article>`;
  }

  function _fmtNum(val, decimals) {
    if (val == null) return '—';
    return Number(val).toLocaleString('ru', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    const d = iso.slice(0,10).split('-');
    return d[2]+'.'+d[1]+'.'+d[0];
  }

  function _missingBadge(text) {
    return `<span style="font-size:var(--text-xs);color:var(--color-text-faint);font-style:italic">${text}</span>`;
  }

  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();
