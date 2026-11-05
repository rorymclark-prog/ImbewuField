# France: Station Metadata Open Licence Evidence

Coordinator fetched these public pages:
- Dataset page: `https://www.data.gouv.fr/datasets/informations-sur-les-stations-metadonnees` (HTTP 200, fetched 2026-11-05 13:14:11 UTC).
- Licence links: `https://www.etalab.gouv.fr/licence-ouverte-open-licence` (redirects to `https://www.data.gouv.fr/pages/legal/licences/etalab-2-0`, HTTP 200) and `https://raw.githubusercontent.com/etalab/licence-ouverte/master/LO.md` (HTTP 200), fetched 2026-11-05 16:51 UTC (manifest `5c8c83d308dea5db17afb4ab6f82a0eb1144a1e868bcbd8e937dc3e2a0a12930`).

### What Licence 2.0 Establishes
The dataset entry advertises *Licence Ouverte / Open Licence version 2.0*. For covered information, Licence 2.0 grants a worldwide, perpetual, free, non-exclusive right to reproduce, copy, adapt, modify, extract, transform, and commercially or non-commercially redistribute, including creating derived works or product integrations.

**Conditions**:
- **Attribution**: Reusers must credit authorship by indicating the source (at minimum grantor name) and last update date of the reused information. Providing a URL to the information supports effective attribution, but does not waive naming the source and last update date.
- **No Endorsement or Misleading Claims**: Reusers must not suggest official public endorsement or mislead third parties regarding content, source, or update date.
- **Intellectual Property**: Grantor warrants that the information contains no third-party IP rights obstructing granted freedoms, and cedes held IP rights without fee.
- **Personal Data**: Personal data may be included and reused, provided reusers comply with applicable privacy laws.
- **Warranty & Liability**: Provided as produced, without warranty of error-free status or continuous delivery.

### Limits & Scope
Licence 2.0 governs information covered by its terms; advertising it on a catalog page does not certify final applicability for every uninspected resource file, API endpoint, or institution (e.g. INRAE, INPN). API authentication, update cadence, live weather observations, and agricultural suitability remain unverified.

### Proposed Next Verifications (Not Executed)
- *Next Verification*: Verify relevant resource file applicability, grantor source metadata, and last update dates before downstream selector attribution.
- *Negative Scenarios*:
  1. Reject ingesting datasets lacking grantor name or last-update-date attribution.
  2. Block implying government endorsement in UI presentations.
  3. Prohibit extending Licence 2.0 permissions to unverified third-party sources.

```json
{
  "status": "documentation-only",
  "manifestSha256": "5c8c83d308dea5db17afb4ab6f82a0eb1144a1e868bcbd8e937dc3e2a0a12930",
  "review": "unreviewed-ai-draft",
  "commandsRun": false,
  "testsRun": false,
  "validation": "UNKNOWN",
  "workersActive": 0,
  "runtimeActivation": false,
  "countrySupported": false,
  "legalApproved": false,
  "productApiImplemented": false,
  "customerTestingPerformed": false,
  "humanFluentApproval": false,
  "independentLegalApproval": false
}
```
