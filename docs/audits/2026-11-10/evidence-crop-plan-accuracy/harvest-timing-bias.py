# How the app's first-harvest month compares with the published duration range.
# App rule (lib/crop-plan.ts): offset = ceil(daysToHarvest/30) months, +2 months for a tray-raised crop.
# Independent expectation: sowing somewhere in month M (day 0..30); nursery 4-6 weeks for transplants
# (the KZN DARD warm-condition range the code itself cites); days from the catalogue's published range.
import json, math, sys
cat=json.load(open(sys.argv[1])); ML=30.44
rows=[]
for c in cat:
    if not c['timingVerified']: continue
    lo,hi=(c.get('daysToHarvestRange') or [c['daysToHarvest'],c['daysToHarvest']])
    n_lo,n_mid,n_hi=(28,35,42) if c['transplant'] else (0,0,0)
    app=math.ceil(c['daysToHarvest']/30)+(2 if c['transplant'] else 0)
    early=math.floor((0+n_lo+lo)/ML); typical=math.floor((15+n_mid+(lo+hi)/2)/ML); late=math.floor((30+n_hi+hi)/ML)
    rows.append((c['key'],lo,hi,c['transplant'],early,typical,late,app,app-typical,app-late))
print(f"{'crop':18} {'days':9} T  earliest typical latest  app  app-typical app-latest")
for r in sorted(rows,key=lambda r:(-r[8],r[0])):
    print(f"{r[0]:18} {str(r[1])+'-'+str(r[2]):9} {'T' if r[3] else '-'}  {r[4]:8} {r[5]:7} {r[6]:6} {r[7]:4} {r[8]:+11} {r[9]:+10}")
import collections
print('app minus typical (months):',dict(sorted(collections.Counter(r[8] for r in rows).items())))
print('app minus latest plausible:',dict(sorted(collections.Counter(r[9] for r in rows).items())))
