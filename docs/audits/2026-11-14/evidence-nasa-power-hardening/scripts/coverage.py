import json, sys, glob, os, collections
c = collections.Counter(); koppen_on_incomplete = []
for d in sys.argv[1:]:
    for f in sorted(glob.glob(os.path.join(d, 'cache', 'nasa_*.json'))):
        j = json.load(open(f)); st = (j['climate'].get('monthlyTempCoverage') or {}).get('status', 'absent'); c[st] += 1
        if st != 'complete': koppen_on_incomplete.append((os.path.basename(f), j['climate'].get('koppen')))
print(f"archived app outputs (fetchNasaPower): {sum(c.values())}; monthlyTempCoverage.status: {dict(c)}")
print(f"incomplete or absent, with the class the server printed: {koppen_on_incomplete or 'none'}")
