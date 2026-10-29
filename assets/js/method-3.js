/* Method 3: gas composition — interactive benches. */
(function () {
  'use strict';
  const { $, svg: el, fmt, clamp } = ST;

  /* ---------- Method 3 equations ---------- */
  function dryMW(co2, o2, co = 0) {
    const n2 = 100 - co2 - o2 - co;
    return 0.44 * co2 + 0.32 * o2 + 0.28 * (n2 + co);
  }
  const wetMW = (md, bws) => md * (1 - bws) + 18.0 * bws;
  function excessAir(co2, o2, co = 0) {
    const n2 = 100 - co2 - o2 - co;
    const num = o2 - 0.5 * co;
    const den = 0.264 * n2 - num;
    return den > 0.05 && o2 < 20.5 ? (100 * num) / den : NaN;
  }
  // Fo = 0.209·Fd/Fc from EPA Method 19 F-factors (dscf/MMBtu and scf CO2/MMBtu)
  const FUELS = [
    { name: 'natural gas', fo: (0.209 * 8710) / 1040 },
    { name: 'fuel oil', fo: (0.209 * 9190) / 1420 },
    { name: 'bituminous coal', fo: (0.209 * 9780) / 1800 },
  ];
  const n = (x, k) => fmt(x, k).replace(/,/g, '{,}');

  /** Small tween helper: fn(t) with t in 0..1, then done(). Instant under reduced motion. */
  function tween(dur, fn, done) {
    if (ST.reducedMotion) { fn(1); if (done) done(); return; }
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / (dur * 1000));
      fn(ST.ease(t));
      if (t < 1) requestAnimationFrame(frame);
      else if (done) done();
    };
    requestAnimationFrame(frame);
  }

  const GAS = {
    co2: { label: 'CO₂', fill: 'var(--gas)', text: 'var(--paper)' },
    o2: { label: 'O₂', fill: 'var(--water)', text: 'var(--paper)' },
    co: { label: 'CO', fill: 'var(--caution)', text: '#14232C' },
    n2: { label: 'N₂', fill: 'var(--steel)', text: '#14232C' },
  };

  /* =========================================================
     Bench 1: composition mixer
     ========================================================= */
  (function mixerBench() {
    const svg = $('#m3-mix-svg');
    if (!svg) return;
    const PRESETS = {
      air: { co2: 0, o2: 20.9, co: 0, bws: 1.5 },
      ng: { co2: 10.2, o2: 3.0, co: 0, bws: 17 },
      coal: { co2: 13.1, o2: 6.0, co: 0, bws: 8 },
      turbine: { co2: 3.4, o2: 15.0, co: 0, bws: 8 },
    };
    const inputs = { co2: $('#mx-co2'), o2: $('#mx-o2'), co: $('#mx-co'), bws: $('#mx-bws') };
    const X0 = 60, X1 = 960;
    let fromPreset = false;

    function segBar(y, h, parts, total, scale) {
      let x = X0;
      parts.forEach((p) => {
        const w = p.value * scale;
        if (w <= 0.2) return;
        el('rect', { x, y, width: w, height: h, style: `fill:${GAS[p.key].fill}` }, svg);
        if (w > 64) {
          el('text', { x: x + 8, y: y + h / 2 + 5, class: 'dg-label-strong', style: `fill:${GAS[p.key].text}`, text: p.text }, svg);
        } else if (w > 22) {
          el('text', { x: x + w / 2, y: y + h / 2 + 5, class: 'dg-label-strong', 'text-anchor': 'middle', style: `fill:${GAS[p.key].text}`, text: GAS[p.key].label }, svg);
        }
        x += w;
      });
      void total;
    }

    function draw() {
      const co2 = +inputs.co2.value, o2 = +inputs.o2.value, co = +inputs.co.value, bws = +inputs.bws.value / 100;
      const n2 = Math.max(0, 100 - co2 - o2 - co);
      const md = dryMW(co2, o2, co);
      const ms = wetMW(md, bws);
      const ea = excessAir(co2, o2, co);

      svg.innerHTML = '';
      // Composition bar (0–100%)
      el('text', { x: X0, y: 26, class: 'dg-label', text: 'Dry composition, % by volume' }, svg);
      const sc1 = (X1 - X0) / 100;
      segBar(36, 44, [
        { key: 'co2', value: co2, text: `CO₂ ${fmt(co2, 1)}%` },
        { key: 'o2', value: o2, text: `O₂ ${fmt(o2, 1)}%` },
        { key: 'co', value: co, text: `CO ${fmt(co, 2)}%` },
        { key: 'n2', value: n2, text: `N₂ + Ar ${fmt(n2, 1)}%` },
      ], 100, sc1);
      el('rect', { x: X0, y: 36, width: X1 - X0, height: 44, class: 'dg-rule' }, svg);

      // Contribution bar (0–32 lb/lb-mol)
      el('text', { x: X0, y: 128, class: 'dg-label', text: 'Contribution to dry molecular weight, lb/lb-mol' }, svg);
      const sc2 = (X1 - X0) / 32;
      segBar(138, 44, [
        { key: 'co2', value: 0.44 * co2, text: `CO₂ ${fmt(0.44 * co2, 2)}` },
        { key: 'o2', value: 0.32 * o2, text: `O₂ ${fmt(0.32 * o2, 2)}` },
        { key: 'co', value: 0.28 * co, text: `CO ${fmt(0.28 * co, 2)}` },
        { key: 'n2', value: 0.28 * n2, text: `N₂ ${fmt(0.28 * n2, 2)}` },
      ], md, sc2);
      for (let v = 0; v <= 32; v += 4) {
        const x = X0 + v * sc2;
        el('line', { x1: x, x2: x, y1: 186, y2: 194, class: 'dg-rule' }, svg);
        el('text', { x, y: 210, class: 'dg-label', 'text-anchor': 'middle', text: v }, svg);
      }
      const xa = X0 + 28.84 * sc2, xm = X0 + md * sc2;
      el('line', { x1: xa, x2: xa, y1: 130, y2: 190, style: 'stroke:var(--ink-2);stroke-width:1.5', 'stroke-dasharray': '3 3' }, svg);
      el('text', { x: xa, y: 124, class: 'dg-label', 'text-anchor': 'middle', text: 'air 28.84' }, svg);
      el('line', { x1: xm, x2: xm, y1: 130, y2: 196, style: 'stroke:var(--ink);stroke-width:2.5' }, svg);
      el('text', { x: Math.min(xm + 6, X1), y: 236, class: 'dg-label-strong', 'text-anchor': xm + 90 > X1 ? 'end' : 'start', text: `Md = ${fmt(md, 2)}` }, svg);

      $('#mx-md').innerHTML = `${fmt(md, 2)}<span class="readout-unit">lb/lb-mol</span>`;
      $('#mx-ms').innerHTML = `${fmt(ms, 2)}<span class="readout-unit">lb/lb-mol</span>`;
      $('#mx-n2').innerHTML = `${fmt(n2, 1)}<span class="readout-unit">%</span>`;
      $('#mx-ea').innerHTML = Number.isFinite(ea) ? `${fmt(ea, 0)}<span class="readout-unit">%</span>` : '—';
      const fo = co2 > 0.3 ? (20.9 - o2) / co2 : NaN;
      $('#mx-fo').textContent = Number.isFinite(fo) ? fmt(fo, 2) : '—';
      ST.tex($('#mx-eq'), `M_d = 0.440(${n(co2, 1)}) + 0.320(${n(o2, 1)}) + 0.280(${n(n2, 1)} + ${n(co, 2)}) = \\mathbf{${n(md, 2)}}`);

      const st = $('#mx-status');
      if (co2 + o2 > 21.05) {
        st.innerHTML = '<span class="status fail">CO₂ + O₂ above 21%</span><p class="ctl-help" style="margin-top:.5rem">Combustion in air cannot produce this. Suspect an analyzer or absorption error.</p>';
      } else if (!Number.isFinite(fo)) {
        st.innerHTML = '<span class="status pass">Essentially air</span><p class="ctl-help" style="margin-top:.5rem">Method 2 would let you assume M<sub>d</sub> = 29.0 here.</p>';
      } else {
        const best = FUELS.reduce((a, f) => (Math.abs(f.fo - fo) < Math.abs(a.fo - fo) ? f : a));
        const off = Math.abs(fo / best.fo - 1);
        st.innerHTML = off < 0.05
          ? `<span class="status pass"><span>F<sub>o</sub> ${fmt(fo, 2)} fits ${best.name} (about ${fmt(best.fo, 2)})</span></span>`
          : `<span class="status warn"><span>F<sub>o</sub> ${fmt(fo, 2)} does not fit a common fuel</span></span><p class="ctl-help" style="margin-top:.5rem">Closest is ${best.name} at about ${fmt(best.fo, 2)}. In the field this would prompt a check of the analyzer.</p>`;
      }
    }

    const preset = ST.seg('mx-preset', (v) => {
      const p = PRESETS[v];
      fromPreset = true;
      Object.keys(p).forEach((k) => { inputs[k].value = p[k]; ST.paintRange(inputs[k]); inputs[k].dispatchEvent(new Event('input')); });
      fromPreset = false;
      draw();
    });
    const fmts = { co2: (v) => `${fmt(v, 1)}%`, o2: (v) => `${fmt(v, 1)}%`, co: (v) => `${fmt(v, 2)}%`, bws: (v) => `${fmt(v, 1)}%` };
    Object.keys(inputs).forEach((k) => {
      ST.bind(inputs[k], `mx-${k}-out`, fmts[k]);
      inputs[k].addEventListener('input', () => {
        if (!fromPreset && k !== 'bws') ST.$$('#mx-preset button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        if (!fromPreset) draw();
      });
    });
    void preset;
    draw();
  })();

  /* =========================================================
     Figure: integrated bag sampling train (static, animated flow)
     ========================================================= */
  (function trainFigure() {
    const svg = $('#m3-train-svg');
    if (!svg) return;
    const Y = 100;
    // Stack wall and gas
    el('rect', { x: 0, y: 10, width: 56, height: 180, style: 'fill:var(--gas-soft)' }, svg);
    el('rect', { x: 56, y: 10, width: 12, height: 180, class: 'dg-wall' }, svg);
    el('text', { x: 8, y: 30, class: 'dg-label', text: 'Stack' }, svg);
    // Flow line through the whole train
    const line = 'M20,100 L640,100 L700,100';
    el('path', { d: line, style: 'fill:none;stroke:var(--rule-strong);stroke-width:6;stroke-linecap:round' }, svg);
    el('path', { d: line, class: 'm3-flow', style: 'fill:none;stroke:var(--gas);stroke-width:3;stroke-linecap:round' }, svg);
    const label = (x, a, b) => {
      el('text', { x, y: 168, class: 'dg-label-strong', 'text-anchor': 'middle', text: a }, svg);
      if (b) el('text', { x, y: 186, class: 'dg-label', 'text-anchor': 'middle', text: b }, svg);
    };
    // Probe
    el('rect', { x: 14, y: Y - 7, width: 130, height: 14, rx: 3, style: 'fill:var(--steel);stroke:var(--ink);stroke-width:1.5' }, svg);
    label(112, 'Probe', 'with filter plug');
    // Condenser in an ice bath
    el('rect', { x: 186, y: 44, width: 96, height: 104, rx: 8, style: 'fill:var(--water-soft);stroke:var(--rule-strong);stroke-width:1.5' }, svg);
    el('path', { d: 'M200,100 C210,70 222,130 234,100 C246,70 258,130 270,100', style: 'fill:none;stroke:var(--ink);stroke-width:2.5' }, svg);
    el('rect', { x: 222, y: 120, width: 26, height: 22, rx: 4, style: 'fill:var(--water);opacity:0.6' }, svg);
    label(234, 'Condenser', 'knocks out water');
    // Valve
    el('circle', { cx: 330, cy: Y, r: 13, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
    el('line', { x1: 320, y1: Y - 10, x2: 340, y2: Y + 10, style: 'stroke:var(--ink);stroke-width:3' }, svg);
    label(330, 'Valve');
    // Pump
    el('rect', { x: 380, y: 66, width: 84, height: 68, rx: 10, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
    el('circle', { cx: 422, cy: Y, r: 20, style: 'fill:none;stroke:var(--ink-2);stroke-width:2' }, svg);
    el('path', { d: 'M412,100 L428,100 M422,92 L430,100 L422,108', style: 'fill:none;stroke:var(--ink-2);stroke-width:2' }, svg);
    label(422, 'Leak-free pump');
    // Rate meter (rotameter)
    el('rect', { x: 512, y: 36, width: 26, height: 112, rx: 6, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
    el('path', { d: 'M519,72 L531,72 L525,84 Z', style: 'fill:var(--gauge)' }, svg);
    for (let k = 0; k < 6; k++) el('line', { x1: 538, x2: 546, y1: 50 + k * 18, y2: 50 + k * 18, class: 'dg-rule' }, svg);
    label(525, 'Rate meter', 'holds flow steady');
    // Bag
    el('path', { d: 'M720,54 Q700,54 700,74 L700,126 Q700,146 720,146 L940,146 Q960,146 960,126 L960,74 Q960,54 940,54 Z', style: 'fill:var(--gas-soft);stroke:var(--ink);stroke-width:2' }, svg);
    el('path', { d: 'M720,64 L940,64 M720,136 L940,136', style: 'stroke:var(--rule-strong);stroke-width:1', 'stroke-dasharray': '2 5' }, svg);
    label(830, 'Flexible bag', 'nonreactive film, leak checked');
  })();

  /* =========================================================
     Bench 2: Orsat analyzer
     ========================================================= */
  (function orsatBench() {
    const svg = $('#m3-orsat-svg');
    if (!svg) return;
    const SAMPLES = {
      coal: { co2: 13.1, o2: 6.0, co: 0.2 },
      ng: { co2: 10.2, o2: 3.0, co: 0.1 },
    };
    const PIPETTES = {
      koh: { x: 430, name: 'KOH', absorbs: ['co2'], reports: 'co2', color: 'var(--steel)', note: 'absorbs CO₂' },
      pyro: { x: 620, name: 'Alkaline pyrogallol', absorbs: ['co2', 'o2'], reports: 'o2', color: 'var(--soot)', note: 'absorbs O₂ (and CO₂)' },
      cucl: { x: 810, name: 'Cuprous chloride', absorbs: ['o2', 'co'], reports: 'co', color: 'var(--water)', note: 'absorbs CO (and O₂)' },
    };
    const BT = 64, BB = 334, PX = (BB - BT) / 100; // burette: 100 mL over 270 px
    let sampleKey = 'coal', gas = null, steps = [], busy = false;

    /* --- Static drawing --- */
    // Leveling bottle and its tube
    el('path', { d: 'M86,348 C86,370 150,372 172,360 L210,340', style: 'fill:none;stroke:var(--rule-strong);stroke-width:4' }, svg);
    el('rect', { x: 52, y: 214, width: 68, height: 130, rx: 12, style: 'fill:var(--panel);stroke:var(--ink-2);stroke-width:2' }, svg);
    const bottleWater = el('rect', { x: 55, width: 62, rx: 9, style: 'fill:var(--water);opacity:0.35' }, svg);
    el('text', { x: 86, y: 206, class: 'dg-label', 'text-anchor': 'middle', text: 'Leveling bottle' }, svg);
    // Burette in its water jacket
    el('rect', { x: 186, y: BT - 14, width: 64, height: BB - BT + 28, rx: 10, style: 'fill:var(--water-soft);stroke:var(--rule-strong);stroke-width:1.5' }, svg);
    el('rect', { x: 202, y: BT, width: 32, height: BB - BT, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
    const buretteGas = el('rect', { x: 204, y: BT + 1, width: 28, style: 'fill:var(--gas);opacity:0.28' }, svg);
    const buretteWater = el('rect', { x: 204, width: 28, style: 'fill:var(--water);opacity:0.35' }, svg);
    const menisc = el('line', { x1: 200, x2: 236, style: 'stroke:var(--ink);stroke-width:2' }, svg);
    for (let v = 0; v <= 100; v += 5) {
      const y = BT + v * PX;
      el('line', { x1: 234, x2: v % 10 ? 240 : 246, y1: y, y2: y, class: 'dg-rule' }, svg);
      if (v % 20 === 0) el('text', { x: 268, y: y + 4, class: 'dg-label', 'text-anchor': 'middle', text: v }, svg);
    }
    el('text', { x: 218, y: 380, class: 'dg-label', 'text-anchor': 'middle', text: 'Burette, mL' }, svg);
    // Manifold
    el('path', { d: `M218,${BT} L218,30 L890,30`, style: 'fill:none;stroke:var(--ink-2);stroke-width:3' }, svg);
    const transit = el('path', { d: `M218,${BT} L218,30 L430,30`, class: 'm3-flow', style: 'fill:none;stroke:var(--gas);stroke-width:2.5;opacity:0' }, svg);
    // Pipettes
    const P = {};
    Object.entries(PIPETTES).forEach(([key, p]) => {
      const fx = p.x - 52, rx = p.x + 8, top = 96, bot = 300, w = 44;
      el('path', { d: `M${p.x - 30},30 L${p.x - 30},${top}`, style: 'stroke:var(--ink-2);stroke-width:3' }, svg);
      el('circle', { cx: p.x - 30, cy: 52, r: 8, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
      el('line', { x1: p.x - 40, x2: p.x - 20, y1: 52, y2: 52, style: 'stroke:var(--ink);stroke-width:3' }, svg);
      el('path', { d: `M${fx + w / 2},${bot} L${fx + w / 2},${bot + 22} L${rx + w / 2},${bot + 22} L${rx + w / 2},${bot}`, style: 'fill:none;stroke:var(--ink-2);stroke-width:4' }, svg);
      el('rect', { x: fx, y: top, width: w, height: bot - top, rx: 10, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
      el('rect', { x: rx, y: top, width: w, height: bot - top, rx: 10, style: 'fill:var(--panel);stroke:var(--ink-2);stroke-width:1.5' }, svg);
      const front = el('rect', { x: fx + 3, width: w - 6, rx: 7, style: `fill:${p.color};opacity:0.7` }, svg);
      const rear = el('rect', { x: rx + 3, width: w - 6, rx: 7, style: `fill:${p.color};opacity:0.55` }, svg);
      const pocket = el('rect', { x: fx + 3, y: top + 3, width: w - 6, rx: 7, style: 'fill:var(--gas);opacity:0.3' }, svg);
      // glass contact tubes inside the front vessel
      for (let k = 0; k < 4; k++) el('line', { x1: fx + 10 + k * 8, x2: fx + 10 + k * 8, y1: top + 14, y2: bot - 14, class: 'dg-rule', opacity: 0.6 }, svg);
      el('text', { x: p.x, y: 350, class: 'dg-label-strong', 'text-anchor': 'middle', text: p.name }, svg);
      el('text', { x: p.x, y: 368, class: 'dg-label', 'text-anchor': 'middle', text: p.note }, svg);
      P[key] = { front, rear, pocket, top, bot };
    });

    /* --- State drawing --- */
    function setBurette(v) {
      const y = BT + clamp(v, 0, 100) * PX;
      buretteGas.setAttribute('height', Math.max(0, y - BT - 1));
      buretteWater.setAttribute('y', y);
      buretteWater.setAttribute('height', Math.max(0, BB - y - 1));
      menisc.setAttribute('y1', y); menisc.setAttribute('y2', y);
      // the leveling bottle drops as the burette fills with gas
      const wy = 250 + (v / 100) * 70;
      bottleWater.setAttribute('y', wy);
      bottleWater.setAttribute('height', Math.max(0, 341 - wy));
    }
    function setPipette(key, gasMl) {
      const p = P[key];
      const span = p.bot - p.top - 6;
      const g = (clamp(gasMl, 0, 100) / 100) * span * 0.85;
      p.pocket.setAttribute('height', Math.max(0, g));
      const fy = p.top + 3 + g;
      p.front.setAttribute('y', fy);
      p.front.setAttribute('height', Math.max(0, p.bot - 3 - fy));
      const ry = p.top + 3 + span * 0.8 - g;
      p.rear.setAttribute('y', ry);
      p.rear.setAttribute('height', Math.max(0, p.bot - 3 - ry));
    }
    const volume = () => (gas ? gas.co2 + gas.o2 + gas.co + gas.n2 : 0);

    function render() {
      const v = volume();
      $('#or-vol').innerHTML = gas ? `${fmt(v, 1)}<span class="readout-unit">mL</span>` : '—';
      ST.$$('#b-orsat [data-pipette]').forEach((b) => (b.disabled = !gas || busy));
      $('#or-draw').disabled = busy;
      const table = $('#or-table');
      if (!steps.length) {
        table.innerHTML = '';
      } else {
        table.innerHTML = `<thead><tr><th>Pass</th><th>Pipette</th><th class="n">Burette reading</th><th class="n">Drop</th><th>Reported as</th></tr></thead><tbody>${steps
          .map((s, i) => `<tr><td class="n">${i + 1}</td><td>${PIPETTES[s.key].name}</td><td class="n">${fmt(s.after, 1)} mL</td><td class="n">${fmt(s.drop, 1)} mL</td><td>${GAS[PIPETTES[s.key].reports].label}</td></tr>`)
          .join('')}</tbody>`;
      }
      const used = new Set(steps.map((s) => s.key));
      const st = $('#or-status');
      if (!gas) { st.innerHTML = '<p class="ctl-help">Draw a sample to start.</p>'; return; }
      if (used.size < 3) { st.innerHTML = ''; return; }
      const rep = { co2: 0, o2: 0, co: 0 };
      steps.forEach((s) => { rep[PIPETTES[s.key].reports] += s.drop; });
      const truth = SAMPLES[sampleKey];
      const n2 = v;
      const mdRep = dryMW(rep.co2, rep.o2, rep.co);
      const mdTrue = dryMW(truth.co2, truth.o2, truth.co);
      const errs = ['co2', 'o2', 'co'].filter((k) => Math.abs(rep[k] - truth[k]) > 0.05);
      const summary = `CO₂ ${fmt(rep.co2, 1)}%, O₂ ${fmt(rep.o2, 1)}%, CO ${fmt(rep.co, 1)}%, N₂ ${fmt(n2, 1)}%: M<sub>d</sub> = ${fmt(mdRep, 2)}`;
      if (!errs.length) {
        st.innerHTML = `<span class="status pass">Analysis matches the sample</span><p class="ctl-help" style="margin-top:.5rem">${summary}</p>`;
      } else {
        const why = [];
        const order = steps.map((s) => s.key);
        const first = (k) => order.indexOf(k);
        if (first('pyro') > -1 && (first('koh') === -1 || first('pyro') < first('koh'))) why.push('pyrogallol absorbed the CO₂ before KOH could');
        if (first('cucl') > -1 && (first('pyro') === -1 || first('cucl') < first('pyro'))) why.push('cuprous chloride took up oxygen meant for the pyrogallol');
        st.innerHTML = `<span class="status fail">Reported composition is wrong</span><p class="ctl-help" style="margin-top:.5rem">${summary}, against a true ${fmt(mdTrue, 2)}. ${why.length ? 'The order was off: ' + why.join(', and ') + '.' : ''} Draw a new sample and run KOH, pyrogallol, then cuprous chloride.</p>`;
      }
    }

    function draw() {
      const t = SAMPLES[sampleKey];
      gas = { co2: t.co2, o2: t.o2, co: t.co, n2: 100 - t.co2 - t.o2 - t.co };
      steps = [];
      busy = true;
      render();
      const from = 0;
      tween(0.9, (k) => setBurette(ST.lerp(from, 100, k)), () => { busy = false; render(); });
    }

    function pass(key) {
      if (!gas || busy) return;
      const p = PIPETTES[key];
      const before = volume();
      busy = true;
      render();
      transit.setAttribute('d', `M218,${BT} L218,30 L${p.x - 30},30 L${p.x - 30},96`);
      transit.style.opacity = 1;
      tween(0.9, (k) => { setBurette(ST.lerp(before, 0, k)); setPipette(key, ST.lerp(0, before, k)); }, () => {
        p.absorbs.forEach((g) => { gas[g] = 0; });
        const after = volume();
        tween(0.9, (k) => { setBurette(ST.lerp(0, after, k)); setPipette(key, ST.lerp(after, 0, k)); }, () => {
          transit.style.opacity = 0;
          steps.push({ key, after, drop: before - after });
          busy = false;
          render();
        });
      });
    }

    ST.seg('or-sample', (v) => { sampleKey = v; gas = null; steps = []; setBurette(0); render(); });
    $('#or-draw').addEventListener('click', draw);
    ST.$$('#b-orsat [data-pipette]').forEach((b) => b.addEventListener('click', () => pass(b.dataset.pipette)));
    Object.keys(PIPETTES).forEach((k) => setPipette(k, 0));
    setBurette(0);
    render();
  })();

  /* =========================================================
     Bench 3: correcting to a reference O2
     ========================================================= */
  (function o2Bench() {
    const svg = $('#m3-o2-svg');
    if (!svg) return;
    const eaIn = $('#o2-ea');
    let ref = 7;
    const C0 = 100; // ppmvd at 0% O2 (stoichiometric)

    function draw() {
      const ea = +eaIn.value / 100;
      const o2 = (20.9 * ea) / (1 + ea);
      const c = (C0 * (20.9 - o2)) / 20.9;
      const cc = (c * (20.9 - ref)) / (20.9 - o2);
      svg.innerHTML = '';
      const x0 = 70, y0 = 30, y1 = 250;
      const Y = (v) => y1 - (v / 100) * (y1 - y0);
      for (let v = 0; v <= 100; v += 25) {
        el('line', { x1: x0, x2: 530, y1: Y(v), y2: Y(v), class: 'dg-rule', opacity: v ? 0.45 : 1 }, svg);
        el('text', { x: x0 - 8, y: Y(v) + 4, class: 'dg-label', 'text-anchor': 'end', text: v }, svg);
      }
      el('text', { x: 16, y: (y0 + y1) / 2, class: 'dg-label', 'text-anchor': 'middle', transform: `rotate(-90 16 ${(y0 + y1) / 2})`, text: 'NOₓ, ppmvd' }, svg);
      const bar = (x, v, fill, a, b) => {
        el('rect', { x, y: Y(v), width: 110, height: y1 - Y(v), rx: 3, style: `fill:${fill}` }, svg);
        el('text', { x: x + 55, y: Y(v) - 8, class: 'dg-label-strong', 'text-anchor': 'middle', text: fmt(v, 1) }, svg);
        el('text', { x: x + 55, y: y1 + 20, class: 'dg-label', 'text-anchor': 'middle', text: a }, svg);
        el('text', { x: x + 55, y: y1 + 37, class: 'dg-label', 'text-anchor': 'middle', text: b }, svg);
      };
      bar(130, c, 'var(--gauge)', 'Measured', `at ${fmt(o2, 1)}% O₂`);
      bar(330, cc, 'var(--accent)', 'Corrected', `to ${ref}% O₂`);
      $('#o2-o2').innerHTML = `${fmt(o2, 1)}<span class="readout-unit">%</span>`;
      $('#o2-c').innerHTML = `${fmt(c, 1)}<span class="readout-unit">ppmvd</span>`;
      $('#o2-cc').innerHTML = `${fmt(cc, 1)}<span class="readout-unit">ppmvd</span>`;
      ST.tex($('#o2-eq'), `C_{@${ref}\\%} = ${n(c, 1)} \\times \\dfrac{20.9 - ${ref}}{20.9 - ${n(o2, 1)}} = \\mathbf{${n(cc, 1)}}`);
    }
    ST.seg('o2-ref', (v) => { ref = +v; draw(); });
    ST.bind(eaIn, 'o2-ea-out', (v) => `${v}%`, draw);
  })();

  /* =========================================================
     Bench 4: assumed vs. measured molecular weight
     ========================================================= */
  (function mwBench() {
    const svg = $('#m3-err-svg');
    if (!svg) return;
    const co2In = $('#mw-co2'), o2In = $('#mw-o2'), bIn = $('#mw-bws');
    let assumed = 29.0;
    const X0 = 50, X1 = 510, LIM = 5;
    const X = (e) => X0 + ((clamp(e, -LIM, LIM) + LIM) / (2 * LIM)) * (X1 - X0);

    function draw() {
      const co2 = +co2In.value, o2 = +o2In.value, bws = +bIn.value / 100;
      const md = dryMW(co2, o2);
      const msTrue = wetMW(md, bws), msAssumed = wetMW(assumed, bws);
      const err = (Math.sqrt(msTrue / msAssumed) - 1) * 100; // v ∝ 1/√Ms
      svg.innerHTML = '';
      el('rect', { x: X0, y: 70, width: X1 - X0, height: 26, rx: 13, class: 'dg-well', style: 'stroke:var(--rule-strong)' }, svg);
      el('rect', { x: X(-1), y: 70, width: X(1) - X(-1), height: 26, style: 'fill:var(--gas-soft)' }, svg);
      for (let e = -LIM; e <= LIM; e++) {
        el('line', { x1: X(e), x2: X(e), y1: 100, y2: e % 5 ? 106 : 112, class: 'dg-rule' }, svg);
        el('text', { x: X(e), y: 128, class: 'dg-label', 'text-anchor': 'middle', text: `${e > 0 ? '+' : e < 0 ? '−' : ''}${Math.abs(e)}%` }, svg);
      }
      const x = X(err);
      el('line', { x1: x, x2: x, y1: 58, y2: 108, style: 'stroke:var(--gauge);stroke-width:3' }, svg);
      el('path', { d: `M${x - 8},48 L${x + 8},48 L${x},60 Z`, style: 'fill:var(--gauge)' }, svg);
      el('text', { x: X0, y: 30, class: 'dg-label', text: 'Velocity error from the assumed molecular weight' }, svg);
      el('text', { x: X0, y: 166, class: 'dg-label', text: `Actual Ms ${fmt(msTrue, 2)} vs. assumed Ms ${fmt(msAssumed, 2)} lb/lb-mol` }, svg);
      el('text', { x: X0, y: 190, class: 'dg-label', text: err > 0.005 ? 'The assumed gas is too light, so velocity and flow read high.' : err < -0.005 ? 'The assumed gas is too heavy, so velocity and flow read low.' : 'The assumption matches the real gas.' }, svg);
      $('#mw-md').innerHTML = `${fmt(md, 2)}<span class="readout-unit">lb/lb-mol</span>`;
      $('#mw-err').innerHTML = `${err >= 0.005 ? '+' : err <= -0.005 ? '−' : ''}${fmt(Math.abs(err), 2)}<span class="readout-unit">%</span>`;
    }
    ST.seg('mw-assume', (v) => { assumed = +v; draw(); });
    ST.bind(co2In, 'mw-co2-out', (v) => `${fmt(v, 1)}%`, draw);
    ST.bind(o2In, 'mw-o2-out', (v) => `${fmt(v, 1)}%`, draw);
    ST.bind(bIn, 'mw-bws-out', (v) => `${fmt(v, 1)}%`, draw);
  })();
})();
