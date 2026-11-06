# France: Official Source Fit (Documentation Only)

This assessment reviews four coordinator public curl fetch attempts for France national evidence preparation across three official domains. No API, GeoJSON, data, or PDF payload was downloaded.

### Source Evaluation

1. **INRAE Experimental Unit Profile**
   - *URL*: `https://ue-maraichage.isc.inrae.fr/qui-sommes-nous/presentation-de-l-unite` (HTTP 200, fetched 2026-11-05).
   - *Findings*: Public profile for INRAE's experimental research unit (*UE Maraîchage*) focused on sheltered agroecological market-gardening systems at a single research station in Alénya.
   - *Fit & Limits*: Relevant context on French protected organic vegetable research. It is a local research facility profile, not a validated national crop calendar, extension advisory channel, or all-France agronomy baseline. Website reuse terms, modification cadence, and API capabilities remain unknown.

2. **Météo-France Station Metadata on data.gouv.fr**
   - *URL*: `https://www.data.gouv.fr/datasets/informations-sur-les-stations-metadonnees` (HTTP 200, fetched 2026-11-05).
   - *Findings*: Official dataset listing produced by Météo-France advertising meteorological station characteristics across metropolitan and overseas territories. Advertises *Licence Ouverte / Open Licence version 2.0* specifically for this dataset catalog entry.
   - *Fit & Limits*: Provides station discovery context for agroecological planning. Metadata alone does not provide weather observations, forecasts, frost risk calculations, or planting recommendations. Advertised catalog update dates do not verify payload freshness or delivery cadence. Underlying GeoJSON, CSV, and PDF documentation files were not retrieved. Full licence conditions, attribution obligations and API auth remain to be reviewed.

3. **INPN Biodiversity Portal (Blocked Leads)**
   - *URLs*: `https://inpn.mnhn.fr/legal` and `https://inpn.mnhn.fr/accueil/index` (HTTP 403, fetched 2026-11-05).
   - *Findings*: Both requests returned Cloudflare "Just a moment..." interstitial challenge screens without substantive legal terms or biodiversity data.
   - *Fit & Limits*: INPN protected species and legal terms remain completely uninspected and unverified. HTTP 403 blocks must not be bypassed or interpreted as legal prohibition or API authentication requirements.

### Practical Relevance & Boundaries
These public sources offer discovery context for French market-gardening systems and meteorological station locations. They do not constitute an app partnership, funding commitment, farmer consent, or production readiness. France is an independent national review scope within Europe; country dossier readiness remains unactivated.

```json
{
  "status": "documentation-fit-only",
  "receiptsSha256": "6496da842dab6b0b4acbe28237f72a6a0930b35c9c33e966ae87843f346abbae",
  "commandsRun": false,
  "testsRun": false,
  "validation": "UNKNOWN",
  "workersActive": 0,
  "countryActivated": false,
  "productApiImplemented": false
}
```
