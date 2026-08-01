# Firestore and Storage rules-fix proposal

Date: 2026-08-01

This is a proposed diff, not a deployed change. `firestore.rules` and `storage.rules` are
intentionally unchanged. The exact blocks below are written against the current files and should
be applied by the owner only after the enrollment/data checks in this document are complete.

## Decision required before rollout

The repository has the enrollment schema and client writes, but no migration, backfill, production
seed, or fixture proving that current learners have `course_enrollments` documents. Production data
could not be inspected in this sandbox. Treat the answer as **unknown, with a backfill required
unless production proves otherwise**.

Do not deploy the mentor-scope rules first. A mentor whose learner has no matching enrollment would
lose access to that learner's progress, assignments, submissions, and logs. The dashboard currently
calls `listTrainees()` (all farmers/students in the mentor's org), then calls `getCourseProgress()`
and `getAssignments()` for every returned profile. A safe rollout therefore needs:

1. an inventory of current mentor/learner responsibility and the learner's org;
2. one default-track enrollment document per genuine relationship, with
   `profile_id`, `enrolled_by`, `org_id`, `track: 'permaculture-core'`, and a non-withdrawn status;
3. a check that log documents carry the same non-null `org_id` as the enrollment; and
4. a dashboard/query change to load enrolled learners (or exact profile gets derived from the
   enrollment list), rather than relying on a mentor-wide profile list. The current `listOrgEnrollments`
   query is org-wide; a mentor-scoped enrollment rule needs an `enrolled_by == current uid` query.

The `course_enrollments` document id is deterministic in `lib/course-enrollment.ts`:
`${profile_id}_${track}`. This proposal scopes the shipped default track. Adding more tracks needs
the same rule/data design explicitly; do not silently widen the rule to arbitrary client-supplied
track ids.

## Shared helper for mentor responsibility

Add these functions after `inMyOrg` (the exact path expression matches the existing deterministic
default-track id):

```firestore
function mentorHasLearner(profileId) {
  return isMentor()
    && myOrg() != null
    && exists(/databases/$(database)/documents/course_enrollments/$(profileId + '_permaculture-core'))
    && get(/databases/$(database)/documents/course_enrollments/$(profileId + '_permaculture-core')).data.enrolled_by == request.auth.uid
    && get(/databases/$(database)/documents/course_enrollments/$(profileId + '_permaculture-core')).data.org_id == myOrg()
    && get(/databases/$(database)/documents/course_enrollments/$(profileId + '_permaculture-core')).data.status in ['invited', 'active', 'paused', 'completed']
    && get(/databases/$(database)/documents/profiles/$(profileId)).data.org_id == myOrg();
}

function mentorOwnsLearnerData(d) {
  return 'profile_id' in d
    && d.org_id == myOrg()
    && mentorHasLearner(d.profile_id);
}
```

`paused` remains readable because it is a temporary mentor decision and the course model says its
history matters. `withdrawn` is excluded. The log's `org_id` check prevents a valid enrollment from
being used to read an unscoped or cross-org log.

### Signup profile block (current lines 33–52)

Replace the create/update block with:

```firestore
match /profiles/{uid} {
  allow get: if signedIn() && (
    uid == request.auth.uid
    || (isStaff() && myOrg() != null && resource.data.org_id == myOrg())
    || mentorHasLearner(uid)
  );
  // A mentor cannot enumerate the whole profile directory. Staff queries must carry the org
  // equality constraint; mentor dashboards load profiles by their enrollment relationships.
  allow list: if signedIn() && isStaff() && myOrg() != null
    && resource.data.org_id == myOrg();
  // Public signup may create only an ordinary learner account. Trusted Admin-SDK code or custom
  // claims must assign mentor/staff roles after the person is verified and placed in an org.
  allow create: if signedIn() && uid == request.auth.uid
    && request.resource.data.role in ['farmer', 'student']
    && (!('org_id' in request.resource.data) || request.resource.data.org_id == null);
  allow update: if signedIn() && uid == request.auth.uid
    && request.resource.data.role == resource.data.role
    && request.resource.data.org_id == resource.data.org_id;
}
```

This stops a new client from minting `mentor`, `ngo`, or `funder` access. It does not stop trusted
Admin-SDK provisioning. It preserves the owner's profile edits and the staff org directory, but it
requires the mentor page to stop using a mentor-wide profile list. The login role dropdown must be
changed in the same rollout; rules remain the actual boundary if an old client is still installed.

### Farm and log reads (current lines 57–109)

Replace the mentor branches as follows:

```firestore
match /gardens/{gid} {
  allow read: if signedIn() && (
    sameOrg(resource.data)
    || resource.data.supervisor_id == request.auth.uid
    || exists(/databases/$(database)/documents/gardens/$(gid)/members/$(request.auth.uid))
  );
  allow write: if signedIn() && (
    (isStaff() && myOrg() != null && request.resource.data.org_id == myOrg())
    || resource.data.supervisor_id == request.auth.uid
  );

  match /members/{pid} {
    allow read: if signedIn() && (
      sameOrg(get(/databases/$(database)/documents/gardens/$(gid)).data)
      || get(/databases/$(database)/documents/gardens/$(gid)).data.supervisor_id == request.auth.uid
      || pid == request.auth.uid
      || mentorHasLearner(pid)
    );
    allow write: if signedIn() && isStaff()
      && myOrg() != null
      && get(/databases/$(database)/documents/gardens/$(gid)).data.org_id == myOrg();
  }
}

match /production_logs/{id} {
  allow read: if owns(resource.data) || sameOrg(resource.data) || mentorOwnsLearnerData(resource.data);
  allow create: if signedIn()
    && request.resource.data.profile_id == request.auth.uid
    && request.resource.data.kg is number && request.resource.data.kg > 0
    && request.resource.data.crop is string && request.resource.data.crop.size() > 0;
  allow update, delete: if owns(resource.data);
}

match /sales_logs/{id} {
  allow read: if owns(resource.data) || sameOrg(resource.data) || mentorOwnsLearnerData(resource.data);
  allow create: if signedIn()
    && request.resource.data.profile_id == request.auth.uid
    && request.resource.data.kg is number && request.resource.data.kg > 0
    && request.resource.data.amount is number && request.resource.data.amount >= 0
    && request.resource.data.crop is string && request.resource.data.crop.size() > 0;
  allow update, delete: if owns(resource.data);
}

match /expense_logs/{id} {
  allow read: if owns(resource.data) || sameOrg(resource.data) || mentorOwnsLearnerData(resource.data);
  allow create: if signedIn()
    && request.resource.data.profile_id == request.auth.uid
    && request.resource.data.amount is number && request.resource.data.amount >= 0
    && request.resource.data.item is string && request.resource.data.item.size() > 0;
  allow update, delete: if owns(resource.data);
}
```

The log replacements stop a mentor from reading unrelated money while preserving farmer ownership,
staff same-org reads, and a genuine mentor/learner link. The garden replacement removes an
unscoped mentor read because `gardens` has no learner-owner field and rules cannot safely query
"any member enrolled under this mentor". A future farm-oversight flow needs an explicit
`mentor_id`/owner relationship or a separate authorized read path before that branch is restored.
The proposed staff garden write check assumes gardens carry `org_id`; if deployed data does not,
backfill that field or keep staff writes closed until it does.

### Course and report reads (current lines 111–190)

Replace the relevant read lines with:

```firestore
match /reports/{id} {
  allow read: if ownsField(resource.data, 'owner_id')
    || sameOrg(resource.data)
    || mentorOwnsLearnerData(resource.data);
  allow create: if signedIn() && request.resource.data.owner_id == request.auth.uid;
  allow update, delete: if ownsField(resource.data, 'owner_id');
}

match /course_progress/{id} {
  allow read: if owns(resource.data) || isStaff() || mentorOwnsLearnerData(resource.data);
  allow write: if signedIn()
    && request.resource.data.profile_id == request.auth.uid
    && request.resource.data.module is string
    && request.resource.data.done is bool;
}

match /course_submissions/{id} {
  allow read: if owns(resource.data) || isStaff() || mentorOwnsLearnerData(resource.data);
  allow create, update: if signedIn()
    && request.resource.data.profile_id == request.auth.uid
    && request.resource.data.module is string
    && request.resource.data.submitted_at is string
    && request.resource.data.self_check is list
    && (!('photo_path' in request.resource.data) || request.resource.data.photo_path == null || request.resource.data.photo_path is string)
    && (!('voice_path' in request.resource.data) || request.resource.data.voice_path == null || request.resource.data.voice_path is string);
  allow delete: if false;
}
```

This preserves the mentor's course evidence flow for enrolled learners. It does not solve the
separate unscoped `isStaff()` course-read issue; that is listed below as a further finding. A safe
staff fix needs `org_id` on these currently org-less documents, plus a backfill and writer update,
before replacing `isStaff()` with `sameOrg()`.

### Enrollment and assignment reads

To make the relationship itself least-privilege, replace the current read clauses with:

```firestore
match /course_enrollments/{id} {
  allow read: if owns(resource.data)
    || (isStaff() && inMyOrg(resource.data))
    || (isMentor() && inMyOrg(resource.data) && resource.data.enrolled_by == request.auth.uid);
  // create, update, and delete remain as currently written.
}

match /course_assignments/{id} {
  allow read: if owns(resource.data)
    || (isStaff() && inMyOrg(resource.data))
    || mentorOwnsLearnerData(resource.data);
  allow create, update: if isStaff() && inMyOrg(request.resource.data)
    && request.resource.data.assigned_by == request.auth.uid
    && request.resource.data.profile_id is string
    && request.resource.data.module is string
    && (request.resource.data.due_at == null || request.resource.data.due_at is string)
    || (isMentor() && mentorHasLearner(request.resource.data.profile_id)
      && request.resource.data.assigned_by == request.auth.uid
      && request.resource.data.profile_id is string
      && request.resource.data.module is string
      && (request.resource.data.due_at == null || request.resource.data.due_at is string));
  allow delete: if (isStaff() && inMyOrg(resource.data)) || mentorOwnsLearnerData(resource.data);
}
```

The parentheses around the `allow create, update` OR should be retained when this is transcribed
into the deployed file. The mentor page must query enrollments with `where('enrolled_by', '==',
currentUid)` (and the org constraint), or its current org-wide query will be denied by the
relationship-scoped rule. This is a deliberate client/rules rollout dependency, not a reason to
leave the current broad mentor read in place.

### Shared sites (current lines 223–230)

Replace the block with:

```firestore
match /shared_sites/{code} {
  // The share code is the capability. A caller must already know the exact document id.
  allow get: if true;
  allow list: if false;
  allow create: if request.auth != null
    && request.resource.data.code == code
    && request.resource.data.code is string
    && request.resource.data.code.size() == 6
    && request.resource.data.geojson is map;
  allow update, delete: if false;
}
```

This stops unauthenticated collection enumeration while preserving the public share URL's exact
known-code read. The `code == code` check also prevents a client from creating a document whose
payload claims a different share code than its path. No data migration is required.

## Rollback

If the deployment denies a legitimate learner or dashboard action, revert the deployed rules file
to the immediately preceding rules version and restore the previous dashboard query/client bundle.
Keep the enrollment backfill; it is additive and can be audited. Do not roll back by reintroducing
public `/shared_sites` listing or by granting every mentor all logs. Any temporary emergency access
should be a narrowly scoped trusted Admin-SDK operation, logged and removed after the affected
enrollment/org data is repaired.

## Part 3 — other over-broad rules (report only)

These are not changed by this task. They are ranked by the sensitivity and breadth of the data or
write they expose.

### Critical / high

1. **Storage `/photos/{allPaths=**}` read, `storage.rules:33–35`, and the overlapping
   `/photos/{folder}/{uid}/{file=**}` read at `:27–30`: `allow read: if true`.** Every uploaded
   photo is world-readable, including any future folder and any user's exact farm imagery. The
   feature may need public images in published reports, but this catch-all is broader than that
   need. Replace it with an explicit published/report path or an authenticated, owner/authorized
   viewer check; remove the duplicate catch-all.

2. **Storage course evidence read, `storage.rules:15–22`: role-only `isCourseStaffOrMentor()`.**
   Any account whose profile says mentor/NGO/funder/admin can read every learner's submission photo
   or voice file, with no org or enrollment relationship. It should mirror the Firestore
   `course_submissions` relationship and org check; a storage rule change needs emulator/deploy
   verification because the cross-service lookup is currently documented as unverified.

3. **Unscoped staff writes, `firestore.rules:64` and `:75–76`: `isStaff()` can write any garden or
   garden member.** The role is not combined with `myOrg()`/the parent garden's org. It should be
   same-org staff, with the parent garden org checked on member writes and a separate supervisor
   path for the supervisor's own garden.

4. **Unscoped staff reads, `firestore.rules:112`, `:129`, `:181`, `:196`, and `:214`:** staff can
   read every design, course-progress row, course-submission row, mentor visit, and survey response
   across organizations. These documents do not consistently carry `org_id`, so the right fix is
   an explicit org field plus backfill/writer update, then `sameOrg`; do not guess an org from a
   role alone. If designs are intentionally cross-org, that should be a separately documented
   share/publication capability rather than `isStaff()`.

### Medium

5. **Organization read, `firestore.rules:54`: `isStaff()` reads any organization document.** A
   staff role can enumerate or inspect organizations by id, including organizations outside its
   org. Change the broad branch to a deliberately global admin capability, or to the caller's own
   organization for NGO/funder users.

6. **Programme read, `firestore.rules:55`: no `signedIn()` guard and `resource.data.org_id ==
   myOrg()`.** An unauthenticated request has `myOrg() == null`, so an org-less programme document
   is readable publicly; any signed-in role in an org can also read all programme documents in that
   org. Require `signedIn()` and confirm whether all org members or only staff should read the
   programme; at minimum use `inMyOrg(resource.data)`.

7. **Survey creation, `firestore.rules:209`: any `isStaff()` user may create a survey with a
   client-supplied `org_id`.** The rule checks `created_by` but does not require the new document's
   org to equal the caller's org. Require a non-null caller org and
   `request.resource.data.org_id == myOrg()` (or have trusted code stamp it), while retaining the
   creator check.

8. **Mentor visits, `firestore.rules:192–203`: reads allow any staff member and creates allow any
   mentor to name any `trainee_id`.** The visit itself is not tied to an enrollment or org. Scope
   staff to the visit's org after adding/backfilling it, and require mentor creation to satisfy the
   same enrollment relationship used for learner data.

9. **Photo writes, `storage.rules:27–31`: the wildcard `{folder}` permits an owner to write into
   any photo namespace.** The user is limited to their own uid folder, but the arbitrary folder can
   create files in namespaces the feature did not define. Constrain `folder` to the documented set
   (or use separate matches), while preserving the size/type checks.

### Deliberately broad but currently feature-shaped rules to re-check

The `community_*` rules at `firestore.rules:238–283` are broad among signed-in users by design,
but are behind the server-side `communityOn()` kill switch and match the community feature's
discovery/board/messaging model. `community_reports` is admin-only by design. The render-job and
render-usage rules are owner-scoped. They are not classified as findings here, but should remain
covered by regression tests whenever the community or render features change.

## Data migration and backfill risk

- **Required before mentor reads:** map each genuine mentor-to-learner relationship into the
  deterministic default-track enrollment document. Do not infer it solely from `role`, `org_id`,
  or a cohort label; those are not a relationship.
- **Required for money reads:** verify/backfill `org_id` on production, sales, and expense logs to
  the learner's actual org. A missing/null org will intentionally fail the proposed mentor rule.
- **Potentially required for garden reads/writes:** verify gardens have `org_id`; the current
  `Garden` TypeScript type does not declare it, so this cannot be assumed from the app code.
- **No migration for shared-site reads:** exact document ids already exist; only the authorization
  split changes.
- **No migration for immutable profile fields:** the current update rule is already correct and is
  pinned by the test.
