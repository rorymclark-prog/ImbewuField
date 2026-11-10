# App sowing months for a real place (the calendar column the app assigns from NASA POWER) against the
# "General sowing guide (according to SANSOR)" regional table, read from the page image of
# sources/sutherland_sowguide.pdf (a nursery's reproduction, PDF dated 2004). Secondary, seed-industry source.
# Site -> SANSOR region is the auditor's assignment; ambiguous sites are left out and listed.
import json, re, sys, collections
M={m:i+1 for i,m in enumerate(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'])}
def rng(a,b):
    out=[];m=a
    while True:
        out.append(m)
        if m==b: break
        m=m%12+1
    return out
def parse(cell):
    s=set()
    for part in cell.split(','):
        part=part.strip()
        if not part or part=='-': continue
        ab=re.split(r'\s*[-–]\s*',part)
        a=M[ab[0].lower()[:3]]; b=M[ab[-1].lower()[:3]]
        s|=set(rng(a,b))
    return s
REG=['Highveld','Middleveld','Lowveld','N Cape & Great Karoo','KZN Midlands','E Cape & Little Karoo','W Cape & South Coast','KZN & Coast']
T={ # catalog key: (SANSOR row, [8 cells])
'broad-beans':('Bean (broad)',['Apr-May','Apr-May','Apr-May','Apr','Apr-May','Apr-May','Apr-Jun','Apr-May']),
'green-beans':('Bean (dwarf)',['Aug-Jan','Aug-Feb','Feb-Sep','Aug-Jan','Aug-Jan','Oct-Jan','Oct-Feb','Feb-Sep']),
'beetroot':('Beetroot',['Aug-Oct, Jan-Mar','Aug-Apr','Feb-Jul','Aug-Oct, Feb-Mar','Aug-Apr','Jul-Feb','Jul-Nov, Feb-Apr','Feb-Jul']),
'brinjal':('Brinjal or egg-fruit',['Aug-Oct','Aug-Nov','Jan-Sep','Aug-Oct','Aug-Oct','Aug-Oct','Aug-Oct','Jan-Sep']),
'broccoli':('Broccoli',['Dec-Feb','Jan-Feb','-','Dec-Feb','Dec-Feb','Dec-Jan','Dec-Jan','-']),
'cabbage':('Cabbage',['Nov-Feb, Jul-Aug','Feb-Apr, Aug-Sep','Feb-Jun','Nov-Feb','Aug-Feb','Aug-Apr','Nov-Apr','Feb-Jun']),
'peppers':('Capsicum',['Aug-Oct','Aug-Oct','Jan-Apr, Jul-Oct','Aug-Oct','Sep-Oct','Aug-Oct','Aug-Oct','Jan-Apr, Jul-Oct']),
'chilli':('Capsicum',['Aug-Oct','Aug-Oct','Jan-Apr, Jul-Oct','Aug-Oct','Sep-Oct','Aug-Oct','Aug-Oct','Jan-Apr, Jul-Oct']),
'carrots':('Carrot',['Aug-Oct, Jan-Mar','Aug-Oct, Jan-Mar','Feb-Aug','Aug-Oct, Jan-Mar','Aug-Apr','Jul-Apr','Aug-Nov, Jan-Apr','Feb-Aug']),
'cauliflower':('Cauliflower (early+main+late)',['Nov-Mar','Nov-Mar','Feb-Mar','Nov-Feb','Dec-Mar','Dec-Apr','Nov-Apr','Feb-Mar']),
'cucumber':('Cucumber (open culture)',['Sep-Dec','Aug-Jan','Feb-Sep','Sep-Dec','Sep-Dec','Jul-Feb','Sep-Nov','Feb-Sep']),
'lettuce':('Lettuce',['Jan-Mar, Aug-Sep','Jan-Sep','Mar-May','Jan-Mar, Aug-Sep','Jan-Mar, Aug-Sep','Jan-Apr, Jul-Oct','Aug-May','Mar-May']),
'sweetcorn':('Mealies (green and sweetcorn)',['Sep-Nov','Aug-Dec','Jul-Nov','Aug-Nov','Sep-Nov','Sep-Dec','Aug-Dec','Jul-Nov']),
'spanspek':('Melons (sweet)',['Sep-Nov','Aug-Dec','Jun-Aug','Sep-Oct','-','Sep-Oct','Sep-Dec','Jun-Aug']),
'watermelon':('Melon (water)',['Sep-Nov','Aug-Sep','Jul-Aug','Sep-Oct','Sep-Oct','Sep-Oct','Sep-Oct','Jul-Aug']),
'onions':('Onion',['Feb-Mar','Feb-Mar','Feb-Mar','Mar-Jul','Feb-Mar','Mar-May','Apr-May','Feb-Mar']),
'parsley':('Parsley',['Sep-Oct, Feb-Apr','Aug-Oct, Mar-Apr','Mar-May, Aug-Sep','Feb-Mar, Sep-Oct','Aug-Sep, Dec-Jan','Aug-Dec','Mar-Nov','Mar-May, Aug-Sep']),
'peas':('Pea',['Jul-Sep','Apr-Jun','Mar-Jun','Jul-Aug','Jun-Jul','May-Jul','Apr-Aug','Mar-Jun']),
'pumpkin':('Pumpkin and hubbard squash',['Sep-Nov','Aug-Dec','Feb-Aug','Sep-Dec','Sep-Dec','Sep-Nov','Sep-Nov','Feb-Aug']),
'butternut':('Squash (trailing types)',['Sep-Nov','Aug-Jan','Feb-Aug','Aug-Nov','Sep-Nov','Sep-Dec','Aug-Jan','Feb-Aug']),
'gem-squash':('Squash (trailing types)',['Sep-Nov','Aug-Jan','Feb-Aug','Aug-Nov','Sep-Nov','Sep-Dec','Aug-Jan','Feb-Aug']),
'baby-marrow':('Squash (bush types)',['Sep-Nov','Aug-Jan','Feb-Aug','Aug-Nov','Sep-Nov','Sep-Dec','Aug-Jan','Feb-Aug']),
'radish':('Radish',['Aug-Nov, Feb-Apr','Jul-Oct, Feb-Mar','Feb-Sep','Aug-Oct, Feb-Mar','Aug-Oct, Jan-Apr','Aug-May','Mar-Oct','Feb-Sep']),
'true-spinach':('Spinach',['Aug-Apr','Aug-Apr','Feb-Jun','Aug-Apr','Aug-Apr','Aug-Sep','Mar-May','Feb-Jun']),
'swiss-chard':('Swiss chard',['Aug-Oct, Jan-Mar','Jul-Oct, Jan-Apr','Feb-Aug','Jan-Mar, Jul-Oct','Aug-Oct, Jan-Mar','Aug-Oct, Jan-Mar','Mar-Apr, Aug-Sep','Feb-Aug']),
'tomatoes':('Tomato (open culture)',['Aug-Nov','Jul-Dec','Jan-Jul','Aug-Nov','Aug-Nov','Aug-Oct','Jul-Sep','Jan-Jul']),
'turnip':('Turnip',['Aug-Sep, Jan-Apr','Jul-Sep, Jan-Apr','Feb-Jun','Aug-Sep, Jan-Apr','Jan-Apr, Aug-Sep','Jul-Aug, Feb-Mar','Mar-Nov','Feb-Jun']),
}
SITE={ 'Johannesburg':0,'Ermelo':0,'Bethlehem':0,'Bloemfontein':0,'Potchefstroom':0,'Mahikeng':0,
 'Pretoria':1,'Rustenburg':1,'Polokwane':1,'Lephalale':1,
 'Mbombela':2,'Komatipoort':2,'Tzaneen':2,'Musina':2,'Thohoyandou':2,'Phalaborwa':2,
 'Kimberley':3,'Upington':3,'Kuruman':3,'Beaufort West':3,'Sutherland':3,'Graaff-Reinet':3,'Springbok':3,
 'Pietermaritzburg':4,'Underberg':4,'Kokstad':4,'Newcastle':4,'Vryheid':4,
 'Komani':5,'Mthatha':5,'Oudtshoorn':5,'East London':5,'Gqeberha':5,
 'Cape Town':6,'Stellenbosch':6,'Worcester':6,'Ceres':6,'George':6,'Vredendal':6,
 'Durban':7,'Richards Bay':7,'Mkuze sample farm':7 }
cat={c['key']:c for c in json.load(open(sys.argv[1]))}
locs=[l for l in json.load(open(sys.argv[2]))['locations'] if l['inSouthAfrica']]
L='JFMAMJJASOND'; show=lambda s:''.join(L[i] if i+1 in s else '.' for i in range(12))
agg=collections.defaultdict(lambda:[0,0,0,0,0]) # region -> both, extra, missing, crops, zero-overlap crops
persite=[]; zero=collections.defaultdict(list); detail={}
for l in locs:
    if l['name'] not in SITE: continue
    r=SITE[l['name']]; pat=l['app']['pattern']; b=e=m=n=z=0; rows=[]
    for k,(row,cells) in T.items():
        ref=parse(cells[r]); app=set(cat[k]['sowMonths'][pat])
        if not ref and not app: continue
        n+=1; b+=len(app&ref); e+=len(app-ref); m+=len(ref-app)
        if app and ref and not (app&ref): z+=1; zero[(REG[r],pat)].append((l['name'],k))
        rows.append((k,show(app),show(ref),len(app&ref),len(app-ref),len(ref-app)))
    persite.append((REG[r],l['name'],pat,n,b,e,m,z)); detail[l['name']]=rows
    a=agg[REG[r]]; a[0]+=b;a[1]+=e;a[2]+=m;a[3]+=n;a[4]+=z
print(f"{'region (SANSOR)':24} {'site':18} {'app column':10} crops  app months also in guide | not in guide | guide months app lacks | crops with NO overlap")
for p in sorted(persite):
    off=p[4]+p[5]
    print(f"{p[0]:24} {p[1]:18} {p[2]:10} {p[3]:5}  {p[4]:3}/{off:<3} = {100*p[4]/max(1,off):3.0f}%          {p[5]:3}            {p[6]:3}                 {p[7]:2}")
print()
for r in REG:
    a=agg[r]; off=a[0]+a[1]
    if a[3]: print(f"{r:24} agreement {100*a[0]/max(1,off):3.0f}% of offered months; guide months offered {100*a[0]/max(1,a[0]+a[2]):3.0f}%; crop-sites with no overlap {a[4]} of {a[3]}")
print('not scored (ambiguous region):',[l['name'] for l in locs if l['name'] not in SITE])
for name in sys.argv[3:]:
    print('\n==',name, SITE[name], [p for p in persite if p[1]==name][0][2])
    for row in detail[name]: print(f"  {row[0]:13} app {row[1]}  guide {row[2]}  both {row[3]} extra {row[4]} missing {row[5]}{'   <-- no overlap' if row[3]==0 and row[4] and row[5] else ''}")
