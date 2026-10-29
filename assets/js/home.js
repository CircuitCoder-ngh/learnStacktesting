/* Home page: hero traverse animation, flow map wiring, progress note. */
(function () {
  'use strict';

  /* ---------- Hero: a Method 5 probe traversing a stack ---------- */
  const canvas = document.getElementById('hero-canvas');
  if (canvas) heroRig(canvas);

  function heroRig(canvas) {
    // The hero panel is dark in both themes, so it uses fixed colours.
    const C = {
      bg: '#12212A', interior: '#15293A', grid: 'rgba(120,160,175,0.07)',
      gas: '63,202,189', soot: '#D8AE7E', wall: '#3C4F59', hatch: '#5E7581',
      steel: '#9FB0B8', steelHi: '#D5DEE2', dim: '#6F8590', ink: '#DCE6E9', red: '#FF6B57', tape: '#F4C13D',
    };
    // Traverse points for a 6-point diameter, as a fraction of D from the port wall (Method 1, Table 1-2).
    // The crew starts at the far wall and works back toward the port.
    const FR = [0.956, 0.854, 0.704, 0.296, 0.146, 0.044];
    const DP_CENTER = 0.92; // in. H2O at the centreline
    const K_FACTOR = 1.87;  // ΔH = K · Δp for this nozzle and set of conditions
    const MIN_PER_POINT = 5;

    let W = 0, H = 0, g = {}, parts = [];
    const cv = ST.canvas(canvas, null, (w, h) => { W = w; H = h; layout(); });
    const ctx = cv.ctx;

    function layout() {
      const t = Math.max(7, W * 0.022);
      const L = W * 0.1, R = W * 0.58;
      g = { t, L, R, D: R - L, cx: (L + R) / 2, portY: H * 0.53, nozDrop: Math.max(12, H * 0.03), nip: Math.max(20, W * 0.045) };
      g.sampleY = g.portY + g.nozDrop;
      g.outX = R + t + g.nip + 18;
      const n = Math.round((g.D * H) / 300);
      parts = Array.from({ length: n }, () => spawn(true));
    }
    const pointX = (i) => g.R - FR[i] * g.D;
    const profile = (x) => {
      const r = Math.min(1, Math.abs(x - g.cx) / (g.D / 2));
      return Math.pow(Math.max(1e-4, 1 - r), 1 / 7); // 1/7-power turbulent profile
    };
    function spawn(anyY) {
      return {
        x: g.L + 3 + Math.random() * (g.D - 6),
        y: anyY ? Math.random() * H : H + Math.random() * 30,
        k: 0.82 + Math.random() * 0.36,
        ph: Math.random() * 6.283,
        a: 0.25 + Math.random() * 0.55,
        pm: Math.random() < 0.07,
      };
    }

    /* ---------- Traverse state machine ---------- */
    const S = { port: 0, idx: 0, phase: 'dwell', pt: 0, tip: 0, from: 0, to: 0, visited: [], clock: 0, iso: 100.2, msg: '' };
    const DUR = { insert: 1.6, dwell: 2.8, move: 0.85, withdraw: 1.5, swap: 0.9, complete: 2.6 };
    function enter(phase) {
      S.phase = phase; S.pt = 0; S.from = S.tip;
      if (phase === 'insert' || phase === 'move') S.to = pointX(S.idx);
      if (phase === 'withdraw') S.to = g.outX;
    }
    function advance(dt) {
      S.pt += dt;
      const d = DUR[S.phase];
      const f = Math.min(1, S.pt / d);
      if (S.phase === 'insert' || S.phase === 'move' || S.phase === 'withdraw') S.tip = ST.lerp(S.from, S.to, ST.ease(f));
      if (S.phase === 'dwell') S.clock = (S.port * 6 + S.idx + f) * MIN_PER_POINT;
      if (f < 1) return;
      switch (S.phase) {
        case 'insert': case 'move': enter('dwell'); break;
        case 'dwell':
          S.visited.push(S.port * 6 + S.idx);
          if (S.idx < 5) { S.idx++; enter('move'); } else enter('withdraw');
          break;
        case 'withdraw': enter(S.port === 0 ? 'swap' : 'complete'); break;
        case 'swap': S.port = 1; S.idx = 0; enter('insert'); break;
        case 'complete': S.port = 0; S.idx = 0; S.visited = []; S.clock = 0; enter('insert'); break;
      }
    }

    /* ---------- Readouts ---------- */
    const rd = {
      point: document.getElementById('rd-point'), dp: document.getElementById('rd-dp'), dh: document.getElementById('rd-dh'),
      ts: document.getElementById('rd-ts'), clock: document.getElementById('rd-clock'), iso: document.getElementById('rd-iso'),
    };
    let rdTimer = 0;
    function readouts(dt, force) {
      rdTimer -= dt;
      if (rdTimer > 0 && !force) return;
      rdTimer = 0.3;
      const inStack = S.tip < g.R;
      const r = Math.min(1, Math.abs(S.tip - g.cx) / (g.D / 2));
      const v = Math.pow(Math.max(1e-4, 1 - r), 1 / 7);
      const noise = S.phase === 'dwell' ? 1 + (Math.random() - 0.5) * 0.03 : 1;
      const dp = inStack ? DP_CENTER * v * v * noise : 0;
      if (S.phase === 'dwell') S.iso = ST.clamp(S.iso + (Math.random() - 0.5) * 0.6 + (100 - S.iso) * 0.08, 97.5, 102.5);
      rd.point.textContent = S.phase === 'swap' || S.phase === 'complete' ? (S.phase === 'swap' ? 'Port B' : 'Done') : `${'AB'[S.port]}-${S.idx + 1}`;
      rd.dp.textContent = ST.fmt(dp, 2);
      rd.dh.textContent = ST.fmt(dp * K_FACTOR, 2);
      rd.ts.textContent = Math.round(312 + (Math.random() - 0.5) * 2.4);
      const m = Math.floor(S.clock), s = Math.floor((S.clock - m) * 60);
      rd.clock.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      rd.iso.textContent = ST.fmt(S.iso, 1);
    }

    /* ---------- Drawing ---------- */
    function step(dt, t) {
      if (!W) return;
      advance(dt);
      const { L, R, D, t: wt, portY } = g;
      const vmax = H * 0.42;
      const nozX = S.tip - 9, nozY = g.sampleY;
      const sampling = S.tip < R && (S.phase === 'dwell' || S.phase === 'move');

      // Move gas
      for (const p of parts) {
        const v = vmax * profile(p.x) * p.k;
        p.y -= v * dt;
        p.x += Math.sin(t * 1.6 + p.ph) * 0.12;
        if (sampling && p.y > nozY && p.y < nozY + 46 && Math.abs(p.x - nozX) < 15) {
          p.x += (nozX - p.x) * Math.min(1, dt * 7);
          if (p.y < nozY + 3 && Math.abs(p.x - nozX) < 4) Object.assign(p, spawn(false));
        }
        if (p.y < -14) Object.assign(p, spawn(false));
      }

      // Background + faint drawing grid
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < W; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0.5; y < H; y += 24) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      // Stack interior
      ctx.fillStyle = C.interior;
      ctx.fillRect(L, 0, D, H);

      // Gas streaks and particulate
      ctx.lineCap = 'round';
      for (const p of parts) {
        const pr = profile(p.x);
        if (p.pm) {
          ctx.fillStyle = C.soot;
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, 6.283); ctx.fill();
        } else {
          const a = p.a * (0.45 + 0.55 * pr);
          ctx.strokeStyle = `rgba(${C.gas},${a * 0.7})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 4 + 11 * pr * p.k); ctx.stroke();
          ctx.fillStyle = `rgba(${C.gas},${Math.min(1, a * 1.4)})`;
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
      }
      ctx.globalAlpha = 1;

      // Walls with section hatching (engineering-drawing convention for cut material)
      const portH = 22;
      drawWall(L - wt, 0, wt, H);
      drawWall(R, 0, wt, portY - portH / 2);
      drawWall(R, portY + portH / 2, wt, H - portY - portH / 2);

      // Port nipple and flange
      ctx.strokeStyle = C.steel; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(R + wt, portY - portH / 2); ctx.lineTo(R + wt + g.nip, portY - portH / 2);
      ctx.moveTo(R + wt, portY + portH / 2); ctx.lineTo(R + wt + g.nip, portY + portH / 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(R + wt + g.nip, portY - portH / 2 - 7); ctx.lineTo(R + wt + g.nip, portY + portH / 2 + 7); ctx.stroke();

      // Platform and handrail
      const platY = portY + Math.max(52, H * 0.11);
      const x0 = R + wt;
      ctx.strokeStyle = C.dim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, platY); ctx.lineTo(W, platY); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0 + 4; x < W; x += 7) { ctx.moveTo(x, platY); ctx.lineTo(x, platY + 5); }
      ctx.moveTo(x0, platY + 5); ctx.lineTo(W, platY + 5);
      const railTop = platY - Math.max(48, H * 0.1);
      const postA = x0 + g.nip + 46, postB = W - 14;
      [postA, postB].forEach((x) => { ctx.moveTo(x, platY); ctx.lineTo(x, railTop); });
      ctx.moveTo(postA, railTop); ctx.lineTo(W, railTop);
      ctx.moveTo(postA, (railTop + platY) / 2); ctx.lineTo(W, (railTop + platY) / 2);
      ctx.stroke();

      // Sampling plane and traverse points
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(220,230,233,0.25)';
      ctx.beginPath(); ctx.moveTo(L, g.sampleY); ctx.lineTo(R, g.sampleY); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 6; i++) {
        const x = pointX(i);
        const id = S.port * 6 + i;
        const visited = S.visited.includes(id);
        const current = i === S.idx && S.phase === 'dwell';
        ctx.beginPath(); ctx.arc(x, g.sampleY, 3.4, 0, 6.283);
        if (visited || current) { ctx.fillStyle = C.red; ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(220,230,233,0.55)'; ctx.lineWidth = 1.2; ctx.stroke(); }
        if (current) {
          const pulse = (t * 1.2) % 1;
          ctx.strokeStyle = `rgba(255,107,87,${0.8 * (1 - pulse)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, g.sampleY, 4 + pulse * 13, 0, 6.283); ctx.stroke();
        }
      }

      drawProbe(S.tip);

      // Labels
      ctx.font = '600 12px "Public Sans", system-ui, sans-serif';
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.fillText(S.port === 0 ? 'Port A' : 'Port B', R + wt + 2, portY - portH / 2 - 12);
      ctx.font = '600 11px "Public Sans", system-ui, sans-serif';
      const lab = 'Stack gas flows up';
      const lw = ctx.measureText(lab).width;
      ctx.fillStyle = 'rgba(18,33,42,0.85)';
      ctx.fillRect(L + 8, H - 32, lw + 16, 22);
      ctx.fillStyle = C.ink;
      ctx.fillText(lab, L + 16, H - 17);

      drawPlanView(t);

      // Soft fade top and bottom: we are looking at a section of a taller stack
      const fadeTop = ctx.createLinearGradient(0, 0, 0, 40);
      fadeTop.addColorStop(0, C.bg); fadeTop.addColorStop(1, 'rgba(18,33,42,0)');
      ctx.fillStyle = fadeTop; ctx.fillRect(0, 0, R + wt + 1, 40);

      readouts(dt, dt === 0);
    }

    function drawWall(x, y, w, h) {
      if (h <= 0) return;
      ctx.fillStyle = C.wall;
      ctx.fillRect(x, y, w, h);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = C.hatch; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = y - w; k < y + h + w; k += 6) { ctx.moveTo(x, k + w); ctx.lineTo(x + w, k); }
      ctx.stroke();
      ctx.restore();
    }

    function drawProbe(tip) {
      const { portY } = g;
      const y = portY;
      // Probe sheath
      ctx.fillStyle = C.steel;
      ctx.fillRect(tip, y - 4, W - tip + 10, 8);
      ctx.fillStyle = C.steelHi;
      ctx.fillRect(tip, y - 4, W - tip + 10, 1.5);
      // Tape marks at each traverse point distance: mark i lines up with the flange when the tip is at point i
      ctx.fillStyle = C.tape;
      const flangeX = g.R + g.t + g.nip;
      for (let i = 0; i < 6; i++) {
        const mx = tip + (flangeX - pointX(i));
        if (mx > tip + 4 && mx < W) ctx.fillRect(mx - 1, y - 4, 2.2, 8);
      }
      // Pitot tube riding on top of the probe, with the S-type head near the nozzle
      ctx.strokeStyle = C.steelHi; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(W + 10, y - 7); ctx.lineTo(tip - 1, y - 7);
      ctx.moveTo(tip - 1, y - 13); ctx.lineTo(tip - 1, y - 1);
      ctx.stroke();
      // Buttonhook nozzle facing into the upward flow
      ctx.strokeStyle = C.steelHi; ctx.lineWidth = 3.2; ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(tip + 1, y);
      ctx.quadraticCurveTo(tip - 9, y, tip - 9, y + 7);
      ctx.lineTo(tip - 9, g.sampleY);
      ctx.stroke();
      ctx.lineCap = 'round';
    }

    function drawPlanView(t) {
      const rr = Math.min(W * 0.115, H * 0.14);
      const cx = W - rr - Math.max(22, W * 0.06), cy = rr + Math.max(26, H * 0.06);
      ctx.save();
      ctx.fillStyle = 'rgba(21,41,58,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283); ctx.fill();
      // Equal-area annulus boundaries for 3 rings
      ctx.strokeStyle = 'rgba(220,230,233,0.12)'; ctx.lineWidth = 1;
      [Math.sqrt(1 / 3), Math.sqrt(2 / 3)].forEach((f) => { ctx.beginPath(); ctx.arc(cx, cy, rr * f, 0, 6.283); ctx.stroke(); });
      ctx.strokeStyle = C.steel; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283); ctx.stroke();
      // Ports
      ctx.fillStyle = C.steel;
      ctx.fillRect(cx + rr, cy - 4, 9, 8);
      ctx.fillRect(cx - 4, cy + rr, 8, 9);
      ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(220,230,233,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - rr, cy); ctx.lineTo(cx + rr, cy); ctx.moveTo(cx, cy - rr); ctx.lineTo(cx, cy + rr); ctx.stroke();
      ctx.setLineDash([]);
      for (let port = 0; port < 2; port++) {
        for (let i = 0; i < 6; i++) {
          const d = rr - FR[i] * 2 * rr;
          const x = port === 0 ? cx + d : cx, y = port === 0 ? cy : cy + d;
          const id = port * 6 + i;
          const current = port === S.port && i === S.idx && S.phase === 'dwell';
          ctx.beginPath(); ctx.arc(x, y, current ? 3.6 : 2.6, 0, 6.283);
          if (current || S.visited.includes(id)) { ctx.fillStyle = current ? C.red : 'rgba(255,107,87,0.6)'; ctx.fill(); }
          else { ctx.strokeStyle = 'rgba(220,230,233,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
        }
      }
      ctx.font = '500 11px "Public Sans", system-ui, sans-serif';
      ctx.fillStyle = C.dim; ctx.textAlign = 'center';
      ctx.fillText(W < 480 ? 'Plan view' : 'Plan view, 12 points', cx, cy + rr + 22);
      ctx.textAlign = 'left';
      ctx.fillText('A', cx + rr + 12, cy + 4);
      ctx.fillText('B', cx + 8, cy + rr + 12);
      ctx.restore();
    }

    S.tip = pointX(0);
    const loop = ST.loop(canvas, step, { buttonHost: canvas.parentElement });
    ST.onTheme(() => loop.draw());
  }

  /* ---------- Flow map wires ---------- */
  const map = document.getElementById('flowmap');
  if (map) {
    const svg = document.getElementById('flowmap-wires');
    const targets = { flow: document.getElementById('fm-flow'), conc: document.getElementById('fm-conc'), rate: document.getElementById('fm-rate') };
    const draw = () => {
      svg.innerHTML = '';
      const box = map.getBoundingClientRect();
      if (getComputedStyle(svg).display === 'none') return;
      const wire = (from, to, cls) => {
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
        const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top;
        const dx = (x2 - x1) * 0.55;
        ST.svg('path', { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, class: 'wire ' + cls }, svg);
      };
      ST.$$('[data-to]', map).forEach((el) => {
        el.dataset.to.split(' ').forEach((key, i) => wire(el, targets[key], i === 0 ? 'is-live' : 'is-soft'));
      });
    };
    new ResizeObserver(draw).observe(map);
    window.addEventListener('load', draw);
  }

  /* ---------- Progress note ---------- */
  const note = document.getElementById('hero-progress');
  if (note && Object.keys(ST.progress.all()).length) note.hidden = false;
})();
