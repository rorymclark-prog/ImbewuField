# Brazil Product Access and Reuse Verification

**Review Date:** 2026-11-03
**Fetch Start (UTC):** 2026-11-03T00:16:07Z (exact receipts: Redape completed 00:16:32Z; INMET completed 00:16:12Z)
**Scope:** Bounded verification of two exact official links identified in previous introductory inventories: the persistent Redape soil dataset DOI and the INMET automatic station catalog.
**Operational Status:** Documentation fetched = 1; failed fetch attempts = 1; data payloads downloaded = 0; integrations implemented = 0.

---

## 1. Embrapa Redape Soil Profile Dataset Documentation

* **Requested Link:** `https://doi.org/10.48432/DDBVFO`
* **Effective URL:** `https://www.redape.dados.embrapa.br/dataset.xhtml?persistentId=doi:10.48432/DDBVFO`
* **Receipt ID:** `br-redape-doi` (HTTP 200, 188,341 bytes, SHA-256: `e51ef6d032a7495edad36070168c898ac3d3a8e3f9ed876f1d68de4d4370b481`).
* **Actual Fetch Window (UTC):** 2026-11-03T00:16:07.246415+00:00 to 2026-11-03T00:16:32.080694+00:00.
* **Evidence Level:** Dataset documentation read only. Raw tabular data files were not downloaded; no API integration was implemented.

### 1.1 Provenance, Releases, and Dates
* **Title:** *Dados morfológicos e analíticos de solos do Brasil:* (Banco de Dados de Solos do Brasil - BDSolos).
* **Producer:** Embrapa Solos (Chefia Adjunta de Pesquisa e Desenvolvimento).
* **Deposit Date:** 2024-09-04.
* **Release Date:** 2025-02-20 (Version 2.0).
* **Observed Time Periods:** Historic collection period 1955-01-01 to 2004-12-01; coverage period 1960-01-01 to 2018-12-31.
* **Citation Standard:** Embrapa, 2025, "Dados morfológicos e analíticos de solos do Brasil:", `https://doi.org/10.48432/DDBVFO`, Redape, V2.

### 1.2 Files Exposed and Schema Metadata
The repository page exposes two public CSV data files:
1. `bd_solos_para_redape.csv` (93.0 MB, published 2025-02-20, MD5: `ccefdacb8d61cde2dcc8889919c759e2`): BDSolos profile migration dataset updated through 2024-09-25.
2. `Template.csv` (11.2 KB, published 2026-06-24, MD5: `94af06c7a3e4c1a29da184ab6c09ad8f`): Attribute submission template.

* **Methodological Standards:** Data structure follows the Brazilian Soil Classification System (*SiBCS*, Santos et al., 2018), Normative Procedures for Pedological Surveys (1995), and Field Description Manual (2015).
* **Measurement Units:** Column-level physical and chemical measurement units are not established from this response.
* **Geographic Coverage & Resolution:** National profile point locations across Brazil's five regions. Spatial density for Campinas or specific agricultural catchments is not established on this metadata page; suitability cannot be inferred without payload spatial analysis.

### 1.3 Licensing and Access Observations
* **Licence Label:** Observed label is `Embrapa (CC BY-NC 4.0)` linking to `/licenses/embrapa-by-nc-4.0.xhtml`. Commercial and AI reuse clearance is not established; no broader legal conclusion is drawn.
* **Authentication:** Catalogue metadata page is viewable without credentials. A login link and Dataverse `/api/access/datafile/` href appear on the page, and metadata displays `Public (2)` access labels, but these describe catalogue metadata only. Actual datafile download and API endpoint authentication remain UNKNOWN because neither was fetched.

---

## 2. INMET Automatic Station Catalog Link Attempt

* **Requested Link:** `https://portal.inmet.gov.br/paginas/catalogoaut`
* **Effective URL:** `https://portal.inmet.gov.br/paginas/catalogoaut`
* **Receipt ID:** `br-inmet-catalog` (HTTP 0, curl exit 56, 0 bytes, `curl: (56) Recv failure: Connection reset by peer`).
* **Actual Fetch Window (UTC):** 2026-11-03T00:16:07.245582+00:00 to 2026-11-03T00:16:12.017646+00:00.
* **Evidence Level:** Failed fetch attempt.

### 2.1 Technical Evaluation
* **Attempt Result:** Unauthenticated HTTP GET failed due to a TCP connection reset by peer during payload transfer.
* **Interpretation:** This represents a failed network attempt on this specific endpoint link during the execution window. It is not conclusive proof of provider downtime or service decommissioning.
* **Constraint Compliance:** Per work order instructions, no retries, alternative endpoints, or scrape routines were executed. Station schema, units, and Campinas coverage for this link remain UNKNOWN.

---

## 3. Product Access and Integration Accounting

| Metric | Verified State |
| :--- | :--- |
| **Official Documentation Pages Verified** | 1 (Redape DOI dataset documentation) |
| **Failed Official Endpoint Attempts** | 1 (INMET catalog link connection reset) |
| **Data Payload Files Downloaded** | 0 (No CSV files downloaded) |
| **Product APIs Implemented** | 0 (None) |
| **Commercial Reuse Clearance** | Not established (Observed label: CC BY-NC 4.0) |
| **AI Training / Derivative Clearance** | Not established |
| **Campinas Agronomic Suitability** | Not inferred |

Zero production code, pipeline configurations, or database integrations have been modified or deployed.
