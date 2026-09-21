#!/usr/bin/env node
// Public guide text is the recording script. Refuse stale scripts or changed files before
// importing: a working audio URL is not proof that it says what the learner is reading.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { APP_GUIDES, appGuideNarrationSections } from '../lib/course-app-guides.ts';

const [mode, directory] = process.argv.slice(2);
if (!['export', 'check', 'import'].includes(mode) || !directory) {
  throw new Error('Usage: node scripts/app-guide-narration.mjs export|check|import <recording-directory>');
}
const root = resolve(directory);
const repo = fileURLToPath(new URL('..', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const normalise = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const manifest = {};
const files = [];
for (const guide of APP_GUIDES) {
  const folder = join(root, guide.id);
  const sections = appGuideNarrationSections(guide).map(section => ({ ...section, sourceSha256: sha(section.text) }));
  if (mode === 'export') {
    mkdirSync(folder, { recursive: true });
    const script = { id: guide.id, title: guide.cardTitle, language: 'en', voice: 'en-ZA-LukeNeural', rate: '-12%', sections };
    writeFileSync(join(folder, 'script.json'), `${JSON.stringify(script, null, 2)}\n`);
    writeFileSync(join(folder, 'SCRIPT.md'), `# ${guide.cardTitle}\n\nRecording script derived from the guide. Feedback is conditional on a chosen answer. Control-path arrows are spoken as “then”.\n\n${sections.map(s => `## ${s.id} — ${s.title}\n\n${s.text}\n`).join('\n')}`);
    continue;
  }
  const script = JSON.parse(readFileSync(join(folder, 'script.json'), 'utf8'));
  assert.deepEqual(script.sections, sections, `${guide.id}: recording script differs from current guide text`);
  assert.equal(script.language, 'en');
  const tracks = [];
  for (const section of sections) {
    const audioPath = join(folder, `${section.id}.mp3`);
    const bytes = readFileSync(audioPath);
    const proof = JSON.parse(readFileSync(join(folder, `${section.id}.verification.json`), 'utf8'));
    assert.equal(proof.sourceSha256, section.sourceSha256, `${guide.id}/${section.id}: stale text`);
    assert.equal(proof.audioSha256, sha(bytes), `${guide.id}/${section.id}: changed audio`);
    assert.equal(proof.bytes, bytes.length);
    assert.equal(proof.voice, script.voice);
    assert.equal(proof.rate, script.rate);
    assert.equal(proof.textMatch, true);
    assert.equal(proof.fullDecode, 'pass');
    assert.equal(normalise(proof.words.map(w => w.text).join(' ')), normalise(section.text), `${guide.id}/${section.id}: incomplete spoken words`);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    const duration = Number(probe.stdout.trim());
    assert.ok(duration > 0 && Math.abs(duration - proof.seconds) < 0.01, 'duration differs from verification');
    const last = proof.words.at(-1);
    assert.ok(last && (last.offset + last.duration) / 1e7 <= duration + 0.1, 'audio ends before the final words');
    const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', audioPath, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.equal(decode.status, 0, decode.stderr);
    tracks.push({ section: section.id, seconds: duration, bytes: bytes.length, sourceSha256: section.sourceSha256, audioSha256: sha(bytes) });
    files.push({ source: audioPath, target: join(repo, 'public', 'app-guide-audio', guide.id, `${section.id}.mp3`) });
  }
  manifest[guide.id] = { language: 'en', voice: script.voice, rate: script.rate, tracks };
}
if (mode === 'export') {
  writeFileSync(join(root, 'INDEX.json'), `${JSON.stringify({ status: 'recording candidates, not published', guides: APP_GUIDES.map(g => ({ id: g.id, sections: appGuideNarrationSections(g).length })) }, null, 2)}\n`);
} else if (mode === 'import') {
  // Validate the complete collection before changing any public asset or promise.
  for (const file of files) { mkdirSync(resolve(file.target, '..'), { recursive: true }); copyFileSync(file.source, file.target); }
  const source = join(repo, 'lib', 'course-audio.ts');
  const before = readFileSync(source, 'utf8');
  const marker = /export const APP_GUIDE_NARRATION: Record<string, AppGuideNarration> = [\s\S]*?;\n\nexport function appGuideTrack/;
  assert.ok(marker.test(before), 'manifest insertion point missing');
  writeFileSync(source, before.replace(marker, `export const APP_GUIDE_NARRATION: Record<string, AppGuideNarration> = ${JSON.stringify(manifest, null, 2)};\n\nexport function appGuideTrack`));
}
console.log(JSON.stringify({ mode, guides: APP_GUIDES.length, recordings: files.length, bytes: files.reduce((n, f) => n + readFileSync(f.source).length, 0) }));
