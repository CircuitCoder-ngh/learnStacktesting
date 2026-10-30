/* The movie: an animated, scrubbable summary of the whole course.
   Every frame is a pure function of the playhead time, so scrubbing and
   chapter jumps land on exactly the same picture as playback. */
(function () {
  'use strict';
  const { $ } = ST;
  const canvas = $('#film-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 720;

  // The film stays dark in both themes, like the home page hero panel.
  const C = {
    bg: '#0F1E26', grid: 'rgba(120,160,175,0.055)', panel: '#172C37', panel2: '#132833',
    ink: '#E3ECEF', ink2: '#AFC2C9', dim: '#7F95A0', faint: '#33505E',
    gas: '#3FCABD', gasRGB: '63,202,189', gauge: '#FF6B57', water: '#6DA6FF', waterRGB: '109,166,255',
    caution: '#F4C13D', soot: '#D8AE7E', steel: '#9FB0B8', steelHi: '#D5DEE2', wall: '#3C4F59', hatch: '#5E7581',
    geom: '#8DB3C9', paper: '#E6EDEF', paperInk: '#14232C', pink: '#E68DB0', stack: '#1D3440',
  };
  const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const BODY = '"Public Sans", system-ui, sans-serif';

  /* =========================================================
     Helpers
     ========================================================= */
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const out = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  const io = (x) => ST.ease(clamp01(x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmtN = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const FR6 = [0.044, 0.146, 0.296, 0.704, 0.854, 0.956]; // 6 points per diameter, fraction of D from the port wall

  /** Run fn with extra transparency; skipped when invisible. */
  function A(a, fn) { if (a <= 0.002) return; ctx.save(); ctx.globalAlpha *= Math.min(1, a); fn(); ctx.restore(); }
  const font = (size, w, disp) => `${w} ${size}px ${disp ? DISPLAY : BODY}`;
  function txt(s, x, y, o = {}) {
    ctx.save();
    if (o.a !== undefined) ctx.globalAlpha *= clamp01(o.a);
    ctx.font = font(o.size || 20, o.w || 500, o.disp);
    ctx.fillStyle = o.c || C.ink;
    ctx.textAlign = o.al || 'left';
    ctx.textBaseline = o.bl || 'alphabetic';
    ctx.fillText(String(s), x, y);
    ctx.restore();
  }
  /** Text with _sub, _{sub}, ^sup and ^{sup} markup. */
  function tokens(s) {
    const list = [];
    let buf = '', i = 0;
    while (i < s.length) {
      const ch = s[i];
      if ((ch === '_' || ch === '^') && i + 1 < s.length) {
        if (buf) list.push({ t: buf, k: 0 });
        buf = '';
        let g;
        if (s[i + 1] === '{') { const j = s.indexOf('}', i + 2); g = s.slice(i + 2, j); i = j + 1; }
        else { g = s[i + 1]; i += 2; }
        list.push({ t: g, k: ch === '_' ? 1 : 2 });
      } else { buf += ch; i++; }
    }
    if (buf) list.push({ t: buf, k: 0 });
    return list;
  }
  function rt(s, x, y, o = {}) {
    const size = o.size || 24, w = o.w || 500;
    const tk = tokens(s);
    ctx.save();
    if (o.a !== undefined) ctx.globalAlpha *= clamp01(o.a);
    ctx.fillStyle = o.c || C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let total = 0;
    tk.forEach((k) => { ctx.font = font(k.k ? size * 0.64 : size, w, o.disp); k.w = ctx.measureText(k.t).width; total += k.w; });
    let cx = o.al === 'center' ? x - total / 2 : o.al === 'right' ? x - total : x;
    tk.forEach((k) => {
      ctx.font = font(k.k ? size * 0.64 : size, w, o.disp);
      ctx.fillText(k.t, cx, y + (k.k === 1 ? size * 0.24 : k.k === 2 ? -size * 0.4 : 0));
      cx += k.w;
    });
    ctx.restore();
    return total;
  }
  /** A big number followed by a smaller unit. */
  function numUnit(n, unit, x, y, size, c) {
    ctx.font = font(size, 700, true);
    const w = ctx.measureText(n).width;
    txt(n, x, y, { size, disp: true, w: 700, c });
    txt(unit, x + w + 12, y, { size: Math.max(16, Math.round(size * 0.3)), c: C.ink2 });
  }
  function rr(x, y, w, h, r, fill, stroke, lw = 1.5) {
    if (w <= 0 || h <= 0) return;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function ln(x1, y1, x2, y2, c, lw = 1.5, dash) {
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }
  function circ(x, y, r, fill, stroke, lw = 1.5) {
    if (r <= 0) return;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function head(x, y, ang, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s, -s * 0.55); ctx.lineTo(-s, s * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function arrow(x1, y1, x2, y2, c, lw = 2, s = 11) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ln(x1, y1, x2 - Math.cos(a) * s * 0.7, y2 - Math.sin(a) * s * 0.7, c, lw);
    head(x2, y2, a, s, c);
  }
  function lens(pts) {
    const L = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
    return { L, tot };
  }
  /** Draw the first fraction p of a polyline. */
  function poly(pts, p, c, lw = 2, dash) {
    if (p <= 0) return;
    const { L, tot } = lens(pts);
    let rem = tot * clamp01(p);
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && rem > 0; i++) {
      const f = Math.min(1, rem / L[i - 1]);
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
      rem -= L[i - 1];
    }
    ctx.stroke();
    ctx.restore();
  }
  /** Point at fraction s along a polyline. */
  function along(pts, s) {
    const { L, tot } = lens(pts);
    let d = tot * clamp01(s);
    for (let i = 1; i < pts.length; i++) {
      if (d <= L[i - 1] || i === pts.length - 1) {
        const f = L[i - 1] ? Math.min(1, d / L[i - 1]) : 0;
        return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
      }
      d -= L[i - 1];
    }
    return pts[pts.length - 1];
  }
  /** Stack wall in section, hatched the way engineering drawings show cut material. */
  function wall(x, y, w, h) {
    if (h <= 0 || w <= 0) return;
    ctx.save();
    ctx.fillStyle = C.wall; ctx.fillRect(x, y, w, h);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = C.hatch; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = y - w; k < y + h + w; k += 7) { ctx.moveTo(x, k + w); ctx.lineTo(x + w, k); }
    ctx.stroke();
    ctx.restore();
  }
  function grid() {
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0.5; x < W; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0.5; y < H; y += 32) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }
  /** Upward gas streaks inside a box, deterministic in t. */
  function streaks(x0, y0, w, h, n, t, o = {}) {
    const sp = o.speed || 150, seed = o.seed || 1, a = o.a === undefined ? 1 : o.a;
    if (a <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) {
      const u = rnd(i * 3.7 + seed), v = rnd(i * 9.1 + seed * 2), k = 0.8 + 0.4 * rnd(i * 5.3 + seed * 3);
      const pr = o.profile ? Math.pow(Math.max(0.02, 1 - Math.abs(2 * u - 1)), 1 / 7) : 1;
      const x = x0 + 3 + u * (w - 6);
      const len = 6 + 12 * pr;
      const y = y0 + h + 20 - ((v * (h + 40) + t * sp * pr * k) % (h + 40));
      ctx.strokeStyle = `rgba(${C.gasRGB},${(0.25 + 0.5 * rnd(i + seed * 7)) * a * (0.5 + 0.5 * pr)})`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
    ctx.restore();
  }
  function plume(x, y, t, s, a, n = 30, seed = 0) {
    if (a <= 0) return;
    for (let i = 0; i < n; i++) {
      const age = (rnd(i + seed) + t * 0.11) % 1;
      circ(x + age * 260 * s + Math.sin(i * 1.7 + t * 0.7) * 12 * age * s,
        y - age * 190 * s - rnd(i + seed + 31) * 14 * s,
        (8 + age * 46) * s, `rgba(205,220,226,${(1 - age) * 0.12 * a})`);
    }
  }
  /** Square-ish badge with a lesson number, anchored at its top-left. Returns width. */
  function badge(label, x, y, o = {}) {
    const h = o.h || 34, size = o.size || 22;
    ctx.font = font(size, 600, true);
    const w = Math.max(h, ctx.measureText(label).width + 18);
    rr(x, y, w, h, 7, o.fill || null, o.stroke || C.ink2, 1.6);
    txt(label, x + w / 2, y + h / 2 + 1, { size, w: 600, disp: true, al: 'center', bl: 'middle', c: o.c || C.ink });
    return w;
  }
  /** Pill with text centered on (x, y). */
  function chip(s, x, y, o = {}) {
    const size = o.size || 18;
    ctx.font = font(size, 600, false);
    const w = ctx.measureText(s).width + 30, h = size + 16;
    rr(x - w / 2, y - h / 2, w, h, h / 2, o.bg || 'rgba(63,202,189,0.15)', o.stroke || null);
    txt(s, x, y + 1, { size, w: 600, al: 'center', bl: 'middle', c: o.c || C.gas });
  }
  function check(x, y, s, c) {
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = s * 0.18; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s * 0.1, y + s * 0.3); ctx.lineTo(x + s * 0.45, y - s * 0.35); ctx.stroke();
    ctx.restore();
  }
  /** Caution-tape stripes: used only for pass/fail limits, as on the rest of the site. */
  function stripes(x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = C.caution; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1B2A33';
    for (let k = x - h; k < x + w + h; k += 14) {
      ctx.beginPath(); ctx.moveTo(k, y + h); ctx.lineTo(k + 7, y + h); ctx.lineTo(k + 7 + h, y); ctx.lineTo(k + h, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function dial(x, y, r, ang, label) {
    circ(x, y, r, C.panel2, C.ink2, 2);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; ln(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, C.dim, 1.2); }
    ln(x, y, x + Math.cos(ang) * r * 0.72, y + Math.sin(ang) * r * 0.72, C.gauge, 2.5);
    circ(x, y, 3.5, C.ink);
    if (label) txt(label, x, y + r + 20, { al: 'center', size: 15, c: C.dim });
  }

  /* =========================================================
     Scenes. Each draw(t) gets local time in seconds.
     ========================================================= */

  function sIntro(t) {
    const g = out(seg(t, 0.2, 2.4));
    ln(0, 650, W, 650, C.faint, 2);
    A(seg(t, 0.6, 1.8), () => {
      rr(560, 530, 250, 120, 4, C.panel, C.faint);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) rr(580 + i * 45, 552 + j * 44, 26, 22, 3, 'rgba(244,193,61,0.16)');
      rr(600, 500, 20, 30, 2, C.panel, C.faint);
      rr(650, 508, 14, 22, 2, C.panel, C.faint);
    });
    const sx = 850, sw = 120, top = lerp(650, 150, g);
    ctx.fillStyle = C.stack;
    ctx.beginPath(); ctx.moveTo(sx, 650); ctx.lineTo(sx + 10, top); ctx.lineTo(sx + sw - 10, top); ctx.lineTo(sx + sw, 650); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5; ctx.stroke();
    if (g > 0.98) [0.1, 0.72].forEach((f) => { const y = lerp(150, 650, f); ln(sx + 8, y, sx + sw - 8, y, C.faint, 1.5); });
    const py = lerp(150, 650, 0.42);
    A(seg(t, 2.2, 2.8), () => {
      ln(sx - 40, py, sx + sw + 40, py, C.steel, 3);
      ln(sx - 40, py - 28, sx + sw + 40, py - 28, C.dim, 1.5);
      for (let k = 0; k <= 6; k++) { const x = sx - 40 + (k * (sw + 80)) / 6; ln(x, py, x, py - 28, C.dim, 1.2); }
      rr(sx + sw - 4, py - 20, 16, 9, 1, C.gauge);
    });
    plume(sx + sw / 2, top - 8, amb, 1.15, seg(t, 2.0, 3.6), 46, 7);
    const a1 = out(seg(t, 1.9, 3.1)), a2 = out(seg(t, 2.7, 3.9)), a3 = out(seg(t, 4.8, 6.0));
    txt('Stack testing', 110, 300 + (1 - a1) * 26, { disp: true, w: 700, size: 124, a: a1 });
    txt('from the port to the report.', 114, 372 + (1 - a2) * 20, { disp: true, w: 600, size: 58, a: a2, c: C.ink2 });
    txt('A visual summary of every lesson in the Stack Testing Field Guide', 116, 440, { size: 22, a: a3, c: C.dim });
  }

  function sWhy(t) {
    A(1 - seg(t, 4.5, 5.2), () => {
      const a = out(seg(t, 0.1, 1.0));
      A(a, () => {
        rr(150, 380, 160, 100, 4, C.panel, C.faint);
        rr(268, 250, 28, 130, 2, C.stack, C.faint);
        for (let i = 0; i < 3; i++) rr(166 + i * 34, 410, 20, 18, 2, 'rgba(244,193,61,0.16)');
        plume(282, 246, amb, 0.45, 1, 22, 3);
        ln(110, 480, 360, 480, C.faint, 2);
        txt('Facility', 230, 520, { al: 'center', size: 20, c: C.ink2 });
      });
      const b = seg(t, 1.0, 1.8);
      poly([[380, 400], [522, 400]], b, C.dim, 2);
      if (b >= 1) head(532, 400, 0, 12, C.dim);
      txt('holds an', 455, 386, { al: 'center', size: 16, c: C.dim, a: b });
      const c = out(seg(t, 1.6, 2.5));
      A(c, () => {
        const y = 270 + (1 - c) * 20;
        rr(545, y, 290, 250, 10, C.paper);
        txt('Air permit', 570, y + 48, { disp: true, w: 700, size: 34, c: C.paperInk });
        ln(570, y + 66, 810, y + 66, 'rgba(20,35,44,0.2)', 1.5);
        ['Particulate: 15 lb/hr', 'NOₓ: 50 ppmvd at 7% O₂', 'Tested by EPA methods', 'Three runs, averaged'].forEach((s, i) =>
          txt(s, 570, y + 104 + i * 34, { size: 19, c: C.paperInk, w: i < 2 ? 600 : 400 }));
      });
      const d = seg(t, 2.6, 3.4);
      poly([[850, 400], [962, 400]], d, C.dim, 2);
      if (d >= 1) head(972, 400, 0, 12, C.dim);
      txt('checked by', 905, 386, { al: 'center', size: 16, c: C.dim, a: d });
      const e = out(seg(t, 3.2, 4.0));
      A(e, () => {
        circ(1070, 400, 78 * (0.8 + 0.2 * e), C.panel, C.geom, 2.5);
        txt('Agency', 1070, 398, { al: 'center', size: 32, disp: true, w: 600 });
        txt('state, local or EPA', 1070, 426, { al: 'center', size: 15, c: C.dim });
      });
    });

    const by = 180, bw = 300, bh = 190;
    const boxes = [
      { x: 100, sym: 'E', name: 'Emission rate', unit: 'lb/hr', at: 5.0, c: C.caution },
      { x: 490, sym: 'C', name: 'Concentration', unit: 'gr/dscf or ppmvd', at: 5.9, c: C.soot },
      { x: 880, sym: 'Q_{sd}', name: 'Dry standard flow', unit: 'dscf/hr', at: 6.8, c: C.gas },
    ];
    boxes.forEach((b) => {
      const a = out(seg(t, b.at, b.at + 0.8));
      A(a, () => {
        const y = by + (1 - a) * 30;
        rr(b.x, y, bw, bh, 14, C.panel, b.c, 2);
        rt(b.sym, b.x + bw / 2, y + 98, { size: 80, w: 700, disp: true, al: 'center', c: b.c });
        txt(b.name, b.x + bw / 2, y + 146, { al: 'center', size: 22 });
        txt(b.unit, b.x + bw / 2, y + 172, { al: 'center', size: 17, c: C.dim });
      });
    });
    txt('=', 445, by + 112, { al: 'center', size: 64, disp: true, w: 600, a: out(seg(t, 5.7, 6.4)) });
    txt('×', 835, by + 112, { al: 'center', size: 64, disp: true, w: 600, a: out(seg(t, 6.6, 7.3)) });

    const src = (labels, cx, at, caption, c) => {
      const a = out(seg(t, at, at + 0.8));
      A(a, () => {
        const total = labels.length * 56 + (labels.length - 1) * 12;
        let x = cx - total / 2;
        labels.forEach((l) => {
          ln(x + 28, 432, x + 28, by + bh + 6, C.faint, 1.5, [3, 4]);
          badge(l, x, 432, { h: 52, size: 28, stroke: c, c });
          x += 68;
        });
        txt(caption, cx, 520, { al: 'center', size: 19, c: C.ink2 });
      });
    };
    src(['1', '2', '3', '4'], 1030, 10.4, 'measure the flow', C.gas);
    src(['5', '7E'], 640, 11.6, 'measure the concentration', C.soot);

    const g = out(seg(t, 13.0, 14.2));
    A(g, () => {
      txt('Compared with the permit limit', 250, 455, { al: 'center', size: 18, c: C.ink2 });
      rr(110, 472, 280, 14, 7, C.panel, C.faint);
      rr(110, 472, 280 * 0.647 * g, 14, 7, C.caution);
      ln(390, 464, 390, 494, C.gauge, 3);
      txt('9.7 lb/hr', 110, 520, { size: 18, w: 600, c: C.caution });
      txt('limit 15', 390, 520, { al: 'right', size: 16, c: C.gauge });
    });
  }

  function sPlan(t) {
    const xs = [170, 362, 554, 746, 938, 1130], y = 290;
    const stops = [
      ['Test protocol', 'Weeks before'], ['Agency notice', '30+ days ahead for NSPS'], ['Site survey', 'Ports, platform, power'],
      ['Test day', 'Three runs'], ['Lab and math', 'Analysis and QA review'], ['Report', 'Submitted to the agency'],
    ];
    poly([[110, y], [1190, y]], io(seg(t, 0, 1.8)), C.faint, 3);
    const k = ST.clamp((t - 1.6) / 1.45, 0, 5);
    stops.forEach(([title, when], i) => {
      const at = 0.9 + i * 1.45, a = out(seg(t, at, at + 0.6));
      if (a <= 0) return;
      const reached = k >= i - 0.02;
      circ(xs[i], y, 30 * (0.6 + 0.4 * a), reached ? C.panel : C.bg, reached ? C.geom : C.faint, 2.5);
      txt(i + 1, xs[i], y + 2, { al: 'center', bl: 'middle', size: 28, disp: true, w: 600, a });
      txt(title, xs[i], y - 54, { al: 'center', size: 28, disp: true, w: 600, a });
      txt(when, xs[i], y + 62, { al: 'center', size: 16, c: C.dim, a });
    });
    if (t > 1.6) {
      const i0 = Math.floor(k), f = io(k - i0);
      const tx = i0 >= 5 ? xs[5] : lerp(xs[i0], xs[i0 + 1], f);
      circ(tx, y, 40, null, C.gas, 3);
    }
    const d = out(seg(t, 9.6, 10.6));
    A(d, () => {
      const x0 = 506, w = 480, yy = 410;
      ln(746, y + 80, 746, yy - 8, C.faint, 1.5, [3, 4]);
      rr(x0, yy, w, 126, 12, C.panel, C.faint);
      txt('A typical test day', x0 + 20, yy + 32, { size: 17, c: C.ink2, w: 600 });
      const blocks = [['Setup', 0, 0.15, false], ['Run 1', 0.17, 0.2, true], ['Run 2', 0.41, 0.2, true], ['Run 3', 0.65, 0.2, true], ['Pack', 0.88, 0.12, false]];
      blocks.forEach(([s, f0, fw, run], i) => {
        const g2 = out(seg(t, 10.2 + i * 0.35, 10.7 + i * 0.35));
        const bx = x0 + 20 + f0 * (w - 40), full = fw * (w - 40);
        rr(bx, yy + 54, full * g2, 46, 6, run ? 'rgba(63,202,189,0.22)' : C.panel2, run ? C.gas : C.faint, 1.5);
        if (g2 > 0.6) txt(s, bx + full / 2, yy + 83, { al: 'center', size: 16, w: 600, c: run ? C.gas : C.ink2 });
      });
    });
  }

  function fig11(b) { return b < 5 ? 24 : b < 6 ? 20 : b < 7 ? 16 : 12; }
  function sM1(t) {
    // Elevation of the stack: inlet disturbance at the bottom, exit at the top
    const D = 44, cx = 250, L = cx - D / 2, R = cx + D / 2, yd = 556, yb = 600, yp = yd - 8 * D, ye = yp - 2 * D;
    const g = out(seg(t, 0, 1.4));
    const top = lerp(yb, ye, g);
    A(seg(t, 0, 0.8), () => {
      ctx.fillStyle = C.panel2; ctx.fillRect(80, yd, L - 80, yb - yd);
      ln(80, yd, L, yd, C.ink2, 2); ln(80, yb, L, yb, C.ink2, 2);
      txt('Inlet', 84, yd - 10, { size: 16, c: C.dim });
    });
    ctx.fillStyle = C.panel2; ctx.fillRect(L, top, D, yb - top);
    streaks(L, top, D, yb - top, 14, amb, { speed: 120, seed: 4, a: 0.9 });
    ln(L, top, L, yd, C.ink2, 2); ln(R, top, R, yb, C.ink2, 2);
    ln(60, yb, R + 90, yb, C.faint, 2);
    A(seg(t, 1.2, 1.8), () => txt('Exit', R + 12, ye + 6, { size: 16, c: C.dim }));
    const dx = L - 30, pb = io(seg(t, 1.8, 3.4)), pa = io(seg(t, 3.6, 4.6));
    if (pb > 0) {
      ln(dx, yd, dx, lerp(yd, yp, pb), C.caution, 2); ln(dx - 7, yd, dx + 7, yd, C.caution, 2);
      txt(`${fmtN(8 * pb, 1)} D`, dx - 10, lerp(yd, yp, pb / 2) + 7, { al: 'right', size: 24, disp: true, w: 600, c: C.caution });
    }
    if (pb >= 1) ln(dx - 7, yp, dx + 7, yp, C.caution, 2);
    if (pa > 0) {
      ln(dx, yp, dx, lerp(yp, ye, pa), C.caution, 2);
      txt(`${fmtN(2 * pa, 1)} D`, dx - 10, lerp(yp, ye, pa / 2) + 7, { al: 'right', size: 24, disp: true, w: 600, c: C.caution });
    }
    if (pa >= 1) ln(dx - 7, ye, dx + 7, ye, C.caution, 2);
    A(seg(t, 4.6, 5.2), () => {
      rr(R, yp - 6, 16, 12, 2, C.gauge);
      ln(R, yp + 22, R + 72, yp + 22, C.steel, 3);
      ln(R + 68, yp + 22, R + 68, yp - 8, C.dim, 1.5);
      txt('Port', R + 22, yp - 12, { size: 16, w: 600 });
    });
    txt('The 8-and-2 rule', 380, 150, { disp: true, w: 600, size: 40, a: out(seg(t, 4.8, 5.6)) });
    txt('8 diameters after a disturbance, 2 before the next', 382, 184, { size: 19, c: C.ink2, a: out(seg(t, 5.0, 5.8)) });

    // Figure 1-1: closer to a disturbance means more points
    A(out(seg(t, 6, 6.8)) * (1 - seg(t, 19.4, 20.2)), () => {
      const X0 = 420, X1 = 740, Y0 = 250, Y1 = 470;
      const X = (b) => X0 + ((b - 2) / 8) * (X1 - X0), Y = (p) => Y1 - ((p - 8) / 18) * (Y1 - Y0);
      rr(X0, Y0, X1 - X0, Y1 - Y0, 6, 'rgba(23,44,55,0.6)', C.faint);
      [12, 16, 20, 24].forEach((p) => { ln(X0, Y(p), X1, Y(p), C.faint, 1, [2, 4]); txt(p, X0 - 8, Y(p) + 5, { al: 'right', size: 14, c: C.dim }); });
      [2, 4, 6, 8, 10].forEach((b) => txt(b, X(b), Y1 + 20, { al: 'center', size: 14, c: C.dim }));
      txt('Diameters downstream, B', (X0 + X1) / 2, Y1 + 42, { al: 'center', size: 15, c: C.dim });
      txt('Points', X0 - 8, Y0 - 10, { al: 'right', size: 15, c: C.dim });
      const steps = [[2, 24], [5, 24], [5, 20], [6, 20], [6, 16], [7, 16], [7, 12], [10, 12]].map(([b, p]) => [X(b), Y(p)]);
      poly(steps, io(seg(t, 6.4, 8.0)), C.ink, 2.5);
      const B = lerp(9, 5.5, io(seg(t, 9.0, 10.6)));
      A(out(seg(t, 8.0, 8.6)), () => {
        const P = fig11(B);
        circ(X(B), Y(P), 8, C.caution);
        txt(`${P} points`, X(B) + 12, Y(P) - 12, { size: 22, disp: true, w: 600, c: C.caution });
      });
    });

    // Equal-area cross-section
    const CX = 1010, CY = 335, CR = 165;
    A(out(seg(t, 10.8, 11.6)), () => {
      txt('Equal areas, 12 points', CX, 145, { al: 'center', size: 30, disp: true, w: 600 });
      for (let k = 3; k >= 1; k--) {
        const a = out(seg(t, 11 + (3 - k) * 0.7, 11.7 + (3 - k) * 0.7));
        A(a, () => circ(CX, CY, CR * Math.sqrt(k / 3), k % 2 ? 'rgba(141,179,201,0.24)' : 'rgba(141,179,201,0.08)'));
      }
      circ(CX, CY, CR, null, C.ink2, 3);
      ln(CX - CR, CY, CX + CR, CY, C.faint, 1, [3, 4]);
      ln(CX, CY - CR, CX, CY + CR, C.faint, 1, [3, 4]);
      rr(CX + CR + 2, CY - 8, 22, 16, 2, C.steel);
      rr(CX - 8, CY + CR + 2, 16, 22, 2, C.steel);
      txt('A', CX + CR + 32, CY + 6, { size: 16, w: 600, c: C.dim });
      txt('B', CX + 16, CY + CR + 22, { size: 16, w: 600, c: C.dim });
      for (let p = 0; p < 2; p++) for (let i = 0; i < 6; i++) {
        const at = 13.4 + (p * 6 + i) * 0.22, s = out(seg(t, at, at + 0.35));
        if (s <= 0) continue;
        const d = CR - FR6[i] * 2 * CR;
        circ(p ? CX : CX + d, p ? CY + d : CY, 7 * s, C.ink);
      }
      A(out(seg(t, 16.6, 17.4)), () => {
        txt('4.4    14.6    29.6    70.4    85.4    95.6', CX, CY + CR + 58, { al: 'center', size: 20, w: 600, c: C.ink2 });
        txt('percent of the diameter from the wall', CX, CY + CR + 82, { al: 'center', size: 15, c: C.dim });
      });
    });

    // Cyclonic flow check: rotate the pitot to the null angle
    A(out(seg(t, 20.2, 21.0)), () => {
      const PX = 575, PY = 362, alpha = 14;
      txt('Cyclonic flow check', PX, 232, { al: 'center', size: 30, disp: true, w: 600 });
      ctx.save();
      ctx.beginPath(); ctx.arc(PX, PY, 105, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = C.panel2; ctx.fillRect(PX - 110, PY - 110, 220, 220);
      const ar = (alpha * Math.PI) / 180, dir = [Math.sin(ar), -Math.cos(ar)], perp = [Math.cos(ar), Math.sin(ar)];
      for (let i = 0; i < 28; i++) {
        const al = ((rnd(i) + amb * 0.35) % 1) * 260 - 130, ac = rnd(i + 50) * 240 - 120;
        const x = PX + perp[0] * ac + dir[0] * al, y = PY + perp[1] * ac + dir[1] * al;
        ln(x, y, x - dir[0] * 16, y - dir[1] * 16, `rgba(${C.gasRGB},0.55)`, 2);
      }
      ctx.restore();
      circ(PX, PY, 105, null, C.faint, 1.5);
      const th = alpha * io(seg(t, 21.4, 23.6));
      ctx.save();
      ctx.translate(PX, PY); ctx.rotate((th * Math.PI) / 180);
      [-1, 1].forEach((s) => { circ(s * 20, 0, 16, C.steel, C.bg, 2); circ(s * 20, 0, 5, C.bg); });
      ln(-62, 0, 62, 0, C.caution, 1.4, [3, 3]);
      ctx.restore();
      const dp = 0.55 * Math.sin(((alpha - th) * Math.PI) / 180);
      txt(`Pitot rotated ${fmtN(th, 0)}°`, PX, PY + 136, { al: 'center', size: 18, w: 600 });
      txt(`Manometer ${fmtN(Math.abs(dp) < 0.005 ? 0 : dp, 2)} in. H₂O`, PX, PY + 162, { al: 'center', size: 18, w: 600, c: C.gauge });
      A(out(seg(t, 24.0, 24.6)), () => chip('Average angle 9°, within 20°', PX, PY + 200));
    });
  }

  function sM2(t) {
    const x0 = 110, x1 = 450, y0 = 100, y1 = 600, py = 330, hx = 280;
    ctx.fillStyle = C.panel2; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    streaks(x0, y0, x1 - x0, y1 - y0, 70, amb, { speed: 170, profile: true, seed: 9 });
    wall(x0 - 12, y0, 12, y1 - y0);
    wall(x1, y0, 12, py - 18 - y0);
    wall(x1, py + 18, 12, y1 - py - 18);
    // Type S pitot: wake leg up, impact leg down into the flow
    ctx.save();
    ctx.strokeStyle = C.steelHi; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1 + 70, py - 8); ctx.lineTo(hx + 12, py - 8); ctx.quadraticCurveTo(hx, py - 8, hx, py - 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + 70, py + 8); ctx.lineTo(hx + 12, py + 8); ctx.quadraticCurveTo(hx, py + 8, hx, py + 22); ctx.stroke();
    ctx.restore();
    circ(hx, py + 25, 4.5, C.gauge);
    circ(hx, py - 25, 4.5, C.dim);
    chip('Wake opening', hx, py - 58, { size: 14, bg: 'rgba(15,30,38,0.9)', c: C.ink2 });
    chip('Impact opening faces the flow', hx, py + 60, { size: 14, bg: 'rgba(15,30,38,0.9)', c: C.gauge });

    // Inclined manometer
    const dp = 0.55 * out(seg(t, 1.0, 4.0));
    A(1 - seg(t, 11.6, 12.6), () => {
      poly([[x1 + 70, py + 8], [590, py + 8], [590, 478]], 1, C.dim, 2);
      poly([[x1 + 70, py - 8], [1010, py - 8], [1010, 410]], 1, C.dim, 2);
      const tx0 = 620, ty0 = 505, tx1 = 1010, ty1 = 420;
      ln(tx0, ty0, tx1, ty1, C.ink2, 13);
      ln(tx0, ty0, tx1, ty1, C.panel, 9);
      const f = dp / 1.0;
      ln(tx0, ty0, lerp(tx0, tx1, f), lerp(ty0, ty1, f), C.gauge, 9);
      rr(560, 478, 60, 54, 8, C.panel, C.ink2, 2);
      rr(563, 498 + 18 * (dp / 0.55) * 0.4, 54, 30 - 18 * (dp / 0.55) * 0.4, 6, C.gauge);
      [0, 0.5, 1].forEach((v) => {
        const x = lerp(tx0, tx1, v), y = lerp(ty0, ty1, v);
        ln(x, y + 10, x, y + 20, C.dim, 1.5);
        txt(v === 0 ? '0' : v === 1 ? '1.0' : '0.5', x, y + 40, { al: 'center', size: 15, c: C.dim });
      });
      txt('Inclined manometer, in. H₂O', 620, 580, { size: 16, c: C.dim });
      rt(`Δp = ${fmtN(dp, 2)} in. H_2O`, 640, 400, { size: 40, w: 700, disp: true, c: C.gauge });
    });

    // Velocity profile across the traverse
    const plane = 545;
    A(out(seg(t, 6.4, 7.0)), () => {
      ln(x0, plane, x1, plane, C.caution, 1.5, [4, 4]);
      FR6.forEach((f, i) => {
        const s = out(seg(t, 6.6 + i * 0.45, 7.1 + i * 0.45));
        if (s <= 0) return;
        const x = x1 - f * (x1 - x0);
        const pr = Math.pow(Math.max(0.02, 1 - Math.abs(1 - 2 * f)), 1 / 7);
        arrow(x, plane, x, plane - 120 * pr * s, C.caution, 3, 12);
        circ(x, plane, 4.5, C.caution);
      });
      A(out(seg(t, 9.8, 10.4)), () => chip('Average the square roots of Δp', 280, 584, { size: 15, bg: 'rgba(15,30,38,0.92)', c: C.caution }));
    });

    // Velocity and flow equations
    A(out(seg(t, 12.6, 13.4)), () => {
      rt('v_s = K_p C_p (√Δp)_{avg} √(T_s / P_s M_s)', 520, 190, { size: 34 });
      rt('= 85.49 × 0.84 × 0.875 × √(785 / (29.38 × 28.71))', 520, 232, { size: 21, c: C.dim });
      numUnit(fmtN(60.6 * out(seg(t, 13.6, 15.2)), 1), 'ft/s', 520, 312, 76, C.gas);
    });
    A(out(seg(t, 15.8, 16.6)), () => {
      rt('Q_{sd} = 3600 (1 − B_{ws}) v_s A (T_{std} / T_s)(P_s / P_{std})', 520, 400, { size: 28 });
      numUnit(fmtN(3.63 * out(seg(t, 16.8, 18.2)), 2), 'million dscf/hr, about 60,500 dscfm', 520, 478, 66, C.gas);
    });
  }

  function sM3(t) {
    // Integrated bag sample
    wall(60, 150, 18, 420);
    const inf = out(seg(t, 0.4, 3.2));
    ln(78, 300, 196, 300, C.steelHi, 5);
    rr(196, 282, 56, 36, 6, C.panel, C.ink2);
    txt('Pump', 224, 340, { al: 'center', size: 14, c: C.dim });
    ln(252, 300, 290, 300, C.dim, 2);
    const bw = lerp(30, 180, inf), bh = lerp(30, 220, inf);
    rr(380 - bw / 2 + 10, 320 - bh / 2, bw, bh, Math.min(bw, bh) * 0.45, `rgba(${C.gasRGB},0.14)`, C.gas, 2);
    txt('Integrated bag sample', 390, 470, { al: 'center', size: 18, c: C.ink2, a: seg(t, 1.2, 2.0) });
    if (inf > 0.05 && inf < 0.999) for (let i = 0; i < 6; i++) {
      const s = (rnd(i) + amb * 0.8) % 1;
      circ(lerp(80, 300, s), 300, 3, C.gas);
    }

    // Composition bar splitting into N2, CO2, O2
    const X0 = 520, BW = 660, Y0 = 200, BH = 70;
    const split = io(seg(t, 3.5, 6.0));
    const parts = [
      { n: 'N₂', v: 82.0, c: C.geom }, { n: 'CO₂', v: 10.8, c: C.gas }, { n: 'O₂', v: 7.2, c: C.ink2 },
    ];
    A(out(seg(t, 0.8, 1.6)), () => {
      txt('Dry stack gas, 100%', X0, Y0 - 16, { size: 18, c: C.ink2, a: 1 - split });
      if (split <= 0) { rr(X0, Y0, BW, BH, 8, C.faint); return; }
      let x = X0;
      parts.forEach((p, i) => {
        const w = lerp(BW / 3, (BW * p.v) / 100, split);
        rr(x + (i ? 2 : 0), Y0, w - (i ? 2 : 0), BH, 6, p.c);
        const lx = x + w / 2;
        A(seg(t, 5.2, 6.0), () => {
          if (i === 0) txt(`${p.n}  ${fmtN(p.v * out(seg(t, 5.2, 6.4)), 1)}%`, lx, Y0 + BH / 2 + 8, { al: 'center', size: 24, disp: true, w: 600, c: C.bg });
          else {
            ln(lx, Y0 + BH + 4, lx, Y0 + BH + 22 + (i - 1) * 34, p.c, 1.5);
            txt(`${p.n}  ${fmtN(p.v * out(seg(t, 5.2, 6.4)), 1)}%`, lx - 6, Y0 + BH + 40 + (i - 1) * 34, { al: 'right', size: 22, disp: true, w: 600, c: p.c });
          }
        });
        x += w;
      });
    });

    A(out(seg(t, 7.0, 7.8)), () => {
      rt('M_d = 0.440(%CO_2) + 0.320(%O_2) + 0.280(%N_2 + %CO)', X0, 390, { size: 28 });
      rt('= 0.440(10.8) + 0.320(7.2) + 0.280(82.0)', X0, 428, { size: 21, c: C.dim });
      numUnit(fmtN(30.02 * out(seg(t, 8.0, 9.4)), 2), 'lb/lb-mole', X0, 500, 70, C.gas);
    });
    A(out(seg(t, 11.2, 12.0)), () => {
      rt('C_{7%} = C × (20.9 − 7) / (20.9 − %O_2)', X0, 565, { size: 24 });
      txt('Oxygen also corrects results for dilution air', X0, 594, { size: 17, c: C.dim });
    });
  }

  function sM4(t) {
    const p = out(seg(t, 1.0, 9.0));
    const xs = [210, 330, 450, 570], top = 220, bot = 540, hw = 28;
    // Ice bath
    rr(140, 300, 500, 262, 14, `rgba(${C.waterRGB},0.1)`, `rgba(${C.waterRGB},0.45)`, 2);
    for (let i = 0; i < 9; i++) {
      const x = 160 + rnd(i + 3) * 460, y = 312 + rnd(i + 17) * 230;
      if (xs.some((c) => Math.abs(x - c) < hw + 14)) continue;
      rr(x, y, 16, 16, 3, null, 'rgba(220,235,245,0.45)', 1.5);
    }
    // Plumbing along the top
    const pipe = [[40, 180], [xs[0], 180], [xs[0], top - 6]];
    poly(pipe, 1, C.steelHi, 4);
    for (let i = 0; i < 3; i++) poly([[xs[i] + 16, top - 6], [xs[i] + 16, 180], [xs[i + 1], 180], [xs[i + 1], top - 6]], 1, C.dim, 2.5);
    poly([[xs[3] + 16, top - 6], [xs[3] + 16, 180], [714, 180], [714, 240]], 1, C.dim, 2.5);
    txt('From the heated probe', 40, 166, { size: 15, c: C.dim });

    xs.forEach((x, i) => {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x - hw, top, hw * 2, bot - top, [6, 6, hw, hw]); ctx.clip();
      ctx.fillStyle = 'rgba(227,236,239,0.06)'; ctx.fillRect(x - hw, top, hw * 2, bot - top);
      if (i < 3) {
        const h = [60 + 72 * p, 60 + 22 * p, 10 * p][i];
        ctx.fillStyle = `rgba(${C.waterRGB},0.55)`; ctx.fillRect(x - hw, bot - h, hw * 2, h);
        if (i < 2) for (let b = 0; b < 7; b++) {
          const s = (rnd(b + i * 11) + amb * 0.9) % 1;
          circ(x - 6 + rnd(b + 4) * 12, bot - 14 - s * (h - 16), 2.5 + rnd(b) * 2, 'rgba(227,236,239,0.7)');
        }
      } else {
        // Indicating silica gel loads from the bottom up and changes color
        for (let r = 0; r < 22; r++) for (let c = 0; c < 4; c++) {
          const y = bot - 10 - r * 11, bx = x - 18 + c * 12 + (r % 2) * 5;
          const loaded = r / 22 < p * 0.55;
          circ(bx, y, 4.5, loaded ? C.pink : C.water);
        }
      }
      ctx.restore();
      ctx.beginPath(); ctx.roundRect(x - hw, top, hw * 2, bot - top, [6, 6, hw, hw]);
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 2; ctx.stroke();
      rr(x - hw - 4, top - 10, hw * 2 + 8, 12, 3, C.panel, C.ink2);
      ln(x, top - 6, x, bot - 18, C.ink2, 2);
      txt(['100 mL water', '100 mL water', 'Empty', 'Silica gel'][i], x, 590, { al: 'center', size: 15, c: C.dim });
    });
    chip('Gas leaves at 68 °F or colder', 640, 140, { size: 15, bg: 'rgba(244,193,61,0.14)', c: C.caution });

    // Meter box
    txt('Dry gas meter', 800, 230, { al: 'center', size: 15, c: C.dim });
    rr(700, 240, 170, 160, 10, C.panel, C.ink2);
    dial(785, 302, 40, amb * 2.4);
    txt(`${fmtN(73.0 * p, 1)} ft³`, 785, 388, { al: 'center', size: 22, disp: true, w: 600 });

    // Moisture fraction
    const qa = out(seg(t, 9.2, 10.0));
    A(qa, () => {
      txt('Water caught: 168 mL plus 14.2 g on the gel', 700, 446, { size: 17, c: C.ink2 });
      rt('B_{ws} = V_{w(std)} / (V_{w(std)} + V_{m(std)})', 700, 488, { size: 26 });
      rt('= 8.58 / (8.58 + 70.08)', 700, 520, { size: 19, c: C.dim });
    });
    A(out(seg(t, 10.4, 11.2)), () => numUnit(`${fmtN(10.9 * out(seg(t, 10.4, 11.8)), 1)}%`, 'water by volume', 700, 594, 60, C.water));
    // One cubic foot of stack gas
    A(out(seg(t, 11.6, 12.4)), () => {
      const cx = 1040, cy0 = 200, ch = 170, cw = 120;
      rr(cx, cy0, cw, ch, 6, `rgba(${C.gasRGB},0.25)`, C.ink2);
      rr(cx, cy0, cw, ch * 0.109, 6, `rgba(${C.waterRGB},0.7)`);
      txt('1 ft³ in the stack', cx + cw / 2, cy0 - 12, { al: 'center', size: 15, c: C.dim });
      txt('dry gas 89.1%', cx + cw / 2, cy0 + ch / 2 + 10, { al: 'center', size: 15, w: 600 });
    });
  }

  // Shared train geometry for the Method 5 scene
  const TRAIN = {
    soot: [[64, 340], [64, 314], [78, 300], [480, 300]],
    water: [[64, 340], [64, 314], [78, 300], [540, 300], [575, 300], [575, 226], [650, 226], [650, 430]],
    gas: [[64, 340], [64, 314], [78, 300], [540, 300], [575, 300], [575, 226], [906, 226], [940, 236], [968, 290], [1000, 330]],
  };
  function sM5(t) {
    /* ---- Part A: the train ---- */
    A(1 - seg(t, 11.4, 12.4), () => {
      const show = (at) => out(seg(t, at, at + 0.7));
      // stack and nozzle
      ctx.fillStyle = C.panel2; ctx.fillRect(20, 120, 100, 420);
      streaks(20, 120, 100, 420, 22, amb, { speed: 140, seed: 21 });
      wall(120, 120, 14, 166); wall(120, 314, 14, 226);
      A(show(0.4), () => {
        ctx.save(); ctx.strokeStyle = C.steelHi; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(86, 300); ctx.quadraticCurveTo(64, 300, 64, 318); ctx.lineTo(64, 336); ctx.stroke(); ctx.restore();
        txt('Nozzle', 70, 580, { al: 'center', size: 17, w: 600 });
      });
      A(show(1.3), () => {
        rr(80, 292, 400, 16, 6, C.steel);
        ctx.save(); ctx.strokeStyle = C.gauge; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let x = 150; x <= 410; x += 2) ctx.lineTo(x, 300 + Math.sin(x * 0.25) * 4);
        ctx.stroke(); ctx.restore();
        ln(86, 283, 470, 283, C.steelHi, 1.5);
        txt('Heated probe', 280, 580, { al: 'center', size: 17, w: 600 });
      });
      A(show(2.2), () => {
        rr(420, 232, 120, 138, 10, C.panel, C.gauge, 1.8);
        ctx.fillStyle = C.panel2; ctx.beginPath(); ctx.moveTo(446, 300); ctx.lineTo(476, 262); ctx.lineTo(484, 262); ctx.lineTo(514, 300); ctx.lineTo(484, 338); ctx.lineTo(476, 338); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.stroke();
        const load = seg(t, 6, 12);
        const r = Math.round(lerp(230, 107, load)), gC = Math.round(lerp(239, 84, load)), b = Math.round(lerp(240, 64, load));
        rr(476, 266, 8, 68, 2, `rgb(${r},${gC},${b})`);
        txt('Heated filter', 480, 580, { al: 'center', size: 17, w: 600 });
      });
      A(show(3.1), () => {
        rr(600, 250, 290, 210, 12, `rgba(${C.waterRGB},0.1)`, `rgba(${C.waterRGB},0.45)`, 1.8);
        [650, 715, 780, 845].forEach((x, i) => {
          ctx.beginPath(); ctx.roundRect(x - 18, 236, 36, 214, [4, 4, 18, 18]);
          ctx.fillStyle = 'rgba(227,236,239,0.05)'; ctx.fill(); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.6; ctx.stroke();
          if (i < 2) rr(x - 16, 400 - seg(t, 6, 12) * 20, 32, 48 + seg(t, 6, 12) * 20, 12, `rgba(${C.waterRGB},0.5)`);
          if (i === 3) for (let k = 0; k < 24; k++) circ(x - 9 + (k % 3) * 9, 440 - Math.floor(k / 3) * 12, 3.6, C.water);
        });
        poly([[540, 300], [575, 300], [575, 226], [870, 226]], 1, C.dim, 2.5);
        txt('Impingers in ice', 745, 580, { al: 'center', size: 17, w: 600 });
      });
      A(show(4.0), () => {
        ctx.save(); ctx.strokeStyle = '#0A161C'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(870, 226); ctx.bezierCurveTo(950, 226, 950, 330, 1000, 330); ctx.stroke();
        ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        rr(1000, 200, 220, 280, 12, C.panel, C.ink2);
        [[1020, 236, 'Δp'], [1020, 270, 'ΔH']].forEach(([x, y, l], i) => {
          txt(l, x, y + 5, { size: 15, c: C.dim });
          ln(x + 34, y + 6, x + 180, y - 6, C.ink2, 7);
          ln(x + 34, y + 6, lerp(x + 34, x + 180, i ? 0.62 : 0.38), lerp(y + 6, y - 6, i ? 0.62 : 0.38), C.gauge, 4);
        });
        dial(1110, 380, 46, amb * 2.2);
        txt('Meter box', 1110, 580, { al: 'center', size: 17, w: 600 });
      });
      A(out(seg(t, 5.0, 5.8)), () => {
        chip('248 °F', 480, 208, { size: 15, bg: 'rgba(255,107,87,0.16)', c: C.gauge });
        chip('68 °F or colder', 820, 196, { size: 15, bg: 'rgba(244,193,61,0.14)', c: C.caution });
      });
      // what goes where
      const flow = seg(t, 6, 6.8);
      if (flow > 0) {
        const tt = amb;
        for (let i = 0; i < 18; i++) {
          const s = (rnd(i + 1) + tt * 0.2) % 1;
          const [x, y] = along(TRAIN.soot, s);
          circ(x, y, 3.6, C.soot);
        }
        for (let i = 0; i < 14; i++) {
          const s = (rnd(i + 40) + tt * 0.14) % 1;
          const [x, y] = along(TRAIN.water, s);
          circ(x, y, 3.2, C.water);
        }
        for (let i = 0; i < 26; i++) {
          const s = (rnd(i + 80) + tt * 0.11) % 1;
          const [x, y] = along(TRAIN.gas, s);
          circ(x, y, 2.6, C.gas);
        }
      }
    });

    /* ---- Part B: isokinetic sampling ---- */
    A(seg(t, 12.2, 12.9) * (1 - seg(t, 23.4, 24.4)), () => {
      const panels = [
        { x: 70, r: 0.7, title: 'Too slow, 70%', res: 'Biased high', sub: 'extra large particles get in', bad: true, at: 12.4 },
        { x: 470, r: 1.0, title: 'Isokinetic, 100%', res: 'Accurate', sub: 'gas and particles in proportion', bad: false, at: 13.6 },
        { x: 870, r: 1.4, title: 'Too fast, 140%', res: 'Biased low', sub: 'large particles are missed', bad: true, at: 14.8 },
      ];
      panels.forEach((pn) => {
        A(out(seg(t, pn.at, pn.at + 0.8)), () => {
          const x0 = pn.x, w = 340, y0 = 128, h = 300, yc = y0 + h / 2, xn = x0 + 230, hn = 34, span = 140;
          rr(x0, y0, w, h, 10, C.panel2, C.faint);
          txt(pn.title, x0 + w / 2, y0 - 16, { al: 'center', size: 26, disp: true, w: 600 });
          ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 10); ctx.clip();
          const hc = hn * pn.r; // half-height of the gas the nozzle captures, far upstream
          const map = (y) => {
            const a = Math.abs(y), s = Math.sign(y) || 1;
            if (a < hc) return y / pn.r;
            return s * (hn + ((a - hc) * (span - hn)) / (span - hc));
          };
          ctx.fillStyle = `rgba(${C.gasRGB},0.12)`;
          ctx.beginPath();
          for (let x = x0; x <= xn; x += 6) ctx.lineTo(x, yc - lerp(hc, hn, io(seg(x, xn - 150, xn))));
          for (let x = xn; x >= x0; x -= 6) ctx.lineTo(x, yc + lerp(hc, hn, io(seg(x, xn - 150, xn))));
          ctx.fill();
          for (let k = -4; k <= 4; k++) {
            const y0s = k * 32;
            const y1s = map(y0s);
            const inside = Math.abs(y0s) < hc;
            ctx.strokeStyle = inside ? `rgba(${C.gasRGB},0.9)` : `rgba(${C.gasRGB},0.35)`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let x = x0; x <= x0 + w; x += 6) {
              const yy = x < xn ? lerp(y0s, y1s, io(seg(x, xn - 150, xn))) : y1s;
              ctx.lineTo(x, yc + yy);
            }
            ctx.stroke();
          }
          // Large particles fly straight: the nozzle catches those within its own height
          for (let i = 0; i < 9; i++) {
            const yy = (i - 4) * 15 + (rnd(i + pn.x) - 0.5) * 6;
            const s = (rnd(i * 3 + pn.x) + amb * 0.32) % 1;
            const x = x0 + s * (xn - x0 + 20);
            circ(x, yc + yy, 5, C.soot);
          }
          ctx.restore();
          rr(xn, yc - hn - 8, w - (xn - x0), 8, 2, C.steel);
          rr(xn, yc + hn, w - (xn - x0), 8, 2, C.steel);
          txt(pn.res, x0 + w / 2, y0 + h + 44, { al: 'center', size: 32, disp: true, w: 700, c: pn.bad ? C.gauge : C.gas });
          txt(pn.sub, x0 + w / 2, y0 + h + 70, { al: 'center', size: 16, c: C.dim });
        });
      });
      A(out(seg(t, 19.0, 19.8)), () => {
        stripes(100, 548, 10, 42);
        txt('Each run must be 90 to 110% isokinetic', 126, 577, { size: 22, w: 600 });
        rt('ΔH = K · Δp  at every traverse point', 760, 577, { size: 24, c: C.ink2 });
      });
    });

    /* ---- Part C: leak check, recovery, weighing ---- */
    A(seg(t, 24.2, 24.9), () => {
      A(out(seg(t, 24.3, 25.0)), () => chip('Post-test leak check: 0.004 cfm, under the 0.020 cfm limit', 640, 132, { size: 17 }));
      // probe liner being brushed
      rr(110, 262, 470, 36, 16, 'rgba(213,222,226,0.12)', C.ink2, 2);
      const bx = 160 + (Math.sin(amb * 3) * 0.5 + 0.5) * 340;
      ln(bx, 280, 640, 280, C.dim, 2.5);
      for (let k = 0; k < 9; k++) ln(bx - 18 + k * 2.5, 268, bx - 18 + k * 2.5, 292, C.soot, 1.4);
      txt('Brush and acetone rinse', 345, 240, { al: 'center', size: 17, w: 600 });
      // rinse jar
      const fillR = seg(t, 25, 30);
      rr(70, 360, 80, 100, 10, 'rgba(227,236,239,0.06)', C.ink2, 2);
      rr(72, 458 - 70 * fillR, 76, 70 * fillR, 8, 'rgba(216,174,126,0.4)');
      rr(82, 348, 56, 14, 3, C.ink2);
      for (let i = 0; i < 4; i++) {
        const s = (rnd(i + 9) + amb * 0.9) % 1;
        circ(110, lerp(300, 440, s), 3, C.soot);
      }
      txt('Container 2: rinse', 110, 490, { al: 'center', size: 15, c: C.dim });
      // filter in petri dish
      A(out(seg(t, 25.4, 26.2)), () => {
        circ(330, 410, 44, 'rgba(227,236,239,0.08)', C.ink2, 2);
        circ(330, 410, 30, '#6B5440');
        txt('Container 1: filter', 330, 490, { al: 'center', size: 15, c: C.dim });
      });
      // balance
      A(out(seg(t, 27.6, 28.4)), () => {
        arrow(400, 420, 790, 420, C.faint, 2, 12);
        rr(820, 250, 300, 190, 10, 'rgba(227,236,239,0.04)', C.faint, 1.5);
        ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.ellipse(970, 418, 80, 10, 0, 0, Math.PI * 2); ctx.fill();
        ln(970, 428, 970, 446, C.ink2, 4);
        rr(800, 440, 340, 64, 10, C.panel, C.ink2);
        rr(880, 452, 180, 40, 6, '#081114');
        txt(`${fmtN(85.4 * out(seg(t, 28.8, 30.8)), 1)} mg`, 1050, 482, { al: 'right', size: 32, disp: true, w: 600, c: C.gas });
        txt('Dried and weighed to a constant weight', 970, 540, { al: 'center', size: 17, c: C.ink2 });
      });
    });
  }

  function sInstr(t) {
    // Sampling system
    wall(50, 180, 18, 300);
    ln(68, 330, 150, 330, C.steelHi, 5);
    rr(150, 312, 44, 36, 6, C.panel, C.gauge);
    ctx.save(); ctx.strokeStyle = C.gauge; ctx.lineWidth = 6; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -amb * 30;
    ctx.beginPath(); ctx.moveTo(194, 330); ctx.lineTo(330, 330); ctx.stroke(); ctx.restore();
    txt('Heated line', 262, 312, { al: 'center', size: 14, c: C.dim });
    rr(330, 290, 92, 80, 8, C.panel, C.water, 1.8);
    txt('Moisture', 376, 326, { al: 'center', size: 14, w: 600 });
    txt('removal', 376, 344, { al: 'center', size: 14, w: 600 });
    ln(422, 330, 452, 330, C.dim, 2.5);
    circ(470, 330, 18, C.panel, C.ink2, 2);
    head(480, 330, 0, 10, C.ink2);
    ln(488, 330, 505, 330, C.dim, 2.5);
    ln(505, 195, 505, 465, C.dim, 2.5);
    const units = [['O₂', 7.2, '%', 1], ['CO₂', 10.8, '%', 1], ['NOₓ', 42.1, 'ppm', 1], ['CO', 12.6, 'ppm', 1]];
    units.forEach(([n, v, u], i) => {
      const y = 158 + i * 90;
      ln(505, y + 37, 520, y + 37, C.dim, 2.5);
      rr(520, y, 250, 76, 8, C.panel, C.ink2);
      txt(n, 538, y + 46, { size: 30, disp: true, w: 600 });
      const jit = v * (1 + 0.012 * Math.sin(amb * 1.7 + i * 2) + 0.006 * Math.sin(amb * 5.1 + i));
      rr(612, y + 14, 140, 34, 5, '#081114');
      txt(`${fmtN(jit, 1)} ${u}`, 744, y + 38, { al: 'right', size: 22, disp: true, w: 600, c: C.gas });
      ctx.save(); ctx.strokeStyle = `rgba(${C.gasRGB},0.7)`; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const x = 612 + k * 3.5, tt = amb - (40 - k) * 0.08;
        ctx.lineTo(x, y + 64 - 6 * (0.5 + 0.5 * Math.sin(tt * 1.7 + i * 2)) - 3 * Math.sin(tt * 5.1 + i));
      }
      ctx.stroke(); ctx.restore();
    });
    txt('Analyzers log every few seconds', 645, 540, { al: 'center', size: 16, c: C.dim });

    // Calibration gases
    A(1 - seg(t, 6.0, 6.8), () => {
      const names = ['Zero', 'Mid', 'High'];
      [880, 990, 1100].forEach((x, i) => {
        const a = out(seg(t, 0.6 + i * 0.4, 1.3 + i * 0.4));
        A(a, () => {
          rr(x - 30, 230, 60, 230, 26, '#4A5E68', C.ink2, 1.5);
          rr(x - 30, 270, 60, 16, 2, [C.dim, C.gas, C.caution][i]);
          rr(x - 10, 206, 20, 26, 4, C.ink2);
          txt(names[i], x, 490, { al: 'center', size: 18, w: 600 });
        });
      });
      txt('EPA Protocol calibration gases', 990, 180, { al: 'center', size: 18, c: C.ink2, a: seg(t, 1, 1.8) });
      poly([[990, 206], [990, 128], [110, 128], [110, 318]], io(seg(t, 2.2, 4.2)), C.gas, 2.5, [7, 6]);
      txt('Gas sent to the probe checks the whole system', 560, 116, { al: 'center', size: 16, c: C.gas, a: seg(t, 3.6, 4.4) });
    });

    // Calibration checks with limit bands
    A(seg(t, 6.6, 7.3) * (1 - seg(t, 12.6, 13.4)), () => {
      const rows = [['Calibration error', 2, 0.8, 7.4], ['System bias', 5, -1.5, 8.9], ['Drift', 3, 1.0, 10.4]];
      rows.forEach(([name, lim, val, at], i) => {
        const y = 190 + i * 110, x0 = 840, x1 = 1200, mid = (x0 + x1) / 2, half = 110;
        txt(name, x0, y, { size: 22, disp: true, w: 600 });
        txt(`within ${lim}% of span`, x1, y, { al: 'right', size: 16, c: C.dim });
        rr(mid - half, y + 18, half * 2, 26, 4, 'rgba(63,202,189,0.18)');
        stripes(x0, y + 18, mid - half - x0, 26);
        stripes(mid + half, y + 18, x1 - mid - half, 26);
        ln(mid, y + 14, mid, y + 48, C.dim, 1.5);
        const a = out(seg(t, at, at + 0.9));
        if (a > 0) {
          const x = lerp(x1 + 20, mid + (val / lim) * half, a);
          circ(x, y + 31, 9, C.ink, C.bg, 2);
          A(seg(t, at + 0.8, at + 1.2), () => {
            txt(`${val > 0 ? '+' : '−'}${fmtN(Math.abs(val), 1)}%`, mid + (val / lim) * half, y + 72, { al: 'center', size: 16, w: 600, c: C.ink2 });
            check(x1 + 34, y + 31, 22, C.gas);
          });
        }
      });
    });

    // Stratification and RATA
    A(out(seg(t, 13.2, 14.0)), () => {
      const CX = 1020, CY = 300, CR = 120;
      txt('Stratification test', CX, 150, { al: 'center', size: 26, disp: true, w: 600 });
      circ(CX, CY, CR, C.panel2, C.ink2, 2.5);
      for (let p = 0; p < 2; p++) for (let i = 0; i < 6; i++) {
        const s = out(seg(t, 13.6 + (p * 6 + i) * 0.12, 14.0 + (p * 6 + i) * 0.12));
        const d = CR - FR6[i] * 2 * CR;
        circ(p ? CX : CX + d, p ? CY + d : CY, 7 * s, C.gas);
      }
      A(out(seg(t, 15.2, 15.8)), () => txt('Every point within 5% of the mean:', CX, CY + CR + 40, { al: 'center', size: 17, c: C.ink2 }));
      A(out(seg(t, 15.6, 16.2)), () => txt('sample at one point', CX, CY + CR + 66, { al: 'center', size: 22, disp: true, w: 600, c: C.gas }));
    });
  }

  function sResults(t) {
    const cards = [
      ['V_{m(std)}', 70.08, 2, 'dscf'], ['B_{ws}', 10.9, 1, '%'], ['M_s', 28.71, 2, 'lb/lb-mole'],
      ['v_s', 60.6, 1, 'ft/s'], ['Q_{sd}', 3.63, 2, 'million dscf/hr'],
    ];
    cards.forEach(([sym, v, d, u], i) => {
      const at = 0.3 + i * 0.7, a = out(seg(t, at, at + 0.7));
      A(a, () => {
        const x = 88 + i * 226, y = 104 + (1 - a) * 16;
        rr(x, y, 200, 110, 10, C.panel, C.faint);
        rt(sym, x + 18, y + 34, { size: 22, c: C.ink2 });
        txt(fmtN(v * out(seg(t, at, at + 1.2)), d), x + 18, y + 80, { size: 40, disp: true, w: 700 });
        txt(u, x + 18, y + 100, { size: 14, c: C.dim });
      });
    });
    A(out(seg(t, 5.6, 6.4)), () => {
      poly([[868, 214], [868, 250], [420, 250], [420, 290]], io(seg(t, 5.6, 6.6)), C.faint, 1.5, [4, 4]);
      poly([[1094, 214], [1094, 262], [440, 262], [440, 290]], io(seg(t, 5.8, 6.8)), C.faint, 1.5, [4, 4]);
      rt('E = c_s × Q_{sd} ÷ 7000', 100, 340, { size: 36 });
      rt('= 0.0188 gr/dscf × 3.63 million dscf/hr ÷ 7000 gr/lb', 100, 380, { size: 20, c: C.dim });
    });
    A(out(seg(t, 7.2, 8.0)), () => numUnit(fmtN(9.7 * out(seg(t, 7.2, 9.0)), 1), 'lb/hr', 100, 500, 120, C.caution));

    // Three runs against the limit
    A(out(seg(t, 10.8, 11.6)), () => {
      const bx0 = 790, base = 560, sc = 14; // px per lb/hr
      const runs = [9.7, 9.0, 10.4];
      ln(bx0, base, 1190, base, C.ink2, 2);
      runs.forEach((v, i) => {
        const g = out(seg(t, 11.2 + i * 0.6, 12.2 + i * 0.6));
        const x = bx0 + 30 + i * 125;
        rr(x, base - v * sc * g, 80, v * sc * g, 6, 'rgba(244,193,61,0.75)');
        txt(`Run ${i + 1}`, x + 40, base + 24, { al: 'center', size: 16, c: C.dim });
        if (g > 0.9) txt(fmtN(v, 1), x + 40, base - v * sc - 10, { al: 'center', size: 20, disp: true, w: 600 });
      });
      A(out(seg(t, 13.4, 14.0)), () => {
        ln(bx0, base - 15 * sc, 1190, base - 15 * sc, C.gauge, 2.5, [8, 6]);
        txt('Limit 15 lb/hr', 1190, base - 15 * sc - 10, { al: 'right', size: 17, w: 600, c: C.gauge });
        ln(bx0, base - 9.7 * sc, 1190, base - 9.7 * sc, C.ink, 1.5, [3, 4]);
      });
      A(out(seg(t, 14.4, 15.2)), () => chip('Three-run average 9.7 lb/hr: passes', 990, 290, { size: 17 }));
    });
  }

  function sReport(t) {
    const a = out(seg(t, 0.2, 1.0));
    A(a, () => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
      rr(240, 96 + (1 - a) * 20, 360, 500, 8, C.paper); ctx.restore();
      txt('Emission test report', 270, 150, { size: 32, disp: true, w: 700, c: C.paperInk });
      txt('Unit 1 boiler, particulate', 270, 176, { size: 15, c: '#4A5C67' });
      const secs = ['Summary of results', 'Process operating data', 'Sampling methods', 'Quality assurance', 'Calculations and field data'];
      secs.forEach((s, i) => {
        const g = out(seg(t, 0.8 + i * 0.6, 1.6 + i * 0.6));
        A(g, () => {
          const y = 222 + i * 70;
          txt(s, 270, y, { size: 16, w: 700, c: C.paperInk });
          [0.92, 0.8, 0.6].forEach((f, k) => rr(270, y + 14 + k * 13, 300 * f * g, 6, 3, 'rgba(20,35,44,0.16)'));
        });
      });
    });
    const st = out(seg(t, 4.4, 5.2));
    A(st, () => {
      ctx.save(); ctx.translate(470, 520); ctx.rotate(-0.16); ctx.scale(lerp(1.5, 1, st), lerp(1.5, 1, st));
      rr(-92, -30, 184, 60, 10, null, '#0E8A82', 4);
      txt('Submitted', 0, 12, { al: 'center', size: 36, disp: true, w: 700, c: '#0E8A82' });
      ctx.restore();
    });
    txt('From the port', 700, 290, { size: 80, disp: true, w: 700, a: out(seg(t, 5.6, 6.6)) });
    txt('to the report.', 700, 370, { size: 80, disp: true, w: 700, a: out(seg(t, 6.2, 7.2)), c: C.ink2 });
    txt('That is the whole test. Explore any step in the lessons.', 704, 420, { size: 21, c: C.dim, a: out(seg(t, 7.0, 7.8)) });
    let x = 704;
    ['0', '1', '2', '3', '4', '5', '7E', 'Σ'].forEach((b, i) => {
      const g = out(seg(t, 7.6 + i * 0.18, 8.2 + i * 0.18));
      A(g, () => { x += badge(b, x, 460 + (1 - g) * 12, { h: 44, size: 24 }) + 10; });
      if (g <= 0.002) x += 54;
    });
  }

  /* =========================================================
     Script: scenes, timing, captions
     ========================================================= */
  const SCENES = [
    { title: 'Stack testing', lesson: 'overview.html', lessonName: 'The test, start to finish', badge: '', d: 10, draw: sIntro, cap: [
      [0, 'Every day, stacks carry exhaust from boilers, kilns and turbines into the air.'],
      [5, 'A stack test measures exactly what is in that exhaust, and how much of it leaves.'] ] },
    { title: 'Why facilities test', lesson: 'overview.html', lessonName: 'The test, start to finish', badge: '0', d: 16, draw: sWhy, cap: [
      [0, 'Permits and federal standards set emission limits. A test proves the source meets them.'],
      [5.4, 'Almost every result is a concentration multiplied by a flow.'],
      [10.2, 'Methods 1 through 4 measure the flow. Method 5 and the gas analyzers measure the concentration.'],
      [13, 'The emission rate is then compared with the permit limit.'] ] },
    { title: 'Planning the test', lesson: 'overview.html', lessonName: 'The test, start to finish', badge: '0', d: 14, draw: sPlan, cap: [
      [0, 'A test starts weeks ahead, with a written test protocol and notice to the agency.'],
      [5.2, 'The crew surveys the site: ports, platform, power and access.'],
      [9.6, 'Then comes a test day of three runs, followed by lab work, calculations and a report.'] ] },
    { title: 'Method 1: where to sample', lesson: 'method-1.html', lessonName: 'Method 1', badge: '1', d: 26, draw: sM1, cap: [
      [0, 'Method 1 picks the sampling site: ideally 8 diameters after a disturbance and 2 before the next.'],
      [6, 'The closer the site is to a disturbance, the more traverse points it needs, read from Figure 1-1.'],
      [10.8, 'The cross-section is split into rings of equal area, with a point in each half-ring.'],
      [15.6, 'Points crowd toward the wall because the thin outer rings hold as much area as the wide inner ones.'],
      [20.2, 'A null-angle check confirms the gas is not swirling: the average angle must be 20° or less.'] ] },
    { title: 'Method 2: velocity and flow', lesson: 'method-2.html', lessonName: 'Method 2', badge: '2', d: 20, draw: sM2, cap: [
      [0, 'Method 2 reads velocity with an S-type pitot tube and an inclined manometer.'],
      [3.6, 'The impact opening faces the flow. The pressure difference, Δp, grows with the square of velocity.'],
      [6.4, 'Readings at every traverse point give the velocity profile. You average the square roots of Δp.'],
      [12.6, 'Temperature, pressure and molecular weight turn that into velocity, then into dry standard flow.'] ] },
    { title: 'Method 3: gas composition', lesson: 'method-3.html', lessonName: 'Method 3', badge: '3', d: 15, draw: sM3, cap: [
      [0, 'Method 3 measures oxygen and carbon dioxide, from a bag sample or with instrumental analyzers.'],
      [5, 'Nitrogen makes up the rest. Together they give the dry molecular weight of the gas.'],
      [11.2, 'The oxygen reading also corrects results to a reference level, such as 7% O₂.'] ] },
    { title: 'Method 4: moisture', lesson: 'method-4.html', lessonName: 'Method 4', badge: '4', d: 16, draw: sM4, cap: [
      [0, 'Method 4 catches the water. The sample bubbles through impingers sitting in an ice bath.'],
      [5, 'Silica gel in the last impinger catches what is left, and the gas leaves at 68 °F or colder.'],
      [9.2, 'The water collected and the dry gas metered give the moisture fraction, B_ws.'],
      [12.4, 'Results are reported on a dry basis, so moisture touches every number that follows.'] ] },
    { title: 'Method 5: particulate matter', lesson: 'method-5.html', lessonName: 'Method 5', badge: '5', d: 34, draw: sM5, cap: [
      [0, 'Method 5 is the full sampling train: nozzle, heated probe and filter, impingers, and the meter box.'],
      [6, 'Particulate stops on the filter at 248 °F, water drops out in the ice, and the dry gas is metered.'],
      [12.2, 'Sampling must be isokinetic: the nozzle takes in gas at the same speed as the stack gas around it.'],
      [16.4, 'Too slow overcollects large particles and too fast misses them. Each run must land between 90 and 110%.'],
      [24.2, 'After a final leak check, the crew brushes and rinses the nozzle and probe and seals the filter.'],
      [28.4, 'In the lab, the filter and the dried rinse are weighed to a constant weight.'] ] },
    { title: 'Instrumental analyzers', lesson: 'instrumental.html', lessonName: 'Instrumental analyzers', badge: '7E', d: 20, draw: sInstr, cap: [
      [0, 'Gas analyzers measure O₂, CO₂, NOₓ, SO₂ and CO continuously through a heated, dried sample line.'],
      [6.6, 'EPA Protocol gases check them: calibration error within 2%, system bias within 5%, and drift within 3% of span.'],
      [13.2, 'A stratification test decides whether to sample at one point, three points, or the full traverse.'],
      [17, 'Continuous monitors on the stack are certified the same way, against reference-method runs in a RATA.'] ] },
    { title: 'From data to results', lesson: 'calculator.html', lessonName: 'Worked example', badge: 'Σ', d: 18, draw: sResults, cap: [
      [0, 'Back at base, the field data become results one step at a time.'],
      [5.6, 'Concentration times flow gives the emission rate in pounds per hour.'],
      [10.8, 'The three runs are averaged and compared with the limit. Isokinetic and QA checks must pass too.'] ] },
    { title: 'The report', lesson: 'overview.html', lessonName: 'The test, start to finish', badge: '0', d: 12, draw: sReport, cap: [
      [0, 'Everything goes into a report the agency can rely on: results, process data, methods, QA and raw data.'],
      [5.6, 'That is a stack test, from the port to the report. Explore any step in the lessons.'] ] },
  ];
  let acc = 0;
  SCENES.forEach((s, i) => { s.i = i; s.start = acc; acc += s.d; });
  const TOTAL = acc;
  const POSTER_T = 6.5;

  /* =========================================================
     Rendering
     ========================================================= */
  // T is the film's timeline; amb is an ambient clock for background motion
  // (gas, bubbles, dials) that keeps running while the timeline waits for the narrator.
  let scale = 1, T = 0, poster = true, amb = POSTER_T;
  function sceneAt(time) {
    for (let i = SCENES.length - 1; i >= 0; i--) if (time >= SCENES[i].start) return SCENES[i];
    return SCENES[0];
  }
  function drawTag(s, a) {
    if (!s.i) return;
    A(a, () => {
      let x = 40;
      if (s.badge) x += badge(s.badge, 40, 24, { h: 38, size: 24 }) + 14;
      txt(s.title, x, 52, { size: 28, disp: true, w: 600 });
      txt(`${s.i + 1} of ${SCENES.length}`, W - 40, 50, { al: 'right', size: 15, c: C.dim });
    });
  }
  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    grid();
    const time = poster ? POSTER_T : Math.min(T, TOTAL - 1e-6);
    const s = sceneAt(time);
    const t = time - s.start;
    const last = s.i === SCENES.length - 1;
    const a = Math.min(seg(t, 0, 0.45), last ? 1 : 1 - seg(t, s.d - 0.45, s.d));
    ctx.save();
    ctx.globalAlpha = a;
    try { s.draw(t, s.d); } catch (e) { console.error(e); }
    ctx.restore();
    drawTag(s, a);
    if (!poster) syncUI(s, t);
  }
  function fit() {
    const w = canvas.clientWidth || 960;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * 9 / 16) * dpr);
    scale = canvas.width / W;
    render();
  }

  /* =========================================================
     Player UI
     ========================================================= */
  const player = $('#film'), stage = $('#film-stage');
  const btnPlay = $('#film-play'), big = $('#film-big'), range = $('#film-range'), fill = $('#film-fill');
  const nowEl = $('#film-now'), capEl = $('#film-cap'), ccBtn = $('#film-cc'), fsBtn = $('#film-fs');
  const endEl = $('#film-end'), list = $('#film-chapters');
  let playing = false, raf = 0, last = 0, lastCap = null, lastScene = -1;

  /* ---------- Voiceover: the browser's speech synthesis reads each caption ---------- */
  const CUES = [];
  SCENES.forEach((s) => s.cap.forEach(([at, text]) => CUES.push({ time: s.start + at, text, first: at === 0 })));
  const cueAt = (time) => { let k = -1; CUES.forEach((c, i) => { if (c.time <= time + 1e-6) k = i; }); return k; };
  /** Where the timeline waits while cue i is still being read: just before the next cue, or before the scene fades out. */
  const holdPoint = (i) => { const nx = CUES[i + 1]; return nx ? nx.time - (nx.first ? 0.5 : 0.02) : TOTAL - 0.05; };
  /** Spell out symbols the way a tester would say them. */
  const spoken = (s) => s
    .replace(/CO₂/g, 'C O 2').replace(/SO₂/g, 'S O 2').replace(/NOₓ/g, 'N O X').replace(/O₂/g, 'O 2')
    .replace(/\bCO\b/g, 'C O').replace(/B_ws/g, 'B W S').replace(/Δp/g, 'delta P')
    .replace(/(\d+) ?°F/g, '$1 degrees Fahrenheit').replace(/(\d+)°/g, '$1 degrees')
    .replace(/\bQA\b/g, 'Q A').replace(/Figure 1-1/g, 'Figure 1 1').replace(/S-type/g, 'S type');

  const synth = window.speechSynthesis;
  const voiceOK = !!(synth && window.SpeechSynthesisUtterance);
  const voiceBtn = $('#film-voice');
  let voiceOn = false, voice = null, utter = null, speaking = false, spokenIdx = -1, speakStart = 0, speakBudget = 0;
  function pickVoice() {
    const rank = (v) => (/natural|neural|online/i.test(v.name) ? 6 : 0) + (/google/i.test(v.name) ? 4 : 0)
      + (/samantha|aria|jenny|guy|daniel|karen|moira|serena|ava|allison/i.test(v.name) ? 3 : 0)
      + (/en[-_]US/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0);
    const en = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
    en.sort((a, b) => rank(b) - rank(a));
    voice = en[0] || null;
  }
  function speakCue(k) {
    if (!voiceOn || k < 0) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(spoken(CUES[k].text));
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
    u.rate = 1.02;
    const done = () => { if (utter === u) { utter = null; speaking = false; } };
    u.onend = done;
    u.onerror = done;
    utter = u;
    speaking = true;
    spokenIdx = k;
    speakStart = performance.now();
    // Safety net: some engines never fire onend, and the film must not wait forever.
    speakBudget = CUES[k].text.split(/\s+/).length / 1.9 + 2;
    synth.speak(u);
  }
  function hush() {
    if (!voiceOK) return;
    utter = null;
    speaking = false;
    synth.cancel();
  }
  const ICON_VOICE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const ICON_MUTE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  function setVoice(on) {
    voiceOn = voiceOK && on;
    ST.store.set('film-voice', on);
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
    voiceBtn.innerHTML = voiceOn ? ICON_VOICE : ICON_MUTE;
    if (!voiceOn) hush();
    else if (playing) speakCue(cueAt(T));
  }

  $('#film-total').textContent = mmss(TOTAL);
  $('#film-length').textContent = mmss(TOTAL);
  range.max = TOTAL;

  const ticks = $('#film-ticks');
  SCENES.forEach((s) => {
    if (!s.start) return;
    const sp = document.createElement('span');
    sp.style.left = (100 * s.start) / TOTAL + '%';
    ticks.appendChild(sp);
  });
  list.innerHTML = SCENES.map((s) => `<li><button type="button" data-i="${s.i}"><span class="fc-badge" aria-hidden="true">${s.badge || '▶'}</span><span>${s.title}</span><span class="fc-time">${mmss(s.start)}</span></button></li>`).join('');
  const chapterBtns = ST.$$('button', list);
  chapterBtns.forEach((b) => b.addEventListener('click', () => { seek(SCENES[+b.dataset.i].start + 0.01); play(); }));

  $('#film-transcript').innerHTML = SCENES.map((s) => `<section>
      <h3><span>${s.title}</span><span class="fc-time">${mmss(s.start)}</span></h3>
      ${s.cap.map(([, c]) => `<p>${c.replace('B_ws', 'B<sub>ws</sub>')}</p>`).join('')}
      <p class="from">Go deeper: <a href="${s.lesson}">${s.lessonName}</a></p>
    </section>`).join('');

  function syncUI(s, t) {
    nowEl.textContent = mmss(T);
    range.value = T;
    fill.style.width = (100 * T) / TOTAL + '%';
    if (s.i !== lastScene) {
      chapterBtns.forEach((b, i) => {
        b.classList.toggle('is-active', i === s.i);
        if (i === s.i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      lastScene = s.i;
    }
    let cap = '';
    s.cap.forEach(([at, c]) => { if (t >= at) cap = c; });
    if (cap !== lastCap) { capEl.textContent = cap.replace('B_ws', 'Bws'); lastCap = cap; }
  }
  function paintPlay() {
    btnPlay.innerHTML = playing ? ST.icons.pause : ST.icons.play;
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }
  function frame(now) {
    raf = 0;
    if (!playing) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    amb += dt;
    if (voiceOn) {
      if (speaking && (now - speakStart) / 1000 > speakBudget) speaking = false;
      let next = T + dt;
      if (speaking) next = Math.min(next, Math.max(T, holdPoint(spokenIdx)));
      T = next;
      const k = cueAt(T);
      if (k !== spokenIdx) speakCue(k);
    } else {
      T += dt;
    }
    if (T >= TOTAL) {
      T = TOTAL;
      playing = false;
      render();
      endEl.hidden = false;
      paintPlay();
      return;
    }
    render();
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (T >= TOTAL) T = 0;
    poster = false;
    playing = true;
    last = 0;
    big.hidden = true;
    endEl.hidden = true;
    paintPlay();
    // Speaking inside the click handler also unlocks speech on mobile browsers.
    if (voiceOn) speakCue(cueAt(T));
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function pause() { playing = false; hush(); paintPlay(); }
  function toggle() { playing ? pause() : play(); }
  function seek(v) {
    T = ST.clamp(v, 0, TOTAL);
    hush();
    // Read the line if we land at its start; otherwise wait for the next one.
    const k = cueAt(T);
    spokenIdx = k >= 0 && T - CUES[k].time < 0.4 ? k - 1 : k;
    poster = false;
    big.hidden = true;
    endEl.hidden = T < TOTAL;
    render();
  }

  btnPlay.addEventListener('click', toggle);
  big.addEventListener('click', play);
  canvas.addEventListener('click', toggle);
  $('#film-replay').addEventListener('click', () => { T = 0; play(); });
  range.addEventListener('input', () => seek(+range.value));

  const setCC = (on) => {
    player.classList.toggle('no-cc', !on);
    ccBtn.setAttribute('aria-pressed', String(on));
    ST.store.set('film-cc', on);
  };
  setCC(ST.store.get('film-cc', true));
  ccBtn.addEventListener('click', () => setCC(player.classList.contains('no-cc')));

  const fsOK = !!(player.requestFullscreen);
  if (!fsOK) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else player.requestFullscreen().catch(() => {});
  });

  player.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (e.key === ' ' || e.key === 'k') {
      if (tag === 'BUTTON' && e.key === ' ') return; // buttons handle Space themselves
      e.preventDefault(); toggle();
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && tag !== 'INPUT') {
      e.preventDefault(); seek(T + (e.key === 'ArrowRight' ? 5 : -5));
    } else if (e.key === 'c') { setCC(player.classList.contains('no-cc')); }
    else if (e.key === 'v' && voiceOK) { setVoice(!voiceOn); }
    else if (e.key === 'f' && fsOK) { fsBtn.click(); }
  });

  if (voiceOK) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
    setVoice(ST.store.get('film-voice', true));
    voiceBtn.addEventListener('click', () => setVoice(!voiceOn));
    window.addEventListener('pagehide', hush);
  } else {
    voiceBtn.hidden = true;
  }

  paintPlay();
  new ResizeObserver(() => fit()).observe(canvas);
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
  ST.onTheme(() => render());

  // Hook for automated checks: render any moment of the film.
  window.STFilm = { seek: (v) => { pause(); seek(v); }, now: () => T, total: TOTAL, scenes: SCENES.map((s) => ({ title: s.title, start: s.start, d: s.d })) };
})();
