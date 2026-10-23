#!/usr/bin/env python3
"""Plan or stage source-paired regional narration with Narakeet.

Plan mode is the default and does not read credentials or make network requests.
Generation requires NARAKEET_API_KEY and writes only outside the repository.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parent.parent
VOICES = {
    "st": ("Palesa", "palesa"),
    "ve": ("Mulalo", "mulalo"),
    "ts": ("Basetsana", "basetsana"),
}


def _load_existing_plan():
    path = Path(__file__).with_name("generate-regional-course-audio.py")
    spec = importlib.util.spec_from_file_location("regional_course_audio_source", path)
    if not spec or not spec.loader:
        raise RuntimeError("Could not load the canonical paired narration planner")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.plan


plan = _load_existing_plan()


def audio_digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stage_root(out_dir: Path) -> Path:
    output = out_dir.expanduser().resolve()
    if output == ROOT or ROOT in output.parents:
        raise ValueError("Stage outside the repository")
    return output


def request_audio(text: str, voice_id: str, api_key: str) -> bytes:
    url = "https://api.narakeet.com/text-to-speech/mp3?" + urllib.parse.urlencode({"voice": voice_id})
    request = urllib.request.Request(
        url, data=text.encode("utf-8"), method="POST",
        headers={"x-api-key": api_key, "Content-Type": "text/plain; charset=utf-8",
                 "Accept": "application/octet-stream"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        audio = response.read()
    if not audio:
        raise ValueError("Narakeet returned an empty audio response")
    return audio


def inspect_mp3(audio: bytes) -> float:
    """Require a decodable MP3 before putting provider bytes in the stage directory."""
    with tempfile.NamedTemporaryFile(suffix=".mp3") as temporary:
        temporary.write(audio)
        temporary.flush()
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=format_name,duration",
                 "-of", "json", temporary.name], capture_output=True, text=True, check=True,
            )
            metadata = json.loads(result.stdout)["format"]
            names = metadata["format_name"].split(",")
            seconds = float(metadata["duration"])
        except (OSError, subprocess.CalledProcessError, KeyError, ValueError, json.JSONDecodeError) as error:
            raise ValueError("Narakeet response is not a valid MP3 with a readable duration") from error
    if "mp3" not in names or seconds <= 0:
        raise ValueError("Narakeet response is not a valid MP3 with a positive duration")
    return round(seconds, 3)


def _load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("Existing staged clips have no readable verification manifest") from error
    if data.get("slides") is None:
        raise ValueError("Existing verification manifest has no slide records")
    return data


def generate(module: str, lang: str, out_dir: Path, slides: list[dict], api_key: str,
             current_plan: list[dict] | None = None) -> None:
    display_voice, voice_id = VOICES[lang]
    plan_by_slide = {item["slide"]: item for item in (current_plan or slides)}
    too_long = [slide["slide"] for slide in slides if len(slide["spokenText"].encode("utf-8")) > 1000]
    if too_long:
        numbers = ", ".join(f"{number:02d}" for number in too_long)
        raise ValueError(f"Streaming endpoint limit is 1000 UTF-8 bytes; slides {numbers} require the polling API")
    output = stage_root(out_dir) / module / lang
    output.mkdir(parents=True, exist_ok=True)
    record_path = output / "verification.json"
    previous = _load_manifest(record_path) if record_path.exists() else None
    if previous and (previous.get("module") != module or previous.get("language") != lang or
                     previous.get("voiceId") != voice_id):
        raise ValueError("Existing staged clips belong to a different module, language, or voice")
    old_by_slide = {item.get("slide"): item for item in (previous or {}).get("slides", [])}
    # Preserve valid out-of-limit records during a pilot. Their clips are checked against
    # their own stored hashes before they can remain in the manifest.
    records_by_slide = dict(old_by_slide)
    for number, old in old_by_slide.items():
        old_path = output / f"slide-{number:02d}.mp3"
        current = plan_by_slide.get(number)
        if (not current or old.get("sourceSha256") != current["sourceSha256"] or
                old.get("spokenSha256") != current["spokenSha256"]):
            raise ValueError(f"Existing verification record is stale for current narration, slide {number:02d}")
        if not old_path.is_file() or audio_digest(old_path.read_bytes()) != old.get("audioSha256"):
            raise ValueError(f"Existing verification record has missing or changed audio: {old_path}")
    for slide in slides:
        number = slide["slide"]
        audio_path = output / f"slide-{number:02d}.mp3"
        old = old_by_slide.get(number)
        if audio_path.exists():
            current_hash = audio_digest(audio_path.read_bytes())
            if (not old or old.get("sourceSha256") != slide["sourceSha256"] or
                    old.get("spokenSha256") != slide["spokenSha256"] or
                    old.get("audioSha256") != current_hash):
                raise ValueError(f"Refusing stale or unverified audio: {audio_path}")
            records_by_slide[number] = old
            print(f"slide {number:02d}: verified existing audio; source and audio hashes match")
            continue
        if old:
            raise ValueError(f"Verification record exists but audio is missing: {audio_path}")
        audio = request_audio(slide["spokenText"], voice_id, api_key)
        duration = inspect_mp3(audio)
        temporary = audio_path.with_suffix(".mp3.tmp")
        try:
            temporary.write_bytes(audio)
            temporary.replace(audio_path)
        finally:
            temporary.unlink(missing_ok=True)
        records_by_slide[number] = {
            "slide": number,
            "sourceSha256": slide["sourceSha256"],
            "spokenSha256": slide["spokenSha256"],
            "audioSha256": audio_digest(audio),
            "durationSeconds": duration,
        }
        manifest = {
            "module": module, "language": lang, "voice": display_voice, "voiceId": voice_id,
            "reviewStatus": "unreviewed-machine-audio",
            "slides": [records_by_slide[n] for n in sorted(records_by_slide)],
        }
        record_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(f"slide {number:02d}: staged; audio SHA-256 {records_by_slide[number]['audioSha256']}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("module")
    parser.add_argument("lang", choices=VOICES)
    parser.add_argument("out_dir", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--plan", action="store_true", help="Validate and display hashes only (default)")
    mode.add_argument("--generate", action="store_true", help="Call Narakeet TTS and stage audio")
    parser.add_argument("--limit", type=int, help="Stage at most this many slides")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be a positive number")
    try:
        slides = plan(args.module, args.lang)
        display_voice, _ = VOICES[args.lang]
        selected = slides[:args.limit] if args.limit else slides
        print(f"{args.module}/{args.lang}: voice {display_voice}; {len(selected)} of {len(slides)} source-matched slides")
        for slide in selected:
            mixed_summary = f" / {slide['mixedParagraphs']} mixed" if slide["mixedParagraphs"] else ""
            print(f"slide {slide['slide']:02d}: source SHA-256 {slide['sourceSha256']}; "
                  f"spoken SHA-256 {slide['spokenSha256']}; "
                  f"{slide['draftParagraphs']} translated draft / {slide['englishHolds']} English holds"
                  f"{mixed_summary}")
        if not args.generate:
            return
        key = os.environ.get("NARAKEET_API_KEY")
        if not key:
            raise ValueError("Set NARAKEET_API_KEY outside the repository to generate audio")
        generate(args.module, args.lang, args.out_dir, selected, key, current_plan=slides)
    except (OSError, ValueError, RuntimeError, urllib.error.URLError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
