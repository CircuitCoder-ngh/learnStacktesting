/* Method 5: particulate matter — interactive benches. */
(function () {
  'use strict';
  const { $, $$, svg: el, fmt, clamp } = ST;

  /* ---------- Shared Method 5 maths (English units) ---------- */
  const KP = 85.49;      // pitot constant, ft/s · [(lb/lb-mole)(in. Hg)/((°R)(in. H2O))]^½
  const K1 = 17.64;      // °R/in. Hg, Vm(std)
  const K2 = 0.04706;    // ft³/mL, water vapor volume
  const K3 = 0.0154;     // gr/mg
  const K4 = 0.09450;    // isokinetic constant (θ in min, An in ft², vs in ft/s)
  const T_STD = 528, P_STD = 29.92;
  const NOZZLES = [0.125, 0.1875, 0.25, 0.3125, 0.375, 0.4375, 0.5];
  const NOZZLE_LABEL = { 0.125: '1/8', 0.1875: '3/16', 0.25: '1/4', 0.3125: '5/16', 0.375: '3/8', 0.4375: '7/16', 0.5: '1/2' };

  const msWet = (md, bws) => md * (1 - bws) + 18.0 * bws;
  const velocity = (cp, sqrtDp, tsR, ps, ms) => KP * cp * sqrtDp * Math.sqrt(tsR / (ps * ms));
  /** Number formatted for TeX: thousands separators wrapped so KaTeX does not add spacing. */
  const tn = (n, d) => fmt(n, d).replace(/,/g, '{,}');

  /** Build a grid of labelled number inputs. fields: [{id,label,unit,value,step}] */
  function buildForm(host, fields, prefix, onInput) {
    host.innerHTML = fields
      .map((f) => `<label for="${prefix}-${f.id}"><span>${f.label}${f.unit ? ` <em>${f.unit}</em>` : ''}</span>
        <input class="field" type="number" inputmode="decimal" id="${prefix}-${f.id}" value="${f.value}" step="${f.step || 'any'}"></label>`)
      .join('');
    host.addEventListener('input', onInput);
    return {
      read() {
        const v = {};
        let ok = true;
        fields.forEach((f) => {
          const input = document.getElementById(`${prefix}-${f.id}`);
          const n = parseFloat(input.value);
          const bad = !Number.isFinite(n) || (!!f.positive && n <= 0);
          input.classList.toggle('is-bad', bad);
          if (bad) ok = false;
          v[f.id] = n;
        });
        v.ok = ok;
        return v;
      },
      reset() { fields.forEach((f) => (document.getElementById(`${prefix}-${f.id}`).value = f.value)); },
    };
  }

  /* =========================================================
     Bench 1: sampling train explorer
     ========================================================= */
  (function trainBench() {
    const svg = $('#train-svg');
    if (!svg) return;

    const PARTS = {
      nozzle: {
        name: 'Nozzle',
        text: 'A buttonhook or elbow nozzle with a sharp, tapered leading edge faces straight into the flow. Its size is chosen so the sampling rate can match the stack velocity at every traverse point.',
        facts: ['Stainless steel, glass, or quartz', 'Inside diameter measured three times to 0.001 in.; the readings must agree within 0.004 in.', 'Brushed and rinsed into the front-half sample'],
      },
      pitot: {
        name: 'Type S pitot tube and thermocouple',
        text: 'Mounted alongside the nozzle so velocity head (Δp) and stack temperature are read at the same point being sampled. The pitot lines run back to an inclined manometer in the meter box.',
        facts: ['Spacing from the nozzle follows Method 2 so the two do not interfere', 'Pitot lines are leak checked with the train', 'Temperature feeds the velocity and isokinetic calculations'],
      },
      probe: {
        name: 'Heated probe',
        text: 'A borosilicate glass liner, or quartz for hotter stacks, inside a stainless sheath. It is heated so nothing condenses before the filter. Particulate that settles in the probe is part of the sample.',
        facts: ['Heated to keep the gas near the filter temperature', 'Brushed and rinsed with acetone at recovery', 'Long probes need support at the port'],
      },
      filter: {
        name: 'Heated filter',
        text: 'A glass-fiber filter on a glass frit support, in a borosilicate holder inside a heated box. The filter temperature defines what Method 5 counts as particulate.',
        facts: ['Held at 248 ± 25 °F (120 ± 14 °C)', 'Filter removes at least 99.95% of 0.3 µm test particles', 'Rising train vacuum is the sign of a loading filter'],
      },
      impingers: {
        name: 'Impingers in an ice bath',
        text: 'Glass impingers in series condense the water in the sample. The first two hold 100 mL of water each and the third starts empty. They sit in crushed ice for the whole run.',
        facts: ['Measured by volume or weight for the Method 4 moisture result', 'This is the back half: not part of the Method 5 PM catch', 'Condensable PM in the back half is Method 202'],
      },
      silica: {
        name: 'Silica gel',
        text: 'The fourth impinger holds about 200–300 g of silica gel to strip the last water vapor, so the meter measures dry gas. Indicating gel changes color as it fills up.',
        facts: ['Gas leaving it must be 68 °F (20 °C) or colder', 'Weighed before and after for the moisture catch', 'Spent gel lets water reach the meter'],
      },
      umbilical: {
        name: 'Umbilical',
        text: 'A bundle that carries the sample line, pitot lines, thermocouple wires, and heater power between the platform and the meter box. Everything after the impingers must stay leak-free, because a leak here adds air the meter counts as sample.',
        facts: ['Included in every leak check', 'Lets the meter box sit away from the port'],
      },
      vacuum: {
        name: 'Vacuum gauge',
        text: 'Shows how hard the pump is pulling on the train. Vacuum climbs as the filter loads with particulate.',
        facts: ['Recorded at every traverse point', 'The highest vacuum of the run sets the minimum vacuum for the post-test leak check'],
      },
      pump: {
        name: 'Pump and valves',
        text: 'A leak-free pump with coarse and fine (bypass) valves lets the operator dial in the exact sampling rate at each point.',
        facts: ['Adjusted at every traverse point', 'Must not leak outside air into the metered gas'],
      },
      dgm: {
        name: 'Dry gas meter',
        text: 'Measures the total sample volume, Vm, with inlet and outlet temperatures recorded for the meter temperature Tm. It is calibrated against a reference meter to get its correction factor, Y.',
        facts: ['Accurate to within 2%', 'Y is re-checked after the test', 'Sees only dry gas'],
      },
      orifice: {
        name: 'Orifice and manometers',
        text: 'The pressure drop across a calibrated orifice, ΔH, shows the sampling rate in real time. Inclined manometers show ΔH and the pitot Δp side by side so the operator can set ΔH = K·Δp.',
        facts: ['ΔH@ is the ΔH that gives 0.75 cfm at 68 °F and 29.92 in. Hg', 'Read and set at every traverse point'],
      },
    };
    const ORDER = ['nozzle', 'pitot', 'probe', 'filter', 'impingers', 'silica', 'umbilical', 'vacuum', 'pump', 'dgm', 'orifice'];

    const layer = {
      back: el('g', {}, svg),
      flow: el('g', {}, svg),
      parts: el('g', {}, svg),
      dots: el('g', {}, svg),
      top: el('g', {}, svg),
    };
    const groups = {};
    const part = (id) => {
      const g = el('g', { class: 'train-part', 'data-part': id, tabindex: 0, role: 'button', 'aria-label': PARTS[id].name, 'aria-pressed': 'false' }, layer.parts);
      groups[id] = g;
      return g;
    };
    const hit = (g, x, y, w, h) => el('rect', { class: 'hit', x, y, width: w, height: h, rx: 6 }, g);
    const tag = (x, y, text) => {
      const g = el('g', { class: 'm5-tag' }, layer.top);
      const t = el('text', { x: x + 8, y: y + 15, text }, g);
      const w = t.getComputedTextLength ? t.getComputedTextLength() + 16 : text.length * 7 + 16;
      const r = el('rect', { x, y, width: w, height: 22, rx: 11 }, g);
      g.insertBefore(r, t);
      return g;
    };

    /* --- Stack --- */
    el('rect', { x: 0, y: 0, width: 124, height: 380, style: 'fill:color-mix(in srgb, var(--gas) 7%, var(--panel))' }, layer.back);
    el('rect', { x: 124, y: 0, width: 12, height: 140, class: 'dg-wall' }, layer.back);
    el('rect', { x: 124, y: 160, width: 12, height: 220, class: 'dg-wall' }, layer.back);
    el('text', { x: 12, y: 26, class: 'dg-label-strong', text: 'Stack' }, layer.back);
    const stackStreaks = Array.from({ length: 16 }, (_, i) => ({
      x: 10 + ((i * 37) % 104), y: (i * 61) % 380, line: el('line', { class: 'dg-gas-stroke', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.45 }, layer.back),
    }));

    /* --- Pitot lines (drawn behind parts) --- */
    el('path', { d: 'M318,136 L318,40 L906,40 L906,104', style: 'fill:none;stroke:var(--gauge);stroke-width:1.4;stroke-dasharray:5 4;opacity:.75' }, layer.back);
    el('text', { x: 328, y: 32, class: 'dg-label', text: 'Pitot lines to the Δp manometer' }, layer.back);

    /* --- Probe --- */
    let g = part('probe');
    hit(g, 72, 140, 262, 22);
    el('rect', { x: 62, y: 143, width: 272, height: 14, rx: 3, class: 'dg-wall' }, g);
    el('line', { x1: 64, x2: 334, y1: 150, y2: 150, style: 'stroke:var(--panel);stroke-width:2.5;opacity:.8' }, g);
    let zig = 'M150,145';
    for (let x = 156; x <= 320; x += 6) zig += ` L${x},${x % 12 ? 155 : 145}`;
    el('path', { d: zig, style: 'fill:none;stroke:var(--gauge);stroke-width:1;opacity:.6' }, g);

    /* --- Pitot head and thermocouple --- */
    g = part('pitot');
    hit(g, 44, 120, 74, 22);
    el('line', { x1: 56, x2: 318, y1: 136, y2: 136, style: 'stroke:var(--steel-dark);stroke-width:2.5' }, g);
    el('path', { d: 'M56,127 L56,145 M52,127 L60,127 M52,145 L60,145', style: 'stroke:var(--ink);stroke-width:2;fill:none' }, g);
    el('line', { x1: 74, x2: 74, y1: 157, y2: 172, style: 'stroke:var(--ink);stroke-width:1.5' }, g);
    el('circle', { cx: 74, cy: 173, r: 2.5, style: 'fill:var(--gauge)' }, g);

    /* --- Nozzle --- */
    g = part('nozzle');
    hit(g, 32, 144, 40, 66);
    el('path', { d: 'M66,150 Q50,150 50,166 L50,198', style: 'fill:none;stroke:var(--steel-dark);stroke-width:7' }, g);
    el('path', { d: 'M66,150 Q50,150 50,166 L50,198', style: 'fill:none;stroke:var(--panel);stroke-width:2.5;opacity:.8' }, g);
    el('path', { d: 'M44,200 L56,200', style: 'stroke:var(--accent);stroke-width:3' }, g);

    /* --- Filter box --- */
    g = part('filter');
    hit(g, 336, 92, 136, 136);
    el('rect', { x: 336, y: 92, width: 136, height: 136, rx: 8, class: 'dg-panel', style: 'stroke:var(--ink);stroke-width:1.8' }, g);
    el('text', { x: 404, y: 112, class: 'dg-label', 'text-anchor': 'middle', text: 'Heated box' }, g);
    el('path', { d: 'M366,150 L392,128 L392,172 Z', style: 'fill:color-mix(in srgb, var(--steel) 18%, transparent);stroke:var(--ink);stroke-width:1.5' }, g);
    el('path', { d: 'M416,128 L442,150 L416,172 Z', style: 'fill:color-mix(in srgb, var(--steel) 18%, transparent);stroke:var(--ink);stroke-width:1.5' }, g);
    el('rect', { x: 392, y: 126, width: 24, height: 48, style: 'fill:var(--panel);stroke:var(--ink);stroke-width:1.2' }, g);
    const cake = el('rect', { x: 398, y: 128, width: 12, height: 44, style: 'fill:var(--soot)', opacity: 0.15 }, g);
    el('line', { x1: 404, x2: 404, y1: 128, y2: 172, style: 'stroke:var(--ink-3);stroke-width:1;stroke-dasharray:2 2' }, g);
    el('path', { d: 'M352,212 q6,-8 12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0', style: 'fill:none;stroke:var(--gauge);stroke-width:1.6' }, g);
    // probe-to-filter and filter-to-impinger glass
    el('path', { d: 'M334,150 L366,150 M442,150 L500,150 L500,80 L536,80', style: 'fill:none;stroke:var(--ink);stroke-width:2' }, layer.back);

    /* --- Ice bath + impingers --- */
    el('rect', { x: 486, y: 64, width: 286, height: 276, rx: 10, style: 'fill:var(--water-soft);stroke:var(--water);stroke-width:1.5' }, layer.back);
    el('text', { x: 498, y: 330, class: 'dg-label', text: 'Ice bath' }, layer.back);
    [[500, 300], [566, 316], [628, 304], [690, 318], [752, 300], [512, 190], [748, 200]].forEach(([x, y], i) =>
      el('rect', { x, y, width: 12, height: 12, rx: 2, transform: `rotate(${i * 23} ${x + 6} ${y + 6})`, style: 'fill:var(--panel);stroke:var(--water);stroke-width:1;opacity:.85' }, layer.back));
    const IMP = [536, 596, 656, 716];
    const impG = part('impingers');
    hit(impG, 512, 66, 172, 258);
    const silG = part('silica');
    hit(silG, 692, 66, 50, 258);
    IMP.forEach((cx, i) => {
      const host = i === 3 ? silG : impG;
      el('rect', { x: cx - 19, y: 88, width: 38, height: 230, rx: 10, style: 'fill:color-mix(in srgb, var(--panel) 88%, transparent);stroke:var(--ink);stroke-width:1.5' }, host);
      if (i < 2) el('rect', { x: cx - 17, y: 258, width: 34, height: 58, rx: 8, style: 'fill:var(--water);opacity:.38' }, host);
      if (i === 3) {
        el('rect', { x: cx - 17, y: 168, width: 34, height: 148, rx: 8, style: 'fill:var(--water);opacity:.16' }, host);
        for (let yy = 176; yy < 312; yy += 8)
          for (let xx = cx - 12; xx <= cx + 12; xx += 8) el('circle', { cx: xx + ((yy / 8) % 2) * 3, cy: yy, r: 2.4, style: 'fill:var(--water);opacity:.55' }, host);
      }
      el('line', { x1: cx, x2: cx, y1: 80, y2: 300, style: 'stroke:var(--ink);stroke-width:1.5' }, host);
      el('text', { x: cx, y: 106, class: 'dg-label', 'text-anchor': 'middle', text: i + 1, style: 'font-size:11px' }, host);
      if (i < 3) el('path', { d: `M${cx + 10},88 L${cx + 10},76 L${IMP[i + 1]},76 L${IMP[i + 1]},84`, style: 'fill:none;stroke:var(--ink);stroke-width:2' }, host);
    });

    /* --- Umbilical --- */
    g = part('umbilical');
    el('path', { d: 'M726,88 L726,76 L762,76 C 812,76 800,210 836,210', style: 'fill:none;stroke:transparent;stroke-width:22', class: 'hit' }, g);
    el('path', { d: 'M762,76 C 812,76 800,210 836,210', style: 'fill:none;stroke:var(--ink-3);stroke-width:11;stroke-linecap:round;opacity:.35' }, g);
    el('path', { d: 'M726,88 L726,76 L762,76 C 812,76 800,210 836,210', style: 'fill:none;stroke:var(--ink);stroke-width:2' }, g);

    /* --- Meter box --- */
    el('rect', { x: 836, y: 64, width: 154, height: 288, rx: 10, class: 'dg-panel', style: 'stroke:var(--ink);stroke-width:1.8' }, layer.back);
    el('text', { x: 913, y: 344, class: 'dg-label-strong', 'text-anchor': 'middle', text: 'Meter box' }, layer.back);
    // manometers + orifice
    g = part('orifice');
    hit(g, 844, 90, 140, 52);
    const mano = (y, label, frac) => {
      el('line', { x1: 874, y1: y + 8, x2: 976, y2: y - 3, style: 'stroke:var(--rule-strong);stroke-width:8;stroke-linecap:round' }, g);
      el('line', { x1: 874, y1: y + 8, x2: 976, y2: y - 3, style: 'stroke:var(--panel);stroke-width:4.5;stroke-linecap:round' }, g);
      el('line', { x1: 874, y1: y + 8, x2: 874 + 102 * frac, y2: y + 8 - 11 * frac, style: 'stroke:var(--gauge);stroke-width:4.5;stroke-linecap:round' }, g);
      el('text', { x: 846, y: y + 10, class: 'dg-label', 'text-anchor': 'start', text: label, style: 'font-size:11px' }, g);
    };
    mano(104, 'Δp', 0.42);
    mano(128, 'ΔH', 0.78);
    hit(g, 966, 264, 24, 52);
    el('path', { d: 'M972,270 L978,290 L984,270 M972,312 L978,292 L984,312', style: 'fill:none;stroke:var(--ink);stroke-width:1.6' }, g);
    // vacuum gauge
    g = part('vacuum');
    hit(g, 850, 158, 44, 44);
    el('line', { x1: 872, x2: 872, y1: 196, y2: 210, style: 'stroke:var(--ink);stroke-width:2' }, g);
    el('circle', { cx: 872, cy: 180, r: 17, class: 'dg-panel', style: 'stroke:var(--ink);stroke-width:1.8' }, g);
    el('line', { x1: 872, y1: 180, x2: 862, y2: 170, style: 'stroke:var(--gauge);stroke-width:2;stroke-linecap:round' }, g);
    // pump
    g = part('pump');
    hit(g, 850, 254, 44, 50);
    el('circle', { cx: 872, cy: 278, r: 19, class: 'dg-panel', style: 'stroke:var(--ink);stroke-width:1.8' }, g);
    const impeller = el('g', {}, g);
    [0, 60, 120].forEach((a) => el('line', { x1: -11, x2: 11, y1: 0, y2: 0, transform: `rotate(${a})`, style: 'stroke:var(--ink-2);stroke-width:2.2;stroke-linecap:round' }, impeller));
    // dry gas meter
    g = part('dgm');
    hit(g, 912, 182, 64, 64);
    el('circle', { cx: 944, cy: 214, r: 28, class: 'dg-panel', style: 'stroke:var(--ink);stroke-width:2' }, g);
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      el('line', { x1: 944 + Math.cos(a) * 22, y1: 214 + Math.sin(a) * 22, x2: 944 + Math.cos(a) * (k % 5 ? 25 : 27), y2: 214 + Math.sin(a) * (k % 5 ? 25 : 27), style: 'stroke:var(--ink-3);stroke-width:1' }, g);
    }
    const needle = el('line', { x1: 944, y1: 214, x2: 944, y2: 194, style: 'stroke:var(--gauge);stroke-width:2.2;stroke-linecap:round' }, g);
    el('circle', { cx: 944, cy: 214, r: 2.5, style: 'fill:var(--ink)' }, g);

    /* --- Temperature tags --- */
    tag(358, 62, '248 ± 25 °F');
    tag(640, 36, 'Exit ≤ 68 °F');
    tag(10, 346, 'Stack gas ~320 °F');

    /* --- Gas route and moving dots --- */
    const V = [
      [50, 262], [50, 198], [50, 166], [56, 155], [66, 150], [404, 150],
      [500, 150], [500, 80], [536, 80], [536, 296], [546, 296], [546, 80],
      [596, 80], [596, 296], [606, 296], [606, 80], [656, 80], [656, 296], [666, 296], [666, 80],
      [716, 80], [716, 296], [726, 296], [726, 76], [762, 76], [790, 90], [806, 150], [818, 196], [836, 210],
      [872, 210], [872, 297], [872, 322], [910, 322], [910, 214], [944, 214], [978, 214], [978, 334], [1004, 334],
    ];
    const cum = [0];
    for (let i = 1; i < V.length; i++) cum.push(cum[i - 1] + Math.hypot(V[i][0] - V[i - 1][0], V[i][1] - V[i - 1][1]));
    const TOTAL = cum[cum.length - 1];
    const S_FILTER = cum[5], S_IMP1 = cum[9], S_IMP2 = cum[13];
    el('polyline', { points: V.map((p) => p.join(',')).join(' '), style: 'fill:none;stroke:var(--gas);stroke-width:1.2;stroke-dasharray:3 5;opacity:.45' }, layer.flow);
    // MeterBox internal piping
    el('path', { d: 'M836,210 L872,210 L872,259 M872,297 L872,322 L910,322 L910,214 L916,214 M972,214 L978,214 L978,270 M978,312 L978,334 L990,334', style: 'fill:none;stroke:var(--ink);stroke-width:1.6' }, layer.back);
    el('text', { x: 998, y: 370, class: 'dg-label', 'text-anchor': 'end', text: 'Exhaust', style: 'font-size:11px' }, layer.top);

    const at = (s) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [ST.lerp(V[i - 1][0], V[i][0], f), ST.lerp(V[i - 1][1], V[i][1], f)];
    };
    const pickType = () => { const r = Math.random(); return r < 0.18 ? 'pm' : r < 0.42 ? 'water' : 'gas'; };
    const dots = Array.from({ length: 36 }, (_, i) => {
      const type = pickType();
      return { s: (i / 36) * TOTAL, type, stop: type === 'water' ? (Math.random() < 0.65 ? S_IMP1 : S_IMP2) : 0, fade: 1, c: el('circle', { r: 3 }, layer.dots) };
    });
    const styleDot = (d) => {
      const fill = d.type === 'pm' ? 'var(--soot)' : d.type === 'water' ? 'var(--water)' : 'var(--gas)';
      d.c.setAttribute('style', `fill:${fill}`);
      d.c.setAttribute('r', d.type === 'pm' ? 3.4 : d.type === 'water' ? 2.8 : 2.4);
    };
    dots.forEach(styleDot);
    let caught = 0;

    const highlight = el('rect', { class: 'm5-hl', rx: 9 }, layer.top);

    function step(dt, t) {
      const speed = 120;
      for (const d of dots) {
        if (d.fade < 1) {
          d.fade -= dt * 2.2;
          if (d.fade <= 0) { d.s = 0; d.type = pickType(); d.stop = d.type === 'water' ? (Math.random() < 0.65 ? S_IMP1 : S_IMP2) : 0; d.fade = 1; styleDot(d); }
        } else {
          d.s += speed * dt;
          if (d.type === 'pm' && d.s >= S_FILTER) { d.s = S_FILTER; d.fade = 0.99; caught++; }
          else if (d.type === 'water' && d.s >= d.stop) { d.s = d.stop; d.fade = 0.99; }
          else if (d.s >= TOTAL) { d.s = TOTAL; d.fade = 0.99; }
        }
        const [x, y] = at(d.s);
        d.c.setAttribute('cx', x);
        d.c.setAttribute('cy', y);
        d.c.setAttribute('opacity', clamp(d.fade, 0, 1));
      }
      cake.setAttribute('opacity', 0.15 + 0.75 * Math.min(1, caught / 80));
      stackStreaks.forEach((s) => {
        const y = 380 - ((380 - s.y + t * 90) % 400);
        s.line.setAttribute('x1', s.x); s.line.setAttribute('x2', s.x);
        s.line.setAttribute('y1', y); s.line.setAttribute('y2', y + 14);
      });
      impeller.setAttribute('transform', `translate(872 278) rotate(${(t * 360) % 360})`);
      const a = t * 2.2;
      needle.setAttribute('x2', 944 + Math.sin(a) * 20);
      needle.setAttribute('y2', 214 - Math.cos(a) * 20);
    }

    /* --- Selection --- */
    const chips = $('#train-chips');
    chips.innerHTML = ORDER.map((id) => `<button type="button" class="m5-chip" data-part="${id}" aria-pressed="false">${PARTS[id].name}</button>`).join('');
    const desc = $('#train-desc');
    function select(id) {
      ORDER.forEach((k) => {
        groups[k].setAttribute('aria-pressed', String(k === id));
        chips.querySelector(`[data-part="${k}"]`).setAttribute('aria-pressed', String(k === id));
      });
      const b = groups[id].getBBox();
      highlight.setAttribute('x', b.x - 5); highlight.setAttribute('y', b.y - 5);
      highlight.setAttribute('width', b.width + 10); highlight.setAttribute('height', b.height + 10);
      const p = PARTS[id];
      desc.innerHTML = `<div><h3>${p.name}</h3><p>${p.text}</p></div><ul class="m5-facts">${p.facts.map((f) => `<li>${f}</li>`).join('')}</ul>`;
    }
    ORDER.forEach((id) => {
      const gEl = groups[id];
      gEl.addEventListener('click', () => select(id));
      gEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); } });
    });
    chips.addEventListener('click', (e) => { const b = e.target.closest('[data-part]'); if (b) select(b.dataset.part); });
    select('nozzle');
    ST.loop(svg, step, { buttonHost: svg.parentElement });
  })();

  /* =========================================================
     Bench 2: isokinetic simulator
     ========================================================= */
  (function isoBench() {
    const canvas = $('#iso-canvas');
    if (!canvas) return;
    const input = $('#iso-r');
    const SIZES = [1, 5, 10, 20, 40]; // µm, aerodynamic
    // Stokes number for unit-density spheres: 15 m/s gas, 0.25 in. (6.35 mm) nozzle, µ = 2.3e-5 Pa·s (hot flue gas)
    const U0_MS = 15, DN_M = 0.00635, MU = 2.3e-5, RHO = 1000;
    const stk = (dUm) => {
      const d = dUm * 1e-6;
      const cc = 1 + (2.52 * 0.068e-6) / d; // simple slip correction
      return (RHO * d * d * cc * U0_MS) / (18 * MU * DN_M);
    };
    const STK = SIZES.map(stk);
    /** Belyaev & Levin (1974): measured/true concentration for velocity ratio R = U/U0. */
    const bias = (R, s) => 1 + (1 / R - 1) * (1 - 1 / (1 + (2 + 0.62 * R) * s));

    let W = 0, H = 0, g = {}, R = +input.value / 100, lines = [], parts = [], spawnAcc = 0;
    let C = {};
    const readColors = () => {
      C = { well: ST.color('well'), gas: ST.color('gas'), soot: ST.color('soot'), steel: ST.color('steel'), steelDark: ST.color('steel-dark'), ink: ST.color('ink'), ink2: ST.color('ink-2'), panel: ST.color('panel') };
    };
    readColors();

    let ctx = null;
    // Resizing clears the canvas, so redraw immediately (matters when the loop is paused)
    const cv = ST.canvas(canvas, null, (w, h) => { W = w; H = h; layout(); if (ctx) draw(); });
    ctx = cv.ctx;

    function layout() {
      g = { yc: H / 2, a: Math.max(12, H * 0.11), xm: W * 0.62 };
      g.w = Math.max(4, g.a * 0.28);
      g.U0 = Math.max(90, W * 0.17);
      parts = [];
      computeLines();
    }

    /* Stream-tube model. Far upstream every streamline sits at its own offset y0 from the axis.
       The captured tube (radius rc = a·√R for a round nozzle) squeezes or spreads to fill the
       mouth; streamlines outside it bend around the lip. Axial speed follows from continuity. */
    function rc() { return g.a * Math.sqrt(R); }
    function S(x) { return 1 / (1 + Math.exp(-(x - (g.xm - 1.1 * g.a)) / (0.5 * g.a))); }
    function lipY() { return g.a + g.w + 1.5; }
    function yAt(y0, x) {
      const ay = Math.abs(y0), sg = y0 < 0 ? -1 : 1, r = rc();
      if (ay < r) {
        const Y = (y0 * g.a * 0.97) / r;
        return x >= g.xm ? Y : y0 + (Y - y0) * S(x);
      }
      const Y = y0 + (sg * (lipY() + (ay - r)) - y0) * Math.exp(-(ay - r) / (2.2 * g.a));
      if (x < g.xm) return y0 + (Y - y0) * S(x);
      const Yf = sg * Math.max(ay, lipY());
      return Y + (Yf - Y) * (1 - Math.exp(-(x - g.xm) / (3 * g.a)));
    }
    /** Invert yAt: which upstream offset passes through (x, y)? */
    function y0At(x, y) {
      if (x < g.xm - 6 * g.a || Math.abs(y) > 7 * g.a) return y;
      let lo = -9 * g.a, hi = 9 * g.a;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        if (yAt(mid, x) < y) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    function field(x, yAbs, U) {
      const y = yAbs - g.yc;
      if (x >= g.xm && Math.abs(y) < g.a) return [U, 0];
      if (x < g.xm - 6 * g.a || Math.abs(y) > 7 * g.a) return [g.U0, 0];
      const d = 0.5;
      const y0 = y0At(x, y);
      const dy0 = (y0At(x, y + d) - y0At(x, y - d)) / (2 * d);
      let u = Math.abs(y) < 0.05 * g.a ? g.U0 * dy0 * dy0 : g.U0 * (y0 / y) * dy0;
      u = clamp(u, 0.05 * g.U0, 3 * g.U0);
      const slope = (yAt(y0, x + d) - yAt(y0, x - d)) / (2 * d);
      return [u, u * slope];
    }

    function computeLines() {
      lines = [];
      const n = 21, span = 3.6 * g.a, r = rc();
      const seeds = [];
      for (let i = 0; i < n; i++) seeds.push(-span + (2 * span * i) / (n - 1));
      seeds.push(-r * 0.999, r * 0.999);
      seeds.forEach((y0, k) => {
        const pts = [];
        for (let x = 0; x <= W + 4; x += 4) pts.push([x, g.yc + yAt(y0, x)]);
        lines.push({ pts, inside: Math.abs(y0) < r, edge: k >= n });
      });
    }

    function spawn() {
      const si = Math.floor(Math.random() * SIZES.length);
      const y = g.yc + (Math.random() * 2 - 1) * 3.2 * g.a;
      const [u, v] = field(0, y, R * g.U0);
      parts.push({ x: 0, y, vx: u, vy: v, si, tau: (STK[si] * 2 * g.a) / g.U0, cap: false });
    }

    function step(dt) {
      if (!W) return;
      const U = R * g.U0;
      // advance particles
      spawnAcc += dt * 46;
      while (spawnAcc > 1) { spawnAcc--; if (parts.length < 180) spawn(); }
      const hMax = 0.004;
      for (const p of parts) {
        let rem = dt;
        while (rem > 1e-6 && !p.dead) {
          const h = Math.min(hMax, rem);
          rem -= h;
          const [u, v] = field(p.x, p.y, U);
          const f = Math.min(1, h / Math.max(p.tau, 1e-6));
          p.vx += (u - p.vx) * f;
          p.vy += (v - p.vy) * f;
          const nx = p.x + p.vx * h, ny = p.y + p.vy * h;
          if (p.x < g.xm && nx >= g.xm) {
            const dy = Math.abs(ny - g.yc);
            if (dy < g.a) p.cap = true;
            else if (dy < g.a + g.w) p.dead = true; // hits the nozzle lip
          }
          if (p.cap) { p.vy *= 0.6; }
          p.x = nx; p.y = ny;
          if (p.x > W + 5 || p.y < -10 || p.y > H + 10) p.dead = true;
        }
      }
      parts = parts.filter((p) => !p.dead);
      draw();
    }

    function draw() {
      ctx.fillStyle = C.well;
      ctx.fillRect(0, 0, W, H);
      // streamlines
      ctx.lineWidth = 1.3;
      for (const l of lines) {
        ctx.strokeStyle = l.edge ? C.ink : C.gas;
        ctx.globalAlpha = l.edge ? 0.7 : l.inside ? 0.8 : 0.3;
        ctx.lineWidth = l.edge ? 1.4 : 1.3;
        ctx.setLineDash(l.edge ? [5, 4] : []);
        ctx.beginPath();
        l.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // the captured stream tube, shaded
      const r = rc();
      ctx.fillStyle = C.gas;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      for (let x = 0; x <= g.xm; x += 4) ctx.lineTo(x, g.yc + yAt(-r * 0.999, x));
      for (let x = g.xm; x >= 0; x -= 4) ctx.lineTo(x, g.yc + yAt(r * 0.999, x));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // nozzle walls with a tapered leading edge
      const { xm, yc, a, w } = g;
      ctx.fillStyle = C.steel;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(xm, yc + s * a);
        ctx.lineTo(xm + w * 2.4, yc + s * (a + w));
        ctx.lineTo(W + 2, yc + s * (a + w));
        ctx.lineTo(W + 2, yc + s * a);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = C.ink2;
      ctx.font = '500 12px "Public Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Nozzle', xm + 10, yc - a - w - 10);
      ctx.fillText('Stack gas', 12, 20);
      ctx.fillText('Dashed: edge of the gas the nozzle captures', 12, H - 14);
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(78, 16); ctx.lineTo(100, 16); ctx.lineTo(95, 12); ctx.moveTo(100, 16); ctx.lineTo(95, 20); ctx.stroke();
      // particles
      const rad = [1.3, 1.9, 2.5, 3.3, 4.4];
      for (const p of parts) {
        ctx.globalAlpha = p.cap ? 1 : 0.55;
        ctx.fillStyle = C.soot;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad[p.si], 0, 6.283); ctx.fill();
        if (p.cap && rad[p.si] > 2) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      // velocity label inside the nozzle
      ctx.fillStyle = C.ink;
      ctx.font = '600 12px "Public Sans", system-ui, sans-serif';
      ctx.fillText(`${Math.round(R * 100)}% of stack velocity`, xm + 12, yc + 4);
    }

    // Bias read-outs
    const list = $('#iso-bias');
    list.innerHTML = SIZES.map((s, i) => `<div class="bias-row"><span class="bias-size"><span class="bias-dot" style="width:${[3, 4, 5, 7, 9][i]}px;height:${[3, 4, 5, 7, 9][i]}px"></span>${s} µm</span><span class="bias-track"><span class="bias-bar" id="bias-${i}"></span></span><span class="bias-val" id="bias-v-${i}"></span></div>`).join('') +
      '<div class="bias-axis"><span></span><span><span>−50%</span><span>0</span><span>+50%</span></span><span></span></div>';
    function updateBias() {
      SIZES.forEach((s, i) => {
        const b = bias(R, STK[i]) - 1;
        const bar = document.getElementById('bias-' + i);
        const w = Math.min(50, Math.abs(b) * 100) ;
        bar.style.left = b >= 0 ? '50%' : `${50 - w}%`;
        bar.style.width = `${w}%`;
        bar.className = 'bias-bar ' + (b >= 0 ? 'is-high' : 'is-low');
        document.getElementById('bias-v-' + i).textContent = (Math.abs(b) < 0.005 ? '' : b > 0 ? '+' : '−') + fmt(Math.abs(b) * 100, 0) + '%';
      });
      const pct = R * 100;
      const st = $('#iso-status');
      st.innerHTML = pct >= 90 && pct <= 110
        ? `<span class="status pass">${fmt(pct, 0)}% isokinetic: within 90–110%</span>`
        : `<span class="status ${pct < 90 ? 'fail' : 'warn'}">${fmt(pct, 0)}%: ${pct < 90 ? 'sub-isokinetic, coarse PM biased high' : 'super-isokinetic, coarse PM biased low'}</span>`;
    }

    let loop = null;
    ST.bind(input, 'iso-r-out', (v) => `${v}%`, (v) => { R = v / 100; computeLines(); updateBias(); if (!loop || !loop.playing) draw(); });
    $$('[data-iso]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.iso; input.dispatchEvent(new Event('input')); }));
    loop = ST.loop(canvas, step, { buttonHost: canvas.parentElement });
    ST.onTheme(() => { readColors(); draw(); });
    updateBias();
  })();

  /* =========================================================
     Bench 3: nozzle and K-factor calculator
     ========================================================= */
  (function nozzleBench() {
    const host = $('#nz-form');
    if (!host) return;
    const FIELDS = [
      { id: 'dp', label: 'Average Δp', unit: 'in. H₂O', value: 0.5, positive: true },
      { id: 'dpmin', label: 'Lowest Δp', unit: 'in. H₂O', value: 0.3, positive: true },
      { id: 'dpmax', label: 'Highest Δp', unit: 'in. H₂O', value: 0.85, positive: true },
      { id: 'ts', label: 'Stack temperature', unit: '°F', value: 320 },
      { id: 'tm', label: 'Meter temperature', unit: '°F', value: 75 },
      { id: 'pbar', label: 'Barometric pressure', unit: 'in. Hg', value: 29.65, positive: true },
      { id: 'pg', label: 'Stack static pressure', unit: 'in. H₂O', value: -0.45 },
      { id: 'bws', label: 'Moisture', unit: '%', value: 10 },
      { id: 'md', label: 'Dry molecular weight', unit: 'lb/lb-mole', value: 29.9, positive: true },
      { id: 'cp', label: 'Pitot coefficient, Cp', unit: '', value: 0.84, positive: true },
      { id: 'dha', label: 'Orifice coefficient, ΔH@', unit: 'in. H₂O', value: 1.84, positive: true },
      { id: 'qm', label: 'Target meter rate', unit: 'cfm', value: 0.75, positive: true },
    ];
    let picked = null; // user's nozzle choice; null means follow the ideal
    const form = buildForm(host, FIELDS, 'nz', () => compute());
    const seg = $('#nz-pick');
    seg.innerHTML = NOZZLES.map((d) => `<button type="button" data-value="${d}" aria-pressed="false">${NOZZLE_LABEL[d]}</button>`).join('');
    seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { picked = +b.dataset.value; compute(); } });

    function compute() {
      const v = form.read();
      if (!v.ok || v.ts <= -460 || v.tm <= -460 || v.bws < 0 || v.bws >= 100) {
        $('#nz-status').innerHTML = '<span class="status warn">Enter valid values in every field</span>';
        return;
      }
      const Ts = v.ts + 460, Tm = v.tm + 460, Ps = v.pbar + v.pg / 13.6, B = v.bws / 100;
      const Ms = msWet(v.md, B);
      const vs = (dp) => velocity(v.cp, Math.sqrt(dp), Ts, Ps, Ms);
      const Pm0 = v.pbar + v.dha / 13.6;
      const qstdTarget = v.qm * (T_STD / Tm) * (Pm0 / P_STD);
      const anIdeal = qstdTarget / (60 * vs(v.dp) * (1 - B) * (T_STD / Ts) * (Ps / P_STD));
      const dnIdeal = Math.sqrt((4 * anIdeal) / Math.PI) * 12;
      const nearest = NOZZLES.reduce((a, b) => (Math.abs(b - dnIdeal) < Math.abs(a - dnIdeal) ? b : a));
      const Dn = picked || nearest;
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.value === Dn)));
      const An = (Math.PI * Math.pow(Dn / 12, 2)) / 4;
      const kBase = 846.72 * Math.pow(Dn, 4) * v.dha * v.cp * v.cp * Math.pow(1 - B, 2) * (v.md / Ms) * (Tm / Ts) * Ps;
      const dH = (dp) => {
        let Pm = v.pbar, h = 0;
        for (let i = 0; i < 5; i++) { h = (kBase / Pm) * dp; Pm = v.pbar + h / 13.6; }
        return { h, Pm };
      };
      const meterRate = (dp) => {
        const { h, Pm } = dH(dp);
        const qstd = 60 * vs(dp) * An * (1 - B) * (T_STD / Ts) * (Ps / P_STD);
        return { h, q: qstd * (Tm / T_STD) * (P_STD / Pm), Pm };
      };
      const avg = meterRate(v.dp);
      const K = avg.h / v.dp;

      $('#nz-vs').innerHTML = `${fmt(vs(v.dp), 1)}<span class="readout-unit">ft/s</span>`;
      $('#nz-ideal').innerHTML = `${fmt(dnIdeal, 3)}<span class="readout-unit">in.</span>`;
      $('#nz-k').textContent = fmt(K, 3);
      $('#nz-q').innerHTML = `${fmt(avg.q, 2)}<span class="readout-unit">cfm</span>`;

      // ΔH table across the expected Δp range
      const lo = Math.min(v.dpmin, v.dpmax), hi = Math.max(v.dpmin, v.dpmax);
      const rows = [];
      for (let i = 0; i < 6; i++) rows.push(lo + ((hi - lo) * i) / 5);
      if (!rows.some((r) => Math.abs(r - v.dp) < 1e-9)) rows.push(v.dp);
      rows.sort((a, b) => a - b);
      $('#nz-table').innerHTML = `<caption>Settings for a ${NOZZLE_LABEL[Dn]} in. nozzle</caption><thead><tr><th class="n">Δp, in. H₂O</th><th class="n">Velocity, ft/s</th><th class="n">Set ΔH, in. H₂O</th><th class="n">Meter rate, cfm</th></tr></thead><tbody>${rows
        .map((dp) => { const r = meterRate(dp); return `<tr class="${Math.abs(dp - v.dp) < 1e-9 ? 'is-avg' : ''}"><td class="n">${fmt(dp, 2)}</td><td class="n">${fmt(vs(dp), 1)}</td><td class="n">${fmt(r.h, 2)}</td><td class="n">${fmt(r.q, 2)}</td></tr>`; })
        .join('')}</tbody>`;

      const qLo = meterRate(lo).q, qHi = meterRate(hi).q;
      const st = $('#nz-status');
      if (qHi > 1.1) st.innerHTML = `<span class="status warn">High rate at the top of the range</span><p class="ctl-help" style="margin-top:.4rem">At Δp ${fmt(hi, 2)} the meter would run ${fmt(qHi, 2)} cfm. A smaller nozzle keeps vacuum and filter loading manageable.</p>`;
      else if (qLo < 0.35) st.innerHTML = `<span class="status warn">Low rate at the bottom of the range</span><p class="ctl-help" style="margin-top:.4rem">At Δp ${fmt(lo, 2)} the meter would run only ${fmt(qLo, 2)} cfm. A larger nozzle helps reach the required sample volume.</p>`;
      else st.innerHTML = `<span class="status pass">Workable from ${fmt(qLo, 2)} to ${fmt(qHi, 2)} cfm</span>`;
      st.insertAdjacentHTML('beforeend', `<p class="ctl-help" style="margin-top:.4rem">${picked ? 'Your pick.' : 'Nearest standard size to the ideal.'} Rate thresholds here are rules of thumb, not method limits.</p>`);

      ST.tex($('#nz-eq'), `K = 846.72\\,(${tn(Dn, 4)})^4\\,(${tn(v.dha, 2)})\\,(${tn(v.cp, 2)})^2\\,(1-${tn(B, 3)})^2\\,\\frac{${tn(v.md, 2)}}{${tn(Ms, 2)}}\\,\\frac{${tn(Tm, 0)}}{${tn(Ts, 0)}}\\,\\frac{${tn(Ps, 2)}}{${tn(avg.Pm, 2)}} = ${tn(K, 3)}`);
    }
    compute();
  })();

  /* =========================================================
     Bench 4: post-test leak check
     ========================================================= */
  (function leakBench() {
    const svg = $('#leak-svg');
    if (!svg) return;
    const x0 = 30, x1 = 530;
    const X = (q) => x0 + (q / 0.04) * (x1 - x0);
    const V = (v) => x0 + (v / 20) * (x1 - x0);
    el('text', { x: x0, y: 26, class: 'dg-label-strong', text: 'Leak rate, cfm' }, svg);
    el('rect', { x: x0, y: 40, width: x1 - x0, height: 30, rx: 4, style: 'fill:var(--panel);stroke:var(--rule)' }, svg);
    [0, 0.01, 0.02, 0.03, 0.04].forEach((q) => el('text', { x: X(q), y: 90, class: 'dg-label', 'text-anchor': 'middle', text: q.toFixed(2) }, svg));
    el('text', { x: x0, y: 136, class: 'dg-label-strong', text: 'Vacuum, in. Hg' }, svg);
    el('rect', { x: x0, y: 150, width: x1 - x0, height: 30, rx: 4, style: 'fill:var(--panel);stroke:var(--rule)' }, svg);
    [0, 5, 10, 15, 20].forEach((v) => el('text', { x: V(v), y: 200, class: 'dg-label', 'text-anchor': 'middle', text: v }, svg));
    const dyn = el('g', {}, svg);

    const rate = $('#lk-rate'), leak = $('#lk-leak'), vmax = $('#lk-max'), vac = $('#lk-vac');
    function draw() {
      const allow = Math.min(0.02, 0.04 * +rate.value);
      const L = +leak.value, mx = +vmax.value, vc = +vac.value;
      const leakOk = L <= allow + 1e-9, vacOk = vc >= mx;
      dyn.innerHTML = '';
      el('rect', { x: x0, y: 44, width: Math.max(0, X(L) - x0), height: 22, rx: 3, style: `fill:${leakOk ? 'var(--gas)' : 'var(--gauge)'}` }, dyn);
      el('line', { x1: X(allow), x2: X(allow), y1: 32, y2: 78, style: 'stroke:var(--caution);stroke-width:3' }, dyn);
      el('text', { x: X(allow) + (X(allow) > 400 ? -6 : 6), y: 112, class: 'dg-label-strong', 'text-anchor': X(allow) > 400 ? 'end' : 'start', text: `Allowable ${allow.toFixed(3)} cfm` }, dyn);
      el('rect', { x: x0, y: 154, width: Math.max(0, V(vc) - x0), height: 22, rx: 3, style: `fill:${vacOk ? 'var(--gas)' : 'var(--caution)'}` }, dyn);
      el('line', { x1: V(mx), x2: V(mx), y1: 142, y2: 188, style: 'stroke:var(--ink);stroke-width:3' }, dyn);
      el('text', { x: V(mx) + 6, y: 222, class: 'dg-label', text: 'highest run vacuum' }, dyn);
      $('#lk-rate-out').textContent = `${fmt(+rate.value, 2)} cfm`;
      $('#lk-leak-out').textContent = `${fmt(L, 3)} cfm`;
      $('#lk-max-out').textContent = `${fmt(mx, 1)} in. Hg`;
      $('#lk-vac-out').textContent = `${fmt(vc, 1)} in. Hg`;
      const which = 0.04 * +rate.value < 0.02 ? `4% of ${fmt(+rate.value, 2)} cfm` : '0.020 cfm';
      let html;
      if (!vacOk) html = `<span class="status warn">Check vacuum too low</span><p class="ctl-help" style="margin-top:.4rem">Repeat the check at ${fmt(mx, 1)} in. Hg or higher, the highest vacuum reached during the run.</p>`;
      else if (!leakOk) html = `<span class="status fail">Leak check fails</span><p class="ctl-help" style="margin-top:.4rem">${fmt(L, 3)} cfm is over the ${fmt(allow, 3)} cfm limit (${which}). Correct the metered volume as the method allows, or void the run, per your protocol.</p>`;
      else html = `<span class="status pass">Leak check passes</span><p class="ctl-help" style="margin-top:.4rem">The limit is ${which}, the smaller of the two.</p>`;
      $('#lk-status').innerHTML = html;
    }
    [rate, leak, vmax, vac].forEach((i) => i.addEventListener('input', draw));
    draw();
  })();

  /* =========================================================
     Bench 5: results walkthrough
     ========================================================= */
  (function calcBench() {
    const host = $('#rc-form');
    if (!host) return;
    const FIELDS = [
      { id: 'dia', label: 'Stack diameter', unit: 'in.', value: 72, positive: true },
      { id: 'pbar', label: 'Barometric pressure', unit: 'in. Hg', value: 29.65, positive: true },
      { id: 'pg', label: 'Stack static pressure', unit: 'in. H₂O', value: -0.45 },
      { id: 'cp', label: 'Pitot coefficient, Cp', unit: '', value: 0.84, positive: true },
      { id: 'y', label: 'Meter factor, Y', unit: '', value: 0.995, positive: true },
      { id: 'dn', label: 'Nozzle diameter', unit: 'in.', value: 0.25, positive: true },
      { id: 'theta', label: 'Sampling time, θ', unit: 'min', value: 60, positive: true },
      { id: 'vm', label: 'Meter volume, Vm', unit: 'ft³', value: 42.15, positive: true },
      { id: 'dh', label: 'Average ΔH', unit: 'in. H₂O', value: 1.75 },
      { id: 'tm', label: 'Average meter temp.', unit: '°F', value: 78 },
      { id: 'sqdp', label: 'Average √Δp', unit: '(in. H₂O)½', value: 0.81, positive: true },
      { id: 'ts', label: 'Average stack temp.', unit: '°F', value: 320 },
      { id: 'vlc', label: 'Water collected, Vlc', unit: 'mL', value: 95.0 },
      { id: 'co2', label: 'CO₂', unit: '% dry', value: 10.2 },
      { id: 'o2', label: 'O₂', unit: '% dry', value: 6.5 },
      { id: 'mn', label: 'Particulate mass, mn', unit: 'mg', value: 18.6 },
    ];
    const form = buildForm(host, FIELDS, 'rc', () => compute());
    $('#rc-reset').addEventListener('click', () => { form.reset(); compute(); });
    const list = $('#rc-steps');

    function compute() {
      const v = form.read();
      if (!v.ok) { $('#rc-foot').innerHTML = '<p><span class="status warn">Enter valid values in every field</span></p>'; return; }
      const Tm = v.tm + 460, Ts = v.ts + 460;
      const vmStd = (K1 * v.vm * v.y * (v.pbar + v.dh / 13.6)) / Tm;
      const vwStd = K2 * v.vlc;
      const B = vwStd / (vwStd + vmStd);
      const n2 = 100 - v.co2 - v.o2;
      const Md = 0.44 * v.co2 + 0.32 * v.o2 + 0.28 * n2;
      const Ms = msWet(Md, B);
      const Ps = v.pbar + v.pg / 13.6;
      const vs = velocity(v.cp, v.sqdp, Ts, Ps, Ms);
      const A = (Math.PI * Math.pow(v.dia / 12, 2)) / 4;
      const Qsd = 3600 * (1 - B) * vs * A * (T_STD / Ts) * (Ps / P_STD);
      const cs = (K3 * v.mn) / vmStd;
      const mgm3 = v.mn / (vmStd * 0.0283168);
      const E = (cs * Qsd) / 7000;
      const An = (Math.PI * Math.pow(v.dn / 12, 2)) / 4;
      const I = (K4 * Ts * vmStd) / (Ps * vs * An * v.theta * (1 - B));
      const isoOk = I >= 90 && I <= 110;

      const steps = [
        { name: 'Sample volume, dry standard', tex: `V_{m(std)} = 17.64\\,V_m\\,Y\\,\\frac{P_{bar} + \\Delta H/13.6}{T_m} = 17.64\\,(${tn(v.vm, 3)})(${tn(v.y, 3)})\\frac{${tn(v.pbar, 2)} + ${tn(v.dh, 2)}/13.6}{${tn(Tm, 0)}}`, out: fmt(vmStd, 3), unit: 'dscf' },
        { name: 'Water vapor collected', tex: `V_{w(std)} = 0.04706\\,V_{lc} = 0.04706\\,(${tn(v.vlc, 1)})`, out: fmt(vwStd, 3), unit: 'scf' },
        { name: 'Moisture fraction', tex: `B_{ws} = \\frac{V_{w(std)}}{V_{w(std)} + V_{m(std)}} = \\frac{${tn(vwStd, 3)}}{${tn(vwStd, 3)} + ${tn(vmStd, 3)}}`, out: fmt(B * 100, 2) + '%', unit: 'water by volume' },
        { name: 'Dry molecular weight (Method 3)', tex: `M_d = 0.440(${tn(v.co2, 1)}) + 0.320(${tn(v.o2, 1)}) + 0.280(${tn(n2, 1)})`, out: fmt(Md, 2), unit: 'lb/lb-mole' },
        { name: 'Wet molecular weight', tex: `M_s = M_d(1 - B_{ws}) + 18.0\\,B_{ws} = ${tn(Md, 2)}(1 - ${tn(B, 4)}) + 18.0(${tn(B, 4)})`, out: fmt(Ms, 2), unit: 'lb/lb-mole' },
        { name: 'Absolute stack pressure', tex: `P_s = P_{bar} + \\frac{P_g}{13.6} = ${tn(v.pbar, 2)} + \\frac{${tn(v.pg, 2)}}{13.6}`, out: fmt(Ps, 3), unit: 'in. Hg' },
        { name: 'Stack gas velocity (Method 2)', tex: `v_s = 85.49\\,C_p\\,\\overline{\\sqrt{\\Delta p}}\\,\\sqrt{\\frac{T_s}{P_s M_s}} = 85.49(${tn(v.cp, 2)})(${tn(v.sqdp, 4)})\\sqrt{\\frac{${tn(Ts, 0)}}{(${tn(Ps, 3)})(${tn(Ms, 2)})}}`, out: fmt(vs, 2), unit: 'ft/s' },
        { name: 'Dry standard flow rate', tex: `Q_{sd} = 3600(1 - B_{ws})\\,v_s\\,A\\,\\frac{T_{std}}{T_s}\\frac{P_s}{P_{std}} = 3600(${tn(1 - B, 4)})(${tn(vs, 2)})(${tn(A, 3)})\\frac{528}{${tn(Ts, 0)}}\\frac{${tn(Ps, 3)}}{29.92}`, out: fmt(Qsd, 0), unit: `dscf/hr (${fmt(Qsd / 60, 0)} dscfm)` },
        { name: 'Particulate concentration', tex: `c_s = 0.0154\\,\\frac{m_n}{V_{m(std)}} = 0.0154\\,\\frac{${tn(v.mn, 1)}}{${tn(vmStd, 3)}}`, out: fmt(cs, 5), unit: `gr/dscf (${fmt(mgm3, 1)} mg/dscm)`, key: true },
        { name: 'Emission rate', tex: `E = \\frac{c_s\\,Q_{sd}}{7000} = \\frac{(${tn(cs, 5)})(${tn(Qsd, 0)})}{7000}`, out: fmt(E, 2), unit: 'lb/hr', key: true },
        { name: 'Isokinetic rate', tex: `I = \\frac{0.09450\\,T_s\\,V_{m(std)}}{P_s\\,v_s\\,A_n\\,\\theta\\,(1 - B_{ws})} = \\frac{0.09450(${tn(Ts, 0)})(${tn(vmStd, 3)})}{(${tn(Ps, 3)})(${tn(vs, 2)})(${tn(An, 6)})(${tn(v.theta, 0)})(${tn(1 - B, 4)})}`, out: fmt(I, 1) + '%', unit: isoOk ? 'within 90–110%' : 'outside 90–110%', key: true },
      ];
      list.innerHTML = steps
        .map((s, i) => `<li class="calc-step${s.key ? ' is-key' : ''}"><div><p class="calc-step-name">${s.name}</p><div class="calc-step-eq" id="rc-eq-${i}"></div></div><div class="calc-step-out">${s.out}<small>${s.unit}</small></div></li>`)
        .join('');
      steps.forEach((s, i) => ST.tex(document.getElementById('rc-eq-' + i), s.tex, true));
      $('#rc-foot').innerHTML = `<p>${isoOk ? '<span class="status pass">Run acceptable: isokinetic within 90–110%</span>' : '<span class="status fail">Isokinetic outside 90–110%: repeat the run unless the agency accepts it</span>'} Temperatures are converted to °R by adding 460, and A is the stack area from its diameter.</p>`;
    }
    compute();
  })();
})();
