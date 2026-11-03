# Colombia IDEAM Agricultural Bulletin Review

## 1. Comparison of Official Indexes
Two official HTML bulletin indexes published by Colombia's *Instituto de Hidrología, Meteorología y Estudios Ambientales* (IDEAM) were inspected:
- **National Agroclimatic Index** ([Boletín agroclimático nacional](https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-agroclim%C3%A1tico-nacional)):
  The first listed publication date is **15 Mayo, 2026** (`boletin_agroclimatico_nacional_mayo_2026.pdf`, 31.43 MB). No later item appeared in the fetched index.
- **Weekly Agricultural Bulletin** ([Boletín Semanal para el Sector Agrícola (BSA)](https://www.ideam.gov.co/sala-de-prensa/boletines/Bolet%C3%ADn-Semanal-para-el-Sector-Agr%C3%ADcola-%28BSA%29)):
  The first listed publication date is **26 Octubre, 2026** (`bam_43_octubre_26_de_2026.pdf`, 6.05 MB). The page header advertises weekly releases published Monday afternoons, covering rainfall forecasts for the following week, preceding-week conditions, and national water availability for the preceding ten-day period. It also describes forecast detail by natural region.

## 2. Publication Metadata vs Actual Forecast Window
Publication timestamps (`Fecha de publicación`) reflect web index publishing dates, not the operational forecast window or active validity period inside the underlying PDF documents. While the weekly BSA index displays recent October 2026 releases, neither index provides machine-readable structured forecast windows or runtime availability guarantees in HTML.

## 3. Reference Recommendation & Draft Descriptions
The **Weekly Agricultural Bulletin (BSA)** is recommended as the single link-only research reference because its first visible item is newer than the national index’s.

- **English Draft**: "IDEAM’s Colombian agricultural bulletin index lists dated PDF links. Consult the provider for each issue’s coverage and validity."
- **Spanish Draft**: "El índice de boletines agrícolas del IDEAM de Colombia presenta enlaces a documentos PDF con fecha. Consulte al proveedor sobre la cobertura y vigencia de cada edición."

## 4. Unknown Capabilities
Re-use rights, automated ingestion, structured API/authentication, ongoing publication cadence, and local microclimate applicability remain strictly **unknown**. No PDF bodies, crop parameters, or advisory claims were ingested.

## Coordinator fetch receipts
- National index, HTTP 200, 2026-11-03T19:58:30.571573+00:00, 77788 bytes, SHA-256 `3d27acc39099b2af76545c44c050099658370cd5668245702bd435d562f0da69`.
- Weekly index, HTTP 200, 2026-11-03T19:58:31.171721+00:00, 81675 bytes, SHA-256 `d9fd7176957e533a2b6ab6406ed4f5d753f6bd94c21cf642a60af73fc748d3dc`.
