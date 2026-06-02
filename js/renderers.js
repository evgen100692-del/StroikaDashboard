
window.renderers = {
  getData(){
    const state = window.dashboardState;
    const contracts = [...state.rawData.contracts, ...state.additions.contracts];
    const objects = [...state.rawData.objects, ...state.additions.objects];
    const contractors = [...state.rawData.svod, ...state.additions.contractors];
    const { contractor, workType, search, readiness } = state.filters;

    const filteredContracts = contracts.filter(item => {
      const contractorOk = contractor === 'all' || item.contractor === contractor;
      const typeOk = workType === 'all' || item.workType === workType;
      const searchOk = utils.searchMatch(item, search);
      return contractorOk && typeOk && searchOk;
    });

    const filteredObjects = objects.filter(item => {
      const contractorOk = contractor === 'all' || item.contractor === contractor;
      const readinessVal = Number(item.readinessNow || 0);
      const readinessOk = readinessVal >= Number(readiness || 0);
      const searchOk = utils.searchMatch(item, search);
      return contractorOk && readinessOk && searchOk;
    });

    const contractorSet = new Set(filteredContracts.map(x => x.contractor).filter(Boolean));
    const filteredContractors = contractors.filter(x => contractor === 'all' ? (contractorSet.has(x.contractor) || !filteredContracts.length) : x.contractor === contractor);

    return { contractors, contracts, objects, filteredContracts, filteredObjects, filteredContractors };
  },

  renderOverview(){
    const { filteredContracts, filteredObjects, filteredContractors } = this.getData();
    const root = document.getElementById('tab-overview');
    const paidTotal = utils.sum(filteredContracts,'paidTotal');
    const contractValue = utils.sum(filteredContracts,'contractValue');
    const doneTotal = utils.sum(filteredContracts,'doneTotal');
    const avgReadiness = utils.avg(filteredObjects,'readinessNow');
    const outstanding = utils.sum(filteredContractors,'advanceOutstanding');
    const cashGap = utils.sum(filteredObjects,'cashGap');
    const contractorsTop = [...filteredContractors].sort((a,b)=>(b.contractSum||0)-(a.contractSum||0)).slice(0,7);
    const yearly = ['2026','2027','2028','2029'].map(y => utils.sum(filteredContracts, 'limit' + y));
    const laggingObjects = [...filteredObjects].filter(x => Number(x.readinessNow||0) < 50).sort((a,b)=>(a.readinessNow||0)-(b.readinessNow||0)).slice(0,5);

    root.innerHTML = `
      <div class="hero-note">В дашборд загружены реальные данные из прикреплённого Excel. Этот экран уже можно использовать как демонстрационный сценарий для руководства: ключевые KPI, фильтры, интерактивные графики и детализация по подрядчикам, контрактам и объектам.</div>
      <div class="kpi-grid">
        <article class="card kpi-card"><span class="kpi-label">Всего контрактов</span><strong class="kpi-value mono">${utils.formatNum(filteredContracts.length)}</strong><span class="kpi-sub">По данным из Excel</span></article>
        <article class="card kpi-card"><span class="kpi-label">Сумма контрактов</span><strong class="kpi-value mono">${utils.formatMoney(contractValue)}</strong><span class="kpi-sub">Загружено в аналитику</span></article>
        <article class="card kpi-card"><span class="kpi-label">Оплачено всего</span><strong class="kpi-value mono">${utils.formatMoney(paidTotal)}</strong><span class="kpi-sub">Выполнено: ${utils.formatMoney(doneTotal)}</span></article>
        <article class="card kpi-card"><span class="kpi-label">Средняя готовность</span><strong class="kpi-value mono">${utils.formatPct(avgReadiness)}</strong><span class="kpi-sub">По объектам фильтра</span></article>
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
          <div class="panel-title"><h2>Управленческие акценты</h2><span class="chip">Для презентации</span></div>
          <div class="insight-list">
            <div class="insight-item"><i class="ri-wallet-3-line"></i><div><strong>Неотработанный аванс</strong><div class="muted mono">${utils.formatMoney(outstanding)}</div></div></div>
            <div class="insight-item"><i class="ri-alarm-warning-line"></i><div><strong>Кассовый разрыв</strong><div class="muted mono">${utils.formatMoney(cashGap)}</div></div></div>
            <div class="insight-item"><i class="ri-building-4-line"></i><div><strong>Объектов в выборке</strong><div class="muted mono">${utils.formatNum(filteredObjects.length)}</div></div></div>
          </div>
          <div class="insight-list">
            ${laggingObjects.map(item => `<div class="insight-item"><i class="ri-focus-2-line"></i><div><strong>${item.object}</strong><div class="muted">${item.contractor || '—'} · готовность ${utils.formatPct(item.readinessNow)}</div></div></div>`).join('') || '<div class="empty-state">Нет проблемных объектов в текущем срезе</div>'}
          </div>
        </article>
      </div>`;

    chartFactory.contractorBar(document.getElementById('contractorBarChart'), contractorsTop.map(x=>x.contractor), contractorsTop.map(x=>x.paidTotal||0), contractorsTop.map(x=>x.doneTotal||0));
    chartFactory.financeDonut(document.getElementById('financeDonutChart'), [paidTotal, outstanding, Math.max(contractValue - paidTotal - outstanding, 0)]);
    chartFactory.timeline(document.getElementById('limitsTimelineChart'), ['2026','2027','2028','2029'], yearly);
  },

  renderContractors(){
    const { filteredContractors } = this.getData();
    const root = document.getElementById('tab-contractors');
    const rows = filteredContractors.length ? filteredContractors.map(item => `
      <tr>
        <td>${item.contractor || '—'}</td>
        <td class="mono">${utils.formatNum(item.contractsTotal)}</td>
        <td class="mono">${utils.formatMoney(item.contractSum)}</td>
        <td class="mono">${utils.formatMoney(item.paidTotal)}</td>
        <td class="mono">${utils.formatMoney(item.doneTotal)}</td>
        <td><div class="progress"><span style="width:${Math.min(((item.paidPct||0) <= 1 ? (item.paidPct||0)*100 : (item.paidPct||0)),100)}%"></span></div></td>
        <td class="mono">${utils.formatMoney(item.advanceOutstanding)}</td>
        <td class="mono">${utils.formatMoney(item.limit2026)}</td>
      </tr>`).join('') : '<tr><td colspan="8" class="empty-state">Нет данных по текущему фильтру</td></tr>';

    root.innerHTML = `
      <article class="card section-stack">
        <div class="panel-title"><h2>Подрядчики</h2><span class="chip">${filteredContractors.length} записей</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Подрядчик</th><th>Контракты</th><th>Сумма ГК</th><th>Оплачено</th><th>Выполнено</th><th>% оплаты</th><th>Неотработанный аванс</th><th>Лимит 2026</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>`;
  },

  renderContracts(){
    const { filteredContracts } = this.getData();
    const root = document.getElementById('tab-contracts');
    const biggest = [...filteredContracts].sort((a,b)=>(b.contractValue||0)-(a.contractValue||0)).slice(0,15);
    root.innerHTML = `
      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Крупнейшие контракты</h2><span class="chip">Топ по стоимости</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Проект</th><th>Подрядчик</th><th>Тип</th><th>Стоимость</th><th>Оплачено</th><th>% выполнения</th></tr></thead>
              <tbody>${biggest.map(item=>`<tr><td>${item.project||'—'}</td><td>${item.contractor||'—'}</td><td>${item.workType||'—'}</td><td class="mono">${utils.formatMoney(item.contractValue)}</td><td class="mono">${utils.formatMoney(item.paidTotal)}</td><td><span class="${utils.statusClass((item.donePct||0) <= 1 ? (item.donePct||0)*100 : (item.donePct||0))}">${utils.formatPct(item.donePct)}</span></td></tr>`).join('')}</tbody>
            </table>
          </div>
        </article>
        <article class="card section-stack">
          <div class="panel-title"><h2>Реестр контрактов</h2><span class="chip">${filteredContracts.length}</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Контракт №</th><th>Проект</th><th>План ввода</th><th>Срок контракта</th><th>Оплачено 2026</th><th>Остаток 2026</th></tr></thead>
              <tbody>${filteredContracts.slice(0,30).map(item=>`<tr><td>${item.contractNo||'—'}</td><td>${item.project||'—'}</td><td>${item.finishPlan||'—'}</td><td>${item.contractDeadline||'—'}</td><td class="mono">${utils.formatMoney(item.paid2026)}</td><td class="mono">${utils.formatMoney(item.balance2026)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </article>
      </div>`;
  },

  renderObjects(){
    const { filteredObjects } = this.getData();
    const root = document.getElementById('tab-objects');
    const points = filteredObjects.slice(0,50).map(item=>({x:Number(item.readinessNow)||0,y:Number(item.workers)||0,r:Math.max(5, Math.min(18, (Number(item.machines)||0)/2 || 6))}));
    root.innerHTML = `
      <div class="grid-2">
        <article class="card section-stack">
          <div class="panel-title"><h2>Готовность / рабочие / техника</h2><span class="chip">Оперативный срез</span></div>
          <div class="chart-wrap"><canvas id="readinessScatterChart"></canvas></div>
        </article>
        <article class="card section-stack">
          <div class="panel-title"><h2>Реестр объектов</h2><span class="chip">${filteredObjects.length}</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Объект</th><th>Подрядчик</th><th>Готовность</th><th>Рабочие</th><th>Техника</th><th>Кассовый разрыв</th></tr></thead>
              <tbody>${filteredObjects.slice(0,35).map(item=>`<tr><td>${item.object||'—'}</td><td>${item.contractor||'—'}</td><td><span class="${utils.statusClass(item.readinessNow)}">${utils.formatPct(item.readinessNow)}</span></td><td class="mono">${utils.formatNum(item.workers)}</td><td class="mono">${utils.formatNum(item.machines)}</td><td class="mono">${utils.formatMoney(item.cashGap)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </article>
      </div>`;
    chartFactory.readinessScatter(document.getElementById('readinessScatterChart'), points);
  },

  renderForms(){
    const root = document.getElementById('tab-forms');
    root.innerHTML = `
      <div class="hero-note">Этот блок показывает будущий сценарий ввода данных: новые подрядчики, контракты и объекты могут заноситься через интерфейс и сразу отражаться в аналитике. Для демонстрации руководству это подчёркивает, что система не только показывает отчёты, но и может стать рабочим инструментом ввода.</div>
      <div class="grid-2">
        <article class="card form-card">
          <div class="panel-title"><h2>Добавить подрядчика</h2><span class="chip">Свод</span></div>
          <form id="contractorForm">
            <div class="form-grid">
              <label><span>Название</span><input name="contractor" required /></label>
              <label><span>Кол-во контрактов</span><input name="contractsTotal" type="number" step="1" /></label>
              <label><span>Сумма ГК</span><input name="contractSum" type="number" step="0.01" /></label>
              <label><span>Оплачено</span><input name="paidTotal" type="number" step="0.01" /></label>
              <label><span>% оплаты (0-1)</span><input name="paidPct" type="number" step="0.01" /></label>
              <label><span>Лимит 2026</span><input name="limit2026" type="number" step="0.01" /></label>
            </div>
            <button class="primary-btn" type="submit">Добавить подрядчика</button>
          </form>
        </article>

        <article class="card form-card">
          <div class="panel-title"><h2>Добавить контракт</h2><span class="chip">Контур финансирования</span></div>
          <form id="contractForm">
            <div class="form-grid">
              <label><span>Проект</span><input name="project" required /></label>
              <label><span>Подрядчик</span><input name="contractor" required /></label>
              <label><span>Контракт №</span><input name="contractNo" /></label>
              <label><span>Тип работ</span><input name="workType" /></label>
              <label><span>Стоимость</span><input name="contractValue" type="number" step="0.01" /></label>
              <label><span>Оплачено</span><input name="paidTotal" type="number" step="0.01" /></label>
              <label><span>Выполнено</span><input name="doneTotal" type="number" step="0.01" /></label>
              <label><span>% выполнения (0-1)</span><input name="donePct" type="number" step="0.01" /></label>
            </div>
            <button class="primary-btn" type="submit">Добавить контракт</button>
          </form>
        </article>
      </div>
      <article class="card form-card">
        <div class="panel-title"><h2>Добавить объект</h2><span class="chip">Оперативный блок</span></div>
        <form id="objectForm">
          <div class="form-grid">
            <label><span>Объект</span><input name="object" required /></label>
            <label><span>Подрядчик</span><input name="contractor" required /></label>
            <label><span>Готовность %</span><input name="readinessNow" type="number" step="0.1" /></label>
            <label><span>Рабочие</span><input name="workers" type="number" step="1" /></label>
            <label><span>Техника</span><input name="machines" type="number" step="1" /></label>
            <label><span>Кассовый разрыв</span><input name="cashGap" type="number" step="0.01" /></label>
          </div>
          <button class="primary-btn" type="submit">Добавить объект</button>
        </form>
      </article>`;
    window.forms.bind();
  },

  renderAll(){
    this.renderOverview();
    this.renderContractors();
    this.renderContracts();
    this.renderObjects();
    this.renderForms();
  }
};
