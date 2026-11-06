# Reuse authenticated historical reconstruction

Import-time history validation repeatedly reconstructs the same worker and asset-manifest predecessors. A bounded diagnostic exposed work in this reconstruction chain; it did not establish the whole suite’s eventual bottleneck.

The B+A+C helper now shares only successful surgical reconstruction strings in a private ten-slot cache. Identity includes the file, phase, integrated and expected bytes’ digests and the module’s authenticated authority fingerprints. Live source reads, caller-byte checks, fresh snapshot size/digest checks, successor checks and complete output comparisons remain on their existing paths. Returned buffers are copied. Authority proofs retain their existing import-time authentication contract; this change does not claim later on-disk proof reloads.

All 47 existing helper assertion calls remain. The new isolated test warms the actual helper, observes no additional surgery while source/snapshot/output comparisons increase, and checks changed live, caller, integrated, dated and owned successor bytes, restoration and returned-buffer isolation. Broader history wrappers are explicitly isolated in that test. An initial expectation about unrelated sentence-repair files was corrected to this helper’s actual worker/manifest ownership, with every owned successor covered.

Node 24 typecheck, the warm/adverse case and staged whitespace checks passed. A read-only test copy using the exact original helper fails the intended warm-work assertion: 30 surgical calls versus 15 expected. An initial private evidence checker assumed the wrong counter value; the actual assertion and original log were retained. Independent bounded source review found no concrete issue.

This is not a full-suite pass or a measured overall speedup. Current-head CI and broader history integration remain review gates. No production source, lesson, species, archived evidence, media, measured geometry or `PLAN_VERSION` changed.
