
window.app = {
  async init(){
    const res = await fetch('./data/dashboard-data.json');
    const data = await res.json();
    window.dashboardState.rawData = data;
    document.documentElement.setAttribute('data-theme', window.dashboardState.ui.theme);
    this.setupThemeToggle();
    this.setupTabs();
    this.setupFilters();
    this.populateFilters();
    this.setupActions();
    this.refresh();
  },

  refresh(){
    this.populateFilters(true);
    renderers.renderAll();
  },

  setupThemeToggle(){
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

  setupTabs(){
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        window.dashboardState.ui.activeTab = btn.dataset.tab;
      });
    });
  },

  setupFilters(){
    const contractorFilter = document.getElementById('contractorFilter');
    const workTypeFilter = document.getElementById('workTypeFilter');
    const searchFilter = document.getElementById('searchFilter');
    const readinessFilter = document.getElementById('readinessFilter');
    const readinessValue = document.getElementById('readinessValue');

    contractorFilter.addEventListener('change', e => { window.dashboardState.filters.contractor = e.target.value; this.refresh(); });
    workTypeFilter.addEventListener('change', e => { window.dashboardState.filters.workType = e.target.value; this.refresh(); });
    searchFilter.addEventListener('input', e => { window.dashboardState.filters.search = e.target.value; this.refresh(); });
    readinessFilter.addEventListener('input', e => { window.dashboardState.filters.readiness = Number(e.target.value); readinessValue.textContent = e.target.value + '%'; this.refresh(); });
  },

  populateFilters(keepValue = false){
    const state = window.dashboardState;
    const contractors = utils.uniq([...(state.rawData?.svod || []), ...state.additions.contractors].map(x => x.contractor));
    const workTypes = utils.uniq([...(state.rawData?.contracts || []), ...state.additions.contracts].map(x => x.workType));
    const contractorFilter = document.getElementById('contractorFilter');
    const workTypeFilter = document.getElementById('workTypeFilter');

    const prevContractor = contractorFilter.value || state.filters.contractor;
    const prevWorkType = workTypeFilter.value || state.filters.workType;

    contractorFilter.innerHTML = `<option value="all">Все подрядчики</option>${contractors.map(v=>`<option value="${v}">${v}</option>`).join('')}`;
    workTypeFilter.innerHTML = `<option value="all">Все типы работ</option>${workTypes.map(v=>`<option value="${v}">${v}</option>`).join('')}`;

    if(keepValue){
      contractorFilter.value = contractors.includes(prevContractor) ? prevContractor : 'all';
      workTypeFilter.value = workTypes.includes(prevWorkType) ? prevWorkType : 'all';
    }
  },

  setupActions(){
    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
      window.dashboardState.filters = { contractor: 'all', workType: 'all', search: '', readiness: 0 };
      document.getElementById('contractorFilter').value = 'all';
      document.getElementById('workTypeFilter').value = 'all';
      document.getElementById('searchFilter').value = '';
      document.getElementById('readinessFilter').value = 0;
      document.getElementById('readinessValue').textContent = '0%';
      this.refresh();
    });

    document.getElementById('demoFillBtn').addEventListener('click', () => {
      window.dashboardState.additions.contractors.push({ contractor:'Новый подрядчик demo', contractsTotal:2, contractSum:125000, paidTotal:46500, paidPct:.37, limit2026:60000, advanceOutstanding:12000, doneTotal:39000 });
      window.dashboardState.additions.contracts.push({ project:'Демо проект', contractor:'Новый подрядчик demo', contractNo:'DEMO-001', workType:'СМР', contractValue:125000, paidTotal:46500, doneTotal:39000, donePct:.31, paid2026:20000, balance2026:40000, contractDeadline:'2027-12-01' });
      window.dashboardState.additions.objects.push({ object:'Демо объект', contractor:'Новый подрядчик demo', readinessNow:42, workers:56, machines:12, cashGap:8300 });
      this.refresh();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => window.app.init());
