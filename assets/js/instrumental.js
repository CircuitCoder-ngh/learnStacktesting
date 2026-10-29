/* Instrumental analyzer methods (3A, 6C, 7E, 10, 25A) — interactive benches. */
(function () {
  'use strict';
  const { $, $$, svg: el, fmt, clamp } = ST;

  /** Within limit as % of span, or within 0.5 ppmv absolute (Method 7E alternative). */
  const passes = (diffPpm, pct, limit) => Math.abs(pct) <= limit + 1e-9 || Math.abs(diffPpm) <= 0.5 + 1e-9;
  const statusTag = (ok, yes = 'Pass', no = 'Fail') => `<span class="status ${ok ? 'pass' : 'fail'}">${ok ? yes : no}</span>`;
  const signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);

  /* =========================================================
     Bench 1: sampling system and calibration paths
     ========================================================= */
  (function systemBench() {
    const svg = $('#sys-svg');
    if (!svg) return;
    const defs = el('defs', {}, svg);
    const mk = el('marker', { id: 'ins-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--ink-3)' }, mk);
    const mkc = el('marker', { id: 'ins-arr-cal', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--caution)' }, mkc);

    const Y = 120;
    // Stack
    el('rect', { x: 20, y: 0, width: 70, height: 330, class: 'dg-panel' }, svg);
    el('path', { d: 'M20,0 L20,330 M90,0 L90,330', class: 'dg-ink', 'stroke-width': 3 }, svg);
    [[42, 300, 250], [68, 230, 180], [42, 90, 40]].forEach(([x, y1, y2]) =>
      el('line', { x1: x, x2: x, y1, y2, style: 'stroke:var(--gas);opacity:.45', 'stroke-width': 2, 'marker-end': 'url(#ins-arr)' }, svg));
    el('text', { x: 55, y: 322, class: 'dg-label', 'text-anchor': 'middle', text: 'Stack' }, svg);

    // Components
    const box = (x, y, w, h, label, sub, lx, ly) => {
      const r = el('rect', { x, y, width: w, height: h, rx: 6, class: 'ins-box' }, svg);
      el('text', { x: lx ?? x + w / 2, y: ly ?? y - 10, class: 'dg-label-strong', 'text-anchor': 'middle', text: label }, svg);
      if (sub) el('text', { x: lx ?? x + w / 2, y: (ly ?? y - 10) + 15, class: 'dg-label', 'text-anchor': 'middle', text: sub }, svg);
      return r;
    };
    // Pipes (static)
    const pipes = [
      `M34,${Y} L150,${Y}`, `M206,${Y} L330,${Y}`, `M420,${Y} L476,${Y}`, `M524,${Y} L560,${Y}`,
    ];
    el('path', { d: `M206,${Y} L330,${Y}`, class: 'ins-heat' }, svg);
    pipes.forEach((d) => el('path', { d, class: 'ins-pipe' }, svg));
    el('rect', { x: 34, y: Y - 5, width: 116, height: 10, rx: 2, style: 'fill:var(--steel)' }, svg);
    el('text', { x: 268, y: Y - 28, class: 'dg-label-strong', 'text-anchor': 'middle', text: 'Heated line' }, svg);
    el('text', { x: 268, y: Y - 13, class: 'dg-label', 'text-anchor': 'middle', text: 'above dew point' }, svg);
    const filter = box(150, Y - 22, 56, 44, 'Heated', 'filter', 178, Y + 42);
    const cond = box(330, Y - 30, 90, 60, 'Gas conditioner', 'removes water', 375, Y - 52);
    el('path', { d: `M375,${Y + 30} L375,${Y + 58}`, style: 'stroke:var(--water)', 'stroke-width': 2.5 }, svg);
    el('path', { d: `M375,${Y + 62} q-6,10 0,14 q6,-4 0,-14`, style: 'fill:var(--water)' }, svg);
    el('text', { x: 375, y: Y + 96, class: 'dg-label', 'text-anchor': 'middle', text: 'Condensate out' }, svg);
    const pump = el('circle', { cx: 500, cy: Y, r: 24, class: 'ins-box' }, svg);
    el('path', { d: `M490,${Y + 10} L500,${Y - 12} L510,${Y + 10}`, style: 'fill:none;stroke:var(--ink);stroke-width:1.8' }, svg);
    el('text', { x: 500, y: Y + 44, class: 'dg-label-strong', 'text-anchor': 'middle', text: 'Pump' }, svg);
    const manifold = el('rect', { x: 560, y: 40, width: 46, height: 160, rx: 6, class: 'ins-box' }, svg);
    el('text', { x: 553, y: 196, class: 'dg-label-strong', 'text-anchor': 'end', text: 'Manifold' }, svg);
    el('line', { x1: 583, x2: 583, y1: 40, y2: 12, style: 'stroke:var(--ink-3)', 'stroke-width': 2, 'marker-end': 'url(#ins-arr)' }, svg);
    el('text', { x: 596, y: 18, class: 'dg-label', text: 'Excess vents' }, svg);

    const analyzers = [
      ['O₂', 'paramagnetic'], ['CO₂', 'NDIR'], ['NOₓ', 'chemiluminescence'], ['CO', 'NDIR / GFC'],
    ];
    const anBoxes = [];
    const branchD = [];
    analyzers.forEach(([name, how], i) => {
      const y = 34 + i * 46;
      branchD.push(`M606,${y + 19} L680,${y + 19}`);
      el('path', { d: branchD[i], class: 'ins-pipe-thin' }, svg);
      anBoxes.push(el('rect', { x: 680, y, width: 166, height: 38, rx: 6, class: 'ins-box' }, svg));
      el('text', { x: 692, y: y + 24, class: 'dg-label-strong', text: name }, svg);
      el('text', { x: 730, y: y + 24, class: 'dg-label', text: how }, svg);
      el('path', { d: `M846,${y + 19} C866,${y + 19} 862,130 880,130`, class: 'ins-signal' }, svg);
    });
    const das = el('rect', { x: 880, y: 96, width: 100, height: 72, rx: 6, class: 'ins-box' }, svg);
    for (let k = 0; k < 3; k++) el('line', { x1: 893, x2: 966 - k * 18, y1: 116 + k * 14, y2: 116 + k * 14, style: 'stroke:var(--gas)', 'stroke-width': 2, opacity: 0.7 }, svg);
    el('text', { x: 930, y: 188, class: 'dg-label-strong', 'text-anchor': 'middle', text: 'Data system' }, svg);

    // Calibration gases
    const cylX = [790, 828, 866];
    ['Zero', 'Mid', 'High'].forEach((lab, i) => {
      el('rect', { x: cylX[i] - 12, y: 244, width: 24, height: 58, rx: 10, style: 'fill:var(--caution-soft);stroke:var(--caution-ink);stroke-width:1.5' }, svg);
      el('line', { x1: cylX[i], x2: cylX[i], y1: 244, y2: 232, style: 'stroke:var(--caution-ink)', 'stroke-width': 2 }, svg);
      el('text', { x: cylX[i], y: 320, class: 'dg-label', 'text-anchor': 'middle', text: lab }, svg);
    });
    el('path', { d: 'M866,232 L740,232', class: 'ins-pipe-thin' }, svg);
    el('path', { d: 'M722,224 L738,240 L738,224 L722,240 Z', style: 'fill:var(--panel);stroke:var(--ink);stroke-width:1.5' }, svg);
    el('text', { x: 828, y: 222, class: 'dg-label', 'text-anchor': 'middle', text: 'EPA Protocol gases' }, svg);
    const directD = 'M722,232 L596,232 L596,200';
    const systemD = 'M730,240 L730,312 L120,312 L120,126';
    el('path', { d: directD, class: 'ins-pipe-thin' }, svg);
    el('path', { d: systemD, class: 'ins-pipe-thin' }, svg);
    el('circle', { cx: 120, cy: Y, r: 5, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:1.5' }, svg);
    el('text', { x: 660, y: 250, class: 'dg-label', 'text-anchor': 'middle', text: 'Direct line' }, svg);
    el('text', { x: 440, y: 304, class: 'dg-label', 'text-anchor': 'middle', text: 'Calibration line up to the probe' }, svg);

    // Animated flow overlays
    const flow = (d, cls) => el('path', { d, class: 'ins-flow ' + cls }, svg);
    const sampleIn = flow(`M34,${Y} L150,${Y}`, 'is-gas');
    const samplePath = [`M150,${Y} L206,${Y}`, ...pipes.slice(1), `M560,${Y} L583,${Y} L583,60 L583,180`];
    const sampleFlows = samplePath.map((d) => flow(d, 'is-gas'));
    const sampleBranches = branchD.map((d) => flow(d, 'is-gas'));
    const calFromTee = [`M120,${Y} L150,${Y}`, ...samplePath].map((d) => flow(d, 'is-cal'));
    const calBranches = branchD.map((d) => flow(d, 'is-cal'));
    const directFlow = [flow(directD, 'is-cal'), flow('M596,200 L596,60', 'is-cal')];
    const systemFlow = flow(systemD, 'is-cal');
    const vents = el('g', { opacity: 0 }, svg);
    [[106, Y - 8], [106, Y + 8]].forEach(([x, y]) =>
      el('line', { x1: x, x2: x - 50, y1: y, y2: y + (y < Y ? -14 : 14), style: 'stroke:var(--caution)', 'stroke-width': 2, 'marker-end': 'url(#ins-arr-cal)' }, vents));

    const TEXT = {
      sample: '<p class="ins-mode-text"><strong>Sampling stack gas</strong>The pump draws gas through the probe and heated filter. It stays hot in the heated line, drops its water in the conditioner, and reaches the analyzers dry. The data system logs each analyzer every few seconds.</p>',
      direct: '<p class="ins-mode-text"><strong>Direct calibration: the analyzer calibration error test</strong>Calibration gas goes straight to the analyzers, skipping the probe, filter, line and conditioner. Zero, mid and high gases are each compared with their certified values. This proves the analyzer itself is accurate across its range.</p>',
      system: '<p class="ins-mode-text"><strong>System calibration: the bias check</strong>Calibration gas travels up to the probe and enters upstream of the filter, slightly faster than the pump draws, so the excess spills into the stack. It then follows the sample path. Any difference from the direct response comes from the system: leaks, absorption on the filter, or losses in the conditioner.</p>',
    };
    let mode = 'sample';
    function setMode(m) {
      mode = m;
      const on = (list, v) => list.forEach((p) => p.classList.toggle('is-on', v));
      on([sampleIn, ...sampleFlows, ...sampleBranches], m === 'sample');
      on(directFlow, m === 'direct');
      on([systemFlow, ...calFromTee], m === 'system');
      on(calBranches, m !== 'sample');
      vents.setAttribute('opacity', m === 'system' ? 1 : 0);
      anBoxes.forEach((b) => b.classList.add('is-lit'));
      [filter, cond, pump, manifold, das].forEach((b) => b.classList.toggle('is-lit', m !== 'direct'));
      manifold.classList.add('is-lit');
      $('#sys-text').innerHTML = TEXT[m];
    }
    const allFlows = $$('.ins-flow', svg);
    let off = 0;
    ST.loop(svg, (dt) => {
      off -= dt * 36;
      allFlows.forEach((p) => p.style.setProperty('stroke-dashoffset', off));
    }, { buttonHost: svg.parentElement });
    ST.seg('sys-mode', setMode);
    setMode(mode);
  })();

  /* =========================================================
     Bench 2: calibration error, system bias and drift
     ========================================================= */
  (function calBench() {
    const svg = $('#cal-svg');
    if (!svg) return;
    const ea = $('#cal-ea'), sb = $('#cal-sb'), dr = $('#cal-dr'), avg = $('#cal-avg');
    const spanSeg = ST.seg('cal-span', () => draw());
    const x0 = 90, x1 = 980, yTop = 40, yBot = 270, LIM = 8;
    const Yp = (p) => yTop + ((LIM - clamp(p, -LIM, LIM)) / (2 * LIM)) * (yBot - yTop);
    const GROUPS = [{ name: 'Zero gas', cx: 260 }, { name: 'Mid gas (upscale)', cx: 560 }, { name: 'High gas', cx: 860 }];
    const SUB = [-95, 0, 95];

    // Static axes
    const axes = el('g', {}, svg);
    [-8, -5, -2, 0, 2, 5, 8].forEach((p) => {
      el('line', { x1: x0, x2: x1, y1: Yp(p), y2: Yp(p), class: 'dg-rule', opacity: p === 0 ? 1 : 0.35, 'stroke-width': p === 0 ? 1.5 : 1 }, axes);
      el('text', { x: x0 - 10, y: Yp(p) + 4, class: 'dg-label', 'text-anchor': 'end', text: p === 0 ? '0' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%` }, axes);
    });
    el('text', { x: 0, y: 0, class: 'dg-label', 'text-anchor': 'middle', transform: `translate(24 ${(yTop + yBot) / 2}) rotate(-90)`, text: 'Error, % of calibration span' }, axes);
    GROUPS.forEach((g, gi) => {
      el('text', { x: g.cx, y: 20, class: 'dg-label-strong', 'text-anchor': 'middle', text: g.name }, axes);
      ['Direct', 'System, pre', 'System, post'].forEach((s, si) => {
        if (gi === 2 && si > 0) return;
        el('text', { x: g.cx + SUB[si], y: yBot + 22, class: 'dg-label', 'text-anchor': 'middle', text: s }, axes);
      });
      if (gi < 2) el('line', { x1: g.cx + 150, x2: g.cx + 150, y1: yTop - 10, y2: yBot + 30, class: 'dg-rule', opacity: 0.5 }, axes);
    });
    const dyn = el('g', {}, svg);

    function draw() {
      const CS = +spanSeg.value;
      const d = CS <= 10 ? 2 : 1;
      $('#cal-ea-out').textContent = `${signed(+ea.value)}% of span`;
      $('#cal-sb-out').textContent = `${signed(+sb.value)}% of span`;
      $('#cal-dr-out').textContent = `${signed(+dr.value)}% of span`;
      $('#cal-avg-out').textContent = `${avg.value}% of span`;
      const u = CS / 100;
      const Cv = [0, 0.5 * CS, CS];
      const Cdir = [Cv[0] + 0.15 * ea.value * u, Cv[1] + +ea.value * u, Cv[2] + 0.4 * ea.value * u];
      const pre = [Cdir[0] + 0.1 * sb.value * u, Cdir[1] + +sb.value * u];
      const post = [pre[0] + 0.3 * dr.value * u, pre[1] + +dr.value * u];
      const ace = Cv.map((v, i) => ((Cdir[i] - v) / CS) * 100);
      const sbPre = [0, 1].map((i) => ((pre[i] - Cdir[i]) / CS) * 100);
      const sbPost = [0, 1].map((i) => ((post[i] - Cdir[i]) / CS) * 100);
      const drift = [0, 1].map((i) => Math.abs(sbPost[i] - sbPre[i]));

      const okAce = ace.map((p, i) => passes(Cdir[i] - Cv[i], p, 2));
      const okPre = sbPre.map((p, i) => passes(pre[i] - Cdir[i], p, 5));
      const okPost = sbPost.map((p, i) => passes(post[i] - Cdir[i], p, 5));
      const okDrift = drift.map((p, i) => passes(post[i] - pre[i], p, 3));

      /* --- chart --- */
      dyn.innerHTML = '';
      const absPct = (0.5 / CS) * 100;
      const band = (cx, lim, cls) => {
        const h = Math.max(lim, absPct);
        el('rect', { x: cx - 34, y: Yp(h), width: 68, height: Yp(-h) - Yp(h), rx: 4, style: `fill:${cls}` }, dyn);
      };
      const dot = (cx, p, ok, color) => {
        const y = Yp(p);
        el('circle', { cx, cy: y, r: 7.5, style: `fill:${ok ? color : 'var(--gauge)'};stroke:var(--panel);stroke-width:2` }, dyn);
        if (Math.abs(p) > LIM) el('text', { x: cx + 12, y: y + 4, class: 'dg-label', text: 'off scale' }, dyn);
        el('text', { x: cx, y: y - 12, class: 'dg-label-strong', 'text-anchor': 'middle', text: `${signed(p, 1)}%` }, dyn);
      };
      GROUPS.forEach((g, gi) => {
        band(g.cx + SUB[0], 2, 'var(--caution-soft)');
        dot(g.cx + SUB[0], ace[gi], okAce[gi], 'var(--ink)');
        if (gi < 2) {
          band(g.cx + SUB[1], 5, 'var(--gas-soft)');
          band(g.cx + SUB[2], 5, 'var(--gas-soft)');
          el('line', { x1: g.cx + SUB[1], x2: g.cx + SUB[2], y1: Yp(sbPre[gi]), y2: Yp(sbPost[gi]), style: `stroke:${okDrift[gi] ? 'var(--ink-3)' : 'var(--gauge)'}`, 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }, dyn);
          el('text', { x: g.cx + (SUB[1] + SUB[2]) / 2, y: yBot - 8, class: 'dg-label', 'text-anchor': 'middle', text: `drift ${fmt(drift[gi], 1)}%` }, dyn);
          dot(g.cx + SUB[1], sbPre[gi], okPre[gi], 'var(--gas)');
          dot(g.cx + SUB[2], sbPost[gi], okPost[gi], 'var(--gas)');
        }
      });

      /* --- table --- */
      const ppm = (v) => fmt(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v, d);
      const row = (check, gas, ref, resp, pct, lim, ok) =>
        `<tr class="${ok ? '' : 'is-hi'}"><td>${check}</td><td>${gas}</td><td class="n">${ppm(ref)}</td><td class="n">${ppm(resp)}</td><td class="n">${signed(pct, 2)}%</td><td class="n">${lim}</td><td>${statusTag(ok)}</td></tr>`;
      $('#cal-table').innerHTML = `<thead><tr><th>Check</th><th>Gas</th><th class="n">Reference, ppm</th><th class="n">Response, ppm</th><th class="n">% of span</th><th class="n">Limit</th><th>Result</th></tr></thead><tbody>
        ${row('Calibration error', 'Zero', Cv[0], Cdir[0], ace[0], '±2.0%', okAce[0])}
        ${row('Calibration error', 'Mid', Cv[1], Cdir[1], ace[1], '±2.0%', okAce[1])}
        ${row('Calibration error', 'High', Cv[2], Cdir[2], ace[2], '±2.0%', okAce[2])}
        ${row('System bias, pre-run', 'Zero', Cdir[0], pre[0], sbPre[0], '±5.0%', okPre[0])}
        ${row('System bias, pre-run', 'Mid', Cdir[1], pre[1], sbPre[1], '±5.0%', okPre[1])}
        ${row('System bias, post-run', 'Zero', Cdir[0], post[0], sbPost[0], '±5.0%', okPost[0])}
        ${row('System bias, post-run', 'Mid', Cdir[1], post[1], sbPost[1], '±5.0%', okPost[1])}
        ${row('Drift', 'Zero', pre[0], post[0], drift[0], '3.0%', okDrift[0])}
        ${row('Drift', 'Mid', pre[1], post[1], drift[1], '3.0%', okDrift[1])}
      </tbody>`;

      /* --- bias-corrected result --- */
      const raw = (+avg.value / 100) * CS;
      const C0 = (pre[0] + post[0]) / 2, Cm = (pre[1] + post[1]) / 2;
      const corr = ((raw - C0) * Cv[1]) / (Cm - C0);
      $('#cal-raw').innerHTML = `${ppm(raw)}<span class="readout-unit">ppm</span>`;
      $('#cal-corr').innerHTML = `${ppm(corr)}<span class="readout-unit">ppm</span>`;

      const status = $('#cal-status');
      if (!okAce.every(Boolean)) status.innerHTML = `${statusTag(false, '', 'Calibration error fails')}<p class="ctl-help" style="margin-top:.5rem">Fix or recalibrate the analyzer before testing. No run can start until all three gases pass.</p>`;
      else if (!okPost.every(Boolean) || !okPre.every(Boolean)) status.innerHTML = `${statusTag(false, '', 'System bias fails')}<p class="ctl-help" style="margin-top:.5rem">${okPre.every(Boolean) ? 'A failed post-run bias check invalidates this run. Find the leak or loss, recalibrate, and repeat the run.' : 'Find the leak or loss before starting the run.'}</p>`;
      else if (!okDrift.every(Boolean)) status.innerHTML = `${statusTag(false, '', 'Drift fails')}<p class="ctl-help" style="margin-top:.5rem">Recalibrate before the next run.</p>`;
      else status.innerHTML = `${statusTag(true, 'All checks pass: report the bias-corrected value')}`;
    }
    [ea, sb, dr, avg].forEach((i) => i.addEventListener('input', draw));
    draw();
  })();

  /* =========================================================
     Bench 3: stratification test
     ========================================================= */
  (function stratBench() {
    const svg = $('#strat-svg');
    if (!svg) return;
    const FR = [0.044, 0.146, 0.296, 0.704, 0.854, 0.956];
    const NOISE = [0.6, -0.9, 0.3, -0.4, 0.9, -0.2, -0.7, 0.4, 0.8, -0.6, 0.1, -0.3];
    const pts = [];
    for (let p = 0; p < 2; p++) FR.forEach((f, i) => pts.push({ x: p === 0 ? 1 - 2 * f : 0, y: p === 0 ? 0 : 1 - 2 * f, label: `${'AB'[p]}${i + 1}` }));
    const amt = $('#st-amt');
    const gasSeg = ST.seg('st-gas', () => draw());
    const patSeg = ST.seg('st-pattern', () => draw());

    const PX = 165, PY = 160, PR = 122;
    const bx0 = 400, bx1 = 975, byT = 30, byB = 262;
    const dyn = el('g', {}, svg);

    function draw() {
      const gas = gasSeg.value, pat = patSeg.value, s = +amt.value;
      $('#st-amt-out').textContent = `up to ±${fmt(s, 1)}%`;
      const mean0 = gas === 'nox' ? 40 : 5.0;
      const unit = gas === 'nox' ? 'ppm' : '% O₂';
      const abs1 = gas === 'nox' ? 0.5 : 0.3, abs2 = gas === 'nox' ? 1.0 : 0.5;
      let g = pts.map((p, i) => (pat === 'side' ? 0.85 * p.x + 0.35 * p.y : 1.5 * (0.55 - (p.x * p.x + p.y * p.y))) + 0.15 * NOISE[i]);
      const gm = g.reduce((a, b) => a + b, 0) / g.length;
      g = g.map((v) => v - gm);
      const gmax = Math.max(...g.map(Math.abs));
      const C = g.map((v) => mean0 * (1 + (s / 100) * (v / gmax)));
      const mean = C.reduce((a, b) => a + b, 0) / C.length;
      const dev = C.map((c) => c - mean);
      const rel = dev.map((d) => (d / mean) * 100);
      const ok1 = dev.every((d, i) => Math.abs(rel[i]) <= 5 + 1e-9 || Math.abs(d) <= abs1 + 1e-9);
      const ok3 = dev.every((d, i) => Math.abs(rel[i]) <= 10 + 1e-9 || Math.abs(d) <= abs2 + 1e-9);
      const band1 = Math.max(5, (abs1 / mean) * 100), band2 = Math.max(10, (abs2 / mean) * 100);
      const maxRel = Math.max(...rel.map(Math.abs));
      const yMax = Math.min(40, Math.max(15, Math.ceil((Math.max(maxRel, band2) + 3) / 5) * 5));
      const Yb = (r) => byT + ((yMax - clamp(r, -yMax, yMax)) / (2 * yMax)) * (byB - byT);
      const d = gas === 'nox' ? 1 : 2;

      dyn.innerHTML = '';
      /* plan view */
      el('circle', { cx: PX, cy: PY, r: PR, class: 'dg-panel' }, dyn);
      el('line', { x1: PX - PR, x2: PX + PR, y1: PY, y2: PY, class: 'dg-rule', 'stroke-dasharray': '2 4' }, dyn);
      el('line', { x1: PX, x2: PX, y1: PY - PR, y2: PY + PR, class: 'dg-rule', 'stroke-dasharray': '2 4' }, dyn);
      el('circle', { cx: PX, cy: PY, r: PR, class: 'dg-ink', 'stroke-width': 2.5 }, dyn);
      el('rect', { x: PX + PR, y: PY - 6, width: 14, height: 12, style: 'fill:var(--steel)' }, dyn);
      el('rect', { x: PX - 6, y: PY + PR, width: 12, height: 14, style: 'fill:var(--steel)' }, dyn);
      el('text', { x: PX + PR + 20, y: PY + 5, class: 'dg-label-strong', text: 'A' }, dyn);
      el('text', { x: PX + 12, y: PY + PR + 18, class: 'dg-label-strong', text: 'B' }, dyn);
      if (!ok1 && ok3) {
        [1 / 6, 0.5, 5 / 6].forEach((f) => {
          const x = PX + PR - f * 2 * PR;
          el('rect', { x: x - 11, y: PY - 11, width: 22, height: 22, rx: 4, style: 'fill:none;stroke:var(--caution);stroke-width:2.5' }, dyn);
        });
      }
      if (ok1) el('circle', { cx: PX, cy: PY, r: 11, style: 'fill:none;stroke:var(--gas);stroke-width:2.5' }, dyn);
      pts.forEach((p, i) => {
        const pct = clamp((Math.abs(rel[i]) / 12) * 70, 0, 75);
        const col = rel[i] >= 0 ? 'var(--gauge)' : 'var(--water)';
        el('circle', { cx: PX + p.x * PR, cy: PY + p.y * PR, r: 7, style: `fill:color-mix(in srgb, ${col} ${pct + 20}%, var(--panel));stroke:var(--ink);stroke-width:1` }, dyn);
      });
      el('text', { x: PX, y: 312, class: 'dg-label', 'text-anchor': 'middle', text: 'Red: above the mean. Blue: below.' }, dyn);

      /* deviation chart */
      el('rect', { x: bx0, y: Yb(band2), width: bx1 - bx0, height: Yb(-band2) - Yb(band2), style: 'fill:var(--caution-soft)' }, dyn);
      el('rect', { x: bx0, y: Yb(band1), width: bx1 - bx0, height: Yb(-band1) - Yb(band1), style: 'fill:var(--gas-soft)' }, dyn);
      el('line', { x1: bx0, x2: bx1, y1: Yb(0), y2: Yb(0), class: 'dg-ink', 'stroke-width': 1.2 }, dyn);
      [band1, band2].forEach((b) => [b, -b].forEach((v) => el('text', { x: bx0 - 8, y: Yb(v) + 4, class: 'dg-label', 'text-anchor': 'end', text: `${v > 0 ? '+' : '−'}${fmt(Math.abs(v), Math.abs(v) % 1 ? 1 : 0)}%` }, dyn)));
      const bw = (bx1 - bx0) / 12;
      rel.forEach((r, i) => {
        const x = bx0 + i * bw + bw * 0.2, w = bw * 0.6;
        const inside1 = Math.abs(r) <= band1 + 1e-9, inside2 = Math.abs(r) <= band2 + 1e-9;
        const col = inside1 ? 'var(--gas)' : inside2 ? 'var(--caution)' : 'var(--gauge)';
        const y0 = Yb(0), y = Yb(r);
        el('rect', { x, y: Math.min(y0, y), width: w, height: Math.max(1, Math.abs(y - y0)), rx: 2, style: `fill:${col}` }, dyn);
        el('text', { x: x + w / 2, y: byB + 20, class: 'dg-label', 'text-anchor': 'middle', text: pts[i].label }, dyn);
        el('text', { x: x + w / 2, y: r >= 0 ? y - 6 : y + 15, class: 'dg-label', 'text-anchor': 'middle', style: 'font-size:11px', text: fmt(C[i], d) }, dyn);
      });
      el('text', { x: (bx0 + bx1) / 2, y: byB + 44, class: 'dg-label', 'text-anchor': 'middle', text: `Each point's deviation from the mean (bar labels in ${unit})` }, dyn);

      $('#st-mean').innerHTML = `${fmt(mean, d)}<span class="readout-unit">${unit}</span>`;
      const worst = rel.reduce((m, r, i) => (Math.abs(r) > Math.abs(rel[m]) ? i : m), 0);
      $('#st-max').innerHTML = `${signed(rel[worst], 1)}<span class="readout-unit">% (${signed(dev[worst], d)} ${unit})</span>`;
      $('#st-status').innerHTML = ok1
        ? `<span class="status pass">Not stratified: sample at a single point</span>`
        : ok3
          ? `<span class="status warn">Minimally stratified: sample 3 points on one line</span>`
          : `<span class="status fail">Stratified: sample every traverse point</span>`;
    }
    amt.addEventListener('input', draw);
    draw();
  })();

  /* =========================================================
     Bench 4: unit converter
     ========================================================= */
  (function converter() {
    const ids = ['cv-pol', 'cv-c', 'cv-o2', 'cv-q', 'cv-fuel'];
    if (!$('#cv-c')) return;
    const refSeg = ST.seg('cv-ref', () => calc());
    function calc() {
      const MW = +$('#cv-pol').value, C = +$('#cv-c').value, O2 = +$('#cv-o2').value, Q = +$('#cv-q').value, Fd = +$('#cv-fuel').value;
      const X = +refSeg.value;
      const lbdscf = (C * MW) / 385.3e6;
      const lbhr = lbdscf * Q * 60;
      const valid = O2 < 20.9 && O2 >= 0;
      const corr = valid ? (C * (20.9 - X)) / (20.9 - O2) : NaN;
      const mmbtu = valid ? (lbdscf * Fd * 20.9) / (20.9 - O2) : NaN;
      $('#cv-lbhr').innerHTML = `${fmt(lbhr, 2)}<span class="readout-unit">lb/hr</span>`;
      $('#cv-ref-label').textContent = `At ${X}% O₂`;
      $('#cv-corr').innerHTML = `${fmt(corr, 1)}<span class="readout-unit">ppmvd</span>`;
      $('#cv-mmbtu').innerHTML = `${fmt(mmbtu, 4)}<span class="readout-unit">lb/MMBtu</span>`;
      const work = $('#cv-work');
      work.innerHTML = '<div></div><div></div><div></div>';
      const [a, b, c] = work.children;
      ST.tex(a, `C = \\frac{${fmt(C, 1)}\\times ${MW}}{385.3\\times10^{6}} = ${(lbdscf * 1e6).toFixed(3)}\\times10^{-6}\\ \\text{lb/dscf}`);
      ST.tex(b, `E = ${(lbdscf * 1e6).toFixed(3)}\\times10^{-6}\\times ${fmt(Q, 0).replace(/,/g, '{,}')}\\times 60 = ${fmt(lbhr, 2)}\\ \\text{lb/hr}`);
      ST.tex(c, valid
        ? `E = ${(lbdscf * 1e6).toFixed(3)}\\times10^{-6}\\times ${fmt(Fd, 0).replace(/,/g, '{,}')}\\times\\frac{20.9}{20.9-${fmt(O2, 1)}} = ${fmt(mmbtu, 4)}\\ \\text{lb/MMBtu}`
        : '\\text{O}_2\\text{ must be below 20.9\\%}');
    }
    ids.forEach((id) => $('#' + id).addEventListener('input', calc));
    calc();
  })();

  /* =========================================================
     Bench 5: RATA calculator
     ========================================================= */
  (function rataBench() {
    const svg = $('#rata-svg');
    if (!svg) return;
    const T = { 9: 2.306, 10: 2.262, 11: 2.228, 12: 2.201 };
    const runs = [
      [41.2, 42.0], [43.8, 44.3], [40.5, 41.9], [42.9, 43.5], [44.1, 44.6], [39.8, 41.2],
      [42.3, 42.8], [43.0, 43.9], [41.7, 42.1], [40.9, 41.6], [42.6, 46.8], [43.4, 44.0],
    ].map(([rm, cems]) => ({ rm, cems, use: true }));
    const nSeg = ST.seg('rata-n', () => { build(); calc(); });
    const table = $('#rata-table');

    function build() {
      const n = +nSeg.value;
      table.innerHTML = `<thead><tr><th class="n">Run</th><th class="n">Reference method, ppm</th><th class="n">CEMS, ppm</th><th class="n">Difference</th><th>Use</th></tr></thead><tbody>${runs
        .slice(0, n)
        .map((r, i) => `<tr data-i="${i}"><td class="n">${i + 1}</td>
          <td class="n"><input class="field" type="number" step="0.1" data-k="rm" value="${r.rm}" aria-label="Run ${i + 1} reference method"></td>
          <td class="n"><input class="field" type="number" step="0.1" data-k="cems" value="${r.cems}" aria-label="Run ${i + 1} CEMS"></td>
          <td class="n" data-diff></td>
          <td><input type="checkbox" data-k="use" ${r.use ? 'checked' : ''} aria-label="Use run ${i + 1}"></td></tr>`)
        .join('')}</tbody>`;
      $$('input', table).forEach((inp) =>
        inp.addEventListener('input', () => {
          const r = runs[+inp.closest('tr').dataset.i];
          if (inp.dataset.k === 'use') r.use = inp.checked;
          else r[inp.dataset.k] = parseFloat(inp.value);
          calc();
        }));
    }

    function calc() {
      const n = +nSeg.value;
      const rows = runs.slice(0, n);
      $$('tbody tr', table).forEach((tr, i) => {
        const r = rows[i];
        tr.classList.toggle('is-off', !r.use);
        tr.querySelector('[data-diff]').textContent = signed(r.rm - r.cems, 1);
      });
      const used = rows.filter((r) => r.use && Number.isFinite(r.rm) && Number.isFinite(r.cems));
      const dropped = n - rows.filter((r) => r.use).length;
      const k = used.length;
      const status = $('#rata-status');
      drawChart(rows);
      if (k < 9 || dropped > 3) {
        ['#rata-d', '#rata-cc', '#rata-ra'].forEach((id) => ($(id).textContent = '—'));
        status.innerHTML = `<span class="status fail">${k < 9 ? 'At least 9 runs must be used' : 'No more than 3 runs may be dropped'}</span>`;
        $('#rata-help').textContent = '';
        return;
      }
      const d = used.map((r) => r.rm - r.cems);
      const dbar = d.reduce((a, b) => a + b, 0) / k;
      const sd = Math.sqrt(d.reduce((a, b) => a + (b - dbar) ** 2, 0) / (k - 1));
      const cc = (T[k] * sd) / Math.sqrt(k);
      const rmbar = used.reduce((a, r) => a + r.rm, 0) / k;
      const ra = ((Math.abs(dbar) + Math.abs(cc)) / rmbar) * 100;
      $('#rata-d').innerHTML = `${signed(dbar, 2)}<span class="readout-unit">ppm</span>`;
      $('#rata-cc').innerHTML = `${fmt(cc, 2)}<span class="readout-unit">ppm</span>`;
      $('#rata-ra').innerHTML = `${fmt(ra, 1)}<span class="readout-unit">%</span>`;
      status.innerHTML = ra <= 20 ? `<span class="status pass">RA ${fmt(ra, 1)}% is within 20%</span>` : `<span class="status fail">RA ${fmt(ra, 1)}% exceeds 20%</span>`;
      $('#rata-help').textContent = `n = ${k}, t = ${T[k]}, Sd = ${fmt(sd, 3)} ppm, mean reference value ${fmt(rmbar, 2)} ppm.` +
        (n >= 11 && runs[10].use ? ' Run 11 looks out of family: try unchecking it and see how much the confidence coefficient shrinks.' : '');
    }

    function drawChart(rows) {
      svg.innerHTML = '';
      const x0 = 56, x1 = 540, yT = 24, yB = 300;
      const vals = rows.flatMap((r) => [r.rm, r.cems]).filter(Number.isFinite);
      const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
      const Yv = (v) => yB - ((v - lo) / (hi - lo)) * (yB - yT);
      const step = (x1 - x0) / rows.length;
      for (let v = lo; v <= hi; v += Math.max(1, Math.round((hi - lo) / 6))) {
        el('line', { x1: x0, x2: x1, y1: Yv(v), y2: Yv(v), class: 'dg-rule', opacity: 0.4 }, svg);
        el('text', { x: x0 - 8, y: Yv(v) + 4, class: 'dg-label', 'text-anchor': 'end', text: v }, svg);
      }
      rows.forEach((r, i) => {
        const x = x0 + step * (i + 0.5);
        const g = el('g', { opacity: r.use ? 1 : 0.3 }, svg);
        if (Number.isFinite(r.rm) && Number.isFinite(r.cems)) el('line', { x1: x, x2: x, y1: Yv(r.rm), y2: Yv(r.cems), class: 'dg-ink', 'stroke-width': 2 }, g);
        if (Number.isFinite(r.rm)) el('circle', { cx: x, cy: Yv(r.rm), r: 6, style: 'fill:var(--ink)' }, g);
        if (Number.isFinite(r.cems)) el('circle', { cx: x, cy: Yv(r.cems), r: 6, style: 'fill:var(--gas);stroke:var(--panel);stroke-width:1.5' }, g);
        el('text', { x, y: yB + 20, class: 'dg-label', 'text-anchor': 'middle', text: i + 1 }, svg);
      });
      el('text', { x: (x0 + x1) / 2, y: yB + 42, class: 'dg-label', 'text-anchor': 'middle', text: 'Run' }, svg);
      el('circle', { cx: x0 + 8, cy: 12, r: 5, style: 'fill:var(--ink)' }, svg);
      el('text', { x: x0 + 18, y: 16, class: 'dg-label', text: 'Reference method' }, svg);
      el('circle', { cx: x0 + 150, cy: 12, r: 5, style: 'fill:var(--gas)' }, svg);
      el('text', { x: x0 + 160, y: 16, class: 'dg-label', text: 'CEMS' }, svg);
      el('text', { x: 0, y: 0, class: 'dg-label', 'text-anchor': 'middle', transform: `translate(16 ${(yT + yB) / 2}) rotate(-90)`, text: 'NOₓ, ppm' }, svg);
    }

    build();
    calc();
  })();
})();
