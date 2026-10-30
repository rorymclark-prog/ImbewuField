# Oblique AI illustration — 30 October 2026

- Auditor: Codex, following Rory's approval to make Oblique an AI workflow option and show a sample.
- Reviewed base: `ceb3fac3c890f625ab528ea9e42125b6f24cb466`; branch `codex/oblique-ai-view`.
- Deployment inspected: release checks and browser evidence will be recorded on issue #35 and the PR before merge.
- Previous audit: [Style footer and oblique feasibility](map-style-footer-and-oblique-feasibility-codex.md). AI-MAP-010 is released; AI-MAP-011 progresses from proposal to an illustrative beta. AI-MAP-007 photo registration seams remain an input limitation.
- Scope: AI viewpoint selector, automatic reference preparation, one existing paid queue request, frozen-scene recovery and white presentation with a saved-design inventory. No worker, provider, permissions, security-rule or saved-geometry change.
- Evidence: source review, actual saved-site sample generated with the built-in image tool, actual app compositor over that sample, reference-board rendering and automated tests. The built-in sample does not prove the deployed paid pipeline; that requires its own browser/model check.

## What was already done

The measured top-down renderer, boundary foreground treatment, white paper, fine legend border and small Reference Blueprint footer are retained. Existing AI account/organisation gates, sample-mode refusal, provider credentials, quotas and worker spending controls are reused unchanged. A view choice does not grant access or start a render.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-011 | No automatic oblique illustration option. | Implemented; release/browser verification pending. | Top-down/Oblique selector beside engine/quality. The app detaches the paid scene, prepares the whole saved plan, registered aerial/drone photo when present and existing Terrain-RGB contours. If contours are insufficient, only a confidence-qualified local slope is supplied; absent evidence stays unavailable. One board and explicit panel roles use the existing queue/worker. |
| AI-MAP-012 | Overhead restoration and surveyed chrome would corrupt a perspective view. | Implemented and locally inspected. | Versioned `oblique:v1:<style>` job identity survives reload. Raw input/output difference gate runs before the separate finisher. No overhead pixel restoration, label projection, scale bar or north marker is applied. White sheet title, catalogue inventory, review note and small style footer are app-owned. Gallery provenance is `ai-illustrated`, unlocked, needs review; it is not a measured report map. |
| AI-MAP-013 | An attractive concept might be mistaken for surveyed 3D reconstruction. | Explicit limitation. | This first option asks the model to infer perspective from references. It does not build a calibrated terrain mesh or surveyed camera, measure object heights or reproject labels. Inventory counts are saved-design facts, not verified visible model features. A single registered aerial is used; arbitrary photo albums or unregistered drone shots are not ingested. |
| AI-MAP-007 | Photographic inset seams exist in the registered input. | Open input limitation. | The oblique prompt identifies these as photographic artefacts rather than fences. That instruction is not evidence that every model output removes them. The existing top-down source is unchanged. |

## Sample and visual evidence

Private farmer imagery is kept outside Git. User-visible files are in Rory's `Documents/ImbewuField App`:

- `Ubhejane-oblique-ai-concept-2026-10-30.png`: actual built-in image generation, shown in chat. References were the current paid Planting map and registered aerial. Camera request: south looking north, around 45 degrees above ground. Whole plot, two northwest tanks, western beds, buildings/courtyard, southern orchard/bands and eastern road. Only the saved indicative 6.7-degree slope toward bearing 188 was supplied; no detailed DEM was claimed. Output is a representative concept, not app-generated or position-certified.
- `Ubhejane-oblique-app-composition-preview-2026-10-30.png`: the actual app compositor around the above artwork. White paper, saved Whole inventory, no metric bar/north arrow, review footer and small style credit inspected. Frozen source scene unchanged. Local canvas uses fallback fonts; browser evidence must verify the release fonts and actual queue flow.

The app's automatic board supplies a fresh text-free saved-layout reference, photo and terrain panel; it does not substitute the attractive concept for a paid result. No paid bypass or automatic second stage is introduced.

## Verification

- Typecheck: passed after correcting a new test fixture's missing nullable frame image field.
- Focused render suite: 581 passed, zero failures/skips/TODO, including seven new oblique tests. Final release head must pass again in CI.
- New tests cover durable viewpoint/style identity; unavailable/single-height/unconfirmed terrain; complete undistorted reference fitting; actual contour coordinates; unchanged geometry; owner-bound frozen-scene recovery; guarded single paid dispatch; durable raw baseline; and perspective-specific finishing. Existing protections remain intact.
- The first full run exposed `design-glossy-simple` pinning the paid button's former `onClick` spelling. The visibility claim remains required. Its check now executes the real JSX ancestor gates for both viewpoints, approval states and the shelved full pass, and verifies that removing the Simple gate would expose the button. No visibility assertion or paid access guard was removed.
- Full suite: required for this new paid workflow; local run and current-head CI must complete before merge. No pending run is called passed.
- Head `950f3846b` finished full CI with 5 failures: one existing kill-switch source guard required the approval-first Full Treatment wrapper, and four update-notice checks exposed the new draft strings missing from the lazily loaded locale copies. The view guard now wraps the unchanged approval guard, and the exact paired unreviewed drafts are included in all four locale chunks. All 43 affected kill-switch, update-notice and Simple-mode checks pass; no tests were changed for these five failures. A fresh full CI run is required.
- Whitespace/release notes: checked before push; four notice translations remain explicitly unreviewed drafts in `oblique-ai-view-release-drafts.json`. Experimental viewpoint controls are labelled English rather than pretending to be reviewed translations.
- Actual app-generated oblique output, refresh recovery, account/org gates and production build: record terminal evidence on the PR and issue #35.
- The preview's Google sign-in domain is not authorised. No domain/access policy was widened for QA. The production account session can verify the integrated paid output after the required merge gates; the real local compositor output remains the pre-merge visual evidence.
- **This changes the picture.** `PLAN_VERSION` and render-recipe tokens remain unchanged. Existing saved images are retained. This adds an illustrative view; the working measured plan remains top-down.

## Next continuation

Finish the full suite, focused-render, rules and preview gates. Inspect the real preview UI and one authorised oblique worker output, including saved-map reload/reassembly. Record exact evidence before merge, then verify the production build and option. A calibrated terrain mesh, multiple unregistered drone photos, surveyed object heights and projected/occlusion-aware labels remain separate work; none is claimed complete here.
