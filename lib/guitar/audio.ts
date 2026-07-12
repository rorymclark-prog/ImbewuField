// Nylon-string guitar synthesis with Karplus–Strong plucked-string modelling.
// Everything is generated in the browser — no samples to download, works offline.

import { fretToMidi, midiToFreq } from './theory';

export type TabColumn = {
  /** Notes sounding together on this beat: [string 1..6, fret]. Empty = rest. */
  ns: [number, number][];
  /** Duration in beats (default 1). */
  d?: number;
  /** Optional lyric/finger label shown under the column. */
  label?: string;
};

let ctx: AudioContext | null = null;
const bufferCache = new Map<number, AudioBuffer>();

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * Render a single plucked note into a buffer using Karplus–Strong.
 * The initial noise burst is low-pass filtered to soften the attack —
 * that (plus a slightly higher damping) is what makes it sound like nylon
 * rather than steel.
 */
function pluckBuffer(ac: AudioContext, midi: number): AudioBuffer {
  const cached = bufferCache.get(midi);
  if (cached) return cached;

  const sr = ac.sampleRate;
  const freq = midiToFreq(midi);
  const seconds = 2.4;
  const buf = ac.createBuffer(1, Math.floor(sr * seconds), sr);
  const out = buf.getChannelData(0);

  const N = Math.max(2, Math.round(sr / freq));
  const line = new Float32Array(N);

  // Excitation: noise burst, softened with a two-pass moving average.
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    line[i] = prev = 0.55 * r + 0.45 * prev;
  }
  prev = 0;
  for (let i = 0; i < N; i++) line[i] = prev = 0.6 * line[i] + 0.4 * prev;

  // Higher notes ring shorter, like a real string.
  const damping = Math.min(0.9985, 0.994 + (freq < 200 ? 0.0035 : freq < 400 ? 0.0025 : 0.0012));

  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % N];
    line[idx] = damping * 0.5 * (cur + next);
    out[i] = cur;
    idx = (idx + 1) % N;
  }

  // Gentle overall decay so tails never click.
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) {
    out[out.length - 1 - i] *= i / fade;
  }

  bufferCache.set(midi, buf);
  return buf;
}

export function pluckNote(midi: number, when = 0, gain = 0.5): void {
  const ac = getAudioContext();
  const src = ac.createBufferSource();
  src.buffer = pluckBuffer(ac, midi);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ac.destination);
  src.start(Math.max(ac.currentTime, when));
}

export function pluckFret(string: number, fret: number, when = 0, gain = 0.5): void {
  pluckNote(fretToMidi(string, fret), when, gain);
}

/** Strum a chord shape (chart order: index 0 = string 6). -1 = muted. */
export function strumChord(frets: number[], downstroke = true, gain = 0.45): void {
  const ac = getAudioContext();
  const t0 = ac.currentTime + 0.03;
  const order = frets
    .map((f, i) => ({ string: 6 - i, fret: f }))
    .filter((n) => n.fret >= 0);
  if (!downstroke) order.reverse();
  order.forEach((n, i) => pluckFret(n.string, n.fret, t0 + i * 0.045, gain));
}

/** Play a chord as a slow p-i-m-a style arpeggio (bass first). */
export function arpeggiateChord(frets: number[], gain = 0.5): void {
  const ac = getAudioContext();
  const t0 = ac.currentTime + 0.03;
  const notes = frets
    .map((f, i) => ({ string: 6 - i, fret: f }))
    .filter((n) => n.fret >= 0);
  notes.forEach((n, i) => pluckFret(n.string, n.fret, t0 + i * 0.28, gain));
}

export type Playback = { stop: () => void };

/**
 * Play a tab exercise. Audio is scheduled sample-accurately on the audio
 * clock; onStep fires per column (via timeouts) so the UI can highlight
 * along. Returns a handle to stop early.
 */
export function playColumns(
  cols: TabColumn[],
  tempo: number,
  opts: { loop?: boolean; countIn?: boolean; onStep?: (i: number) => void; onEnd?: () => void } = {},
): Playback {
  const ac = getAudioContext();
  const beat = 60 / tempo;
  let stopped = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const activeSources: AudioBufferSourceNode[] = [];

  const clickAt = (when: number, hi: boolean) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.value = hi ? 1400 : 1000;
    g.gain.setValueAtTime(0.25, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.06);
  };

  const scheduleAt = (midi: number, when: number, gain: number) => {
    const src = ac.createBufferSource();
    src.buffer = pluckBuffer(ac, midi);
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(g).connect(ac.destination);
    src.start(when);
    activeSources.push(src);
  };

  const runPass = (startTime: number): number => {
    let t = startTime;
    cols.forEach((col, i) => {
      const dur = (col.d ?? 1) * beat;
      col.ns.forEach(([s, f], j) => {
        // Slight roll when several notes sound together, bass first.
        scheduleAt(fretToMidi(s, f), t + j * 0.012, 0.5);
      });
      const delayMs = Math.max(0, (t - ac.currentTime) * 1000);
      timers.push(setTimeout(() => !stopped && opts.onStep?.(i), delayMs));
      t += dur;
    });
    return t;
  };

  let start = ac.currentTime + 0.1;
  if (opts.countIn) {
    for (let i = 0; i < 4; i++) clickAt(start + i * beat, i === 0);
    start += 4 * beat;
  }

  const scheduleFrom = (t0: number) => {
    if (stopped) return;
    const end = runPass(t0);
    const endMs = Math.max(0, (end - ac.currentTime) * 1000);
    timers.push(
      setTimeout(() => {
        if (stopped) return;
        if (opts.loop) scheduleFrom(end);
        else {
          opts.onStep?.(-1);
          opts.onEnd?.();
        }
      }, endMs),
    );
  };
  scheduleFrom(start);

  return {
    stop() {
      stopped = true;
      timers.forEach(clearTimeout);
      timers = [];
      activeSources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already ended */
        }
      });
      opts.onStep?.(-1);
    },
  };
}
