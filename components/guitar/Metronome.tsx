'use client';

// Web Audio metronome with a lookahead scheduler, accented downbeats,
// tap tempo, and Italian tempo names for flavour.

import { useEffect, useRef, useState } from 'react';
import { Play, Square, Minus, Plus, Hand } from 'lucide-react';
import { getAudioContext } from '@/lib/guitar/audio';

const TEMPO_NAMES: [number, string][] = [
  [40, 'Grave'], [55, 'Largo'], [66, 'Adagio'], [76, 'Andante'],
  [98, 'Moderato'], [110, 'Allegretto'], [132, 'Allegro'], [168, 'Presto'], [200, 'Prestissimo'],
];

function tempoName(bpm: number): string {
  let name = TEMPO_NAMES[0][1];
  for (const [min, n] of TEMPO_NAMES) if (bpm >= min) name = n;
  return name;
}

export default function Metronome() {
  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(72);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [beat, setBeat] = useState(-1);

  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerBar);
  const nextTimeRef = useRef(0);
  const beatCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taps = useRef<number[]>([]);

  bpmRef.current = bpm;
  beatsRef.current = beatsPerBar;

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setBeat(-1);
  };

  useEffect(() => stop, []);

  const start = () => {
    const ac = getAudioContext();
    nextTimeRef.current = ac.currentTime + 0.08;
    beatCountRef.current = 0;
    setRunning(true);

    timerRef.current = setInterval(() => {
      const lookahead = ac.currentTime + 0.12;
      while (nextTimeRef.current < lookahead) {
        const b = beatCountRef.current % beatsRef.current;
        const t = nextTimeRef.current;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.frequency.value = b === 0 ? 1500 : 1000;
        g.gain.setValueAtTime(b === 0 ? 0.4 : 0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.connect(g).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.06);

        setTimeout(() => setBeat(b), Math.max(0, (t - ac.currentTime) * 1000));

        beatCountRef.current++;
        nextTimeRef.current += 60 / bpmRef.current;
      }
    }, 25);
  };

  const tap = () => {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 2500);
    taps.current.push(now);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(Math.max(30, Math.min(240, Math.round(60000 / avg))));
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-card p-6 shadow-card">
      <div className="text-center">
        <div className="font-display text-6xl font-semibold tabular-nums text-ink">{bpm}</div>
        <div className="mt-0.5 text-sm italic text-ink-muted">
          {tempoName(bpm)} · {beatsPerBar}/4
        </div>
      </div>

      {/* beat lights */}
      <div className="mt-5 flex justify-center gap-2.5" aria-hidden>
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={
              'h-3.5 w-3.5 rounded-full transition-all duration-75 ' +
              (beat === i ? (i === 0 ? 'scale-125 bg-ochre' : 'scale-110 bg-forest-light') : 'bg-hairline')
            }
          />
        ))}
      </div>

      {/* tempo controls */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <button type="button" aria-label="Slower" onClick={() => setBpm((b) => Math.max(30, b - 2))} className="rounded-md border border-hairline p-2 text-ink-muted hover:text-ink">
          <Minus size={16} />
        </button>
        <input
          type="range"
          min={30}
          max={240}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-48 accent-ochre sm:w-64"
          aria-label="Tempo"
        />
        <button type="button" aria-label="Faster" onClick={() => setBpm((b) => Math.min(240, b + 2))} className="rounded-md border border-hairline p-2 text-ink-muted hover:text-ink">
          <Plus size={16} />
        </button>
      </div>

      {/* time signature */}
      <div className="mt-4 flex justify-center gap-2">
        {[2, 3, 4, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setBeatsPerBar(n)}
            className={
              'rounded-md border px-3 py-1.5 text-sm font-medium transition ' +
              (beatsPerBar === n ? 'border-forest bg-forest text-white' : 'border-hairline text-ink-muted hover:text-ink')
            }
          >
            {n}/4
          </button>
        ))}
      </div>

      <div className="mt-5 flex justify-center gap-3">
        <button
          type="button"
          onClick={running ? stop : start}
          className={
            'flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-white transition ' +
            (running ? 'bg-ink-muted hover:bg-ink' : 'bg-ochre hover:bg-ochre-dark')
          }
        >
          {running ? <Square size={15} /> : <Play size={15} />}
          {running ? 'Stop' : 'Start'}
        </button>
        <button
          type="button"
          onClick={tap}
          className="flex items-center gap-2 rounded-md border border-hairline px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-ochre/60 hover:text-ink"
        >
          <Hand size={15} /> Tap tempo
        </button>
      </div>
    </div>
  );
}
