"""Reconcile source-linked invoice balances without inventing another sale or receipt."""
from pathlib import Path
from copy import deepcopy
from fractions import Fraction
import json
R=Path(__file__).resolve().parent
P=json.loads((R/'f5-practice.json').read_text())
def money(c):return f'R{c//100:,.0f}.{c%100:02d}'
def ledger(case):
    invoice=adjusted=cash=applied=deposit=unmatched=0;out=[];refs=set();last_day=0
    for e in case['events']:
        assert e['ref'] not in refs,'duplicate evidence reference'
        refs.add(e['ref']);assert e['day']>=last_day;last_day=e['day']
        c=e['cents'];assert type(c)is int and c>=0
        k=e['kind']
        if k=='invoice':assert invoice==0,'another invoice for same delivery';invoice=c
        elif k=='receipt':assert invoice>0;cash+=c;applied+=c
        elif k=='deposit':cash+=c;deposit+=c
        elif k=='apply-deposit':assert invoice>0 and c<=deposit;deposit-=c;applied+=c
        elif k=='approved-adjustment':assert invoice>0 and adjusted+c<=invoice;adjusted+=c
        elif k=='unmatched-receipt':cash+=c;unmatched+=c
        else:assert k in ('order','copy','dispute')
        net=invoice-adjusted;owed=max(0,net-applied);credit=max(0,applied-net)
        assert cash==applied+deposit+unmatched,'cash cannot be created by allocating a deposit'
        assert net+credit==applied+owed,'invoice settlement must reconcile'
        out.append([e['ref'],invoice,adjusted,cash,owed,deposit,credit,unmatched])
    return out

def answers(p):
    return ['| '+' | '.join([row[0],*[money(v) for v in row[1:]]])+' |' for c in p['cases'] for row in ledger(c)]

def check(p,manuscript):
    assert p['fullProfit'] is None
    for row in answers(p):assert row in manuscript,'wrong or missing answer: '+row
    lines=p['mixedUnitInvoice']['lines'];amounts=[Fraction(x['quantity'])*x['priceCents'] for x in lines]
    assert all(x.denominator==1 for x in amounts)
    assert 'M01: 2.5 kg × R12.00 = R30.00; 3 bunches × R8.00 = R24.00; total R54.00.' in manuscript
    assert sum(amounts)==5400 and {x['unit'] for x in lines}=={'kg','bunches'}
    i=p['independent'];owed=i['invoiceCents']-i['receivedCents'];after=owed-i['approvedAdjustmentCents'];credit=i['otherReceiptCents']-i['otherInvoiceCents']
    assert f'Independent answers: {money(owed)} owed before an approved adjustment; {money(after)} after it; {money(credit)} customer credit in the separate overpayment case.' in manuscript
    assert ledger(p['cases'][0])[-1][1:]==[12000,0,12000,0,0,0,0]
    assert ledger(p['cases'][1])[1][1:]==[0,0,3000,0,3000,0,0]
    assert ledger(p['cases'][2])[2][4]==8000
    assert ledger(p['cases'][3])[-1][-1]==2500
    assert ledger(p['cases'][4])[-1][-2]==1000

def main():
    text=(R/'f5-sales.md').read_text();check(P,text);rejected=[]
    def bad(name,p=P,t=text):
        try:check(p,t)
        except (AssertionError,ValueError):rejected.append(name);return
        raise AssertionError('missed deliberate fault: '+name)
    for old,new,name in [
      ('| R01-A | R120.00 | R0.00 | R40.00 | R80.00','| R01-A | R120.00 | R0.00 | R40.00 | R0.00','deposit marked paid in full'),
      ('| I01-COPY | R120.00','| I01-COPY | R240.00','copy counted as another sale'),
      ('| DEP02 | R0.00 | R0.00 | R30.00 | R0.00 | R30.00','| DEP02 | R90.00 | R0.00 | R30.00 | R60.00 | R0.00','advance treated as completed sale'),
      ('| ALLOC02 | R90.00 | R0.00 | R30.00','| ALLOC02 | R90.00 | R0.00 | R60.00','deposit allocated as new cash'),
      ('| Q03 | R200.00 | R0.00 | R120.00 | R80.00','| Q03 | R200.00 | R40.00 | R120.00 | R40.00','dispute written off without agreement'),
      ('| BANK04 | R0.00 | R0.00 | R25.00 | R0.00 | R0.00 | R0.00 | R25.00','| BANK04 | R25.00 | R0.00 | R25.00 | R0.00 | R0.00 | R0.00 | R0.00','unknown payer silently assigned'),
      ('| R05 | R50.00 | R0.00 | R60.00 | R0.00 | R0.00 | R10.00','| R05 | R60.00 | R0.00 | R60.00 | R0.00 | R0.00 | R0.00','overpayment called extra sales'),
      ('total R54.00.','total R55.00.','mixed-unit invoice arithmetic')]:
        assert old in text;bad(name,t=text.replace(old,new))
    p=deepcopy(P);p['cases'][0]['events'].append(deepcopy(p['cases'][0]['events'][-1]));bad('duplicate receipt',p)
    p=deepcopy(P);p['cases'][1]['events'][3]['cents']=4000;bad('deposit overallocated',p)
    p=deepcopy(P);p['cases'][2]['events'][3]['cents']=21000;bad('adjustment exceeds invoice',p)
    p=deepcopy(P);p['mixedUnitInvoice']['lines'][1]['unit']='kg';bad('bunches relabelled kilograms',p)
    print(f'F5 verified: 18 document events, five settlements, mixed units and independent balances. {len(rejected)} deliberate faults rejected. Full profit remains unknown.')
if __name__=='__main__':main()
