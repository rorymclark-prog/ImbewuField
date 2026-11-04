# Review Notes: Saved Invoice Currency Summary UI Copy Drafts

## Scope and Intent
- Packet: `invoice-currency-summary-copy-2026-11-04` (source SHA-256: `498e348fe37779b82d1804342d2c8e9f34a655f1da375c6c3ef8dc006506adad`).
- Candidate Drafts: 98 inactive AI drafts (14 distinct messages across 7 locales: `fr`, `es`, `pt-BR`, `sw`, `hi`, `bn`, `id`).
- Token Preservation: Literal `DEMO` in message 06 and interpolation token `{count}` in message 12 are strictly preserved across all target outputs without alteration.

## Key Considerations for Fluent Human Financial Review
1. **Invoice Status vs Bank Clearance**: Message 13 explicitly clarifies that "recorded paid" reflects the grower's internal document status, not bank receipts, cleared settlement, or audited taxable profit. Fluent review should verify that regional phrasing does not imply fiscal certification.
2. **Brazilian Portuguese ('pt-BR') Terminology**: Ordinary commercial "fatura" is used; translators must ensure it does not imply formal tax-document ("nota fiscal") compliance.
3. **Unavailable vs Zero**: Message 07 and message 14 convey unreadable or held data states, which must be clearly differentiated from an empty or zero balance.
4. **Exclusions**: Summaries reflect invoice documents only; pending links, external cash sales, and costs are excluded, and no currency conversion is performed.
