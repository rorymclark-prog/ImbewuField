"""Author the visual comparison from the verified sources; never generate numeric artwork."""
from pathlib import Path
import base64, json, runpy, subprocess
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
v=runpy.run_path(str(HERE/'verify-f8.py'));v['main']();p=v['P']
plans=[]
for q, delayed in [(p['plans'][0],False),(p['plans'][1],False),(p['plans'][0],True)]:
 r=v['plan_summary'](q,receipt_date=p['delayedPlan']['receiptDate'] if delayed else None)
 dates=['2027-01-01','2027-01-05','2027-01-10','2027-01-20','2027-01-30']
 chart=[]
 for date in dates:
  row=[x for x in r['rows'] if x['date']<=date][-1]
  chart.append({'date':date[8:]+' Jan','cash':row['cash']})
 plans.append({**r,'chart':chart,'label':('Plan A · later payment' if delayed else 'Plan '+q['id']+' · '+q['title']),
  'evidence':p['delayedPlan']['reason'] if delayed else q['marketEvidence'],
  'hours':f"Owner time: {q['ownerHours']} hours needed; {p['ownerHoursAvailable']} available. "+('Two more hours need a checked arrangement.' if r['hoursGap'] else 'No owner-hour gap within these supplied assumptions.'),
  'boundary':'January buyer receipts '+v['money'](r['receipts'])+'; payments '+v['money'](r['payments'])+'. Complete profit remains unknown. '+('The expected R480 receipt remains outside January.' if delayed else 'Market enquiries and cost quotes are not proof of future sales or actual payments.')})
a=p['actual'];actual=sorted(a['payments']+a['receipts']+a['contributions']+[a['invoice'],a['closingCashEvidence']],key=lambda e:e['date'])
data={'plans':plans,'bridge':v['variance_bridge'](),'actual':actual}
columns=''.join(f'<div class="cash-event"><div class="plot" aria-hidden="true"><div class="zero"></div><div class="bar" id="cash-bar-{i}"></div></div><strong id="cash-value-{i}"></strong><span id="cash-date-{i}"></span></div>' for i in range(5))
hero=REPO/'docs/media/studies-illustrated-release/art/market-community/know-the-customer.jpg'
s=(HERE/'f8-business-plan.template.html').read_text().replace('__HERO__','data:image/jpeg;base64,'+base64.b64encode(hero.read_bytes()).decode()).replace('__CASH_COLUMNS__',columns).replace('__DATA__',json.dumps(data))
subprocess.run(['node','--check'],input=s.split('<script>')[1].split('</script>')[0],text=True,check=True)
out=REPO/'output/html/finance-f8-business-plan.html';out.write_text(s);print(out)
