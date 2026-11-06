# Grower-Owned Cycle Consumer Integration Map

Inspection bound to `fbe546d6c30c79e584981bbdf82d7cfada5b6363` across the ten named authorities. This map prepares the acceptance of grower-owned dated cycles into canonical crop plans while safeguarding existing consumers. Own profiles reuse existing crop identity keys; no custom crop or species keys were added.

## 1. Consumer Impact Matrix

| Consumer / Export | Legacy Assumptions | Admits Own Cycles | Exact Authority to Use | Failure if Accepted Now |
| :--- | :--- | :--- | :--- | :--- |
| `tasksForPlan`<br>`lib/crop-plan.ts` | Assumes 1–12 calendar month offsets (`p.sowMonth`), catalogue definitions (`cropByKey`), and verified timing. | **No**.<br>Line 1167 explicitly skips: `if (hasGrowerCycleMarker(p)) continue;`. | `resolvePlantingBasis` (`lib/international/grower-cycle.ts`) and `plannedEvents` (`lib/international/grower-cycle-projection.ts`). | Silently drops accepted cycles, producing zero tasks for the grower. |
| `buildCropBoardTasks`<br>`lib/task-board.ts` | Validates `sowMonth` as safe integer 1–12 (lines 247–248); delegates to `tasksForPlan`; formats titles via catalogue names. | **No**.<br>Inherits `hasGrowerCycleMarker` skip and enforces integer `sowMonth`. | `projectGrowerCycles` (`lib/international/grower-cycle-projection.ts`) and `BoardTask` contract. | Operational task board displays nothing for accepted cycles; daily work schedule remains blind to active cycles. |
| `buildCropPlanIcs`<br>`lib/crop-calendar-ics.ts` | Consumes `tasksForPlan` outputs; collapses events to day 1 of resolved month (`resolveCropTaskDate`); formats titles via catalogue. | **No**.<br>Inherits `tasksForPlan` exclusion; lacks mapping for direct cycle events. | `plannedEvents` in `lib/international/grower-cycle-projection.ts` (`nurseryStartDate`, `fieldEntryDate`, etc.). | Exported `.ics` calendar omits own direct cycle phase events, or flattens dated milestones to 1st-of-month placeholders. Own cycles supply direct phase transitions, not catalogue prep/maintenance tasks that were never given grower timings. |
| `intendedKgByCropCycle` / `buildPlanYieldBenchmark`<br>`lib/harvest-reconciliation.ts`<br>`lib/crop-plan.ts` | `buildPlanYieldBenchmark` computes catalogue yield per m²; when any marked cycle is present (`heldGrowerPlantings.length > 0`, line 1487), sets `held: true` and `knownKg: null`. | **No**.<br>Deliberately holds benchmarks as unknown/null rather than integrating cycle capacity. | `GrowerReadyAssessment.capacity` (`estimatedYieldKg`, `measuredAreaM2`) via `resolvePlantingBasis`. | Intended harvest benchmark is deliberately withheld (`knownKg: null`), returning an empty map and withholding comparison rather than reflecting cycle capacity. |
| `loadCropPlan`<br>`lib/crop-plan.ts` | Preserves raw attachments via `preserveGrowerCycleMarker` by design; manages legacy lifecycle flags (`once`, `existing`). | **Partial**.<br>Preserves raw attachment in storage, but does not provide derived-context admission. | `resolvePlantingBasis` (`lib/international/grower-cycle.ts`) requiring current `GrowerCycleContext`. | Saved attachments remain unoperated because downstream consumers lack live `GrowerCycleContext` admission; stale or modified geometry holds rows rather than operating them. |
| `parseTaskJournalQuery`<br>`lib/task-record-link.ts` | Resolves crop identity via `cropByKey` (line 35); validates action against fixed catalogue action list; accepts bed ID without cycle identity. | **No**.<br>Does not associate query parameters with cycle or demand IDs. | `TaskJournalDraft` contract and `resolvePlantingBasis`. | "Log task" links create detached notes without cycle identity; cannot track work against specific cycle cohorts. |

## 2. Smallest Safe Next Implementation Slice

Static inspection of authorities confirms boundaries; testing remains an implementation concern for the coordinator.

- **Slice 1: Revalidation & Acceptance Authority Extension**:
  - Extend existing `createGrowerCyclePlanting` (`lib/international/grower-cycle.ts`) and controller assembler (`lib/international/grower-workflow.ts`) rather than inventing an overlapping acceptance constructor.
  - Live Firebase account binding, fresh reads, and late-response guards are controller responsibilities; pure helpers cannot verify live account identity.
  - Re-verify `geometryFingerprint`, scope, and half-open reservation conflicts `[fieldEntryDate, nextFieldEntryDate)`.
- **Slice 2: Cycle-Aware Task Projection (`tasksForPlan` & `buildCropBoardTasks`)**:
  - Update `tasksForPlan` to evaluate `resolvePlantingBasis`: emit discrete dated tasks from `plannedEvents` (nursery start, field entry, picking, field clear) for valid cycles, distinguishing direct phase events from catalogue cultivation tasks.
- **Slice 3: Connected Controller & State Integration**:
  - Coordinate persistence and live derived-context admission in the controller layer.

## 3. Records Schema Alignment & Remaining Work

- **Monthly Summaries**: `DatedProductionRecord` (`lib/production-records.ts`) records aggregate monthly figures (`date: { year, month }`). These summaries are not dated daily sowing/transplanting/clear observations and cannot represent cycle milestones.
- **Journal Linkage**: Future journal linkage is a proposal, not a validated implementation or proof that optional query IDs create authorised links.
- **Profile Keys**: Own profiles reuse existing crop identity keys; no custom crop or species keys were introduced.

## 4. Required Negative Acceptance Tests

These three negative acceptance tests are requirements for the coordinator's implementation slice, not executed checks in this handoff:

1. **Stale Design Geometry Rejection**: If saved bed dimensions or calibrated polygons are modified between proposal review and acceptance click (altering `geometryFingerprint`), acceptance must be rejected and require re-planning.
2. **Account/Scope Switch Rejection**: A live Firebase or mounted-account change must prevent the controller write. A changed site/scope must independently fail pure assembly; pure helpers do not prove live identity.
3. **Conflicting Reservation Rejection**: If a concurrent cycle or manual allocation is committed to the same bed during the proposed cycle's window `[fieldEntryDate, nextFieldEntryDate)`, acceptance must block without overwriting ground.

Coordinator implementation note: the operations branch extends the task board with an explicit context-bound dated-cycle builder while keeping month-only catalogue tasks separate. The shared projector remains the date authority. This is an implementation choice after this source inspection, not AGY-delivered code.
