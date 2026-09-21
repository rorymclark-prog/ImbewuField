#!/usr/bin/env python3
"""Build the finance teaching preview from its source manuscripts; no lesson bodies are invented here."""
from pathlib import Path
import re,json,hashlib,shutil,os,sys
os.chdir(Path(__file__).resolve().parent.parent)
base=Path('docs/studies-review-2026-09-20/reserve/finance')
files=['f1-foundations.md','f2-records.md','f3-costing.md','f4-cashflow.md','f5-sales.md','f6-equipment.md','f7-results.md','f8-business-plan.md']
summaries=['Separate household and farm money, follow sales and payments, and keep evidence.','Follow produce and money, reconcile records and explain corrections.','Include costs, compare prices and test a bounded break-even calculation.','Build a budget, put money on dates and investigate a cash gap.','Connect orders, deliveries, invoices and payments without duplicate sales.','Compare equipment options, understand commitments and plan reserves.','Separate cash, period result and financial position; prepare reliable records.','Test market evidence, write a checkable plan and review a season.']
images=['expense-record.jpg','record-sale.jpg','expense-record.jpg','sketch-the-site.jpg','record-sale.jpg','expense-record.jpg','record-sale.jpg','sketch-the-site.jpg']
units=[]
for n,filename in enumerate(files,1):
 p=base/filename;t=p.read_text(); heads=list(re.finditer(r'^## (F\d\.\d)\s+[—-]\s+(.+)$',t,re.M));assert len(heads)==3
 chunks=re.split(r'^## ',t,flags=re.M)
 shared=[]
 for c in chunks[1:]:
  title,_,body=c.partition('\n')
  if re.match(r'F\d\.\d',title) or re.match(r'Media|Fact-check|Printable|Assessment.*media',title,re.I):continue
  shared.append({'title':title,'text':body.strip()})
 if n==8:
  prefix=t[:heads[0].start()]
  paragraphs=[part for part in prefix.split('\n\n') if part.startswith(('Use ', 'Build on '))]
  shared.insert(0,{'title':'Practice setting','text':'\n\n'.join(paragraphs)})
 lessons=[]
 for h in heads:
  end=re.search(r'^## ',t[h.end():],re.M); body=t[h.end():h.end()+end.start() if end else len(t)].strip()
  sections=[]; pattern=r'^\*\*([^*]+?)(?::|\.)\*\*\s*'; labels=list(re.finditer(pattern,body,re.M))
  for j,l in enumerate(labels):
   text=body[l.end():labels[j+1].start() if j+1<len(labels) else len(body)].strip();sections.append({'title':l.group(1),'text':text})
  reading=next((s['text'].strip('“”') for s in sections if s['title'] in ['Narration draft','Plain narration']),None);assert reading,h.group(1)
  outcome=next((s['text'] for s in sections if s['title'] in ['Outcome','Learner outcome']),None)
  practices=[s for s in sections if s['title'] not in ['Narration draft','Plain narration','Outcome','Learner outcome','Opening picture','Opening scene']]
  lessons.append({'id':h.group(1).lower().replace('.','-'),'code':h.group(1),'title':h.group(2),'outcome':outcome,'reading':reading,'practice':practices})
 sourcefiles=[p]+list(base.glob(f'f{n}-sources.md'))
 links=[]
 for source in sourcefiles:
  for label,url in re.findall(r'\[([^\]]+)\]\((https://[^)]+)\)',source.read_text()):
   if 'imbewufield' not in url and not any(x['url']==url for x in links):links.append({'label':label,'url':url})
 units.append({'id':f'f{n}','number':n,'title':re.sub(r'^# F\d\s*[—-]\s*','',t.splitlines()[0]),'summary':summaries[n-1],'image':'/studies-guides/'+images[n-1],'sourceFile':str(p),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lessons':lessons,'shared':shared,'sources':links,'workbook':f'/finance-course/workbooks/f{n}.pdf' if n>1 else None})
serialized=json.dumps({'status':'teaching-preview','units':units},ensure_ascii=False,indent=2)+'\n'
public=Path('public/finance-course/workbooks')
if '--check' in sys.argv:
 assert Path('lib/course-finance-content.json').read_text()==serialized, 'Generated lessons differ from manuscripts; regenerate with scripts/build-finance-course.py'
 for n in range(2,9):
  assert (public/f'f{n}.pdf').read_bytes()==Path(f'output/pdf/finance-f{n}-workbook.pdf').read_bytes(), f'Workbook F{n} differs from reviewed source'
else:
 public.mkdir(parents=True,exist_ok=True)
 for n in range(2,9):shutil.copyfile(f'output/pdf/finance-f{n}-workbook.pdf',public/f'f{n}.pdf')
 Path('lib/course-finance-content.json').write_text(serialized)
print(json.dumps({'units':len(units),'lessons':sum(len(u['lessons']) for u in units),'sections':sum(len(l['practice']) for u in units for l in u['lessons'])}))
