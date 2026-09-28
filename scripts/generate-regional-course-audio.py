#!/usr/bin/env python3
"""Stage source-paired, explicitly unreviewed regional Study narration.

Usage: GEMINI_API_KEY=... python3 scripts/generate-regional-course-audio.py \
  intro-permaculture st /tmp/imbewu-regional-audio --generate

This deliberately writes outside public/. Audio is registered only after its spoken
text, files, phone player and offline pack have been checked together.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parent.parent
MODEL = "gemini-3.8-flash-tts"
VOICE = "Kore"
LANGUAGE_NAMES = {"st": "Southern Sotho", "ve": "Tshivenda", "ts": "standard written Xitsonga"}


def normalized(text: str) -> str:
    return " ".join(text.split())


def source_blocks(module: str) -> dict[int, str]:
    with tempfile.TemporaryDirectory(prefix="imbewu-english-source-") as tmp:
        result = subprocess.run(
            ["node", "scripts/course-narration-export.mjs", module, "en", tmp],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        blocks = {int(p.stem.split("-")[-1]): p.read_text().strip() for p in Path(tmp).glob("slide-*.txt")}
        if not blocks:
            raise ValueError(f"No canonical English narration exported for {module}: {result.stdout}")
        return blocks


def plan(module: str, lang: str) -> list[dict]:
    path = ROOT / "docs" / "narration" / f"{module}.{lang}.paired-draft.json"
    data = json.loads(path.read_text())
    if data.get("language") != lang or data.get("sourceLanguage") != "en" or data.get("reviewStatus") != "unreviewed":
        raise ValueError("Expected an unreviewed source-paired regional narration packet")
    english = source_blocks(module)
    slides = data["slides"]
    if [s["n"] for s in slides] != list(range(1, len(english) + 1)):
        raise ValueError("Regional slide numbers do not exactly match canonical English narration")
    result = []
    for slide in slides:
        n = slide["n"]
        source = slide["english"]
        target = slide["target"]
        if len(source["body"]) != len(target["body"]):
            raise ValueError(f"Slide {n} loses an English paragraph")
        if normalized(" ".join(source["body"])) != normalized(english[n]):
            raise ValueError(f"Slide {n} English source differs from the current narration script")
        spoken = []
        statuses = []
        for original, candidate in zip(source["body"], target["body"]):
            status = candidate["status"]
            if status == "draft":
                text = candidate.get("text", "").strip()
                if not text or text == original:
                    raise ValueError(f"Slide {n} has an empty or false translated draft")
            elif status == "english-hold":
                text = original
            else:
                raise ValueError(f"Slide {n} has unknown review status {status!r}")
            spoken.append(text)
            statuses.append(status)
        narration = "\n\n".join(spoken)
        result.append({
            "slide": n,
            "sourceEnglish": english[n],
            "spokenText": narration,
            "statuses": statuses,
            "draftParagraphs": statuses.count("draft"),
            "englishHolds": statuses.count("english-hold"),
            "sourceSha256": hashlib.sha256(english[n].encode()).hexdigest(),
            "spokenSha256": hashlib.sha256(narration.encode()).hexdigest(),
        })
    return result


def synthesize(text: str, lang: str, api_key: str) -> bytes:
    body = {
        "model": MODEL,
        "input": [{"type": "user_input", "content": [{
            "type": "text", "text": text,
            "annotations": [{"type": "speech_metadata", "style":
                f"Warm, clear female teaching voice. Speak the text verbatim in {LANGUAGE_NAMES[lang]}; "
                "retain English technical terms exactly where written."}],
        }]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": VOICE}]},
    }
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        data=json.dumps(body).encode(), method="POST",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        result = json.load(response)
    clips = [item for step in result.get("steps", []) if step.get("type") == "model_output"
             for item in step.get("content", []) if item.get("type") == "audio"]
    if not clips:
        raise ValueError("The TTS response did not contain audio")
    return base64.b64decode(clips[-1]["data"])


def encode_mp3(wav: bytes, output: Path) -> float:
    with tempfile.NamedTemporaryFile(suffix=".wav") as source:
        source.write(wav)
        source.flush()
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", source.name,
                        "-ac", "1", "-b:a", "64k", str(output)], check=True)
    probe = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", str(output)], text=True)
    seconds = float(probe.strip())
    if seconds < 1 or output.stat().st_size < 1000:
        raise ValueError(f"Invalid or truncated clip: {output}")
    return round(seconds, 3)


def join_full_narration(output: Path, count: int) -> dict:
    # Each slide remains independently downloadable on a metered connection. The full file is
    # only an optional convenience and must use exactly those same numbered clips in order.
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt") as listing:
        for n in range(1, count + 1):
            clip = output / f"slide-{n:02d}.mp3"
            if not clip.exists():
                raise ValueError(f"Cannot join full narration: missing {clip}")
            listing.write(f"file '{clip}'\n")
        listing.flush()
        full = output / "full.mp3"
        # Independent MP3 encoders reset frame timestamps. Re-encode the joined convenience
        # file so a long phone lesson can seek without non-monotonic timestamp warnings.
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                        "-i", listing.name, "-ac", "1", "-b:a", "64k", str(full)], check=True)
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                              "format=duration", "-of", "csv=p=0", str(full)], text=True).strip())
    return {"seconds": round(duration, 3), "audioSha256": hashlib.sha256(full.read_bytes()).hexdigest()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("module")
    parser.add_argument("lang", choices=LANGUAGE_NAMES)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--generate", action="store_true", help="Call paid TTS; otherwise validate/print the plan")
    parser.add_argument("--limit", type=int, help="Generate at most this many slides for a pilot")
    parser.add_argument("--replace-stale", action="store_true", help="Regenerate only clips whose source-pair hashes changed")
    args = parser.parse_args()
    slides = plan(args.module, args.lang)
    print(f"{args.module}/{args.lang}: {len(slides)} source-matched slides, "
          f"{sum(x['draftParagraphs'] for x in slides)} draft paragraphs, "
          f"{sum(x['englishHolds'] for x in slides)} exact-English holds")
    if not args.generate:
        return
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise SystemExit("Set GEMINI_API_KEY without placing it in the repository")
    output = args.out_dir.resolve() / args.module / args.lang
    if output.is_relative_to(ROOT):
        raise SystemExit("Stage outside the repository; register checked clips in a separate commit")
    output.mkdir(parents=True, exist_ok=True)
    selected = slides[:args.limit] if args.limit else slides
    record_path = output / "verification.json"
    previous = json.loads(record_path.read_text()) if record_path.exists() else None
    verified = {item["slide"]: item for item in previous["slides"]} if previous else {}
    if previous and (previous["module"] != args.module or previous["language"] != args.lang):
        raise SystemExit("Staged clips belong to a different module or language")
    verification = {
        "module": args.module, "language": args.lang, "reviewStatus": "unreviewed-machine-audio",
        "voice": VOICE, "model": MODEL,
        "warning": "Machine voice and translation need fluent speaker and local farming review. English holds are read verbatim.",
        "slides": [],
    }
    for slide in selected:
        path = output / f"slide-{slide['slide']:02d}.mp3"
        generate = not path.exists()
        if path.exists():
            old = verified.get(slide["slide"])
            if not old or old["spokenSha256"] != slide["spokenSha256"] or \
                    old["sourceSha256"] != slide["sourceSha256"] or \
                    old["audioSha256"] != hashlib.sha256(path.read_bytes()).hexdigest():
                if not args.replace_stale or not old:
                    raise SystemExit(f"Existing clip cannot be safely reused: {path}")
                # Keep the former recording recoverable until the new spoken source has been checked.
                previous_path = output / f"slide-{slide['slide']:02d}.{old['audioSha256'][:10]}.stale.mp3"
                if previous_path.exists():
                    raise SystemExit(f"Refusing to overwrite a previous recording: {previous_path}")
                path.rename(previous_path)
                generate = True
            else:
                slide["seconds"] = old["seconds"]
                slide["audioSha256"] = old["audioSha256"]
        if generate:
            try:
                wav = synthesize(slide["spokenText"], args.lang, key)
            except urllib.error.HTTPError as error:
                raise SystemExit(f"TTS failed on slide {slide['slide']}: HTTP {error.code}") from error
            slide["seconds"] = encode_mp3(wav, path)
            slide["audioSha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        verified[slide["slide"]] = slide
        verification["slides"] = [verified[n] for n in sorted(verified)]
        record_path.write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n")
        print(f"slide {slide['slide']:02d}: {slide['seconds']}s, "
              f"{slide['draftParagraphs']} draft / {slide['englishHolds']} English holds", flush=True)
    if len(selected) == len(slides):
        verification["fullNarration"] = join_full_narration(output, len(slides))
    record_path.write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
