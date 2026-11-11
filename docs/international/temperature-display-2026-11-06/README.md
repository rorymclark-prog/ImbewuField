# Explicit source-temperature display choices

The DWD forecast reference offers a temporary K/C/F display selector. It starts at
source Kelvin and uses no country, language, account or currency default. Selecting
another display unit requests no data, changes no station and keeps an existing
pending forecast request alive. The choice survives same-owner rerenders and resets
with the card's country owner. No preference or crop/farm data is saved.

The pure helper uses the [NIST exact temperature conversion table](https://www.nist.gov/pml/owm/si-units-temperature),
actually fetched and parsed by the coordinator on 6 November 2026 (HTTP 200,
126,437 bytes, SHA256 `c9666798ea2bd4a677ed56f54a23e7c719184a8af465ccc6ac8812c5ef24c720`).
Only its scale equations are used; approximate touchstone/cooking tables, images
and educational verse are excluded. Exact scale definitions do not make JavaScript
floating arithmetic exact real-number arithmetic or establish crop thresholds.

Default K displays the original numeric string. Converted C/F display uses the
existing number formatter with two fraction digits at most and retains exact raw K
beside it. A missing source value remains Unknown; known zero is preserved. A
nonfinite conversion is unavailable while its original source remains visible.
Source temperature units, precipitation, provenance, UTC instants and the first-12
period limit remain unchanged. Rendering changes no measurements or geometry.

The new selector has its own label and rejects unsupported primitive tokens without
coercion. Current-handler ownership retires callbacks from older renders; display
changes do not advance forecast generation. Catalogue selection still fills only
the ID and retires an old forecast response; Check remains a separate user action.

Independent pure and React tests cover these boundaries. Existing Country selectors
are now found through their labelled control, and the default native-value assertion
checks quantity cells rather than legitimate C/F option labels. Original behaviour
assertions and baseline receipts remain preserved. Source controls must detect a
missing current-handler guard and accidental request retirement by unit changes.
Node rendering does not establish real phone/desktop layout or Next delivery;
current-head CI and genuine browser/release review remain separate gates. No
production release, saved-unit preference or local farming readiness is claimed.
