# Site survey elevation and energy — release continuation, 6 November 2026

- Auditor: Codex site-energy child, coordinated with the international owner.
- Previous audit: [5 November implementation and first repair](../2026-11-05/site-energy-survey-codex.md). Carry SE-001–SE-008 and SS-002/SS-004; this is the same bounded milestone.
- Reviewed source: frozen `7a32235bff2fe62dd50adbb003c34d1e02a83638` plus the explicitly recorded release corrections below. Existing hosting is retained; this record is not a live-release claim.
- Scope remains optional survey evidence, explicit authenticated public solar lookup, review/report context. No map renderer, measured geometry, nursery, rules, species, lessons or workflow edits. `PLAN_VERSION` is unchanged.

## Actual failures and bounded corrections

The two full current-head CI runs for `7a32235` failed. Run42120486956 ended with6404 passing,6 failing and1 existing TODO; run42120494234 had the same six failures. These are related contract failures, not dismissed as unrelated. Rules, focused-render and preview passed for that old candidate.

- SE-009: two bare number formatting calls in the new energy card violated the existing number-format contract. Use shared `numberLabel`; retrieval dates explicitly show the UTC source date.
- SE-010: both new farmer-facing components were absent from the typography surface register. Classify both as farmer surfaces with the existing zero-debt12px floor, increase the month labels from10px to12px and specify field-error12px. No expert exemption or weakened assertion.
- SE-011: the eight new release/tour descriptions lacked the native draft pairs expected by four existing update-notice tests. Supply32 exact-source provisional machine drafts through the existing update-copy dictionaries; preserve all old entries, controls, release history and English backing. The generated packet remains unreviewed with inactive generation metadata; separate coordinator adoption/disposition records the existing English-backed caption policy. No dedicated AI-draft badge or fluent approval is claimed. Translation provenance and adoption remain recorded beside the source packet. Fluent review is still open (SS-002).

## Independent source disposition and actual application checks

The original reviewer `/root/claude_patch_review` was a Codex source reviewer, not a Claude-provider call. Its a799 receipt SHA256 is `b471c11505c5d1be8280ec69e296e907b788884c61793b514d84084ffbf7a928`. Root separately inspected the actual6ca repair and accepted SE-005 (late Refresh result after removal) and SE-006 (invalid manual input silently lost). That second source-only receipt SHA256 is `a2245b781622c0236bd1d464a4423d68b0f46c7322d3819706463a0135dff8c2`. Neither source review claims a full-suite pass or hosted customer certification.

Fresh integrated QA used the actual Next app shell, AuthProvider, SiteSurveySheet and persistence under local Auth/Firestore/Storage emulators. A temporary fixture route supplied an explicitly synthetic site/model300 and seeded mandatory base questionnaire answers through `saveSurvey`. New energy/elevation inputs, Review, Save, reload, draft recovery and normal email/password login/onboarding used the real UI. This does not certify normal farmer-map entry navigation; the fixture route was removed before release. There was no browser auth/storage injection and no production record write.

- The exact visible Save & continue control was disabled for benchmark11000. After keep-draft/full-reload/Resume the input still contained11000, and its source/datum survived. The focused screenshot visibly includes the field.
- Wind101 likewise blocked Save and survived full reload. Correcting it to0 allowed Save. Benchmark0 remained separate from synthetic model300; source/datum, wind0, height12, source period and obstacles survived save and full reload.
- Normal B login showed neither A's saved survey nor A's unfinished draft. B saved a separate benchmark123. Normal A return retained its saved0 and unfinished11000 draft. Authenticated read-only emulator checks confirmed A→A200, B→B200 and B→A403.
- The explicit authenticated PVGIS button fetched the documented generic45N,8E example. The actual result was1359.85kWh/year for assumed1kWp, with12months, irradiation1761.99kWh/m²/year, source2005–2023, tilt39°, azimuth1° and losses14% preserved. Refresh then Remove did not reinstate the old result. Another explicit fetch/save/full reload retained the complete reference.
- Three free public PVGIS calls used only those generic demonstration coordinates. No private site coordinates, paid AI calls, credentials or production writes were used.

The durable integrated receipt and actual PNG/text evidence are under `/Users/roryclark/Documents/Codex/2026-11-03/realtime-voice-chat/work/energy-survey-integration-20261106/receipt.json`. This workstation path is an evidence location, not a repository-relative shipping asset.

## Limits that remain visible

- SE-003: supported automatic Wind Atlas point import is not connected. Manual source/height/exposure/period transcription is implemented; no wind turbine kWh is fabricated.
- SS-002: provisional native release descriptions do not establish fluent or consequential survey-wording review. Existing source-English backing remains.
- SS-004: actual local integrated browser checks now cover save/recovery/account isolation, but physical phone/Safari and production/customer account sync remain unverified.
- The hosted preview normal Google sign-in explicitly reports an unauthorised web address. OAuth/domain/security settings were not changed. Local emulator sign-in does not resolve or conceal that deployment limit.
- The local Next fixture session emitted legacy CSS asset404s; the card interactions and exact tested source hashes are retained. Hosted preview build status is separate evidence.

## Verification and resource receipt

The bounded number-format/typography correction first passed Node24 typecheck and162/162 affected tests. After the four-language handoff and source-pair adoption, typecheck and184/184 affected tests passed, including all four previously failing update-notice cases and the new byte-preservation regression. Whitespace is clean. The same code is frozen for full current-head gates. Durable local logs are under `output/site-energy-survey/verification/` in the release-fix checkout.

The initial typecheck after removing the local fixture route found only its stale generated `.next/types/app/energy-survey-qa/page.ts` import. That owned generated file was removed after confirming the route source was absent; the rerun was clean. No application file or assertion was altered for that cleanup.

Full suite, current-head CI/rules and configured preview results remain pending after final freeze. Do not infer them from old candidate checks. No merge while required full gates are pending.

Own NextPID19328 and emulatorPID19143 were checked against their recorded commands/checkouts and gracefully stopped after QA. The owned Chrome tab was closed; temporary fixture source was moved out of `app/`. Ports4295/8080/9099/9199 were free at cleanup and handed back to root; any later listeners belong to the next owner's phase. No other chat's process was stopped.

This changes the picture: readable survey energy labels and elevation/energy cards. It does not change map geometry or `PLAN_VERSION`.
