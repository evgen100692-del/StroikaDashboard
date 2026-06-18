/**
 * contract-view.js — модальное окно просмотра контракта (read-only)
 * Вызывается через ContractView.open(id)
 */
const ContractView = (() => {

  function fmt(v) {
    const n = parseFloat(v);
    if (!n && n !== 0) return '—';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' млрд ₽';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' млн ₽';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' тыс ₽';
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  function fmtPct(num, denom) {
    if (!denom) return null;
    const p = (num / denom) * 100;
    return p.toFixed(1) + '%';
  }

  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Цвет прогресса
  function pctColor(pct) {
    if (pct >= 75) return 'var(--color-success)';
    if (pct >= 40) return 'var(--color-primary)';
    return 'var(--color-warning)';
  }

  function progressBar(pct, color) {
    const w = Math.min(Math.max(pct || 0, 0), 100);
    return `
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;background:var(--color-surface-offset);border-radius:99px;height:6px;overflow:hidden">
          <div style="width:${w}%;height:100%;background:${color};border-radius:99px;transition:width .6s ease"></div>
        </div>
        <span style="font-size:var(--text-xs);font-weight:700;color:${color};min-width:38px;text-align:right">${w.toFixed(1)}%</span>
      </div>`;
  }

  function statRow(label, value, sub) {
    return `
    <div style="display:flex;flex-direction:column;gap:2px;padding:var(--space-3) 0;border-bottom:1px solid var(--color-divider)">
      <span style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-faint)">${esc(label)}</span>
      <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-text)">${value}</span>
      ${sub ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">${sub}</span>` : ''}
    </div>`;
  }

  function kpiBox(label, value, sub, accent) {
    return `
    <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-1)">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-faint)">${esc(label)}</span>
      <span style="font-size:var(--text-base);font-weight:700;color:${accent || 'var(--color-text)'};font-variant-numeric:tabular-nums">${value}</span>
      ${sub ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">${sub}</span>` : ''}
    </div>`;
  }

  function limitRow(year, was, cur) {
    const w = parseFloat(was) || 0, c = parseFloat(cur) || 0;
    const diff = c - w;
    const diffStr = diff === 0 ? '' : `<span style="font-size:var(--text-xs);font-weight:600;color:${diff>0?'var(--color-success)':'var(--color-error)'};margin-left:6px">${diff>0?'+':''}${(diff/1e6).toFixed(2)} млн</span>`;
    return `
    <div style="display:grid;grid-template-columns:60px 1fr 1fr;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md)">
      <span style="font-size:var(--text-sm);font-weight:700;color:var(--color-text)">${year}</span>
      <div style="display:flex;flex-direction:column;gap:1px">
        <span style="font-size:10px;color:var(--color-text-faint);font-weight:600;text-transform:uppercase">ПЛАН</span>
        <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-text-muted)">${fmt(was)}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:1px">
        <span style="font-size:10px;color:var(--color-text-faint);font-weight:600;text-transform:uppercase">ТЕКУЩИЙ${diffStr}</span>
        <span style="font-size:var(--text-sm);font-weight:700;color:var(--color-text)">${fmt(cur)}</span>
      </div>
    </div>`;
  }

  function badge(text, type) {
    const styles = {
      success: 'background:var(--color-success-bg);color:var(--color-success)',
      warning: 'background:var(--color-warning-bg);color:var(--color-warning)',
      error:   'background:var(--color-error-bg);color:var(--color-error)',
      info:    'background:var(--color-info-bg);color:var(--color-info)',
      neutral: 'background:var(--color-surface-offset);color:var(--color-text-muted)',
    };
    const s = styles[type] || styles.neutral;
    return `<span style="${s};padding:2px 10px;border-radius:99px;font-size:var(--text-xs);font-weight:700">${esc(text)}</span>`;
  }

  function open(id) {
    const c = AppData.getContractById(id);
    if (!c) return;

    const overlay = document.getElementById('view-modal');
    if (!overlay) return;

    const readiness   = parseFloat(c.readinessPct) || 0;
    const readinessColor = pctColor(readiness);

    // Статус ДПТ
    const dptBadgeType = !c.dptStatus || c.dptStatus === '—' ? 'neutral'
      : /утв|принят|одобр/i.test(c.dptStatus) ? 'success'
      : /отказ|отклон/i.test(c.dptStatus) ? 'error'
      : /рассм|согл|ожид/i.test(c.dptStatus) ? 'warning' : 'info';

    overlay.querySelector('#view-modal-body').innerHTML = `

      <!-- ── Подзаголовок: источник, подрядчик, номер контракта ── -->
      <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-5)">
        ${c.financingSource ? badge(c.financingSource, 'info') : ''}
        ${c.contractor     ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted);font-weight:500">Подрядчик: <strong style="color:var(--color-text)">${esc(c.contractor)}</strong></span>` : ''}
        ${c.contractNum    ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">№ ${esc(c.contractNum)}</span>` : ''}
      </div>

      <!-- ── Стройготовность (большой прогресс) ── -->
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:var(--space-4) var(--space-5);margin-bottom:var(--space-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
          <span style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-faint)">Строительная готовность</span>
          <span style="font-size:var(--text-xl);font-weight:700;color:${readinessColor}">${readiness.toFixed(1)}%</span>
        </div>
        ${progressBar(readiness, readinessColor)}
      </div>

      <!-- ── KPI 4-колонки ── -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin-bottom:var(--space-5)">
        ${kpiBox('Стоимость ГК',   fmt(c.priceGK),  '', 'var(--color-text)')}
        ${kpiBox('Выполнено',      fmt(c.completed), fmtPct(c.completed, c.priceGK), 'var(--color-primary)')}
        ${kpiBox('Оплачено всего', fmt(c.paidTotal),  fmtPct(c.paidTotal, c.priceGK), 'var(--color-text)')}
        ${kpiBox('Аванс по ГК',    fmt(c.advanceGK),  fmtPct(c.advanceGK, c.priceGK), 'var(--color-text)')}
      </div>

      <!-- ── Два столбца: Финансы | Сроки и объект ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);margin-bottom:var(--space-5)">

        <!-- Финансовые показатели -->
        <div>
          <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-faint);padding-bottom:var(--space-2);border-bottom:2px solid var(--color-border);margin-bottom:var(--space-1)">Финансы</div>
          ${statRow('Выданный аванс',       fmt(c.advancePaid),      fmtPct(c.advancePaid, c.advanceGK) ? 'от аванса по ГК: ' + fmtPct(c.advancePaid, c.advanceGK) : null)}
          ${statRow('Неотработанный аванс', fmt(c.unworkedAdvance),   fmtPct(c.unworkedAdvance, c.advancePaid) ? fmtPct(c.unworkedAdvance, c.advancePaid) + ' от выданного' : null)}
          ${statRow('Выполнено в 2025',     fmt(c.completed2025),    null)}
          ${statRow('Оплачено в 2025',      fmt(c.paid2025),         null)}
          ${statRow('Выполнено в 2026',     fmt(c.completed2026),    null)}
          ${statRow('Оплачено в 2026',      fmt(c.paid2026),         null)}
          ${statRow('Остаток финансирования', fmt(c.remainder),      null)}
        </div>

        <!-- Сроки и объект -->
        <div>
          <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-faint);padding-bottom:var(--space-2);border-bottom:2px solid var(--color-border);margin-bottom:var(--space-1)">Сроки и объект</div>
          ${statRow('Дата заключения',         fmtDate(c.contractDate),       null)}
          ${statRow('Срок окончания контракта', fmtDate(c.contractEndDate),   null)}
          ${statRow('Плановый срок ввода',      fmtDate(c.plannedIntroDate),  null)}
          ${statRow('Планируемое открытие',     fmtDate(c.plannedOpenDate),   null)}
          ${statRow('Статус ДПТ', c.dptStatus ? badge(c.dptStatus, dptBadgeType) : '—', null)}
          ${statRow('Рабочих / Техника',
            `<span style="display:inline-flex;gap:var(--space-3)">
              <span>👷 ${c.workers || 0} чел.</span>
              <span>🚧 ${c.equipment || 0} ед.</span>
            </span>`, null)}
          ${statRow('Изъятие ЗУ', c.landWithdrawalPct ? progressBar(parseFloat(c.landWithdrawalPct), pctColor(parseFloat(c.landWithdrawalPct))) : '—', null)}
          ${statRow('МОГЭ', esc(c.moge || '—'), null)}
        </div>
      </div>

      <!-- ── Лимиты по годам ── -->
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden">
        <div style="padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-divider);font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-faint)">Лимиты по годам</div>
        <div style="padding:var(--space-2) var(--space-1)">
          ${limitRow('2026', c.limit2026was, c.limit2026cur)}
          ${limitRow('2027', c.limit2027was, c.limit2027cur)}
          ${limitRow('2028', c.limit2028was, c.limit2028cur)}
          ${limitRow('2029', c.limit2029was, c.limit2029cur)}
        </div>
      </div>
    `;

    // Заголовок модала
    overlay.querySelector('#view-modal-title').textContent = c.objectName || 'Просмотр объекта';

    // Кнопка «Редактировать»
    const editBtn = overlay.querySelector('#view-modal-edit-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        closeModal('view-modal');
        ContractsPage.openEdit(id);
      };
    }

    openModal('view-modal');
  }

  return { open };
})();
