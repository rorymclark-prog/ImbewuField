#!/usr/bin/env python3
"""Record an authored tour and retain word timings for its highlights.

Run with: uv run --with edge-tts python scripts/record-forest-layer-tour.py
Use --art-dir to select another storyboard; the forest tour remains the default.
Changing the source requires re-rendering the tour before importing either asset.
"""
import argparse,asyncio,json,html,hashlib,subprocess
from pathlib import Path
import edge_tts
parser=argparse.ArgumentParser()
parser.add_argument('--art-dir',type=Path,default=Path(__file__).resolve().parents[1]/'docs/media/studies-animation-quality/forest-layers')
root=parser.parse_args().art_dir
config=json.loads((root/'storyboard.json').read_text())
text='\n\n'.join(s['narration'] for s in config['scenes'])
def norm(t): return ''.join(c for c in html.unescape(t).casefold() if c.isalnum())
async def main():
 words=[];out=root/'narration.mp3'
 with out.open('wb') as f:
  async for event in edge_tts.Communicate(text,'en-ZA-LukeNeural',rate='-12%',boundary='WordBoundary').stream():
   if event['type']=='audio': f.write(event['data'])
   elif event['type']=='WordBoundary': words.append({k:event[k] for k in ['text','offset','duration']})
 assert norm(text)==norm(' '.join(w['text'] for w in words)), 'Narration text differs'
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(out)]))
 starts=[];index=0
 for scene in config['scenes']:
  expected=norm(scene['narration']);spoken='';start=words[index]['offset']/1e7
  while len(spoken)<len(expected):
   spoken+=norm(words[index]['text']);index+=1
  assert spoken==expected,scene['id'];starts.append(start)
 assert index==len(words)
 ends=[(words[-1]['offset']+words[-1]['duration'])/1e7];assert duration+.1>=ends[0]
 subprocess.run(['ffmpeg','-v','error','-i',str(out),'-f','null','-'],check=True)
 (root/'timing.json').write_text(json.dumps({'voice':'en-ZA-LukeNeural','rate':'-12%','seconds':duration,'starts':starts,'text_match':True,'full_decode':'pass','human_listening_review':False,'source_sha256':hashlib.sha256(text.encode()).hexdigest(),'audio_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'words':words},indent=2)+'\n')
 print('Verified',len(words),'words;',duration,'seconds; scene starts',starts)
asyncio.run(main())
