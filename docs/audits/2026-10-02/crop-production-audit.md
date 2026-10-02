# Crop and production planning audit register — 2 October 2026

- Original auditor: Codex, chat **Audit crop plan visually and fully**, task
  `01a0fc07-9179-78a3-9327-85f244f3170f`.
- Archive/register prepared by: Codex in the site survey archive chat.
- Original reviewed revision: `f76814b2aa256a9610f7bd02d36a4c04183955db`.
- Original report: [Ubhejane crop plan audit — nine pages](Ubhejane-Crop-Plan-Audit-2026-10-02.pdf).
- Previous audit: [Crop-plan truth — 6 August](../../CROP-PLAN-TRUTH-AUDIT-2026-08-06.md).
- Current follow-up: **in progress** on
  `codex/ubhejane-farmer-crop-print-20261002`, worktree
  `/Users/roryclark/.codex/worktrees/crop-plan-audit/ImbewuField`.
- Follow-up pull request: [#879 — farmer crop-plan prints](https://github.com/rorymclark-prog/ImbewuField/pull/879).
- Survey continuation: [draft recovery iteration](site-survey-draft-recovery-codex.md).
  This keeps unfinished answers separate from saved production/report inputs;
  it does not duplicate the crop chat's frost, water or poultry questions.

## Preserve the original evidence

The PDF is copied unchanged from
`/Users/roryclark/ImbewuField/output/pdf/crop-plan-audit-2026-10-02/Ubhejane-Crop-Plan-Audit-2026-10-02.pdf`.
Its SHA-256 is
`9ecca6c6be9c0f88dccc6006c47005265b3e5fd005074977bc8100a819bc398f`.
Do not overwrite it with a revised implementation report. Save the next dated
audit separately and refer back to these finding IDs.

The original auditor examined the supplied 30-page print, reconstructed its 71
planting rows, ran 270 regional scenarios, generated 16 regional PDFs and tested
tree/animal omissions. The report records 4,379 passing tests, zero failures and
one existing TODO at its reviewed revision. These are the original audit's
results, not a rerun by this archive task.

Its key conclusion is that reproducible scheduling arithmetic does not make the
printed pack a complete field plan. Timing, designed food sources and instructions
needed by field workers require correction. See the PDF for measured evidence,
source qualifications and acceptance checks.

## Findings carried forward

The status of every row below is **reproduced in the original audit; current fix
verification pending**. The separate crop chat has started changes, but this
archive does not claim its uncommitted work is released or fully verified.

| ID | Original finding | Acceptance evidence required in the follow-up |
| --- | --- | --- |
| CP-001 | Combining national and cultivar windows gives a placed avocado an unsupported local season. | A justified local/cultivar window, or explicit unknown local timing; bearing/proposed status retained. |
| CP-002 | Banana and other designed food sources disappear when months are unknown. | Dated and undated inventory survives in both app and print, with a reason where no month bar is shown. |
| CP-003 | Honey is lost in PDF conversion; Simple mode hides poultry enterprise choices. | Undated honey survives actual PDF export; detected housing has accessible purpose choices; housing count is not presented as animal count. |
| CP-004 | Cover, food chart and field sheets mix first-year and established-year assumptions. | One dated horizon reconciles headlines, calendars and tasks; repeating established scenarios are separately labelled. |
| CP-005 | Monthly sow/transplant instructions omit partial-bed allocations. | Each job retains its crop share/area and field reference, with readable bed-by-bed timing. Saved geometry remains unchanged. |
| CP-006 | Calendar passage promotes an unconfirmed starter to an existing planting. | Planted, skipped and overdue states are distinguished; an unperformed sowing cannot generate an asserted harvest. |
| CP-007 | Rate-based procurement, seed-before-nursery reminders and storage conditions are incomplete on paper. | Existing sourced instructions and unknown purchase quantities remain visible, without invented seed rates or storage durations. |
| CP-008 | Small type, orphan continuation rows and incomplete record fields weaken field use. | Rendered pages retain readable type, section context, month/year, units, responsibility and cohort references. |

## Scope now being extended

The original crop chat has been asked to develop a broader **production plan**
covering vegetables, fruit, berries, eggs and honey, with site and climate inputs.
Its latest update identifies region-specific variety claims and seed-saving
claims that need stronger evidence. This is ongoing work, not an approved list
of regional varieties or chicken breeds.

Coordinate with the [Site Survey register](site-survey-continuation.md): shared
site conditions and recorded production should reach the plan without a second
conflicting survey store. The crop chat is already examining observed frost,
dry-season water and poultry-management inputs. Check that branch's latest work
before adding overlapping fields or changing survey schemas.

## Evidence locations and limits

- The original report and local probes are in
  `/Users/roryclark/ImbewuField/output/pdf/crop-plan-audit-2026-10-02/`.
- Later print reconstruction is in
  `/Users/roryclark/ImbewuField/output/pdf/production-plan-2026-10-02/`.
- The original evidence ZIP contains raw logs and detailed reconstruction data;
  it remains local and is not committed with this archive.
- The original report did not inspect Ubhejane's private saved animal choices.
  Its reproducible omissions do not establish which private setting caused a
  particular missing coop or hive.
- Some cited source material, including the underlying honey-flow reference,
  could not be independently retrieved by the original auditor. Preserve that
  limitation; do not treat the archive as new agronomic verification.

This task archives the audit and its continuation links. It does not modify crop
planning code or certify the in-progress follow-up's app/print result.

Archive validation: the PDF copy matches the recorded SHA-256, and all nine
pages were rendered and visually inspected without modifying the report.
The archive branch passed typecheck and the full Node 24.19.0 suite (4,381 pass,
zero failures, one existing TODO), whitespace and local-link checks.
