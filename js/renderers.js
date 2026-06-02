window.renderers = {
  pct(v) { const n = Number(v || 0); return n <= 1 ? n * 100 : n; },

  getData() {
    const state = window.dashboardState;
    const contracts   = [...(state.rawData?.contracts  || []), ...state.additions.contracts];
    const objects     = [...(state.rawData?.objects    || []), ...state.additions.objects];
    const contractors = [...(state.rawData?.svod       || []), ...state.additions.contractors];
    const { contractor, workType, search, readiness } = state.filters;

    const filteredContracts = contracts.filter(item => {
      const contractorOk = contractor === 'all' || item.contractor === contractor;
      const wt = item.workType || 'СМР';
      const typeOk = workType === 'all' || wt === workType;
      return contractorOk && typeOk && utils.searchMatch(item, search);
    });
    const filteredObjects = objects.filter(item => {
      const contractorOk = contractor === 'all' || item.contractor === contractor;
      const rNow = this.pct(item.readinessNow);
      return contractorOk && rNow >= Number(readiness || 0) && utils.searchMatch(item, search);
    });
    const contractorSet = new Set(filteredContracts.map(x => x.contractor).filter(Boolean));
    const filteredContractors = contractors.filter(x =>
      contractor === 'all' ? (contractorSet.has(x.contractor) || !filteredContracts.length) : x.contractor === contractor
    );
    return { contractors, contracts, objects, filteredContracts, filteredObjects, filteredContractors };
  },

  renderAll() {
    this.renderOverview();
    this.renderContractors();
    this.renderContracts();
    this.renderObjects();
  },

  renderOverview() {
    const { filteredContracts, filteredObjects, filteredContractors } = this.getData();
    const root = document.getElementById('tab-overview');

    const paidTotal     = utils.sum(filteredContracts, 'paidTotal');
    const contractValue = utils.sum(filteredContracts, 'contractValue');
    const doneTotal     = utils.sum(filteredContracts, 'doneTotal');
    const outstanding   = utils.sum(filteredContractors, 'advanceOutstanding');
    const totalWorkers  = utils.sum(filteredObjects, 'workers');
    const avgReadiness  = filteredObjects.length
      ? filteredObjects.reduce((s, x) => s + this.pct(x.readinessNow), 0) / filteredObjects.length : 0;
    const activeObjects = filteredObjects.filter(x => (x.workers || 0) > 0).length;

    const contractorsTop = [...filteredContractors].sort((a, b) => (b.contractSum || 0) - (a.contractSum || 0)).slice(0, 7);
    const yearly = ['2026','2027','2028','2029'].map(y => utils.sum(filteredContracts, 'limit' + y));
    const laggingObjects = [...filteredObjects]
      .filter(x => this.pct(x.readinessNow) < 50)
      .sort((a, b) => this.pct(a.readinessNow) - this.pct(b.readinessNow))
      .slice(0, 5);

    root.innerHTML = `
      <div class="hero-note">Дашборд содержит реальные данные из Excel (29.05.2026): ${filteredContractors.length} подрядчиков · ${filteredContracts.length} контрактов · ${filteredObjects.length} объектов. Используйте фильтры для детализации.</div>

      <div class="kpi-grid">
        <article class="card kpi-card">
          <span class="kpi-label">Контрактов / Объектов</span>
          <strong class="kpi-value mono">${utils.formatNum(filteredContracts.length)} / ${utils.formatNum(filteredObjects.length)}</strong>
          <span class="kpi-sub">Подрядчиков: ${utils.formatNum(filteredContractors.length)}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Сумма ГК</span>
          <strong class="kpi-value mono">${utils.formatMoneyFull(contractValue)}</strong>
          <span class="kpi-sub">Выполнено: ${utils.formatMoneyFull(doneTotal)}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Оплачено</span>
          <strong class="kpi-value mono">${utils.formatMoneyFull(paidTotal)}</strong>
          <span class="kpi-sub">Неотраб. аванс: ${utils.formatMoneyFull(outstanding)}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Средняя готовность</span>
          <strong class="kpi-value mono">${avgReadiness.toFixed(1).replace('.', ',')}%</strong>
          <span class="kpi-sub">Рабочих: ${utils.formatNum(totalWorkers)} · активных: ${activeObjects}</span>
        </article>
      </div>

      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Топ подрядчиков по сумме ГК</h2><span class="chip">СВОД СМР</span></div>
          <div class="chart-wrap"><canvas id="contractorBarChart"></canvas></div>
        </article>
        <article class="card section-stack">
          <div class="panel-title"><h2>Структура финансирования</h2><span class="chip">Оплаты</span></div>
          <div class="chart-wrap sm"><canvas id="financeDonutChart"></canvas></div>
        </article>
      </div>

      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Лимиты по годам</h2><span class="chip">2026–2029</span></div>
          <div class="chart-wrap sm"><canvas id="limitsTimelineChart"></canvas></div>
        </article>
        <article class="card section-stack">
          <div class="panel-title"><h2>Отстающие объекты (&lt; 50%)</h2><span class="chip">Топ 5</span></div>
          <div class="insight-list">
            ${laggingObjects.map(item => {
              const rNow = this.pct(item.readinessNow);
              const delta = item.weekDelta != null ? this.pct(item.weekDelta) : rNow - this.pct(item.readinessMay22);
              return `<div class="insight-item"><i class="ri-focus-2-line"></i>
                <div>
                  <strong>${item.object || '—'}</strong>
                  <div class="muted">${item.omsu || item.contractor || '—'} · готовность
                    <span class="${rNow < 25 ? 'delta-down' : 'delta-zero'}">${rNow.toFixed(0)}%</span>
                    ${delta !== 0 ? `<span class="${delta > 0 ? 'delta-up' : 'delta-down'}">(${delta > 0 ? '+' : ''}${delta.toFixed(1)}%)</span>` : ''}
                  </div>
                </div></div>`;
            }).join('') || '<div class="empty-state">Нет отстающих</div>'}
          </div>
          <div class="insight-list" style="margin-top:auto;padding-top:.75rem;border-top:1px solid var(--color-divider)">
            <div class="insight-item"><i class="ri-group-line"></i>
              <div><strong>Рабочих на объектах</strong>
              <div class="muted mono">${utils.formatNum(totalWorkers)} чел. · активных: ${activeObjects}</div></div></div>
            <div class="insight-item"><i class="ri-wallet-3-line"></i>
              <div><strong>Неотработанный аванс</strong>
              <div class="muted mono">${utils.formatMoneyFull(outstanding)}</div></div></div>
          </div>
        </article>
      </div>`;

    chartFactory.contractorBar(
      document.getElementById('contractorBarChart'),
      contractorsTop.map(x => x.contractor),
      contractorsTop.map(x => x.paidTotal || 0),
      contractorsTop.map(x => x.doneTotal || 0)
    );
    chartFactory.financeDonut(
      document.getElementById('financeDonutChart'),
      [paidTotal, outstanding, Math.max(contractValue - paidTotal - outstanding, 0)]
    );
    chartFactory.timeline(
      document.getElementById('limitsTimelineChart'),
      ['2026','2027','2028','2029'],
      yearly
    );
  },

  renderContractors() {
    const { filteredContractors } = this.getData();
    const root = document.getElementById('tab-contractors');
    const rows = filteredContractors.length
      ? filteredContractors.map(item => {
          const paidPct = this.pct(item.paidPct);
          return `<tr>
            <td class="col-name">${item.contractor || '—'}</td>
            <td class="num">${utils.formatNum(item.contractsTotal)}</td>
            <td class="num">${utils.formatMoneyFull(item.contractSum)}</td>
            <td class="num">${utils.formatMoneyFull(item.paidTotal)}</td>
            <td class="num">${utils.formatMoneyFull(item.doneTotal)}</td>
            <td style="min-width:130px">
              <div style="display:flex;align-items:center;gap:.5rem">
                <div class="progress" style="flex:1;max-width:none">
                  <span style="width:${Math.min(paidPct, 100)}%"></span>
                </div>
                <span class="mono" style="font-size:.75rem;flex-shrink:0">${paidPct.toFixed(0)}%</span>
              </div>
            </td>
            <td class="num">${utils.formatMoneyFull(item.advanceOutstanding)}</td>
            <td class="num">${utils.formatMoneyFull(item.limit2026)}</td>
            <td class="num">${utils.formatMoneyFull(item.limit2027)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="9" class="empty-state">Нет данных</td></tr>';

    root.innerHTML = `
      <article class="card section-stack">
        <div class="panel-title">
          <h2>Подрядчики — СВОД СМР</h2>
          <span class="chip">${filteredContractors.length} подрядчиков</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Подрядчик</th>
              <th class="num">Контракты</th>
              <th class="num">Сумма ГК</th>
              <th class="num">Оплачено</th>
              <th class="num">Выполнено</th>
              <th>% оплаты</th>
              <th class="num">Неотраб. аванс</th>
              <th class="num">Лимит 2026</th>
              <th class="num">Лимит 2027</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>`;
  },

  renderContracts() {
    const { filteredContracts } = this.getData();
    const root = document.getElementById('tab-contracts');

    const tableRows = filteredContracts.map(item => {
      const donePct = this.pct(item.donePct);
      const cls = donePct >= 80 ? 'delta-up' : donePct >= 40 ? 'delta-zero' : 'delta-down';
      return `<tr>
        <td class="col-tag">${item.contractNo || '—'}</td>
        <td class="col-name">${item.project || '—'}</td>
        <td>${item.contractor || '—'}</td>
        <td class="col-tag"><span class="tag">${item.workType || '—'}</span></td>
        <td class="num">${utils.formatMoneyFull(item.contractValue)}</td>
        <td class="num">${utils.formatMoneyFull(item.paidTotal)}</td>
        <td class="num">${utils.formatMoneyFull(item.doneTotal)}</td>
        <td class="num"><span class="${cls}">${donePct.toFixed(1)}%</span></td>
        <td class="num">${utils.formatMoneyFull(item.paid2026)}</td>
        <td class="num">${utils.formatMoneyFull(item.balance2026)}</td>
        <td class="col-date">${item.finishPlan || '—'}</td>
        <td class="col-date">${item.contractDeadline || '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="12" class="empty-state">Нет данных</td></tr>';

    root.innerHTML = `
      <article class="card section-stack">
        <div class="panel-title">
          <h2>Реестр контрактов</h2>
          <span class="chip">${filteredContracts.length} контрактов</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>№</th>
              <th>Проект</th>
              <th>Подрядчик</th>
              <th>Тип</th>
              <th class="num">Стоимость ГК</th>
              <th class="num">Оплачено</th>
              <th class="num">Выполнено</th>
              <th class="num">% вып.</th>
              <th class="num">Оплачено 2026</th>
              <th class="num">Остаток 2026</th>
              <th>Срок ввода</th>
              <th>Срок ГК</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </article>`;
  },

  renderObjects() {
    const { filteredObjects } = this.getData();
    const root = document.getElementById('tab-objects');

    const totalWorkers  = utils.sum(filteredObjects, 'workers');
    const totalMachines = utils.sum(filteredObjects, 'machines');
    const avgReady = filteredObjects.length
      ? filteredObjects.reduce((s, x) => s + this.pct(x.readinessNow), 0) / filteredObjects.length : 0;

    const tableRows = filteredObjects.map(item => {
      const rNow  = this.pct(item.readinessNow);
      const rPrev = this.pct(item.readinessMay22);
      const delta = item.weekDelta != null ? this.pct(item.weekDelta) : (rNow - rPrev);
      const cls = rNow >= 80 ? 'delta-up' : rNow >= 40 ? 'delta-zero' : 'delta-down';
      return `<tr>
        <td>${item.omsu || '—'}</td>
        <td class="col-name">${item.object || '—'}</td>
        <td>${item.contractor || '—'}</td>
        <td class="num">
          <span class="${cls}">${rNow.toFixed(0)}%</span>
          <div class="progress"><span style="width:${Math.min(rNow,100)}%"></span></div>
        </td>
        <td class="num ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-zero'}">
          ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%
        </td>
        <td class="num">${utils.formatNum(item.workers)}</td>
        <td class="num">${utils.formatNum(item.machines)}</td>
        <td class="num">${utils.formatMoneyFull(item.limit2026)}</td>
        <td class="col-date">${item.finishPlan || '—'}</td>
        <td>${item.financeSource || '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="empty-state">Нет данных</td></tr>';

    root.innerHTML = `
      <div class="kpi-grid">
        <article class="card kpi-card">
          <span class="kpi-label">Объектов в выборке</span>
          <strong class="kpi-value mono">${filteredObjects.length}</strong>
          <span class="kpi-sub">Активных (есть рабочие): ${filteredObjects.filter(x=>x.workers>0).length}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Средняя готовность</span>
          <strong class="kpi-value mono">${avgReady.toFixed(1).replace('.', ',')}%</strong>
          <span class="kpi-sub">Отстающих (&lt;50%): ${filteredObjects.filter(x=>this.pct(x.readinessNow)<50).length}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Рабочих</span>
          <strong class="kpi-value mono">${utils.formatNum(totalWorkers)}</strong>
          <span class="kpi-sub">человек</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Техника</span>
          <strong class="kpi-value mono">${utils.formatNum(totalMachines)}</strong>
          <span class="kpi-sub">единиц</span>
        </article>
      </div>
      <article class="card section-stack">
        <div class="panel-title">
          <h2>Объекты строительства</h2>
          <span class="chip">${filteredObjects.length} объектов</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>ОМСУ</th>
              <th>Объект</th>
              <th>Подрядчик</th>
              <th class="num">Готовность</th>
              <th class="num">Дельта</th>
              <th class="num">Рабочих</th>
              <th class="num">Техника</th>
              <th class="num">Лимит 2026</th>
              <th>Срок ввода</th>
              <th>Финансир.</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </article>`;
  }
};
