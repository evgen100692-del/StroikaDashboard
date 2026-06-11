/**
 * charts-pothole.js — Графики дашборда «Ямочный ремонт»
 * Использует Chart.js (уже подключен в HTML)
 */

const PotholeCharts = (() => {

  // Цвета всегда читаются в момент обращения, не кэшируются
  function textColor()   { return getCSSVar('--color-text')       || '#1e1e1c'; }
  function mutedColor()  { return getCSSVar('--color-text-muted')  || '#6b6b68'; }
  function borderColor() { return getCSSVar('--color-border')      || '#cecece'; }
  function bgColor()     { return getCSSVar('--color-surface')     || '#f9f9f7'; }
  function fontFamily()  { return getCSSVar('--font-body')         || "'Satoshi', 'Inter', sans-serif"; }

  // Храним последние аргументы для каждого графика, чтобы пересоздать при смене темы
  const _last = {
    donuts: {},  // { canvasId: { data, labels } }
    weekly: null // { canvasId, data }
  };

  // ── Плагин центрального текста пончика ───────────────────────────────────────
  // Читает CSS-переменные НЕПОСРЕДСТВЕННО в afterDraw — всегда актуальный цвет
  const centerTextPlugin = {
    id: 'doughnutCenterText',
    afterDraw(chart) {
      const pluginOpts = chart.config.options?.plugins?.doughnutCenterText;
      if (!pluginOpts) return;
      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const cx = (left + right) / 2;
      const cy = (top  + bottom) / 2;
      const ff = fontFamily();
      ctx.save();
      ctx.font         = `700 22px ${ff}`;
      ctx.fillStyle    = textColor();   // ← живое чтение из CSS
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pluginOpts.total.toLocaleString('ru-RU'), cx, cy - 6);
      ctx.font      = `400 11px ${ff}`;
      ctx.fillStyle = mutedColor();     // ← живое чтение из CSS
      ctx.fillText('всего', cx, cy + 14);
      ctx.restore();
    },
  };

  // ── Построение пончика ────────────────────────────────────────────────────
  function _buildDonut(canvasId, data, labels) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const colors = chartPalette();
    const total  = data.reduce((s, v) => s + v, 0);
    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderColor:     bgColor(),
          borderWidth:     3,
          hoverOffset:     8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { animateRotate: true, animateScale: true, duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color:        textColor(),
              font:         { family: fontFamily(), size: 12 },
              padding:      12,
              boxWidth:     12,
              boxHeight:    12,
              borderRadius: 3,
            },
          },
          tooltip: {
            backgroundColor: bgColor(),
            titleColor:      textColor(),
            bodyColor:       mutedColor(),
            borderColor:     borderColor(),
            borderWidth:     1,
            padding:         10,
            callbacks: {
              label: ctx => {
                const val = ctx.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return ` ${ctx.label}: ${val.toLocaleString('ru-RU')} (${pct}%)`;
              },
            },
          },
          doughnutCenterText: { total },
        },
      },
      plugins: [centerTextPlugin],
    });
  }

  function donut(canvasId, data, labels, existingChart) {
    _last.donuts[canvasId] = { data: [...data], labels: [...labels] };
    if (existingChart) {
      existingChart.data.labels           = labels;
      existingChart.data.datasets[0].data = data;
      existingChart.options.plugins.doughnutCenterText.total = data.reduce((s, v) => s + v, 0);
      existingChart.update('active');
      return existingChart;
    }
    return _buildDonut(canvasId, data, labels);
  }

  // ── Построение недельного графика ────────────────────────────────────────
  function _buildWeekly(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const col  = chartPalette();
    const font = fontFamily();
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          {
            label:           'Зарегистрировано ям',
            data:            data.map(d => d.registered),
            backgroundColor: col[0] + 'cc',
            borderColor:     col[0],
            borderWidth:     1,
            borderRadius:    4,
          },
          {
            label:           'Устранено ям',
            data:            data.map(d => d.fixed),
            backgroundColor: col[3] + 'cc',
            borderColor:     col[3],
            borderWidth:     1,
            borderRadius:    4,
          },
          {
            label:           'Жалобы',
            data:            data.map(d => d.complaints),
            backgroundColor: col[1] + 'cc',
            borderColor:     col[1],
            borderWidth:     1,
            borderRadius:    4,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        scales: {
          x: {
            grid:  { color: borderColor() + '55' },
            ticks: { color: mutedColor(), font: { family: font, size: 12 } },
          },
          y: {
            beginAtZero: true,
            grid:  { color: borderColor() + '55' },
            ticks: {
              color:    mutedColor(),
              font:     { family: font, size: 12 },
              callback: v => v.toLocaleString('ru-RU'),
            },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            align:    'start',
            labels:   { color: textColor(), font: { family: font, size: 12 } },
          },
          tooltip: {
            backgroundColor: bgColor(),
            titleColor:      textColor(),
            bodyColor:       mutedColor(),
            borderColor:     borderColor(),
            borderWidth:     1,
            padding:         10,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('ru-RU')}`,
            },
          },
        },
      },
    });
  }

  function weekly(canvasId, data, existingChart) {
    _last.weekly = { canvasId, data };
    if (existingChart) {
      existingChart.data.labels                = data.map(d => d.label);
      existingChart.data.datasets[0].data      = data.map(d => d.registered);
      existingChart.data.datasets[1].data      = data.map(d => d.fixed);
      existingChart.data.datasets[2].data      = data.map(d => d.complaints);
      existingChart.update('active');
      return existingChart;
    }
    return _buildWeekly(canvasId, data);
  }

  // ── Пересоздаёт все графики с актуальными CSS-цветами ────────────────────
  // Вызывается из Theme.apply() при смене темы.
  // Обновляет ссылки в PotholePage._charts если он доступен.
  function updateTheme() {
    // Пончики
    for (const [canvasId, entry] of Object.entries(_last.donuts)) {
      if (!entry) continue;
      // Берём текущий инстанс из PotholePage._charts
      const existing = _getPageChart(canvasId);
      if (existing) { existing.destroy(); }
      const newChart = _buildDonut(canvasId, entry.data, entry.labels);
      _setPageChart(canvasId, newChart);
    }
    // Недельный
    if (_last.weekly) {
      const { canvasId, data } = _last.weekly;
      const existing = _getPageChart('weekly');
      if (existing) { existing.destroy(); }
      const newChart = _buildWeekly(canvasId, data);
      _setPageChart('weekly', newChart);
    }
  }

  // Хелперы доступа к PotholePage._charts без прямой зависимости
  function _getPageChart(key) {
    try { return typeof PotholePage !== 'undefined' && PotholePage.getChart(key); }
    catch { return null; }
  }
  function _setPageChart(key, chart) {
    try { if (typeof PotholePage !== 'undefined') PotholePage.setChart(key, chart); }
    catch { /* нет PotholePage — не страшно */ }
  }

  return { donut, weekly, updateTheme };
})();
