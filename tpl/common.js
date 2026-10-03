loadDict() {
fetch('/_blob/20a388f53ee5cb9a1808aff46657be5e').then((r) => r.json()).then((d) => this.setState({ data: d })).catch(() => this.setState({ failed: true }));
}
strip(s) {
return s.replace(/́/g, '');
}
sortKey(w) {
return this.strip(w.ru).toLowerCase().replace(/^\(к\)\s*/, '').replace(/^[^а-яё]+/, '');
}
tag(t) {
const m = { nm: ['nom m.', 'n'], nf: ['nom f.', 'n'], nn: ['nom n.', 'n'], npl: ['nom pl.', 'n'], v: ['verbe', 'v'], adj: ['adjectif', 'o'], adv: ['adverbe', 'o'], pron: ['pronom', 'o'], prep: ['préposition', 'o'], conj: ['conjonction', 'o'], num: ['nombre', 'o'], part: ['particule', 'o'], expr: ['expression', 'e'] };
const s = { n: 'background: #E4E9F7; color: #1C3488', v: 'background: #FBE6E4; color: #8E2019', e: 'background: #E3F1EC; color: #1B5E4C', o: 'background: #EEEFF3; color: #3A4056' };
const x = m[t] || ['', 'o'];
return { label: x[0], style: s[x[1]], kind: x[1] };
}
split(forms) {
const real = forms.filter((f) => f && f !== '—');
let p = real[0] || '';
real.forEach((f) => { while (p && f.indexOf(p) !== 0) p = p.slice(0, -1); });
return forms.map((f) => (f === '—' ? { stem: '—', end: '', full: '—' } : { stem: f.slice(0, p.length), end: f.slice(p.length), full: f }));
}
conj(v, tense, inf) {
const P = { pres: ['я', 'ты', 'он / она', 'мы', 'вы', 'они'], fut: ['я', 'ты', 'он / она', 'мы', 'вы', 'они'], past: ['он', 'она', 'оно', 'они'], imp: ['ты', 'вы'] };
if (tense === 'fut') {
const b = ['буду', 'будешь', 'будет', 'будем', 'будете', 'будут'];
return this.split(b).map((f, i) => ({ p: P.fut[i], stem: f.stem, end: f.end, rest: ' ' + inf, cur: f.full + ' ' + inf }));
}
const forms = tense === 'pres' ? v.pres : tense === 'past' ? v.past : v.imp;
return this.split(forms).map((f, i) => ({ p: P[tense][i], stem: f.stem, end: f.end, rest: '', cur: f.full }));
}
verbInfo(v) {
if (!v) return '';
const g = v.g === 'irr' ? 'irrégulier' : v.g === '1' ? '1re conjugaison' : '2e conjugaison';
return (v.a === 'pf' ? 'Perfectif' : 'Imperfectif') + ' · ' + g + (v.pair ? ' · ' + (v.a === 'pf' ? 'imperf. : ' : 'perf. : ') + v.pair : '');
}
item(w, data, open, mode) {
const key = this.strip(w.ru);
const t = this.tag(w.t);
const v = w.t === 'v' ? data.verbs[key] : null;
const isOpen = !!v && open === key;
return {
ru: w.ru, cur: key, fr: w.fr, l: w.l, tagLabel: t.label, tagStyle: t.style, kind: t.kind,
isVerb: !!v, isOpen, span: isOpen ? '1 / -1' : 'auto',
showPrint: mode !== 'cursive', showCursive: mode !== 'print',
toggle: () => this.setState({ open: isOpen ? '' : key }),
toggleLabel: isOpen ? 'Masquer la conjugaison' : 'Voir la conjugaison',
info: this.verbInfo(v),
presLabel: v && v.a === 'pf' ? 'Futur' : 'Présent',
pres: isOpen ? this.conj(v, 'pres') : [],
past: isOpen ? this.conj(v, 'past') : [],
note: v ? v.note : ''
};
}
seg(list, cur, key) {
const on = 'background: #FFFFFF; color: #161B2E; box-shadow: 0 1px 2px rgba(22,27,46,0.12)';
const off = 'background: transparent; color: #5A6074';
return list.map(([id, label]) => ({ label, style: id === cur ? on : off, pick: () => this.setState({ [key]: id }) }));
}
chips(list, cur, key) {
return list.map(([id, label]) => ({
label,
style: id === cur ? 'background: #161B2E; color: #FFFFFF; border: 1px solid #161B2E' : 'background: #FFFFFF; color: #161B2E; border: 1px solid #D5D8E0',
pick: () => this.setState({ [key]: id })
}));
}
lessonChips(done, sel) {
const on = 'background: #161B2E; color: #FFFFFF; border: 1px solid #161B2E';
const off = 'background: #FFFFFF; color: #161B2E; border: 1px solid #D5D8E0';
const chips = [{ label: 'Toutes', on: !sel.length, style: !sel.length ? on : off, pick: () => this.setState({ sel: [], open: '' }) }];
for (let n = 1; n <= done; n++) {
const isOn = sel.indexOf(n) >= 0;
chips.push({ label: 'L' + n, on: isOn, style: isOn ? on : off, pick: () => this.setState({ sel: isOn ? sel.filter((x) => x !== n) : sel.concat([n]), open: '' }) });
}
return chips;
}
