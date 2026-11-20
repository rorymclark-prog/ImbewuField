'use client';

import { useId, useRef } from 'react';
import { useInViewOnce } from '@/lib/use-in-view-once';
import styles from './MiniPlanPlate.module.css';
import { MINI_H, MINI_W, type MiniPlan, type MiniPaint } from '@/lib/mini-plan';

/**
 * A site's own geometry, drawn small — the picture on a crop-plan site card.
 *
 * All the geometry decisions live in lib/mini-plan.ts (pure, tested); this file
 * only chooses ink. Keep it that way: anything here that computes a position is
 * a second opinion on the fit, and the plate would drift from the bed list it
 * sits above.
 *
 * The plate is decorative-with-a-job: it exists so a farmer can tell two saved
 * designs apart at a glance, so it carries no labels and no scale bar and is
 * marked aria-hidden — the card's own text is what a screen reader reads.
 */

const INK: Record<MiniPaint, { fill: string; fillOpacity: number; stroke: string; strokeWidth: number }> = {
  // The beds are the subject of a crop plan, so they are the only saturated ink.
  bed: { fill: 'var(--mini-plate-bed, #1F4D2B)', fillOpacity: 0.5, stroke: 'var(--mini-plate-bed, #1F4D2B)', strokeWidth: 1.2 },
  // Staple ground is hatched rather than filled: it is a FIELD, not a bed, and a
  // solid block of it at this size would out-shout the beds it dwarfs.
  plot: { fill: 'none', fillOpacity: 1, stroke: 'var(--mini-plate-plot, #A9812C)', strokeWidth: 1.2 },
  canopy: { fill: 'var(--mini-plate-canopy, #6F8F5E)', fillOpacity: 0.22, stroke: 'var(--mini-plate-canopy, #6F8F5E)', strokeWidth: 0 },
  structure: { fill: 'var(--mini-plate-structure, #6B6152)', fillOpacity: 0.16, stroke: 'var(--mini-plate-structure, #6B6152)', strokeWidth: 0.8 },
  water: { fill: 'var(--mini-plate-water, #3E6B7A)', fillOpacity: 0.32, stroke: 'var(--mini-plate-water, #3E6B7A)', strokeWidth: 0.8 },
};

// Plates that come into view in the same moment (a list of saved sites) start a little apart, so
// the grid ripples instead of flashing. The offset is capped well under half a second.
let lastStart = 0;
let burst = 0;
function nextLagMs(): number {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  burst = now - lastStart < 150 ? burst + 1 : 0;
  lastStart = now;
  return Math.min(burst * 70, 350);
}

export default function MiniPlanPlate({ plan, className }: { plan: MiniPlan; className?: string }) {
  // Unique per instance — several plates share one document, and duplicate
  // pattern ids would make every plot on the page take the first plate's hatch.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hatchId = `mini-hatch-${uid}`;
  const { ref, phase } = useInViewOnce<SVGSVGElement>();
  const lag = useRef<number | null>(null);
  if (phase === 'play' && lag.current === null) lag.current = nextLagMs();
  const phaseClass = phase === 'armed' ? styles.armed : phase === 'play' ? styles.play : '';

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${MINI_W} ${MINI_H}`}
      className={[className, phaseClass].filter(Boolean).join(' ') || undefined}
      role="presentation"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: 'auto', background: 'var(--mini-plate-bg, #F6F1E6)', ...(lag.current ? { '--lag': `${lag.current}ms` } as React.CSSProperties : null) }}
    >
      <defs>
        <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--mini-plate-plot, #A9812C)" strokeWidth="1.4" strokeOpacity="0.55" />
        </pattern>
      </defs>

      {plan.shapes.map((s, i) => {
        const ink = INK[s.paint];
        const fill = s.paint === 'plot' ? `url(#${hatchId})` : ink.fill;
        const common = {
          fill,
          fillOpacity: s.paint === 'plot' ? 1 : ink.fillOpacity,
          stroke: ink.strokeWidth > 0 ? ink.stroke : 'none',
          strokeWidth: ink.strokeWidth,
          strokeOpacity: 0.75,
        };
        const cls = styles[s.paint];
        if (s.kind === 'poly') {
          return <polygon key={i} className={cls} points={s.points.map(([x, y]) => `${x},${y}`).join(' ')} {...common} />;
        }
        if (s.kind === 'ellipse') {
          return <ellipse key={i} className={cls} cx={s.cx} cy={s.cy} rx={Math.max(s.w / 2, 1.2)} ry={Math.max(s.h / 2, 1.2)} {...common} />;
        }
        return (
          <rect
            key={i}
            className={cls}
            x={s.cx - s.w / 2}
            y={s.cy - s.h / 2}
            width={Math.max(s.w, 2)}
            height={Math.max(s.h, 2)}
            rx={1.5}
            transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}
            {...common}
          />
        );
      })}
    </svg>
  );
}
