# Core Study isiZulu source text in image zoom — 2026-10-05

- Auditor: Codex, scoped helper implementation and root diff review.
- Reviewed base: `51463f1ca61729e543cecee05a84b5e0e768fbf3` and working changes.
- Previous audit: [Image descriptions](study-isizulu-image-descriptions-codex.md).
- Scope: existing isiZulu source-pair disclosure in the separate image viewer.
- Deployment inspected: pending; no new live or visual quality claim.

## Findings carried forward

| ID | Finding | Current disposition |
| --- | --- | --- |
| STUDY-RES-002 | Full ordinary prose and selected app coverage remain incomplete. | Open; Water learner candidates are separately under review. |
| STUDY-ZU-003 | Earlier audits reported missing deck source pairing. | Fresh resolver audit finds all 240 pairs already registered and disclosed in the normal/expanded player. The separate image viewer lacked the text; implemented here, actual phone/offline review pending. |
| STUDY-ZU-004 | Artwork does not consistently carry draft status. | Open for embedded artwork. The source panel identifies unreviewed text, but is not a translation of every label in the artwork. |
| STUDY-ZU-005 | Historical handoffs disagree with current visibility. | This continuation distinguishes current resolver evidence from older claims. |
| STUDY-ZU-007 | Missing isiZulu learner image descriptions. | PR949 merged; production `51463f1` verified. All 32 runtime descriptions matched the applied packet; eight phone screens inspected. |

## Implementation and evidence

One shared content renderer supplies the existing normal/expanded disclosure and
the separate image viewer. Existing corrected silent drafts, review holds and
exact English fallback decisions remain authoritative. Only a viewer with
isiZulu source text gets a bounded image stage and a scrolling reading panel.
Other viewers retain their existing full-height image layout. Image zoom affects
the image alone. Canonical text, audio, assets, indices and `PLAN_VERSION` are
unchanged. This changes the image viewer picture, not the slide image bytes.

[Detailed inventory and limits](../../study-translation-reviews/ISIZULU-SOURCE-PAIR-IMAGE-ZOOM-2026-10-05.json)
records all ten modules and 240 pairs. The existing all-240 source binding test
passed 11 checks. Thirty-seven source/target paragraph counts differ: pairing is
by slide, not by an invented paragraph alignment. Semantic machine reports do
not establish fluent approval or validate every farming claim.

## Verification and next continuation

Root ordered typecheck, full suite (4,665 pass, zero failures, one existing
shape-sync TODO), and whitespace passed. Focused deck checks passed 44/44.
Historical single-heading/source-section checks now assert each reading surface
and compare exact source and target arrays, preserving playback and held-audio
coverage; the extra mounted image dialog made the old global count obsolete.
Exact preview,
actual 390px normal/expanded/zoom source text, one playable and one held slide,
and loaded-route offline behavior remain publication gates. No audio listening,
whole-course cold-start offline or fluent/local farming approval is claimed.
Preserve existing holds and the 22 Sesotho Introduction audio bindings.
