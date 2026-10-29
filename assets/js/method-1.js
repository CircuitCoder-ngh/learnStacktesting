/* Method 1: traverse points — interactive benches. */
(function () {
  'use strict';
  const { $, svg: el, fmt, clamp } = ST;

  /* ---------- Shared Method 1 maths ---------- */

  /** Percent of diameter from the near wall for point i (1-based) of n points on a diameter. */
  function pointPct(i, n) {
    if (i > n / 2) return 100 - pointPct(n + 1 - i, n);
    return 50 * (1 - Math.sqrt((n - 2 * i + 1) / n));
  }

  /**
   * Minimum particulate traverse points from Figure 1-1.
   * dist is in diameters; which = 'B' (downstream of disturbance) or 'A' (upstream).
   * The A axis lines up with the B axis at B = 4A. Returns null below the method minimum.
   */
  function figure11(dist, which, dIn, rect) {
    const x = which === 'A' ? dist * 4 : dist;
    if (x < 2 - 1e-9) return null;
    if (x < 5) return rect ? 25 : 24;
    if (x < 6) return 20;
    if (x < 7) return 16;
    if (x < 8) return 12;
    return dIn > 24 ? 12 : rect ? 9 : 8;
  }

  const inches = (v) => (v >= 24 ? `${fmt(v, 0)} in. (${fmt(v / 12, 1)} ft)` : `${fmt(v, 0)} in.`);
  const arrowDefs = (svg, id, cls) => {
    const defs = el('defs', {}, svg);
    const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }, m);
  };

  /* =========================================================
     Bench 1: velocity profile recovering after a bend
     ========================================================= */
  (function profileBench() {
    const svg = $('#profile-svg');
    if (!svg) return;
    const D = 84, x0 = 130, yTop = 50, yBot = yTop + D, xEnd = 985;
    arrowDefs(svg, 'm1-arr', 'dg-gas');
    arrowDefs(svg, 'm1-arr-ink', 'dg-label');

    // Duct interior and walls
    el('path', { d: `M46,270 L46,${yTop + 56} Q46,${yTop} 102,${yTop} L${xEnd},${yTop} L${xEnd},${yBot} L${x0 + 10},${yBot} Q${x0},${yBot} ${x0},${yBot + 10} L${x0},270 Z`, class: 'dg-panel' }, svg);
    el('path', { d: `M46,270 L46,${yTop + 56} Q46,${yTop} 102,${yTop} L${xEnd},${yTop}`, class: 'dg-ink', 'stroke-width': 3 }, svg);
    el('path', { d: `M${x0},270 L${x0},${yBot + 10} Q${x0},${yBot} ${x0 + 10},${yBot} L${xEnd},${yBot}`, class: 'dg-ink', 'stroke-width': 3 }, svg);
    // Inflow arrow in the riser
    el('path', { d: `M88,262 L88,${yBot + 34}`, style: 'stroke:var(--ink-3)', 'stroke-width': 2, 'marker-end': 'url(#m1-arr-ink)' }, svg);
    el('text', { x: 150, y: 214, class: 'dg-label', text: 'Gas enters from below' }, svg);
    el('text', { x: 150, y: 232, class: 'dg-label', text: 'and turns through a 90° bend' }, svg);
    // Diameter scale
    const scale = el('g', {}, svg);
    for (let k = 0; k <= 10; k++) {
      const x = x0 + k * D;
      if (x > xEnd) break;
      el('line', { x1: x, x2: x, y1: yBot + 12, y2: yBot + (k % 2 ? 18 : 22), class: 'dg-rule', 'stroke-width': 1.2 }, scale);
      if (k % 2 === 0) el('text', { x, y: yBot + 38, class: 'dg-label', 'text-anchor': 'middle', text: k === 0 ? '0' : `${k}D` }, scale);
    }
    el('line', { x1: x0, x2: Math.min(xEnd, x0 + 10 * D), y1: yBot + 12, y2: yBot + 12, class: 'dg-rule' }, scale);
    el('text', { x: xEnd, y: yTop - 14, class: 'dg-label', 'text-anchor': 'end', text: 'Outer wall of the bend' }, svg);
    el('text', { x: xEnd, y: yBot + 62, class: 'dg-label', 'text-anchor': 'end', text: 'Inner wall of the bend' }, svg);

    const dyn = el('g', {}, svg);
    const input = $('#pf-dist');
    const base = (r) => Math.pow(Math.max(1e-6, 1 - Math.min(1, r)), 1 / 7);
    const skew = (d) => 1.05 * Math.exp(-d / 2.1);

    function areaMean(a) {
      // Polar integration of base(r)·exp(a·r·cosθ) over the unit disc
      const NR = 80, NT = 64;
      let sum = 0;
      for (let i = 0; i < NR; i++) {
        const r = (i + 0.5) / NR;
        let ring = 0;
        for (let j = 0; j < NT; j++) ring += Math.exp(a * r * Math.cos((2 * Math.PI * (j + 0.5)) / NT));
        sum += base(r) * (ring / NT) * r * (1 / NR);
      }
      return 2 * sum; // divide by π·1², times 2π from θ
    }

    function draw(d) {
      const a = skew(d);
      const mean = areaMean(a);
      const norm = 0.8167 / mean; // keep the area-average velocity fixed as the profile reshapes
      const xp = x0 + d * D;
      const L = 92;
      dyn.innerHTML = '';
      el('line', { x1: xp, x2: xp, y1: yTop, y2: yBot, class: 'dg-ink', 'stroke-dasharray': '4 4', style: 'stroke:var(--accent)', 'stroke-width': 1.5 }, dyn);
      const rows = 9, tips = [];
      let peak = 0;
      for (let j = 0; j < rows; j++) {
        const y = yTop + ((j + 0.5) * D) / rows;
        const s = 1 - (2 * (y - yTop)) / D; // +1 at the outer (top) wall
        const u = base(Math.abs(s)) * Math.exp(a * s) * norm;
        peak = Math.max(peak, u);
        const len = Math.max(2, L * u);
        tips.push([xp + len, y]);
        el('line', { x1: xp, y1: y, x2: xp + len, y2: y, class: 'dg-gas-stroke', 'stroke-width': 2.4, 'marker-end': 'url(#m1-arr)' }, dyn);
      }
      const pts = [[xp, yTop], ...tips, [xp, yBot]];
      el('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'dg-gas-stroke', 'stroke-width': 1, opacity: 0.55 }, dyn);
      // Average-velocity reference
      const xm = xp + L * 0.8167;
      el('line', { x1: xm, x2: xm, y1: yTop - 6, y2: yBot + 6, class: 'dg-label', style: 'stroke:var(--ink-3)', 'stroke-dasharray': '2 3' }, dyn);
      el('text', { x: xm, y: yTop - 10, class: 'dg-label', 'text-anchor': 'middle', text: 'average' }, dyn);

      // Errors: single center point vs equal-area 12-point traverse
      const center = 1 * norm;
      const rj = [1, 2, 3].map((j) => Math.sqrt((2 * j - 1) / 6));
      let trav = 0;
      rj.forEach((r) => { trav += base(r) * (Math.exp(a * r) + Math.exp(-a * r) + 2); });
      trav = (trav / 12) * norm;
      // Peak over the whole field lies on the skew axis
      let fieldPeak = 0;
      for (let s = -1; s <= 1; s += 0.005) fieldPeak = Math.max(fieldPeak, base(Math.abs(s)) * Math.exp(a * s) * norm);
      $('#pf-peak').textContent = fmt(fieldPeak / 0.8167, 2) + '×';
      const pct = (v) => (v >= 0 ? '+' : '−') + fmt(Math.abs(v) * 100, 1) + '%';
      $('#pf-one').textContent = pct(center / 0.8167 - 1);
      $('#pf-trav').textContent = pct(trav / 0.8167 - 1);
    }
    ST.bind(input, '#pf-dist-out', (v) => `${fmt(v, 1)} diameters`, draw);
  })();

  /* =========================================================
     Bench 2: site planner + Figure 1-1
     ========================================================= */
  (function siteBench() {
    const svg = $('#site-svg');
    if (!svg) return;
    arrowDefs(svg, 'm1-dim', 'dg-label');
    const dIn = $('#st-d'), run = $('#st-run'), bIn = $('#st-b');
    let shape = 'circ';
    const static_ = el('g', {}, svg);
    const stackG = el('g', {}, svg);
    const chartG = el('g', {}, svg);

    // Chart frame (static)
    const cx0 = 520, cx1 = 965, cy0 = 62, cy1 = 352;
    const X = (b) => cx0 + ((b - 2) / 8) * (cx1 - cx0);
    const Y = (p) => cy1 - (p / 26) * (cy1 - cy0);
    el('rect', { x: cx0, y: cy0, width: cx1 - cx0, height: cy1 - cy0, class: 'dg-panel' }, static_);
    for (let b = 2; b <= 10; b++) {
      el('line', { x1: X(b), x2: X(b), y1: cy0, y2: cy1, class: 'dg-rule', opacity: 0.45 }, static_);
      el('text', { x: X(b), y: cy1 + 18, class: 'dg-label', 'text-anchor': 'middle', text: b }, static_);
    }
    [0.5, 1, 1.5, 2, 2.5].forEach((a) => el('text', { x: X(a * 4), y: cy0 - 8, class: 'dg-label', 'text-anchor': 'middle', text: a }, static_));
    [8, 12, 16, 20, 24].forEach((p) => {
      el('line', { x1: cx0, x2: cx1, y1: Y(p), y2: Y(p), class: 'dg-rule', opacity: 0.45 }, static_);
      el('text', { x: cx0 - 8, y: Y(p) + 4, class: 'dg-label', 'text-anchor': 'end', text: p }, static_);
    });
    el('rect', { x: cx0, y: cy0, width: cx1 - cx0, height: cy1 - cy0, class: 'dg-rule' }, static_);
    el('text', { x: (cx0 + cx1) / 2, y: cy1 + 40, class: 'dg-label', 'text-anchor': 'middle', text: 'Distance B: diameters downstream of the disturbance' }, static_);
    el('text', { x: (cx0 + cx1) / 2, y: cy0 - 28, class: 'dg-label', 'text-anchor': 'middle', text: 'Distance A: diameters upstream of the disturbance' }, static_);
    const yl = el('text', { x: 0, y: 0, class: 'dg-label', 'text-anchor': 'middle', text: 'Minimum number of traverse points', transform: `translate(${cx0 - 36} ${(cy0 + cy1) / 2}) rotate(-90)` }, static_);

    function draw() {
      const D = +dIn.value, L = +run.value;
      bIn.max = L;
      let B = Math.min(+bIn.value, L);
      if (+bIn.value > L) bIn.value = L;
      ST.paintRange(bIn);
      const A = L - B;
      const rect = shape === 'rect';
      $('#st-d-out').textContent = inches(D);
      $('#st-run-out').textContent = `${fmt(L, 1)} D = ${fmt((L * D) / 12, 1)} ft`;
      $('#st-b-out').textContent = `${fmt(B, 1)} D`;

      /* --- Stack elevation --- */
      stackG.innerHTML = '';
      const k = Math.min(330 / (L + 1.2), 62); // px per diameter
      const cx = 230, yDist = 400 - k, yExit = yDist - L * k;
      const left = cx - k / 2, right = cx + k / 2;
      // ground and breeching (the upstream disturbance)
      el('line', { x1: 30, x2: 420, y1: yDist + k + 6, y2: yDist + k + 6, class: 'dg-rule', 'stroke-width': 1.5 }, stackG);
      el('rect', { x: 40, y: yDist, width: left - 40, height: k, style: 'fill:var(--panel)' }, stackG);
      el('path', { d: `M40,${yDist} L${left},${yDist} M40,${yDist + k} L${left},${yDist + k}`, class: 'dg-ink', 'stroke-width': 2 }, stackG);
      el('rect', { x: left, y: yExit, width: k, height: yDist + k + 6 - yExit, style: 'fill:var(--panel)' }, stackG);
      el('path', { d: `M${left},${yExit} L${left},${yDist} M${right},${yExit} L${right},${yDist + k + 6} M${left},${yDist + k} L${left},${yDist + k + 6}`, class: 'dg-ink', 'stroke-width': 2 }, stackG);
      // plume at exit
      [[0, -14, 9], [-8, -28, 11], [6, -40, 13], [-2, -56, 15]].forEach(([dx, dy, r], i) =>
        el('circle', { cx: cx + dx, cy: yExit + dy, r: Math.min(r, k * 0.6), class: 'dg-gas', opacity: 0.18 - i * 0.03 }, stackG));
      el('text', { x: 44, y: yDist - 8, class: 'dg-label', text: 'Inlet (disturbance)' }, stackG);
      el('text', { x: right + 10, y: yExit + 4, class: 'dg-label', text: 'Stack exit (disturbance)' }, stackG);
      // dimension lines
      const yPort = yDist - B * k;
      const dx = left - 26;
      const dim = (y1, y2, label, sub) => {
        if (Math.abs(y2 - y1) > 6) el('line', { x1: dx, x2: dx, y1, y2, class: 'dg-label', style: 'stroke:var(--ink-2)', 'stroke-width': 1.2, 'marker-start': 'url(#m1-dim)', 'marker-end': 'url(#m1-dim)' }, stackG);
        const ym = (y1 + y2) / 2;
        el('text', { x: dx - 8, y: ym - 2, class: 'dg-label-strong', 'text-anchor': 'end', text: label }, stackG);
        el('text', { x: dx - 8, y: ym + 14, class: 'dg-label', 'text-anchor': 'end', text: sub }, stackG);
      };
      dim(yDist, yPort, 'B', `${fmt(B, 1)} D`);
      dim(yPort, yExit, 'A', `${fmt(A, 1)} D`);
      // port, platform, drag handle
      el('rect', { x: right, y: yPort - 5, width: 16, height: 10, style: 'fill:var(--accent)' }, stackG);
      el('line', { x1: right, x2: right + 70, y1: yPort + 18, y2: yPort + 18, class: 'dg-ink', 'stroke-width': 2 }, stackG);
      el('line', { x1: right + 66, x2: right + 66, y1: yPort + 18, y2: yPort - 14, class: 'dg-rule', 'stroke-width': 1.5 }, stackG);
      el('text', { x: right + 22, y: yPort - 10, class: 'dg-label-strong', text: 'Port' }, stackG);
      el('line', { x1: left, x2: right, y1: yPort, y2: yPort, style: 'stroke:var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '3 3' }, stackG);
      const handle = el('rect', { x: left - 30, y: yExit, width: k + 110, height: yDist - yExit, fill: 'transparent', style: 'cursor:ns-resize' }, stackG);
      handle.addEventListener('pointerdown', (e) => {
        handle.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM().inverse());
          bIn.value = clamp((yDist - p.y) / k, 0, L).toFixed(1);
          draw();
        };
        move(e);
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', move), { once: true });
      });

      /* --- Figure 1-1 chart --- */
      chartG.innerHTML = '';
      const big = rect ? 25 : 24, small = rect ? 9 : 8;
      const main = D > 24 ? 12 : small;
      const other = D > 24 ? small : 12;
      const stepPts = (end) => [[2, big], [5, big], [5, 20], [6, 20], [6, 16], [7, 16], [7, 12], [8, 12], [8, end], [10, end]];
      const poly = (pts) => pts.map(([b, p]) => `${X(b)},${Y(p)}`).join(' ');
      el('polyline', { points: poly(stepPts(other).slice(7)), class: 'dg-rule', 'stroke-width': 2, 'stroke-dasharray': '4 4' }, chartG);
      el('polyline', { points: poly(stepPts(main)), class: 'dg-ink', 'stroke-width': 2.5 }, chartG);
      el('text', { x: X(2) + 6, y: Y(big) - 8, class: 'dg-label', text: rect ? '25 (rectangular)' : '24 (circular)' }, chartG);
      el('text', { x: X(10) - 4, y: Y(other) + (other > main ? -8 : 16), class: 'dg-label', 'text-anchor': 'end', text: other === 12 ? 'over 24 in.' : '12–24 in.' }, chartG);

      const pB = figure11(B, 'B', D, rect), pA = figure11(A, 'A', D, rect);
      const need = pB && pA ? Math.max(pB, pA) : null;
      if (need) {
        el('line', { x1: cx0, x2: cx1, y1: Y(need), y2: Y(need), style: 'stroke:var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, chartG);
      }
      const marker = (dist, p, which) => {
        const xx = X(clamp(which === 'A' ? dist * 4 : dist, 2, 10));
        const yy = Y(p || 0);
        const fail = !p;
        if (which === 'B') el('circle', { cx: xx, cy: fail ? cy1 : yy, r: 7, style: `fill:${fail ? 'var(--gauge)' : 'var(--ink)'}` }, chartG);
        else el('rect', { x: xx - 6, y: (fail ? cy1 : yy) - 6, width: 12, height: 12, transform: `rotate(45 ${xx} ${fail ? cy1 : yy})`, style: `fill:${fail ? 'var(--gauge)' : 'var(--accent)'}` }, chartG);
        el('text', { x: xx, y: (fail ? cy1 : yy) - 12, class: 'dg-label-strong', 'text-anchor': 'middle', text: which }, chartG);
      };
      marker(B, pB, 'B');
      marker(A, pA, 'A');

      /* --- Readouts --- */
      $('#st-bv').innerHTML = `${fmt(B, 1)}<span class="readout-unit">D</span>`;
      $('#st-av').innerHTML = `${fmt(A, 1)}<span class="readout-unit">D</span>`;
      $('#st-pts').textContent = need || '—';
      const status = $('#st-status');
      if (D < 12) {
        status.innerHTML = '<span class="status warn">Under 12 in.: use Method 1A</span>';
      } else if (!need) {
        status.innerHTML = `<span class="status fail">Site fails the minimum</span><p class="ctl-help" style="margin-top:.5rem">${B < 2 ? 'Distance B must be at least 2 diameters.' : 'Distance A must be at least 0.5 diameters.'} Move the port or get the regulator to approve an alternative.</p>`;
      } else if (B >= 8 && A >= 2) {
        status.innerHTML = `<span class="status pass">Meets 8-and-2: minimum ${need} points</span>`;
      } else {
        status.innerHTML = `<span class="status warn">Acceptable with ${need} points</span><p class="ctl-help" style="margin-top:.5rem">${pB >= pA ? 'Distance B' : 'Distance A'} controls the count.</p>`;
      }
    }

    ST.seg('st-shape', (v) => { shape = v; draw(); });
    [dIn, run, bIn].forEach((i) => i.addEventListener('input', draw));
    draw();
  })();

  /* =========================================================
     Bench 3: equal-area layout
     ========================================================= */
  (function layoutBench() {
    const svg = $('#layout-svg');
    if (!svg) return;
    const C = 220, R = 170;
    const CIRC_N = [8, 12, 16, 20, 24];
    const RECT_N = { 9: [3, 3], 12: [4, 3], 16: [4, 4], 20: [5, 4], 25: [5, 5], 30: [6, 5], 36: [6, 6], 42: [7, 6], 49: [7, 7] };
    let shape = 'circ', n = 12;
    const segN = $('#ly-n');
    const table = $('#ly-table');
    const tint = (pct) => `fill:color-mix(in srgb, var(--accent) ${pct}%, var(--panel))`;

    function buildSeg() {
      const opts = shape === 'circ' ? CIRC_N : Object.keys(RECT_N).map(Number);
      if (!opts.includes(n)) n = shape === 'circ' ? 12 : 12;
      segN.innerHTML = opts.map((v) => `<button type="button" data-value="${v}" aria-pressed="${v === n}">${v}</button>`).join('');
      ST.seg(segN, (v) => { n = +v; draw(); });
    }

    function draw() {
      svg.innerHTML = '';
      ST.$$('[data-shape]').forEach((c) => (c.hidden = c.dataset.shape !== shape));
      if (shape === 'circ') drawCirc(); else drawRect();
    }

    function drawCirc() {
      const D = +$('#ly-d').value, port = +$('#ly-port').value;
      $('#ly-d-out').textContent = inches(D);
      $('#ly-port-out').textContent = `${fmt(port, 1)} in.`;
      const perDia = n / 2, rings = n / 4;
      const minWall = D > 24 ? 1.0 : 0.5;
      // Equal-area rings, outermost first so inner ones paint on top
      for (let k = rings; k >= 1; k--) {
        el('circle', { cx: C, cy: C, r: R * Math.sqrt(k / rings), style: tint(k % 2 ? 16 : 6) }, svg);
      }
      el('circle', { cx: C, cy: C, r: R, class: 'dg-ink', 'stroke-width': 3 }, svg);
      // centroid circles
      for (let j = 1; j <= rings; j++) {
        el('circle', { cx: C, cy: C, r: R * Math.sqrt((2 * j - 1) / perDia), class: 'dg-rule', 'stroke-dasharray': '2 4' }, svg);
      }
      el('line', { x1: C - R, x2: C + R, y1: C, y2: C, class: 'dg-rule' }, svg);
      el('line', { x1: C, x2: C, y1: C - R, y2: C + R, class: 'dg-rule' }, svg);
      // ports: A on the right, B at the bottom
      el('rect', { x: C + R + 1, y: C - 7, width: 22, height: 14, style: 'fill:var(--steel)' }, svg);
      el('rect', { x: C - 7, y: C + R + 1, width: 14, height: 22, style: 'fill:var(--steel)' }, svg);
      el('text', { x: C + R + 12, y: C - 14, class: 'dg-label-strong', 'text-anchor': 'middle', text: 'A' }, svg);
      el('text', { x: C + 18, y: C + R + 20, class: 'dg-label-strong', text: 'B' }, svg);

      const rows = [];
      let adjusted = 0;
      for (let i = 1; i <= perDia; i++) {
        const pct = pointPct(i, perDia);
        let dist = (pct / 100) * D;
        const fromFar = D - dist;
        let adj = false;
        if (dist < minWall) { dist = minWall; adj = true; }
        if (fromFar < minWall) { dist = D - minWall; adj = true; }
        if (adj) adjusted++;
        rows.push({ i, pct, dist, adj });
        const f = dist / D; // fraction from port-side wall
        const xa = C + R - f * 2 * R, yb = C + R - f * 2 * R;
        [[xa, C], [C, yb]].forEach(([x, y], k) => {
          if (adj) {
            const fo = pct / 100;
            const ox = k === 0 ? C + R - fo * 2 * R : C, oy = k === 0 ? C : C + R - fo * 2 * R;
            el('circle', { cx: ox, cy: oy, r: 4, class: 'dg-rule', 'stroke-dasharray': '2 2' }, svg);
            el('circle', { cx: x, cy: y, r: 8, style: 'fill:none;stroke:var(--caution);stroke-width:2' }, svg);
          }
          el('circle', { cx: x, cy: y, r: 5, style: 'fill:var(--ink)' }, svg);
        });
        if (perDia <= 8) el('text', { x: xa, y: C - 10, class: 'dg-label', 'text-anchor': 'middle', text: i }, svg);
        else if (i === 1 || i === perDia) el('text', { x: xa, y: C - 10, class: 'dg-label', 'text-anchor': 'middle', text: i }, svg);
      }

      table.innerHTML = `<thead><tr><th class="n">Point</th><th class="n">% of diameter</th><th class="n">From inside wall</th><th class="n">Probe mark from port face</th></tr></thead><tbody>${rows
        .map((r) => `<tr class="${r.adj ? 'is-flag' : ''}"><td class="n">${r.i}</td><td class="n">${fmt(r.pct, 1)}</td><td class="n">${fmt(r.dist, 2)} in.${r.adj ? ' <span class="tag">adjusted</span>' : ''}</td><td class="n">${fmt(r.dist + port, 2)} in.</td></tr>`)
        .join('')}</tbody>`;
      $('#ly-note').textContent = adjusted
        ? `${adjusted} point${adjusted > 1 ? 's' : ''} per diameter moved to ${fmt(minWall, 1)} in. from the wall (dashed circles show the unadjusted spots).`
        : `No points fall within ${fmt(minWall, 1)} in. of the wall.`;
      const r1 = rows[0];
      $('#ly-foot').innerHTML = `<p>Each diameter has ${perDia} points; both ports use the same marks. Point 1 sits ${fmt(r1.dist, 2)} in. inside the wall, so with ${fmt(port, 1)} in. of port depth you mark the probe at ${fmt(r1.dist + port, 2)} in. from the port face.</p>`;
    }

    function drawRect() {
      const Lr = +$('#ly-l').value, Wr = +$('#ly-w').value;
      $('#ly-l-out').textContent = inches(Lr);
      $('#ly-w-out').textContent = inches(Wr);
      const [a, b] = RECT_N[n];
      const cols = Lr >= Wr ? a : b, rows = Lr >= Wr ? b : a;
      const s = 340 / Math.max(Lr, Wr);
      const w = Lr * s, h = Wr * s, x0 = C - w / 2, y0 = C - h / 2;
      el('rect', { x: x0, y: y0, width: w, height: h, style: tint(6) }, svg);
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          if ((i + j) % 2 === 0) el('rect', { x: x0 + (i * w) / cols, y: y0 + (j * h) / rows, width: w / cols, height: h / rows, style: tint(15) }, svg);
      for (let i = 1; i < cols; i++) el('line', { x1: x0 + (i * w) / cols, x2: x0 + (i * w) / cols, y1: y0, y2: y0 + h, class: 'dg-rule', 'stroke-dasharray': '3 3' }, svg);
      for (let j = 1; j < rows; j++) el('line', { x1: x0, x2: x0 + w, y1: y0 + (j * h) / rows, y2: y0 + (j * h) / rows, class: 'dg-rule', 'stroke-dasharray': '3 3' }, svg);
      el('rect', { x: x0, y: y0, width: w, height: h, class: 'dg-ink', 'stroke-width': 3 }, svg);
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          el('circle', { cx: x0 + ((i + 0.5) * w) / cols, cy: y0 + ((j + 0.5) * h) / rows, r: 5, style: 'fill:var(--ink)' }, svg);
      el('text', { x: C, y: y0 - 10, class: 'dg-label', 'text-anchor': 'middle', text: `Length ${fmt(Lr, 0)} in.: ${cols} columns` }, svg);
      el('text', { x: x0 - 10, y: C, class: 'dg-label', 'text-anchor': 'middle', transform: `rotate(-90 ${x0 - 10} ${C})`, text: `Width ${fmt(Wr, 0)} in.: ${rows} rows` }, svg);

      const eL = Lr / cols, eW = Wr / rows;
      const ratio = Math.max(eL, eW) / Math.min(eL, eW);
      const De = (2 * Lr * Wr) / (Lr + Wr);
      const maxN = Math.max(cols, rows);
      let body = '';
      for (let k = 0; k < maxN; k++) {
        body += `<tr><td class="n">${k + 1}</td><td class="n">${k < cols ? fmt((k + 0.5) * eL, 2) + ' in.' : ''}</td><td class="n">${k < rows ? fmt((k + 0.5) * eW, 2) + ' in.' : ''}</td></tr>`;
      }
      table.innerHTML = `<thead><tr><th class="n">Line</th><th class="n">Column center, from side wall</th><th class="n">Row center, from port wall</th></tr></thead><tbody>${body}</tbody>`;
      const ok = ratio <= 2.0;
      $('#ly-note').innerHTML = `Equivalent diameter ${fmt(De, 1)} in. Each element is ${fmt(eL, 1)} × ${fmt(eW, 1)} in., a ratio of ${fmt(ratio, 2)}. ${ok ? '' : '<strong>Above 2.0: choose a layout with more points along the long side.</strong>'}`;
      $('#ly-foot').innerHTML = `<p>${ok ? `<span class="status pass">Element ratio within 1.0–2.0</span>` : `<span class="status fail">Element ratio over 2.0</span>`}  Points sit at the center of each element. Ports are spaced along one side so the probe can reach each row.</p>`;
    }

    ST.seg('ly-shape', (v) => { shape = v; buildSeg(); draw(); });
    ['#ly-d', '#ly-port', '#ly-l', '#ly-w'].forEach((id) => $(id).addEventListener('input', draw));
    buildSeg();
    draw();
  })();

  /* =========================================================
     Bench 4: cyclonic flow null check
     ========================================================= */
  (function cyclonicBench() {
    const svg = $('#cyc-svg');
    if (!svg) return;
    const FR = [0.044, 0.146, 0.296, 0.704, 0.854, 0.956]; // 12-point traverse, fraction of D from port wall
    const thetaIn = $('#cy-theta'), swirlIn = $('#cy-swirl');
    let truth = [], rec = [], cur = 0;

    function mulberry(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function generate() {
      const sw = +swirlIn.value;
      const rnd = mulberry(1000 + sw * 7);
      truth = [];
      for (let p = 0; p < 2; p++)
        for (let i = 0; i < 6; i++) {
          const r = Math.abs(1 - 2 * FR[i]);
          let a = sw * (0.35 + 0.65 * r) + (rnd() - 0.5) * Math.min(8, sw * 0.6);
          a = Math.round(a);
          if (Math.abs(a) < 2 && sw < 6) a = 0;
          truth.push(clamp(a, -90, 90));
        }
      rec = new Array(12).fill(null);
      cur = 0;
      thetaIn.value = 0;
      ST.paintRange(thetaIn);
    }

    /* --- Static layout --- */
    const VX = 240, VY = 138; // center of the "along the probe" view
    const clip = el('clipPath', { id: 'm1-cyc-clip' }, el('defs', {}, svg));
    el('rect', { x: 20, y: 14, width: 440, height: 250, rx: 10 }, clip);
    el('rect', { x: 20, y: 14, width: 440, height: 250, rx: 10, class: 'dg-panel' }, svg);
    const streakG = el('g', { 'clip-path': 'url(#m1-cyc-clip)' }, svg);
    el('rect', { x: 20, y: 14, width: 440, height: 250, rx: 10, class: 'dg-rule' }, svg);
    el('rect', { x: 28, y: 22, width: 168, height: 24, rx: 4, class: 'dg-panel', opacity: 0.9 }, svg);
    el('text', { x: 36, y: 39, class: 'dg-label', text: 'Looking along the probe' }, svg);
    const pitot = el('g', {}, svg);
    // The pitot head: two tubes with openings facing outward
    [-1, 1].forEach((sgn) => {
      el('circle', { cx: sgn * 24, cy: 0, r: 20, style: 'fill:var(--steel);stroke:var(--ink);stroke-width:2' }, pitot);
      el('path', { d: `M${sgn * 44},-12 A20,20 0 0 ${sgn > 0 ? 1 : 0} ${sgn * 44},12`, style: 'fill:none;stroke:var(--paper);stroke-width:5' }, pitot);
      el('circle', { cx: sgn * 24, cy: 0, r: 7, style: 'fill:var(--ink)' }, pitot);
    });
    el('line', { x1: -80, x2: 80, y1: 0, y2: 0, style: 'stroke:var(--accent);stroke-width:1.2', 'stroke-dasharray': '3 3' }, pitot);
    const angleArc = el('path', { style: 'fill:none;stroke:var(--caution);stroke-width:2' }, svg);
    const angleTxt = el('text', { x: VX, y: VY - 82, class: 'dg-label-strong', 'text-anchor': 'middle' }, svg);

    // Inclined manometer
    const mx0 = 40, mx1 = 440, my0 = 318, my1 = 292;
    el('text', { x: 40, y: 284, class: 'dg-label', text: 'Inclined manometer, in. H₂O' }, svg);
    el('line', { x1: mx0, y1: my0, x2: mx1, y2: my1, style: 'stroke:var(--rule-strong);stroke-width:12;stroke-linecap:round' }, svg);
    el('line', { x1: mx0, y1: my0, x2: mx1, y2: my1, style: 'stroke:var(--panel);stroke-width:8;stroke-linecap:round' }, svg);
    const fluid = el('line', { style: 'stroke:var(--gauge);stroke-width:8' }, svg);
    for (let k = -5; k <= 5; k++) {
      const f = (k + 5) / 10;
      const x = ST.lerp(mx0 + 10, mx1 - 10, f), y = ST.lerp(my0, my1, (x - mx0) / (mx1 - mx0));
      el('line', { x1: x, x2: x, y1: y + 8, y2: y + (k === 0 ? 18 : 13), class: 'dg-rule' }, svg);
      if (k % 5 === 0) el('text', { x, y: y + 31, class: 'dg-label', 'text-anchor': 'middle', text: k === 0 ? '0' : k > 0 ? '+0.5' : '−0.5' }, svg);
    }

    // Plan view
    const PX = 740, PY = 165, PR = 125;
    el('text', { x: PX, y: 22, class: 'dg-label', 'text-anchor': 'middle', text: 'Plan view: recorded yaw angles' }, svg);
    const swirlG = el('g', {}, svg);
    el('circle', { cx: PX, cy: PY, r: PR, class: 'dg-panel' }, svg);
    el('circle', { cx: PX, cy: PY, r: PR, class: 'dg-ink', 'stroke-width': 2.5 }, svg);
    el('line', { x1: PX - PR, x2: PX + PR, y1: PY, y2: PY, class: 'dg-rule', 'stroke-dasharray': '2 4' }, svg);
    el('line', { x1: PX, x2: PX, y1: PY - PR, y2: PY + PR, class: 'dg-rule', 'stroke-dasharray': '2 4' }, svg);
    el('rect', { x: PX + PR, y: PY - 6, width: 14, height: 12, style: 'fill:var(--steel)' }, svg);
    el('rect', { x: PX - 6, y: PY + PR, width: 12, height: 14, style: 'fill:var(--steel)' }, svg);
    el('text', { x: PX + PR + 20, y: PY + 5, class: 'dg-label-strong', text: 'A' }, svg);
    el('text', { x: PX + 12, y: PY + PR + 18, class: 'dg-label-strong', text: 'B' }, svg);
    const planG = el('g', {}, svg);
    const planTxt = el('text', { x: PX, y: PY + PR + 42, class: 'dg-label', 'text-anchor': 'middle' }, svg);

    const pos = (idx) => {
      const p = Math.floor(idx / 6), i = idx % 6;
      const d = PR - FR[i] * 2 * PR;
      return p === 0 ? [PX + d, PY] : [PX, PY + d];
    };
    const label = (idx) => `${'AB'[Math.floor(idx / 6)]}-${(idx % 6) + 1}`;

    /* --- Streaks: gas direction at the current point --- */
    const streaks = Array.from({ length: 46 }, (_, i) => ({ u: (i * 0.618034) % 1, v: (i * 0.4142) % 1, line: el('line', { class: 'dg-gas-stroke', 'stroke-width': 2, 'stroke-linecap': 'round' }, streakG) }));

    function render(t) {
      if (!truth.length) return;
      const theta = +thetaIn.value;
      const alpha = cur < 12 ? truth[cur] : 0;
      const ar = (alpha * Math.PI) / 180;
      // Streaks move along the flow direction: up, tilted by alpha
      const dir = [Math.sin(ar), -Math.cos(ar)], perp = [Math.cos(ar), Math.sin(ar)];
      streaks.forEach((s) => {
        const along = ((s.v + t * 0.22) % 1) * 520 - 260;
        const across = s.u * 520 - 260;
        const x = VX + perp[0] * across + dir[0] * along, y = VY + perp[1] * across + dir[1] * along;
        s.line.setAttribute('x1', x); s.line.setAttribute('y1', y);
        s.line.setAttribute('x2', x - dir[0] * 20); s.line.setAttribute('y2', y - dir[1] * 20);
        s.line.setAttribute('opacity', 0.5);
      });
      pitot.setAttribute('transform', `translate(${VX} ${VY}) rotate(${theta})`);
      // angle arc from vertical-reference to current rotation
      const r = 72, a0 = -90, a1 = -90 + theta;
      const p0 = [VX + r * Math.cos((a0 * Math.PI) / 180), VY + r * Math.sin((a0 * Math.PI) / 180)];
      const p1 = [VX + r * Math.cos((a1 * Math.PI) / 180), VY + r * Math.sin((a1 * Math.PI) / 180)];
      angleArc.setAttribute('d', Math.abs(theta) < 1 ? '' : `M${p0[0]},${p0[1]} A${r},${r} 0 0 ${theta > 0 ? 1 : 0} ${p1[0]},${p1[1]}`);
      angleTxt.textContent = `${theta > 0 ? '+' : ''}${theta}°`;

      const dp = cur < 12 ? 0.55 * Math.sin(((alpha - theta) * Math.PI) / 180) : 0;
      const shown = Math.abs(dp) < 0.005 ? 0 : dp;
      const f = clamp(0.5 + shown, 0, 1);
      const zx = ST.lerp(mx0 + 10, mx1 - 10, 0.5), zy = ST.lerp(my0, my1, (zx - mx0) / (mx1 - mx0));
      const fx = ST.lerp(mx0 + 10, mx1 - 10, f), fy = ST.lerp(my0, my1, (fx - mx0) / (mx1 - mx0));
      fluid.setAttribute('x1', mx0); fluid.setAttribute('y1', my0);
      fluid.setAttribute('x2', fx); fluid.setAttribute('y2', fy);
      $('#cy-dp').textContent = cur < 12 ? (shown >= 0 ? '' : '−') + fmt(Math.abs(shown), 2) : '—';
      void zx; void zy;
    }

    function refresh() {
      planG.innerHTML = '';
      swirlG.innerHTML = '';
      const sw = +swirlIn.value;
      // faint swirl arcs whose strength follows the swirl setting
      if (sw > 0) {
        [0.45, 0.75].forEach((f, k) => {
          const r = PR * f, a = k * 90;
          const s = [PX + r * Math.cos((a * Math.PI) / 180), PY + r * Math.sin((a * Math.PI) / 180)];
          const e = [PX + r * Math.cos(((a + 120) * Math.PI) / 180), PY + r * Math.sin(((a + 120) * Math.PI) / 180)];
          el('path', { d: `M${s[0]},${s[1]} A${r},${r} 0 0 1 ${e[0]},${e[1]}`, style: `fill:none;stroke:var(--gas);stroke-width:2;opacity:${Math.min(0.5, sw / 60)}` }, swirlG);
        });
      }
      for (let k = 0; k < 12; k++) {
        const [x, y] = pos(k);
        const v = rec[k];
        const done = v !== null;
        el('circle', { cx: x, cy: y, r: 6, style: done ? `fill:${Math.abs(v) > 20 ? 'var(--gauge)' : 'var(--gas)'}` : 'fill:var(--panel);stroke:var(--ink-3);stroke-width:1.5' }, planG);
        if (done) {
          const horiz = k < 6;
          el('text', { x: horiz ? x : x + 12, y: horiz ? y - 12 + (k % 2 ? 26 : 0) : y + 4, class: 'dg-label', 'text-anchor': horiz ? 'middle' : 'start', text: `${v}°` }, planG);
        }
        if (k === cur) el('circle', { cx: x, cy: y, r: 11, style: 'fill:none;stroke:var(--accent);stroke-width:2' }, planG);
      }
      const done = rec.filter((v) => v !== null);
      const avg = done.length ? done.reduce((s, v) => s + Math.abs(v), 0) / done.length : null;
      $('#cy-avg').innerHTML = avg === null ? '—' : `${fmt(avg, 1)}<span class="readout-unit">°</span>`;
      $('#cy-point').textContent = cur < 12 ? label(cur) : 'Done';
      planTxt.textContent = done.length ? `${done.length} of 12 points recorded` : 'Start at A-1';
      const status = $('#cy-status');
      $('#cy-record').disabled = cur >= 12;
      $('#cy-fill').disabled = cur >= 12;
      if (cur >= 12) {
        status.innerHTML = avg > 20
          ? `<span class="status fail">Average ${fmt(avg, 1)}° is over 20°: cyclonic flow</span>`
          : `<span class="status pass">Average ${fmt(avg, 1)}° is within 20°: site acceptable</span>`;
      } else if (!status.dataset.msg) {
        status.innerHTML = '';
      }
      status.dataset.msg = '';
      render(lastT);
    }

    let lastT = 0;
    const loop = ST.loop(svg, (dt, t) => { lastT = t; render(t); }, { buttonHost: svg.parentElement });

    ST.bind(thetaIn, '#cy-theta-out', (v) => `${v > 0 ? '+' : ''}${v}°`, () => render(lastT));
    ST.bind(swirlIn, '#cy-swirl-out', (v) => `about ${v}°`);
    swirlIn.addEventListener('change', () => { generate(); refresh(); });
    swirlIn.addEventListener('input', () => { generate(); refresh(); });
    $('#cy-record').addEventListener('click', () => {
      if (cur >= 12) return;
      const theta = +thetaIn.value;
      const dp = 0.55 * Math.sin(((truth[cur] - theta) * Math.PI) / 180);
      const status = $('#cy-status');
      if (Math.abs(dp) >= 0.005) {
        status.dataset.msg = '1';
        status.innerHTML = `<span class="status warn">Not at null yet</span><p class="ctl-help" style="margin-top:.5rem">The manometer still reads ${fmt(dp, 2)} in. H₂O. Keep rotating until it reads 0.00.</p>`;
        refresh();
        return;
      }
      rec[cur] = theta;
      cur++;
      thetaIn.value = 0;
      ST.paintRange(thetaIn);
      $('#cy-theta-out').textContent = '0°';
      refresh();
    });
    $('#cy-fill').addEventListener('click', () => {
      for (let k = cur; k < 12; k++) rec[k] = truth[k];
      cur = 12;
      refresh();
    });

    generate();
    refresh();
    void loop;
  })();
})();
