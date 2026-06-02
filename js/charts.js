
window.chartFactory = {
  destroy(id){ if(window.dashboardState.charts[id]) window.dashboardState.charts[id].destroy(); },
  palette(){ const css = getComputedStyle(document.documentElement); return {
    primary: css.getPropertyValue('--color-primary').trim(),
    blue: css.getPropertyValue('--color-blue').trim(),
    warning: css.getPropertyValue('--color-warning').trim(),
    success: css.getPropertyValue('--color-success').trim(),
    purple: css.getPropertyValue('--color-purple').trim(),
    text: css.getPropertyValue('--color-text').trim(),
    muted: css.getPropertyValue('--color-text-muted').trim(),
    divider: css.getPropertyValue('--color-divider').trim()
  }; },
  contractorBar(canvas, labels, paid, done){ this.destroy(canvas.id); const p = this.palette(); window.dashboardState.charts[canvas.id] = new Chart(canvas, {type:'bar', data:{labels,datasets:[{label:'Оплачено',data:paid,backgroundColor:p.primary,borderRadius:8},{label:'Выполнено',data:done,backgroundColor:p.blue,borderRadius:8}]}, options:this.options()}); },
  financeDonut(canvas, values){ this.destroy(canvas.id); const p = this.palette(); window.dashboardState.charts[canvas.id] = new Chart(canvas, {type:'doughnut', data:{labels:['Оплачено','Неотработанный аванс','Остаток'],datasets:[{data:values,backgroundColor:[p.primary,p.warning,p.divider],borderWidth:0}]}, options:{...this.options(), cutout:'68%'}}); },
  timeline(canvas, labels, values){ this.destroy(canvas.id); const p = this.palette(); window.dashboardState.charts[canvas.id] = new Chart(canvas, {type:'line', data:{labels,datasets:[{label:'Лимиты',data:values,borderColor:p.purple,backgroundColor:'transparent',tension:.35,pointRadius:4,pointBackgroundColor:p.purple}]}, options:this.options()}); },
  readinessScatter(canvas, points){ this.destroy(canvas.id); const p = this.palette(); window.dashboardState.charts[canvas.id] = new Chart(canvas, {type:'bubble', data:{datasets:[{label:'Объекты',data:points,backgroundColor:p.primary + 'cc'}]}, options:{...this.options(), scales:{x:{title:{display:true,text:'Готовность %'}},y:{title:{display:true,text:'Рабочие'}}}}}); },
  options(){ const p = this.palette(); return {responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:p.text,font:{family:'Satoshi'}}}, tooltip:{mode:'index',intersect:false}}, scales:{x:{ticks:{color:p.muted},grid:{color:p.divider}},y:{ticks:{color:p.muted},grid:{color:p.divider}}}}; }
};
