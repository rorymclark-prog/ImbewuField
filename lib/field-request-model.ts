import { productionAreaSummary } from './production-sites';
export type FieldWrite = { url: string; body: Record<string, any>; operationId: string; label: string; createdAt: number; state: 'waiting' | 'sending' | 'review'; leaseUntil: number; error?: string; acknowledged?: boolean };
export const FIELD_CHANGED = 'imbewu:fieldwork-changed';
export const FIELD_SYNCED = 'imbewu:fieldwork-synced';
export const DEVICE_SAVE_NOTICE = 'Saved on this device, including attached photos and signatures. Waiting to send when connected.';
const READ_PATHS = new Set(['/api/field-teams', '/api/programme-evidence', '/api/production-sites', '/api/assessments', '/api/network/orgs', '/api/network/farmers']);
export function fieldUrl(raw: string) {
  const url = new URL(raw, 'https://field.local');
  if (url.origin !== 'https://field.local' || !READ_PATHS.has(url.pathname)) throw Error('This service is not available for device saving.');
  url.searchParams.sort(); return url.pathname + url.search;
}
export function writeIdentity(url: string, body: Record<string, any>): { resource: string; label: string } | null {
  const path = new URL(url, 'https://field.local').pathname;
  if (path === '/api/field-teams' && body.action === 'visit' && typeof body.id === 'string') return { resource: body.id, label: `Visit · ${body.date ?? ''}` };
  if (path === '/api/programme-evidence' && ['session', 'milestone'].includes(body.action) && typeof body[body.action]?.id === 'string') return { resource: body.action + ':' + body[body.action].id, label: body[body.action].title || (body.action === 'session' ? 'Training register' : 'Programme indicator') };
  if (path === '/api/production-sites' && typeof body.site?.code === 'string') return { resource: body.site.code, label: body.site.name || 'Garden observation' };
  if (path === '/api/assessments' && body.action === 'respond' && typeof body.id === 'string') return { resource: body.id, label: 'Assessment response' };
  return null;
}
export function queuedResult(write: FieldWrite) {
  const b = write.body;
  return { saved: false, queued: true, ...(b.action === 'visit' ? { visit: { ...b, _pending: true, photos: b.photos ?? [], updatedAt: b.expectedUpdatedAt ?? '' } } : {}) };
}
export function overlayFieldWrites(url: string, original: any, writes: FieldWrite[]) {
  const u = new URL(url, 'https://field.local'), out = structuredClone(original);
  for (const w of writes) {
    const target = new URL(w.url, 'https://field.local');
    if (u.pathname !== target.pathname || (u.searchParams.get('org') ?? '') !== (target.searchParams.get('org') ?? '')) continue;
    const b = w.body, stamp = new Date(w.createdAt).toISOString();
    if (u.searchParams.get('mode') === 'photos') {
      const row = b.action === 'session' ? b.session : b;
      if (row?.id === u.searchParams.get('id')) out.photos = row.photos ?? [];
    } else if (b.action === 'visit' && Array.isArray(out.visits)) {
      out.visits = [...out.visits.filter((v: any) => v.id !== b.id), { ...b, _pending: !w.acknowledged, updatedAt: b.expectedUpdatedAt ?? '', photoCount: b.photos?.length ?? 0 }];
    } else if (b.action === 'session' && Array.isArray(out.sessions)) {
      const s = b.session;
      out.sessions = [...out.sessions.filter((v: any) => v.id !== s.id), { ...s, _pending: !w.acknowledged, updatedAt: b.expectedUpdatedAt ?? '', presentCount: s.attendance.filter((a: any) => a.present).length, registeredCount: s.attendance.length, photoCount: s.photos.length }];
    } else if (b.action === 'milestone' && Array.isArray(out.milestones)) {
      out.milestones = [...out.milestones.filter((v: any) => v.id !== b.milestone.id), { ...b.milestone, _pending: !w.acknowledged, updatedAt: b.expectedUpdatedAt ?? '' }];
    } else if (b.site && Array.isArray(out.sites)) {
      out.sites = [...out.sites.filter((v: any) => v.code !== b.site.code), { ...b.site, _pending: !w.acknowledged, updatedAt: b.expectedUpdatedAt ?? '', updatedBy: '' }];
      out.summary = productionAreaSummary(out.sites);
    } else if (b.action === 'respond' && Array.isArray(out.assessments)) {
      out.assessments = out.assessments.map((a: any) => a.id === b.id ? { ...a, response: { answers: b.answers, language: b.language, consent: b.consent, submittedAt: b.expectedSubmittedAt ?? stamp } } : a);
    }
  }
  return out;
}

export function fieldDataReportNote(data: any): string | null {
  const status=data?._device;
  const pending=status?.pending || ['visits','sessions','milestones','sites'].some(key=>Array.isArray(data?.[key])&&data[key].some((row:any)=>row._pending));
  if(!status?.cached&&!pending)return null;
  return [status?.cached?`Uses information saved on this device${status.savedAt?` on ${new Date(status.savedAt).toISOString()}`:''}.`:null,pending?'Includes device-saved changes not yet confirmed by the server.':null].filter(Boolean).join(' ');
}
