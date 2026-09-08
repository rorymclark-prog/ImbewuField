# Training and report quality review — 8 September 2026

The request was to make a training record useful in the field, give its report a
clear visual structure, and carry repeated product decisions into future work.
The review covered the existing tour, mentor/organisation/funder flows, training
storage and projections, report builders, and the available earlier design and
audit decisions. It does not claim a review of every historical conversation or
every app route.

## Decisions applied

- Use a compact **Tour** label. Remove repeated fictional/sample notices from
  current screens and exports. Keep relevant distinctions for generated imagery,
  unmeasured plans, missing observations and cumulative reporting periods.
- Capture attendance names, an optional participant reference, a finger/pen
  signature, and a certificate reference. A national identity number is not
  required. Support paper-register photographs when device signing is impractical.
- Keep session activity, group, certificate and venue photographs together.
  Each photo has a category, caption and explicit sharing choice.
- Capture the venue with one GPS action, show an embedded Google map, and offer
  Google Maps and directions links. Retain manual venue entry.
- Connect five existing English/isiZulu post-course questions to the session.
  Support assisted recording with consent and linking the existing assessment
  flow for participants answering through their own accounts.
- Reuse one report presentation across training and programme reports: partner
  identity, key figures, charts, clear sections, signed register, feedback and
  captioned evidence. Include full-colour and ink-saving exports.
- Preserve scope, dates and missing-data meaning. Funders receive published
  summaries, explicitly reviewed photos and suppressed small-group findings;
  attendance identities, signatures and written responses remain private.

## Implementation and checks

Training fields are wired through validation, API save/read, tour persistence,
funder projection, screen preview and PDF export. Signature strokes are encoded
for Firestore storage and decoded at the read boundary. The Firestore serializer
test verifies the actual wire representation rather than only a JSON round-trip.
Photo/document limits are enforced in both upload preparation and validation.

The review exercised save and reopen in the tour at a 390-pixel phone width and
checked the desktop training layout, embedded map, report presentation, internal
and funder PDFs, ink-saving export and programme progress report. The phone page
had no horizontal document overflow. The full suite passed with the repository's
one pre-existing tracked TODO. New coverage checks signatures, feedback validity,
explicit photo sharing, storage serialization and funder privacy.

The independent final code review identified an assisted-feedback draft that
could retain a removed/absent participant. Selection now clears when eligibility
changes and the Add action checks the current present roster.

Live authenticated account writes and physical-device GPS permission behaviour
were not exercised. The original attached image files could not be materialized;
the corresponding live UI and available attachment descriptions informed the
review. Certificates are recorded as references and photographs, not issued as
accreditation by this change.

All 18 pre-generated garden report PDFs were refreshed from the shared renderer.
This changes report presentation; PLAN_VERSION and saved geometry are unchanged.
Generated tour-photo provenance is recorded in TRAINING-ASSETS.json.

The reusable **ImbewuField Quality** skill records the accepted decisions and a
review sequence covering capture, persistence, permissions, presentation, export
and actual visual inspection. It was installed and checked separately from this
repository.
