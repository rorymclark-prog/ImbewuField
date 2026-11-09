# Invalid nursery resources must not imply absent transplant batches

The actual local crop-planning screen reproduced a contradictory review: an
existing transplant proposal remained visible, but allocating more containers
than the saved stock made the nursery review unavailable and also said that the
proposal had no transplant raising batch. An empty resource date interval caused
the same misleading message. Rejecting those resource inputs was correct.

The empty-batch sentence now requires a checked forecast fingerprint. Invalid,
missing or stale requests without a fingerprint retain their unavailable-review
message, unknown headroom and specific input problems. Checked proposals with no
transplant batches retain their existing empty-batch explanation. No calculation,
resource validation, saved data, observation, export or permission changes.

Two added mounted regressions reproduce the false absence claim before the
correction, for excess allocated containers and an empty date interval. Each
also checks recovery to the actual transplant batch after valid input. A
direct-field proposal supplies the positive control for a genuinely empty
nursery review. Existing test assertions remain intact; the shared fixture's
default transplant behavior is unchanged.

Release-note draft: "Nursery input errors no longer say a transplant batch is absent."

This is a local correction on top of ce637c546e9df5c4dc536a49d4ce1234c2467e0c.
The parent has a strict 10,539-case full-suite pass. That parent result is not a
new full-suite result for this correction. Final checks and browser evidence are
recorded separately by the coordinator. Hosted/current-head CI, account/cloud
verification and release approval are not established by this document.

This changes the picture in the invalid-input state. PLAN_VERSION is unchanged.

## Local validation of this correction

Node24 typecheck passed with a4GiB heap after the initial2GiB-capped process
exhausted its heap. The ordered affected run then passed93tests across7files,
with zero failures, cancellations, skips orTODOs. Whitespace was clean. No full
suite was repeated. The release-note drift script passed on the unchanged parent
history; the draft note above still needs coordinated adoption when integrating.

The corrected screen was also exercised through supported CUA browser controls
against the existing fictional local site. Allocating3trays while saved stock was2
retained unknown headroom and the specific input-error message, without the false
empty-batch sentence. Re-entering2trays restored the saved Cabbage batch and its
reviewed6positions,6starts,8seeds,2fills and0.12m² footprint. No farming record was
changed during that correction check. The temporary tab, preview and generated
cache were released afterwards. This is local UI evidence, not a hosted release.

The final release entry has now been added for9November, covering the ce637
parent and the correction in its next commit. After that source change, Node24
typecheck passed again. The final affected run covered the7nursery files plus
5release/update files:133tests passed, zero failures/cancellations/skips/TODOs.
The earlier93-case result remains the narrower pre-note correction evidence.
The signed-in local emulator follow-up separately verified fictional account
journal and crop-estimate separation through sign-out/relogin, and denied an
authenticated second account's read/write attempts on the first account's
profile. These are bounded emulator/device checks, not hosted production proof.
