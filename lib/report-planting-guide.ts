/** New generation choices consolidate overlapping chapters. Saved settings/text stay intact. */
export const PLANTING_SUITABILITY_SECTION = 'Suitable Plants for This Site';
const PREVIOUS_PLANTING_SECTIONS = new Set(['Fruit, Nut & Berry Trees', 'Indigenous Trees', 'Agroecosystem Planting Guide']);
export function reportSectionsForGeneration(sections: readonly string[]): string[] {
  return [...new Set(sections.map(section => PREVIOUS_PLANTING_SECTIONS.has(section) ? PLANTING_SUITABILITY_SECTION : section))];
}
export const PLANTING_SUITABILITY_PROMPT = `## Suitable Plants for This Site

Write a concise, evidence-based assessment in the following three subsections. This is the site's planting strategy. Detailed bed allocations, quantities, rotations and buying tasks belong in the separate crop-plan report. Do not repeat the sowing calendar. Propose no listed alien invasive plant, even if it appears in a saved design or a broad biome description; a saved plant is not a new-planting recommendation.

### Vegetables, staples and herbs
Assess the crops actually recorded in the saved plan. Group only where the same reasoning applies. Explain which recorded conditions support the choice and which conditions or missing evidence limit it. Consider season and temperature, reliable water, soil and drainage, available growing space/sunlight, labour and the household or organisation's food needs. A crop in a saved plan is a proposal, not proof of suitability. Flag conflicts rather than manufacture a justification. If no plan is recorded, identify priorities and evidence needed without inventing a saved crop plan.

### Fruit, nuts and berries
Include indigenous food plants here where justified. Provide a selective shortlist appropriate to the available site space and goals; do not fill a quota of fruit or nut species. Explain each plant's purpose, evidence for fit, proposed position and important establishment/maintenance conditions. Only give mature size, root clearance, pollination needs, chill requirements, first-bearing time, variety or quantities where supported by trusted information or the supplied records. A regional minimum temperature does not establish chill hours or absence of frost. Label unsupported local requirements as needing confirmation.

### Useful indigenous plants
Consider trees, shrubs, grasses, groundcovers and climbers for identified needs: shade, wind shelter, pollinator habitat, erosion protection, mulch, screening or documented cultural uses. Local occurrence and suitability need checking against the specific site, not just nationality or a biome label. Indigenous status does not prove drought tolerance, nitrogen fixation, edibility or safety. Do not recommend medicinal use or assert unverified species functions. For a crèche/school, consider children's activity areas, mature size, access and relevant plant-specific thorns or toxicity.

Use short rows: Plant or crop group | Why it fits / evidence | Position or role | Conditions to check. Keep unknowns explicit. Cite only real references you can identify accurately; never invent a source or claim a field/laboratory check happened. Separate site observations, regional estimates and recommendations. Consult the supplied farmer/mentor experience rather than replace it with generic regional claims.

Give each plant one main entry: an indigenous fruit tree belongs in the food group and can carry shade/habitat as secondary uses. Refer back to those entries from windbreak, guild and zone sections. Natural Vegetation & Biome describes existing communities and what to retain/restore; it must not duplicate this proposed planting list.\n`;
