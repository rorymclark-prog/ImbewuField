// Visual direction for the 33 lesson infographics — one authored subject per lesson.
//
// WHY THIS IS DATA, NOT A PROMPT STRING SOMEWHERE: these are illustration briefs for training
// material shown to farmers, so they need reviewing, diffing and correcting like any other
// content. Keeping them here means a change is a code review, not a lost chat message.
//
// EVERY SUBJECT IS DELIBERATELY SPECIES-FREE. Plants are described by SHAPE or ROLE — "a climbing
// vine on a pole", "generic leaf and canopy shapes" — never by name. South Africa's NEMBA
// regulations make certain species illegal to propagate, so an illustration that reads as a
// recognisable listed invasive is a legal problem, not a style preference. Two modules (Plant
// Guilds, Food Forest) are marked `hold` for exactly this reason: those lessons are ABOUT species
// accuracy, which makes illustration the wrong medium — they need real photographs.
//
// Kept as reviewable source data for the human brief and any future image-production workflow,
// so the same direction is applied whether an image is generated or made by hand.

export interface CourseImageBrief {
  lessonId: string;
  moduleId: string;
  /** What the picture shows. Species-free by construction — see the note above. */
  subject: string;
  /** True where illustration is the wrong medium and a real photograph is required instead. */
  hold?: boolean;
  /** Why it is held, in words a non-engineer can act on. */
  holdReason?: string;
}

/**
 * The house rules, prepended to every generated image prompt.
 *
 * Rule 3 (southern hemisphere) is stated first and bluntly because image models default to
 * northern-hemisphere lighting every single time; in South Africa the sun is in the NORTH and
 * shadows fall SOUTH, and a sun-path diagram that gets this backwards teaches the opposite of
 * the lesson.
 */
export const IMAGE_RULES = [
  'Illustration for a permaculture training card for South African smallholder farmers.',
  'Many readers have low literacy and read isiZulu first, on entry-level Android phones.',
  '',
  'Hard requirements, all of them, every time:',
  '- SOUTHERN HEMISPHERE: the sun is in the NORTH and shadows fall SOUTH. Never the reverse.',
  '- NO TEXT ANYWHERE: no labels, numbers, lettering, captions or watermarks. The app adds its own',
  '  text and it must be translatable into isiZulu later; anything drawn in cannot be translated.',
  '- NO IDENTIFIABLE PLANT SPECIES: generic leaf, canopy and root shapes only.',
  '- PLAIN FLAT BACKGROUND: no landscape behind the subject, no scene clutter. One idea per image.',
  '- READABLE SMALL: viewed about 8cm wide on a phone. Thick lines, high contrast, few elements.',
  '',
  'Style: simple, warm, instructional. Flat illustration — not photorealistic, not 3D.',
  'Earth tones: ochre, terracotta, warm brown, olive and sage green. Clear blue for water only.',
  'Confident dark outlines. Landscape orientation. No borders.',
].join('\n');

export const COURSE_IMAGE_BRIEFS: CourseImageBrief[] = [
  { lessonId: 'seeds-sovereignty-l1', moduleId: 'seeds-sovereignty', subject: 'Two seed packets side by side: one leading to a row of five identical plants, the other to a row of five mixed, uneven plants. Shapes only, no species.' },
  { lessonId: 'seeds-sovereignty-l2', moduleId: 'seeds-sovereignty', subject: 'Split panel. Left: pods drying on a plant, then an opened pod and a bowl of collected seed. Right: wet seed and pulp in a jar of water with a film forming on the surface, then rinsed seed drying on a cloth.' },
  { lessonId: 'seeds-sovereignty-l3', moduleId: 'seeds-sovereignty', subject: 'Paper envelopes inside a closed container, their labels shown as blank ruled lines rather than readable words, with icons for cool, dark and dry beside it. Ten seeds on a damp cloth, some sprouted, as a germination test.' },

  { lessonId: 'vegetables-staples-l1', moduleId: 'vegetables-staples', subject: 'A rectangular raised bed at an angle with a person reaching comfortably to the middle from the side, and a dimension line across the width. Clear paths on both sides.' },
  { lessonId: 'vegetables-staples-l2', moduleId: 'vegetables-staples', subject: 'One bed shown as three panels over time: a fast crop harvested, then a second sowing going in beside a slower crop still growing. Generic leaf shapes only.' },
  { lessonId: 'vegetables-staples-l3', moduleId: 'vegetables-staples', subject: 'Three generic staple forms grouped together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below ground in cutaway.' },
  { lessonId: 'vegetables-staples-l4', moduleId: 'vegetables-staples', subject: 'A leaf with a small pest on it, and beside it three non-chemical responses as icons: a beneficial insect, a physical barrier, and a hand picking the pest off.' },

  { lessonId: 'soil-health-l1', moduleId: 'soil-health', subject: 'A spade-cut through the ground showing dark crumbly topsoil above pale subsoil, with worm channels. Beside it, a glass jar with three settled layers of sand, silt and clay.' },
  { lessonId: 'soil-health-l2', moduleId: 'soil-health', subject: 'A compost heap in cross-section with alternating dry-brown and fresh-green layers, a curved arrow showing turning, and faint heat lines rising from the middle.' },
  { lessonId: 'soil-health-l3', moduleId: 'soil-health', subject: 'Two soil surfaces side by side under the same sun: one bare and cracked, one under thick mulch staying dark and moist.' },

  { lessonId: 'water-harvesting-l1', moduleId: 'water-harvesting', subject: 'Cross-section through a slope showing a shallow ditch on the contour with a raised mound below it, arrows showing water slowing, spreading and soaking sideways into the soil.' },
  { lessonId: 'water-harvesting-l2', moduleId: 'water-harvesting', subject: 'A small farm dam in cross-section: inflow, the stored body of water, a spillway at the top edge, and a planted bank. Simple, no wildlife.' },
  { lessonId: 'water-harvesting-l3', moduleId: 'water-harvesting', subject: 'A roof with a gutter feeding a downpipe into a cylindrical tank, with a small first-flush diverter branching off before the tank. Flow arrows throughout.' },
  { lessonId: 'water-harvesting-l4', moduleId: 'water-harvesting', subject: 'A house in cutaway with a pipe from an indoor basin running to a buried line that feeds a mulched planting basin. The line is clearly underground, never an open channel.' },

  { lessonId: 'intro-permaculture-l1', moduleId: 'intro-permaculture', subject: 'Three linked circles of equal size, each holding one icon: a hand cupping soil, two simple human figures, and a basket passing between two pairs of hands. Equal weight, none dominant.' },
  { lessonId: 'intro-permaculture-l2', moduleId: 'intro-permaculture', subject: 'A wheel of twelve simple icon segments around a central seedling: an eye for observation, a droplet for catching water, a sun for energy, a loop arrow for waste returning. Icons only.' },
  { lessonId: 'intro-permaculture-l3', moduleId: 'intro-permaculture', subject: 'Concentric rings spreading out from a small house: the nearest ring intensely tended, each ring outward progressively wilder. Rings clearly separated, no plant detail.' },

  { lessonId: 'reading-landscape-l1', moduleId: 'reading-landscape', subject: 'A hillside from the side with arrows showing rain running downslope, pooling in a hollow, and soaking in where the ground flattens. Water in blue, ground in earth tones.' },
  { lessonId: 'reading-landscape-l2', moduleId: 'reading-landscape', subject: 'A slope in cross-section with the sun in the NORTH sky and shadows falling SOUTH behind a building and a tree canopy. North marked with an arrow.' },
  { lessonId: 'reading-landscape-l3', moduleId: 'reading-landscape', subject: 'A farm from above with three overlaid arrow sets in different colours: prevailing wind, cold air draining downhill into a frost hollow, and the direction of the slope.' },
  { lessonId: 'reading-landscape-l4', moduleId: 'reading-landscape', subject: 'A hand-drawn-style site map on paper: north arrow, a simple building outline, a water line, a boundary. Deliberately rough, as if a farmer drew it.' },

  { lessonId: 'small-livestock-l1', moduleId: 'small-livestock', subject: 'A moveable chicken pen shown in two positions on a strip of ground, the vacated patch scratched over and enriched, with an arrow showing the move.' },
  { lessonId: 'small-livestock-l2', moduleId: 'small-livestock', subject: 'A hive box in cross-section with stacked frames, and a foraging radius drawn as a wide circle over a simple farm plan.' },
  { lessonId: 'small-livestock-l3', moduleId: 'small-livestock', subject: 'A closed loop of four icons with arrows between them: animal, manure, compost, growing area, returning to animal feed.' },

  { lessonId: 'market-community-l1', moduleId: 'market-community', subject: 'A simple ruled record sheet with columns, the handwriting suggested by wavy lines rather than readable words, and a small pile of harvested produce beside it.' },
  { lessonId: 'market-community-l2', moduleId: 'market-community', subject: 'Three selling routes as icons with arrows from one farm: a roadside stall, a group delivery to a shop, and a box going directly to a household.' },
  { lessonId: 'market-community-l3', moduleId: 'market-community', subject: 'Five small farms linked by lines to a shared central point, with one larger combined crate at the centre.' },

  { lessonId: 'plant-guilds-l1', moduleId: 'plant-guilds', hold: true, holdReason: 'This lesson is about which plants fix nitrogen — species accuracy is the point, so it needs a real photograph, not an illustration.', subject: 'A plant with its root system exposed, small round nodules on the roots, and arrows showing nitrogen moving into the surrounding soil.' },
  { lessonId: 'plant-guilds-l2', moduleId: 'plant-guilds', hold: true, holdReason: 'Names specific mulch and pest-control plants — needs photographs.', subject: 'A broad-leaved plant being cut back, its cut leaves dropped as mulch around a neighbouring plant, with an arrow from cut to ground.' },
  { lessonId: 'plant-guilds-l3', moduleId: 'plant-guilds', hold: true, holdReason: 'A worked guild example names real species — needs photographs.', subject: 'A central tree in plan view with four rings of companions around it, each ring marked by role icon only: nitrogen, mulch, pest control, ground cover.' },

  { lessonId: 'food-forest-l1', moduleId: 'food-forest', hold: true, holdReason: 'Layer diagrams invite recognisable species — hold with the rest of the module.', subject: 'Seven stacked layers in side view from tall canopy down to root layer, each a simple silhouette band with clear height differences.' },
  { lessonId: 'food-forest-l2', moduleId: 'food-forest', hold: true, holdReason: 'This lesson IS the species list for each SA climate zone — photographs only.', subject: 'A map of South Africa divided into simple climate bands, with a generic layered-planting silhouette beside each band.' },
  { lessonId: 'food-forest-l3', moduleId: 'food-forest', hold: true, holdReason: 'Planting sequence shows specific species at each stage — needs photographs.', subject: 'A timeline in three stages left to right on the same plot: pioneer plants and shelter first, then the mid-layer filling in, then a mature layered system.' },
];

export function briefFor(lessonId: string): CourseImageBrief | undefined {
  return COURSE_IMAGE_BRIEFS.find((b) => b.lessonId === lessonId);
}

/** The full prompt for one lesson: house rules plus its own subject. */
export function promptFor(brief: CourseImageBrief): string {
  return `${IMAGE_RULES}\n\nSUBJECT: ${brief.subject}`;
}
