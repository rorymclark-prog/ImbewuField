# Review Notes: Recorded Invoice Price History Copy Drafts

## Scope and Intent
- Packet: `invoice-price-history-copy-2026-11-04` (source SHA-256: `21124529e1d311664726ab54726e1c43d2785cc0465bc3dabb9ad0711cfa6238`).
- Scope: 56 unreviewed AI candidate drafts (8 messages across 7 locales: `fr`, `es`, `pt-BR`, `sw`, `hi`, `bn`, `id`).
- Token Preservation: All interpolation tokens (`{currency}` in message 04; `#{invoice}`, `{buyer}`, `{date}` and punctuation separator `·` in message 07) are strictly preserved across all target outputs.

## Key Considerations for Fluent Human Review
1. **Historical Recorded Data vs Recommendation**: Message 04 presents historical prices previously entered on past invoices, not current market recommendations, price guides, or buyer agreements. Translators must ensure the wording clearly reminds the user to independently confirm the price for the present sale.
2. **Review / Reopen Workflow**: Message 03 addresses an unreadable or held storage state, instructing the grower to reopen the current records rather than implying that picking a price will repair damaged storage.
3. **Exact Item and Unit Context**: Message 04 emphasizes that historical prices match the exact description and unit of measurement without automated conversion or package size inference.
