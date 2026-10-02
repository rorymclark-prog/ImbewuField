# Site Survey draft recovery audit — 2 October 2026

- Auditor: Codex, continuing the shared site survey archive chat.
- Reviewed implementation: `d79d6c58f2f28e3fdf7734863d6fc984c0802e1f`,
  branch `codex/site-survey-draft-recovery-20261002`, based on main
  `ea97e803440c3dd4672d4084d7b2f33dfc5b75bf`.
- Deployment inspected: local development at `http://localhost:4269/qa-survey`;
  no production deployment claimed. The temporary QA route was removed.
- Previous audit: [continuation baseline](site-survey-continuation.md).
- Related audit: [crop/production planning register](crop-production-audit.md).
- Scope: the actual `SiteSurveySheet`, existing survey storage authority,
  account/site isolation, unfinished recovery and explicit final save.
- Evidence: source review, real IndexedDB transactions, full suite and headed
  Chromium with a fictitious local site fixture. No private farm answers
  or paid report generation were used.

## What was already done

The September survey rebuild and later mobile/language follow-ups remain the
baseline. This iteration addresses SS-001 rather than rebuilding the form or
adding another crop/production questionnaire. The shared archive guidance is
already on main in `AGENTS.md` and `CLAUDE.md`, merged through
[PR #880](https://github.com/rorymclark-prog/ImbewuField/pull/880).

Browser checks used `69d19e065acb6a082e71d2bb9ff08cb2ef50bb7b`. The branch was
then rebased over main's concurrent course-only greywater merge; all five survey
implementation/test files are byte-identical to that browser-tested checkpoint.
The shared release notes retain both changes. The full suite was rerun after rebase.

Unfinished edits now use the existing transactional `field-device-store` under
the mounted account and canonical coordinate site. Reopening offers a dated
continue/discard choice. Saved survey/report readers still read only explicit
`saveSurvey` records. A draft stores the active route/section, raw area inputs,
partial production rows and notes; blank figures remain unknown and negative
figures remain available for correction.

Queued writes are ordered. A stale tab's write or discard cannot erase a newer
draft. Save/discard waits for this session's writes before matching cleanup;
failed final saves keep the draft. A successful save with failed cleanup stays
open and retries cleanup without publishing another survey update. Sample mode
does not write demonstration answers into persistent IndexedDB drafts.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| SS-001 | Unfinished questionnaire answers disappear after reloading or restarting. | Implemented; verified in local component/browser and IndexedDB tests | Resume/discard, raw negative/blank values, comprehensive detail after a short-route switch, final save, transaction failures, account/site isolation and stale-tab protection checked. Production/signed-in integration remains SS-003. |
| SS-002 | Consequential survey wording and language drafts lack fluent/local farming review. | Open review dependency, carried forward | Existing review holds remain. New recovery/status/error keys deliberately fall back to English; no new isiZulu translations or reviewer sign-off claimed. Add this wording to the next fluent review. |
| SS-003 | Fresh integrated signed-in saved-farm → survey → report verification is missing. | Still needs verification | This is an isolated local component with real device storage, not a Firebase account or an end-to-end production journey. Recheck after this branch and the crop follow-up are integrated. |
| SS-004 | Physical phone/iPad and Safari ergonomics are not established. | Still needs verification | Chromium viewports, dark appearance and CSS zoom were inspected. They do not verify a physical keyboard, browser termination, device reboot or Safari's storage lifecycle. |
| SS-005 | The existing global update notification overlaps part of survey error instructions on a narrow screen. | Newly reproduced; open | At 390×844, the global “Update ready” pill covers a line of the final-save/cleanup warning. Actions remain usable and the pill can be dismissed. See failure screenshots below; review notification positioning with other open dialogs before changing its app-wide owner. |

## Browser verification and durable evidence

The QA page imported the real survey component and the normal application
providers. The local pin, mounted-identity fixture and failure injection were artificial.
Account isolation was verified separately with mounted UID bindings and real
IndexedDB transactions; this browser fixture did not sign in to Firebase.
Storage was read back independently after interactions; checks could fail when
a record, value or survey update notification was wrong.

| Check | Observation and evidence |
| --- | --- |
| Recovery choice | Reload showed the dated draft and disabled ordinary Continue until a choice. [Desktop 1280×900](site-survey-draft-recovery-evidence/01-recovery-desktop.png), [phone viewport 390×844](site-survey-draft-recovery-evidence/02-recovery-mobile.png). |
| Incomplete answers | Blank name/unit and production `-2`, plus area `-3`, survived reload/resume and still required correction. [Incomplete row](site-survey-draft-recovery-evidence/03-resumed-incomplete-row-mobile.png). These are test figures, not farming guidance. |
| Device write failure | Injected transaction failure displayed an honest warning; Retry kept the current notes while the saved survey stayed unchanged. [Failure state](site-survey-draft-recovery-evidence/04-device-write-failure-mobile.png). |
| Final save failure | Injected saved-survey localStorage failure kept the dialog and draft open and emitted zero survey-update events. [Save failure](site-survey-draft-recovery-evidence/05-final-save-failure-mobile.png). |
| Cleanup failure | Successful final save emitted one event; failed cleanup kept the draft. Retrying cleanup closed the dialog, cleared the draft and still had exactly one event. [Cleanup failure](site-survey-draft-recovery-evidence/06-cleanup-failure-mobile.png), [completed save](site-survey-draft-recovery-evidence/07-save-completed-mobile.png). |
| Route switch | Switching from a comprehensive-only section to Short, then reloading, returned to a visible short section and retained detailed production inputs. [Recovered short route](site-survey-draft-recovery-evidence/08-short-route-recovered-mobile.png). |
| Cancel and discard | Cancel kept edits. Confirmed close/discard and the reopening prompt's Discard both removed the matching draft without changing the previously saved survey, checked by independent storage read-back. |
| Competing tabs | After another transaction replaced the draft, a further edit displayed a conflict. Confirming close/discard closed the older dialog while independent storage read-back still found the newer tab's answers. |
| Narrow/dark/zoom | Recovery buttons remained within the viewport and at least 44 px high. [Dark 320×640](site-survey-draft-recovery-evidence/10-recovery-dark-narrow.png), [140% CSS zoom at 448×896, equivalent content width 320](site-survey-draft-recovery-evidence/11-recovery-dark-zoom140.png). CSS zoom is a simulation, not a physical-device accessibility test. |

The first browser session hit local disk exhaustion. Only this worktree's
generated webpack cache was removed; the session was restarted. The local QA
service-worker caches also needed clearing after source edits so the final
checks used the updated bundle. The final checks above completed successfully.

## Verification

- Final typecheck: clean. Full suite on Node 24.19.0: 4,391 tests, 4,390 pass,
  zero failures and one existing shape-sync TODO. Whitespace: clean.
- New draft/storage tests: seven meaningful cases added to the existing survey
  suite; all 25 survey tests pass at the implementation checkpoint.
- Archive validation: all 66 local file links resolve; release-note drift check
  passes. Temporary QA routes, logs and duplicate screenshots were excluded.
- Output inspected: recovery, incomplete inputs and failure states, including
  narrow/dark/zoom views above. The mobile device status was initially hidden by
  an existing footer rule and was made visible before the final checks.
- This changes the questionnaire picture: a recovery choice and device status
  now appear. `PLAN_VERSION` is unchanged.
- Drafts are kept on this device; no cross-device draft sync is claimed. An abrupt
  termination before an in-flight transaction commits can still lose that edit.
- Production app integration, physical devices and fluent wording review remain
  open as separate findings; a passing suite does not close them.

## Next continuation

1. Integrate/recheck this branch with
   [crop/production PR #879](https://github.com/rorymclark-prog/ImbewuField/pull/879).
   Its frost, water and poultry inputs must travel through the existing survey
   normalizer and the draft snapshot. Do not create a parallel survey store or
   infer new breed/variety facts from this recovery work. Version/migrate the draft
   format when its schema changes so older code cannot silently drop new answers.
2. Complete SS-003 on a disposable signed-in farm: reopen explicitly saved
   answers, edit/recover, switch routes, save and verify the same site's report
   facts without paid generation. Record the deployed build SHA and evidence.
3. Reproduce and address SS-005 through the notification's owner; include error
   states and other dialogs so one placement rule serves the application.
4. Carry SS-002 and SS-004 forward for fluent review and physical Safari/phone
   testing. Save the next dated record separately and update the shared index.
