# Harvest weight entry and shared confirmation boundary

This branch builds on nursery head `b1df0d1ac441b36f515029ed4e902cc8720041e5`
(draft PR #1180). It is an international market-garden milestone, with production
release still pending the prerequisite stack, current-main integration and gates
below. No worldwide crop suitability or local farming approval follows from a
weight-unit choice.

## Product scope

Harvest-target forms accept kilograms or avoirdupois pounds for weekly harvest
weight and the grower's optional weight per produce pack. Canonical `weeklyKg`
and `kgPerUnit` remain kilograms. Produce-pack counts, saleable share, target
months, crop identities and observed records retain their existing meanings.
Missing pack weights stay missing; the app supplies no standard box/bunch/tray
weight. Own-record planning never becomes a catalogue forecast because a unit
changed.

The new mass facade reuses the existing plain-decimal parser, nonzero-safe display
formatter and staged canonical draft kernel. Field and nursery public unit sets
and contracts remain closed. The exact pound factor is `0.45359237 kg` from NIST
SP 811 footnote 22, not the rounded table value. Reverse display is derived;
unit toggles never reparse rounded labels or rewrite saved values.

A physical-equivalence regression was necessary: ordinary binary multiplication
put a newly entered ten-pound target one ULP above independently entered
`4.5359237 kg`, producing two cycles instead of one at a synthetic capacity
boundary. Forward conversion now uses the existing decimal-product authority.
Both new entries produce one cycle/eight positions in the actual own-demand
planner fixture. A genuinely higher, previously saved extra-precision value stays
exact and still requires two cycles/sixteen positions. This prevents an epsilon,
global rounding or silent-data-migration substitute from passing the check.
These are engineering fixtures, not recommended farm quantities or yields.

## One save authority

Nursery and harvest inputs share one parent actor/sample/site/scope lifecycle,
closed field-bound context/request/result proofs, and actual canonical write plus
admitted readback. The existing scoped namespace merge remains the authority.
Both actual harvest callers and all edit/delete actions use the checked path;
legacy booleans/void are not device-save confirmations. Cross-field substitution,
collateral book changes, foreign-row edits and uncertain writes cannot acquire a
matching confirmation or trigger automatic duplicate retry. A matching sample
confirmation clears only its own sample draft with memory-only wording.

Two target namespace comparisons now use the existing descriptor-safe source
identity with explicit non-null checks. The causal sample probe showed that
object-key insertion order alone rejected valid-ready sample data. Array order,
field values, unknown metadata, original admission/token and writer guards remain
separate evidence; no sanitizer/count equality substitutes for them. Existing
nursery namespace comparisons and planner-cycle acceptance remain unchanged.

Both editors also replace the inherited permanent source-key grant with a
one-shot original result/request handoff. Before probes failed for prior success
followed by dirty input and a same-bytes lease replacement. Immediate valid
postwrite context leaves no reusable grant; delayed adoption revalidates the
actual confirmed source/token/lease once. Cold pristine arrival and valid original
context aliases remain usable; retained dirty input is not fresh authority.
The frozen prerequisite nursery tree is unchanged; this child correction must be
included before releasing that inherited editor behavior.

## Verification and translations

Three lanes froze nineteen owned files. Actual ordered lane checks were 123/123
across eight core/calculation files, 222/222 across fourteen UI/affected files,
and 154/154 across ten parent/storage files, each after Node 24 typecheck and
before whitespace checks. Counts overlap and are not summed. Independent bounded
review matched all nineteen hashes before and after and ran 78/78 across four
mounted/in-memory suites without findings in that scope. Original parent and
nursery assertion inventories were retained; obsolete target-record setup and
save-certainty claims were updated with real actor/storage/receipt dependencies
and stronger uncertainty/reload controls. The coordinator then ran a distinct combined set: Node 24 typecheck exit 0,
360/360 tests across 26 files (zero failures/skips/TODOs), then whitespace exit 0. Three new suites are registered
once without dropping existing test-file arguments.

A fixed-set impact probe of the shared kernel found no bed/cycle/nursery budget
outcome difference in its tested field/nursery paths. It is bounded evidence,
not a universal floating-point equivalence claim.

AGY's 126 global labels (18 each French, Spanish, Brazilian Portuguese, Swahili,
Hindi, Bengali and Indonesian) passed exact source/hash/unit checks and fifteen
damaged-packet controls. They remain unselected AI candidates. Twenty clarified
release/update-tour descriptions (five each isiZulu, Sesotho, Xitsonga and
Tshivenda) were selected into the existing disclosed AI-draft description tables,
with inherited bytes preserved and fourteen damaged controls rejected. The
superseded English revision's twenty candidates were never selected. Generation
packets retain historical `runtimeActivation: false`; selection does not confer
human/fluency approval or add a runtime language. Final text/hash reconciliation
is separate from original frozen-source provenance. Research contracts describe
their historical source heads, not current implementation status.

## Required release gates

This changes harvest forms and nursery reconciliation behavior. Populated desktop
and phone appearance, real account/save/reload/export, two-tab/offline/BFCache and
prerequisite/current-main integration remain unverified. Browser use is explicitly
disabled; no workaround or temporary preview server was started. Earlier views of
other builds do not validate this screen.

Current-head full tests/security/render/preview checks and actual browser review
are required before production. The prerequisite nursery full native suite finished in its frozen checkout: all
681 original test-file arguments, 6,951 total/6,950 pass/zero failures/one existing
shape-sync TODO, ordered typecheck/tests/whitespace exit 0. That result does not
cover this child tree. No production merge/deploy, `PLAN_VERSION`, plant
species, calibrated lesson/quiz/narration, agronomic default, or render-time saved
geometry change is claimed by this milestone.
