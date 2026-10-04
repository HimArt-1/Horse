(function () {
  'use strict';
  if (location.pathname === '/admin' || location.pathname.endsWith('/admin.html') || navigator.doNotTrack === '1') return;

  const key = 'ehr_visit_session';
  let session = sessionStorage.getItem(key);
  if (!session) {
    session = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, session);
  }

  function device() {
    if (matchMedia('(max-width: 640px)').matches) return 'mobile';
    if (matchMedia('(max-width: 1024px)').matches) return 'tablet';
    return 'desktop';
  }

  function source() {
    const params = new URLSearchParams(location.search);
    if (params.get('utm_source')) return params.get('utm_source').slice(0, 60);
    if (!document.referrer) return 'مباشر';
    try {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host === location.hostname) return 'داخلي';
      if (/google|bing|yahoo|duckduckgo/.test(host)) return 'بحث';
      if (/instagram|facebook|tiktok|twitter|x\.com|linkedin|snapchat/.test(host)) return 'تواصل اجتماعي';
      return host;
    } catch { return 'إحالة'; }
  }

  function send(type, details) {
    const params = new URLSearchParams(location.search);
    const body = JSON.stringify({
      type, session, path: location.pathname, device: device(), source: source(),
      referrer: document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch { return ''; } })() : '',
      utm: params.get('utm_campaign') || '', ...details
    });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics/event', new Blob([body], { type: 'application/json' }));
    else fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }

  window.trackSiteEvent = send;
  send('page_view');
  if (/showcase/.test(location.pathname)) send('sponsorship_open');

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('tel:')) send('contact_phone');
    else if (href.startsWith('mailto:')) send('contact_email');
    else if (/wa\.me|whatsapp/i.test(href)) send('contact_whatsapp');
    else if (/showcase|sponsor|رعا/i.test(href + ' ' + link.textContent)) send('sponsorship_open');
    else if (link.matches('.nav-cta,.btn-primary,.visitor-route-link')) send('cta_click');
  }, { passive: true });
})();
