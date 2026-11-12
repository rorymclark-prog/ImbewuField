# Tables for the held-out record, from outputs/holdout-results.json.
#   python3 summarise.py > outputs/holdout-summary.txt
# Nothing here is judged that holdout-places.json did not name as a criterion. Guide overlap,
# dataset agreement and close calls are reported only.
import json, os, collections
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, 'outputs', 'holdout-results.json')))
rows = d['rows']
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
NAME = {'summer': 'Winter frost', 'mild-frost': 'Light frost at most', 'all-year': 'Hot area, no frost', 'winter': 'Winter rainfall'}
show = lambda ms: ' '.join(MON[m - 1] for m in ms) if ms else '(none)'

print(f"Run at {d['ranAt']}. Places {d['places']}; with an app reading {d['withAppReading']}; with an ERA5 record {d['withEra5']}.")
judged = [r for r in rows if r.get('app') and r.get('era5')]
failed = [r for r in judged if r['failed']]
print(f"Judged against H-A to H-D: {len(judged)}. Passed all four: {len(judged) - len(failed)}. Failed at least one: {len(failed)}.\n")
for r in rows:
    if not r.get('app'): print(f"NOT JUDGED  {r['name']}: no app reading ({r.get('appFailure')})")
    elif not r.get('era5'): print(f"NOT JUDGED  {r['name']}: no ERA5 record ({r.get('era5Failure')})")

print('\n== Every place ==')
print(f"{'place':25}{'guide region':23}{'calendar':21}{'coldest':>8}{'hottest':>8}{'rec min':>8} | {'ERA5 frost/yr':>13}{'lowest':>8}{'frost yrs':>10} | {'on ERA5 values':20}{'close call':13}result")
for r in judged:
    a, e = r['app'], r['era5']
    other = r.get('patternOnEra5Values')
    print(f"{r['name'][:24]:25}{(r['guideRegion'] or 'not scored')[:22]:23}{NAME[a['pattern']]:21}{a['coldestMonthC']:8.1f}{a['hottestMonthC']:8.1f}{str(a['recordMinC']):>8} | {e['airFrostDaysPerYear']:13}{e['lowestDailyMinC']:8}{e['yearsWithFrost']:10} | "
          f"{(NAME[other] if other else 'none') + ('' if other == a['pattern'] else ' *'):20}{(a['closeCall'] or '-'):13}{'FAILED ' + ','.join(r['failed']) if r['failed'] else 'passed'}")

print('\n== Calendars given ==')
count = collections.Counter(r['app']['pattern'] for r in judged)
for k in ['summer', 'mild-frost', 'all-year', 'winter']: print(f"{NAME[k]:22}{count[k]:3}   {', '.join(r['name'] for r in judged if r['app']['pattern'] == k)}")

print('\n== Per criterion ==')
tests = {
    'H-A': lambda r: r['app']['pattern'] == 'all-year',
    'H-B': lambda r: r['app']['pattern'] == 'mild-frost',
    'H-C': lambda r: r['era5']['airFrostDaysPerYear'] >= 1,
    'H-D': lambda r: r['era5']['yearsWithFrost'] == 0 and r['era5']['lowestDailyMinC'] > 0 and (r['app']['recordMinC'] or -1) > 0,
}
for k, applies in tests.items():
    subject = [r for r in judged if applies(r)]
    bad = [r['name'] for r in subject if k in r['failed']]
    print(f"{k}: applies to {len(subject)} places; failed {len(bad)}{': ' + ', '.join(bad) if bad else ''}")

print('\n== Reported, not judged: the same rule on ERA5 monthly values gives another calendar ==')
for r in judged:
    if r.get('patternOnEra5Values') != r['app']['pattern']:
        print(f"{r['name']:25}app (NASA POWER) {NAME[r['app']['pattern']]:21} on ERA5 values {NAME.get(r.get('patternOnEra5Values'), 'none')}")

print('\n== Reported, not judged: places the rule itself marks as close to a line ==')
for r in judged:
    if r['app']['closeCall']: print(f"{r['name']:25}{NAME[r['app']['pattern']]:21} close to {NAME[r['app']['closeCall']]:21} warmer neighbour {r['app']['warmerNeighbour'] or '-'}")

print('\n== Reported, not judged: places sharing one NASA POWER grid reading ==')
seen = collections.defaultdict(list)
for r in judged: seen[json.dumps([r['app']['monthlyTempC'], r['app']['recordMinC']])].append(r['name'])
for names in seen.values():
    if len(names) > 1: print(', '.join(names))

print('\n== Reported, not judged: frost on the ERA5 record at places on the Winter rainfall calendar ==')
for r in judged:
    if r['app']['pattern'] == 'winter': print(f"{r['name']:25}ERA5 frost days/yr {r['era5']['airFrostDaysPerYear']:6}  lowest {r['era5']['lowestDailyMinC']:6}  app record minimum {r['app']['recordMinC']}")

print('\n== Reported, not judged: month overlap with the regional guide (secondary, seed-industry, 2004) ==')
print('agree = share of the months the app offers that the guide also lists; cover = share of the guide months the app offers.')
print("The app's Western Cape rows are taken from this guide, so overlap there is by construction.")
agg = collections.defaultdict(lambda: [0, 0, 0, 0, 0])
print(f"{'guide region':23}{'place':25}{'calendar':21}{'agree':>6}{'cover':>6}{'no shared month':>17}")
for r in sorted((r for r in judged if r.get('guide')), key=lambda r: (r['guide']['region'], r['name'])):
    g = r['guide']; b, ao, go = g['monthsBoth'], g['monthsAppOnly'], g['monthsGuideOnly']
    for i, v in enumerate([b, ao, go, len(g['noOverlap']), g['cropsScored']]): agg[g['region']][i] += v
    print(f"{g['region'][:22]:23}{r['name'][:24]:25}{NAME[r['app']['pattern']]:21}{100 * b / max(1, b + ao):5.0f}%{100 * b / max(1, b + go):5.0f}%{len(g['noOverlap']):11} of {g['cropsScored']}")
print()
tot = [0, 0, 0, 0, 0]; ex = [0, 0, 0, 0, 0]
for region, a in agg.items():
    for i in range(5):
        tot[i] += a[i]
        if not region.startswith('W Cape'): ex[i] += a[i]
    print(f"{region:23}agree {100 * a[0] / max(1, a[0] + a[1]):3.0f}%  cover {100 * a[0] / max(1, a[0] + a[2]):3.0f}%  no shared month {a[3]} of {a[4]}")
print(f"{'All scored places':23}agree {100 * tot[0] / max(1, tot[0] + tot[1]):3.0f}%  cover {100 * tot[0] / max(1, tot[0] + tot[2]):3.0f}%  no shared month {tot[3]} of {tot[4]}")
print(f"{'Without the W Cape':23}agree {100 * ex[0] / max(1, ex[0] + ex[1]):3.0f}%  cover {100 * ex[0] / max(1, ex[0] + ex[2]):3.0f}%  no shared month {ex[3]} of {ex[4]}")

print('\n== Reported, not judged: every crop-and-place pair sharing no sowing month with the guide ==')
pairs = collections.defaultdict(list)
for r in judged:
    if not r.get('guide'): continue
    for p in r['guide']['noOverlap']:
        pairs[(r['guide']['region'], p['crop'], NAME[r['app']['pattern']], tuple(p['appMonths']), tuple(p['guideMonths']))].append(r['name'])
print(f"{'guide region':23}{'crop':22}{'calendar':21}{'app sows':28}{'guide sows':28}places")
for (region, crop, cal, app, ref), names in sorted(pairs.items()):
    print(f"{region[:22]:23}{crop[:21]:22}{cal:21}{show(app):28}{show(ref):28}{', '.join(names)}")
print(f"{sum(len(v) for v in pairs.values())} pairs in all; {sum(len(v) for k, v in pairs.items() if not k[0].startswith('W Cape'))} outside the W Cape.")
