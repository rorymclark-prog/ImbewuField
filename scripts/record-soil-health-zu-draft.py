#!/usr/bin/env python3
"""Stage unreviewed Soil Health isiZulu narration using the Seeds Thando voice settings.

Run: uv run --with edge-tts python scripts/record-soil-health-zu-draft.py [stage-dir]
The generated clips are explicitly unreviewed draft audio; human language review remains pending.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import html
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STAGE = Path.home() / "Downloads/imbewu-record/soil-health-zu-20260924"
MODULE = "soil-health"
LANGUAGE = "zu"
VOICE = "zu-ZA-ThandoNeural"
RATE = "-12%"
SLIDES = 20


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def norm(text: str) -> str:
    return "".join(ch for ch in html.unescape(text).casefold() if ch.isalnum())


def run(args: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(args, cwd=ROOT, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else ""


def duration(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "csv=p=0", str(path)], capture=True))


def decode(path: Path) -> None:
    run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"])


async def synthesize(text: str, target: Path) -> dict:
    boundaries = []
    partial = target.with_suffix(".partial.mp3")
    try:
        with partial.open("wb") as output:
            voice = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
            async for event in voice.stream():
                if event["type"] == "audio":
                    output.write(event["data"])
                elif event["type"] == "WordBoundary":
                    boundaries.append({key: event[key] for key in ("text", "offset", "duration")
                                       if key in event})
        if not partial.exists() or not partial.stat().st_size:
            raise RuntimeError("Edge TTS returned no audio")
        seconds = duration(partial)
        if seconds <= 0.3:
            raise RuntimeError(f"clip is too short ({seconds:.2f}s)")
        decode(partial)
        if not boundaries:
            raise RuntimeError("no word boundaries returned")
        if norm(text) != norm(" ".join(str(x.get("text", "")) for x in boundaries)):
            raise RuntimeError("returned word-boundary text does not match source")
        final = boundaries[-1]
        end = (final["offset"] + final["duration"]) / 10_000_000
        if seconds + 0.1 < end:
            raise RuntimeError("audio ends before the last word boundary")
        data = partial.read_bytes()
        partial.replace(target)
        return {"seconds": seconds, "bytes": len(data), "audioSha256": sha(data),
                "fullDecode": "pass", "wordBoundaryAvailable": True,
                "textMatch": True, "wordBoundaries": boundaries,
                "humanListeningReview": False}
    except Exception:
        partial.unlink(missing_ok=True)
        raise


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=DEFAULT_STAGE)
    stage = parser.parse_args().directory.expanduser().resolve()
    for cmd in ("ffmpeg", "ffprobe"):
        if shutil.which(cmd) is None:
            raise SystemExit(f"{cmd} is required")

    script = ROOT / "docs/narration/soil-health.zu.md"
    english = ROOT / "docs/narration/soil-health.en.md"
    lesson_source = ROOT / "lib/course-modules.ts"
    script_sha, english_sha, lesson_sha = map(lambda p: sha(p.read_bytes()),
                                               (script, english, lesson_source))
    stage.mkdir(parents=True, exist_ok=True)
    source_dir = stage / "source-text"
    run(["node", "scripts/course-narration-export.mjs", MODULE, LANGUAGE, str(source_dir)])
    sources = sorted(source_dir.glob("slide-*.txt"))
    expected = [f"slide-{n:02d}.txt" for n in range(1, SLIDES + 1)]
    if [p.name for p in sources] != expected:
        raise SystemExit(f"Expected 20 sequential blocks; found {[p.name for p in sources]}")

    audio_dir, proofs = stage / "isizulu", stage / "proof"
    audio_dir.mkdir(exist_ok=True)
    proofs.mkdir(exist_ok=True)
    rows = []
    for source in sources:
        n = int(re.search(r"(\d+)", source.stem)[1])
        text = source.read_text(encoding="utf-8")
        target = audio_dir / f"Slide_{n:02d}_isiZulu.mp3"
        proof = await synthesize(text, target)
        proof.update({"module": MODULE, "language": LANGUAGE, "slide": n,
                      "voice": VOICE, "rate": RATE,
                      "sourceFile": str(source.relative_to(stage)),
                      "sourceSha256": sha(source.read_bytes()),
                      "scriptFile": str(script.relative_to(ROOT)), "scriptSha256": script_sha,
                      "englishSourceFile": str(english.relative_to(ROOT)),
                      "englishSourceSha256": english_sha,
                      "lessonSourceFile": str(lesson_source.relative_to(ROOT)),
                      "lessonSourceSha256": lesson_sha,
                      "generatedAt": datetime.now(timezone.utc).isoformat(),
                      "reviewStatus": "unreviewed-draft; fluent isiZulu and local farming review pending"})
        (proofs / f"slide-{n:02d}.json").write_text(
            json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        rows.append({"slide": n, "file": target.name, "seconds": proof["seconds"],
                     "bytes": proof["bytes"], "sha256": proof["audioSha256"]})
        print(f"staged slide {n:02d}: {proof['seconds']:.2f}s, {proof['bytes']} bytes", flush=True)

    concat = stage / "concat.txt"
    concat.write_text("".join(f"file '{(audio_dir / row['file']).as_posix()}'\n" for row in rows),
                       encoding="utf-8")
    full = audio_dir / "Full_Narration_isiZulu.mp3"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i",
         str(concat), "-c", "copy", str(full)])
    decode(full)
    full_data = full.read_bytes()
    full_record = {"module": MODULE, "language": LANGUAGE, "scope": "slides-1-through-20",
                   "voice": VOICE, "rate": RATE, "seconds": duration(full),
                   "bytes": len(full_data), "audioSha256": sha(full_data),
                   "fullDecode": "pass", "humanListeningReview": False,
                   "reviewStatus": "unreviewed-draft; fluent isiZulu and local farming review pending",
                   "scriptSha256": script_sha, "englishSourceSha256": english_sha,
                   "lessonSourceSha256": lesson_sha,
                   "slideAudioSha256": [r["sha256"] for r in rows]}
    (proofs / "full.json").write_text(json.dumps(full_record, ensure_ascii=False, indent=2) + "\n",
                                        encoding="utf-8")
    if any(sha(path.read_bytes()) != expected_sha for path, expected_sha in
           ((script, script_sha), (english, english_sha), (lesson_source, lesson_sha))):
        raise SystemExit("A source changed while TTS ran; the output is stale")

    record = {"complete": True, "module": MODULE, "language": LANGUAGE, "voice": VOICE,
              "rate": RATE, "reviewStatus": "unreviewed-draft",
              "humanListeningReview": False, "scriptSha256": script_sha,
              "englishSourceSha256": english_sha, "lessonSourceSha256": lesson_sha,
              "slides": rows, "full": full_record}
    (stage / "RUN.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n",
                                    encoding="utf-8")
    print(f"Staged complete draft pack: {stage}")
    print(f"Voice: {VOICE} at {RATE}; human listening review: pending")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
