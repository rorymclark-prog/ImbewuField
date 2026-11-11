# Frost exposure of frost-tender crops, using the app's own exposure rule (tests/crop-catalog-frost.test.ts):
# exposure starts the month AFTER sowing (emergence, or the earliest printed transplant month) and runs to the
# first harvest month. Frost = ERA5 daily minimum <= 0 C, 2001-2020, averaged per calendar month.
# Usage: python3 frost-by-app-rule.py <locations.json from location-harness.ts>
import json, sys, collections
d=[l for l in json.load(open(sys.argv[1]))['locations'] if l['inSouthAfrica']]
MN='JFMAMJJASOND'
for th in (1.0,0.2):
    out=collections.defaultdict(list)
    for l in d:
        fr={i+1:m['airFrostDays'] for i,m in enumerate(l['era5']['monthly'])}
        sh={i+1:m['shareYearsWithAirFrost'] for i,m in enumerate(l['era5']['monthly'])}
        for c in l['crops']:
            if not c['frostTender']: continue
            hit=[m for m in c['fieldMonths'] if m!=c['sowMonth'] and fr[m]>=th]
            if hit: out[(l['name'],l['app']['pattern'])].append((c['crop'],c['sowMonth'],[(MN[m-1],round(fr[m],1),round(100*sh[m])) for m in hit]))
    print(f"threshold {th} air-frost days per month: {len(out)} of {len(d)} South African sites flagged, {sum(len(v) for v in out.values())} crop/sow-month combinations")
    for k,v in sorted(out.items(), key=lambda kv:-len(kv[1])):
        print('  ',k[0],'('+k[1]+')',len(v),'::','; '.join(f"{c} sown {MN[s-1]}: {', '.join(f'{m} {dd} days, {p}% of years' for m,dd,p in hit)}" for c,s,hit in v[:5]))
