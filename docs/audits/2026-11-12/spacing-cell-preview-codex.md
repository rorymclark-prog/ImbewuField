# Conditional spacing-cell preview

Base: `49d26fd73cf37c96cb5ecf89789955f39b36a54a` (draft PR1348).
Previous records: [combined candidate](global-report-integration-codex.md) and
[cowpea conditions](kenya-cowpea-conditions-codex.md). Existing report and global
release findings retain their recorded scope; this is no agricultural approval.

The preview now offers a separate count method for the existing Kenya cowpea
leaf reference. All spacing and final-stand controls start blank. A grower chooses
within the source ranges and explicitly interprets the source's between-plants
distance as between stations. They must also declare that the whole selected
measured bed area is usable for this area budget. No paths, edge offsets,
orientation, actual rows or physical clearance are inferred.

The formula first floors area in square metres times 10000 divided by row cm
and in-row cm, then multiplies those whole cells by declared whole survivors.
This floor order is an explicit engineering convention, not source agronomy.
Unknown final stand permits a station budget while plants stay unknown. Explicit
zero means zero survivors only when the other prerequisites are valid. The
source's 2–3 seeds per hill never supply a final stand.

World Vegetable Center Publication 24-1077 (June 2024, day unknown), original PDF
pages25–26, supplies spreading50–75cm on both axes and erect/semi-erect50cm rows
with15–25cm between plants. This remains one code-owned typed table. Attribution,
CC BY-SA3.0, original ranges and grower selections accompany the printed preview.
Original PDF SHA256:
`d15d3279690547814b8d369337987f3a6a0893316cbe5cf7ea6afd82e790368c`.
https://worldveg.org/wp-content/uploads/2024/06/24-1077_Agroecology-Kenya_compressed-82.pdf

Original decimal tokens and exact rectangle factors reach the same count helper
in the complete and provisional assessors. A first-class profile origin binds
scope, crop/profile, bed, area basis and source conditions; JSON reload validates
it again. Legacy declared decimal density retains its existing behavior. For
synthetic10.125m² and75×75cm with one survivor, spacing gives18; an independently
declared1.7777777777777777plants/m² still correctly gives17. No epsilon is used.

The preview has no save/adopt action. Existing normalizers preserve a spacing
origin, while ordinary writes and stale edit permits cannot discard or replace
it. The older manual-density editor holds such profiles instead of converting
them. Explicit confirmed profile removal remains available. No production data,
saved geometry, plant identity, lesson content or PLAN_VERSION is changed.

An independent Python Fraction corpus provides40 synthetic boundary cases,
including all source corners, exact long-decimal range admission, reciprocal
loss, both rectangle precision directions, unknown/zero/multiple survivors,
floor order and safe-integer limits. The checked-in fixture records its oracle
hash. These are software-arithmetic cases, not recommendations or field trials.

Validation and actual component/download inspection are recorded outside the
repository in `spacing-derived-planning-20261112`. Current-head full CI,
independent code review, genuine account/device checks and applicable external
review remain separate gates. Automatic AGY calls remain disabled under the
account suspension; no substitute reviewer is represented as AGY or Claude.
Broader region/crop coverage and independent agricultural validation are open.
