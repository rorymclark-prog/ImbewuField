"""Check F3 arithmetic against source cards and detect misleading worked answers.

Exact fractions keep shared bills conserved. The printed facilitator tables are
checked separately so a correct calculation cannot hide a wrong learner answer.
Run directly with Python; no network, packages or private farm records needed.
"""
import copy
from fractions import Fraction as F
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def whole(value, name, positive=False):
    assert type(value) is int and value >= (1 if positive else 0), f'{name}: invalid integer'


def money(value):
    assert value.denominator == 1 if isinstance(value, F) else type(value) is int
    cents = int(value)
    return ('-' if cents < 0 else '') + f'R{abs(cents)//100:,}.{abs(cents)%100:02}'


def split_cost(cents, units):
    whole(cents, 'Shared cost')
    assert units and sum(units.values()) > 0, 'Missing allocation basis'
    for v in units.values(): whole(v, 'Allocation units')
    shares = {k: F(cents*v, sum(units.values())) for k,v in units.items()}
    assert all(v.denominator == 1 for v in shares.values()), 'A cent-rounding policy is required'
    assert sum(shares.values()) == cents, 'Shared bill counted more than once'
    return shares


def allocation(data):
    products = data['products']
    assert len(products) == len(set(products)) == 2
    rows = data['direct'] + data['shared']
    ids = [r['id'] for r in rows]
    assert len(ids) == len(set(ids)), 'Duplicate cost card'
    shares, paid = {}, dict.fromkeys(products, 0)
    for r in data['direct']:
        whole(r['cents'], 'Direct cost')
        assert r['product'] in paid
        shares[r['id']] = {k: r['cents'] if k == r['product'] else 0 for k in products}
    for r in data['shared']:
        assert set(r['units']) == set(products), 'Allocation omits an enterprise'
        shares[r['id']] = split_cost(r['cents'], r['units'])
    for row in shares.values():
        for product in products: paid[product] += row[product]
    assert sum(paid.values()) == sum(r['cents'] for r in rows)
    assert data['familyCashPaid'] == 0, 'Unpaid time must not become cash paid'
    assert set(data['familyHours']) == set(products)
    whole(data['familyComparisonCentsPerHour'], 'Time comparison value', True)
    time = {}
    for k,v in data['familyHours'].items():
        whole(v, 'Family hours'); time[k] = v*data['familyComparisonCentsPerHour']
    view = {k: paid[k]+time[k] for k in products}
    for key in ['carrotMarketableGrams', 'carrotExpectedSoldGrams']: whole(data[key], key, True)
    assert data['carrotExpectedSoldGrams'] <= data['carrotMarketableGrams'], 'Expected sales exceed available produce'
    assert data['fullProfit'] is None and data['exclusions'], 'Incomplete costs cannot establish full profit'
    unit = {
        'A07': paid['carrots']*F(1000,data['carrotMarketableGrams']),
        'A08': view['carrots']*F(1000,data['carrotMarketableGrams']),
        'A09': view['carrots']*F(1000,data['carrotExpectedSoldGrams']),
    }
    return dict(shares=shares,paid=paid,time=time,view=view,unit=unit)


def break_even(d):
    for k in ['fixedCents','priceCentsPerUnit','capacityUnits']: whole(d[k], k, True)
    whole(d['expectedSalesUnits'], 'Expected sales')
    assert d['expectedSalesUnits'] <= d['capacityUnits'], 'Sales exceed model capacity'
    if d['variableCentsPerUnit'] is None:
        return dict(contribution=None,units=None,within=None,result=None,status='unknown')
    whole(d['variableCentsPerUnit'], 'Variable cost')
    contribution = d['priceCentsPerUnit']-d['variableCentsPerUnit']
    q = None if contribution <= 0 else (d['fixedCents']+contribution-1)//contribution
    result = d['expectedSalesUnits']*contribution-d['fixedCents']
    if q is not None:
        assert q*contribution >= d['fixedCents'] and (q-1)*contribution < d['fixedCents']
        # Independent expansion catches subtracting fixed cost per unit or ignoring variable cost.
        assert result == d['expectedSalesUnits']*d['priceCentsPerUnit'] - (d['fixedCents']+d['expectedSalesUnits']*d['variableCentsPerUnit'])
    return dict(contribution=contribution,units=q,within=q is not None and q<=d['capacityUnits'],result=result,status='infeasible' if q is None else 'calculated')


def percentages(d):
    cost,price=d['includedCostCents'],d['sellingPriceCents']
    whole(cost,'Included cost',True); whole(price,'Selling price',True)
    difference=price-cost
    return difference,F(100*difference,cost),F(100*difference,price)


def buyers(d):
    assert d['quantityUnit']=='g', 'A crate count is not a measured kg quantity'
    whole(d['quantityGrams'],'Buyer quantity',True)
    whole(d['commonIncurredCents'],'Common cost')
    ids=[r['id'] for r in d['offers']];assert len(set(ids))==len(ids), 'Duplicate offer'
    out={}
    for r in d['offers']:
        for k in ['priceCentsPerKg','deliveryCents','packagingCents','paymentDay']: whole(r[k],k)
        hours=F(r['additionalFamilyHours']);assert hours>=0
        sales=F(d['quantityGrams'],1000)*r['priceCentsPerKg']
        extras=r['deliveryCents']+r['packagingCents']
        after_cash=sales-extras
        after_common=after_cash-d['commonIncurredCents']
        time=hours*d['familyComparisonCentsPerHour']
        out[r['id']]=[sales,extras,after_cash,after_common,time,after_common-time]
    return out


def table(md, heading):
    section=md.split(heading,1)[1].split('\n## ',1)[0]
    return {cells[0]:cells for line in section.splitlines() if line.startswith('| ')
            for cells in [[c.strip() for c in line.strip('|').split('|')]]}


def check_printed(pack,md):
    assert pack['moneyUnit']=='cents' and pack['currency']=='ZAR'
    a=allocation(pack['allocation']); products=pack['allocation']['products']
    rows=table(md,'## A - Worked allocation and cost-per-unit answers')
    answer_rows={**a['shares'],'CASH':a['paid'],'TIME':a['time'],'VIEW':a['view']}
    for key,values in answer_rows.items():
        expected=[money(values[k]) for k in products]+[money(sum(values.values()))]
        assert rows[key][-3:]==expected, f'Printed allocation differs: {key}; expected {expected}'
    for key,value in a['unit'].items(): assert rows[key][1]==money(value),f'Printed denominator result differs: {key}'
    rows=table(md,'## B - Worked break-even and percentage answers')
    base=pack['breakEven'];all_cases=[base,*[{**base,**case} for case in base['cases']]]
    computed={}
    for case in all_cases:
        r=break_even(case);computed[case['id']]=r;row=rows[case['id']]
        expected_contribution='Unknown' if r['contribution'] is None else money(r['contribution'])
        expected_units='Unknown' if r['status']=='unknown' else 'None' if r['units'] is None else str(r['units'])
        expected_within='Unknown' if r['within'] is None else 'Yes' if r['within'] else 'No'
        expected_result='Unknown' if r['result'] is None else money(r['result'])
        assert row[2:4]==[expected_contribution,expected_units],f'Printed break-even differs: {case["id"]}'
        assert row[4].split(';')[0]==expected_within and row[5]==expected_result,f'Printed capacity/result differs: {case["id"]}'
    diff,markup,margin=percentages(pack['markup']);m=pack['markup']
    assert rows['M01'][1:]==[money(m['includedCostCents']),money(m['sellingPriceCents']),money(diff),f'{markup}%',f'{margin}%'], 'Printed markup and margin differ'
    rows=table(md,'## C - Worked buyer comparison'); c=buyers(pack['buyers'])
    for offer in pack['buyers']['offers']:
        assert rows[offer['id']][1:7]==[money(v) for v in c[offer['id']]],'Printed buyer arithmetic differs'
        assert rows[offer['id']][7]==f'Day {offer["paymentDay"]}', 'Printed payment timing differs'
    transfer=pack['transfer'];t=split_cost(transfer['allocation']['poolCents'],transfer['allocation']['hours'])
    assert f"**{money(t['one'])} and {money(t['two'])}**" in md, 'Independent allocation answer differs'
    b=break_even(transfer['breakEven']);assert f"**{b['units']} packs**" in md and f"**{money(b['result'])}**" in md, 'Independent capacity answer differs'
    d,mu,ma=percentages(transfer['markup']);assert f'**{money(d)} difference, {mu}% markup and {ma}% margin**' in md, 'Independent percentages differ'
    buyer=transfer['buyers'];assert buyer['extraDeliveryCents'] is None, 'Missing charge became zero'
    tie=F(buyer['quantityGrams'],1000)*(buyer['deliveryCentsPerKg']-buyer['collectionCentsPerKg'])
    assert f'**{money(tie)} delivery cost**' in md, 'Independent buyer threshold differs'
    return dict(allocation=a,breakEven=computed,buyers=c)


def reject(label,action,reason):
    try: action()
    except AssertionError as e:
        assert reason in str(e),f'{label} failed for a different reason: {e}'
        return
    raise AssertionError(f'Missed deliberate fault: {label}')


def main():
    pack=json.loads((ROOT/'f3-practice.json').read_text());md=(ROOT/'f3-costing.md').read_text()
    result=check_printed(pack,md)
    edits=[
        ('double allocation','R40.00 | R80.00 | R120.00','R120.00 | R120.00 | R240.00','Printed allocation'),
        ('wrong denominator','| A09 | R10.00 |','| A09 | R8.00 |','Printed denominator'),
        ('rounded down','R4.50 | 24 | Yes |','R4.50 | 23 | Yes |','Printed break-even'),
        ('capacity ignored','R4.50 | 24 | No |','R4.50 | 24 | Yes |','Printed capacity'),
        ('infeasible as zero','R0.00 | None | No |','R0.00 | 0 | Yes |','Printed break-even'),
        ('unknown as free','| B06 | Variable cost missing | Unknown','| B06 | Variable cost missing | R12.00','Printed break-even'),
        ('margin equals markup','R2.00 | 25% | 20%','R2.00 | 25% | 25%','Printed markup'),
        ('ignore delivery','R240.00 | R45.00 | R195.00','R240.00 | R45.00 | R240.00','Printed buyer'),
        ('late payment as today','R17.50 | Day 7','R17.50 | Day 0','Printed payment'),
    ]
    for label,old,new,reason in edits:
        assert old in md,label
        reject(label,lambda:check_printed(pack,md.replace(old,new)),reason)
    bad=copy.deepcopy(pack);bad['allocation']['direct'].append(bad['allocation']['direct'][0])
    reject('duplicate card',lambda:check_printed(bad,md),'Duplicate cost card')
    bad=copy.deepcopy(pack);bad['allocation']['shared'][0]['units']={'carrots':0,'second-crop':0}
    reject('no basis',lambda:check_printed(bad,md),'Missing allocation basis')
    bad=copy.deepcopy(pack);bad['allocation']['familyCashPaid']=10000
    reject('invented payment',lambda:check_printed(bad,md),'Unpaid time')
    bad=copy.deepcopy(pack);bad['allocation']['fullProfit']=0
    reject('invented profit',lambda:check_printed(bad,md),'Incomplete costs')
    bad=copy.deepcopy(pack);bad['buyers']['quantityUnit']='crates'
    reject('unmeasured crates',lambda:check_printed(bad,md),'crate count')
    bad=copy.deepcopy(pack);bad['transfer']['buyers']['extraDeliveryCents']=0
    reject('missing delivery as zero',lambda:check_printed(bad,md),'Missing charge')
    print('F3 verified: cost allocation, units, six break-even cases, percentages, buyer terms and independent answers.')
    print(f"Assigned cash {money(sum(result['allocation']['paid'].values()))}; with separate time comparison {money(sum(result['allocation']['view'].values()))}.")
    print('15 deliberate faults rejected; full profit remains unknown. No real farm records used.')


if __name__=='__main__': main()
