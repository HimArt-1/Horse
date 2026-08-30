/* Saheel particle + scrolly engine — grid edition v2 (9 acts: net → scan-hand → horse+rider → KSA → Taif→Riyadh → world → track → race) */
(function () {
  const GOLD = [233, 188, 92];

  class SaheelEngine {
    constructor() {
      this.canvas = document.getElementById('saheel-canvas');
      this.scrollyContainer = document.querySelector('[data-story-root]');
      this.hub = document.getElementById('about');
      this.opening = document.querySelector('[data-opening-screens]');
      this.rail = document.querySelector('[data-rail]');
      this.venue = document.querySelector('[data-venue]');
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
      this.buildScan();
      this.buildTaif();
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
      // A complete racehorse and rider drawn as a refined, open wireframe.
      // The generous negative space keeps the particle silhouette legible on small screens.
      const w = 680, h = 440, cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
      const stroke = (width, draw) => {
        x.lineWidth = width; x.beginPath(); draw(x); x.stroke();
      };
      const dot = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };

      // The single outer contour gives the animal one elegant, anatomically coherent silhouette.
      stroke(11, p => {
        p.moveTo(150, 225);
        p.bezierCurveTo(184, 190, 242, 184, 305, 191);
        p.bezierCurveTo(350, 196, 382, 188, 405, 160);
        p.bezierCurveTo(423, 139, 431, 113, 451, 91);
        p.bezierCurveTo(468, 72, 497, 73, 516, 88);
        p.bezierCurveTo(531, 99, 551, 101, 564, 111);
        p.bezierCurveTo(552, 124, 530, 130, 508, 127);
        p.bezierCurveTo(487, 124, 473, 132, 463, 151);
        p.bezierCurveTo(450, 177, 446, 213, 421, 246);
        p.bezierCurveTo(395, 279, 351, 292, 301, 289);
        p.bezierCurveTo(248, 286, 199, 294, 165, 271);
        p.bezierCurveTo(147, 259, 140, 241, 150, 225);
      });

      // Ears, jaw, eye and mane give the head character without turning it into a solid blob.
      stroke(7, p => {
        p.moveTo(458, 85); p.lineTo(458, 59); p.lineTo(472, 78);
        p.moveTo(478, 79); p.lineTo(487, 55); p.lineTo(493, 82);
        p.moveTo(507, 127); p.bezierCurveTo(499, 139, 486, 146, 470, 149);
        p.moveTo(443, 111); p.bezierCurveTo(430, 128, 422, 149, 417, 177);
      });
      dot(497, 98, 5); dot(553, 113, 3.5);
      stroke(4, p => {
        p.moveTo(454, 104); p.bezierCurveTo(441, 121, 436, 143, 430, 165);
        p.moveTo(448, 127); p.bezierCurveTo(438, 149, 435, 175, 426, 197);
        p.moveTo(440, 151); p.bezierCurveTo(431, 176, 427, 201, 416, 220);
      });

      // Tail: three flowing strands imply speed while keeping the rump unmistakable.
      stroke(10, p => { p.moveTo(153, 224); p.bezierCurveTo(116, 203, 91, 165, 50, 161); });
      stroke(6, p => {
        p.moveTo(151, 235); p.bezierCurveTo(106, 228, 74, 204, 37, 208);
        p.moveTo(150, 244); p.bezierCurveTo(109, 251, 79, 240, 49, 251);
      });

      // Four articulated legs in a suspended racing stride.
      stroke(10, p => {
        p.moveTo(391, 263); p.bezierCurveTo(415, 286, 454, 307, 493, 323);
        p.bezierCurveTo(511, 331, 535, 330, 555, 340);
        p.moveTo(365, 278); p.bezierCurveTo(379, 310, 402, 331, 430, 340);
        p.bezierCurveTo(448, 346, 455, 359, 469, 372);
        p.moveTo(206, 279); p.bezierCurveTo(170, 302, 131, 324, 91, 338);
        p.bezierCurveTo(73, 344, 58, 355, 42, 365);
        p.moveTo(241, 287); p.bezierCurveTo(225, 315, 221, 340, 235, 359);
        p.bezierCurveTo(245, 373, 258, 379, 273, 384);
      });
      stroke(6, p => {
        p.moveTo(548, 340); p.lineTo(574, 344);
        p.moveTo(464, 372); p.lineTo(486, 381);
        p.moveTo(43, 365); p.lineTo(23, 376);
        p.moveTo(271, 384); p.lineTo(294, 389);
      });

      // Lightweight body construction lines make the point cloud feel engineered and dimensional.
      stroke(3.5, p => {
        p.moveTo(172, 226); p.bezierCurveTo(235, 215, 310, 215, 381, 228);
        p.moveTo(177, 251); p.bezierCurveTo(235, 268, 319, 269, 398, 244);
        p.moveTo(214, 202); p.bezierCurveTo(242, 230, 250, 257, 242, 283);
        p.moveTo(302, 195); p.bezierCurveTo(325, 220, 326, 257, 305, 287);
        p.moveTo(384, 188); p.bezierCurveTo(402, 211, 405, 237, 395, 266);
      });

      // Rider: a compact racing posture, helmet, reins, bent knee and stirrup.
      stroke(9, p => {
        p.moveTo(292, 190); p.bezierCurveTo(299, 158, 320, 132, 349, 120);
        p.bezierCurveTo(366, 113, 384, 119, 397, 136);
        p.moveTo(315, 162); p.bezierCurveTo(347, 163, 375, 163, 410, 177);
        p.moveTo(307, 177); p.bezierCurveTo(300, 205, 315, 225, 345, 236);
        p.bezierCurveTo(362, 242, 376, 251, 385, 263);
      });
      stroke(4, p => {
        p.moveTo(405, 176); p.bezierCurveTo(438, 170, 468, 158, 494, 143);
        p.moveTo(400, 183); p.bezierCurveTo(438, 183, 468, 168, 498, 146);
        p.moveTo(286, 191); p.bezierCurveTo(320, 201, 351, 199, 381, 190);
      });
      x.lineWidth = 7; x.beginPath(); x.ellipse(365, 96, 17, 18, -0.28, 0, Math.PI * 2); x.stroke();
      stroke(7, p => { p.moveTo(348, 85); p.bezierCurveTo(363, 76, 380, 78, 392, 88); });
      dot(385, 264, 5); dot(304, 191, 5);

      this.horsePts = this.samplePts(cv, 2700);
      this.horseAspect = h / w;
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
        const compact = p > 0.075;
        const scale = compact ? 0.68 : 1;
        const opacity = compact ? 0.78 : 1;
        const key = compact ? 'compact' : 'full';
        if (this.logo._mode !== key) {
          this.logo.style.transform = 'translateX(-50%) scale(' + scale + ')';
          this.logo.style.opacity = String(opacity);
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
      if (this.venue) {
        const vv = hubOn ? 0 : Math.max(0, Math.min(1, (storyP - 0.492) / 0.018)) * Math.max(0, Math.min(1, (0.572 - storyP) / 0.018));
        const key = vv.toFixed(2);
        if (this.venue._v !== key) {
          this.venue.style.opacity = vv.toFixed(3);
          this.venue.style.transform = 'scale(' + (0.92 + 0.08 * vv).toFixed(3) + ')';
          this.venue._v = key;
        }
      }
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
        const show = !hubOn && storyP > 0.45 && storyP < 0.69;
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
    }

    smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

    scene() {
      const p = this.p, N = this.N, seg = 1 / N, m = this.hubMix;
      const storyP = p * N / 9;
      const fi = Math.min(N - 0.0001, Math.max(0, p / seg));
      const i = Math.floor(fi), f = this.smooth((fi - i - 0.58) / 0.34);
      const cam = this.camera(storyP);
      this.taifDim = Math.max(0, Math.min(1, (storyP - 0.49) / 0.02)) * Math.max(0, Math.min(1, (0.578 - storyP) / 0.02));
      const n = Math.min(this.count, this.parts.length);
      const A = this.pos.bind(this), ctx = this.ctx;

      let lineW = Math.max(0, Math.min(1, (storyP - 0.115) / 0.04)) * Math.max(0, Math.min(1, (0.25 - storyP) / 0.04));
      let trackW = Math.max(0, Math.min(1, (storyP - 0.775) / 0.03)) * (1 - m);
      let globeW = Math.max(0, Math.min(1, (storyP - 0.42) / 0.03)) * Math.max(0, Math.min(1, (0.795 - storyP) / 0.03)) * (1 - m);
      lineW = Math.max(lineW * (1 - m), m * 0.44);

      if (globeW > 0.01) this.drawGlobe(cam, globeW, storyP);
      if (trackW > 0.01) this.drawTrack(trackW, storyP);

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
        case 7: return this.posTrack(q, 1);
        default: return this.posRace(q, k);
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
      const pts = this.scanPts || [];
      if (!pts.length) return this.posDust(q);
      const pt = pts[k % pts.length];
      const scale = Math.min(this.W * (this.mobile ? 0.88 : 0.58), this.H * (this.mobile ? 0.70 : 0.84));
      let a = 0.5 + Math.pow(q.s, 1.4) * 0.5;
      if (pt[0] < -0.12) a += Math.sin(this.t * 3 + pt[1] * 4) * 0.18; // QR side pulses like a live scan
      return {
        x: this.W * (this.mobile ? 0.50 : 0.61) + pt[0] * scale + Math.sin(this.t * 0.8 + q.s * 8) * 1.5,
        y: this.H * (this.mobile ? 0.40 : 0.52) + pt[1] * scale * (this.scanAspect || 0.667) + Math.cos(this.t * 0.7 + q.s * 6) * 1.5,
        a: a, s: 0.4 + q.s * 0.24
      };
    }

    posHorse(q, k, phase) {
      const pts = this.horsePts || [];
      if (!pts.length) return this.posDust(q);
      const pt = pts[k % pts.length];
      const scale = Math.min(this.W * (phase ? 0.44 : (this.mobile ? 1.02 : 0.60)), this.H * (phase ? 0.66 : (this.mobile ? 0.70 : 0.88)));
      const bob = phase ? Math.sin(this.t * 5.4 + pt[0] * 2.4) * this.H * 0.009 : Math.sin(this.t * 2.2 + pt[0] * 2.4) * this.H * 0.004;
      const surge = phase ? Math.sin(this.t * 5.4 + 1.2) * this.W * 0.006 : 0;
      return {
        x: this.W * (phase ? 0.23 : (this.mobile ? 0.50 : 0.35)) + pt[0] * scale + surge + Math.sin(this.t * 0.8 + q.s * 8) * 1.7,
        y: this.H * (phase ? 0.76 : (this.mobile ? 0.40 : 0.54)) + pt[1] * scale * (this.horseAspect || 0.647) + bob,
        a: (phase ? 0.62 : 0.5) + Math.pow(q.s, 1.4) * 0.5, s: 0.42 + q.s * 0.26
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
        [0.512, 10.5, 40.42, 21.30, 0.50, 0.46, 1],
        [0.556, 10.5, 40.42, 21.30, 0.50, 0.46, 1],
        [0.585, 8.0, 40.42, 21.30, 0.50, 0.48, 1],
        [0.625, 7.0, 44.6, 23.2, 0.50, 0.48, 1],
        [0.655, 2.2, 45.8, 23.9, 0.50, 0.49, 1],
        [0.70, 0.62, 46.72, 24.69, 0.50, 0.47, 0.5],
        [0.778, 0.50, 46.72, 24.69, 0.50, 0.47, 0.3]
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
        lon: lp(2) + this.t * 2.6 * (1 - zoom) + mx * 6 * (1 - zoom * 0.7),
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

    drawTaif(cam, p, gw) {
      const zw = Math.max(0, Math.min(1, (p - 0.488) / 0.02)) * Math.max(0, Math.min(1, (0.60 - p) / 0.03)) * gw;
      if (zw < 0.01 || !this.taif) return;
      const c = this.project(40.42, 21.27, cam);
      if (!c.v) return;
      const S = Math.max(90, Math.min(Math.min(this.W, this.H) * 0.85, cam.R * 0.075));
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
      // racecourse oval, offset from the city core
      const ox = c.x + S * 0.20, oy = c.y - S * 0.10;
      const rx = S * 0.52, ry = S * 0.30, rot = -0.16;
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

    drawKsaLine(cam, p, gw) {
      // Glowing fast line: Taif -> Riyadh (act 5)
      const w = Math.max(0, Math.min(1, (p - 0.578) / 0.02)) * Math.max(0, Math.min(1, (0.74 - p) / 0.04)) * gw;
      if (w < 0.01) return;
      const prog = Math.max(0, Math.min(1, (p - 0.588) / 0.062));
      if (prog <= 0) return;
      const A = [40.42, 21.27], B = [46.72, 24.69], ctx = this.ctx;
      const steps = 42, pts = [];
      const maxI = Math.max(1, Math.round(steps * prog));
      for (let i = 0; i <= maxI; i++) {
        const t = i / steps;
        const lon = A[0] + (B[0] - A[0]) * t;
        const lat = A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 0.9;
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
      stroke(5, 'rgba(233,188,92,' + (0.12 * w).toFixed(3) + ')');
      stroke(1.6, 'rgba(255,232,180,' + (0.85 * w).toFixed(3) + ')');
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
      const aw = Math.max(0, Math.min(1, (p - 0.685) / 0.03)) * Math.max(0, Math.min(1, (0.79 - p) / 0.025));
      if (aw < 0.01) return;
      const ctx = this.ctx, hub = [46.72, 24.69], d = Math.PI / 180;
      const v0 = [Math.cos(hub[1] * d) * Math.cos(hub[0] * d), Math.cos(hub[1] * d) * Math.sin(hub[0] * d), Math.sin(hub[1] * d)];
      for (let c = 0; c < this.world.length; c++) {
        const city = this.world[c];
        const prog = Math.max(0, Math.min(1, (p - 0.693 - c * 0.003) / 0.04));
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
        ctx.lineWidth = 1;
        let started = false;
        ctx.strokeStyle = 'rgba(255,225,160,' + (0.34 * aw).toFixed(3) + ')';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          if (!pts[i].v) { started = false; continue; }
          if (!started) { ctx.moveTo(pts[i].x, pts[i].y); started = true; } else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();

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
        ctx.drawImage(this.sprite, h.x - 26, h.y - 26, 52, 52);
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
      const show = p > 0.45 && p < 0.69;
      const dz = Math.max(0, Math.min(1, (p - 0.49) / 0.03)) * Math.max(0, Math.min(1, (0.578 - p) / 0.02));
      const deep = dz > 0.05;
      for (let i = 0; i < this.nodes.length; i++) {
        const el = this.nodes[i];
        const city = el.getAttribute('data-city');
        if (!show || (deep && city !== 'الطائف')) { if (el._h !== '0') { el.style.opacity = '0'; el._h = '0'; } continue; }
        const lon = +el.getAttribute('data-lon'), lat = +el.getAttribute('data-lat');
        const pr = this.project(lon, lat, cam);
        if (!pr.v) { if (el._h !== '0') { el.style.opacity = '0'; el._h = '0'; } continue; }
        if (el._h !== '1') { el.style.opacity = '1'; el._h = '1'; }
        const sc = city === 'الطائف' ? (1 + dz * 1.6) : 1;
        el.style.transform = 'translate3d(' + pr.x.toFixed(1) + 'px,' + pr.y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
      }
    }
  }

  window.SaheelEngine = SaheelEngine;
})();
