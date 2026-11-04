import { createHash, randomBytes } from 'crypto';

export const SCOPES = {
  'field:read': 'Read selected sites, designs, surveys, evidence and render progress',
  'field:write': 'Edit site notes and existing feature labels/status, and attach original files',
  'field:org': 'Read permitted organisation production observations and summaries',
  'field:operator': 'Read platform health and manage the AI map kill switch (platform owner only)',
} as const;
export type Scope = keyof typeof SCOPES;
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
export function record(v: unknown): Record<string, any> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Expected an object.');
  return v as Record<string, any>;
}
export function identifier(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9:_.,-]{1,160}$/.test(v) || ['__proto__', 'constructor', 'prototype'].includes(v)) fail('Invalid identifier.');
  return v;
}
export function scopes(input?: string[]): Scope[] {
  const values = input?.length ? [...new Set(input)] : ['field:read'];
  if (values.some(v => !Object.prototype.hasOwnProperty.call(SCOPES, v))) fail('Unsupported permission.');
  if (!values.includes('field:read')) values.unshift('field:read');
  return values as Scope[];
}
export function safeRedirect(raw: string): boolean {
  try {
    const u = new URL(raw);
    return !u.username && !u.password && !u.hash && (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(u.hostname)));
  } catch { return false; }
}
export function siteId(place: { lat: number; lon: number }): string { return `site:${place.lat.toFixed(5)},${place.lon.toFixed(5)}`; }
export function parseStore(raw: unknown): Record<string, any> {
  if (typeof raw !== 'string') return {};
  try { return record(JSON.parse(raw)); } catch { return {}; }
}
export function assertSite(grant: { siteIds: string[] }, id: string): void {
  identifier(id);
  if (!grant.siteIds.includes(id)) fail('This site was not authorised for this connection.', 403);
}
export function originalType(bytes: Buffer, mime: string): boolean {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) return false;
  if (mime === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
}
export function provenance(value: unknown) {
  const p = record(value);
  if (!['local_file', 'authorised_connector', 'public_archive'].includes(p.kind) || typeof p.reference !== 'string' || !p.reference.trim() || p.reference.length > 1500 || typeof p.authorisation !== 'string' || !p.authorisation.trim() || p.authorisation.length > 1000) fail('Record the actual source reference and the user’s authorisation to import it.');
  if (p.sourceUrl !== undefined) {
    const u = new URL(p.sourceUrl);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) fail('Source URL must be HTTPS without credentials, query tokens or a fragment.');
  }
  return { kind: p.kind as string, reference: p.reference as string, authorisation: p.authorisation as string, ...(p.sourceUrl ? { sourceUrl: p.sourceUrl as string } : {}) };
}
