# Agreement between the calendar each place gets and the "General sowing guide (according to SANSOR)",
# before and after the 10 November 2026 fixes; and every sowing-month row that changed.
#
#   python3 guide-agreement.py <catalog-after.json> <calendar-choices.json>
#
# Before: ../evidence-crop-plan-accuracy/outputs/catalog.json and the "before" calendar in calendar-choices.json.
# After:  the catalogue dump and calendars passed in (made by dump-catalog.ts and calendar-choice-matrix.ts).
# Guide:  research/crop-sources/_sansor-sowing-guide.json. Which region a place belongs to is the auditor's
#         assignment, taken unchanged from ../evidence-crop-plan-accuracy/compare-sansor.py.
#
# READ THE WESTERN CAPE LINE WITH CARE: since these fixes the catalogue's Western Cape rows are TAKEN FROM this
# guide, so its agreement there is by construction, not an independent check. Every other region's rows come
# from other sources (the KZN Department of Agriculture table, crop guidelines), so the guide is independent there.
import json, re, sys, os, collections
here=os.path.dirname(os.path.abspath(__file__)); root=os.path.abspath(os.path.join(here,'..','..','..','..'))
guide=json.load(open(os.path.join(root,'research/crop-sources/_sansor-sowing-guide.json')))
src=open(os.path.join(here,'..','evidence-crop-plan-accuracy','compare-sansor.py')).read().split("cat={c['key']")[0]
g={'sys':sys}; argv=sys.argv; sys.argv=['x']; exec(src,g); sys.argv=argv
SITE=g['SITE']; SHORT=g['REG']; parse=g['parse']
assert [k for k in g['T']]==list(guide['rows']), 'the guide file and the audit script must hold the same rows'
for k,(row,cells) in g['T'].items(): assert guide['rows'][k]['cells']==cells, k
catB={c['key']:c for c in json.load(open(os.path.join(here,'..','evidence-crop-plan-accuracy','outputs','catalog.json')))}
catA={c['key']:c for c in json.load(open(sys.argv[1]))}
choice={r['name']:r for r in json.load(open(sys.argv[2]))}
def score(cat,pat,r):
    b=e=m=z=n=0
    for k,row in guide['rows'].items():
        ref=parse(row['cells'][r]); app=set(cat[k]['sowMonths'][pat])
        if not ref and not app: continue
        n+=1; b+=len(app&ref); e+=len(app-ref); m+=len(ref-app)
        if app and ref and not(app&ref): z+=1
    return b,e,m,z,n
pc=lambda s:(100*s[0]/max(1,s[0]+s[1]),100*s[0]/max(1,s[0]+s[2]))
print("agree = share of the months the app offers that the guide also lists; cover = share of the guide's months the app offers;")
print("none = crops (of the 27 the guide lists) sharing no month with it. Guide: secondary, seed-industry, 2004.\n")
agg=collections.defaultdict(lambda:[[0]*5,[0]*5])
print(f"{'guide region':22}{'place':19}{'before':11}{'agree':>6}{'cover':>6}{'none':>5}   {'after':11}{'agree':>6}{'cover':>6}{'none':>5}")
for name,r in sorted(SITE.items(), key=lambda kv:(kv[1],kv[0])):
    c=choice[name]; sb=score(catB,c['before'],r); sa=score(catA,c['after'],r)
    for i in range(5): agg[SHORT[r]][0][i]+=sb[i]; agg[SHORT[r]][1][i]+=sa[i]
    print(f"{SHORT[r][:21]:22}{name[:18]:19}{c['before']:11}{pc(sb)[0]:5.0f}%{pc(sb)[1]:5.0f}%{sb[3]:5}   {c['after']:11}{pc(sa)[0]:5.0f}%{pc(sa)[1]:5.0f}%{sa[3]:5}{'   <-- calendar changed' if c['before']!=c['after'] else ''}")
print(f"\n{'guide region':24}{'before: agree':>14}{'cover':>7}{'none':>12}   {'after: agree':>13}{'cover':>7}{'none':>12}")
tot=[[0]*5,[0]*5]
for r in SHORT:
    a=agg[r]
    if not a[0][4]: continue
    for i in range(5): tot[0][i]+=a[0][i]; tot[1][i]+=a[1][i]
    note='   (by construction: rows now come from this guide)' if r.startswith('W Cape') else ''
    print(f"{r:24}{pc(a[0])[0]:13.0f}%{pc(a[0])[1]:6.0f}%{a[0][3]:6} of {a[0][4]:<4}{pc(a[1])[0]:12.0f}%{pc(a[1])[1]:6.0f}%{a[1][3]:6} of {a[1][4]:<4}{note}")
print(f"{'All '+str(len(SITE))+' scored places':24}{pc(tot[0])[0]:13.0f}%{pc(tot[0])[1]:6.0f}%{tot[0][3]:6} of {tot[0][4]:<4}{pc(tot[1])[0]:12.0f}%{pc(tot[1])[1]:6.0f}%{tot[1][3]:6} of {tot[1][4]:<4}")
ex=[[0]*5,[0]*5]
for r in SHORT:
    if r.startswith('W Cape'): continue
    for i in range(5): ex[0][i]+=agg[r][0][i]; ex[1][i]+=agg[r][1][i]
print(f"{'Without the W Cape':24}{pc(ex[0])[0]:13.0f}%{pc(ex[0])[1]:6.0f}%{ex[0][3]:6} of {ex[0][4]:<4}{pc(ex[1])[0]:12.0f}%{pc(ex[1])[1]:6.0f}%{ex[1][3]:6} of {ex[1][4]:<4}   (independent of the guide)")
print('not scored (region ambiguous):',sorted(n for n in choice if n not in SITE))

L=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
show=lambda ms:' '.join(L[m-1] for m in ms) if ms else '(none)'
COL={'summer':'hard frost','mild-frost':'light frost','all-year':'hot, frost-free','winter':'Western Cape'}
print('\n\n== Every sowing-month row that changed ==')
n=0
for k,a in catA.items():
    for col in ['summer','mild-frost','all-year','winter']:
        b=catB[k]['sowMonths'][col]; x=a['sowMonths'][col]
        if sorted(b)!=sorted(x):
            n+=1; print(f"{a['name'][:26]:27}{COL[col]:16} was {show(sorted(b)):38} now {show(sorted(x))}")
print(f"{n} rows changed, in {len({k for k,a in catA.items() if any(sorted(catB[k]['sowMonths'][c])!=sorted(a['sowMonths'][c]) for c in COL)})} crops. The source row for each is in the comment above it in lib/crop-catalog.ts.")
