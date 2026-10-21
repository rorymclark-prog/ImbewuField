import { reportDocumentText } from './report-localisation';
/**
 * report-risk.ts — the risk register.
 *
 * ── WHY EVERY RATING STATES ITS OWN TRIGGER ─────────────────────────────────────────────────
 * A risk register normally rates likelihood High/Medium/Low, and those three words are exactly
 * the kind of confident-looking judgement this app must not manufacture. So no risk is rated by
 * feel: each one has a THRESHOLD written into the code, and the register prints the threshold
 * and this site's actual figure beside the rating. A reader who disagrees with the rating can
 * see precisely what produced it and argue with the number instead of the adjective.
 *
 * A risk whose trigger did not fire does not appear. The register lists what this site's own
 * data raises, not the standard list of things that can go wrong on a farm.
 */

import type { ReportSiteFacts } from '@/lib/report-site-facts';

export type RiskRating = 'High' | 'Medium' | 'Low';

export interface RiskRow {
  id: string;
  risk: string;
  /** The data that raised it, with the threshold that decided the rating. */
  trigger: string;
  likelihood: RiskRating;
  impact: RiskRating;
  mitigation: string;
}

export interface RiskInput {
  facts: ReportSiteFacts | null | undefined;
  rainfallMm: number;
  slopeDeg: number;
  minTempC?: number;
  soilSource?: 'lab' | 'soilgrids' | 'estimate';
  /** How many BOQ lines carry a quantity but no rate. */
  unpricedBoqLines: number;
}

/** Thresholds, named so the register can print them. */
const DRY_SITE_MM = 500;
const STEEP_SLOPE_DEG = 10;
const MODERATE_SLOPE_DEG = 5;
const FROST_MIN_C = 5;

export function buildRiskRegister(input: RiskInput, language = 'en'): RiskRow[] {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  const rows: RiskRow[] = [];
  const { facts } = input;
  const add = (row: Omit<RiskRow, 'id'>): void => {
    rows.push({ id: `R${rows.length + 1}`, ...row });
  };

  // ── Water ──
  const storage = facts?.water?.statedStorageLitres ?? 0;
  if (input.rainfallMm > 0 && input.rainfallMm < DRY_SITE_MM) {
    add({
      risk: t('Dry-season crop failure from insufficient stored water'),
      trigger: t('{rainfall} mm/yr, below the {threshold} mm threshold this register uses for a water-limited site',{rainfall:input.rainfallMm,threshold:DRY_SITE_MM}),
      likelihood: 'High',
      impact: 'High',
      mitigation: t('Build storage before expanding planted area. Size the tanks against the roof catchment figure in the water section, and plant the dry months from stored water only.'),
    });
  }
  // "Nothing to store it in" must mean genuinely NOTHING. `storage` is the sum of STATED tank
  // capacities only (FactWater.statedStorageLitres never guesses an unknown one into the total),
  // so a farm with one tank of unrecorded size also has storage === 0 — but it does have
  // something to gutter the roof into, and the very next check below already raises "tank sizes
  // are not recorded" for exactly that case. Firing both told a farmer in one row that they had
  // nothing to store water in and, in the next, that their tank's size just was not recorded —
  // two rows of the same register disagreeing about whether a tank exists.
  const hasAnyTank = (facts?.water?.tanks.length ?? 0) > 0;
  if (storage === 0 && !hasAnyTank && facts?.roof && facts.roof.areaM2 > 0) {
    add({
      risk: t('Roof runoff is lost — catchment traced but nothing to store it in'),
      trigger: t('{area} m² of roof traced and 0 L of tank capacity on the plan',{area:Math.round(facts.roof.areaM2)}),
      likelihood: 'High',
      impact: 'Medium',
      mitigation: t('Gutter the traced roof and connect it to a tank. This is the cheapest water on the site and it is currently running onto the ground.'),
    });
  }
  const unknownTanks = facts?.water?.tanksOfUnknownCapacity ?? 0;
  if (unknownTanks > 0) {
    add({
      risk: t('Storage cannot be planned — tank sizes are not recorded'),
      trigger: t(unknownTanks===1?'{count} tank on the plan with no stated capacity':'{count} tanks on the plan with no stated capacity',{count:unknownTanks}),
      likelihood: 'Medium',
      impact: 'Medium',
      mitigation: t('Measure or read the capacity off each tank and record it. Every dry-season calculation in this report depends on it.'),
    });
  }

  // ── Land ──
  if (input.slopeDeg >= STEEP_SLOPE_DEG) {
    add({
      risk: t('Soil loss from runoff on the slope'),
      trigger: t('{slope}° slope, at or above the {threshold}° threshold',{slope:input.slopeDeg,threshold:STEEP_SLOPE_DEG}),
      likelihood: 'High',
      impact: 'High',
      mitigation: t('Keep the ground covered at all times, and put earthworks on contour above the growing area before breaking any more soil.'),
    });
  } else if (input.slopeDeg >= MODERATE_SLOPE_DEG) {
    add({
      risk: t('Runoff carries water and topsoil off the growing area'),
      trigger: t('{slope}° slope, between the {lower}° and {upper}° thresholds',{slope:input.slopeDeg,lower:MODERATE_SLOPE_DEG,upper:STEEP_SLOPE_DEG}),
      likelihood: 'Medium',
      impact: 'Medium',
      mitigation: t('Mulch the beds and slow runoff on contour. Watch the ground after the first heavy rain and record where water actually runs.'),
    });
  }
  if (input.minTempC !== undefined && input.minTempC < FROST_MIN_C) {
    add({
      risk: t('Frost damage to tender crops and young trees'),
      trigger: t('minimum {temperature} °C, below the {threshold} °C threshold',{temperature:Math.round(input.minTempC),threshold:FROST_MIN_C}),
      likelihood: 'Medium',
      impact: 'Medium',
      mitigation: t('Keep tender crops off the lowest ground, where cold air settles. Plant frost-sensitive trees after the last frost date, not before.'),
    });
  }

  // ── The data the report itself stands on ──
  if (input.soilSource !== 'lab') {
    add({
      risk: t('Soil recommendations are built on modelled soil, not this field'),
      trigger: input.soilSource === 'soilgrids'
        ? t('soil figures come from a district-wide model, not a sample taken here')
        : t('no soil data for this point — the app\'s generic defaults were used'),
      likelihood: 'High',
      impact: 'Medium',
      mitigation: t('Take one soil sample and send it for a test. It is the cheapest way to replace every estimated soil figure in this report with a measured one.'),
    });
  }
  if (!facts?.boundary) {
    add({
      risk: t('Every area figure is provisional — no property boundary was traced'),
      trigger: t('no traced boundary on the map'),
      likelihood: 'Medium',
      impact: 'Medium',
      mitigation: t('Walk and trace the boundary. Until then, treat site area, and anything divided by it, as unconfirmed.'),
    });
  }
  if (input.unpricedBoqLines > 0) {
    add({
      risk: t('The build costs more than the bill of quantities shows'),
      trigger: t(input.unpricedBoqLines===1?'{count} measured line in the bill carry no rate':'{count} measured lines in the bill carry no rate',{count:input.unpricedBoqLines}),
      likelihood: 'High',
      impact: 'Medium',
      mitigation: t('Get local quotes for the unpriced lines before committing a budget. The subtotal in the cost section is a floor, not a total.'),
    });
  }
  if (!facts?.crop || facts.crop.plantingCount === 0) {
    add({
      risk: t('No crop plan — the growing area has no sowing schedule behind it'),
      trigger: t('nothing entered in the crop planner'),
      likelihood: 'Medium',
      impact: 'High',
      mitigation: t('Build the crop plan before the next sowing window. Beds without a plan sit empty through the months that matter.'),
    });
  }

  return rows;
}

export function riskRegisterMarkdown(rows: RiskRow[], language = 'en'): string {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  const out: string[] = [`## ${t('Risk Register')}`, ''];
  if (!rows.length) {
    out.push(t('No risk in this register\'s rule set was triggered by this site\'s data. That is not the same as no risk — it means the specific thresholds this report checks (rainfall, slope, frost, soil basis, traced boundary, unpriced work, crop plan) were all clear.'));
    out.push('');
    return out.join('\n');
  }
  out.push(t('Each row was raised by this site\'s own data. The trigger column prints the figure and the threshold that produced the rating, so a reader who disagrees can argue with the number rather than the adjective.'));
  out.push('');
  out.push(`| # | ${t('Risk')} | ${t('What raised it')} | ${t('Likelihood')} | ${t('Impact')} | ${t('What to do about it')} |`);
  out.push('|---|------|----------------|------------|--------|---------------------|');
  for (const r of rows) {
    out.push(`| ${r.id} | ${r.risk} | ${r.trigger} | ${t(r.likelihood)} | ${t(r.impact)} | ${r.mitigation} |`);
  }
  out.push('');
  return out.join('\n');
}
