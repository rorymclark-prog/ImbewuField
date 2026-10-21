# Consent and goal choices: draft evidence

Parent: `088ca5b3e7f0552fcd5f2b9706d3b810f62da5c4` (#1047). The pre-edit control inventory was
captured at `9072996b`; intervening parent changes concern the translator handoff CSV only.
The original component, English dictionary and four locale hashes are recorded in
`consent-drafts.json`. These are unreviewed AI drafts, without fluent-speaker approval.

The 16 added/corrected native values cover three missing goal prompts, the source label,
review-status notices, the anonymised-results label and the Xitsonga steady-production goal.
Every original English consent/goal clause stays exact. The existing isiZulu notice stays exact.
The native label corrections and their prior source lines are explicit in the packet. The
Justice Department's primary POPIA definition was consulted for the scope of anonymisation;
this is not a compliance assessment or certification of native legal prose.

`browser-qa.json` records the actual PopiaConsent component on `/home`, in all four languages
at 390 × 844 and 1440 × 1000. Each language uses a disposable browser context, with only language
onboarding marked complete so the real consent gate appears. Storage starts on, sharing starts
off; switching storage off disables Continue and displays its native required-storage message.
The goal step starts with no selection, a disabled finish button and its native prompt. Selecting
a goal enables completion. Phone cases save `feed` with sharing off; desktop cases explicitly
opt in and save `soil`. All eight synthetic records have precisely `at`, `consent`, `goal` and
`shareNgo`, and use the existing local-only namespace. Contexts are closed afterwards. No real
account, NGO permission, personal record, external consent or paid service is involved.

The four states per viewport—storage, storage required, goal and selected—make 32 measured
states. Every nonblank text node was scrolled into view and checked using its actual text-line
rectangles and hit testing: 1,381 lines, no clipped or occluded lines, and no document overflow.
All English source blocks have `lang="en"`; their translated prefixes and primary wording have
the target language. Native names label dialogs, switches and actions. Goal buttons expose
selection state and their existing descriptions. Phone content scrolls inside the modal; the
whole two-step document is not claimed to fit on a single screen. The screenshots include the
beginning and end of that scrolling content and were visually inspected.

`tests/consent-localization.test.ts` exercises the shipped component with real React hooks,
effects and handlers in isolated storage. It covers missing onboarding, existing consent,
required storage, default sharing, all three unchanged goal IDs, empty-goal rejection, exact
record fields and language changes that preserve the selection. Exact source pairs and prior
locale-file hashes protect undeclared wording. Historical Study checks retain their original
hashes; only the complete exact consent layer can be reversed, and altered/partial drafts or
unrelated learning changes remain exposed. The earlier test pinning Xitsonga's source exclusion
now guards source backing for every target draft; its original consent-gate test remains.

Validation: clean TypeScript check, 433 tests passed across 51 registered files, and clean
whitespace check. The registered suite now contains 550 files.

The full 547-file run at older `6446f1cb` remains live. Its three known failures were corrected
in predecessor heads; it is not current-head proof. No complete-suite success or production
merge is claimed. No PDF or media changed. This changes the picture; `PLAN_VERSION` is unchanged.
