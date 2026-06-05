/**
 * charts-pothole.js — Графики дашборда «Ямочный ремонт»
 * Использует Chart.js (уже подключен в HTML)
 */

const PotholeCharts = (() => {

  // Общие настройки шрифтов
  const fontFamily = "'Satoshi', 'Inter', sans-serif";

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function palette() {
    return [
      getCssVar('--color-primary')   || '#01696f',
      getCssVar('--color-orange')    || '#da7101',
      getCssVar('--color-blue')      || '#006494',
      getCssVar('--color-success')   || '#437a22',
      getCssVar('--color-purple')    || '#7a39bb',
      getCssVar('--color-gold')      || '#d19900',
    ];
  }

  function textColor()   { return getCssVar('--color-text')        || '#28251d'; }
  function mutedColor()  { return getCssVar('--color-text-muted')   || '#7a7974'; }
  function borderColor() { return getCssVar('--color-border')       || '#d4d1ca'; }
  function bgColor()     { return getCssVar('--color-surface')      || '#f9f8f5'; }

  // ── Пончик ───────────────────────────────────────────────────────────
function donut(canvasId, data, labels, existingChart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return existingChart;

    if (existingChart) existingChart.destroy();

    const colors = palette();
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
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { animateRotate: true, animateScale: true, duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color:       textColor(),
              font:        { family: fontFamily, size: 12 },
              padding:     12,
              boxWidth:    12,
              boxHeight:   12,
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
          // Центральный текст
          doughnutCenterText: { total, textColor: textColor(), mutedColor: mutedColor(), fontFamily },
        },
      },
      plugins: [{
        id: 'doughnutCenterText',
        afterDraw(chart) {
          if (chart.config.options.plugins?.doughnutCenterText === false) return;
          const { ctx, chartArea: { left, right, top, bottom } } = chart;
          const centerX = (left + right)  / 2;
          const centerY = (top  + bottom) / 2;
          const opts    = chart.config.options.plugins.doughnutCenterText;
          ctx.save();
          ctx.font = `700 22px ${opts.fontFamily}`;
          ctx.fillStyle   = opts.textColor;
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(opts.total.toLocaleString('ru-RU'), centerX, centerY - 6);
          ctx.font = `400 11px ${opts.fontFamily}`;
          ctx.fillStyle = opts.mutedColor;
          ctx.fillText('всего', centerX, centerY + 14);
          ctx.restore();
        },
      }],
    });
  }

  // ── График недельной динамики ─────────────────────────────────────
  function weekly(canvasId, data, existingChart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return existingChart;

    if (existingChart) existingChart.destroy();

    const col = palette();
    const labels = data.map(d => d.label);

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Зарегистрировано ям',
            data:            data.map(d => d.registered),
            backgroundColor: col[0] + 'cc',
            borderColor:     col[0],
            borderWidth:     1,
            borderRadius:    4,
          },
          {
            label: 'Устранено ям',
            data:            data.map(d => d.fixed),
            backgroundColor: col[3] + 'cc',
            borderColor:     col[3],
            borderWidth:     1,
            borderRadius:    4,
          },
          {
            label: 'Жалобы',
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
            ticks: { color: mutedColor(), font: { family: fontFamily, size: 12 } },
          },
          y: {
            beginAtZero: true,
            grid:  { color: borderColor() + '55' },
            ticks: {
              color: mutedColor(),
              font:  { family: fontFamily, size: 12 },
              callback: v => v.toLocaleString('ru-RU'),
            },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            align:    'start',
            labels:   { color: textColor(), font: { family: fontFamily, size: 12 }, padding: 16, boxWidth: 12, boxHeight: 12 },
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

  return { donut, weekly };
})();
