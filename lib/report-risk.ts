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
  /** Recorded estimate only; slope alone does not establish runoff/erosion risk. */
  slopeDeg: number;
  /** Retained for old callers; a record low does not establish farm frost risk. */
  minTempC?: number;
  soilSource?: 'lab' | 'soilgrids' | 'estimate';
  /** How many BOQ lines carry a quantity but no rate. */
  unpricedBoqLines: number;
}


export function buildRiskRegister(input: RiskInput, language = 'en'): RiskRow[] {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  const rows: RiskRow[] = [];
  const { facts } = input;
  const add = (row: Omit<RiskRow, 'id'>): void => {
    rows.push({ id: `R${rows.length + 1}`, ...row });
  };

  // ── Water ──

  // A missing tank on a drawing is not a complete inventory, runoff observation
  // or cost comparison. The shared unrated earthworks note keeps this limit visible.
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

  // Slope remains visible in the shared unrated evidence note below. The old
  // 5°/10° bands disagreed with the document and had no site-risk evidence.
  // Farm frost observations remain in the survey evidence. A grid record low cannot
  // supply a likelihood rating or a last-frost date for this register.


  // ── The data the report itself stands on ──
  // A source label alone does not support a soil-health/risk grade or treatment.
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

/** New evidence copy remains visibly English until its translation is reviewed. */
export function reportEvidenceText(text: string, language = 'en'): string {
  return language === 'en' ? text : `English; translation pending: ${text}`;
}

export function reportSoilEvidence(source: unknown, language = 'en'): string {
  const recorded = source === 'lab' ? 'laboratory attribution; original report and sample/site correspondence not verified here'
    : source === 'soilgrids' ? 'SoilGrids model, not a field sample'
      : source === 'estimate' ? 'generic app placeholders, not field evidence' : 'not known';
  return reportEvidenceText(`Recorded soil source: ${recorded}. Soil health, compaction, amendment needs and risk likelihood/impact have not been assessed. Review the original results and sampling method, depth and date for the intended crop and field conditions before choosing treatment. Comparative costs have not been assessed.`, language);
}

export function reportEarthworksEvidence(language = 'en'): string {
  return reportEvidenceText('Earthwork suitability, dimensions, construction order, timing and comparative costs have not been assessed. Missing map entries do not prove physical absence. Recorded features and proposals are not a site-design approval. Confirm contour, drainage, soil/infiltration, safe overflow and local design requirements before selecting work.', language);
}

/** Provider outages and older saved records can violate the declared numeric type.
 * Keep fields independent: below-sea-level elevation and a genuine zero are valid
 * recorded estimates, while absent direction cannot justify an orientation claim. */
export function reportTerrainValues(input: {
  elevation?: unknown; slopeDeg?: unknown; slopePct?: unknown; aspectLabel?: unknown;
} | null | undefined): {
  elevationM: number | undefined; slopeDeg: number | undefined;
  slopePct: number | undefined; aspectLabel: string | undefined;
} {
  return {
    elevationM: typeof input?.elevation === 'number' && Number.isFinite(input.elevation) ? input.elevation : undefined,
    slopeDeg: reportSlopeEvidence(input?.slopeDeg).recordedSlope,
    slopePct: typeof input?.slopePct === 'number' && Number.isFinite(input.slopePct) && input.slopePct >= 0 ? input.slopePct : undefined,
    // The elevation producer explicitly uses an em dash when its relief does
    // not support a direction. Do not turn that sentinel into a facing claim.
    aspectLabel: typeof input?.aspectLabel === 'string' && input.aspectLabel.trim()
      && !['—', 'unknown', 'not known'].includes(input.aspectLabel.trim().toLowerCase()) ? input.aspectLabel : undefined,
  };
}

/** Shared by the risk register and the instant document. A recorded model value
 * is not a runoff model, erosion observation or earthworks suitability check. */
export function reportSlopeEvidence(slopeDeg: unknown, language = 'en'): { recordedSlope: number | undefined; runoffRisk: string; erosionRisk: string } {
  const recordedSlope = typeof slopeDeg === 'number' && Number.isFinite(slopeDeg) && slopeDeg >= 0 && slopeDeg <= 90
    ? slopeDeg : undefined;
  const recorded = recordedSlope === undefined ? 'unknown' : `${recordedSlope}°`;
  return {
    recordedSlope,
    runoffRisk: reportEvidenceText(`Recorded slope estimate: ${recorded}. Runoff risk has not been assessed. Confirm drainage, soil, ground cover and observed water flow before planning earthworks.`, language),
    erosionRisk: reportEvidenceText('Erosion risk has not been assessed. A slope estimate alone does not establish soil-loss likelihood or impact.', language),
  };
}

export function riskRegisterMarkdown(rows: RiskRow[], language = 'en', rainfallMm: number | null = null, slopeDeg?: unknown, soilSource?: unknown): string {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  // The new evidence statement has no reviewed translations. Make the English
  // fallback visible rather than reusing the retired translated risk judgement.
  const label = language === 'en' ? 'Water evidence' : 'Water evidence (English; translation pending)';
  const slopeLabel = language === 'en' ? 'Slope evidence' : 'Slope evidence (English; translation pending)';
  const slope = reportSlopeEvidence(slopeDeg);
  const out: string[] = [`## ${t('Risk Register')}`, '', `**${label}:** ${reportWaterEvidence(rainfallMm)}`, '',
    `**${slopeLabel}:** ${slope.runoffRisk} ${slope.erosionRisk}`, '',
    `**Soil evidence${language === 'en' ? '' : ' (English; translation pending)'}:** ${reportSoilEvidence(soilSource)}`, '',
    `**Earthworks evidence${language === 'en' ? '' : ' (English; translation pending)'}:** ${reportEarthworksEvidence()}`, ''];
  if (!rows.length) {
    out.push('No risk rows were produced from the available inputs. Missing evidence and farm frost conditions have not been assessed; this is not a finding of low risk.');
    out.push('');
    return out.join('\n');
  }
  out.push(`${language === 'en' ? '' : 'English; translation pending: '}These rows identify recorded inputs and gaps to review. Retained ratings are qualitative rule outputs, not measured probabilities or a complete site-risk assessment.`);
  out.push('');
  out.push(`| # | ${t('Risk')} | ${t('What raised it')} | ${t('Likelihood')} | ${t('Impact')} | ${t('What to do about it')} |`);
  out.push('|---|------|----------------|------------|--------|---------------------|');
  for (const r of rows) {
    out.push(`| ${r.id} | ${r.risk} | ${r.trigger} | ${t(r.likelihood)} | ${t(r.impact)} | ${r.mitigation} |`);
  }
  out.push('');
  return out.join('\n');
}
