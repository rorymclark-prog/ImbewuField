# Country form and harvest-target consumer regression contract

This repair changes test consumers only, from application base
`ce7b291f18687d4660a295d0f03bd7c33df544f3`. It does not roll back exact-date
buyer records or change country, geometry, acceptance or storage authority.

## Corrected layout claim

The mapped own-records harvest editor is intentionally available to both
catalogue-supported and unsupported countries. A confirmed mapped South African
site therefore has exactly one `basis="own-records"` editor and one separate
default-basis catalogue editor: two total. Unknown or unsupported mapped sites
retain the record-only editor while catalogue advice and exports remain held.

The former confirmed-country assertion expected one total editor and treated
the first row as catalogue. Root independently reproduced that unchanged case
failing on the intended two-editor layout before this repair. The country form's
renewed confirmation, stored metadata, sowing preservation and remount checks
remain in place; only the obsolete count/identity claim changes.

## Acceptance consumers must be distinguishable

`international-planner-context.test.ts` selects the catalogue editor by its
actual default `basis === undefined`, never array position or simply “not own.”
The own-records editor is selected independently by its explicit basis.

The suite now contains these complementary controls:

- A current supported-country catalogue callback appends a schema-valid copied
  fixture sowing into an initially empty isolated plan through the actual page
  updater and canonical saver. It must change stored plantings and perform one
  canonical-book write. The fixture introduces no crop timing, yield or spacing
  guidance; its basis note explicitly describes an engineering control.
- The separate own-records callback remains a no-op, with unchanged raw book,
  plantings and zero canonical-book mutations. Its success cannot validate
  catalogue acceptance.
- A retained actual catalogue callback after a silent country change must keep
  the original plantings and complete raw book unchanged and perform zero
  canonical-book mutations.
- The same negative requirements apply after a same-coordinate bed-kind
  change, alongside the retained queued-production invalidation assertion.

Per-key counters belong only to the isolated in-memory test storage. Baselines
are captured after setup/event settling, so place metadata writes, initial
migration and unrelated storage rows cannot satisfy or pollute the acceptance
controls. The retired import-evidence assertion remains unchanged.

## Evidence limits

The real page, country policy, country form, canonical book initializer and page
mutation handlers execute in the established controlled React harness. Child
presentation widgets and external geometry/network inputs remain substituted.
This is not browser, real-account, deployed-security or farming-suitability
evidence. Root sequences typecheck and affected tests after the frozen handoff;
this document makes no new passing-check claim.
