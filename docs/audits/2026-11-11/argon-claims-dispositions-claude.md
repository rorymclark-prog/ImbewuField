# Argon's claims F-07 and F-09, as reproduced by Codex: dispositions — 2026-11-11

- Auditor: Claude, answering the package Rory relayed on 11 November 2026: `codex-argon-new-claims-9a5b102e.zip` (365,297 bytes, sha256 `e7d2588a2dbfabe54c7e87ebacd44422bde78fd5e8617f096fd82727c81cb4de`, 22 entries; size and checksum verified before opening), with its report and check file.
- Reviewed revision: the package covers `9a5b102e850ff708d5f0761f8c17eaae4d96b54d`, tree `fec2aebb261a8774d3f132adc76745b49fd1810e`. The changes below are on branch `claude/blissful-pasteur-1c4ne6`, PR #1334.
- Deployment inspected: not inspected for this record.
- Previous audit: [Codex interim review dispositions](codex-interim-review-dispositions-claude.md), same day.
- Scope: the six claims in the package. Three are confirmed and acted on. Three are qualified by Codex; I agree with its reading and change nothing for them.
- Evidence type: source review, automated tests, an offline re-analysis of archived daily responses. I read the package's runner as text and did not execute it. No live collection, no browser.

## Dispositions

| Claim | Codex's classification | Disposition | What was done, and what is left |
| --- | --- | --- | --- |
| F09-ONCE-SHARE: the year-free yield check accepts a one-time sowing with a share of 2.5 beds | Confirmed helper gap | **Accepted. Fixed.** | Reproduced with the package's inputs: no conflict, 72.9 kg, "about 73 kg" in the year report; the rolling check withheld the same plan. Cause: the year-free walk skips one-time rows, and its share check passed anything above zero, so nothing looked at that row's share. A one-time row's own share is now checked on that path too. The rule for recurring rows is left exactly as it was. The new test in `tests/crop-plan.test.ts` fails on the old code and passes now; the package's controls (a valid half share counted, a recurring oversized row refused) still hold. Reach: the picker stores a share of 1 or more as a whole bed, so no screen creates this row. A stored or imported row could. |
| F09-HARNESS: the 10 November location harness measured crop exposure over the wrong months | Confirmed audit-harness defect | **Accepted. The harness is kept as it ran; the measurement is redone on the planner's real months; one sentence of the 10 November audit is corrected.** | See the next section. |
| F07-JOINT: the close-call search misses a neighbour that needs both monthly means to move | Confirmed search limitation; not evidence that the warmer calendar is right | **Accepted. Fixed in the search only. No threshold and no site's calendar changes.** | See the section after next. |
| F07-FROST-YES: "frost yes" on a light-frost site should demote it to hard frost | Source-contract choice; the general claim is unsupported | **No change. I agree with Codex.** | "Light frost at most" already allows for frost. A yes-or-no answer says nothing about how hard or how often. The grower's recorded frost months do hold tender crops back, checked against every bed month including the picking months (`observedFrostConflictsForPlanting`). A grower who wants the hard-frost calendar can choose it. |
| F07-WINTER: frost-bearing winter-rainfall places | Existing limit (CP-104), with qualification | **No change. CP-104 stays open.** | The winter-rainfall calendar is reached by rain timing alone. Calvinia (4.45 frost days a year) and Malmesbury (0.6) are on it. The reasons line still shows the record minimum. A replacement needs a source for winter-rainfall areas with a frost season. |
| F09-OCCUPANCY: a seven-month cabbage reservation is inflated | Source-contract choice; no arithmetic bug | **No change. I agree with Codex.** | 125 days rounds up to five months; a January sowing reserves February to August with planned entry in March. That is the documented conservative contract: a bed is not released early. It is not shortened on this claim. Whether 125 days suits a given cultivar is a source question, not answered here. |

## F09-HARNESS: what the old harness got wrong, and what changes when it is put right

The 10 November harness took a crop's months as "sowing month to first harvest month". The planner reserves a bed from bed entry, which is after the nursery for a transplanted crop, to the **last** harvest month. For an August tomato that is August to January in the harness and September to March in the planner. So the harness counted a seedling tray's month as field exposure and left out the picking months.

I re-ran both spans, offline, on the archived daily responses for the 44 South African places, with today's catalogue and calendars ([`exposure-span-recheck.ts`](evidence-argon-claims/exposure-span-recheck.ts), output [`exposure-span-recheck.txt`](evidence-argon-claims/outputs/exposure-span-recheck.txt)). 7,942 crop, sowing-month and place combinations; the two spans differ for 3,491 of them.

| Frost-tender crop in a month averaging one air-frost day or more | Combinations | Places |
| --- | --- | --- |
| Old span, sowing month left out (the figure the 10 November record quoted) | 8 | 2: Underberg, Sutherland |
| The planner's real bed months | 45 | 3: Underberg, Bloemfontein, Sutherland |

The 37 extra combinations are of two kinds.

- **Late picking months (21).** Tomatoes, peppers and chilli sown in October, pumpkin and sweet potato sown in November, butternut and watermelon sown in December are still reserved in May, when Underberg averages 2.7 frost days, and Bloemfontein and Sutherland 1.2. The harness stopped at first harvest and never looked.
- **The sowing month of direct-sown crops (16).** Green beans, potato, cucumber, amaranth, gem squash, baby marrow, spanspek and sweetcorn sown in September at Underberg (1.2 frost days in September) and Sutherland (2.4). The planner counts the sowing month as bed occupancy; the catalogue's own frost test starts exposure the month after sowing, on the reasoning that seed is underground. This is a difference of definition, not an error of either.

Nothing was flagged by the old span that the planner's months do not also carry.

**Heat.** The app's heat check gives "too hot" for 7 combinations on either span, the same 7. The package's February example is synthetic; on these 44 places the missing months change no heat verdict.

**Correction to the 10 November audit.** Its sentence "42 of 44 South African sites have no frost-tender crop standing in a month that averages one air-frost day or more" is true only for the months from the one after sowing to first harvest. On the planner's bed months it is 41 of 44. The correction is appended to that record. Its other findings do not use this span.

**New finding, CP-108, open.** On the hard-frost calendar the last planned picking month of autumn-harvested tender crops falls in May at the three coldest places, in a month that averages one to three frost days. The plan says nothing about it. A grower who records May as a frost month is protected: the recorded months are checked against every bed month. A grower who has not recorded frost months is not told. This needs a decision on wording (for example a note that picking ends with the first frost), not a new number. Not changed in this branch.

## F07-JOINT: the close-call search

The search asks whether a site would get another calendar if one reading moved by the tolerance: the coldest month by one degree, the hottest by one degree, the record minimum by two, the rain share by 0.05. It moved one at a time. Two gridded records usually differ by an offset in every month, so a line that needs both the coldest and the hottest month to move was never tried.

Measured on all 100 recorded places: moving all twelve months by one degree reaches a calendar the search did not name at exactly **one** place, Eshowe (coldest 15.1 °C against the 16 °C line, hottest 23.9 °C against 24 °C, record minimum 2.9 °C, no frost day on the second record).

The change: two more trials at the end of the list, both monthly means one degree colder and both one degree warmer. Because they come last they can only name a neighbour the earlier trials missed. Before and after, for all 100 places: every calendar is the same, every rain season is the same, and the only difference is Eshowe, which is now told it is close to the hot-area line. Its grower's answer "I have never seen frost here" can now use the hot-area calendar, as at Mbombela. Without that answer nothing changes.

What this does not claim: that the hot-area calendar is right for Eshowe. That is the grower's call, as before. No threshold moved.

Tests: `tests/koppen-global.test.ts` (the synthetic case, both directions, and that a single-reading neighbour still wins) and `tests/sa-calendar-real-sites.test.ts` (Eshowe by name, and a check over all 100 places that every calendar reachable by a one-degree shift of all months is one the site is told about).

## What changed in the application because of this package

| File | Change |
| --- | --- |
| `lib/crop-plan.ts` | A one-time sowing's share above a whole bed is an invalid share on the year-free path as well. |
| `lib/koppen-global.ts` | Two joint trials added to the close-call search. No threshold, no calendar assignment. |

## Verification

- Typecheck: clean.
- New tests fail on the old code where they should: the share test was run against the code before the fix in a separate checkout and failed there.
- The 100-place before and after comparison for the close-call change was made by dumping calendar, close call, warmer neighbour and rain season for every place before and after the edit.
- Full test suite: required on the final head; result in the review packet.
- Not done: I did not execute the package's runner. No browser check of these two changes; neither changes a screen for the recorded farm.

## Next continuation

1. CP-108: decide the wording for late picking months that fall in frost.
2. CP-104: a source for frost-prone winter-rainfall areas.
3. The old harness stays in the repository as the record of what ran on 10 November. Any new exposure measurement should start from `exposure-span-recheck.ts`.
