/* Method 2: velocity and flow rate — interactive benches. */
(function () {
  'use strict';
  const { $, svg: el, fmt, clamp } = ST;

  /* ---------- Method 2 constants and equations ---------- */
  const KP = 85.49;     // ft/s [(lb/lb-mol)(in. Hg)/((°R)(in. H2O))]^1/2
  const TSTD = 528;     // °R
  const PSTD = 29.92;   // in. Hg

  const stackPressure = (pbar, pg) => pbar + pg / 13.6;
  const wetMW = (md, bws) => md * (1 - bws) + 18.0 * bws;
  const velocity = (cp, sqdp, tsR, ps, ms) => KP * cp * sqdp * Math.sqrt(tsR / (ps * ms));
  const flowStd = (bws, vs, area, tsR, ps) => 3600 * (1 - bws) * vs * area * (TSTD / tsR) * (ps / PSTD);
  const areaFt2 = (dIn) => (Math.PI * Math.pow(dIn / 12, 2)) / 4;
  const big = (n) => fmt(n, 0);

  /* =========================================================
     Bench 1: pitot tube and inclined manometer
     ========================================================= */
  (function pitotBench() {
    const svg = $('#m2-pitot-svg');
    if (!svg) return;
    const vIn = $('#pt-v'), tIn = $('#pt-t');
    let type = 'S';
    const PS = 29.92, MS = 29.0, CP = { S: 0.84, std: 0.99 };

    // Stack cutaway
    const X0 = 30, X1 = 370, Y0 = 10, Y1 = 360, PORT0 = 168, PORT1 = 212;
    const clip = el('clipPath', { id: 'm2-pt-clip' }, el('defs', {}, svg));
    el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 }, clip);
    el('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: 'dg-panel' }, svg);
    const streakG = el('g', { 'clip-path': 'url(#m2-pt-clip)' }, svg);
    el('rect', { x: X0 - 9, y: Y0, width: 9, height: Y1 - Y0, class: 'dg-wall' }, svg);
    el('rect', { x: X1, y: Y0, width: 9, height: PORT0 - Y0, class: 'dg-wall' }, svg);
    el('rect', { x: X1, y: PORT1, width: 9, height: Y1 - PORT1, class: 'dg-wall' }, svg);
    el('path', { d: `M${X1 + 9},${PORT0} L${X1 + 40},${PORT0} M${X1 + 9},${PORT1} L${X1 + 40},${PORT1}`, class: 'dg-rule', 'stroke-width': 2 }, svg);
    el('rect', { x: X0 + 8, y: Y1 - 34, width: 132, height: 24, rx: 4, class: 'dg-panel', opacity: 0.92 }, svg);
    el('text', { x: X0 + 16, y: Y1 - 17, class: 'dg-label', text: 'Stack gas flows up' }, svg);

    // Hoses from the pitot to the manometer
    const tube = (d, cls, w) => el('path', { d, class: cls, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    tube('M440,201 C500,201 505,238 540,238 L568,238 L568,256', 'dg-rule', 3.5);
    tube('M440,179 C510,179 520,122 590,122 L952,122 L952,214', 'dg-rule', 3.5);

    // Pitot heads (both drawn, one shown at a time)
    const TIP = 190;
    const head = (paths) => {
      const g = el('g', {}, svg);
      paths.forEach((d) => el('path', { d, style: 'fill:none;stroke:var(--ink);stroke-width:9;stroke-linecap:butt;stroke-linejoin:round' }, g));
      paths.forEach((d) => el('path', { d, style: 'fill:none;stroke:var(--steel);stroke-width:5;stroke-linecap:butt;stroke-linejoin:round' }, g));
      return g;
    };
    const gS = head([
      `M440,180 L${TIP + 12},180 Q${TIP},180 ${TIP},168 L${TIP},158`,
      `M440,200 L${TIP + 12},200 Q${TIP},200 ${TIP},212 L${TIP},222`,
    ]);
    el('ellipse', { cx: TIP, cy: 157, rx: 5, ry: 2.4, style: 'fill:var(--ink-3)' }, gS);
    el('ellipse', { cx: TIP, cy: 223, rx: 5, ry: 2.4, style: 'fill:var(--gauge)' }, gS);
    const gStd = head([`M440,190 L${TIP + 12},190 Q${TIP},190 ${TIP},202 L${TIP},234`]);
    el('ellipse', { cx: TIP, cy: 235, rx: 4, ry: 2, style: 'fill:var(--gauge)' }, gStd);
    [210, 216].forEach((y) => {
      el('rect', { x: TIP - 6, y, width: 3, height: 3, style: 'fill:var(--ink)' }, gStd);
      el('rect', { x: TIP + 3, y, width: 3, height: 3, style: 'fill:var(--ink)' }, gStd);
    });
    el('path', { d: 'M440,186 L440,194', style: 'stroke:var(--ink);stroke-width:2' }, gStd);

    const labelBox = (x, y, lines, cls) => {
      const g = el('g', {}, svg);
      const w = Math.max(...lines.map((l) => l.length)) * 6.6 + 14;
      el('rect', { x: x - w, y: y - 14, width: w, height: lines.length * 17 + 8, rx: 4, class: 'dg-panel', opacity: 0.92 }, g);
      lines.forEach((l, i) => el('text', { x: x - 7, y: y + i * 17, class: i === 0 ? cls || 'dg-label-strong' : 'dg-label', 'text-anchor': 'end', text: l }, g));
      return g;
    };
    const lblS = el('g', {}, svg);
    lblS.appendChild(labelBox(TIP - 10, 146, ['Downstream opening', 'sits in the wake']));
    lblS.appendChild(labelBox(TIP - 10, 232, ['Impact opening', 'faces into the flow']));
    const lblStd = el('g', {}, svg);
    lblStd.appendChild(labelBox(TIP - 10, 244, ['Nose opening', 'total pressure']));
    lblStd.appendChild(labelBox(TIP - 10, 190, ['Side holes', 'static pressure']));

    // Pressure tags on the hoses
    const tagImp = el('text', { x: 452, y: 230, class: 'dg-label-strong', style: 'fill:var(--gauge)' }, svg);
    const tagWake = el('text', { x: 452, y: 168, class: 'dg-label-strong' }, svg);

    // Inclined manometer
    const P0 = [606, 309], P1 = [942, 224];
    const d = [P1[0] - P0[0], P1[1] - P0[1]];
    const len = Math.hypot(d[0], d[1]);
    const nrm = [-d[1] / len, d[0] / len]; // points below the tube
    el('rect', { x: 540, y: 256, width: 58, height: 72, rx: 7, style: 'fill:var(--panel);stroke:var(--rule-strong);stroke-width:2' }, svg);
    el('rect', { x: 544, y: 300, width: 50, height: 24, rx: 4, style: 'fill:var(--gauge);opacity:0.75' }, svg);
    el('line', { x1: 596, y1: 312, x2: 952, y2: 222, style: 'stroke:var(--rule-strong);stroke-width:13;stroke-linecap:round' }, svg);
    el('line', { x1: 596, y1: 312, x2: 952, y2: 222, style: 'stroke:var(--panel);stroke-width:8;stroke-linecap:round' }, svg);
    const fluid = el('line', { x1: 596, y1: 312, style: 'stroke:var(--gauge);stroke-width:8;stroke-linecap:round' }, svg);
    const at = (f, off) => [P0[0] + d[0] * f + nrm[0] * off, P0[1] + d[1] * f + nrm[1] * off];
    for (let k = 0; k <= 20; k++) {
      const f = k / 20, major = k % 5 === 0;
      const a = at(f, 8), b = at(f, major ? 20 : 13);
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'dg-rule', 'stroke-width': major ? 1.6 : 1 }, svg);
      if (major) {
        const t = at(f, 36);
        el('text', { x: t[0], y: t[1] + 4, class: 'dg-label', 'text-anchor': 'middle', text: fmt(k / 10, 1) }, svg);
      }
    }
    el('text', { x: 540, y: 364, class: 'dg-label', text: 'Inclined manometer, in. H₂O' }, svg);
    const offScale = el('text', { x: 952, y: 206, class: 'dg-label-strong', 'text-anchor': 'end', style: 'fill:var(--gauge)' }, svg);

    // Streaks
    const streaks = Array.from({ length: 40 }, (_, i) => ({
      x: X0 + 14 + ((i * 0.6180339 + 0.13) % 1) * (X1 - X0 - 28),
      y: Y0 + ((i * 0.7548777 + 0.41) % 1) * (Y1 - Y0),
      k: 0.85 + ((i * 0.5698403) % 1) * 0.3,
      line: el('line', { class: 'dg-gas-stroke', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.5 }, streakG),
    }));

    function readings() {
      const v = +vIn.value, tsR = +tIn.value + 460;
      const pv = Math.pow(v / KP, 2) * (PS * MS) / tsR; // true velocity pressure (Cp = 1)
      const dp = pv / Math.pow(CP[type], 2);
      return { v, pv, dp, imp: pv, wake: -(dp - pv) };
    }

    function update() {
      const r = readings();
      gS.style.display = type === 'S' ? '' : 'none';
      lblS.style.display = type === 'S' ? '' : 'none';
      gStd.style.display = type === 'std' ? '' : 'none';
      lblStd.style.display = type === 'std' ? '' : 'none';
      const f = clamp(r.dp / 2.0, 0, 1);
      const end = at(f, 0);
      fluid.setAttribute('x2', end[0]);
      fluid.setAttribute('y2', end[1]);
      offScale.textContent = r.dp > 2.0 ? 'Off scale' : '';
      const sgn = (x) => (x >= 0.005 ? '+' : x <= -0.005 ? '−' : '') + fmt(Math.abs(x), 2);
      tagImp.textContent = `${sgn(r.imp)} in.`;
      tagWake.textContent = `${sgn(r.wake)} in.`;
      $('#pt-dp').innerHTML = `${fmt(r.dp, 2)}<span class="readout-unit">in. H₂O</span>`;
      $('#pt-imp').innerHTML = `${sgn(r.imp)}<span class="readout-unit">in. H₂O</span>`;
      $('#pt-wake').innerHTML = `${sgn(r.wake)}<span class="readout-unit">in. H₂O</span>`;
      $('#pt-pv').innerHTML = `${fmt(r.pv, 2)}<span class="readout-unit">in. H₂O</span>`;
    }

    const loop = ST.loop(svg, (dt) => {
      const v = +vIn.value;
      streaks.forEach((s) => {
        s.y -= v * 2.6 * s.k * dt;
        if (s.y < Y0 - 30) s.y += Y1 - Y0 + 40;
        const L = 6 + v * 0.22;
        s.line.setAttribute('x1', s.x); s.line.setAttribute('x2', s.x);
        s.line.setAttribute('y1', s.y); s.line.setAttribute('y2', s.y + L);
      });
    }, { buttonHost: svg.parentElement });

    ST.seg('pt-type', (v) => { type = v; update(); });
    ST.bind(vIn, 'pt-v-out', (v) => `${v} ft/s (${fmt(v * 60, 0)} ft/min)`, () => { update(); loop.draw(); });
    ST.bind(tIn, 'pt-t-out', (v) => `${v} °F`, update);
    update();
  })();

  /* =========================================================
     Bench 2: velocity and flow calculator
     ========================================================= */
  (function calcBench() {
    if (!$('#b-calc')) return;
    const ids = ['cl-sq', 'cl-ts', 'cl-cp', 'cl-pbar', 'cl-pg', 'cl-md', 'cl-bws', 'cl-d'];
    const fmts = {
      'cl-sq': (v) => `${fmt(v, 2)} (Δp ≈ ${fmt(v * v, 2)} in. H₂O)`,
      'cl-ts': (v) => `${v} °F`,
      'cl-cp': (v) => fmt(v, 2),
      'cl-pbar': (v) => `${fmt(v, 2)} in. Hg`,
      'cl-pg': (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)} in. H₂O`,
      'cl-md': (v) => `${fmt(v, 2)} lb/lb-mol`,
      'cl-bws': (v) => `${fmt(v, 1)}%`,
      'cl-d': (v) => `${v} in. (${fmt(v / 12, 2)} ft)`,
    };

    function compute() {
      const g = (id) => +$('#' + id).value;
      const sq = g('cl-sq'), tF = g('cl-ts'), cp = g('cl-cp'), pbar = g('cl-pbar'), pg = g('cl-pg');
      const md = g('cl-md'), bws = g('cl-bws') / 100, D = g('cl-d');
      const tsR = tF + 460;
      const ps = stackPressure(pbar, pg);
      const ms = wetMW(md, bws);
      const vs = velocity(cp, sq, tsR, ps, ms);
      const A = areaFt2(D);
      const qa = vs * A * 60;
      const qsd = flowStd(bws, vs, A, tsR, ps);
      const n = (x, k) => fmt(x, k).replace(/,/g, '{,}');
      ST.tex($('#cl-eq-ps'), `P_s = ${n(pbar, 2)} + \\dfrac{${pg < 0 ? '(' + n(pg, 1) + ')' : n(pg, 1)}}{13.6} = \\mathbf{${n(ps, 2)}}\\ \\text{in. Hg}`);
      ST.tex($('#cl-eq-ms'), `M_s = ${n(md, 2)}\\,(1 - ${n(bws, 3)}) + 18.0 \\times ${n(bws, 3)} = \\mathbf{${n(ms, 2)}}\\ \\text{lb/lb-mol}`);
      ST.tex($('#cl-eq-vs'), `v_s = 85.49 \\times ${n(cp, 2)} \\times ${n(sq, 3)} \\times \\sqrt{\\dfrac{${n(tsR, 0)}}{${n(ps, 2)} \\times ${n(ms, 2)}}} = \\mathbf{${n(vs, 1)}}\\ \\text{ft/s}`);
      ST.tex($('#cl-eq-q'), `Q_{sd} = 3600 \\times (1 - ${n(bws, 3)}) \\times ${n(vs, 1)} \\times ${n(A, 2)} \\times \\dfrac{528}{${n(tsR, 0)}} \\times \\dfrac{${n(ps, 2)}}{29.92} = \\mathbf{${n(qsd, 0)}}\\ \\text{dscf/hr}`);
      $('#cl-vs').innerHTML = `${fmt(vs, 1)}<span class="readout-unit">ft/s</span>`;
      $('#cl-qa').innerHTML = `${big(qa)}<span class="readout-unit">acfm</span>`;
      $('#cl-qsd').innerHTML = `${big(qsd / 60)}<span class="readout-unit">dscfm</span>`;
      $('#cl-qm').innerHTML = `${fmt((qsd / 60) * 0.0283168, 0)}<span class="readout-unit">dscm/min</span>`;
    }
    ids.forEach((id) => ST.bind(id, id + '-out', fmts[id], compute));
  })();

  /* =========================================================
     Bench 3: a 12-point traverse, average √Δp vs √ average Δp
     ========================================================= */
  (function traverseBench() {
    const svg = $('#m2-trav-svg');
    if (!svg) return;
    const FR = [0.044, 0.146, 0.296, 0.704, 0.854, 0.956];
    const COND = { D: 84, cp: 0.84, pbar: 29.4, pg: -0.6, md: 30.1, bws: 0.105 };
    const table = $('#tv-table');
    let profile = 'settled', seed = 7, data = [];

    function rng(s) {
      return function () {
        s |= 0; s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function generate() {
      const r = rng(seed);
      const gauss = () => (r() + r() + r() - 1.5) * 1.15;
      const P = {
        settled: { a: [0, 0], noise: 0.015, dip: 0 },
        skewed: { a: [0.55, 0.15], noise: 0.03, dip: 0 },
        uneven: { a: [0.9, 0.2], noise: 0.06, dip: 0.55 },
      }[profile];
      const raw = [];
      for (let p = 0; p < 2; p++)
        for (let i = 0; i < 6; i++) {
          const s = 1 - 2 * FR[i];
          let u = Math.pow(1 - Math.abs(s), 1 / 7) * Math.exp(P.a[p] * s) * (1 + P.noise * gauss());
          if (p === 1 && P.dip) u *= 1 - P.dip * Math.exp(-Math.pow(s - 0.3, 2) / 0.06);
          raw.push(Math.max(0.05, u));
        }
      const meanSq = raw.reduce((t, u) => t + u * u, 0) / raw.length;
      data = raw.map((u, k) => ({
        label: `${'AB'[Math.floor(k / 6)]}${(k % 6) + 1}`,
        dp: Math.max(0.01, Math.round(((0.7 * u * u) / meanSq) * 100) / 100),
        ts: Math.round(345 + gauss() * (profile === 'settled' ? 1.5 : 3.5)),
      }));
      buildTable();
      compute();
    }

    function buildTable() {
      table.innerHTML = `<thead><tr><th>Point</th><th class="n">Δp, in. H₂O</th><th class="n">√Δp</th><th class="n">T<sub>s</sub>, °F</th></tr></thead>
        <tbody>${data.map((d, k) => `<tr><td>${d.label}</td>
          <td class="n"><input class="field" type="number" step="0.01" min="0" inputmode="decimal" aria-label="Δp at ${d.label}" data-k="${k}" data-f="dp" value="${d.dp.toFixed(2)}"></td>
          <td class="n" id="tv-sq-${k}"></td>
          <td class="n"><input class="field" type="number" step="1" inputmode="numeric" aria-label="Stack temperature at ${d.label}" data-k="${k}" data-f="ts" value="${d.ts}"></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Average</td><td class="n" id="tv-f-dp"></td><td class="n" id="tv-f-sq"></td><td class="n" id="tv-f-ts"></td></tr></tfoot>`;
      ST.$$('input', table).forEach((inp) =>
        inp.addEventListener('input', () => {
          const v = parseFloat(inp.value);
          if (!Number.isFinite(v)) return;
          data[+inp.dataset.k][inp.dataset.f] = inp.dataset.f === 'dp' ? Math.max(0, v) : v;
          compute();
        })
      );
    }

    function compute() {
      const n = data.length;
      const avgDp = data.reduce((t, d) => t + d.dp, 0) / n;
      const avgSq = data.reduce((t, d) => t + Math.sqrt(d.dp), 0) / n;
      const sqAvg = Math.sqrt(avgDp);
      const avgTs = data.reduce((t, d) => t + d.ts, 0) / n;
      data.forEach((d, k) => { const c = $('#tv-sq-' + k); if (c) c.textContent = fmt(Math.sqrt(d.dp), 3); });
      $('#tv-f-dp').textContent = fmt(avgDp, 3);
      $('#tv-f-sq').textContent = fmt(avgSq, 3);
      $('#tv-f-ts').textContent = fmt(avgTs, 0);

      const tsR = avgTs + 460;
      const ps = stackPressure(COND.pbar, COND.pg);
      const ms = wetMW(COND.md, COND.bws);
      const vs = velocity(COND.cp, avgSq, tsR, ps, ms);
      const q = flowStd(COND.bws, vs, areaFt2(COND.D), tsR, ps) / 60;
      const bias = avgSq > 0 ? (sqAvg / avgSq - 1) * 100 : NaN;
      $('#tv-avgsq').textContent = fmt(avgSq, 3);
      $('#tv-sqavg').textContent = fmt(sqAvg, 3);
      $('#tv-bias').innerHTML = `+${fmt(bias, 1)}<span class="readout-unit">%</span>`;
      $('#tv-vs').innerHTML = `${fmt(vs, 1)}<span class="readout-unit">ft/s</span>`;
      $('#tv-q').innerHTML = `${big(q)}<span class="readout-unit">dscfm</span>`;
      const qWrong = q * (sqAvg / avgSq);
      $('#tv-note').innerHTML = `Averaging Δp first would report <strong>${big(qWrong)} dscfm</strong> instead of <strong>${big(q)} dscfm</strong>, and every pounds-per-hour result calculated from it would be ${fmt(bias, 1)}% high too.`;
      drawChart(avgDp, avgSq * avgSq);
    }

    function drawChart(avgDp, eqDp) {
      svg.innerHTML = '';
      const x0 = 52, x1 = 624, y0 = 18, y1 = 280;
      const maxDp = Math.max(...data.map((d) => d.dp), 0.01);
      const top = Math.max(1, Math.ceil((maxDp * 1.15) / 0.25) * 0.25);
      const Y = (v) => y1 - (v / top) * (y1 - y0);
      const slot = (x1 - x0) / data.length;
      for (let v = 0; v <= top + 1e-9; v += top > 2 ? 0.5 : 0.25) {
        el('line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), class: 'dg-rule', opacity: v === 0 ? 1 : 0.45 }, svg);
        el('text', { x: x0 - 8, y: Y(v) + 4, class: 'dg-label', 'text-anchor': 'end', text: fmt(v, 2) }, svg);
      }
      el('text', { x: 14, y: (y0 + y1) / 2, class: 'dg-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(y0 + y1) / 2})`, text: 'Δp, in. H₂O' }, svg);
      data.forEach((d, k) => {
        const cx = x0 + slot * (k + 0.5);
        el('rect', { x: cx - slot * 0.32, y: Y(d.dp), width: slot * 0.64, height: Math.max(0, y1 - Y(d.dp)), rx: 2, style: 'fill:var(--gauge);opacity:0.55' }, svg);
        el('text', { x: cx, y: y1 + 18, class: 'dg-label', 'text-anchor': 'middle', text: d.label }, svg);
      });
      el('line', { x1: x0 + slot * 6, x2: x0 + slot * 6, y1: y0, y2: y1 + 22, class: 'dg-rule', 'stroke-dasharray': '3 3' }, svg);
      el('text', { x: x0 + slot * 3, y: y1 + 40, class: 'dg-label', 'text-anchor': 'middle', text: 'Port A' }, svg);
      el('text', { x: x0 + slot * 9, y: y1 + 40, class: 'dg-label', 'text-anchor': 'middle', text: 'Port B' }, svg);
      // average Δp (wrong basis) above, (average √Δp)² (correct basis) below
      el('line', { x1: x0, x2: x1, y1: Y(avgDp), y2: Y(avgDp), style: 'stroke:var(--gauge);stroke-width:2', 'stroke-dasharray': '6 4' }, svg);
      el('line', { x1: x0, x2: x1, y1: Y(eqDp), y2: Y(eqDp), style: 'stroke:var(--ink);stroke-width:2' }, svg);
      const tag = (y, text, cls, dy) => {
        const g = el('g', {}, svg);
        const w = text.length * 6.7 + 12;
        el('rect', { x: x1 - w, y: y + dy - 13, width: w, height: 18, rx: 3, class: 'dg-panel', opacity: 0.92 }, g);
        el('text', { x: x1 - 6, y: y + dy, class: cls, 'text-anchor': 'end', text }, g);
      };
      tag(Y(avgDp), `average Δp = ${fmt(avgDp, 3)}`, 'dg-label-strong', -6);
      tag(Y(eqDp), `(average √Δp)² = ${fmt(eqDp, 3)}`, 'dg-label-strong', 18);
    }

    ST.seg('tv-prof', (v) => { profile = v; generate(); });
    $('#tv-regen').addEventListener('click', () => { seed = (Math.random() * 1e9) | 0; generate(); });
    generate();
  })();
})();
