# Bounded Tend Market-Gardener Workflow Comparison

**Date:** 2026-11-03
**Scope:** Comparative review of documented public claims from Tend against ImbewuField's grower workflow contracts and core planning modules.
**Audience:** Smallholder diversified market gardeners, food-security initiatives, and agroecology projects.
**Evidentiary Standard:** Tend claims reflect public marketing and changelog text, not authenticated product testing. ImbewuField status reflects inspected source contracts; a source read is not an independent test run.

---

## 1. Documented Primary Source Summaries

### 1.1 Tend Visual Crop Planner
* **Source:** `https://www.tend.com/feature/visual-crop-planner` (HTTP 200, Receipt `tend-crop-planner`, read 2026-11-03T00:48:25.788146+00:00).
* **Summary:** Tend claims automated crop plan generation from growing templates, calculating space, materials, yield, and revenue. It advertises drag-and-drop bed allocation with space utilization feedback, multi-season plan duplication, and cascading date recalculations. It also claims automatic seed and transplant list calculations factoring in germination and loss rates.

### 1.2 Tend Task Management
* **Source:** `https://www.tend.com/feature/task-management` (HTTP 200, Receipt `tend-task-management`, read 2026-11-03T00:48:25.788444+00:00).
* **Summary:** Tend claims tasks auto-generate from customizable templates upon planting creation, with date adjustments instantly rescheduling linked work. It advertises mobile logging for labor, inputs, and harvests, updating compliance records upon task completion. The platform also claims tools for labor/yield comparisons, timesheet tracking, and harvest coordination.

### 1.3 Tend Fresh Features Changelog
* **Source:** `https://www.tend.com/freshfeatures` (HTTP 200, Receipt `tend-fresh-features`, read 2026-11-03T00:48:25.788584+00:00).
* **Summary:** Tend's public changelog documents updates through October 2026. Documented features include multi-stage nursery tracking (growth stages, pot-up tracking, loss rates), field versus current location tracking, organic certification classifications on maps, and inventory overselling protection. It also claims mobile offline location assignment, QR codes for traceability, multi-week delivery windows, and AI purchase order processing.

---

## 2. Capability Mapping: Documented Claims vs. ImbewuField Implementation

| # | Capability Area | Documented Tend Claim | ImbewuField Status | Architectural Boundary & Gap Analysis |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Target-to-Bed Space Allocation** | Auto-calculates required bed space and placement from templates. | **Implemented**: Pure engine (`grower-autoplan.ts`, `grower-workflow.ts`) converts buyer targets to bed space. | Strictly enforces unassessed legacy occupancy blocks; proposals remain detached and unaccepted. |
| **2** | **Nursery Staging & Loss Modeling** | Generates seed and transplant lists factoring in germination, losses, and containers. | **Implemented**: Pure adapter (`grower-nursery.ts`) computes tray and cell demand from explicit grower inputs. | Inputs start blank; supports direct vs transplant. Headroom remains unknown with unresolved competing occupancy. |
| **3** | **Measured Geometry Binding** | Map and bed controls for location assignment; field certification boundaries. | **Implemented**: Source contract (`grower-workflow-source.ts`) binds planning strictly to measured bed dimensions and calibrated polygons. | Geometry is presentation over measured ground truths; invalid bed dimensions block availability. |
| **4** | **Proposal Acceptance to Canonical Plan** | Plantings are added directly to active crop plans upon creation. | **Not Implemented (Gap)**: Engine produces detached `GrowerWorkflowReview` proposals; saving to plan book is withheld. | Tend operates directly on live records; ImbewuField isolates unverified proposals from saved rows. |
| **5** | **Lifecycle Task Derivation** | Tasks auto-generate from templates when plantings are created; date shifts cascade. | **Integration Gap**: Core app implements task board (`lib/task-board.ts`) and journal links (`lib/task-record-link.ts`), but auto-plan cycles do not yet derive tasks. | App task engine exists; missing bridge from new auto-plan cycles to canonical task board without parallel ledgers. |
| **6** | **Harvest Fulfillment Reconciliation** | Coordinates harvest planning against customer orders, field availability, and inventory. | **Integration Gap**: Core app implements harvest reconciliation (`lib/harvest-reconciliation.ts`) and buyer targets (`grower-harvest-demand.ts`), but they are not linked. | App reconciliation exists; missing direct connection between new buyer-demand targets and existing harvest logs. |
| **7** | **On-Hand Seed & Input Inventory** | Compares required seeds against on-hand inventory lots to generate purchase orders. | **Not Implemented (Gap)**: The inspected nursery workflow computes gross demand without an on-hand seed-lot ledger. | Tend integrates inventory transactions; ImbewuField avoids inventory accounting without verified local stock. |
| **8** | **Observed Actuals & Variance Logging** | Mobile logging of actual harvest yields, termination reasons, and pest observations. | **Integration Gap**: Core app implements monthly actuals (`lib/production-records.ts`), but new cycle projector does not consume them. | App actuals exist; missing feedback loop from observed records to cycle projection without duplicate stores. |

---

## 3. Ranked Concrete User-Visible Milestones

*Priority Note:* Ranking reflects engineering dependencies in current contracts, not customer surveys or commercial commitments.

### Milestone 1: Controlled Proposal Acceptance into Canonical Plan Book
* **Outcome:** A grower reviewing an auto-plan proposal can accept the reviewed set of crop cycles, appending them as persistent canonical plantings with unique IDs.
* **Dependency:** Revalidates current account, source design, canonical book, and existing reservations before appending; rejects stale reviews without re-running planning.

### Milestone 2: Automated Lifecycle Task Derivation from Accepted Cycles
* **Outcome:** Once accepted, the system derives dated operational task entries (nursery start, field entry, harvest start, termination) into the existing canonical task board (`lib/task-board.ts`).
* **Dependency:** Bounded strictly to explicit cycle intervals from `grower-cycle.ts`; does not invent weeding or other uncalibrated agronomic timings.

### Milestone 3: Field Actuals Logging & Succession Horizon Review
* **Outcome:** Connect observed records to explicit review of downstream bed impacts. Existing monthly production summaries do not store sowing or transplant dates; that schema integration remains required.
* **Dependency:** Requires explicit review of schedule effects; avoids silently cascading subsequent saved work or introducing duplicate stores.

---

## 4. Architectural Boundaries & Guardrails

1. **No Parallel Ledgers:** Attach directly to existing task, production, and reconciliation modules (`lib/task-board.ts`, `lib/production-records.ts`, `lib/harvest-reconciliation.ts`).
2. **Diversified Focus:** Preserves usability for smallholder market gardens and agroecology rather than industrial monocultures.
3. **No Fabricated Validations:** Bounded to inspected sources; no customer interviews or funder promises are inferred.
