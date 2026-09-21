"""Check the teaching answers against dated source cards, including counterexamples."""
from pathlib import Path
from copy import deepcopy
from datetime import date
from fractions import Fraction
import json

ROOT=Path(__file__).resolve().parent
PACK=json.loads((ROOT/'f4-practice.json').read_text())


def money(cents):
    if cents is None: return 'Unknown'
    assert isinstance(cents,int)
    return ('-' if cents<0 else '')+f'R{abs(cents)//100:,}.{abs(cents)%100:02}'


def budget(p):
    b=p['budget']; rows=[]
    for a in b['activities']:
        hire=Fraction(b['hireCents']*a['hireHours'],sum(x['hireHours'] for x in b['activities']))
        trip=Fraction(b['tripCents']*a['tripSpaces'],sum(x['tripSpaces'] for x in b['activities']))
        assert hire.denominator==trip.denominator==1
        paid=a['directCents']+int(hire+trip)
        time=a['familyHours']*b['familyComparisonCentsPerHour']
        rows.append([a['id'],a['salesCents'],a['directCents'],int(hire),int(trip),paid,time,a['salesCents']-paid-time])
    assert sum(r[3] for r in rows)==b['hireCents']
    assert sum(r[4] for r in rows)==b['tripCents']
    rows.append(['TOTAL',*[sum(r[i] for r in rows) for i in range(1,8)]])
    return rows


def forecast(p,scenario):
    events=deepcopy(p['events'])
    assert len({r['id'] for r in events})==len(events),'duplicate source card'
    assert set(scenario['changes']).issubset({r['id'] for r in events})
    for r in events:
        r.update(scenario['changes'].get(r['id'],{}))
        date.fromisoformat(r['date'])
        assert r['direction'] in ('in','out')
        assert r['cents'] is None or type(r['cents']) is int and r['cents']>=0
    start,end=p['horizon']
    outside=[r for r in events if r['date']>end]
    events=sorted([r for r in events if start<=r['date']<=end],key=lambda r:(r['date'],r['id']))
    opening=p['opening']['cashTinCents']+p['opening']['bankCents']-p['opening']['restrictedCents']
    balance=opening; lowest=opening; first_gap=None; ledger=[]; months=[]
    for month in ['2027-01','2027-02','2027-03']:
        month_open=balance; receipts=payments=0
        for r in [r for r in events if r['date'].startswith(month)]:
            amount=r['cents']
            if r['direction']=='in': receipts=None if amount is None or receipts is None else receipts+amount
            else: payments=None if amount is None or payments is None else payments+amount
            balance=None if balance is None or amount is None else balance+(amount if r['direction']=='in' else -amount)
            if balance is not None:
                lowest=min(lowest,balance)
                if balance<0 and first_gap is None:first_gap=r['date']
            ledger.append({**r,'balance':balance})
        months.append([month,month_open,receipts,payments,balance])
    known=all(r['cents'] is not None for r in events)
    if known:
        assert balance==opening+sum(r['cents']*(1 if r['direction']=='in' else -1) for r in events)
    return {'id':scenario['id'],'opening':opening,'ledger':ledger,'months':months,'closing':balance,'minimum':lowest if known else None,'gap':max(0,-lowest) if known else None,'first_gap':first_gap if known else 'Unknown','outside':outside}


def answer_lines(p):
    out=[]
    for row in budget(p):out.append('| '+str(row[0])+' | '+' | '.join(money(v) for v in row[1:])+' |')
    base=forecast(p,p['scenarios'][0])
    for row in base['months']:out.append('| '+row[0]+' | '+' | '.join(money(v) for v in row[1:])+' |')
    for s in p['scenarios']:
        f=forecast(p,s)
        out.append('| '+s['id']+' | '+money(f['closing'])+' | '+money(f['minimum'])+' | '+money(f['gap'])+' | '+str(f['first_gap'])+' |')
    return out


def verify_answers(p,text):
    for line in answer_lines(p):assert line in text,f'Incorrect or missing printed answer: {line}'
    assert p['budget']['fullProfit'] is None,'incomplete costs cannot establish full profit'
    assert {r['kind'] for r in p['excluded']}=={'internal-transfer','unapproved-application','invoice'}
    assert not {r['id'] for r in p['events']}&{r['id'] for r in p['excluded']}
    b=budget(p)[-1]
    operating_out=sum(r['cents'] for r in p['events'] if r['category']=='current-input')
    operating_in=sum(r['cents'] for r in p['events'] if r['category']=='current-sale')
    assert b[5]==operating_out and b[1]==operating_in,'budget and base cash sources no longer reconcile'
    # These independent totals make omissions in the source pack visible too.
    assert b[1:]==[110000,40000,12000,9000,61000,25000,24000]
    base=forecast(p,p['scenarios'][0])
    assert [r[-1] for r in base['months']]==[38000,64000,43000]
    outside=forecast(p,next(s for s in p['scenarios'] if s['id']=='OUTSIDE'))
    assert [(r['id'],r['date']) for r in outside['outside']]==[('R02','2027-04-20')]
    assert 'R02' not in [r['id'] for r in outside['ledger']]
    assert base['minimum']==-22000 and base['first_gap']=='2027-01-10'
    assert sum(r['cents'] for r in p['events'] if r['direction']=='in')==122000
    assert sum(r['cents'] for r in p['events'] if r['direction']=='out')==109000
    t=p['transfer'];bal=t['openingCents'];low=bal
    for r in sorted(t['events'],key=lambda r:r['date']):
        bal+=r['cents']*(1 if r['direction']=='in' else -1);low=min(low,bal)
    assert f'Independent case: closing {money(bal)}; lowest {money(low)}; gap {money(-low)} before any additional unknown fee.' in text


def main():
    manuscript=(ROOT/'f4-cashflow.md').read_text()
    verify_answers(PACK,manuscript)
    bad=[]
    def reject(name,p=PACK,text=manuscript):
        try:verify_answers(p,text)
        except (AssertionError,ValueError):bad.append(name);return
        raise AssertionError('Check missed deliberate fault: '+name)
    for old,new,name in [
      ('| TOTAL | R1,100.00','| TOTAL | R1,310.00','shared pool counted as income'),
      ('| A | R600.00 | R220.00 | R40.00','| A | R600.00 | R220.00 | R120.00','whole shared bill assigned twice'),
      ('| 2027-02 | R380.00','| 2027-02 | R300.00','opening reset each month'),
      ('| BASE | R430.00 | -R220.00 | R220.00','| BASE | R430.00 | R380.00 | R0.00','month end hides earlier gap'),
      ('| LATE | R430.00 | -R310.00','| LATE | R430.00 | -R220.00','receipt kept on invoice date'),
      ('| OUTSIDE | -R70.00','| OUTSIDE | R430.00','receipt outside horizon included'),
      ('| DEFER | R680.00 | -R220.00','| DEFER | R680.00 | R0.00','later deferral claimed to solve earlier gap'),
      ('| UNKNOWN | Unknown | Unknown','| UNKNOWN | R610.00 | R0.00','unknown quote treated as zero'),
      ('Independent case: closing R20.00','Independent case: closing R60.00','payment sign reversed')]:
        assert old in manuscript
        reject(name,text=manuscript.replace(old,new))
    p=deepcopy(PACK);p['events'].append(deepcopy(p['events'][0]));reject('duplicate source',p)
    p=deepcopy(PACK);p['budget']['fullProfit']=24000;reject('partial surplus called full profit',p)
    p=deepcopy(PACK);p['events'].append({'id':'FAKE','date':'2027-01-15','direction':'in','cents':50000,'category':'grant'});reject('unapproved funding added',p)
    p=deepcopy(PACK);p['events'].append({'id':'MOVE','date':'2027-01-24','direction':'in','cents':5000,'category':'transfer'});reject('internal transfer added to total cash',p)
    print(f'F4 verified: two enterprise budgets, dated ledger, monthly carry-forward, eight scenarios and independent answer. {len(bad)} deliberate faults rejected.')
    print('Base: R430.00 closing; earlier R220.00 unfunded gap. Full profit remains unknown.')

if __name__=='__main__':main()
