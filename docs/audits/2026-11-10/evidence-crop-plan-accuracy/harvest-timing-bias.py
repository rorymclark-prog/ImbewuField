# How the app's first-harvest month compares with the published duration range, with nursery time and
# field time kept apart.
#
# App rule (lib/crop-plan.ts): field months = ceil(daysToHarvest / 30); a tray-raised crop adds a planned
# nursery period of 2 months before it (TRANSPLANT_ENTRY_PLANNED_MONTHS), and its bed is reserved from 1 month
# after sowing (TRANSPLANT_ENTRY_EARLIEST_MONTHS). The app treats a tray crop's catalogue duration as counted
# from TRANSPLANTING (comment at lib/crop-plan.ts:1190) and a direct-sown crop's as counted from SOWING.
# Whether each source figure really is from transplanting was not re-checked crop by crop.
#
# Independent expectation: sowing falls anywhere in month M (day 0..30); nursery 4-6 weeks for a tray crop
# (the warm-condition range the app's own comment cites; Starke Ayres says 5 weeks); field days from the
# catalogue's published range.
# Usage: python3 harvest-timing-bias.py <catalog.json>
import json, math, sys, collections
cat=json.load(open(sys.argv[1])); ML=30.44
rows=[]
for c in cat:
    if not c['timingVerified']: continue
    lo,hi=(c.get('daysToHarvestRange') or [c['daysToHarvest'],c['daysToHarvest']])
    tray=c['transplant']
    n_lo,n_mid,n_hi=(28,35,42) if tray else (0,0,0)
    app_nursery=2 if tray else 0
    app_field=math.ceil(c['daysToHarvest']/30)
    app=app_nursery+app_field
    early=math.floor((0+n_lo+lo)/ML); typical=math.floor((15+n_mid+(lo+hi)/2)/ML); late=math.floor((30+n_hi+hi)/ML)
    rows.append((c['key'],'transplanting' if tray else 'sowing',f'{lo}-{hi}','4-6 wk' if tray else '-',app_nursery,app_field,app,early,typical,late,app-typical,app-late))
print('Months are counted from the sowing month (0 = harvest in the month of sowing).')
print(f"{'crop':18} {'days counted from':17} {'field days':10} {'nursery':7} | app: nursery + field = first harvest | expected: earliest typical latest | app-typical app-latest")
for r in sorted(rows,key=lambda r:(-r[10],r[0])):
    print(f"{r[0]:18} {r[1]:17} {r[2]:10} {r[3]:7} | {r[4]:12} + {r[5]:5} = {r[6]:13} | {r[7]:18} {r[8]:7} {r[9]:6} | {r[10]:+11} {r[11]:+10}")
print('app minus typical, months:',dict(sorted(collections.Counter(r[10] for r in rows).items())))
print('app minus latest plausible, months:',dict(sorted(collections.Counter(r[11] for r in rows).items())))
print('tray-raised crops:',sum(1 for r in rows if r[1]=='transplanting'),'of',len(rows))
