# Assistant connector audit — 2026-11-03

- Auditor: Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision: implementation began at `a4fdf7afa` on `codex/imbewu-mcp-connector` (PR #1181). Its `f1a53e262` checkpoint has now been integrated with main `2583801ee3cad1c191e33e257df0af6891eda601` in the separate `codex/imbewu-mcp-integration` checkout, merge `4ea7d5816`, with the corrections below. Historical baseline, named areas, geographic-frame correction and regional A–B profile are retained unchanged.
- Deployment inspected: local emulator backend and actual Next app browser journey; production release and native plugin verification remain pending at this checkpoint.
- Previous audit: no prior connector audit exists. Mapping context is retained from [the current fidelity audit](ai-layer-fidelity-corrections-codex.md); ongoing historical-baseline implementation in the separate map worktree was inspected read-only.
- Scope: account/site consent, personal saved places/surveys/designs, original evidence, historical registration drafts, render progress, organisation production observations and bounded operator controls.
- Evidence type: source review, compiler checks, SDK Streamable HTTP integration, Firebase Auth/Firestore/Storage emulators, browser sign-in/consent and phone/desktop screenshots.

## What was already done

ImbewuField already has Firebase identity, account-only `user_map_data` sync,
revision-ranked design-canvas sync, original lab PDFs in browser IndexedDB,
thumbnail evidence in account-local storage, paid render jobs and strict worker
spending controls. Programme production views already enforce roles, MEL
permissions, funder grants and published aggregate projections.

No MCP server or assistant OAuth provider was present. Browser-local originals
and sheet/report galleries cannot honestly be described as remotely accessible
files. The new service reuses existing saved data and production-view policies.
`UserRole` is extracted without changing its values, so the function bundle can
reuse the existing pure permission modules without pulling browser code into its
compiler graph. Existing map rendering/paid dispatch is not replaced.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MCP-001 | Assistants cannot discover a truthful authenticated app capability surface. | Implemented; local SDK verified | 17 customer tools, plus 2 owner tools; typed inputs, annotations, profile identity and OAuth error metadata. Native installed-host verification remains a separate gate. |
| MCP-002 | An installed plugin card can be mistaken for an authenticated connection. | Implementation verified locally; native verification pending | Resource/issuer discovery, DCR public clients, S256 PKCE, per-tool security schemes, HTTP and tool-level challenges. Actual browser consent returned exactly one selected site to the SDK client. |
| MCP-003 | A document reference can be mistaken for an imported original. | Verified in emulators and browser | The authorised 6,026,629-byte archive JPG was attached only to a synthetic site. Original SHA-256 `7ad1313428b8b3968c44b71866655db29bddae5cc4480257a96b697f80f179bc` and downloaded bytes match exactly. The packaged transfer helper was exercised. No real site data changed. |
| MCP-004 | Organisation membership could accidentally expose another person's maps or funder-private evidence. | Verified in emulators | Personal maps remain bound to the connected UID and explicit site IDs. Other-user assets, unselected sites, other organisations and operator escalation were rejected. Funders received only published aggregates. |
| MCP-005 | Retries, expired credentials and asynchronous jobs can create duplicates or false completion claims. | Verified in emulators | Receipt replay, conflicting retry keys/revisions, pre-upload finalisation, wrong bytes, content dedup, code reuse, wrong PKCE, access expiry, refresh replay, downscoping, disabled accounts and tenant moves were exercised. Worker `complete` remains explicitly visually unverified. |
| MCP-006 | An assistant needs a useful way to prepare historical-photo alignment without altering saved measurements. | Draft preparation and preview verified | Observed control pairs produce an affine fit and pixel residuals. Original/source facts persist; current design revision stays identical. The app preview draws historical evidence and saved outlines. This is a registration draft, not an applied Existing Site/Sector map. |
| MCP-007 | Phone consent content can be covered by global app chrome. | Cleaned phone consent visually verified | The new phone evidence shows readable scope text, one explicit site selection, one Back link and no Lima overlay. The original overlapping view is retained as historical evidence. Account reads and consent decisions use the existing uncached `/api/` lane; stale page HTML cannot authorise a grant. |
| MCP-008 | Operators need useful access without a production shell or secrets. | Verified in emulators | Current `aiMapMaster` claim plus separate operator OAuth scope is required. Health reads are bounded; the AI kill switch uses preview, expected-value checks, a receipt and audit entry. Tests did not change a live switch or start paid generation. |
| MCP-009 | Buffered original transfers can overlap beyond the small instance's practical memory budget. | Configuration tightened; deployment verification pending | This was a configuration review, not an observed outage: twenty allowed 25 MiB bodies nearly fill a 512 MiB instance before ordinary runtime and readback overhead. Only this new handler now limits concurrency to two, retaining three maximum instances. Compiled endpoint metadata confirms those limits; no load-test or existing-worker change is claimed. |
| MCP-010 | The new static tab title has no source-bound native-language catalogue entry. | Corrected; focused checks pass | The live `f1a53e262` full run reported this exact missing metadata identity. Its source row and four explicitly unreviewed machine drafts were added to the existing title authority and packet. Old identities, source SHA, review status and unknown/private-title guards remain intact. No assertion was weakened. |

## Capability and permission mapping

| Scope | Tools | Server-side boundary |
| --- | --- | --- |
| `field:read` | `get_profile`, `get_connection`, `list_sites`, `get_site`, `get_design`, `list_attachments`, `get_attachment`, `list_photo_registrations`, `list_render_jobs`, `get_render_job`, `get_ai_map_access` | Current Firebase user, unrevoked grant, unchanged org membership, access-token scope, explicit site selection, current site existence and record ownership. |
| `field:write` | `update_site_notes`, `update_feature`, `prepare_upload`, `finish_upload`, `prepare_photo_registration` | Same account/site boundaries; current timestamps/revisions and retry receipts. No geometry/species/course edits. Original upload capabilities expire and remain revocation-bound. |
| `field:org` | `get_organization_production` | Existing `decideNetworkAccess` and `productionAreaAccess`, current grants/MEL controls; published aggregates for funders. |
| `field:operator` | `get_platform_health`, `set_ai_map_kill_switch` | Current Auth `aiMapMaster` custom claim, separately consented scope, transaction checks. Ordinary profile roles cannot grant operator access. |

## Verification

- Root typecheck: passed after implementation and phone-chrome changes.
- Functions compiler/entry verification: passed; final description-only change needs the release build.
- Integration: 92 checks passed against isolated Firebase emulators and the real SDK HTTP client, including the packaged original-file transfer helper. Repeated probe runs hit the SDK's intentional in-memory token rate limit; a fresh verification server passed the complete probe without weakening assertions or disabling production rate limits.
- Browser: email/password sign-in, existing app onboarding, consent permission text, explicit one-of-two site selection and OAuth callback/code exchange succeeded. The callback verifier then read the correct stable profile, one authorised site and 17 tools.
- Original output: [desktop registration draft](evidence-connector/synthetic-registration-desktop.png). The fit is deliberately synthetic and explicitly not a claim about the real site's alignment.
- Phone output: [390 × 844 consent before chrome cleanup](evidence-connector/consent-phone-before-chrome-cleanup.png). It caught the overlap recorded in MCP-007.
- First full suite: 5,990 tests, 5,902 passed, 87 failed, one TODO. The failures traced to the historical source-preservation guard rejecting a proposed service-worker cache exclusion. That source edit was removed; no test or historical guard was weakened. A fresh full run is required.
- The next full run uses Node 24 and places `--test-concurrency=2` before test paths in the canonical command. A trailing option was not limiting workers in the earlier Node 26 invocation; that own test process was gracefully stopped before restarting.
- Focused affected contracts: 135 passed on Node 24. Current-main integration exposed a release-guide coverage failure: the new note displaced the earlier map guide from the visible five-line window. A second useful guide stop now sends the reader to review the saved map, and the affected tests pass without assertion edits.
- First preview `7259b19` built and served its exact SHA. Current-head `rules` and `focused-render` passed. The complete updated-head full run and release gates remain required.
- Release CI, deployed URLs and native plugin/Claude compatibility: pending at this checkpoint; not claimed as passed.
- This initial emulator/browser phase did not mutate production data. Later bounded live synthetic verification is recorded below. No real farm record, paid generation, security-rule deployment or `PLAN_VERSION` edit occurred.
- This adds connection/evidence screens. It does not change the existing rendered map picture.

Temporary Next, emulator backend, callback and isolated Playwright processes were
recorded in `/tmp/imbewu-connector-processes.md` and stopped after this verification
phase. Other chats' previews and the unrelated listener on port 5001 were left alone.

## Full-suite integration follow-up

The next complete run exposed three real integration misses in the new screens:
original byte counts used the runtime locale, the new route lacked its own tab
title, and combining the connection-screen condition into the existing update
render guard broke the presentation deck's guarded contract. The screen now uses
`numberLabel`, has server metadata and retains the exact deck guard before its
separate connection-screen guard. No test was changed for those fixes.

Two failures were already present in current main's newly merged historical map
release. Both `DesignGlossy.tsx` and the affected test source had identical Git
blob IDs in this branch and `origin/main`. The old assertions assumed all polish
passes restore no pixels and every provenance footer equals `analysis.noteText`.
Historical output legitimately restores its unphotographed-coverage mask even
after polish and carries its own complete source/coverage/terrain qualifications.

Those claims were rewritten upward, with their reasons in the tests. The tests
now execute the actual queue roof-mask, completion restoration and footer
expressions. They independently verify ordinary Hybrid roofs, polish without a
photographic roof mask, historical blank-coverage preservation, required source
and mask, frozen image/source delivery to the finisher, complete normal notes,
and all historical confidence/coverage/terrain qualifications. Existing font,
padding, hairline box and house/chrome checks remain. No map renderer or picture
was changed to satisfy these checks, and no assertion was simply removed.

The affected group now passes **178 tests** on Node 24. Fresh complete current-head
CI remains mandatory before merge. Local full runs are recorded honestly as failed
or stopped after known failures; long source-preservation checks are not a reason
to label the complete suite as passed.

The isolated Firebase connector function has now been deployed. Live SDK discovery
returns all 17 customer tools, every tool advertises scopes, unauthenticated profile
calls return the actual linking challenge, DCR succeeds, and unauthenticated direct
Firestore access to its synthetic server-side client document is denied. This is
backend evidence only; canonical app publication and native plugin linking remain
separate gates. No real farmer/site record, paid render or security rule changed.

## Live synthetic verification and current-main integration

A normal Firebase self-service signup created one explicitly synthetic farmer
account with no organisation. Its own profile, two clearly labelled test places
and a synthetic canvas were written through the existing client security rules,
without Admin SDK impersonation or changes to any real farm account.

The deployed function passed **33 live assertions** using the official MCP SDK:
DCR, S256 code exchange and state; stable profile identity; all 17 customer tools
with no operator tools; one explicitly selected site and denial of the unselected
site; incomplete-upload rejection; the packaged helper's original-byte transfer;
verified finish and repeat finish; exact 6,026,629-byte original readback with
SHA-256 `7ad1313428b8b3968c44b71866655db29bddae5cc4480257a96b697f80f179bc`;
persisted, explicitly synthetic historical registration draft; unchanged saved
design revision; app-account visibility; disconnect; immediate bearer denial and
revocation of the previously issued download URL. Source authorisation remains
attached to that synthetic asset. This was a direct-backend protocol probe, not
native host linking or a real Ubhejane import. Synthetic credentials remain only
in a mode-0600 temporary file, never in the repository or plugin.

The current branch preview reports build `8fe6511`. A fresh 390 × 844 visual
inspection confirmed that the connection sign-in screen has its own title,
readable controls, one Back link and no overlapping Lima widget. The temporary
browser tab and viewport override were released after that inspection.

Main then advanced through historical-area-labels PR #1182. That change was
integrated unchanged, resolving only the release-note conflict and preserving
both the map note and the assistant note. Outdated local/CI full-suite runs were
stopped explicitly before restarting final-head verification; interrupted tests
are not recorded as passes. This connector still does not modify map drawing
implementation. Native desktop automation of the Codex app itself is denied by
the host's computer-use safety boundary; supported plugin tools/browser and the
official CLI remain the appropriate installation/test paths.

## Latest integration and interrupted local environment

The geographic-frame and regional terrain-profile release is main merge
`2583801ee3cad1c191e33e257df0af6891eda601` (PR #1184), not just the earlier
named-area release. This integration's `DesignGlossy.tsx` has the exact same Git
blob `35e6678d0d75c528eee69d3faf80550ef2f6214a` as that main revision; its new
`sheet-terrain-profile.ts`, native release drafts and audit are also retained.
The separate map chat's shade-tunnel correction is still active and is not
claimed as completed by this connector. No map implementation was edited here.

The historical footer test now preserves the newer release's stronger regional
DEM qualifications: indicative contours, unverified horizontal/vertical accuracy
and height datum, and an explicit excavation set-out prohibition. Its ordinary
complete-note, historical date/coverage/assumption, typography and layout checks
remain. The earlier phrase was retired with its reason, not deleted as coverage.

Ordered integration typecheck and 47 affected tests pass. Functions compilation
and entry verification pass, with compiled metadata reporting concurrency 2,
512 MiB, maximum instances 3 and timeout 120 seconds. These are development
checks; they do not establish final release or native linking.

The old local `f1a53e262` run has no terminal result: its process/session and
temporary logs were no longer present when the runtime was rechecked. Last
observed output contained the related title-catalogue failure. It is not a pass.
Its remote PR run [41657925217](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41657925217)
was independently confirmed still running, with rules and focused-render green;
it was not restarted or cancelled because observation expired. Final source was
prepared in a separate checkout so that live run's source remained unchanged.
New verification files and owned-process records now use a private persistent
local QA directory rather than relying on disposable temporary logs.

The deployed backend also passed separate live Storage checks: anonymous and
owner direct Storage reads were denied, while the owner's account attachment
still returned the exact original after assistant disconnect. Disconnect removes
assistant access without deleting the imported evidence.

Codex's supported native app-server API successfully listed its private-plugin
catalogue without errors or an existing ImbewuField match. That is a feasible
installation path, not proof of installation. Claude Desktop 4.4212.0 exposed
Settings → Customize → Connectors → Add custom connector, with Name and MCP
server URL fields. Nothing was saved there. The app had been closed before this
inspection and was quit afterwards; no user draft was entered. No new chat was
created to force tool refresh. Canonical app publication and native OAuth/tool
verification remain mandatory next steps.

The fresh isolated Auth/Firestore/Storage probe now passes **106 checks**. Its
added operator cases verify that preview leaves configuration untouched, an
applied switch is read back, retry returns the same receipt, a stale expected
value is refused, the initial emulator state is restored, and an owner claim
without operator scope cannot read platform health. No live switch changed.

A fresh browser journey then signed in through the existing app onboarding,
selected one of two sites and completed the real callback exchange. The SDK
read the expected profile, one site and 17 customer tools. The phone consent
view was inspected at a measured 390 × 664 CSS viewport, with content width 390
and no horizontal overflow or overlapping Lima widget:
[cleaned phone consent](evidence-connector/phone-consent-clean.png). The test
connection was disconnected through the app, and its imported original still
opened with successful byte verification in the
[phone registration draft](evidence-connector/synthetic-registration-phone.png).
Its synthetic fit and lack of survey/terrain/current-map claims remain visible.
This local development session reported dependency-link stylesheet/font
warnings; the actual consent and draft views were inspected as rendered.
Canonical published-host inspection is still a release gate.

The callback exited itself after verification. The isolated browser, Next
preview, backend and emulators were all confirmed stopped before the full-suite
phase. The owned emulator-only environment file and current-session raw browser
artifacts were removed. Older tracked browser artifacts were restored unchanged;
they are not part of this connector diff.

## Structures shade recovery integration

Main subsequently merged [the recorded shade-cover recovery](structures-shade-recovery-codex.md)
in PR #1187 at `a602ee78ba094ae10b4f4a764c1cbf2536c407ed`. The combined connector
merge `41e92179d687ec1fd1812ef30c9b75d9ccebc1d0` retains that renderer, its added
checks and its release drafts byte for byte; `DesignGlossy.tsx` now matches main
blob `4ddc52562d9ceede8060fd2ed0f9e0fec9573247`. Both release-note entries and
audit-index links are retained. The map owner's separately recorded visual
evidence remains authoritative; this connector did not paint or spend on a new
map. `PLAN_VERSION`, connector permission/transfer code and plugin bytes are
unchanged by this integration.

The local Node 24 `a70667fee` full run remains on its unchanged checkout. This
new candidate was assembled with a separate Git index so no test source was
switched under the live process and no duplicate heavy local suite was started.
The combined revision still requires its own full current-head CI and rules
result before production merge.

## Terrain integration and update copy

The combined revision includes the two terrain sections from PR #1188 and the
contour detail from PR #1192 through source revision `88bdad20a3eb56fb65a39cdd5cf20400223063e6`.
The renderer, terrain route and helpers match that source. The Sector test
keeps its executable restoration checks where the two branches covered the
same contract. The map branch's separate checks and structure-register
correction are preserved.

The full local `a70667fee` run exposed missing native update descriptions.
The existing update catalogue now carries four
[unreviewed machine drafts](assistant-release-drafts.json) for each of the
nine new note and guide strings. The historical copy and test assertions
remain intact. The older full run stays separate from the verification
of this combined revision.

## Real limits

- Linking ImbewuField does not link Drive, Gmail, an archive or a local filesystem.
  A host must actually be able to obtain and transfer authorised bytes. A local
  helper is included; unsupported file transfer must be reported honestly.
- Saved sheet/report browser galleries are not automatically cloud originals.
  Existing worker status does not establish final map appearance.
- Historical registration drafts are persisted and previewable. The parallel map
  implementation remains the authority for applying historical baselines and
  generating Existing Site/Sector maps. These drafts do not silently replace it.
- Paid generation remains in the app's existing gated flow. This connector does
  not create an alternative spending path.
- Customer tools do not expose organisation member administration, raw farmer
  portfolio data, unrestricted queries, arbitrary URL fetches or a shell.

## Next continuation

1. Finish full tests, whitespace, functions build and package inspection. Push once.
2. Read current-head full `test`, security `rules`, and preview deployment results.
3. Deploy the isolated connector function and existing Vercel app through the
   authorised release path; verify actual endpoint/discovery/build URLs.
4. Save the complete private plugin and inspect its returned connection metadata.
   Exercise actual native linking/tool availability rather than relying on the card.
5. Test feasible Codex/Claude client paths separately and record any unavoidable
   user identity-provider action exactly. Recheck the cleaned phone consent page.
6. Record branch/SHA, release evidence and remaining host limits on issue #35.
