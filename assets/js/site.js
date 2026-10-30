/* Stack Testing Field Guide — shared chrome and helpers.
   Loaded with `defer` on every page, before the page's own script.
   Exposes window.ST for page scripts. Classic script (no modules) so the
   site also works when index.html is opened straight from disk. */
(function () {
  'use strict';

  const ST = (window.ST = {});

  /* ---------- Course map: single source of truth for nav, rail and pager ---------- */
  ST.course = [
    {
      group: 'Start here',
      items: [
        { id: 'overview', badge: '0', title: 'The test, start to finish', href: 'overview.html' },
      ],
    },
    {
      group: 'Reference methods',
      items: [
        { id: 'm1', badge: '1', title: 'Traverse points', href: 'method-1.html' },
        { id: 'm2', badge: '2', title: 'Velocity and flow rate', href: 'method-2.html' },
        { id: 'm3', badge: '3', title: 'Gas composition', href: 'method-3.html' },
        { id: 'm4', badge: '4', title: 'Moisture', href: 'method-4.html' },
        { id: 'm5', badge: '5', title: 'Particulate matter', href: 'method-5.html' },
        { id: 'instr', badge: '7E', title: 'Instrumental analyzers', href: 'instrumental.html' },
        { id: 'more', badge: '+', title: 'More methods', href: 'more-methods.html' },
      ],
    },
    {
      group: 'Put it together',
      items: [
        { id: 'calc', badge: 'Σ', title: 'Worked example', href: 'calculator.html' },
        { id: 'movie', badge: '▶', title: 'The movie', href: 'movie.html' },
        { id: 'glossary', badge: 'A', title: 'Glossary', href: 'glossary.html' },
      ],
    },
  ];
  ST.lessons = ST.course.flatMap((g) => g.items);
  const LESSON_IDS = ['overview', 'm1', 'm2', 'm3', 'm4', 'm5', 'instr', 'more', 'calc'];

  /* ---------- Small utilities ---------- */
  ST.$ = (sel, root = document) => root.querySelector(sel);
  ST.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  ST.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  ST.lerp = (a, b, t) => a + (b - a) * t;
  ST.ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Format a number with fixed decimals; em dash for non-finite. */
  ST.fmt = function (n, d = 2) {
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  ST.svgNS = 'http://www.w3.org/2000/svg';
  /** Create an SVG element with attributes. */
  ST.svg = function (tag, attrs = {}, parent) {
    const el = document.createElementNS(ST.svgNS, tag);
    for (const k in attrs) {
      if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(el);
    return el;
  };

  ST.store = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem('st:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('st:' + key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable: progress simply isn't remembered */
      }
    },
  };

  /* ---------- Theme ---------- */
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  const themeListeners = [];
  ST.theme = function () {
    const t = document.documentElement.dataset.theme;
    return t || (darkMQ.matches ? 'dark' : 'light');
  };
  ST.onTheme = (fn) => themeListeners.push(fn);
  function notifyTheme() {
    themeListeners.forEach((fn) => {
      try { fn(ST.theme()); } catch (e) { console.error(e); }
    });
  }
  darkMQ.addEventListener('change', notifyTheme);
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    ST.store.set('theme', t);
    notifyTheme();
  }
  /** Read a CSS custom property (theme-aware colour for canvas drawing). */
  ST.color = (name) => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();

  ST.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Progress ---------- */
  ST.progress = {
    all() { return ST.store.get('done', {}); },
    isDone(id) { return !!this.all()[id]; },
    set(id, done) {
      const all = this.all();
      if (done) all[id] = Date.now();
      else delete all[id];
      ST.store.set('done', all);
      refreshProgress();
    },
  };

  /* ---------- Icons ---------- */
  const ICONS = {
    logo:
      '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="7" width="9" height="23" rx="1" fill="currentColor"/><rect x="7" y="27" width="13" height="3" rx="1" fill="currentColor"/><path d="M18 17h7" stroke="var(--gauge)" stroke-width="2.4" stroke-linecap="round"/><circle cx="13.5" cy="17" r="1.6" fill="var(--paper)"/><path d="M11 5c0-2 3-2 3-4M15.5 5.5c0-2 3-2 3-4" stroke="var(--gas)" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    check: '<svg class="rail-check" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M4.6 8.3l2.2 2.2 4.6-4.8" stroke="var(--paper)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="1.5" width="2.6" height="9" fill="currentColor"/><rect x="6.9" y="1.5" width="2.6" height="9" fill="currentColor"/></svg>',
  };
  ST.icons = ICONS;

  /* ---------- Chrome ---------- */
  const page = document.body.dataset.page || '';

  function buildHeader() {
    const host = document.getElementById('site-header');
    if (!host) return;
    host.className = 'topbar';
    const hasRail = !!document.getElementById('rail');
    const link = (href, label, id, cls = '') =>
      `<a href="${href}" class="${cls}"${page === id ? ' aria-current="page"' : ''}>${label}</a>`;
    host.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="topbar-inner">
        ${hasRail ? `<button class="icon-btn rail-toggle" type="button" aria-label="Open course map" aria-expanded="false" aria-controls="rail">${ICONS.menu}</button>` : ''}
        <a class="brand" href="index.html">${ICONS.logo}<span>Stack Testing Field Guide</span></a>
        <nav class="topnav" aria-label="Primary">
          ${link('overview.html', 'Course', 'overview', 'hide-sm')}
          ${link('index.html#methods', 'Methods', '__', 'hide-sm')}
          ${link('calculator.html', 'Worked example', 'calc', 'hide-sm')}
          ${link('movie.html', 'Movie', 'movie', 'hide-sm')}
          ${link('glossary.html', 'Glossary', 'glossary', 'hide-sm')}
          <button class="icon-btn theme-btn" type="button" aria-label="Switch color theme"></button>
        </nav>
      </div>`;

    const themeBtn = host.querySelector('.theme-btn');
    const paintThemeBtn = () => {
      const dark = ST.theme() === 'dark';
      themeBtn.innerHTML = dark ? ICONS.sun : ICONS.moon;
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    paintThemeBtn();
    ST.onTheme(paintThemeBtn);
    themeBtn.addEventListener('click', () => setTheme(ST.theme() === 'dark' ? 'light' : 'dark'));
  }

  function buildRail() {
    const rail = document.getElementById('rail');
    if (!rail) return;
    const done = ST.progress.all();
    let html = '<nav aria-label="Course map">';
    ST.course.forEach((g) => {
      html += `<div class="rail-group"><p class="rail-group-name">${g.group}</p><ol class="rail-list">`;
      g.items.forEach((it) => {
        const current = it.id === page;
        html += `<li><a class="rail-link${done[it.id] ? ' is-done' : ''}" data-id="${it.id}" href="${it.href}"${current ? ' aria-current="page"' : ''}>
          <span class="rail-badge" aria-hidden="true">${it.badge}</span><span>${it.title}</span>${ICONS.check}</a>`;
        if (current) html += '<ol class="rail-sections" id="rail-sections"></ol>';
        html += '</li>';
      });
      html += '</ol></div>';
    });
    html += `<div class="rail-progress"><span id="rail-progress-text"></span><div class="rail-progress-bar"><span id="rail-progress-bar"></span></div></div>`;
    html += '</nav>';
    rail.innerHTML = html;

    // In-page section list from h2[id] inside main
    const secList = document.getElementById('rail-sections');
    const heads = ST.$$('#main h2[id]');
    if (secList && heads.length) {
      heads.forEach((h) => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="#${h.id}">${h.dataset.short || h.textContent}</a>`;
        secList.appendChild(li);
      });
      const links = ST.$$('a', secList);
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
            }
          });
        },
        { rootMargin: '-15% 0px -70% 0px' }
      );
      heads.forEach((h) => io.observe(h));
    }

    // Mobile drawer
    const toggle = document.querySelector('.rail-toggle');
    const scrim = document.createElement('div');
    scrim.className = 'rail-scrim';
    document.body.appendChild(scrim);
    const setOpen = (open) => {
      rail.classList.toggle('is-open', open);
      scrim.classList.toggle('is-open', open);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    };
    if (toggle) toggle.addEventListener('click', () => setOpen(!rail.classList.contains('is-open')));
    scrim.addEventListener('click', () => setOpen(false));
    rail.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    refreshProgress();
  }

  function refreshProgress() {
    const done = ST.progress.all();
    ST.$$('.rail-link').forEach((a) => a.classList.toggle('is-done', !!done[a.dataset.id]));
    const n = LESSON_IDS.filter((id) => done[id]).length;
    const text = document.getElementById('rail-progress-text');
    const bar = document.getElementById('rail-progress-bar');
    if (text) text.textContent = `${n} of ${LESSON_IDS.length} lessons complete`;
    if (bar) bar.style.width = (100 * n) / LESSON_IDS.length + '%';
    ST.$$('[data-progress-count]').forEach((el) => (el.textContent = n));
  }

  function buildLessonEnd() {
    const host = document.getElementById('lesson-end');
    if (!host) return;
    const idx = ST.lessons.findIndex((l) => l.id === page);
    const prev = ST.lessons[idx - 1];
    const next = ST.lessons[idx + 1];
    const canComplete = LESSON_IDS.includes(page);
    host.innerHTML = `
      ${canComplete ? `<div class="lesson-end"><p>Finished this lesson? Mark it to track your progress through the course.</p>
        <button class="btn ghost complete-btn" type="button"></button></div>` : ''}
      <nav class="pager" aria-label="Lesson navigation">
        ${prev ? `<a href="${prev.href}"><span class="pager-dir">Previous</span><span class="pager-title">${prev.title}</span></a>` : ''}
        ${next ? `<a class="is-next" href="${next.href}"><span class="pager-dir">Next</span><span class="pager-title">${next.title}</span></a>` : ''}
      </nav>`;
    const btn = host.querySelector('.complete-btn');
    if (!btn) return;
    const paint = () => {
      const d = ST.progress.isDone(page);
      btn.classList.toggle('is-done', d);
      btn.textContent = d ? 'Completed — click to undo' : 'Mark lesson complete';
    };
    btn.addEventListener('click', () => { ST.progress.set(page, !ST.progress.isDone(page)); paint(); });
    paint();
  }

  function buildFooter() {
    const host = document.getElementById('site-footer');
    if (!host) return;
    host.className = 'site-footer';
    host.innerHTML = `<div class="site-footer-inner">
      <div>
        <p>An educational guide to stationary source emissions testing. Method summaries paraphrase the U.S. EPA reference methods (40 CFR Part 60 Appendix A, Part 51 Appendix M, Part 63 Appendix A).
        Regulations change: always work from the current text at <a href="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/appendix-Appendix%20A-1%20to%20Part%2060" rel="noopener">eCFR</a>, the EPA <a href="https://www.epa.gov/emc" rel="noopener">Emission Measurement Center</a>, and your approved test protocol.</p>
      </div>
      <nav aria-label="Footer"><a href="index.html">Home</a><a href="overview.html">Course</a><a href="glossary.html">Glossary</a></nav>
    </div>`;
  }

  /* ---------- KaTeX ---------- */
  /** Render TeX into an element (display or inline). Falls back to source text. */
  ST.tex = function (el, src, display = true) {
    if (!el) return;
    if (window.katex) {
      try {
        window.katex.render(src, el, { displayMode: display, throwOnError: false, strict: false });
        return;
      } catch (e) { /* fall through */ }
    }
    el.textContent = src;
  };
  function renderAllTex(root = document) {
    ST.$$('.tex', root).forEach((el) => {
      if (el.dataset.rendered) return;
      const src = el.textContent;
      el.dataset.src = src;
      ST.tex(el, src, el.tagName !== 'SPAN');
      el.dataset.rendered = '1';
    });
  }
  ST.renderTex = renderAllTex;

  /* ---------- Quizzes ----------
     <div class="quiz" data-title="Check yourself"><script type="application/json">
       [{"q":"...","options":["a","b"],"answer":1,"why":"..."}]
     </script></div> */
  function buildQuizzes() {
    ST.$$('.quiz').forEach((quiz, qi) => {
      const data = JSON.parse(quiz.querySelector('script[type="application/json"]').textContent);
      buildQuiz(quiz, qi, data);
    });
  }
  function buildQuiz(quiz, qi, data) {
    {
      const title = quiz.dataset.title || 'Check yourself';
      let answered = 0, correct = 0;
      quiz.innerHTML = `<div class="quiz-head"><h3>${title}</h3><span class="quiz-score" aria-live="polite">${data.length} questions</span></div>`;
      const score = quiz.querySelector('.quiz-score');
      data.forEach((item, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'quiz-item';
        const qid = `quiz-${qi}-${i}`;
        wrap.innerHTML = `<p class="quiz-q" id="${qid}"><span>${i + 1}.</span>${item.q}</p>
          <ul class="quiz-opts" role="list" aria-labelledby="${qid}">${item.options
            .map((o, j) => `<li><button type="button" class="quiz-opt" data-j="${j}"><span class="mark" aria-hidden="true"></span><span>${o}</span></button></li>`)
            .join('')}</ul>
          <p class="quiz-why" hidden></p>`;
        const why = wrap.querySelector('.quiz-why');
        const btns = ST.$$('.quiz-opt', wrap);
        btns.forEach((b) =>
          b.addEventListener('click', () => {
            const j = +b.dataset.j;
            const ok = j === item.answer;
            btns.forEach((x) => (x.disabled = true));
            btns[item.answer].classList.add('is-correct');
            btns[item.answer].querySelector('.mark').textContent = '✓';
            if (!ok) { b.classList.add('is-wrong'); b.querySelector('.mark').textContent = '✕'; }
            why.innerHTML = `<strong>${ok ? 'Correct.' : 'Not quite.'}</strong> ${item.why}`;
            why.hidden = false;
            renderAllTex(why);
            answered++;
            if (ok) correct++;
            score.textContent = answered === data.length
              ? `You scored ${correct} of ${data.length}`
              : `${correct} of ${answered} correct so far`;
            if (answered === data.length) foot.hidden = false;
          })
        );
        quiz.appendChild(wrap);
      });
      const foot = document.createElement('div');
      foot.className = 'quiz-foot';
      foot.hidden = true;
      foot.innerHTML = '<button type="button" class="btn ghost small">Try again</button>';
      foot.querySelector('button').addEventListener('click', () => buildQuiz(quiz, qi, data));
      quiz.appendChild(foot);
      renderAllTex(quiz);
    }
  }

  /* ---------- Range inputs: keep the filled-track gradient in sync ---------- */
  ST.paintRange = function (input) {
    const min = +input.min || 0, max = +input.max || 100;
    input.style.setProperty('--fill', ((+input.value - min) / (max - min)) * 100 + '%');
  };
  function wireRanges() {
    ST.$$('input[type="range"]').forEach((r) => {
      ST.paintRange(r);
      r.addEventListener('input', () => ST.paintRange(r));
    });
  }

  /**
   * Bind a range/number input to an output element and a callback.
   * fmt(value) returns the text for the output.
   */
  ST.bind = function (input, out, fmt, onChange) {
    if (typeof input === 'string') input = document.getElementById(input.replace(/^#/, ''));
    if (typeof out === 'string') out = document.getElementById(out.replace(/^#/, ''));
    const update = () => {
      if (out) out.textContent = fmt ? fmt(+input.value) : input.value;
      if (input.type === 'range') ST.paintRange(input);
      if (onChange) onChange(+input.value);
    };
    input.addEventListener('input', update);
    update();
    return input;
  };

  /** Segmented control: buttons with data-value inside .seg. */
  ST.seg = function (el, onChange) {
    if (typeof el === 'string') el = document.getElementById(el.replace(/^#/, ''));
    const btns = ST.$$('button', el);
    const set = (v, fire = true) => {
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
      if (fire && onChange) onChange(v);
    };
    btns.forEach((b) => b.addEventListener('click', () => set(b.dataset.value)));
    const initial = btns.find((b) => b.getAttribute('aria-pressed') === 'true') || btns[0];
    return { set, get value() { const b = btns.find((x) => x.getAttribute('aria-pressed') === 'true'); return b ? b.dataset.value : null; }, init: () => set(initial.dataset.value) };
  };

  /* ---------- Canvas + animation helpers ---------- */
  /**
   * Make a canvas crisp on high-DPI screens and keep it sized to its CSS box.
   * aspect = height / width. Calls onResize(w, h) in CSS pixels.
   */
  ST.canvas = function (canvas, aspect, onResize) {
    const ctx = canvas.getContext('2d');
    const state = { ctx, w: 0, h: 0, dpr: 1 };
    const fit = () => {
      const w = canvas.clientWidth || canvas.parentElement.clientWidth;
      const h = aspect ? Math.round(w * aspect) : canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (aspect) canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Object.assign(state, { w, h, dpr });
      if (onResize) onResize(w, h);
      // Resizing clears the bitmap; a paused ST.loop listens for this and redraws.
      canvas.dispatchEvent(new Event('st-resize'));
    };
    fit();
    new ResizeObserver(() => {
      const w = canvas.clientWidth;
      if (Math.abs(w - state.w) > 1) fit();
    }).observe(canvas);
    return state;
  };

  /**
   * requestAnimationFrame loop that only runs while `el` is on screen.
   * step(dt seconds, t seconds). Respects reduced motion: starts paused,
   * and a play/pause button is added to `buttonHost` if given.
   */
  ST.loop = function (el, step, opts = {}) {
    let playing = !ST.reducedMotion && opts.autoplay !== false;
    let visible = false, raf = 0, last = 0, t = 0;
    const frame = (now) => {
      raf = 0;
      if (!playing || !visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      t += dt;
      step(dt, t);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && playing && visible) { last = 0; raf = requestAnimationFrame(frame); } };
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }, { threshold: 0.01 }).observe(el);
    el.addEventListener('st-resize', () => { if (!raf) step(0, t); });
    let btn = null;
    const paintBtn = () => {
      if (!btn) return;
      btn.innerHTML = playing ? `${ICONS.pause}Pause` : `${ICONS.play}Play`;
      btn.setAttribute('aria-pressed', String(!playing));
    };
    if (opts.buttonHost) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'anim-toggle';
      opts.buttonHost.appendChild(btn);
      btn.addEventListener('click', () => api.toggle());
      paintBtn();
    }
    const api = {
      get playing() { return playing; },
      play() { playing = true; paintBtn(); kick(); },
      pause() { playing = false; paintBtn(); },
      toggle() { playing ? api.pause() : api.play(); },
      /** Draw one frame without advancing time (for static redraws). */
      draw() { step(0, t); },
    };
    step(0, 0);
    return api;
  };

  /* ---------- Init ---------- */
  function init() {
    buildHeader();
    buildRail();
    buildLessonEnd();
    buildFooter();
    renderAllTex();
    buildQuizzes();
    wireRanges();
  }
  // Deferred scripts run before DOMContentLoaded, so page scripts can register first.
  document.addEventListener('DOMContentLoaded', init);
})();
