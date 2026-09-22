"""Rebuild this local review from existing assets, refusing changed source bytes."""
from pathlib import Path
import hashlib
import json
import subprocess

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
verified = []
for source, target, digest in assets:
    data = source.read_bytes() if source.is_file() else b''
    if hashlib.sha256(data).hexdigest() != digest and source.is_relative_to(ROOT):
        # Preserve this comparison's published baseline when a later lesson replaces a still.
        data = subprocess.check_output(['git', 'show', f"{manifest['repository_base_commit']}:{source.relative_to(ROOT)}"], cwd=ROOT)
    if hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit(f'Missing or changed source: {source}')
    verified.append((target, data))
for target, data in verified:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
print(f'Restored {len(assets)} verified assets. Serve this directory with python3 -m http.server 4372 --bind 127.0.0.1')
