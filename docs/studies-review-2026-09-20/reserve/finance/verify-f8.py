"""Reconcile source records and reject answers that confuse sales, cash and forecasts."""
from pathlib import Path
from copy import deepcopy
import json

HERE = Path(__file__).resolve().parent
P = json.loads((HERE / 'f8-practice.json').read_text())


def money(cents):
    return 'Unknown' if cents is None else ('-R' if cents < 0 else 'R') + f'{abs(cents) / 100:.2f}'


def in_period(date, p=P):
    return p['period']['start'] <= date <= p['period']['end']


def cash_rows(opening, events):
    balance = opening
    rows = [{'ref': 'OPEN', 'date': '2027-01-01', 'label': 'Opening cash', 'change': 0, 'cash': balance}]
    for e in sorted(events, key=lambda e: (e['date'], e['ref'])):
        change = e['amount'] if e['direction'] == 'in' else None if e['amount'] is None else -e['amount']
        balance = None if balance is None or change is None else balance + change
        rows.append({**e, 'change': change, 'cash': balance})
    return rows


def plan_summary(plan, p=P, receipt_date=None):
    sale = plan['quantity'] * plan['price']
    date = receipt_date or plan['receiptDate']
    events = [dict(e, direction='out') for e in plan['payments'] if in_period(e['date'], p)]
    if in_period(date, p):
        events.append({'ref': plan['id'] + '-R', 'date': date, 'amount': sale, 'direction': 'in', 'label': 'Assumed buyer payment'})
    rows = cash_rows(p['openingCash'], events)
    return {'sales': sale, 'receipts': sale if in_period(date, p) else 0,
            'payments': sum(e['amount'] for e in plan['payments'] if in_period(e['date'], p)),
            'closing': rows[-1]['cash'], 'minimum': min(r['cash'] for r in rows),
            'gap': max(0, -min(r['cash'] for r in rows)),
            'hoursGap': max(0, plan['ownerHours'] - p['ownerHoursAvailable']), 'rows': rows}


def actual_summary(p=P, missing=False):
    a = p['actual']
    payments = [dict(e, amount=None if missing and e['ref'] == p['missingCase']['ref'] else e['amount'], direction='out') for e in a['payments'] if in_period(e['date'], p)]
    receipts = [dict(e, direction='in') for e in a['receipts'] if in_period(e['date'], p)]
    owner = [dict(e, direction='in') for e in a['contributions'] if in_period(e['date'], p)]
    rows = cash_rows(p['openingCash'], payments + receipts + owner)
    sales = a['quantity'] * a['price']
    paid = sum(e['amount'] for e in receipts)
    return {'sales': sales, 'receipts': paid, 'receivable': sales - paid,
            'owner': sum(e['amount'] for e in owner),
            'payments': None if missing else sum(e['amount'] for e in payments),
            'closing': rows[-1]['cash'], 'minimum': None if missing else min(r['cash'] for r in rows),
            'gap': None if missing else max(0, -min(r['cash'] for r in rows)), 'rows': rows,
            'profit': None}


def variance_bridge(p=P):
    plan, a = p['plans'][0], p['actual']
    start = plan_summary(plan, p)['closing']
    qty = (a['quantity'] - plan['quantity']) * plan['price']
    price = a['quantity'] * (a['price'] - plan['price'])
    actual = actual_summary(p)
    costs = [(q, e) for q, e in zip(plan['payments'], a['payments'])]
    deltas = [
        ('Quantity', qty, '36 kg instead of 40 kg, valued at the planned R12 per kg.'),
        ('Price', price, 'The 36 kg actually sold earned R11 per kg instead of R12.'),
        ('Still owed', -actual['receivable'], 'R96 of the January invoice was unpaid on 31 January. The February receipt is outside this window.'),
        *[(e['label'], -(e['amount'] - q['amount']), 'Actual payment ' + money(e['amount']) + ' compared with planned ' + money(q['amount']) + '.') for q, e in costs],
        ('Owner funds', actual['owner'], 'R20 came from the owner, outside the business cash scope. It is not sales revenue.')]
    frames = [{'title': 'Original closing forecast', 'change': 0, 'cash': start, 'body': 'The original January plan projected R500 closing cash. Keep it as the baseline; do not rewrite it to match the outcome.'}]
    for title, change, body in deltas:
        start += change
        frames.append({'title': title, 'change': change, 'cash': start, 'body': body})
    return frames


def audit(actual, plans, bridge, p=P):
    # Independently sum dated source categories, not the sequential display rows.
    a = p['actual']
    sales = a['quantity'] * a['price']
    received = sum(e['amount'] for e in a['receipts'] if p['period']['start'] <= e['date'] <= p['period']['end'])
    costs = sum(e['amount'] for e in a['payments'] if p['period']['start'] <= e['date'] <= p['period']['end'])
    owner = sum(e['amount'] for e in a['contributions'] if p['period']['start'] <= e['date'] <= p['period']['end'])
    assert actual['sales'] == sales
    assert actual['receipts'] == received
    assert actual['receivable'] == sales - received
    assert actual['payments'] == costs
    assert actual['owner'] == owner
    assert actual['closing'] == p['openingCash'] + received + owner - costs == a['closingCashEvidence']['amount']
    assert actual['profit'] is None
    assert actual['minimum'] == 1000 and actual['gap'] == 0
    for q, result in zip(p['plans'], plans):
        expected_sale = q['quantity'] * q['price']
        assert result['sales'] == expected_sale
        assert result['closing'] == p['openingCash'] + expected_sale - sum(e['amount'] for e in q['payments'])
        assert result['hoursGap'] == max(0, q['ownerHours'] - p['ownerHoursAvailable'])
    assert plans[0]['minimum'] == 2000 and plans[0]['gap'] == 0
    assert plans[1]['minimum'] == -18000 and plans[1]['gap'] == 18000
    assert bridge[0]['cash'] == plans[0]['closing']
    for previous, current in zip(bridge, bridge[1:]):
        assert current['cash'] == previous['cash'] + current['change']
    assert bridge[1]['change'] == (a['quantity'] - p['plans'][0]['quantity']) * p['plans'][0]['price']
    assert bridge[2]['change'] == a['quantity'] * (a['price'] - p['plans'][0]['price'])
    assert sum(r['change'] for r in bridge[1:3]) == sales - plans[0]['sales']
    assert bridge[-1]['cash'] == actual['closing']
    assert p['funding']['approved'] is False and p['funding']['paymentDate'] is None


def main():
    plans = [plan_summary(q) for q in P['plans']]
    actual, bridge = actual_summary(), variance_bridge()
    audit(actual, plans, bridge)
    missing = actual_summary(missing=True)
    assert all(missing[k] is None for k in ('payments', 'closing', 'minimum', 'gap', 'profit'))
    assert missing['sales'] == 39600 and missing['receivable'] == 9600
    delayed = plan_summary(P['plans'][0], receipt_date=P['delayedPlan']['receiptDate'])
    assert delayed['receipts'] == 0 and delayed['closing'] == 2000 and delayed['sales'] == 48000
    q = P['independent']; base, a = q['plan'], q['actual']
    assert q['openingCash'] + base['quantity'] * base['price'] - base['payments'] == 17000
    assert a['quantity'] * a['price'] == 11200
    assert q['openingCash'] + a['receipts'] + a['ownerContribution'] - a['payments'] == 12000
    assert a['quantity'] * a['price'] - a['receipts'] == 2200
    assert (a['quantity'] - base['quantity']) * base['price'] == -3000
    assert a['quantity'] * (a['price'] - base['price']) == -800
    failures = 0
    faults = [('actual', 'sales', 41600), ('actual', 'receipts', 39600), ('actual', 'receivable', 0),
              ('actual', 'payments', 28000), ('actual', 'owner', 0), ('actual', 'closing', 40600),
              ('actual', 'profit', 8600), ('actual', 'minimum', 31000),
              ('planB', 'closing', 60000), ('planB', 'gap', 0), ('planB', 'hoursGap', 0),
              ('planA', 'sales', 40), ('bridge1', 'change', -4400), ('bridge2', 'change', -4000),
              ('bridgeLast', 'cash', 33000)]
    for target, field, wrong in faults:
        aa, pp, bb = deepcopy(actual), deepcopy(plans), deepcopy(bridge)
        obj = {'actual': aa, 'planA': pp[0], 'planB': pp[1], 'bridge1': bb[1], 'bridge2': bb[2], 'bridgeLast': bb[-1]}[target]
        obj[field] = wrong
        try:
            audit(aa, pp, bb)
        except AssertionError:
            failures += 1
        else:
            raise AssertionError(f'Fault escaped: {target}.{field}')
    manuscript = HERE / 'f8-business-plan.md'
    if manuscript.exists():
        text = manuscript.read_text()
        for row in answer_rows():
            assert row in text, f'Missing/incorrect printed answer: {row}'
    print(f'F8: sources, dated cash, bridge, unknown case and independent answers reconcile; {failures} deliberate faults rejected.')


def answer_rows():
    a, b = [plan_summary(q) for q in P['plans']]
    actual = actual_summary()
    return [f"| {label} | " + ' | '.join(money(v[k]) for k in keys) + ' |' for label, v, keys in [
        ('Plan A', a, ('sales','receipts','payments','closing','minimum','gap')),
        ('Plan B', b, ('sales','receipts','payments','closing','minimum','gap')),
        ('Actual A', actual, ('sales','receipts','payments','closing','minimum','gap'))]]


if __name__ == '__main__':
    main()
