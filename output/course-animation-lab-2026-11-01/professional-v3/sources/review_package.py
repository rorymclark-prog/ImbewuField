"""Review evidence that fails if a native export silently freezes the movie."""
from pathlib import Path
from PIL import Image
import subprocess,json,hashlib,math,array,html
ROOT=Path(__file__).resolve().parents[1];LAB=ROOT.parent;REPO=LAB.parents[1]
movie=ROOT/'professional-study-pilot.mp4'
def run(args):return subprocess.check_output(args)
def probe(p):return json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]))
def frame(t,crop):
    return run(['ffmpeg','-v','error','-ss',str(t),'-i',str(movie),'-vf',crop+',scale=240:160','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
def mad(a,b):return sum(abs(x-y) for x,y in zip(a,b))/len(a)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
info=probe(movie);video=next(s for s in info['streams'] if s['codec_type']=='video');audio=next(s for s in info['streams'] if s['codec_type']=='audio')
assert abs(float(info['format']['duration'])-24)<.06
assert (video['width'],video['height'])==(1920,1080)
assert video['nb_frames']=='576'
motion=mad(frame(1,'crop=900:550:0:40'),frame(3,'crop=900:550:0:40'))
hold=mad(frame(6,'crop=600:450:0:80'),frame(10,'crop=600:450:0:80'))
assert motion>3,f'Moving opening is frozen: {motion}'
assert hold<2,f'Explaining frame drifted underneath its registered labels: {hold}'
samples=array.array('f',run(['ffmpeg','-v','error','-i',str(movie),'-vn','-ac','1','-ar','8000','-f','f32le','-']))
rms=math.sqrt(sum(x*x for x in samples)/len(samples));assert rms>.005,'Narration is missing or silent'
run(['ffmpeg','-v','error','-i',str(movie),'-f','null','-'])
source_audio=REPO/'public/course-audio/intro-permaculture/en/slide-17.mp3'
report={
 'date':'2026-11-01','status':'review draft, not installed in the course',
 'final':{'file':movie.name,'duration_seconds':float(info['format']['duration']),'width':video['width'],'height':video['height'],'frames':int(video['nb_frames']),'audio_codec':audio['codec_name'],'sha256':sha(movie)},
 'motion_checks':{'moving_opening_mean_absolute_pixel_difference':round(motion,3),'intentional_hold_background_mean_absolute_pixel_difference':round(hold,3),'decoded_audio_rms':round(rms,6),'full_decode':'passed'},
 'production':{'footage':'Google Flow / Veo 3.1 Fast, original 720p, fictional scene','graphics':'native Apple Motion document, rendered by Apple Compressor','master':'apple-motion-native-master-r2.mov','native_project':'sources/Professional-Study-Apple-Motion.motn','narration':'existing manifested intro-permaculture/en/slide-17.mp3, reused unchanged','narration_sha256':sha(source_audio),'audio_start_seconds':.8},
 'reviewed':'Exported contact sheet plus representative full-size frames. Human learner comprehension and preferred style remain for Rory to judge.',
 'limits':['AI footage is illustrative, not a measured farm plan.','Export is 1080p; original generated footage is 720p.','Ten-minute lessons and their stitched long version were not completed after the rejected style directions.','No lesson body, quiz, species list, saved geometry, app route, public asset, audio manifest or PLAN_VERSION changed.'],
 'repository_checks':{'typecheck':'Blocked in clean worktree: shared node_modules lacks @rive-app/react-canvas-lite. Initial main checkout also includes unrelated qedit_tmp type errors.','full_test_suite':'Started, then stopped on user style pivot; no passing full-suite claim.','diff_check':'Run separately before commit.'},
 'sources':[{'url':'https://cumi.co.uk/map-illustration/','application':'One coherent look and geographic frame; checked locations and routes before animation.'},{'url':'https://www.esri.com/arcgis-blog/products/arcgis-storymaps/constituent-engagement/choreograph-your-maps-with-arcgis-storymaps','application':'Controlled focal point, progressive reveal, continuity and a pause for explanation.'},{'url':'https://doi.org/10.1017/9781108894333.019','application':'Less irrelevant material; nearby labels and graphics introduced with the explanation.'}]
}
(ROOT/'review-evidence.json').write_text(json.dumps(report,indent=2)+'\n')
cards=[]
archive=[('01-zones-paper.mp4','Paper zones','Scripted 2D'),('02-sectors-chalkboard.mp4','Chalkboard sectors','Scripted 2D'),('03-zones-blender.mp4','Clay zones model','Blender'),('04-sectors-google-flow-original.mp4','Felt sectors','Google Flow / Veo'),('05-zones-painted.mp4','Painted homestead','Imagegen artwork + scripted overlays')]
for f,title,tool in archive:cards.append(f'<article><h3>{title}</h3><p>{tool} · earlier experiment</p><video controls preload="none" src="{f}"></video></article>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ImbewuField · study animation review</title><style>*{box-sizing:border-box}body{margin:0;background:#111a16;color:#f4eddf;font:17px/1.6 system-ui}main{max-width:1150px;margin:auto;padding:40px 24px}h1{font-size:clamp(32px,5vw,58px);line-height:1.12;font-weight:550}h2{margin-top:48px}p{max-width:850px;color:#d4d9cd}a{color:#efd39b}video{width:100%;background:#000;border-radius:8px}.links{display:flex;flex-wrap:wrap;gap:20px;margin:20px 0}details{border-top:1px solid #3d4b3f;margin-top:48px;padding-top:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:26px}small{color:#aebcaa}li{margin-bottom:12px}</style><main><small>IMBEWUFIELD · 1 NOVEMBER 2026 · REVIEW DRAFT</small><h1>Design for the work you do every day.</h1><p>The revised 24-second teaching pilot uses a moving documentary shot, a deliberate pause to explain the daily walk, and a clear reflection. The scene is AI-generated and fictional. Original course narration is reused unchanged.</p><video controls preload="metadata" poster="professional-v3/previews/poster.jpg" src="professional-v3/professional-study-pilot.mp4"></video><div class="links"><a href="professional-v3/professional-study-pilot.mp4">Open updated film</a><a href="professional-v3/sources/Professional-Study-Apple-Motion.motn">Editable Apple Motion project</a><a href="professional-v3/review-evidence.json">Checks and provenance</a></div><h2>What changed after studying professional practice</h2><ul><li><strong>One place, one story.</strong> The door and garden retain their positions while the camera approaches. The explanation holds that same view.</li><li><strong>Movement carries meaning.</strong> The camera establishes proximity; the short route draws from the door to the garden. Labels appear beside what they identify.</li><li><strong>Space to understand.</strong> Graphics appear in sequence and clear away. A final question gives the learner something to do.</li><li><strong>Restraint.</strong> No simultaneous weather arrows, decorative music, stacked paragraphs or toy diorama treatment.</li></ul><p>This is our applied art direction, informed by <a href="https://cumi.co.uk/map-illustration/">CUMI’s documentary-map workflow</a>, <a href="https://www.esri.com/arcgis-blog/products/arcgis-storymaps/constituent-engagement/choreograph-your-maps-with-arcgis-storymaps">Esri’s map-choreography guidance</a>, and <a href="https://doi.org/10.1017/9781108894333.019">Mayer’s multimedia-learning principles</a>.</p><p>The export was checked for actual picture motion, stable registration during the deliberate hold, audible narration, duration and full decode. The generated footage begins at 720p; Motion composites the graphics and exports at 1080p. This draft is separate from the live course. The long teaching edits remain unfinished following the style changes.</p><details><summary>Earlier five-format experiments — superseded directions</summary><p>Retained for comparison and recovery. These are not the proposed professional treatment.</p><div class="grid">'''+''.join(cards)+'''</div><h3>First native Motion attempt</h3><video controls preload="none" src="cinematic-v2/01-apple-motion-cinematic.mp4"></video><p>The earlier still-photo-and-sector-arrows treatment, retained as an iteration.</p></details></main></html>'''
(LAB/'review.html').write_text(page)
print(json.dumps(report['motion_checks']))
