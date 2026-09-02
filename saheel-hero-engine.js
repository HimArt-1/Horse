/* Saheel particle + scrolly engine — cinematic grid edition (8 acts: idea → network → scan → horse → KSA → Taif→Riyadh → world → identity) */
(function () {
  const GOLD = [233, 188, 92];
  const TAIF_CITY = [40.4167, 21.2703];
  const TAIF_TRACK = [40.4764623, 21.4085991];
  const RIYADH_CITY = [46.6753, 24.7136];
  const RIYADH_TRACK = [46.78593, 24.98410];
  const SCAN_TAU = Math.PI * 2;
  const SCAN_C = {
    gold: '233,188,92', hi: '242,206,118', lo: '201,146,43',
    cream: '255,243,214', soft: '255,239,198'
  };
  const scanClamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const scanLerp = (a, b, t) => a + (b - a) * t;
  const scanSmooth = (t) => t * t * (3 - 2 * t);
  const scanFrac = (t) => t - Math.floor(t);
  const scanRgba = (c, a) => 'rgba(' + c + ',' + a + ')';
  let scanQrCache = null;

  function scanRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function scanGlow(ctx, color, blur, draw) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    draw();
    ctx.restore();
  }

  function scanRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function scanQrMatrix() {
    if (scanQrCache) return scanQrCache;
    const N = 25;
    const matrix = Array.from({ length: N }, () => new Array(N).fill(0));
    const reserved = Array.from({ length: N }, () => new Array(N).fill(0));
    const finder = (r0, c0) => {
      for (let i = -1; i <= 7; i++) {
        for (let j = -1; j <= 7; j++) {
          const r = r0 + i, c = c0 + j;
          if (r < 0 || c < 0 || r >= N || c >= N) continue;
          reserved[r][c] = 1;
          const inside = i >= 0 && i <= 6 && j >= 0 && j <= 6;
          const ring = i === 0 || i === 6 || j === 0 || j === 6;
          const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          matrix[r][c] = inside && (ring || core) ? 1 : 0;
        }
      }
    };
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const r = 18 + i, c = 18 + j;
        reserved[r][c] = 1;
        matrix[r][c] = Math.max(Math.abs(i), Math.abs(j)) !== 1 ? 1 : 0;
      }
    }
    for (let i = 8; i < N - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = 1;
      matrix[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = 1;
    }
    matrix[N - 8][8] = 1; reserved[N - 8][8] = 1;
    const a0 = Math.floor(N / 2) - 3, a1 = a0 + 6;
    const rand = scanRng(0x5A4EE1);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (reserved[r][c]) continue;
        if (r >= a0 && r <= a1 && c >= a0 && c <= a1) {
          reserved[r][c] = 2; matrix[r][c] = 0; continue;
        }
        matrix[r][c] = rand() < 0.46 ? 1 : 0;
      }
    }
    scanQrCache = { N, matrix, reserved };
    return scanQrCache;
  }

  function drawScanMark(ctx, cx, cy, size, alpha) {
    const radius = size * 0.30;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = scanRgba(SCAN_C.hi, alpha);
    ctx.lineWidth = Math.max(2, size * 0.115);
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.03, radius, Math.PI * 0.90, Math.PI * 0.10, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.985, cy + size * 0.06);
    ctx.lineTo(cx - radius * 0.92, cy + size * 0.28);
    ctx.moveTo(cx + radius * 0.985, cy + size * 0.06);
    ctx.lineTo(cx + radius * 0.92, cy + size * 0.28);
    ctx.stroke();
    ctx.fillStyle = scanRgba(SCAN_C.lo, alpha * 0.9);
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI * (0.82 - i * 0.128);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy - size * 0.03 - Math.sin(angle) * radius, size * 0.026, 0, SCAN_TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawScanVisual(ctx, opts) {
    const cx = opts.cx, cy = opts.cy, size = opts.size, t = opts.t;
    const progress = scanClamp(opts.progress, 0, 1);
    const showPhone = opts.phone !== false;
    if (progress <= 0.001) return;
    const qr = scanQrMatrix(), N = qr.N;
    const cardX = cx + size * 0.30, cardY = cy;
    const left = cardX - size / 2, top = cardY - size / 2;
    const phoneX = cx - size * 1.05, phoneY = cy + size * 0.15;
    const phoneW = size * 0.46, phoneH = size * 0.94;

    ctx.save();
    ctx.globalAlpha = scanSmooth(scanClamp(progress * 1.15, 0, 1));

    const pulse = scanFrac(t * 0.30);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const k = scanFrac(pulse + i / 3);
      ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.14 * (1 - k) * progress);
      ctx.beginPath(); ctx.arc(cardX, cardY, size * (0.66 + k * 0.72), 0, SCAN_TAU); ctx.stroke();
    }

    if (showPhone && progress > 0.35) {
      const beamProgress = scanSmooth(scanClamp((progress - 0.35) / 0.4, 0, 1));
      const fromX = phoneX + phoneW * 0.52, fromY = phoneY - phoneH * 0.26;
      const beam = ctx.createLinearGradient(fromX, fromY, left, cardY);
      beam.addColorStop(0, scanRgba(SCAN_C.gold, 0));
      beam.addColorStop(0.55, scanRgba(SCAN_C.gold, 0.055 * beamProgress));
      beam.addColorStop(1, scanRgba(SCAN_C.hi, 0.16 * beamProgress));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY - size * 0.012);
      ctx.lineTo(left, cardY - size * 0.30);
      ctx.lineTo(left, cardY + size * 0.30);
      ctx.lineTo(fromX, fromY + size * 0.012);
      ctx.closePath(); ctx.fill();
      const rand = scanRng(77);
      for (let i = 0; i < 16; i++) {
        const offset = rand(), spread = rand() - 0.5;
        const k = scanFrac(t * 0.55 + offset), eased = scanSmooth(k);
        const x = scanLerp(left, fromX, eased);
        const y = scanLerp(cardY + spread * size * 0.36, fromY, eased);
        ctx.fillStyle = scanRgba(SCAN_C.soft, Math.sin(Math.PI * k) * 0.8 * beamProgress);
        ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
      }
    }

    const plate = ctx.createLinearGradient(left, top, left, top + size);
    plate.addColorStop(0, 'rgba(11,10,8,0.94)');
    plate.addColorStop(1, 'rgba(4,4,4,0.97)');
    ctx.fillStyle = plate;
    scanRoundRect(ctx, left - size * 0.085, top - size * 0.085, size * 1.17, size * 1.17, size * 0.07);
    ctx.fill();
    ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.26); ctx.lineWidth = 1; ctx.stroke();

    const sweepY = top + size * scanFrac(t * 0.40), band = size * 0.11;
    if (progress > 0.25) {
      const sweep = scanSmooth(scanClamp((progress - 0.25) / 0.3, 0, 1));
      const glow = ctx.createLinearGradient(left, sweepY - band, left, sweepY + band * 0.5);
      glow.addColorStop(0, scanRgba(SCAN_C.gold, 0));
      glow.addColorStop(0.8, scanRgba(SCAN_C.gold, 0.07 * sweep));
      glow.addColorStop(1, scanRgba(SCAN_C.gold, 0.13 * sweep));
      ctx.fillStyle = glow; ctx.fillRect(left, sweepY - band, size, band * 1.5);
    }

    const cell = size / N, pad = cell * 0.11, revealWave = progress * (N * 2 + 6);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!qr.matrix[r][c]) continue;
        const appear = scanClamp((revealWave - (r + c)) / 4, 0, 1);
        if (appear <= 0.02) continue;
        const x = left + c * cell, y = top + r * cell;
        const distance = Math.abs(y + cell / 2 - sweepY);
        const lit = distance < band ? Math.pow(1 - distance / band, 1.6) : 0;
        const structural = qr.reserved[r][c] === 1;
        const alpha = ((structural ? 0.92 : 0.58) + lit * 0.40) * appear;
        const moduleSize = (cell - pad * 2) * (1 + lit * 0.20) * (0.55 + 0.45 * appear);
        ctx.fillStyle = lit > 0.2 ? scanRgba(SCAN_C.soft, alpha) : structural ? scanRgba(SCAN_C.cream, alpha) : scanRgba(SCAN_C.gold, alpha);
        scanRoundRect(ctx, x + cell / 2 - moduleSize / 2, y + cell / 2 - moduleSize / 2, moduleSize, moduleSize, moduleSize * 0.26);
        ctx.fill();
      }
    }

    if (progress > 0.25) {
      const sweep = scanSmooth(scanClamp((progress - 0.25) / 0.3, 0, 1));
      scanGlow(ctx, scanRgba(SCAN_C.soft, 0.9), 14, () => {
        ctx.strokeStyle = scanRgba(SCAN_C.cream, 0.85 * sweep); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(left - size * 0.02, sweepY); ctx.lineTo(left + size * 1.02, sweepY); ctx.stroke();
      });
    }

    if (progress > 0.55) {
      const logoProgress = scanSmooth(scanClamp((progress - 0.55) / 0.35, 0, 1));
      const logoSize = cell * 7.7;
      ctx.save(); ctx.globalAlpha = logoProgress;
      ctx.fillStyle = '#050505';
      scanRoundRect(ctx, cardX - logoSize / 2, cardY - logoSize / 2, logoSize, logoSize, logoSize * 0.22);
      ctx.fill(); ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.5); ctx.lineWidth = 1; ctx.stroke();
      drawScanMark(ctx, cardX, cardY, logoSize * 0.86, 0.95);
      ctx.restore();
    }

    const bracketOffset = size * 0.605, bracketLength = size * 0.19;
    const bracketProgress = scanSmooth(scanClamp(progress / 0.5, 0, 1));
    const breathe = 1 + Math.sin(t * 1.5) * 0.012;
    ctx.save(); ctx.strokeStyle = scanRgba(SCAN_C.hi, 0.92 * bracketProgress); ctx.lineWidth = 2; ctx.lineCap = 'square';
    scanGlow(ctx, scanRgba(SCAN_C.gold, 0.5), 12, () => {
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach((side) => {
        const x = cardX + side[0] * bracketOffset * breathe;
        const y = cardY + side[1] * bracketOffset * breathe;
        ctx.beginPath();
        ctx.moveTo(x, y - side[1] * bracketLength * bracketProgress);
        ctx.lineTo(x, y);
        ctx.lineTo(x - side[0] * bracketLength * bracketProgress, y);
        ctx.stroke();
      });
    });
    ctx.restore();

    if (showPhone && progress > 0.35) {
      const phoneProgress = scanSmooth(scanClamp((progress - 0.35) / 0.4, 0, 1));
      ctx.save(); ctx.globalAlpha = phoneProgress;
      ctx.fillStyle = 'rgba(7,7,8,0.96)';
      scanRoundRect(ctx, phoneX, phoneY - phoneH / 2, phoneW, phoneH, phoneW * 0.17);
      ctx.fill(); ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.5); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = scanRgba(SCAN_C.gold, 0.32);
      scanRoundRect(ctx, phoneX + phoneW * 0.38, phoneY - phoneH / 2 + phoneW * 0.095, phoneW * 0.24, phoneW * 0.032, phoneW * 0.02);
      ctx.fill();
      const screenX = phoneX + phoneW * 0.095, screenY = phoneY - phoneH / 2 + phoneW * 0.215;
      const screenW = phoneW * 0.81, screenH = phoneH - phoneW * 0.42;
      ctx.save(); scanRoundRect(ctx, screenX, screenY, screenW, screenH, phoneW * 0.08); ctx.clip();
      ctx.fillStyle = scanRgba(SCAN_C.gold, 0.14); ctx.fillRect(screenX, screenY, screenW, screenH * 0.15);
      ctx.fillStyle = scanRgba(SCAN_C.soft, 0.55); ctx.fillRect(screenX + screenW * 0.10, screenY + screenH * 0.062, screenW * 0.34, Math.max(1.5, screenH * 0.020));
      ctx.fillStyle = scanRgba(SCAN_C.gold, 0.45); ctx.fillRect(screenX + screenW * 0.66, screenY + screenH * 0.062, screenW * 0.24, Math.max(1.5, screenH * 0.020));
      for (let i = 0; i < 4; i++) {
        const lineY = screenY + screenH * (0.30 + i * 0.135);
        ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.22); ctx.lineWidth = 1; ctx.setLineDash([3,4]);
        ctx.beginPath(); ctx.moveTo(screenX + screenW * 0.06, lineY); ctx.lineTo(screenX + screenW * 0.94, lineY); ctx.stroke(); ctx.setLineDash([]);
        const runner = scanFrac(t * (0.30 + i * 0.055) + i * 0.21);
        const runnerX = screenX + screenW * (0.94 - 0.88 * runner), lead = i === 1;
        ctx.fillStyle = scanRgba(lead ? SCAN_C.soft : SCAN_C.gold, lead ? 0.95 : 0.5);
        ctx.beginPath(); ctx.arc(runnerX, lineY, lead ? 3 : 2, 0, SCAN_TAU); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.22); ctx.lineWidth = 1;
      scanRoundRect(ctx, screenX, screenY, screenW, screenH, phoneW * 0.08); ctx.stroke();
      const buttonW = screenW * 0.74, buttonH = phoneW * 0.20;
      const buttonX = screenX + (screenW - buttonW) / 2, buttonY = screenY + screenH - buttonH - phoneW * 0.10;
      const button = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonH);
      button.addColorStop(0, '#F2CE76'); button.addColorStop(1, '#C9922B');
      ctx.fillStyle = button; scanRoundRect(ctx, buttonX, buttonY, buttonW, buttonH, buttonH / 2); ctx.fill();
      ctx.fillStyle = 'rgba(23,17,4,0.75)'; ctx.fillRect(buttonX + buttonW * 0.30, buttonY + buttonH * 0.44, buttonW * 0.40, Math.max(1.6, buttonH * 0.11));
      ctx.restore();
    }

    if (progress > 0.6) {
      const statusProgress = scanSmooth(scanClamp((progress - 0.6) / 0.4, 0, 1));
      const barW = size * 1.17, barX = cardX - barW / 2, barY = cardY + size * 0.70;
      ctx.save(); ctx.globalAlpha = statusProgress;
      ctx.strokeStyle = scanRgba(SCAN_C.gold, 0.20); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();
      const fill = scanFrac(t * 0.40);
      scanGlow(ctx, scanRgba(SCAN_C.gold, 0.7), 10, () => {
        ctx.strokeStyle = scanRgba(SCAN_C.hi, 0.95); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW * fill, barY); ctx.stroke();
      });
      ctx.font = '500 ' + Math.round(size * 0.045) + 'px "IBM Plex Mono", monospace';
      ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = scanRgba(SCAN_C.gold, 0.6);
      ctx.fillText(fill > 0.92 ? 'GATE OPEN' : 'SCANNING', barX, barY + size * 0.045);
      ctx.textAlign = 'right'; ctx.fillStyle = scanRgba(SCAN_C.soft, 0.85);
      ctx.fillText(String(Math.round(fill * 100)).padStart(2, '0') + '%', barX + barW, barY + size * 0.045);
      ctx.restore();
    }
    ctx.restore();
  }

  class SaheelEngine {
    constructor() {
      this.canvas = document.getElementById('saheel-canvas');
      this.scrollyContainer = document.querySelector('[data-story-root]');
      this.hub = document.getElementById('about');
      this.opening = document.querySelector('[data-opening-screens]');
      this.rail = document.querySelector('[data-rail]');
      this.venueTaif = document.querySelector('[data-venue="taif"]');
      this.venueRiyadh = document.querySelector('[data-venue="riyadh"]');
      this.logo = document.querySelector('.hero-network-logo');
      if (!this.canvas) return;
      const CFG = window.SAHEEL_CFG || {};
      this.links = CFG.links !== false;

      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.p = 0; this.pt = 0; this.t = 0;
      this.hubT = 0; this.hubMix = 0;
      this.mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false };
      this.geo = null; this.slow = 0;

      this.mobile = window.matchMedia('(max-width: 820px)').matches;
      this.count = this.mobile ? 1000 : (CFG.count || 3300);
      this.dprCap = this.mobile ? 1.5 : 2;

      this.buildSprite();
      this.buildParticles();
      this.buildHorse();
      this.buildLogo();
      this.buildTaif();
      this.buildRiyadh();
      this.resize();

      this.acts = Array.from(document.querySelectorAll('[data-act]'));
      this.N = this.acts.length || 7;
      this.dots = Array.from(document.querySelectorAll('[data-dot]'));
      this.tele = {};
      document.querySelectorAll('[data-tele]').forEach((el) => {
        this.tele[el.getAttribute('data-tele')] = el.querySelector('[data-val]');
      });
      this.tip = document.querySelector('[data-tip]');
      this.nodeLayer = document.querySelector('[data-nodes]');

      this.bindEvents();
      this.setupReveal();
      this.loadGeo();
      this.onScroll();

      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }

    bindEvents() {
      const self = this;
      window.addEventListener('scroll', () => self.onScroll(), { passive: true });
      window.addEventListener('resize', () => { self.resize(); if (self.nodes) self.nodes = null; });
      window.addEventListener('pointermove', (e) => {
        self.mouse.tx = e.clientX; self.mouse.ty = e.clientY; self.mouse.active = true;
        self.magnet(e);
      }, { passive: true });
      window.addEventListener('pointerleave', () => {
        self.mouse.active = false; self.mouse.tx = -1e4; self.mouse.ty = -1e4;
      });

      this.dots.forEach((d) => {
        d.addEventListener('click', () => self.jumpTo(+d.getAttribute('data-dot')));
        d.addEventListener('pointerenter', () => {
          const lab = d.querySelector('[data-lab]');
          if (lab) lab.style.opacity = '1';
        });
        d.addEventListener('pointerleave', () => {
          const lab = d.querySelector('[data-lab]');
          if (self.actIndex !== +d.getAttribute('data-dot') && lab) lab.style.opacity = '0';
        });
      });

      document.querySelectorAll('[data-jump]').forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          self.jumpTo(+a.getAttribute('data-jump'));
        });
      });

      this.magnets = Array.from(document.querySelectorAll('[data-magnet]'));
    }

    setupReveal() {
      const els = Array.from(document.querySelectorAll('[data-reveal]'));
      const vh = window.innerHeight;
      const pending = [];
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top > vh * 0.85) {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(0,44px,0)';
          el.style.transition = 'opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.16,1,.3,1)';
          el.style.transitionDelay = (el.getAttribute('data-reveal-delay') || '0') + 'ms';
          pending.push(el);
        }
      });
      if (!pending.length) return;
      if (!('IntersectionObserver' in window)) {
        pending.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
        return;
      }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.style.opacity = '1';
            en.target.style.transform = 'translate3d(0,0,0)';
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '-6% 0px -6% 0px', threshold: 0.08 });
      pending.forEach((el) => io.observe(el));
    }

    magnet(e) {
      (this.magnets || []).forEach((b) => {
        const r = b.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d < 150) {
          const k = (1 - d / 150) * 0.28;
          b.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
        } else if (b.style.transform) {
          b.style.transform = '';
        }
      });
    }

    jumpTo(i) {
      const root = this.scrollyContainer;
      const rootTop = root ? root.getBoundingClientRect().top + window.scrollY : 0;
      const travel = root ? Math.max(window.innerHeight, root.offsetHeight - window.innerHeight) : window.innerHeight * 6;
      const target = rootTop + (Math.max(0, Math.min(this.N - 1, i)) / Math.max(1, this.N - 1)) * travel;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }

    onScroll() {
      const root = this.scrollyContainer;
      if (root) {
        const rect = root.getBoundingClientRect();
        const travel = Math.max(1, root.offsetHeight - window.innerHeight);
        this.pt = Math.min(1, Math.max(0, -rect.top / travel));
      } else {
        this.pt = 0;
      }
      if (this.hub) {
        const r = this.hub.getBoundingClientRect();
        const vh = window.innerHeight;
        this.hubT = Math.max(0, Math.min(1, (vh * 0.8 - r.top) / (vh * 0.45)));
      }
    }

    resize() {
      if (!this.canvas) return;
      this.mobile = window.matchMedia('(max-width: 820px)').matches;
      const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
      this.W = window.innerWidth; this.H = window.innerHeight; this.dpr = dpr;
      this.canvas.width = Math.floor(this.W * dpr);
      this.canvas.height = Math.floor(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.fillStyle = '#030303';
      this.ctx.fillRect(0, 0, this.W, this.H);

      if (this.rail) {
        this.rail.style.display = this.W < 720 ? 'none' : 'flex';
        const labels = this.W >= 1180;
        this.rail.querySelectorAll('[data-lab]').forEach((l) => { l.style.display = labels ? 'block' : 'none'; });
      }
    }

    buildSprite() {
      const s = 32, cv = document.createElement('canvas');
      cv.width = s; cv.height = s;
      const x = cv.getContext('2d');
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,240,200,1)');
      g.addColorStop(0.22, 'rgba(' + GOLD.join(',') + ',0.85)');
      g.addColorStop(0.55, 'rgba(190,140,50,0.22)');
      g.addColorStop(1, 'rgba(120,80,20,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      this.sprite = cv;
    }

    buildParticles() {
      const n = this.count, a = new Array(n);
      for (let i = 0; i < n; i++) {
        const s = Math.random();
        const gr = Math.acos(1 - 2 * (i + 0.5) / n);
        const ga = Math.PI * (1 + Math.sqrt(5)) * i;
        a[i] = {
          x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
          px: 0, py: 0, s: s, k: 0.055 + s * 0.075, sz: 0.6 + Math.pow(Math.random(), 2) * 2.2,
          a: 0.25 + s * 0.55,
          rx: Math.random(), ry: Math.random(), rz: Math.random(),
          lon: (ga * 180 / Math.PI) % 360 - 180, lat: 90 - gr * 180 / Math.PI,
          lane: i % 9, u: Math.random(), hi: i
        };
      }
      this.parts = a;
    }

    samplePts(cv, want) {
      const w = cv.width, h = cv.height;
      const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
      const on = (px, py) => (px >= 0 && py >= 0 && px < w && py < h) && d[(py * w + px) * 4 + 3] > 140;
      const pts = [];
      for (let i = 0; i < 60000 && pts.length < want; i++) {
        const px = 1 + Math.floor(Math.random() * (w - 2)), py = 1 + Math.floor(Math.random() * (h - 2));
        if (on(px, py)) pts.push([px / w - 0.5, py / h - 0.5]);
      }
      return pts;
    }

    buildHorse() {
      // The supplied reference is the source of truth: a portrait of an Arabian
      // horse built from transparent highlights. It becomes the particle mask
      // after decoding, preserving the original drawing without approximation.
      this.horsePts = [];
      this.horseAspect = 440 / 330;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth || 330;
        cv.height = img.naturalHeight || 440;
        const x = cv.getContext('2d', { willReadFrequently: true });
        x.clearRect(0, 0, cv.width, cv.height);
        x.drawImage(img, 0, 0, cv.width, cv.height);
        this.horseAspect = cv.height / cv.width;
        this.horsePts = this.samplePts(cv, this.mobile ? 1800 : 3100);
      };
      img.src = 'images/saheel-horse-grid-19.png';
    }

    buildLogo() {
      this.logoPts = [];
      this.logoAspect = 1 / 1.48;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth || 740;
        cv.height = img.naturalHeight || 500;
        const x = cv.getContext('2d', { willReadFrequently: true });
        x.clearRect(0, 0, cv.width, cv.height);
        x.drawImage(img, 0, 0, cv.width, cv.height);
        this.logoAspect = cv.height / cv.width;
        this.logoPts = this.samplePts(cv, this.mobile ? 1500 : 2800);
      };
      img.src = 'images/saheel-network-logo.png';
    }

    buildScan() {
      // A precise instant-entry interface: QR portal, data beam and mobile confirmation.
      const w = 660, h = 440, cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
      const stroke = (width, draw) => { x.lineWidth = width; x.beginPath(); draw(x); x.stroke(); };
      const rr = (left, top, width, height, radius) => {
        x.beginPath(); x.roundRect(left, top, width, height, radius); x.stroke();
      };
      const finder = (cx, cy) => {
        x.lineWidth = 8; x.strokeRect(cx, cy, 42, 42);
        x.lineWidth = 5; x.strokeRect(cx + 11, cy + 11, 20, 20);
      };

      // QR portal — framed, generous and immediately recognisable.
      x.lineWidth = 6; rr(70, 76, 238, 238, 22);
      x.lineWidth = 3; rr(83, 89, 212, 212, 14);
      finder(104, 110); finder(218, 110); finder(104, 224);
      const modules = [
        [4,1],[5,1],[4,2],[6,2],[3,3],[4,3],[6,3],[1,4],[2,4],[4,4],[5,4],[7,4],
        [2,5],[3,5],[5,5],[6,5],[7,5],[1,6],[4,6],[6,6],[7,6],[3,7],[4,7],[6,7],[7,7]
      ];
      modules.forEach(m => {
        const mx = 100 + m[0] * 23, my = 106 + m[1] * 23;
        x.fillRect(mx, my, 11, 11);
      });

      // Corner brackets and the travelling scan beam.
      stroke(11, p => {
        p.moveTo(54, 136); p.lineTo(54, 60); p.lineTo(130, 60);
        p.moveTo(248, 60); p.lineTo(324, 60); p.lineTo(324, 136);
        p.moveTo(324, 254); p.lineTo(324, 330); p.lineTo(248, 330);
        p.moveTo(130, 330); p.lineTo(54, 330); p.lineTo(54, 254);
      });
      stroke(5, p => { p.moveTo(88, 196); p.lineTo(291, 196); });
      stroke(2.5, p => {
        p.moveTo(92, 188); p.lineTo(287, 188);
        p.moveTo(92, 204); p.lineTo(287, 204);
      });

      // Data stream into a clean mobile interface.
      stroke(4, p => {
        p.moveTo(326, 175); p.bezierCurveTo(356, 148, 374, 146, 405, 158);
        p.moveTo(326, 216); p.bezierCurveTo(360, 238, 377, 241, 405, 230);
      });
      for (let i = 0; i < 5; i++) {
        x.beginPath(); x.arc(345 + i * 13, 196 + Math.sin(i * 1.4) * 14, 4.5, 0, Math.PI * 2); x.fill();
      }

      // Smartphone in slight perspective, with a positive entry confirmation.
      x.save();
      x.translate(503, 204); x.rotate(0.075);
      x.lineWidth = 10; rr(-84, -146, 168, 292, 30);
      x.lineWidth = 3; rr(-69, -126, 138, 250, 21);
      stroke(6, p => { p.moveTo(-20, -134); p.lineTo(20, -134); });
      x.lineWidth = 6; x.beginPath(); x.arc(0, -20, 48, 0, Math.PI * 2); x.stroke();
      stroke(11, p => { p.moveTo(-24, -18); p.lineTo(-5, 2); p.lineTo(29, -39); });
      stroke(4, p => {
        p.moveTo(-38, 60); p.lineTo(38, 60);
        p.moveTo(-29, 81); p.lineTo(29, 81);
      });
      x.beginPath(); x.arc(0, 132, 5, 0, Math.PI * 2); x.fill();
      x.restore();

      // A restrained orbit hints at instant network hand-off.
      stroke(3, p => { p.ellipse(337, 196, 285, 126, -0.04, -0.62, 0.72); });
      this.scanPts = this.samplePts(cv, 2500);
      this.scanAspect = h / w;
    }

    loop(now) {
      this.raf = requestAnimationFrame(this.loop);
      const dt = Math.min(50, now - (this.last || now));
      this.last = now;
      if (dt > 26) this.slow++; else this.slow = Math.max(0, this.slow - 1);
      if (this.slow > 45 && this.count > 700) { this.count = Math.floor(this.count * 0.75); this.slow = 0; }
      this.t += dt / 1000;
      this.p += (this.pt - this.p) * 0.075;
      this.hubMix += (this.hubT - this.hubMix) * 0.06;
      this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.12;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.12;
      this.updateDom();
      this.draw();
    }

    updateDom() {
      const p = this.p, n = this.N, seg = 1 / n;
      const storyP = p * n / 9;
      const idx = Math.min(n - 1, Math.floor(p / seg));
      const hubOn = this.hubMix > 0.5;
      for (let i = 0; i < this.acts.length; i++) {
        const local = (p - i * seg) / seg;
        let o = 0, y = 0;
        if (local > -0.05 && local < 1.05) {
          const e = i === 0 ? 1 : this.smooth(local / 0.2);
          const f = i === this.acts.length - 1 ? 1 : this.smooth((1 - local) / 0.2);
          o = Math.min(e, f);
          y = (0.5 - Math.max(0, Math.min(1, local))) * -64;
        }
        if (hubOn) o = 0;
        const el = this.acts[i];
        if (el._o !== o.toFixed(2)) { el.style.opacity = o.toFixed(3); el._o = o.toFixed(2); }
        el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
        el.style.pointerEvents = (!hubOn && o > 0.6) ? 'auto' : 'none';
      }
      if (this.opening) {
        const want = hubOn ? 'hidden' : '';
        if (this.opening._v !== want) {
          this.opening.style.visibility = want;
          this.opening.style.opacity = hubOn ? '0' : '1';
          this.opening._v = want;
        }
      }
      if (this.logo) {
        // Keep the solid identity as an opening signature only. The finale is
        // drawn exclusively by the particle system so the two marks never stack.
        const opening = 1 - this.smooth((p - seg * 0.72) / (seg * 0.24));
        const opacity = hubOn ? 0 : opening;
        const finalMode = false;
        const scale = 1;
        const hidden = opacity < 0.01;
        const key = scale.toFixed(3) + '|' + opacity.toFixed(3) + '|' + hidden + '|' + finalMode;
        if (this.logo._mode !== key) {
          this.logo.classList.toggle('is-finale', finalMode);
          this.logo.style.top = finalMode ? '48%' : '';
          this.logo.style.transform = finalMode
            ? 'translate(-50%,-50%) scale(' + scale + ')'
            : 'translateX(-50%) scale(' + scale + ')';
          this.logo.style.opacity = String(opacity);
          this.logo.style.visibility = hidden ? 'hidden' : 'visible';
          this.logo._mode = key;
        }
      }
      if (this.rail) {
        const want = hubOn ? '0' : '1';
        if (this.rail._v !== want) {
          this.rail.style.opacity = want;
          this.rail.style.pointerEvents = hubOn ? 'none' : 'auto';
          this.rail._v = want;
        }
      }
      const setVenue = (el, value) => {
        if (!el) return;
        const key = value.toFixed(2);
        if (el._v !== key) {
          el.style.opacity = value.toFixed(3);
          el.style.transform = 'scale(' + (0.92 + 0.08 * value).toFixed(3) + ')';
          el._v = key;
        }
      };
      const taifVenue = hubOn ? 0 : Math.max(0, Math.min(1, (storyP - 0.490) / 0.012)) * Math.max(0, Math.min(1, (0.582 - storyP) / 0.018));
      const riyadhVenue = hubOn ? 0 : Math.max(0, Math.min(1, (storyP - 0.622) / 0.013)) * Math.max(0, Math.min(1, (0.675 - storyP) / 0.012));
      setVenue(this.venueTaif, taifVenue);
      setVenue(this.venueRiyadh, riyadhVenue);
      if (this.actIndex !== idx) {
        this.actIndex = idx;
        this.dots.forEach((d, i) => {
          const on = i === idx;
          const tick = d.querySelector('[data-tick]'), lab = d.querySelector('[data-lab]');
          if (tick) {
            tick.style.width = on ? '30px' : '14px';
            tick.style.background = on ? '#F2CE76' : 'rgba(233,188,92,0.4)';
            tick.style.boxShadow = on ? '0 0 12px rgba(233,188,92,0.8)' : 'none';
          }
          if (lab) lab.style.opacity = on ? '0.9' : '0';
          d.style.color = on ? 'rgba(255,239,198,0.95)' : 'rgba(233,188,92,0.35)';
        });
      }
      if (this.nodeLayer) {
        const show = !hubOn && storyP > 0.45 && storyP < 0.73;
        const want = show ? '1' : '0';
        if (this.nodeLayer._v !== want) {
          this.nodeLayer.style.opacity = want;
          this.nodeLayer.style.pointerEvents = show ? 'auto' : 'none';
          this.nodeLayer._v = want;
        }
      }
      if (p > 0.79 && p < 0.97 && this.tele.speed) this.updateTele();
    }

    updateTele() {
      if (this.t - (this.teleT || 0) < 0.09) return;
      this.teleT = this.t;
      const b = Math.max(0, Math.min(1, (this.p - 0.80) / 0.14));
      const set = (el, v) => { if (el) el.textContent = v; };
      set(this.tele.speed, Math.max(15, Math.round(60 - b * 45)));
      set(this.tele.hr, '8');
      set(this.tele.stride, '01');
      set(this.tele.power, '0');
      set(this.tele.lat, '#1');
    }

    draw() {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(3,3,3,0.30)';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalCompositeOperation = 'lighter';
      this.scene();
      ctx.globalCompositeOperation = 'source-over';

      // The scan act uses the supplied visual language as a dedicated premium
      // interface layer. It stays above the ambient particle field and below
      // the DOM copy, so the instruction remains readable at every viewport.
      const seg = 1 / this.N;
      const local = (this.p - seg * 2) / seg;
      const enter = this.smooth(local / 0.20);
      const exit = this.smooth((1 - local) / 0.22);
      const visibility = Math.min(enter, exit) * (1 - this.hubMix);
      if (visibility > 0.002) {
        const showPhone = this.W >= 760;
        const size = Math.min(
          this.W * (showPhone ? 0.24 : 0.55),
          this.H * (showPhone ? 0.39 : 0.30)
        );
        drawScanVisual(ctx, {
          cx: this.W * (showPhone ? 0.56 : 0.43),
          cy: this.H * (showPhone ? 0.40 : 0.32),
          size,
          t: this.t,
          progress: visibility,
          phone: showPhone
        });
      }
    }

    smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

    scene() {
      const p = this.p, N = this.N, seg = 1 / N, m = this.hubMix;
      const storyP = p * N / 9;
      const fi = Math.min(N - 0.0001, Math.max(0, p / seg));
      const i = Math.floor(fi), f = this.smooth((fi - i - 0.58) / 0.34);
      const cam = this.camera(storyP);
      this.taifDim = Math.max(0, Math.min(1, (storyP - 0.50) / 0.02)) * Math.max(0, Math.min(1, (0.59 - storyP) / 0.02));
      const n = Math.min(this.count, this.parts.length);
      const A = this.pos.bind(this), ctx = this.ctx;

      let lineW = Math.max(0, Math.min(1, (storyP - 0.115) / 0.04)) * Math.max(0, Math.min(1, (0.25 - storyP) / 0.04));
      const horseW = Math.max(0, Math.min(1, (storyP - 0.305) / 0.035)) * Math.max(0, Math.min(1, (0.458 - storyP) / 0.035));
      const finaleW = Math.max(0, Math.min(1, (storyP - 0.79) / 0.035)) * (1 - m);
      let globeW = Math.max(0, Math.min(1, (storyP - 0.42) / 0.03)) * Math.max(0, Math.min(1, (0.855 - storyP) / 0.035)) * (1 - m);
      lineW = Math.max(lineW * (1 - m), horseW * 0.72 * (1 - m), finaleW * 0.82, m * 0.44);

      if (globeW > 0.01) this.drawGlobe(cam, globeW, storyP);

      for (let k = 0; k < n; k++) {
        const q = this.parts[k];
        const a = A(i, q, k, cam), b = A(Math.min(N - 1, i + 1), q, k, cam);
        let tx = a.x + (b.x - a.x) * f, ty = a.y + (b.y - a.y) * f;
        let al = (a.a + (b.a - a.a) * f) * q.a;
        let sz = (a.s + (b.s - a.s) * f) * q.sz;

        if (m > 0.01) {
          const np = this.posNet(q, k);
          tx += (np.x - tx) * m; ty += (np.y - ty) * m;
          al += (np.a * q.a * 0.55 - al) * m;
          sz += (np.s * q.sz - sz) * m;
        }

        if (this.mouse.active) {
          const dx = q.x - this.mouse.x, dy = q.y - this.mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 20000 && d2 > 1) {
            const force = (1 - Math.sqrt(d2) / 141) * 26;
            tx += dx / Math.sqrt(d2) * force; ty += dy / Math.sqrt(d2) * force;
            al = Math.min(1, al * 1.5);
          }
        }
        q.px = q.x; q.py = q.y;
        q.x += (tx - q.x) * q.k; q.y += (ty - q.y) * q.k;

        if (al > 0.012 && q.x > -80 && q.x < this.W + 80 && q.y > -80 && q.y < this.H + 80) {
          const s = Math.max(0.7, sz) * 6;
          ctx.globalAlpha = Math.min(1, al);
          ctx.drawImage(this.sprite, q.x - s / 2, q.y - s / 2, s, s);
          const vx = q.x - q.px, vy = q.y - q.py;
          if (vx * vx + vy * vy > 30) {
            ctx.strokeStyle = 'rgba(233,188,92,' + Math.min(0.5, al * 0.55).toFixed(3) + ')';
            ctx.lineWidth = Math.min(1.6, sz * 0.7);
            ctx.beginPath(); ctx.moveTo(q.px, q.py); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (this.links && lineW > 0.01) this.drawLinks(lineW, n);
    }

    pos(act, q, k, cam) {
      switch (act) {
        case 0: return this.posDust(q);
        case 1: return this.posNet(q, k);
        case 2: return this.posScan(q, k);
        case 3: return this.posHorse(q, k, 0);
        case 4: case 5: return this.posSphere(q, cam, true);
        case 6: return this.posSphere(q, cam, false);
        case 7: return this.posFinalLogo(q, k);
        default: return this.posFinalLogo(q, k);
      }
    }

    posDust(q) {
      const t = this.t;
      return {
        x: (q.rx * 1.2 - 0.1) * this.W + Math.sin(t * 0.16 + q.s * 9) * 46,
        y: (q.ry * 1.2 - 0.1) * this.H + Math.cos(t * 0.13 + q.s * 7) * 40,
        a: 0.05 + Math.pow(q.s, 3) * 0.5, s: 0.5
      };
    }

    posNet(q, k) {
      const cols = Math.max(8, Math.round(Math.sqrt(this.count * (this.W / this.H))));
      const rows = Math.ceil(this.count / cols);
      const cx = k % cols, cy = Math.floor(k / cols);
      const t = this.t;
      return {
        x: (cx + 0.5) / cols * this.W * 1.12 - this.W * 0.06 + Math.sin(t * 0.5 + q.s * 12) * 16,
        y: (cy + 0.5) / rows * this.H * 1.1 - this.H * 0.05 + Math.cos(t * 0.45 + q.s * 10) * 14,
        a: 0.5 + Math.sin(t * 1.5 + q.s * 20) * 0.22, s: 0.85
      };
    }

    posScan(q, k) {
      // A restrained peripheral field replaces the old particle QR. The main
      // scan interface is now drawn with clean geometry, leaving the copy clear.
      const t = this.t;
      const x = (q.rx * 1.12 - 0.06) * this.W + Math.sin(t * 0.30 + q.s * 13) * 12;
      const y = (q.ry * 1.12 - 0.06) * this.H + Math.cos(t * 0.26 + q.s * 11) * 10;
      const lowerFade = y > this.H * 0.56 ? 0.22 : 1;
      return {
        x,
        y,
        a: (0.025 + Math.pow(q.s, 2.2) * 0.10) * lowerFade,
        s: 0.34 + q.s * 0.18
      };
    }

    posHorse(q, k, phase) {
      const pts = this.horsePts || [];
      if (!pts.length) return this.posDust(q);
      const pt = pts[k % pts.length];
      const scale = Math.min(this.W * (phase ? 0.28 : (this.mobile ? 0.66 : 0.30)), this.H * (phase ? 0.42 : (this.mobile ? 0.48 : 0.52)));
      const bob = phase ? Math.sin(this.t * 5.4 + pt[0] * 2.4) * this.H * 0.009 : Math.sin(this.t * 2.2 + pt[0] * 2.4) * this.H * 0.004;
      const surge = phase ? Math.sin(this.t * 5.4 + 1.2) * this.W * 0.006 : 0;
      return {
        x: this.W * (phase ? 0.23 : (this.mobile ? 0.50 : 0.27)) + pt[0] * scale + surge + Math.sin(this.t * 0.8 + q.s * 8) * 1.25,
        y: this.H * (phase ? 0.76 : (this.mobile ? 0.40 : 0.49)) + pt[1] * scale * (this.horseAspect || 1.333) + bob,
        a: (phase ? 0.62 : 0.58) + Math.pow(q.s, 1.35) * 0.46, s: 0.54 + q.s * 0.28
      };
    }

    posFinalLogo(q, k) {
      const pts = this.logoPts || [];
      if (!pts.length) return this.posNet(q, k);
      const pt = pts[k % pts.length];
      const scale = Math.min(this.W * (this.mobile ? 0.82 : 0.58), this.H * (this.mobile ? 0.58 : 0.72));
      const pulse = 1 + Math.sin(this.t * 1.4 + q.s * 7) * 0.008;
      return {
        x: this.W * 0.5 + pt[0] * scale * pulse + Math.sin(this.t * 0.7 + q.s * 10) * 1.4,
        y: this.H * (this.mobile ? 0.47 : 0.49) + pt[1] * scale * (this.logoAspect || 0.676) * pulse + Math.cos(this.t * 0.6 + q.s * 8) * 1.4,
        a: 0.34 + Math.pow(q.s, 1.2) * 0.54,
        s: 0.46 + q.s * 0.24
      };
    }

    posTrack(q, speed) {
      const horizon = this.H * 0.52;
      let z = (q.u + this.t * 0.17 * speed) % 1;
      const near = Math.pow(1 - z, 2.15);
      const lane = (q.lane - 4) + (q.rx - 0.5) * 0.55;
      return {
        x: this.W * 0.5 + lane * (0.06 + near * 1.05) * this.W * 0.105,
        y: horizon + near * this.H * 0.52 + (q.rz - 0.5) * 6,
        a: 0.18 + near * 0.85, s: 0.35 + near * 1.5
      };
    }

    posRace(q, k) {
      if (k % 2 === 0) return this.posHorse(q, k >> 1, 1);
      const tr = this.posTrack(q, 2.2);
      tr.a *= 0.5; tr.s *= 0.8;
      return tr;
    }

    drawLinks(w, n) {
      const ctx = this.ctx, cell = 52, cols = Math.ceil(this.W / cell) + 1;
      const grid = new Map();
      for (let k = 0; k < n; k += 2) {
        const q = this.parts[k];
        const gx = (q.x / cell) | 0, gy = (q.y / cell) | 0, key = gy * cols + gx;
        let arr = grid.get(key); if (!arr) { arr = []; grid.set(key, arr); }
        if (arr.length < 5) arr.push(q);
      }
      ctx.lineWidth = 0.6;
      let drawn = 0;
      const cap = this.mobile ? 1100 : 3600;
      grid.forEach((arr, key) => {
        if (drawn > cap) return;
        const neigh = [grid.get(key + 1), grid.get(key + cols), grid.get(key + cols + 1)];
        for (let a = 0; a < arr.length; a++) {
          for (let g = -1; g < 3; g++) {
            const other = g < 0 ? arr : neigh[g];
            if (!other) continue;
            for (let b = g < 0 ? a + 1 : 0; b < other.length; b++) {
              const p1 = arr[a], p2 = other[b];
              const dx = p2.x - p1.x, dy = p2.y - p1.y, d = Math.hypot(dx, dy);
              if (d > 58 || d < 2) continue;
              ctx.strokeStyle = 'rgba(233,188,92,' + ((1 - d / 58) * 0.30 * w).toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
              drawn++;
              if (drawn > cap) return;
            }
          }
        }
      });
    }

    drawTrack(w, p) {
      const ctx = this.ctx, H = this.H, W = this.W, horizon = H * 0.52;
      const speed = p > 0.90 ? 2.1 : 1;
      ctx.save();
      ctx.lineWidth = 1;
      for (let l = -4; l <= 4; l++) {
        const x0 = W * 0.5 + l * 0.06 * W * 0.105;
        const x1 = W * 0.5 + l * 1.11 * W * 0.105;
        const g = ctx.createLinearGradient(x0, horizon, x1, horizon + H * 0.52);
        const a = (0.05 + Math.abs(l) * 0.012) * w;
        g.addColorStop(0, 'rgba(233,188,92,0)');
        g.addColorStop(0.35, 'rgba(233,188,92,' + (a * 2.4).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,232,180,' + (a * 4).toFixed(3) + ')');
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(x0, horizon); ctx.lineTo(x1, horizon + H * 0.52); ctx.stroke();
      }
      for (let r = 0; r < 9; r++) {
        let z = ((r / 9) + this.t * 0.17 * speed) % 1;
        const near = Math.pow(1 - z, 2.15);
        const y = horizon + near * H * 0.52;
        const half = (0.06 + near * 1.05) * W * 0.105 * 4.3;
        ctx.strokeStyle = 'rgba(233,188,92,' + (0.16 * near * w).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(W * 0.5 - half, y); ctx.lineTo(W * 0.5 + half, y); ctx.stroke();
      }
      const hg = ctx.createLinearGradient(0, horizon - H * 0.1, 0, horizon + H * 0.05);
      hg.addColorStop(0, 'rgba(233,188,92,0)');
      hg.addColorStop(0.72, 'rgba(233,188,92,' + (0.13 * w).toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(233,188,92,0)');
      ctx.fillStyle = hg; ctx.fillRect(0, horizon - H * 0.1, W, H * 0.15);
      ctx.restore();
    }

    loadGeo() {
      const self = this;
      this.world = [
        [139.69, 35.68], [-0.13, 51.51], [-74.01, 40.71], [2.35, 48.86], [55.27, 25.20],
        [151.21, -33.87], [-46.63, -23.55], [36.82, -1.29], [72.88, 19.08], [-118.24, 34.05],
        [121.47, 31.23], [18.42, -33.92]
      ];
      let tries = 0;
      const attempt = () => {
        if (window.d3 && window.topojson) {
          fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
            .then(r => r.json())
            .then(topo => {
              const fc = window.topojson.feature(topo, topo.objects.countries);
              const rings = [], ksa = [];
              fc.features.forEach(f => {
                const isK = String(f.id) === '682';
                const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
                polys.forEach(poly => {
                  poly.forEach(ring => {
                    const simp = [];
                    for (let i = 0; i < ring.length; i++) {
                      const last = simp[simp.length - 1];
                      if (!last || i === ring.length - 1 || Math.hypot(ring[i][0] - last[0], ring[i][1] - last[1]) > (isK ? 0.25 : 0.9)) simp.push(ring[i]);
                    }
                    if (simp.length > 2) (isK ? ksa : rings).push(simp);
                  });
                });
              });
              self.geo = rings; self.ksaRings = ksa;
              const feat = fc.features.filter(f => String(f.id) === '682')[0];
              if (feat && window.d3 && window.d3.geoContains) self.sampleKsa(feat);
            })
            .catch(() => {});
        } else if (tries++ < 70) {
          setTimeout(attempt, 140);
        }
      };
      attempt();
    }

    sampleKsa(feat) {
      const pool = [];
      for (let i = 0; i < 9000 && pool.length < 900; i++) {
        const lon = 34 + Math.random() * 22, lat = 16 + Math.random() * 16.6;
        if (window.d3.geoContains(feat, [lon, lat])) pool.push([lon, lat]);
      }
      if (!pool.length) return;
      this.parts.forEach((q, i) => {
        if (i % 2 === 0) { const c = pool[(i / 2) % pool.length]; q.slon = c[0]; q.slat = c[1]; }
      });
    }

    camera(p) {
      // [p, Rfactor, lon, lat, cx, cy, zoomFlag]
      const keys = [
        [0.42, 1.05, 45.5, 24.4, 0.50, 0.50, 1],
        [0.455, 1.05, 45.5, 24.4, 0.50, 0.50, 1],
        [0.490, 4.8, 40.45, 21.34, 0.50, 0.48, 1],
        [0.525, 17.5, TAIF_TRACK[0], TAIF_TRACK[1], 0.50, 0.48, 1],
        [0.565, 20.0, TAIF_TRACK[0], TAIF_TRACK[1], 0.50, 0.48, 1],
        [0.595, 12.0, TAIF_TRACK[0], TAIF_TRACK[1], 0.50, 0.48, 1],
        [0.620, 7.5, 43.1, 22.75, 0.50, 0.48, 1],
        [0.650, 15.5, RIYADH_TRACK[0], RIYADH_TRACK[1], 0.50, 0.48, 1],
        [0.690, 19.0, RIYADH_TRACK[0], RIYADH_TRACK[1], 0.50, 0.48, 1],
        [0.715, 5.0, RIYADH_TRACK[0], RIYADH_TRACK[1], 0.50, 0.48, 0.9],
        // One continuous westward orbit. The final longitude is the Saudi
        // longitude minus 360deg, so the camera returns home without reversing.
        [0.750, 0.50, 46.72, 24.69, 0.50, 0.48, 0.25],
        [0.772, 0.48, -10.0, 20.0, 0.50, 0.48, 0.14],
        [0.795, 0.46, -95.0, 15.0, 0.50, 0.48, 0.08],
        [0.818, 0.44, -200.0, 18.0, 0.50, 0.48, 0.08],
        [0.838, 0.43, -313.28, 24.69, 0.50, 0.48, 0.15],
        [0.860, 0.24, -313.28, 24.69, 0.50, 0.48, 0.0],
        [0.888, 0.14, -313.28, 24.69, 0.50, 0.48, 0.0]
      ];
      let a = keys[0], b = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (p >= keys[i][0] && p <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
        if (p < keys[0][0]) { a = keys[0]; b = keys[0]; break; }
        if (p > keys[keys.length - 1][0]) { a = b = keys[keys.length - 1]; break; }
      }
      const span = (b[0] - a[0]) || 1, f = this.smooth((p - a[0]) / span);
      const lp = (i) => a[i] + (b[i] - a[i]) * f;
      const zoom = lp(6);
      const mx = this.mouse.active ? (this.mouse.x / this.W - 0.5) : 0;
      const my = this.mouse.active ? (this.mouse.y / this.H - 0.5) : 0;
      const R = lp(1) * Math.min(this.W, this.H);
      return {
        R: R,
        lon: lp(2) + mx * 6 * (1 - zoom * 0.7),
        lat: Math.max(-70, Math.min(70, lp(3) - my * 5 * (1 - zoom * 0.8))),
        cx: this.W * lp(4), cy: this.H * lp(5), zoom: zoom
      };
    }

    project(lon, lat, cam) {
      const d = Math.PI / 180;
      const la = lat * d, lo = (lon - cam.lon) * d, la0 = cam.lat * d;
      const cl = Math.cos(la), sl = Math.sin(la), cl0 = Math.cos(la0), sl0 = Math.sin(la0);
      const cosc = sl0 * sl + cl0 * cl * Math.cos(lo);
      return {
        x: cam.cx + cam.R * cl * Math.sin(lo),
        y: cam.cy - cam.R * (cl0 * sl - sl0 * cl * Math.cos(lo)),
        v: cosc > 0.02, d: cosc
      };
    }

    posSphere(q, cam, ksaMode) {
      const kingdom = ksaMode && q.slon !== undefined;
      const pr = this.project(kingdom ? q.slon : q.lon, kingdom ? q.slat : q.lat, cam);
      if (!pr.v) return { x: pr.x, y: pr.y, a: 0, s: 0.4 };
      const dep = Math.min(1, pr.d * 1.5);
      return {
        x: pr.x + Math.sin(this.t * 0.7 + q.s * 9) * 1.6,
        y: pr.y + Math.cos(this.t * 0.6 + q.s * 7) * 1.6,
        a: (kingdom ? 0.85 * (1 - 0.75 * (this.taifDim || 0)) : 0.3) * (0.25 + dep * 0.85), s: (kingdom ? 0.9 * (1 - 0.45 * (this.taifDim || 0)) : 0.55) * (0.4 + dep * 0.7)
      };
    }

    strokeRings(rings, cam, alpha, width) {
      const ctx = this.ctx;
      ctx.strokeStyle = 'rgba(233,188,92,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let r = 0; r < rings.length; r++) {
        const ring = rings[r];
        let started = false;
        for (let i = 0; i < ring.length; i++) {
          const pr = this.project(ring[i][0], ring[i][1], cam);
          if (!pr.v) { started = false; continue; }
          if (!started) { ctx.moveTo(pr.x, pr.y); started = true; }
          else ctx.lineTo(pr.x, pr.y);
        }
      }
      ctx.stroke();
    }

    drawGlobe(cam, w, p) {
      const ctx = this.ctx, R = cam.R;
      ctx.save();
      if (R < Math.min(this.W, this.H) * 1.6) {
        const g = ctx.createRadialGradient(cam.cx, cam.cy, R * 0.62, cam.cx, cam.cy, R * 1.28);
        g.addColorStop(0, 'rgba(233,188,92,0)');
        g.addColorStop(0.52, 'rgba(233,188,92,' + (0.10 * w).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(233,188,92,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cam.cx, cam.cy, R * 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(233,188,92,' + (0.20 * w).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cam.cx, cam.cy, R, 0, Math.PI * 2); ctx.stroke();
      }

      const grat = [];
      for (let la = -60; la <= 60; la += 15) {
        const line = [];
        for (let lo = -180; lo <= 180; lo += 4) line.push([lo, la]);
        grat.push(line);
      }
      for (let lo = -180; lo < 180; lo += 15) {
        const line = [];
        for (let la = -90; la <= 90; la += 4) line.push([lo, la]);
        grat.push(line);
      }
      this.strokeRings(grat, cam, 0.055 * w, 0.6);

      if (this.geo) this.strokeRings(this.geo, cam, 0.26 * w, 0.85);
      if (this.ksaRings) {
        const kw = Math.max(0, Math.min(1, (p - 0.435) / 0.05));
        this.strokeRings(this.ksaRings, cam, (0.35 + 0.6 * kw) * w, 1.1 + kw * 0.7);
      }
      this.drawTaif(cam, p, w);
      this.drawRiyadh(cam, p, w);
      this.drawKsaLine(cam, p, w);
      this.drawArcs(cam, p, w);
      this.updateNodes(cam, p);
      ctx.restore();
    }

    buildTaif() {
      // Deterministic Taif city: lights cluster + radiating roads
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const lights = [];
      for (let i = 0; i < 220; i++) {
        const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.55) * 0.9;
        const stretch = 1 + 0.25 * Math.sin(a * 2);
        lights.push({ x: Math.cos(a) * r * stretch, y: Math.sin(a) * r * 0.72, r: 0.9 + rnd() * 2.4, tw: rnd() * 6.28, b: 0.35 + rnd() * 0.65 });
      }
      const roads = [];
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2 + 0.35;
        const line = [[0, 0]];
        let x = 0, y = 0;
        for (let s = 1; s <= 5; s++) {
          x += Math.cos(a + Math.sin(s * 1.7 + k) * 0.25) * 0.22;
          y += Math.sin(a + Math.sin(s * 1.7 + k) * 0.25) * 0.16;
          line.push([x, y]);
          if (rnd() < 0.85) lights.push({ x: x + (rnd() - 0.5) * 0.07, y: y + (rnd() - 0.5) * 0.05, r: 0.8 + rnd() * 1.6, tw: rnd() * 6.28, b: 0.3 + rnd() * 0.5 });
        }
        roads.push(line);
      }
      this.taif = { lights: lights, roads: roads };
    }

    buildRiyadh() {
      // A denser, orthogonal light field echoes Riyadh's urban fabric.
      let seed = 19;
      const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
      const lights = [];
      for (let i = 0; i < 300; i++) {
        const x = (rnd() - 0.5) * 1.8;
        const y = (rnd() - 0.5) * 1.25;
        lights.push({ x: x, y: y, r: 0.8 + rnd() * 2.1, tw: rnd() * Math.PI * 2, b: 0.28 + rnd() * 0.72 });
      }
      this.riyadh = { lights: lights };
    }

    drawTaif(cam, p, gw) {
      const zw = Math.max(0, Math.min(1, (p - 0.492) / 0.018)) * Math.max(0, Math.min(1, (0.605 - p) / 0.025)) * gw;
      if (zw < 0.01 || !this.taif) return;
      const c = this.project(TAIF_CITY[0], TAIF_CITY[1], cam);
      const course = this.project(TAIF_TRACK[0], TAIF_TRACK[1], cam);
      if (!c.v || !course.v) return;
      const S = Math.max(82, Math.min(Math.min(this.W, this.H) * 0.68, cam.R * 0.034));
      const ctx = this.ctx, t = this.t;
      // ambient city glow
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, S * 1.1);
      g.addColorStop(0, 'rgba(233,188,92,' + (0.10 * zw).toFixed(3) + ')');
      g.addColorStop(0.6, 'rgba(233,188,92,' + (0.045 * zw).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(233,188,92,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, S * 1.1, 0, Math.PI * 2); ctx.fill();
      // roads
      ctx.strokeStyle = 'rgba(233,188,92,' + (0.16 * zw).toFixed(3) + ')';
      ctx.lineWidth = 0.8;
      for (let r = 0; r < this.taif.roads.length; r++) {
        const line = this.taif.roads[r];
        ctx.beginPath();
        for (let i = 0; i < line.length; i++) {
          const X = c.x + line[i][0] * S, Y = c.y + line[i][1] * S * 0.8;
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        }
        ctx.stroke();
      }
      // twinkling city lights
      for (let i = 0; i < this.taif.lights.length; i++) {
        const L = this.taif.lights[i];
        const al = (0.3 + 0.7 * Math.abs(Math.sin(t * 1.2 + L.tw))) * L.b * zw;
        if (al < 0.02) continue;
        const s = L.r * 3.2;
        ctx.globalAlpha = Math.min(1, al);
        ctx.drawImage(this.sprite, c.x + L.x * S - s / 2, c.y + L.y * S * 0.8 - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      // The oval is anchored to the actual Al Hawiyah racecourse coordinates.
      const ox = course.x, oy = course.y;
      const rx = S * 0.21, ry = S * 0.115, rot = -0.16;
      const pt = (k, th) => {
        const cx0 = Math.cos(th) * rx * k, cy0 = Math.sin(th) * ry * k;
        return { x: ox + cx0 * Math.cos(rot) - cy0 * Math.sin(rot), y: oy + cx0 * Math.sin(rot) + cy0 * Math.cos(rot) };
      };
      const oval = (kx, alpha, width) => {
        ctx.strokeStyle = 'rgba(255,232,180,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.ellipse(ox, oy, rx * kx, ry * kx, rot, 0, Math.PI * 2); ctx.stroke();
      };
      oval(1, 0.12 * zw, 6);
      oval(1, 0.85 * zw, 1.6);
      oval(0.87, 0.30 * zw, 0.8);
      oval(0.74, 0.45 * zw, 1);
      // rotating light sweep along the outer rail
      ctx.strokeStyle = 'rgba(255,239,198,' + (0.55 * zw).toFixed(3) + ')';
      ctx.lineWidth = 2.2;
      const sa = t * 0.85;
      ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, rot, sa, sa + 0.7); ctx.stroke();
      ctx.strokeStyle = 'rgba(233,188,92,' + (0.18 * zw).toFixed(3) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(ox, oy, rx * 0.38, ry * 0.38, rot, 0, Math.PI * 2); ctx.stroke();
      // finish line across the track
      const f0 = pt(0.74, 0.35), f1 = pt(1.0, 0.35);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,239,198,' + ((0.5 + 0.4 * Math.abs(Math.sin(t * 2.6))) * zw).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = zw;
      ctx.drawImage(this.sprite, f1.x - 7, f1.y - 7, 14, 14);
      ctx.globalAlpha = 1;
      // grandstand ticks along the lower side
      ctx.strokeStyle = 'rgba(233,188,92,' + (0.5 * zw).toFixed(3) + ')';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const th = Math.PI / 2 + i * 0.17;
        const P0 = pt(1.07, th), P1 = pt(1.16, th);
        ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke();
      }
      // three glowing horses circling the track with short trails
      for (let hIdx = 0; hIdx < 3; hIdx++) {
        const th = -t * (0.85 + hIdx * 0.13) + hIdx * 1.9;
        const k = 0.80 + hIdx * 0.065;
        const P = pt(k, th), Pb = pt(k, th + 0.22);
        ctx.strokeStyle = 'rgba(255,232,180,' + (0.4 * zw).toFixed(3) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(Pb.x, Pb.y); ctx.lineTo(P.x, P.y); ctx.stroke();
        const sz = 13 - hIdx * 2;
        ctx.globalAlpha = zw * (0.9 - hIdx * 0.15);
        ctx.drawImage(this.sprite, P.x - sz / 2, P.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    }

    drawRiyadh(cam, p, gw) {
      const rw = Math.max(0, Math.min(1, (p - 0.632) / 0.018)) * Math.max(0, Math.min(1, (0.728 - p) / 0.026)) * gw;
      if (rw < 0.01 || !this.riyadh) return;
      const city = this.project(RIYADH_CITY[0], RIYADH_CITY[1], cam);
      const course = this.project(RIYADH_TRACK[0], RIYADH_TRACK[1], cam);
      if (!city.v || !course.v) return;
      const ctx = this.ctx, t = this.t;
      const S = Math.max(88, Math.min(Math.min(this.W, this.H) * 0.70, cam.R * 0.032));

      const halo = ctx.createRadialGradient(course.x, course.y, 0, course.x, course.y, S * 0.72);
      halo.addColorStop(0, 'rgba(255,232,180,' + (0.12 * rw).toFixed(3) + ')');
      halo.addColorStop(0.46, 'rgba(233,188,92,' + (0.045 * rw).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(233,188,92,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(course.x, course.y, S * 0.72, 0, Math.PI * 2); ctx.fill();

      // Riyadh's rectilinear road rhythm establishes a distinct urban approach.
      ctx.strokeStyle = 'rgba(233,188,92,' + (0.11 * rw).toFixed(3) + ')';
      ctx.lineWidth = 0.65;
      for (let i = -5; i <= 5; i++) {
        const off = i * S * 0.105;
        ctx.beginPath(); ctx.moveTo(city.x - S * 0.78, city.y + off * 0.56); ctx.lineTo(city.x + S * 0.78, city.y + off * 0.56); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(city.x + off, city.y - S * 0.48); ctx.lineTo(city.x + off, city.y + S * 0.48); ctx.stroke();
      }
      for (let i = 0; i < this.riyadh.lights.length; i++) {
        const L = this.riyadh.lights[i];
        const al = (0.34 + 0.66 * Math.abs(Math.sin(t * 1.05 + L.tw))) * L.b * rw;
        if (al < 0.025) continue;
        const s = L.r * 2.8;
        ctx.globalAlpha = Math.min(1, al);
        ctx.drawImage(this.sprite, city.x + L.x * S - s / 2, city.y + L.y * S * 0.55 - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // King Abdulaziz Racecourse at its real north-Riyadh coordinates.
      const rx = S * 0.23, ry = S * 0.125, rot = 0.07;
      ctx.strokeStyle = 'rgba(255,239,198,' + (0.14 * rw).toFixed(3) + ')';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(course.x, course.y, rx, ry, rot, 0, Math.PI * 2); ctx.stroke();
      [[1,0.92,1.8],[0.86,0.38,1],[0.70,0.25,0.8]].forEach((v) => {
        ctx.strokeStyle = 'rgba(255,232,180,' + (v[1] * rw).toFixed(3) + ')';
        ctx.lineWidth = v[2];
        ctx.beginPath(); ctx.ellipse(course.x, course.y, rx * v[0], ry * v[0], rot, 0, Math.PI * 2); ctx.stroke();
      });

      // Grandstand and floodlights identify the venue at a glance.
      ctx.strokeStyle = 'rgba(255,232,180,' + (0.72 * rw).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      for (let i = -4; i <= 4; i++) {
        const a = Math.PI / 2 + i * 0.105;
        const x0 = course.x + Math.cos(a) * rx * 1.06;
        const y0 = course.y + Math.sin(a) * ry * 1.06;
        const x1 = course.x + Math.cos(a) * rx * 1.23;
        const y1 = course.y + Math.sin(a) * ry * 1.23;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const x = course.x + Math.cos(a) * rx * 1.17;
        const y = course.y + Math.sin(a) * ry * 1.17;
        ctx.globalAlpha = rw * (0.65 + 0.35 * Math.sin(t * 1.4 + i));
        ctx.drawImage(this.sprite, x - 7, y - 7, 14, 14);
      }
      ctx.globalAlpha = 1;

      const sweep = t * 0.72;
      ctx.strokeStyle = 'rgba(255,244,207,' + (0.72 * rw).toFixed(3) + ')';
      ctx.lineWidth = 2.1;
      ctx.beginPath(); ctx.ellipse(course.x, course.y, rx, ry, rot, sweep, sweep + 0.72); ctx.stroke();
    }

    drawKsaLine(cam, p, gw) {
      // Glowing fast line: Taif -> Riyadh (act 5)
      const w = Math.max(0, Math.min(1, (p - 0.572) / 0.018)) * Math.max(0, Math.min(1, (0.735 - p) / 0.03)) * gw;
      if (w < 0.01) return;
      const prog = Math.max(0, Math.min(1, (p - 0.582) / 0.075));
      if (prog <= 0) return;
      const A = TAIF_TRACK, B = RIYADH_TRACK, ctx = this.ctx;
      const steps = 58, pts = [];
      const maxI = Math.max(1, Math.round(steps * prog));
      for (let i = 0; i <= maxI; i++) {
        const t = i / steps;
        const lon = A[0] + (B[0] - A[0]) * t;
        const lat = A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 0.78;
        pts.push(this.project(lon, lat, cam));
      }
      const stroke = (lw, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < pts.length; i++) {
          if (!pts[i].v) { started = false; continue; }
          if (!started) { ctx.moveTo(pts[i].x, pts[i].y); started = true; }
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      };
      stroke(9, 'rgba(233,188,92,' + (0.09 * w).toFixed(3) + ')');
      stroke(2.1, 'rgba(255,239,198,' + (0.92 * w).toFixed(3) + ')');
      // moving pulse
      const ph = (this.t * 0.9) % 1;
      const pi = Math.floor(ph * (pts.length - 1));
      if (pts[pi] && pts[pi].v) {
        ctx.globalAlpha = w * 0.9;
        ctx.drawImage(this.sprite, pts[pi].x - 10, pts[pi].y - 10, 20, 20);
        ctx.globalAlpha = 1;
      }
      const a0 = pts[0], a1 = pts[pts.length - 1];
      if (a0 && a0.v) { ctx.globalAlpha = w * 0.8; ctx.drawImage(this.sprite, a0.x - 8, a0.y - 8, 16, 16); ctx.globalAlpha = 1; }
      if (a1 && a1.v && prog > 0.96) { ctx.globalAlpha = w; ctx.drawImage(this.sprite, a1.x - 15, a1.y - 15, 30, 30); ctx.globalAlpha = 1; }
    }

    drawArcs(cam, p, w) {
      const aw = Math.max(0, Math.min(1, (p - 0.722) / 0.022)) * Math.max(0, Math.min(1, (0.852 - p) / 0.025));
      if (aw < 0.01) return;
      const ctx = this.ctx, hub = RIYADH_TRACK, d = Math.PI / 180;
      const v0 = [Math.cos(hub[1] * d) * Math.cos(hub[0] * d), Math.cos(hub[1] * d) * Math.sin(hub[0] * d), Math.sin(hub[1] * d)];
      for (let c = 0; c < this.world.length; c++) {
        const city = this.world[c];
        const prog = Math.max(0, Math.min(1, (p - 0.728 - c * 0.0022) / 0.062));
        if (prog <= 0) continue;
        const v1 = [Math.cos(city[1] * d) * Math.cos(city[0] * d), Math.cos(city[1] * d) * Math.sin(city[0] * d), Math.sin(city[1] * d)];
        const dot = Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]));
        const om = Math.acos(dot), so = Math.sin(om) || 1e-6;
        const steps = 34, pts = [];
        const lift = 1 + 0.19 * Math.min(1, om / Math.PI * 1.6);
        for (let i = 0; i <= steps * prog; i++) {
          const tt = i / steps;
          const A = Math.sin((1 - tt) * om) / so, B = Math.sin(tt * om) / so;
          const x = A * v0[0] + B * v1[0], y = A * v0[1] + B * v1[1], z = A * v0[2] + B * v1[2];
          const len = Math.hypot(x, y, z);
          const lat = Math.asin(z / len) / d, lon = Math.atan2(y, x) / d;
          const bulge = 1 + (lift - 1) * Math.sin(tt * Math.PI);
          const pr = this.project(lon, lat, { cx: cam.cx, cy: cam.cy, R: cam.R * bulge, lon: cam.lon, lat: cam.lat });
          pts.push(pr);
        }
        const paintArc = (width, alpha) => {
          let started = false;
          ctx.lineWidth = width;
          ctx.strokeStyle = 'rgba(255,225,160,' + (alpha * aw).toFixed(3) + ')';
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (!pts[i].v) { started = false; continue; }
            if (!started) { ctx.moveTo(pts[i].x, pts[i].y); started = true; } else ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        };
        paintArc(7, 0.075);
        paintArc(1.35, 0.74);

        const ph = (this.t * 0.42 + c * 0.17) % 1;
        const pi = Math.floor(ph * (pts.length - 1));
        const pt = pts[pi];
        if (pt && pt.v) {
          ctx.globalAlpha = aw * (0.55 + 0.45 * Math.sin(ph * Math.PI));
          ctx.drawImage(this.sprite, pt.x - 9, pt.y - 9, 18, 18);
          ctx.globalAlpha = 1;
        }
        const end = pts[pts.length - 1];
        if (end && end.v && prog > 0.98) {
          ctx.globalAlpha = aw * 0.9;
          ctx.drawImage(this.sprite, end.x - 6, end.y - 6, 12, 12);
          ctx.globalAlpha = 1;
        }
      }
      const h = this.project(hub[0], hub[1], cam);
      if (h.v) {
        ctx.globalAlpha = aw;
        ctx.drawImage(this.sprite, h.x - 34, h.y - 34, 68, 68);
        ctx.globalAlpha = 1;
      }
    }

    updateNodes(cam, p) {
      if (!this.nodes) {
        const layer = this.nodeLayer;
        this.nodes = layer ? Array.from(layer.querySelectorAll('[data-city]')) : [];
        const self = this;
        this.nodes.forEach((el) => {
          el.addEventListener('pointerenter', () => {
            const r = el.getBoundingClientRect();
            if (!self.tip) return;
            self.tip.textContent = el.getAttribute('data-city') + ' · ' + el.getAttribute('data-role');
            self.tip.style.opacity = '1';
            self.tip.style.left = (r.left + r.width / 2) + 'px';
            self.tip.style.top = r.top + 'px';
          });
          el.addEventListener('pointerleave', () => { if (self.tip) self.tip.style.opacity = '0'; });
        });
      }
      const show = p > 0.45 && p < 0.73;
      const taifZoom = Math.max(0, Math.min(1, (p - 0.495) / 0.025)) * Math.max(0, Math.min(1, (0.60 - p) / 0.022));
      const riyadhZoom = Math.max(0, Math.min(1, (p - 0.635) / 0.022)) * Math.max(0, Math.min(1, (0.72 - p) / 0.022));
      const venueFocus = (p > 0.490 && p < 0.582) || (p > 0.622 && p < 0.675);
      for (let i = 0; i < this.nodes.length; i++) {
        const el = this.nodes[i];
        const city = el.getAttribute('data-city');
        const isolated = (taifZoom > 0.05 && city !== 'الطائف') || (riyadhZoom > 0.05 && city !== 'الرياض');
        if (!show || isolated || venueFocus) { if (el._h !== '0') { el.style.opacity = '0'; el._h = '0'; } continue; }
        const lon = +el.getAttribute('data-lon'), lat = +el.getAttribute('data-lat');
        const pr = this.project(lon, lat, cam);
        if (!pr.v) { if (el._h !== '0') { el.style.opacity = '0'; el._h = '0'; } continue; }
        if (el._h !== '1') { el.style.opacity = '1'; el._h = '1'; }
        const focus = city === 'الطائف' ? taifZoom : (city === 'الرياض' ? riyadhZoom : 0);
        const sc = 1 + focus * 1.5;
        el.style.transform = 'translate3d(' + pr.x.toFixed(1) + 'px,' + pr.y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
      }
    }
  }

  window.SaheelEngine = SaheelEngine;
})();
