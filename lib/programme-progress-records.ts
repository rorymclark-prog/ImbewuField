'use client';
import { fieldDataReportNote } from './field-request-model';
import { fieldApi } from './field-api';
import { isSampleMode } from './sample-mode';
import { completeSampleAreas, freshSampleAreas, sampleRead } from './sample-operations';
import { productionAreaSummary } from './production-sites';
import { DEMO_NETWORK } from './network-demo';
import { programmeRecordMetrics, type ProgrammeRecords } from './programme-progress';

export async function loadProgrammeProgressRecords(org: string, funder: boolean, sample: boolean): Promise<ProgrammeRecords> {
  if (sample !== isSampleMode()) throw Error('The workspace changed. Reopen project progress.');
  if (sample) {
    const areas = productionAreaSummary(completeSampleAreas(sampleRead('areas', freshSampleAreas)), funder);
    const records = programmeRecordMetrics(DEMO_NETWORK.farmers, areas);
    records.notes.unshift('Area comes from the 18-garden catalogue; production and finances come from the separate farmer portfolio. Their coverage differs.');
    return records;
  }
  async function get(url: string) {
    return fieldApi(url);
  }
  // Existing endpoints apply consent, organisation access and publication rules.
  // Failure in one register does not replace it with sample values or zero totals.
  const [portfolio, areas] = await Promise.allSettled([
    get(`/api/network/farmers?org_id=${encodeURIComponent(org)}`),
    get(`/api/production-sites?org=${encodeURIComponent(org)}${funder ? '&published=true' : ''}`),
  ]);
  const records = programmeRecordMetrics(
    portfolio.status==='fulfilled' && Array.isArray(portfolio.value.farmers) ? portfolio.value.farmers : null,
    areas.status==='fulfilled' ? areas.value.summary ?? null : null,
    portfolio.status==='fulfilled' ? portfolio.value.withheldForConsent ?? 0 : 0,
  );
  for(const source of [portfolio,areas])if(source.status==='fulfilled'){const note=fieldDataReportNote(source.value);if(note)records.notes.push(note);}
  if (portfolio.status==='rejected') records.errors.push(`Production and finance records: ${portfolio.reason instanceof Error ? portfolio.reason.message : 'unavailable'}`);
  if (areas.status==='rejected') records.errors.push(`Production area records: ${areas.reason instanceof Error ? areas.reason.message : 'unavailable'}`);
  return records;
}
