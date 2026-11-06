# Explicit public-station forecast reference

The international review page now includes a manual DWD station lookup. It starts
blank and requests data only when the user presses Check. Changing the reviewed
country retires and resets the card; it does not select a station, attach weather
to a saved farm or change country readiness. Nothing updates crop plans, field
calendars, maps or observations.

The server action accepts a station request and uses server-owned defaults. The
existing request authority preserves the exact identifier and derives its public
endpoint. No client transport options, arbitrary URL, farm coordinates or account
context become provider request parameters. This follows the existing public
reference-action pattern; per-request bounds are not caller authentication or a
global/account request budget.

Retrieval accepts one bounded binary response with no automatic retry. Maintained
zip.js 2.24.0 checks the single-member archive, CRC and directory consistency.
A shared intrinsic typed-array snapshot bounds copies and preserves reused-buffer
contents. Explicit UTF-8 or declared ISO-8859-1 decoding then delegates to the
existing XML/station authority. Unsupported input remains held.

The composed import spans retrieval, Blob reads, extraction and decoding under
one 24-second engineering ceiling. Its HTTP phase remains capped at 12 seconds;
compressed input and retained output are capped at 1 MiB and 2 MiB respectively.
These are software limits, not provider quotas, forecast validity or farm limits.

The card distinguishes missing values from recorded zero and keeps source units
K and kg/m². Issue, retrieval and individual validity instants retain their UTC
source precision. Only the first 12 source periods are displayed, with an explicit
shown/total count; that count does not assert hours or forecast completeness.
Missing descriptions display Unknown. Retained callbacks, country changes,
unmounts and late responses cannot borrow a newer selection's request authority.

## Source credit and data terms

On 6 November 2026 the [current DWD legal page](https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html)
was fetched and read. It states CC BY 4.0 with source credit for freely accessible
geodata and defines these to include location-related weather/climate information.
The app applies that definition to this public point-weather product; this is a
scoped interpretation of DWD's general statement, not a separate permission letter
or an approval of local farming use. The card names DWD/MOSMIX, identifies extraction
and display of selected values, and links the source, terms and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
No DWD logo or endorsement is used. The source HTML receipt was HTTP200,
51,806 bytes, SHA256 `a2223fadb827196f9d9cc1200e6e19a0b5bf40fd0b28f39606ae9be9710735f3`.

The data terms are distinct from zip.js's declared BSD-3-Clause package licence.
They do not automatically cover unrelated third-party images or other providers.

## Evidence and remaining checks

Independent Python-generated ZIP fixtures exercise names, descriptors, CRC,
profiles and declared sizes. Explicitly labelled codec/stage contract doubles
exercise chunk reuse, deceptive properties, ignoring async work and delayed
callbacks. These doubles are not live provider or browser evidence. Source mutants
must fail assertions rather than setup or hanging-test checks.

Offline checks of two retained official archives reproduced exact KML bytes,
988 independently extracted values and 418 zeros. A separate actual composed
request on 6 November received HTTP200, 18,828 bytes and 247 decoded periods from
one explicit public station. It supplied no private site/account information and
proved no farm suitability, source quality or freshness policy.

Retained-output limits are not a peak-codec-allocation guarantee. Directory
enumeration has no AbortSignal API; checks around bounded in-memory work do not
prove interruption during enumeration. Optional entry ZIP64 metadata does not
prove absence of archive-wide ZIP64 records.

Current-tree checks, full-suite CI and genuine desktop/phone preview inspection
remain release gates. Node render tests do not establish physical layout, actual
Next server-action delivery or signed-in/account-transition behavior. No production
release or worldwide agronomic readiness is claimed.
