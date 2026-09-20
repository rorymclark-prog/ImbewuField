#!/usr/bin/env python3
# Keep the recording, source and diagram together so reviewers can find the exact slide.
from pathlib import Path
import subprocess,shutil,json,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageOps
import re
import argparse
parser=argparse.ArgumentParser(description='Prepare unapproved Studies review material; never publishes learner assets.')
parser.add_argument('--output',type=Path,required=True,help='Existing review pack with exported recordings')
parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[1])
args=parser.parse_args()
repo=args.repo.resolve();pack=args.output.resolve()
modules={'water-harvesting':('water',24),'intro-permaculture':('intro',22),'reading-landscape':('landscape',21),'soil-health':('soil',20),'vegetables-staples':('vegetables',18),'food-forest':('forest',20),'small-livestock':('livestock',20),'market-community':('market',20)}
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24)
for module,(short,count) in modules.items():
 out=pack/'isizulu-deck-REVIEW'/module;out.mkdir(parents=True,exist_ok=True)
 art=out/'review-art';art.mkdir(exist_ok=True)
 for poster in (repo/'public/course-animations'/module/'posters').glob('watch-*.jpg'):
  n=int(re.search(r'watch-(\d+)',poster.name)[1]);shutil.copy2(poster,art/f'slide-{n:02}.jpg')
 title=sorted((repo/'public/course-images'/module).glob('*.jpg'))[0]
 ImageOps.pad(Image.open(title).convert('RGB'),(1076,1080),color='#f5f2eb').save(art/'slide-01.jpg',quality=90)
 subprocess.run(['node','scripts/make-lesson-slides.mjs',module,'zu',str(out),'--images',str(art)],cwd=repo,check=True,stdout=subprocess.DEVNULL)
 slides=sorted(out.glob('slide-??.png'));assert len(slides)==count
 records=[]
 for src in slides:
  im=Image.open(src).convert('RGB'); canvas=Image.new('RGB',(im.width,im.height+60),'#793b2d');canvas.paste(im,(0,60));d=ImageDraw.Draw(canvas)
  d.text((32,15),'UNAPPROVED isiZulu REVIEW | English diagram labels await localization | Not for learner release',font=font,fill='white')
  dst=src.with_suffix('.jpg');canvas.save(dst,quality=88)
  records.append({'slide':int(src.stem[-2:]),'file':dst.name,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest()})
 # Contact sheet shows the complete marked review copy, not clipped source thumbnails.
 cw,ch=480,285;sheet=Image.new('RGB',(cw*4,ch*((len(slides)+3)//4)),'#f5f0e4')
 for i,src in enumerate(slides):sheet.paste(Image.open(src.with_suffix('.jpg')).resize((cw,ch)),((i%4)*cw,(i//4)*ch))
 sheet.save(out/'contact-review.jpg',quality=90)
 (out/'REVIEW.json').write_text(json.dumps({'module':module,'status':'UNAPPROVED REVIEW ONLY','human_review':False,'english_diagram_labels':True,'source_sha256':hashlib.sha256((repo/f'docs/narration/{module}.zu.md').read_bytes()).hexdigest(),'slides':records},indent=2)+'\n')
 print(module,count,'review slides',flush=True)
