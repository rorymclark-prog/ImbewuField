"""Check cash timing, quoted repayment components and allocations against the teaching answers."""
from pathlib import Path
from copy import deepcopy
import json
R=Path(__file__).resolve().parent
P=json.loads((R/'f6-practice.json').read_text())
def money(c):
    if c is None:return 'Unknown'
    return ('-' if c<0 else '')+f'R{abs(c)//100:,.0f}.{abs(c)%100:02d}'
def equipment(p,c):
    balance=p['openingCents'];low=balance;out=received=0;rows=[];refs=set();last=0
    for e in c['events']:
        assert e['ref'] not in refs;refs.add(e['ref']);assert e['day']>=last and e['day']<=p['horizonDays'];last=e['day']
        assert all(type(e[k])is int and e[k]>=0 for k in ('in','out'))
        out+=e['out'];received+=e['in'];balance+=e['in']-e['out'];low=min(low,balance)
        rows.append({**e,'balance':balance})
    return dict(id=c['id'],out=out,received=received,net=out-received,closing=balance,gap=max(0,-low),peak= p['openingCents']-low,rows=rows)
def loan(p,s):
    principal=p['principalCents'];fee=p['feeCents']
    assert s['separateFeeCents']+s['withheldFeeCents']==fee,'fee once only'
    assert s['creditedCents']+s['withheldFeeCents']==principal,'withheld fee reconciles to principal'
    net=s['creditedCents']-s['separateFeeCents'];balance=principal;rows=[];last='';total=0
    for r in s['rows']:
        assert r['date']>last;last=r['date']
        for k in ('principal','interest','service','insurance'):assert r[k]is None or (type(r[k])is int and r[k]>=0)
        assert r['principal']is not None and r['principal']<=balance;balance-=r['principal']
        amount=None if any(r[k]is None for k in ('principal','interest','service','insurance')) else sum(r[k]for k in ('principal','interest','service','insurance'))
        total=None if total is None or amount is None else total+amount
        rows.append({**r,'amount':amount,'remaining':balance})
    assert balance==0,'principal must reconcile across this fully repaid schedule'
    cost=None if total is None else total-principal+fee
    # Cash cost also reconciles when a fee is withheld instead of charged again.
    assert total is None or total-net==cost
    return dict(id=s['id'],net=net,total=total,cost=cost,rows=rows)
def reserve(p,shock=False):
    op=p['openingOperatingCents'];held=p['openingReservedCents'];cash=op+held;rows=[];refs=set()
    events=sorted(p['events']+([p['shock']]if shock else []),key=lambda e:e['day'])
    for e in events:
        assert e['ref']not in refs;refs.add(e['ref']);c=e['cents'];assert type(c)is int and c>=0;k=e['kind']
        if k=='allocate':assert c<=op;op-=c;held+=c
        elif k=='reserve-payment':assert c<=held;held-=c;cash-=c
        elif k=='operating-receipt':op+=c;cash+=c
        elif k=='operating-payment':op-=c;cash-=c
        elif k=='repair':use=min(held,c);held-=use;op-=c-use;cash-=c
        else:raise AssertionError('unsupported movement')
        assert cash==op+held and held>=0
        rows.append({**e,'operating':op,'reserved':held,'total':cash})
    return dict(id='SHOCK'if shock else 'BASE',rows=rows,closing=cash,targetGap=max(0,p['targetCents']-held),cashGap=max(0,-min(r['total']for r in rows)))
def table_rows(p):
    output=[]
    for c in p['equipment']['cases']:
        x=equipment(p['equipment'],c);output.append('| '+' | '.join([x['id'],*[money(x[k])for k in ('out','received','net','peak','closing','gap')]])+' |')
    for s in p['borrowing']['schedules']:
        x=loan(p['borrowing'],s);output.append('| '+' | '.join([x['id'],*[money(x[k])for k in ('net','total','cost')]])+' |')
        for i,r in enumerate(x['rows'],1):output.append('| '+' | '.join([x['id']+f'-{i}',r['date'],*[money(r[k])for k in ('principal','interest','service','insurance','amount','remaining')]])+' |')
    for shock in (False,True):
        x=reserve(p['reserves'],shock)
        for r in x['rows']:output.append('| '+' | '.join([x['id']+'/'+r['ref'],str(r['day']),*[money(r[k])for k in ('operating','reserved','total')]])+' |')
    return output

def independent(p):
    i=p['independent'];upfront=i['hireChargeCents']+i['depositCents'];net=upfront-i['refundedCents'];payment=i['principalCents']+i['interestCents']+i['includedServiceCents'];after=i['openingTotalCents']-i['reservePaymentCents'];held=i['allocatedCents']-i['reservePaymentCents']
    return f"Independent: {money(upfront)} needed before hire; {money(net)} net after refund; {money(payment)} instalment including its service fee; {money(i['openingTotalCents'])} total after allocation; {money(after)} after the payment, including {money(held)} still reserved."
def check(p,t):
    assert p['fullProfit']is None
    for row in table_rows(p):assert row in t,'answer mismatch: '+row
    assert independent(p)in t
    e={c['id']:equipment(p['equipment'],c)for c in p['equipment']['cases']}
    assert e['HIRE']['peak']>e['HIRE']['net'],'refundable deposit still needs cash first'
    a,b,u=[loan(p['borrowing'],s)for s in p['borrowing']['schedules']]
    assert a['net']==b['net']and a['total']==b['total']and a['cost']==b['cost']
    assert u['cost']is None and all(r['amount']is None for r in u['rows'])
    base=reserve(p['reserves']);shock=reserve(p['reserves'],True)
    assert base['rows'][0]['total']==p['reserves']['openingOperatingCents']+p['reserves']['openingReservedCents']
    assert base['cashGap']==0 and shock['cashGap']>0
    assert all(c['remainingAssetValueCents']is None for c in p['equipment']['cases']if c['id']!='HIRE')
def main():
    t=(R/'f6-equipment.md').read_text();check(P,t);rejected=[]
    def bad(name,p=P,text=t):
        try:check(p,text)
        except (AssertionError,TypeError):rejected.append(name);return
        raise AssertionError('missed fault: '+name)
    for old,new,label in [
      ('| HIRE | R420.00 | R150.00 | R270.00 | R420.00','| HIRE | R420.00 | R150.00 | R270.00 | R270.00','deposit ignored in up-front need'),
      ('| BUY | R1,000.00 | R0.00 | R1,000.00 | R1,000.00 | -R500.00 | R500.00','| BUY | R1,000.00 | R0.00 | R1,000.00 | R1,000.00 | R500.00 | R0.00','unfunded purchase called available cash'),
      ('| SEPARATE | R570.00 | R654.00 | R84.00','| SEPARATE | R600.00 | R654.00 | R54.00','up-front fee omitted'),
      ('| WITHHELD | R570.00 | R654.00 | R84.00','| WITHHELD | R540.00 | R654.00 | R114.00','withheld fee charged twice'),
      ('| UNKNOWN | R570.00 | Unknown | Unknown','| UNKNOWN | R570.00 | R630.00 | R60.00','unknown insurance treated as free'),
      ('| BASE/A01 | 5 | R500.00 | R300.00 | R800.00','| BASE/A01 | 5 | R500.00 | R300.00 | R700.00','allocation counted as expense'),
      ('| BASE/M01 | 10 | R500.00 | R180.00 | R680.00','| BASE/M01 | 10 | R500.00 | R300.00 | R800.00','maintenance payment ignored'),
      ('| SHOCK/E01 | 25 | -R40.00 | R0.00 | -R40.00','| SHOCK/E01 | 25 | R0.00 | R0.00 | R0.00','shortfall silently clipped')]:
        assert old in t;bad(label,text=t.replace(old,new))
    p=deepcopy(P);p['borrowing']['schedules'][0]['rows'][0]['principal']=19000;bad('unreconciled principal',p)
    p=deepcopy(P);p['borrowing']['schedules'][1]['separateFeeCents']=3000;bad('fee duplicated in data',p)
    p=deepcopy(P);p['equipment']['cases'][1]['events'].append(deepcopy(p['equipment']['cases'][1]['events'][-1]));bad('deposit refunded twice',p)
    p=deepcopy(P);p['equipment']['cases'][0]['remainingAssetValueCents']=0;bad('missing asset value replaced by zero',p)
    p=deepcopy(P);p['reserves']['events'].append({'day':26,'ref':'D01','kind':'operating-payment','cents':5000});bad('non-cash estimate subtracted from cash',p)
    p=deepcopy(P);p['reserves']['events'].append({'day':26,'ref':'G01','kind':'operating-receipt','cents':30000});bad('unapproved funding counted',p)
    bad('included service fee counted twice',text=t.replace('R112.00 instalment','R114.00 instalment'))
    print(f'F6 verified: three equipment options, three repayment schedules, two reserve projections and independent answers. {len(rejected)} deliberate faults rejected.')
if __name__=='__main__':main()
