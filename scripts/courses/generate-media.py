#!/usr/bin/env python3
"""Generate the courses' NEW images and animations straight into the repo.

Reads courses/media-manifest.json (run scripts/courses/build.py first — it attaches a full prompt,
with the course's own look from courses/<course>/style.md, to every NEW item) and calls Google's
Gemini API:
  * images     → Gemini image model (the same family the app's image producer uses)
  * animations → Veo (the video model behind Google Flow), silent, 16:9
Each result is written to the item's `target` path; re-run build.py and the decks pick it up.

WHY THE API AND NOT THE FLOW WEBSITE: Flow is a browser app with no API of its own. Veo, the model
it runs, is on the Gemini API, so the same clips can be made unattended and land in the repo with
the right names — no downloading, renaming and uploading 400 files by hand.

Needs:  GEMINI_API_KEY in the environment (a key from Google AI Studio; the one the app already
        uses in Vercel works). Optional: IMAGE_MODEL, VEO_MODEL to override the model ids.
        ffmpeg (optional) to strip Veo's audio track and cut a still frame.

Usage:
  python3 scripts/courses/generate-media.py --course farmer-5day --kind image --limit 5
  python3 scripts/courses/generate-media.py --ids F-P06-ART,F-ANI-17
  python3 scripts/courses/generate-media.py --course ai-literacy --dry-run      # show what would run
Existing files are skipped unless --force. Costs money per call — start with --limit.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "courses" / "media-manifest.json"
API = "https://generativelanguage.googleapis.com/v1beta"
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "gemini-3-pro-image-preview")
VEO_MODEL = os.environ.get("VEO_MODEL", "veo-3.1-generate-preview")

ASPECT = {"poster-art": "3:4", "image": "16:9", "photo": "16:9", "animation": "16:9"}
MAX_EDGE = {"poster-art": 3508, "image": 1600, "photo": 1600}


def headers(key: str) -> dict:
    return {"x-goog-api-key": key, "Content-Type": "application/json"}


def aspect_for(item: dict) -> str:
    if item["kind"] == "image" and "card" in (item.get("length") or ""):
        return "2:3"
    return ASPECT.get(item["kind"], "16:9")


def save_image(raw: bytes, item: dict, out: Path) -> None:
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    edge = MAX_EDGE.get(item["kind"], 1600)
    if max(im.size) > edge:
        im.thumbnail((edge, edge))
    out.parent.mkdir(parents=True, exist_ok=True)
    # Poster art keeps a lossless master beside the JPG for print layout.
    if item["kind"] == "poster-art":
        im.save(out.with_suffix(".png"))
    q = 88
    while True:
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= (800_000 if item["kind"] == "poster-art" else 250_000) or q <= 60:
            break
        q -= 6
    out.write_bytes(buf.getvalue())


def gen_image(requests, key: str, item: dict, out: Path) -> None:
    body = {
        "contents": [{"parts": [{"text": item["prompt"]}]}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect_for(item)}},
    }
    r = requests.post(f"{API}/models/{IMAGE_MODEL}:generateContent", headers=headers(key), json=body, timeout=300)
    r.raise_for_status()
    for cand in r.json().get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            data = part.get("inlineData") or part.get("inline_data")
            if data and data.get("data"):
                save_image(base64.b64decode(data["data"]), item, out)
                return
    raise RuntimeError(f"no image returned: {json.dumps(r.json())[:400]}")


def gen_video(requests, key: str, item: dict, out: Path) -> None:
    body = {"instances": [{"prompt": item["prompt"]}],
            "parameters": {"aspectRatio": "16:9", "personGeneration": "allow_adult"}}
    r = requests.post(f"{API}/models/{VEO_MODEL}:predictLongRunning", headers=headers(key), json=body, timeout=120)
    r.raise_for_status()
    op = r.json()["name"]
    for _ in range(90):  # up to ~15 min
        time.sleep(10)
        s = requests.get(f"{API}/{op}", headers=headers(key), timeout=60).json()
        if s.get("done"):
            if "error" in s:
                raise RuntimeError(s["error"])
            samples = s["response"]["generateVideoResponse"]["generatedSamples"]
            uri = samples[0]["video"]["uri"]
            v = requests.get(uri, headers={"x-goog-api-key": key}, timeout=300, allow_redirects=True)
            v.raise_for_status()
            out.parent.mkdir(parents=True, exist_ok=True)
            raw = out.with_suffix(".raw.mp4")
            raw.write_bytes(v.content)
            finish_video(raw, out)
            return
    raise TimeoutError(f"Veo operation {op} did not finish")


def finish_video(raw: Path, out: Path) -> None:
    """Silent, web-friendly MP4 + a still frame. Without ffmpeg, keep the file as delivered."""
    if not shutil.which("ffmpeg"):
        raw.rename(out)
        print("   (ffmpeg missing: audio not stripped, no still frame — run finish later)")
        return
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-an", "-vf", "scale=1280:-2",
                    "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-movflags", "+faststart", str(out)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.5", "-i", str(out), "-frames:v", "1",
                    "-q:v", "4", str(out.with_suffix(".jpg"))], check=True)
    raw.unlink()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--course")
    ap.add_argument("--ids", help="comma-separated media ids")
    ap.add_argument("--kind", choices=["image", "poster-art", "photo", "animation"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    items = [it for it in json.loads(MANIFEST.read_text())["items"] if it.get("prompt") and it.get("target")]
    if args.course:
        items = [it for it in items if it["course"] == args.course]
    if args.ids:
        want = {i.strip() for i in args.ids.split(",")}
        items = [it for it in items if it["id"] in want]
    if args.kind:
        items = [it for it in items if it["kind"] == args.kind]
    items = [it for it in items if args.force or not (ROOT / it["target"]).exists()]
    if args.limit:
        items = items[: args.limit]

    print(f"{len(items)} item(s) to generate (image model {IMAGE_MODEL}, video model {VEO_MODEL})")
    if args.dry_run or not items:
        for it in items:
            print(f" - {it['id']:12} {it['kind']:11} → {it['target']}")
        return 0

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("GEMINI_API_KEY is not set. Add it to the environment (never paste it in chat).", file=sys.stderr)
        return 2
    import requests

    failed = []
    for n, it in enumerate(items, 1):
        out = ROOT / it["target"]
        print(f"[{n}/{len(items)}] {it['id']} ({it['kind']}) …", flush=True)
        try:
            (gen_video if it["kind"] == "animation" else gen_image)(requests, key, it, out)
            print(f"   saved {out.relative_to(ROOT)}")
        except Exception as e:  # keep going; report at the end
            failed.append(it["id"])
            print(f"   FAILED: {e}")
    if failed:
        print("Failed:", ", ".join(failed))
    print("Now run: python3 scripts/courses/build.py")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
