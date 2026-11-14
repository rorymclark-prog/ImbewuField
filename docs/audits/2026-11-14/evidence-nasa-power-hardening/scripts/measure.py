import json, sys, glob, os, collections
raw10, raw11, fx1, fx2 = sys.argv[1:5]
out = []
# (a) stated units in every archived Open-Meteo response
units = collections.Counter(); n = 0
for d in (raw10, raw11):
    for f in sorted(glob.glob(os.path.join(d, 'cache', 'era5_*.json'))):
        j = json.load(open(f)); n += 1
        units[repr((j.get('daily_units') or {}).get('precipitation_sum'))] += 1
out.append(f"(a) archived Open-Meteo responses: {n}; daily_units.precipitation_sum values: {dict(units)}")
# (b) hemisphere of every recorded place (both fixtures)
places = []
for f in (fx1, fx2):
    for s in json.load(open(f))['sites']:
        places.append((os.path.basename(f), s['name'], s['lat'], s['rainfallSource'], s['monthlyRainMm']))
north = [p for p in places if p[2] >= 0]
out.append(f"(b) recorded places: {len(places)}; latitude >= 0: {len(north)}; most northerly lat: {max(p[2] for p in places)}")
# Pattern under the old and new code, from the fixture's own monthly rainfall
def pattern(m, lat, new):
    djf = m[11]+m[0]+m[1]; jja = m[5]+m[6]+m[7]; northern = new and lat >= 0
    if djf > jja*2: return 'winter' if northern else 'summer'
    if jja > djf*1.5: return 'summer' if northern else 'winter'
    return 'year-round'
changed = [p[1] for p in places if pattern(p[4], p[2], False) != pattern(p[4], p[2], True)]
out.append(f"    pattern old vs new differs at: {changed or 'none'}; patterns: {dict(collections.Counter(pattern(p[4], p[2], True) for p in places))}")
# (c) February at 28.25 days, places whose rainfall is NASA POWER's
nasa = [p for p in places if p[3] == 'nasa-power']
deltas = sorted(((p[4][1] / 28) * 0.25, p[1], p[4][1], sum(p[4])) for p in nasa)
out.append(f"(c) places on NASA POWER rainfall: {len(nasa)} of {len(places)} (rest on Open-Meteo, unaffected)")
out.append(f"    February increase at 28.25 days: min {deltas[0][0]:.2f} mm, median {deltas[len(deltas)//2][0]:.2f} mm, max {deltas[-1][0]:.2f} mm ({deltas[-1][1]}, Feb {deltas[-1][2]} mm, year {deltas[-1][3]:.0f} mm)")
rel = max(d[0]/d[3] for d in deltas)
out.append(f"    largest change to the annual total: {rel*100:.2f}%")
flips = [p[1] for p in nasa if pattern(p[4], p[2], True) != pattern([x*(28.25/28) if i == 1 else x for i, x in enumerate(p[4])], p[2], True)]
out.append(f"    pattern change from the February correction alone: {flips or 'none'}")
out.append("    30% source comparison: NOT measurable here; neither archive holds the app's 1991-2020 Open-Meteo annual beside NASA's.")
print('\n'.join(out))
