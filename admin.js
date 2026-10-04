(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const loginView = $('#loginView');
  const dashboardView = $('#dashboardView');
  const loginForm = $('#loginForm');
  const loginMessage = $('#loginMessage');
  const dashboardContent = $('#dashboardContent');
  const dashboardError = $('#dashboardError');
  let days = 7;

  const labels = {
    '/': 'صفحة الهبوط', '/landing.html': 'صفحة الهبوط', '/index.html': 'صفحة الهبوط',
    '/showcase.html': 'ملف الرعاية', mobile: 'جوال', tablet: 'جهاز لوحي', desktop: 'كمبيوتر',
    '—': 'غير متاح'
  };
  const label = value => labels[value] || value;
  const number = value => new Intl.NumberFormat('ar-SA').format(value || 0);
  const time = value => new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(value));

  async function request(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || data.error || 'حدث خطأ غير متوقع.'), { status: response.status, data });
    return data;
  }

  function showLogin(message = '') {
    dashboardView.hidden = true;
    loginView.hidden = false;
    loginMessage.textContent = message;
    setTimeout(() => $('#password').focus(), 50);
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    loadSummary();
  }

  function changeText(selector, value) { $(selector).textContent = value; }
  function changeLabel(selector, value) {
    const el = $(selector);
    const sign = value > 0 ? '+' : '';
    el.textContent = value ? `${sign}${number(value)}٪ مقارنة بالفترة السابقة` : 'مستقر مقارنة بالفترة السابقة';
    el.style.color = value >= 0 ? 'var(--good)' : 'var(--danger)';
  }

  function renderChart(rows) {
    const host = $('#trafficChart');
    host.replaceChildren();
    if (!rows.length) return;
    const width = 900, height = 270, padX = 24, padY = 24;
    const max = Math.max(1, ...rows.map(row => row.visits));
    const points = rows.map((row, index) => ({
      x: padX + index * ((width - padX * 2) / Math.max(1, rows.length - 1)),
      y: height - padY - (row.visits / max) * (height - padY * 2), row
    }));
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'حركة مشاهدات الصفحات يوميًا');
    const defs = document.createElementNS(ns, 'defs');
    const gradient = document.createElementNS(ns, 'linearGradient');
    gradient.id = 'areaFill'; gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0'); gradient.setAttribute('x2', '0'); gradient.setAttribute('y2', '1');
    for (const [offset, opacity] of [['0%', '.28'], ['100%', '0']]) { const stop = document.createElementNS(ns, 'stop'); stop.setAttribute('offset', offset); stop.setAttribute('stop-color', '#c5a55f'); stop.setAttribute('stop-opacity', opacity); gradient.append(stop); }
    defs.append(gradient); svg.append(defs);
    for (let i = 0; i < 4; i++) { const line = document.createElementNS(ns, 'line'); const y = padY + i * ((height - padY * 2) / 3); line.setAttribute('x1', padX); line.setAttribute('x2', width - padX); line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('class', 'chart-grid'); svg.append(line); }
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const area = document.createElementNS(ns, 'path'); area.setAttribute('d', `${path} L${points.at(-1).x},${height - padY} L${points[0].x},${height - padY} Z`); area.setAttribute('class', 'chart-area'); svg.append(area);
    const line = document.createElementNS(ns, 'path'); line.setAttribute('d', path); line.setAttribute('class', 'chart-line'); svg.append(line);
    const step = Math.max(1, Math.ceil(rows.length / 7));
    points.forEach((point, index) => {
      const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y); dot.setAttribute('r', rows.length > 31 ? 1.8 : 3); dot.setAttribute('class', 'chart-dot');
      const title = document.createElementNS(ns, 'title'); title.textContent = `${point.row.date}: ${point.row.visits}`; dot.append(title); svg.append(dot);
      if (index % step === 0 || index === rows.length - 1) { const text = document.createElementNS(ns, 'text'); text.setAttribute('x', point.x); text.setAttribute('y', height - 5); text.setAttribute('text-anchor', 'middle'); text.setAttribute('class', 'chart-label'); text.textContent = point.row.date.slice(5); svg.append(text); }
    });
    host.append(svg);
  }

  function renderRanks(selector, rows) {
    const host = $(selector); host.replaceChildren();
    if (!rows.length) { const row = document.createElement('div'); const text = document.createElement('span'); text.textContent = 'لا توجد بيانات بعد'; row.append(text); host.append(row); return; }
    rows.forEach(item => { const row = document.createElement('div'); const name = document.createElement('span'); const count = document.createElement('b'); name.textContent = label(item.name); name.title = label(item.name); count.textContent = number(item.count); row.append(name, count); host.append(row); });
  }

  function renderDevices(rows, visits) {
    const host = $('#deviceList'); host.replaceChildren();
    const mobile = rows.find(row => row.name === 'mobile')?.count || 0;
    const share = visits ? Math.round((mobile / visits) * 100) : 0;
    changeText('#mobileShare', `${number(share)}٪`);
    $('#deviceRing').style.background = `conic-gradient(var(--gold) ${share * 3.6}deg,#2c2a22 0deg)`;
    renderRanks('#deviceList', rows);
  }

  function renderRecent(rows) {
    const body = $('#recentTable'); body.replaceChildren();
    const empty = $('#emptyState'); const table = $('.table-scroll');
    empty.hidden = rows.length > 0; table.hidden = rows.length === 0;
    rows.forEach(item => {
      const row = document.createElement('tr');
      [item.visitor, label(item.path), label(item.source), label(item.device), label(item.country), time(item.ts)].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
      body.append(row);
    });
  }

  function render(data) {
    changeText('#metricVisits', number(data.metrics.visits));
    changeText('#metricVisitors', number(data.metrics.visitors));
    changeText('#metricSessions', number(data.metrics.sessions));
    changeText('#metricDepth', String(data.metrics.pagesPerSession).replace('.', '٫'));
    changeLabel('#changeVisits', data.metrics.visitChange);
    changeLabel('#changeVisitors', data.metrics.visitorChange);
    changeText('#updatedAt', `آخر تحديث ${time(data.generatedAt)}`);
    changeText('#eventRaceStart', number(data.events.race_start));
    changeText('#eventRaceComplete', number(data.events.race_complete));
    changeText('#eventWhatsapp', number(data.events.contact_whatsapp));
    changeText('#eventPhone', number(data.events.contact_phone));
    changeText('#eventEmail', number(data.events.contact_email));
    renderChart(data.daily); renderDevices(data.devices, data.metrics.visits);
    renderRanks('#pagesList', data.pages); renderRanks('#sourcesList', data.sources); renderRanks('#countriesList', data.countries); renderRecent(data.recent);
  }

  async function loadSummary() {
    dashboardContent.dataset.state = 'loading'; dashboardError.hidden = true;
    try { render(await request(`/api/admin/summary?days=${days}`)); dashboardContent.dataset.state = 'ready'; }
    catch (error) {
      if (error.status === 401) return showLogin('انتهت الجلسة. سجّل الدخول مجددًا.');
      dashboardContent.dataset.state = 'ready'; dashboardError.hidden = false; dashboardError.querySelector('span').textContent = error.message;
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault(); loginMessage.textContent = '';
    const submit = loginForm.querySelector('[type=submit]'); submit.disabled = true;
    try {
      await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#password').value }) });
      $('#password').value = ''; showDashboard();
    } catch (error) { loginMessage.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  $('#togglePassword').addEventListener('click', () => {
    const field = $('#password'); const showing = field.type === 'text'; field.type = showing ? 'password' : 'text';
    $('#togglePassword').setAttribute('aria-label', showing ? 'إظهار رمز الدخول' : 'إخفاء رمز الدخول');
  });
  $('#logoutButton').addEventListener('click', async () => { await request('/api/admin/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
  $('#refreshButton').addEventListener('click', loadSummary);
  dashboardError.querySelector('button').addEventListener('click', loadSummary);
  document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => {
    days = Number(button.dataset.days); document.querySelectorAll('[data-days]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); loadSummary();
  }));
  setInterval(() => { if (!document.hidden && !dashboardView.hidden) loadSummary(); }, 60000);

  request('/api/admin/session').then(data => data.authenticated ? showDashboard() : showLogin(data.configured ? '' : 'يلزم إعداد ADMIN_PASSWORD على الخادم أولًا.')).catch(() => showLogin('تعذّر الاتصال بالخادم.'));
})();
