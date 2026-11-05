# Record actual nursery sowing against a saved batch

This milestone extends the existing private field journal and its guarded own-cycle observation writer. It creates no second ledger, checklist completion, seed/stock/harvest movement, availability claim or planning calculation. The previous generic nursery-start note remains supported.

## User flow

On one checked saved accepted nursery batch, choose **Record nursery sowing**. Enter the actual observed calendar day, a note, and optionally a whole count of physical trays used (including partly filled trays). Leave the count blank for unknown or other containers; an explicitly entered zero remains zero. The date and quantity start blank, never copied from a planned day or estimate. Explicit confirmation is required.

Unsaved reference edits or an unchecked/held/proposed/foreign batch cannot admit this action. The observation snapshots the current checked variety, seed-lot and raising-batch reference labels; these remain entered labels, not verified seed identity. Later reference edits must not rewrite historical observations. The planned nursery-start date remains only in the existing source link; the observed day is solely `JournalEntry.date`.

After a confirmed append, show the existing journal outcome and an internal `/journal` client-navigation link. A document reload resets the disposable sample store, so this action must preserve the current sample session. Prevent duplicate submission for the same form intent. An uncertain receipt is never an automatic retry; tell the grower to inspect the journal. A deliberate new observation must be a new explicit form intent, with blank date/count/confirmation. Do not equate elapsed time or rerender with a successful receipt.

## Canonical journal model

Extend `JournalEntry` and `JournalEntryInput` with optional `nurserySowing?: unknown`, preserving original malformed/future JSON evidence through normalization and ordinary note edits rather than silently dropping it. Unsafe runtime descriptors retain a visible held marker without invoking getters. Reuse the existing JSON authority.

Export readonly `JournalNurserySowingObservation` with exactly:

```ts
{
  kind: 'nursery-sowing-observation';
  version: 1;
  traysUsed: number | null;
  references: {
    variety: string | null;
    seedLotReference: string | null;
    raisingBatchReference: string | null;
  };
}
```

`traysUsed` is null or a nonnegative safe integer count, not a full-tray equivalent or a seed/plant estimate. References are null or nonblank strings at most 120 characters without control characters; do not truncate malformed evidence into a different identity. Required own enumerable data fields only, exact shapes, no accessors/prototype aliases/coercion. These are storage/input rules, not agronomic figures.

Export `normaliseJournalNurserySowingObservation(value: unknown): JournalNurserySowingObservation | null` for shape inspection only. Export `inspectJournalNurserySowing(entry: unknown)` returning `{status:'legacy'}`, `{status:'observed', observation}`, or `{status:'held', reason:string}`. A present payload additionally requires a structurally valid existing `growerCycleLink` with `eventKind:'nursery-start'` and consistent bed; it cannot silently become a legacy/unlinked note. Historical display does not require the crop plan still to exist; current membership is a writer gate.

`normaliseJournal`, `createJournalEntry`, `editJournalEntry`, `inspectJournalRowsForWrite` and ordinary `saveJournal` must preserve the payload. Ordinary note editing must not introduce, replace or discard it. A new linked observation is appended only by the guarded checked writer. A malformed retained payload holds a lossy save rather than being normalized away. Legacy rows without this property stay supported, and unrelated raw metadata is retained.

## Single guarded append authority

In `lib/grower-field-observation.ts`, retain the exact existing three-field generic input behavior. Export `GrowerNurserySowingInput` with exactly `observedDate:string`, `note:string`, `traysUsed:number|null`, `confirmed:true`, and `recordGrowerNurserySowing(source, task, input, {isCurrent})` returning the existing `GrowerFieldObservationResult`.

Factor the existing private append pipeline rather than creating another storage writer. Reject malformed or accessor-backed inputs without executing getters; enforce the existing date/note authority plus explicit physical count. Only a current, uniquely resolved own accepted `nursery-start` task may create this payload. Resolve current reference labels with the existing nursery reference authority and copy them into the payload; never trust caller-supplied label snapshots. Check whole-book membership, exact scope/bed/event, actual actor/account/sample, original/current raw book/design and journal receipts before writing and during readback. Preserve existing sample and personal storage separation, collision/budget holds and unconfirmed-write behavior. No side effects to stock, production or task ticks.

## Saved-batch controller and UI

Extend `useGrowerWorkflow` with `onRecordNurserySowing(view, plantingId, input, displayedIsCurrent)`. It must require the original private saved-view binding, current checked source/book/actor and exact target in `view.references`. Load fresh operations sources with the original revocation guard; find exactly one corresponding generated nursery-start task in the correct scope and delegate to the same checked writer. No synthetic caller task, new admission bypass or dirty-book rebase. Preserve the original displayed form epoch throughout awaits.

`SavedGrowerNurseryReviewPanel` accepts an optional callback with that signature for compatibility; the real parent supplies it. Only a clean current eligible saved row offers a form. Source/reference/sample/revision changes withdraw the original form's write intent; retain earlier unsaved text separately if useful, never apply it silently to another source. Block reentrant/stale callbacks and repeat append after saved/unconfirmed outcome. The field journal's actual entry view displays the read-only observed count/reference snapshot or an explicit hold. Use existing routes and styling, 44-pixel targets and a readable phone layout.

## Evidence required

Existing journal CSV/HTML downloads must not omit the new observed facts. Preserve legacy-only export bytes. If selected rows contain a nursery payload, CSV appends observation status, physical tray count, three recorded reference labels and planned nursery-start UTC date; legacy rows have empty extras, missing observed values stay explicitly unknown and zero stays zero. HTML adds an escaped read-only observation block only for these rows. Held evidence is labelled for review without exporting raw malformed payloads as checked values. Reuse existing CSV formula/HTML escaping and the canonical inspector; no live-plan lookup or second validator.

Independent model, writer/hook and real component/parent tests must distinguish missing/zero, planned/observed, current/forged/proposed/duplicate/stale membership, unsafe getters, account/sample/source/journal changes, malformed-history preservation and uncertain readback. Existing assertions stay intact. Root registers new suites, runs ordered typecheck/affected checks/whitespace/release gate, reviews actual desktop/phone journal save/readback, and records exact source hashes/CI/PR evidence. Persistence changes require full current-head CI and hosted/account checks before production merge. No PLAN_VERSION, species, calibrated lessons or measured geometry changes.


## Coordinator browser review — 5 November 2026

Actual local desktop and 390-pixel phone checks used the normal Samples → Open Farmer practice workspace. All inputs were explicitly fictional engineering examples, not crop recommendations. A grower estimate and buyer target produced one accepted nursery cycle on an available sample plot; existing bed-occupation holds were retained. The checked saved batch supplied entered reference labels.

Two observations saved and read back through the actual journal: an observed day of 5 November with zero physical trays, and 4 November with the tray count blank/Unknown, both distinct from the planned 10 November nursery start. Editing the first note preserved its payload. Changing the batch variety label before the second observation left the first historical label unchanged. Plot history and search found the saved records. Actual filtered CSV and HTML downloads retained both counts, historical labels and separate dates; legacy-only export byte checks remain covered separately.

The first browser pass exposed a plain journal anchor resetting the sample store on full navigation. The corrected client link was exercised through actual saved observation → journal navigation and readback. A real Next Link/router regression covers that failure. The phone form's save target measured 44 pixels high and the document stayed 390 pixels wide. Existing floating-helper/sticky-header overlaps were not changed.

This is a local demonstration-session review, not an authenticated hosted-account test or full-reload sample-persistence claim. Downloaded HTML content was checked; its printed layout was not visually rendered. Full current-head CI and the remaining hosted/account gates are required before production release.
