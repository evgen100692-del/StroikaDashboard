// js/pages/pothole-rating.js
// Модуль «Метаданные» — заполнение протяжённости сети и населения по PYAD/MO

const PotholeRating = (() => {
  'use strict';

  // ── Состояние ──────────────────────────────────────────────────────────────
  let _meta      = [];   // кэш из /api/pothole/metadata
  let _ruadNames = [];
  let _moNames   = [];

  // активная вкладка в каждом модале: 'ruad' | 'mo'
  let _netTab = 'ruad';
  let _popTab = 'ruad';

  // ── Инициализация ──────────────────────────────────────────────────────────
  function init(ruadNames, moNames) {
    _ruadNames = ruadNames || [];
    _moNames   = moNames   || [];
    _bindButtons();
  }

  // ── Привязка кнопок ────────────────────────────────────────────────────────
  function _bindButtons() {
    const btnNet = document.getElementById('ph-rating-btn-ruad');   // кнопка «Протяжённость сети»
    const btnPop = document.getElementById('ph-rating-btn-mo');     // кнопка «Население»

    if (btnNet) {
      btnNet.onclick = null;
      btnNet.addEventListener('click', () => _openModal('network'));
    }
    if (btnPop) {
      btnPop.onclick = null;
      btnPop.addEventListener('click', () => _openModal('population'));
    }

    // Привязать вкладки и сохранение в обоих модалах
    _bindModalEvents('network');
    _bindModalEvents('population');
  }

  // ── Открыть модальное окно ─────────────────────────────────────────────────
  async function _openModal(type) {
    // Загружаем актуальные метаданные
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

  // ── Привязка событий внутри модала (delegation) ───────────────────────
  function _bindModalEvents(type) {
    const modalId = type === 'network' ? 'rating-ruad-modal' : 'rating-mo-modal';
    const modal   = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', e => {
      // Вкладка
      const tabBtn = e.target.closest('[data-ph-meta-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.phMetaTab;
        if (type === 'network') _netTab = tab;
        else                    _popTab  = tab;
        _renderModalBody(type, tab);
        return;
      }
      // Кнопка «Сохранить»
      const saveBtn = e.target.closest('[data-ph-meta-save]');
      if (saveBtn) {
        _saveModal(type);
      }
    });
  }

  // ── Рендер содержимого модала ───────────────────────────────────────────
  function _renderModalBody(type, tab) {
    const modalId  = type === 'network' ? 'rating-ruad-modal' : 'rating-mo-modal';
    const bodyId   = type === 'network' ? 'rating-ruad-body'  : 'rating-mo-body';
    const body     = document.getElementById(bodyId);
    if (!body) return;

    const orgType     = tab;   // 'ruad' | 'mo'
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
        const val = existing && existing[field] !== null && existing[field] !== undefined
          ? existing[field] : '';
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Сохранить
        </button>
      </div>`;
  }

  // ── Сохранение данных ────────────────────────────────────────────────────────
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
          body:    JSON.stringify({ org_type, name, [field]: rawVal === '' ? '' : rawVal }),
        });
      } catch (e) {
        errCount++;
      }
    }));

    // Обновить кэш
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
    }
  }

  // ── Утилиты ────────────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { init };
})();
