# Multiple confirmed availability windows per growing space

The own-estimate automatic planner now accepts separate grower-confirmed date
intervals for each saved measured bed or field plot. Add creates an empty,
unconfirmed interval. Editing/removing one preserves its siblings and other beds.
Each interval keeps an exclusive end; gaps are unavailable. Confirmed duplicates,
partial overlaps and nested overlaps are held. Adjacent intervals remain separate;
they are never silently joined to fit a longer cycle.

The existing automatic-plan engine remains the scheduling authority. Full field
occupancy plus turnaround must fit inside one interval. Existing canonical own
reservations and unresolved legacy occupations are still checked and cannot be
overridden by confirmation. The existing workflow DTO and saved schemas are
unchanged. Stable private UI row identities are stripped before the parent review;
every edit invalidates old proposals and in-flight acceptance callbacks. The
parent still owns current actor/source/whole-book and final-write checks.

Interval area labels reuse the existing approximate-number display helper. A
saved polygon area can show ≈21 m² without changing its full underlying measured
value, count/capacity arithmetic or saved geometry. No new formatter, farming
calendar, timing, yield, crop identity or country-readiness rule is introduced.

Ordered final coordinator verification: Node 24 typecheck exit 0, then 351/351 across
29 affected files, zero failures/skips/TODO, followed by clean whitespace. This includes 13 new
real workflow tests and 18 actual UI cases. The old workflow produced 4 passes and 9 failures on
the 13 new controls because it rejected every repeated bed ID. An independent
read-only review found no actionable issue within the four-file model/UI scope;
the later display-only correction was separately exercised against actual source,
submitted DTO and unrounded planner capacity. Focused checks are not full-suite
or release approval.

Actual local desktop and 390px phone review used the built-in temporary garden.
Normal forms saved explicitly synthetic own estimates and a labelled buyer target.
Two date intervals were entered through native browser controls for an existing measured plot: the first
was too short for the synthetic cycle, so the proposal selected the later complete
window. The UI withheld the previous proposal/save action immediately after a date
edit, displayed the overlap hold, and accepted the corrected proposal through the
ordinary guarded Save. Its DEMO receipt and the saved own-record readback agreed
on the later field-entry/next-entry dates. Existing sample beds with unresolved
occupations remained held. No observed sowing, harvest, stock or sale was recorded.

Phone document width 390px matched viewport 390px; date and Remove controls measured
44px high. Actual sibling-removal and other-bed values were retained. Availability
is ephemeral review input, not a new persistence ledger. Real account/hosted flows,
full current-head CI and production release remain unverified gates. Temporary
preview, viewport and usable tab resources were cleaned up after review. A small
Nextdev memory limit caused earlier connection-error tabs; no app-code workaround
was introduced and blocked error-page access was not bypassed.

The update descriptions contain 12 additive unreviewed Codex AI candidates for the
four existing update languages, preserving prior dictionary bytes. There is no
fluent review or new runtime language activation. Global control translations
remain a separate review scope. Stacked after invoice summary draft #1257 at
bbb0848674f4337791ce1be454974f654e9ec260. No PLAN_VERSION/species/lesson/geometry change.
This changes the automatic planner screen picture. No production merge is claimed.
