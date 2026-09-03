(function () {
  'use strict';

  const root = document.querySelector('[data-race-simulator]');
  const canvas = document.getElementById('raceCanvas');
  if (!root || !canvas) return;

  const ctx = canvas.getContext('2d');
  const statusChip = document.getElementById('raceStatusChip');
  const statusText = document.getElementById('raceStatus');
  const countdownEl = document.getElementById('raceCountdown');
  const rankEl = document.getElementById('raceRank');
  const speedEl = document.getElementById('raceSpeed');
  const energyEl = document.getElementById('raceEnergy');
  const energyBar = document.getElementById('raceEnergyBar');
  const rhythmEl = document.getElementById('raceRhythm');
  const distanceEl = document.getElementById('raceDistance');
  const boostBtn = document.getElementById('boostBtn');
  const boostLabel = document.getElementById('boostLabel');
  const resetBtn = document.getElementById('resetBtn');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const RACE_DISTANCE = 900;
  const FIXED_STEP = 1 / 60;
  let viewW = 1200;
  let viewH = 510;
  let dpr = 1;
  let lastFrame = performance.now();
  let manualTime = false;

  const state = {
    mode: 'idle',
    elapsed: 0,
    countdown: 0,
    playerDistance: 0,
    aiDistance: 0,
    playerSpeed: 0,
    aiSpeed: 0,
    energy: 100,
    combo: 0,
    lastBoostAt: -10,
    boostPulse: 0,
    finishFlash: 0,
    winner: null,
    taps: 0,
    resultTime: 0
  };

  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: ((i * 73) % 997) / 997,
    y: ((i * 151) % 463) / 463,
    a: 0.18 + ((i * 31) % 60) / 100,
    s: 0.5 + ((i * 17) % 13) / 10
  }));

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function easeOut(value) {
    const t = clamp(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  function setStatus(text, mode) {
    statusText.textContent = text;
    statusChip.dataset.state = mode || state.mode;
  }

  function resetRace() {
    state.mode = 'idle';
    state.elapsed = 0;
    state.countdown = 0;
    state.playerDistance = 0;
    state.aiDistance = 0;
    state.playerSpeed = 0;
    state.aiSpeed = 0;
    state.energy = 100;
    state.combo = 0;
    state.lastBoostAt = -10;
    state.boostPulse = 0;
    state.finishFlash = 0;
    state.winner = null;
    state.taps = 0;
    state.resultTime = 0;
    countdownEl.hidden = true;
    boostBtn.disabled = false;
    boostLabel.textContent = 'ابدأ شوط التحدي';
    setStatus('جاهز للانطلاق', 'idle');
    syncHud();
    render();
  }

  function beginCountdown() {
    if (state.mode !== 'idle' && state.mode !== 'finished') return;
    if (state.mode === 'finished') resetRace();
    state.mode = 'countdown';
    state.countdown = 2.85;
    state.elapsed = 0;
    countdownEl.hidden = false;
    countdownEl.textContent = '3';
    boostBtn.disabled = true;
    boostLabel.textContent = 'استعد للانطلاق';
    setStatus('البوابة تستعد للفتح', 'countdown');
  }

  function launchRace() {
    state.mode = 'racing';
    state.playerSpeed = 31;
    state.aiSpeed = 43;
    state.countdown = 0;
    countdownEl.hidden = true;
    boostBtn.disabled = false;
    boostLabel.textContent = 'اضغط لتعزيز السرعة';
    setStatus('الشوط مباشر — حافظ على الإيقاع', 'racing');
  }

  function finishRace(winner) {
    if (state.mode !== 'racing') return;
    state.mode = 'finished';
    state.winner = winner;
    state.finishFlash = 1;
    state.resultTime = state.elapsed;
    boostBtn.disabled = false;
    boostLabel.textContent = 'ابدأ شوطًا جديدًا';
    if (winner === 'player') {
      setStatus('المركز الأول — حسمت الشوط!', 'won');
      if (navigator.vibrate) navigator.vibrate([35, 35, 70]);
    } else {
      setStatus('فارق بسيط — أعد الشوط وارفع الإيقاع', 'lost');
    }
  }

  function boost() {
    if (state.mode === 'idle' || state.mode === 'finished') {
      beginCountdown();
      return;
    }
    if (state.mode !== 'racing') return;
    if (state.energy < 6) {
      setStatus('استعد طاقتك للحظة', 'racing');
      return;
    }

    const gap = state.elapsed - state.lastBoostAt;
    state.combo = gap < 0.62 ? Math.min(9, state.combo + 1) : 1;
    state.lastBoostAt = state.elapsed;
    state.energy = Math.max(0, state.energy - 6.5);
    state.playerSpeed = Math.min(82, state.playerSpeed + 5.8 + state.combo * 0.36);
    state.boostPulse = 1;
    state.taps += 1;
    if (navigator.vibrate) navigator.vibrate(10);
    syncHud();
  }

  function update(dt) {
    dt = Math.min(0.05, Math.max(0, dt));
    if (state.mode === 'countdown' || state.mode === 'racing') state.elapsed += dt;
    state.boostPulse = Math.max(0, state.boostPulse - dt * 4.8);
    state.finishFlash = Math.max(0, state.finishFlash - dt * 1.6);

    if (state.mode === 'countdown') {
      state.countdown -= dt;
      const number = Math.ceil(state.countdown);
      countdownEl.textContent = state.countdown <= 0.28 ? 'انطلق' : String(Math.max(1, number));
      if (state.countdown <= 0) launchRace();
    }

    if (state.mode === 'racing') {
      const sinceBoost = state.elapsed - state.lastBoostAt;
      if (sinceBoost > 0.78) state.combo = 0;
      state.energy = Math.min(100, state.energy + dt * 17);
      state.playerSpeed += (30 - state.playerSpeed) * dt * 1.15;
      state.aiSpeed = 45.5 + Math.sin(state.elapsed * 1.32) * 2.3 + Math.sin(state.elapsed * 0.47 + 1.2) * 1.5;
      const raceScale = 1.38;
      state.playerDistance = Math.min(RACE_DISTANCE, state.playerDistance + state.playerSpeed * dt * raceScale);
      state.aiDistance = Math.min(RACE_DISTANCE, state.aiDistance + state.aiSpeed * dt * raceScale);

      if (state.playerDistance >= RACE_DISTANCE || state.aiDistance >= RACE_DISTANCE) {
        finishRace(state.playerDistance >= state.aiDistance ? 'player' : 'ai');
      }
    }

    syncHud();
  }

  function syncHud() {
    const playerProgress = state.playerDistance / RACE_DISTANCE;
    const aiProgress = state.aiDistance / RACE_DISTANCE;
    const rank = state.mode === 'idle' || state.mode === 'countdown' ? '—' : playerProgress >= aiProgress ? '01' : '02';
    rankEl.textContent = rank;
    speedEl.textContent = String(Math.round(state.playerSpeed * 2.1)).padStart(2, '0');
    energyEl.textContent = Math.round(state.energy) + '%';
    energyBar.style.transform = 'scaleX(' + (state.energy / 100).toFixed(3) + ')';
    rhythmEl.textContent = state.combo > 1 ? '×' + state.combo : state.mode === 'racing' ? '01' : '—';
    distanceEl.textContent = Math.round(Math.min(RACE_DISTANCE, state.playerDistance)) + ' / ' + RACE_DISTANCE;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    viewW = Math.max(320, rect.width);
    viewH = Math.max(280, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function drawMountains(baseY, color, amplitude, shift) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    ctx.lineTo(0, baseY);
    const points = 9;
    for (let i = 0; i <= points; i++) {
      const x = i / points * viewW;
      const peak = Math.sin(i * 1.74 + shift) * 0.45 + Math.sin(i * 0.81 + shift * 2) * 0.35 + 0.65;
      ctx.lineTo(x, baseY - peak * amplitude);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
  }

  function drawFloodlight(x, groundY, scale) {
    ctx.save();
    ctx.strokeStyle = 'rgba(239,210,148,.27)';
    ctx.lineWidth = Math.max(1, scale * 1.2);
    ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 74 * scale); ctx.stroke();
    ctx.fillStyle = 'rgba(255,232,174,.72)';
    ctx.fillRect(x - 12 * scale, groundY - 82 * scale, 24 * scale, 7 * scale);
    const glow = ctx.createRadialGradient(x, groundY - 79 * scale, 0, x, groundY - 79 * scale, 44 * scale);
    glow.addColorStop(0, 'rgba(255,224,151,.13)'); glow.addColorStop(1, 'rgba(255,224,151,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, groundY - 79 * scale, 44 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHorse(x, y, scale, color, phase, label, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isPlayer) {
      const aura = ctx.createRadialGradient(0, -10, 2, 0, -10, 42);
      aura.addColorStop(0, 'rgba(233,188,92,.23)'); aura.addColorStop(1, 'rgba(233,188,92,0)');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, -10, 42, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, -12, 22, 10, -0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(13, -17); ctx.bezierCurveTo(19, -27, 23, -32, 30, -31);
    ctx.lineTo(32, -24); ctx.quadraticCurveTo(25, -20, 18, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(35, -32, 8, 4.8, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(31, -35); ctx.lineTo(31, -42); ctx.lineTo(35, -36); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(36, -36); ctx.lineTo(39, -42); ctx.lineTo(40, -35); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, -15); ctx.quadraticCurveTo(-33, -22, -39, -12); ctx.quadraticCurveTo(-34, -13, -26, -7); ctx.stroke();

    // Tack and jockey: compact editorial silhouette that stays legible on mobile.
    ctx.fillStyle = isPlayer ? '#1a1208' : 'rgba(20,17,13,.88)';
    ctx.beginPath(); ctx.ellipse(-3, -20, 12, 4.2, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isPlayer ? '#ffe1a0' : 'rgba(245,233,210,.72)';
    ctx.fillStyle = isPlayer ? '#e9bc5c' : 'rgba(224,211,187,.78)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(2, -39, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1, -35); ctx.lineTo(-7, -24); ctx.lineTo(5, -24); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1, -33); ctx.lineTo(12, -25); ctx.lineTo(24, -27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -25); ctx.lineTo(-13, -13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -43); ctx.quadraticCurveTo(5, -45, 8, -42); ctx.stroke();

    ctx.strokeStyle = color;

    const gait = Math.sin(phase * 6.4);
    const legs = [
      [-13, -7, -18 + gait * 9, 8, -27 + gait * 12, 18],
      [-4, -5, 0 - gait * 8, 9, -8 - gait * 10, 21],
      [10, -6, 15 - gait * 8, 8, 27 - gait * 11, 15],
      [17, -8, 20 + gait * 8, 5, 14 + gait * 12, 20]
    ];
    legs.forEach((leg) => {
      ctx.beginPath(); ctx.moveTo(leg[0], leg[1]); ctx.lineTo(leg[2], leg[3]); ctx.lineTo(leg[4], leg[5]); ctx.stroke();
    });
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 ' + (isPlayer ? 11 : 10) + 'px "Almarai", sans-serif';
    ctx.fillStyle = isPlayer ? 'rgba(255,240,196,.92)' : 'rgba(245,233,210,.58)';
    ctx.fillText(label, x, y + 32 * scale);
    ctx.restore();
  }

  function drawDust(x, y, amount, color) {
    if (reduceMotion.matches || amount <= 0) return;
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const life = (state.elapsed * (0.8 + i * 0.025) + i * 0.071) % 1;
      const px = x + 14 + life * 72 * amount;
      const py = y + 9 + Math.sin(i * 2.2 + state.elapsed * 3) * 9 * life;
      ctx.globalAlpha = (1 - life) * 0.42 * amount;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, 1 + life * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, '#050508');
    sky.addColorStop(0.42, '#17100d');
    sky.addColorStop(1, '#080604');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, viewW, viewH);

    stars.forEach((star) => {
      const twinkle = 0.55 + Math.sin(state.elapsed * 0.8 + star.x * 18) * 0.25;
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = '#f5d894';
      ctx.fillRect(star.x * viewW, star.y * viewH * 0.48, star.s, star.s);
    });
    ctx.globalAlpha = 1;

    drawMountains(viewH * 0.44, '#17110d', viewH * 0.19, 0.4);
    drawMountains(viewH * 0.50, '#0e0b09', viewH * 0.14, 1.3);

    const horizon = viewH * 0.50;
    for (let i = 0; i < 7; i++) drawFloodlight(viewW * (0.08 + i * 0.145), horizon + 2, 0.66 + (i % 2) * 0.12);

    const trackTop = viewH * 0.48;
    const trackBottom = viewH * 0.94;
    const track = ctx.createLinearGradient(0, trackTop, 0, trackBottom);
    track.addColorStop(0, '#3b2418'); track.addColorStop(0.55, '#5a3420'); track.addColorStop(1, '#26160f');
    ctx.fillStyle = track;
    ctx.beginPath(); ctx.moveTo(0, trackTop); ctx.lineTo(viewW, trackTop); ctx.lineTo(viewW, trackBottom); ctx.lineTo(0, trackBottom); ctx.closePath(); ctx.fill();

    const scroll = ((state.playerDistance + state.aiDistance) * 0.025) % 1;
    ctx.strokeStyle = 'rgba(246,216,142,.09)'; ctx.lineWidth = 1;
    for (let i = -1; i < 16; i++) {
      const x = ((i + scroll) / 15) * viewW;
      ctx.beginPath(); ctx.moveTo(x, trackTop); ctx.lineTo(x - viewW * 0.07, trackBottom); ctx.stroke();
    }

    const laneOne = viewH * 0.64;
    const laneTwo = viewH * 0.82;
    [trackTop + 7, (laneOne + laneTwo) / 2, trackBottom - 7].forEach((y, index) => {
      ctx.strokeStyle = index === 1 ? 'rgba(255,235,187,.34)' : 'rgba(255,235,187,.18)';
      ctx.setLineDash(index === 1 ? [11, 13] : []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewW, y); ctx.stroke();
    });
    ctx.setLineDash([]);

    const startX = viewW * 0.88;
    const finishX = viewW * 0.10;
    ctx.fillStyle = 'rgba(5,5,4,.78)'; ctx.fillRect(finishX - 5, trackTop, 10, trackBottom - trackTop);
    const tile = Math.max(5, viewW * 0.006);
    for (let row = 0; row < Math.ceil((trackBottom - trackTop) / tile); row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#f3e4c4' : '#17110b';
        ctx.fillRect(finishX - tile + col * tile, trackTop + row * tile, tile, tile);
      }
    }

    const playerProgress = easeOut(state.playerDistance / RACE_DISTANCE);
    const aiProgress = easeOut(state.aiDistance / RACE_DISTANCE);
    const playerX = lerp(startX, finishX, playerProgress);
    const aiX = lerp(startX, finishX, aiProgress);
    const horseScale = clamp(viewW / 1100, 0.82, 1.05);
    const playerPhase = state.elapsed * (2.4 + state.playerSpeed * 0.035);
    const aiPhase = state.elapsed * (2.2 + state.aiSpeed * 0.032) + 1.4;

    const streakPower = state.mode === 'racing' ? clamp((state.playerSpeed - 30) / 50, 0, 1) : 0;
    if (!reduceMotion.matches && streakPower > 0.04) {
      ctx.save(); ctx.strokeStyle = 'rgba(233,188,92,' + (0.09 + streakPower * 0.16) + ')';
      for (let i = 0; i < 8; i++) {
        const y = laneOne - 27 + i * 7;
        ctx.beginPath(); ctx.moveTo(playerX + 24, y); ctx.lineTo(playerX + 70 + i * 7, y); ctx.stroke();
      }
      ctx.restore();
    }

    drawDust(playerX, laneOne, streakPower, '#e9bc5c');
    drawDust(aiX, laneTwo, state.mode === 'racing' ? 0.38 : 0, '#d6c5a7');
    drawHorse(playerX, laneOne, horseScale * (1 + state.boostPulse * 0.06), '#e9bc5c', playerPhase, 'فارس التحدي', true);
    drawHorse(aiX, laneTwo, horseScale * 0.94, 'rgba(224,211,187,.72)', aiPhase, 'المنافس', false);

    if (state.finishFlash > 0) {
      const flash = ctx.createRadialGradient(finishX, (trackTop + trackBottom) / 2, 0, finishX, (trackTop + trackBottom) / 2, viewW * 0.28);
      flash.addColorStop(0, 'rgba(255,231,170,' + (state.finishFlash * 0.42) + ')'); flash.addColorStop(1, 'rgba(255,231,170,0)');
      ctx.fillStyle = flash; ctx.fillRect(0, trackTop, viewW * 0.45, trackBottom - trackTop);
    }

    ctx.fillStyle = 'rgba(3,3,2,.44)';
    const vignette = ctx.createRadialGradient(viewW / 2, viewH / 2, viewW * 0.12, viewW / 2, viewH / 2, viewW * 0.70);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, viewW, viewH);
  }

  function frame(now) {
    if (!manualTime) update((now - lastFrame) / 1000);
    lastFrame = now;
    render();
    requestAnimationFrame(frame);
  }

  function installViewportLock() {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
      document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    });
    document.addEventListener('wheel', (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    }, { passive: false });
    document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('keydown', (event) => {
      const zoomKey = ['+', '-', '=', '0'].includes(event.key);
      if ((event.ctrlKey || event.metaKey) && zoomKey) event.preventDefault();
    });
    root.addEventListener('touchmove', (event) => {
      if (event.touches.length > 1) event.preventDefault();
    }, { passive: false });
  }

  boostBtn.addEventListener('click', boost);
  canvas.addEventListener('click', boost);
  resetBtn.addEventListener('click', resetRace);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && document.activeElement !== resetBtn) {
      event.preventDefault();
      boost();
    }
  });

  new ResizeObserver(resizeCanvas).observe(canvas);
  reduceMotion.addEventListener('change', render);
  installViewportLock();
  resetRace();

  window.render_game_to_text = function () {
    return JSON.stringify({
      coordinateSystem: 'المسافة بالمتر من بوابة الانطلاق (0) إلى خط النهاية (900)، والسرعة متر/ثانية',
      mode: state.mode,
      player: { distance: Math.round(state.playerDistance), speed: Math.round(state.playerSpeed), energy: Math.round(state.energy), combo: state.combo },
      opponent: { distance: Math.round(state.aiDistance), speed: Math.round(state.aiSpeed) },
      rank: state.mode === 'idle' || state.mode === 'countdown' ? null : state.playerDistance >= state.aiDistance ? 1 : 2,
      countdown: Math.max(0, Number(state.countdown.toFixed(2))),
      winner: state.winner,
      taps: state.taps,
      elapsed: Number(state.elapsed.toFixed(2))
    });
  };

  window.advanceTime = function (milliseconds) {
    manualTime = true;
    const steps = Math.max(1, Math.round(milliseconds / (1000 / 60)));
    for (let i = 0; i < steps; i++) update(FIXED_STEP);
    render();
  };

  window.__raceSimulator = { state, boost, reset: resetRace, render };
  requestAnimationFrame(frame);
})();
