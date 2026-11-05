# Bangladesh Official Source Fit: Agrometeorological Information

## Decision & Source-Fit Boundary
Official public portals of the Department of Agricultural Extension ([BAMIS](https://www.bamis.gov.bd/en/home/)) and the Bangladesh Meteorological Department ([BMD](https://www.bmd.gov.bd/web/en/p/Agromet-Forecast)) support research; **product data integration is not established**: no API client, bulletin parser, or country readiness is verified by this inspection. Commercial reuse rights, machine access, and timing semantics remain unresolved.

---

## Source Provenance & Inspection
Fetched by coordinator via public curl on 2026-11-05 (HTTP 200; exit 0):
- **BAMIS Home**: [https://www.bamis.gov.bd/en/home/](https://www.bamis.gov.bd/en/home/) (fetched 11:12:50 UTC; SHA-256: `456aa7463870178893490cdc445547350889e6b512a566ad58b0d9e5bdc6f97c`)
- **BAMIS National Bulletin**: [https://www.bamis.gov.bd/en/bulletin/nation/](https://www.bamis.gov.bd/en/bulletin/nation/) (fetched 11:12:52 UTC; SHA-256: `e041a8e4bc44fc25ed9eb283fad424eca45bcf949e2513367c2312efff74ed54`)
- **BMD Agromet Forecast**: [https://www.bmd.gov.bd/web/en/p/Agromet-Forecast](https://www.bmd.gov.bd/web/en/p/Agromet-Forecast) (fetched 11:12:53 UTC; SHA-256: `167a76c2f330f5557c2e4d63f4ecbb03036c26192b15d631b2138632d6775939`)

Fetch timestamps record document retrieval, not bulletin publication or data freshness.

---

## Technical & Legal Findings
1. **Institutional Separation**: BAMIS displays advisory services, training notices, and national/district bulletin links. BMD advertises agromet forecasts and observational menus. These pages establish no unified API.
2. **Observed Operational Limits**:
   - BAMIS displays a banner stating the system development project expires on 31 December 2024. Alone, this notice proves neither service shutdown nor current renewal; service continuity remains **UNKNOWN**.
   - BAMIS national bulletin pages display "Current" and "Archive" navigation tabs without inline text; no bulletin bodies were fetched.
   - BMD links a PDF ([https://live8.bmd.gov.bd/file/2026/11/01/pdf/211663.pdf](https://live8.bmd.gov.bd/file/2026/11/01/pdf/211663.pdf)). Only the URL href was inspected; **zero PDF bodies were fetched**. A path string does not verify issue date, validity, or contents.
3. **Licensing & Rights (UNKNOWN)**:
   BMD terms of use links resolve to `#`. Public HTTP 200 delivery and 2026 copyright footers do not grant open commercial reuse or machine ingestion. Quotas, authentication, and update cadence remain **UNKNOWN**.

---

## Proposed checks — not executed tests
1. **Empty Navigation Tabs Forbid Freshness Assumptions**: "Current" navigation labels without verified bulletin text must never be asserted as fresh weather data.
2. **Project Expiry Banners Forbid Reliability Claims**: An unverified project expiration date must not be treated as proof of ongoing maintenance or confirmed renewal.
3. **Unfetched PDF Links Forbid Content Interpretation**: A dated PDF URL path must never be treated as verified observation data or agronomic guidance.
