window.app = {
  async init() {
    const loadJSON = (url) => new Promise((resolve, reject) => {
      if (window.DASHBOARD_DATA) { resolve(window.DASHBOARD_DATA); return; }
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(e); } };
      xhr.onerror = () => reject(new Error('XHR failed: ' + xhr.status));
      xhr.send();
    });

    try {
      const data = await loadJSON('./data/dashboard-data.json');
      data.svod      = data.svod      || [];
      data.contracts = data.contracts || [];
      data.objects   = data.objects   || [];
      window.dashboardState.rawData = data;
      const s = data.meta?.summary || {};
      console.info(`[Dashboard] Загружено: ${s.contractors || 0} подрядчиков, ${s.contracts || 0} контрактов, ${s.objects || 0} объектов`);
    } catch (e) {
      console.error('Ошибка загрузки данных:', e.message);
      this._showCorsNotice();
      window.dashboardState.rawData = { svod: [], contracts: [], objects: [] };
    }

    document.documentElement.setAttribute('data-theme', window.dashboardState.ui.theme);
    this.setupThemeToggle();
    this.setupTabs();
    this.setupFilters();
    this.populateFilters();
    this.setupActions();
    this.refresh();
  },

  _showCorsNotice() {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px 20px;background:#c0392b;color:#fff;font:14px/1.4 sans-serif;z-index:9999;display:flex;gap:16px;align-items:center';
    div.innerHTML = `
      <strong>⚠️ CORS-ошибка:</strong>
      Файл открыт через <code>file://</code>.
      Используйте: <code style="background:rgba(0,0,0,.3);padding:2px 8px;border-radius:4px">npx serve .</code>
      затем <b>http://localhost:3000/app.html</b>
      <button onclick="this.parentNode.remove()" style="margin-left:auto;background:none;border:1px solid #fff;color:#fff;padding:4px 12px;cursor:pointer;border-radius:4px">Закрыть</button>`;
    document.body.prepend(div);
  },

  refresh() {
    this.populateFilters(true);
    renderers.renderAll();
    const tab = window.dashboardState.ui.activeTab;
    if (tab === 'editor')   editor.render();
    if (tab === 'dynamics') dynamics.render();
  },

  setupThemeToggle() {
    const btn = document.querySelector('[data-theme-toggle]');
    const setIcon = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.innerHTML = dark ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
    };
    setIcon();
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      window.dashboardState.ui.theme = next;
      setIcon();
      this.refresh();
    });
  },

  setupTabs() {
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById('tab-' + tabId).classList.add('active');
        window.dashboardState.ui.activeTab = tabId;
        if (tabId === 'editor')   editor.render();
        if (tabId === 'dynamics') dynamics.render();
      });
    });
  },

  setupFilters() {
    const get = id => document.getElementById(id);
    get('contractorFilter').addEventListener('change', e => { window.dashboardState.filters.contractor = e.target.value; this.refresh(); });
    get('workTypeFilter').addEventListener('change',   e => { window.dashboardState.filters.workType   = e.target.value; this.refresh(); });
    get('searchFilter').addEventListener('input',      e => { window.dashboardState.filters.search     = e.target.value; this.refresh(); });
    get('readinessFilter').addEventListener('input',   e => {
      window.dashboardState.filters.readiness = Number(e.target.value);
      get('readinessValue').textContent = e.target.value + '%';
      this.refresh();
    });
  },

  populateFilters(keepValue = false) {
    const state = window.dashboardState;
    const raw = state.rawData || {};
    const contractors = utils.uniq([...(raw.svod || []), ...state.additions.contractors].map(x => x.contractor));
    const workTypes   = utils.uniq([...(raw.contracts || []), ...state.additions.contracts].map(x => x.workType || 'СМР'));
    const cf = document.getElementById('contractorFilter');
    const wf = document.getElementById('workTypeFilter');
    const prevC = cf.value || state.filters.contractor;
    const prevW = wf.value || state.filters.workType;
    cf.innerHTML = `<option value="all">Все подрядчики</option>${contractors.map(v => `<option value="${v}">${v}</option>`).join('')}`;
    wf.innerHTML = `<option value="all">Все типы работ</option>${workTypes.map(v => `<option value="${v}">${v}</option>`).join('')}`;
    if (keepValue) {
      cf.value = contractors.includes(prevC) ? prevC : 'all';
      wf.value = workTypes.includes(prevW)   ? prevW : 'all';
    }
  },

  setupActions() {
    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
      window.dashboardState.filters = { contractor: 'all', workType: 'all', search: '', readiness: 0 };
      ['contractorFilter','workTypeFilter'].forEach(id => document.getElementById(id).value = 'all');
      document.getElementById('searchFilter').value    = '';
      document.getElementById('readinessFilter').value = 0;
      document.getElementById('readinessValue').textContent = '0%';
      this.refresh();
    });
    document.getElementById('demoFillBtn').addEventListener('click', () => {
      window.dashboardState.additions.contractors.push({ contractor: 'Демо-Строй (тест)', contractsTotal: 2, contractSum: 185000, paidTotal: 72000, paidPct: 0.39, doneTotal: 61000, donePct: 0.33, advanceOutstanding: 18500, limit2026: 95000, limit2027: 90000 });
      window.dashboardState.additions.contracts.push({ project: 'Строительство развязки — ДЕМО', contractor: 'Демо-Строй (тест)', contractNo: 'DEMO-2026-01', workType: 'СМР', contractValue: 185000, paidTotal: 72000, doneTotal: 61000, donePct: 0.33, paid2026: 35000, balance2026: 60000, limit2026: 95000, finishPlan: 'да', contractDeadline: '2027-06-30' });
      window.dashboardState.additions.objects.push({ object: 'Развязка ул. Ленина — ДЕМО', omsu: 'Красногорск', contractor: 'Демо-Строй (тест)', readinessNow: 0.42, readinessMay22: 0.39, weekDelta: 0.03, workers: 68, machines: 14, financeSource: 'ФБ', finishPlan: '2027-12-31', limit2026: 95000 });
      this.refresh();
      document.querySelector('[data-tab="objects"]')?.click();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => window.app.init());
