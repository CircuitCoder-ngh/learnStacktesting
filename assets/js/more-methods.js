/* More methods: finder, train comparison, Method 9 observer position. */
(function () {
  'use strict';
  const { $, $$, svg: el, fmt } = ST;

  /* =========================================================
     Method finder
     ========================================================= */
  const CATS = {
    pm: 'Particulate', acid: 'Acid gases', metals: 'Metals', org: 'Organics',
    comb: 'Combustion gases', opacity: 'Opacity', valid: 'Capture and validation',
  };
  const METHODS = [
    { id: '5B', cat: 'pm', title: 'Nonsulfuric acid particulate', measures: 'Filterable PM, excluding sulfuric acid mist',
      how: 'A Method 5 train with the probe and filter held at 320 °F (160 °C). After sampling, the filter and probe rinse residue are baked at the same temperature to drive off sulfuric acid before weighing.',
      keys: ['Common at coal-fired units with wet scrubbers, where acid mist would inflate a Method 5 result.'], builds: 'Builds on Methods 1–5.' },
    { id: '5D', cat: 'pm', title: 'PM from positive-pressure baghouses', measures: 'Filterable PM',
      how: 'Rules for choosing sampling locations and calculating flow when a fabric filter exhausts through roof monitors, short stacks, or many outlets instead of one stack.',
      keys: ['The sampling itself follows Method 5 or Method 17.'], builds: 'Builds on Methods 1–5 and 17.' },
    { id: '17', cat: 'pm', title: 'In-stack filtration', measures: 'Filterable PM at stack temperature',
      how: 'The filter sits inside the stack at the end of the probe, so particulate is caught at stack temperature rather than in a heated box.',
      keys: ['Only valid where the PM concentration does not depend on temperature; many rules restrict its use.', 'Not for saturated or droplet-laden gas.'], builds: 'Builds on Methods 1–4.' },
    { id: '201A', cat: 'pm', title: 'PM10 and PM2.5', measures: 'Filterable particulate smaller than 10 and 2.5 µm',
      how: 'In-stack cyclones ahead of an in-stack filter separate particles by size. The sampling rate is held constant because it sets the cyclone cut size.',
      keys: ['Pair with Method 202 to add condensable PM for total PM10 or PM2.5.', 'The cyclone assembly is bulky: check that it fits through the ports.'], builds: 'Builds on Methods 1–4.' },
    { id: '202', cat: 'pm', title: 'Condensable particulate matter', measures: 'Material that is a gas in the stack but condenses into particles in the plume',
      how: 'Behind the Method 5 or 201A filter, the gas is cooled in a condenser and dry impingers, then passes a second filter kept at or below 85 °F (30 °C). The catch is purged with nitrogen, split into organic and inorganic fractions, and weighed.',
      keys: ['The dry-impinger design replaced an older wet-impinger version that overstated CPM by dissolving SO₂ into the catch.', 'Field and reagent blanks matter: results are often a few milligrams.'], builds: 'Builds on Method 5 or 201A.' },
    { id: '6', cat: 'comb', title: 'SO₂ by wet chemistry', measures: 'Sulfur dioxide',
      how: 'Gas bubbles through isopropanol, which traps SO₃ and sulfuric acid, then hydrogen peroxide, which converts SO₂ to sulfate. The sulfate is titrated with barium perchlorate using thorin indicator.',
      keys: ['Mostly replaced by the instrumental Method 6C.'], builds: 'Builds on Methods 1–4.' },
    { id: '7', cat: 'comb', title: 'NOₓ by grab sample', measures: 'Nitrogen oxides',
      how: 'A grab sample is drawn into an evacuated flask holding a sulfuric acid and hydrogen peroxide absorbing solution, then analyzed colorimetrically with phenoldisulfonic acid.',
      keys: ['Historical: it captures one instant, not a run average. Method 7E replaced it for most work.'], builds: 'Builds on Method 3 for diluent gases.' },
    { id: '7E', cat: 'comb', title: 'Instrumental gas methods', measures: 'NOₓ (7E), SO₂ (6C), CO (10), O₂ and CO₂ (3A)',
      how: 'Continuous extractive analyzers, bracketed by calibration error, system bias and drift checks.',
      keys: ['Covered in its own lesson.'], builds: 'Builds on Method 1 for points.', link: 'instrumental.html' },
    { id: '26', cat: 'acid', title: 'Hydrogen halides and halogens', measures: 'HCl, HF, HBr, Cl₂ and Br₂',
      how: 'A non-isokinetic midget impinger train. Dilute sulfuric acid impingers absorb the hydrogen halides as halide ions; dilute sodium hydroxide impingers then capture the halogens. Analysis by ion chromatography.',
      keys: ['Only for gas streams without water droplets; otherwise use 26A.'], builds: 'Builds on Methods 1 and 4.' },
    { id: '26A', cat: 'acid', title: 'Isokinetic halides and halogens', measures: 'HCl, HF, HBr, Cl₂ and Br₂, plus PM if needed',
      how: 'A Method 5-style isokinetic train with a heated filter, followed by the same acidic and alkaline impingers as Method 26.',
      keys: ['Use where droplets are present, such as after wet scrubbers, because droplets carry dissolved HCl.', 'The probe and filter must stay hot enough that acid gases do not condense ahead of the impingers.'], builds: 'Builds on Methods 1–5.' },
    { id: '29', cat: 'metals', title: 'Multiple metals', measures: 'Sb, As, Ba, Be, Cd, Cr, Co, Cu, Pb, Mn, Hg, Ni, P, Se, Ag, Tl and Zn',
      how: 'An isokinetic train with a heated quartz-fiber filter, then nitric acid and hydrogen peroxide impingers for most metals and acidic potassium permanganate impingers for mercury. Fractions are digested and analyzed by ICP, with mercury by cold vapor atomic absorption.',
      keys: ['Front half (filter and rinses) and back half are analyzed separately.', 'Contamination control is everything: acid-washed glassware and high-purity reagents.'], builds: 'Builds on Methods 1–5.' },
    { id: '30B', cat: 'metals', title: 'Mercury by sorbent trap', measures: 'Total vapor-phase mercury',
      how: 'Paired traps of halogenated activated carbon go straight into the stack and sample at a measured rate. The traps are analyzed by thermal desorption or acid leaching.',
      keys: ['The paired traps must agree closely, and each trap’s second section shows whether mercury broke through.', 'Widely used at coal-fired utilities and to audit mercury monitors.'], builds: 'Builds on Method 1 points, Method 4 moisture.' },
    { id: '23', cat: 'org', title: 'Dioxins and furans', measures: 'Polychlorinated dibenzo-p-dioxins and dibenzofurans',
      how: 'An isokinetic train with a filter, a water-cooled condenser, and a trap of XAD-2 resin that adsorbs semivolatile organics. Samples are spiked with isotope-labeled standards and analyzed by high-resolution GC/MS.',
      keys: ['Results are in nanograms or less, so cleaning and blanks get extraordinary care.', 'Toxic equivalents (TEQ) weight each compound by its toxicity.'], builds: 'Builds on Methods 1–5.' },
    { id: '18', cat: 'org', title: 'Speciated VOCs by gas chromatography', measures: 'Individual organic compounds',
      how: 'Samples are collected in bags, fed directly or through a dilution interface to a GC, or captured on adsorbent tubes, then separated and quantified by gas chromatography.',
      keys: ['Compound-specific, so it complements the single total from Method 25A.', 'Recovery checks prove the target compounds survive sampling.'], builds: 'Builds on Methods 1–4.' },
    { id: '25', cat: 'org', title: 'Total gaseous nonmethane organics', measures: 'TGNMO, as carbon',
      how: 'Gas is drawn through a condensate trap into an evacuated tank. In the lab the organics are oxidized to CO₂, reduced to methane, and counted with an FID, so every carbon atom counts the same.',
      keys: ['Suited to concentrated organic streams; Method 25A is simpler at low concentrations.'], builds: 'Builds on Methods 1–4.' },
    { id: '25A', cat: 'org', title: 'Total hydrocarbons by FID', measures: 'Total gaseous organics, as propane or as carbon',
      how: 'A heated line feeds a flame ionization detector calibrated with propane.',
      keys: ['Covered in the instrumental lesson.'], builds: 'Builds on Methods 1–4.', link: 'instrumental.html#thc' },
    { id: '320', cat: 'org', title: 'FTIR spectroscopy', measures: 'Many gases at once: HCl, HF, NH₃, formaldehyde, water and more',
      how: 'An extractive system feeds a heated gas cell in a Fourier transform infrared spectrometer. Each compound’s absorption is fitted against reference spectra.',
      keys: ['Analyte spiking shows the system recovers each target compound.', 'It measures moisture too, which helps with wet-to-dry conversions.'], builds: 'Builds on Method 1 points.' },
    { id: '9', cat: 'opacity', title: 'Visual opacity', measures: 'Plume opacity, in percent',
      how: 'A certified observer reads plume opacity to the nearest 5% every 15 seconds. Twenty-four consecutive readings make a 6-minute average.',
      keys: ['Observers recertify every 6 months at a smoke school.', 'The sun must be in the 140° sector behind the observer.'], builds: 'Needs no sampling train.', link: '#opacity' },
    { id: '22', cat: 'opacity', title: 'Visible fugitive emissions', measures: 'Whether visible emissions occur, and for how long',
      how: 'An observer watches a source such as a conveyor transfer point or a building opening and times how long visible emissions are present during the observation period.',
      keys: ['Presence or absence, not opacity.', 'The observer needs training in the method, not Method 9 certification.'], builds: 'Needs no sampling train.' },
    { id: '204', cat: 'valid', title: 'Capture efficiency', measures: 'How much of a process’s VOC reaches the control device',
      how: 'Criteria for verifying a permanent total enclosure, plus procedures for measuring captured and uncaptured VOC streams when the enclosure is temporary.',
      keys: ['An enclosure that meets the permanent total enclosure criteria is taken as 100% capture.', 'Air must flow into the enclosure through every natural draft opening.'], builds: 'Builds on Methods 1–4 and 25A.' },
    { id: '301', cat: 'valid', title: 'Method validation', measures: 'Whether a new or modified method is accurate and precise',
      how: 'Field validation with paired or quadruplicate sampling trains, using analyte spiking or comparison with a validated method, then statistical tests for bias and precision.',
      keys: ['Used when no reference method fits a source or pollutant.'], builds: 'Uses whatever the method under test needs.' },
  ];

  (function finder() {
    const grid = $('#mm-grid');
    if (!grid) return;
    const q = $('#mm-q');
    const catSeg = ST.seg('mm-cat', () => render());
    grid.innerHTML = METHODS.map((m) => `
      <article class="mm-card" data-cat="${m.cat}" data-id="${m.id}">
        <div class="mm-card-head"><span class="mm-num">${m.id}</span><span class="tag">${CATS[m.cat]}</span></div>
        <h3>${m.title}</h3>
        <p class="mm-measures"><span>Measures: </span>${m.measures}</p>
        <p class="mm-how">${m.how}</p>
        <ul class="mm-keys">${m.keys.map((k) => `<li>${k}</li>`).join('')}</ul>
        <p class="mm-builds">${m.builds}${m.link ? ` <a href="${m.link}">Read more</a>` : ''}</p>
      </article>`).join('') + '<p class="mm-empty" hidden>No methods match. Try a pollutant such as “mercury” or a method number such as “26A”.</p>';
    const cards = $$('.mm-card', grid);
    const empty = $('.mm-empty', grid);
    // Plain-text index for search, with subscripts folded to digits (SO₂ → so2)
    const fold = (s) => s.toLowerCase().replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/ₓ/g, 'x');
    const index = METHODS.map((m) => fold(`method ${m.id} ${m.title} ${m.measures} ${m.how} ${m.keys.join(' ')} ${CATS[m.cat]}`));
    function render() {
      const cat = catSeg.value;
      const terms = fold(q.value.trim()).split(/\s+/).filter(Boolean);
      let n = 0;
      cards.forEach((c, i) => {
        const show = (cat === 'all' || METHODS[i].cat === cat) && terms.every((t) => index[i].includes(t));
        c.hidden = !show;
        if (show) n++;
      });
      empty.hidden = n > 0;
      $('#mm-count').textContent = `Showing ${n} of ${METHODS.length} methods`;
    }
    q.addEventListener('input', render);
    render();
  })();

  /* =========================================================
     Train comparison
     ========================================================= */
  const TRAINS = {
    m5: {
      parts: [['nozzle', 'Nozzle'], ['probe', 'Probe'], ['filter', 'Filter|248 ± 25 °F'], ['imp', 'Water|100 mL', 'water'], ['imp', 'Water|100 mL', 'water'], ['imp', 'Empty'], ['imp', 'Silica|gel', 'gel'], ['meter', 'Meter box']],
      zones: [[1, 2, 'heat', 'Heated'], [3, 6, 'cool', 'Ice bath']],
      fracs: [[0, 2, 'Front half', 'Filterable PM'], [3, 6, 'Back half', 'Moisture only']],
      text: '<p>The baseline. Everything that matters for particulate is in the front half: the acetone rinses of the nozzle, probe and filter holder, plus the filter itself, all weighed.</p><dl><dt>Front half</dt><dd>Filter and acetone rinses, dried and weighed as filterable PM.</dd><dt>Back half</dt><dd>Impinger water and silica gel weighed for moisture (Method 4), then discarded.</dd></dl>',
    },
    m202: {
      parts: [['nozzle', 'Nozzle'], ['probe', 'Probe'], ['filter', 'Filter|248 ± 25 °F'], ['cond', 'Condenser'], ['imp', 'Dropout|dry'], ['imp', 'Impinger|dry'], ['cpm', 'CPM filter'], ['imp', 'Moisture|impinger', 'water'], ['imp', 'Silica|gel', 'gel'], ['meter', 'Meter box']],
      zones: [[1, 2, 'heat', 'Heated'], [3, 6, 'warm', 'At or below 85 °F'], [7, 8, 'cool', 'Ice bath']],
      fracs: [[0, 2, 'Front half', 'Filterable PM'], [3, 6, 'CPM section', 'Condensable PM'], [7, 8, 'Moisture', 'Water only']],
      text: '<p>Method 202 bolts a condensable-PM section behind the Method 5 (or 201A) filter. The impingers start dry, so SO₂ has little water to dissolve into, and the CPM filter catches the fine condensed aerosol.</p><dl><dt>Front half</dt><dd>Filterable PM, exactly as in Method 5.</dd><dt>CPM section</dt><dd>After a nitrogen purge, the condenser, impingers and CPM filter are recovered into inorganic (water) and organic (solvent) fractions, dried and weighed.</dd><dt>Moisture</dt><dd>Water gain for Method 4.</dd></dl>',
    },
    m26a: {
      parts: [['nozzle', 'Nozzle'], ['probe', 'Probe'], ['filter', 'Filter|heated'], ['imp', '0.1 N|H₂SO₄', 'acid'], ['imp', '0.1 N|H₂SO₄', 'acid'], ['imp', '0.1 N|NaOH', 'base'], ['imp', '0.1 N|NaOH', 'base'], ['imp', 'Silica|gel', 'gel'], ['meter', 'Meter box']],
      zones: [[1, 2, 'heat', 'Heated'], [3, 7, 'cool', 'Ice bath']],
      fracs: [[0, 2, 'Front half', 'PM, if required'], [3, 4, 'Acid', 'HCl, HF, HBr'], [5, 6, 'Alkaline', 'Cl₂, Br₂']],
      text: '<p>The same isokinetic front end, then two pairs of impingers that split the acid gases by chemistry. An empty knockout impinger is often added first to catch condensed water.</p><dl><dt>Acid impingers</dt><dd>Dilute sulfuric acid absorbs hydrogen halides as chloride, fluoride and bromide ions.</dd><dt>Alkaline impingers</dt><dd>Dilute sodium hydroxide captures the halogens Cl₂ and Br₂.</dd><dt>Analysis</dt><dd>Ion chromatography of each fraction.</dd></dl>',
    },
    m29: {
      parts: [['nozzle', 'Nozzle'], ['probe', 'Probe'], ['filter', 'Quartz|filter'], ['imp', 'HNO₃|H₂O₂', 'acid'], ['imp', 'HNO₃|H₂O₂', 'acid'], ['imp', 'Empty'], ['imp', 'Acidic|KMnO₄', 'kmno4'], ['imp', 'Acidic|KMnO₄', 'kmno4'], ['imp', 'Silica|gel', 'gel'], ['meter', 'Meter box']],
      zones: [[1, 2, 'heat', 'Heated'], [3, 8, 'cool', 'Ice bath']],
      fracs: [[0, 2, 'Front half', 'Metals'], [3, 4, 'Peroxide', 'Metals, some Hg'], [5, 7, 'Permanganate', 'Mercury']],
      text: '<p>Seventeen metals from one train. An optional empty knockout impinger may come first. Every piece of glass is acid-washed, and every fraction has a reagent blank.</p><dl><dt>Front half</dt><dd>Filter and acid rinses, digested and analyzed for metals.</dd><dt>Nitric acid and peroxide</dt><dd>Captures most vapor-phase metals and oxidized mercury.</dd><dt>Permanganate</dt><dd>Oxidizes and captures elemental mercury; analyzed by cold vapor atomic absorption.</dd></dl>',
    },
  };

  (function trains() {
    const svg = $('#trains-svg');
    if (!svg) return;
    const Y = 120;
    const FILL = {
      water: 'color-mix(in srgb, var(--water) 35%, var(--panel))',
      acid: 'color-mix(in srgb, var(--gauge) 25%, var(--panel))',
      base: 'color-mix(in srgb, var(--gas) 30%, var(--panel))',
      kmno4: 'color-mix(in srgb, #8E3FA8 55%, var(--panel))',
      gel: 'color-mix(in srgb, var(--caution) 60%, var(--panel))',
    };
    function label(x, y, text) {
      text.split('|').forEach((t, i) => el('text', { x, y: y + i * 15, class: i ? 'dg-label' : 'dg-label-strong', 'text-anchor': 'middle', text: t }, svg));
    }
    function draw(key) {
      const T = TRAINS[key];
      svg.innerHTML = '';
      const n = T.parts.length;
      const X = (i) => 60 + (i * 880) / (n - 1);
      const half = 440 / (n - 1);
      T.zones.forEach(([a, b, cls, lab]) => {
        const x0 = X(a) - half + 6, x1 = X(b) + half - 6;
        el('rect', { x: x0, y: 40, width: x1 - x0, height: 160, rx: 10, class: 'tr-zone-' + cls }, svg);
        el('text', { x: x0 + 10, y: 58, class: 'dg-label', text: lab }, svg);
      });
      el('line', { x1: X(0), x2: X(n - 1), y1: Y, y2: Y, class: 'tr-pipe' }, svg);
      T.parts.forEach(([kind, lab, fill], i) => {
        const x = X(i);
        if (kind === 'nozzle') {
          el('path', { d: `M${x - 14},${Y + 26} L${x - 14},${Y + 8} Q${x - 14},${Y} ${x - 6},${Y} L${x + 24},${Y}`, style: 'fill:none;stroke:var(--ink);stroke-width:4;stroke-linecap:round' }, svg);
        } else if (kind === 'probe') {
          el('rect', { x: x - 40, y: Y - 7, width: 80, height: 14, rx: 3, style: 'fill:var(--steel);stroke:var(--ink);stroke-width:1.2' }, svg);
        } else if (kind === 'filter' || kind === 'cpm') {
          const s = kind === 'cpm' ? 18 : 24;
          el('rect', { x: x - s, y: Y - s, width: 2 * s, height: 2 * s, rx: 6, class: 'tr-part' }, svg);
          el('line', { x1: x, x2: x, y1: Y - s + 5, y2: Y + s - 5, style: 'stroke:var(--soot);stroke-width:3' }, svg);
        } else if (kind === 'cond') {
          el('rect', { x: x - 18, y: Y - 36, width: 36, height: 72, rx: 8, class: 'tr-part' }, svg);
          let d = `M${x - 8},${Y - 28}`;
          for (let k = 0; k < 6; k++) d += ` L${x + (k % 2 ? -8 : 8)},${Y - 28 + (k + 1) * 9.3}`;
          el('path', { d, style: 'fill:none;stroke:var(--water);stroke-width:2' }, svg);
        } else if (kind === 'imp') {
          el('rect', { x: x - 15, y: Y - 40, width: 30, height: 80, rx: 9, class: 'tr-part' }, svg);
          if (fill) el('rect', { x: x - 13, y: Y + (fill === 'gel' ? -14 : 2), width: 26, height: fill === 'gel' ? 52 : 36, rx: 7, style: `fill:${FILL[fill]}` }, svg);
          el('line', { x1: x - 3, x2: x - 3, y1: Y - 46, y2: Y + 28, style: 'stroke:var(--ink-2);stroke-width:2' }, svg);
        } else if (kind === 'meter') {
          el('rect', { x: x - 30, y: Y - 28, width: 60, height: 56, rx: 6, class: 'tr-part' }, svg);
          el('circle', { cx: x, cy: Y - 4, r: 13, style: 'fill:none;stroke:var(--ink-2);stroke-width:1.5' }, svg);
          el('line', { x1: x, x2: x + 8, y1: Y - 4, y2: Y - 12, style: 'stroke:var(--gauge);stroke-width:2' }, svg);
        }
        label(x, Y + 62, lab);
      });
      T.fracs.forEach(([a, b, lab, sub]) => {
        const x0 = X(a) - half * 0.75, x1 = X(b) + half * 0.75, y = 238;
        el('path', { d: `M${x0},${y - 8} L${x0},${y} L${x1},${y} L${x1},${y - 8}`, class: 'tr-frac' }, svg);
        el('text', { x: (x0 + x1) / 2, y: y + 22, class: 'dg-label-strong', 'text-anchor': 'middle', text: lab }, svg);
        el('text', { x: (x0 + x1) / 2, y: y + 39, class: 'dg-label', 'text-anchor': 'middle', text: sub }, svg);
      });
      el('text', { x: 500, y: 318, class: 'dg-label', 'text-anchor': 'middle', text: 'Gas flows left to right, from the stack to the meter box' }, svg);
      $('#tr-text').innerHTML = `<div class="tr-text">${T.text}</div>`;
    }
    ST.seg('tr-mode', draw);
    draw('m5');
  })();

  /* =========================================================
     Method 9 observer position
     ========================================================= */
  (function m9() {
    const svg = $('#m9-svg');
    if (!svg) return;
    const obsIn = $('#m9-obs'), sunIn = $('#m9-sun');
    const S = [260, 212];
    const dir = (b) => [Math.sin((b * Math.PI) / 180), -Math.cos((b * Math.PI) / 180)];
    const at = (b, r, o = S) => [o[0] + dir(b)[0] * r, o[1] + dir(b)[1] * r];
    const NAMES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compass = (b) => NAMES[Math.round(b / 22.5) % 16];
    const angDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

    // Static: compass labels and stack
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, b]) => {
      const [x, y] = at(b, 178);
      el('text', { x, y: y + 5, class: 'dg-label-strong', 'text-anchor': 'middle', text: t }, svg);
    });
    el('circle', { cx: S[0], cy: S[1], r: 152, class: 'dg-rule', 'stroke-dasharray': '2 6' }, svg);
    const wedge = el('path', { style: 'fill:var(--caution-soft);stroke:var(--caution);stroke-width:1.2' }, svg);
    const plumeG = el('g', {}, svg);
    el('circle', { cx: S[0], cy: S[1], r: 12, style: 'fill:var(--steel);stroke:var(--ink);stroke-width:2' }, svg);
    const sight = el('line', { class: 'dg-ink', 'stroke-dasharray': '5 5', 'stroke-width': 1.5 }, svg);
    const obsG = el('g', {}, svg);
    el('circle', { cx: 0, cy: 0, r: 10, style: 'fill:var(--ink)' }, obsG);
    el('circle', { cx: 0, cy: -3, r: 3.5, style: 'fill:var(--paper)' }, obsG);
    const obsTxt = el('text', { class: 'dg-label-strong', 'text-anchor': 'middle', text: 'Observer' }, svg);
    const sunG = el('g', {}, svg);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      el('line', { x1: Math.cos(a) * 15, y1: Math.sin(a) * 15, x2: Math.cos(a) * 22, y2: Math.sin(a) * 22, style: 'stroke:var(--caution);stroke-width:2.5;stroke-linecap:round' }, sunG);
    }
    el('circle', { cx: 0, cy: 0, r: 11, style: 'fill:var(--caution)' }, sunG);

    const puffs = Array.from({ length: 9 }, (_, i) => ({ p: i / 9, c: el('circle', { style: 'fill:var(--ink-3)' }, plumeG) }));

    function update() {
      const ob = +obsIn.value, sb = +sunIn.value;
      $('#m9-obs-out').textContent = `${ob}° ${compass(ob)}`;
      $('#m9-sun-out').textContent = `${sb}° ${compass(sb)}`;
      const O = at(ob, 104);
      obsG.setAttribute('transform', `translate(${O[0]} ${O[1]})`);
      const L = at(ob + 90, 46, O);
      obsTxt.setAttribute('x', L[0]);
      obsTxt.setAttribute('y', L[1] + 4);
      sight.setAttribute('x1', O[0]); sight.setAttribute('y1', O[1]);
      sight.setAttribute('x2', S[0]); sight.setAttribute('y2', S[1]);
      // 140° sector behind the observer: centred on the bearing pointing away from the stack
      const R = 72;
      const a0 = at(ob - 70, R, O), a1 = at(ob + 70, R, O);
      wedge.setAttribute('d', `M${O[0]},${O[1]} L${a0[0]},${a0[1]} A${R},${R} 0 0 1 ${a1[0]},${a1[1]} Z`);
      const sp = at(sb, 152);
      sunG.setAttribute('transform', `translate(${sp[0]} ${sp[1]})`);

      const sunOff = angDiff(sb, ob);
      const sightBearing = (ob + 180) % 360;
      let plume = angDiff(sightBearing, 90);
      if (plume > 90) plume = 180 - plume;
      $('#m9-sunang').innerHTML = `${fmt(sunOff, 0)}<span class="readout-unit">° (limit 70°)</span>`;
      $('#m9-plang').innerHTML = `${fmt(plume, 0)}<span class="readout-unit">° from the plume</span>`;
      const sunOK = sunOff <= 70;
      const st = $('#m9-status');
      if (!sunOK) st.innerHTML = '<span class="status fail">Sun outside the 140° sector behind you</span>';
      else if (plume < 45) st.innerHTML = '<span class="status warn">Sun is fine, but you are looking along the plume</span>';
      else st.innerHTML = '<span class="status pass">Good position: sun behind, looking across the plume</span>';
    }

    ST.loop(svg, (dt, t) => {
      puffs.forEach((pf, i) => {
        const p = (pf.p + t * 0.08) % 1;
        const x = S[0] + 14 + p * 190, y = S[1] - 4 + Math.sin(p * 5 + i) * 4 * p;
        pf.c.setAttribute('cx', x); pf.c.setAttribute('cy', y);
        pf.c.setAttribute('r', 7 + p * 18);
        pf.c.setAttribute('opacity', 0.42 * (1 - p) + 0.04);
      });
    }, { buttonHost: svg.parentElement });
    [obsIn, sunIn].forEach((i) => i.addEventListener('input', update));
    update();
  })();
})();
