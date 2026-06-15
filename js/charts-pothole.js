/**
 * charts-pothole.js — Графики дашборда «Ямочный ремонт»
 * Использует Chart.js (уже подключен в HTML)
 */

const PotholeCharts = (() => {

  function textColor()   { return getCSSVar('--color-text')       || '#1e1e1c'; }
  function mutedColor()  { return getCSSVar('--color-text-muted')  || '#6b6b68'; }
  function borderColor() { return getCSSVar('--color-border')      || '#cecece'; }
  function bgColor()     { return getCSSVar('--color-surface')     || '#f9f9f7'; }
  function fontFamily()  { return getCSSVar('--font-body')         || "'Satoshi', 'Inter', sans-serif"; }

  const _last = {
    donuts: {},
    weekly: null
  };

  // ── Плагин центрального текста пончика ───────────────────────────────────
  // Рисует цифры через afterDraw (после всего рендера canvas).
  // Tooltip тоже вынесен в DOM (см. ниже), поэтому они не перекрывают друг друга.
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
      ctx.fillStyle    = textColor();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pluginOpts.total.toLocaleString('ru-RU'), cx, cy - 6);
      ctx.font      = `400 11px ${ff}`;
      ctx.fillStyle = mutedColor();
      ctx.fillText('всего', cx, cy + 14);
      ctx.restore();
    },
  };

  // ── Общий external-tooltip для пончиков и недельного графика ─────────────
  // Толтип рендерится как DOM-элемент с position:fixed и z-index:99999,
  // поэтому он неизбежно поверх canvas (и centerText в нём в том числе).
  const TOOLTIP_ID = 'ph-chart-tooltip';

  function _getOrCreateTooltipEl() {
    let el = document.getElementById(TOOLTIP_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOOLTIP_ID;
      Object.assign(el.style, {
        position:      'fixed',
        zIndex:        '99999',
        pointerEvents: 'none',
        transition:    'opacity 0.15s ease',
        opacity:       '0',
        padding:       '10px 14px',
        borderRadius:  '8px',
        fontSize:      '13px',
        lineHeight:    '1.6',
        boxShadow:     '0 4px 16px rgba(0,0,0,0.18)',
        minWidth:      '160px',
        whiteSpace:    'nowrap',
      });
      document.body.appendChild(el);
    }
    return el;
  }

  function _externalTooltipHandler(context) {
    const { chart, tooltip } = context;
    const el = _getOrCreateTooltipEl();

    if (tooltip.opacity === 0) {
      el.style.opacity = '0';
      return;
    }

    el.style.background = bgColor();
    el.style.border     = `1px solid ${borderColor()}`;
    el.style.color      = textColor();

    const title = tooltip.title?.[0] || '';

    const lines = (tooltip.body || []).map((b, i) => {
      const dp    = tooltip.dataPoints?.[i];
      const dsIdx = dp?.datasetIndex ?? 0;
      const dIdx  = dp?.dataIndex    ?? 0;
      const ds    = chart.data.datasets[dsIdx];
      // Для пончика backgroundColor может быть массивом
      const rawColor = Array.isArray(ds?.backgroundColor)
        ? ds.backgroundColor[dIdx]
        : (ds?.borderColor || '#888');
      // Убираем альфа-суффикс 'cc' чтобы цвет шпарки был чистым
      const color = typeof rawColor === 'string' ? rawColor.replace(/cc$/, '') : rawColor;
      const text  = b.lines?.[0] || '';
      return `<div style="display:flex;align-items:center;gap:7px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        <span style="color:${mutedColor()};">${text}</span>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;color:${textColor()};">${title}</div>
      ${lines}
    `;

    const canvasRect = chart.canvas.getBoundingClientRect();
    const tooltipX   = canvasRect.left + tooltip.caretX;
    const tooltipY   = canvasRect.top  + tooltip.caretY;

    el.style.opacity = '0';
    el.style.display = 'block';

    requestAnimationFrame(() => {
      const tw = el.offsetWidth;
      const th = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = tooltipX + 14;
      let top  = tooltipY - th / 2;

      if (left + tw + 8 > vw) left = tooltipX - tw - 14;
      if (top + th + 8 > vh)  top  = vh - th - 8;
      if (top < 8)            top  = 8;

      el.style.left    = left + 'px';
      el.style.top     = top  + 'px';
      el.style.opacity = '1';
    });
  }

  // ── Построение пончика ─────────────────────────────────────────────────
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
            // Толтип вынесен в DOM — цифры centerText на canvas его не перекроют
            enabled:  false,
            external: _externalTooltipHandler,
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

  // ── Построение недельного графика ───────────────────────────────────────
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
            enabled:  false,
            external: _externalTooltipHandler,
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

  // ── Пересоздаёт все графики при смене темы ──────────────────────────
  function updateTheme() {
    for (const [canvasId, entry] of Object.entries(_last.donuts)) {
      if (!entry) continue;
      const existing = _getPageChart(canvasId);
      if (existing) { existing.destroy(); }
      const newChart = _buildDonut(canvasId, entry.data, entry.labels);
      _setPageChart(canvasId, newChart);
    }
    if (_last.weekly) {
      const { canvasId, data } = _last.weekly;
      const existing = _getPageChart('weekly');
      if (existing) { existing.destroy(); }
      const newChart = _buildWeekly(canvasId, data);
      _setPageChart('weekly', newChart);
    }
    const tooltipEl = document.getElementById(TOOLTIP_ID);
    if (tooltipEl) {
      tooltipEl.style.background = bgColor();
      tooltipEl.style.border     = `1px solid ${borderColor()}`;
      tooltipEl.style.color      = textColor();
    }
  }

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
