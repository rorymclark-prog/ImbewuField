'use client';

// SVG chord chart. Tap to hear the chord arpeggiated (bass → treble).

import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { Chord } from '@/lib/guitar/chords';
import { arpeggiateChord } from '@/lib/guitar/audio';

const W = 132;
const H = 158;
const LEFT = 18;
const TOP = 34;
const STRING_GAP = (W - LEFT * 2) / 5;
const FRET_GAP = 24;
const NUM_FRETS = 4;

export default function ChordDiagram({ chord, compact = false }: { chord: Chord; compact?: boolean }) {
  const [ringing, setRinging] = useState(false);

  const play = () => {
    arpeggiateChord(chord.frets);
    setRinging(true);
    setTimeout(() => setRinging(false), 1600);
  };

  // frets array is chart order: index 0 = string 6 (leftmost).
  const xFor = (chartIdx: number) => LEFT + chartIdx * STRING_GAP;
  const yFor = (fret: number) => TOP + (fret - 0.5) * FRET_GAP;

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Play ${chord.name} chord`}
      className={
        'group flex flex-col items-center rounded-lg border bg-card p-3 text-left shadow-card transition ' +
        (ringing ? 'border-ochre' : 'border-hairline hover:border-ochre/60')
      }
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
        {/* chord name */}
        <text x={W / 2} y={14} textAnchor="middle" className="fill-ink font-display" fontSize={15} fontWeight={600}>
          {chord.name}
        </text>

        {/* nut */}
        <rect x={LEFT - 1} y={TOP - 3} width={W - LEFT * 2 + 2} height={3} rx={1} fill="#20190F" />

        {/* frets */}
        {Array.from({ length: NUM_FRETS + 1 }, (_, i) => (
          <line key={i} x1={LEFT} y1={TOP + i * FRET_GAP} x2={W - LEFT} y2={TOP + i * FRET_GAP} stroke="#E2D8C4" strokeWidth={1.5} />
        ))}

        {/* strings */}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={xFor(i)} y1={TOP} x2={xFor(i)} y2={TOP + NUM_FRETS * FRET_GAP} stroke="#8C7A62" strokeWidth={i < 3 ? 1.8 : 1.2} />
        ))}

        {/* barre */}
        {chord.barre && (
          <rect
            x={xFor(6 - chord.barre.fromString) - 7}
            y={yFor(chord.barre.fret) - 7}
            width={(chord.barre.fromString - chord.barre.toString) * STRING_GAP + 14}
            height={14}
            rx={7}
            fill="#1F4D2B"
          />
        )}

        {/* dots, opens and mutes */}
        {chord.frets.map((f, i) => {
          const x = xFor(i);
          if (f < 0) {
            return (
              <text key={i} x={x} y={TOP - 8} textAnchor="middle" fontSize={11} className="fill-ink-faint" fontWeight={600}>
                ✕
              </text>
            );
          }
          if (f === 0) {
            return <circle key={i} cx={x} cy={TOP - 12} r={4} fill="none" stroke="#5C5040" strokeWidth={1.5} />;
          }
          const finger = chord.fingers?.[i];
          return (
            <g key={i}>
              <circle cx={x} cy={yFor(f)} r={8.5} fill="#1F4D2B" />
              {finger ? (
                <text x={x} y={yFor(f) + 3.5} textAnchor="middle" fontSize={10} fill="#F7F2E9" fontWeight={700}>
                  {finger}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {!compact && (
        <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
          <Volume2 size={13} className={ringing ? 'text-ochre' : 'text-ink-faint group-hover:text-ochre'} />
          tap to hear
        </span>
      )}
    </button>
  );
}
