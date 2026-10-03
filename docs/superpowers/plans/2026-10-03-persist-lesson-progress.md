# Persist Lesson Progress Server-Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move lesson-validation progress (`lessonsDone` 0–28, plus a date per validated lesson) out of `localStorage` and into a small server-side store, so it's identical on every device/browser the user opens the app from.

**Architecture:** One new Vercel serverless function (`api/progress.js`) backed by a single Upstash Redis key, called via plain `fetch` (no SDK). `web/app.js` fetches that state once on boot instead of reading `localStorage`, and writes to it on every "Valider"/"Mettre à jour ma progression" action instead of writing to `localStorage`.

**Tech Stack:** Vanilla JS (no change), Vercel Node.js Serverless Function (CommonJS — no `package.json` exists, so Node defaults to CommonJS `module.exports`), Upstash Redis REST API.

**Spec:** `docs/superpowers/specs/2026-10-03-persist-lesson-progress-design.md`

## Global Constraints

- No new npm dependency, no `package.json`, no build step — call Upstash's REST API with native `fetch`, matching the spec's "stays as dependency-free as today" requirement.
- `api/progress.js` performs no authentication/authorization of its own — access control is entirely delegated to Vercel Deployment Protection, already covering the whole production domain (set up separately). Do not add any auth code here.
- `lessonsDone` is always clamped to the integer range 0–28, both on read and on write (same invariant the old `localStorage` code enforced).
- The `date` field is stored as free text exactly as typed — no format parsing or validation beyond "is it a non-empty string."
- This repo has no automated test runner (pure static site, manually verified throughout its history — see `CLAUDE.md`). Introducing one now would be disproportionate for a single-user hobby app and was not asked for. "Testing" in this plan means: deploy, then verify live behavior directly (browser requests, browser devtools console, the Upstash Data Browser) — that is this project's established verification method, and matches the user's own "I cannot validate until I see it in prod."
- Every commit message ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer (standing repo convention this session).

---

## Task 1: Provision the Upstash Redis store (user, dashboard — no code)

**Files:** none.

**Interfaces:**
- Produces: two environment variables available to all Vercel Functions in this project, one of these two pairs (Vercel's Upstash integration has used different naming across versions, so Task 2's code checks both): `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Step 1: Create the store**

In the Vercel dashboard: `russe-app` project → **Storage** tab → **Marketplace** → **Upstash** → create a Redis database → **Connect** it to the `russe-app` project (all environments: Production, Preview, Development).

- [ ] **Step 2: Confirm the env vars landed**

Project → **Settings → Environment Variables**. Confirm a URL/token pair exists (either naming from above). No need to copy the values anywhere — Task 2's code reads them from `process.env` at runtime.

---

## Task 2: `api/progress.js` — the persistence endpoint

**Files:**
- Create: `api/progress.js`

**Interfaces:**
- Produces (consumed by Task 3's `web/app.js`):
  - `GET /api/progress` → `200 { lessonsDone: number, dates: { [lessonNumber: string]: string } }`
  - `POST /api/progress` body `{ lessonsDone: number, date?: string }` → `200` with the same shape as GET (the full saved document), or `400 { error: string }` if `lessonsDone` isn't an integer 0–28.
  - Any other method → `405 { error: string }`. Upstash unreachable or misconfigured → `500 { error: string }`.

- [ ] **Step 1: Write the function**

```js
// api/progress.js
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'russe:state';
const TOTAL = 28;

function clamp(n) {
  const i = parseInt(n, 10);
  return Number.isFinite(i) ? Math.min(TOTAL, Math.max(0, i)) : 0;
}

async function upstashGet(key) {
  const res = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REST_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Upstash GET ${res.status}`);
  const body = await res.json();
  return body.result; // string | null
}

async function upstashSet(key, value) {
  const res = await fetch(`${REST_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    body: value
  });
  if (!res.ok) throw new Error(`Upstash SET ${res.status}`);
}

async function readState() {
  const raw = await upstashGet(KEY);
  if (!raw) return { lessonsDone: 0, dates: {} };
  try {
    const parsed = JSON.parse(raw);
    return {
      lessonsDone: clamp(parsed.lessonsDone),
      dates: parsed.dates && typeof parsed.dates === 'object' ? parsed.dates : {}
    };
  } catch (e) {
    return { lessonsDone: 0, dates: {} };
  }
}

module.exports = async function handler(req, res) {
  if (!REST_URL || !REST_TOKEN) {
    res.status(500).json({ error: 'Upstash not configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readState());
      return;
    }
    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const lessonsDone = parseInt(body.lessonsDone, 10);
      if (!Number.isFinite(lessonsDone) || lessonsDone < 0 || lessonsDone > TOTAL) {
        res.status(400).json({ error: 'lessonsDone must be an integer 0-28' });
        return;
      }
      const current = await readState();
      let dates = current.dates;
      if (typeof body.date === 'string' && body.date.trim()) {
        dates = { ...current.dates, [String(lessonsDone)]: body.date };
      }
      const next = { lessonsDone, dates };
      await upstashSet(KEY, JSON.stringify(next));
      res.status(200).json(next);
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Internal error' });
  }
};
```

- [ ] **Step 2: Commit and push**

```bash
git add api/progress.js
git commit -m "Add api/progress.js for server-side lesson progress

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

This triggers a production deployment via the existing GitHub→Vercel auto-deploy. `web/app.js` doesn't call this endpoint yet (that's Task 3), so this ships safely on its own — the app keeps working exactly as before in the meantime.

- [ ] **Step 3: Verify live, standalone, before wiring up the frontend**

Wait for the deployment to finish (Vercel dashboard → Deployments → latest → Ready). Then, **in your own browser** (it already passes Vercel Authentication):

1. Visit `https://russe-app-eight.vercel.app/api/progress` directly — a GET renders in the tab. Expect: `{"lessonsDone":0,"dates":{}}`.
2. Open devtools console on that same tab and run:
   ```js
   fetch('/api/progress', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ lessonsDone: 2, date: 'test-02/10/2026' })
   }).then(r => r.json()).then(console.log)
   ```
   Expect: `{lessonsDone: 2, dates: {2: "test-02/10/2026"}}`.
3. Reload step 1's URL — expect it now shows `lessonsDone: 2` (proves it's actually persisted in Upstash, not just echoed back).
4. Reset it back to zero so Task 3's end-to-end check starts clean:
   ```js
   fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonsDone: 0 }) })
   ```

If step 1 instead shows a Vercel login/SSO page: Deployment Protection is blocking even your own authenticated session unexpectedly — stop and resolve that first (not an `api/progress.js` bug). If step 1 shows `{"error":"Upstash not configured"}`: Task 1's env vars aren't on the Production environment — recheck Task 1, Step 2, then redeploy (Deployments → latest → Redeploy) and retry.

---

## Task 3: Wire `web/app.js` to the new endpoint

**Files:**
- Modify: `web/app.js:10-28` (remove `STORE_KEY`/`memDone`/`getDone`/`setDone`, add server-backed state)
- Modify: `web/app.js:217-257` (`viewValidate` — add date subtitle to validated tiles)
- Modify: `web/app.js:479-525` (click handler + final boot call)

**Interfaces:**
- Consumes: `GET /api/progress` and `POST /api/progress` from Task 2, exact shapes as documented there.
- Produces: `getDone()` keeps the same name/signature (`() => number`) so every existing view function (`viewHome`, `viewDictionary`, `viewLesson`, `viewVerb`, `viewValidate`) needs no changes beyond `viewValidate`'s tile subtitle. `setDone` changes signature from `setDone(n)` to `async setDone(n, date)` — only the two call sites touched in this task call it.

- [ ] **Step 1: Replace the localStorage progression block**

In `web/app.js`, replace (lines 10–28):

```js
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
```

with:

```js
  const D = window.DICT;
  const TOTAL = 28;
  const app = document.getElementById('app');

  // ---------- Progression (persisted server-side via /api/progress, not localStorage) ----------
  const state = { done: null, dates: {}, loading: true, error: null };
  const getDone = () => state.done || 0;

  async function loadProgress() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const res = await fetch('/api/progress');
      if (!res.ok) throw new Error('load failed');
      const body = await res.json();
      state.done = body.lessonsDone;
      state.dates = body.dates || {};
      state.loading = false;
    } catch (e) {
      state.loading = false;
      state.error = 'load';
    }
    render();
  }

  async function setDone(n, date) {
    const payload = { lessonsDone: Math.min(TOTAL, Math.max(0, n)) };
    if (date) payload.date = date;
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('save failed');
    const body = await res.json();
    state.done = body.lessonsDone;
    state.dates = body.dates || {};
  }
```

- [ ] **Step 2: Add the loading/error branches to `render()`**

In `render()` (the function containing `const r = route();`), add this immediately after the existing `const caret = ...` line and before `const r = route();`:

```js
    if (state.loading) {
      app.innerHTML = `<div class="shell" style="align-items:center;justify-content:center"><p class="muted">Chargement…</p></div>`;
      return;
    }
    if (state.error === 'load') {
      app.innerHTML = `<div class="shell" style="align-items:center;justify-content:center;flex-direction:column;gap:16px">
        <p class="muted">Impossible de charger ta progression.</p>
        <button type="button" class="btn" data-action="retry-load">Réessayer</button>
      </div>`;
      return;
    }
```

- [ ] **Step 3: Replace the `validate`/`set-done` cases and add `retry-load`**

In the click handler's `switch (a)`, replace:

```js
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
```

with:

```js
      case 'retry-load': loadProgress(); return;
      case 'validate': {
        const date = document.getElementById('lesson-date');
        if (date) ui.lessonDate = date.value;
        saveProgress(btn, getDone() + 1, ui.lessonDate, () => { ui.sel = []; location.hash = '#/dico'; });
        return;
      }
      case 'set-done': {
        const s = document.getElementById('set-done');
        saveProgress(btn, parseInt(s.value, 10), null, null);
        return;
      }
```

Then, right after the closing of the `app.addEventListener('click', ...)` block, add the helper it calls:

```js
  async function saveProgress(btn, n, date, onDone) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    ui.saveError = '';
    try {
      await setDone(n, date);
      if (onDone) onDone();
      render();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = original;
      ui.saveError = 'Échec de l’enregistrement, réessaie.';
      render();
    }
  }
```

(`ui.saveError` is a new field on the existing `ui` object — no declaration needed beyond using it, consistent with the other `ui.*` fields already used this way.)

- [ ] **Step 4: Show the save error and the per-lesson date in `viewValidate()`**

In `viewValidate()`, right after the opening `<header>...</header>` block's closing `</header>`, add:

```js
      ${ui.saveError ? `<p class="muted" style="color:var(--accent-dark)">${esc(ui.saveError)}</p>` : ''}
```

Then in the tile-building loop, replace:

```js
      const sub = n <= done ? count(n) + ' mots' : n === next ? 'À valider' : 'Verrouillée';
```

with:

```js
      const sub = n <= done
        ? count(n) + ' mots' + (state.dates[n] ? ' · ' + esc(state.dates[n]) : '')
        : n === next ? 'À valider' : 'Verrouillée';
```

- [ ] **Step 5: Boot via `loadProgress()` instead of a bare `render()`**

At the very bottom of the file, replace:

```js
  window.addEventListener('hashchange', () => { ui.open = ''; render(); window.scrollTo(0, 0); });
  render();
})();
```

with:

```js
  window.addEventListener('hashchange', () => { ui.open = ''; render(); window.scrollTo(0, 0); });
  loadProgress();
})();
```

- [ ] **Step 6: Commit and push**

```bash
git add web/app.js
git commit -m "Persist lesson progress server-side instead of localStorage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 7: Verify end-to-end in production**

In your browser (already past Vercel Authentication), after the deployment is Ready:

1. Open `https://russe-app-eight.vercel.app` — briefly shows "Chargement…", then the home screen with 0 lessons validated (Task 2 Step 3.4 reset it).
2. Go to **Valider une leçon**, (optionally edit the date field), click **Valider la leçon 1**. The button should briefly read "Enregistrement…", then you land on **Dictionnaire** with lesson 1's words visible.
3. Go back to **Valider une leçon** — the lesson 1 tile should show its date next to the word count (e.g. "15 mots · 03/10/2026").
4. Reload the page fully (not just in-app navigation) — confirm lesson 1 is still unlocked and the date is still shown (proves it's reading from the server, not from in-memory state that a reload would have wiped).
5. Open the same URL in a second, different browser (or a private window, logged into the same Vercel account) — confirm it shows lesson 1 unlocked too, with no action taken there.
6. In the Vercel dashboard → Storage → the Upstash database → Data Browser, look up key `russe:state` and confirm its value matches what the app shows — independent proof this is really server-side, not an app-level illusion.

If step 2's button shows the inline error instead of succeeding: open devtools → Network tab, check the `/api/progress` POST response body for the actual error (most likely cause: Task 1's env vars missing on Production, or a typo carried over from Task 2).

---

## Task 4: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (the `## Données` section's "Progression" line, and the `## Structure` section)

- [ ] **Step 1: Update the docs**

Replace the existing line:
```
- Progression : `localStorage['russe.lessonsDone']` (nombre de leçons validées, 0–28). Seul ce compteur est persisté : la date saisie dans l'écran Valider (`ui.lessonDate`) n'est affichée que pour cette session et n'est jamais sauvegardée.
```
with:
```
- Progression : persistée côté serveur (`api/progress.js` + Upstash Redis, clé `russe:state` = `{lessonsDone, dates}`), pas en `localStorage` — identique sur tous les navigateurs/appareils de l'unique utilisateur. La date saisie dans l'écran Valider est envoyée et conservée par leçon (`dates[N]`), affichée en sous-titre sur la tuile de la leçon validée.
```

Add a new bullet under `## Structure` documenting the new file:
```
- `api/progress.js` : fonction serverless Vercel (Node.js, CommonJS, aucune dépendance npm) qui lit/écrit l'état de progression dans Upstash Redis via son API REST brute (pas de SDK). Aucune auth propre : protégée uniquement par Vercel Deployment Protection sur tout le déploiement.
```

- [ ] **Step 2: Commit and push**

```bash
git add CLAUDE.md
git commit -m "Document server-side progress persistence in CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

## Self-Review Notes

- **Spec coverage:** durable cross-device progress (Task 3), reload-is-enough sync (Task 3 Step 5, no polling added), date persisted per lesson + shown on tiles (Task 3 Steps 1/4), no auth code in the API (Task 2, Global Constraints), never showing unpersisted progress (Task 3's `saveProgress` only updates `state`/re-renders on success) — all covered.
- **Type consistency:** `getDone()` keeps its original `() => number` shape everywhere it's already called; only `setDone`'s signature changes, and both its call sites are updated in the same task. `state.dates` keys are plain object property access (`state.dates[n]`), which JS coerces from the lesson number to match the string keys the API returns — verified consistent between Task 2's `JSON.stringify` output and Task 3's read.
- **No placeholders:** every step above is real, complete code — nothing deferred to "later."
