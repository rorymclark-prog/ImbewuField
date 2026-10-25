# Projection PDF translation batch — local verification complete

This branch adds 55 source-bound draft rows after the 561-row graph parent (#1107).
The combined registry has 616 rows. isiZulu, Sesotho, Xitsonga and Tshivenda remain
unreviewed drafts; guidance, other screens and whole-app translation work continue.

On 25 October 2026, Node 24 completed the required checks in order:

1. `npx tsc --noEmit`: passed.
2. Full `npm test`: 5,786 passed, zero failed, one existing shape-sync TODO;
   5,787 total tests across 565 registered files.
3. `git diff --check`: passed.

All 139 source/test/fixture/document-JSON inputs in [required-checks.json](required-checks.json)
remained unchanged through the terminal run and were checked again before staging.
Existing review packets stay byte-for-byte as tested, including historical pending
fields; this new delivery record supplies the completed full-suite result. Earlier
failed attempts remain locally recorded and are not counted as passes. The full run
used a unique external TMPDIR after the staging/renderer diagnostics passed.

The [render verification](verification.json) covers 60 generated and 72 comparison
PDFs, 344 pages and 102,269 word bounds, with no detected clipping or parser errors.
Eleven ordinary English cases retain identical pixels/text. The extreme overflow
case intentionally changes to retain its exact source value in scientific form
instead of producing invalid PDF geometry. All original model outputs and source
catalogue decisions remain unchanged. Native extraction checks retain full source
assumptions, entered checkpoints and all-page cautions. Four changing-case contact
sheets were re-inspected before delivery; the recorded wider visual checks do not
claim that every page was manually read or approved by fluent speakers.

This changes the picture; PLAN_VERSION is unchanged. This is a stacked draft
review delivery, with no main merge or manual production deployment. Read both
CI jobs at the pushed head before claiming green CI. The whole-app goal remains active.
