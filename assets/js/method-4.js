/* Method 4: moisture — interactive benches. */
(function () {
  'use strict';
  const { $, svg: el, fmt, clamp, lerp } = ST;

  /* ---------- Shared Method 4 maths ---------- */
  const K_WATER_ML = 0.04706; // ft³ of vapor (std) per mL of liquid water
  const K_WATER_G = 0.04715;  // ft³ of vapor (std) per g of water
  const K_STD = 17.64;        // 528 °R / 29.92 in. Hg

  /** Vapor pressure of water, in. Hg, from the Antoine equation. */
  function pvInHg(tF) {
    const tC = (tF - 32) / 1.8;
    const log10mm = tC <= 100 ? 8.07131 - 1730.63 / (233.426 + tC) : 8.14019 - 1810.94 / (244.485 + tC);
    return Math.pow(10, log10mm) / 25.4;
  }
  const pct = (v, d = 1) => `${fmt(v * 100, d)}<span class="readout-unit">%</span>`;
  const unit = (v, d, u) => `${fmt(v, d)}<span class="readout-unit">${u}</span>`;

  /* =========================================================
     Bench 1: what moisture does to Ms, velocity and concentration
     ========================================================= */
  (function whyBench() {
    const svg = $('#m4-why-svg');
    if (!svg) return;
    const MD = 30.16, TS = 350 + 460, PS = 29.5, SQDP = 0.9, CP = 0.84;
    const vel = (M) => 85.49 * CP * SQDP * Math.sqrt(TS / (PS * M));
    const top = 36, bot = 252, H = bot - top;
    const g = el('g', {}, svg);

    function draw(bwsPct) {
      const B = bwsPct / 100;
      const Ms = MD * (1 - B) + 18 * B;
      const vs = vel(Ms), vsDry = vel(MD);
      $('#wy-ms').innerHTML = unit(Ms, 2, 'lb/lb-mol');
      $('#wy-vs').innerHTML = unit(vs, 1, 'ft/s');
      $('#wy-err').innerHTML = (B > 0 ? '−' : '') + unit(Math.abs((vsDry / vs - 1) * 100), 1, '%');
      $('#wy-dry').innerHTML = unit(100 / (1 - B), 1, 'ppmvd');

      g.innerHTML = '';
      const wH = H * B;
      // Left bar: one cubic foot of stack gas
      el('rect', { x: 70, y: top, width: 110, height: H, rx: 4, class: 'dg-panel' }, g);
      el('rect', { x: 70, y: top + wH, width: 110, height: H - wH, style: 'fill:var(--gas);opacity:.55' }, g);
      if (wH > 0.5) el('rect', { x: 70, y: top, width: 110, height: wH, style: 'fill:var(--water);opacity:.8' }, g);
      el('rect', { x: 70, y: top, width: 110, height: H, rx: 4, class: 'dg-ink', 'stroke-width': 1.5 }, g);
      // Labels
      const wy = wH > 30 ? top + wH / 2 + 5 : top - 8;
      el('text', { x: 125, y: wy, class: wH > 30 ? 'dg-label-strong' : 'dg-label', 'text-anchor': 'middle', style: wH > 30 ? 'fill:var(--panel)' : '', text: `Water ${fmt(B * 100, 1)}%` }, g);
      el('text', { x: 125, y: top + wH + (H - wH) / 2 + 5, class: 'dg-label-strong', 'text-anchor': 'middle', text: `Dry gas ${fmt((1 - B) * 100, 1)}%` }, g);
      el('text', { x: 125, y: bot + 26, class: 'dg-label', 'text-anchor': 'middle', text: '1 ft³ in the stack' }, g);
      // Arrow
      el('line', { x1: 200, x2: 318, y1: 150, y2: 150, style: 'stroke:var(--ink-3);stroke-width:2', 'marker-end': 'url(#m4-why-arr)' }, g);
      el('text', { x: 259, y: 136, class: 'dg-label', 'text-anchor': 'middle', text: 'impingers remove' }, g);
      el('text', { x: 259, y: 172, class: 'dg-label', 'text-anchor': 'middle', text: 'the water' }, g);
      // Right bar: what the meter measures
      el('rect', { x: 340, y: top, width: 110, height: H, rx: 4, style: 'fill:none;stroke:var(--rule-strong);stroke-dasharray:4 4' }, g);
      el('rect', { x: 340, y: top + wH, width: 110, height: H - wH, rx: 4, style: 'fill:var(--gas);opacity:.55;stroke:var(--ink);stroke-width:1.5' }, g);
      el('text', { x: 395, y: top + wH + (H - wH) / 2 + 5, class: 'dg-label-strong', 'text-anchor': 'middle', text: `${fmt(1 - B, 3)} ft³` }, g);
      el('text', { x: 395, y: bot + 26, class: 'dg-label', 'text-anchor': 'middle', text: 'At the dry gas meter' }, g);
      el('text', { x: 470, y: top + wH + 4, class: 'dg-label', text: 'dry only' }, g);
    }
    const defs = el('defs', {}, svg);
    const m = el('marker', { id: 'm4-why-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--ink-3)' }, m);
    ST.bind('wy-bws', 'wy-bws-out', (v) => `${fmt(v, 1)}%`, draw);
  })();

  /* =========================================================
     Bench 2: animated impinger train
     ========================================================= */
  (function trainBench() {
    const svg = $('#m4-train-svg');
    if (!svg) return;
    const CX = [260, 370, 480, 590];
    const CAP_Y = 100, BODY_TOP = 112, BODY_BOT = 360, TIP_Y = 342, PIPE_Y = 44;
    const PX_PER_ML = (BODY_BOT - BODY_TOP) / 550;
    const GEL_G = 250, GEL_DENSITY = 0.7; // g, g/mL
    const GEL_TOP = BODY_BOT - 4 - (GEL_G / GEL_DENSITY) * PX_PER_ML;
    const FRESH = [62, 116, 214], SPENT = [228, 138, 176]; // indicating gel: blue to pink
    const SPLIT = { iced: [0.7, 0.2, 0.06, 0.04], melted: [0.4, 0.12, 0.04, 0.44] };
    const GEL_CAP = { iced: 75, melted: 30 }; // g the gel can hold at bath temperature
    const RUN_MIN = 60, MIN_PER_SEC = 2;

    const bwsIn = $('#tr-bws');
    let ice = 'iced';
    const sim = { t: 0 };

    const body = (cx) => `M${cx - 32},${BODY_TOP} L${cx - 32},${BODY_BOT - 18} Q${cx - 32},${BODY_BOT} ${cx - 14},${BODY_BOT} L${cx + 14},${BODY_BOT} Q${cx + 32},${BODY_BOT} ${cx + 32},${BODY_BOT - 18} L${cx + 32},${BODY_TOP} Z`;
    const defs = el('defs', {}, svg);
    CX.forEach((cx, i) => el('path', { d: body(cx) }, el('clipPath', { id: `m4-imp-${i}` }, defs)));

    // Ice bath
    const bath = el('rect', { x: 196, y: 128, width: 458, height: 244, rx: 12 }, svg);
    const iceG = el('g', {}, svg);
    const cubes = [[206, 136], [300, 140], [318, 162], [410, 134], [428, 158], [520, 140], [536, 164], [626, 138], [208, 170], [630, 168], [300, 300], [410, 320], [520, 296], [628, 320], [210, 330]];
    cubes.forEach(([x, y], i) => el('rect', { x, y, width: 18, height: 16, rx: 4, transform: `rotate(${(i * 37) % 30 - 15} ${x + 9} ${y + 8})`, style: 'fill:var(--panel);stroke:var(--water);stroke-width:1;opacity:.95' }, iceG));

    // Probe with heating element
    el('rect', { x: 20, y: PIPE_Y - 6, width: 196, height: 12, rx: 3, style: 'fill:var(--steel)' }, svg);
    let zig = `M24,${PIPE_Y}`;
    for (let x = 30; x <= 210; x += 8) zig += ` L${x},${PIPE_Y + ((x / 8) % 2 ? -4 : 4)}`;
    el('path', { d: zig, style: 'fill:none;stroke:var(--gauge);stroke-width:1.4' }, svg);
    el('text', { x: 22, y: 26, class: 'dg-label-strong', text: 'Heated probe' }, svg);
    el('text', { x: 22, y: 76, class: 'dg-label', text: 'Stack gas in' }, svg);

    // Tubing (and the dashed gas-flow overlay that animates along it)
    const tubes = [`M216,${PIPE_Y} L${CX[0]},${PIPE_Y} L${CX[0]},60`];
    for (let i = 0; i < 3; i++) tubes.push(`M${CX[i] + 22},${CAP_Y} L${CX[i] + 22},${PIPE_Y} L${CX[i + 1]},${PIPE_Y} L${CX[i + 1]},60`);
    tubes.push(`M${CX[3] + 22},${CAP_Y} L${CX[3] + 22},${PIPE_Y} L692,${PIPE_Y}`);
    tubes.push(`M708,${PIPE_Y} L780,${PIPE_Y} Q800,${PIPE_Y} 800,64 L800,130`);
    tubes.forEach((d) => el('path', { d, style: 'fill:none;stroke:var(--rule-strong);stroke-width:6;stroke-linejoin:round' }, svg));
    const flow = tubes.map((d) => el('path', { d, style: 'fill:none;stroke:var(--gas);stroke-width:2;stroke-dasharray:4 9;stroke-linecap:round' }, svg));

    // Impingers: liquid, bubbles, glass, stems
    const liquids = [], bubbles = [];
    const gelG = el('g', { 'clip-path': 'url(#m4-imp-3)' }, svg);
    const granules = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 190; k++) {
      const x = CX[3] - 27 + rnd() * 54, y = GEL_TOP + 3 + rnd() * (BODY_BOT - GEL_TOP - 6);
      granules.push({ y, c: el('circle', { cx: x, cy: y, r: 3.3 }, gelG) });
    }
    CX.forEach((cx, i) => {
      const cg = el('g', { 'clip-path': `url(#m4-imp-${i})` }, svg);
      if (i < 3) {
        liquids.push(el('rect', { x: cx - 34, width: 68, y: BODY_BOT, height: 0, style: 'fill:var(--water);opacity:.38' }, cg));
        for (let b = 0; b < 7; b++) bubbles.push({ i, ph: b / 7, dx: ((b * 5) % 7) - 3, c: el('circle', { r: 2 + (b % 3), style: 'fill:none;stroke:var(--water);stroke-width:1.2' }, cg) });
      }
      el('path', { d: body(cx), style: 'fill:none;stroke:var(--ink-2);stroke-width:2' }, svg);
      el('rect', { x: cx - 38, y: CAP_Y, width: 76, height: 12, rx: 3, style: 'fill:var(--panel);stroke:var(--ink-2);stroke-width:2' }, svg);
      el('line', { x1: cx, x2: cx, y1: 60, y2: i === 3 ? GEL_TOP + 20 : TIP_Y, style: 'stroke:var(--ink-2);stroke-width:4' }, svg);
      if (i === 1) el('line', { x1: cx - 11, x2: cx + 11, y1: TIP_Y + 8, y2: TIP_Y + 8, style: 'stroke:var(--ink-2);stroke-width:3' }, svg);
      el('text', { x: cx, y: 394, class: 'dg-label-strong', 'text-anchor': 'middle', text: ['1: 100 mL water', '2: 100 mL water', '3: empty', '4: silica gel'][i] }, svg);
    });

    // Outlet thermometer
    el('circle', { cx: 700, cy: PIPE_Y, r: 8, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:2' }, svg);
    el('line', { x1: 700, x2: 700, y1: PIPE_Y + 8, y2: PIPE_Y + 30, style: 'stroke:var(--ink);stroke-width:2' }, svg);
    const tempTxt = el('text', { x: 700, y: PIPE_Y + 50, class: 'dg-label-strong', 'text-anchor': 'middle' }, svg);
    el('text', { x: 700, y: PIPE_Y + 66, class: 'dg-label', 'text-anchor': 'middle', text: 'gel outlet' }, svg);

    // Meter box
    el('rect', { x: 760, y: 130, width: 220, height: 220, rx: 10, class: 'dg-panel' }, svg);
    el('rect', { x: 760, y: 130, width: 220, height: 220, rx: 10, class: 'dg-ink', 'stroke-width': 2 }, svg);
    el('text', { x: 776, y: 156, class: 'dg-label-strong', text: 'Meter box' }, svg);
    el('text', { x: 776, y: 174, class: 'dg-label', text: 'pump and dry gas meter' }, svg);
    const DX = 870, DY = 252, DR = 52;
    el('circle', { cx: DX, cy: DY, r: DR, style: 'fill:var(--paper);stroke:var(--ink);stroke-width:2' }, svg);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      el('line', { x1: DX + Math.cos(a) * (DR - 4), y1: DY + Math.sin(a) * (DR - 4), x2: DX + Math.cos(a) * (DR - 12), y2: DY + Math.sin(a) * (DR - 12), style: 'stroke:var(--ink-2);stroke-width:1.5' }, svg);
    }
    const needle = el('line', { x1: DX, y1: DY, x2: DX, y2: DY - DR + 14, style: 'stroke:var(--gauge);stroke-width:2.5;stroke-linecap:round' }, svg);
    el('circle', { cx: DX, cy: DY, r: 4, style: 'fill:var(--ink)' }, svg);
    const meterTxt = el('text', { x: DX, y: 334, class: 'dg-label-strong', 'text-anchor': 'middle' }, svg);

    /** The state of the train t minutes into the run. */
    function state(t) {
      const B = +bwsIn.value / 100;
      const f = t / RUN_MIN;
      const vm = 0.75 * t;              // ft³ at the meter, 0.75 cfm
      const vmStd = vm * 0.996;         // near-standard meter conditions
      const waterMl = ((B / (1 - B)) * vmStd) / K_WATER_ML;
      const s = SPLIT[ice];
      const imp = [0, 1, 2].map((i) => waterMl * s[i]);
      const routed = waterMl * s[3];
      const gel = Math.min(routed, GEL_CAP[ice]);
      const measScf = (imp[0] + imp[1] + imp[2]) * K_WATER_ML + gel * K_WATER_G;
      const meas = vmStd > 0 ? measScf / (measScf + vmStd) : 0;
      const temp = ice === 'iced' ? 52 + 5 * f + 25 * B : 78 + 9 * f;
      return { B, f, vm, imp, gel, load: gel / GEL_CAP.iced, spent: gel / GEL_CAP[ice], meas, temp, escaped: routed - gel };
    }

    let rdTimer = 0;
    function draw(dt, t) {
      if (sim.t < RUN_MIN) sim.t = Math.min(RUN_MIN, sim.t + dt * MIN_PER_SEC);
      const S = state(sim.t);
      const running = sim.t < RUN_MIN;
      // Bath
      bath.setAttribute('style', `fill:${ice === 'iced' ? 'var(--water-soft)' : 'color-mix(in srgb, var(--water-soft) 40%, transparent)'};stroke:var(--rule-strong);stroke-width:1.5`);
      iceG.setAttribute('opacity', ice === 'iced' ? 1 : 0);
      // Liquid levels (impingers 1 and 2 start with 100 mL)
      S.imp.forEach((ml, i) => {
        const vol = (i < 2 ? 100 : 0) + ml;
        const y = BODY_BOT - vol * PX_PER_ML;
        liquids[i].setAttribute('y', y);
        liquids[i].setAttribute('height', Math.max(0, BODY_BOT - y + 2));
        liquids[i].dataset.level = y;
      });
      // Bubbles rise from the stem tip to the surface while gas is flowing
      bubbles.forEach((b) => {
        const surf = +liquids[b.i].dataset.level;
        if (!running || surf > TIP_Y - 4) { b.c.setAttribute('opacity', 0); return; }
        const p = (b.ph + t * 0.9) % 1;
        b.c.setAttribute('cx', CX[b.i] + b.dx * 3 + Math.sin((p + b.ph) * 9) * 2);
        b.c.setAttribute('cy', lerp(TIP_Y, surf, p));
        b.c.setAttribute('opacity', 0.9 * (1 - p * 0.6));
      });
      // Silica gel loads from the bottom, where the gas enters
      const front = BODY_BOT - (BODY_BOT - GEL_TOP) * clamp(S.spent, 0, 1);
      granules.forEach((g) => {
        const m = clamp((g.y - front) / 14 + 0.5, 0, 1);
        const c = FRESH.map((v, k) => Math.round(lerp(v, SPENT[k], m)));
        g.c.setAttribute('style', `fill:rgb(${c.join(',')})`);
      });
      // Flow dashes and meter
      flow.forEach((p) => p.style.strokeDashoffset = running ? -t * 26 : 0);
      flow.forEach((p) => (p.style.opacity = running ? 0.9 : 0.25));
      needle.setAttribute('transform', `rotate(${(S.vm % 1) * 360} ${DX} ${DY})`);
      meterTxt.textContent = `${fmt(S.vm, 3)} ft³`;
      tempTxt.textContent = `${Math.round(S.temp)} °F`;
      tempTxt.setAttribute('style', S.temp > 68 ? 'fill:var(--gauge)' : '');

      rdTimer -= dt;
      if (rdTimer > 0 && dt > 0) return;
      rdTimer = 0.12;
      const m = Math.floor(sim.t), s = Math.floor((sim.t - m) * 60);
      $('#tr-clock').innerHTML = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}<span class="readout-unit">of 60:00</span>`;
      $('#tr-cond').innerHTML = unit(S.imp[0] + S.imp[1] + S.imp[2], 1, 'mL');
      $('#tr-gel').innerHTML = unit(S.gel, 1, 'g');
      $('#tr-temp').innerHTML = unit(S.temp, 0, '°F');
      $('#tr-meas').innerHTML = sim.t > 0.5 ? pct(S.meas) : '—';
      const status = $('#tr-status');
      if (ice === 'melted') {
        status.innerHTML = `<span class="status fail">Outlet above 68 °F</span><p class="ctl-help" style="margin-top:.5rem">${S.escaped > 0.5 ? `About ${fmt(S.escaped, 0)} g of water has slipped past the spent gel. ` : ''}Measured moisture is reading low against the true ${fmt(S.B * 100, 0)}%.</p>`;
      } else if (!running) {
        status.innerHTML = `<span class="status pass">Run complete: measured ${fmt(S.meas * 100, 1)}%, true ${fmt(S.B * 100, 0)}%</span>`;
      } else {
        status.innerHTML = '';
      }
    }

    const loop = ST.loop(svg, draw, { buttonHost: svg.parentElement });
    const restart = () => { sim.t = ST.reducedMotion && !loop.playing ? RUN_MIN : 0; loop.draw(); };
    ST.bind(bwsIn, 'tr-bws-out', (v) => `${v}%`, () => { if (typeof loop !== 'undefined') restart(); });
    ST.seg('tr-ice', (v) => { ice = v; restart(); });
    $('#tr-restart').addEventListener('click', () => { sim.t = 0; if (!loop.playing) loop.play(); });
    if (ST.reducedMotion) sim.t = RUN_MIN;
    loop.draw();
    ST.onTheme(() => loop.draw());
  })();

  /* =========================================================
     Bench 3: moisture calculator
     ========================================================= */
  (function calcBench() {
    const ids = ['mc-vi', 'mc-vf', 'mc-wi', 'mc-wf', 'mc-vm', 'mc-y', 'mc-pb', 'mc-dh', 'mc-tm'];
    if (!$('#mc-vi')) return;
    let mode = 'vol';
    const v = (id) => parseFloat($('#' + id).value);
    const n = (x, d) => fmt(x, d).replace(/,/g, '{,}');

    function run() {
      const [vi, vf, wi, wf, vm, y, pb, dh, tm] = ids.map(v);
      const k = mode === 'vol' ? K_WATER_ML : K_WATER_G;
      const sym = mode === 'vol' ? 'V' : 'W';
      const vwc = k * (vf - vi);
      const vwsg = K_WATER_G * (wf - wi);
      const tmR = tm + 460;
      const vmstd = (K_STD * y * vm * (pb + dh / 13.6)) / tmR;
      const bws = (vwc + vwsg) / (vwc + vwsg + vmstd);

      const al = (lhs, sym, num, res) => `\\begin{aligned} ${lhs} &= ${sym} \\\\ &= ${num} \\\\ &= \\mathbf{${res}} \\end{aligned}`;
      ST.tex($('#mc-eq1'), al('V_{wc(std)}', `${k}\\,(${sym}_f - ${sym}_i)`, `${k}\\,(${n(vf, 1)} - ${n(vi, 1)})`, `${n(vwc, 3)}\\ \\text{scf}`));
      ST.tex($('#mc-eq2'), al('V_{wsg(std)}', '0.04715\\,(W_f - W_i)', `0.04715\\,(${n(wf, 1)} - ${n(wi, 1)})`, `${n(vwsg, 3)}\\ \\text{scf}`));
      ST.tex($('#mc-eq3'), al('V_{m(std)}', '17.64\\,Y\\,V_m\\,\\dfrac{P_{bar} + \\Delta H/13.6}{T_m}', `17.64\\,(${n(y, 3)})(${n(vm, 3)})\\,\\dfrac{${n(pb, 2)} + ${n(dh, 2)}/13.6}{${n(tm, 0)} + 460}`, `${n(vmstd, 3)}\\ \\text{dscf}`));
      ST.tex($('#mc-eq4'), al('B_{ws}', '\\dfrac{V_{wc(std)} + V_{wsg(std)}}{V_{wc(std)} + V_{wsg(std)} + V_{m(std)}}', `\\dfrac{${n(vwc, 3)} + ${n(vwsg, 3)}}{${n(vwc, 3)} + ${n(vwsg, 3)} + ${n(vmstd, 3)}}`, `${n(bws, 4)}\\quad(${n(bws * 100, 1)}\\%)`));

      const problems = [];
      const flag = (id, bad) => $('#' + id).setAttribute('aria-invalid', String(!!bad));
      flag('mc-vf', vf < vi); if (vf < vi) problems.push('the final impinger reading is below the initial one');
      flag('mc-wf', wf < wi); if (wf < wi) problems.push('the final silica gel weight is below the initial one');
      flag('mc-vm', !(vm > 0)); if (!(vm > 0)) problems.push('the meter volume must be positive');
      flag('mc-y', !(y > 0.8 && y < 1.2)); if (!(y > 0.8 && y < 1.2)) problems.push('a meter factor is normally close to 1.000');
      flag('mc-pb', !(pb > 20 && pb < 32)); if (!(pb > 20 && pb < 32)) problems.push('barometric pressure is entered in in. Hg, typically 24–31');
      const status = $('#mc-status');
      if (problems.length || !Number.isFinite(bws)) {
        status.innerHTML = `<span class="status fail">Check the inputs</span><p class="ctl-help" style="margin-top:.5rem">${problems.length ? problems.join('; ').replace(/^./, (c) => c.toUpperCase()) + '.' : 'Some fields are empty.'}</p>`;
      } else if (bws > 0.5) {
        status.innerHTML = `<span class="status warn">${fmt(bws * 100, 1)}% moisture is unusually high: run the saturation check</span>`;
      } else {
        status.innerHTML = `<span class="status pass">Stack gas is ${fmt(bws * 100, 1)}% water vapor</span>`;
      }
    }

    ST.seg('mc-mode', (m) => {
      mode = m;
      const vol = m === 'vol';
      $('#mc-vi-lab').textContent = vol ? 'Impinger water, initial' : 'Impingers 1–3, initial weight';
      $('#mc-vf-lab').textContent = vol ? 'Impinger water, final' : 'Impingers 1–3, final weight';
      $('#mc-u1').textContent = $('#mc-u2').textContent = vol ? 'mL' : 'g';
      run();
    });
    ids.forEach((id) => $('#' + id).addEventListener('input', run));
    run();
  })();

  /* =========================================================
     Bench 4: saturation check chart
     ========================================================= */
  (function satBench() {
    const svg = $('#m4-sat-svg');
    if (!svg) return;
    const x0 = 90, x1 = 960, y0 = 28, y1 = 320;
    const T0 = 60, T1 = 220, B1 = 0.7;
    const X = (t) => x0 + ((t - T0) / (T1 - T0)) * (x1 - x0);
    const Y = (b) => y1 - (b / B1) * (y1 - y0);
    const tsIn = $('#sa-ts'), measIn = $('#sa-meas'), psIn = $('#sa-ps');

    const clip = el('clipPath', { id: 'm4-sat-clip' }, el('defs', {}, svg));
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, clip);
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'dg-panel' }, svg);
    const dyn = el('g', {}, svg);
    for (let t = T0; t <= T1; t += 20) {
      el('line', { x1: X(t), x2: X(t), y1: y0, y2: y1, class: 'dg-rule', opacity: 0.45 }, svg);
      el('text', { x: X(t), y: y1 + 20, class: 'dg-label', 'text-anchor': 'middle', text: t }, svg);
    }
    for (let b = 0; b <= B1 + 1e-9; b += 0.1) {
      el('line', { x1: x0, x2: x1, y1: Y(b), y2: Y(b), class: 'dg-rule', opacity: 0.45 }, svg);
      el('text', { x: x0 - 10, y: Y(b) + 4, class: 'dg-label', 'text-anchor': 'end', text: `${Math.round(b * 100)}%` }, svg);
    }
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'dg-rule' }, svg);
    el('text', { x: (x0 + x1) / 2, y: y1 + 46, class: 'dg-label', 'text-anchor': 'middle', text: 'Stack temperature, °F' }, svg);
    el('text', { class: 'dg-label', 'text-anchor': 'middle', transform: `translate(${x0 - 56} ${(y0 + y1) / 2}) rotate(-90)`, text: 'Moisture fraction, Bws' }, svg);
    const curveG = el('g', { 'clip-path': 'url(#m4-sat-clip)' }, svg);
    svg.appendChild(dyn);

    function draw() {
      const ts = +tsIn.value, meas = +measIn.value / 100, ps = +psIn.value;
      $('#sa-ts-out').textContent = `${ts} °F`;
      $('#sa-meas-out').textContent = `${fmt(meas * 100, 1)}%`;
      $('#sa-ps-out').textContent = `${fmt(ps, 2)} in. Hg`;
      const sat = (t) => Math.min(1, pvInHg(t) / ps);

      curveG.innerHTML = '';
      let line = '', area = `M${X(T0)},${y0} `;
      for (let t = T0; t <= T1; t += 1) {
        const p = `${X(t)},${Y(sat(t))}`;
        line += (line ? ' L' : 'M') + p;
        area += `L${p} `;
      }
      area += `L${X(T1)},${y0} Z`;
      el('path', { d: area, style: 'fill:var(--water-soft)' }, curveG);
      el('path', { d: line, style: 'fill:none;stroke:var(--water);stroke-width:3' }, curveG);
      el('text', { x: X(78), y: Y(0.52), class: 'dg-label-strong', text: 'Above the curve: vapor plus droplets' }, curveG);
      el('text', { x: X(150), y: Y(0.04), class: 'dg-label', text: 'Below the curve: all vapor' }, curveG);
      const tLab = 170;
      el('text', { x: X(tLab) + 10, y: Math.max(y0 + 16, Y(sat(tLab)) + 4), class: 'dg-label', style: 'fill:var(--water)', text: 'saturation' }, curveG);

      dyn.innerHTML = '';
      const s = sat(ts);
      const use = Math.min(s, meas);
      const xs = X(ts);
      el('line', { x1: xs, x2: xs, y1: y1, y2: Y(Math.min(B1, Math.max(s, meas))), style: 'stroke:var(--ink-3);stroke-dasharray:3 4' }, dyn);
      if (meas > s) {
        el('line', { x1: xs, x2: xs, y1: Y(Math.min(meas, B1)) + 9, y2: Y(Math.min(s, B1)) - 10, style: 'stroke:var(--gauge);stroke-width:2', 'marker-end': 'url(#m4-sat-arr)' }, dyn);
      }
      el('circle', { cx: xs, cy: Y(Math.min(s, B1)), r: 7, style: 'fill:var(--panel);stroke:var(--water);stroke-width:3' }, dyn);
      el('circle', { cx: xs, cy: Y(Math.min(meas, B1)), r: 7, style: `fill:${meas > s ? 'var(--gauge)' : 'var(--accent)'}` }, dyn);
      const right = xs < (x0 + x1) / 2;
      el('text', { x: xs + (right ? 14 : -14), y: Y(Math.min(meas, B1)) + 4, class: 'dg-label-strong', 'text-anchor': right ? 'start' : 'end', text: `measured ${fmt(meas * 100, 1)}%` }, dyn);
      el('text', { x: xs + (right ? 14 : -14), y: Y(Math.min(s, B1)) + (meas > s ? 18 : -10), class: 'dg-label', 'text-anchor': right ? 'start' : 'end', text: `saturation ${fmt(s * 100, 1)}%` }, dyn);

      $('#sa-sat').innerHTML = pct(s);
      $('#sa-use').innerHTML = pct(use);
      $('#sa-status').innerHTML = meas > s
        ? '<span class="status warn">Measured value is above saturation: use the saturation value</span>'
        : '<span class="status pass">Measured value is below saturation: use the measured value</span>';
    }
    const m = el('marker', { id: 'm4-sat-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, el('defs', {}, svg));
    el('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--gauge)' }, m);
    [tsIn, measIn, psIn].forEach((i) => i.addEventListener('input', draw));
    draw();
  })();
})();
