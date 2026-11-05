# Four-language UI draft handoff

AGY returned 97 source-bound segments per locale: French, Latin American
Spanish, Brazilian Portuguese and Kenyan Swahili (388 draft entries). Every
entry is **unreviewed**. This batch adds no production language option.

The exact English, component location and SHA256 remain in [source.json](source.json).
The original source inventory is immutable. These are developing UI segments,
not complete translated screens or calibrated lessons. The coordinator restored
three literal DEMO/cm labels and quarantined unsupported regional-usage claims
from the original notes. Human comprehension and dialect review remain open.

| Locale | Draft | Candidate glossary and review gates |
| --- | --- | --- |
| French | [fr.json](fr.json) | [French review](fr-notes.md) |
| Latin American Spanish | [es.json](es.json) | [Spanish review](es-notes.md) |
| Brazilian Portuguese | [pt-BR.json](pt-BR.json) | [Portuguese review](pt-BR-notes.md) |
| Kenyan Swahili | [sw-KE.json](sw-KE.json) | [Swahili review](sw-KE-notes.md) |

Structural checks compare exact keys, original English/hashes, nonempty draft
text, literal symbols and unreviewed status. They cannot certify translation
meaning or visual fit. [Status](status.json) records the observed executor limit:
the main CLI exited with code 2 after its partial handoff. No clean final
completion or live ongoing translation process is claimed.

Next: translate omitted full warnings and statuses from the separate frozen
follow-up inventory, replace fragile UI fragments with complete source messages,
then obtain named fluent review before integrating any approved language scope.
Country, currency, units, calendars, agronomy and legal permissions remain
separate. No provider or local crop-plan support was implemented by this job.
