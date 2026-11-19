# Report PDF table starts — 12 November 2026

- Writer: Codex, sole writer of `codex/report-pdf-table-start-20261112`.
- Base: `cd408331865da2de20777630d6ff831842db50d0`, tree `73667db47f0f2859159dbf992199293b818a5a8e` (draft PR1345).
- Finding: F01-RETAINED-PDF-HEADER, independently confirmed on both c8 and cd408.
- Previous audit: [Annual rainfall evidence](report-water-evidence-f01-codex.md), preserved unchanged. Root's separate same-candidate F01 review closed only that earlier delta.
- Scope: PDF table measurement and pagination; no report wording, farming thresholds, translations or provider calls.

## Cause and correction

The table renderer painted its header before asking whether the first wrapped row fitted. It then moved the row to another page and repeated the header, leaving the first header alone. Heading lookahead did not prevent this when explanatory paragraphs intervened between the chapter heading and the table.

Table opening and chapter lookahead now use the same measured column wrapping, font size, row advance and bottom clearance. Before painting a normal header, the renderer reserves its first whole row if that row can fit on a fresh page. A row taller than a page starts with its header and continues in measured chunks at the existing 8.5-point size; every continuation page repeats the header. Waiting chapter pictures are accounted for after page transitions. Extremely tall supplied headers can continue without recursive calls, retaining their text and reserving room for the body after the last header chunk.

No rows are hidden, no fixture strings/page numbers determine layout, and text is not shrunk to force a fit. The release note describes the visible export change. This changes the picture; PLAN_VERSION is unchanged.

## Checks and actual output

- Typecheck passed before focused execution; final typecheck passed after the test fixture correction and release note.
- Final PDF and document-localization checks: 45/45 passed, no failures, skips or cancellations. Another 29 report/water, monitoring-localization and release/update checks passed in the initial focused run.
- The initial oversized-row test correctly rejected its own 500-token input because it fitted on one page. Enlarged to 1,800 synthetic tokens to exercise actual continuation; every token is now checked exactly once, with repeated labels, normal font size and footer clearance.
- All three new regression groups fail on exact cd408 `lib/report-pdf.ts` through a read-only loader: prose-to-table boundary, oversized-row header, and actual six-column native table. No baseline source files were changed.
- Boundary coverage includes 21 filler lengths; generated English, isiZulu, Sesotho, Xitsonga and Tshivenda monitoring/risk tables at three positions; existing chapter heading, image, footer, final-row and crop-summary checks remain passing.
- No unrelated full local suite rerun while remote CI is live. Applicable successor-head CI and independent review remain separate gates.

Original zero and 499 mm report markdown was reused byte-for-byte from cd408, converted with the actual PDF builder and inspected as rendered PNGs. The risk note remains on page 6; the table header now appears with R1 on page 7 rather than alone on page 6. Original predecessor PDF/PNG controls are retained. The long-row export was inspected across all three pages, including its last supplied token and final row. Representative actual English monitoring and isiZulu/Tshivenda risk tables were inspected; all five language outputs are retained for review.

These are original PDF exports of synthetic report inputs, not a new paid model report, physical print test or authenticated app check. Existing native character normalization/font limitations and unvalidated agronomic wording are unchanged; no fluent-language approval is claimed. Earlier source, provenance, privacy and crop findings are not closed by this layout fix.

## Handoff

Publish once as a draft successor stacked on PR1345, with exact commit/tree, original PDF evidence, source/artifact hashes and baseline failures. F01-RETAINED-PDF-HEADER is author-verified corrected for this delta; independent same-candidate disposition is still required. No Claude/Flash/AGY review ran and no merge/release is authorised. This task used a sparse source checkout to reduce duplicate media on the low-space Mac; no browser or server was needed, and its dependency link is removed at handoff.
