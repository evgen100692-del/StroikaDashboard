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

  // Храним ссылки на все созданные графики, чтобы мочь updateTheme()
  const _charts = {
    donuts: {},   // { canvasId: { chart, data, labels } }
    weekly: null, // { chart, data }
  };

  // ── Плагин центрального текста пончика ──────────────────────────────────
  // Читает CSS-переменные НЕПОСРЕДСТВЕННО в afterDraw, не из opts
  const centerTextPlugin = {
    id: 'doughnutCenterText',
    afterDraw(chart) {
      const pluginOpts = chart.config.options?.plugins?.doughnutCenterText;
      if (!pluginOpts) return;

      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const cx = (left + right)  / 2;
      const cy = (top  + bottom) / 2;
      const ff = fontFamily();

      ctx.save();

      // Цифра в центре
      ctx.font         = `700 22px ${ff}`;
      ctx.fillStyle    = textColor();   // ← читаем в момент рисования
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pluginOpts.total.toLocaleString('ru-RU'), cx, cy - 6);

      // Подпись «всего»
      ctx.font      = `400 11px ${ff}`;
      ctx.fillStyle = mutedColor();     // ← читаем в момент рисования
      ctx.fillText('всего', cx, cy + 14);

      ctx.restore();
    },
  };

  // ── Пончик ────────────────────────────────────────────────────────────────────────
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
    // Если график уже есть — обновляем данные без пересоздания
    if (existingChart) {
      existingChart.data.labels                = labels;
      existingChart.data.datasets[0].data      = data;
      existingChart.options.plugins.doughnutCenterText.total = data.reduce((s, v) => s + v, 0);
      existingChart.update('active');
      _charts.donuts[canvasId] = { chart: existingChart, data, labels };
      return existingChart;
    }

    const chart = _buildDonut(canvasId, data, labels);
    _charts.donuts[canvasId] = { chart, data, labels };
    return chart;
  }

  // ── Недельная динамика ────────────────────────────────────────────────────────
  function _buildWeekly(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const col    = chartPalette();
    const labels = data.map(d => d.label);
    const font   = fontFamily();

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
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
    if (existingChart) {
      existingChart.data.labels                = data.map(d => d.label);
      existingChart.data.datasets[0].data      = data.map(d => d.registered);
      existingChart.data.datasets[1].data      = data.map(d => d.fixed);
      existingChart.data.datasets[2].data      = data.map(d => d.complaints);
      existingChart.update('active');
      _charts.weekly = { chart: existingChart, canvasId, data };
      return existingChart;
    }

    const chart = _buildWeekly(canvasId, data);
    _charts.weekly = { chart, canvasId, data };
    return chart;
  }

  // ── Обновление цветов при смене темы ─────────────────────────────────
  // Пересоздаёт все графики с актуальными цветами из CSS
  function updateTheme() {
    // Пончики
    for (const [canvasId, entry] of Object.entries(_charts.donuts)) {
      if (!entry || !entry.chart) continue;
      entry.chart.destroy();
      const newChart = _buildDonut(canvasId, entry.data, entry.labels);
      _charts.donuts[canvasId] = { chart: newChart, data: entry.data, labels: entry.labels };
      // Возвращаем ссылку через PotholePage, если есть
      if (typeof PotholePage !== 'undefined') PotholePage._replaceDonutRef(canvasId, newChart);
    }
    // Недельный график
    if (_charts.weekly) {
      const { canvasId, data } = _charts.weekly;
      _charts.weekly.chart.destroy();
      const newChart = _buildWeekly(canvasId, data);
      _charts.weekly = { chart: newChart, canvasId, data };
      if (typeof PotholePage !== 'undefined') PotholePage._replaceWeeklyRef(newChart);
    }
  }

  return { donut, weekly, updateTheme };
})();
