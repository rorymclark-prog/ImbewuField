# Review Notes: Invoice Currency Choice UI Copy Drafts

## Scope and Intent
- Packet: `invoice-currency-choice-copy-2026-11-04` (source SHA-256: `89a0e36996c8868f297f8d3bdabde6c4f20155bc05422c64ca28ff23a6352b67`).
- Outputs: 84 unreviewed AI drafts (12 distinct messages across 7 locales: `fr`, `es`, `pt-BR`, `sw`, `hi`, `bn`, `id`).
- Literal Preservation: Exact 3-letter currency code literals (`ZAR`, `KES`, `GBP`, `USD`, `EUR`, `BRL`) in rows 07–12 are strictly preserved in their original positions and counts without alteration.

## Key Considerations for Fluent Human Review
1. **Historical Rand Invoice**: Message 04 explicitly refers to South African Rand as an unlabelled legacy record denomination. Translators must verify that "rand" is never substituted with a local or domestic currency term.
2. **No Automatic Conversion Notice**: Message 03 communicates that choosing a currency does not perform foreign exchange conversion on amounts. It warns users that changing the choice requires agreed prices and does not automatically calculate equivalent values.
3. **Immutability of Saved Records**: Message 05 communicates that saved records cannot have their currency altered, preserving audit integrity.
4. **Held / Review Status**: Message 06 ("Currency needs review") indicates an unrecognized or unreadable currency state, not a zero or invalid invoice total.
