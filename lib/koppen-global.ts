// Köppen-Geiger climate classification, for anywhere on Earth.
//
// WHY THIS EXISTS SEPARATELY FROM lib/biome.ts's koppenClassify.
// That one is a deliberate eight-class approximation tuned for South Africa: it takes
// annual rainfall and three temperatures, and it is good enough for the range of
// climates a South African site can actually be. Point it at Bergen or Ulaanbaatar and
// it confidently returns the wrong answer — "anything under 300 mm is a hot desert"
// is true in the Northern Cape and false in the Arctic. The Atlas lets a farmer tap
// ANY point on the globe, so it needs the real thing. biome.ts's version is untouched:
// every existing South African caller keeps the classification it was tuned for.
//
// The rules below are the standard Köppen-Geiger formulation as set out in Peel,
// Finlayson & McMahon (2007), "Updated world map of the Köppen-Geiger climate
// classification". Nothing here is invented or tuned — it is an implementation of a
// published standard, which is why it can be tested by rule rather than by vibe.
//
// INPUT is twelve monthly mean temperatures and twelve monthly precipitation totals,
// January-first, plus latitude (which half of the year is summer depends on which
// hemisphere you are standing in — and getting that backwards silently turns every
// Mediterranean climate into a monsoon one).

/** Jan-first monthly climatology for one point. */
export interface MonthlyClimate {
  /** Mean temperature per month, °C, Jan..Dec. */
  tempC: number[];
  /** Total precipitation per month, mm, Jan..Dec. */
  precipMm: number[];
  /** Signed latitude. Only its SIGN is used — to decide which six months are summer. */
  lat: number;
}

export interface KoppenResult {
  /** e.g. 'Cfa'. '?' when the input is unusable. */
  code: string;
  /** Plain-English name, e.g. 'Humid subtropical'. */
  description: string;
  /** One sentence a grower can act on. Empty for '?'. */
  growerNote: string;
  /** The main group letter: A, B, C, D, E — or '?' */
  group: string;
}

const NORTHERN_SUMMER = [3, 4, 5, 6, 7, 8]; // Apr..Sep
const SOUTHERN_SUMMER = [9, 10, 11, 0, 1, 2]; // Oct..Mar

function usable(c: MonthlyClimate): boolean {
  return (
    Array.isArray(c.tempC) && Array.isArray(c.precipMm)
    && c.tempC.length === 12 && c.precipMm.length === 12
    && c.tempC.every((t) => Number.isFinite(t))
    && c.precipMm.every((p) => Number.isFinite(p) && p >= 0)
    && Number.isFinite(c.lat)
  );
}

/**
 * Which six months count as summer here.
 *
 * Köppen defines the summer half-year by hemisphere, not by which months happen to be
 * warmest in the data — using the data's own warmest run would make the definition
 * circular and would flip on noisy equatorial records where the annual temperature
 * range is under a degree.
 */
export function summerMonthIndices(lat: number): number[] {
  return lat >= 0 ? NORTHERN_SUMMER : SOUTHERN_SUMMER;
}

/**
 * The aridity threshold, in mm. A place is arid when its annual precipitation falls
 * below ten times this. The +28 / +14 / +0 offsets encode that rain arriving in the hot
 * half of the year is worth less to a plant than the same rain in the cool half —
 * more of it evaporates before it is ever taken up.
 */
function aridityThreshold(meanAnnualTempC: number, pSummer: number, pWinter: number, map: number): number {
  if (map <= 0) return 2 * meanAnnualTempC;
  if (pWinter >= 0.7 * map) return 2 * meanAnnualTempC;
  if (pSummer >= 0.7 * map) return 2 * meanAnnualTempC + 28;
  return 2 * meanAnnualTempC + 14;
}

/** Second letter for the temperate (C) and cold (D) groups: dry summer, dry winter, or no dry season. */
function seasonalityLetter(
  pSummerDriest: number, pSummerWettest: number,
  pWinterDriest: number, pWinterWettest: number,
): 's' | 'w' | 'f' {
  // Checked in this order deliberately: Peel resolves the (rare) case where a record
  // satisfies both by taking the dry-summer reading.
  if (pSummerDriest < 40 && pSummerDriest < pWinterWettest / 3) return 's';
  if (pWinterDriest < pSummerWettest / 10) return 'w';
  return 'f';
}

/** Third letter for C/D: how hot the summer gets and how long it lasts. */
function temperatureLetter(tHot: number, tCold: number, monthsAbove10: number): 'a' | 'b' | 'c' | 'd' {
  if (tHot >= 22) return 'a';
  if (monthsAbove10 >= 4) return 'b';
  if (tCold < -38) return 'd';
  return 'c';
}

const DESCRIPTIONS: Record<string, [string, string]> = {
  Af: ['Tropical rainforest', 'Warm and wet all year — growing never stops, but neither does disease pressure or leaching.'],
  Am: ['Tropical monsoon', 'A short dry spell inside a very wet year — storage and drainage matter more than irrigation.'],
  Aw: ['Tropical savanna, dry winter', 'A hot wet season and a hard dry one — the dry months decide what a garden can carry.'],
  As: ['Tropical savanna, dry summer', 'A dry spell in the hottest months — shade and mulch do the work irrigation cannot.'],
  BWh: ['Hot desert', 'Water is the whole plan. Nothing here grows on rainfall alone.'],
  BWk: ['Cold desert', 'Dry and cold — a short season bounded by frost at one end and drought at the other.'],
  BSh: ['Hot semi-arid steppe', 'Rain comes, but not reliably. Harvesting and holding it is the difference between years.'],
  BSk: ['Cold semi-arid steppe', 'Dry, with real winters — a narrow window between the last frost and the dry heat.'],
  Cfa: ['Humid subtropical', 'Rain in every month and hot summers — a long season, with rot and fungus as the limit rather than drought.'],
  Cfb: ['Temperate oceanic', 'Mild and damp year-round — a long, gentle season that rarely gets properly hot.'],
  Cfc: ['Subpolar oceanic', 'Cool and wet with a very short warm spell — hardy crops only.'],
  Csa: ['Mediterranean, hot summer', 'Winter rain, bone-dry summer — the growing calendar runs opposite to a summer-rainfall one.'],
  Csb: ['Mediterranean, warm summer', 'Winter rain and a dry, mild summer — irrigation carries the summer crop.'],
  Csc: ['Mediterranean, cold summer', 'Winter rain and a short cool summer — a narrow window.'],
  Cwa: ['Humid subtropical, dry winter', 'Summer rain and a dry winter — frost is light, so the dry season is the real limit.'],
  Cwb: ['Subtropical highland, dry winter', 'Summer rain, dry winters, mild all year from altitude — a highland growing pattern.'],
  Cwc: ['Subtropical highland, short summer', 'Summer rain with a very short warm season.'],
  Dfa: ['Cold, no dry season, hot summer', 'Hard winters and hot summers — everything happens between the frosts.'],
  Dfb: ['Cold, no dry season, warm summer', 'A real winter and a moderate summer — the season is bounded at both ends by frost.'],
  Dfc: ['Subarctic', 'A short cool summer between long winters.'],
  Dfd: ['Extremely cold subarctic', 'A very short summer inside a severe winter.'],
  Dwa: ['Cold, dry winter, hot summer', 'Dry cold winters and hot wet summers.'],
  Dwb: ['Cold, dry winter, warm summer', 'Dry cold winters and moderate summers.'],
  Dwc: ['Subarctic, dry winter', 'A short summer after a dry, severe winter.'],
  Dwd: ['Extremely cold, dry winter', 'Among the harshest inhabited climates.'],
  Dsa: ['Cold, dry summer, hot summer', 'Dry hot summers with cold wet winters.'],
  Dsb: ['Cold, dry summer, warm summer', 'Dry warm summers with cold wet winters.'],
  Dsc: ['Subarctic, dry summer', 'A short dry summer between cold wet winters.'],
  Dsd: ['Extremely cold, dry summer', 'A very short dry summer in a severe winter climate.'],
  ET: ['Tundra', 'Too cold for tree crops — the warmest month barely reaches ten degrees.'],
  EF: ['Ice cap', 'No month rises above freezing. Nothing is grown in the ground here.'],
};

/**
 * Classify a point from its monthly climatology.
 *
 * Returns code '?' rather than a guess when the input is incomplete — a wrong climate
 * label is worse than a missing one, because a farmer would plan against it.
 */
export function classifyKoppen(c: MonthlyClimate): KoppenResult {
  if (!usable(c)) return { code: '?', description: 'Unknown', growerNote: '', group: '?' };

  const { tempC, precipMm, lat } = c;
  const map = precipMm.reduce((s, p) => s + p, 0);
  const mat = tempC.reduce((s, t) => s + t, 0) / 12;
  const tHot = Math.max(...tempC);
  const tCold = Math.min(...tempC);
  const monthsAbove10 = tempC.filter((t) => t >= 10).length;

  const summer = summerMonthIndices(lat);
  const winter = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((m) => !summer.includes(m));
  const pSummerMonths = summer.map((m) => precipMm[m]);
  const pWinterMonths = winter.map((m) => precipMm[m]);
  const pSummer = pSummerMonths.reduce((s, p) => s + p, 0);
  const pWinter = pWinterMonths.reduce((s, p) => s + p, 0);

  let code: string;

  // B — arid. Checked FIRST: aridity overrides every other group, which is why the
  // Gobi is a cold desert and not a continental climate.
  const pth = aridityThreshold(mat, pSummer, pWinter, map);
  if (map < 10 * pth) {
    code = (map < 5 * pth ? 'BW' : 'BS') + (mat >= 18 ? 'h' : 'k');
  } else if (tCold >= 18) {
    // A — tropical.
    const pDriest = Math.min(...precipMm);
    if (pDriest >= 60) code = 'Af';
    else if (pDriest >= 100 - map / 25) code = 'Am';
    else {
      // Dry season in the summer half or the winter half. Peel folds both into Aw;
      // the distinction is kept here because it inverts the planting calendar, which
      // is the entire point of showing a farmer another place's climate.
      const driestIdx = precipMm.indexOf(pDriest);
      code = summer.includes(driestIdx) ? 'As' : 'Aw';
    }
  } else if (tHot > 10 && tCold > 0) {
    // C — temperate.
    code = 'C'
      + seasonalityLetter(Math.min(...pSummerMonths), Math.max(...pSummerMonths), Math.min(...pWinterMonths), Math.max(...pWinterMonths))
      + temperatureLetter(tHot, tCold, monthsAbove10);
  } else if (tHot > 10) {
    // D — cold (tCold <= 0).
    code = 'D'
      + seasonalityLetter(Math.min(...pSummerMonths), Math.max(...pSummerMonths), Math.min(...pWinterMonths), Math.max(...pWinterMonths))
      + temperatureLetter(tHot, tCold, monthsAbove10);
  } else {
    // E — polar.
    code = tHot > 0 ? 'ET' : 'EF';
  }

  const [description, growerNote] = DESCRIPTIONS[code] ?? ['Unclassified', ''];
  return { code, description, growerNote, group: code[0] };
}

/**
 * Which of the app's four rainfall patterns this climate behaves like.
 *
 * The crop planner reasons in these four patterns, not in Köppen codes, so this is the
 * bridge that lets a place on the other side of the world be read against the same crop
 * calendar. It is a mapping between two coarse models — deliberately not dressed up as
 * a precise claim.
 */
export type AtlasRainPattern = 'summer' | 'winter' | 'all-year' | 'mild-frost';

export function rainPatternFor(c: MonthlyClimate, koppen: KoppenResult): AtlasRainPattern {
  const map = c.precipMm.reduce((s, p) => s + p, 0);
  const summer = summerMonthIndices(c.lat);
  const pSummer = summer.reduce((s, m) => s + c.precipMm[m], 0);
  const tCold = Math.min(...c.tempC);

  // A cold month below ~4 °C mean implies frost nights around it. The planner's
  // 'mild-frost' pattern exists for exactly that: rain is not the binding constraint,
  // the frost window is.
  if (tCold < 4 && koppen.group !== 'A') return 'mild-frost';
  if (map <= 0) return 'summer';
  const summerShare = pSummer / map;
  if (summerShare >= 0.65) return 'summer';
  if (summerShare <= 0.35) return 'winter';
  return 'all-year';
}
