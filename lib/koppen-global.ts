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
//
// ── THE LIMIT IS THE INPUT, NOT THE RULES ────────────────────────────────────
// Measured against eight real points using live NASA POWER data through
// /api/location-data, this classifier corrects the old one at Cape Town (Csa ->
// Csb), Upington (BSh -> BWh), Alice Springs (BSh -> BWh) and — most starkly —
// Ulaanbaatar, which the old one called a HOT semi-arid steppe at a coldest-month
// mean of -20.9 C, and this one calls Dwc. It also fixes Bergen's seasonality
// letter: 2715 mm a year was being reported as a dry-winter climate.
//
// It still disagrees with the published class at two of the eight, and the cause
// is the DATA rather than the arithmetic. NASA POWER's climatology is a ~0.5°
// (~55 km) grid, and at coastal and mountain sites that cell averages across
// terrain the site is not in:
//   • Durban comes back with a coldest month of 20.0 C (really nearer 17). The
//     A/C boundary sits at exactly 18, so the grid's warm coastal bias tips it
//     from Cfa to Aw. Nairobi tips the same way.
//   • Bergen comes back at -2.1 C (really around +1.5), and the C/D boundary sits
//     at 0, so the grid's cold inland bias tips it from Cfb to Dfb.
// Both boundaries are knife-edge by definition, so a degree or two of grid bias
// changes the letter. That is not fixable here — it needs a finer temperature
// source, the way lib/nasa-power.ts already prefers Open-Meteo's ~9 km grid for
// RAINFALL when the two disagree by more than 30%.
//
// CONSEQUENCE FOR ANY UI BUILT ON THIS: show the measured numbers — annual
// rainfall, coldest and hottest month — as the primary reading, and the Köppen
// code as a secondary label, said to be modelled. A farmer can judge "coldest
// month 17 C" for themselves; "Aw" they have to take on trust, and at a coastal
// site that trust would occasionally be misplaced.

/** Jan-first monthly climatology for one point. */
export interface MonthlyClimate {
  /** Mean temperature per month, °C, Jan..Dec. */
  tempC: number[];
  /** Total precipitation per month, mm, Jan..Dec. */
  precipMm: number[];
  /** Signed latitude. Only its SIGN is used — to decide which six months are summer. */
  lat: number;
  /**
   * Lowest hourly 2 m air temperature in the grid cell's climatological record, °C.
   * Optional, and read ONLY by the sowing-calendar choice below — the Köppen rules
   * never see it. It is NASA POWER's climatology T2M_MIN ("the minimum hourly air
   * temperature at 2 meters ... in the period of interest"), taken over all twelve
   * months, and only a caller holding a real provider reading may pass it
   * (lib/climate-temperature.ts recordMinimumC).
   */
  recordMinC?: number;
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

// A NOTE MAY SAY ONLY WHAT ITS CLASS DEFINES. A class is decided by monthly MEANS (the
// rules in classifyKoppen below): a temperate "C" class needs a coldest-month mean above
// 0 °C and a hottest above 10 °C; "w" is a dry winter, "f" no dry season; "a" is a hottest
// month of 22 °C or more, "b" a cooler summer with four months at 10 °C or more. None of
// that says how cold a night gets, so a C-class note must not call the year mild or frost
// light. Three did until 11 November 2026 (finding CP-114):
//   Cwb  "…mild all year from altitude — a highland growing pattern."
//   Cwa  "…frost is light, so the dry season is the real limit."
//   Cfb  "Mild and damp year-round — a long, gentle season…"
// Of the 100 saved South African places (tests/fixtures), all 13 Cwb places have a gridded
// record minimum below 0 °C (to -6.7 °C) and frost on the second daily record, as do 5 of
// 11 Cfb places (to -4.1 °C) and 1 of 3 Cwa places. Johannesburg printed "mild all year"
// above a record low of -4.8 °C. The three now state the class's rain season and summer
// warmth and say plainly that the class is silent on frost. "From altitude" is gone too:
// the classifier never sees altitude. The class NAMES are the conventional ones, unchanged.
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
  Cfb: ['Temperate oceanic', 'Rain in every month and summers that stay warm rather than hot. This climate type alone does not tell you whether there is frost.'],
  Cfc: ['Subpolar oceanic', 'Cool and wet with a very short warm spell — hardy crops only.'],
  Csa: ['Mediterranean, hot summer', 'Winter rain, bone-dry summer — the growing calendar runs opposite to a summer-rainfall one.'],
  Csb: ['Mediterranean, warm summer', 'Winter rain and a dry, mild summer — irrigation carries the summer crop.'],
  Csc: ['Mediterranean, cold summer', 'Winter rain and a short cool summer — a narrow window.'],
  Cwa: ['Humid subtropical, dry winter', 'Summer rain, a dry winter and hot summers. This climate type alone does not tell you whether there is frost.'],
  Cwb: ['Subtropical highland, dry winter', 'Summer rain, dry winters and summers that stay warm rather than hot. This climate type alone does not tell you whether there is frost.'],
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
 * The note for a class code, read from the one table above. '' for a code the table does
 * not hold. For a screen that has only a stored code: a saved site can still carry a note
 * written before 11 November 2026 ("mild all year from altitude"), and that stored sentence
 * must not be printed in place of the current one (finding CP-113).
 */
export function koppenClassNote(code: string): string {
  return Object.hasOwn(DESCRIPTIONS, code) ? DESCRIPTIONS[code][1] : '';
}

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

/*
 * FROST FIRST, RAIN SECOND (2026-09-27 crop-plan audit).
 *
 * The catalog's four columns are FROST regimes before they are rainfall regimes
 * (lib/crop-catalog.ts header): 'summer' is the hard-frost interior, 'mild-frost' is
 * KZN DARD's "warm areas / light frosts" column, 'all-year' its "hot areas / frost-free"
 * column and 'winter' the mild Mediterranean Cape. This bridge used to choose by rain
 * share alone and tested temperature once, backwards: a coldest month under 4 °C — the
 * harshest frost in the country — was sent to the LIGHT-frost calendar, while frost-free
 * lowveld and coast could only ever reach the hard-frost windows, and Sutherland-type
 * hard-frost sites with bimodal rain reached the frost-free column.
 *
 * Coldest-month MEAN is the one temperature every caller has, so the first thresholds
 * are stated on it. They lean cold on purpose: a site near a line lands in the COLDER
 * column, whose windows wait for frost to pass.
 *   < 7 °C   hard frost (Lesotho border, Sutherland, high Karoo) — frost column always.
 *   >= 13 °C light frost in low pockets at most (Upper Highway ~14) — the warm-area column.
 *
 * WHAT THE 10 NOVEMBER 2026 ACCURACY AUDIT CHANGED (CP-073, CP-074, CP-078).
 * The rule was run for 44 real South African places and checked against 20 years of
 * daily minimum temperatures and a published regional sowing guide
 * (docs/audits/2026-11-10/crop-plan-accuracy-claude.md). Three things were wrong:
 *
 * 1. FROST WAS GUESSED FROM A MEAN AND AN ARIDITY CLASS. Every semi-arid summer-rain
 *    site went to the hard-frost column, because "a desert's clear nights fall far
 *    below its mean". True for Upington; false for Komatipoort, Phalaborwa, Musina and
 *    Thohoyandou, which had no frost day in 20 years of the gridded record and were
 *    shown the Highveld's season — tomatoes sown August to October where the regional
 *    guides say January to July. The site's record minimum temperature was already
 *    being fetched and was not read. It is read now: an arid site clears the frost
 *    column only when its own record shows no freezing temperature.
 * 2. NOTHING COULD REACH THE HOT-AREA COLUMN ON SUMMER RAIN. 'all-year' was reachable
 *    only when summer rain was under 65 % of the year, so Richards Bay (64 %) got the
 *    frost-free calendar and Durban (69 %) did not. The column is KZN DARD's "Hot
 *    areas, frost-free": autumn, winter and spring sowing, summer closed. It is chosen
 *    by frost and heat, not by rain timing.
 * 3. A MILD, FROST-FREE COAST IS NOT A HOT AREA. George and Gqeberha were on the
 *    frost-free column and agree far better with the warm-area one (their guides sow
 *    beans October to January, not February to September). A site with rain in both
 *    halves of the year now goes through the same frost test as a summer-rain site.
 *
 * THE HOT-AREA TEST, and where each number comes from. All three must hold:
 *   - Frost-free, as far as a grid can say. Record minimum >= 2 °C, the line
 *     lib/design-studio.ts already uses for "watch for frost". It is this rule's
 *     working line on gridded evidence, not a measurement: a cell whose record has
 *     touched 2 °C may hold ground that froze, and a cell above the line is not
 *     proof that a given farm or hollow never does. With no record minimum, the
 *     coldest-month mean must reach Köppen's tropical line (18 °C), aridity or not.
 *   - Warm winter. Coldest-month mean >= 16 °C, the bottom of the common bean's optimum
 *     range in FAO ECOCROP (Phaseolus vulgaris, TOPMN — the table lib/crop-climate-gate.ts
 *     cites). The column sows bush beans from February to September, so beans must
 *     still grow in the coldest month.
 *   - Hot summer. Hottest-month mean >= 24 °C, the top of the optimum range (TOPMX) for
 *     cabbage, broccoli, carrots and peas in the same table: the summer the column
 *     closes for them. East London (17.6 °C winter, 23.4 °C summer) fails this and
 *     stays on the warm-area column, where its regional guide fits.
 *
 * WHAT THIS IS NOT. Every input is a gridded estimate for a cell tens of kilometres
 * wide, not a weather station and not the farm. Mbombela (coldest month 15.9 °C) and
 * Tzaneen (record minimum 0.7 °C) sit just on the cold side and get the warm-area
 * column; a frost-free farm there would be better served by the hot one. That is the
 * lean-cold rule doing its job, and `closeCall` below is how the planner says so.
 */
export const HARD_FROST_COLDEST_MONTH_C = 7;
export const LIGHT_FROST_COLDEST_MONTH_C = 13;
/**
 * The rule's frost-free line: a gridded record minimum at or above this is TREATED as
 * frost-free when a calendar is chosen. It is a heuristic on grid evidence, not an
 * assurance about any farm: a grid minimum cannot rule out frost in a cold hollow.
 * That is why a near miss is flagged (`closeCall`), why the reasons line tells the
 * grower the records are for the wider area, and why their own frost answer and
 * their own calendar choice both override it.
 */
export const FROST_FREE_RECORD_MIN_C = 2;
/** Coldest-month mean for the hot-area column: ECOCROP TOPMN, Phaseolus vulgaris. */
export const HOT_AREA_COLDEST_MONTH_C = 16;
/** Hottest-month mean for the hot-area column: ECOCROP TOPMX, cabbage/broccoli/carrot/pea. */
export const HOT_AREA_HOTTEST_MONTH_C = 24;
/**
 * Coldest-month mean below which frost commonly lasts into September. The hard-frost
 * column assumes frost from May to August. In 20 years of daily minima (ERA5, 2001-2020)
 * every audited site that frosted in September in at least 15 % of years had a coldest
 * month of 8.6 °C or lower — Sutherland 80 % of years, Underberg 45 %, Bethlehem 25 %,
 * Bloemfontein and Kokstad 20 %, Komani and Graaff-Reinet 15 % — and no site at 9.8 °C or
 * above reached more than 10 % (accuracy audit, CP-081). It selects a warning, never a
 * sowing month: a gridded record can miss frost in a cold hollow and is not a frost
 * observation at the farm, so the grower's own last frost is what decides.
 */
export const LATE_FROST_COLDEST_MONTH_C = 9;
/** Köppen's tropical line: the frost-free stand-in when no record minimum is known. */
const TROPICAL_COLDEST_MONTH_C = 18;
const SUMMER_RAIN_SHARE = 0.65;
const WINTER_RAIN_SHARE = 0.35;

/**
 * How far two gridded climate records disagree about the same South African place:
 * NASA POWER against ERA5 at the audit's 44 sites. Monthly means differed by a median
 * 0.8–1.0 °C (upper quartile 1.2–1.4 °C), summer rain share by 0.05 or less at nine
 * sites in ten, and the record minimum by 2 °C or less at 31 of 44. A site that would
 * change calendar inside these tolerances is a close call, not a finding.
 */
const CLOSE_CALL_MEAN_C = 1;
const CLOSE_CALL_RECORD_MIN_C = 2;
const CLOSE_CALL_RAIN_SHARE = 0.05;

/** The three frost columns from coldest to warmest. The Cape's winter-rain column is not
 * on this ladder: it is reached by rain timing and has no warmer or colder neighbour. */
const WARMTH_RANK: Record<AtlasRainPattern, number> = { summer: 0, 'mild-frost': 1, 'all-year': 2, winter: -1 };

/** Which half of the year the rain falls in — a separate question from the frost regime. */
export type RainSeason = 'summer' | 'winter' | 'all-year';

interface CalendarFacts {
  coldestMonthC: number;
  hottestMonthC: number;
  summerRainShare: number;
  arid: boolean;
  tropical: boolean;
  recordMinC: number | null;
}

function calendarFromFacts(f: CalendarFacts): AtlasRainPattern {
  // Tropical (group A) means a coldest month >= 18 °C — never a frost climate, even
  // when a coarse grid cell puts the number on the wrong side of a threshold above.
  if (!f.tropical && f.coldestMonthC < HARD_FROST_COLDEST_MONTH_C) return 'summer';
  if (f.summerRainShare <= WINTER_RAIN_SHARE) return 'winter';

  const frostFree = f.recordMinC !== null
    ? f.recordMinC >= FROST_FREE_RECORD_MIN_C
    : f.coldestMonthC >= TROPICAL_COLDEST_MONTH_C;
  if (frostFree
      && f.coldestMonthC >= HOT_AREA_COLDEST_MONTH_C
      && f.hottestMonthC >= HOT_AREA_HOTTEST_MONTH_C) return 'all-year';

  // Arid (group B): a desert's clear winter nights fall far below its monthly mean
  // (Upington frosts with a coldest month near 11-13 °C), so the mean alone cannot
  // clear it of frost. Its own record can: no freezing temperature on record is the
  // same `<= 0` line lib/design-elements.ts uses for frost-sensitive plantings.
  const meanClearsFrost = !f.arid || (f.recordMinC !== null && f.recordMinC > 0);
  // A frost-free record outranks the mean it was being guessed from: a cool maritime
  // coast (George: coldest month 12.7-13.8 °C by dataset, record minimum 3-5 °C) is a
  // warm-area site on either reading, never a hard-frost one.
  const lightFrostAtMost = f.tropical || frostFree
    || (f.coldestMonthC >= LIGHT_FROST_COLDEST_MONTH_C && meanClearsFrost);
  return lightFrostAtMost ? 'mild-frost' : 'summer';
}

export interface SowingCalendarChoice {
  /** The catalog column this climate is read against. */
  pattern: AtlasRainPattern;
  /** When the rain falls. Storage sizing and rain labels read THIS, never `pattern`. */
  rainSeason: RainSeason;
  /**
   * Another column this site would get if its readings moved by no more than two
   * gridded records typically disagree — null when the choice is clear either way.
   * Shown to the grower as "close to the line", never used to pick a month.
   */
  closeCall: AtlasRainPattern | null;
  /**
   * The next WARMER column (hard frost → light frost → hot, frost-free), when the site is
   * within the same tolerance of it. The rule itself never moves a site there — it leans
   * cold — but a grower who has not seen frost on their own ground can
   * (lib/site-climate.ts calendarForGrower).
   */
  warmerNeighbour: AtlasRainPattern | null;
  /** The readings the choice rests on, for the screen to show in plain numbers. */
  coldestMonthC: number;
  hottestMonthC: number;
  recordMinC: number | null;
  summerRainShare: number;
}

export function sowingCalendarFor(c: MonthlyClimate, koppen: KoppenResult): SowingCalendarChoice {
  const map = c.precipMm.reduce((s, p) => s + p, 0);
  const summer = summerMonthIndices(c.lat);
  const pSummer = summer.reduce((s, m) => s + c.precipMm[m], 0);
  const recordMinC = typeof c.recordMinC === 'number' && Number.isFinite(c.recordMinC) ? c.recordMinC : null;
  const facts: CalendarFacts = {
    coldestMonthC: Math.min(...c.tempC),
    hottestMonthC: Math.max(...c.tempC),
    summerRainShare: map > 0 ? pSummer / map : 1,
    arid: koppen.group === 'B',
    tropical: koppen.group === 'A',
    recordMinC,
  };
  const pattern = calendarFromFacts(facts);

  // Colder and drier-side readings are tried first, so a site with two neighbours is
  // told about the colder one.
  const nudges: Partial<CalendarFacts>[] = [
    { coldestMonthC: facts.coldestMonthC - CLOSE_CALL_MEAN_C },
    ...(recordMinC === null ? [] : [{ recordMinC: recordMinC - CLOSE_CALL_RECORD_MIN_C }]),
    { hottestMonthC: facts.hottestMonthC - CLOSE_CALL_MEAN_C },
    { summerRainShare: facts.summerRainShare - CLOSE_CALL_RAIN_SHARE },
    { coldestMonthC: facts.coldestMonthC + CLOSE_CALL_MEAN_C },
    ...(recordMinC === null ? [] : [{ recordMinC: recordMinC + CLOSE_CALL_RECORD_MIN_C }]),
    { hottestMonthC: facts.hottestMonthC + CLOSE_CALL_MEAN_C },
    { summerRainShare: facts.summerRainShare + CLOSE_CALL_RAIN_SHARE },
    // Both monthly means together, colder then warmer. Two gridded records usually
    // differ by an offset in every month, not in the coldest month alone, so a site can
    // sit inside the tolerance of a line that needs BOTH readings to move: Eshowe
    // (coldest 15.1 °C against 16, hottest 23.9 °C against 24) reaches the hot-area
    // column when every month is one degree warmer, and the single-reading nudges above
    // never say so (independent review of 11 November 2026, Argon F-07 reproduced by
    // Codex). These come last, so they can only name a neighbour the nudges above
    // missed; no threshold changes and no site's own calendar changes. Measured on the
    // 100 recorded South African places: Eshowe is the only one affected.
    { coldestMonthC: facts.coldestMonthC - CLOSE_CALL_MEAN_C, hottestMonthC: facts.hottestMonthC - CLOSE_CALL_MEAN_C },
    { coldestMonthC: facts.coldestMonthC + CLOSE_CALL_MEAN_C, hottestMonthC: facts.hottestMonthC + CLOSE_CALL_MEAN_C },
  ];
  let closeCall: AtlasRainPattern | null = null;
  let warmerNeighbour: AtlasRainPattern | null = null;
  for (const nudge of nudges) {
    const other = calendarFromFacts({ ...facts, ...nudge });
    if (other === pattern) continue;
    closeCall ??= other;
    if (pattern !== 'winter' && other !== 'winter' && WARMTH_RANK[other] > WARMTH_RANK[pattern]) warmerNeighbour ??= other;
  }

  const rainSeason: RainSeason = facts.summerRainShare >= SUMMER_RAIN_SHARE ? 'summer'
    : facts.summerRainShare <= WINTER_RAIN_SHARE ? 'winter' : 'all-year';
  return {
    pattern, rainSeason, closeCall, warmerNeighbour,
    coldestMonthC: facts.coldestMonthC, hottestMonthC: facts.hottestMonthC,
    recordMinC, summerRainShare: facts.summerRainShare,
  };
}

export function rainPatternFor(c: MonthlyClimate, koppen: KoppenResult): AtlasRainPattern {
  return sowingCalendarFor(c, koppen).pattern;
}
