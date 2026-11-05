# Reviewed International Research Publication Index

This index organizes six compact, coordinator-reviewed documentation deliverables for the unmerged international research queue under [publication-manifest.json](publication-manifest.json). These documents evaluate public sources and technical interfaces; they do not constitute country readiness, production software integration, or legal certification.

### Reviewed Documents & Evidence Scope

1. **[France Official Source Fit](../agy-france-official-source-fit-2026-11-05/FRANCE-SOURCE-FIT.md)**
   *Inspected*: Public INRAE experimental unit profile and Météo-France station metadata catalog page (HTTP 200). Recorded two INPN 403 challenge interstitials.
   *Open Gates*: INPN legal/species terms uninspected; payload files, live weather observations, and update cadence remain unverified.

2. **[Nepal Official Source Fit](../agy-nepal-official-source-fit-2026-11-05/NEPAL-SOURCE-FIT.md)**
   *Inspected*: DHM agromet bulletin index and AITC institutional introduction (HTTP 200). Recorded three curl no-response transport failures (connect error, expired certificate, timeout).
   *Open Gates*: Calendar conversions, bulletin PDFs, forecast payloads, and institutional reuse licenses remain unverified.

3. **[Nepal Material Use Evidence](../agy-nepal-material-use-2026-11-05/MATERIAL-USE-EVIDENCE.md)**
   *Inspected*: Two distinct AITC notice HTML pages (HTTP 200). Found notice body contains only an unretrieved external image link.
   *Open Gates*: Substantive use conditions were absent from markup; actual text remained uninspected in this step.

4. **[Nepal Notice Payload Reading](../agy-nepal-notice-payload-2026-11-05/NOTICE-PAYLOAD-READING.md)**
   *Inspected*: Scanned notice image graphic retrieved and visually inspected. Tentative reading identifies public video attribution instructions.
   *Open Gates*: Requires fluent local legal review; does not establish blanket rights over other materials or commercial adaptations.

5. **[France Open Licence Note](../agy-france-open-licence-2026-11-05/FRANCE-OPEN-LICENCE-NOTE.md)**
   *Inspected*: Official *Licence Ouverte 2.0* texts and redirect pages. Details rights, attribution requirements, and IP warranties.
   *Open Gates*: Catalog label does not grant blanket permissions across separate institutions; API auth and payload files remain unverified.

6. **[NRCS Query Adapter Contract](../agy-nrcs-bounded-adapter-contract-2026-11-05/NRCS-QUERY-CONTRACT.md)**
   *Inspected*: SDA documentation and one unauthenticated constant-only probe (`SELECT 1 AS probe`, HTTP 200, 199 bytes).
   *Open Gates*: Constant probe is not a soil observation; general authentication, quotas, rate limits, and SLAs remain unverified.

```json
{
  "status": "coordinator-source-reviewed-index",
  "manifest": "publication-manifest.json",
  "documentCount": 6,
  "runtimeActivation": false,
  "countrySupported": false,
  "aiGenerated": true,
  "humanFluentOrLegalApproval": false
}
```
