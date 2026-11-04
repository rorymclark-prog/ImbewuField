# Claude web connector verification — 2026-11-04

- Auditor: Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision: released main `a5300d2f7e1da32238196e02444c1c494f954761`, identical tree to verified candidate `050b22fecc928d3b2f0e3f921fd7f8ad17158e92`.
- Deployment inspected: canonical `https://imbewufield.vercel.app/api/assistant/mcp` through the signed-in Claude web host.
- Previous audit: [production and Codex verification](assistant-production-host-verification-codex.md). Its initial Claude gate is superseded only by the web evidence below; its desktop control-surface observation remains accurate.
- Scope: ordinary Claude custom connector DCR, selected synthetic-site consent, authenticated discovery, one actual read and complete test cleanup.
- Evidence type: observed host UI, actual OAuth callback, expanded host tool response, screenshots and independent owner readback.

## What was already done

The previous audit records the merged release, required exact-head full/rules/render
checks, successful preview and production deployments, 39 canonical production
checks and 18 actual native Codex checks. None was restarted for this continuation.
The private plugin remains version 1.0.3 with its original identity and audience.

Claude Desktop's stale AX/no-window control limitation prompted the supported web
fallback. The existing signed-in Chrome profile could open Claude's normal custom
connector flow. Only the explicitly named `ImbewuField synthetic verification`
definition and synthetic farmer were used; existing connectors were preserved.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MCP-016 | Claude needs its own authenticated host journey, beyond Codex success. | Verified in Claude web for discovery and one actual read | Normal Add custom connector → canonical endpoint → Sign in now → Register automatically (DCR) completed. Direct same-browser synthetic sign-in, one-of-two site consent and unchanged canonical callback succeeded. Claude discovered exactly 12 read and 5 write tools, with no operator tools. A single incognito prompt executed `list_sites`; the expanded actual tool response contained exactly the selected synthetic site. Desktop app control itself is not claimed verified. |
| MCP-014 | Private plugin card substitutes a generic icon. | Still open host publication/rendering gate | Correct packaged/published sprout and standard live MCP icon metadata are retained. No new package version or actual corrected private-card rendering is claimed. |

## Verification

The first synthetic consent was completed in an isolated browser lacking Claude's
signed-in session; its callback reached Claude's auth-error/login route. That is
not a successful host journey. A fresh unchanged callback returned to the original
signed-in browser did connect and discover tools. A final reconnection then used
normal synthetic sign-in and consent directly in that same signed-in browser,
without a callback bridge or preview substitution, before the actual tool read.
No PKCE, state, redirect URI or server permission was changed.

The actual host result was expanded and inspected, rather than inferred from the
model's prose. Claude displayed a completed `list_sites` connector activity and
these response fields:

| Observed field | Actual synthetic response |
| --- | --- |
| Returned sites | 1 |
| Name | Synthetic Connector Release Site |
| ID | `site:-28.12345,30.12345` |
| Place ID | `release-fixture-a` |
| Has design | Yes |

The unselected second site was absent. The incognito prompt restricted the host to
this one connector read. No write, paid generation, farm advice or real farm record
was requested. This proves one actual Claude host read, not every possible Claude
workflow, file upload, owner action or mobile/desktop client.

[Actual connected tool groups: 12 read and 5 write tools](assistant-claude-connected-tools.png).
The screenshot was inspected. The settings remained at the host's existing
approval choices; no Always allow setting was enabled. The incognito session was
ended after saving the observed result, keeping it out of normal chat history.

Cleanup completed through the actual UI: Claude disconnected, then only the owned
test definition was removed. All three synthetic grants from the callback trials
were separately revoked in ImbewuField. The temporary Chrome ImbewuField sign-in
was confirmed synthetic, signed out, and its owned tab closed. The isolated test
browser and one-use loopback callback helper both exited; no user app was closed.
An independent fresh normal owner sign-in subsequently confirmed two retained
sites, zero active connections, original notes, tank status `existing`, one
preserved original and one unapplied registration draft.

Automatic main CI [41868034947](https://github.com/rorymclark-prog/ImbewuField/actions/runs/41868034947)
still had full `test` in progress at the final check, with `rules` and
`focused-render` successful. It was neither restarted nor described as passed.
The two successful full CI runs on the identical release candidate tree remain
the release's terminal full-suite evidence. This continuation changes only audit
documents and evidence; whitespace and relative links pass. No product picture
or `PLAN_VERSION` change, runtime test or deployment was introduced here.

## Next continuation

Keep MCP-014 open until the private host actually renders the sprout. Functional
release verification now includes canonical production, native Codex and a real
Claude web read. Broader Claude workflows and the desktop app remain outside this
single-read acceptance claim.
