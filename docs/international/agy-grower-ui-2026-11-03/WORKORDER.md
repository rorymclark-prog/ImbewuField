# AGY: grower automatic-plan and nursery UI translation drafts

Rory has authorised continuing parallel AGY work for the international programme.
Resume the existing private translation conversation. Optional interaction-data
sharing stays OFF; normal scoped one-time approvals only. No permission bypass,
settings changes or always-allow. Inspect worker states; reuse at most two idle
researchers for disjoint French and Spanish drafts; main handles Brazilian
Portuguese, Swahili, consolidation and structural checks. One main file writer.

Translate the 32 exact source strings in `source.json` into `fr`, `es`, `pt-BR`
and `sw` (128 entries total). The packet SHA256 is `d7f072d7bc1e1d26e67b8e2525f575fdcefc6293824b62daed801f636479314b`.
Read this source packet, not prior release messages. These are engineering UI
strings from the frozen grower automatic-plan and nursery workflow. Nursery means
plant propagation; recipes are grower-supplied propagation inputs. Preserve buyer
priority, whole-bed cycles, proposed vs saved vs observed, unknown vs zero,
explicit confirmations, dates excluded at interval ends, and all limits on local
farming approval or delivery promises. Preserve `UTC` and `CSV` verbatim.

Write ONLY this directory: `docs/international/agy-grower-ui-2026-11-03/**`.
Do not change `source.json`, this work order, production code, locale registries,
other translation packets, tests, lessons, species lists, Git or other agents' work.
No external calls are needed. Drafts are NOT fluent human approval and do not
activate languages. English fallback remains authoritative until reviewed wiring.

Output `fr.json`, `es.json`, `pt-BR.json`, `sw.json`, `review-notes.md`, `status.json`.
Each locale object: `schemaVersion:1`, `locale`, `sourceSha256` (whole source-file
hash above), `review:{status:"unreviewed"}`, `provenance:{kind:"ai-draft",executor:"AGY",createdOn:"2026-11-03"}`,
`messages` array of exactly 32 objects with exact `key`, `sourceEnglish`,
`sourceSha256` (per message from source), nonempty translated `text`, and
`review:{status:"unreviewed"}`. Do not rename keys or alter English/hashes.

Validate JSON, 32 distinct matching keys per locale, source/hash equality,
nonempty text, retained UTC/CSV, and unreviewed status everywhere. Do not invent
validation results; run checks on actual files and report any uncertainty in
review-notes. No crop/species examples, invented numeric farming guidance,
private identifiers, paths, transcripts, raw logs or claims of native review.
Return compact counts and validation results; stop workers on delivery.
No commits, pushes, issue posts, runtime integration or next batch until root
independently reviews the handoff.
