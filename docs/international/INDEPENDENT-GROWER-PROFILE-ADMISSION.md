# Independent grower profile compatibility

A coordinator reproduced a first-account save failure using a disposable local emulator account and normal authentication. Actual app initialization created a profile without an organisation field; personal design creation was rejected. An explicit-null profile admitted the same personal creation. Production reproduction has not been performed.

The four existing first-profile creation paths now initialize `org_id: null`: Google redirect completion, signed-in observer fallback, email signup and Google popup. Existing UID, epoch, migration and error guards remain. Existing profile lookup paths skip initialization; this is not a generic profile edit or membership reset.

The rules read missing organisation membership with the established safe map getter. A self-profile edit compares both old and proposed membership with the same missing/null interpretation, while retaining exact role equality and same-user requirements. This admits ordinary legacy profile edits and an explicit null repair. Non-null membership cannot be assigned, replaced or deleted by the client. Organisation and staff access continue requiring their existing non-null membership and consent rules.

Eight actual mounted AuthProvider regressions isolate the four creation paths, existing memberships and stale account reads. Four additive rules scenarios exercise actual missing-key documents, personal designs/reports/logs, repairs, immutable roles/membership, cross-account isolation, spoofed ownership/organisation and anonymous denial. Original assertions remain intact. Local checks and current-head release evidence belong in the coordinator handoff; this document is not a security certification or deployment receipt.

The existing-language update notice includes four Codex AI wording candidates, still labelled as drafts with English source backing. No fluent approval or new runtime language is established. No species, lessons, farming figures, measured geometry or PLAN_VERSION changes.
