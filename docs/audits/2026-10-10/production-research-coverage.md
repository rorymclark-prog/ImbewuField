# Production research coverage — catalogue reconciliation, 11 October 2026

## Scope and result

**Gap-closing result, 11 October:** the shared generated authority now contains **103 dossiers**, including the 63 formerly missing distinct workstreams and three annual reference-only profiles. Seven verified equivalent live IDs reach those sources without changing saved identities; the joined lemon/mandarin choice explicitly requires product selection. The other 11 live food rows retain their existing annual crop authority and edible-part qualifications. All **122 catalogue food rows are accounted for**. No earlier dossier was lost.

There are **40 profiles with dated source references, 63 separate regional/cultivar windows and 133 supplemental references**. Source fields now contain 19 first-crop ages, nine full-bearing ages, six per-plant weight references, one generic chill-unit range and 21 pollination entries. Lower weight/chill counts reflect withdrawal of unsupported banana, plum and cultivar-union defaults. These counts describe available evidence; they do not mean all plants have a local calendar or a validated age-yield curve.

Nine dossiers require specialist food-use review, and the composite citrus identity requires selection. They remain mapped inventory and historical records, while ordinary picking jobs, food counts and kg totals exclude them. Historical records explain that exclusion; new ordinary food entries cannot select them. Primary-source notes preserve edible part, preparation, cultivar, starting stage, region and original units. The app, PDF and site-report guidance share those same records.

### Final source-stage and geography review

The final audit inspected all 45 profiles that previously had dates. Five profiles lost their only dated food reference, and wild medlar lost one wider interval: **45 → 40 dated profiles; 69 → 63 windows**. All six withdrawn intervals remain cited supplemental guidance. The profile count, products, existing plant identities, numeric age/weight facts and food-use holds are unchanged. No flowering month or development duration was shifted into an invented ripe-picking month. This changes the picture: those unsupported source bars disappear; actual locally recorded months still require the farmer's confirmation.

| Product | Before | After and primary-source reason |
| --- | --- | --- |
| Kei apple (`dovyalis-afra`) | November–January food reference | No ripe-picking window. [ICRAF BIOLOGY, PDF p.1](https://apps.worldagroforestry.org/treedb2/AFTPDFS/Dovyalis_caffra.PDF) combines flowering and fruiting and separately describes development. It does not date ripe yellow-orange fruit. The first-fruiting minimum remains separate evidence. |
| Jacket plum (`pappea-capensis`) | December–July food reference | No ripe-picking window. [SANBI](https://pza.sanbi.org/pappea-capensis) describes green fruit that later splits to expose edible red flesh; its fruit-production interval does not date that food-ready stage. |
| Waterberry (`syzygium-cordatum`) | November–March food reference | No ripe-picking window. [Original PROTA account](https://prota.prota4u.org/protav8.asp?p=Syzygium+cordatum) dates fruiting rather than ripening. The original institutional source replaces the mirror for the retained phenology citation. |
| Wild medlar (`vangueria-infausta`) | SANBI January–April plus ICRAF November–April | Retain January–April only: [SANBI's paragraph](https://pza.sanbi.org/vangueria-infausta) discusses soft edible ripe fruit. [ICRAF BIOLOGY, PDF p.1](https://apps.worldagroforestry.org/treedb2/AFTPDFS/Vangueria_infausta.PDF) gives a wider fruiting interval without dating the green-to-brown ripening change; retain it as phenology. |
| Moringa (`moringa-oleifera`) | March–April pod food reference | No young green-pod picking window. [North West DARD, PDF pp.7 and 34](https://dard.nwpg.gov.za/wp-content/uploads/2022/05/Moringa-production-for-food-security.pdf) dates fruit production in a botanical description, then separately requires young, tender, green pods for consumption without calendar months. The first-leaf age remains valid but does not establish pod readiness. |
| Spiny monkey orange (`strychnos-spinosa`) | August–December labelled South Africa (general) | No verified South African window. The [2021 review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8703348/) supplies months without a harvest locality. Related [author literature](https://www.tandfonline.com/doi/full/10.1080/87559129.2016.1149862) places this interval in Zimbabwe, while the [WUR thesis](https://edepot.wur.nl/459128) discusses that country's interval under a different monkey-orange species. Retain the review statement as contextual evidence, without assigning a general South African or warm-coast calendar. |

Edible-flower dates for wild garlic and green/mature edible-seed dates for Schotia are retained because those are the specified food stages, not ripe-fruit claims. Other retained botanical fruit dates explicitly describe ripening or place the interval in a ripe, edible-fruit paragraph. Cultivar first-pick dates, commercial crop/harvest intervals and named-site trial dates retain their original region, system and partial-season limits. Dedicated regression coverage rejects the removed profile windows, preserves each contextual citation and keeps wild medlar's narrower food-ready reference.

Spiny monkey orange's quoted first-bearing range remains 3–5 years, with an explicit note that the review cites a [Benin study](https://link.springer.com/article/10.1007/s12231-019-09481-0), not a South African bearing trial. Its directly stated 40–100 kg/tree-stand weight remains a source reference with no annual period or mature age. It is not relabelled kg/year, divided into monthly food or used as a farm yield curve. A regression supplies an established plant with known planting age and no farm yield schedule, and confirms that the source weight still leaves annual farm kg unknown.

The inventory tables below record the **pre-closure baseline at 89867f8b** and explain where the extensive previous research lived. Current closures are in the source JSONs and the linked age, animal and annual/identity reports; baseline nulls are not current missing-profile claims.

Inventory of the current existing catalogue at `89867f8bc87264ce7f2c6831a84fdc7a1d887bad`, before the next gap-closing research additions. This audit reads source, public research files and Git history only. It does not read private farmer records, alter plant names, add species, change geometry, change `PLAN_VERSION`, or invent production quantities. The archive path follows the ongoing 10 October audit.

**The extensive previous research exists and is retained.** The July palette exercise covers planting fit for 119 of the 122 current food-tagged botanical rows by an exact botanical-name match. That is planting/biome research, not 119 validated production forecasts. At the pre-closure baseline, the structured perennial production authority had 37 dossiers, all 37 wired into generated data, 32 with dated windows and 50 distinct regional/cultivar windows. No historical perennial dossier was found missing from the current source.

**The remaining gap is field-level production evidence and identity wiring.** It cannot be honestly described as 85 missing trees or 122 separately researched perennial products. A food tag also includes annual vegetables, fodder/food legumes, edible leaves, flower buds, tea plants and species whose catalogue name has several variants.

| Disjoint inventory bucket | Existing live catalogue rows | What it means |
| --- | ---: | --- |
| Dedicated perennial dossier + generated authority | 37 | Includes fruit, nuts, berries and moringa; some important fields remain null. |
| Existing annual crop authority or clearly related product/landrace | 11 | Reuse existing crop evidence; retain edible-part and cultivar qualifications. |
| Identity bridge / composite planting rows | 8 | Two peach variants, one joined citrus row, one wild-plum spelling, three extra wild-olive naming rows and one extra rosemary naming row. This is an accounting bucket, not permission to rewrite taxonomy. |
| Existing partial crop research, absent from automatic CROPS | 3 | Pigeon pea, lablab and narrow-leaf lupin already have source dossiers with real gaps. |
| Remaining distinct research workstreams represented by live IDs | 63 | 49 woody/climber rows and 14 herb/groundcover rows. These are not all orchard trees; production model and edible part must be checked. |
| **Total** | **122** | Every current food-tagged row appears exactly once below. |

All 122 are live `SPECIES` IDs. The only implemented retired-ID alias is `dovyalis-caffra → dovyalis-afra`; it is not an extra live row. The identity bucket groups potential duplicate research work, while preserving every saved ID. Wild olives are counted once as a representative workstream plus three bridge rows; rosemary once plus one bridge row. Different species with similar common names, including the two Carpobrotus species, are not merged.

## Authorities and what previous research actually established

- [SPECIES catalogue](../../../lib/species-catalog.ts): botanical identity, uses, stratum, mature design size, water/frost and biome ranking. Its source string is not a structured harvest calendar or numeric food-yield record.
- [July species research](../../../research/sa-species-research-2026-07-31.json): 394 biome-palette entries, covering 119 current food rows by exact botanical name. Strawberry, southern-highbush blueberry and raspberry are the three exact-name misses; their later production dossiers are present. Primary and secondary links are mixed in the July material, so new production figures must be checked against the primary source itself.
- [CROPS](../../../lib/crop-catalog.ts): 49 schedulable/catalogue entries, with cited fields and explicit timing/spacing/yield gates. 29 original entries carry inline source history and variety dossiers; 20 later entries also have top-level crop-source JSON. Absence of a separate top-level JSON does not mean the original crop is unresearched.
- [37 perennial research JSONs](../../../research/perennial-sources) and [generated harvest authority](../../../lib/perennial-harvest-data.ts): exact parity; no dossier is merely sitting unwired.
- [Product buying/care guidance](../../../lib/production-product-guidance.ts): 34 explicit profiles; fig, Cape gooseberry and guava use the existing generic dossier-backed path. A researched regional window is distinct from a confirmed local picking record.
- [Perennial produce picker](../../../lib/perennial-produce.ts): records mapped food products without inventing planning kg. Its source comments explicitly describe the annual/perennial ambiguity in herb and groundcover strata; pineapple, ginger, globe artichoke and Livingstone potato need a reviewed lifecycle/product model rather than a tree-kg assumption.
- [4 October product audit](../2026-10-04/production-products-codex.md), [regional calendar audit](../2026-10-04/regional-production-calendar-codex.md) and [regional sample manifest](../2026-10-04/evidence-regional-calendar/sample-manifest.json): retain the actual earlier cultivar/region exercise and distinguish reference bars from confirmed food.
- [Current complete example audit](complete-production-example-audit.md): the fictional demonstration is not evidence that all catalogue species are suitable for warm KZN.

Git history confirms the sequence: `c711285c` had 30 perennial dossiers; `e8be1de8` added six (strawberry, moringa, granadilla, Cape gooseberry, raspberry, blueberry), giving 36; `090437e2`, `8272b3b9` and `b12b7cd1` retain those 36; `89867f8b` adds apple, giving 37. `git ls-tree` found no former dossier absent today. The September/October crop research commits (`bf42c587`, `b06c08df`, `ae2818c5`, `8ab4bf6a`, `1f584a37` and related commits) also retain their partial source files.

## Field completeness of the 37 existing production dossiers

Counts of non-null structured fields: **H 32; F 13; B 7; Y 8; C 2; P 14**. H = source-qualified harvest month windows; F = first production age; B = full bearing age; Y = mature per-plant kg reference; C = generic chill units; P = pollination. A null C/P can be biologically irrelevant or cultivar-dependent; it is not an instruction to invent a number. A mature reference or first-bearing age is not a yield-by-age curve. No sourced curve is inferred between ages, and no mature weight is divided evenly among calendar months.

Apple illustrates why raw null counts need interpretation: its named Afri-Star chilling requirement is retained in buying context, but a universal apple chilling range is null; Granny Smith first-pick dates at Elgin are not a whole-season or warm KZN forecast. Moringa age evidence concerns leaf production while its dated window concerns pods. Banana has a first-crop interval and a regional converted yield reference but no verified local/year-round month bar.

| Existing species ID | Product label | Source windows | Missing structured fields | Dossier |
| --- | --- | ---: | --- | --- |
| `carica-papaya` | Pawpaw / papaya | 1 | B, Y, C, P | [JSON](../../../research/perennial-sources/carica-papaya.json) |
| `carissa-macrocarpa` | Num-num / Natal plum | 0 | H, F, B, Y, C, P | [JSON](../../../research/perennial-sources/carissa-macrocarpa.json) |
| `carpobrotus-edulis` | Sour fig | 0 | H, F, B, Y, C, P | [JSON](../../../research/perennial-sources/carpobrotus-edulis.json) |
| `carya-illinoinensis` | Pecan / pekanneut | 1 | F, B, Y, C | [JSON](../../../research/perennial-sources/carya-illinoinensis.json) |
| `citrus-limon` | Lemon | 2 | B, C, P | [JSON](../../../research/perennial-sources/citrus-limon.json) |
| `citrus-reticulata` | Soft citrus / naartjie | 3 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/citrus-reticulata.json) |
| `dovyalis-afra` | Kei apple / umqokolo | 1 | B, Y, C | [JSON](../../../research/perennial-sources/dovyalis-afra.json) |
| `englerophytum-magalismontanum` | Transvaal milkplum (stamvrug) | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/englerophytum-magalismontanum.json) |
| `ficus-carica` | Fig | 1 | F, B, Y, C | [JSON](../../../research/perennial-sources/ficus-carica.json) |
| `fragaria-x-ananassa` | Strawberry | 5 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/fragaria-x-ananassa.json) |
| `garcinia-livingstonei` | African mangosteen / imbe | 0 | H, F, B, Y, C, P | [JSON](../../../research/perennial-sources/garcinia-livingstonei.json) |
| `grewia-occidentalis` | Cross-berry | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/grewia-occidentalis.json) |
| `harpephyllum-caffrum` | Wild plum / umgwenya | 1 | F, B, Y, C | [JSON](../../../research/perennial-sources/harpephyllum-caffrum.json) |
| `litchi-chinensis` | Litchi | 4 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/litchi-chinensis.json) |
| `macadamia-integrifolia` | Macadamia | 1 | Y, C | [JSON](../../../research/perennial-sources/macadamia-integrifolia.json) |
| `malus-domestica` | Apple (low-chill cultivars) | 2 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/malus-domestica.json) |
| `mangifera-indica` | Mango | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/mangifera-indica.json) |
| `mimusops-zeyheri` | Red milkwood (moepel) | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/mimusops-zeyheri.json) |
| `moringa-oleifera` | Moringa / drumstick tree | 1 | B, Y, C, P | [JSON](../../../research/perennial-sources/moringa-oleifera.json) |
| `musa-acuminata-aaa-group` | Banana ('Dwarf Cavendish', 'Williams') | 0 | H, B, C | [JSON](../../../research/perennial-sources/musa-acuminata-aaa-group.json) |
| `pappea-capensis` | Jacket plum / doppruim | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/pappea-capensis.json) |
| `passiflora-edulis` | Purple granadilla / passion fruit | 1 | Y, C, P | [JSON](../../../research/perennial-sources/passiflora-edulis.json) |
| `persea-americana` | Avocado | 3 | C | [JSON](../../../research/perennial-sources/persea-americana.json) |
| `phoenix-reclinata` | Wild date palm / isuNdu | 2 | F, B, Y, C | [JSON](../../../research/perennial-sources/phoenix-reclinata.json) |
| `physalis-peruviana` | Cape gooseberry | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/physalis-peruviana.json) |
| `prunus-persica` | Low-chill peach | 2 | None of these six; local cultivar/age/management still needed | [JSON](../../../research/perennial-sources/prunus-persica.json) |
| `prunus-salicina` | Plum | 1 | B | [JSON](../../../research/perennial-sources/prunus-salicina.json) |
| `psidium-guajava` | Guava | 0 | H, C | [JSON](../../../research/perennial-sources/psidium-guajava.json) |
| `punica-granatum` | Pomegranate | 1 | F, Y, C, P | [JSON](../../../research/perennial-sources/punica-granatum.json) |
| `rhoicissus-tomentosa` | Common wild grape / bosdruif | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/rhoicissus-tomentosa.json) |
| `rubus-idaeus` | Raspberry | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/rubus-idaeus.json) |
| `sclerocarya-birrea-subsp-caffra` | Marula | 1 | F, B, C | [JSON](../../../research/perennial-sources/sclerocarya-birrea-subsp-caffra.json) |
| `strychnos-spinosa` | Spiny monkey orange | 1 | B, C, P | [JSON](../../../research/perennial-sources/strychnos-spinosa.json) |
| `syzygium-cordatum` | Waterberry / umDoni | 1 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/syzygium-cordatum.json) |
| `vaccinium-corymbosum` | Blueberry (southern highbush) | 2 | Y, C | [JSON](../../../research/perennial-sources/vaccinium-corymbosum.json) |
| `vangueria-infausta` | Wild medlar (mmilo) | 2 | F, B, Y, C, P | [JSON](../../../research/perennial-sources/vangueria-infausta.json) |
| `vitis-vinifera` | Grape vine / wingerd | 2 | F, B, Y, C | [JSON](../../../research/perennial-sources/vitis-vinifera.json) |

Each source dossier also carries its own `gaps` and conversion/context notes. Those are stronger evidence of the precise remaining question than the presence of a fruit icon. For the five dossiers without windows (banana, guava, Natal plum, sour fig and African mangosteen), previous searches explicitly withheld foreign calendars, flowering-only dates or secondary-only claims; the absent bars are intentional unknowns, not a render failure.

## Existing annual evidence: do not create duplicate perennial production

| Live catalogue species ID | Existing crop key / authority | Exact qualification |
| --- | --- | --- |
| `vigna-unguiculata` | `cowpea` | Exact botanical crop research; edible leaf yield remains unknown. |
| `ipomoea-batatas` | `sweet-potato` | Existing tuber planner; separate edible-leaf production is not implied. |
| `amaranthus-cruentus` | `amaranth` | Existing repeated leafy harvest; no defensible planning kg. |
| `cucurbita-maxima-c-moschata-open-pollinated-landraces` | `pumpkin` | Existing fruit planner is related; this mixed landrace and its leaf harvest are not a cultivar-specific yield source. |
| `cucurbita-moschata` | `pumpkin / butternut` | Existing fruit planners are related; leaf harvest and cultivar choice need separate context. |
| `cleome-gynandra` | `spider-plant` | Existing leafy planner; no defensible planning kg. |
| `colocasia-esculenta` | `amadumbe` | Existing taro planner; no defensible planning kg. |
| `vicia-faba` | `broad-beans` | Existing timed bean planner; no new orchard dossier needed. |
| `sorghum-bicolor` | `sorghum` | Existing grain planner; grain kg are not green fodder kg. |
| `citrullus-lanatus` | `watermelon` | Existing watermelon planner is related; tsamma/citron end-use and landrace must not inherit fruit weight blindly. |
| `solanum-retroflexum` | `african-nightshade` | Exact DAFF botanical research and leafy planner; no defensible planning kg; berry weights are separate. |

These rows are cross-references, not a promise that every cultivar or edible part shares the same schedule. In particular, a pumpkin-fruit benchmark cannot forecast harvested pumpkin leaves; a watermelon benchmark cannot be copied to an arbitrary tsamma landrace; a leaf yield cannot predict nightshade berry weight.

## Research already present but not connected to a dedicated production identity

| Exact existing live ID | Evidence / unresolved connection |
| --- | --- |
| `harpephyllum-afrum` | Source points to SANBI Harpephyllum caffrum; a complete caffrum dossier exists. Verify the old botanical spelling before any production alias. No automatic synonym added here. |
| `prunus-persica-low-chill-cultivars-200-500-chill-units` | Existing prunus-persica dossier and low-chill cultivar sheets. Map compatibility needs review; named peach sheets do not automatically validate a nectarine cultivar. |
| `prunus-persica-low-chill-arc-infruitec-selections` | Existing prunus-persica dossier; distinguish this planting variant from a new produce species. Exact cultivar still needed. |
| `citrus-reticulata-citrus-limon` | Composite planting choice names two products already covered by citrus-reticulata and citrus-limon. A harvest record needs the actual identity, not one joined season. |
| `olea-europaea-subsp-africana-o-e-subsp-cuspidata` | Catalogue botanical name explicitly gives alternate wild-olive names; shares SANBI source with olea-europaea-subsp-africana. One research workstream; exact saved ID preserved. |
| `olea-europaea-subsp-africana-subsp-cuspidata` | Same SANBI wild-olive source; catalogue naming needs taxonomy review. No separate invented fruit calendar. |
| `olea-europaea-subsp-cuspidata` | Catalogue explicitly references SANBI africana as alternate naming; same wild-olive research workstream, saved ID preserved. |
| `salvia-rosmarinus-rosmarinus-officinalis` | Catalogue explicitly gives Rosmarinus officinalis as alternate name of Salvia rosmarinus. One rosemary research workstream, two saved IDs; no new alias written. |

No taxonomy alias or species catalogue edit is made by this inventory. The same primary source link on two palette rows establishes a useful research starting point; it is not enough to change saved identities or copy cultivar quantities automatically.

| Live ID | Existing partial dossier | Existing usable context | Missing or incompatible production fields |
| --- | --- | --- | --- |
| `cajanus-cajan` | [pigeon-pea.json](../../../research/crop-sources/pigeon-pea.json); [runtime references](../../../research/perennial-sources/cajanus-cajan.json) | Original Mpumalanga cultivar-specific maturity/grain trial and tentative ARC Potchefstroom planting comparison now verified; retained DAFF planting/product context. | Trial references are cultivar/place/product specific. Actual cultivar, sowing date, applicable local picking window and farm quantity remain needed; generic age/yield/calendar are unset. |
| `lablab-purpureus` | [lablab.json](../../../research/crop-sources/lablab.json); [runtime references](../../../research/perennial-sources/lablab-purpureus.json) | Original Dalmada accession trial verifies paired physiological maturity and grain kg/ha, separately from forage biomass. | Food type, purchase availability, preparation and farm calibration need confirmation. Rongai cannot inherit early-accession performance; existing 2–6 t/ha dry fodder biomass never becomes food kg. |
| `lupinus-angustifolius` | [lupin.json](../../../research/crop-sources/lupin.json); [runtime references](../../../research/perennial-sources/lupinus-angustifolius.json) | Southern Cape sweet narrow-leaf Tanjil trial verifies actual sowing/harvest dates and measured grain; current supplier cultivar options are separate. | Sweet/bitter and food/feed qualification required. White-lupin material and adjusted harvest losses remain separate; old Tanjil trial does not calibrate current-cultivar edible kg or generic maturity. |

The three retained workstreams now have additional verified primary references in the shared production guidance; see [annual and identity closure](annual-and-identity-research-closure.md). Research references do not enter timed crop or edible kg calculations merely because their JSON exists. Generic production fields remain unset, and qualified farmer records remain the quantity authority.

## Remaining research workstreams: exact IDs and missing fields

The following **63 representative live IDs** have no dedicated perennial-production dossier or exact usable timed food authority in the current baseline. Their existing July/catalogue evidence is planting/food-use context; **H, F, B and Y remain absent from a dedicated production authority**, and cultivar/region, edible part, yield unit/density and any relevant C/P still need source review. For herbs, shrubs harvested for leaves, tea and flower-bud crops, replace tree-centric B/Y with the correct establishment, harvest cycle and native output unit; never force kg/tree. The category column is the existing catalogue stratum, not a new botanical lifecycle claim.

| Exact existing ID | Existing catalogue label | Catalogue stratum | Available research starting point |
| --- | --- | --- | --- |
| `euclea-undulata` | Small-leaved guarri | sub-canopy | [existing source link](https://pza.sanbi.org/euclea-undulata) — requires product-level verification |
| `olea-europaea-subsp-europaea` | Olive | sub-canopy | [existing source link](https://www.saolive.co.za/olive-growing/) — requires product-level verification |
| `morus-nigra` | Black mulberry | sub-canopy | [existing source link](https://www.gov.za/sites/default/files/gcis_document/202009/43726gon1003.pdf) — requires product-level verification |
| `sideroxylon-inerme` | White milkwood | canopy | [existing source link](https://pza.sanbi.org/sideroxylon-inerme) — requires product-level verification |
| `olea-europaea-subsp-africana` | Wild olive | sub-canopy | [existing source link](https://pza.sanbi.org/olea-europaea-subsp-africana) — requires product-level verification |
| `ziziphus-mucronata` | Buffalo thorn | sub-canopy | [existing source link](https://pza.sanbi.org/ziziphus-mucronata) — requires product-level verification |
| `schotia-afra-var-afra` | Karoo boer-bean | sub-canopy | [existing source link](https://pza.sanbi.org/schotia-afra-var-afra) — requires product-level verification |
| `portulacaria-afra` | Spekboom | shrub | [existing source link](https://sti-portal.fao.org/innovations/spekboom-portulacaria-afra-planting-within-riplines-thicket-biome-restoration) — requires product-level verification |
| `osteospermum-moniliferum` | Bietou / bush-tick berry | shrub | [existing source link](https://pza.sanbi.org/osteospermum-moniliferum) — requires product-level verification |
| `carpobrotus-deliciosus` | Sour fig | groundcover | [existing source link](https://pza.sanbi.org/carpobrotus-deliciosus) — requires product-level verification |
| `tulbaghia-violacea` | Wild garlic | herb | [existing source link](https://pza.sanbi.org/tulbaghia-violacea) — requires product-level verification |
| `rhoicissus-digitata` | Baboon grape | climber | [existing source link](https://pza.sanbi.org/rhoicissus-digitata) — requires product-level verification |
| `searsia-lancea-rhus-lancea` | Karee | canopy | [existing source link](https://pza.sanbi.org/searsia-lancea) — requires product-level verification |
| `diospyros-lycioides` | Bluebush / bloubos | shrub | [existing source link](https://pza.sanbi.org/diospyros-lycioides) — requires product-level verification |
| `grewia-robusta` | Karoo crossberry / kruisbessie | shrub | [existing source link](https://pza.sanbi.org/grewia-robusta) — requires product-level verification |
| `boscia-albitrunca` | Shepherd's tree / witgat | sub-canopy | [existing source link](https://pza.sanbi.org/boscia-albitrunca) — requires product-level verification |
| `ehretia-rigida` | Puzzle bush / deurmekaarbos | shrub | [existing source link](https://pza.sanbi.org/ehretia-rigida) — requires product-level verification |
| `carissa-haematocarpa` | Karoo num-num / karoo-noemnoem | shrub | July palette/catalogue context; no sufficient primary production source identified here |
| `cydonia-oblonga` | Quince / kweper | shrub | July palette/catalogue context; no sufficient primary production source identified here |
| `pistacia-vera` | Pistachio / pistakieneut | sub-canopy | July palette/catalogue context; no sufficient primary production source identified here |
| `citrullus-lanatus-landrace-var-citroides` | Tsamma / Kalahari melon / karkoer | groundcover | [existing source link](https://pza.sanbi.org/citrullus-lanatus) — requires product-level verification |
| `berchemia-discolor` | Brown ivory (motsintsila) | canopy | [existing source link](https://pza.sanbi.org/berchemia-discolor) — requires product-level verification |
| `carissa-bispinosa` | Num-num / forest num-num | shrub | [existing source link](https://pza.sanbi.org/carissa-bispinosa) — requires product-level verification |
| `grewia-flava` | Brandybush / velvet raisin | shrub | [existing source link](https://pza.sanbi.org/grewia-flava) — requires product-level verification |
| `momordica-balsamina` | Nkaka / balsam pear | climber | [existing source link](https://pza.sanbi.org/momordica-balsamica) — requires product-level verification |
| `rhoicissus-tridentata` | Bushman's grape | climber | [existing source link](https://pza.sanbi.org/rhoicissus-tridentata) — requires product-level verification |
| `mimusops-afra` | Coastal red milkwood | sub-canopy | [existing source link](https://pza.sanbi.org/mimusops-caffra) — requires product-level verification |
| `coffea-arabica` | Arabica coffee | shrub | July palette/catalogue context; no sufficient primary production source identified here |
| `ficus-sur` | Broom cluster fig / umKhiwane | canopy | [existing source link](https://pza.sanbi.org/ficus-sur) — requires product-level verification |
| `barringtonia-racemosa` | Powder-puff tree / iBoqo | sub-canopy | [existing source link](https://pza.sanbi.org/barringtonia-racemosa) — requires product-level verification |
| `searsia-natalensis` | Natal currant | shrub | [existing source link](https://pza.sanbi.org/searsia-natalensis) — requires product-level verification |
| `ananas-comosus` | Pineapple | herb | July palette/catalogue context; no sufficient primary production source identified here |
| `asystasia-gangetica-subsp-micrantha` | Creeping foxglove | groundcover | [existing source link](http://redlist.sanbi.org/species.php?species=3885-4) — requires product-level verification |
| `basella-alba` | Malabar spinach | climber | July palette/catalogue context; no sufficient primary production source identified here |
| `prunus-armeniaca` | Apricot | sub-canopy | [existing source link](https://www.hortgro.co.za/wp-content/uploads/docs/dlm_uploads/2022/08/KEY-DECIDUOUS-FRUIT-STATSISTICS-2021.pdf) — requires product-level verification |
| `prunus-dulcis` | Almond | sub-canopy | July palette/catalogue context; no sufficient primary production source identified here |
| `ceratonia-siliqua` | Carob | canopy | [existing source link](https://www.feedipedia.org/node/320) — requires product-level verification |
| `searsia-undulata` | Kuni bush / koeniebos | shrub | July palette/catalogue context; no sufficient primary production source identified here |
| `lycium-ferocissimum` | Kriedoring / Cape boxthorn | shrub | [existing source link](https://pza.sanbi.org/lycium-ferocissimum) — requires product-level verification |
| `tetragonia-fruticosa` | Kinkelbossie | groundcover | [existing source link](https://pza.sanbi.org/tetragonia-fruticosa) — requires product-level verification |
| `trachyandra-ciliata` | Veldkool | herb | [existing source link](https://pza.sanbi.org/trachyandra-ciliata) — requires product-level verification |
| `pyrus-communis` | Pear | sub-canopy | [existing source link](https://www.hortgro.co.za/wp-content/uploads/docs/dlm_uploads/2022/08/KEY-DECIDUOUS-FRUIT-STATSISTICS-2021.pdf) — requires product-level verification |
| `prunus-avium` | Sweet cherry | sub-canopy | July palette/catalogue context; no sufficient primary production source identified here |
| `phoenix-dactylifera` | Date palm | canopy | July palette/catalogue context; no sufficient primary production source identified here |
| `ficus-cordata` | Namaqua rock fig | canopy | [existing source link](https://pza.sanbi.org/ficus-cordata) — requires product-level verification |
| `euclea-pseudebenus` | Gariep ebony / ebbehout | sub-canopy | [existing source link](https://pza.sanbi.org/euclea-pseudebenus) — requires product-level verification |
| `aloidendron-dichotomum` | Quiver tree / kokerboom | sub-canopy | [existing source link](https://pza.sanbi.org/aloidendron-dichotomum) — requires product-level verification |
| `lycium-cinereum` | Kriedoring / honey-thorn | shrub | [existing source link](https://pza.sanbi.org/lycium-ferocissimum) — requires product-level verification |
| `tetragonia-decumbens` | Dune spinach / kinkelbossie | groundcover | [existing source link](https://pza.sanbi.org/tetragonia-decumbens) — requires product-level verification |
| `mesembryanthemum-crystallinum` | Ice plant / brakslaai | groundcover | [existing source link](https://pza.sanbi.org/mesembryanthemum-crystallinum) — requires product-level verification |
| `aponogeton-distachyos` | Waterblommetjie / Cape pondweed | herb | [existing source link](https://pza.sanbi.org/aponogeton-distachyos) — requires product-level verification |
| `searsia-lucida` | Glossy currant / blinktaaibos | shrub | [existing source link](https://pza.sanbi.org/searsia-lucida) — requires product-level verification |
| `morella-cordifolia` | Waxberry / wasbessie | shrub | [existing source link](https://pza.sanbi.org/morella-cordifolia) — requires product-level verification |
| `aspalathus-linearis` | Rooibos | shrub | [existing source link](https://pza.sanbi.org/aspalathus-linearis) — requires product-level verification |
| `cyclopia-genistoides` | Honeybush / heuningbos | shrub | [existing source link](https://pza.sanbi.org/cyclopia-genistoides) — requires product-level verification |
| `salvia-rosmarinus` | Rosemary | shrub | July palette/catalogue context; no sufficient primary production source identified here |
| `cynara-cardunculus-var-scolymus` | Globe artichoke | herb | July palette/catalogue context; no sufficient primary production source identified here |
| `acca-sellowiana` | Feijoa / pineapple guava | shrub | July palette/catalogue context; no sufficient primary production source identified here |
| `trema-orientalis` | Pigeonwood / umbengele | sub-canopy | [existing source link](https://pza.sanbi.org/trema-orientalis) — requires product-level verification |
| `rhamnus-prinoides` | Dogwood / umglindi | shrub | [existing source link](https://pza.sanbi.org/rhamnus-prinoides) — requires product-level verification |
| `coleus-esculentus` | Livingstone potato / umbondwe | herb | [existing source link](https://pza.sanbi.org/coleus-esculentus) — requires product-level verification |
| `zingiber-officinale` | Ginger | herb | July palette/catalogue context; no sufficient primary production source identified here |
| `centella-asiatica` | Pennywort / gotu kola / varkoortjies | groundcover | [existing source link](https://pza.sanbi.org/) — requires product-level verification |

`citrullus-lanatus-landrace-var-citroides` is a landrace/end-use workstream, not another fruit tree. The two Carpobrotus IDs are distinct catalogue species. `barringtonia-racemosa`, `portulacaria-afra`, `morella-cordifolia`, `rhamnus-prinoides` and similar food-tagged plants need exact edible-part/end-use review before a calendar means food for people. Tea, medicinal use, wax, fodder and wildlife fruit must not silently become the same household-food kilogram. A food tag alone is insufficient for a safe recipe or species-wide processing claim.

## Evidence present that must not be promoted into false production dates

- The catalogue mentions July–September flowering for `trachyandra-ciliata`, whose food part is an unopened bud/stalk. The primary page needs checking for the actual picking stage before constructing a window.
- `ehretia-rigida` and `aloidendron-dichotomum` have flowering-month context in source strings. A bloom window is not proof of ripe edible fruit or a household honey harvest.
- `basella-alba` has a January–March sentence in the palette narrative, backed there by supplier/secondary links rather than a primary local production calendar. That prose is not a verified KZN picking window.
- Olive temperature/chilling context in the palette is not an olive-harvest window. The existing manual factcheck explicitly says its almond seasonal wording was not rechecked online; it cannot populate a new month array.
- The July exercise includes some newspaper, generic horticulture and tertiary references. These remain useful leads but cannot establish new yields, months or purchasing recommendations under the primary-source rule.

## Other evidence repositories and nationwide limits

Of the 37 top-level crop-research JSON files, 20 keys are present in CROPS and 17 are deliberately research-only: `buckwheat`, `cassava`, `cereal-rye`, `chinese-cabbage`, `ethiopian-kale`, `grazing-vetch`, `jack-bean`, `jute-mallow`, `lablab`, `leaf-rape`, `leeks`, `lupin`, `okra`, `pearl-millet`, `pigeon-pea`, `spring-onion`, `velvet-bean`. Not all are existing SPECIES food entries, so they are not added to the 122-row denominator. Many contain explicit partial/unsourced verdicts or biomass instead of edible yield. Twenty-nine original crops have variety JSONs; the eight-zone climate test checks the catalogue column and heat/frost gates, not eight independent crop calendars or national fruit suitability.

All 15 existing animal enterprises have source dossiers in [animal-sources](../../../research/animal-sources), separate from the plant denominator. That establishes product/care/reference coverage; housing does not establish animal counts, milk lactation months, fish batches, honey flows or measured output. Exact expected/actual records can add native-unit quantities. Species or product illustrations do not establish a validated farm budget.

For a local forecast the single authorities remain: site survey for actual location/frost/chilling/soil/water and purchase candidates; mapped design for plant identity/status/count; production plan for cultivar actually selected, planting/establishment cohorts, confirmed picking months and entered age-yield/expected/actual records; stock record for exact observed kept-food date and amount. A regional reference must never overwrite those local facts. Unknown climate continues to suppress assumed regional bars. No arbitrary nationwide fallback is justified by this inventory.

## Gap-closing order authorised by the user

1. Add real primary-source dossiers for existing major orchard identities first: pear, apricot, almond, pistachio, sweet cherry, date palm, cultivated olive, black mulberry, quince, carob, feijoa, coffee and pineapple. Keep country/region/cultivar/first-pick qualifiers; only numeric facts stated by the source or a fully documented same-source conversion enter numeric fields.
2. Review the eight identity/composite rows against primary botany and existing product evidence, without changing canonical species names or saved map records. Any compatibility mapping is separate reviewable code work.
3. Close remaining indigenous fruit and herb/tea/leaf product evidence using exact edible part and native units. Explicit nulls and an honest search record are valid where primary evidence does not exist; a generic zero, foreign calendar or mature-yield ramp is not.
4. Reconcile every newly verified dossier through the existing generator and shared app/PDF authority, then rerun visual/functional checks. The current inventory does not claim the next additions are already implemented.

## Reproduction and audit checks

Performed read-only module imports on Node 24, exact ID set comparisons and `git ls-tree` at the listed revisions; verified JSON/data parity and every food row assigned exactly once to the five disjoint buckets. No private data or secrets were read. This document is a source coverage audit, not new agricultural advice. Earlier focused implementation checks (51 perennial/sample tests) remain evidence for wiring; this read-only inventory has not changed the app picture.

## Assigned dossier closure — 11 October 2026

This section records work after the baseline inventory above; it does not replace that dated baseline or claim every numeric field is now known.

The guidance lane added all 11 assigned major orchard dossiers: `pyrus-communis`, `prunus-armeniaca`, `prunus-dulcis`, `pistacia-vera`, `phoenix-dactylifera`, `olea-europaea-subsp-europaea`, `morus-nigra`, `cydonia-oblonga`, `ceratonia-siliqua`, `acca-sellowiana` and `coffea-arabica`. They contain source-qualified food-part, regional/cultivar, care and buying guidance, with supplementary references preserved for the generated app/PDF record. Seven have ten qualified picking references. Unsupported first/full-bearing ages and mature kg remain null; almond cultivar production and pistachio project expectations remain contextual citations rather than universal yield curves.

The same lane added the first 25 remaining workstreams in table order, excluding those major orchard identities:

`euclea-undulata`, `sideroxylon-inerme`, `olea-europaea-subsp-africana`, `ziziphus-mucronata`, `schotia-afra-var-afra`, `portulacaria-afra`, `osteospermum-moniliferum`, `carpobrotus-deliciosus`, `tulbaghia-violacea`, `rhoicissus-digitata`, `searsia-lancea-rhus-lancea`, `diospyros-lycioides`, `grewia-robusta`, `boscia-albitrunca`, `ehretia-rigida`, `carissa-haematocarpa`, `citrullus-lanatus-landrace-var-citroides`, `berchemia-discolor`, `carissa-bispinosa`, `grewia-flava`, `momordica-balsamina`, `rhoicissus-tridentata`, `mimusops-afra`, `ficus-sur` and `barringtonia-racemosa`.

Every added workstream supplies an exact edible-part verdict and source-backed guidance. This is a completed evidence review, not a claim that every plant has an agronomic trial, monthly household yield or named commercial cultivar.

| Newly retained seasonal reference | Limit that survives into the dossier |
|---|---|
| Karoo boer-bean: May–June seed production | Source explicitly permits green or mature seed; not a measured food yield or sowing calendar. |
| Wild garlic: January–April edible flowers | Source flowering interval applies to edible flowers only; leaf picking remains undated. |
| Baboon grape: March–August ripe berries | Source says ripen; a botanical regional reference, not confirmed farm picking. |
| Broom cluster fig: approximately December ripe figs | September–March production is not copied into ripe-picking months. |

For the other 21 indigenous dossiers, source descriptions of fruit appearing, persisting, being produced, or following flowers are retained as context where present and are not automatically assigned as ripe-food windows. All 25 keep numeric first-food age, full-bearing age, mature food kg and numeric chilling unknown. Germination weeks, vegetative growth, plant lifespan, flower-to-fruit development and shade age are not substituted for those fields. Karee, bluebush and puzzle bush explicitly retain separate male/female plant requirements.

The food gate is explicit. Twenty-two are `confirmed-food` for the specified edible part. Three are `specialist-review`: [mixed tsamma/makataan/karkoer identity](https://pza.sanbi.org/citrullus-lanatus), [Momordica balsamina toxicity conflict](https://pza.sanbi.org/momordica-balsamica), and [Barringtonia racemosa young-leaf claim alongside poisonous parts](https://pza.sanbi.org/barringtonia-racemosa). They remain mapped inventory with the sourced explanation; ordinary household-food availability/counts must exclude them. Bushman's grape retains edible berries while explicitly excluding its reported poisonous roots. No medicinal recipes or fish-poison use become production instructions.

A further identity bridge was found: [SANBI's 2023 Carissa bispinosa assessment](https://redlist.sanbi.org/species.php?species=984-2) lists `Carissa haematocarpa` among its synonyms. Both existing catalogue IDs/names are preserved. The haematocarpa dossier records that identity rather than inventing an independent Karoo cultivar, frost threshold or picking season. Thus the baseline's 63 missing workstreams are not 63 independent perennial species.

Source access limits are recorded honestly. PlantZAfrica direct requests in this audit returned HTTP 403, while indexed primary SANBI page content supplied the checked passages. Each affected dossier states this; no claim of a successful direct fetch is made. Primary university research and SANBI taxonomy provide supplementary context where useful. Current protected-tree collection requirements are left for a separate local/legal check instead of presenting old botanical-page law wording as current permission.

Validation for this lane: all 36 new JSONs parse; all 25 indigenous identities exactly match the existing catalogue; every added indigenous dossier has non-empty cited guidance, valid unique month arrays where supplied, explicit food status and null unsupported numeric fields. The per-source verbatim quotation allowance was checked. `git diff --check` is clean. Generator reconciliation, integrated tests, complete coverage totals and final visual/release evidence are owned by the parent audit and must be filled after all lanes freeze.
