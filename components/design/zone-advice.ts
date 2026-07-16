// Zone ADVICE — the guidance half of the hybrid. Lima's deterministic zone plan is turned
// into short spatial ADVICE the farmer reads and then draws themselves; geometry is never
// auto-committed. See docs/DISCOVERABILITY-SIMPLE-PLAN.md §1.3.

import type { DetectSuggestion } from '@/lib/design-canvas';

export interface ZoneAdvicePin {
  id: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
  /** Normalised centroid of the suggested ring (0..1) — for an optional on-canvas pin. */
  x: number;
  y: number;
  /** Lima's one-line reason, e.g. "Zone 1 — daily herbs by the kitchen door". */
  note: string;
}

function centroid(ring: Array<[number, number]>): [number, number] {
  if (ring.length === 0) return [0.5, 0.5];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

// Filter the deterministic suggestZones() output down to advice pins: zone + centroid +
// note. Nothing here mutates canvas state — the farmer taps a pin to ARM the zone chip and
// draws it themselves.
export function zoneAdviceFromSuggestions(suggestions: DetectSuggestion[]): ZoneAdvicePin[] {
  return suggestions
    .filter((s) => s.kind === 'zone' && s.zone !== undefined && s.points.length >= 3)
    .map((s) => {
      const [x, y] = centroid(s.points);
      return {
        id: s.id,
        zone: s.zone as 0 | 1 | 2 | 3 | 4 | 5,
        x,
        y,
        note: s.note ?? `Zone ${s.zone}`,
      };
    });
}
