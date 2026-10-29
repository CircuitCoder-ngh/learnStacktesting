/* Worked example: a three-run Method 5 calculation from field data to results. */
(function () {
  'use strict';
  const { $, fmt } = ST;
  if (!$('#calc-app')) return;

  /* ---------- Constants (same as the Method 2, 4 and 5 lessons) ---------- */
  const KP = 85.49;        // ft/s · [(lb/lb-mole)(in. Hg)/((°R)(in. H2O))]^½
  const K_STD = 17.64;     // °R/in. Hg
  const K_WATER_ML = 0.04706, K_WATER_G = 0.04715; // ft³ per mL or g of water
  const K_GR = 0.0154;     // gr/mg
  const K_ISO = 0.09450;   // isokinetic constant, English units
  const T_STD = 528, P_STD = 29.92;
  const FUELS = { coal: { name: 'Bituminous coal', fd: 9780 }, gas: { name: 'Natural gas', fd: 8710 }, oil: { name: 'Fuel oil', fd: 9190 } };

  /* ---------- Field data sheet definition ---------- */
  const GROUPS = [
    { name: 'Stack and equipment', items: [
      { k: 'dia', label: 'Stack inside diameter', sym: 'D_s', unit: 'in.', step: 0.1, min: 12, max: 600, d: 1 },
      { k: 'cp', label: 'Pitot coefficient', sym: 'C_p', unit: '', step: 0.001, min: 0.7, max: 1.0, d: 3 },
      { k: 'dn', label: 'Nozzle diameter', sym: 'D_n', unit: 'in.', step: 0.001, min: 0.1, max: 1.0, d: 3 },
      { k: 'y', label: 'Meter calibration factor', sym: 'Y', unit: '', step: 0.001, min: 0.9, max: 1.1, d: 3 },
      { k: 'dhat', label: 'Orifice coefficient', sym: '\\Delta H_@', unit: 'in. H₂O', step: 0.01, min: 1.0, max: 3.0, d: 2 },
    ] },
    { name: 'Run conditions', items: [
      { k: 'pbar', label: 'Barometric pressure', sym: 'P_{bar}', unit: 'in. Hg', step: 0.01, min: 20, max: 32, d: 2 },
      { k: 'pg', label: 'Stack static pressure', sym: 'P_g', unit: 'in. H₂O', step: 0.01, min: -30, max: 30, d: 2 },
      { k: 'theta', label: 'Total sampling time', sym: '\\theta', unit: 'min', step: 1, min: 10, max: 600, d: 0 },
    ] },
    { name: 'Meter box', items: [
      { k: 'vm', label: 'Meter volume', sym: 'V_m', unit: 'ft³', step: 0.001, min: 1, max: 500, d: 3 },
      { k: 'dh', label: 'Average orifice reading', sym: '\\Delta H', unit: 'in. H₂O', step: 0.01, min: 0.05, max: 10, d: 2 },
      { k: 'tm', label: 'Average meter temperature', sym: 'T_m', unit: '°F', step: 1, min: 20, max: 160, d: 0 },
    ] },
    { name: 'Stack traverse', items: [
      { k: 'sqdp', label: 'Average square root of Δp', sym: '\\overline{\\sqrt{\\Delta p}}', unit: '(in. H₂O)^½', step: 0.001, min: 0.05, max: 3, d: 3 },
      { k: 'ts', label: 'Average stack temperature', sym: 'T_s', unit: '°F', step: 1, min: 32, max: 1800, d: 0 },
    ] },
    { name: 'Moisture', items: [
      { k: 'vlc', label: 'Impinger water gained', sym: 'V_{lc}', unit: 'mL', step: 0.1, min: 0, max: 3000, d: 1 },
      { k: 'wsg', label: 'Silica gel weight gained', sym: 'W_{sg}', unit: 'g', step: 0.1, min: 0, max: 300, d: 1 },
    ] },
    { name: 'Gas composition (dry)', items: [
      { k: 'co2', label: 'Carbon dioxide', sym: '\\%\\mathrm{CO_2}', unit: '%', step: 0.1, min: 0, max: 21, d: 1 },
      { k: 'o2', label: 'Oxygen', sym: '\\%\\mathrm{O_2}', unit: '%', step: 0.1, min: 0, max: 21, d: 1 },
    ] },
    { name: 'Laboratory', items: [
      { k: 'mn', label: 'Particulate catch, filter plus rinse', sym: 'm_n', unit: 'mg', step: 0.1, min: 0, max: 10000, d: 1 },
    ] },
  ];
  const FIELDS = GROUPS.flatMap((g) => g.items);

  const BASE = { dia: 72, cp: 0.84, dn: 0.25, y: 0.998, dhat: 1.84, pbar: 29.42, pg: -0.55, theta: 96, vm: 73.0, dh: 1.87, tm: 82, sqdp: 0.875, ts: 325, vlc: 168.0, wsg: 14.2, co2: 10.8, o2: 7.2, mn: 85.4 };
  const EXAMPLE = [
    { ...BASE },
    { ...BASE, pbar: 29.40, pg: -0.56, vm: 72.4, dh: 1.84, tm: 85, sqdp: 0.868, ts: 327, vlc: 171.5, wsg: 13.6, co2: 10.6, o2: 7.4, mn: 79.2 },
    { ...BASE, pbar: 29.38, pg: -0.54, vm: 73.5, dh: 1.90, tm: 88, sqdp: 0.880, ts: 324, vlc: 165.2, wsg: 14.8, co2: 10.9, o2: 7.1, mn: 91.0 },
  ];
  let runs = EXAMPLE.map((r) => ({ ...r }));
  let cur = 0;
  let fuel = 'coal';

  /** Water vapor pressure, in. Hg (Antoine equation). */
  function pvInHg(tF) {
    const tC = (tF - 32) / 1.8;
    const l = tC <= 100 ? 8.07131 - 1730.63 / (233.426 + tC) : 8.14019 - 1810.94 / (244.485 + tC);
    return Math.pow(10, l) / 25.4;
  }

  /* ---------- The calculation ---------- */
  function compute(r) {
    const o = {};
    o.tsR = r.ts + 460;
    o.tmR = r.tm + 460;
    o.pm = r.pbar + r.dh / 13.6;
    o.vmstd = (K_STD * r.y * r.vm * o.pm) / o.tmR;
    o.vwc = K_WATER_ML * r.vlc;
    o.vwsg = K_WATER_G * r.wsg;
    o.vwstd = o.vwc + o.vwsg;
    o.bwsMeas = o.vwstd / (o.vwstd + o.vmstd);
    o.ps = r.pbar + r.pg / 13.6;
    o.bwsSat = r.ts < 212 ? pvInHg(r.ts) / o.ps : Infinity;
    o.bws = Math.min(o.bwsMeas, o.bwsSat);
    o.n2 = 100 - r.co2 - r.o2;
    o.md = 0.44 * r.co2 + 0.32 * r.o2 + 0.28 * o.n2;
    o.ms = o.md * (1 - o.bws) + 18.0 * o.bws;
    o.vs = KP * r.cp * r.sqdp * Math.sqrt(o.tsR / (o.ps * o.ms));
    o.area = (Math.PI * Math.pow(r.dia / 12, 2)) / 4;
    o.qsd = 3600 * (1 - o.bws) * o.vs * o.area * (T_STD / o.tsR) * (o.ps / P_STD);
    o.dscfm = o.qsd / 60;
    o.acfm = o.vs * o.area * 60;
    o.cs = (K_GR * r.mn) / o.vmstd;
    o.csMg = r.mn / (o.vmstd * 0.0283168);
    o.e = (o.cs * o.qsd) / 7000;
    o.an = (Math.PI * Math.pow(r.dn / 12, 2)) / 4;
    o.iso = (K_ISO * o.tsR * o.vmstd) / (o.ps * o.vs * o.an * r.theta * (1 - o.bws));
    o.k = 846.72 * Math.pow(r.dn, 4) * r.dhat * r.cp * r.cp * Math.pow(1 - o.bws, 2) * (o.md / o.ms) * (o.tmR / o.tsR) * (o.ps / o.pm);
    o.dhPred = o.k * r.sqdp * r.sqdp;
    o.fd = FUELS[fuel].fd;
    o.lbmm = (o.cs / 7000) * o.fd * (20.9 / (20.9 - r.o2));
    return o;
  }

  /* ---------- Validation ---------- */
  function validate(r, o) {
    const issues = [];
    FIELDS.forEach((f) => {
      const v = r[f.k];
      if (!Number.isFinite(v)) issues.push({ k: f.k, msg: `${f.label} is empty.` });
      else if (v < f.min || v > f.max) issues.push({ k: f.k, msg: `${f.label} of ${v} ${f.unit} is outside the usual range of ${f.min} to ${f.max} ${f.unit}.` });
    });
    if (Number.isFinite(r.co2) && Number.isFinite(r.o2) && r.co2 + r.o2 > 21) issues.push({ k: 'o2', msg: 'CO₂ plus O₂ is above 21%, which is not possible for air-fired combustion. Check the gas analysis.' });
    if (Number.isFinite(r.ts) && Number.isFinite(r.tm) && r.ts < r.tm - 30) issues.push({ k: 'ts', msg: 'Stack temperature is well below meter temperature. Check the units (°F) and the thermocouple readings.' });
    if (o.bwsMeas > 0.5) issues.push({ k: 'vlc', msg: `Measured moisture of ${fmt(o.bwsMeas * 100, 1)}% is very high. Check the impinger weights.` });
    return issues;
  }

  /* ---------- Build the data sheet ---------- */
  const form = $('#calc-form');
  let html = '';
  GROUPS.forEach((g) => {
    html += `<fieldset><legend>${g.name}</legend>`;
    g.items.forEach((f) => {
      html += `<div class="cf-row"><label for="cf-${f.k}">${f.label} <span class="tex">${f.sym}</span><span class="cf-unit">${f.unit}</span></label>
        <input class="field" id="cf-${f.k}" name="${f.k}" type="number" step="${f.step}" inputmode="decimal"></div>`;
    });
    html += '</fieldset>';
  });
  html += `<fieldset><legend>Fuel</legend><div class="cf-row"><label for="cf-fuel">Fuel, for the Method 19 <span class="tex">F_d</span><span class="cf-unit">same for all runs</span></label>
    <select class="field" id="cf-fuel">${Object.entries(FUELS).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('')}</select></div></fieldset>`;
  form.innerHTML = html;

  function fillForm() {
    FIELDS.forEach((f) => {
      const v = runs[cur][f.k];
      $('#cf-' + f.k).value = Number.isFinite(v) ? v.toFixed(f.d) : '';
    });
    $('#cf-fuel').value = fuel;
  }
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'cf-fuel') fuel = t.value;
    else if (t.name) runs[cur][t.name] = parseFloat(t.value);
    update();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  /* ---------- Steps ---------- */
  const n = (x, d) => (Number.isFinite(x) ? fmt(x, d).replace(/,/g, '{,}') : '?');
  const al = (lhs, sym, num, res) => `\\begin{aligned} ${lhs} &= ${sym} \\\\ &= ${num} \\\\ &= \\mathbf{${res}} \\end{aligned}`;

  const STEPS = [
    { id: 'vmstd', title: 'Dry gas sampled, at standard conditions', link: ['method-5.html', 'Method 5'],
      tex: (r, o) => al('V_{m(std)}', '17.64\\,Y\\,V_m\\,\\dfrac{P_{bar} + \\Delta H/13.6}{T_m}', `17.64\\,(${n(r.y, 3)})(${n(r.vm, 3)})\\,\\dfrac{${n(r.pbar, 2)} + ${n(r.dh, 2)}/13.6}{${n(r.tm, 0)} + 460}`, `${n(o.vmstd, 3)}\\ \\text{dscf}`),
      why: () => 'The dry gas meter reads actual cubic feet at the meter’s temperature and pressure. This puts the sample on the 68 °F, 29.92 in. Hg basis every other number uses.' },
    { id: 'vw', title: 'Water vapor collected', link: ['method-4.html', 'Method 4'],
      tex: (r, o) => al('V_{w(std)}', '0.04706\\,V_{lc} + 0.04715\\,W_{sg}', `0.04706\\,(${n(r.vlc, 1)}) + 0.04715\\,(${n(r.wsg, 1)})`, `${n(o.vwstd, 3)}\\ \\text{scf}`),
      why: () => 'Each milliliter of condensate, and each gram of silica gel gain, is converted to the volume it occupied as vapor in the stack.' },
    { id: 'bws', title: 'Moisture fraction', link: ['method-4.html', 'Method 4'],
      tex: (r, o) => al('B_{ws}', '\\dfrac{V_{w(std)}}{V_{w(std)} + V_{m(std)}}', `\\dfrac{${n(o.vwstd, 3)}}{${n(o.vwstd, 3)} + ${n(o.vmstd, 3)}}`, `${n(o.bwsMeas, 4)}\\quad(${n(o.bwsMeas * 100, 1)}\\%)`),
      why: (r, o) => (o.bwsMeas > o.bwsSat
        ? `<span class="status warn">Above saturation</span> At ${n(r.ts, 0)} °F the gas can hold only ${fmt(o.bwsSat * 100, 1)}% water vapor, so the extra is droplets. The rest of the calculation uses the saturation value, as Method 4 requires.`
        : 'The share of the stack gas, by volume, that is water vapor. It converts between wet and dry gas everywhere downstream.') },
    { id: 'md', title: 'Dry molecular weight', link: ['method-3.html', 'Method 3'],
      tex: (r, o) => al('M_d', '0.440\\,(\\%\\mathrm{CO_2}) + 0.320\\,(\\%\\mathrm{O_2}) + 0.280\\,(\\%\\mathrm{N_2} + \\%\\mathrm{CO})', `0.440\\,(${n(r.co2, 1)}) + 0.320\\,(${n(r.o2, 1)}) + 0.280\\,(${n(o.n2, 1)})`, `${n(o.md, 2)}\\ \\text{lb/lb-mole}`),
      why: () => 'Nitrogen is found by difference: 100 − %CO₂ − %O₂ − %CO. CO is taken as zero here, which is typical for a well-run boiler.' },
    { id: 'ms', title: 'Wet molecular weight', link: ['method-2.html', 'Method 2'],
      tex: (r, o) => al('M_s', 'M_d\\,(1 - B_{ws}) + 18.0\\,B_{ws}', `${n(o.md, 2)}\\,(1 - ${n(o.bws, 4)}) + 18.0\\,(${n(o.bws, 4)})`, `${n(o.ms, 2)}\\ \\text{lb/lb-mole}`),
      why: () => 'The pitot tube responds to the gas actually in the stack, wet, so velocity needs the wet molecular weight.' },
    { id: 'ps', title: 'Absolute stack pressure', link: ['method-2.html', 'Method 2'],
      tex: (r, o) => al('P_s', 'P_{bar} + P_g/13.6', `${n(r.pbar, 2)} + (${n(r.pg, 2)})/13.6`, `${n(o.ps, 3)}\\ \\text{in. Hg}`),
      why: () => 'Static pressure is read in inches of water; dividing by 13.6 converts it to inches of mercury. A negative value means the stack is under slight suction.' },
    { id: 'vs', title: 'Stack gas velocity', link: ['method-2.html', 'Method 2'],
      tex: (r, o) => al('v_s', 'K_p\\,C_p\\,\\overline{\\sqrt{\\Delta p}}\\,\\sqrt{\\dfrac{T_s}{P_s\\,M_s}}', `85.49\\,(${n(r.cp, 3)})(${n(r.sqdp, 3)})\\sqrt{\\dfrac{${n(r.ts, 0)} + 460}{(${n(o.ps, 3)})(${n(o.ms, 2)})}}`, `${n(o.vs, 2)}\\ \\text{ft/s}`),
      why: () => 'The average of the square roots of Δp, not the square root of the average Δp, because velocity goes with √Δp at each point.' },
    { id: 'area', title: 'Stack cross-sectional area', link: ['method-1.html', 'Method 1'],
      tex: (r, o) => al('A', '\\dfrac{\\pi}{4}\\left(\\dfrac{D_s}{12}\\right)^2', `\\dfrac{\\pi}{4}\\left(\\dfrac{${n(r.dia, 1)}}{12}\\right)^2`, `${n(o.area, 3)}\\ \\text{ft}^2`),
      why: () => 'Measured inside diameter at the sampling location, converted from inches to feet.' },
    { id: 'qsd', title: 'Volumetric flow rate, dry standard', link: ['method-2.html', 'Method 2'],
      tex: (r, o) => al('Q_{sd}', '3600\\,(1 - B_{ws})\\,v_s\\,A\\,\\dfrac{T_{std}}{T_s}\\,\\dfrac{P_s}{P_{std}}', `3600\\,(1 - ${n(o.bws, 4)})(${n(o.vs, 2)})(${n(o.area, 3)})\\,\\dfrac{528}{${n(o.tsR, 0)}}\\,\\dfrac{${n(o.ps, 3)}}{29.92}`, `${n(o.qsd, 0)}\\ \\text{dscf/hr}`),
      why: (r, o) => `That is ${fmt(o.dscfm, 0)} dscfm. The actual flow at stack conditions is ${fmt(o.acfm, 0)} acfm: hotter, wetter, and at stack pressure, so larger.` },
    { id: 'cs', title: 'Particulate concentration', link: ['method-5.html', 'Method 5'],
      tex: (r, o) => al('c_s', '0.0154\\,\\dfrac{m_n}{V_{m(std)}}', `0.0154\\,\\dfrac{${n(r.mn, 1)}}{${n(o.vmstd, 3)}}`, `${n(o.cs, 5)}\\ \\text{gr/dscf}`),
      why: (r, o) => `The same catch is ${fmt(o.csMg, 1)} mg/dscm. 0.0154 converts milligrams to grains (7,000 grains to the pound).` },
    { id: 'e', title: 'Emission rate', link: ['method-5.html', 'Method 5'],
      tex: (r, o) => al('E', '\\dfrac{c_s\\,Q_{sd}}{7000}', `\\dfrac{(${n(o.cs, 5)})(${n(o.qsd, 0)})}{7000}`, `${n(o.e, 2)}\\ \\text{lb/hr}`),
      why: () => 'Concentration times flow, with both on a dry standard basis. Dividing by 7,000 turns grains into pounds.' },
    { id: 'iso', title: 'Isokinetic variation', link: ['method-5.html', 'Method 5'],
      tex: (r, o) => al('I', '\\dfrac{0.09450\\,T_s\\,V_{m(std)}}{P_s\\,v_s\\,A_n\\,\\theta\\,(1 - B_{ws})}', `\\dfrac{0.09450\\,(${n(o.tsR, 0)})(${n(o.vmstd, 3)})}{(${n(o.ps, 3)})(${n(o.vs, 2)})(${n(o.an, 6)})(${n(r.theta, 0)})(1 - ${n(o.bws, 4)})}`, `${n(o.iso, 1)}\\%`),
      why: (r, o) => `${o.iso >= 90 && o.iso <= 110 ? '<span class="status pass">Within 90–110%</span>' : '<span class="status fail">Outside 90–110%: the run is not valid</span>'} The nozzle area <span class="tex">A_n = \\pi D_n^2/4</span> is ${fmt(o.an, 6)} ft². This compares the gas that went through the nozzle with the gas that would have passed through the same area at stack velocity.` },
    { id: 'k', title: 'Meter setting check', link: ['method-5.html', 'Method 5'],
      tex: (r, o) => al('\\Delta H', '846.72\\,D_n^4\\,\\Delta H_@\\,C_p^2\\,(1 - B_{ws})^2\\,\\dfrac{M_d}{M_s}\\,\\dfrac{T_m}{T_s}\\,\\dfrac{P_s}{P_m}\\,\\Delta p', `${n(o.k, 3)}\\times(${n(r.sqdp, 3)})^2`, `${n(o.dhPred, 2)}\\ \\text{in. H}_2\\text{O}`),
      why: (r, o) => {
        const diff = (r.dh / o.dhPred - 1) * 100;
        return `The isokinetic equation says the meter should have averaged about ${fmt(o.dhPred, 2)} in. H₂O (using the square of the average √Δp for Δp, a slight underestimate). The crew recorded ${fmt(r.dh, 2)}, ${fmt(Math.abs(diff), 1)}% ${diff >= 0 ? 'higher' : 'lower'}. A big gap here usually shows up in the isokinetic rate too.`;
      } },
    { id: 'lbmm', title: 'Emission rate per heat input', link: ['calculator.html#mmbtu', 'Method 19'],
      tex: (r, o) => al('E', '\\dfrac{c_s}{7000}\\,F_d\\,\\dfrac{20.9}{20.9 - \\%\\mathrm{O_2}}', `\\dfrac{${n(o.cs, 5)}}{7000}\\,(${n(o.fd, 0)})\\,\\dfrac{20.9}{20.9 - ${n(r.o2, 1)}}`, `${n(o.lbmm, 4)}\\ \\text{lb/MMBtu}`),
      why: () => `Using the F-factor for ${FUELS[fuel].name.toLowerCase()}. Change the fuel at the bottom of the data sheet.` },
  ];

  const host = $('#calc-steps');
  host.innerHTML = STEPS.map((s, i) => `<article class="step-card" id="step-${s.id}">
      <header class="step-head"><span class="step-n" aria-hidden="true">${i + 1}</span><h3 class="step-title">${s.title}</h3><a class="step-link" href="${s.link[0]}">${s.link[1]}</a></header>
      <div class="step-eq"></div>
      <p class="step-why"></p>
    </article>`).join('');

  /* ---------- Summary table ---------- */
  const ROWS = [
    { label: 'Sample volume', unit: 'dscf', get: (o) => o.vmstd, d: 3 },
    { label: 'Moisture', unit: '%', get: (o) => o.bws * 100, d: 1 },
    { label: 'Stack velocity', unit: 'ft/s', get: (o) => o.vs, d: 2 },
    { label: 'Flow rate', unit: 'dscfm', get: (o) => o.dscfm, d: 0 },
    { label: 'Flow rate, actual', unit: 'acfm', get: (o) => o.acfm, d: 0 },
    { label: 'Concentration', unit: 'gr/dscf', get: (o) => o.cs, d: 5 },
    { label: 'Concentration', unit: 'mg/dscm', get: (o) => o.csMg, d: 1 },
    { label: 'Emission rate', unit: 'lb/hr', get: (o) => o.e, d: 2 },
    { label: 'Emission rate', unit: 'lb/MMBtu', get: (o) => o.lbmm, d: 4 },
    { label: 'Isokinetic rate', unit: '%', get: (o) => o.iso, d: 1, noAvg: true },
  ];

  function renderSummary(all) {
    const head = `<caption>Results for all three runs. The highlighted column is the run shown above.</caption>
      <thead><tr><th>Result</th><th>Units</th>${all.map((_, i) => `<th class="n${i === cur ? ' is-cur' : ''}">Run ${i + 1}</th>`).join('')}<th class="n">Average</th></tr></thead>`;
    const body = ROWS.map((row) => {
      const vals = all.map((o) => row.get(o));
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const cells = vals.map((v, i) => {
        let tag = '';
        if (row.noAvg) tag = v >= 90 && v <= 110 ? ' <span class="tag cs-pass">pass</span>' : ' <span class="tag cs-fail">fail</span>';
        return `<td class="n${i === cur ? ' is-cur' : ''}">${fmt(v, row.d)}${tag}</td>`;
      }).join('');
      return `<tr><td>${row.label}</td><td>${row.unit}</td>${cells}<td class="n"><strong>${row.noAvg ? 'each run' : fmt(avg, row.d)}</strong></td></tr>`;
    }).join('');
    $('#sum-table').innerHTML = head + `<tbody>${body}</tbody>`;
  }

  /* ---------- Update everything ---------- */
  function update() {
    const r = runs[cur];
    const o = compute(r);
    STEPS.forEach((s) => {
      const card = $('#step-' + s.id);
      ST.tex(card.querySelector('.step-eq'), s.tex(r, o), true);
      const why = card.querySelector('.step-why');
      why.innerHTML = s.why(r, o);
      ST.renderTex(why);
    });
    const issues = validate(r, o);
    FIELDS.forEach((f) => $('#cf-' + f.k).setAttribute('aria-invalid', String(issues.some((i) => i.k === f.k))));
    $('#calc-alerts').innerHTML = issues.length
      ? `<div class="calc-alert"><p class="callout-title">Check these inputs on Run ${cur + 1}</p><ul>${issues.map((i) => `<li>${i.msg}</li>`).join('')}</ul></div>`
      : '';
    renderSummary(runs.map(compute));
  }

  /* ---------- CSV export ---------- */
  function csv() {
    const all = runs.map(compute);
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [['Parameter', 'Units', 'Run 1', 'Run 2', 'Run 3', 'Average'].map(q).join(',')];
    FIELDS.forEach((f) => {
      const vals = runs.map((r) => r[f.k]);
      lines.push([q(f.label), q(f.unit), ...vals.map((v) => (Number.isFinite(v) ? v : '')), ''].join(','));
    });
    lines.push([q('Fuel for F-factor'), q(''), q(FUELS[fuel].name), '', '', ''].join(','));
    ROWS.forEach((row) => {
      const vals = all.map((o) => row.get(o));
      const avg = row.noAvg ? '' : (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(row.d + 1);
      lines.push([q(row.label), q(row.unit), ...vals.map((v) => (Number.isFinite(v) ? v.toFixed(row.d + 1) : '')), avg].join(','));
    });
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'method-5-worked-example.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  ST.seg('calc-run', (v) => { cur = +v; fillForm(); update(); });
  $('#calc-reset').addEventListener('click', () => { runs = EXAMPLE.map((r) => ({ ...r })); fuel = 'coal'; fillForm(); update(); });
  $('#calc-csv').addEventListener('click', csv);

  fillForm();
  // KaTeX loads with `defer` before this script, so equations can render immediately.
  update();
})();
