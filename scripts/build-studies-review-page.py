#!/usr/bin/env python3
"""Build a curated review pack without copying private source extracts or stale audio."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
args = parser.parse_args()
repo, pack = args.repo.resolve(), args.output.resolve()
pack.mkdir(parents=True, exist_ok=True)
modules = {'water-harvesting': 24, 'intro-permaculture': 22, 'reading-landscape': 21,
           'soil-health': 20, 'vegetables-staples': 18, 'food-forest': 20,
           'small-livestock': 20, 'market-community': 20}
flows = json.loads((repo/'docs/media/studies-illustrated-release/flow-clips.json').read_text())['clips']
data = []
for module, count in modules.items():
    en, zu = pack/'review/english'/module, pack/'review/isizulu-draft'/module
    for language, dest in [('en', en), ('zu', zu)]:
        subprocess.run(['node', 'scripts/course-narration-export.mjs', module, language, str(dest)],
                       cwd=repo, check=True, stdout=subprocess.DEVNULL)
    slides = []
    for n in range(1, count + 1):
        stem = f'slide-{n:02}'
        for suffix, folder in [('mp3', 'course-audio'), ('jpg', 'course-decks')]:
            shutil.copy2(repo/f'public/{folder}/{module}/en/{stem}.{suffix}', en/f'{stem}.{suffix}')
        clips = list((repo/f'public/course-animations/{module}').glob(f'watch-{n:02}-*.mp4'))
        clips += [repo/c['asset'] for c in flows if c['module'] == module and c['slide'] == n]
        videos = []
        for source in clips:
            dest = pack/'review/animations'/module/source.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
            videos.append({'path': str(dest.relative_to(pack)), 'name': source.stem.replace('-', ' ')})
        slides.append({'n': n, 'image': str((en/f'{stem}.jpg').relative_to(pack)),
                       'audioEn': str((en/f'{stem}.mp3').relative_to(pack)),
                       'en': (en/f'{stem}.txt').read_text().strip(),
                       'zu': (zu/f'{stem}.txt').read_text().strip(), 'videos': videos})
    data.append({'id': module, 'name': module.replace('-', ' ').title(), 'slides': slides})
# Only authored review documents are copied. The Downloads source bundle contains learner IDs.
for name in ['FACT-CHECK.md', 'AUDIT-DISPOSITION.md']:
    shutil.copy2(repo/'docs/studies-review-2026-09-20'/name, pack/name)
shutil.copytree(repo/'docs/studies-review-2026-09-20/reserve', pack/'reserve', dirs_exist_ok=True)
page = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ImbewuField Studies — teaching review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f0e4;color:#203b29;font:17px/1.5 system-ui}header,main{max-width:1180px;margin:auto;padding:24px}header{padding-bottom:0}h1{font:36px Georgia;margin:12px 0}.notice{background:#793b2d;color:white;padding:12px 18px;border-radius:8px}.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;position:sticky;top:0;background:#f5f0e4;padding:12px 0;z-index:2}select,button{font:inherit;min-height:44px;border:1px solid #78917b;border-radius:7px;padding:8px 12px;background:white;color:#203b29}button{cursor:pointer}button:disabled{opacity:.4}img,video{width:100%;height:auto;background:#eee}video{max-height:560px}audio{width:100%}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}.card{background:#fffaf1;padding:18px;border:1px solid #dfd5c1;border-radius:8px}.copy{white-space:pre-wrap;color:#24251f}h2{margin-top:0;font-size:23px}details{margin:24px 0}a{color:#205735}textarea{width:100%;min-height:130px;font:inherit;padding:12px}footer{padding:20px 0}@media(max-width:700px){.columns{grid-template-columns:1fr}header,main{padding:14px}h1{font-size:28px}}
</style><header><p>IMBEWUFIELD · TEACHING REVIEW · 20 SEPTEMBER 2026</p><h1>Watch, listen and check each lesson</h1><p class="notice">The English reference includes the latest factual corrections. isiZulu text is an unapproved working draft and needs reconciliation against this English version, followed by fluent review. Earlier draft recordings are excluded because they no longer reliably match the revised teaching.</p><p><a href="reserve/README.md">15 reserve modules · 51 draft lessons</a> · <a href="FACT-CHECK.md">Fact-check record</a> · <a href="AUDIT-DISPOSITION.md">30-audit review</a></p></header><main><div class="toolbar"><label>Module <select id="module"></select></label><button id="previous">‹ Previous</button><label>Slide <select id="slide"></select></label><button id="next">Next ›</button></div><img id="slideImage" alt="English teaching slide"><div class="columns"><section class="card"><h2>Current English reference</h2><audio id="enAudio" controls preload="none"></audio><p id="enText" class="copy"></p></section><section class="card"><h2>isiZulu working draft</h2><p>Review meaning and factual consistency before recording. This is not an approved translation.</p><p id="zuText" class="copy"></p></section></div><details id="animationPanel"><summary>Teaching animations on this slide</summary><div id="animations"></div></details><section class="card"><h2>Reviewer notes</h2><p>Record module, slide, exact phrase and proposed correction. Download before closing; this page does not save or send your notes.</p><textarea id="notes" aria-label="Reviewer notes" placeholder="Module / slide — wording or pronunciation — suggested correction"></textarea><button id="download">Download notes</button></section><footer><a href="START-HERE.md">Pack status and verification limits</a><p>Nothing plays automatically. Changing slide stops playback. Diagrams and Flow scenes are illustrative; use the narration and transcript for the teaching.</p></footer></main><script>
const modules=DATA;let mi=0,si=0;const $=id=>document.getElementById(id);modules.forEach((m,i)=>$('module').add(new Option(m.name,i)));
function renderModule(){mi=Number($('module').value);si=0;$('slide').replaceChildren();modules[mi].slides.forEach((s,i)=>$('slide').add(new Option(s.n,i)));render()}
function render(){document.querySelectorAll('audio,video').forEach(x=>x.pause());const s=modules[mi].slides[si];$('slide').value=si;$('slideImage').src=s.image;$('slideImage').alt=modules[mi].name+' — English slide '+s.n;$('enAudio').src=s.audioEn;$('zuText').textContent=s.zu;$('enText').textContent=s.en;$('animationPanel').open=false;$('animationPanel').hidden=!s.videos.length;$('animations').replaceChildren();for(const clip of s.videos){const title=document.createElement('p');title.textContent=clip.name;const video=document.createElement('video');video.controls=true;video.preload='none';video.src=clip.path;$('animations').append(title,video)}$('previous').disabled=si===0;$('next').disabled=si===modules[mi].slides.length-1;}
$('animationPanel').addEventListener('toggle',()=>{if(!$('animationPanel').open)document.querySelectorAll('video').forEach(x=>x.pause())});$('module').addEventListener('change',renderModule);$('slide').addEventListener('change',()=>{si=Number($('slide').value);render()});$('previous').onclick=()=>{si--;render()};$('next').onclick=()=>{si++;render()};$('download').onclick=()=>{const blob=new Blob(['Imbewu Studies review notes — '+new Date().toISOString()+'\n\n'+$('notes').value],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='imbewu-studies-review-notes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};renderModule();
</script></html>'''
page = page.replace('DATA', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
(pack/'REVIEW.html').write_text(page)
manifest = [{'path': str(p.relative_to(pack)), 'bytes': p.stat().st_size,
             'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in sorted(pack.rglob('*')) if p.is_file() and p.name != 'MANIFEST.json']
(pack/'MANIFEST.json').write_text(json.dumps(manifest, indent=2)+'\n')
print('Review page:', len(data), 'modules,', sum(len(m['slides']) for m in data), 'slides,',
      sum(len(s['videos']) for m in data for s in m['slides']), 'animations')
