# Assistant connector callback audit — 4 November 2026

- Auditor — Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision — main `f6a170245c53cc85542ec94ef6d9fc73bc87b85b` and the callback correction on `codex/imbewu-oauth-loopback`.
- Deployment inspected — `https://imbewufield.vercel.app`, build `2c4100b`. Its Git tree `d11b6d91fe5af330e1f6d1ee98dc1bc7a39b1205` is identical to the merged revision.
- Previous audit — [initial connector implementation and verification](../2026-11-03/assistant-connector-codex.md). MCP-001 through MCP-010 retain their earlier evidence and host verification limits.
- Scope — canonical production discovery, native callback transport, plugin loading and targeted function deployment.
- Evidence type — actual deployed HTTP requests, official MCP SDK, source reproduction using the app's NextRequest class, regression checks.

## What was already done

PR #1181 merged after its full CI run passed 6,376 tests with zero failures and
one TODO. Rules and focused-render also passed, as did the duplicate push run.
Production deployment jobs remained queued for over three hours. Their exact
queued handles were cancelled before the authenticated Vercel CLI redeployed the
verified preview artifacts to the production target. Both established domains
were assigned to that deployment. Build metadata retains the preview commit and
branch, with the identical merge tree verified independently.

A targeted Firebase deployment updated only `imbewuConnector`. The deployment
completed successfully and an independent function inventory reports concurrency
two, retaining the bounded memory and instance limits. The earlier source review
finding MCP-009 now has production configuration evidence.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MCP-001 | Assistants need a truthful authenticated capability surface. | Canonical discovery verified, signed-in canonical probe pending | Live health, both metadata endpoints, both standard well-known routes and all 17 public customer schemas respond. Anonymous data access returns the linking challenge. |
| MCP-002 | An installed card can be mistaken for an authenticated connection. | Native creation and linking pending | Private plugin `plugins_6aea9fe058908191a3719bc8a25f93b1` was created once as a USER-scoped PRIVATE package. Creator readback retains its branded icon, MCP endpoint and OAuth DCR scopes. The native Codex catalogue reports it installed and enabled. Authenticated tool use remains a separate check. Canonical DCR succeeds. |
| MCP-009 | Whole-file buffers could overlap beyond the instance memory budget. | Deployed configuration verified | The successful targeted deployment and subsequent Firebase inventory both confirm concurrency two. This is configuration evidence, with no claimed load test. |
| MCP-011 | Desktop OAuth registration succeeds but the callback is rejected through the app proxy. | Reproduced, correction awaiting release verification | GET authorization with a registered `127.0.0.1` callback fails through Vercel and succeeds directly against the same backend. HTTPS callbacks and POST authorization succeed. The installed NextRequest class rewrites the loopback address inside its URL query to `localhost`. The underlying web Request retains the exact original. The proxy now reads that URL through the standard Request getter, preserving callback, state and resource bytes. |

| MCP-012 | The private package installs but its tools are absent from the native Codex inventory. | Corrected and native discovery verified | The loader rejected the server-level OAuth `extensions` field. Version 1.0.1 uses standard MCP OAuth discovery. Readback preserves the endpoint, assets and skills. Native inventory now exposes all 17 customer tools with `notLoggedIn` status, and the actual tool call asks for connection. |
| MCP-013 | Claude requests every advertised scope, including owner controls, during ordinary connection. | Corrected, host reconnection pending | The real DCR journey reached the app consent screen with the operator scope. Claude's setup exposes transport and registration choices but no scope field. Both metadata endpoints now advertise the same customer scope list. Owner requests still explicitly accept `field:operator` and enforce the current claim. The emulator authenticates an ordinary account using the discovered list and separately exercises owner permission. |

## Verification

The regression uses the actual installed NextRequest class. It checks IPv4,
IPv6, localhost and HTTPS callbacks, nested callback queries, an opaque state
containing a loopback address, exact resource and the fixed route target. The
previous proxy fails this check because its normalized URL changes the IPv4
callback. Runtime validation continues to require the registered callback and
S256 PKCE.

The deployed canonical probe stopped on MCP-011 before granting access or
transferring files. Its earlier discovery and anonymous challenge checks passed.
The successful earlier backend and emulator original-file checks remain recorded
in the previous audit. Canonical signed-in persistence, disconnect and native
installation are still required after this correction.

The ordered Node 24 typecheck and functions compiler passed. The isolated
Auth/Firestore/Storage integration passed 108 checks, including ordinary
authorization using the actual discovery scope list and separate owner controls.
The affected root group passed 71 tests,
including the new real NextRequest regression. Whitespace is clean. Full CI
and preview results remain required before merge and will be recorded on the
PR and issue #35. This change affects connection
transport. It does not change the map picture. `PLAN_VERSION` is unchanged.

The earlier local full run on `be34f3601` was stopped after the real Claude
scope-discovery issue required this source change. It has no terminal pass.
Its runner and temporary emulators/backend were confirmed stopped before the
new full-suite phase.

Claude Desktop 4.16336.0 completed endpoint checking and DCR through its real
connector controls. Its browser handoff reached the existing owner's app session.
The request was cancelled before granting access. The unconnected test connector
definition was removed and the unused form/tab closed. No user account was signed
out. A new test after release will use the synthetic app account.

## Next continuation

Finish the ordered release checks, push the completed correction once, and read
the actual required CI results before merge. Verify canonical loopback consent,
original-byte transfer, persisted registration and disconnect. Create and inspect
the private plugin once, then test the supported native installation and OAuth
journeys. Record any concrete host gate with the observed failure and exact
remaining action.


## Current-main integration and later live verification

Main advanced to `81d696f1800151722e088dea19be572fe6de6781` through the reviewed
Existing Site and Zone releases. The OAuth candidate integrates that main with
`02ff1adf4547b7719a6cacbc1fde7391b0bfac69`. The only merge conflicts were the two
audit indexes and release notes. Both map notices, the three connector notices,
the connector/map guide stops and all audit links are retained. The renderer,
map regressions and native map release drafts are preserved from main. This
integration does not add a map picture change or edit `PLAN_VERSION`.

Later evidence advances the earlier findings without replacing their history:

- MCP-001/002/012: private ImbewuField 1.0.3 is installed and enabled with 17
  customer tools. Its actual Codex DCR/PKCE callback completed, matching the
  explicit login ID. Eighteen native authenticated checks verified the synthetic
  identity, one selected site, denial of the other site and unrelated organisation,
  saved design, preserved original and registration draft. Only the authorization
  GET used the corrected deployed preview; consent, token, MCP and storage used
  canonical production. This is not a normal published-entry OAuth pass.
- MCP-003/004/005/006: 34 live transfer/persistence/revocation checks verified the
  authorised 6,026,629-byte original, exact readback, provenance, repeated finish,
  persisted synthetic corner-fit draft, unchanged design revision and owner access
  after disconnect. The actual published phone draft was visually inspected at
  390 pixels with no horizontal overflow. No surveyed or applied map is claimed.
- MCP-005: 35 further live checks verified note/status previews, applied persistence,
  receipt retries and stale timestamp/revision refusal. Original synthetic notes
  and tank status were restored. The complete final design equals its starting
  data apart from legitimate revision/edit time; all measured geometry is intact.
- Test cleanup was independently read back: two synthetic sites, zero active grants,
  original notes/status, one original and one registration draft. Native logout
  removed the synthetic credentials. No real farm record or paid job changed.
- MCP-011/013: actual local Next HTTP adapter and deployed Vercel preview return the
  proper consent redirect for the registered loopback callback. Canonical production
  still needs this correction and the customer discovery scope release. Ordinary
  Claude reconnection remains unverified after release.

The original full suite on clean `02ff1adf4` completed in its owning session with
exit 0: 6,378 tests, 6,377 passed, zero failed/cancelled/skipped, one existing TODO.
The TODO source is identical to main. This is parent-head baseline evidence, not
an updated integration-head full-suite pass. Both old heads' rules/focused-render
and previews passed; their full CI jobs were running when this integration began.
Fresh required checks apply to the finished updated heads. Detailed live evidence
and terminal counts are recorded in [issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-6623733778).

The resolved integration passed ordered Node 24 typecheck, 90 affected
connector/title/release/Sector checks, all 638 checks from the shared
`test:render` file list with two workers, functions compiler/entry verification,
and whitespace. Release-note validation passed with its existing one-commit
stamp tolerance. The connector runtime and its tests are unchanged from the
previous auth head; map runtime/tests and native release data match current main
byte for byte. The original 108 isolated connector checks remain baseline
runtime evidence. A new full suite and required current-head CI are still
pending for this integrated source, not inherited from the old heads.
