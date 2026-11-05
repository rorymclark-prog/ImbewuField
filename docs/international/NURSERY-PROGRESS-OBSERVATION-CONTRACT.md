# Record an observed nursery plant count

Extend the existing checked saved-batch journal workflow at `04e90c46016d4191d226b02588b6393f851ca465`. One observation records the grower's explicit count and assessment at a point in time. It does not update nursery forecasts, seeds, available stock, crop capacity, task ticks or sales. Do not sum repeated observations or infer a germination percentage from missing denominators. Ready is the grower's assessment, not a readiness certificate.

## Canonical payload and APIs

Add optional `nurseryProgress?: unknown` to `JournalEntry`/`JournalEntryInput`, preserving malformed/future JSON evidence through normalize/create/edit/raw-write checks. Export `JournalNurseryProgressObservation` with exact own data fields:

```ts
{ kind: 'nursery-progress-observation'; version: 1;
  stage: 'emerged' | 'alive' | 'ready';
  coverage: 'whole-batch' | 'checked-subset';
  plantsObserved: number;
  references: { variety: string | null; seedLotReference: string | null;
    raisingBatchReference: string | null };
}
```

Count is a nonnegative safe integer: explicit zero is valid, missing/fractional/coerced values are not. Reuse the sowing-reference shape authority and safe descriptor/JSON utilities rather than adding another validator. Expose `normaliseJournalNurseryProgressObservation` and `inspectJournalNurseryProgress` with the existing legacy/observed/held pattern. A present progress payload needs the existing structurally valid nursery-start planning link and matching bed; current actor/whole-book membership remains a writer gate. A single new row cannot represent both a sowing and a progress observation. Retain ambiguous old evidence as held instead of dropping either payload. Ordinary note editing cannot introduce, replace or discard progress evidence. Historical display needs no current crop plan.

Export `GrowerNurseryProgressInput` with exactly observedDate, note, plantsObserved, stage, coverage, confirmed:true. `recordGrowerNurseryProgress(source, task, input, {isCurrent})` delegates to the SAME private guarded append pipeline as generic notes and nursery sowing. Title `Nursery count`, category `planting`. Resolve current reference labels inside that authority, never from caller-supplied snapshots. No implicit link to a particular earlier sowing note: the current schema has no typed relationship and multiple observations can share a planting reference.

## Actual saved-batch flow

Add `onRecordNurseryProgress(view, plantingId, input, displayedIsCurrent)` to the existing hook, sharing its original-view/current-book/design/actor/sample/form guard and unique persistent planting/event lookup. Avoid duplicating that authorization algorithm. Keep a stable form intent consumed once after saved/unconfirmed; uncertain writes require journal inspection, with no auto retry. Fresh source checks cannot silently adopt stale inputs.

The saved-batch panel offers `Record nursery plant count` only for clean current accepted rows, through optional `onRecordProgress` supplied by the real parent. New `NurseryProgressObservationForm` starts date, note, count, stage, coverage and confirmation blank. Clearly label whole-batch versus checked-subset counts, assessment versus certification, actual versus planned, historical entered references versus verified seed identity and DEMO versus personal storage. Use client navigation for Open journal. Existing sowing action and generic notes stay supported.

Wire a read-only `JournalNurseryProgressSummary` into both the actual journal timeline and entry sheet. Show count, stage, coverage and historical labels, or an explicit evidence hold. Preserve existing exports' exact bytes when no progress property is selected; append conditional progress columns/HTML block when present. Distinguish observed day from planned nursery start, use canonical inspection/escaping, and never export held raw payload as checked facts.

## Ownership and verification

Model/export owner: field-journal.ts, journal-export.ts and two new progress model/export suites. Writer owner: grower-field-observation.ts, useGrowerWorkflow.ts and new writer suite. UI owner: new form/summary, SavedGrowerNurseryReviewPanel, actual FieldJournal/JournalEntrySheet, additive real shared test-loader mapping, new UI suite. Root owns parent callback/package/release source pairs/final review/checks/browser/Git. No overlapping writers.

Cover zero versus missing, explicit stages/coverage, subset versus availability, malformed/future/dual evidence, getter refusal, ordinary edit preservation, proposed/foreign/duplicate/stale membership, actor/sample/source/journal withdrawal, original intent across awaits, uncertain readback and real client navigation. Existing assertions remain intact. Run ordered Node24 typecheck, affected contracts, whitespace/release checks and actual desktop/phone save/readback/edit/history/download review. Persistence changes require full current-head CI and hosted/account gates before production merge. No PLAN_VERSION/species/lesson/geometry or invented agronomic values.


## Coordinator browser review — 5 November 2026

Ordered Node24 typecheck, all 594 affected checks across 44 files, whitespace and release gates passed on frozen product bytes. Separate lane checks covered the canonical model/export, real guarded writer/controller and actual form/history components. Removing the original-payload write guard or changing a subset to whole-batch coverage makes the corresponding fault control fail. All 16 parent legacy/sowing-only CSV/HTML fixture byte hashes remain unchanged.

Actual local desktop and 390-pixel phone QA used Samples → Open Farmer before any write. Synthetic engineering inputs produced an accepted nursery cycle on an unoccupied sample plot; existing bed occupation holds were respected. New date, note, count, assessment, coverage and confirmation began blank. Save remained disabled for blank and fractional counts; explicit 0 saved as an emerged/whole-batch observation. A separate phone entry recorded 3 plants as ready according to the grower and checked-subset only. Both observations retained their own observed dates, distinct from the planned nursery-start reference. Note editing preserved evidence; later variety-label changes left older labels unchanged. Opening the existing sowing form and switching to count worked without saving a sowing observation.

Actual journal readback, plot history, search, CSV and HTML downloads retained both separate counts, assessments, coverage and historical labels. The phone document stayed 390 pixels wide and its save target measured 230×44 pixels. Read-only history was visually inspected on desktop and phone. No count total, available-stock quantity or readiness certification was inferred.

This review used an isolated DEMO session, not authenticated hosted-account writes or full-reload sample persistence. Downloaded HTML content was checked; its printed layout was not visually rendered. Existing floating-helper/sticky-header overlap remains. Full current-head CI and the remaining hosted/account gates are required before production merge.
