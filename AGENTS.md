# AGENTS.md — ImbewuField

Read automatically by Codex (cloud and CLI) at the start of every task. Claude
Code reads `CLAUDE.md`; this file is the shared contract both must honour.

ImbewuField is a permaculture design and learning app for **smallholder farmers in
South Africa**. Its outputs are farming instructions and site plans that real
people act on. That single fact drives most of the rules below.

---

## 1. Verify with these commands, in this order

```bash
npx tsc --noEmit     # must be clean
npm test             # must be 100% pass, every test, every time
git diff --check     # no whitespace damage
```

**Never edit a test to make it pass.** If a test fails, either the code is wrong or
the test encodes a claim that is no longer true — and the second case needs the
claim rewritten with its reason, not the assertion deleted. Two tests in this repo
failed because they PINNED A CONSTANT rather than a rule: one asserted a 10–12 MB
animation total and failed when the clips were legitimately made smaller; another
asserted "isiZulu is missing slide 13" and failed when that slide was rebuilt.
Both were right to fail and both needed rewriting upward, into the rule they were
really about. Deleting either would have removed real coverage.

**Do not run `npm run build` in a sandbox.** `app/layout.tsx` imports `Newsreader`
and `Public_Sans` via `next/font/google`, so the build fetches from
fonts.googleapis.com at compile time. With no network it fails at the font stage.
That is an environment limit, not a defect — the build is green on Vercel and in
CI. Never "fix" it.

### If `npm test` fails with `ERR_UNKNOWN_FILE_EXTENSION`

Your Node is too old. The tests are TypeScript, loaded by Node's **native type
stripping** — `tests/register-alias.mjs` only registers the `@/` alias resolver,
it does not transpile. Type stripping is default-on from **Node 22.18 / 23.6**;
on Node 20 every test file fails to load.

```bash
nvm install 24 && nvm use 24   # .nvmrc pins 24
```

This is not a broken test setup. Do not rewrite the test script, add `tsx`, or
introduce a build step for tests.

Other known sandbox artefacts, none of them repo defects: `npx tsx` returning
HTTP 403 (no registry access) and any Google Fonts fetch failure.

---

## 1b. There is a queue

`docs/CODEX-QUEUE.md` holds the current backlog, in priority order, one branch per item. Take the
top unstarted item unless you have been given something else. Every item in it was verified real
before it was written down — if you find one is already fixed or its premise is wrong, say so and
skip it. That is a useful result, not a failure.

**Re-read the queue from `origin/main` before you start EACH item — it changes while you work.**

```bash
git fetch origin && git show origin/main:docs/CODEX-QUEUE.md
```

This is not ceremony. Claude edits the queue *during* your run: adding items it finds by rendering
sheets, re-scoping an item whose cause has already been located, marking items done. On 2026-07-29
item 2 (the swapped tank labels) was rewritten from "hunt for an id mismatch" to "re-render and
confirm" because the real cause — a leader-line collision — had been found and fixed an hour
earlier. An agent working from the copy it pulled at start-up would have spent an hour chasing a bug
that no longer existed.

Read `PLAN_VERSION` the same way — from `origin/main`, not from the number written in the queue
text, which goes stale within the hour:

```bash
git show origin/main:components/design/DesignGlossy.tsx | grep -m1 "PLAN_VERSION ="
```

Two branches landing the same version is the most common merge problem here, and it is not
cosmetic: the second change silently inherits the first's cache entries, so it is invisible to
anyone who rendered in between. Equally, **do not bump it for a refactor** — a bump re-keys the
gallery, and an AI sheet a farmer already paid for stops being found. Bump when the picture changes.

**Deployments are a rationed resource — do not spend one per commit.** The Vercel free plan allows
**100 deployments per 24h across the whole account**, and on 2026-07-29 an overnight run exhausted
it and froze production for the second time in one day. Preview deploys now skip pushes whose diff
is only `tests/**`, `docs/**` or markdown (see `.github/workflows/deploy-preview.yml`), but the
budget is still shared with production: **push each branch once, when it is finished**, rather than
after every commit on it. If you genuinely want a preview of a test-only branch, trigger it by hand
with `workflow_dispatch`.

**Do not stop after one item.** Push the branch, write the report, then take the next item straight
away. Claude reviews and merges behind you; waiting for that review is what turns a long run into a
short one. Only stop when the queue is empty or something is genuinely blocking you — and if it is
blocking, skip to an item it does not block rather than idling.

If the next item touches a file you changed on a branch that has not been merged yet, branch from
that branch instead of `main`, and say so in the report so the merge order is obvious.

---

## 2. Push, or the work does not exist

Work has been lost to this three times: `codex/drawing-quality` sat invisible for
a day, and commits `240e60e` and `6600c77` were made in sandboxes with no push
destination and died with them.

**Before writing any code:**

```bash
git remote -v && git ls-remote --exit-code origin HEAD >/dev/null && echo "PUSH OK"
```

If that does not print `PUSH OK`, **stop and say so.** Do not start work. A commit
you cannot push is a commit nobody can review, deploy or recover.

Push early and often — this is a shared repo with more than one agent in it, and a
long-running uncommitted change guarantees a conflict.

---

## 3. Ownership — do not edit outside your lane

| Codex | Claude |
|---|---|
| `components/design/DesignGlossy.tsx` | `lib/course-*.ts`, `scripts/*` |
| `lib/producer-prompt.ts` | `lib/user-sync.ts`, `lib/local-tombstones.ts` |
| `lib/render-policy.ts`, `lib/render-jobs.ts` | `lib/tidy-outline.ts`, `snap-edges.ts`, `align-items.ts` |
| `lib/locked-polish-flow.ts`, `lib/sheet-render-route.ts` | `docs/narration/*`, course content |
| `lib/leader-labels.ts`, `lib/render-difference.ts` | `lib/offline-*.ts`, `lib/narration-*.ts` |
| `functions/`, `firestore.rules` | `.github/workflows/*`, `docs/narration/*` |

`lib/water-cartography.ts` is shared — say so in the ledger before changing it.

Coordination happens in **GitHub issue #35** (`rorymclark-prog/ImbewuField`). When
you finish, post the branch and SHA there.

---

## 4. Guardrails — non-negotiable

- **Never mutate saved geometry during rendering.** Items, lines, zones, house,
  driveway, boundary. Presentation scaling is a paint-time concern only; the
  farmer's measurements are the product.
- **Never change or add a plant species name.** Some species are illegal to
  propagate in South Africa under NEMBA, and the existing list was checked against
  primary sources.
- **Never rewrite lesson bodies, quiz questions or rationales.** They are
  calibrated for a low-literacy, isiZulu-first audience. The plainness is the
  design, not a gap to improve.
- **Invent no numbers.** Spacings, yields, timings, rainfall. If a figure is not
  in the source, say it is missing — a plausible wrong number in a farming
  instruction does real harm.
- **Never commit secrets**, `.env*`, `serviceAccount.json`, or logs.
- **If you add audio, add its `lib/course-audio.ts` manifest entry in the same
  commit.** `tests/course-audio.test.ts` enforces both directions — a promised
  clip must exist on disk, and audio on disk must be claimed.

---

## 5. LOOK AT WHAT YOU MADE

This is the rule that matters most on this repo, and the one that has been broken
most expensively.

Rory paid for the AI "Full Treatment" render again and again and got back the
picture he already had. **Six commits over two days were each reported as fixing
it, every one with a green test suite**, because no code in the app had ever
looked at an output image. A pass that returned its own input verbatim satisfied
every check — including the protected-pixel verifier, which a byte-for-byte copy
passes perfectly — and was then stored, labelled "AI polished", and charged for.

His words at the end of it: *"this is still shit meh after days of coding with
codex and you its still shit"*, and *"i am just burning tokens over tokens for no
result"*. Both were fair.

So:

- **A green suite is not evidence that a rendered thing looks right.** Tests prove
  arithmetic and wiring. They cannot see a squashed sheet, a label off the edge, a
  grey slab over a house, or two legends fighting on one page.
- **Never write "fixed" about anything visual you have not seen.** Say exactly what
  you verified and what you did not. "tsc and tests pass; I could not render the
  sheet, so the visual result is unverified" is a good report. "Fixed the sheet
  framing" without a rendered sheet is not.
- **If you cannot see it, say so and hand it back.** Rory or Claude can open a
  preview URL. Every branch push gets one automatically
  (`imbewufield-<slug>.vercel.app`, see §6). Naming the exact thing to look at —
  which sheet, which style, what should be different — is far more useful than a
  confident summary.
- **Where a difference can be measured, measure it.** `lib/render-difference.ts`
  exists for exactly this: `measureRenderDifference(before, after, protectMask)`
  scores an output against its input, excluding protected pixels, and returns
  `redrawn` / `filtered-only` / `unchanged`. If you add a paid render path, wire
  it in — `tests/paid-render-gate.test.ts` enforces that every flow which enqueues
  a paid pass records a baseline to compare against.

The general form: **the check must be able to fail.** A test that pins whatever the
code currently does, a verifier that only confirms the bytes it restored itself, a
word-count rule that cannot fire on the language it was written for — all of these
pass forever and protect nothing. Before you finish, ask what would have to break
for your check to notice, and confirm it actually would.

---

## 6. House style

- **Comments explain *why*, not *what*.** Most comments in this repo record the
  real-world observation or bug that forced the code to be the way it is —
  including the farmer's own words where they exist. Match that.
- **One authority per question.** The recurring bug in this codebase is two places
  independently answering the same question and silently diverging. Before adding
  a rule, check whether `lib/sheet-render-route.ts`, `lib/locked-polish-flow.ts`
  or a sibling already owns it.
- **Tests carry the reason too.** A test name should say what breaks for a user,
  not which function it calls.
- Prefer extending an existing `lib/` module over adding a parallel one.

---

## 7. Branches

`main` is production (auto-deploys via `deploy.yml`). All work happens on branches.
Every push to a non-main branch gets its own stable preview hostname —
`imbewufield-<slug>.vercel.app` — via `deploy-preview.yml`, so a cloud-only
contributor can ship something Rory can open on his phone without a laptop.

Every push also runs `test.yml`: typecheck plus the full suite on Node 24. **If you
cannot run the tests in your sandbox, push and read the CI result** — that is the
supported workflow, not a workaround.
