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
      <div class="hero-note">Дашборд содержит реальные данные из Excel (29.05.2026): ${filteredContractors.length} подрядчиков, ${filteredContracts.length} контрактов, ${filteredObjects.length} объектов. Используйте фильтры вверху для детализации.</div>
      <div class="kpi-grid">
        <article class="card kpi-card">
          <span class="kpi-label">Контрактов в выборке</span>
          <strong class="kpi-value mono">${utils.formatNum(filteredContracts.length)}</strong>
          <span class="kpi-sub">Объектов: ${utils.formatNum(filteredObjects.length)}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Сумма ГК</span>
          <strong class="kpi-value mono">${utils.formatMoneyFull(contractValue)}</strong>
          <span class="kpi-sub">Выполнено: ${utils.formatMoneyFull(doneTotal)}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Оплачено всего</span>
          <strong class="kpi-value mono">${utils.formatMoneyFull(paidTotal)}</strong>
          <span class="kpi-sub">Неотраб. аванс: ${utils.formatMoneyFull(outstanding)}</span>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Средняя готовность</span>
          <strong class="kpi-value mono">${avgReadiness.toFixed(1).replace('.', ',')}%</strong>
          <span class="kpi-sub">Рабочих на объектах: ${utils.formatNum(totalWorkers)} · активных: ${activeObjects}</span>
        </article>
      </div>
      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Топ подрядчиков по сумме ГК</h2><span class="chip">СВОД СМР</span></div>
          <div class="chart-wrap"><canvas id="contractorBarChart"></canvas></div>
        </article>
        <article class="card section-stack">
          <div class="panel-title"><h2>Структура финансирования</h2><span class="chip">Оплаты и авансы</span></div>
          <div class="chart-wrap sm"><canvas id="financeDonutChart"></canvas></div>
        </article>
      </div>
      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Лимиты по годам</h2><span class="chip">2026–2029</span></div>
          <div class="chart-wrap sm"><canvas id="limitsTimelineChart"></canvas></div>
        </article>
        <article class="card section-stack">
          <div class="panel-title"><h2>Управленческие акценты</h2><span class="chip">Для руководства</span></div>
          <div class="insight-list">
            <div class="insight-item"><i class="ri-group-line"></i>
              <div><strong>Рабочих на объектах</strong>
              <div class="muted mono">${utils.formatNum(totalWorkers)} чел. · активных объектов: ${activeObjects}</div></div></div>
            <div class="insight-item"><i class="ri-wallet-3-line"></i>
              <div><strong>Неотработанный аванс</strong>
              <div class="muted mono">${utils.formatMoneyFull(outstanding)}</div></div></div>
          </div>
          <div class="insight-list" style="margin-top:1rem">
            <div class="panel-title" style="margin-bottom:.5rem"><h3>Отстающие объекты (&lt;50%)</h3></div>
            ${laggingObjects.map(item => `
              <div class="insight-item"><i class="ri-focus-2-line"></i>
                <div>
                  <strong>${item.object || '—'}</strong>
                  <div class="muted">${item.omsu || item.contractor || '—'} · готовность
                    <span class="${this.pct(item.readinessNow) < 25 ? 'delta-down' : 'delta-zero'}">
                      ${this.pct(item.readinessNow).toFixed(0)}%</span>
                  </div>
                </div>
              </div>`).join('') || '<div class="empty-state">Нет отстающих объектов в выборке</div>'}
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
            <td>${item.contractor || '—'}</td>
            <td class="num">${utils.formatNum(item.contractsTotal)}</td>
            <td class="num">${utils.formatMoneyFull(item.contractSum)}</td>
            <td class="num">${utils.formatMoneyFull(item.paidTotal)}</td>
            <td class="num">${utils.formatMoneyFull(item.doneTotal)}</td>
            <td>
              <div class="progress" title="${paidPct.toFixed(1)}%">
                <span style="width:${Math.min(paidPct, 100)}%"></span>
              </div>
              <span class="muted" style="font-size:.75rem">${paidPct.toFixed(0)}%</span>
            </td>
            <td class="num">${utils.formatMoneyFull(item.advanceOutstanding)}</td>
            <td class="num">${utils.formatMoneyFull(item.limit2026)}</td>
            <td class="num">${utils.formatMoneyFull(item.limit2027)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="9" class="empty-state">Нет данных по фильтру</td></tr>';

    root.innerHTML = `
      <article class="card section-stack">
        <div class="panel-title">
          <h2>Подрядчики — СВОД СМР</h2>
          <span class="chip">${filteredContractors.length} подрядчиков</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Подрядчик</th><th>Контракты</th><th>Сумма ГК</th>
              <th>Оплачено</th><th>Выполнено</th><th>% оплаты</th>
              <th>Неотраб. аванс</th><th>Лимит 2026</th><th>Лимит 2027</th>
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
      return `<tr>
        <td>${item.contractNo || '—'}</td>
        <td>${item.project || '—'}</td>
        <td>${item.contractor || '—'}</td>
        <td>${item.workType || '—'}</td>
        <td class="num">${utils.formatMoneyFull(item.contractValue)}</td>
        <td class="num">${utils.formatMoneyFull(item.paidTotal)}</td>
        <td class="num">${utils.formatMoneyFull(item.doneTotal)}</td>
        <td><span class="${utils.statusClass(donePct)}">${donePct.toFixed(1)}%</span></td>
        <td class="num">${utils.formatMoneyFull(item.paid2026)}</td>
        <td class="num">${utils.formatMoneyFull(item.balance2026)}</td>
        <td>${item.finishPlan || '—'}</td>
        <td>${item.contractDeadline || '—'}</td>
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
              <th>№ контракта</th><th>Проект</th><th>Подрядчик</th><th>Тип работ</th>
              <th>Стоимость ГК</th><th>Оплачено</th><th>Выполнено</th><th>% вып.</th>
              <th>Оплачено 2026</th><th>Остаток 2026</th><th>Срок ввода</th><th>Срок ГК</th>
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
    const withDelta = filteredObjects.filter(x => x.weekDelta && Number(x.weekDelta) !== 0);

    const tableRows = filteredObjects.map(item => {
      const rNow  = this.pct(item.readinessNow);
      const rPrev = this.pct(item.readinessMay22);
      const delta = (item.weekDelta != null) ? this.pct(item.weekDelta) : (rNow - rPrev);
      return `<tr>
        <td>${item.omsu || '—'}</td>
        <td>${item.object || '—'}</td>
        <td>${item.contractor || '—'}</td>
        <td><span class="${utils.statusClass(rNow)}">${rNow.toFixed(0)}%</span></td>
        <td class="${utils.deltaClass(delta)}">${utils.deltaLabel(delta / 100)}</td>
        <td class="num">${utils.formatNum(item.workers)}</td>
        <td class="num">${utils.formatNum(item.machines)}</td>
        <td class="num">${utils.formatMoneyFull(item.limit2026)}</td>
        <td>${item.finishPlan || '—'}</td>
        <td>${item.financeSource || '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="empty-state">Нет объектов по текущему фильтру</td></tr>';

    const points = filteredObjects.slice(0, 80).map(item => ({
      x: this.pct(item.readinessNow),
      y: Number(item.workers) || 0,
      r: Math.max(4, Math.min(20, (Number(item.machines) || 0) + 4))
    }));

    root.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:var(--space-5)">
        <article class="card kpi-card">
          <span class="kpi-label">Объектов в выборке</span>
          <strong class="kpi-value mono">${filteredObjects.length}</strong>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Средняя готовность</span>
          <strong class="kpi-value mono">${avgReady.toFixed(1).replace('.', ',')}%</strong>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Рабочих (итого)</span>
          <strong class="kpi-value mono">${utils.formatNum(totalWorkers)}</strong>
        </article>
        <article class="card kpi-card">
          <span class="kpi-label">Техники (итого)</span>
          <strong class="kpi-value mono">${utils.formatNum(totalMachines)}</strong>
        </article>
      </div>
      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Готовность / рабочие / техника</h2><span class="chip">Пузырьковая диаграмма</span></div>
          <div class="chart-wrap"><canvas id="readinessScatterChart"></canvas></div>
        </article>
        <article class="card section-stack">
          <div class="panel-title">
            <h2>Реестр объектов СМР</h2>
            <span class="chip">${filteredObjects.length} · с динамикой: ${withDelta.length}</span>
          </div>
          <div class="table-wrap" style="max-height:420px;overflow:auto">
            <table class="data-table">
              <thead><tr>
                <th>ОМСУ</th><th>Объект</th><th>Подрядчик</th>
                <th>Готовность</th><th>Динамика</th>
                <th>Рабочих</th><th>Техники</th>
                <th>Лимит 2026</th><th>Срок ввода</th><th>Финансирование</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </article>
      </div>`;

    chartFactory.readinessScatter(document.getElementById('readinessScatterChart'), points);
  },

  renderForms() {
    const root = document.getElementById('tab-forms');
    root.innerHTML = `
      <div class="hero-note">Блок оперативного ввода данных. Новые записи сразу отражаются во всех вкладках дашборда.</div>
      <div class="grid-2">
        <article class="card form-card">
          <div class="panel-title"><h2>Добавить подрядчика</h2><span class="chip">Свод</span></div>
          <form id="contractorForm">
            <div class="form-grid">
              <label><span>Название</span><input name="contractor" required /></label>
              <label><span>Кол-во контрактов</span><input name="contractsTotal" type="number" step="1" /></label>
              <label><span>Сумма ГК, тыс. ₽</span><input name="contractSum" type="number" step="0.01" /></label>
              <label><span>Оплачено, тыс. ₽</span><input name="paidTotal" type="number" step="0.01" /></label>
              <label><span>% оплаты (0–1)</span><input name="paidPct" type="number" step="0.01" min="0" max="1" /></label>
              <label><span>Лимит 2026, тыс. ₽</span><input name="limit2026" type="number" step="0.01" /></label>
            </div>
            <button class="primary-btn" type="submit"><i class="ri-add-line"></i> Добавить подрядчика</button>
          </form>
        </article>
        <article class="card form-card">
          <div class="panel-title"><h2>Добавить контракт</h2><span class="chip">Финансирование</span></div>
          <form id="contractForm">
            <div class="form-grid">
              <label><span>Проект</span><input name="project" required /></label>
              <label><span>Подрядчик</span><input name="contractor" required /></label>
              <label><span>Контракт №</span><input name="contractNo" /></label>
              <label><span>Тип работ</span><select name="workType"><option>СМР</option><option>СМР+ПИР</option><option>ПИР</option></select></label>
              <label><span>Стоимость, тыс. ₽</span><input name="contractValue" type="number" step="0.01" /></label>
              <label><span>Оплачено, тыс. ₽</span><input name="paidTotal" type="number" step="0.01" /></label>
              <label><span>Выполнено, тыс. ₽</span><input name="doneTotal" type="number" step="0.01" /></label>
              <label><span>% выполнения (0–1)</span><input name="donePct" type="number" step="0.01" min="0" max="1" /></label>
            </div>
            <button class="primary-btn" type="submit"><i class="ri-add-line"></i> Добавить контракт</button>
          </form>
        </article>
      </div>
      <article class="card form-card">
        <div class="panel-title"><h2>Добавить объект</h2><span class="chip">Оперативный блок</span></div>
        <form id="objectForm">
          <div class="form-grid">
            <label><span>Объект</span><input name="object" required /></label>
            <label><span>ОМСУ</span><input name="omsu" /></label>
            <label><span>Подрядчик</span><input name="contractor" /></label>
            <label><span>Готовность % (0–100)</span><input name="readinessNow" type="number" step="0.1" min="0" max="100" /></label>
            <label><span>Рабочих</span><input name="workers" type="number" step="1" /></label>
            <label><span>Техники</span><input name="machines" type="number" step="1" /></label>
            <label><span>Лимит 2026, тыс. ₽</span><input name="limit2026" type="number" step="0.01" /></label>
            <label><span>Источник финансирования</span><input name="financeSource" /></label>
          </div>
          <button class="primary-btn" type="submit"><i class="ri-add-line"></i> Добавить объект</button>
        </form>
      </article>`;
    window.forms.bind();
  },

  renderAll() {
    this.renderOverview();
    this.renderContractors();
    this.renderContracts();
    this.renderObjects();
    this.renderForms();
  }
};
