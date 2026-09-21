"""Rebuild this local review from existing assets, refusing changed source bytes."""
from pathlib import Path
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
manifest = json.loads((HERE / 'sources.json').read_text())
assets = []
for item in manifest['video'] + manifest['slide_stills']:
    source = ROOT / item['repository_path'] if 'repository_path' in item else Path(item['local_source'])
    assets.append((source, HERE / item['local_path'], item['sha256']))
for slide, digest in manifest['audio_sha256'].items():
    assets.append((ROOT / f'public/course-audio/soil-health/en/{slide}.mp3', HERE / f'assets/audio/{slide}.mp3', digest))
# Validate the whole set before copying so a stale/missing candidate cannot become a partial review.
for source, _, digest in assets:
    if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != digest:
        raise SystemExit(f'Missing or changed source: {source}')
for source, target, _ in assets:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
print(f'Restored {len(assets)} verified assets. Serve this directory with python3 -m http.server 4372 --bind 127.0.0.1')
