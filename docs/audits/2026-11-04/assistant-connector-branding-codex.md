# Assistant identity audit — 4 November 2026

- Auditor — Codex, chat `01a1a14e-971d-70d3-abdc-2efcaf61d2ef`.
- Reviewed revision — `02ff1adf4547b7719a6cacbc1fde7391b0bfac69` and the presentation changes on `codex/imbewu-connector-branding`.
- Deployment inspected — the private ImbewuField 1.0.2 page and published `https://imbewufield.vercel.app/icon-512.png`. App build `2c4100b` has the same source tree as merge `f6a1702`.
- Previous audit — [production callbacks and native package loading](assistant-connector-loopback-codex.md). MCP-001 through MCP-013 retain their earlier evidence and release gates.
- Scope — MCP initialization identity and private listing metadata.
- Evidence type — actual browser inspection, owned archive download and hash comparison, strict compilers and official SDK integration.

## What was already done

The private package is installed and native discovery exposes 17 customer tools.
The callback and customer-scope corrections belong to PR #1228. This branch is
based on its `02ff1adf4` head and must follow that merge.

The real web plugin page shows the correct name, publisher, description, skill,
server and version. It displays a generic lightbulb and reports the website as
unavailable. The downloaded current release contains the correct square sprout
PNG and both relative logo references. The archive PNG, repository asset and
published app icon are byte-identical, with SHA-256
`36189277e5f2389bfa2ebce0df89f7e8563b11c6e44f8a3ad48e3685cbfcda80`.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MCP-014 | The private listing displays a generic icon despite the valid packaged sprout asset. | Open host rendering check | Archive readback proves both documented logo paths and exact original bytes. Version 1.0.3 includes the complete verified assets, listing website and forest colour. The working website is visible. The host still displays its default image and returns no logo URLs. |
| MCP-015 | MCP clients receive a machine name and version without the app's human display name or image. | Implemented and SDK verified locally | Initialization now supplies `title`, `websiteUrl` and the public square PNG through the SDK's standard `icons` field.  |
| MCP-002 | Installed status can be mistaken for an authenticated connection. | Prior gate remains | The existing native result is `notLoggedIn`. Actual authenticated tool use follows PR #1228's required release checks and deployment. |

## Verification

- Ordered root `npx tsc --noEmit` and functions compiler/entry verification passed on Node 24.
- The lightweight checkout initially omitted imported documentation JSON and preservation-test packets. The original inputs were restored from the same Git revision before the clean checks. No application or assertion change was needed for those missing-file failures.
- The isolated Auth/Firestore/Storage integration passed 110 checks. Its real SDK initialization response contains the display name, app connection page and 512 × 512 PNG reference. Existing permission, retry, operator and exact original-byte assertions remain.
- The published PNG was downloaded and compared byte for byte with the package and source asset.
- The listing colour uses the existing `#1F4D2B` forest token from `tailwind.config.ts` and `app/globals.css`. Its website uses the package's existing verified homepage.
- Private 1.0.3 was updated in place with the complete eight-file archive. The source reader confirms both logo references, website and forest colour, plus USER/PRIVATE scope.
- The real page now shows version 1.0.3 and its working Website link. It still displays a lightbulb. A fresh native catalogue also reports `logoUrl: null` and `composerIconUrl: null`; that rendering gap remains open.
- Native catalogue and local package versions both read 1.0.3, installed and enabled, with 17 customer tools and `notLoggedIn` status.
- The affected app group passed 71 tests. Release-note validation and whitespace passed.
- The authentication branch's local full suite continues separately in its original checkout. This follow-up uses a separate lightweight checkout. Its remote checks and release remain pending.

The intended visual result is the existing sprout mark, app name and forest
theme in assistant surfaces. A valid archive or metadata response alone does
not establish that a particular host displays them.

## Next continuation

Publish the finished branch once and retain the merge order behind PR #1228. Verify the deployed MCP
initialization fields after the required release checks. Carry MCP-014 forward
if the host still substitutes its default image. Continue native OAuth,
selected-site persistence and original-file readback from the previous audit.

The logo-path and listing fields follow the current [OpenAI listing metadata reference](https://developers.openai.com/plugins/deploy/submission#listing-metadata). The square 512-pixel PNG also meets the documented [image requirements](https://developers.openai.com/plugins/deploy/submission-errors#image-errors). These source checks are recorded separately from the host's observed default image.


## Later verification and current-main integration

The callback candidate now integrates map main `81d696f1800151722e088dea19be572fe6de6781`
at `40e462ce77f5bc683ea4b6fce25ce6a0b00157b6`. This branding candidate follows that
integration. The sole additional conflict was the dated audit index; all three
links are retained. Connector functions, package bytes, icon and proxy are
unchanged from the original branding head `4145296e2`. The map renderer/tests
remain byte-identical to main, with no new map picture or `PLAN_VERSION` edit.

Later checks supersede only the earlier verification limits:

- MCP-002 now has 18 actual authenticated native Codex checks, with a matching
  OAuth callback and selected-site original/draft readback. Only authorization
  GET used the deployed corrected preview; issuer, consent, token, MCP and storage
  remained canonical. The published-entry and ordinary Claude gates remain open.
- The callback audit records 34 live transfer checks and 35 live write checks.
  Original synthetic notes/tank status were restored, geometry stayed intact,
  all test grants were revoked and the native cached login was removed.
- The original auth-head `02ff1adf4` full suite finished with exit 0, 6,378 total,
  6,377 passed, zero failed and one existing TODO. It is baseline evidence for
  that head, not a full-suite result for this updated integration.
- A fresh post-full native catalogue read still reports installed/enabled 1.0.3,
  the correct name, app website and forest colour, but null logo/composer URLs.
  MCP-014 remains open. No further package update or public submission was made.

Both earlier heads' rules, focused-render and previews passed. Updated heads
require fresh checks before release. The source-unchanged 110 SDK/emulator
checks retain their original scope. Native/live and terminal suite evidence is
linked from [issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-6623733778).

The resolved branding integration passed ordered Node 24 typecheck, the 90
connector/title/release/Sector checks, functions compiler/entry verification
and whitespace. The inherited map source is the same source that passed 638
shared rendering checks on the integrated auth parent. Functions and package
source remain identical to the earlier 110-check SDK/emulator candidate. The
new integration heads still require their own release CI; no old full-suite
result is relabelled as a new-head pass.
