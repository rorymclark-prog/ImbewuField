import { canSeeOrg, type AccessGranted } from './network-access';
import { melCan, type MelPermission } from './mel';
/** A physical garden is counted once, by its stable NGO site code. These are NGO
 * observations, not surveyed boundaries or independently verified impact. */
export type ProductionSite = { code: string; name: string; observedOn: string; vegetableM2: number; stapleM2: number; boundaryM2: number | null; evidence: string; published: boolean; updatedAt: string; updatedBy: string };
export function validProductionSite(value: unknown, today: string): value is ProductionSite {
  if (!value || typeof value !== 'object') return false;
  const s = value as ProductionSite;
  return typeof s.code === 'string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(s.code)
    && typeof s.name === 'string' && s.name.trim().length > 0 && s.name.length <= 160
    && typeof s.observedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.observedOn)
    && Number.isFinite(Date.parse(s.observedOn)) && new Date(s.observedOn).toISOString().slice(0, 10) === s.observedOn && s.observedOn <= today
    && [s.vegetableM2, s.stapleM2].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000000)
    && (s.boundaryM2 === null || typeof s.boundaryM2 === 'number' && Number.isFinite(s.boundaryM2) && s.boundaryM2 > 0 && s.boundaryM2 <= 100000000 && s.vegetableM2 + s.stapleM2 <= s.boundaryM2)
    && typeof s.evidence === 'string' && s.evidence.trim().length >= 10 && s.evidence.length <= 1500
    && typeof s.published === 'boolean';
}
export function productionAreaSummary(rows: readonly ProductionSite[], publishedOnly = false) {
  const unique = new Map<string, ProductionSite>();
  for (const row of rows) { const old = unique.get(row.code); if (!old || old.updatedAt < row.updatedAt) unique.set(row.code, row); }
  const sites = [...unique.values()].filter(s => !publishedOnly || s.published);
  const vegetableM2 = sites.reduce((sum, s) => sum + s.vegetableM2, 0);
  const stapleM2 = sites.reduce((sum, s) => sum + s.stapleM2, 0);
  const dates = sites.map(s => s.observedOn).sort();
  return { sites: sites.length, vegetableM2, stapleM2, combinedM2: vegetableM2 + stapleM2, hectares: (vegetableM2 + stapleM2) / 10000, firstObserved: dates[0] ?? null, lastObserved: dates.at(-1) ?? null };
}

export function productionAreaAccess(access: AccessGranted, org: string, permission: MelPermission | null, funderEnabled: boolean, preview: boolean) {
  if (!org || org.includes('/') || !canSeeOrg(access, org)) return null;
  const publishedOnly = access.role === 'funder' || preview;
  if (publishedOnly && !funderEnabled) return null;
  const manage = ['ngo', 'admin'].includes(access.role) && melCan(access.role, permission, 'manage');
  if (!publishedOnly && !manage && !melCan(access.role, permission, 'analyse')) return null;
  return { publishedOnly, manage: manage && !publishedOnly };
}
