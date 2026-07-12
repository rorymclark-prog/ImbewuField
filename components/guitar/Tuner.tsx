'use client';

// Chromatic tuner: listens through the microphone, detects pitch with
// autocorrelation, and shows how far the note is from true.
// Also plays reference tones for each open string.

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { freqToNote, STANDARD_TUNING } from '@/lib/guitar/theory';
import { getAudioContext, pluckNote } from '@/lib/guitar/audio';

type Reading = { name: string; cents: number; freq: number };

// Autocorrelation pitch detection (ACF2+), solid for guitar's 80–350 Hz range.
function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return -1; // too quiet

  // Trim silence at the edges.
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < threshold) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  const trimmed = buf.slice(r1, r2);
  const N = trimmed.length;
  if (N < 2) return -1;

  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }

  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return -1;

  // Parabolic interpolation for sub-sample accuracy.
  let T0 = maxPos;
  const x1 = c[T0 - 1] ?? c[T0];
  const x2 = c[T0];
  const x3 = c[T0 + 1] ?? c[T0];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;
  return freq > 60 && freq < 1200 ? freq : -1;
}

export default function Tuner() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastGoodRef = useRef<number>(0);

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setListening(false);
    setReading(null);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ac = getAudioContext();
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setListening(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = detectPitch(buf, ac.sampleRate);
        const now = performance.now();
        if (freq > 0) {
          const note = freqToNote(freq);
          setReading({ name: note.name, cents: note.cents, freq });
          lastGoodRef.current = now;
        } else if (now - lastGoodRef.current > 900) {
          setReading(null);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError('Microphone access was blocked. Allow the microphone in your browser, or tune by ear with the reference tones below.');
    }
  };

  const cents = reading?.cents ?? 0;
  const inTune = reading !== null && Math.abs(cents) <= 5;
  const needleAngle = Math.max(-45, Math.min(45, cents * 0.9));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-hairline bg-card p-6 text-center shadow-card">
        {/* dial */}
        <div className="relative mx-auto h-36 w-72 max-w-full overflow-hidden">
          <svg viewBox="0 0 288 144" className="h-full w-full">
            <path d="M 24 132 A 120 120 0 0 1 264 132" fill="none" stroke="#E2D8C4" strokeWidth={10} strokeLinecap="round" />
            {/* in-tune zone */}
            <path
              d="M 133.6 12.5 A 120 120 0 0 1 154.4 12.5"
              fill="none"
              stroke={inTune ? '#2E6B3A' : '#A8D88A'}
              strokeWidth={10}
              strokeLinecap="round"
            />
            {/* needle */}
            <g transform={`rotate(${needleAngle} 144 132)`}>
              <line x1={144} y1={132} x2={144} y2={26} stroke={inTune ? '#1F4D2B' : reading ? '#C07A1E' : '#8C7A62'} strokeWidth={3.5} strokeLinecap="round" />
              <circle cx={144} cy={132} r={7} fill="#20190F" />
            </g>
            <text x={30} y={120} fontSize={11} className="fill-ink-faint">♭ flat</text>
            <text x={222} y={120} fontSize={11} className="fill-ink-faint">sharp ♯</text>
          </svg>
        </div>

        <div className="mt-2 font-display text-5xl font-semibold text-ink" aria-live="polite">
          {reading ? reading.name : '—'}
        </div>
        <div className={'mt-1 text-sm font-medium ' + (inTune ? 'text-forest-light' : 'text-ink-muted')}>
          {reading
            ? inTune
              ? 'In tune'
              : `${Math.abs(cents)} cents ${cents < 0 ? 'flat — tighten' : 'sharp — loosen'}`
            : listening
              ? 'Play a string…'
              : 'Tuner is off'}
        </div>
        {reading && <div className="mt-0.5 text-xs text-ink-faint">{reading.freq.toFixed(1)} Hz</div>}

        <button
          type="button"
          onClick={listening ? stop : start}
          className={
            'mx-auto mt-4 flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition ' +
            (listening ? 'bg-ink-muted hover:bg-ink' : 'bg-ochre hover:bg-ochre-dark')
          }
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
          {listening ? 'Stop listening' : 'Start tuner'}
        </button>
        {error && <p className="mx-auto mt-3 max-w-md text-sm text-ochre-dark">{error}</p>}
      </div>

      {/* reference tones */}
      <div className="rounded-xl border border-hairline bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 font-display text-sm font-medium text-ink">
          <Volume2 size={15} className="text-forest" /> Reference tones — tune by ear
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[...STANDARD_TUNING].reverse().map((s) => (
            <button
              key={s.string}
              type="button"
              onClick={() => pluckNote(s.midi, 0, 0.6)}
              className="rounded-md border border-hairline bg-paper px-2 py-2.5 text-center transition hover:border-ochre/60"
            >
              <span className="block font-display text-lg font-semibold text-ink">{s.name}</span>
              <span className="block text-[11px] text-ink-faint">string {s.string}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          Match your string to the tone: play the tone, play your string, and adjust until the two “beats” between them disappear.
        </p>
      </div>
    </div>
  );
}
