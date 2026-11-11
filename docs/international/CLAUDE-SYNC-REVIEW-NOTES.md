# Independent review of the first sync draft — 2 November 2026

These are actual-helper probes run against the new draft, not hypothetical
requirements. Root will not release until each has a real regression and fix.
Keep your exclusive ownership and original guardrails. Do not weaken tests.

1. **A context has no stored base binding.** `withoutStaleSiteContext` checks
   coordinates only. A row confirmed as ZA at updatedAt 100 keeps that context
   when copied into a deliberate whole-place edit/re-add at updatedAt 300.
   `mergePlaceContexts` also trusts the new row's own copied context. Bind each
   stored confirmation to the exact base revision/creation identity it describes;
   reject stale copied context on whole-place writes, moves and re-adds. A
   transient UI confirmation can remain unbound until the safe helper binds
   each current alias independently. Never infer approval for missing binding.
2. **Two revision authorities disagree for legacy rows.** `mergePlaces` defaults
   to old placeTs (updatedAt only), while context transactions use placeRevision
   (updatedAt or savedAt). An old legacy row savedAt 2020 with ZA context and a
   newer legacy row savedAt 2026 without context both compare as zero in the
   merge, which attaches the old ZA context to the newer row. The actual probe
   returned the newer savedAt with old country ZA. Use one reviewed base/context
   identity rule, including legacy creation identity; keep original deliberate
   re-add/tombstone behavior covered rather than silently changing it.
3. **Late account-A cloud mutation/report survives a switch to B.** A held
   tx.get was released only after Firebase UID and mounted owner changed from
   A to B. The draft still wrote A's cloud row and invoked onCloudReport with
   outcome applied under current UID B. B's local row stayed isolated, but the
   stale cloud mutation and report are wrong. Guard captured account identity
   at start, after await, in transaction retries and at report delivery. An
   obsolete operation must not switch accounts or report into B's UI.
4. **Rejected context stays locally approved.** With remote row moved to a new
   coordinate/revision and old local row still present, the context transaction
   correctly returns base-changed, but the local old site remains confirmed ZA
   and allows automatic planning. On definitive rejection, invalidate/roll back
   only that still-current local confirmation (guard account, base revision and
   exact context identity), notify consumers and report the rejection. Do not
   erase a newer confirmation or overwrite geometry. Network unavailability is
   pending, not a definitive rejection or successful cloud acknowledgement.

The following three narrow follow-up probes were also run against actual helpers
with synthetic data and mocked transport after the first four fixes landed:

5. **Superseded context stays approved without any new listener event.** Same
   base revision, remote bound KE confirmation dated later than the local ZA
   confirmation: result superseded/localConfirmation kept, no cloud writes,
   remote KE/local ZA and allowAutoPlanning true. Invalidate the still-current
   superseded confirmation or apply the authoritative winner through the same
   guarded path; do not wait for an event from a transaction that wrote nothing.
6. **A metadata edit drops an unrelated malformed raw row.** A raw saved-place
   array containing the valid target plus an unrelated malformed row returns
   local-saved but shrinks from two stored rows to one because normalisePlaces
   sanitises the whole array before writing. A country edit must preserve every
   unrelated raw row or refuse the write; it is not a cleanup/migration action.
   Keep the existing readable-place projection separate from raw mutation.
7. **Cloud writes need both account guards.** With mounted owner A still bound
   while Firebase currentUser is B, the helper correctly writes local A only,
   but upsertPlaceContext still writes A's cloud row and reports applied under
   Firebase B. Keep the local namespace bound to mounted A, but require BOTH
   mounted owner and Firebase UID to match the captured UID for cloud reads,
   each transaction retry/write and late report delivery. Do not switch to B's
   namespace or erase A's local pending edit during this transition.

The UI/planner/report fixture authors will update their explicit saved-place
fixtures to the final bound schema while retaining original behavioral checks.
Send the exact schema/API contract when ready. Root will integrate the new
places-only React subscription and display truthful local/cloud outcomes.
