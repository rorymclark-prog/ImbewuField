// One registry for how a contour line is painted, everywhere it is painted.
//
// WHY THIS FILE EXISTS: contours were being drawn in FOUR different colours by four surfaces —
// #7aaa50/#b8d470 on the satellite map, #8B5A2B in the Design Studio, #B89A60 on the facilitator
// sheet — and on the two surfaces that sit over aerial imagery they were painted the same hue as
// the ground beneath them. Rory, looking at a farm plan: "change the colour of contours".
//
// THE AUDIT (worst-case WCAG contrast against real South African smallholding imagery — canopy
// shadow, tree canopy, green pasture, dry veld, red-brown soil, bare sand, concrete, bright roof):
//
//     #7aaa50  map minor      1.02:1   vanishes into concrete/roof
//     #b8d470  map major      1.07:1   vanishes into bare sand
//     #8B5A2B  design studio  1.00:1   EXACTLY the luminance of red-brown SA soil
//     #B89A60  facilitator    1.01:1   vanishes into concrete/roof
//
// A ratio of 1.00 means the line and the ground are the same brightness: invisible, not merely
// subtle. But the audit's real finding was that NO flat colour fixes this. Farm imagery spans
// luminance 0.020 (canopy shadow) to 0.786 (bright roof), which caps ANY single flat colour at
// 3.46:1 — and only a perfectly-tuned mid-grey could reach it, which would mean nothing and look
// like dirt. Every bright candidate tested scored between 1.02 and 1.26 worst-case, because
// whatever brightness you pick, some patch of ground matches it.
//
// So a contour is drawn as a CASED line: a bright core over a dark casing. Whichever half loses
// against the ground, the other holds — the dark casing carries bright ground, the bright core
// carries dark ground. That lifts the worst case to 3.35:1, i.e. essentially the flat-colour
// ceiling, while ALSO carrying a hue no ground has. It is the same trick the contour LABELS have
// always used here (text-halo-color) — it just never reached the lines.
//
// WHY MAGENTA, and not the higher-scoring options:
//   - white  (5.04:1) scores best on luminance and worst on meaning: hue distance 4 from bare
//     sand, roofs and gravel, all of which are everywhere on a smallholding. A white line reads
//     as a footpath.
//   - yellow (3.85:1) scores well but sits 106 from the summer-wind arrow and near the sun arc
//     (#F7C97E / #E08A2C). Mistaking a contour for the sun path on a permaculture sheet is an
//     agronomic error, not a cosmetic one.
//   - magenta #FF4FAE reaches 3.35:1 with 115 hue distance from its nearest neighbour (the fire
//     wedge) — the only perceptual slot this app has not already spent. Blue is water and swale,
//     amber is sun and wind, red is fire, purple is greywater, green is planting and the ground
//     itself. Magenta is also the surveyor's convention for overlay linework on orthophotography.
//
// The swale distinction matters most of all: a swale is dug ON contour, so the guide line and the
// built earthwork sit on top of each other. Swale is #258DBA blue; a magenta guide can never be
// read as the thing you are being told to build.

/** The contour line itself. Always drawn over CONTOUR_CASING, never bare. */
export const CONTOUR_CORE = '#FF4FAE';
/** The casing under the core. Near-black with a trace of the core's hue so the pair reads as
 *  one object rather than as a line with a drop shadow. */
export const CONTOUR_CASING = '#140A11';
/** Index (major) contours — the labelled ones — are the same hue, lighter, so the major/minor
 *  distinction survives even where the imagery is busy. */
export const CONTOUR_CORE_MAJOR = '#FFC2E2';
/** Elevation labels, and the halo that keeps them legible over anything. */
export const CONTOUR_LABEL = '#FFD9EE';
export const CONTOUR_LABEL_HALO = '#140A11';

/** How much wider the casing is than the core, in px. Enough to read at a glance, not so much
 *  that a contour field turns the map dark. */
export const CONTOUR_CASING_EXTRA = 2;
