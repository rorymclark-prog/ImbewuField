import { SAMPLE_GARDENS } from './sample-gardens';
import { isSampleMode } from './sample-mode';
import { validProductionSite, type ProductionSite } from './production-sites';

// The root sample storage shim makes these edits disposable. Every entry point
// also refuses outside sample mode, including stale event handlers after exit.
export function sampleRead<T>(key: string, fresh: () => T): T {
  if (!isSampleMode()) throw Error('Open a sample workspace first.');
  const saved = window.localStorage.getItem(`imbewu-sample-${key}`);
  return saved ? JSON.parse(saved) as T : fresh();
}
export function sampleWrite<T>(key: string, value: T): void {
  if (!isSampleMode()) throw Error('Open a sample workspace first.');
  window.localStorage.setItem(`imbewu-sample-${key}`, JSON.stringify(value));
}
export function freshSampleAreas(): ProductionSite[] {
  return SAMPLE_GARDENS.map(g => ({ code: g.id, name: g.name, observedOn: '2026-09-01',
    ...g.production, boundaryM2: g.areaM2 ?? null,
    evidence: `Fictional ${g.kind} allocation for ${g.town}. Planted beds exclude buildings, paths, trees and unused land. AI reference photos do not establish measured area.`,
    published: true, updatedAt: '2026-09-01', updatedBy: 'sample-organisation' }));
}
/** Upgrade the old one-garden seed without throwing away practice edits. */
export function completeSampleAreas(rows: ProductionSite[]): ProductionSite[] {
  const retained = rows.filter(s => !(s.code === 'ubhejane-example' && s.updatedAt === '2026-09-01'));
  const codes = new Set(retained.map(s => s.code));
  return [...retained, ...freshSampleAreas().filter(s => !codes.has(s.code))];
}

export function upsertSampleArea(rows: ProductionSite[], site: ProductionSite, today: string): ProductionSite[] {
  if (!validProductionSite(site, today)) throw Error('Check the date, areas, boundary and measurement evidence.');
  return [...rows.filter(s => s.code !== site.code), site];
}
export type SampleMessage = { id: string; from_name: string; from_uid: string; recipient: string; subject: string; body: string; status: 'unread' | 'read' | 'replied'; created_at: string; reply?: string };
export function freshSampleMessages(recipient: string): SampleMessage[] {
  return [
    { id: 'sample-visit', from_name: 'Sample farmer', from_uid: 'sample-farmer', recipient, subject: 'Help planning the next visit', body: 'Could we review the crop plan together during the next garden visit?', status: 'unread', created_at: '2026-09-01T09:00:00Z' },
    { id: 'sample-course', from_name: 'Sample student', from_uid: 'sample-student', recipient, subject: 'Course follow-up', body: 'I have completed my course assessment. Where can I find the next activity?', status: 'read', created_at: '2026-09-01T08:00:00Z' },
  ];
}
