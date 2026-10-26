# Ubhejane map availability and recovery audit — 26 October 2026

- Auditor: Codex.
- Reviewed revision: `201d57f5fc48772cbcdb1e8d6a5e02b543f3df05`, branch `codex/ubhejane-report-images-20261026`; documentation only.
- Deployment inspected: https://imbewufield.vercel.app, build-info returned `main` / `201d57f`.
- Previous audit: [Survey recovery and signed-in site check](../2026-10-22/survey-draft-recovery-codex.md); carries SS-001 through SS-004.
- Scope: actual signed-in Ubhejane Design Studio gallery, report map availability, existing file archives, free exact-map creation, reload and local PDF export.
- Evidence: source review, production Chrome, browser storage count, original PDF extraction and rendered PDF inspection. Private artifacts are retained outside Git.

## What was already done

SS-001 shipped in PR #1066, merge `1fb671ea02a2a40b7937d1f09df1ef7d38075f47`.
Its post-merge CI run 39856876036 is now confirmed successful. The original
survey recovery/save checks remain recorded in the previous audit; they were
not rerun or broadened into a claim about newly generated AI advice today.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| SS-001 | Interrupted questionnaire answers could be lost | Released; previous verification retained | #1066 and successful branch and main CI. |
| SS-002 | Recovery wording needs fluent/local-language review | Open | No fluent review claimed. |
| SS-003 | Actual site save/reopen/report delivery | Prior save/reopen retained; map availability additionally verified | All nine current sheets now appear in report preparation. No paid narrative generation requested. |
| SS-004 | Physical phone/iPad/Safari delivery | Open | Desktop Chrome is not physical-device evidence. |
| SS-005 | Report had no rendered design-sheet images in this browser | Current exact-sheet availability restored and verified | Before: report 0/9, same-site gallery 0, read-only count of the entire `imbewu-sheets` store 0. After the existing free batch action: gallery 9 after reload; report 9/9 saved, 9 included, 0 reviewed. |
| SS-006 | Historical exports could be mistaken for a current approved plan | Recovered separately; comparison needed | Nine original embedded JPEGs recovered from an existing 38-page Drive PDF archive dated 4 August. Seven older PNGs already in Downloads copied separately. Source dates, page numbers, dimensions and checksums retained locally. Historical site-area and roof figures differ from current report records. |

### Why the appendix was empty

`lib/sheet-store.ts` stores bitmaps in browser-local IndexedDB, scoped by account
and site. `ReportView` and `DesignGlossy` use the same `loadSheetMetas` authority
and canonical site ID. `lib/user-sync.ts` syncs survey and geometry records, not
these sheet bitmaps. Therefore a synced layout can draw report figures while its
sheet-image gallery remains empty. Zero physical rows here ruled out report
selection filters or old plan-version labels as the immediate cause in this
browser. It does not establish why/when rows became absent, nor prove that other
devices or origins have no copies. No owner-isolation fallback was weakened.

### Action performed and observed result

Used Design Studio → Glossy → More options → Create all design sheets. Source
review confirmed `generateAllSheets` uses the free deterministic renderers and
`pushGallery`, without enqueueing a paid render. Retained the user's existing
Plain paper / High / Codes settings. The action saved nine exact sheets for the
current site. Reloaded and confirmed Saved maps (9), then reopened the actual
report workspace: its checklist reported 9/9 saved, 0/9 reviewed and 9 included.
The report also exposed the saved whole-design cover and all nine preview entries.
No review status was promoted. No saved narrative was rewritten.

Exported all nine selected sheets through the gallery's PDF download. Verified
that the file contains nine landscape pages; rendered all pages to JPEGs and
inspected their contact sheet. This confirms the exported set exists and contains
the nine distinct drawings. It is not agronomic approval, a new field survey or
a complete fine-label audit at print size. Source geometry, survey observations,
production records, species catalogue and lessons were not edited.

### Private recovery artifact

The dated recovery folder under the user's local ImbewuField App / Reports /
2026-10-26 contains the original archive PDF, nine extracted historical map JPEGs,
seven older reference PNG copies, a manifest with original-byte checksums, a
viewable HTML index, the new current nine-page exact-map PDF, rendered contact
sheets and the live report checklist screenshot. None of these private farm
records or screenshots is committed to Git or uploaded to Drive. Original files
and sharing permissions are unchanged.

## Verification

- Typecheck: `npx tsc --noEmit` passed on Node 24.
- Full local suite: started on the unchanged application source; not yet complete at this audit checkpoint. No pass claim is made for an unfinished run.
- Previous draft-recovery full branch and post-merge CI: successful; current main has a separate automatic run, not substituted for those results.
- Whitespace: checked for the documentation changes before commit.
- Output inspected: live gallery after reload; actual report checklist and previews; all nine exported current PDF pages as a contact sheet; nine historical embedded maps as a separate contact sheet.
- Limits: no paid narrative generation, no physical Safari/phone check, no fluent language review, no claim of automatic cross-device sheet backup.

This creates new pictures from the existing saved layout through the existing app
action. There is no application code or deployment change; `PLAN_VERSION` is untouched.

## Next continuation

1. Review the new exact sheets against the historical references and current site evidence before marking them reviewed. Preserve dates and disagreements rather than copying old numbers into observations.
2. A supported export/import or backup/restore flow would address future browser/device moves. The current app has no map-file importer; this was not bypassed by writing archived files into production storage.
3. Complete SS-002 and SS-004 with fluent reviewers and physical devices. Re-check paid comprehensive narrative quality separately if requested.
