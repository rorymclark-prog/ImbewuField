# Calendar accuracy audit: app pattern vs ERA5 frost and heat

Generated 2026-11-10 by accuracy/harness.ts. Raw data: locations.json.

## Limits

- ERA5 (Open-Meteo archive) is a gridded reanalysis, roughly 9-25 km cells. It smooths mountains and can miss frost in valley bottoms and cold-air pockets: its air-frost counts are estimates for a grid cell, not frost observations at a farm, a farm in a hollow may frost more often, and cell elevation (see locations.json era5.elevationM) can differ from the site.
- App side is NASA POWER monthly means (via fetchNasaPower; rainfall may be swapped for Open-Meteo 1991-2020 by the app when the two differ >30%, see rainfallSource). ERA5 side is 2001-2020 daily. Different periods and grids; differences are reported, not reconciled.
- Frost days = daily Tmin (2 m air) <= 0 C; ground-frost proxy = Tmin <= 2 C. Field months = sow month through first harvest month (harvestMonthForCrop, which includes the nursery months for transplants). Frost on seedlings in a tray is not field frost; locations.json also carries frostExposureBedEntryOnly (from bedEntryMonth).
- Monthly resolution: a month counted as exposed is exposed for at least part of it; harvest-window months after first harvest are not counted.

## (a) Locations

| Location | Lat, Lon | NASA cold/hot mean C | ERA5 cold/hot mean C | Rain mm NASA / ERA5 | Summer share N/E | Koppen N/E | Pattern N/E | ERA5 frost d/yr | Months >=1 frost d | Mean last frost |
|---|---|---|---|---|---|---|---|---|---|---|
| Mkuze sample farm | -27.73, 31.96 | 16.8/24.7 | 16.3/24.1 | 768 (nasa-power) / 584 | 0.8/0.77 | Cfa/BSh | mild-frost/summer | 0 | none | no frost (0/20 yrs) |
| Durban | -29.86, 31.03 | 20/25 | 17.4/24.5 | 886.8 (nasa-power) / 821.3 | 0.69/0.63 | Aw/Cfa | mild-frost/all-year | 0 | none | no frost (0/20 yrs) |
| Richards Bay | -28.78, 32.04 | 19.3/25.6 | 18.4/25.3 | 895.5 (open-meteo) / 870.6 | 0.64/0.63 | Aw/Aw | all-year/all-year | 0 | none | no frost (0/20 yrs) |
| Hillcrest | -29.78, 30.77 | 13.8/21.8 | 13.5/21.4 | 788.4 (open-meteo) / 759.4 | 0.7/0.68 | Cfb/Cfb | mild-frost/mild-frost | 0 | none | no frost (0/20 yrs) |
| Pietermaritzburg | -29.6, 30.38 | 12.9/21.2 | 12.8/21.6 | 1168.1 (nasa-power) / 864.6 | 0.78/0.74 | Cfb/Cfb | summer/summer | 0.2 | none | 2 Jul (4/20 yrs) |
| Underberg | -29.79, 29.5 | 7.4/18.4 | 6.7/17.5 | 1062.5 (nasa-power) / 1314.6 | 0.82/0.83 | Cwb/Cwb | summer/summer | 41.2 | May Jun Jul Aug Sep | 6 Sep (20/20 yrs) |
| Kokstad | -30.55, 29.42 | 8.6/19.3 | 9.2/19.4 | 1151.7 (nasa-power) / 865.7 | 0.78/0.76 | Cwb/Cfb | summer/summer | 15 | Jun Jul Aug | 17 Aug (20/20 yrs) |
| Newcastle | -27.76, 29.93 | 10.8/21.9 | 10.8/20.8 | 746.1 (nasa-power) / 799.6 | 0.83/0.82 | Cwb/Cwb | summer/summer | 5.1 | Jun Jul | 2 Aug (18/20 yrs) |
| Vryheid | -27.77, 30.79 | 10.9/21.3 | 11.6/20.4 | 764.4 (nasa-power) / 820.4 | 0.82/0.81 | Cwb/Cwb | summer/summer | 3.6 | Jun Jul | 23 Jul (15/20 yrs) |
| Johannesburg | -26.2, 28.05 | 9.9/21.6 | 9.2/19.4 | 641.2 (nasa-power) / 682.5 | 0.86/0.85 | Cwb/Cwb | summer/summer | 12.8 | Jun Jul Aug | 10 Aug (19/20 yrs) |
| Pretoria | -25.75, 28.19 | 12.6/24.3 | 11.9/22.2 | 570.7 (nasa-power) / 600.6 | 0.87/0.86 | BSh/BSh | summer/summer | 0.5 | none | 13 Jul (8/20 yrs) |
| Ermelo | -26.53, 29.98 | 8.2/19.4 | 9.1/18.2 | 795.5 (nasa-power) / 761.3 | 0.84/0.86 | Cwb/Cwb | summer/summer | 9.3 | Jun Jul Aug | 2 Aug (20/20 yrs) |
| Bethlehem | -28.23, 28.31 | 7.9/21.5 | 8/19.7 | 793.5 (open-meteo) / 717 | 0.83/0.83 | Cwb/Cwb | summer/summer | 21.9 | Jun Jul Aug | 22 Aug (20/20 yrs) |
| Bloemfontein | -29.12, 26.21 | 8.5/24.4 | 8.9/23.5 | 489.1 (nasa-power) / 491 | 0.79/0.74 | BSk/BSk | summer/summer | 22.5 | May Jun Jul Aug | 24 Aug (20/20 yrs) |
| Potchefstroom | -26.71, 27.1 | 9.8/23.4 | 10.7/22.7 | 554 (nasa-power) / 564.1 | 0.84/0.83 | BSk/BSh | summer/summer | 8.4 | Jun Jul Aug | 4 Aug (19/20 yrs) |
| Mahikeng | -25.86, 25.64 | 11/24.9 | 11.4/23.6 | 480.3 (nasa-power) / 495.3 | 0.83/0.82 | BSh/BSh | summer/summer | 5.8 | Jun Jul | 29 Jul (19/20 yrs) |
| Kimberley | -28.74, 24.76 | 9.8/26.3 | 10.8/25.7 | 416.7 (nasa-power) / 430.4 | 0.8/0.76 | BSh/BSh | summer/summer | 8 | Jun Jul Aug | 9 Aug (19/20 yrs) |
| Rustenburg | -25.67, 27.24 | 12.8/24.9 | 12.4/23.5 | 583.8 (nasa-power) / 527.9 | 0.85/0.84 | BSh/BSh | summer/summer | 0.9 | none | 16 Jul (9/20 yrs) |
| Mbombela | -25.47, 30.97 | 15.9/24.5 | 14.2/23.1 | 684.3 (nasa-power) / 848.3 | 0.84/0.83 | BSh/Cwa | summer/mild-frost | 0 | none | no frost (0/20 yrs) |
| Komatipoort | -25.43, 31.95 | 18.4/26.3 | 18.6/26.1 | 641.3 (nasa-power) / 514.8 | 0.84/0.84 | BSh/BSh | summer/summer | 0 | none | no frost (0/20 yrs) |
| Tzaneen | -23.83, 30.16 | 13.8/23.1 | 14.9/23.1 | 633.7 (nasa-power) / 851.1 | 0.86/0.83 | BSh/Cwa | summer/mild-frost | 0 | none | no frost (0/20 yrs) |
| Polokwane | -23.9, 29.45 | 12.1/22.5 | 12.8/21.6 | 529 (nasa-power) / 598.2 | 0.87/0.87 | BSh/BSh | summer/summer | 0.1 | none | 17 Jul (1/20 yrs) |
| Musina | -22.35, 30.04 | 17.4/27.2 | 17/26.4 | 349.2 (open-meteo) / 331.1 | 0.9/0.9 | BWh/BWh | summer/summer | 0 | none | no frost (0/20 yrs) |
| Thohoyandou | -22.95, 30.48 | 17.2/26.2 | 15.4/23.1 | 584.2 (nasa-power) / 971.9 | 0.85/0.82 | BSh/Cwa | summer/mild-frost | 0 | none | no frost (0/20 yrs) |
| Phalaborwa | -23.94, 31.14 | 18.2/27 | 17.5/25.8 | 541.8 (nasa-power) / 424.1 | 0.86/0.88 | BSh/BSh | summer/summer | 0 | none | no frost (0/20 yrs) |
| Lephalale | -23.67, 27.75 | 15.3/27 | 15.1/26.2 | 419.2 (nasa-power) / 350.9 | 0.88/0.88 | BSh/BWh | summer/summer | 0 | none | no frost (0/20 yrs) |
| Mthatha | -31.59, 28.78 | 11.2/20.7 | 12.4/20.4 | 1113.8 (nasa-power) / 902.4 | 0.73/0.74 | Cfb/Cfb | summer/summer | 0.1 | none | 31 Jul (1/20 yrs) |
| Port St Johns | -31.62, 29.54 | 14.1/22.1 | 16.4/23.4 | 1063.3 (nasa-power) / 1000.3 | 0.72/0.67 | Cfa/Cfa | mild-frost/mild-frost | 0 | none | no frost (0/20 yrs) |
| East London | -33.02, 27.9 | 17.6/23.4 | 16.6/23.2 | 984 (nasa-power) / 710.2 | 0.68/0.64 | Cfa/Cfa | mild-frost/all-year | 0 | none | no frost (0/20 yrs) |
| Gqeberha | -33.96, 25.6 | 15.8/22.2 | 15.1/21.7 | 435.6 (nasa-power) / 455.9 | 0.55/0.58 | BSh/BSh | all-year/all-year | 0 | none | no frost (0/20 yrs) |
| Komani | -31.9, 26.88 | 8.3/20.9 | 10.1/21 | 723.6 (nasa-power) / 610 | 0.75/0.76 | Cfb/Cfb | summer/summer | 10.4 | Jun Jul Aug | 18 Aug (20/20 yrs) |
| Graaff-Reinet | -32.25, 24.53 | 7.9/21.6 | 11.3/22.9 | 424.2 (nasa-power) / 460.6 | 0.7/0.7 | BSk/BSk | summer/summer | 7 | Jun Jul Aug | 20 Aug (20/20 yrs) |
| Cape Town | -33.93, 18.42 | 14.3/20.3 | 12.8/21.5 | 488.7 (nasa-power) / 505.4 | 0.23/0.23 | Csb/Csb | winter/winter | 0 | none | no frost (0/20 yrs) |
| Stellenbosch | -33.93, 18.86 | 11.9/21.6 | 12.1/22.9 | 733.1 (nasa-power) / 791.2 | 0.24/0.23 | Csb/Csa | winter/winter | 0 | none | no frost (0/20 yrs) |
| Worcester | -33.65, 19.45 | 8.8/21.8 | 12.1/22.9 | 440.2 (open-meteo) / 430.2 | 0.37/0.37 | BSk/BSk | summer/all-year | 0.1 | none | 16 Jul (2/20 yrs) |
| Ceres | -33.37, 19.31 | 8.8/21.8 | 10.6/23.5 | 670.5 (nasa-power) / 605.7 | 0.29/0.24 | Csb/Csa | winter/winter | 1.2 | none | 4 Aug (9/20 yrs) |
| George | -33.96, 22.46 | 13.8/21.3 | 12.7/20 | 626.1 (open-meteo) / 615.6 | 0.56/0.55 | Cfb/Cfb | all-year/all-year | 0 | none | no frost (0/20 yrs) |
| Oudtshoorn | -33.59, 22.2 | 9.8/21.6 | 11.7/22.6 | 487.5 (nasa-power) / 358.3 | 0.56/0.54 | Cfb/BSk | summer/all-year | 2.7 | Jul | 31 Jul (15/20 yrs) |
| Beaufort West | -32.35, 22.58 | 10.7/24.8 | 11.3/24.2 | 299.8 (nasa-power) / 339.1 | 0.63/0.66 | BSk/BSh | summer/summer | 3.8 | Jul | 3 Aug (20/20 yrs) |
| Vredendal | -31.67, 18.5 | 12.4/24.4 | 13.5/22.9 | 267.5 (nasa-power) / 203.9 | 0.19/0.24 | BSh/BSh | winter/winter | 0 | none | no frost (0/20 yrs) |
| Sutherland | -32.4, 20.66 | 7.8/22.3 | 7/20.9 | 317.5 (nasa-power) / 298.8 | 0.38/0.52 | BSk/BSk | summer/summer | 23.6 | May Jun Jul Aug Sep | 25 Sep (20/20 yrs) |
| Upington | -28.45, 21.25 | 11.8/28.6 | 13/28.8 | 192.8 (nasa-power) / 206.9 | 0.76/0.72 | BWh/BWh | summer/summer | 1.9 | none | 21 Jul (17/20 yrs) |
| Springbok | -29.66, 17.89 | 10.5/24.5 | 11.7/23 | 168.6 (nasa-power) / 151.8 | 0.33/0.43 | BWk/BWk | winter/all-year | 1.2 | none | 2 Aug (14/20 yrs) |
| Kuruman | -27.45, 23.43 | 10.8/26.7 | 10.8/24.5 | 412.3 (nasa-power) / 453.5 | 0.77/0.8 | BSh/BSh | summer/summer | 3.7 | Jun Jul | 29 Jul (19/20 yrs) |
| Maseru | -29.31, 27.48 | 6.8/21 | 6.7/20.7 | 668.6 (nasa-power) / 787.6 | 0.77/0.78 | Cwb/Cwb | summer/summer | 53 | May Jun Jul Aug Sep | 11 Sep (20/20 yrs) |
| Mbabane | -26.31, 31.13 | 14.4/23 | 12.2/19.9 | 1263.5 (open-meteo) / 1215.8 | 0.81/0.81 | Cwa/Cwb | mild-frost/summer | 0.2 | none | 7 Jul (3/20 yrs) |
| Maputo | -25.97, 32.57 | 19.2/26.4 | 19.2/25.9 | 776.3 (nasa-power) / 634.1 | 0.79/0.81 | Aw/BSh | mild-frost/summer | 0 | none | no frost (0/20 yrs) |
| Gaborone | -24.65, 25.91 | 13/26.2 | 13.4/25.7 | 502.3 (nasa-power) / 440.4 | 0.84/0.85 | BSh/BSh | summer/summer | 0.2 | none | 29 Jun (3/20 yrs) |
| Windhoek | -22.56, 17.08 | 12.3/24.1 | 13/23.8 | 441 (nasa-power) / 514.6 | 0.84/0.92 | BSh/BSh | summer/summer | 4.7 | Jun Jul Aug | 9 Aug (17/20 yrs) |
| Harare | -17.83, 31.05 | 13.6/22.7 | 13.8/21.6 | 787.4 (nasa-power) / 767.2 | 0.91/0.95 | Cwa/Cwb | mild-frost/mild-frost | 0 | none | no frost (0/20 yrs) |
| Lusaka | -15.42, 28.28 | 17.4/26.6 | 15.9/24.6 | 778.6 (nasa-power) / 910.8 | 0.96/0.96 | Cwa/Cwa | mild-frost/mild-frost | 0 | none | no frost (0/20 yrs) |
| Lilongwe | -13.96, 33.77 | 15.9/24.7 | 16.5/24.1 | 713.5 (open-meteo) / 728.3 | 0.95/0.96 | Cwa/Cwa | mild-frost/mild-frost | 0 | none | no frost (0/20 yrs) |
| Nairobi | -1.29, 36.82 | 18.7/21.6 | 17.2/20.6 | 601.7 (nasa-power) / 700.7 | 0.55/0.54 | Aw/Csb | all-year/all-year | 0 | none | no frost (0/20 yrs) |
| Kampala | 0.35, 32.58 | 21.4/24.3 | 20.2/22.2 | 1396.5 (nasa-power) / 1577.5 | 0.49/0.51 | Am/Af | all-year/all-year | 0 | none | no frost (0/19 yrs) |
| Addis Ababa | 9.03, 38.74 | 14.1/18.1 | 14.3/16.9 | 1741 (open-meteo) / 1721.1 | 0.91/0.92 | Cwb/Cwb | mild-frost/mild-frost | 0 | none | no frost (0/19 yrs) |
| Accra | 5.6, -0.19 | 24.1/27.9 | 24.2/28 | 1166.7 (nasa-power) / 845.6 | 0.65/0.66 | Aw/Aw | mild-frost/mild-frost | 0 | none | no frost (0/19 yrs) |
| Vienna | 48.21, 16.37 | -1.6/20.9 | 0.2/21.6 | 736.4 (nasa-power) / 658.3 | 0.64/0.63 | Dfb/Cfb | summer/summer | 82.7 | Jan Feb Mar Apr Nov Dec | 5 Apr (19/19 yrs) |
| London | 51.51, -0.13 | 4.1/17.6 | 4.8/17.8 | 708.8 (nasa-power) / 656.2 | 0.45/0.49 | Cfb/Cfb | summer/summer | 39.7 | Jan Feb Mar Apr Nov Dec | 8 Apr (19/19 yrs) |
| Delhi | 28.61, 77.21 | 13.6/35.9 | 13.5/33.1 | 751 (nasa-power) / 649.7 | 0.89/0.85 | BSh/BSh | summer/summer | 0 | none | no frost (0/19 yrs) |
| Sao Paulo | -23.55, -46.63 | 15.9/22.4 | 16.4/22.6 | 1350.7 (nasa-power) / 1223.8 | 0.72/0.74 | Cfa/Cfa | mild-frost/mild-frost | 0 | none | no frost (0/20 yrs) |
| Melbourne | -37.81, 144.96 | 9.5/20 | 9.7/20.4 | 714.8 (nasa-power) / 592.8 | 0.47/0.5 | Cfb/Cfb | summer/summer | 0.2 | none | 2 Aug (3/20 yrs) |
| Fresno | 36.74, -119.79 | 9.1/30.2 | 8.7/30 | 416.2 (open-meteo) / 377.4 | 0.14/0.16 | Csa/Csa | winter/winter | 5 | Jan Dec | 16 Jan (17/19 yrs) |

## (b) frostExposure (frost-tender crop, >=1.0 ERA5 air-frost day per month in a field month)

Severity = highest monthly frost-day average among field months, then sum across field months. Soft flag (>=0.2 d/month) counts are given in the heading.

### Pattern summer: 31 locations, 79 hard flags, 247 soft flags

**Pietermaritzburg** (ERA5 0.2 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Underberg** (ERA5 41.2 frost d/yr; 17 hard, 34 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 7.15, Sep 1.15 | Aug 95%, Sep 45% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 7.15, Sep 1.15 | Aug 95%, Sep 45% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 7.15, Sep 1.15 | Aug 95%, Sep 45% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 7.15, Sep 1.15 | Aug 95%, Sep 45% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 7.15, Sep 1.15 | Aug 95%, Sep 45% |
| green-beans | Sep | Sep-Oct-Nov | Sep 1.15 | Sep 45% |
| tomatoes | Sep | Sep-Oct-Nov-Dec-Jan-Feb | Sep 1.15 | Sep 45% |
| peppers | Sep | Sep-Oct-Nov-Dec-Jan-Feb | Sep 1.15 | Sep 45% |
| chilli | Sep | Sep-Oct-Nov-Dec-Jan-Feb | Sep 1.15 | Sep 45% |
| potato | Sep | Sep-Oct-Nov-Dec-Jan | Sep 1.15 | Sep 45% |
| cucumber | Sep | Sep-Oct-Nov-Dec | Sep 1.15 | Sep 45% |
| amaranth | Sep | Sep-Oct-Nov | Sep 1.15 | Sep 45% |
| gem-squash | Sep | Sep-Oct-Nov-Dec | Sep 1.15 | Sep 45% |
| baby-marrow | Sep | Sep-Oct-Nov | Sep 1.15 | Sep 45% |
| spanspek | Sep | Sep-Oct-Nov-Dec-Jan | Sep 1.15 | Sep 45% |
| sweetcorn | Sep | Sep-Oct-Nov-Dec | Sep 1.15 | Sep 45% |
| spider-plant | Sep | Sep-Oct-Nov-Dec-Jan | Sep 1.15 | Sep 45% |

**Kokstad** (ERA5 15 frost d/yr; 5 hard, 12 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2.95 | Aug 80% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2.95 | Aug 80% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2.95 | Aug 80% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 2.95 | Aug 80% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 2.95 | Aug 80% |

**Newcastle** (ERA5 5.1 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

**Vryheid** (ERA5 3.6 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

**Johannesburg** (ERA5 12.8 frost d/yr; 5 hard, 0 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.9 | Aug 65% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.9 | Aug 65% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.9 | Aug 65% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.9 | Aug 65% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.9 | Aug 65% |

**Pretoria** (ERA5 0.5 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Ermelo** (ERA5 9.3 frost d/yr; 5 hard, 0 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.55 | Aug 55% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.55 | Aug 55% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.55 | Aug 55% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.55 | Aug 55% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.55 | Aug 55% |

**Bethlehem** (ERA5 21.9 frost d/yr; 5 hard, 12 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 3.85 | Aug 85% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 3.85 | Aug 85% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 3.85 | Aug 85% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 3.85 | Aug 85% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 3.85 | Aug 85% |

**Bloemfontein** (ERA5 22.5 frost d/yr; 5 hard, 12 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 4.4 | Aug 95% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 4.4 | Aug 95% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 4.4 | Aug 95% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 4.4 | Aug 95% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 4.4 | Aug 95% |

**Potchefstroom** (ERA5 8.4 frost d/yr; 5 hard, 0 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.05 | Aug 60% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.05 | Aug 60% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.05 | Aug 60% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.05 | Aug 60% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.05 | Aug 60% |

**Mahikeng** (ERA5 5.8 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

**Kimberley** (ERA5 8 frost d/yr; 5 hard, 0 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.3 | Aug 55% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.3 | Aug 55% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 1.3 | Aug 55% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.3 | Aug 55% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 1.3 | Aug 55% |

**Rustenburg** (ERA5 0.9 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Mbombela** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Komatipoort** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Tzaneen** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Polokwane** (ERA5 0.1 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Musina** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Thohoyandou** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Phalaborwa** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Lephalale** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Mthatha** (ERA5 0.1 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Komani** (ERA5 10.4 frost d/yr; 5 hard, 12 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2.05 | Aug 95% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2.05 | Aug 95% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2.05 | Aug 95% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 2.05 | Aug 95% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 2.05 | Aug 95% |

**Graaff-Reinet** (ERA5 7 frost d/yr; 5 hard, 12 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2 | Aug 80% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2 | Aug 80% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 2 | Aug 80% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 2 | Aug 80% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 2 | Aug 80% |

**Worcester** (ERA5 0.1 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Oudtshoorn** (ERA5 2.7 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

**Beaufort West** (ERA5 3.8 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

**Sutherland** (ERA5 23.6 frost d/yr; 17 hard, 39 soft-only)

| Crop | Sow | Field months | Frost d/month in flagged months | Share of years with frost |
|---|---|---|---|---|
| tomatoes | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 7.4, Sep 2.45 | Aug 100%, Sep 80% |
| peppers | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 7.4, Sep 2.45 | Aug 100%, Sep 80% |
| chilli | Aug | Aug-Sep-Oct-Nov-Dec-Jan | Aug 7.4, Sep 2.45 | Aug 100%, Sep 80% |
| potato | Aug | Aug-Sep-Oct-Nov-Dec | Aug 7.4, Sep 2.45 | Aug 100%, Sep 80% |
| spider-plant | Aug | Aug-Sep-Oct-Nov-Dec | Aug 7.4, Sep 2.45 | Aug 100%, Sep 80% |
| green-beans | Sep | Sep-Oct-Nov | Sep 2.45 | Sep 80% |
| tomatoes | Sep | Sep-Oct-Nov-Dec-Jan-Feb | Sep 2.45 | Sep 80% |
| peppers | Sep | Sep-Oct-Nov-Dec-Jan-Feb | Sep 2.45 | Sep 80% |
| chilli | Sep | Sep-Oct-Nov-Dec-Jan-Feb | Sep 2.45 | Sep 80% |
| potato | Sep | Sep-Oct-Nov-Dec-Jan | Sep 2.45 | Sep 80% |
| cucumber | Sep | Sep-Oct-Nov-Dec | Sep 2.45 | Sep 80% |
| amaranth | Sep | Sep-Oct-Nov | Sep 2.45 | Sep 80% |
| gem-squash | Sep | Sep-Oct-Nov-Dec | Sep 2.45 | Sep 80% |
| baby-marrow | Sep | Sep-Oct-Nov | Sep 2.45 | Sep 80% |
| spanspek | Sep | Sep-Oct-Nov-Dec-Jan | Sep 2.45 | Sep 80% |
| sweetcorn | Sep | Sep-Oct-Nov-Dec | Sep 2.45 | Sep 80% |
| spider-plant | Sep | Sep-Oct-Nov-Dec-Jan | Sep 2.45 | Sep 80% |

**Upington** (ERA5 1.9 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

**Kuruman** (ERA5 3.7 frost d/yr; 0 hard, 5 soft-only)

No hard flags.

### Pattern mild-frost: 5 locations, 0 hard flags, 0 soft flags

**Mkuze sample farm** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Durban** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Hillcrest** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Port St Johns** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**East London** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

### Pattern all-year: 3 locations, 0 hard flags, 0 soft flags

**Richards Bay** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Gqeberha** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**George** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

### Pattern winter: 5 locations, 0 hard flags, 11 soft flags

**Cape Town** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Stellenbosch** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Ceres** (ERA5 1.2 frost d/yr; 0 hard, 8 soft-only)

No hard flags.

**Vredendal** (ERA5 0 frost d/yr; 0 hard, 0 soft-only)

No hard flags.

**Springbok** (ERA5 1.2 frost d/yr; 0 hard, 3 soft-only)

No hard flags.

## (c) Heat

App heat gate (judgeFieldMonths, NASA monthly means, field months = sow..first harvest): **9 of 7462** crop/sow-month/location combinations rejected as too-hot (assigned-pattern combinations only).

By location: Musina 1; Phalaborwa 1; Upington 7

| Location | Crop | Sow | Field months |
|---|---|---|---|
| Musina | true-spinach | Oct | Oct-Nov-Dec |
| Phalaborwa | true-spinach | Oct | Oct-Nov-Dec |
| Upington | true-spinach | Feb | Feb-Mar-Apr |
| Upington | true-spinach | Oct | Oct-Nov-Dec |
| Upington | parsley | Oct | Oct-Nov-Dec-Jan |
| Upington | parsley | Nov | Nov-Dec-Jan-Feb |
| Upington | parsley | Dec | Dec-Jan-Feb-Mar |
| Upington | parsley | Jan | Jan-Feb-Mar-Apr |
| Upington | parsley | Feb | Feb-Mar-Apr-May |

### aboveOptimum (NASA monthly mean above ECOCROP optimalMax): 1712 combinations; top 25 by degrees over

| Location | Crop | Sow | Months (NASA mean C vs optimalMax) | Max excess C |
|---|---|---|---|---|
| Upington | turnip | Jan | Jan 28.62 vs 17, Feb 28.08 vs 17, Mar 25.68 vs 17, Apr 20.86 vs 17 | 11.6 |
| Upington | turnip | Feb | Feb 28.08 vs 17, Mar 25.68 vs 17, Apr 20.86 vs 17 | 11.1 |
| Upington | turnip | Sep | Sep 18.1 vs 17, Oct 22.23 vs 17, Nov 24.85 vs 17, Dec 27.37 vs 17 | 10.4 |
| Musina | turnip | Sep | Sep 22.9 vs 17, Oct 25.34 vs 17, Nov 26.59 vs 17, Dec 27.15 vs 17 | 10.1 |
| Phalaborwa | turnip | Sep | Sep 23.16 vs 17, Oct 25.08 vs 17, Nov 26.31 vs 17, Dec 27.03 vs 17 | 10 |
| Lephalale | turnip | Jan | Jan 26.96 vs 17, Feb 26.7 vs 17, Mar 25.28 vs 17, Apr 22.37 vs 17 | 10 |
| Lephalale | turnip | Sep | Sep 22.48 vs 17, Oct 25.47 vs 17, Nov 26.41 vs 17, Dec 26.96 vs 17 | 10 |
| Musina | turnip | Jan | Jan 26.91 vs 17, Feb 26.67 vs 17, Mar 25.52 vs 17, Apr 23.27 vs 17 | 9.9 |
| Phalaborwa | turnip | Jan | Jan 26.89 vs 17, Feb 26.79 vs 17, Mar 25.75 vs 17, Apr 23.37 vs 17 | 9.9 |
| Phalaborwa | turnip | Feb | Feb 26.79 vs 17, Mar 25.75 vs 17, Apr 23.37 vs 17, May 21 vs 17 | 9.8 |
| Musina | turnip | Feb | Feb 26.67 vs 17, Mar 25.52 vs 17, Apr 23.27 vs 17, May 20.51 vs 17 | 9.7 |
| Lephalale | turnip | Feb | Feb 26.7 vs 17, Mar 25.28 vs 17, Apr 22.37 vs 17, May 19.02 vs 17 | 9.7 |
| Musina | turnip | Aug | Aug 19.97 vs 17, Sep 22.9 vs 17, Oct 25.34 vs 17, Nov 26.59 vs 17 | 9.6 |
| Kuruman | turnip | Jan | Jan 26.65 vs 17, Feb 25.71 vs 17, Mar 23.59 vs 17, Apr 19.09 vs 17 | 9.6 |
| Lephalale | turnip | Aug | Aug 18.54 vs 17, Sep 22.48 vs 17, Oct 25.47 vs 17, Nov 26.41 vs 17 | 9.4 |
| Kimberley | turnip | Jan | Jan 26.27 vs 17, Feb 25.2 vs 17, Mar 22.99 vs 17, Apr 18.36 vs 17 | 9.3 |
| Komatipoort | turnip | Sep | Sep 22.82 vs 17, Oct 24.25 vs 17, Nov 25.34 vs 17, Dec 26.31 vs 17 | 9.3 |
| Phalaborwa | turnip | Aug | Aug 20.5 vs 17, Sep 23.16 vs 17, Oct 25.08 vs 17, Nov 26.31 vs 17 | 9.3 |
| Komatipoort | turnip | Jan | Jan 26.24 vs 17, Feb 26.23 vs 17, Mar 25.47 vs 17, Apr 23.08 vs 17 | 9.2 |
| Komatipoort | turnip | Feb | Feb 26.23 vs 17, Mar 25.47 vs 17, Apr 23.08 vs 17, May 20.94 vs 17 | 9.2 |
| Thohoyandou | turnip | Sep | Sep 22.4 vs 17, Oct 24.5 vs 17, Nov 25.7 vs 17, Dec 26.18 vs 17 | 9.2 |
| Kuruman | turnip | Sep | Sep 17.96 vs 17, Oct 21.73 vs 17, Nov 23.99 vs 17, Dec 26.06 vs 17 | 9.1 |
| Kimberley | turnip | Sep | Sep 17.4 vs 17, Oct 21.26 vs 17, Nov 23.44 vs 17, Dec 25.76 vs 17 | 8.8 |
| Thohoyandou | turnip | Jan | Jan 25.84 vs 17, Feb 25.72 vs 17, Mar 24.66 vs 17, Apr 22.53 vs 17 | 8.8 |
| Phalaborwa | turnip | Mar | Mar 25.75 vs 17, Apr 23.37 vs 17, May 21 vs 17, Jun 18.6 vs 17 | 8.8 |

### hotDays (information only; ERA5 mean daily MAX above ECOCROP absoluteMax in a field month): 703 combinations; top 25

| Location | Crop | Sow | Months (ERA5 mean max vs absoluteMax) | Max excess C |
|---|---|---|---|---|
| Upington | true-spinach | Oct | Oct 30.8 vs 27, Nov 32.8 vs 27, Dec 34.9 vs 27 | 7.9 |
| Upington | true-spinach | Feb | Feb 34.6 vs 27, Mar 32.6 vs 27, Apr 27.7 vs 27 | 7.6 |
| Upington | parsley | Oct | Oct 30.8 vs 28, Nov 32.8 vs 28, Dec 34.9 vs 28, Jan 35.4 vs 28 | 7.4 |
| Upington | parsley | Nov | Nov 32.8 vs 28, Dec 34.9 vs 28, Jan 35.4 vs 28, Feb 34.6 vs 28 | 7.4 |
| Upington | parsley | Dec | Dec 34.9 vs 28, Jan 35.4 vs 28, Feb 34.6 vs 28, Mar 32.6 vs 28 | 7.4 |
| Upington | parsley | Jan | Jan 35.4 vs 28, Feb 34.6 vs 28, Mar 32.6 vs 28 | 7.4 |
| Upington | parsley | Sep | Oct 30.8 vs 28, Nov 32.8 vs 28, Dec 34.9 vs 28 | 6.9 |
| Upington | parsley | Feb | Feb 34.6 vs 28, Mar 32.6 vs 28 | 6.6 |
| Upington | true-spinach | Sep | Sep 27.3 vs 27, Oct 30.8 vs 27, Nov 32.8 vs 27 | 5.8 |
| Kimberley | true-spinach | Oct | Oct 29.7 vs 27, Nov 31.1 vs 27, Dec 32.7 vs 27 | 5.7 |
| Upington | true-spinach | Mar | Mar 32.6 vs 27, Apr 27.7 vs 27 | 5.6 |
| Upington | kale | Jan | Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |
| Upington | kale | Aug | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30 | 5.4 |
| Upington | kale | Sep | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |
| Upington | carrots | Sep | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30 | 5.4 |
| Upington | carrots | Oct | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30 | 5.4 |
| Upington | onions | May | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30 | 5.4 |
| Upington | potato | Sep | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30 | 5.4 |
| Upington | lettuce | Aug | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30 | 5.4 |
| Upington | lettuce | Sep | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30 | 5.4 |
| Upington | lettuce | Oct | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |
| Upington | turnip | Jan | Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |
| Upington | cauliflower | Aug | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |
| Upington | cauliflower | Sep | Oct 30.8 vs 30, Nov 32.8 vs 30, Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |
| Upington | cauliflower | Dec | Dec 34.9 vs 30, Jan 35.4 vs 30, Feb 34.6 vs 30, Mar 32.6 vs 30 | 5.4 |

## (d) NASA vs ERA5 pattern disagreements

| Location | NASA pattern | ERA5 pattern | Coldest mean N/E | Summer share N/E | Koppen N/E | ERA5 frost d/yr |
|---|---|---|---|---|---|---|
| Mkuze sample farm | mild-frost | summer | 16.8/16.3 | 0.8/0.77 | Cfa/BSh | 0 |
| Durban | mild-frost | all-year | 20/17.4 | 0.69/0.63 | Aw/Cfa | 0 |
| Mbombela | summer | mild-frost | 15.9/14.2 | 0.84/0.83 | BSh/Cwa | 0 |
| Tzaneen | summer | mild-frost | 13.8/14.9 | 0.86/0.83 | BSh/Cwa | 0 |
| Thohoyandou | summer | mild-frost | 17.2/15.4 | 0.85/0.82 | BSh/Cwa | 0 |
| East London | mild-frost | all-year | 17.6/16.6 | 0.68/0.64 | Cfa/Cfa | 0 |
| Worcester | summer | all-year | 8.8/12.1 | 0.37/0.37 | BSk/BSk | 0.1 |
| Oudtshoorn | summer | all-year | 9.8/11.7 | 0.56/0.54 | Cfb/BSk | 2.7 |
| Springbok | winter | all-year | 10.5/11.7 | 0.33/0.43 | BWk/BWk | 1.2 |
| Mbabane | mild-frost | summer | 14.4/12.2 | 0.81/0.81 | Cwa/Cwb | 0.2 |
| Maputo | mild-frost | summer | 19.2/19.2 | 0.79/0.81 | Aw/BSh | 0 |

## Failures

None.
