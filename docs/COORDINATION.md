# Claude ⇄ Codex coordination — read before working

Two agents work on this repo in parallel. The live, append-only progress ledger is
**[GitHub issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35)** — read its latest
entries before starting ANY session, post after every meaningful commit, and obey any comment
prefixed `DIRECTIVE:` (that's Rory steering).

## The single-link contract

- **Integration branch: `codex/reference-blueprint-quality`.** Fork feature branches from its
  CURRENT TIP. Merge back here first; `main` (production) only via explicit DIRECTIVE.
- **Verify on https://imbewufield-preview.vercel.app** — CI auto-deploys every push of any
  non-main branch there and re-points the domain (`.github/workflows/deploy-preview.yml`).
  Confirm `/api/build-info` (or the Build badge) shows YOUR sha before claiming "verified live".
- **Production `imbewufield.vercel.app` deploys only from `main`** (`deploy.yml`). Never verify
  new work against it; never hand-run `vercel deploy` — push and let CI do it.

## Working-copy rule

`~/ImbewuField` is ONE checkout. Do not switch its branch while the other agent may be mid-run —
use `git worktree add` for isolated branches, and **push your branch to origin early** so work is
never trapped in a local worktree.

## Ownership

The current split lives in issue #35 (it changes as tracks hand over). Standing rule: neither
agent edits the other's owned files without posting a handoff entry in the ledger first. Shared
single-authority modules everyone must respect rather than duplicate: `lib/sheet-render-route.ts`
(sheet×mode routing + authority flags), `lib/locked-polish-flow.ts` (guided-flow stages + style),
`lib/render-policy.ts` (authority flags), `lib/local-tombstones.ts` (deletion tombstones),
`promptNearbyUpdate` in `lib/saved-places.ts` (duplicate-site guard).
