#!/usr/bin/env python3
"""Record the exported public app-guide scripts, with resumable verification.

uv run --with edge-tts python scripts/record-app-guide-narration.py <recording-directory>
Run app-guide-narration.mjs export first; import only after the complete batch passes.
Word alignment and decode checks do not replace a fluent listening review.
"""
import argparse, asyncio, json, hashlib, html, subprocess
from pathlib import Path
import edge_tts
parser=argparse.ArgumentParser()
parser.add_argument('directory',type=Path)
ROOT=parser.parse_args().directory.resolve()
def digest(data): return hashlib.sha256(data).hexdigest()
def norm(text): return ''.join(c for c in html.unescape(text).casefold() if c.isalnum())
async def record(script, section):
 folder=ROOT/script['id']; path=folder/(section['id']+'.mp3'); evidence=folder/(section['id']+'.verification.json')
 if path.exists() and evidence.exists():
  old=json.loads(evidence.read_text())
  if (old['sourceSha256']==section['sourceSha256'] and old['audioSha256']==digest(path.read_bytes())
      and old.get('voice')==script['voice'] and old.get('rate')==script['rate']
      and old.get('textMatch') is True and old.get('fullDecode')=='pass'):
   return {'guide':script['id'],'section':section['id'],'status':'cached'}
 words=[]; temp=path.with_suffix('.partial.mp3')
 try:
  with temp.open('wb') as f:
   async for event in edge_tts.Communicate(section['text'],script['voice'],rate=script['rate'],boundary='WordBoundary').stream():
    if event['type']=='audio': f.write(event['data'])
    elif event['type']=='WordBoundary': words.append({k:event[k] for k in ['text','offset','duration']})
  if norm(section['text'])!=norm(' '.join(w['text'] for w in words)): raise ValueError('word-boundary text mismatch')
  duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(temp)]))
  if not words or duration<=0 or duration+.1<(words[-1]['offset']+words[-1]['duration'])/1e7: raise ValueError('incomplete audio timing')
  subprocess.run(['ffmpeg','-v','error','-i',str(temp),'-f','null','-'],check=True,capture_output=True)
  proof={'voice':script['voice'],'rate':script['rate'],'seconds':duration,'bytes':temp.stat().st_size,'sourceSha256':section['sourceSha256'],'audioSha256':digest(temp.read_bytes()),'textMatch':True,'fullDecode':'pass','humanListeningReview':False,'words':words}
  temp.replace(path); evidence.write_text(json.dumps(proof,indent=2)+'\n')
  return {'guide':script['id'],'section':section['id'],'status':'verified','seconds':duration}
 except Exception as e:
  return {'guide':script['id'],'section':section['id'],'status':'failed','error':str(e)}
async def main():
 index=json.loads((ROOT/'INDEX.json').read_text());results=[]
 for guide in index['guides']:
  script=json.loads((ROOT/guide['id']/'script.json').read_text())
  for section in script['sections']:
   result=await record(script,section);results.append(result)
   (ROOT/'RUN.json').write_text(json.dumps({'complete':False,'results':results},indent=2)+'\n')
   print(json.dumps(result),flush=True)
  print('GUIDE FINISHED '+guide['id'],flush=True)
 (ROOT/'RUN.json').write_text(json.dumps({'complete':True,'results':results},indent=2)+'\n')
 print('BATCH FINISHED',flush=True)
 if any(r['status']=='failed' for r in results): raise SystemExit(1)
asyncio.run(main())
