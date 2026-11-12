# Argon's claims F-07 and F-09, as reproduced by Codex: dispositions — 2026-11-11

- Auditor: Claude, answering the package Rory relayed on 11 November 2026: `codex-argon-new-claims-9a5b102e.zip` (365,297 bytes, sha256 `e7d2588a2dbfabe54c7e87ebacd44422bde78fd5e8617f096fd82727c81cb4de`, 22 entries; size and checksum verified before opening), with its report and check file.
- Reviewed revision: the package covers `9a5b102e850ff708d5f0761f8c17eaae4d96b54d`, tree `fec2aebb261a8774d3f132adc76745b49fd1810e`. The changes below are on branch `claude/blissful-pasteur-1c4ne6`, PR #1334.
- Deployment inspected: not inspected for this record.
- Previous audit: [Codex interim review dispositions](codex-interim-review-dispositions-claude.md), same day.
- Scope: the six claims in the Codex package, and then the twelve issues of Argon's own ledger (second half of this record).
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

## The native Argon packet: every ledger issue

Rory then relayed Argon's own interim packet: `argon-interim-review-9a5b102e.zip` (548,140 bytes, sha256 `a6f0917a98d660474519b53c522bb1da08d75dec505c086316ea64e13ae64028`, 88 entries; verified before opening). I read the handoff, the interim recommendation and the discrepancy ledger. Its disposition is "changes required, interim", with no final approval. One row for each ledger issue:

| Ledger | Subject | Disposition | Evidence, and what is left |
| --- | --- | --- | --- |
| ISS-01 | Butterworth and Mossel Bay on the hard-frost calendar (CP-103); the reason line rounds 1.7 °C to "2 °C" | **Agreed; deferred to Rory's decision.** | The three options are in the held-out record. The rounding slip is real and is logged as CP-109: it should be settled with CP-103, because the right fix depends on which line the grower is being shown. No rule changed. |
| ISS-02 | The criteria admit an always-winter answer; frost-bearing winter-rainfall places; bimodal south-coast places on the hard-frost calendar | **Accepted; wording and control fixed; the rest deferred.** | CBR-01 above. CP-104 stays open. Swellendam, Robertson and Caledon have real frost on the second record (0.15, 0.25 and 0.05 days a year, lowest -0.5, -1.2 and -0.1 °C) and record minimums below zero, so the hard-frost calendar is not a frost error there; whether its months suit a south-coast place is the regional question already open as CP-099. |
| ISS-03 | Repeated climate readings between the two sets | **Accepted; now measured from raw data.** | The ledger's caution was right that identical readings do not prove a shared cell. The archived daily responses settle the second record: 56 distinct cells for the 56 places and 44 for the 44, none shared (`raw-verification*.txt`). For the app's own reading (a coarser grid) the repeats stand: 3 pairs inside the 56, and 6 of the 56 repeat a reading from the 44. So at most 48 of the 56 are new readings to the rule. The held-out record now says so. |
| ISS-04 | Collectors omit the model, the cell policy and unit checks | **Accepted for my two audit collectors (CBR-02, CBR-03 above). Deferred for the app's own rainfall download.** | Audit collectors: disclosed, raw data preserved, verified offline. The app's `fetchOpenMeteoRainfall` already walks every expected date of its own configured period and refuses a gap or a non-number; it does not check the stated unit and does not pin a model. Pinning a model would change the rainfall growers see, so it needs its own comparison first. Not changed here; suggested as a separate task. |
| ISS-05 | February counted as 28 days; rainfall from one provider with temperature from another; southern-hemisphere season names on the fetched rainfall | **Deferred, with reasons.** | All three are in the shared climate fetch, outside the crop plan. The planner does not read the fetched season names: it recomputes rain timing from the months with a latitude-aware rule (Codex C09, C11). The provider swap is the documented 30% rule and is labelled on screen. A 28-day February understates evaporation by under 1% of one month. None changes a calendar at the 100 recorded places. |
| ISS-06 | 20 °C stand-ins fed to the climate classifier; sparse arrays; the -999 marker in the heat gate | **Sparse arrays and the marker: fixed (CBR-04, CBR-05 above). Stand-ins: fixed where the Atlas used them; deferred on the server.** | The crop planner already refuses a year marked incomplete. The Atlas did not: it derived a sowing calendar and a crop list from the stand-ins. `atlasRainPattern` now returns nothing for an incomplete year (`tests/atlas-explorer.test.ts`). The server still classifies the stand-ins for its display string; an existing test pins that display fields do not change with coverage, so that is another owner's contract and is not altered here. |
| ISS-07 | The rain and evaporation screen | **Fixed as a water screen (CBR-06 above).** | No temperature threshold added, as the ledger asks. |
| ISS-08 | Joint close call at Eshowe; "frost yes" on a light-frost site | **First: fixed in the search only (above). Second: no change, agreed.** | |
| ISS-09 | The regional guide is not an accuracy measure; catalogue provenance limits | **Agreed; no change.** | Second-hand KZN rows (CP-083), eight crops without months (CP-082) and the secondary guide are standing limits, carried forward. |
| ISS-10 | Occupancy, the old harness, the one-time share | **Occupancy: no change, agreed. Harness and share: done (above).** | |
| ISS-11 | Planning is held back outside South Africa | **Agreed; no change.** | This branch does not alter country support. |
| ISS-12 | A raw NUL byte in `lib/crop-autosuggest.ts`; whole-app, export and CI gates | **NUL byte: fixed. Gates: see the review packet.** | Confirmed on current code: one byte `0x00` at offset 149,980, line 2,926, inside a template string used as a map key. Replaced with the six characters `\u0000`, as lines 282 and 2,498 already do. The string at run time is identical. No other control byte is in the file, and no other source file has one. The file now reads as text. |

Not adopted from Argon's original first pass, as its own second pass and Codex also conclude: an automatic demotion to hard frost on "frost yes", a shorter cabbage occupancy, a universal temperature cut-off in the water screen, and treating repeated readings as proven tuning leakage.

## What changed in the application because of this package

| File | Change |
| --- | --- |
| `lib/crop-plan.ts` | A one-time sowing's share above a whole bed is an invalid share on the year-free path as well. |
| `lib/koppen-global.ts` | Two joint trials added to the close-call search. No threshold, no calendar assignment. |
| `lib/crop-autosuggest.ts` | One raw NUL byte replaced by its escape. Same string at run time. |
| `lib/atlas.ts` | No sowing calendar or crop list from a year the server marked incomplete. |

## Verification

- Typecheck: clean.
- New tests fail on the old code where they should: the share test was run against the code before the fix in a separate checkout and failed there.
- The 100-place before and after comparison for the close-call change was made by dumping calendar, close call, warmer neighbour and rain season for every place before and after the edit.
- Full test suite: required on the final head; result in the review packet.
- Not done: I did not execute the package's runner. No browser check of these two changes; neither changes a screen for the recorded farm.

## Next continuation

1. CP-108: decide the wording for late picking months that fall in frost. CP-109: the record minimum's rounding in the reason line, with CP-103.
2. CP-104: a source for frost-prone winter-rainfall areas.
3. The old harness stays in the repository as the record of what ran on 10 November. Any new exposure measurement should start from `exposure-span-recheck.ts`.
