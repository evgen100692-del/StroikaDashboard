/**
 * pothole.js — Дашборд «Ямочный ремонт»
 */

const PotholePage = (() => {

  // Текущие графики
  let charts = {};

  // Фильтр недельной динамики
  let weeklyMonth = new Date().getMonth() + 1;
  let weeklyYear  = new Date().getFullYear();

  // ── Инициализация ──────────────────────────────────────────────
  async function init() {
    _bindUploadModal();
    _bindReportsPanel();
    _bindWeeklyFilter();
    await refresh();
  }

  // ── Обновление всех данных ─────────────────────────────────────
  async function refresh() {
    try {
      await PotholeData.loadAll();
      _renderKPI();
      _renderDonuts();
      await _renderWeekly();
      _renderReportsList();
    } catch(e) {
      console.error('[PotholePage] refresh error:', e);
      Toast.show('Ошибка загрузки данных: ' + e.message, 'error');
    }
  }

  // ── KPI-карточки ─────────────────────────────────────────────────
  function _renderKPI() {
    const kpi     = PotholeData.getKPI();
    const reports = PotholeData.getReports();
    const prev    = _getPreviousReport(reports);
    const prevKPI = prev ? _calcKpiFromReportSet(prev) : null;

    if (!kpi) {
      _setKPI('ph-kpi-reg-all',  '—', null);
      _setKPI('ph-kpi-mun-all',  '—', null);
      _setKPI('ph-kpi-comp-all', '—', null);
      _setKPI('ph-kpi-fix-all',  '—', null);
      return;
    }

    const regAll  = kpi.regional.registered;
    const munAll  = kpi.municipal.registered;
    const fixAll  = kpi.regional.fixed + kpi.municipal.fixed;
    const compAll = kpi.complaints.totalAll;

    const diff = prevKPI ? {
      reg:  regAll  - prevKPI.regAll,
      mun:  munAll  - prevKPI.munAll,
      fix:  fixAll  - prevKPI.fixAll,
      comp: compAll - prevKPI.compAll,
    } : null;

    _setKPI('ph-kpi-reg-all',  regAll.toLocaleString('ru-RU'),  diff?.reg);
    _setKPI('ph-kpi-mun-all',  munAll.toLocaleString('ru-RU'),  diff?.mun);
    _setKPI('ph-kpi-fix-all',  fixAll.toLocaleString('ru-RU'),  diff?.fix);
    _setKPI('ph-kpi-comp-all', compAll.toLocaleString('ru-RU'), diff?.comp);
  }

  function _setKPI(id, value, diff) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    const badge = document.getElementById(id + '-diff');
    if (!badge) return;
    if (diff === null || diff === undefined) { badge.style.display = 'none'; return; }
    badge.style.display = '';
    const sign = diff > 0 ? '+' : '';
    badge.textContent = sign + diff.toLocaleString('ru-RU');
    badge.className = 'kpi-diff-badge ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral');
  }

  // ── Графики-пончики ───────────────────────────────────────────────
  function _renderDonuts() {
    const kpi = PotholeData.getKPI();

    const empty = [1, 0];
    const emptyLabels = ['Нет данных', ''];

    // Зарегистрированные ямы
    const regData = kpi
      ? [kpi.regional.registered, kpi.municipal.registered]
      : empty;
    const regLabels = kpi ? ['Региональные', 'Муниципальные'] : emptyLabels;

    // Устранённые ямы
    const fixData = kpi
      ? [kpi.regional.fixed, kpi.municipal.fixed]
      : empty;
    const fixLabels = kpi ? ['Региональные', 'Муниципальные'] : emptyLabels;

    // Жалобы
    const compData = kpi
      ? [kpi.complaints.totalOms, kpi.complaints.totalMad]
      : empty;
    const compLabels = kpi ? ['ОМС', 'МАД (РУАД)'] : emptyLabels;

    charts.donutReg  = PotholeCharts.donut('ph-chart-donut-reg',  regData,  regLabels,  charts.donutReg);
    charts.donutFix  = PotholeCharts.donut('ph-chart-donut-fix',  fixData,  fixLabels,  charts.donutFix);
    charts.donutComp = PotholeCharts.donut('ph-chart-donut-comp', compData, compLabels, charts.donutComp);
  }

  // ── Недельная динамика ─────────────────────────────────────────────
  async function _renderWeekly() {
    try {
      const data = await PotholeData.getWeeklyData(weeklyYear, weeklyMonth);
      charts.weekly = PotholeCharts.weekly('ph-chart-weekly', data, charts.weekly);
    } catch(e) {
      console.warn('[PotholePage] weekly chart error:', e);
    }
  }

  function _bindWeeklyFilter() {
    const sel = document.getElementById('ph-week-month');
    if (!sel) return;
    // Заполняем селект месяцами
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    sel.innerHTML = months.map((m, i) => {
      const y = weeklyYear;
      const selected = (i + 1 === weeklyMonth) ? 'selected' : '';
      return `<option value="${y}-${i+1}" ${selected}>${m} ${y}</option>`;
    }).join('');
    sel.addEventListener('change', async () => {
      const [y, m] = sel.value.split('-').map(Number);
      weeklyYear  = y;
      weeklyMonth = m;
      await _renderWeekly();
    });
  }

  // ── Панель «Отчёты» ────────────────────────────────────────────────
  function _bindReportsPanel() {
    const btn = document.getElementById('ph-reports-toggle');
    const panel = document.getElementById('ph-reports-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', panel.classList.contains('open'));
    });
  }

  function _renderReportsList() {
    const tbody = document.getElementById('ph-reports-tbody');
    if (!tbody) return;
    const reports = PotholeData.getReports();
    const typeNames = { complaints: 'Жалобы', regional: 'Регион. ремонт', municipal: 'Мун. ремонт' };
    if (!reports.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-faint);padding:var(--space-6)">Отчёты не загружены</td></tr>';
      return;
    }
    tbody.innerHTML = reports.map(r => `
      <tr>
        <td>${typeNames[r.report_type] || r.report_type}</td>
        <td>${_fmtDate(r.report_date)}</td>
        <td>${_fmtDatetime(r.uploaded_at)}</td>
        <td>
          <button class="btn btn-ghost btn-icon btn-sm" title="Удалить"
            onclick="PotholePage.confirmDeleteReport(${r.id})" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </td>
      </tr>
    `).join('');
  }

  function confirmDeleteReport(id) {
    Confirm.show(
      'Удалить отчёт?',
      'Данные будут удалены безвозвратно.',
      async () => {
        try {
          await PotholeData.deleteReport(id);
          _renderKPI();
          _renderDonuts();
          await _renderWeekly();
          _renderReportsList();
          Toast.show('Отчёт удалён', 'success');
        } catch(e) {
          Toast.show('Ошибка: ' + e.message, 'error');
        }
      }
    );
  }

  // ── Модал загрузки файла ────────────────────────────────────────
  function _bindUploadModal() {
    const openBtn   = document.getElementById('ph-upload-btn');
    const closeBtn  = document.getElementById('ph-upload-close');
    const cancelBtn = document.getElementById('ph-upload-cancel');
    const submitBtn = document.getElementById('ph-upload-submit');
    const modal     = document.getElementById('ph-upload-modal');
    const form      = document.getElementById('ph-upload-form');
    const fileInput = document.getElementById('ph-file-input');
    const fileName  = document.getElementById('ph-file-name');
    const fileArea  = document.getElementById('ph-file-area');

    if (!openBtn || !modal) return;

    // Драг и дроп
    if (fileArea && fileInput) {
      fileArea.addEventListener('click', () => fileInput.click());
      fileArea.addEventListener('dragover', e => { e.preventDefault(); fileArea.classList.add('drag-over'); });
      fileArea.addEventListener('dragleave', () => fileArea.classList.remove('drag-over'));
      fileArea.addEventListener('drop', e => {
        e.preventDefault();
        fileArea.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) {
          fileInput.files = e.dataTransfer.files;
          fileName.textContent = e.dataTransfer.files[0].name;
        }
      });
      fileInput.addEventListener('change', () => {
        fileName.textContent = fileInput.files[0]?.name || 'Файл не выбран';
      });
    }

    openBtn.addEventListener('click',   () => openModal('ph-upload-modal'));
    closeBtn?.addEventListener('click',  () => closeModal('ph-upload-modal'));
    cancelBtn?.addEventListener('click', () => closeModal('ph-upload-modal'));

    submitBtn?.addEventListener('click', async () => {
      const type = document.getElementById('ph-report-type')?.value;
      const date = document.getElementById('ph-report-date')?.value;
      const file = fileInput?.files[0];

      if (!type || !date || !file) {
        Toast.show('Заполните все поля и выберите файл', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Загружка...';

      try {
        const res = await PotholeData.uploadReport(file, type, date);
        Toast.show(`Отчёт загружен: ${res.rows} строк`, 'success');
        closeModal('ph-upload-modal');
        _renderKPI();
        _renderDonuts();
        await _renderWeekly();
        _renderReportsList();
        // Сбрасываем форму
        if (form) form.reset();
        if (fileName) fileName.textContent = 'Не выбран';
      } catch(e) {
        Toast.show('Ошибка: ' + e.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Загрузить';
      }
    });
  }

  // ── Вспомогательные ───────────────────────────────────────────────
  function _fmtDate(s) {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return s; }
  }

  function _fmtDatetime(s) {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
  }

  // Получить KPI из набора предыдущих отчётов (пенультимативная версия для диффа)
  function _getPreviousReport(reports) {
    // Берём второй по дате региональный отчёт как реперезентации
    const sorted = [...reports]
      .filter(r => r.report_type === 'regional')
      .sort((a, b) => b.report_date.localeCompare(a.report_date));
    return sorted[1] || null; // второй по дате
  }

  function _calcKpiFromReportSet(report) {
    // Не есть данных для всех типов — упрощенный расчёт
    return { regAll: 0, munAll: 0, fixAll: 0, compAll: 0 };
  }

  return { init, refresh, confirmDeleteReport };
})();
