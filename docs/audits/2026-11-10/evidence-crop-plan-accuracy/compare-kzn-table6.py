# KZN DARD 'Plant Establishment' Table 6 rows as transcribed in the repo's own research files and catalog comments
# (research/crop-sources/_frost-free-months.json, per-crop dossiers, lib/crop-catalog.ts comments).
# Columns: cold areas (moderate/heavy frost) | warm areas (light frost) | hot areas (frost-free).
# The primary PDF was NOT reachable during this audit (HTTP 503/404), so these are second-hand transcriptions.
import json, re, sys
M={m:i+1 for i,m in enumerate(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'])}
def mon(s): return M[s.strip().lower()[:3]]
def rng(a,b):
    out=[];m=a
    while True:
        out.append(m)
        if m==b: break
        m=m%12+1
    return out
def parse(cell):
    """returns (core,wide) month sets. 'Feb - Jun/Jul' -> core Feb-Jun, wide Feb-Jul. 'Sept/Oct - Dec' -> core Oct-Dec, wide Sep-Dec."""
    cell=cell.strip()
    if cell in ('-',''): return (set(),set())
    if cell.lower()=='all year': return (set(range(1,13)),set(range(1,13)))
    core=set();wide=set()
    for part in cell.split(','):
        part=part.strip()
        if '-' in part or '–' in part:
            a,b=re.split(r'\s*[-–]\s*',part,maxsplit=1)
            a_alts=[mon(x) for x in a.split('/')]; b_alts=[mon(x) for x in b.split('/')]
            wide|=set(rng(a_alts[0],b_alts[-1])); core|=set(rng(a_alts[-1],b_alts[0]))
        else:
            alts=[mon(x) for x in part.split('/')]
            wide|=set(alts); core|=set(alts) if len(alts)==1 else set()
    return (core,wide)
ROWS={ # catalog key(s): (cold, warm, hot)
 'sweetcorn':('Sept/Oct - Dec','Aug/Sept - Jan/Feb','Jan - Mar, Jul - Sept'),
 'green-beans':('Sept - Jan','Aug - Feb/Mar','Feb - Sept'),
 'dry-beans':('Sept - Jan','Aug - Feb/Mar','Feb - Sept'),
 'butternut':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'pumpkin':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'cucumber':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'watermelon':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'gem-squash':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'baby-marrow':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'spanspek':('Sept - Dec/Jan','Aug - Jan/Feb','Mar - May, Jul - Oct'),
 'cabbage':('Sept - Feb','All year','Feb - Jun/Jul'),
 'beetroot':('Aug - Mar','All year','Feb - Sept'),
 'sweet-potato':('Nov','Sept/Oct - Dec','Aug - Mar'),
 'potato':('Sept/Oct','Jun - Aug','Apr/May'),
 'lettuce':('Jan - Apr, Jul - Dec','All year','Feb - Aug/Sept'),
 'amadumbe':('-','Aug - Nov','Jul - Dec, Mar'),
 'garlic':('Apr - May','Apr - May','Apr - May'),
 'peas':('Jun/Jul - Sept','Mar - Jul/Aug','Mar - May/Jun'),
 'broad-beans':('Apr - May','Apr - May','Apr - May'),
 'broccoli':('Sept - Jan','Jan - Sept','Feb - Jun/Jul'),
 'cauliflower':('Aug - Sept, Dec - Feb/Mar','Jul - Sept, Jan - Apr','Feb - Mar/Apr'),
 'parsley':('Aug - Mar','Jul - Apr','Feb - Sept'),
 'radish':('Jul - Apr','All year','Mar - Oct'),
 'true-spinach':('Aug - Mar','Feb - May, Jul - Sept','Mar - Aug'),
}
cat={c['key']:c for c in json.load(open(sys.argv[1]))}
L='JFMAMJJASOND'
def show(s): return ''.join(L[i] if i+1 in s else '.' for i in range(12))
cols=[('summer',0,'cold'),('mild-frost',1,'warm'),('all-year',2,'hot')]
tot={c[0]:[0,0,0] for c in cols}
print(f"{'crop':13} {'column':10} {'source core':12} {'source wide':12} {'catalog':12} {'not in source':13} {'source months missing':12}")
for k,row in ROWS.items():
    for col,i,name in cols:
        core,wide=parse(row[i]); c=set(cat[k]['sowMonths'][col]); extra=c-wide; missing=core-c
        tot[col][0]+=1; tot[col][1]+=bool(extra); tot[col][2]+=bool(missing)
        flag='OK' if not extra and not missing else ''
        print(f"{k:13} {col:10} {show(core)} {show(wide)} {show(c)} {show(extra) if extra else '':13} {show(missing) if missing else '':12} {flag}")
print({k:{'rows':v[0],'rows with months not in source':v[1],'rows missing source months':v[2]} for k,v in tot.items()})
# the Western Cape column against the hard-frost column
same=[c['key'] for c in cat.values() if c['sowMonths']['winter'] and sorted(c['sowMonths']['winter'])==sorted(c['sowMonths']['summer'])]
print('winter column identical to summer column:',same)
print('no sow month at all per column:',{col:[c['key'] for c in cat.values() if not c['sowMonths'][col] and c['timingVerified']] for col in ['summer','mild-frost','all-year','winter']})
