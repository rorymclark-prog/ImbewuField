# Three things the audit found that an agent must not fix

**15 August 2026.** From a ten-lens swarm audit of `main` (73 agents; 31 findings raised, 16 survived
two independent adversarial verifiers, 15 refuted). Everything else it found is being fixed in
branches. These three are not, because each one is a decision, a deploy, or a spend policy that is
yours — not something to change quietly on a Saturday.

Every file and line below was opened and read by a verifier whose job was to *refute* the claim. The
quotes are copied from the files, not recalled.

---

## 1. Firestore rules let any staff account read every other org's farmers — CRITICAL

**`firestore.rules`, lines 40, 54, 152, 221, 254. Rules files are read-only to agents. Nothing in
this repo deploys them. This is inert until you deploy it yourself.**

`isStaff()` (line 13) is:

```
myRole() in ['ngo', 'funder', 'admin']
```

It never checks `org_id`. Five rules gate on it bare:

| line | collection | what a staff account can reach across every org |
|---|---|---|
| 40 | `profiles` (list) | every farmer's name and role, in the whole database |
| 54 | `organizations` | every org |
| 152 | `designs` (read) | any farmer's saved design — location, sketch, personal notes |
| 221 | `course_submissions` (read) | any learner's submitted photo and voice evidence |
| 254 | `survey_responses` (read) | any farmer's raw survey answers |

**The same file already knows this is wrong.** Every other money-shaped collection scopes staff to
their own org — `production_logs` (84), `sales_logs` (106), `expense_logs` (130), `reports` (158) —
and the `surveys` collection at line 248 carries a comment saying it was deliberately changed to
`sameOrg` *"so a staff member can't read another org's surveys by id"*. Its neighbour
`survey_responses`, fourteen lines later, did not get the same fix.

`lib/network.ts:16-40` is the app's own earlier internal audit, and it independently names three of
these four collections. So this was found before and not closed.

**What it needs from you.** Mirror the `surveys` fix — replace the bare `isStaff()` branch with an
org-scoped check in all five places, and do the same for `isCourseStaffOrMentor()` in
`storage.rules` (15-19). **Two of them cannot simply be rewritten:** `course_submissions` and
`survey_responses` carry no `org_id` field at all, so those documents need it denormalised onto them
first — a migration, not a rules edit.

**How exposed is this really?** It needs a provisioned NGO / funder / admin account. That is not the
public internet — but it is every partner organisation you ever onboard, and it is the difference
between "a partner sees their own farmers" and "a partner sees everyone's."

---

## 2. Nothing at all stands in front of the seventeen routes that spend your money — CRITICAL

Two layers, both open, and neither is an accident — each has a comment explaining why it was turned
off.

**The outer gate.** `middleware.ts:10`:

```ts
export function middleware() {
  return NextResponse.next();
}
```

Its own comment: *"The shared-password wall is off — every request passes straight through. (Rory
asked for it gone during prototyping, 2026-07-03.)"* No conditional, no env check. `.env.example`
still describes `SITE_PASSWORD` as **"REQUIRED — guards the whole site"**, which is now false.

**The inner gate.** `guardPaidApiRequest` in `lib/api-auth.ts:13-15` only enforces anything when
`REQUIRE_API_AUTH` is `'1'` or `'true'`. That variable is not set in `.env.example`, not in
`.env.local`, and not documented as required anywhere. So it is in log-only mode: an unauthenticated
call is **recorded and then served**. And even in hard mode it checks only that *some* Firebase user
is signed in — it enforces no ceiling.

**What that adds up to.** `grep -rl guardPaidApiRequest app/api` lists roughly seventeen routes that
call billed Gemini / OpenAI / fal / Anthropic APIs — `ai-render`, `image-producer`, `area-profile`,
`ai-insights`, `generate-report`, `lima-vision`, `tree-id`, `design-detect` and the rest. Anyone who
knows a URL can POST to them, in a loop, on your keys, with no per-user cap, no global cap, no
idempotency key and no CAPTCHA.

**Your own docs already said so.** `docs/WORK-QUEUE-2026-08-02.md` item #2: *"The API routes that
spend money have no auth … `/api/image-producer` and `/api/ai-render` call OpenAI/fal/Gemini with no
ceiling."* It prescribed `REQUIRE_API_AUTH` as an interim log-only measure. The measure shipped. It
was never switched from log-only to enforcing.

**One useful detail.** `/api/ai-render` looks dead in the UI: its only call path is
`lib/ai-render-client.ts` → `DesignGlossy.generate()`, triggered by `analysisStyle`, which is never
set to a non-null value anywhere in that file. The route is still deployed and still publicly
reachable by URL regardless. Dead in the UI is not dead on the internet.

**What it needs from you — pick one, it is a policy call not a code call:**

- turn `REQUIRE_API_AUTH` on and confirm every paid route requires a signed-in user; and/or
- restore the site password gate (git history has the pre-2026-07-03 version); and/or
- add the per-user and per-day counter that the render queue already uses, to the direct routes too.

An agent could write any of these in an hour. None of them should be switched on without you,
because each one changes who can use the app tomorrow morning — including during a demo.

---

## 3. The crop plan, journal, invoices and saved reports exist only on one phone — CRITICAL

`lib/crop-plan.ts:112` and its siblings `lib/field-journal.ts`, `lib/invoices.ts`,
`lib/saved-reports.ts` are localStorage only. There is no cloud sync path for any of them.

A farmer who loses, breaks, wipes or reinstalls onto a phone loses every crop plan, every journal
entry, every invoice and every saved report. Nothing warns them. The app's own language —
"ImbewuField · saved automatically" in the settings footer — reads, to a farmer, as a promise that
this is backed up.

This is marked **large** and it is genuinely architectural: it needs a schema, a conflict rule, a
migration for data already on phones, and a decision about what happens offline. It is not a
Saturday fix and it is not something to start without you deciding it is the next big thing.

The narrower, reachable half of the same defect — guest work vanishing at sign-up — **is** being
fixed today in `claude/fix11`.

---

## What was refuted, so nobody re-raises it

Fifteen of the thirty-one findings did not survive verification. Two are worth recording because
they look alarming and are not:

- *"Every paid AI endpoint is reachable by the whole internet with no spend ceiling"* — refuted as
  written, and then confirmed in the narrower, accurate form above. The distinction matters: the
  render **queue** does have a counter; the **direct routes** do not.
- *"Field journal entries never sync to the cloud, unlike every sibling data type"* — refuted,
  because the siblings do not sync either. The real finding is #3 above, and it is bigger.
