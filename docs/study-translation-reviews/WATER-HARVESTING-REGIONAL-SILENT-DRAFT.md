# Water Harvesting regional silent slide draft

This is an unreviewed machine-draft deck for Sesotho (`st`), Tshivenda (`ve`) and standard
written Xitsonga (`ts`). It contains all 24 slides from the English source. Each frame keeps the
existing illustrated English slide and the exact English narration beside the regional draft or
English hold. The deck is silent by default; learners may choose the existing English narration.
No regional audio is claimed or registered.

Only the ordinary sentence on slide 10, “Rainfall seasons differ across South Africa,” is drafted:

- Sesotho: `Dihla tsa dipula di fapana ho pholletsa le Afrika Borwa.`
- Tshivenda: `Zwifhinga zwa mvula zwi a fhambana kha Afrika Tshipembe.`
- Xitsonga: `Tinguva ta mpfula ta hambana eAfrika Dzonga.`

These regional lines are candidates, not approved translations. A fluent first-language reviewer
should confirm local phrasing and the country name before approval. The rest of slide 10 remains
exact English, including local rainfall records, drought planning, and authorisation checks.

All other headings and narration passages remain exact English. They include site and earthwork
design; runoff, soil, slope, overflow and neighbour effects; dam and spillway design; tank sizing,
first-flush and water-quality guidance; potable-water and food-crop safety; greywater sources,
local rules and sanitation advice; and the A-frame field assignment. These statements can change
what a farmer builds or how water is used, so no regional wording is supplied for them here.

No figures, species, farming recommendations, or lesson wording were added or changed. The
illustrated source images and exact English text remain source-paired on every frame. The images
are concepts, not construction or farm designs.

Regenerate the learner frames, contact sheets, 390px phone samples, checksums and byte counts with:

```sh
python3 docs/media/water-harvesting/render-regional-paired.py
node scripts/gen-asset-sizes.mjs
```

Review the contact sheets and phone samples under `docs/media/water-harvesting/qa/`. No fluent
language, farming, engineering, water-safety or sanitation review has been completed for this
deck.
