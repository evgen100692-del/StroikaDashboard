// js/pages/pothole-rating.js
// Модуль «Рейтинг» — таблицы рейтинга РУАД и МАД

const PotholeRating = (() => {
  'use strict';

  // ── Состояние ──────────────────────────────────────────────────────────────
  let _meta      = [];   // кэш из /api/pothole/metadata
  let _ruadNames = [];
  let _moNames   = [];
  let _latestRegional   = null;   // последний региональный отчёт
  let _latestComplaints = null;   // последний отчёт по жалобам
  let _latestMunicipal  = null;   // последний муниципальный отчёт

  // активная таблица рейтинга
  let _ratingTab = 'ruad';   // 'ruad' | 'mad'

  // активная вкладка в каждом модале: 'ruad' | 'mo'
  let _netTab = 'ruad';
  let _popTab = 'ruad';

  // ── Инициализация ──────────────────────────────────────────────────────────
  function init(ruadNames, moNames, latestRegional, latestComplaints, latestMunicipal) {
    _ruadNames        = ruadNames        || [];
    _moNames          = moNames          || [];
    _latestRegional   = latestRegional   || null;
    _latestComplaints = latestComplaints || null;
    _latestMunicipal  = latestMunicipal  || null;
    _bindButtons();
    _renderRatingContent();
  }

  // ── Привязка кнопок ────────────────────────────────────────────────────────
  function _bindButtons() {
    const btnNet = document.getElementById('ph-rating-btn-ruad');
    const btnPop = document.getElementById('ph-rating-btn-mo');

    if (btnNet) {
      btnNet.onclick = null;
      btnNet.addEventListener('click', () => _openModal('network'));
    }
    if (btnPop) {
      btnPop.onclick = null;
      btnPop.addEventListener('click', () => _openModal('population'));
    }

    _bindModalEvents('network');
    _bindModalEvents('population');
  }

  // ── Открыть модальное окно ─────────────────────────────────────────────────
  async function _openModal(type) {
    try {
      const r = await fetch('/api/pothole/metadata');
      _meta = await r.json();
    } catch (e) {
      _meta = [];
    }

    if (type === 'network') {
      _netTab = 'ruad';
      _renderModalBody('network', _netTab);
      if (typeof openModal === 'function') openModal('rating-ruad-modal');
    } else {
      _popTab = 'ruad';
      _renderModalBody('population', _popTab);
      if (typeof openModal === 'function') openModal('rating-mo-modal');
    }
  }

  // ── Привязка событий внутри модала (delegation) ────────────────────────────
  function _bindModalEvents(type) {
    const modalId = type === 'network' ? 'rating-ruad-modal' : 'rating-mo-modal';
    const modal   = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', e => {
      const tabBtn = e.target.closest('[data-ph-meta-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.phMetaTab;
        if (type === 'network') _netTab = tab;
        else                    _popTab  = tab;
        _renderModalBody(type, tab);
        return;
      }
      const saveBtn = e.target.closest('[data-ph-meta-save]');
      if (saveBtn) _saveModal(type);
    });
  }

  // ── Рендер содержимого модала ───────────────────────────────────────────────
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
      tableHtml = `
        <div class="ph-meta-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Нет организаций. Загрузите отчёты ямочного ремонта — список ${tab === 'ruad' ? 'РУАД' : 'МО'} заполнится автоматически.</p>
        </div>`;
    } else {
      const rows = names.map(name => {
        const existing = _meta.find(m => m.org_type === orgType && m.name === name);
        const val = (existing && existing[field] != null) ? existing[field] : '';
        return `
          <tr>
            <td class="ph-meta-name-cell">${_esc(name)}</td>
            <td>
              <input
                class="ph-meta-input form-input"
                type="number"
                min="0"
                step="${step}"
                placeholder="${placeholder}"
                data-org="${_esc(orgType)}"
                data-name="${_esc(name)}"
                value="${_esc(String(val))}"
              />
            </td>
          </tr>`;
      }).join('');

      tableHtml = `
        <div class="ph-meta-hint">${fieldLabel}</div>
        <div class="data-table-wrap">
          <table class="data-table ph-meta-table">
            <thead><tr><th>${colLabel}</th><th>${fieldLabel}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    body.innerHTML = `
      ${tabHtml}
      <div class="ph-meta-tab-body">${tableHtml}</div>
      <div class="form-actions" style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border)">
        <button class="btn btn-ghost" type="button" onclick="closeModal('${modalId}')">Отмена</button>
        <button class="btn btn-primary" type="button" data-ph-meta-save>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Сохранить
        </button>
      </div>`;
  }

  // ── Сохранение данных ──────────────────────────────────────────────────────
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
        await fetch('/api/pothole/metadata', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ org_type, name, [field]: rawVal }),
        });
      } catch (e) {
        errCount++;
      }
    }));

    try {
      const r = await fetch('/api/pothole/metadata');
      _meta = await r.json();
    } catch (e) { /* ignore */ }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Сохранить'; }

    if (errCount) {
      if (typeof Toast !== 'undefined') Toast.error(`Ошибка при сохранении ${errCount} записей`);
    } else {
      if (typeof Toast !== 'undefined') Toast.success('Данные сохранены');
      if (typeof closeModal === 'function') closeModal(modalId);
      _renderRatingTable();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  РЕЙТИНГ — общий контейнер
  // ══════════════════════════════════════════════════════════════════════════

  function _renderRatingContent() {
    const container = document.getElementById('ph-rating-content');
    if (!container) return;

    container.innerHTML = `
      <div class="ph-rating-tabs-row">
        <div class="ph-seg" role="group" aria-label="Таблица рейтинга">
          <button class="ph-seg-btn${_ratingTab === 'ruad' ? ' active' : ''}" data-rating-tab="ruad" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            Рейтинг РУАД
          </button>
          <button class="ph-seg-btn${_ratingTab === 'mad' ? ' active' : ''}" data-rating-tab="mad" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            Рейтинг ОМС
          </button>
        </div>
      </div>
      <div id="ph-rating-table-wrap" style="margin-top:var(--space-4)"></div>`;

    container.querySelectorAll('[data-rating-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        _ratingTab = btn.dataset.ratingTab;
        container.querySelectorAll('[data-rating-tab]').forEach(b =>
          b.classList.toggle('active', b.dataset.ratingTab === _ratingTab)
        );
        _renderRatingTable();
      });
    });

    _loadMetaThenRender();
  }

  async function _loadMetaThenRender() {
    try {
      const r = await fetch('/api/pothole/metadata');
      _meta = await r.json();
    } catch (e) {
      _meta = [];
    }
    _renderRatingTable();
  }

  function _renderRatingTable() {
    const wrap = document.getElementById('ph-rating-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = _ratingTab === 'ruad' ? _buildRuadTable() : _buildMadTable();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ТАБЛИЦА РУАД
  // ══════════════════════════════════════════════════════════════════════════

  function _buildRuadTable() {
    if (!_ruadNames.length) {
      return _emptyCard('Загрузите региональные отчёты ямочного ремонта — список РУАД заполнится автоматически.');
    }

    const regData  = (_latestRegional   && _latestRegional.data_json)  ? _latestRegional.data_json  : [];
    const compData = (_latestComplaints && _latestComplaints.data_json) ? _latestComplaints.data_json : null;

    // Жалобы по РУАД: строки type='mad' из complaints.total
    const compByName = {};
    if (compData && compData.total) {
      compData.total
        .filter(r => r.type === 'mad' && r.name !== 'МАД')
        .forEach(r => { compByName[r.name] = r.count; });
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

    const regDate  = _latestRegional   ? _latestRegional.report_date   : null;
    const compDate = _latestComplaints ? _latestComplaints.report_date : null;

    return _buildTable({
      title:    'Рейтинг РУАД',
      subtitle: 'Сортировка по убыванию рейтинга. Чтобы задать протяжённость сети и население — нажмите кнопки в заголовке страницы.',
      colName:  'Наименование РУАД',
      rows,
      regDate,
      compDate,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ТАБЛИЦА МАД
  // ══════════════════════════════════════════════════════════════════════════

  function _buildMadTable() {
    if (!_moNames.length) {
      return _emptyCard('Загрузите муниципальные отчёты ямочного ремонта — список МАД заполнится автоматически.');
    }

    const munData  = (_latestMunicipal  && _latestMunicipal.data_json)  ? _latestMunicipal.data_json  : [];
    const compData = (_latestComplaints && _latestComplaints.data_json) ? _latestComplaints.data_json : null;

    // Жалобы по МАД (МО): строки type='oms' из complaints.total
    const compByName = {};
    if (compData && compData.total) {
      compData.total
        .filter(r => r.type === 'oms' && r.name !== 'ОМС')
        .forEach(r => { compByName[r.name] = r.count; });
    }

    const rows = _moNames.map(name => {
      const munRow = munData.find(r => r.name === name);
      const meta   = _meta.find(m => m.org_type === 'mo' && m.name === name);

      const registered = munRow ? (munRow.registeredTotal ?? munRow.registered ?? 0) : 0;
      const repaired   = munRow ? (munRow.fixedTotal       ?? munRow.fixed       ?? 0) : 0;

      // Попытка найти жалобы по точному имени, затем по нормализованному
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

    const munDate  = _latestMunicipal  ? _latestMunicipal.report_date  : null;
    const compDate = _latestComplaints ? _latestComplaints.report_date : null;

    return _buildTable({
      title:    'Рейтинг МАД',
      subtitle: 'Сортировка по убыванию рейтинга. Чтобы задать протяжённость сети и население — нажмите кнопки в заголовке страницы.',
      colName:  'Наименование МАД',
      rows,
      regDate:  munDate,
      compDate,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Общий построитель таблицы рейтинга
  // ══════════════════════════════════════════════════════════════════════════

  function _buildTable({ title, subtitle, colName, rows, regDate, compDate }) {
    // Сортировка: с рейтингом — по убыванию, без — в конец
    rows.sort((a, b) => {
      if (a.rating !== null && b.rating !== null) return b.rating - a.rating;
      if (a.rating !== null) return -1;
      if (b.rating !== null) return  1;
      return a.name.localeCompare(b.name, 'ru');
    });

    let rank = 1;
    const rowsHtml = rows.map(r => {
      const hasRating = r.rating !== null;
      const rankCell  = hasRating
        ? `<td class="ph-rating-rank">${rank++}</td>`
        : `<td class="ph-rating-rank" style="color:var(--color-text-faint)">—</td>`;

      const netLenStr = r.netLength  != null ? _fmtNum(r.netLength,  2) : _missingBadge('Не задано');
      const popStr    = r.population != null ? _fmtNum(r.population, 0) : _missingBadge('Не задано');
      // complaints: null (нет отчёта) → показываем 0, как и в формуле
      const compStr   = _fmtNum(r.complaints != null ? r.complaints : 0, 0);
      const ratingStr = hasRating
        ? `<span class="ph-rating-score" style="${_ratingColor(r.rating)}">${r.rating.toFixed(4)}</span>`
        : _missingBadge('Недостаточно данных');

      return `<tr>
        ${rankCell}
        <td>${_esc(r.name)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${netLenStr}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${popStr}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${_fmtNum(r.registered, 0)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${_fmtNum(r.repaired,   0)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${compStr}</td>
        <td style="text-align:center">${ratingStr}</td>
      </tr>`;
    }).join('');

    const dateLine = [
      regDate  && ('Отчёт по ремонту: ' + _fmtDate(regDate)),
      compDate && ('Жалобы: ' + _fmtDate(compDate)),
    ].filter(Boolean).join(' · ');

    const formulaHint = `
      <div class="ph-rating-formula-hint">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>`;

    return `
      <article class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${title}</div>
            <div class="card-subtitle">${subtitle}</div>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <div class="data-table-wrap">
            <table class="data-table ph-rating-table">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center">#</th>
                  <th>${colName}</th>
                  <th style="text-align:right">Протяжённость сети, км</th>
                  <th style="text-align:right">Население, чел.</th>
                  <th style="text-align:right">Зарег. с нач. года</th>
                  <th style="text-align:right">Отрем. с нач. года</th>
                  <th style="text-align:right">Жалобы с нач. года</th>
                  <th style="text-align:center">Рейтинг</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </article>`;
  }

  // ── Расчёт рейтинга ────────────────────────────────────────────────────────
  // Обязательные условия для расчёта: netLength и population заданы и > 0.
  // registered, repaired, complaints при null/undefined считаются равными 0.
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

  // ── Утилиты ────────────────────────────────────────────────────────────────

  /** Нормализует имя МО для нечёткого сопоставления с данными жалоб */
  function _normalizeName(name) {
    if (!name) return '';
    return name.trim()
      .toLowerCase()
      .replace(/\s*г\.?о\.?$/i, '')
      .replace(/\s*г\/о$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _emptyCard(msg) {
    return `<article class="card">
      <div class="card-body">
        <div class="ph-rep-empty">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <h3>Нет данных</h3>
          <p>${msg}</p>
        </div>
      </div>
    </article>`;
  }

  function _fmtNum(val, decimals) {
    if (val == null) return '—';
    return Number(val).toLocaleString('ru', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    const d = iso.slice(0, 10).split('-');
    return d[2] + '.' + d[1] + '.' + d[0];
  }

  function _missingBadge(text) {
    return `<span style="font-size:var(--text-xs);color:var(--color-text-faint);font-style:italic">${text}</span>`;
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
