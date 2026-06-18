/**
 * contract-view.js — модальное окно «Просмотр контракта»
 * Использует данные из AppData, вызывается из ContractsPage.openView(id)
 */

const ContractView = (() => {

  function fmt(v) {
    const n = parseFloat(v);
    if (!v && v !== 0) return '<span class="vm-status-no">—</span>';
    if (isNaN(n))     return '<span class="vm-field-value muted">' + esc(String(v)) + '</span>';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
  }

  function fmtMoney(v) {
    const n = parseFloat(v);
    if (!v && v !== 0 || isNaN(n) || n === 0) return '<span class="vm-status-no">—</span>';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' млрд ₽';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' млн ₽';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
  }

  function fmtPct(v) {
    const n = parseFloat(v);
    if (isNaN(n) || n === 0) return '<span class="vm-status-no">0%</span>';
    return n.toFixed(1).replace('.', ',') + '%';
  }

  function fmtDate(v) {
    if (!v) return '<span class="vm-status-no">—</span>';
    try {
      const d = new Date(v);
      if (isNaN(d)) return esc(v);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return esc(v); }
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function pct(a, b) {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!nb || isNaN(na) || isNaN(nb)) return 0;
    return Math.min(Math.round(na / nb * 100), 100);
  }

  function progressBar(val, total, cls) {
    const p = pct(val, total);
    const c = p >= 75 ? 'success' : p >= 40 ? '' : 'warning';
    return `<div class="vm-progress-wrap"><div class="vm-progress-fill ${cls || c}" style="width:${p}%"></div></div>`;
  }

  function field(label, valueHtml, subHtml) {
    return `<div class="vm-field">
      <div class="vm-field-label">${label}</div>
      <div class="vm-field-value">${valueHtml}</div>
      ${subHtml ? '<div class="vm-field-sub">' + subHtml + '</div>' : ''}
    </div>`;
  }

  function section(icon, label, gridCols, ...fields) {
    return `<div class="vm-section">
      <div class="vm-section-header">
        <span class="vm-section-icon">${icon}</span>
        <span class="vm-section-label">${label}</span>
      </div>
      <div class="vm-grid ${gridCols}">${fields.join('')}</div>
    </div>`;
  }

  function readinessBadge(pctVal) {
    const n = parseFloat(pctVal) || 0;
    const cls = n >= 75 ? 'success' : n >= 40 ? 'info' : 'warning';
    return `<span class="vm-badge ${cls}">${n.toFixed(1).replace('.',',')}%</span>`;
  }

  function open(id) {
    const c = AppData.getContractById(id);
    if (!c) return;

    const priceGK   = parseFloat(c.priceGK)   || 0;
    const paidTotal = parseFloat(c.paidTotal)  || 0;
    const completed = parseFloat(c.completed)  || 0;
    const readiness = parseFloat(c.readinessPct) || 0;

    const paidPct      = pct(paidTotal, priceGK);
    const completedPct = pct(completed, priceGK);

    // Источник финансирования badge
    const sourceBadge = c.financingSource
      ? `<span class="vm-badge primary">${esc(c.financingSource)}</span>`
      : '';

    // Подрядчик badge
    const contractorBadge = c.contractor
      ? `<span class="vm-badge">${esc(c.contractor)}</span>`
      : '';

    // Стройготовность
    const readinessBadgeHtml = readinessBadge(readiness);

    const html = `
    <!-- ── Шапка ── -->
    <div class="vm-header">
      <div class="vm-header-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div class="vm-header-body">
        <div class="vm-title">${esc(c.objectName || '—')}</div>
        <div class="vm-meta">
          ${contractorBadge}
          ${sourceBadge}
          ${readinessBadgeHtml}
          ${c.contractNum ? '<span class="vm-badge">№ ' + esc(c.contractNum) + '</span>' : ''}
        </div>
      </div>
    </div>

    <!-- ── Тело ── -->
    <div class="vm-body">

      <!-- Раздел: Договор -->
      ${section(
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        'Контракт',
        'cols-3',
        field('Номер контракта',   c.contractNum  ? esc(c.contractNum)  : '<span class="vm-status-no">—</span>'),
        field('Дата заключения',   fmtDate(c.contractDate)),
        field('Срок контракта',    fmtDate(c.contractEndDate)),
        field('Источник финансирования', c.financingSource ? esc(c.financingSource) : '<span class="vm-status-no">—</span>'),
        field('Плановый ввод по ГП',     fmtDate(c.plannedIntroDate)),
        field('Планируемое открытие',    fmtDate(c.plannedOpenDate))
      )}

      <!-- Раздел: Финансы -->
      <div class="vm-section">
        <div class="vm-section-header">
          <span class="vm-section-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
          <span class="vm-section-label">Финансовые показатели</span>
        </div>
        <div class="vm-grid cols-3">
          ${field('Стоимость ГК',       '<span class="vm-field-value accent">' + fmtMoney(priceGK) + '</span>')}
          ${field('Аванс по ГК',        fmtMoney(c.advanceGK), fmtPct(pct(c.advanceGK, priceGK)) + ' от стоимости')}
          ${field('Выданный аванс',     fmtMoney(c.advancePaid), fmtPct(pct(c.advancePaid, c.advanceGK)) + ' от аванса по ГК')}
          <div class="vm-field">
            <div class="vm-field-label">Оплачено всего</div>
            <div class="vm-field-value">${fmtMoney(paidTotal)}</div>
            ${progressBar(paidTotal, priceGK)}
            <div class="vm-field-sub">${paidPct}% от стоимости ГК</div>
          </div>
          <div class="vm-field">
            <div class="vm-field-label">Выполнено</div>
            <div class="vm-field-value">${fmtMoney(completed)}</div>
            ${progressBar(completed, priceGK)}
            <div class="vm-field-sub">${completedPct}% от стоимости ГК</div>
          </div>
          ${field('Неотработанный аванс', fmtMoney(c.unworkedAdvance))}
        </div>
      </div>

      <!-- Раздел: Данные за годы -->
      <div class="vm-section">
        <div class="vm-section-header">
          <span class="vm-section-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <span class="vm-section-label">Данные за 2025 год</span>
        </div>
        <div class="vm-grid cols-3">
          ${field('Выполнено в 2025', fmtMoney(c.completed2025))}
          ${field('Оплачено в 2025',  fmtMoney(c.paid2025))}
          ${field('Остаток финансирования', fmtMoney(c.remainder))}
        </div>
      </div>

      <!-- Раздел: Лимиты -->
      <div class="vm-section">
        <div class="vm-section-header">
          <span class="vm-section-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
          <span class="vm-section-label">Лимиты по годам</span>
        </div>
        <div class="vm-limits-grid">
          ${['2026','2027','2028','2029'].map(y => `
            <div class="vm-limits-year">
              <div class="vm-limits-year-label">${y}</div>
              <div class="vm-limits-row">
                <div class="vm-limits-item">
                  <span class="vm-limits-item-label">План</span>
                  <span class="vm-limits-item-value">${fmtMoney(c['limit'+y+'was'])}</span>
                </div>
                <div class="vm-limits-item">
                  <span class="vm-limits-item-label">Текущий</span>
                  <span class="vm-limits-item-value">${fmtMoney(c['limit'+y+'cur'])}</span>
                </div>
                ${y === '2026' ? `<div class="vm-limits-item"><span class="vm-limits-item-label">Выпол.</span><span class="vm-limits-item-value">${fmtMoney(c.completed2026)}</span></div>` : ''}
                ${y === '2026' ? `<div class="vm-limits-item"><span class="vm-limits-item-label">Оплач.</span><span class="vm-limits-item-value">${fmtMoney(c.paid2026)}</span></div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Раздел: Ресурсы и статус -->
      ${section(
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        'Ресурсы и статус',
        'cols-4',
        field('Рабочих на объекте', c.workers ? fmt(c.workers) + ' чел.' : '<span class="vm-status-no">—</span>'),
        field('Единиц техники',    c.equipment ? fmt(c.equipment) + ' ед.' : '<span class="vm-status-no">—</span>'),
        field('МОГЭ',              c.moge ? esc(c.moge) : '<span class="vm-status-no">—</span>'),
        field('Статус ДПТ',        c.dptStatus ? '<span style="font-size:var(--text-xs);line-height:1.4">' + esc(c.dptStatus) + '</span>' : '<span class="vm-status-no">—</span>'),
        field('Стройготовность',
          `<div style="display:flex;align-items:center;gap:6px">
             <strong>${readiness.toFixed(1).replace('.',',')}%</strong>
           </div>`,
          progressBar(readiness, 100) + ''),
        field('Изъятие ЗУ',        c.landWithdrawalPct ? parseFloat(c.landWithdrawalPct).toFixed(1).replace('.',',') + '%' : '<span class="vm-status-no">—</span>')
      )}

    </div><!-- /vm-body -->

    <!-- ── Footer ── -->
    <div class="vm-footer">
      <span class="vm-footer-id">ID контракта: ${c.id}</span>
      <div style="display:flex;gap:var(--space-2)">
        <button class="btn btn-secondary" type="button" onclick="closeModal('view-modal')">Закрыть</button>
        <button class="btn btn-primary" type="button" onclick="closeModal('view-modal');ContractsPage.openEdit(${c.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Редактировать
        </button>
      </div>
    </div>
    `;

    document.getElementById('view-modal-content').innerHTML = html;
    openModal('view-modal');
  }

  return { open };
})();
