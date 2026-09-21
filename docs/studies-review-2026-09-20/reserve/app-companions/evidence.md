# C13 — Field evidence and saved reports

Route: `/student/guides/evidence`. Six English steps, a source-result decision exercise and independent practice. Uses the existing inspected site-sketch illustration and shared printable layout. No animations changed.

## Current source evidence

Baseline main `e9c9282149a530a91c1e876a3ded2a7a965d9b26` (PR479 export-guide release).

- `app/reports/page.tsx`: Saved sites versus Saved reports, named site coordinates, latest-saved opening, report-workspace route and account/role boundaries.
- `components/report/ReportPreparation.tsx`, `lib/report-readiness.ts`: seven preparation areas indicate presence, not checked accuracy or completion; name/save site before attaching photos/tests/survey. Current checklist can differ from saved snapshot.
- `components/EvidenceSheet.tsx`, `lib/site-evidence.ts`, `lib/evidence-documents.ts`: lab PDFs stored on this device; upload does not parse their contents. Results and sampling details must be entered and checked. Photographs are resized; other PDF entries can retain filenames only. Preserve originals.
- `components/ReportView.tsx`, `lib/saved-reports.ts`: save records the current report/version and checks storage success; reopen preserves text and timestamp. New evidence does not rewrite old text; current photos/checklist may postdate the saved text. View/print/summary controls do not regenerate advice. PDF image choice and phone View and print options sourced here.
- `app/samples/farm/page.tsx`, `lib/sample-farm-pack.ts`: separate practice evidence pack, explicit AI picture and fictional soil/interview source labels; Save edits and Download evidence report. Do not imply it is a verified agronomic site report or real laboratory finding.

## Actual sample walkthrough

Only disposable prepared sample records used; no real site evidence, account records or recipients changed.

1. Opened sample farm, inspected picture captions and Source details: prepared aerial/harvest are AI illustrations, soil values are fictional. Replaced Mentor notes and follow-up with an explicit practice-only note; Save edits reported Edits saved.
2. Download evidence report reported ready and produced the actual `ImbewuField-Tour-Farm-Evidence.pdf` in Downloads. Rendered and visually inspected all three A4pages: labels and household/sample limits preserved; page2 contains the practice note; page3 contains both example-picture captions. No clipping/overlap found. Saved a copy in the external evidence-guide checkpoint.
3. Open site reports → named Ubhejane site → report workspace. Opened Improve this report: four of seven areas had records, with source/absence details. Opened Add soil test results and inspected the explicit original-PDF, manual-results and retain-originals instructions. No laboratory result fabricated and no private file uploaded.
4. Saved the prepared sample Site Analysis Report. An initial native browser Back test showed the report list with zero records, so it is not claimed as a verified retention path. The app report’s own Back control returned to a list with one saved report; Read latest saved report reopened the same dated version and exposed Export PDF. No Generate action or paid report API call was used. This is sample in-session save/reopen, not verification of real-account cross-device persistence.

## Acceptance and remaining production work

Validate six readable steps, loaded art, phone layout, all exercise responses, keyboard use and guide/report/tour links on exact-head preview. Run typecheck, full suite, whitespace and release-note gate. Record exact CI/merge/deployment/production results in issue35. Narration, fluent isiZulu and learner review remain open. The real lab upload/download flow and real report AI generation are source-checked, not newly exercised by this tutorial review.
