# Persist lesson progress server-side

## Problem

Lesson-validation progress (`localStorage['russe.lessonsDone']`, an integer 0–28 that gates which words/lessons are unlocked) lives only in the browser's `localStorage`. It therefore does not survive across browsers, devices, or a cleared profile — confirmed by the user validating 2 lessons on one mobile browser and seeing 0 progress on desktop and on a second mobile browser, even while logged into the same (now Vercel-Authentication-gated) deployment.

The app has exactly one user. There is no multi-tenant concern — this is purely "give the single piece of state a durable home instead of the browser."

## Goals

- Lesson progress persists indefinitely, independent of device/browser, and is correct on every fresh page load ("I reopen in 3 months and I'm exactly where I left off").
- Validating a lesson on one device and then reloading the app on another device shows the update. Live cross-tab push (no reload) is explicitly **not required** — confirmed with the user.
- The `lessonsDone` counter (0–28) and the date entered for each validated lesson both move server-side. No other app behavior changes.
- No progress or date is ever shown in the UI that did not actually get persisted server-side (directly addresses the user's "make sure it registers in the database" concern).
- The date recorded per lesson is visible after the fact, not just while typing it — shown as a subtitle on each validated lesson's tile in the Valider screen (e.g. "Leçon 3 · 17/09/2026").

## Non-goals

- No real-time/live sync between simultaneously-open tabs or devices.
- No validation/editing of past dates after the fact (if a date was mistyped, re-validating isn't a flow this app supports today — out of scope here, same as before).
- No multi-user support, no login/identity concept inside the app itself. Access control is entirely delegated to Vercel Deployment Protection (Vercel Authentication), set up separately — this spec assumes that protection is (or will be) active on the production domain, and `api/progress.js` performs no auth of its own.
- No offline support beyond a clear error state; this is a personal study app, not a PWA.

## Architecture

```
Browser (web/app.js)
   │  GET/POST /api/progress   (same-origin; passes through Vercel Authentication
   │                             transparently since the page itself already required it)
   ▼
Vercel Serverless Function (api/progress.js, Node.js runtime)
   │  fetch() to Upstash REST API, Bearer-token auth via env vars
   ▼
Upstash Redis (provisioned via Vercel Storage → Marketplace)
   single key "russe:state" → JSON string
   {"lessonsDone": <int>, "dates": {"<lessonNumber>": "<date string>", ...}}
```

- `web/` remains a pure static deployment; `vercel.json` (`{"outputDirectory": "web"}`) is unchanged. Vercel detects `api/*.js` at the repo root as serverless functions independently of `outputDirectory`, so this works alongside the existing static config with no deployment-config changes.
- No new npm dependency, no `package.json`, no build step: Upstash's REST API is called with the platform's native `fetch`.
- Storing a JSON object (not a bare integer) under the one key costs nothing extra today and means any future persisted feature (e.g. saved grammar-rule edits, mentioned as a possible future feature in `CLAUDE.md`'s "À faire" list) is just another field in the same document, with no schema migration.

## Components

### 1. Upstash Redis store (provisioned by the user, one-time)
- Vercel dashboard → `russe-app` project → Storage tab → Marketplace → Upstash → create a Redis database, connect it to the project.
- This auto-injects REST URL + token env vars into the project (exact names surface once connected — read them off the dashboard's "Connect" step rather than assuming a name, since Vercel's Upstash integration has changed env var naming across versions).

### 2. `api/progress.js` (new file, repo root)
- `GET`: reads key `russe:state` via Upstash's REST `GET` command. If missing or unparseable, returns `{"lessonsDone": 0, "dates": {}}` (first-ever call, or defensive recovery from a corrupted value) rather than erroring. Otherwise returns the stored JSON, with `lessonsDone` re-clamped to the 0–28 range server-side (same guard `app.js` already applies client-side today) before returning.
- `POST`: body `{"lessonsDone": <int>, "date": <string>}`. Validates `lessonsDone` is an integer in 0–28 (reject anything else with 400); `date` is stored as-is (free text, same as the existing input — no format parsing/validation, matching today's behavior where it's just whatever the user typed). Merges `{"dates": {[lessonsDone]: date}}` into the existing document (read-modify-write) and writes it back via Upstash's REST `SET` command. Returns the full saved document.
- The "Mettre à jour ma progression" (`set-done`) action, which has no date field, posts `{"lessonsDone": <int>}` with no `date` — the handler leaves `dates` untouched in that case (bulk-setting progress shouldn't fabricate historical dates for lessons it didn't actually walk through one by one).
- No authentication/authorization code — relies entirely on Vercel Deployment Protection at the edge (see Non-goals).

### 3. `web/app.js` changes
- Remove `STORE_KEY`, `memDone`, and the `localStorage`-based `getDone()`/`setDone()` entirely.
- Add module-level state, e.g. `const state = { done: null, dates: {}, loading: true, error: null }`.
- Add `loadProgress()`: `fetch('/api/progress')` → on success, `state.done = body.lessonsDone; state.dates = body.dates; state.loading = false; render()`. On failure, `state.loading = false; state.error = 'load'; render()`.
- Replace the current unconditional `render()` call at the bottom of the IIFE with: show a minimal loading view while `state.loading`; show a full-page error view (message + Retry button that re-runs `loadProgress()`) when `state.error === 'load'`; otherwise render the app as today, with every former `getDone()` call site reading `state.done` directly.
- `setDone(n, date)` becomes async: disable/label the triggering control ("Enregistrement…"), `POST /api/progress` with `{lessonsDone: n, date}` (date omitted for the `set-done` bulk action). On success, update `state.done`/`state.dates` from the response and re-render normally. On failure, re-enable the control, show an inline error near it, and leave state unchanged. Both current call sites (`validate` and `set-done` actions in the click handler) go through this same path, the former passing `ui.lessonDate`, the latter not.
- `viewValidate()`'s lesson tiles (`n <= done`) grow a subtitle showing `state.dates[n]` when present, e.g. "Leçon 3 · 17/09/2026" under the existing "N mots" line.
- `hashchange` behavior is unchanged — no new fetch on in-app navigation, only on initial load, per the agreed "reload is enough" sync model.

## Data flow (happy path)

1. Page loads → loading view → `GET /api/progress` → `{"lessonsDone": 5, "dates": {"1": "03/09/2026", ..., "5": "24/09/2026"}}` → `state.done = 5`, `state.dates = {...}` → normal render, lessons 1–5 unlocked, each validated tile showing its date.
2. User types a date (or keeps the default) and clicks "Valider la leçon 6" → button shows "Enregistrement…" → `POST /api/progress {"lessonsDone": 6, "date": "01/10/2026"}` → 200 OK → `state.done = 6`, `state.dates["6"] = "01/10/2026"` → re-render, lesson 6 words now visible with its date.
3. Same user opens the app on a different device/browser → step 1 again → sees `lessonsDone: 6` and all six dates immediately, no action needed.

## Error handling

| Failure | Behavior |
|---|---|
| Initial `GET` fails (network/Upstash down) | Full-page "Impossible de charger ta progression" + Retry button. Never defaults silently to 0. |
| `POST` fails | Inline error next to the button that triggered it; control re-enabled; `state.done`/`state.dates` untouched; user can retry the same action. |
| Stored value missing/corrupted | `GET` handler treats it as `{"lessonsDone": 0, "dates": {}}` rather than erroring. |
| Value out of 0–28 range (shouldn't happen via normal use, defensive only) | Clamped server-side on both read and write. |

## Testing / verification

- Validate a lesson in one browser; open the deployment in a second browser profile (still behind Vercel Authentication, same account) and confirm the unlocked words appear without re-validating.
- Check the Upstash Data Browser in the Vercel dashboard to directly confirm the stored key/value, as independent proof persistence is server-side and not an app-level illusion.
- Temporarily point the function at an invalid token (or similar) to confirm the error UI appears instead of failing silently, then restore.
