# Offline check of the raw daily responses behind a held-out or audit run. No network.
#
#   python3 verify-raw-responses.py                      (the 56 places of 11 November)
#   python3 verify-raw-responses.py --audit-2026-11-10   (the 44 South African places of 10 November)
#   python3 verify-raw-responses.py --negative-controls  (five corrupt records, each of which must be refused)
#
# Written after the independent review of 11 November 2026 (CBR-02, CBR-03), which showed
# that the collector's own summary would accept one day a year as "20 years, 0 missing",
# would read a Fahrenheit record as Celsius, and would score a record with missing minima.
# This reads the archived raw responses and refuses each of those: it checks the exact
# daily sequence, the units the provider stated, every missing value, and then rebuilds the
# frost figures from the raw minima without using the collector's code.
import datetime, hashlib, io, json, math, os, sys, tarfile, collections
here = os.path.dirname(os.path.abspath(__file__))
AUDIT = '--audit-2026-11-10' in sys.argv
if AUDIT:
    root = os.path.abspath(os.path.join(here, '..', '..', '..', '..'))
    archive = os.path.join(root, 'docs/audits/2026-11-10/evidence-crop-plan-accuracy/outputs/raw-responses-2026-11-10.tar.xz')
    saved = {s['name']: {'lat': s['lat'], 'lon': s['lon'], **s['era5']} for s in json.load(open(os.path.join(root, 'tests/fixtures/sa-climate-sites-2026-11-10.json')))['sites']}
    variables = ['temperature_2m_min', 'temperature_2m_max', 'temperature_2m_mean', 'precipitation_sum']
else:
    archive = os.path.join(here, 'outputs', 'raw-responses-2026-11-11.tar.xz')
    saved = {r['name']: {'lat': r['lat'], 'lon': r['lon'], **r['era5']} for r in json.load(open(os.path.join(here, 'outputs', 'holdout-results.json')))['rows']}
    variables = ['temperature_2m_min', 'temperature_2m_mean', 'precipitation_sum']
slug = lambda n: ''.join(c if c.isalnum() else '-' for c in n.lower()).strip('-')
def collapse(s):
    while '--' in s: s = s.replace('--', '-')
    return s
START, END = datetime.date(2001, 1, 1), datetime.date(2020, 12, 31)
EXPECTED = [(START + datetime.timedelta(days=i)).isoformat() for i in range((END - START).days + 1)]
assert len(EXPECTED) == 7305
UNITS = {'temperature_2m_min': '°C', 'temperature_2m_max': '°C', 'temperature_2m_mean': '°C', 'precipitation_sum': 'mm'}
r1 = lambda x: math.floor(x * 10 + 0.5) / 10
r2 = lambda x: math.floor(x * 100 + 0.5) / 100
def km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))

def admit(j):
    """Why this response may not be scored; an empty list means it is complete and in the stated units."""
    d = j.get('daily') or {}
    issues = []
    if d.get('time') != EXPECTED:
        got = d.get('time') or []
        issues.append(f"dates are not the 7305 days 2001-01-01..2020-12-31 (got {len(got)}, {len(set(got))} unique, first {got[:1]}, last {got[-1:]})")
    for v in variables:
        series = d.get(v)
        if not isinstance(series, list) or len(series) != 7305: issues.append(f"{v}: {None if series is None else len(series)} values, not 7305"); continue
        missing = sum(1 for x in series if x is None)
        bad = sum(1 for x in series if x is not None and (isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x)))
        if missing: issues.append(f"{v}: {missing} missing values")
        if bad: issues.append(f"{v}: {bad} non-numeric values")
        if (j.get('daily_units') or {}).get(v) != UNITS[v]: issues.append(f"{v}: unit is {(j.get('daily_units') or {}).get(v)!r}, not {UNITS[v]!r}")
    return issues

raw = {}
with tarfile.open(archive, 'r:xz') as tar:
    for member in tar.getmembers():
        if member.isfile() and os.path.basename(member.name).startswith('era5_'):
            data = tar.extractfile(member).read()
            raw[os.path.basename(member.name)[5:-5]] = (data, hashlib.sha256(data).hexdigest())
print(f"archive: {os.path.basename(archive)}  sha256 {hashlib.sha256(open(archive, 'rb').read()).hexdigest()}")
print(f"daily responses in the archive: {len(raw)}; places to check: {len(saved)}\n")

if '--negative-controls' in sys.argv:
    # The three corrupt records of the independent review (its checks H03, H04, H05), built from
    # a real response, plus two more. Each must be REFUSED. Synthetic inputs, not observations.
    import copy
    base = json.loads(next(iter(raw.values()))[0])
    assert admit(base) == [], 'fixture: the untouched response must be admitted'
    def one_day_a_year(j):
        keep = [i for i, t in enumerate(j['daily']['time']) if t.endswith('-01-01')]
        for k in list(j['daily']): j['daily'][k] = [j['daily'][k][i] for i in keep]
    def fahrenheit(j): j['daily_units']['temperature_2m_min'] = '°F'
    def missing_minimum(j): j['daily']['temperature_2m_min'][100] = None
    def duplicated_day(j): j['daily']['time'][200] = j['daily']['time'][199]
    def no_units(j): del j['daily_units']
    accepted = 0
    for label, corrupt in [('one day in each of 20 years (H03)', one_day_a_year), ('minimum labelled Fahrenheit (H04)', fahrenheit),
                           ('one missing daily minimum (H05)', missing_minimum), ('a duplicated date', duplicated_day), ('no units stated', no_units)]:
        j = copy.deepcopy(base); corrupt(j); issues = admit(j)
        accepted += not issues
        print(f"{'REFUSED ' if issues else 'ACCEPTED'}  {label}: {issues[0] if issues else 'no objection'}")
    print(f"\n{5 - accepted} of 5 corrupt records refused.")
    sys.exit(1 if accepted else 0)

problems, cells, rows = [], collections.defaultdict(list), []
for name, want in saved.items():
    key = collapse(slug(name))
    if key not in raw: problems.append(f"{name}: no raw response in the archive"); continue
    data, digest = raw[key]
    j = json.loads(data); d = j.get('daily') or {}
    issues = admit(j)
    stats = None
    if not issues:
        tn = d['temperature_2m_min']
        frost = [(t, x) for t, x in zip(d['time'], tn) if x <= 0]
        stats = {'airFrostDaysPerYear': r2(len(frost) / 20), 'lowestDailyMinC': r1(min(tn)), 'yearsWithFrost': len({t[:4] for t, _ in frost}), 'years': len({t[:4] for t in d['time']})}
        for field, value in stats.items():
            # The 10 November fixture keeps frost days a year to one decimal; the 11 November results keep two.
            compare = r1(value) if AUDIT and field == 'airFrostDaysPerYear' else value
            if want.get(field) != compare: issues.append(f"{field}: rebuilt {value}, saved {want.get(field)}")
    cells[(j.get('latitude'), j.get('longitude'))].append(name)
    rows.append((name, digest[:12], j.get('latitude'), j.get('longitude'), j.get('elevation'), km(want['lat'], want['lon'], j.get('latitude'), j.get('longitude')), j.get('timezone'), stats, issues))
    for issue in issues: problems.append(f"{name}: {issue}")

print(f"{'place':25}{'sha256':14}{'cell lat':>10}{'cell lon':>10}{'elev m':>8}{'km off':>8}  {'timezone':22}{'frost/yr':>9}{'lowest':>8}{'frost yrs':>10}  result")
for name, digest, lat, lon, elev, off, tz, stats, issues in rows:
    s = stats or {}
    print(f"{name[:24]:25}{digest:14}{lat:10.4f}{lon:10.4f}{elev:8.0f}{off:8.1f}  {str(tz):22}{str(s.get('airFrostDaysPerYear', '-')):>9}{str(s.get('lowestDailyMinC', '-')):>8}{str(s.get('yearsWithFrost', '-')):>10}  {'REFUSED: ' + '; '.join(issues) if issues else 'complete; rebuilt figures equal the saved ones'}")

print(f"\nplaces checked {len(rows)}; complete and reproduced {sum(1 for r in rows if not r[8])}; refused or different {sum(1 for r in rows if r[8])}; no raw response {len(saved) - len(rows)}")
shared = [names for names in cells.values() if len(names) > 1]
print(f"distinct daily grid cells {len(cells)}; places sharing a daily cell: {'; '.join(', '.join(n) for n in shared) if shared else 'none'}")
offs = [r[5] for r in rows]
if offs: print(f"distance from the requested point to the cell the provider returned: median {sorted(offs)[len(offs) // 2]:.1f} km, largest {max(offs):.1f} km ({max(rows, key=lambda r: r[5])[0]})")
print("\nWhat the responses do NOT say: which model produced them. They carry no model field. The requests did not send")
print("`models` or `cell_selection`, so the provider's defaults applied (see the record). Units and dates are as stated above.")
if problems:
    print('\nPROBLEMS'); [print(' -', p) for p in problems]; sys.exit(1)
