#!/usr/bin/env python3
"""Stage Small Livestock isiZulu review audio from its source-paired drafts.

Run: uv run --with edge-tts python scripts/record-small-livestock-zu-draft.py [stage-dir]

The clips are review candidates. This script never imports them into public learner audio.
"""

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

REPO = Path(__file__).resolve().parents[1]
DEFAULT_STAGE = Path.home() / "Downloads/imbewu-record/small-livestock-zu-20260924"
MODULE = "small-livestock"
LANGUAGE = "zu"
VOICE = "zu-ZA-ThandoNeural"
RATE = "-12%"
FIRST_SLIDE = 1
LAST_SLIDE = 20


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def norm(text: str) -> str:
    return "".join(ch for ch in html.unescape(text).casefold() if ch.isalnum())


def run(args: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(args, cwd=REPO, check=True, text=True,
                            capture_output=capture)
    return result.stdout.strip() if capture else ""


def probe(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "csv=p=0", str(path)], capture=True))


def decode(path: Path) -> None:
    run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"])


async def synthesize(text: str, target: Path) -> dict:
    boundaries: list[dict] = []
    partial = target.with_suffix(".partial.mp3")
    try:
        with partial.open("wb") as output:
            speaker = edge_tts.Communicate(text, VOICE, rate=RATE,
                                           boundary="WordBoundary")
            async for event in speaker.stream():
                if event["type"] == "audio":
                    output.write(event["data"])
                elif event["type"] == "WordBoundary":
                    boundaries.append({key: event[key] for key in ("text", "offset", "duration")
                                       if key in event})
        if not partial.exists() or not partial.stat().st_size:
            raise RuntimeError("Edge TTS returned no audio")
        seconds = probe(partial)
        if seconds <= 0.3:
            raise RuntimeError(f"audio too short ({seconds:.3f}s)")
        decode(partial)
        if not boundaries:
            raise RuntimeError("Edge TTS returned no word boundaries")
        boundary_text = " ".join(str(item.get("text", "")) for item in boundaries)
        if norm(text) != norm(boundary_text):
            raise RuntimeError("word-boundary text does not match the exported source")
        last = boundaries[-1]
        boundary_end = (last["offset"] + last["duration"]) / 10_000_000
        if seconds + 0.1 < boundary_end:
            raise RuntimeError("audio ends before its final word boundary")
        audio = partial.read_bytes()
        partial.replace(target)
        return {"seconds": seconds, "bytes": len(audio), "audioSha256": sha256(audio),
                "fullDecode": "pass", "wordBoundaryAvailable": True,
                "textMatch": True, "wordBoundaries": boundaries,
                "humanListeningReview": False}
    except Exception:
        partial.unlink(missing_ok=True)
        raise


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=DEFAULT_STAGE)
    args = parser.parse_args()
    stage = args.directory.expanduser().resolve()
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise SystemExit("ffmpeg and ffprobe are required")

    script = REPO / "docs/narration/small-livestock.zu.md"
    english = REPO / "docs/narration/small-livestock.en.md"
    lesson_source = REPO / "lib/course-modules.ts"
    script_sha = sha256(script.read_bytes())
    english_sha = sha256(english.read_bytes())
    lesson_source_sha = sha256(lesson_source.read_bytes())
    stage.mkdir(parents=True, exist_ok=True)
    export = stage / "source-text"
    run(["node", "scripts/course-narration-export.mjs", MODULE, LANGUAGE, str(export)])
    sources = sorted(export.glob("slide-*.txt"))
    expected_all = [f"slide-{i:02d}.txt" for i in range(1, LAST_SLIDE + 1)]
    if [path.name for path in sources] != expected_all:
        raise SystemExit(f"expected 20 exported blocks; found {[p.name for p in sources]}")
    selected = [p for p in sources if FIRST_SLIDE <= int(re.search(r"(\d+)", p.stem)[1]) <= LAST_SLIDE]

    audio_dir = stage / "isizulu"
    proof_dir = stage / "proof"
    audio_dir.mkdir(exist_ok=True)
    proof_dir.mkdir(exist_ok=True)
    rows = []
    for source in selected:
        slide = int(re.search(r"(\d+)", source.stem)[1])
        raw = source.read_bytes()
        text = raw.decode("utf-8")
        target = audio_dir / f"Slide_{slide:02d}_isiZulu.mp3"
        proof_path = proof_dir / f"slide-{slide:02d}.json"
        proof = None
        if target.exists() and proof_path.exists():
            try:
                cached = json.loads(proof_path.read_text(encoding="utf-8"))
                if (cached.get("sourceSha256") == sha256(raw)
                        and cached.get("audioSha256") == sha256(target.read_bytes())
                        and cached.get("voice") == VOICE and cached.get("rate") == RATE
                        and cached.get("fullDecode") == "pass"
                        and cached.get("wordBoundaryAvailable") is True
                        and cached.get("textMatch") is True
                        and cached.get("humanListeningReview") is False):
                    proof = cached
                    proof["revalidatedAt"] = datetime.now(timezone.utc).isoformat()
                    print(f"reusing exact source take slide {slide:02d}", flush=True)
            except (OSError, ValueError, TypeError):
                proof = None
        if proof is None:
            target.unlink(missing_ok=True)
            proof_path.unlink(missing_ok=True)
            proof = await synthesize(text, target)
        lesson = "small-livestock-l1" if 4 <= slide <= 8 else ("small-livestock-l2" if 9 <= slide <= 13 else ("small-livestock-l3" if 14 <= slide <= 18 else None))
        proof.update({"module": MODULE, "lesson": lesson,
                      "language": LANGUAGE, "slide": slide, "voice": VOICE,
                      "rate": RATE, "sourceFile": str(source.relative_to(stage)),
                      "sourceSha256": sha256(raw), "scriptFile": str(script.relative_to(REPO)),
                      "scriptSha256": script_sha,
                      "englishSourceFile": str(english.relative_to(REPO)),
                      "englishSourceSha256": english_sha,
                      "lessonSourceFile": str(lesson_source.relative_to(REPO)),
                      "lessonSourceSha256": lesson_source_sha,
                      "generatedAt": datetime.now(timezone.utc).isoformat(),
                      "reviewStatus": "pending-fluent-isiZulu-and-local-farming-review"})
        proof_path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        rows.append({"slide": slide, "file": target.name, "seconds": proof["seconds"],
                     "bytes": proof["bytes"], "sha256": proof["audioSha256"], "proof": True})
        print(f"staged slide {slide:02d} ({proof['seconds']:.2f}s, {proof['bytes']} bytes)", flush=True)

    # Build the full module listening track in slide order.
    concat = stage / "concat.txt"
    concat.write_text("".join(f"file '{(audio_dir / row['file']).as_posix()}'\n" for row in rows),
                      encoding="utf-8")
    full = audio_dir / "Full_Narration_isiZulu.mp3"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i",
         str(concat), "-c", "copy", str(full)])
    decode(full)
    full_bytes = full.read_bytes()
    full_proof = {"module": MODULE, "lesson": None, "scope": "slides-1-through-20",
                  "language": LANGUAGE, "file": full.name, "voice": VOICE,
                  "rate": RATE, "seconds": probe(full), "bytes": len(full_bytes),
                  "audioSha256": sha256(full_bytes), "fullDecode": "pass",
                  "humanListeningReview": False, "reviewStatus": "pending-fluent-isiZulu-and-local-farming-review",
                  "scriptSha256": script_sha, "englishSourceSha256": english_sha,
                  "lessonSourceSha256": lesson_source_sha,
                  "slideAudioSha256": [row["sha256"] for row in rows]}
    (proof_dir / "full.json").write_text(json.dumps(full_proof, ensure_ascii=False, indent=2) + "\n",
                                           encoding="utf-8")

    # Recheck immutable inputs after the remote synthesis calls.
    if sha256(script.read_bytes()) != script_sha or sha256(english.read_bytes()) != english_sha or sha256(lesson_source.read_bytes()) != lesson_source_sha:
        raise SystemExit("a source file changed during TTS; this staged recording is stale")
    run_record = {"complete": len(rows) == LAST_SLIDE - FIRST_SLIDE + 1,
                  "module": MODULE, "language": LANGUAGE,
                  "voice": VOICE, "rate": RATE, "reviewStatus": "pending-fluent-isiZulu-and-local-farming-review",
                  "humanListeningReview": False, "scriptSha256": script_sha,
                  "englishSourceSha256": english_sha, "lessonSourceSha256": lesson_source_sha,
                  "slides": rows, "full": full_proof}
    (stage / "RUN.json").write_text(json.dumps(run_record, ensure_ascii=False, indent=2) + "\n",
                                     encoding="utf-8")
    table = ["# Small Livestock isiZulu review audio — asset sizes", "",
             "> UNREVIEWED DRAFT AUDIO — pending first-language isiZulu and local farming review.",
             "", "| Asset | Seconds | Bytes | SHA-256 |", "| --- | ---: | ---: | --- |"]
    table.extend(f"| `{row['file']}` | {row['seconds']:.2f} | {row['bytes']} | `{row['sha256']}` |" for row in rows)
    table.append(f"| `{full.name}` | {full_proof['seconds']:.2f} | {full_proof['bytes']} | `{full_proof['audioSha256']}` |")
    table.extend(["", f"Voice: `{VOICE}` at `{RATE}`. Text, English and lesson source SHA-256 proofs are in `RUN.json` and `proof/`.", ""])
    (stage / "ASSET-SIZES.md").write_text("\n".join(table), encoding="utf-8")
    print(f"BATCH STAGED: {stage}", flush=True)
    print("Review status: no human listening or fluent/local review claimed.", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("Interrupted; completed takes remain in the staging directory.")
        raise SystemExit(130)
