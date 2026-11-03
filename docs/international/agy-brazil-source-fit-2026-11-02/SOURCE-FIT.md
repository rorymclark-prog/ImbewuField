# Brazil Source-Fit Dossier: Campinas & São Paulo Agroecology Investigation

**Date:** 2026-11-03
**Investigation Target:** Campinas / São Paulo evaluated strictly as a provisional engineering investigation target. Not an approved rollout zone, operational baseline, or real farm recommendation.
**Jurisdiction Note:** Federal, state (São Paulo), and municipal responsibilities are distinct and non-interchangeable. Federal introductory guidance confers no state agricultural defense approvals or municipal land-use permits.
**Evidence Baseline:** Five official primary documentation HTTP responses fetched on 2026-11-02 UTC (3 November locally) and reviewed on 3 November in `coordinator-receipts-2026-11-03.json`. Underlying product data endpoints fetched: 0 / 5. Product integrations implemented: 0 / 5.

---

## 1. Source-Fit Summary Matrix

| Source Family | Primary URL | Evidence Level | Supported Observations | Campinas / Regional Fit | Operational State & Unknowns |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **INMET** (Weather/Climate) | `https://portal.inmet.gov.br/` | Documentation read | National forecasts, monitoring maps, normals (1961–1990), station catalogs, and Sisdagro agrometeorology. | Search box present; does not establish Campinas station identifiers, coordinates, microclimates, or frost series. | Informational portal only; no REST API contracts or raw schemas. Resolution, units, auth, cadence, and data terms UNKNOWN. Commercial reuse not established. |
| **Embrapa** (Research/Extension) | `https://www.embrapa.br/` | Documentation read | Institutional portal covering publications, technologies, distance courses, and innovation frameworks. | Decentralized units linked broadly; does not establish Campinas facilities or surveys. | Institutional CMS only; copyright notice (*Lei nº 9.610*); commercial reuse not established. Resolution, units, auth, and cadence UNKNOWN. |
| **Embrapa / SiSolos** (Soil Redirect) | `https://www.sisolos.cnptia.embrapa.br/` | Documentation read | Redirect stub for soil profiles, disseminating Redape DOI `10.48432/DDBVFO` with 5s meta-refresh. | Hostname uses `cnptia.embrapa.br`, but physical facility location or Campinas profile coverage not established. | Redirect stub citing `Licença: Embrapa (CC BY-NC 4.0)`; commercial reuse not established. Downstream terms, resolution, units, and dates UNKNOWN. |
| **SiBBr** (Biodiversity) | `https://sibbr.gov.br/` | Documentation read | Platform integrating biological collections, taxonomic catalogs (>160k species), and regional occurrence queries. | Regional modules exist, but occurrences do not establish agricultural suitability or municipal farming rules. | Observational records only; do not establish legal, native, or invasive status. Underlying dataset licensing, resolution, units, auth, and cadence UNKNOWN. |
| **MAPA** (Phytosanitary) | `https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/sanidade-vegetal` | Documentation read | Federal plant health overview (*Defesa Sanitária Vegetal*) covering Pest Risk Analysis (*ARP*), quarantine pests, and ZARC links. | Federal policy applies nationwide; introductory page does not establish state (São Paulo) or municipal permits. | Regulatory guidance only; CC BY-ND 3.0 on text. Not local planting permission. Lacks machine-readable compliance APIs. Data terms UNKNOWN. |

---

## 2. Detailed Findings Bound to Fetched Text

### 2.1 INMET (Instituto Nacional de Meteorologia)
* **URL & Access:** `https://portal.inmet.gov.br/` (Public HTTP GET, Receipt `br-inmet`, fetched 2026-11-02 UTC; reviewed 2026-11-03).
* **Observed Capabilities:** Weather forecasts (`previsao.inmet.gov.br`), synoptic analysis, precipitation maps, frost maps (`/paginas/geadas`), 24h extremes, 1961–1990 Normals (`/normais`), meteorological database links (BDMEP at `bdmep.inmet.gov.br`), station catalogs (`/paginas/catalogoaut`, `/paginas/catalogoman`), and Sisdagro agrometeorology (`sisdagro.inmet.gov.br`: water balance, degree days, workability days, frost risk). Alert-AS RSS linked (`apiprevmet3.inmet.gov.br/avisos/rss`).
* **Limitations & Explicit Unknowns:** Generic municipal search field is present, but supplies no Campinas station identifiers, coordinates, microclimate observations, or frost series. Only an RSS feed is exposed; REST API contracts and raw data schemas are absent. Federal portal branding; explicit open data licence is not established on page. Underlying data resolution, units, authentication, refresh cadence, and commercial reuse terms remain UNKNOWN.

### 2.2 Embrapa (Empresa Brasileira de Pesquisa Agropecuária)
* **URL & Access:** `https://www.embrapa.br/` (Public HTTP GET, Receipt `br-embrapa`, fetched 2026-11-02 UTC; reviewed 2026-11-03).
* **Observed Capabilities:** Research and extension portal covering publications, technology transfer, and institutional governance. News and multimedia through late October 2026. Technologies catalog (`/busca-de-solucoes-tecnologicas/`, `/tecnologias`) covering crop management systems and mobile apps (e.g. *Irriga Certo*). Distance training via e-Campo / AVA Embrapa (`ava.sede.embrapa.br`) on digital agriculture and soil data management. Scientific publications catalog (`/busca-de-publicacoes/`, SEB) and licensing frameworks (`/licenciamento`).
* **Limitations & Explicit Unknowns:** Homepage does not establish research unit facilities or local soil surveys in Campinas; decentralized units are linked broadly via `/embrapa-no-brasil`. Footer states *"Todos os direitos reservados, conforme Lei nº 9.610"*; commercial reuse of underlying research data is not established. Informational CMS only; no REST API endpoints. Underlying data resolution, physical units, endpoint authentication, and release cadence are UNKNOWN.

### 2.3 Embrapa / SiSolos (Sistema de Informação de Solos Brasileiros)
* **URL & Access:** `https://www.sisolos.cnptia.embrapa.br/` (Public HTTP GET, Receipt `br-embrapa-soils`, fetched 2026-11-02 UTC; reviewed 2026-11-03).
* **Observed Capabilities:** Landing redirect stub for Brazilian soil profile data. Directs to Redape repository via persistent identifier DOI `10.48432/DDBVFO` (`https://doi.org/10.48432/DDBVFO`). Executes automated 5s HTTP meta-refresh to target DOI.
* **Limitations & Explicit Unknowns:** Landing stub displays `<p class="small">Licença: Embrapa (CC BY-NC 4.0).</p>` for cited Redape dataset; commercial reuse is not established under this label. Whether this label governs every downstream file or separate terms exist is UNKNOWN (target repo not fetched). Minimal 1,572-byte stub delivers no raw soil horizons, GIS layers, or query APIs. Hostname uses `cnptia.embrapa.br`, but physical facility location or Campinas profile coverage is not established on stub. Resolution, units, and dates are UNKNOWN.

### 2.4 SiBBr (Sistema de Informação sobre a Biodiversidade Brasileira)
* **URL & Access:** `https://sibbr.gov.br/` (Public HTTP GET, Receipt `br-sibbr`, fetched 2026-11-02 UTC; reviewed 2026-11-03).
* **Observed Capabilities:** National biodiversity platform under MCTI (Brazilian GBIF Node). Reference taxonomic catalog (>160,000 entries from fauna and flora catalogs). Regional queries (`regions.sibbr.gov.br`), spatial analysis hub (`portal-espacial.sibbr.gov.br`), thematic threatened/endemic lists, nutritional database, and citizen science workflows (via iNaturalist).
* **Limitations & Explicit Unknowns:** Occurrence records document observed specimens only; they do NOT establish native, invasive, or legal status for farm planning. Portal displays media under CC BY-NC 4.0; these media labels do not establish licensing for underlying datasets, which remains UNKNOWN on this page. Commercial reuse of underlying data is not established. Summary counters render as zero on non-executing static fetches. Regional filters exist, but occurrences do not constitute agronomic advice or local permits. Underlying resolution, units, auth, and cadence are UNKNOWN.

### 2.5 MAPA (Ministério da Agricultura e Pecuária - Sanidade Vegetal)
* **URL & Access:** `https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/sanidade-vegetal` (Public HTTP GET, Receipt `br-mapa`, fetched 2026-11-02 UTC; reviewed 2026-11-03).
* **Observed Capabilities:** Federal plant health policy overview (*Defesa Sanitária Vegetal*) and agricultural inputs under SDA. Covers Pest Risk Analysis (*ARP*), quarantine treatments, import/export certification, and links to ZARC agricultural climate risk zoning. Published 2016-11-18, updated 2026-05-13.
* **Limitations & Explicit Unknowns:** Introductory policy context only; does NOT provide local planting permissions, full legal coverage, or grower compliance certificates. This federal introductory page does not verify São Paulo agency responsibilities or municipal rules. Separate state and local source verification remains required. Footer states CC BY-ND 3.0 for editorial portal text; terms and commercial reuse for underlying regulatory data remain UNKNOWN. Machine-readable APIs, resolution, units, auth, and update cadence are UNKNOWN.

---

## 3. Core Guardrails & Boundary Verification

1. **Provisional Target Only:** Campinas / São Paulo is evaluated strictly as an engineering investigation target, not an approved rollout zone, operational baseline, or agronomic recommendation.
2. **Jurisdictional Boundaries:** Federal (MAPA, INMET, MCTI), state (São Paulo), and municipal remits remain legally distinct. Federal overviews do not substitute for state phytosanitary transit certificates or municipal permits.
3. **Embrapa Soil Profile Non-Commercial Label:** Landing stub for Brazilian soil profiles (`sisolos.cnptia.embrapa.br`) displays `CC BY-NC 4.0` for the cited dataset; commercial reuse is not established. Downstream file terms remain UNKNOWN.
4. **Occurrence vs. Ecological/Legal Status:** SiBBr occurrence records document observed presence only. They do not prove an organism is legally permissible to cultivate, ecologically benign, native, or non-invasive.
5. **Regulatory Overview vs. Grower Permissions:** MAPA's introductory page states national biosecurity goals. It does not supply parcel-level planting authorizations, municipal zoning clearances, or local crop health permits.
6. **Zero Plant Species Names / Crop Examples:** All agricultural systems and botanical entities are referenced strictly through generic institutional and taxonomic categories.

---

## 4. Unverified Candidate Next Verification Targets

The following unverified candidate targets are identified strictly from exact hrefs in fetched link inventories (none has been fetched as a product data endpoint):

1. **INMET:** Candidate links `https://bdmep.inmet.gov.br` (Meteorological Database) or `https://portal.inmet.gov.br/paginas/catalogoaut` (Automatic Station Catalog) to check if station observations exist for Campinas.
2. **Embrapa General:** Candidate links `https://www.embrapa.br/dados-de-pesquisa` (Research Data) or `https://www.embrapa.br/embrapa-no-brasil` (Decentralized Units) to check unit remits and dataset terms.
3. **Embrapa Soils (SiSolos):** Candidate link `https://doi.org/10.48432/DDBVFO` (Redape dataset target) to check tabular file schemas, horizons, and licensing terms across repository files.
4. **SiBBr:** Candidate links `https://ala-hub.sibbr.gov.br/ala-hub/occurrences/search?taxa=` or `https://portal-espacial.sibbr.gov.br/spatial-hub/` to evaluate JSON query structure and publisher terms.
5. **MAPA / ZARC:** Candidate links `https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico` or `https://www.gov.br/agricultura/pt-br/acesso-a-informacao/dadosabertos` to check if municipal risk tables are publicly queryable.

---

## 5. Implementation & Operational Status

* **Documentation Pages Read & Verified:** 5 / 5
* **Public Product-Data Endpoints Fetched:** 0 / 5
* **Product Integrations Implemented:** 0 / 5 (None)
* **Operational Readiness:** Zero production code, components, or pipeline integrations are authorized or implemented from these documentation responses.
