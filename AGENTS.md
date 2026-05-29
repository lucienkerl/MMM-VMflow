# AGENTS.md — MMM-VMflow

Guidance for AI agents (and humans) working in this repository. Tool-neutral; Claude Code
reads it via [`CLAUDE.md`](CLAUDE.md).

## What this is

`MMM-VMflow` is a standalone [MagicMirror²](https://docs.magicmirror.builders/) module that
displays vending-machine data from a self-hosted **VMflow** backend (the `mdb-esp32-cashless`
project) on a smart mirror: revenue KPIs, a live sales feed, and refill status/products, in
**7 configurable layouts** (`combo` default, `kpi`, `feed`, `refillStatus`, `refillProducts`,
`fleet`, `ticker`).

It is **read-only** and talks only to the backend's public **`/api/v1/`** REST API using an
`X-API-Key`. There is no write path, no MQTT, no device control.

## Architecture — "thin module, fat node_helper"

```
Pi (Node, server side)                      Browser (mirror)
node_helper.js ──VMFLOW_DATA──▶ MMM-VMflow.js ──▶ renderers/<layout>.js
  ├ lib/fetch-all.js  (the 6 /api/v1 resources)
  ├ lib/api-client.js (paginated GET + 401/429/network mapping)
  └ lib/compute.js    (PURE: KPIs, trends, stock health, view model)
        │ X-API-Key (secret — stays here, never sent to the browser)
        ▼  /api/v1/{machines,devices,sales,trays,stock-batches,products}
```

- **`lib/compute.js`** — pure, dependency-free, side-effect-free `(raw, config, now) → viewModel`.
  All numeric/stock logic lives here and is unit-tested. This is the heart of the module.
- **`node_helper.js`** — holds the API key, polls per backend (`baseUrl|apiKey`), dedups across
  instances, caches the last good payload, backs off on `429`, emits `VMFLOW_DATA`/`VMFLOW_ERROR`.
- **`MMM-VMflow.js`** — browser module shell: config, sockets, `getDom` dispatch to a renderer,
  loading/error/setup states.
- **`renderers/`** — one `(viewModel, ctx) => HTMLElement` function per layout, registered on
  `window.VMflowRenderers`, using only the helpers in `renderers/_shared.js`. `_shared.js` also
  holds `productRow`, `periodBlock`, `statusDot`, `fillBar`, `kpiTrend`, `timeAgo`, `fmtCurrency`.

## Hard rules

- **Zero runtime dependencies. No build step.** Plain JS, Node ≥18 (built-in `fetch`). Do not add
  `dependencies` to `package.json` and do not introduce a bundler/transpiler.
- **The API key never reaches the browser.** Only `node_helper` sees it; the browser receives the
  computed view model. Never put the key in a socket payload or in rendered DOM.
- **No hard-coded user-facing strings.** Every visible label goes through `ctx.t(KEY)` (→
  `this.translate`). When you add a string, add the key to **both** `translations/en.json` and
  `translations/de.json` (same key set in both — keep them in parity). Only language-neutral
  symbols (▲ ▼ ⇄ × 🏆 ⚠) may be inline.
- **DOM is built with `textContent`/`createElement` only** (via `_shared.el`). Never `innerHTML`
  — product/machine names are user data.
- **Don't change the view-model shape** without updating, together: `lib/compute.js`,
  every affected renderer, `preview/sample-data.js`, and the tests.

## Fidelity to the VMflow frontend (important)

`lib/compute.js` is a deliberate, faithful port of the management-frontend's logic. If you change
KPI or stock logic, re-verify against these source files in the parent project
(`management-frontend/app/`):

- **KPI windows** (`pages/index.vue` `loadDashboard`): today/yesterday = local calendar day;
  `week`/`lastWeek` = rolling 7d/14d; `month`/`lastMonth` = calendar month. Revenue = Σ `item_price`.
- **Trend %** (`components/SectionCards.vue` `pctChange`): `prev===0 ? (cur>0?100:null) : round((cur-prev)/prev*100)`.
- **Stock health & refill summaries** (`composables/useMachines.ts`, `lib/stock-health.ts`):
  `isEmpty`/`isLow`/`isFillBelow`, per-product deficit aggregation, pass-2 fill, severity
  `critical|low|fill`, warehouse-availability split, sort by deficit desc.

Known invariants (don't regress):

- `sales.item_price` is **EUR**, never divide by 100.
- The product sell-price column is **`sellprice`** (not `price`).
- `online = !!status && status !== 'offline'`.
- No-warehouse backward-compat: if there are no stock batches at all, every product counts as
  refillable.
- `refillProducts` reproduces the `/machines` page colors exactly: in-stock name = severity color
  (red `#ef4444` / amber `#f59e0b` / blue `#60a5fa`); swap (no-stock + critical) = orange `#fb923c`
  with `⇄`; dimmed no-stock (low/fill) = **neutral** name + row opacity. Tokens live in
  `MMM-VMflow.css` (`--vmf-*`).

## Bilingual

- **UI** follows the mirror's **global** `config.language` (`"de"`/`"en"`; `en` fallback) via
  MagicMirror i18n — no per-module setting. Currency/number locale follows `config.locale` then
  `config.language` (`MMM-VMflow.js` `ctx()`), consistent with the labels.
- **Docs** are bilingual: [`README.md`](README.md) (English, `screenshots/en/`) and
  [`README.de.md`](README.de.md) (German, `screenshots/de/`). Keep both in parity when editing.

## Testing

```bash
node --test        # or: npm test  — 13 tests across compute / api-client / fetch-all
node --check <file> # syntax-check browser files (renderers, module, node_helper) — they are
                    # not runnable in Node (they need window/MagicMirror globals)
```

- `lib/compute.js` and `lib/api-client.js` are unit-tested with the built-in `node:test`.
  **Use TDD** for new compute logic: add a failing test in `test/compute.test.js` first.
- The browser pieces (renderers, module, CSS) are verified visually via the preview harness
  (below), not via Node tests.

## Preview & screenshots

`preview/preview.html` renders any layout with no MagicMirror and no backend, using the frozen
`preview/sample-data.js` (which must match the real view-model shape). Open in a browser:

```
preview/preview.html?layout=combo&lang=de        # nav bar for switching layouts/lang
preview/preview.html?layout=combo&lang=en&shot=1 # screenshot mode (nav hidden)
```

To regenerate the README screenshots (both languages → `screenshots/en/` and `screenshots/de/`),
render each layout at a fixed width on a black background. Headless Chrome works, e.g.:

```bash
"<chrome>" --headless=new --no-first-run --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --default-background-color=000000ff \
  --window-size=420,380 --screenshot=screenshots/en/combo.png \
  "file://$PWD/preview/preview.html?layout=combo&lang=en&shot=1"
```

Heights are per-layout (combo ~380, kpi ~350, feed ~260, refillStatus ~210, refillProducts ~360,
fleet ~200, ticker ~110). Keep `en/` and `de/` in sync, and update the README image references.

## Config options

`baseUrl`, `apiKey`, `layout`, `machineIds` (`[]` = all), `updateInterval` (ms, floored to 15000),
`showImages`, `maxFeedItems`, `timezone` (IANA, null = host local), `header`. See
[`config.sample.js`](config.sample.js) and the README options table (keep them in sync with the
`defaults` block in `MMM-VMflow.js`).

## Origin docs

This module was designed and planned in the parent project under
`docs/superpowers/specs/2026-05-29-magicmirror-vmflow-module-design.md` and
`docs/superpowers/plans/2026-05-29-mmm-vmflow-magicmirror-module.md` (in the `mdb-esp32-cashless`
repo, if available alongside this one).
