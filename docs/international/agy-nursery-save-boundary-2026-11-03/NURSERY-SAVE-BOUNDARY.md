# Nursery Producer Save Boundary Contract

## 1. Inspected Scope (`844e4a1bc`)

- Repo-relative sources (full-file/AST-extract bytes/SHA256 in `status.json`): `app/facilitator/crops/page.tsx` (extract), `lib/crop-plan.ts` (extract), `lib/crop-plan-storage.ts` (complete), `docs/international/agy-nursery-unit-entry-2026-11-03/NURSERY-UNIT-ENTRY.md`.
- Unshown imports/normalizers (`activeAccountUid`/`isSampleMode`/`isBackendConfigured`/`getFirebase`, `loadCropPlanWithWriteAdmission`/`cropPlanWriteAdmissionMatches`/`cropPlanWriteToken`/`cropPlanWriteCandidateIsLossless`, `copyCropPlanAuthoredData`/`cropPlanStorageValue`/`sampleCropPlanSnapshot`/`setSandboxCropPlan`) are `UNKNOWN`.

## 2. Actual Callers and Save Chain

- **Callers (`app/facilitator/crops/page.tsx`)**: Both `nursery-equipment:${productionSiteId}` (`allowCatalogueForecast={false}`) and `nursery-plan:${productionSiteId}` (`showBuyingCalendar={!simple}`) pass `onSettings={nursery=>saveScopedGrowerInputs('nursery',nursery)}`.
- **`saveScopedGrowerInputs('nursery',value)`**: Requires `plan`, `productionSiteId`, `!planSaveConflict`, `growerActorIsCurrent()` (`growerBookContext.current` + `plannerActorIsCurrent`), `planWriteBase.current` matching `JSON.stringify(plan)` and `cropPlanWriteAdmissionMatches`, non-null `cropPlanWriteToken()`, and fresh `loadCropPlanWithWriteAdmission()` with matching token/admission and `fresh.updatedAt>=plan.updatedAt`. Enforces `cropPlanWriteCandidateIsLossless` before/after `sanitiseNurserySettings`, requires unchanged `sourceIssues`, `heldInputs`, and foreign-site rows (`siteId!==productionSiteId`), requires stored own-site rows matching `plan.nursery`, merges `[...other(current),...own(rows)]`, re-verifies actor/base/token/lossless guards, clears `saveTimer.current`, and calls `saveCropPlanWithReceipt(next)`. On `receipt.saved`, runs `rememberStoredPlan(next,receipt.token)` and `setPlan(next)`; returns `receipt.saved`.
- **`saveCropPlanWithReceipt` & `writeCropPlanStorageRaw`**: Re-verifies ready admission, lossless `cropPlanStorageValue`, actor/sample, and `cropPlanWriteToken()===loaded.token`. Sample mode writes in-memory sandbox state (`setSandboxCropPlan`), never `localStorage`. Device mode requires `!context.sample`, no review/transfer hold, `ownsLease(context)`, `authoredEnvelope(bookRaw)`, and unchanged pre-write `capture(context)` before `storage.setItem(canonicalKey,raw)`, returning `writeToken(context,{...before,canonical:raw},lease)`. Both modes wrap `CROP_PLAN_CHANGED_EVENT` in inner `try/catch` so notification throws never return `saved:false`. Possible after-write failures include a throwing mutator or token construction; this is non-exhaustive because unshown mutator internals are `UNKNOWN`. `saved:false` is not a no-mutation guarantee. Yet `writeCropPlanStorageRaw` lacks post-`setItem` readback, and `saveScopedGrowerInputs` returns `true` even if `rememberStoredPlan` mismatches `receipt.token`/admission (`setPlanSaveConflict(true)`).

## 3. Minimal Authority Reuse

- Reuse `growerBookContext`/`planWriteBase`/`cropPlanWriteAdmissionMatches`/`loadCropPlanWithWriteAdmission`/`cropPlanStorageLeaseMatches`/`nurserySettingsFingerprint` (no duplicate store).
- Capture detached `{owner,sample,siteId,scopeKey,baseToken,leaseProof,targetFingerprint}` at submit. Withhold private drafts on context change. Retain drafts after unconfirmed attempts without automatic duplicate retry or "unchanged storage" claims; clear only when `growerActorIsCurrent()` matches the captured context, `receipt.saved` is `true`, and `rememberStoredPlan`'s readback confirms `loaded.token===receipt.token`, matching admission/lease, and `targetFingerprint` (sample receipts clear only matching sample drafts with memory-only wording).

## 4. Proposed Negative Requirements (Not Executed)

1. Altered foreign-site rows/`sourceIssues`/`heldInputs` or concurrent own-site changes must return `false`, preserve foreign namespaces, and hold dirty drafts.
2. `receipt.saved===true` with post-write `planSaveConflict` (`loaded.token!==receipt.token`), or sample-memory saves (`sample===true`), must not clear device-bound drafts or claim confirmed device persistence.
3. Actor/sample/`siteId`/`scopeKey` switches or `false`/thrown/unconfirmed saves must withhold prior private drafts, block duplicate retries, and never claim pre-write atomicity after possible writes.
