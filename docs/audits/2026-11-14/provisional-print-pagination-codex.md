# Provisional report evidence pagination — 14 November 2026

- Auditor: Codex implementation owner; separate independent Codex presentation assessment. Not Claude/AGY.
- Starting revision: `741675f6fd601ec62ab6d21defe2d73f00b48c7d`, tree `b84947a98303c46fe9bc55e34b3c98c9266f7bec`, PR #1376.
- Branch: `codex/provisional-print-pagination-20261114`, stacked on #1376.
- Previous audit: [Saskatchewan nursery reference](saskatchewan-cabbage-nursery-codex.md). NURSERY-SK-04 stays closed; NURSERY-SK-06 and all broader source/local/external gates remain open.
- Scope: HTML evidence appendix and print layout only. No calculations, source admission, values, saved schemas, fingerprints, data, geometry, species, lessons or PLAN_VERSION change.
- Output: this changes the picture. Static originals inspected; hosted/browser print and physical printer behavior not verified.

## Findings and disposition

| ID | User-visible problem or gap | Disposition |
| --- | --- | --- |
| PROVISIONAL-PRINT-01 | Whole-field print avoidance strands a short unknown field on an otherwise empty page before a long source block | Evidence appendix permits paragraph-level breaks; output rows, nursery date/complete conditions and unrelated field sections retain their existing break rules. |
| PROVISIONAL-PRINT-02 | Repeated empty evidence paragraphs obscure the fields that have usable evidence | Contiguous untouched missing fields become explicit table rows, preserving label/units, status, active input, active basis and evidence default. |
| PROVISIONAL-PRINT-03 | Compact status text wrapped into fragments in the first actual render | Corrected before final candidate: compact value cells stay on one line; field labels and headers still wrap. No font or margin reduction. |
| PROVISIONAL-PRINT-04 | Exact successor review, CI and hosted output | Open at implementation handoff. No release approval. |

## Evidence preservation

Compaction requires the resolver’s untouched missing sentinel and no override, candidate, baseline, range, coverage, option, conflict, source, assumption or active tier. Unknown new resolved metadata keeps a field detailed. A rejected candidate associated with a field prevents compaction. Zero, explicit empty month windows, invalid edits, withheld values and conflicts stay detailed. The complete Evidence not used section stays visible. No values are inferred from absent records.

All four original nursery examples retain their field-associated HTML meanings, outside-appendix content, exact input data and returned planning fingerprints. Three earlier AAFC originals likewise retain their semantic inventory and fingerprints. HTML intentionally changes; historical byte identity is not claimed. Five test-only corruptions (removed field, swapped field labels, dropped reuse terms, zero changed to unknown and removed rejection reason) fail the semantic comparator. Every detailed HTML paragraph survives PDF text extraction; all nine fields remain present. These checks do not establish agricultural accuracy.

## Actual outputs and verification

The same original synthetic requests and saved adopted row, fixed timestamps, WeasyPrint renderer, 10pt print text and 16mm margins produce: lower endpoint 6→5 pages; upper endpoint 6→5; own override 6→5; adopted record 7→6. All 21 final pages inspected in a montage; full-size result/table/source continuation boundaries inspected. No clipped text or narrow status fragments observed. Nursery date and complete source qualification remain together. The old 18-word harvest-weight-only orphan page disappears. Legitimate short final pages remain; this is not a claim of optimal pagination.

- Ordered typecheck: clean.
- Affected contracts: 787 checks across 58 existing files, zero failures; final CSS adjustment followed by another clean typecheck and 70 affected exporter/consumer checks, zero failures.
- Whitespace and actual pending-release-note gate: checked at finished candidate.
- Private originals, before/final semantic comparison, fingerprints, PNGs, negative controls and exact-candidate bindings retained in the programme evidence packet. No private data or raw logs committed.
- Current-head full CI, independent affected-delta review and preview results remain separately tracked in issue #35. Parent full jobs are not successor verification.

## Next continuation

Inspect the exact final presentation delta with its originals, resolve related findings and publish the verified branch once. Retain the full original P01–P24 goal and same-final-candidate external release outcomes. AGY automation remains disabled. Continue useful global planning work without inventing local thresholds or treating software checks as local farm validation.
