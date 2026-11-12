# What the four held-out criteria can and cannot tell apart (independent review, CBR-01).
#   python3 criteria-controls.py > outputs/criteria-controls.txt
#
# Part 1 scores answers that ignore the place entirely. If such an answer passes, the
# criteria do not measure whether the calendar is right; they only forbid some frost mistakes.
# Part 2 is a POST-HOC description, written after the results were seen. It is not one of the
# pre-registered criteria and it is not a held-out result.
import json, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..', '..', '..'))
held = [{'name': r['name'], 'app': r['app']['pattern'], 'recordMinC': r['app']['recordMinC'], 'appRain': r['app']['monthlyRainMm'], 'lat': r['lat'],
         'frost': r['era5']['airFrostDaysPerYear'], 'lowest': r['era5']['lowestDailyMinC'], 'frostYears': r['era5']['yearsWithFrost'], 'rain': r['era5']['monthlyRainMm']}
        for r in json.load(open(os.path.join(here, 'outputs', 'holdout-results.json')))['rows']]
dev = [{'name': s['name'], 'recordMinC': s['recordMinC'], 'frost': s['era5']['airFrostDaysPerYear'], 'lowest': s['era5']['lowestDailyMinC'], 'frostYears': s['era5']['yearsWithFrost']}
       for s in json.load(open(os.path.join(root, 'tests', 'fixtures', 'sa-climate-sites-2026-11-10.json')))['sites']]
NAME = {'summer': 'Winter frost', 'mild-frost': 'Light frost at most', 'all-year': 'Hot area, no frost', 'winter': 'Winter rainfall'}

def failed(pattern, p):
    out = []
    if pattern == 'all-year' and (p['frost'] > 0 or p['lowest'] <= 0): out.append('H-A')
    if pattern == 'mild-frost' and p['frost'] >= 0.5: out.append('H-B')
    if p['frost'] >= 1 and pattern not in ('summer', 'winter'): out.append('H-C')
    if pattern == 'summer' and p['frostYears'] == 0 and p['lowest'] > 0 and p['recordMinC'] is not None and p['recordMinC'] > 0: out.append('H-D')
    return out

print('== Part 1. Answers that ignore the place, scored on the four criteria ==')
print(f"{'answer given to every place':34}{'56 held-out: pass':>20}{'44 development: pass':>24}")
for constant in ['winter', 'summer', 'mild-frost', 'all-year']:
    h = sum(1 for p in held if not failed(constant, p)); d = sum(1 for p in dev if not failed(constant, p))
    print(f"{'always ' + NAME[constant]:34}{h:>14} of 56{d:>18} of 44")
print(f"{'the app (for comparison)':34}{sum(1 for p in held if not failed(p['app'], p)):>14} of 56{'44':>18} of 44")
print("""
"Always Winter rainfall" passes everything: H-A and H-B only constrain the hot-area and light-frost
answers, H-C allows the winter calendar at any frost count, and H-D forbids the hard-frost calendar only.
So 54 of 56 is compliance with four one-sided frost constraints. It is not a share of places given the
right calendar, and it says nothing about sowing months, crops or yields.""")

print('\n== Part 2. POST HOC, not pre-registered: does the calendar agree with the rain timing of the independent record? ==')
print("The winter-rainfall calendar is meant for places whose rain falls mainly in winter. The app decides that from")
print("NASA POWER rain: summer half-year (October to March) share of annual rain at or below 0.35. Here the same share")
print("is taken from the independent record's own rain, and compared.\n")
share = lambda rain: sum(rain[m] for m in (9, 10, 11, 0, 1, 2)) / sum(rain)
print(f"{'place':25}{'calendar':21}{'summer share, app':>19}{'summer share, independent':>27}   agreement")
agree = winter_wrong = 0
for p in held:
    a, i = share(p['appRain']), share(p['rain'])
    ok = (p['app'] == 'winter') == (i <= 0.35)
    agree += ok
    winter_wrong += i > 0.35
    if p['app'] == 'winter' or i <= 0.40 or not ok:
        print(f"{p['name'][:24]:25}{NAME[p['app']]:21}{a:19.2f}{i:27.2f}   {'same side of 0.35' if ok else 'DIFFERENT side of 0.35'}")
print(f"\n(only places on the winter calendar, or with an independent share of 0.40 or less, or that disagree, are listed)")
print(f"the app's winter / not-winter answer is on the same side as the independent record at {agree} of 56 places")
print(f"an 'always Winter rainfall' answer would be on the wrong side at {winter_wrong} of 56 places")
print("""
This check would reject the always-winter answer. It was chosen after the results were known, on places already
seen, and it uses the app's own 0.35 line, so it is a description of this run and a candidate for the NEXT
pre-registered validation. It is not evidence that the winter calendar's months are right for these places.""")
