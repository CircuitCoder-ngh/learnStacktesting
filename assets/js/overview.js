/* Overview: lifecycle stepper and test-day timeline. */
(function () {
  'use strict';
  const { $, svg: el, clamp } = ST;

  /* =========================================================
     Lifecycle stepper
     ========================================================= */
  const STAGES = [
    {
      short: 'Plan',
      title: 'Plan and write the protocol',
      when: '6 to 10 weeks before',
      body: [
        'Start from the permit and the applicable standard. Pin down which pollutants to measure, the limits and their units, the required methods, minimum run times or sample volumes, and the operating conditions the test must represent.',
        'The test contractor turns this into a test protocol, also called a site-specific test plan: sampling locations, methods, number and length of runs, quality assurance, process data to record, and the schedule. The facility then notifies the agency. NSPS require at least 30 days’ notice; many NESHAP and permits require more, and some require the plan to be approved first.',
      ],
      deliverables: ['Test protocol or site-specific test plan', 'Notification to the agency', 'Agency approval, where required'],
      checks: ['Applicable rules and limits identified', 'Methods, run times and volumes confirmed', 'Operating conditions agreed with the facility', 'Notification sent on time', 'Observer attendance confirmed'],
    },
    {
      short: 'Survey',
      title: 'Survey the site',
      when: 'Weeks before, or on a pre-test visit',
      body: [
        'Someone from the test team visits, or reviews photos and drawings with the facility. They check the ports (number, size, spacing, and distance from disturbances), the platform (guardrails, space to swing and withdraw a full-length probe), and how equipment gets up there.',
        'They also find power for heaters and pumps, a spot for the mobile lab, the route for sample lines, and site hazards such as positive-pressure ducts that blow hot gas out of open ports.',
      ],
      deliverables: ['Site survey notes and photos', 'Stack inside diameter and port nipple lengths', 'Equipment and power plan'],
      checks: ['Stack diameter and port depth measured', 'Distances to disturbances checked against Method 1', 'Clearance behind ports to withdraw the probe', 'Power and trailer location agreed', 'Positive-pressure ducts and other hazards noted'],
    },
    {
      short: 'Mobilize',
      title: 'Mobilize and calibrate',
      when: 'Days before',
      body: [
        'Results are only as good as the equipment’s calibrations, so they are checked before the trip. The dry gas meter needs a current calibration factor (Y) and orifice coefficient (ΔH@). Pitot tubes are inspected, nozzles measured, thermocouples and barometers checked.',
        'Filters are desiccated and weighed (tared), glassware is cleaned, reagents and rinse solvents prepared, and analyzer calibration gases checked against their certificates. Spares of everything breakable go in the truck.',
      ],
      deliverables: ['Calibration records', 'Tared filters and clean glassware', 'Packed, inventoried equipment'],
      checks: ['Meter box Y and ΔH@ current', 'Pitot tubes inspected', 'Nozzle diameters measured', 'Filters tared and logged', 'Calibration gas certificates in date'],
    },
    {
      short: 'Prelims',
      title: 'Preliminary measurements',
      when: 'Test day, before Run 1',
      body: [
        'On site, the crew confirms the stack dimensions, lays out the traverse points and marks the probe (Method 1), and checks for cyclonic flow. A preliminary velocity traverse gives the range of Δp readings and the stack temperature (Method 2). Moisture and gas composition are estimated (Methods 3 and 4).',
        'Those numbers choose the nozzle size and set up the isokinetic calculation for Method 5. For instrumental methods, the analyzers get their calibration error test, initial system bias check, and, where required, a stratification test to decide how many points to sample.',
      ],
      deliverables: ['Traverse point layout and marked probe', 'Preliminary field data', 'Nozzle selection and K-factor', 'Analyzer pre-test calibration data'],
      checks: ['Probe marked at each traverse point', 'Cyclonic flow check passed', 'Δp range and stack temperature recorded', 'Nozzle selected', 'Pre-test leak check passed'],
    },
    {
      short: 'Runs',
      title: 'Run the tests',
      when: 'Test day, usually three runs',
      body: [
        'With the process at the agreed conditions, each run traverses every point for the same length of time. At each point the crew reads the pitot Δp, sets the meter box ΔH to stay isokinetic, and logs temperatures, vacuum, and meter volume. Probe and filter heaters stay in range and the impinger outlet stays cold.',
        'Each run ends with a leak check at the highest vacuum reached. Analyzers get post-run bias and drift checks. Meanwhile the facility logs its process data for the same period.',
      ],
      deliverables: ['Field data sheets for each run', 'Analyzer data and calibration checks', 'Facility process data'],
      checks: ['Process conditions logged for each run', 'Equal sampling time at every point', 'Probe, filter and impinger temperatures in range', 'Post-run leak check passed', 'Analyzer bias and drift checks done'],
    },
    {
      short: 'Recovery',
      title: 'Recover the samples',
      when: 'After each run',
      body: [
        'The train is capped and carried to a clean recovery area. For Method 5, the filter goes into a labeled petri dish. The nozzle, probe liner, and front half of the filter holder are brushed and rinsed with acetone into a sample bottle. Impinger water is measured and the silica gel weighed for moisture.',
        'Every container is sealed, its liquid level marked, and logged on a chain-of-custody form that follows it to the lab. A blank of the rinse solvent is collected too.',
      ],
      deliverables: ['Sealed, labeled sample containers', 'Recovery data sheets', 'Chain-of-custody forms'],
      checks: ['Filter recovered intact', 'Front half rinsed until no particles are visible', 'Impinger water and silica gel weighed or measured', 'Containers sealed with levels marked', 'Chain of custody signed'],
    },
    {
      short: 'Lab',
      title: 'Analyze in the lab',
      when: 'Days to weeks after',
      body: [
        'Particulate filters and rinse residues are dried and weighed until the weight stops changing. Other methods go to instrumental analysis: ion chromatography for acid gases, ICP-MS for metals, gas chromatography for organics.',
        'The lab runs its own quality checks, such as blanks, spikes, and duplicates, and reports the mass of pollutant in each sample fraction.',
      ],
      deliverables: ['Lab report with sample masses', 'Lab quality control results'],
      checks: ['Samples arrived sealed and intact', 'Constant weight reached', 'Blanks within limits', 'Results reported with detection limits'],
    },
    {
      short: 'QA',
      title: 'Calculate and review',
      when: 'After lab results arrive',
      body: [
        'Field and lab data become results: sample volume at standard conditions, moisture, molecular weight, velocity, flow rate, concentration, emission rate, and percent isokinetic. Analyzer data is corrected for calibration bias.',
        'Then the quality review: were isokinetic rates within 90 to 110 percent, did every leak check pass, does the post-test meter calibration agree with the pre-test one, were drift and bias within limits? Finally, the three-run average is compared with the limit in the limit’s own units.',
      ],
      deliverables: ['Calculation workbook', 'Quality assurance summary', 'Results in the units of the standard'],
      checks: ['Isokinetic rate 90–110% for every run', 'Post-test meter check agrees with pre-test', 'Drift and bias within method limits', 'Results in the same units as the limit'],
    },
    {
      short: 'Report',
      title: 'Write and submit the report',
      when: 'Commonly due within 60 days',
      body: [
        'The report presents results against the limits, and enough supporting detail that a reviewer could repeat every calculation: process description and operating data, sampling locations, methods and any deviations, field data sheets, lab reports, calibration records, and chain of custody.',
        'It goes to the agency by the deadline in the rule or permit. Many federal standards now require electronic submittal using EPA’s Electronic Reporting Tool.',
      ],
      deliverables: ['Final test report', 'Submittal confirmation'],
      checks: ['Results stated in the units of the standard', 'Deviations explained', 'Report certified and signed', 'Submitted before the deadline'],
    },
  ];

  (function lifecycle() {
    const track = $('#life-track');
    if (!track) return;
    const panel = $('#life-panel'), fill = $('#life-fill'), count = $('#life-count');
    const prev = $('#life-prev'), next = $('#life-next');
    const saved = ST.store.get('life-checks', {});
    let cur = 0;

    const tabs = STAGES.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'life-step';
      b.id = `life-tab-${i}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'life-panel');
      b.innerHTML = `<span class="life-dot" aria-hidden="true">${i + 1}</span><span class="life-name">${s.short}</span><span class="visually-hidden">: ${s.title}</span>`;
      b.addEventListener('click', () => select(i, true));
      b.addEventListener('keydown', (e) => {
        const k = e.key;
        let to = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') to = Math.min(STAGES.length - 1, cur + 1);
        if (k === 'ArrowLeft' || k === 'ArrowUp') to = Math.max(0, cur - 1);
        if (k === 'Home') to = 0;
        if (k === 'End') to = STAGES.length - 1;
        if (to !== null) { e.preventDefault(); select(to, true); tabs[to].focus(); }
      });
      track.appendChild(b);
      return b;
    });

    function select(i, animate) {
      cur = clamp(i, 0, STAGES.length - 1);
      const s = STAGES[cur];
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === cur));
        t.tabIndex = k === cur ? 0 : -1;
        t.classList.toggle('is-past', k < cur);
      });
      panel.setAttribute('aria-labelledby', tabs[cur].id);
      fill.style.width = (100 * cur) / (STAGES.length - 1) + '%';
      const checks = saved[cur] || [];
      panel.innerHTML = `
        <div class="life-body">
          <div class="life-head"><h3>${s.title}</h3><span class="tag">${s.when}</span></div>
          ${s.body.map((p) => `<p>${p}</p>`).join('')}
        </div>
        <div class="life-lists">
          <div><h4>Deliverables</h4><ul>${s.deliverables.map((d) => `<li>${d}</li>`).join('')}</ul></div>
          <div><h4>Checklist</h4><ul class="life-checks">${s.checks
            .map((c, k) => `<li><label><input type="checkbox" data-k="${k}"${checks.includes(k) ? ' checked' : ''}><span>${c}</span></label></li>`)
            .join('')}</ul></div>
        </div>`;
      ST.$$('input[type="checkbox"]', panel).forEach((box) =>
        box.addEventListener('change', () => {
          const k = +box.dataset.k;
          const list = new Set(saved[cur] || []);
          box.checked ? list.add(k) : list.delete(k);
          saved[cur] = [...list];
          ST.store.set('life-checks', saved);
        })
      );
      if (animate && !ST.reducedMotion) {
        panel.classList.remove('is-entering');
        void panel.offsetWidth; // restart the entrance animation
        panel.classList.add('is-entering');
      }
      count.textContent = `Stage ${cur + 1} of ${STAGES.length}`;
      prev.disabled = cur === 0;
      next.disabled = cur === STAGES.length - 1;
    }

    prev.addEventListener('click', () => select(cur - 1, true));
    next.addEventListener('click', () => select(cur + 1, true));
    select(0, false);
  })();

  /* =========================================================
     Test-day timeline
     ========================================================= */
  (function testDay() {
    const svg = $('#day-svg');
    if (!svg) return;
    const T = (h, m = 0) => h * 60 + m;
    const T0 = T(6), T1 = T(15, 30);
    const X0 = 172, X1 = 985;
    const X = (t) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
    const DARK = '#14232C';

    const KINDS = {
      safety: { label: 'Safety', fill: 'var(--caution)', text: DARK },
      setup: { label: 'Setup and teardown', fill: 'var(--steel)', text: DARK },
      qa: { label: 'Checks and calibrations', fill: 'var(--water)', text: 'var(--paper)' },
      run: { label: 'Test run', fill: 'var(--ink)', text: 'var(--paper)' },
      recovery: { label: 'Sample recovery', fill: 'var(--soot)', text: 'var(--paper)' },
      process: { label: 'Process operation', fill: 'var(--gas)', text: 'var(--paper)' },
    };

    const LANES = [
      {
        name: 'Platform crew',
        tasks: [
          [T(6), T(6, 30), 'safety', 'Safety briefing', 'Job safety analysis, work permits, fall protection and gas monitor checks. The whole crew and the facility contact attend.'],
          [T(6, 30), T(8), 'setup', 'Rig up', 'Hoist probes, the heated filter box, impinger box, and umbilicals to the platform. Mount the probe support and run sample lines down to the trailer.'],
          [T(8), T(8, 45), 'qa', 'Preliminaries', 'Measure the stack through both ports, mark the probe at each traverse point, run the cyclonic flow check and a preliminary velocity traverse.', 'Prelims'],
          [T(8, 45), T(9), 'qa', 'Leak checks', 'Leak check the Method 5 train and the pitot lines. Bring the probe and filter heaters up to temperature.'],
          [T(9), T(10, 10), 'run', 'Run 1', 'Traverse both ports with equal time at every point. Read Δp, set ΔH, and log temperatures, vacuum, and meter volume at each point. Change ports at the halfway mark.'],
          [T(10, 10), T(10, 25), 'qa', 'Post-run leak check', 'Leak check at the highest vacuum reached during the run, then cap the train and send it down for recovery.'],
          [T(10, 25), T(10, 45), 'setup', 'Train swap', 'Install a fresh, pre-assembled train, let the heaters stabilize, and leak check before Run 2.', 'Swap'],
          [T(10, 45), T(11, 55), 'run', 'Run 2', 'Same traverse as Run 1. The crew watches for changes in Δp or temperature that hint at a process upset.'],
          [T(11, 55), T(12, 10), 'qa', 'Post-run leak check', 'Leak check, cap, and send the train down.'],
          [T(12, 10), T(12, 30), 'setup', 'Train swap', 'Fresh train in, heaters stable, leak check. Crews often eat in shifts here.', 'Swap'],
          [T(12, 30), T(13, 40), 'run', 'Run 3', 'The final traverse. If any earlier run had a problem, a fourth run may be added while everyone is still set up.'],
          [T(13, 40), T(13, 55), 'qa', 'Final leak check', 'Last post-run leak check on the train and pitot lines.'],
          [T(13, 55), T(15, 30), 'setup', 'Teardown', 'Pull the probes, lower the equipment, cap the ports, and leave the platform clean.'],
        ],
      },
      {
        name: 'Trailer and lab crew',
        tasks: [
          [T(6), T(6, 30), 'safety', 'Safety briefing', 'Same briefing as the platform crew, plus cylinder handling and trailer electrical checks.'],
          [T(6, 30), T(7, 30), 'setup', 'Analyzer warm-up', 'Power up the analyzers, heated sample line, and sample conditioner, and let them stabilize.', 'Warm-up'],
          [T(7, 30), T(8, 15), 'qa', 'Calibration error test', 'Inject zero, mid, and high Protocol gases straight into each analyzer. Each response must be within 2% of the calibration span.', 'Cal error'],
          [T(8, 15), T(9), 'qa', 'System bias and response time', 'Send calibration gas to the probe to check bias through the whole sampling system and time how long the response takes. Stratification readings come back from the platform.', 'Bias'],
          [T(9), T(10, 10), 'run', 'Run 1 logging', 'Analyzers log O₂, CO₂, NOₓ, and CO continuously while the data system records one-minute averages.'],
          [T(10, 10), T(10, 45), 'recovery', 'Recover Run 1', 'Post-run bias and drift checks on the analyzers. Filter into a petri dish; nozzle, probe, and filter holder rinsed with acetone; impinger water measured and silica gel weighed.'],
          [T(10, 45), T(11, 55), 'run', 'Run 2 logging', 'Analyzers log Run 2 while the recovery technician seals, labels, and logs the Run 1 samples.'],
          [T(11, 55), T(12, 30), 'recovery', 'Recover Run 2', 'Bias and drift checks, then recovery of the second train.'],
          [T(12, 30), T(13, 40), 'run', 'Run 3 logging', 'Last run of continuous data. The crew starts reviewing Run 1 and 2 data for obvious problems.'],
          [T(13, 40), T(14, 30), 'recovery', 'Recover Run 3', 'Final bias and drift checks, recovery of the last train, a solvent blank, and chain-of-custody forms completed.'],
          [T(14, 30), T(15, 30), 'setup', 'Pack out', 'Cylinders secured, data backed up in two places, samples packed for the lab.'],
        ],
      },
      {
        name: 'Facility',
        tasks: [
          [T(6), T(6, 30), 'safety', 'Safety briefing', 'The facility contact issues work permits and reviews site hazards and emergency procedures.'],
          [T(6, 30), T(9), 'process', 'Bring to test load', 'Operators bring the unit to the agreed operating rate and hold it steady, so conditions are stable before Run 1.', 'Bring to test load'],
          [T(9), T(10, 10), 'process', 'Run 1: log process data', 'Production or fuel rate, control device readings, and anything unusual are logged for the run period. An agency observer may watch the runs and review this data.', 'Run 1 data'],
          [T(10, 10), T(10, 45), 'process', 'Hold load', 'The unit stays at test conditions between runs so Run 2 can start on time.', 'Hold'],
          [T(10, 45), T(11, 55), 'process', 'Run 2: log process data', 'Same records as Run 1. If anything trips or drops, the operator tells the test crew right away.', 'Run 2 data'],
          [T(11, 55), T(12, 30), 'process', 'Hold load', 'Steady operation between runs.', 'Hold'],
          [T(12, 30), T(13, 40), 'process', 'Run 3: log process data', 'The last run’s process records complete the set the report will need.', 'Run 3 data'],
          [T(13, 40), T(15, 30), 'process', 'Back to normal operation', 'Once the crew confirms the last run is good, the unit returns to normal operation and the facility signs off.', 'Normal operation'],
        ],
      },
    ];

    const fmtTime = (t) => {
      const h = Math.floor(t / 60), m = Math.round(t % 60);
      const hh = ((h + 11) % 12) + 1;
      return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
    };

    /* --- Static drawing --- */
    const laneY = (i) => 52 + i * 78, laneH = 56;
    for (let h = 6; h <= 15; h++) {
      const x = X(T(h));
      el('line', { x1: x, x2: x, y1: 34, y2: 290, class: 'dg-rule', opacity: 0.5 }, svg);
      el('text', { x, y: 24, class: 'dg-label', 'text-anchor': 'middle', text: `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}` }, svg);
    }
    const bars = [];
    LANES.forEach((lane, i) => {
      const y = laneY(i);
      el('text', { x: 12, y: y + laneH / 2 + 5, class: 'dg-label-strong', text: lane.name }, svg);
      lane.tasks.forEach((task) => {
        const [a, b, kind, title, , short] = task;
        const k = KINDS[kind];
        const g = el('g', { class: 'day-bar' }, svg);
        const x = X(a) + 1, w = X(b) - X(a) - 2;
        const rect = el('rect', { x, y, width: w, height: laneH, rx: 5, style: `fill:${k.fill}`, opacity: 0.32 }, g);
        const name = short || title;
        const words = name.length * 6.6 + 12;
        const label = w > words ? el('text', { x: x + 7, y: y + laneH / 2 + 4.5, style: 'font-size:12.5px;font-weight:600', text: name }, g) : null;
        bars.push({ lane: i, task, rect, label, kind: k });
      });
    });

    // Scrubber
    const scrub = el('g', {}, svg);
    const scrubLine = el('line', { y1: 34, y2: 292, style: 'stroke:var(--gauge);stroke-width:2' }, scrub);
    const scrubKnob = el('circle', { cy: 34, r: 7, style: 'fill:var(--gauge);stroke:var(--panel);stroke-width:2' }, scrub);
    const hit = el('rect', { x: X0, y: 0, width: X1 - X0, height: 300, fill: 'transparent', style: 'cursor:ew-resize' }, svg);

    const range = $('#day-time');
    let t = +range.value;

    function setTime(v) {
      t = clamp(Math.round(v / 5) * 5, T0, T1);
      range.value = t;
      ST.paintRange(range);
      render();
    }

    function render() {
      const x = X(t);
      scrubLine.setAttribute('x1', x); scrubLine.setAttribute('x2', x);
      scrubKnob.setAttribute('cx', x);
      $('#day-clock').textContent = fmtTime(t);

      const now = $('#day-now');
      now.innerHTML = '';
      let phase = '';
      LANES.forEach((lane, i) => {
        const task = lane.tasks.find(([a, b]) => t >= a && t < b) || (t >= T1 ? lane.tasks[lane.tasks.length - 1] : null);
        const k = task ? KINDS[task[2]] : null;
        const div = document.createElement('div');
        div.className = 'day-lane';
        if (k) div.style.borderTopColor = k.fill;
        div.innerHTML = `<div class="day-lane-name">${lane.name}</div><p class="day-task">${task ? task[3] : 'Off site'}</p><p class="day-detail">${task ? task[4] : ''}</p>`;
        now.appendChild(div);
        if (i === 0 && task && task[2] === 'run') {
          const done = Math.round(t - task[0]), total = task[1] - task[0];
          phase = `${task[3]} underway: ${done} of ${total} minutes`;
        }
      });
      if (!phase) {
        const runs = LANES[0].tasks.filter((x) => x[2] === 'run');
        const doneRuns = runs.filter((r) => t >= r[1]).length;
        phase = t < runs[0][0] ? 'Before Run 1' : doneRuns === runs.length ? 'All three runs complete' : `${doneRuns} of ${runs.length} runs complete`;
      }
      $('#day-phase').textContent = phase;
      bars.forEach((b) => {
        const [a, e] = b.task;
        const on = t >= a && t < e;
        b.rect.setAttribute('opacity', on ? 1 : 0.32);
        if (b.label) b.label.style.fill = on ? b.kind.text : 'var(--ink)';
      });
    }

    // Dragging on the timeline
    const toTime = (ev) => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return T0 + ((p.x - X0) / (X1 - X0)) * (T1 - T0);
    };
    hit.addEventListener('pointerdown', (e) => {
      hit.setPointerCapture(e.pointerId);
      if (loop.playing) loop.pause();
      setTime(toTime(e));
      const move = (ev) => setTime(toTime(ev));
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerup', () => hit.removeEventListener('pointermove', move), { once: true });
    });
    range.addEventListener('input', () => { if (loop.playing) loop.pause(); t = +range.value; render(); });

    // Legend
    $('#day-legend').innerHTML = Object.values(KINDS).map((k) => `<span><i style="background:${k.fill}"></i>${k.label}</span>`).join('');

    // Play sweeps the day at about 40 minutes per second
    let acc = t;
    const loop = ST.loop(svg, (dt) => {
      if (!dt) return;
      acc = t + dt * 40;
      if (acc > T1) acc = T0;
      t = acc;
      range.value = Math.round(t / 5) * 5;
      ST.paintRange(range);
      render();
    }, { autoplay: false, buttonHost: svg.parentElement });

    render();
  })();
})();
