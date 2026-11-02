# Proposed release note — localization foundation

Added a language draft review workspace at `/international/locales` with paired
current English and French, Spanish, Portuguese and Swahili drafts for 32 interface
messages. It shows missing/stale source bindings, placeholders, plural coverage,
English fallback and human-review status. All four dictionaries remain unreviewed;
the app's supported language choices and existing translations are unchanged.

Added executable source coverage reporting, explicit runtime locale/fallback
reporting, date/number examples, directional isolation and currency-preserving
synthetic examples. Mixed currencies remain separate subtotals.

This is draft-review infrastructure. It does not deliver four-language farming
advice, reports, lessons, offline packs, new country crop support or financial-data
migration. Implementation: Codex delegated agent. Visual/integrated release review
remains with the coordinator.
