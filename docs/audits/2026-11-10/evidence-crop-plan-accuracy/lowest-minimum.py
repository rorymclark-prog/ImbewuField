# The lowest daily minimum temperature in the ERA5 record (2001-2020) for the sites whose frost status matters most.
# "No air-frost day" is a count; this shows how close each site came, which matters because a gridded record
# runs warmer than a cold hollow. Reads the raw daily cache written by location-harness.ts.
# Usage: python3 lowest-minimum.py <OUT dir of location-harness.ts>
import json, os, sys
cache=os.path.join(sys.argv[1],'cache')
SITES={'Komatipoort':'komatipoort','Phalaborwa':'phalaborwa','Thohoyandou':'thohoyandou','Musina':'musina','Tzaneen':'tzaneen','Lephalale':'lephalale','Mbombela':'mbombela',
       'Durban':'durban','Richards Bay':'richards','Mkuze sample farm':'mkuze','Polokwane':'polokwane','Pretoria':'pretoria'}
files=os.listdir(cache)
print('site | lowest daily minimum, C | date | days <= 0 C | days <= 2 C | days <= 4 C | grid cell elevation, m')
for name,slug in SITES.items():
    f=[x for x in files if x.startswith('era5_') and slug in x.lower()][0]
    j=json.load(open(os.path.join(cache,f))); d=j['daily']; tm=d['temperature_2m_min']
    lo=min(v for v in tm if v is not None); i=tm.index(lo)
    c=lambda th: sum(1 for v in tm if v is not None and v<=th)
    print(f"{name} | {lo:.1f} | {d['time'][i]} | {c(0)} | {c(2)} | {c(4)} | {round(j.get('elevation',0))}")
