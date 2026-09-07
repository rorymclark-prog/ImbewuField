#!/usr/bin/env python3
"""Record exported, numbered text into a separate review pack; never overwrite live audio.

Requires edge-tts and ffmpeg. Run the existing course:record-sheet exporter first.
The exact voice follows docs/COURSE-NARRATION-VOICE.md. A source hash and speech
boundary metadata accompany each recording. Review is deliberately not inferred
from the service returning audio or from a duration check.
"""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone
import edge_tts
import edge_tts.communicate as speech


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('scripts', type=Path, help='Root containing module/lang/slide-NN.txt')
    parser.add_argument('output', type=Path, help='Separate review audio directory')
    parser.add_argument('--system-trust', action='store_true', help='Also load the operating system trusted certificate authorities; TLS verification stays enabled')
    args = parser.parse_args()
    if args.system_trust:
        speech._SSL_CTX.load_default_certs()
    semaphore = asyncio.Semaphore(2)
    sources = sorted(args.scripts.glob('*/*/slide-*.txt'))
    if not sources:
        raise RuntimeError('No exported slide text found.')
    results = []

    async def record(source):
        async with semaphore:
            module, lang = source.parts[-3:-1]
            settings = json.loads((source.parent / 'voice-settings.json').read_text())
            if settings['module'] != module or settings['lang'] != lang or settings['reviewRequired']:
                raise RuntimeError(f'Recording settings need review: {source.parent}')
            voice, rate = settings['voice'], settings['rate']
            out = args.output / module / lang
            out.mkdir(parents=True, exist_ok=True)
            media = out / (source.stem + '.mp3')
            timing = out / (source.stem + '.boundaries.jsonl')
            receipt = out / (source.stem + '.recording.json')
            source_sha = digest(source)
            if receipt.exists():
                saved = json.loads(receipt.read_text())
                if saved['source_sha256'] == source_sha and saved['voice'] == voice and saved['rate'] == rate and media.exists() and saved['audio_sha256'] == digest(media):
                    results.append(saved)
                    return
            text = source.read_text().strip()
            if not text:
                raise RuntimeError(f'Empty recording text: {source}')
            await edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary', connect_timeout=15, receive_timeout=45).save(str(media), str(timing))
            seconds = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(media)], text=True).strip())
            if seconds <= 0 or media.stat().st_size == 0:
                raise RuntimeError(f'Empty recording: {media}')
            saved = {'module':module,'lang':lang,'slide':source.stem,'voice':voice,'rate':rate,'pitch':'+0Hz','volume':'+0%',
                     'engine':'edge-tts','engine_version':importlib.metadata.version('edge-tts'),
                     'generated_utc':datetime.now(timezone.utc).isoformat(),'source_sha256':source_sha,'audio_sha256':digest(media),
                     'seconds':seconds,'bytes':media.stat().st_size,'review':'awaiting listening and pronunciation review'}
            receipt.write_text(json.dumps(saved, indent=2)+'\n')
            (out / source.name).write_text(text+'\n')
            results.append(saved)
            print(f'{module}/{lang}/{source.stem}: {seconds:.2f}s', flush=True)
    await asyncio.gather(*(record(source) for source in sources))
    for module,lang in sorted({(row['module'],row['lang']) for row in results}):
        out = args.output/module/lang
        clips = sorted(out.glob('slide-*.mp3'))
        listing = out/'concat.txt'
        listing.write_text('\n'.join("file '"+str(clip.resolve()).replace("'", "'\\''")+"'" for clip in clips))
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-c:a','copy',str(out/'full.mp3')],check=True)
        listing.unlink()
    (args.output/'recordings.json').write_text(json.dumps(sorted(results,key=lambda row:(row['module'],row['lang'],row['slide'])),indent=2)+'\n')
    print(f'{len(results)} clips generated for review.',flush=True)

if __name__ == '__main__':
    asyncio.run(main())
