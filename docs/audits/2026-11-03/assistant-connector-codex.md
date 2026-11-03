# Assistant connector audit — 2026-11-03

- Auditor: Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision: base `a4fdf7afa`, isolated branch `codex/imbewu-mcp-connector`, plus the connector implementation recorded with this audit. Current main `56d6ebad0` and the completed historical-baseline release were merged without changing their map implementation.
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
| MCP-007 | Phone consent content can be covered by global app chrome. | Implemented; final visual recheck pending | Browser evidence caught Lima overlapping scope text. Connection routes now suppress Lima/update chrome and register their own Back link. All account reads and consent decisions use the existing uncached `/api/` lane; stale page HTML cannot authorise a grant. The screenshot below predates chrome cleanup and is labelled accordingly. |
| MCP-008 | Operators need useful access without a production shell or secrets. | Verified in emulators | Current `aiMapMaster` claim plus separate operator OAuth scope is required. Health reads are bounded; the AI kill switch uses preview, expected-value checks, a receipt and audit entry. Tests did not change a live switch or start paid generation. |

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
- No production data was mutated. No paid generation, security-rule deployment or `PLAN_VERSION` edit occurred.
- This adds connection/evidence screens. It does not change the existing rendered map picture.

Temporary Next, emulator backend, callback and isolated Playwright processes were
recorded in `/tmp/imbewu-connector-processes.md` and stopped after this verification
phase. Other chats' previews and the unrelated listener on port 5001 were left alone.

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
