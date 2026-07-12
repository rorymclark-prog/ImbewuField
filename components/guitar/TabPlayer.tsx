'use client';

// Renders a tab exercise as SVG and plays it back with the synthesised
// nylon-string sound, highlighting the current column as it goes.

import { useEffect, useRef, useState } from 'react';
import { Play, Square, Repeat, Minus, Plus } from 'lucide-react';
import type { Exercise } from '@/lib/guitar/curriculum';
import { playColumns, type Playback } from '@/lib/guitar/audio';
import { STRING_LABELS } from '@/lib/guitar/theory';

const ROW_GAP = 15;
const TOP_PAD = 14;
const LEFT_PAD = 26;
const COL_W = 34;

export default function TabPlayer({ ex }: { ex: Exercise }) {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [tempo, setTempo] = useState(ex.tempo);
  const [loop, setLoop] = useState(!!ex.loop);
  const playbackRef = useRef<Playback | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => playbackRef.current?.stop(), []);

  // Keep the highlighted column in view on long exercises.
  useEffect(() => {
    if (step < 0 || !scrollRef.current) return;
    const x = LEFT_PAD + step * COL_W;
    const el = scrollRef.current;
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) {
      el.scrollTo({ left: Math.max(0, x - 80), behavior: 'smooth' });
    }
  }, [step]);

  const stop = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setPlaying(false);
    setStep(-1);
  };

  const start = () => {
    stop();
    setPlaying(true);
    playbackRef.current = playColumns(ex.cols, tempo, {
      loop,
      countIn: ex.countIn,
      onStep: setStep,
      onEnd: () => {
        setPlaying(false);
        setStep(-1);
      },
    });
  };

  const width = LEFT_PAD + ex.cols.length * COL_W + 12;
  const height = TOP_PAD + 5 * ROW_GAP + 30;
  const yFor = (s: number) => TOP_PAD + (s - 1) * ROW_GAP;

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <button
          type="button"
          onClick={playing ? stop : start}
          className={
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white transition ' +
            (playing ? 'bg-ink-muted hover:bg-ink' : 'bg-ochre hover:bg-ochre-dark')
          }
        >
          {playing ? <Square size={14} /> : <Play size={14} />}
          {playing ? 'Stop' : 'Play'}
        </button>

        <span className="ml-1 font-display text-sm font-medium text-ink">{ex.title}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLoop((l) => !l)}
            aria-pressed={loop}
            title="Loop"
            className={
              'rounded-md border p-1.5 transition ' +
              (loop ? 'border-forest bg-forest text-white' : 'border-hairline text-ink-faint hover:text-ink')
            }
          >
            <Repeat size={13} />
          </button>
          <div className="flex items-center gap-1 rounded-md border border-hairline px-1 py-0.5">
            <button type="button" aria-label="Slower" className="p-1 text-ink-faint hover:text-ink" onClick={() => setTempo((t) => Math.max(30, t - 5))}>
              <Minus size={12} />
            </button>
            <span className="w-14 text-center text-xs font-medium text-ink-muted">{tempo} bpm</span>
            <button type="button" aria-label="Faster" className="p-1 text-ink-faint hover:text-ink" onClick={() => setTempo((t) => Math.min(200, t + 5))}>
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto px-2 py-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
          {/* highlight */}
          {step >= 0 && (
            <rect
              x={LEFT_PAD + step * COL_W - 4}
              y={TOP_PAD - 10}
              width={COL_W - 8}
              height={5 * ROW_GAP + 20}
              rx={6}
              fill="#C07A1E"
              opacity={0.18}
            />
          )}

          {/* string lines + labels */}
          {STRING_LABELS.map((label, i) => (
            <g key={i}>
              <text x={8} y={yFor(i + 1) + 3.5} fontSize={10} className="fill-ink-faint" fontWeight={600}>
                {label}
              </text>
              <line x1={LEFT_PAD - 4} y1={yFor(i + 1)} x2={width - 8} y2={yFor(i + 1)} stroke="#E2D8C4" strokeWidth={1.2} />
            </g>
          ))}

          {/* notes */}
          {ex.cols.map((col, ci) => {
            const x = LEFT_PAD + ci * COL_W + (COL_W - 8) / 2 - 4;
            return (
              <g key={ci}>
                {col.ns.map(([s, f], ni) => (
                  <g key={ni}>
                    <rect x={x - 7} y={yFor(s) - 7} width={f > 9 ? 20 : 14} height={14} rx={3} fill="#FBF6EC" />
                    <text
                      x={x + (f > 9 ? 3 : 0)}
                      y={yFor(s) + 4}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={700}
                      fill={ci === step ? '#C07A1E' : '#1F4D2B'}
                    >
                      {f}
                    </text>
                  </g>
                ))}
                {col.label && (
                  <text x={x} y={height - 8} textAnchor="middle" fontSize={9.5} className="fill-ink-faint" fontStyle="italic">
                    {col.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {ex.tip && (
        <p className="border-t border-hairline bg-paper/60 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          {ex.tip}
        </p>
      )}
    </div>
  );
}
