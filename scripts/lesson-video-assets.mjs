// Pure planning shared by the facilitator exporter and its missing-teaching regression checks.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const STILL = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg']);
const VIDEO = new Set(['mp4', 'mov']);
export function collectSlideFrames(dir, expectedSlides) {
  const groups = new Map();
  for (const file of readdirSync(dir)) {
    const match = /^slide-(\d+)(?:-continuation(?:-(\d+))?)?\.(\w+)$/i.exec(file);
    if (!match || (!STILL.has(match[3].toLowerCase()) && !VIDEO.has(match[3].toLowerCase()))) continue;
    const slide = Number(match[1]);
    const part = /-continuation/i.test(file) ? Number(match[2] || 1) : 0;
    if (!Number.isSafeInteger(slide) || !expectedSlides.includes(slide)) throw new Error(`${file} has no matching narration block; refusing to leave teaching out.`);
    const frames = groups.get(slide) || [];
    if (frames.some(frame => frame.part === part)) throw new Error(`Slide ${slide}, part ${part}: multiple images/videos; choose one explicitly.`);
    frames.push({ path: join(dir, file), part, kind: VIDEO.has(match[3].toLowerCase()) ? 'video' : 'image' });
    groups.set(slide, frames);
  }
  for (const slide of expectedSlides) {
    const frames = (groups.get(slide) || []).sort((a,b) => a.part-b.part);
    if (!frames.length || frames[0].part !== 0) throw new Error(`Missing base frame for narration slide ${slide}.`);
    frames.forEach((frame,i) => {
      if (frame.part !== i) throw new Error(`Missing continuation part ${i} for narration slide ${slide}.`);
      if (frame.part > 0 && frame.kind === 'video') throw new Error(`Slide ${slide}: a continuation must be a still reading card.`);
    });
    groups.set(slide, frames);
  }
  return groups;
}
// Cumulative audio time prevents rounding from adding one frame of drift per slide.
// This is block-level timing, not a claim of word alignment inside an existing recording.
export function frameSchedule(durations, frameCounts, fps) {
  if (durations.length !== frameCounts.length || !Number.isFinite(fps) || fps <= 0) throw new Error('Invalid export schedule.');
  let elapsed = 0, previous = 0;
  return durations.map((seconds,index) => {
    const count = frameCounts[index];
    if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isInteger(count) || count < 1) throw new Error('Every narration block needs positive duration and at least one frame.');
    elapsed += seconds;
    const end = Math.round(elapsed * fps), available = end-previous;
    previous = end;
    if (available < count) throw new Error(`Narration block ${index+1} is too short to display every continuation.`);
    const boundaries = Array.from({length:count+1},(_,i)=>Math.round(available*i/count));
    return boundaries.slice(1).map((value,i)=>value-boundaries[i]);
  });
}
