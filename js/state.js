
window.dashboardState = {
  rawData: null,
  filters: { contractor: 'all', workType: 'all', search: '', readiness: 0 },
  ui: { activeTab: 'overview', theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
  additions: { contractors: [], contracts: [], objects: [] },
  charts: {}
};
