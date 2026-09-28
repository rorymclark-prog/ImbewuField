import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const script = path.join(root, 'scripts/generate-regional-course-audio-narakeet.py');

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
    assert.doesNotMatch(result.stdout, /NARAKEET_API_KEY/);
  }
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
