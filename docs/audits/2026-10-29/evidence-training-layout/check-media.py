"""Read-only asset integrity check; does not certify wording or device playback."""
import concurrent.futures
import collections
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[4]
files = sorted(path for path in (root / 'public').rglob('*') if path.suffix.lower() in {'.mp3', '.m4a', '.mp4', '.webm'})

def inspect(path):
    relative = str(path.relative_to(root))
    try:
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', str(path)], capture_output=True, text=True, timeout=120)
        metadata = json.loads(probe.stdout or '{}')
        duration = float(metadata.get('format', {}).get('duration', 0))
        kinds = [stream.get('codec_type') for stream in metadata.get('streams', [])]
        if probe.returncode or duration <= 0 or not any(kind in {'audio', 'video'} for kind in kinds):
            return {'path': relative, 'error': 'Missing duration or readable media stream', 'details': probe.stderr[:500]}
        decode = subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(path), '-f', 'null', '-'], capture_output=True, text=True, timeout=120)
        if decode.returncode or decode.stderr.strip():
            return {'path': relative, 'error': 'Media decoder reported an error', 'details': decode.stderr[:500]}
        return {'path': relative, 'durationSeconds': round(duration, 3), 'streams': kinds, 'bytes': path.stat().st_size}
    except Exception as error:
        return {'path': relative, 'error': type(error).__name__ + ': ' + str(error)[:300]}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(inspect, files))
failures = [record for record in records if 'error' in record]
result = {'scope': 'All repository public MP3, M4A, MP4 and WebM files; full FFmpeg decode. Not a linguistic review, player/browser test or offline-device check.', 'files': len(files), 'extensions': dict(collections.Counter(path.suffix for path in files)), 'failures': failures, 'records': records}
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/imbewu-media-integrity.json')
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'records'}, indent=2))
sys.exit(bool(failures))
