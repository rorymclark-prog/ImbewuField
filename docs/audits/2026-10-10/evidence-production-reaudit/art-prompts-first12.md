# First 12 painted fruit assets — generation and QA

Generated 10 October 2026 with the built-in image_gen tool, one distinct call per species. No repository AI route, API, paid rendering path or CLI image generator was used. Existing tomato and butternut PNGs were visually inspected as the style references. Species and product requirements come from docs/FRUIT-ART-BRIEF.md.

Original generated images remain in the generated_images directory. Sharp downsampled to 128 × 128, quantised to 256 colours without dithering, then re-encoded truecolour RGBA with alpha and lossless PNG compression. Adaptive PNG row filtering is disabled because it produces larger files after palette quantisation, without changing pixels. Every asset is below 25,000 bytes; no creative post-editing. The SVG placeholders are retained. Root owns species-art wiring.

Contact sheet: fruit-first12-contact.png shows each native 128 px icon plus 18, 24 and 36 px thumbnails.

| Asset | Bytes | Colours | Transparent fraction | Visible bounds (x1,y1,x2,y2) | Corner alpha |
|---|---:|---:|---:|---|---|
| carica-papaya | 11708 | 256 | 0.384 | 5, 5, 124, 123 | 0, 0, 0, 0 |
| carissa-macrocarpa | 9785 | 256 | 0.5246 | 8, 7, 120, 121 | 0, 0, 0, 0 |
| carpobrotus-edulis | 14716 | 256 | 0.3964 | 4, 5, 123, 121 | 0, 0, 0, 0 |
| carya-illinoinensis | 14206 | 256 | 0.3875 | 4, 7, 125, 120 | 0, 0, 0, 0 |
| citrus-limon | 12304 | 256 | 0.4642 | 3, 4, 122, 120 | 0, 0, 0, 0 |
| citrus-reticulata | 13074 | 256 | 0.3907 | 5, 10, 125, 117 | 0, 0, 0, 0 |
| dovyalis-afra | 10368 | 256 | 0.478 | 4, 16, 125, 114 | 0, 0, 0, 0 |
| englerophytum-magalismontanum | 11070 | 256 | 0.4954 | 3, 5, 125, 120 | 0, 0, 0, 0 |
| ficus-carica | 12054 | 256 | 0.4547 | 5, 6, 124, 120 | 0, 0, 0, 0 |
| fragaria-x-ananassa | 12516 | 256 | 0.4331 | 16, 2, 122, 124 | 0, 0, 0, 0 |
| garcinia-livingstonei | 10657 | 256 | 0.4807 | 5, 5, 123, 117 | 0, 0, 0, 0 |
| grewia-occidentalis | 11976 | 256 | 0.4378 | 10, 11, 118, 116 | 0, 0, 0, 0 |

## Pawpaw — carica-papaya

Destination: public/fruit-art/carica-papaya.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-afa925b7-d166-4d2a-8932-062ebec44778.png

Exact prompt:

Create one production-ready small calendar icon: harvested PAWPAW / PAPAYA (Carica papaya). One elongated, gently pear-shaped whole yellow-orange papaya with a natural green blush, next to a single cut half revealing saturated orange flesh and a central cavity of black round seeds. The whole and half together form one simple compact composition, no leaf or plant. A polished soft-shaded botanical produce illustration, natural rounded volume, subtly painted texture, the style of a realistic illustrated vegetable icon rather than a photo or flat vector. Upper-left soft diffuse illumination. Crisp clean botanical silhouette readable at 18 pixels. Three-quarter angle, centered, produce fills about 85–90% of square canvas. Actual transparent background, alpha transparency, clean edges. Absolutely no ground, surface, cast shadow, drop shadow, plate, basket, text, border or watermark. The only visible pixels are the produce. True PNG cutout.

## Num-num — carissa-macrocarpa

Destination: public/fruit-art/carissa-macrocarpa.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-e9bf1f18-5db9-4c74-974b-aac894fb09b8.png

Exact prompt:

Draw two harvested NUM-NUM fruits (Carissa macrocarpa): glossy scarlet red, plump oval fruits with slightly tapered ends, arranged on a very short green-brown stem. Show their oval silhouette clearly. No round cherry shape, no strawberry seed texture. A production-ready small calendar produce icon in the same family as softly painted realistic vegetable illustrations: natural rounded volume, subtle hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse light from upper left. Three-quarter angle. Simple compact composition centered in a square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background with clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Sour fig — carpobrotus-edulis

Destination: public/fruit-art/carpobrotus-edulis.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-e9a52bce-40b9-4345-8173-68860b20794a.png

Exact prompt:

Draw ONE harvested ripe SOUR FIG fruit (Carpobrotus edulis). The edible succulent fruit is a squat top-shaped fleshy capsule, straw-brown when ripe, wrinkled and softly leathery, with a clearly many-segmented radial upper surface and short pointed triangular remains of the calyx around its top. It is NOT an ordinary purple tree fig, NOT an artichoke, NOT a cactus. Show the characteristic short wide fleshy brown segmented fruit alone from three-quarter view. A production-ready small calendar produce icon in the same family as softly painted realistic vegetable illustrations: natural rounded volume, subtle hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse light from upper left. Three-quarter angle. Simple compact composition centered in a square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background with clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Pecan — carya-illinoinensis

Destination: public/fruit-art/carya-illinoinensis.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-b9c23c2a-3b65-458d-a2b6-b73b0d4e34bf.png

Exact prompt:

Draw harvested PECAN nuts (Carya illinoinensis). Two elongated oval pecans with smooth warm-brown shells and narrow darker longitudinal stripes. One shell is cracked open cleanly to show a pale golden, deeply grooved pecan kernel. The long narrow oval nut silhouette is essential, not round walnuts. Simple two-nut composition. A production-ready small calendar produce icon in the same family as softly painted realistic vegetable illustrations: natural rounded volume, subtle hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse light from upper left. Three-quarter angle. Simple compact composition centered in a square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background with clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Lemon — citrus-limon

Destination: public/fruit-art/citrus-limon.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-6205835b-143b-4b97-a7c6-2cc7ed971947.png

Exact prompt:

Draw ONE harvested LEMON (Citrus limon). Bright yellow ripe skin with delicate natural pores, an elongated oval shape tapering to the lemon's characteristic pointed nipple at each end. One small fresh green leaf on its short stem. Show the whole lemon diagonally, not sliced. Strong pointed oval lemon silhouette. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Soft citrus — citrus-reticulata

Destination: public/fruit-art/citrus-reticulata.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-4cf62469-628d-40b2-9221-7494e26a9168.png

Exact prompt:

Draw ONE harvested NAARTJIE / mandarin (Citrus reticulata). A ripe deep-orange flattened round fruit with clearly dimpled porous peel, a slightly indented top and a short stem bearing one small fresh green leaf. Broad low slightly oblate mandarin shape, not a tall orange or a lemon. Whole fruit only. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Kei apple — dovyalis-afra

Destination: public/fruit-art/dovyalis-afra.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-1a59067d-4040-4a72-bafa-a9056104be22.png

Exact prompt:

Draw TWO harvested KEI APPLES (Dovyalis afra). Small smoothly rounded plump apricot-yellow fruits, nearly spherical, with very slight natural mottling and a tiny brown dried blossom point. Two whole fruits simply arranged beside each other, one just behind the other. No red blush, no conventional apple lobes, no long stems or leaves. Smooth yellow round kei apples. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Transvaal milkplum — englerophytum-magalismontanum

Destination: public/fruit-art/englerophytum-magalismontanum.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-dadd321f-0e6b-4523-b4db-f5d3736a8caa.png

Exact prompt:

Draw harvested TRANSVAAL MILKPLUM / STAMVRUG (Englerophytum magalismontanum). A compact cluster of exactly three glossy deep-red oval fruits growing directly from a very short piece of brown woody branch. Fruit plump elongated oval, scarlet to wine-red, smooth natural skin. The direct-on-branch growth and the three elongated fruits are essential. No grape bunch, no long cherry stalks, no leaves or whole plant. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Fig — ficus-carica

Destination: public/fruit-art/ficus-carica.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-8c2e82a1-eb48-4624-ba3c-8f388ef58632.png

Exact prompt:

Draw harvested FIGS (Ficus carica): one whole plump purple fig with a short green stem and a graceful narrowing neck, next to a half cut lengthwise showing rich pink-red seedy flesh surrounded by a thin pale rim. Two simple overlapping shapes. Distinct purple pear-shaped fig silhouette and pink seedy interior. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Strawberry — fragaria-x-ananassa

Destination: public/fruit-art/fragaria-x-ananassa.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-358a779b-f118-4ab2-99e4-6a2dadab1701.png

Exact prompt:

Draw ONE harvested ripe STRAWBERRY (Fragaria × ananassa). A red heart-shaped strawberry tapering to a rounded point, dotted with small yellow seeds recessed in its bright-red textured surface, topped by a compact fresh green star-like leafy calyx. Whole berry only, diagonal three-quarter angle, no sliced berry. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## African mangosteen — garcinia-livingstonei

Destination: public/fruit-art/garcinia-livingstonei.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-b0390123-c830-4445-b16a-1ffc663658ec.png

Exact prompt:

Draw harvested AFRICAN MANGOSTEEN / IMBE (Garcinia livingstonei). Exactly three small round ripe bright-orange fruits in a compact cluster on a short brown-green stem. Smooth softly glossy orange skin and small green calyx at the stem ends. The fruit are rounded orange imbe, NOT purple mangosteens, NOT cherries, not a large orange with oversized leaf. No extra leaves. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Cross-berry — grewia-occidentalis

Destination: public/fruit-art/grewia-occidentalis.png

Generated original: /Users/roryclark/.codex/generated_images/01a124f8-d7ff-7f60-87ac-dc303a5569b1/exec-3e0da783-ba40-4b83-a9f8-9cfa0f90d621.png

Exact prompt:

Draw ONE harvested CROSS-BERRY (Grewia occidentalis). The ripe fruit is a single compact reddish-brown FOUR-LOBED berry: four distinct rounded plump lobes joined around one small central stalk, seen from a slightly elevated three-quarter angle so the cross-like four-lobed silhouette is unmistakable. Glossy reddish-brown skin with warm copper undertones. Show exactly four connected fruit lobes, not four separate berries, not a raspberry with many tiny drupelets, no flowers or leaves. This distinctive cross-shaped fruit must read at thumbnail size. A production-ready small calendar produce icon matching softly painted realistic vegetable illustrations: natural rounded volume, subtly hand-painted texture, precise botanical silhouette, no black outline, neither a photograph nor a flat vector. Soft diffuse upper-left light. Three-quarter angle. Simple compact composition centered square, fills 85–90% of frame, readable at 18 pixels. Genuine transparent PNG background and clean alpha edges. No ground, surface, cast shadow, drop shadow, plate, basket, text, label, border, watermark, flower or whole plant. Only the described harvested product is visible.

## Completed visual QA

Viewed fruit-first12-contact.png after export, containing every native 128 px asset and its 18/24/36 px thumbnails. Checked the produce silhouettes against the brief: yellow-green whole/half papaya and seeds; two scarlet oval num-num; ripe straw-brown segmented sour fig; striped elongated pecan shell and kernel; pointed lemon; flattened naartjie; two smooth yellow kei apples; three oval stamvrug growing directly on a short branch; purple fig plus pink seedy half; seeded red strawberry with green calyx; three orange imbe; and exactly four joined cross-berry lobes. All twelve remain distinct at 18 px and have clean transparent backgrounds without cast shadows. The PNG IHDR colour type is 6 (truecolour RGBA) for every output. No species, production facts, code wiring or SVG fallback was changed.
