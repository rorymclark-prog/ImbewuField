# Data-Source Opportunities — ranked menu

_Research sweep 2026-07-15 (4 lanes: SA-gov/research, global-gridded, crop/pest/market/biodiversity, farmer-facing feeds). Read-only; nothing built. Product north-star: **deep data, radically simple for the farmer**; multi-country-ready sources score higher (owner may expand beyond SA)._

**Already integrated (don't re-add):** NASA POWER climate · SANBI vegetation · ISRIC/SoilGrids soil · Mapbox 10m terrain/DEM · **KZN BRU zones (just shipped)**.

## Top picks (ranked value × feasibility × commercial-license-safe × multi-country)

| # | Dataset | Farmer sees | Effort | Scope | License flag |
|---|---|---|---|---|---|
| 1 | **Open-Meteo Forecast + ET0** | 7–16 day rain/temp/wind strip + "water 12mm today" irrigation number; frost/heavy-rain banners | low | 🌍 global | Free tier is **non-commercial**; budget ~$29/mo paid tier once past prototype |
| 2 | **NASA SMAP soil moisture** | "Your soil is 40% drier than normal for now" — dynamic layer over static soil type | med | 🌍 global | Public domain — **clean** |
| 3 | **KZN Farm Portions cadastral** | Type a farm/portion → legal boundary auto-draws (matches deeds, not a traced guess) | low | KZN | No published ToS — **email CSG** before shipping to a paid product |
| 4 | **Joburg Market daily prices** | "What tomatoes/onions sold for at SA's biggest market yesterday" — the "sell now?" signal | med | SA | No API (HTML only), no reuse terms — **get written permission** |
| 5 | **GBIF occurrence API** | "These plants/birds/insects/pests recorded within X km" — grounds companion-planting + invasive flags | med | 🌍 global | Mixed per-record; ~82% commercial-safe — **build a license filter** (drop CC-BY-NC) |
| 6 | **ESA WorldCover 10m** | One-glance "what's around your farm" (cropland/forest/wetland/built-up) | low | 🌍 global | CC BY 4.0 — **clean** |
| 7 | **NASA FIRMS active fire** | "Fire detected 8km away, 2h ago" — real proximity safety alert | low | 🌍 global | NASA open — **clean** |
| 8 | **CABI Plantwise** | Named pest/crop → plain-language symptoms + photo + what to do (Africa-weighted) | high | 🌍 global | No bulk API; embedding terms unpublished — **contact CABI** |
| 9 | **FAO Crop Calendar** | Any crop → plant-this-month / harvest-by, govt-validated; auto-fills untuned crops | low | 🌍 50+ countries | FAO Open Data (CC-BY) — **clean** |
| 10 | **Sentinel-2 NDVI** | Green→brown crop-health overlay per bed, ~5-day refresh; stress before it's visible | high | 🌍 global | Data free/commercial-OK w/ attribution; Sentinel Hub compute paid (~€83/mo+) |

## Quick wins (low effort, clean license, real value)
- **Open-Meteo forecast + ET0** — closes the biggest gap: everything integrated is backward-looking.
- **ESA WorldCover 10m** — trivial add, zero license risk, instant context layer.
- **NASA FIRMS fire** — free key, simple REST CSV, global safety value.
- **FAO Crop Calendar** — free CC-BY, instant default planting windows for any crop/country.
- **KZN Farm Portions** — verified-live endpoint today; low lift; auto-draws legal boundaries; just needs a CSG license email. **Natural companion to the BRU work.**

## Multi-country foundation (makes the app work in any country)
Open-Meteo forecast+ET0 · NASA SMAP · NASA FIRMS · ESA WorldCover · GBIF (with license filter) · FAO Crop Calendar · Sentinel-2 NDVI · CHIRPS rainfall.

## ⚠️ Avoid / caution (license traps found)
- **WorldClim v2.1** (incl. CMIP6 future-climate) — CC BY-**NC**-SA, non-commercial. The unique future-climate part is exactly what you can't legally use in a paid product.
- **FAO GAEZ v5** — conceptually the *perfect* global BRU-equivalent, but license is CC BY-NC-SA + some "request permission" layers. Needs written FAO confirmation.
- **FAO/IIASA HWSD v2** — non-commercial AND lower-res than SoilGrids already integrated. Skip.
- **iNaturalist API** — CC BY-NC + ToS explicitly **bars commercial AI/ML**. Use GBIF's open subset instead.
- **ARC agromet stations** — paid subscription, no free API. Deprioritize.
- **SAWS severe-weather warnings** (via AfriGIS) — most farmer-relevant SA alert, but commercial subscription only (60-day trial).
- **PlantVillage images** — CC BY-**SA** share-alike traps a closed-source commercial app.
- **National cadastral / SANLC land cover / NFEPA wetlands** — data almost certainly exists but endpoints failed (DNS/TLS/socket) this pass — **re-verify before spending engineering time**.
- **Copernicus GLO-30 DEM** — NOT an upgrade; Mapbox 10m terrain is already finer. Back-pocket only for poor-Mapbox-coverage countries.

## The honest strategic read
The single biggest capability gap is that **everything integrated is backward-looking** — Open-Meteo (forecast + irrigation number) is the highest-leverage add and travels to any country day one. The most *attractive* datasets (WorldClim future-climate, FAO GAEZ, iNaturalist) are exactly the ones with commercial-license traps — steer around them. For SA-specific depth, KZN Farm Portions (auto-boundary) and Joburg Market prices are the standouts, both needing a permission conversation first.
