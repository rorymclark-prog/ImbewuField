# Nursery unit entry and confirmed-save boundary

This branch extends field-unit head `844e4a1bcbf9d1b25d5cc7b747ea22f88e1f727e`
(`codex/international-field-block-units`, draft PR #1177). International production
release is pending; the underlying stack still needs current-main integration and
its own release gates. No production merge or deployment is claimed here.

## Customer-visible scope

Nursery equipment forms offer centimetres/inches for tray sides and square
metres/square feet for net usable growing surface. They use the existing plain
decimal grammar and retain staged canonical centimetres/square metres across
unit toggles. Optional unknown dimensions and ownership stay unknown; explicit
zero stock and zero usable surface stay zero. Counts, crop identities, dates and
the grower's propagation assumptions retain their existing meanings. Choosing
units does not approve a crop for a country or infer a standard tray/pack size.

Saved nursery settings continue into the existing nursery forecast and automatic
crop-planning calculations. Conversion tests compare actual canonical settings,
footprints, demand and own-cycle quantities, rather than introducing a second
nursery calculation authority. Exact NIST factors, direction and float limits are
recorded in `NURSERY-DIMENSION-UNITS.md`; no mass/ounce entry is implemented here.

The remembered nursery choice has its own closed account-scoped purpose within
the existing preference/context authority. Sample preferences and confirmed
sample saves are memory-only. Actor/sample changes withhold old private fields.
A late initial producer context, a replacement lease or a newer same-site source
cannot silently grant authority to earlier unbound edits.

The actual parent uses its existing nursery namespace merge, followed by an
original-request-bound canonical write and admitted readback. Only its matching,
one-use confirmation clears the saved form. A legitimate foreign namespace
rebase uses the actual confirmed source and preserves another open form. Pending,
legacy boolean/void, thrown and performed-but-unconfirmed outcomes retain entries;
uncertainty never becomes a no-mutation claim or an automatic duplicate retry.
The existing harvest-target boolean path remains a separate future boundary.

A delayed native share cannot start a download fallback after its original
context is withdrawn. The optional delivery guard preserves existing unguarded
callers and does not claim an already-started native share can be undone.

## Evidence and provenance

Three implementation lanes froze exact owned-file hashes. Independent review
matched all thirteen UI/parent file bytes before and after its actual mounted and
in-memory checks: **39/39**, no findings in that bounded scope. This executes
production handlers/effects and real canonical storage helpers in isolated
fixtures, not a whole browser/account session.

Two concrete integration gaps were reproduced and corrected: confirmed foreign
nursery rebases stranded another dirty form, and the real effect-driven initial
producer context arrived after the editor's first render. Regressions cover both.
Existing equipment/navigation assertions remain; their setup now supplies actual
actor/storage/receipt dependencies. Old false/void wording was replaced with the
stronger uncertainty, retained-entry and no-duplicate-write rule, including a real
write whose acknowledgment is deliberately withheld.

Four new test suites are registered exactly once in the package command. The
coordinator then ran Node 24 typecheck and **299/299 checks across 26 distinct
files**, with test concurrency limited to two. Full-suite/current-head CI remain
separate pending gates; individual lane counts overlap and are not summed into
that combined total.

AGY supplied 126 global nursery-label drafts (18 each French, Spanish, Brazilian
Portuguese, Swahili, Hindi, Bengali and Indonesian), checked against exact frozen
English/message/file hashes and fourteen damaged-packet controls. Hindi's extra
availability claim for owned equipment was removed. These global packets remain
unselected AI candidates, with no new runtime language or fluency approval.

Separately, 24 exact nursery release/update-tour description pairs (six each
isiZulu, Sesotho, Xitsonga and Tshivenda) were selected into the existing disclosed
AI-draft update tables. Ambiguous inch/square-foot/zero-stock wording was corrected
before selection. Every inherited table byte outside the insertion is preserved.
Their generation packets keep historical `runtimeActivation: false`; this
coordinator selection is limited to the existing description surface and is not
human or fluent review. The original release English is unchanged by a later SHA
restamp; any final source-file hash reconciliation is recorded separately.

## Required release checks

This changes nursery forms and tables. Actual desktop/phone appearance is
**unverified**: the browser inventory probe reports browser use disabled in Work
settings. No browser workaround or local preview server was started for this
milestone. Earlier empty-state views and older PDF pages do not verify this UI.

Before production release: complete current-head typecheck/full tests, security
and render checks; integrate/revalidate current main and the prerequisite stack;
inspect populated desktop/phone entry, save/reload, account/sample switching,
second-form retention, two-tab/offline/BFCache behavior and real file delivery.
Keep human language review and country/crop-source readiness separate. No
`PLAN_VERSION`, species, calibrated lesson/quiz/narration, agronomic figure or
rendered saved-geometry change is made by this milestone.
