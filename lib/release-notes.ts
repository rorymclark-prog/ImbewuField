// What changed in the build the farmer is about to refresh into.
//
// The update banner used to say only "New version available" — which tells you a number changed,
// not whether it is worth interrupting your work for, and gives you nothing to check afterwards.
// (Rory: "when you refresh i want the changes listed underneath the refresh button and in brief".)
//
// RULES FOR WRITING THESE. One line per change, in the farmer's language, describing what is
// different ON THEIR SCREEN — never the mechanism. "Zone maps now follow the zones you drew", not
// "buildZoneOverlay is composited on the model-chrome path". Newest build at the top, and keep the
// list to the last few builds: this is a "should I refresh, and what do I look at" note, not a
// changelog. Anything longer belongs in the repo's docs.
export interface ReleaseNote {
  /** Short human date — no clock time; the farmer only needs the ordering. */
  when: string;
  changes: string[];
}

/** Shown newest-first under the Refresh button. The banner renders at most MAX_SHOWN lines total. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    when: 'Latest',
    changes: [
      'Slide 13 now shows the dry method it teaches, not the wet one',
      'NEW: a Higher quality download for facilitators and funders on wifi — more data',
      'Plan sheets now take the shape of your farm — a long thin plot fills the page',
      'NEW: Open a module and the slides are there — press Play and it teaches itself through',
      'Downloaded clips now play by themselves; ones you have not downloaded still ask first',
      'NEW: Download a module, or the whole course, and use it with no airtime',
      'A downloaded module now survives app updates instead of being cleared',
      'Lessons are half the size to download — isiZulu slides and clips are much smaller',
      'The size on every play button is now the real size of the file',
      'The isiZulu deck is complete — slide 13 no longer shows in English',
      'Long water labels no longer run off the edge of the map',
      'Finished-map labels are larger and feature art no longer has white sticker outlines',
      'Sector maps now use three large slope arrows instead of five thin ones',
      'Sector wind and driving rain now stand out over a quieter aerial photo',
      'AI polish now keeps your selected style',
      'AI polish now paints your saved trees, beds, tanks and structures',
      'Protected roofs, driveways and boundaries are restored exactly',
      'The exact master stays in Saved maps while AI polish runs',
      'One press now continues from the exact map into paid AI polish',
      'AI-polished and Exact-only finishes are both clearly shown',
      'Sector maps now have bold marks, labels and illustrated keys',
      'Small Structures symbols now print clearly and paths no longer border the driveway',
      'Planting now distinguishes banana, pawpaw, moringa, keyhole beds, herb spirals and hedges',
      'Ponds, tree basins, greywater basins, taps, pumps and diverters now use painted artwork',
      'Hand-painted tanks, beds, trees and planting strips stay inside their saved footprints',
      'Structures now show painted compost, hives, chicken tractors, nursery tables and gates',
      'Drip is clear blue with fewer emitters; filtered greywater is now a solid purple line',
      'Water, Planting and Structures now share grouped editorial legends',
      'Unknown elements keep their safe exact symbol instead of becoming a guessed object',
      'Water uses a dark illustrated forest around a clear olive and moss property',
      'Blue, purple and drip routes now use slimmer technical ink',
      'Route labels name each network once; tank and basin counts stay factual',
      'Driveways stay quiet, flat and charcoal; traced geometry stays exact',
    ],
  },
  {
    when: 'Previous',
    changes: [
      'Water artwork is brighter and more natural; exact routes stay locked',
      'Illustrated Water maps keep the driveway and traced ground quieter behind the water system',
      'JoJo tanks and colour-coded water lines are now much easier to read on phones',
      'Water legends are now grouped into rainwater, irrigation, greywater and earthworks',
      'Geometry Lock Water sheets now use the full Water, Greywater & Irrigation title',
      'Water tanks, fittings and routes now stand out clearly over illustrated ground',
      'Rendered driveways are quieter, without a heavy decorative border',
      'Tiny aligned gaps in matching Water routes now close neatly on rendered maps',
      'AI receives only the Water features you saved; missing systems stay absent',
      'Drip and greywater routes now read as real tubing, emitters and inspection points',
      'Water sheets now stay focused: Vetiver Bank appears on Planting and Whole',
      'Vetiver banks now read as dense green hedges instead of brown strips',
      'Trees use finer top-down canopy texture instead of large circular blobs',
      'Duck ponds, animal pens and site fixtures now use their own plan symbols',
      'Sector numbers now separate cleanly when sun, wind and access share a bearing',
      'Refresh update now detects the new build even when it arrives before the first check',
      'Sector numbers now match the exact sun, wind, fire, access and fall marks on the map',
      'Water and infrastructure now use clear illustrated plan symbols',
      'Water maps now name and draw the old Mulch Bank correctly as Vetiver Bank',
      'Planting and Whole use fewer callouts; their legends still list everything',
      'Sector energies are decluttered and fully explained in the numbered legend',
      'The driveway is quieter and the full Phasing schedule now fits its cream panel',
      'Sector analysis now shows driveway access as its own energy, when a driveway is traced',
      'Stacked terraces each get their own fall arrow, not just one for the whole hillside',
      'You can now duplicate a placed, sized element instead of re-placing it from scratch',
      'Drawn lines (swales and the rest) can finally be named and labelled on the canvas',
      'A placed element no longer gets stuck locked the moment you place it, on some steps',
      'AI Sector: the data-strip and sources line stay readable, not just the title',
      'Placing a terrace now tells you the right method for your slope, and when to ask an expert',
      'Sector analysis shows real sun arcs, named winds and a fuller numbered legend',
      'A new Master Atlas style joins the style picker',
      'Sector title stays readable on AI, and labels can no longer hide behind the legend',
      'AI renders finally know what a tree basin, banana circle and greywater line look like',
      'Sector analysis can now be AI-styled too — the bearings are still measured, never guessed',
      'Sector analysis: your ground is drawn quietly so the sun, wind and water arrows read first',
      'Sector labels no longer print on top of each other, and the fire note is no longer cut off',
      'Sector analysis is exact-only again — the AI version kept drawing it off-register',
      'Fire sector removed until we can point it the right way — see below',
      'Sector analysis now shows and names your lawn, veg garden and cleared ground',
      'Picking a style on Site or Sector actually switches that sheet to AI',
      'One legend row per element — four taps no longer take three lines',
      'You can now draw a greywater line — Water step, next to Drip',
      'The driveway draws as tar on the ground, not as another roof',
      'Tree basins draw as the earthwork alone — no invented plant on the mound',
      'Your driveway now stays on every sheet',
      'Water plans stop drawing taps, valves and greywater pipes you never placed',
      'Tree basins draw correctly: tree up on a mound, mulched moat around it',
      'Planting and Structures sheets stop inventing irrigation lines that were never drawn',
      'Older saved maps are now marked, so you can tell them from freshly rendered ones',
      'The property boundary draws as a fence line, not a hatch over the whole plot',
      'Label leaders point at the edge of the area they name, not its middle',
      'Traced areas now nest — lawn cuts out the house, house cuts out the patio',
      'Area labels no longer pile on top of each other (drag one to move it)',
      'New "Other" element on Water, Planting and Structures — place it, then name it yourself',
      'Driveways draw flat, not as a raised slab beside the house',
      'Water plans name the beds and basins the irrigation feeds, under EXISTING',
      'The house, driveway and lawn stay unlabelled so the design stands out',
      'Sector analysis now reads on a light paper base instead of a dark one',
      'The boundary is now a proper post-and-wire fence, not a ticked line',
      'No more invented trees scattered across your plan',
      'Your driveway stays on every sheet',
      'Water plans now show the beds and basins your irrigation runs to',
      'Driveways stay driveways instead of being repainted as lawn',
      'Site and Sector sheets can now be AI-styled, not just exact',
      'Zone maps follow the zones you actually drew',
      'Your rendered maps are saved on this device and survive closing the app',
      'Fixed the phantom hedge along the fence, and the driveway merging into the house',
      'Beds, banana circles and tree basins moved to the Planting sheet where they belong',
    ],
  },
];

/** Never let the banner become a wall of text over the map. */
export const MAX_SHOWN = 5;

/** The lines to render, flattened and capped. Kept pure so it is testable without a DOM. */
export function visibleNotes(notes: ReleaseNote[] = RELEASE_NOTES, max = MAX_SHOWN): string[] {
  return notes.flatMap((n) => n.changes).slice(0, max);
}
