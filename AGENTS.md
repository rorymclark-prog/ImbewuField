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
npm test             # must be 100% pass — currently 487 tests
git diff --check     # no whitespace damage
```

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
| `functions/`, `firestore.rules` | `.github/workflows/*` |

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

## 5. House style

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

## 6. Branches

`main` is production (auto-deploys via `deploy.yml`). All work happens on branches.
Every push to a non-main branch gets its own stable preview hostname —
`imbewufield-<slug>.vercel.app` — via `deploy-preview.yml`, so a cloud-only
contributor can ship something Rory can open on his phone without a laptop.

Every push also runs `test.yml`: typecheck plus the full suite on Node 24. **If you
cannot run the tests in your sandbox, push and read the CI result** — that is the
supported workflow, not a workaround.
