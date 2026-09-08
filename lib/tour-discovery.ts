/** Count document openings, not route changes or React's repeated effect setup. */
export const TOUR_INVITATION_LIMIT = 30;
export type TourDiscovery = { openings: number; menuTipDismissed: boolean };
const launches = new Map<string, TourDiscovery>();
export function recordTourOpening(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string): TourDiscovery {
  const current = launches.get(key);
  if (current) return current;
  let previous: Partial<TourDiscovery> = {};
  try { previous = JSON.parse(storage.getItem(key) || '{}') ?? {}; } catch { /* Start fresh if preferences are unreadable. */ }
  const count = Number.isInteger(previous.openings) && Number(previous.openings) >= 0 ? Number(previous.openings) : 0;
  const next = { openings: Math.min(TOUR_INVITATION_LIMIT + 1, count + 1), menuTipDismissed: previous.menuTipDismissed === true };
  try { storage.setItem(key, JSON.stringify(next)); } catch { /* The tour remains usable without storage. */ }
  launches.set(key, next);
  return next;
}
export function dismissTourMenuTip(storage: Pick<Storage, 'setItem'>, key: string, state: TourDiscovery) {
  const next = { ...state, menuTipDismissed: true };
  launches.set(key, next);
  try { storage.setItem(key, JSON.stringify(next)); } catch { /* Still dismiss for this opening. */ }
  return next;
}
