# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

The full, canonical agent guidance for this module lives in **AGENTS.md** — read it first:

@AGENTS.md

## Claude-specific notes

- **Standalone repo.** `MMM-VMflow/` is its own git repository (it may sit inside the
  `mdb-esp32-cashless` workspace, but it is not tracked by it). Scope all `git` operations to
  this repo; never commit module files into a parent repo.
- **Verifying changes.** These are MagicMirror/browser files (they need `window` and MagicMirror
  globals), so they don't run under Node. Verify with `node --check <file>` for syntax,
  `node --test` for the `lib/` unit tests, and the `preview/preview.html` harness (see AGENTS.md)
  for anything visual — don't claim a renderer/CSS change works without looking at the preview.
- **TDD for `lib/compute.js`.** Add the failing test in `test/compute.test.js` first; keep the
  logic a faithful port of the VMflow frontend (see AGENTS.md → "Fidelity").
- **Two non-negotiables:** zero runtime dependencies / no build step, and the API key stays in
  `node_helper.js` (never in the browser). See AGENTS.md → "Hard rules".
- **Bilingual:** new user-facing strings → add the key to both `translations/en.json` and
  `de.json`; doc changes → keep `README.md` and `README.de.md` in parity.
