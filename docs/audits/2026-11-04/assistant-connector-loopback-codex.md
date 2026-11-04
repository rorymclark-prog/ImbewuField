# Assistant connector callback audit — 4 November 2026

- Auditor — Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision — main `f6a170245c53cc85542ec94ef6d9fc73bc87b85b` and the callback correction on `codex/imbewu-oauth-loopback`.
- Deployment inspected — `https://imbewufield.vercel.app`, build `2c4100b`. Its Git tree `d11b6d91fe5af330e1f6d1ee98dc1bc7a39b1205` is identical to the merged revision.
- Previous audit — [initial connector implementation and verification](../2026-11-03/assistant-connector-codex.md). MCP-001 through MCP-010 retain their earlier evidence and host verification limits.
- Scope — canonical production discovery, native callback transport and targeted function deployment.
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

The ordered Node 24 typecheck passed. The affected group passed 71 tests,
including the new real NextRequest regression. Whitespace is clean. Full CI
and preview results remain required before merge and will be recorded on the
PR and issue #35. This change affects connection
transport. It does not change the map picture. `PLAN_VERSION` is unchanged.

## Next continuation

Finish the ordered release checks, push the completed correction once, and read
the actual required CI results before merge. Verify canonical loopback consent,
original-byte transfer, persisted registration and disconnect. Create and inspect
the private plugin once, then test the supported native installation and OAuth
journeys. Record any concrete host gate with the observed failure and exact
remaining action.
