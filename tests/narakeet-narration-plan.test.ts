import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const script = path.join(root, 'scripts/generate-regional-course-audio-narakeet.py');
const planner = path.join(root, 'scripts/generate-regional-course-audio.py');

function run(lang: string, ...args: string[]) {
  const env = { ...process.env };
  delete env.NARAKEET_API_KEY;
  return spawnSync('python3', [script, 'intro-permaculture', lang, '/tmp/imbewu-narakeet-offline-test', ...args], {
    cwd: root, env, encoding: 'utf8',
  });
}

test('Narakeet plan validates source pairs for all three regional voices without credentials', () => {
  for (const [lang, voice] of [['st', 'Palesa'], ['ve', 'Mulalo'], ['ts', 'Basetsana']]) {
    const result = run(lang);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`voice ${voice}`));
    assert.match(result.stdout, /source SHA-256 [a-f0-9]{64}/);
    assert.match(result.stdout, /spoken SHA-256 [a-f0-9]{64}/);
    if (lang !== 'st') assert.match(result.stdout, /\/ \d+ mixed/,
      'mixed paragraphs are reported separately from full drafts and complete English holds');
    assert.doesNotMatch(result.stdout, /NARAKEET_API_KEY/);
  }
});

test('mixed source-paired paragraphs speak translated and held spans in source order', () => {
  const source = String.raw`
import importlib.util, json, sys, tempfile
from pathlib import Path
spec = importlib.util.spec_from_file_location("audio_plan", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
original = "Check the bed. Keep the marked path clear."
def packet(body):
    return {"language":"ve", "sourceLanguage":"en", "reviewStatus":"unreviewed", "slides":[{
        "n":1, "english":{"body":[original]}, "target":{"body":[body]}}]}
with tempfile.TemporaryDirectory() as tmp:
    m.ROOT = Path(tmp)
    folder = Path(tmp) / "docs" / "narration"
    folder.mkdir(parents=True)
    path = folder / "fixture.ve.paired-draft.json"
    m.source_blocks = lambda _module: {1: original}
    valid = {"status":"mixed", "segments":[
        {"status":"draft", "sourceEnglish":"Check the bed. ", "text":"Sedzani mmbete. "},
        {"status":"english-hold", "sourceEnglish":"Keep the marked path clear."},
    ]}
    path.write_text(json.dumps(packet(valid)))
    slide = m.plan("fixture", "ve")[0]
    assert slide["spokenText"] == "Sedzani mmbete. Keep the marked path clear."
    assert slide["statuses"] == ["mixed"]
    assert (slide["draftParagraphs"], slide["englishHolds"], slide["mixedParagraphs"]) == (0, 0, 1)

    both_draft = {"status":"mixed", "segments":[
        {"status":"draft", "sourceEnglish":"Check the bed. ", "text":"Sedzani mmbete. "},
        {"status":"draft", "sourceEnglish":"Keep the marked path clear.", "text":"Tsireledzani gondo."},
    ]}
    path.write_text(json.dumps(packet(both_draft)))
    slide = m.plan("fixture", "ve")[0]
    assert slide["spokenText"] == "Sedzani mmbete. Tsireledzani gondo."
    assert slide["statuses"] == ["mixed"] and slide["mixedParagraphs"] == 1

    # 6 October 2026: accepted semantic clauses keep exact source-only spacing
    # between anchors. It is not translated speech and must not fail the plan.
    separators = {"status":"mixed", "segments":[
        {"status":"draft", "sourceEnglish":"Check the bed.", "text":"Sedzani mmbete."},
        {"status":"english-hold", "sourceEnglish":" "},
        {"status":"english-hold", "sourceEnglish":"Keep the marked path clear."},
    ]}
    path.write_text(json.dumps(packet(separators)))
    slide = m.plan("fixture", "ve")[0]
    assert slide["spokenText"] == "Sedzani mmbete. Keep the marked path clear."
    assert slide["sourceEnglish"] == original
    assert slide["statuses"] == ["mixed"] and slide["mixedParagraphs"] == 1

    invalid = [
        ({"status":"mixed", "segments":[
            {"status":"english-hold", "sourceEnglish":""},
            {"status":"english-hold", "sourceEnglish":original},
        ]}, "empty mixed English source segment"),
        ({"status":"mixed", "segments":[
            {"status":"draft", "sourceEnglish":" ", "text":"Invented"},
            {"status":"english-hold", "sourceEnglish":original},
        ]}, "empty mixed English source segment"),
        ({"status":"mixed", "segments":[
            {"status":"draft", "sourceEnglish":"Check the bed.", "text":"Sedzani mmbete."},
            {"status":"english-hold", "sourceEnglish":" ", "text":"competing separator"},
            {"status":"english-hold", "sourceEnglish":"Keep the marked path clear."},
        ]}, "competing text for a mixed English hold"),
        ({"status":"mixed", "segments":[]}, "invalid mixed paragraph segments"),
        ({"status":"mixed", "segments":[
            {"status":"draft", "sourceEnglish":"Check the bed. ", "text":" "},
            {"status":"english-hold", "sourceEnglish":"Keep the marked path clear."},
        ]}, "empty or false mixed draft"),
        ({"status":"mixed", "segments":[
            {"status":"draft", "sourceEnglish":"Check the bed. ", "text":"Check the bed. "},
            {"status":"english-hold", "sourceEnglish":"Keep the marked path clear."},
        ]}, "empty or false mixed draft"),
        ({"status":"mixed", "segments":[
            {"status":"draft", "sourceEnglish":"Check the bed. ", "text":"Sedzani mmbete. "},
            {"status":"english-hold", "sourceEnglish":"Keep the marked path clear.", "text":"Translate me"},
        ]}, "competing text for a mixed English hold"),
        ({"status":"mixed", "segments":[
            {"status":"draft", "sourceEnglish":"Keep the marked path clear.", "text":"Xiya ndlela."},
            {"status":"english-hold", "sourceEnglish":"Check the bed. "},
        ]}, "do not preserve the exact English source"),
        ({"status":"english-hold", "text":"competing hold copy"}, "competing text for an English hold"),
    ]
    for candidate, expected in invalid:
        path.write_text(json.dumps(packet(candidate)))
        try:
            m.plan("fixture", "ve")
        except ValueError as error:
            assert expected in str(error), (expected, str(error))
        else:
            raise AssertionError("invalid source-paired plan was accepted: " + expected)
`;
  const result = spawnSync('python3', ['-c', source, planner], {
    cwd: root, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('Sesotho slide 22 planned speech and clip hash remain bound', () => {
  const result = run('st');
  assert.equal(result.status, 0, result.stderr);
  const planned = result.stdout.match(/slide 22: source SHA-256 ([a-f0-9]{64}); spoken SHA-256 ([a-f0-9]{64})/);
  assert.ok(planned, result.stdout);
  const verification = JSON.parse(readFileSync(
    path.join(root, 'docs/narration-reviews/INTRO-PERMACULTURE-ST-AUDIO-2026-09-28.json'), 'utf8'));
  const released = verification.slides.find((slide: { slide: number }) => slide.slide === 22);
  assert.ok(released);
  assert.equal(planned[1], released.sourceSha256);
  assert.equal(planned[2], released.spokenSha256);
  const clip = readFileSync(path.join(root, 'public/course-audio/intro-permaculture/st/slide-22.mp3'));
  assert.equal(createHash('sha256').update(clip).digest('hex'), released.audioSha256);
});

test('Narakeet generation stops before any request when the key is absent', () => {
  const result = run('st', '--generate', '--limit', '1');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set NARAKEET_API_KEY/);
});

test('Narakeet rejects unsupported language codes before source lookup', () => {
  const result = run('zu');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid choice/);
});

test('Narakeet generation preflights the stream limit and rejects non-MP3 provider bytes', () => {
  const source = String.raw`
import importlib.util, sys
spec = importlib.util.spec_from_file_location("narakeet", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.request_audio = lambda *args: (_ for _ in ()).throw(AssertionError("network request attempted"))
try:
    m.generate("intro-permaculture", "st", __import__("pathlib").Path("/tmp/narakeet-never-created"),
        [{"slide": 1, "spokenText": "x" * 1001}], "test-key")
except ValueError as error:
    assert "1000 UTF-8 bytes" in str(error)
else:
    raise AssertionError("oversized slide was not rejected")
try:
    m.inspect_mp3(b"provider error body, not an MP3")
except ValueError as error:
    assert "not a valid MP3" in str(error)
else:
    raise AssertionError("invalid provider bytes were accepted")
`;
  const result = spawnSync('python3', ['-c', source, script], {
    cwd: root, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('a limited regeneration preserves intact verification records for unselected slides', () => {
  const source = String.raw`
import hashlib, importlib.util, json, sys, tempfile
from pathlib import Path
spec = importlib.util.spec_from_file_location("narakeet", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    output = Path(tmp) / "intro-permaculture" / "st"
    output.mkdir(parents=True)
    old_audio = b"verified old clip"
    (output / "slide-01.mp3").write_bytes(old_audio)
    old = {"slide": 1, "sourceSha256": "a" * 64, "spokenSha256": "b" * 64,
           "audioSha256": hashlib.sha256(old_audio).hexdigest(), "durationSeconds": 1.0}
    (output / "verification.json").write_text(json.dumps({"module": "intro-permaculture",
        "language": "st", "voiceId": "palesa", "slides": [old]}))
    m.request_audio = lambda *args: b"new clip"
    m.inspect_mp3 = lambda audio: 2.0
    current = [{"slide": 1, "spokenText": "old", "sourceSha256": "a" * 64,
        "spokenSha256": "b" * 64}, {"slide": 2, "spokenText": "short",
        "sourceSha256": "c" * 64, "spokenSha256": "d" * 64}]
    m.generate("intro-permaculture", "st", Path(tmp), current[1:], "test-key", current_plan=current)
    manifest = json.loads((output / "verification.json").read_text())
    assert [item["slide"] for item in manifest["slides"]] == [1, 2]
    current[0]["spokenSha256"] = "e" * 64
    try:
        m.generate("intro-permaculture", "st", Path(tmp), [], "test-key", current_plan=current)
    except ValueError as error:
        assert "stale for current narration" in str(error)
    else:
        raise AssertionError("stale unselected audio was silently retained")
`;
  const result = spawnSync('python3', ['-c', source, script], {
    cwd: root, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});
