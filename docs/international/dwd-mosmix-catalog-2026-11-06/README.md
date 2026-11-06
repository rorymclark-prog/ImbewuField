# Explicit catalogue search and station choice

On the international review page a grower can search a public station name or ID,
choose a returned canonical ID, then separately check its forecast. Neither mounting,
search completion nor selection automatically requests forecast data or attaches
weather to a farm. Manual ID entry remains available.

Queries use a bounded first ASCII profile: at most 64 supplied characters, with only
edge ASCII spaces removed. Search matches literal case-insensitive substrings of
the admitted ID or known name, preserves source order, counts all matching rows,
and returns at most 20. A no-match result displays 0 of 0 and does not prove no relevant
station exists. It is not nearest-station selection or country/farm suitability.
These are software/UI bounds, not provider quotas or agronomic limits.

## Source and encoding

The [official catalogue download](https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_stationskatalog.cfg?view=nasPublication&nn=16102)
was actually retrieved on 6 November 2026: HTTP 200, 299,502 bytes,
SHA256 `770c7cbbfdc16ef38d156a066b34801d9c1c4c1e7ae2b750f6be75126dcb36f5`.
It has 5,649 fixed 52-byte data rows. Its declared UTF-8 conflicts with actual non-ASCII
bytes. The parser deliberately withholds 49 names; it neither guesses another
encoding nor uses replacement characters. Those rows retain their canonical ID
and remain searchable by that ID. ASCII names preserve their original content.

The exact byte profile checks its header/separator, fixed gaps and printable shape
outside names. Source IDs are admitted by the existing station-request authority.
Duplicate canonical IDs hold the whole catalogue; identical names across distinct
IDs are legitimate. Supplied source framing notes originally misplaced byte 37;
an actual retained-body probe exposed that error, and all 5,649 rows now match an
independent identity/name inspection. Geographic/elevation columns remain opaque
and are not returned or interpreted. Catalogue membership is not proof a forecast
endpoint exists now, or that the source is complete/current for a country.

## Transport, context and interaction

One private bounded-body HTTP core serves the existing archive wrapper and a fixed
catalogue wrapper. The latter validates the query before options/network, fetches
only the fixed download, and keeps raw bytes despite the charset declaration.
One request is bounded to 12 seconds and 1 MiB; there is no retry. Synchronous byte
assembly/search stays inside the deadline. HTTP, admission and no-match outcomes
remain distinct, and the catalogue receipt carries its own retrieval context rather
than station provenance. An actual separate implementation request returned HTTP 200,
5,649 catalogue rows, 49 withheld names and one match for an explicit public engineering
ID; it supplied no private farm/account information. Its body hash was not recorded,
so this is not claimed to be a new byte-identical comparison with the retained body.

The screen displays retrieval UTC when supplied. Editing, prop-owner changes,
unmounts and country changes retire old search results and selection handlers.
A selected canonical request object stays stable across unrelated parent rerenders.
Choosing another row retires an earlier forecast response and only fills the field;
the grower must press Check again. A previously sent upstream request may continue.

DWD/MOSMIX credit, extraction/display notice, source and terms/licence links remain
visible. The [current DWD general geodata statement](https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html)
and its application inference are documented in the parent import README. This
adds no DWD endorsement, local farming approval or country-readiness grant.

## Validation limits

Independent synthetic parser/search/transport/action and actual React parent/card
checks cover holds, unknown names,0/counts, bounds, delayed work and explicit choice.
Source controls produce real assertion failures for guessed names, removed bounds,
stale prop owners, missing selection retirement and unstable request identity.
Node action boundaries do not establish actual Next delivery. Current-head full CI,
genuine desktop/phone output and applicable account/release checks remain gates.
No production release, worldwide data coverage or agronomic readiness is claimed.
