// js/pages/pothole-rating.js
// Модуль для страницы «Рейтинг» — управление метаданными (протяжённость сети, население)

const PotholeRating = (() => {
  'use strict';

  // ── Состояние ──────────────────────────────────────────────────────────────
  let _meta      = [];          // все записи из /api/pothole/metadata
  let _ruadNames = [];          // список РУАД из последних отчётов
  let _moNames   = [];          // список МО из последних отчётов

  // Активная вкладка в каждом модале: 'ruad' | 'mo'
  let _netActiveTab = 'ruad';
  let _popActiveTab = 'ruad';

  // ── Инициализация ──────────────────────────────────────────────────────────
  function init(ruadNames, moNames) {
    _ruadNames = ruadNames || [];
    _moNames   = moNames   || [];
    _bindButtons();
  }

  // Обновить списки имён (вызывается при перезагрузке данных в PotholePage)
  function updateNames(ruadNames, moNames) {
    _ruadNames = ruadNames || [];
    _moNames   = moNames   || [];
  }

  // ── Привязка кнопок на странице рейтинга ───────────────────────────────────
  function _bindButtons() {
    const btnNet = document.getElementById('ph-rating-btn-network');
    const btnPop = document.getElementById('ph-rating-btn-population');
    if (btnNet) btnNet.addEventListener('click', () => _openModal('network'));
    if (btnPop) btnPop.addEventListener('click', () => _openModal('population'));

    _bindModal('network');
    _bindModal('population');
  }

  // ── Открыть модал ──────────────────────────────────────────────────────────
  async function _openModal(type) {
    // Загружаем актуальные метаданные
    try {
      const r = await fetch('/api/pothole/metadata');
      _meta = await r.json();
    } catch(e) {
      _meta = [];
    }

    if (type === 'network') {
      _netActiveTab = 'ruad';
      _renderModalContent('network', _netActiveTab);
      openModal('ph-meta-network-modal');
    } else {
      _popActiveTab = 'ruad';
      _renderModalContent('population', _popActiveTab);
      openModal('ph-meta-population-modal');
    }
  }

  // ── Привязка вкладок и сохранения внутри модала ────────────────────────────
  function _bindModal(type) {
    const modalId  = type === 'network' ? 'ph-meta-network-modal' : 'ph-meta-population-modal';
    const modal    = document.getElementById(modalId);
    if (!modal) return;

    // Вкладки
    modal.querySelectorAll('[data-meta-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.metaTab;
        if (type === 'network') _netActiveTab = tab;
        else                    _popActiveTab  = tab;
        _renderModalContent(type, tab);
        modal.querySelectorAll('[data-meta-tab]').forEach(b => b.classList.toggle('active', b.dataset.metaTab === tab));
      });
    });

    // Кнопка «Сохранить»
    const saveBtn = modal.querySelector('[data-meta-save]');
    if (saveBtn) saveBtn.addEventListener('click', () => _saveModal(type));
  }

  // ── Рендер содержимого (таблица с инпутами) ────────────────────────────────
  function _renderModalContent(type, tab) {
    const modalId = type === 'network' ? 'ph-meta-network-modal' : 'ph-meta-population-modal';
    const modal   = document.getElementById(modalId);
    if (!modal) return;

    const body    = modal.querySelector('.ph-meta-body');
    const orgType = tab === 'ruad' ? 'ruad' : 'mo';
    const names   = tab === 'ruad' ? _ruadNames : _moNames;
    const field   = type === 'network' ? 'net_length' : 'population';
    const label   = type === 'network' ? 'Протяжённость сети (км)' : 'Население (чел.)';
    const placeholder = type === 'network' ? 'например: 123.45' : 'например: 50000';

    // Обновить активную вкладку визуально
    modal.querySelectorAll('[data-meta-tab]').forEach(b =>
      b.classList.toggle('active', b.dataset.metaTab === tab)
    );

    if (!names.length) {
      body.innerHTML = `
        <div class="ph-meta-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Нет данных. Загрузите отчёты ямочного ремонта, чтобы список ${tab === 'ruad' ? 'РУАД' : 'МО'} заполнился автоматически.</p>
        </div>`;
      return;
    }

    const rows = names.map(name => {
      const existing = _meta.find(m => m.org_type === orgType && m.name === name);
      const val      = existing ? (existing[field] !== null ? existing[field] : '') : '';
      return `
        <tr>
          <td class="ph-meta-name-cell">${_esc(name)}</td>
          <td>
            <input
              class="ph-meta-input form-input"
              type="number"
              min="0"
              step="${type === 'network' ? '0.01' : '1'}"
              placeholder="${placeholder}"
              data-org="${_esc(orgType)}"
              data-name="${_esc(name)}"
              value="${val}"
            />
          </td>
        </tr>`;
    }).join('');

    body.innerHTML = `
      <div class="ph-meta-hint">${label}</div>
      <div class="data-table-wrap">
        <table class="data-table ph-meta-table">
          <thead>
            <tr>
              <th>${tab === 'ruad' ? 'РУАД' : 'МО'}</th>
              <th>${label}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Сохранение всех инпутов модала ─────────────────────────────────────────
  async function _saveModal(type) {
    const modalId = type === 'network' ? 'ph-meta-network-modal' : 'ph-meta-population-modal';
    const modal   = document.getElementById(modalId);
    if (!modal) return;

    const field   = type === 'network' ? 'net_length' : 'population';
    const inputs  = modal.querySelectorAll('.ph-meta-input');
    const saveBtn = modal.querySelector('[data-meta-save]');

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Сохранение...'; }

    let errCount = 0;
    const promises = Array.from(inputs).map(async inp => {
      const org_type = inp.dataset.org;
      const name     = inp.dataset.name;
      const rawVal   = inp.value.trim();
      try {
        await fetch('/api/pothole/metadata', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ org_type, name, [field]: rawVal === '' ? '' : rawVal }),
        });
      } catch(e) {
        errCount++;
      }
    });

    await Promise.all(promises);

    // Обновить локальный кеш
    try {
      const r = await fetch('/api/pothole/metadata');
      _meta = await r.json();
    } catch(e) { /* ignore */ }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Сохранить'; }

    if (errCount) {
      Toast.error(`Ошибка при сохранении ${errCount} записей`);
    } else {
      Toast.success('Данные сохранены');
      closeModal(modalId);
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

  return { init, updateNames };
})();
