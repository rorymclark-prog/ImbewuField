# Verification record — what was checked, at what level

Environment: isolated sandbox, **Node 22.23.4** (type stripping on by default), TypeScript 5.9.3, firebase 11.10.0 (types
only). Not the real repo, not Node 24, no emulator, no browser. Logs are in the package `logs/` folder.

## Levels

* **L1 syntax** — parses as TS/TSX; no types, no dependency resolution.
* **L2 strict types** — `tsc --strict --noEmit` with real dependency types.
* **L3 stand-in** — executed with sandbox-only stand-ins for modules absent from the packet (`sandbox/standins/`).
* **L4 sandbox exec** — executed against the real prototype exports with deterministic fakes, no stand-ins.
* **L5 real** — real repo / Node 24 / emulator / browser. **None done here** (GATES G1–G5).

| Check | Level | Result | Log |
|---|---|---|---|
| New modules `farm-geometry`, `shape-sync/{protocol,controller,draw-adapter}` | L2 strict (`noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly`) | pass | 06 |
| `lib/user-sync.ts` + `lib/map-sync.ts`, base **and** proposed | L2 with real Firebase 11 types; `any` stand-ins for 4 absent local modules | pass both | 07 |
| `components/Map.tsx` base and proposed | **L1 only** | pass | 08 |
| New prototype suites: protocol 15, controller 11, adapter 9, v2-loss 2 | L4 | **37/37 pass** | 01 |
| `shape-sync-v2-user-sync` wiring (real user-sync.ts, fake Firestore via `registerHooks`) | L3 (needs stand-ins for sample-mode deps + international/*) | 2/2 pass | 02 |
| 7 existing suites, base vs proposed | L3 | **identical** results; `shape-sync-loss` = `todo` (red) in both; `sample-mode` #7 fails in **both** (reads `app/home/page.tsx`, absent from packet) | 03–05 |
| Mutation checks: reintroduce v1-class faults (no dedupe, drop pending on adopt, LWW, stale-snapshot write, delete-on-omission, late basis, fresh id on Done, tombstone on reticle start) | L4 | **8/8 caught** by ≥1 test each | 09–10 |
| Patches apply to clean frozen base; 0001–0006 in order and 0000 alone both reproduce `proposed/` byte-for-byte; existing tests + `pushShapes` body byte-identical | exact | pass | 11 |

## Pass 2 (second package) — same levels; logs in the pass-2 package `logs/`

| Check | Level | Result | Log |
|---|---|---|---|
| Negative controls NC1–NC5, **same file**: first package vs pass 2 | L4 | first package **0/5**; pass 2 **5/5** | 01, 02 |
| All 9 `shape-sync-v2-*` suites on pass 2 (protocol 15, controller 11, adapter 9, v2-loss 2, user-sync 2, negative-controls 5, pass2 27, old-client 9, map-source 12) | L4; user-sync + old-client are L3 | **92/92** | 03 |
| Old-client characterisation: frozen base `user-sync.ts` (sha256 `b11d9b1b…`) as the old client, pass 2 as the new client | L3 (stand-ins for consent/demo-farm/international/firebase-init) | 9/9; identical with this tree's own v1 path as the old client | 05 |
| Map.tsx source-structure checks | **source text only** (not behaviour) | base 0/12 · first package 8/12 · pass 2 12/12 | 04 |
| 7 existing suites, base vs pass 2 | L3 | identical; `shape-sync-loss` still `todo` | 06–08 |
| `tsc --strict`: new modules; user-sync base + pass 2 (Firebase 11 types); every v2 test file | L2 | pass | 09 |
| Map.tsx, user-sync, controller, protocol | L1 | pass | 10 |
| Mutations: the 8 pass-1 classes re-pointed at pass-2 code + 13 new (shared journal key, no in-step revalidation, watermark pruning, ignored marker, unsafe overwrite, quarantine trim, cap-rejects, unretained refusal, false "synced", drain-with-unreadable, drain starvation, Map untracked Undo, no causal order) | L4 | **21/21 caught** | 11 |
| Historical red control `tests/shape-sync-loss.test.ts`, `pushShapes` body, 6 other existing tests | exact bytes | identical to frozen base | 12 |
| Patches: `0000` (frozen → pass 2) and `0100`/`0101–0106` (first package → pass 2) | exact | apply cleanly, reproduce the tree byte-for-byte | 14 |

## Pass 3 (third package) — logs in the pass-3 package `logs/`

| Check | Level | Result | Log |
|---|---|---|---|
| The attached review controls, byte-identical (sha256 `c4b48d1a…`), against first / pass 2 / pass 3 | L4 | **0/5 · 2/5 · 5/5** | 01–03 |
| All 11 `shape-sync-v2-*` suites on pass 3 (prior 9 suites + `review-controls` 5 + `pass3` 16; old-client now 10) | L4 / L3 | **114/114** | 04 |
| Old-client characterisation vs the frozen base; transport field set (B5) | L3 | 10/10 | 05 |
| 7 existing suites, base vs pass 3 | L3 | identical; TODO intact | 06–08 |
| `tsc --strict` modules, user-sync (base + pass 3), every v2 test file | L2 | pass | 09 |
| Mutations: 21 prior + P1–P10 (no carry, carry ignored, fb acked, fallback as durable, UTF-16 bound, astral miscount, sticky too-large, identity forgotten, identity ignored, client re-queue) | L4 | **31/31** | 11 |
| Firestore size rules modelled from the official quotas + storage-size pages (fetched this pass) | doc check | 1,048,576 / 1,048,487; string = UTF-8 + 1; name + 16; doc + 32 | PASS3 §2 |

## Not verified (and why it matters)

* Map.tsx types/build (G2) — React/Mapbox/Next deps are absent.
* Mapbox Draw behaviour (G4) — explicit-id honouring and "programmatic calls emit no events" are **assumptions** modelled in `FakeDraw`.
* Real Firestore transactions, retries, offline errors, rules (G3, G6) — modelled by `FakeShapeServer`'s version check.
* Multi-browser UX of the conflict tray and banners (G5).
* Real cross-tab `storage` events, quota and eviction (G14): the multi-tab tests share one in-memory storage and call
  `refresh()` where the browser would fire the event.
* Real Firestore acceptance at the byte budget and index behaviour of a large `stateJson` (G16); real selective quota
  failure (G17). The size tests prove our bound, not Firestore's acceptance.
* Real old-client builds (G15): the old client here is the frozen source file with stand-ins, not a deployed bundle.
* Stand-in results (L3) say nothing about the absent modules' real behaviour.

## Reproduce (coordinator, real repo)

```
git apply patches/0000-all-frozen5c-to-proposed.patch
node --test tests/*.test.ts            # with the repo's own --import tests/register-alias.mjs, on Node 24
npx tsc --noEmit && npm run build      # G2
```
Sandbox reproduction (as run here): `SHAPE_SYNC_ROOT=$PWD node --import sandbox/register.mjs --test tests/shape-sync-v2-*.test.ts`
(the wiring test additionally needs `sandbox/standins/` layered in — see `sandbox/run-existing.sh`).
