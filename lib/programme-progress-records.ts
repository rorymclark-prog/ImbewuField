'use client';
import { paidApiHeaders } from './api-client-auth';
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
    records.notes.unshift('Fictional examples: area comes from the 18-garden catalogue; production and finances come from the separate sample farmer portfolio. Their coverage differs.');
    return records;
  }
  async function get(url: string) {
    const response = await fetch(url, { headers: await paidApiHeaders(), cache:'no-store' });
    const body = await response.json();
    if (!response.ok) throw Error(body.error ?? 'Shared records could not be loaded.');
    return body;
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
  if (portfolio.status==='rejected') records.errors.push(`Production and finance records: ${portfolio.reason instanceof Error ? portfolio.reason.message : 'unavailable'}`);
  if (areas.status==='rejected') records.errors.push(`Production area records: ${areas.reason instanceof Error ? areas.reason.message : 'unavailable'}`);
  return records;
}
