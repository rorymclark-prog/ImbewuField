import { reportDocumentText } from './report-localisation';
/**
 * report-risk.ts — the risk register.
 *
 * Ratings retain their recorded triggers so the reader can inspect their basis.
 * An annual rainfall total does not establish seasonal supply, crop demand or
 * storage needs. Keep that evidence gap outside the rated rows, even at zero.
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
  /** Retained for callers; annual rainfall alone cannot produce a risk rating. */
  rainfallMm: number | null;
  slopeDeg: number;
  /** Retained for old callers; a record low does not establish farm frost risk. */
  minTempC?: number;
  soilSource?: 'lab' | 'soilgrids' | 'estimate';
  /** How many BOQ lines carry a quantity but no rate. */
  unpricedBoqLines: number;
}

/** Thresholds, named so the register can print them. */
const STEEP_SLOPE_DEG = 10;
const MODERATE_SLOPE_DEG = 5;

export function buildRiskRegister(input: RiskInput, language = 'en'): RiskRow[] {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  const rows: RiskRow[] = [];
  const { facts } = input;
  const add = (row: Omit<RiskRow, 'id'>): void => {
    rows.push({ id: `R${rows.length + 1}`, ...row });
  };

  // ── Water ──
  const storage = facts?.water?.statedStorageLitres ?? 0;
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
  // Farm frost observations remain in the survey evidence. A grid record low cannot
  // supply a likelihood rating or a last-frost date for this register.


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

/** Shared report evidence statement; no translated safety claim is invented here. */
export function reportWaterEvidence(rainfallMm: number | null): string {
  const annual = typeof rainfallMm === 'number' && Number.isFinite(rainfallMm) && rainfallMm >= 0
    ? `${rainfallMm} mm/year` : 'unknown';
  return `Annual rainfall: ${annual}. Crop water demand, seasonal water supply and water adequacy have not been assessed. Annual rainfall alone does not establish dry-season crop-failure risk or required storage capacity.`;
}

export function riskRegisterMarkdown(rows: RiskRow[], language = 'en', rainfallMm: number | null = null): string {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  // The new evidence statement has no reviewed translations. Make the English
  // fallback visible rather than reusing the retired translated risk judgement.
  const label = language === 'en' ? 'Water evidence' : 'Water evidence (English; translation pending)';
  const out: string[] = [`## ${t('Risk Register')}`, '', `**${label}:** ${reportWaterEvidence(rainfallMm)}`, ''];
  if (!rows.length) {
    out.push('No risk rows were produced from the available inputs. Missing evidence and farm frost conditions have not been assessed; this is not a finding of low risk.');
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
