# Climate-zone crown HSV audit

- Git commit: `9b642d42fe70b21f5a07fa4d47acd94f2197776d`
- Top-down assets: 53 / 53
- Pixel selection: decoded RGBA pixels with alpha > 128.
- Hue: circular mean weighted by saturation × alpha. Neutral pixels therefore do not impose an arbitrary hue, and antialiased pixels contribute in proportion to coverage.
- Saturation and value: arithmetic means weighted by alpha.
- Hue spread: smallest circular arc containing the 53 per-species mean hues; this avoids an artificial 0°/360° discontinuity.
- Hue spread: **151.56° — PASS** (target ≥70°; ordinary min–max 151.56°).
- Value spread: **46.88 percentage points — PASS** (target ≥45; Gariep ebony 12.48% to Lablab / dolichos bean 59.37%).
- Overall colour-spread gate: **PASS**

| Species | Top-down path | Mean hue | Mean saturation | Mean value | Pixels α>128 |
|---|---|---:|---:|---:|---:|
| Almond | `public/render-assets/reference-blueprint/almond-tree-v1.png` | 85.62° | 60.97% | 50.59% | 823,012 |
| Apricot | `public/render-assets/reference-blueprint/apricot-tree-v1.png` | 89.22° | 92.27% | 56.66% | 825,544 |
| Arabica coffee | `public/render-assets/reference-blueprint/arabica-coffee-tree-v1.png` | 89.25° | 81.05% | 43.98% | 887,712 |
| Dwarf Cavendish/Williams banana | `public/render-assets/reference-blueprint/banana-dwarf-cavendish-williams-v1.png` | 88.60° | 69.89% | 53.18% | 501,415 |
| Black mulberry | `public/render-assets/reference-blueprint/black-mulberry-tree-v1.png` | 107.28° | 80.34% | 42.41% | 908,112 |
| Carob | `public/render-assets/reference-blueprint/carob-tree-v1.png` | 97.66° | 88.19% | 33.38% | 890,188 |
| Date palm | `public/render-assets/reference-blueprint/date-palm-v1.png` | 81.09° | 70.56% | 41.11% | 751,440 |
| Pecan | `public/render-assets/reference-blueprint/pecan-tree-v1.png` | 98.65° | 82.61% | 39.79% | 865,080 |
| Pistachio | `public/render-assets/reference-blueprint/pistachio-tree-v1.png` | 89.18° | 61.95% | 48.58% | 871,684 |
| Quince | `public/render-assets/reference-blueprint/quince-tree-v1.png` | 75.97° | 48.76% | 54.22% | 735,058 |
| Sweet cherry | `public/render-assets/reference-blueprint/sweet-cherry-tree-v1.png` | 78.91° | 49.15% | 56.12% | 832,928 |
| Bluebush | `public/render-assets/reference-blueprint/bluebush-v1.png` | 128.87° | 37.39% | 46.78% | 795,869 |
| Brown ivory / motsintsila | `public/render-assets/reference-blueprint/brown-ivory-tree-v1.png` | 92.61° | 76.09% | 37.96% | 888,390 |
| Coastal red milkwood | `public/render-assets/reference-blueprint/coastal-red-milkwood-tree-v1.png` | 97.43° | 45.96% | 40.23% | 896,055 |
| Cross-berry | `public/render-assets/reference-blueprint/cross-berry-v1.png` | 75.62° | 53.99% | 40.11% | 734,459 |
| Gariep ebony | `public/render-assets/reference-blueprint/gariep-ebony-tree-v1.png` | 204.62° | 62.24% | 12.48% | 740,156 |
| Glossy currant | `public/render-assets/reference-blueprint/glossy-currant-v1.png` | 76.86° | 67.34% | 39.32% | 888,302 |
| Karoo crossberry | `public/render-assets/reference-blueprint/karoo-crossberry-v1.png` | 77.76° | 58.42% | 40.26% | 716,527 |
| Kuni bush | `public/render-assets/reference-blueprint/kuni-bush-v1.png` | 76.17° | 68.07% | 34.10% | 715,613 |
| Puzzle bush | `public/render-assets/reference-blueprint/puzzle-bush-v1.png` | 73.22° | 57.59% | 41.22% | 810,984 |
| Red milkwood / moepel | `public/render-assets/reference-blueprint/red-milkwood-tree-v1.png` | 97.04° | 57.26% | 32.54% | 879,771 |
| Shepherd's tree | `public/render-assets/reference-blueprint/shepherds-tree-v1.png` | 79.56° | 36.05% | 45.92% | 794,103 |
| Small-leaved guarri | `public/render-assets/reference-blueprint/small-leaved-guarri-v1.png` | 79.46° | 45.33% | 32.20% | 850,928 |
| Waterblommetjie | `public/render-assets/reference-blueprint/waterblommetjie-v1.png` | 82.91° | 74.75% | 44.67% | 694,921 |
| Wild date palm | `public/render-assets/reference-blueprint/wild-date-palm-v1.png` | 85.99° | 66.48% | 45.36% | 785,855 |
| Wild medlar / mmilo | `public/render-assets/reference-blueprint/wild-medlar-v1.png` | 77.72° | 62.97% | 46.41% | 756,408 |
| Bietou / bush-tick berry | `public/render-assets/reference-blueprint/bietou-v1.png` | 82.36° | 64.25% | 45.10% | 745,564 |
| Brandybush / velvet raisin | `public/render-assets/reference-blueprint/brandybush-v1.png` | 76.53° | 52.02% | 43.75% | 698,484 |
| Honeybush / heuningbos | `public/render-assets/reference-blueprint/honeybush-v1.png` | 68.33° | 63.90% | 43.72% | 772,513 |
| Rooibos | `public/render-assets/reference-blueprint/rooibos-v1.png` | 57.87° | 57.90% | 38.64% | 816,685 |
| Rosemary | `public/render-assets/reference-blueprint/rosemary-v1.png` | 99.47° | 34.73% | 38.23% | 752,322 |
| Dogwood / umglindi | `public/render-assets/reference-blueprint/dogwood-v1.png` | 89.72° | 76.80% | 40.99% | 840,480 |
| Cape boxthorn / kriedoring | `public/render-assets/reference-blueprint/cape-boxthorn-v1.png` | 63.58° | 39.04% | 45.86% | 742,329 |
| Honey-thorn / kriedoring | `public/render-assets/reference-blueprint/honey-thorn-v1.png` | 60.55° | 33.10% | 42.57% | 755,879 |
| Natal currant | `public/render-assets/reference-blueprint/natal-currant-v1.png` | 76.34° | 87.92% | 44.36% | 835,616 |
| Pigeon pea | `public/render-assets/reference-blueprint/pigeon-pea-v1.png` | 92.20° | 73.31% | 47.17% | 761,484 |
| Quiver tree / kokerboom | `public/render-assets/reference-blueprint/quiver-tree-v1.png` | 70.46° | 41.27% | 48.74% | 616,474 |
| Spekboom | `public/render-assets/reference-blueprint/spekboom-v1.png` | 76.21° | 89.74% | 50.74% | 785,944 |
| Waxberry / wasbessie | `public/render-assets/reference-blueprint/waxberry-v1.png` | 100.66° | 76.77% | 41.06% | 850,763 |
| Baboon grape | `public/render-assets/reference-blueprint/baboon-grape-v1.png` | 67.87° | 78.62% | 34.47% | 734,477 |
| Bushman's grape | `public/render-assets/reference-blueprint/bushmans-grape-v1.png` | 82.41° | 78.66% | 45.77% | 869,143 |
| Common wild grape / bosdruif | `public/render-assets/reference-blueprint/common-wild-grape-v1.png` | 79.57° | 76.13% | 51.33% | 883,699 |
| Grape vine / wingerd | `public/render-assets/reference-blueprint/grape-vine-v1.png` | 77.18° | 80.79% | 52.02% | 895,982 |
| Lablab / dolichos bean | `public/render-assets/reference-blueprint/lablab-v1.png` | 89.32° | 83.07% | 59.37% | 854,576 |
| Malabar spinach | `public/render-assets/reference-blueprint/malabar-spinach-v1.png` | 89.69° | 76.43% | 53.32% | 867,888 |
| Purple granadilla / passion fruit | `public/render-assets/reference-blueprint/purple-granadilla-v1.png` | 88.40° | 74.35% | 46.79% | 867,096 |
| Buffalo thorn | `public/render-assets/reference-blueprint/buffalo-thorn-v1.png` | 73.99° | 66.01% | 40.61% | 818,973 |
| Karoo boer-bean | `public/render-assets/reference-blueprint/karoo-boer-bean-v1.png` | 53.06° | 44.50% | 44.91% | 858,632 |
| Pigeonwood / umbengele | `public/render-assets/reference-blueprint/pigeonwood-v1.png` | 83.61° | 54.01% | 45.84% | 856,959 |
| Powder-puff tree / iBoqo | `public/render-assets/reference-blueprint/powder-puff-tree-v1.png` | 81.42° | 64.46% | 44.86% | 890,307 |
| Karee | `public/render-assets/reference-blueprint/karee-v1.png` | 77.09° | 94.57% | 27.05% | 723,846 |
| White milkwood | `public/render-assets/reference-blueprint/white-milkwood-v1.png` | 84.01° | 62.65% | 30.16% | 761,916 |
| Olive | `public/render-assets/reference-blueprint/olive-v1.png` | 95.47° | 25.55% | 43.41% | 722,317 |
