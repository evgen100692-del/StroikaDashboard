/**
 * charts.js — Chart.js chart instances for the dashboard
 */

const ChartsManager = (() => {
  const instances = {};

  function textColor()   { return getCSSVar('--color-text-muted'); }
  function gridColor()   { return getCSSVar('--color-divider'); }
  function bgColor()     { return getCSSVar('--color-surface-2'); }

  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: {
            color: textColor(),
            font: { family: getCSSVar('--font-body'), size: 12 },
            boxWidth: 12,
            boxHeight: 12,
            padding: 16,
          }
        },
        tooltip: {
          backgroundColor: bgColor(),
          titleColor: getCSSVar('--color-text'),
          bodyColor: textColor(),
          borderColor: getCSSVar('--color-border'),
          borderWidth: 1,
          padding: 10,
          titleFont: { weight: '700' },
          callbacks: {},
        }
      },
      scales: {
        x: {
          ticks: { color: textColor(), font: { size: 11 } },
          grid:  { color: gridColor() }
        },
        y: {
          ticks: { color: textColor(), font: { size: 11 } },
          grid:  { color: gridColor() }
        }
      }
    };
  }

  // ---- Chart: Limits by year ----
  function renderLimitsChart(analytics) {
    const ctx = document.getElementById('chart-limits');
    if (!ctx) return;

    const years = [2026, 2027, 2028, 2029];
    const colors = chartPalette();

    const data = {
      labels: years.map(y => String(y)),
      datasets: [
        {
          label: 'Лимит (было)',
          data: years.map(y => analytics.limits[y].was),
          backgroundColor: colors[0] + '99',
          borderColor: colors[0],
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: 'Лимит (текущий)',
          data: years.map(y => analytics.limits[y].cur),
          backgroundColor: colors[1] + '99',
          borderColor: colors[1],
          borderWidth: 2,
          borderRadius: 6,
        }
      ]
    };

    const opts = baseOptions();
    opts.plugins.tooltip.callbacks.label = ctx => {
      return ` ${ctx.dataset.label}: ${formatMoneyShort(ctx.raw)}`;
    };
    opts.scales.y.ticks.callback = v => formatMoneyShort(v);

    if (instances.limits) {
      instances.limits.data = data;
      instances.limits.update('active');
    } else {
      instances.limits = new Chart(ctx, { type: 'bar', data, options: opts });
    }
  }

  // ---- Chart: Financing structure (donut) ----
  function renderFinancingChart(analytics) {
    const ctx = document.getElementById('chart-financing');
    if (!ctx) return;

    const paid    = analytics.paidTotal;
    const total   = analytics.totalGK;
    const unpaid  = Math.max(0, total - paid - analytics.remainder);
    const remainder = analytics.remainder;

    const colors = chartPalette();
    const data = {
      labels: ['Оплачено', 'Не оплачено', 'Остаток'],
      datasets: [{
        data: [paid, unpaid, remainder],
        backgroundColor: [colors[1] + 'dd', colors[2] + 'dd', colors[3] + 'dd'],
        borderColor: [colors[1], colors[2], colors[3]],
        borderWidth: 2,
        hoverOffset: 8,
      }]
    };

    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor(),
            font: { family: getCSSVar('--font-body'), size: 12 },
            padding: 14,
            boxWidth: 12,
            boxHeight: 12,
          }
        },
        tooltip: {
          backgroundColor: bgColor(),
          titleColor: getCSSVar('--color-text'),
          bodyColor: textColor(),
          borderColor: getCSSVar('--color-border'),
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatMoneyShort(ctx.raw)} (${formatPct(total ? ctx.raw / total * 100 : 0)})`,
          }
        }
      }
    };

    if (instances.financing) {
      instances.financing.data = data;
      instances.financing.update('active');
    } else {
      instances.financing = new Chart(ctx, { type: 'doughnut', data, options: opts });
    }
  }

  // ---- Chart: Construction readiness (horizontal bar) ----
  // sorted — массив объектов, каждый может содержать
  // _delta: { prev_value, new_value } — история изменений стройготовности
  function renderReadinessChart(filtered) {
    const ctx = document.getElementById('chart-readiness');
    if (!ctx) return;

    const sorted = [...filtered]
      .sort((a, b) => AppData.num(b.readinessPct) - AppData.num(a.readinessPct))
      .slice(0, 8);

    const colors = chartPalette();

    // Для каждого объекта получаем дельту стройготовности
    const deltas = sorted.map(c => {
      const d = AppData.getReadinessDelta(c.id);
      if (!d) return null;
      const diff = AppData.num(d.new_value) - AppData.num(d.prev_value);
      return diff !== 0 ? diff : null;
    });

    const data = {
      labels: sorted.map(c => c.objectName.length > 32 ? c.objectName.slice(0, 32) + '…' : c.objectName),
      datasets: [{
        label: 'Стройготовность %',
        data: sorted.map(c => AppData.num(c.readinessPct)),
        backgroundColor: sorted.map(c => {
          const v = AppData.num(c.readinessPct);
          if (v >= 75) return colors[1] + 'cc';
          if (v >= 50) return colors[0] + 'cc';
          if (v >= 25) return colors[2] + 'cc';
          return colors[5] + 'cc';
        }),
        borderColor: sorted.map(c => {
          const v = AppData.num(c.readinessPct);
          if (v >= 75) return colors[1];
          if (v >= 50) return colors[0];
          if (v >= 25) return colors[2];
          return colors[5];
        }),
        borderWidth: 2,
        borderRadius: 4,
      }]
    };

    // Плагин: рисуем значения и дельту после каждого бара
    const deltaLabelPlugin = {
      id: 'readinessDeltaLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c, scales: { x, y } } = chart;
        const meta = chart.getDatasetMeta(0);
        c.save();
        c.textBaseline = 'middle';
        c.font = `600 11px ${getCSSVar('--font-body') || 'Inter, sans-serif'}`;

        meta.data.forEach((bar, i) => {
          const value  = sorted[i] ? AppData.num(sorted[i].readinessPct) : 0;
          const delta  = deltas[i];
          const barRight = bar.x; // x правого края бара
          const barY    = bar.y;

          // Значение (темный текст)
          c.fillStyle = getCSSVar('--color-text') || '#1e1e1c';
          c.textAlign = 'left';
          const valText = value + '%';
          c.fillText(valText, barRight + 6, barY);

          // Дельта (+X% / -X%) цветной меткой
          if (delta !== null && delta !== undefined) {
            const sign    = delta > 0 ? '+' : '';
            const deltaText = `${sign}${delta.toFixed(1).replace('.0','')}%`;
            const valWidth  = c.measureText(valText).width;

            c.font      = `500 10px ${getCSSVar('--font-body') || 'Inter, sans-serif'}`;
            c.fillStyle = delta > 0 ? '#22c55e' : '#ef4444'; // зелёный или красный
            c.fillText(deltaText, barRight + 6 + valWidth + 4, barY);
            // Возвращаем шрифт обратно перед следующей итерацией
            c.font = `600 11px ${getCSSVar('--font-body') || 'Inter, sans-serif'}`;
          }
        });
        c.restore();
      }
    };

    const opts = {
      ...baseOptions(),
      indexAxis: 'y',
      // Оставляем место справа для подписей (ось X идёт максимум 110 а не 100)
      layout: { padding: { right: 72 } },
    };
    opts.scales.x.min = 0;
    opts.scales.x.max = 100;
    opts.scales.x.ticks.callback = v => v + '%';
    opts.plugins.tooltip.callbacks.label = (ctx) => {
      const c = sorted[ctx.dataIndex];
      const d = AppData.getReadinessDelta(c?.id);
      let label = ` Стройготовность: ${ctx.raw}%`;
      if (d) {
        const diff = AppData.num(d.new_value) - AppData.num(d.prev_value);
        if (diff !== 0) {
          const sign = diff > 0 ? '+' : '';
          label += `  (${sign}${diff.toFixed(1).replace('.0','')}% за последнее обновление)`;
        }
      }
      return label;
    };
    delete opts.scales.y.grid;
    opts.scales.y.grid = { display: false };

    if (instances.readiness) {
      // При обновлении пересоздаём чтобы плагин получил актуальные deltas
      instances.readiness.destroy();
      instances.readiness = null;
    }
    instances.readiness = new Chart(ctx, {
      type: 'bar',
      data,
      options: opts,
      plugins: [deltaLabelPlugin],
    });
  }


  function renderAll(analytics, filtered) {
    renderLimitsChart(analytics);
    renderFinancingChart(analytics);
    renderReadinessChart(filtered);
  }

  function updateTheme() {
    for (const inst of Object.values(instances)) {
      if (!inst) continue;
      try {
        const opts = inst.options;
        if (opts.plugins?.legend?.labels) {
          opts.plugins.legend.labels.color = textColor();
        }
        if (opts.plugins?.tooltip) {
          opts.plugins.tooltip.backgroundColor = bgColor();
          opts.plugins.tooltip.titleColor = getCSSVar('--color-text');
          opts.plugins.tooltip.bodyColor = textColor();
          opts.plugins.tooltip.borderColor = getCSSVar('--color-border');
        }
        if (opts.scales?.x?.ticks) opts.scales.x.ticks.color = textColor();
        if (opts.scales?.x?.grid)  opts.scales.x.grid.color  = gridColor();
        if (opts.scales?.y?.ticks) opts.scales.y.ticks.color = textColor();
        if (opts.scales?.y?.grid)  opts.scales.y.grid.color  = gridColor();
        inst.update('none');
      } catch(e) {}
    }
  }

  return { renderAll, renderLimitsChart, renderFinancingChart, renderReadinessChart, updateTheme };
})();
