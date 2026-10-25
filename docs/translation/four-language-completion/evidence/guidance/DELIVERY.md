# Guidance translation batch — full local verification complete

This partial guidance batch adds 391 source-bound draft rows after the 616-row
projection parent (#1108). The combined registry has 1,007 rows. The new isiZulu,
Sesotho, Xitsonga and Tshivenda wording remains unreviewed. There are still 438
authored prose candidates in the typed guidance inventory, three retained pure
provenance labels, other public/display fields and wider whole-app work.

On 25 October 2026, Node 24 completed the required checks in order:

1. `npx tsc --noEmit`: passed.
2. Full `npm test`: 5,810 passed, zero failed, one existing shape-sync TODO;
   5,811 total tests across 566 registered files.
3. `git diff --check`: passed.

All 171 source/test/fixture/document-JSON inputs recorded in
[required-checks.json](required-checks.json) stayed unchanged through the terminal
run and were checked again after alignment to the finished projection parent and
before staging. Alignment changed only the branch/index, then restored missing
ancestor evidence files. Existing tested packets retain historical pending fields;
this new delivery record supplies the completed full result.

The first guidance attempt was deliberately stopped (exit 143) after an observed
isiZulu release-note error used “lists” instead of translation drafts. Its logs and
prior wording remain recorded. The corrected required run used a unique external
TMPDIR, passed the staging diagnostics, and finished without changing its inputs.
No interrupted run or observation timeout is counted as a full pass.

The source-linked evidence directories cover poultry, survey observations,
product/animal conditions, four authored research batches, animal units and regional
source qualifiers. They retain their exact measured scope and historical hashes.
The latest wild-fruit comparison uses 10 PDFs / 31 pages / 11,424 word bounds,
retaining 372 complete guide clauses and 72 new source-clause occurrences with no
detected clipping/parser errors. Its eight native PDFs retain full cautions on all
23 pages; both ordinary original English cases retain identical pixels/text.
Regional qualifier evidence separately checks 14 PDFs / 67 pages / 28,383 bounds,
776 complete clauses and 88 new fields. These are sample sets, not percentages or
proof that all remaining English guidance has been translated.

Actual rendered failures exposed missing arithmetic/comparison glyphs, source-only
continuations and a section introduction separated from its first card. Paint-only
operator fallbacks and measured native-only reservations correct those cases;
original failing outputs remain in fixtures and are rejected by negative checks.
Raw farming profiles, species identities, source citations/month windows, unknown
quantity gates and saved names/values remain protected by original captures.

This changes the picture; PLAN_VERSION is unchanged. Recorded image inspections
cover selected contact sheets and enlarged pages, not every PDF page or fluent
language approval. The crop-screen caller forwards the selected language; full
Home/Farmer/crop-route browser integration, sample/title/export metadata, remaining
prose/public labels, media/accessibility/errors and current-main changes remain.

This is a stacked draft review delivery with no main merge/manual production
deployment. Read both CI jobs at the pushed head before claiming green CI. The
whole-app goal remains active.
