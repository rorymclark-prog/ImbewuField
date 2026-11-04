# Assistant production and host verification — 2026-11-04

- Auditor: Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision: candidate `050b22fecc928d3b2f0e3f921fd7f8ad17158e92`, merged by PR #1244 as main `a5300d2f7e1da32238196e02444c1c494f954761`. Their complete trees are identical: `8fdc6efdf8e975c8d970f397417f8d5aafee54e9`.
- Deployment inspected: both [ImbewuField](https://imbewufield.vercel.app) and [PermaMap](https://permamap-sa.vercel.app) independently serve `a5300d2`, branch main.
- Previous audit: [combined release integration](assistant-release-main-integration-codex.md), carrying forward its MCP findings and earlier workflow evidence.
- Scope: released OAuth, selected-site permissions, standard MCP identity, preserved original evidence and drafts, native Codex and feasible Claude Desktop linking.
- Evidence type: exact-head CI, production HTTP and actual SDK checks, actual native app-server OAuth/tool calls, browser consent inspection and independent owner readback.

## What was already done

PR #1244 combines the callback and branding corrections with the previously
released Water and Sector work. All required head checks passed before the
ordinary expected-head merge. No force/admin bypass was used. No `PLAN_VERSION`,
species, lesson, measured geometry, security-rule deployment or paid-generation
bypass changed in this continuation.

The existing app and connector deploy workflows completed successfully:
[app 41868034399](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41868034399)
and [Functions 41868034396](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41868034396).
No duplicate manual function rollout was needed. Production Vercel deployment
`dpl_9y1K1iK6bfv4CqXqn9NrfAZaMFSe` is READY on the exact merge SHA.

The [private ImbewuField plugin](https://chatgpt.com/plugins/plugins_6aea9fe058908191a3719bc8a25f93b1)
remains USER/PRIVATE version 1.0.3, release
`pluginrel_6aeaaefa34d88191bed543c9a3d5e80e`, installed and enabled with 17 customer tools.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MCP-001/002/004/005/008/012 | Authenticated workflows need selected-site and role boundaries after release. | Verified within stated scope | 39 normal canonical production checks and 18 actual native Codex tool checks passed. The canonical grant requested all three customer scopes and denied unrelated organization access; the native default requested only `field:read`, so its organization denial is scope evidence, not an independent organization-role test. Owner controls retain the prior 110-check emulator evidence; no production owner switch was exercised. |
| MCP-003/006 | Original files and draft registrations must remain evidence, without pretending to be an applied surveyed map. | Verified | Existing 6,026,629-byte original read back with SHA256 `7ad1313428b8b3968c44b71866655db29bddae5cc4480257a96b697f80f179bc`; retry deduplicated. One synthetic corner-fit draft remains `needs-visual-review`, unapplied. No second upload or new render job was created. |
| MCP-011/013 | Desktop callback bytes and ordinary customer discovery previously blocked normal production OAuth. | Verified in production and native Codex | Real canonical DCR/S256 GET loopback succeeded. Discovery advertises exactly `field:read`, `field:write`, `field:org`; operator access is not a default request. Native Codex completed its actual matching login callback and authenticated calls without preview substitution. |
| MCP-014 | Private host shows a generic plugin icon. | Open host publication/rendering gate | Packaged and published original PNGs and both manifest paths match. Latest actual catalogue metadata still has null `logoUrl`/`composerIconUrl`; the earlier actual card was generic. No version churn, public submission or claim of a corrected card image. |
| MCP-015 | MCP server needs the actual app name, website and icon metadata. | Verified on deployed SDK initialize | Canonical production returns title `ImbewuField`, website `/connect/imbewu` and `/icon-512.png`. This is independent of the private catalogue card gate. |
| MCP-016 | Ordinary Claude Desktop linking needs its own completed host journey. | Unverified; desktop automation gate | Earlier real flow reached consent using Add custom connector → Sign in now → Register automatically (DCR), then was cancelled before granting a real farm. After release, repeated desktop actions exposed duplicated/stale AX controls; screenshots disagreed with that state, and the control surface finally returned `noWindowsAvailable`. No new connector definition or grant was submitted in this final attempt. Claude was not restarted or closed. Complete the actual canonical DCR journey when a usable host window is available; do not infer success from Codex. |

## Verification

- Ordered candidate Node24 typecheck, 168 affected checks, 638 focused-render checks, Functions compiler/entry, release notes and whitespace passed, as detailed in the integration audit.
- Both exact-head [PR tests 41827503398](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41827503398) and [push tests 41827360627](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41827360627) passed full `test`, `rules` and `focused-render`. The [Actions preview 41827360686](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41827360686) passed on attempt 2 after retrying only the failed font build. One unchanged-source Vercel retry also succeeded. No font, package or workflow edit was made for the transient loader failure.
- Local exact-head full log ended at 6,385 total / 6,384 passed / zero failed, cancelled or skipped / one existing TODO. The original owning session expired before its exit receipt was retrieved, so no local exit-zero claim is made. Both exact-head full CI successes supply the terminal full-suite evidence.
- The automatic main test run 41868034947 was still running when inspected; its `rules` and `focused-render` jobs had passed. It is a separate result and is not labelled a full pass.
- The 39 canonical checks used only published production routes, the synthetic farmer and one of two selected synthetic sites. They covered metadata, anonymous challenge, actual schemas, DCR/PKCE, selected-site restrictions, original bytes/provenance, deduplication, persisted draft, existing job/AI gate reads, preview-only writes, exact saved-design preservation, disconnect and post-disconnect file/token refusal. They did not exercise a paid provider.
- Native Codex used the installed private plugin and supported app-server APIs with an ephemeral no-model-turn runtime. It requested read-only access by default, received exactly one selected synthetic site, refused the other site, retrieved the actual original bytes and draft, and preserved the design revision. No user sidebar chat was created.
- Output inspected: actual production consent at 390-pixel width, with the sprout, readable read-only explanation, one checked site and one unchecked site. [Consent screenshot](assistant-native-canonical-consent-phone.png). This is a synthetic fixture, not a real farm.
- Cleanup: supported Codex logout and app-side Disconnect Codex completed. Fresh native status is `notLoggedIn`, with 17 schemas. Independent ordinary owner sign-in confirmed two retained sites, zero active grants, original notes and tank status, one stored original and one registration draft. All owned browser/app-server/test processes are exited. Existing user apps and other connectors were preserved.
- This evidence-only continuation changes no product picture. `PLAN_VERSION` is unchanged. No new runtime tests were needed for the documentation files; whitespace and linked evidence were checked.

## Next continuation

The release and normal Codex journey are usable. Keep MCP-014 open until the
private host actually displays the packaged sprout. Finish MCP-016 through
Claude's normal canonical DCR flow with a synthetic selected-site grant when its
window is usable, then disconnect it and recheck owner state. Neither outstanding
host check is represented as an implementation test failure or a completed
end-to-end Claude result.
