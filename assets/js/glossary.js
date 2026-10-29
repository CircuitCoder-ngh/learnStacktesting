/* Glossary: live search filter and letter index state. */
(function () {
  'use strict';
  const { $, $$ } = ST;
  const input = $('#gloss-q');
  if (!input) return;
  const items = $$('.gloss-item');
  const sections = $$('.gloss-letter');
  const count = $('#gloss-count');
  const empty = $('#gloss-empty');
  const links = $$('.gloss-letters a');
  const total = items.length;

  // Let people type "delta p" or the symbol itself and still match.
  const normalize = (s) => s.toLowerCase().replace(/δ|Δ/g, 'delta ').replace(/\s+/g, ' ').trim();
  items.forEach((it) => { it.dataset.search = normalize(it.dataset.search + ' ' + it.querySelector('dt').textContent); });

  function filter() {
    const words = normalize(input.value).split(' ').filter(Boolean);
    let shown = 0;
    items.forEach((it) => {
      const hit = words.every((w) => it.dataset.search.includes(w));
      it.hidden = !hit;
      if (hit) shown++;
    });
    sections.forEach((sec) => {
      const any = $$('.gloss-item', sec).some((it) => !it.hidden);
      sec.hidden = !any;
      const link = links.find((a) => a.getAttribute('href') === '#' + sec.id);
      if (link) link.classList.toggle('is-empty', !any);
    });
    count.textContent = words.length ? `${shown} of ${total} terms` : `${total} terms`;
    empty.hidden = shown > 0;
  }

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; filter(); }
  });
  // A jump link should always land on something visible.
  links.forEach((a) => a.addEventListener('click', () => {
    if (input.value) { input.value = ''; filter(); }
  }));
})();
