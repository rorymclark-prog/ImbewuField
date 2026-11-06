# UI translation drafts for human review — 6 November 2026

This documentation bundle preserves403 AI translation pairs in23 locale packets across15 languages. It covers13 field-seed-sourcing messages and26 nursery-to-field-observation messages. Every packet remains `unreviewed-ai-draft` with `runtimeActivation: false`; completion in task status means drafting completed. Fluent human review and actual UI/RTL layout checks remain pending.

## Source provenance

The captures are historical references, including any word “current” inside a source file. Field-seed sources record the component at `b98c029e142ba8acbb04890a02be78bb20a10d7b`, body SHA256 `574664a3a13fa2e9a40e00e8515f633e4759a063dc305f9caf95031086e67e6f`. Later binding-guard edits preserved these13 English messages; this bundle preserves the original capture bytes and does not label that body digest as a later component version.

Nursery observation English was captured5 November and its component references reconciled6 November against the stated e70 snapshot. The canonical source identity is `cdf67235c8d74573c0cd107fe0a5411a2750959010f7d2c2ac7a0d673008cb3c`. These documentation packets normalize message-hash field names while retaining exact keys/English/order/hash values; their whole-file source hashes differ from the canonical runtime packet. Adoption into a runtime reader requires a separate source reconciliation and approval.

## Packet groups

| Family | Source entries | Locales | Draft pairs | Review files |
| --- | ---: | --- | ---: | --- |
| Field seed sourcing | 13 | hi, bn, id | 39 | [Source](agy-field-seed-asia-ui-2026-11-06/source.json), [drafts](agy-field-seed-asia-ui-2026-11-06/drafts.json), [status](agy-field-seed-asia-ui-2026-11-06/status.json) |
| Field seed sourcing | 13 | zh-Hans, vi, th | 39 | [Source](agy-field-seed-east-asian-ui-2026-11-06/source.json), [drafts](agy-field-seed-east-asian-ui-2026-11-06/drafts.json), [status](agy-field-seed-east-asian-ui-2026-11-06/status.json) |
| Field seed sourcing | 13 | es, fr, pt-BR, sw | 52 | [Source](agy-field-seed-fres-ui-2026-11-06/source.json), [fr](agy-field-seed-fres-ui-2026-11-06/fr.json), [es](agy-field-seed-fres-ui-2026-11-06/es.json), [pt-BR](agy-field-seed-fres-ui-2026-11-06/pt-BR.json), [sw](agy-field-seed-fres-ui-2026-11-06/sw.json), [status](agy-field-seed-fres-ui-2026-11-06/status.json) |
| Field seed sourcing | 13 | de, it | 26 | [Source](agy-field-seed-german-italian-ui-2026-11-06/source.json), [drafts](agy-field-seed-german-italian-ui-2026-11-06/drafts.json), [status](agy-field-seed-german-italian-ui-2026-11-06/status.json) |
| Field seed sourcing | 13 | ar, ur, fa | 39 | [Source](agy-field-seed-rtl-ui-2026-11-06/source.json), [drafts](agy-field-seed-rtl-ui-2026-11-06/drafts.json), [status](agy-field-seed-rtl-ui-2026-11-06/status.json) |
| Nursery-to-field observations | 26 | zh-Hans, vi, th | 78 | [Source](agy-nursery-field-observation-east-asian-2026-11-06/source.json), [drafts](agy-nursery-field-observation-east-asian-2026-11-06/drafts.json), [status](agy-nursery-field-observation-east-asian-2026-11-06/status.json) |
| Nursery-to-field observations | 26 | de, it | 52 | [Source](agy-nursery-field-observation-europe-2026-11-06/source.json), [drafts](agy-nursery-field-observation-europe-2026-11-06/drafts.json), [status](agy-nursery-field-observation-europe-2026-11-06/status.json) |
| Nursery-to-field observations | 26 | ar, ur, fa | 78 | [Source](agy-nursery-field-observation-rtl-2026-11-06/source.json), [drafts](agy-nursery-field-observation-rtl-2026-11-06/drafts.json), [status](agy-nursery-field-observation-rtl-2026-11-06/status.json) |

Locale identifiers: French `fr`, Spanish `es`, Brazilian Portuguese `pt-BR`, Swahili `sw`, German `de`, Italian `it`, Hindi `hi`, Bengali `bn`, Indonesian `id`, Simplified Chinese `zh-Hans`, Vietnamese `vi`, Thai `th`, Arabic `ar`, Urdu `ur`, Persian `fa`.

## Review and content checks

Review each translation against its frozen English and the terminology notes. Focus on planned versus observed dates/counts, unknown versus explicit zero, seed identity, survival and linked-record permissions. Identified machine-drafting corrections and structural checks supply no fluent certification, country suitability or observed farming outcome.

[publication-manifest.json](publication-manifest.json) binds all28 original artifacts by bytes/SHA256; all were copied exactly. Work orders, private paths/handles, raw logs/bodies, quarantined regional drafts and existing runtime locale files are outside this bundle. [validation-receipt.json](validation-receipt.json) records403 checked pairs and506 rejected damaged-packet controls using [check_packets.py](check_packets.py). The checker preserves the coordinator validation body, prints receipts to stdout and refuses optimized Python so its assertions execute. It does not edit packets or activate a language.

From this directory, run a group using its `folder`, `sourceSha256`, `mode` and `messages` from the manifest:

```sh
python3 check_packets.py <folder> <sourceSha256> <mode> <messages>
```

A content pass verifies source bindings, protected placeholders/numerals/DEMO/CSV/UTC, exact structure/order and inactive status. Named human terminology/fluency review, actual layout testing and the runtime release gates remain separate. Application, package and test code are unchanged by this publication; no new local application-suite success is claimed for the documentation checkout.
