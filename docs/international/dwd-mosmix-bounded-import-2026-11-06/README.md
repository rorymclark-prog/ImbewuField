# Bounded DWD station-import components

This extends the pure station request/XML decoder with server-intended public
archive retrieval, a narrow KMZ extractor and explicit KML byte decoding. These
components are not connected to an app route, weather panel or crop planner.

The request authority preserves an explicitly selected station identifier and
derives its public DWD endpoint. Retrieval accepts one bounded binary response,
with a deadline and no automatic retry. Its receipt records retrieval context;
it does not establish station suitability or forecast freshness.

The extractor uses pinned `@zip.js/zip.js` 2.24.0, its exported native-stream
entry point and CRC/local-directory checks. It admits one ordinary, unencrypted
DEFLATE member with the expected station filename. Compressed input, declared
sizes and retained output have separate engineering limits. Each output chunk is
copied under the remaining budget before retention; a successful result contains
an immutable KML Blob. Partial output is discarded on failure.

The byte decoder accepts the supported UTF-8 or explicitly declared ISO-8859-1
profile, then delegates XML, namespaces, station identity, timestamps and values
to the existing decoder. Latin-1 bytes retain their original code points rather
than using the browser's Windows-1252 alias. Unsupported encodings remain held.
Native kelvin and kg/m² values, missing values and recorded zeros retain their
meaning.

Validation distinguishes three kinds of evidence:

- Independent Python-generated synthetic ZIP fixtures exercise archive names,
  descriptors, CRC mismatches, entry profiles and size declarations.
- Explicit codec-output contract doubles exercise chunk reuse, deceptive typed
  array properties and cancellation timing. These doubles are not ZIP decoding.
- Offline checks of two previously fetched official station archives compare
  extracted KML bytes and decoded series against independent Python results:
  988 selected values and 418 recorded zeros. No new HTTP retrieval is implied.

Retained-output bounds are not a guarantee about peak codec allocation. The
pinned directory-enumeration API has no AbortSignal option; checks around its
bounded in-memory work do not prove interruption during enumeration. Optional
entry ZIP64 metadata does not establish absence of archive-wide ZIP64 records.

These components do not authorize use of a station for a farm, establish country
coverage, convert forecasts into observations or approve planting. Full-suite CI,
HTTP-to-decoder composition, app integration and any release remain separate.

Primary references: [DWD MOSMIX data directory](https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/),
[zip.js 2.24.0 package metadata](https://registry.npmjs.org/@zip.js/zip.js/2.24.0),
[XML encoding requirements](https://www.w3.org/TR/REC-xml/#charencoding).
The installed package declares BSD-3-Clause; its package licence is distinct from
the terms governing DWD data.
