import type { GardenStatus } from '@/lib/db/types';

/* w20-39: one status palette for the /network list dots and the map pins + legend, so the two
 * never disagree. Theme tokens, not hexes, so both follow earth light/dark. */
export const NETWORK_STATUS_COLOR: Record<GardenStatus, string> = {
  thriving: 'var(--emerald)',
  establishing: 'var(--gold)',
  support: 'var(--orange)',
};
