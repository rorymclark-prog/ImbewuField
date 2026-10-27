# Site-report iteration verification — 25 October 2026

- Auditor: Codex, completing Rory's active site-survey/report goal.
- Application revisions: PR #1099 `45d3dabe1932e2d367b71f5811f5f229defce8c6`; stacked PR #1101 `23922e55860c87a44d3eaf0f0f19a319f34d6f70`.
- Previous: [24 October implementation and real-site comparison](../2026-10-24/site-report-market-evidence-codex.md), [production/mapping handoff](../2026-10-24/site-report-production-mapping-codex.md), [readability CI correction](../2026-10-24/site-report-ci-followup-codex.md).
- Preview checked: [public example workspace](https://imbewufield-report-market-evidence-20261024.vercel.app/samples/farm). Its [build metadata](evidence-report-preview/build-info.json) confirms source `23922e5`. Production merge/deployment remains a separate step; #1099 must precede #1101.
- This follow-up adds documentation and evidence only. Application code, tests, species, source figures, saved geometry and `PLAN_VERSION` retain the verified revisions.

## Completed CI — the pending status in the older records is historical

| Application source | Push run | Pull-request run | Full suite in each run |
| --- | --- | --- | --- |
| #1099, `45d3dabe` | [40089782162](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40089782162) | [40089785879](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40089785879) | 5,481 tests; 5,480 pass; **0 fail**; 1 existing TODO |
| #1101, `23922e558` | [40094927566](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40094927566) | [40094968733](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40094968733) | 5,490 tests; 5,489 pass; **0 fail**; 1 existing TODO |

All four runs completed successfully. In each, **both `test` and `rules` passed**;
this includes the typecheck and full `npm test`, plus separate security-rule
verification. The exact run SHAs, conclusions, jobs and totals are retained in
[CI evidence](evidence-report-preview/ci-results.json). The existing TODO in
`tests/shape-sync-loss.test.ts` is unchanged on main and these branches. It is not
a new failure, a removed assertion or a claim that the known sync issue is fixed.

The temporary checkout and its unfinished local full-suite session disappeared
during the interruption. No final local full-suite result is claimed. The
completed CI results above are the supported verification of these application
revisions. The earlier clean local typecheck and 211-pass focused run retain the
scope described in the 24 October record. Whitespace is checked again for this
documentation-only follow-up.

## Deployed questionnaire verification

Used the public demonstration workspace, with explicitly synthetic unsaved notes.
No private buyer notes, real-farm Save, paid generation or account changes were
made. The two report purposes were checked independently of questionnaire length:

- **Complete site plan + Short & simple:** the optional market section is present in Growing & resources. Review retains Complete site plan, the entered note and source, with observation date **Not recorded**.
- **Site potential + Comprehensive:** switching purpose and route retains those notes and source. Review names Site potential and says questionnaire length is a separate choice.

[Recorded purpose checks](evidence-report-preview/purpose-checks.json),
[desktop fields](evidence-report-preview/market-short-desktop.png),
[phone fields](evidence-report-preview/market-short-phone.png) and
[purpose review](evidence-report-preview/purpose-review.png) are saved beside this
record. Field text is the deployed Public Sans at 16px. The phone viewport and
document were both 390px wide. Native browser viewport sizing produced the
inspected 390 × 844 capture; an earlier incorrectly scaled capture was replaced.
Temporary viewport overrides were reset.

The background basemap failed to fetch its external Mapbox style in this browser,
with subsequent missing-glyph warnings. This observation does not verify live
basemap availability. The questionnaire checks above completed independently;
Record plan SVG/PNG and PDF verification remains the separate evidence in the
24 October mapping audit. Recheck the basemap on a normal connection before
claiming it works in this environment.

## Completion audit against the requested scope

| Requirement | Evidence and outcome |
| --- | --- |
| Check previous work before improving it | Shared audit index, earlier crop-plan records and original six-report catalogue were read. The private evidence JSON, maintained authoring source and comprehensive content were compared before implementing SS-010/SS-014. No second calendar, drawing engine or six-report collection was created. |
| Audit Site potential and Complete site plan against real Ubhejane records | The signed-in saved-site workspace and its actual five-page export were checked on 24 October. The earlier comprehensive assessment (10 pages) and design (12 pages) provide the coverage baseline for the two purposes; progress (7 pages) remains a later evidence review. The new three-page private continuation audit records that comparison and the missing field evidence. The deployed purpose controls/review were separately checked above. |
| Carry the full-year crop, food-forest and animal picture into the survey/report | #1099 reuses existing production builders and source/age gates, freezing one dated report snapshot. Reported harvest months/year remain separate from planned windows. Tree-only sites and unknown animal timing are retained. The prior screen, prompt, saved-report and PDF evidence is linked in the 24 October audit. |
| Expose the requested mapping option | #1099 reuses the existing scaled `sitePlanFigure` as Record plan. Actual PNG/SVG delivery and existing Saved maps integration were inspected. Geometry and paid-render/version rules are retained. |
| Make evidence-backed improvements | SS-010 uses optional notes/source/observation date in the existing survey, draft and captured report facts; missing metadata stays missing. The economic prompt labels unsupported opportunities for investigation. SS-014 prevents unsourced soil placeholders in the deterministic full header. CI and rendered exports cover both changes. |
| Save dated shared and readable audit evidence | The repository index points here and to preserved earlier audits. The private 24 October folder contains the three-page audit, actual five-page export, authoring source and rendered QA. All eight private pages were inspected; their QA records report zero off-page glyphs. The six original 3 October PDFs and their sources still exist. |
| Verify tests and visible/PDF results | Completed full CI above; prior 211 focused passes; actual full/short PDFs and real-site export inspected; final deployed desktop/phone controls and purpose review checked. These are distinct checks and none substitutes for a new agronomic review or paid narrative evaluation. |
| Record evidence-dependent checks honestly | SS-002 fluent review and SS-004 physical phone/Safari sharing remain open. SS-010 current buyers/prices/commitments, field soil/water/ecology, installed work, real harvest/sales/spending and generated comprehensive narrative quality are not newly verified. They remain explicit next-iteration inputs. |

## Private files and next iteration

Private reading folder:
`/Users/roryclark/Documents/ImbewuField App/Reports/2026-10-24/Ubhejane Creche audit/`.
Original six-report folder:
`/Users/roryclark/Documents/ImbewuField App/Reports/2026-10-03/Ubhejane Creche/`.
The original PDFs were preserved; the new continuation document is an audit, not
a fresh field visit or a replacement comprehensive site report.

Review/merge #1099, then #1101. Read the newest PR checks before merging: saving
this documentation can queue another CI run, while the application source
verified above remains unchanged. Any final run update belongs in the PR and
issue #35 handover; it does not require rewriting historical audit checkpoints.
Future iterations start from this register and add dated evidence, fluent review
and device checks without turning proposals into achieved results.
