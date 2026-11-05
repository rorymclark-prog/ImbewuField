# Personal profile initialization contract

The profile-retry source test previously required an exact three-field object.
Current retry, Google redirect and Google popup initialization all write a fourth
field, `org_id: null`. The old assertion failed on both the KML branch and its
`b908db69f809d78dd37a26ba6ad885c95148b963` baseline with byte-identical auth source.

The replacement examines the actual TypeScript syntax tree. Every checked default
write must be awaited and explicitly contain exactly these meanings:

- `full_name`: that path's initializing actor's `displayName ?? ''`;
- `role`: `farmer`;
- `language`: `en`;
- `org_id`: explicit `null`.

An explicit null records an unaffiliated personal account. It does not grant an
organization, tenant access, administrator role or any authorization. Existing
profile membership and chosen signup roles remain covered by the separate
`independent-grower-profile-initialization.test.ts` tests.

The original account-creation error isolation, missing-profile retry condition and
profile re-read assertions remain intact. The new checks compare all three actual
default initialization paths without depending on property order or quote style.
Negative controls reject omitted or non-null organization, privileged role,
changed language, wrong actor, altered name fallback, spreads and duplicate keys.

This change updates tests and this explanation only. `lib/auth.tsx` remains
byte-identical (SHA256
`18bfb80d2626fefa1c1267f73c31e40d2f166edaeb9cffe25d5e636a0ea0c23d`).
The AST checks are source-contract tests, not Firebase integration or browser QA.
