'use client';

// Horizontal fretboard diagram with labelled note positions.
// Tap a mark to hear that note.

import type { FretMark } from '@/lib/guitar/curriculum';
import { pluckFret } from '@/lib/guitar/audio';
import { STRING_LABELS } from '@/lib/guitar/theory';

const FRETS = 5;
const FRET_W = 64;
const ROW_GAP = 20;
const LEFT = 34;
const TOP = 16;

export default function FretboardDiagram({ marks, title }: { marks: FretMark[]; title?: string }) {
  const width = LEFT + FRETS * FRET_W + 12;
  const height = TOP + 5 * ROW_GAP + 28;
  const yFor = (s: number) => TOP + (s - 1) * ROW_GAP;
  const xFor = (f: number) => LEFT + (f - 0.5) * FRET_W;

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-card">
      {title && (
        <p className="border-b border-hairline px-3 py-2 font-display text-sm font-medium text-ink">{title}</p>
      )}
      <div className="overflow-x-auto px-2 py-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
          {/* nut */}
          <rect x={LEFT - 4} y={TOP - 4} width={4} height={5 * ROW_GAP + 8} rx={2} fill="#20190F" />

          {/* frets */}
          {Array.from({ length: FRETS }, (_, i) => (
            <g key={i}>
              <line x1={LEFT + (i + 1) * FRET_W} y1={TOP - 2} x2={LEFT + (i + 1) * FRET_W} y2={TOP + 5 * ROW_GAP + 2} stroke="#E2D8C4" strokeWidth={2} />
              <text x={xFor(i + 1)} y={height - 6} textAnchor="middle" fontSize={10} className="fill-ink-faint">
                {i + 1}
              </text>
            </g>
          ))}

          {/* strings */}
          {STRING_LABELS.map((label, i) => (
            <g key={i}>
              <text x={12} y={yFor(i + 1) + 3.5} fontSize={10} className="fill-ink-faint" fontWeight={600}>
                {label}
              </text>
              <line x1={LEFT} y1={yFor(i + 1)} x2={width - 8} y2={yFor(i + 1)} stroke="#8C7A62" strokeWidth={0.8 + i * 0.25} />
            </g>
          ))}

          {/* marks */}
          {marks.map((m, i) => (
            <g key={i} className="cursor-pointer" onClick={() => pluckFret(m.s, m.f)}>
              <circle cx={xFor(m.f)} cy={yFor(m.s)} r={9.5} fill="#1F4D2B" />
              <text x={xFor(m.f)} y={yFor(m.s) + 3.5} textAnchor="middle" fontSize={10} fill="#F7F2E9" fontWeight={700}>
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="border-t border-hairline bg-paper/60 px-3 py-1.5 text-xs text-ink-muted">Tap a note to hear it.</p>
    </div>
  );
}
