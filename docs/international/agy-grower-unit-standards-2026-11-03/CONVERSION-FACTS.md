# Bounded Measurement Standards Verification

## 1. Source-Verified Primary Conversion Factors

Primary sources fetched by coordinator: [NIST SP 811 Appendix B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8) (UTC 2026-11-03T03:17:40Z; SHA `be7334086bcb574317dd1f78a7822adb699670b7f2bece6ca8a252884158eb5f`), [Appendix B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9) (UTC 2026-11-03T03:17:40Z; SHA `0197b5ee24ad88a42cabb9f58a2a08bbda25431dc9182c222e66c09390583396`), and [Footnotes](https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes) (UTC 2026-11-03T03:27:20Z; SHA `20a953aad34582d88d50b099b9b3d4ed9d069787cbfe32b4220f965f21967bd5`).

| Quantity & Unit | Target SI Unit | Printed Factor | Exactness in Source | Distinguished Non-Target Units |
|---|---|---|---|---|
| International foot (`ft`) | meter (`m`) | `3.048 E-01` | Exact (bold in table) | U.S. survey foot (`3.048 006 E-01 m`) |
| International inch (`in`) | meter (`m`) | `2.54 E-02` | Exact (bold in table) | Microinch, mil |
| International square foot (`ft²`) | square meter (`m²`) | `9.290 304 E-02` | Exact (bold in table) | Acre, survey square mile |
| Avoirdupois pound (`lb`) | kilogram (`kg`) | `4.535 924 E-01` | Footnote 22: `4.535 923 7 E-01` (exact); table rounded | Troy pound (`3.732 417 E-01 kg`), pound-force |
| Avoirdupois ounce (`oz`) | kilogram (`kg`) | `2.834 952 E-02` | Rounded in table; exactness UNRESOLVED | Troy ounce, fluid ounces (volume) |

## 2. Fact vs. Implementation Boundaries

- **Exact Pound vs. Unresolved Ounce**: Footnote 22 defines pound as exactly `0.45359237 kg`. The ounce lacks an exact definition in supplied sources; its rounded table factor is insufficient for canonical conversion. Ounce support remains an implementation gate.
- **Mathematical Derivations**: Inverses (e.g. $1/0.3048$, $1/0.45359237$) and compound density denominators (plants/m² $\leftrightarrow$ plants/ft²) are arithmetic derivations, not printed table factors.
- **Display Isolation**: Presentation toggles must never alter stored coordinates, round geometry, or convert count/package observations into weight. Source inspection does not activate unit support.

## 3. Proposed Negative Controls

1. **Unit-family confusion rejection**: Ingestion must reject survey foot, troy mass, and fluid volume units across linear, area, or mass inputs.
2. **Zero geometry drift**: Toggling display units must not mutate canonical stored metres, degree rotations, or canvas coordinates.
3. **Package mass isolation**: Converting units must never assign implied weight to discrete package or count observations.
