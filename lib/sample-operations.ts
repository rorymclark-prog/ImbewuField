import { buildDemoDesignCanvasState, DEMO_SITE } from './demo-farm';
import { bedsFromDesignCanvas } from './design-beds-bridge';
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
  const beds = bedsFromDesignCanvas(buildDemoDesignCanvasState());
  return [{ code: 'ubhejane-example', name: `${DEMO_SITE.name} · illustrative layout`, observedOn: '2026-09-01',
    vegetableM2: beds.filter(b => b.kind !== 'plot').reduce((n, b) => n + b.areaM2, 0),
    stapleM2: beds.filter(b => b.kind === 'plot').reduce((n, b) => n + b.areaM2, 0), boundaryM2: null,
    evidence: 'Demo only: areas calculated from the saved sample design. This is not a surveyed or verified observation of the real crèche.',
    published: true, updatedAt: '2026-09-01', updatedBy: 'sample-organisation' }];
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
