# Saved-site country status — 10 November 2026

- Auditor: Codex, continuing Rory's international-app improvement sprint.
- Reviewed revision: released baseline `dc48b9c06b6e0cc7e733bc6dd67311d17855b506`, branch `codex/site-country-status-20261110` plus this change.
- Deployment inspected: exact candidate `e835db2e0f413e73e14545795514c3a51805254b` at `https://imbewufield-site-country-status-20261110.vercel.app`; successor below changes only the release-note sentence and this audit.
- Previous audit: [Country evidence next steps](country-evidence-next-steps-codex.md), carrying forward COUNTRY-UI-001 as separately released in PR1330, and [review help](international-in-flow-help-codex.md), released in PR1332. Neither closed finding is reopened.
- Scope: the existing saved-site country panel, visible status and planning-availability explanation only.
- Evidence type: actual source and component-output checks; no physical-device/account or local agronomy approval.

## What was already done

The country resolver distinguishes confirmed, unknown, conflicting and missing mapped sites. `sitePlanningSupport` is already the authority for automatic planning availability: confirmed South African sites use the existing planner; other countries retain reference-only support. Country confirmation never approves local agronomy. The panel already keeps local save and cloud acknowledgement separate.

The independently reviewed AGY batch11 proposal P-01 identified a real copy ambiguity: unknown and missing-site resolutions shared the top summary, although their next actions differ. Its broader usability consequences are hypotheses, not measured farmer findings. This change does not shorten the confirmation form or decide CP-047.

## Findings and disposition

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| COUNTRY-STATUS-001 | An unopened map and an existing saved site needing country confirmation share the same top instruction | Component and actual sample output verified; current-head CI pending | Missing sites now ask the grower to open or save a mapped site. Unknown saved sites ask for country confirmation; conflicting aliases retain their distinct instruction. |
| COUNTRY-STATUS-002 | A saved country is shown without explaining the existing automatic-planning boundary | Component and actual sample output verified; current-head CI pending | The panel reads `sitePlanningSupport` without changing it. Confirmed ZA retains reference-planning availability and local-condition qualification; other countries explain unavailable automatic planning and reference evidence. Unsaved selector edits do not change this saved-state explanation. |

## Verification

- Typecheck: passed with Node26.5.0,3072MiB heap, `tsc --noEmit --incremental false` on final code and release note. Existing dependencies reused from an identical lockfile; no install or package changes.
- Affected checks: initial47/47 across six existing files. After CI caught the overlong release-note sentence, final70/70 across those files plus canvas-labels, one worker,0fail/cancel/skip/TODO,5.34seconds. No test assertion was changed or deleted.
- Negative control: the same two new component cases fail against the exact prior SiteCountryPanel (0pass/2fail); candidate restored byte-exact. Whitespace and release-note gates passed.
- Component cases cover unresolved states, ZA and four pilot countries, unsaved selector edits, unchanged input records and no writes while reading. Existing save acknowledgement and evidence-navigation tests remain intact.
- Full suite: no duplicate local run; new candidate CI is separate from the earlier releases.
- Actual sample output: followed Home → Tour → full farm pack → farm workspace → Production plan. At390×844 inspected unknown country in Earth light, confirmed US and ZA in both Earth light/dark;1280×720 ZA desktop. New text wraps without horizontal document overflow. Unsaved ZA selection retains saved US explanation until explicit sample confirmation. Saves reported sample-session only.
- Actual14px panel text/background contrast:7.34:1 light,6.09:1 dark. No weather/provider request or sowing-plan edit was made. Auto appearance restored, sample exited, viewport reset and own tab closed. Missing-site/conflict states have component-output evidence, not manufactured browser records. Physical phone/account sync remain unverified.
- Hosting: Vercel Git automatic preview failed in the unchanged Newsreader Google-font loader. The already-running independent GitHub preview workflow42793269736 succeeded on the same e835db2 source; actual build-info matches and that output was inspected. No font source workaround or redundant deployment retry.
- CI initially failed canvas-labels because the new release note exceeded90characters. Shortened the actual note, retained the test, reran typecheck and70 affected checks. Current correction CI must still be recorded separately.
- This changes visible panel text and height, not map artwork. `PLAN_VERSION`, site resolver/policy, store/sync, country form controls, crop calculations, calendar, species, lesson content, provider dispatch, security rules and translations are unchanged.

## Next continuation

The candidate panel is visually reviewed with the finite scope above. Confirm the corrected release note and successful exact-head preview/rules gates before using AGENTS section1's focused-UI merge authority. Full CI remains separately tracked; preserve the genuine account/device limits.
