# Production graph translation batch — local verification complete

This branch adds 66 source-bound draft rows after the 495-row calendar/export parent.
The combined registry has 561 rows. isiZulu, Sesotho, Xitsonga and Tshivenda remain
unreviewed drafts; production guidance, further screens and whole-app work continue.

On 25 October 2026, Node 24 completed the required commands in order:

1. `npx tsc --noEmit`: passed.
2. Full `npm test`: 5,780 passed, zero failed, one existing shape-sync TODO;
   5,781 total tests across 564 registered files.
3. `git diff --check`: passed.

The 137 source/test/fixture/document-JSON hashes in [required-checks.json](required-checks.json)
remained unchanged through the terminal run and were checked again before staging.
Existing review packets are retained byte-for-byte as test inputs, including their
historical pending/recovery fields; this delivery record supplies the completed result.
The source snapshot is based on the corrected calendar parent `769beced0` (#1106).

Earlier failed and deliberately stopped attempts are retained locally. The last stop
followed a reproduced packet-status failure, not a timeout. The required `IN PROGRESS`
marker was restored; no assertion was removed. The successful run used a unique
external TMPDIR, avoiding unchanged slide-renderer collisions and respecting the
narration staging guard.

The existing [visual verification](verification.json), native PDFs and contact sheets
cover the actual graph presentation. Changes include measured quantity-table and
stock-method grouping, safe display of extreme mapped area, full source cautions and
native labels. This changes the picture; PLAN_VERSION is unchanged. Not every checked
page was manually inspected, and no fluent language approval is claimed.

CI test and rules jobs must both be read at the pushed head. A local pass is not a CI
pass. No production merge or manual deployment is part of this draft delivery.
