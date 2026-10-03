// Русский — application d'apprentissage (version web autonome, sans dépendance).
// Données : window.DICT (dict.js) = { words: [{ ru, l, fr, t, p }], verbs: { inf: { a, pair, g, pres, past, imp, note } } }
//   ru  : mot avec accent tonique (U+0301)   l : numéro de leçon   fr : traduction
//   t   : nature (nm, nf, nn, npl, v, adj, adv, pron, prep, conj, num, part, expr)   p : page du livre
// Progression : nombre de leçons validées, stocké dans localStorage. Les mots des leçons non validées restent masqués.

(function () {
  'use strict';

  const D = window.DICT;
  const TOTAL = 28;
  const STORE_KEY = 'russe.lessonsDone';
  const app = document.getElementById('app');

  // ---------- Progression ----------
  function getDone() {
    try {
      const n = parseInt(localStorage.getItem(STORE_KEY), 10);
      return Number.isFinite(n) ? Math.min(TOTAL, Math.max(0, n)) : 0;
    } catch (e) {
      return memDone;
    }
  }
  let memDone = 0;
  function setDone(n) {
    memDone = Math.min(TOTAL, Math.max(0, n));
    try { localStorage.setItem(STORE_KEY, String(memDone)); } catch (e) { /* stockage indisponible */ }
  }

  // ---------- État d'interface (non persistant) ----------
  const ui = {
    mode: 'both',        // both | print | cursive
    sort: 'alpha',       // alpha | lesson
    q: '',
    sel: [],             // leçons sélectionnées dans le dictionnaire (vide = toutes)
    open: '',            // verbe dont la conjugaison est dépliée
    filter: 'all',       // filtre de la page Leçon
    tense: 'pres',
    verbQ: '',
    cat: 'all',
    lessonDate: new Date().toLocaleDateString('fr-FR')
  };

  // ---------- Utilitaires ----------
  const strip = (s) => s.replace(/́/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sortKey = (w) => strip(w.ru).toLowerCase().replace(/^\(к\)\s*/, '').replace(/^[^а-яё]+/, '');
  const byKey = (a, b) => sortKey(a).localeCompare(sortKey(b), 'ru');
  const unlocked = () => D.words.filter((w) => w.l <= getDone());
  const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);

  const TAGS = {
    nm: ['nom m.', 'n'], nf: ['nom f.', 'n'], nn: ['nom n.', 'n'], npl: ['nom pl.', 'n'], v: ['verbe', 'v'],
    adj: ['adjectif', 'o'], adv: ['adverbe', 'o'], pron: ['pronom', 'o'], prep: ['préposition', 'o'],
    conj: ['conjonction', 'o'], num: ['nombre', 'o'], part: ['particule', 'o'], expr: ['expression', 'e']
  };
  const tag = (t) => TAGS[t] || ['', 'o'];

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    dico: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
    lesson: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    verb: '<path d="M4 7h16M4 12h10M4 17h13"/>',
    grammar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  const icon = (name, size = 20, sw = 1.8) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- Conjugaison ----------
  const PRON = { pres: ['я', 'ты', 'он / она', 'мы', 'вы', 'они'], past: ['он', 'она', 'оно', 'они'], imp: ['ты', 'вы'] };
  const BUDU = ['буду', 'будешь', 'будет', 'будем', 'будете', 'будут'];

  // Sépare radical et terminaison (plus long préfixe commun), pour colorer la terminaison.
  function split(forms) {
    const real = forms.filter((f) => f && f !== '—');
    let p = real[0] || '';
    real.forEach((f) => { while (p && f.indexOf(p) !== 0) p = p.slice(0, -1); });
    return forms.map((f) => (f === '—' ? { stem: '—', end: '' } : { stem: f.slice(0, p.length), end: f.slice(p.length) }));
  }
  function conj(inf, v, tense) {
    if (tense === 'fut') {
      const base = inf.replace(/\s.*$/, '');
      return split(BUDU).map((f, i) => ({ p: PRON.pres[i], ...f, rest: ' ' + base }));
    }
    const forms = tense === 'pres' ? v.pres : tense === 'past' ? v.past : v.imp;
    return split(forms).map((f, i) => ({ p: PRON[tense][i], ...f, rest: '' }));
  }
  const groupLabel = (v) => (v.g === 'irr' ? 'irrégulier' : v.g === '1' ? '1re conjugaison' : '2e conjugaison');
  const verbInfo = (v) =>
    (v.a === 'pf' ? 'Perfectif' : 'Imperfectif') + ' · ' + groupLabel(v) +
    (v.pair ? ' · ' + (v.a === 'pf' ? 'imperf. : ' : 'perf. : ') + v.pair : '');
  const tensesOf = (v) =>
    v.a === 'pf'
      ? [['pres', 'Futur'], ['past', 'Passé'], ['imp', 'Impératif']]
      : [['pres', 'Présent'], ['past', 'Passé'], ['fut', 'Futur'], ['imp', 'Impératif']];
  function ruleFor(v, t) {
    if (t === 'pres') {
      if (v.a === 'pf') return 'Les verbes perfectifs n’ont pas de présent : ces formes expriment le futur.';
      if (v.g === '1') return '1re conjugaison : -ю (-у), -ешь, -ет, -ем, -ете, -ют (-ут).';
      if (v.g === '2') return '2e conjugaison : -ю (-у), -ишь, -ит, -им, -ите, -ят (-ат).';
      return 'Verbe irrégulier : formes à apprendre par cœur.';
    }
    if (t === 'past') return 'Passé : radical + -л (m.), -ла (f.), -ло (n.), -ли (pl.). Il s’accorde en genre et en nombre, pas en personne.';
    if (t === 'fut') return 'Futur composé des imperfectifs : быть au futur + infinitif.';
    return 'Impératif : forme en ты et en вы (-те). Avec la négation, on emploie plutôt l’imperfectif.';
  }

  // ---------- Fragments ----------
  const seg = (action, items, cur, label) =>
    `<div class="seg" role="group" aria-label="${label}">${items
      .map(([id, l]) => `<button type="button" class="${id === cur ? 'on' : ''}" aria-pressed="${id === cur}" data-action="${action}" data-value="${id}">${l}</button>`)
      .join('')}</div>`;

  const modeSeg = () => seg('mode', [['both', 'Les deux'], ['print', 'Imprimé'], ['cursive', 'Cursive']], ui.mode, 'Écriture affichée');

  function wordCard(w) {
    const key = strip(w.ru);
    const [label, kind] = tag(w.t);
    const v = w.t === 'v' ? D.verbs[key] : null;
    const isOpen = !!v && ui.open === key;
    let html = `<article class="word${isOpen ? ' open' : ''}">
      <div class="word-head">
        <div style="min-width:0">
          <div class="word-forms">
            ${ui.mode !== 'cursive' ? `<span class="ru">${esc(w.ru)}</span>` : ''}
            ${ui.mode !== 'print' ? `<span class="cur">${esc(key)}</span>` : ''}
          </div>
          <div class="word-fr">${esc(w.fr)}</div>
        </div>
        <div class="word-meta"><span class="tag ${kind}">${label}</span><span>Leçon ${w.l}</span></div>
      </div>`;
    if (v) {
      html += `<button type="button" class="link-btn" data-action="toggle-verb" data-value="${esc(key)}" aria-expanded="${isOpen}">${isOpen ? 'Masquer la conjugaison' : 'Voir la conjugaison'}</button>`;
    }
    if (isOpen) {
      const block = (title, rows) => `<div class="eyebrow">${title}</div><div class="conj-grid">${rows
        .map((r) => `<div><span class="f"><span class="muted">${r.p} </span>${esc(r.stem)}<span class="end">${esc(r.end)}</span></span><span class="cur">${esc(r.stem + r.end)}</span></div>`)
        .join('')}</div>`;
      html += `<div class="conj">
        <span class="muted" style="font-size:13px">${esc(verbInfo(v))}</span>
        ${block(v.a === 'pf' ? 'Futur' : 'Présent', conj(key, v, 'pres'))}
        ${block('Passé', conj(key, v, 'past'))}
        ${v.note ? `<span class="note">${esc(v.note)}</span>` : ''}
        <a href="#/verbe/${encodeURIComponent(key)}" style="font-size:13px;font-weight:700;text-decoration:none">Fiche complète (futur, impératif) ›</a>
      </div>`;
    }
    return html + '</article>';
  }

  // ---------- Vues ----------
  function viewHome() {
    const done = getDone();
    const words = unlocked();
    const verbs = words.filter((w) => w.t === 'v');
    const next = done + 1;
    const nextCount = D.words.filter((w) => w.l === next).length;
    // Mot du jour : un verbe débloqué, stable pour la journée
    const day = Math.floor(Date.now() / 86400000);
    const wod = verbs.length ? verbs[day % verbs.length] : null;
    const recent = [];
    for (let n = done; n >= 1 && recent.length < 3; n--) recent.push(n);

    return `
      <header class="row" style="justify-content:space-between;align-items:flex-end">
        <div style="display:flex;flex-direction:column">
          <span class="eyebrow">Bon retour</span>
          <h1 class="page-title" style="font-size:40px">Добрый день</h1>
          <span class="page-title-cur" style="font-size:36px">Добрый день</span>
        </div>
        <span class="muted">${done ? `Leçons 1 à ${done} validées sur ${TOTAL}` : 'Aucune leçon validée pour l’instant'}</span>
      </header>
      <div class="grid-fit">
        <section class="card dark" style="justify-content:space-between;gap:16px">
          <div style="display:flex;flex-direction:column;gap:6px">
            <span class="eyebrow">Cours de la semaine</span>
            ${next <= TOTAL
              ? `<span class="ru" style="font-size:28px">Урок ${next} — à valider</span>
                 <span class="muted">${plural(nextCount, 'nouveau mot t’attend', 'nouveaux mots t’attendent')}. Ils restent cachés jusqu’à la validation.</span>`
              : `<span class="ru" style="font-size:28px">Livre terminé !</span><span class="muted">Les ${TOTAL} leçons sont validées.</span>`}
          </div>
          ${next <= TOTAL ? `<a class="btn" href="#/valider" style="max-width:260px">${icon('check', 20, 2.2)}Valider la leçon</a>` : ''}
        </section>
        <section class="card">
          <span class="eyebrow">Mot du jour${wod ? ' · leçon ' + wod.l : ''}</span>
          ${wod
            ? `<span class="ru" style="font-size:34px">${esc(wod.ru)}</span>
               <span class="cur" style="font-size:40px;border-bottom:1px solid #C9D3F0;line-height:1.2">${esc(strip(wod.ru))}</span>
               <span style="font-size:17px">${esc(wod.fr)}</span>
               <a href="#/verbe/${encodeURIComponent(strip(wod.ru))}" style="font-weight:700;text-decoration:none">Voir la conjugaison ›</a>`
            : '<span class="muted">Valide une leçon contenant un verbe pour voir le mot du jour.</span>'}
        </section>
      </div>
      <section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <div class="stat"><b>${done}</b><span class="muted">leçons validées</span></div>
        <div class="stat"><b>${words.length}</b><span class="muted">mots débloqués</span></div>
        <div class="stat"><b>${verbs.length}</b><span class="muted">verbes</span></div>
        <div class="stat"><b>${TOTAL - done}</b><span class="muted">leçons restantes</span></div>
      </section>
      ${recent.length ? `<section style="display:flex;flex-direction:column;gap:10px">
        <h2 class="eyebrow">Dernières leçons</h2>
        <div class="grid">${recent.map((n) => {
          const ws = D.words.filter((w) => w.l === n);
          const vc = ws.filter((w) => w.t === 'v').length;
          return `<a class="card" href="#/lecon/${n}" style="flex-direction:row;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;padding:14px 18px">
            <span style="display:flex;flex-direction:column"><span class="ru" style="font-size:18px">Урок ${n}</span><span class="muted" style="font-size:13px">${vc ? plural(vc, 'verbe', 'verbes') : 'aucun verbe'}</span></span>
            <span class="muted">${ws.length} mots ›</span></a>`;
        }).join('')}</div>
      </section>` : ''}`;
  }

  function viewValidate() {
    const done = getDone();
    const next = done + 1;
    const count = (n) => D.words.filter((w) => w.l === n).length;
    const tiles = [];
    for (let n = 1; n <= TOTAL; n++) {
      const cls = n <= done ? 'done' : n === next ? 'next' : 'locked';
      const sub = n <= done ? count(n) + ' mots' : n === next ? 'À valider' : 'Verrouillée';
      const inner = `<span class="dot">${n <= done ? '✓' : n}</span><span style="display:flex;flex-direction:column"><span class="ru" style="font-size:16px">Урок ${n}</span><span style="font-size:12px">${sub}</span></span>`;
      tiles.push(n <= done ? `<a class="lesson-tile ${cls}" href="#/lecon/${n}">${inner}</a>` : `<div class="lesson-tile ${cls}">${inner}</div>`);
    }
    let options = '';
    for (let n = 0; n <= TOTAL; n++) options += `<option value="${n}"${n === done ? ' selected' : ''}>${n === 0 ? 'Aucune leçon' : 'Leçon ' + n}</option>`;

    return `
      <header style="display:flex;flex-direction:column;gap:4px">
        <h1 class="page-title">Valider une leçon</h1>
        <span class="muted">Quand tu valides une leçon, ses mots et ses verbes apparaissent dans ton dictionnaire.</span>
      </header>
      <div class="split">
        <div class="side" style="display:flex;flex-direction:column;gap:16px">
          ${next <= TOTAL ? `<section class="card outlined" style="gap:12px">
            <span class="eyebrow" style="color:var(--accent-dark);font-weight:700">Prochaine leçon</span>
            <span class="ru" style="font-size:34px">Урок ${next}</span>
            <span style="color:var(--soft);line-height:1.45">${count(next)} mots, dont ${plural(D.words.filter((w) => w.l === next && w.t === 'v').length, 'verbe', 'verbes')}, seront ajoutés à ton dictionnaire.</span>
            <label class="field">Date du cours<input type="text" id="lesson-date" value="${esc(ui.lessonDate)}"></label>
            <button type="button" class="btn" data-action="validate">${icon('check', 20, 2.2)}Valider la leçon ${next}</button>
          </section>` : '<section class="card"><span class="ru" style="font-size:24px">Toutes les leçons sont validées.</span></section>'}
          <section class="card" style="gap:12px">
            <span class="eyebrow">Déjà avancé dans le livre ?</span>
            <label class="field">J’ai validé jusqu’à
              <select id="set-done">${options}</select></label>
            <button type="button" class="btn ghost" data-action="set-done">Mettre à jour ma progression</button>
          </section>
        </div>
        <section class="card wide" style="gap:12px">
          <h2 class="eyebrow">Les ${TOTAL} leçons du livre</h2>
          <div class="lessons">${tiles.join('')}</div>
        </section>
      </div>`;
  }

  function viewDictionary() {
    const done = getDone();
    const sel = ui.sel.filter((n) => n <= done);
    const avail = unlocked();
    const picked = avail.filter((w) => !sel.length || sel.indexOf(w.l) >= 0);
    const query = strip(ui.q).toLowerCase().trim();
    const words = picked.filter((w) => !query || strip(w.ru).toLowerCase().indexOf(query) >= 0 || w.fr.toLowerCase().indexOf(query) >= 0);
    const sorted = words.slice().sort(ui.sort === 'alpha' ? byKey : (a, b) => a.l - b.l || byKey(a, b));
    const groups = [];
    const index = {};
    sorted.forEach((w) => {
      const head = ui.sort === 'alpha' ? (sortKey(w)[0] || '').toUpperCase() : 'Урок ' + w.l;
      if (!index[head]) { index[head] = { head, items: [] }; groups.push(index[head]); }
      index[head].items.push(w);
    });
    let chips = `<button type="button" class="chip${sel.length ? '' : ' on'}" aria-pressed="${!sel.length}" data-action="sel-all">Toutes</button>`;
    for (let n = 1; n <= done; n++) {
      const on = sel.indexOf(n) >= 0;
      chips += `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-action="sel-toggle" data-value="${n}">L${n}</button>`;
    }
    const selLabel = sel.length ? (sel.length === 1 ? 'leçon ' : 'leçons ') + sel.slice().sort((a, b) => a - b).join(', ') : 'toutes les leçons validées';

    return `
      <header class="row" style="justify-content:space-between;align-items:flex-end">
        <div style="display:flex;flex-direction:column">
          <h1 class="page-title">Dictionnaire</h1>
          <span class="page-title-cur">Словарь</span>
        </div>
        <div class="card dark" style="min-width:260px;padding:14px 16px;gap:8px">
          <div class="row" style="justify-content:space-between"><b>${done ? 'Leçons 1 à ' + done + ' débloquées' : 'Aucune leçon validée'}</b><span class="muted">${avail.length} mots</span></div>
          <div class="progress"><div style="width:${Math.round((done / TOTAL) * 100)}%"></div></div>
        </div>
      </header>
      ${done ? `
      <div class="row">
        <label class="search">${icon('search', 20, 2)}<span class="sr-only">Rechercher un mot</span>
          <input type="search" id="dico-q" value="${esc(ui.q)}" placeholder="Chercher en russe ou en français" data-input="q"></label>
        ${seg('sort', [['alpha', 'А–Я'], ['lesson', 'Par leçon']], ui.sort, 'Classement')}
        ${modeSeg()}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span class="muted" style="font-size:13px">Leçons affichées · <b style="color:var(--ink)">${selLabel} · ${words.length} mots</b></span>
        <div class="chips scroll" role="group" aria-label="Filtrer par leçon">${chips}</div>
      </div>
      ${words.length ? '' : '<p class="muted">Aucun mot trouvé dans les leçons sélectionnées.</p>'}
      ${groups.map((g) => `<section style="display:flex;flex-direction:column;gap:10px"><h2 class="group-head">${g.head}</h2><div class="grid">${g.items.map(wordCard).join('')}</div></section>`).join('')}
      ` : '<p class="muted">Valide ta première leçon pour remplir ton dictionnaire.</p>'}
      ${done < TOTAL ? `<section class="lock">${icon('lock', 24)}<span style="flex:1 1 280px">Les mots des leçons ${done + 1} à ${TOTAL} sont masqués. Ils apparaîtront quand tu valideras ces leçons.</span><a class="btn ghost" href="#/valider">Valider la leçon ${done + 1}</a></section>` : ''}`;
  }

  function viewLesson(nParam) {
    const done = getDone();
    if (!done) return '<h1 class="page-title">Leçons</h1><p class="muted">Aucune leçon validée pour l’instant. <a href="#/valider">Valider la première leçon</a></p>';
    const n = Math.min(Math.max(1, nParam || done), done);
    const all = D.words.filter((w) => w.l === n).sort(byKey);
    const words = all.filter((w) => ui.filter === 'all' || tag(w.t)[1] === ui.filter);
    const filters = [['all', 'Tous'], ['n', 'Noms'], ['v', 'Verbes'], ['e', 'Expressions'], ['o', 'Autres']];
    return `
      <header class="row" style="gap:16px">
        <a class="icon-btn" href="#/lecon/${n - 1}" aria-label="Leçon précédente" ${n <= 1 ? 'style="opacity:.35;pointer-events:none"' : ''}>${icon('left', 22, 2)}</a>
        <div class="row" style="align-items:baseline;gap:16px"><h1 class="page-title">Урок ${n}</h1><span class="page-title-cur" style="font-size:34px">Урок ${n}</span></div>
        <a class="icon-btn" href="#/lecon/${n + 1}" aria-label="Leçon suivante" ${n >= done ? 'style="opacity:.35;pointer-events:none"' : ''}>${icon('right', 22, 2)}</a>
        <span class="muted">${all.length} mots · ${plural(all.filter((w) => w.t === 'v').length, 'verbe', 'verbes')}</span>
      </header>
      <div class="row">
        ${modeSeg()}
        <div class="chips">${filters.map(([id, l]) => `<button type="button" class="chip${ui.filter === id ? ' on' : ''}" aria-pressed="${ui.filter === id}" data-action="filter" data-value="${id}">${l}</button>`).join('')}</div>
      </div>
      ${words.length ? `<div class="grid">${words.map(wordCard).join('')}</div>` : '<p class="muted">Aucun mot de ce type dans cette leçon.</p>'}`;
  }

  function viewVerb(keyParam) {
    const list = unlocked().filter((w) => w.t === 'v').sort(byKey);
    if (!list.length) return '<h1 class="page-title">Verbes</h1><p class="muted">Aucun verbe débloqué pour l’instant.</p>';
    const keys = list.map((w) => strip(w.ru));
    const key = keys.indexOf(keyParam) >= 0 ? keyParam : keys[0];
    const w = list[keys.indexOf(key)];
    const v = D.verbs[key];
    const tl = tensesOf(v);
    const t = tl.some((x) => x[0] === ui.tense) ? ui.tense : 'pres';
    const rows = conj(key, v, t);
    const query = strip(ui.verbQ).toLowerCase().trim();
    const items = list.filter((x) => !query || strip(x.ru).indexOf(query) >= 0 || x.fr.toLowerCase().indexOf(query) >= 0);
    return `
      <header style="display:flex;flex-direction:column">
        <h1 class="page-title">Verbes</h1>
        <span class="muted">${list.length} verbes débloqués dans les leçons 1 à ${getDone()}</span>
      </header>
      <div class="split">
        <aside class="card side" style="gap:10px">
          <label class="search" style="flex:none">${icon('search', 18, 2)}<span class="sr-only">Rechercher un verbe</span>
            <input type="search" id="verb-q" value="${esc(ui.verbQ)}" placeholder="Chercher un verbe" data-input="verbQ"></label>
          <div class="verb-list">${items.map((x) => {
            const k = strip(x.ru);
            return `<a class="verb-item${k === key ? ' on' : ''}" href="#/verbe/${encodeURIComponent(k)}"><span class="ru" style="font-size:16px">${esc(k)}</span><small>${esc(x.fr)}</small></a>`;
          }).join('') || '<span class="muted">Aucun verbe trouvé.</span>'}</div>
        </aside>
        <section class="wide" style="display:flex;flex-direction:column;gap:18px">
          <div class="card">
            <div class="row" style="align-items:baseline;gap:24px"><span class="ru" style="font-size:44px">${esc(w.ru)}</span><span class="cur" style="font-size:48px">${esc(key)}</span></div>
            <span style="font-size:19px">${esc(w.fr)}</span>
            <div class="row" style="gap:6px;margin-top:8px">
              <span class="badge v">${v.a === 'pf' ? 'Perfectif' : 'Imperfectif'}</span>
              <span class="badge n">${groupLabel(v).replace(/^./, (c) => c.toUpperCase())}</span>
              ${v.pair ? `<span class="badge">${v.a === 'pf' ? 'Imperfectif' : 'Perfectif'} : ${esc(v.pair)}</span>` : ''}
              <a class="badge" href="#/lecon/${w.l}" style="text-decoration:none">Leçon ${w.l}</a>
            </div>
          </div>
          <div style="max-width:520px">${seg('tense', tl, t, 'Temps')}</div>
          <div class="split" style="gap:18px">
            <div class="conj-table wide" style="flex:2 1 360px">
              ${rows.length ? rows.map((r) => `<div class="conj-row"><span class="muted">${r.p}</span><span class="f">${esc(r.stem)}<span class="end">${esc(r.end)}</span>${esc(r.rest)}</span><span class="cur">${esc(r.stem + r.end + r.rest)}</span></div>`).join('') : '<p class="muted">Pas d’impératif pour ce verbe.</p>'}
            </div>
            <div class="rule"><span class="eyebrow" style="color:inherit;font-weight:700">Règle</span><span>${ruleFor(v, t)}</span>${v.note ? `<span class="note">${esc(v.note)}</span>` : ''}</div>
          </div>
        </section>
      </div>`;
  }

  // Règles de grammaire : exemples provisoires, à remplacer par celles du livre.
  const RULES = [
    { title: 'Les 6 cas — singulier', c: 'decl', lesson: 3 },
    { title: 'Accusatif des noms animés', c: 'decl', lesson: 3 },
    { title: '1re conjugaison : -ешь / -ут', c: 'conj', lesson: 1 },
    { title: '2e conjugaison : -ишь / -ат, -ят', c: 'conj', lesson: 1 },
    { title: 'Pluriels irréguliers : друг → друзья́', c: 'exc', lesson: 1 },
    { title: 'Règle des 7 lettres (и / ы)', c: 'orth', lesson: 2 }
  ];
  const CATS = [['all', 'Toutes'], ['decl', 'Déclinaisons'], ['conj', 'Conjugaisons'], ['exc', 'Exceptions'], ['orth', 'Orthographe']];
  const CASES = [
    ['Nominatif', 'кто? что?', 'стол', '', 'книг', 'а', 'окн', 'о'],
    ['Génitif', 'кого? чего?', 'стол', 'а', 'книг', 'и', 'окн', 'а'],
    ['Datif', 'кому? чему?', 'стол', 'у', 'книг', 'е', 'окн', 'у'],
    ['Accusatif', 'кого? что?', 'стол', '', 'книг', 'у', 'окн', 'о'],
    ['Instrumental', 'кем? чем?', 'стол', 'ом', 'книг', 'ой', 'окн', 'ом'],
    ['Prépositionnel', 'о ком? о чём?', 'о стол', 'е', 'о книг', 'е', 'об окн', 'е']
  ];

  function viewGrammar() {
    const label = Object.fromEntries(CATS);
    const rules = RULES.filter((r) => ui.cat === 'all' || r.c === ui.cat);
    return `
      <header class="row" style="justify-content:space-between;align-items:flex-end">
        <div style="display:flex;flex-direction:column"><h1 class="page-title">Grammaire</h1><span class="page-title-cur">Грамматика</span></div>
      </header>
      <div class="split">
        <aside class="side" style="display:flex;flex-direction:column;gap:12px">
          <div class="chips">${CATS.map(([id, l]) => `<button type="button" class="chip${ui.cat === id ? ' on' : ''}" aria-pressed="${ui.cat === id}" data-action="cat" data-value="${id}">${l}</button>`).join('')}</div>
          ${rules.map((r) => `<div class="rule-item"><div style="display:flex;flex-direction:column;gap:3px"><b>${esc(r.title)}</b><span class="muted" style="font-size:13px">${label[r.c]} · Урок ${r.lesson}</span></div><span class="muted">›</span></div>`).join('')}
        </aside>
        <section class="wide" style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="gap:12px">
            <span class="eyebrow">Déclinaisons · Урок 3</span>
            <h2 class="ru" style="font-size:24px">Les 6 cas — singulier</h2>
            <div style="overflow-x:auto"><table>
              <thead><tr><th>Cas</th><th>Question</th><th>Masculin</th><th>Féminin</th><th>Neutre</th></tr></thead>
              <tbody>${CASES.map((c) => `<tr><td><b>${c[0]}</b></td><td class="ru-cell muted">${c[1]}</td><td class="ru-cell">${c[2]}<span class="end">${c[3]}</span></td><td class="ru-cell">${c[4]}<span class="end">${c[5]}</span></td><td class="ru-cell">${c[6]}<span class="end">${c[7]}</span></td></tr>`).join('')}</tbody>
            </table></div>
          </div>
          <div class="exception">
            <span class="eyebrow" style="color:inherit;font-weight:700">Exception · Orthographe</span>
            <b style="font-size:18px">Règle des 7 lettres</b>
            <span>Après г, к, х, ж, ш, щ, ч on écrit toujours <b>и</b>, jamais <b>ы</b>.</span>
            <div class="row" style="align-items:baseline;gap:16px"><span class="ru" style="font-weight:400;font-size:19px">кни́ги</span><span class="cur" style="font-size:26px">книги</span><span>(et non «книгы»)</span></div>
          </div>
        </section>
      </div>`;
  }

  // ---------- Routage et rendu ----------
  const NAV = [
    ['#/', 'home', 'Accueil'],
    ['#/dico', 'dico', 'Dictionnaire'],
    ['#/lecon', 'lesson', 'Leçons'],
    ['#/verbe', 'verb', 'Verbes'],
    ['#/grammaire', 'grammar', 'Grammaire']
  ];

  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent);
    switch (parts[0]) {
      case 'dico': return { id: 'dico', html: viewDictionary() };
      case 'lecon': return { id: 'lesson', html: viewLesson(parseInt(parts[1], 10)) };
      case 'verbe': return { id: 'verb', html: viewVerb(parts[1] || '') };
      case 'grammaire': return { id: 'grammar', html: viewGrammar() };
      case 'valider': return { id: 'validate', html: viewValidate() };
      default: return { id: 'home', html: viewHome() };
    }
  }

  function render() {
    // Conserve le focus et le curseur d'un champ de recherche pendant la frappe
    const active = document.activeElement;
    const focusId = active && active.id ? active.id : null;
    const caret = focusId && active.selectionStart != null ? active.selectionStart : null;

    const r = route();
    const side = NAV.map(([href, id, label]) => `<a class="side-link${r.id === id ? ' active' : ''}" href="${href}">${icon(id)}${label}</a>`).join('');
    const tabs = [['#/', 'home', 'Accueil'], ['#/dico', 'dico', 'Dico']]
      .map(([href, id, label]) => `<a class="tab${r.id === id ? ' active' : ''}" href="${href}">${icon(id, 24)}${label}</a>`).join('') +
      `<a class="tab-plus" href="#/valider" aria-label="Valider une leçon">${icon('plus', 24, 2.2)}</a>` +
      [['#/verbe', 'verb', 'Verbes'], ['#/grammaire', 'grammar', 'Grammaire']]
        .map(([href, id, label]) => `<a class="tab${r.id === id ? ' active' : ''}" href="${href}">${icon(id, 24)}${label}</a>`).join('');

    app.innerHTML = `<div class="shell">
      <nav class="sidebar" aria-label="Navigation principale">
        <div class="brand"><b>Русский</b><span>мой словарь</span></div>
        ${side}
        <a class="btn side-cta" href="#/valider">${icon('check', 18, 2.2)}Valider une leçon</a>
      </nav>
      <main class="main"><div class="content">${r.html}</div></main>
      <nav class="tabbar" aria-label="Navigation">${tabs}</nav>
    </div>`;

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret); }
    }
  }

  // ---------- Événements ----------
  app.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    const val = btn.dataset.value;
    switch (a) {
      case 'mode': ui.mode = val; break;
      case 'sort': ui.sort = val; break;
      case 'filter': ui.filter = val; break;
      case 'tense': ui.tense = val; break;
      case 'cat': ui.cat = val; break;
      case 'toggle-verb': ui.open = ui.open === val ? '' : val; break;
      case 'sel-all': ui.sel = []; ui.open = ''; break;
      case 'sel-toggle': {
        const n = parseInt(val, 10);
        ui.sel = ui.sel.indexOf(n) >= 0 ? ui.sel.filter((x) => x !== n) : ui.sel.concat([n]);
        ui.open = '';
        break;
      }
      case 'validate': {
        const date = document.getElementById('lesson-date');
        if (date) ui.lessonDate = date.value;
        setDone(getDone() + 1);
        ui.sel = [];
        location.hash = '#/dico';
        return;
      }
      case 'set-done': {
        const s = document.getElementById('set-done');
        setDone(parseInt(s.value, 10));
        break;
      }
      default: return;
    }
    render();
  });

  app.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.input;
    if (!key) return;
    ui[key] = e.target.value;
    render();
  });

  window.addEventListener('hashchange', () => { ui.open = ''; render(); window.scrollTo(0, 0); });
  render();
})();
