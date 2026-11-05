import copy, hashlib, json, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parent
RAW=(ROOT/'source.json').read_bytes()
SHA=hashlib.sha256(RAW).hexdigest()
assert SHA=='96e69ce266789433482899ba88c3d9510f1309c03af3c059c42d6de0b69bb8d5'
SOURCE=json.loads(RAW)
TOKENS=lambda s: sorted(re.findall(r'\{[^{}]+\}',s))
DIGITS=lambda s: re.findall(r'[0-9]+(?:[.,][0-9]+)?',s)
def validate(packet,locale):
 assert set(packet)=={'locale','sourceSha256','status','runtimeActivation','messages'}
 assert packet['locale']==locale and packet['sourceSha256']==SHA
 assert packet['status']=='unreviewed-ai-draft' and packet['runtimeActivation'] is False
 assert len(packet['messages'])==12
 for a,b in zip(SOURCE['messages'],packet['messages']):
  assert set(b)=={'key','english','messageSha256','translation'}
  assert all(a[k]==b[k] for k in ['key','english','messageSha256'])
  assert hashlib.sha256(a['english'].encode()).hexdigest()==a['messageSha256']
  t=b['translation'];assert isinstance(t,str) and t.strip() and t!=a['english']
  assert TOKENS(t)==TOKENS(a['english']) and DIGITS(t)==DIGITS(a['english'])
  assert t.count('m²')==a['english'].count('m²')
results=[]
for locale in SOURCE['locales']:
 packet=json.loads((ROOT/(locale+'.json')).read_text());validate(packet,locale)
 results.append({'locale':locale,'pairs':len(packet['messages']),'sha256':hashlib.sha256((ROOT/(locale+'.json')).read_bytes()).hexdigest()})
base=json.loads((ROOT/'fr.json').read_text());controls=[]
def control(name,fn):
 p=copy.deepcopy(base);fn(p)
 try:validate(p,'fr')
 except (AssertionError,KeyError,TypeError):controls.append(name);return
 raise AssertionError('Damaged packet unexpectedly accepted: '+name)
def head(k,v):return lambda p:p.__setitem__(k,v)
def row(i,k,v):return lambda p:p['messages'][i].__setitem__(k,v)
control('wrong locale',head('locale','es'));control('wrong source hash',head('sourceSha256','0'*64))
control('runtime enabled',head('runtimeActivation',True));control('false reviewed status',head('status','reviewed'))
control('missing message',lambda p:p['messages'].pop());control('duplicate identity',lambda p:p['messages'].__setitem__(1,copy.deepcopy(p['messages'][0])))
control('reordered messages',lambda p:p['messages'].reverse());control('changed English',row(0,'english','Changed'))
control('changed key',row(0,'key','changed'));control('wrong message hash',row(0,'messageSha256','0'*64))
control('empty translation',row(0,'translation',' '));control('English substituted',row(0,'translation',SOURCE['messages'][0]['english']))
control('missing token',lambda p:p['messages'][3].__setitem__('translation',p['messages'][3]['translation'].replace('{bed}','')))
control('renamed token',lambda p:p['messages'][3].__setitem__('translation',p['messages'][3]['translation'].replace('{bed}','{field}')))
control('extra token',lambda p:p['messages'][0].__setitem__('translation',p['messages'][0]['translation']+' {extra}'))
control('missing unit',lambda p:p['messages'][3].__setitem__('translation',p['messages'][3]['translation'].replace('m²','ft²')))
control('unlisted message field',row(0,'humanApproved',True));control('nonstring translation',row(0,'translation',None))
control('invented numeric default',lambda p:p['messages'][0].__setitem__('translation',p['messages'][0]['translation']+' 42'))
notes=(ROOT/'review-notes.md').read_text();out={'sourceSha256':SHA,'pairs':sum(v['pairs']for v in results),'locales':results,'damagedControlsRejected':len(controls),'controls':controls,'notesWords':len(notes.split()),'semanticCertification':False,'runtimeActivation':False}
path=ROOT/'validation.json';path.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'pairs':out['pairs'],'damagedControlsRejected':len(controls),'notesWords':out['notesWords'],'semanticCertification':False}))
