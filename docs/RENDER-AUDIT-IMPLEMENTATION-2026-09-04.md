# Render audit implementation — review branch

This branch preserves the Design Studio editor, its tools, saved geometry, species catalogue and
Exact Canvas artwork. Responsive page changes are being handled separately. Do not merge this
branch or deploy its worker until Rory has reviewed it.

## What changed

- AI image generation requires the server-issued `aiRenderTester: true` account claim. The
  environment switch and worker kill switch remain default off. Ordinary accounts keep Exact
  Canvas and saved maps; paid controls are absent. See [tester administration](AI-RENDER-TESTERS.md).
- Every newly queued job captures a detached scene and source image, bound by a SHA-256 revision.
  Completion uses that scene after edits, navigation or reload. An earlier revision is saved as
  such and cannot replace the current design cache or start the next paid stage.
- Queue completion preserves the original site, underlay, output mode and quality. Cancelled
  subscriptions cannot publish stale results. Unassembled output retains its recovery pointer,
  subject to the existing automatic-resume budget.
- Audit records identify the site, attempt, job and revision. Multiple comparisons of one paid
  pass count once. Old logs cannot borrow another run's success.
- Both paid stages compare against their durable uploaded input. A separate comparison checks
  whether model work survives final composition. Small retained edits are not forced to occupy
  ten percent of a page containing unchanged labels and ground.
- AI candidates carry a review status. Neither an image-change score nor a requested geometry
  lock certifies model-drawn feature counts or positions. Unscored artwork stays explicitly
  unscored in the gallery and audit history.
- Fully protected masks restore the source instead of exposing the model output. Incompatible
  image aspect ratios fail instead of being stretched. Required roof/zone overlay failures do not
  silently ship unprotected artwork.
- Prompts no longer prescribe an unsupported crop mixture for every staple plot or forest around
  every water map. Supplied crop identities and observed ground remain the reference.
- Gemini transient retries retain the requested image configuration and explicit fallback state.

## What this does not claim

AI can still invent or move features inside the artwork it paints. This branch confines that
feature to selected experimenters and removes the false verification claim. The exact master is
the reference for building and planting. Reinstating identical exact sprites over the entire AI
return would repeat the previous paid-but-identical failure, so this branch does not do that.

A future strictly controlled illustrated renderer needs approved assets in saved feature slots,
exact material clipping and app-drawn routes. That visual change needs its own reviewed examples.
The source-image blur, exact roof materials and swale artwork were not redesigned here.

No paid provider render was used for development. Tests cover geometry/source snapshot integrity,
mask/aspect behavior, retries, access decisions, audit grouping and retained image differences.
These checks do not establish that a new paid image is aesthetically better.

## Compatibility and review

Existing saved maps remain readable. Older in-flight jobs without a snapshot are retained but are
not combined with the latest design. A render from a different scale or renderer recipe requires
its original settings; it is not silently reconstructed under a new recipe. Provider outputs with
different aspect ratios are retained for diagnosis rather than stretched; supported padding/crop
transforms can be added later if provider examples require them.

`PLAN_VERSION` remains unchanged. Prompt and final-comparison changes can affect future paid
pictures, while the exact canvas artwork remains the same. Assign any release version at merge,
following the repository's single-writer rule.

Review the free Exact Canvas and saved-map controls in the branch preview. Test access with an
ordinary account and an explicitly approved account before any paid experiment. Deploy the worker
gate before enabling either image-generation switch. Opening or closing the draft PR changes
nothing in production. If the branch is unwanted, leave it unmerged; no rollback of main is needed.
