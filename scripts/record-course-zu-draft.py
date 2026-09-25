#!/usr/bin/env python3
"""Record the market-community isiZulu draft as review audio, with per-slide provenance.

Run from the repository root:
  uv run --with edge-tts python scripts/record-course-zu-draft.py

The existing Node narration exporter supplies the exact spoken text. This writes only to the
external staging directory and does not import audio into public/course-audio or release it.
"""

import argparse
import asyncio
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import edge_tts
except ImportError as exc:
    raise SystemExit(
        "edge-tts is unavailable. Run this script with: "
        "uv run --with edge-tts python scripts/record-course-zu-draft.py"
    ) from exc


REPO = Path(__file__).resolve().parents[1]
DEFAULT_STAGE = Path.home() / "Downloads/imbewu-record/market-community-zu-20260924"
MODULE = "market-community"
LANGUAGE = "zu"
VOICE = "zu-ZA-ThandoNeural"
RATE = "-12%"
EXPECTED_SLIDES = 20


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalized_words(text: str) -> str:
    return "".join(ch for ch in html.unescape(text).casefold() if ch.isalnum())


def run_checked(args: list[str], *, cwd: Path = REPO) -> str:
    result = subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=True)
    return result.stdout.strip()


def probe_duration(path: Path) -> float:
    value = run_checked([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(path),
    ])
    return float(value)


def decode_audio(path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
        check=True,
        capture_output=True,
    )


async def synthesize(text: str, output: Path) -> dict:
    boundaries: list[dict] = []
    temp = output.with_suffix(".partial.mp3")
    try:
        with temp.open("wb") as audio_file:
            communicate = edge_tts.Communicate(
                text, VOICE, rate=RATE, boundary="WordBoundary"
            )
            async for event in communicate.stream():
                if event["type"] == "audio":
                    audio_file.write(event["data"])
                elif event["type"] == "WordBoundary":
                    boundaries.append({
                        key: event[key] for key in ("text", "offset", "duration")
                        if key in event
                    })

        if not temp.exists() or temp.stat().st_size == 0:
            raise RuntimeError("Edge TTS returned no audio bytes")
        duration = probe_duration(temp)
        if duration <= 0.3:
            raise RuntimeError(f"audio duration is too short ({duration:.3f}s)")
        decode_audio(temp)

        boundary_available = bool(boundaries)
        text_match = None
        if boundary_available:
            boundary_text = " ".join(str(item.get("text", "")) for item in boundaries)
            text_match = normalized_words(text) == normalized_words(boundary_text)
            if not text_match:
                raise RuntimeError("word-boundary transcript does not match exported text")
            last = boundaries[-1]
            if "offset" in last and "duration" in last:
                boundary_end_seconds = (last["offset"] + last["duration"]) / 10_000_000
                if duration + 0.1 < boundary_end_seconds:
                    raise RuntimeError("audio ends before the final word boundary")

        audio_bytes = temp.read_bytes()
        temp.replace(output)
        return {
            "voice": VOICE,
            "rate": RATE,
            "seconds": duration,
            "bytes": len(audio_bytes),
            "audioSha256": sha256(audio_bytes),
            "wordBoundaryAvailable": boundary_available,
            "textMatch": text_match,
            "fullDecode": "pass",
            "humanListeningReview": False,
            "wordBoundaries": boundaries,
        }
    except Exception:
        temp.unlink(missing_ok=True)
        raise


def export_texts(stage: Path) -> Path:
    export_dir = stage / "source-text"
    run_checked([
        "node", "scripts/course-narration-export.mjs", MODULE, LANGUAGE,
        str(export_dir),
    ])
    return export_dir


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=DEFAULT_STAGE)
    args = parser.parse_args()
    stage = args.directory.expanduser().resolve()
    if not (REPO / "docs/narration/market-community.zu.md").is_file():
        raise SystemExit("Run from the ImbewuField checkout containing market-community.zu.md")
    if shutil.which("ffprobe") is None or shutil.which("ffmpeg") is None:
        raise SystemExit("ffprobe and ffmpeg must be installed before recording")

    stage.mkdir(parents=True, exist_ok=True)
    export_dir = export_texts(stage)
    script_path = REPO / "docs/narration/market-community.zu.md"
    script_sha = sha256(script_path.read_bytes())
    source_files = sorted(export_dir.glob("slide-*.txt"))
    expected_names = [f"slide-{i:02d}.txt" for i in range(1, EXPECTED_SLIDES + 1)]
    if [path.name for path in source_files] != expected_names:
        raise SystemExit(
            f"Expected exactly {EXPECTED_SLIDES} sequential exported slides; found "
            f"{[path.name for path in source_files]}"
        )

    audio_dir = stage / "isizulu"
    audio_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    run_path = stage / "RUN.json"
    for source_path in source_files:
        slide = int(re.search(r"(\d+)", source_path.stem).group(1))
        source_bytes = source_path.read_bytes()
        text = source_bytes.decode("utf-8")
        source_hash = sha256(source_bytes)
        output = audio_dir / f"Slide_{slide:02d}_isiZulu.mp3"
        proof_path = audio_dir / f"Slide_{slide:02d}_isiZulu.verification.json"

        if output.exists() and proof_path.exists():
            try:
                old = json.loads(proof_path.read_text(encoding="utf-8"))
                current_audio_hash = sha256(output.read_bytes())
                if (
                    old.get("sourceSha256") == source_hash
                    and old.get("scriptSha256") == script_sha
                    and old.get("audioSha256") == current_audio_hash
                    and old.get("voice") == VOICE
                    and old.get("rate") == RATE
                    and old.get("fullDecode") == "pass"
                    and old.get("wordBoundaryAvailable") is True
                    and old.get("textMatch") is True
                    and old.get("humanListeningReview") is False
                ):
                    results.append({"slide": slide, "status": "cached", "proof": proof_path.name})
                    print(f"cached slide {slide:02d}", flush=True)
                    continue
            except (OSError, ValueError, TypeError):
                pass

        if output.exists() or proof_path.exists():
            output.unlink(missing_ok=True)
            proof_path.unlink(missing_ok=True)

        proof = await synthesize(text, output)
        proof.update({
            "module": MODULE,
            "language": LANGUAGE,
            "slide": slide,
            "sourceFile": str(source_path.relative_to(stage)),
            "sourceSha256": source_hash,
            "scriptFile": str(script_path.relative_to(REPO)),
            "scriptSha256": script_sha,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        })
        proof_path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result = {"slide": slide, "status": "verified", "seconds": proof["seconds"], "bytes": proof["bytes"]}
        results.append(result)
        run_path.write_text(json.dumps({
            "complete": False,
            "module": MODULE,
            "language": LANGUAGE,
            "voice": VOICE,
            "rate": RATE,
            "humanListeningReview": False,
            "scriptSha256": script_sha,
            "results": results,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result), flush=True)

    # Recheck that the exact script stayed unchanged while the remote TTS calls were running.
    if sha256(script_path.read_bytes()) != script_sha:
        raise SystemExit("The narration source changed during recording; staged batch is stale")
    all_ready = len(results) == EXPECTED_SLIDES and all(
        item.get("status") in {"verified", "cached"} for item in results
    )
    run_path.write_text(json.dumps({
        "complete": all_ready,
        "module": MODULE,
        "language": LANGUAGE,
        "voice": VOICE,
        "rate": RATE,
        "humanListeningReview": False,
        "scriptSha256": script_sha,
        "results": results,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not all_ready:
        raise SystemExit(f"Expected {EXPECTED_SLIDES} verified slides; got {len(results)}")
    print(f"BATCH STAGED: {audio_dir}", flush=True)
    print("Review status: humanListeningReview=false; this is draft audio, not fluent approval.", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("Interrupted; completed slides and RUN.json remain staged for resume.", file=sys.stderr)
        raise SystemExit(130)
