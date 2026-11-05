# Buyer-target parent and shared confirmation contract

## Inspected scope

Committed head `b1df0d1ac441b36f515029ed4e902cc8720041e5`: complete `components/crops/HarvestTargetsPanel.tsx` and `lib/nursery-save-receipt.ts`, partial `app/facilitator/crops/page.tsx` AST extract (callbacks, nursery lifecycle, authority/context effects, two `HarvestTargetsPanel` callers), and `docs/international/agy-harvest-target-mass-entry-2026-11-03/HARVEST-MASS-ENTRY.md`. Byte/SHA256 identities are in `status.json`. Unshown autosave/storage-readiness internals are UNKNOWN; `lib/nursery-save-receipt.ts` is nursery-only.

## Callers and current paths

`app/facilitator/crops/page.tsx` mounts two `HarvestTargetsPanel` callers for `productionSiteId`, `targets={plan?.harvestTargets??[]}`, void `onTargets={targets=>{saveScopedGrowerInputs('harvestTargets',targets);}}`, and `onSaveTargets={targets=>saveScopedGrowerInputs('harvestTargets',targets)}`:
- `own-records` (`key="own-targets:${productionSiteId}:${growerScopeKey}"`, `climate={{}}`, no `nurserySettings`, no-op `onAccept`).
- `catalogue` (`key="harvest-targets:${productionSiteId}:${planningScopeKey}"`, `nurserySettings={plan?.nursery}`, site `climate`; `onAccept` stages sowings in memory via `setPlan(previous=>stageSuggestedPlanHistory(...))` when `currentPlanningScopeAllowed()&&!hasOwnRecords`; autosave internals UNKNOWN, `onAccept` redesign unauthorised).

In `HarvestTargetsPanel.tsx`, `saveTarget` and `own-records` `removeTarget` call `persist(next)`, treating boolean `true` as device-saved (including sample mode) and claiming unchanged storage on `catch` without proof. Catalogue Trash deletes call `onTargets` directly, bypassing `persist`/`onSaveTargets`, ignoring failure, and resetting form state; catalogue Edit skips `editTarget`, keeping stale `saveStatus`.

For `'harvestTargets'`, `saveScopedGrowerInputs` checks `growerActorIsCurrent()`, `planWriteBase.current`, `cropPlanWriteToken()`, and `loadCropPlanWithWriteAdmission()`, verifies `cropPlanWriteCandidateIsLossless` before/after `sanitiseHarvestTargets(value)` plus separate `rows.length===value.length` count guard, requires unchanged foreign-site `value` and own-site `fresh` slices while rebasing `fresh` foreign rows, clears `saveTimer.current`, and calls `saveCropPlanWithReceipt(next)`. Unlike `nurseryRequest`, it runs `rememberStoredPlan(next,receipt.token)` and `setPlan(next)`, returning boolean `receipt.saved` even after `planSaveConflict`, without readback-book verification or request binding. Booleans never prove auth/rollback.

## Proposed shared confirmation

Extend `lib/nursery-save-receipt.ts` and `saveScopedGrowerInputs`—reusing auth/epoch listeners, namespace merge, normalizers, `WeakMap` proof registries, and writer—to bind closed field `'nursery'|'harvestTargets'`:
- **Distinct proofs/readback**: Nursery checks `sourceIssues`/`heldInputs` and merges `spaces`/`containers`/`profiles`; `'harvestTargets'` separately requires candidate/normalizer `cropPlanWriteCandidateIsLossless`, `rows.length===value.length` count guard, and detached payload/own-site slice (`row.siteId===siteId`) match. Both separately verify original raw `base`/admission, `fresh` token/admission (allowing `fresh` foreign-only rebases when own-site storage matches `expected` and `fresh.updatedAt>=plan.updatedAt`), and `commit...Request` write/admitted readback (`confirmed.token===receipt.token`, admission, lossless, `dataKey(candidate)===dataKey(confirmed.book)`, own-site slice). Cross-field payload/receipt substitution fails.
- **Lifecycle/one-use clear**: Route `saveTarget`, `removeTarget`, and catalogue Trash deletes through one request-bound `persist` boundary (and shared `editTarget`). Installing `confirmed.book`/`token`/`admission` into `planWriteBase.current` and `nurseryProducerLive.current` replaces pre-write base; one-use `ResultMatches` verifies that installed confirmation (`'device'|'sample'`) while `ResultSourceKey` adopts post-rebase readback `sourceKey`. Cold context arrival binds only pristine editors, never authorising unbound dirty input; same-source reissue requires current original authority/base/provenance, while replacement leases/bases or source changes follow existing revalidation/hold/reload rules (retained drafts grant no write authority) and actor/sample/`siteId`/scope changes withhold drafts. Only `'device'` claims device save; matching `'sample'` clears only own sample drafts with memory wording. `'held'`/`'performed-unconfirmed'`/`false`/`void`/throw retains drafts, blocks automatic retry after attempted writes, without rollback claims.

## Proposed negatives — NOT EXECUTED

1. Cross-field (`'nursery'`/`'harvestTargets'`), boolean/token-forged, or reused confirmations must fail without clearing drafts.
2. Catalogue Trash deletes, foreign-site edits, dirty edits on cold/replaced leases, or actor/sample/`siteId`/scope/source transitions must never bypass confirmation, alter foreign rows, or leak drafts.
3. Sample confirmations must never claim device persistence or clear device drafts; unconfirmed/thrown writes must retain drafts without automatic retry or no-mutation claims.
