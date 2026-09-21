"""Reconcile the original F7 cards and the answer table learners actually receive."""
from copy import deepcopy
from pathlib import Path
import json
import re
from decimal import Decimal

HERE = Path(__file__).resolve().parent
P = json.loads((HERE / 'f7-practice.json').read_text())
ASSETS = ('cash', 'receivable', 'stock', 'equipment', 'prepayment')
CHARGES = ('goodsCost', 'interest', 'transport', 'utilities', 'stockLoss', 'depreciation')


def money(value):
    return 'Unknown' if value is None else ('-' if value < 0 else '') + f'R{abs(value) // 100}.{abs(value) % 100:02d}'


def result(state, opening_equity):
    known = state['stock'] is not None
    profit = state['sales'] - sum(state[k] for k in CHARGES) if known else None
    assets = sum(state[k] for k in ASSETS) if known else None
    liabilities = state['payable'] + state['debt']
    equity = opening_equity + profit - state['drawings'] if known else None
    return {**state, 'profit': profit, 'assets': assets, 'liabilities': liabilities, 'equity': equity}


def reconcile(pack=P, missing=False):
    assert pack['period']['start'] <= pack['period']['end']
    opening = pack['opening']
    assert sum(opening[k] for k in ASSETS) == opening['payable'] + opening['debt'] + opening['equity']
    state = {**opening, 'sales': 0, 'drawings': 0, **{k: 0 for k in CHARGES}}
    rows = [{'ref': 'OPEN', 'date': pack['period']['start'], 'title': 'Start with an opening position', **result(state, opening['equity'])}]
    seen = set()
    previous = pack['period']['start']
    for e in pack['events']:
        assert e['ref'] not in seen, 'Duplicate source card'
        seen.add(e['ref'])
        assert previous <= e['date'] <= pack['period']['end'], 'Wrong period or order'
        previous = e['date']
        # These sentences are printed as worksheet cards: every supplied amount must be visible.
        printed = {int(Decimal(x) * 100) for x in re.findall(r'R(\d+(?:\.\d{2})?)', e['evidence'])}
        for key in ('amount', 'cashPaid', 'cost', 'principal', 'interest', 'closing'):
            if key in e:
                assert e[key] in printed, 'Source amount missing from the learner card: ' + e['ref']
        kind = e['kind']
        amount = e.get('amount', 0)
        for key in ('amount', 'cashPaid', 'cost', 'principal', 'interest', 'closing'):
            if key in e:
                assert type(e[key]) is int and e[key] >= 0, 'Money must be whole, nonnegative cents'
        if kind == 'collection':
            state['cash'] += amount
            state['receivable'] -= amount
        elif kind == 'stock-purchase':
            assert e['cashPaid'] <= amount
            state['cash'] -= e['cashPaid']
            state['stock'] += amount
            state['payable'] += amount - e['cashPaid']
        elif kind == 'credit-sale':
            state['receivable'] += amount
            state['sales'] += amount
            state['stock'] -= e['cost']
            state['goodsCost'] += e['cost']
        elif kind == 'supplier-payment':
            state['cash'] -= amount
            state['payable'] -= amount
        elif kind == 'equipment':
            state['cash'] -= amount
            state['equipment'] += amount
        elif kind == 'borrow':
            state['cash'] += amount
            state['debt'] += amount
        elif kind == 'repayment':
            state['cash'] -= e['principal'] + e['interest']
            state['debt'] -= e['principal']
            state['interest'] += e['interest']
        elif kind == 'draw':
            state['cash'] -= amount
            state['drawings'] += amount
        elif kind == 'accrual':
            state['payable'] += amount
            state['transport'] += amount
        elif kind == 'prepay':
            state['cash'] -= amount
            state['prepayment'] += amount
        elif kind == 'expense':
            state['cash'] -= amount
            state['utilities'] += amount
        elif kind == 'stock-review':
            if missing:
                state['bookStockBeforeReview'] = state['stock']
                state['stock'] = None
                state['stockLoss'] = None
            else:
                assert e['closing'] <= state['stock'], 'This supplied case is a reviewed loss, not a stock gain'
                state['stockLoss'] += state['stock'] - e['closing']
                state['stock'] = e['closing']
        elif kind == 'depreciation':
            state['equipment'] -= amount
            state['depreciation'] += amount
        else:
            raise AssertionError('Unknown transaction kind')
        r = result(state, opening['equity'])
        if r['assets'] is not None:
            assert r['assets'] == r['liabilities'] + r['equity'], 'Position does not reconcile'
        assert all(state[k] >= 0 for k in ('cash', 'receivable', 'payable', 'debt', 'equipment', 'prepayment'))
        rows.append({'ref': e['ref'], 'date': e['date'], 'title': e['title'], **r})
    assert all(e['date'] > pack['period']['end'] for e in pack['outsidePeriod'])
    return rows


def audit_final(r, pack=P, missing=False):
    # Reconcile independently by source category: balancing alone misses a loan classified as revenue.
    e = {e['ref']: e for e in pack['events']}
    o = pack['opening']
    receipts = e['R01']['amount'] + e['R02']['amount'] + e['L01']['amount']
    payments = (e['P01']['cashPaid'] + e['P02']['amount'] + e['E01']['amount'] +
                e['L02']['principal'] + e['L02']['interest'] + e['H01']['amount'] +
                e['F01']['amount'] + e['U01']['amount'])
    expected = {'cash': o['cash'] + receipts - payments,
                'receivable': o['receivable'] + e['S01']['amount'] - e['R01']['amount'] - e['R02']['amount'],
                'stock': None if missing else e['C01']['closing'],
                'equipment': o['equipment'] + e['E01']['amount'] - e['D01']['amount'],
                'prepayment': e['F01']['amount'],
                'payable': o['payable'] + e['P01']['amount'] - e['P01']['cashPaid'] - e['P02']['amount'] + e['A01']['amount'],
                'debt': e['L01']['amount'] - e['L02']['principal'],
                'sales': e['S01']['amount'], 'drawings': e['H01']['amount'],
                'goodsCost': e['S01']['cost'], 'interest': e['L02']['interest'],
                'transport': e['A01']['amount'], 'utilities': e['U01']['amount'],
                'stockLoss': None if missing else o['stock'] + e['P01']['amount'] - e['S01']['cost'] - e['C01']['closing'],
                'depreciation': e['D01']['amount']}
    expected['profit'] = None if missing else expected['sales'] - sum(expected[k] for k in CHARGES)
    expected['assets'] = None if missing else sum(expected[k] for k in ASSETS)
    expected['liabilities'] = expected['payable'] + expected['debt']
    expected['equity'] = None if missing else o['equity'] + expected['profit'] - expected['drawings']
    assert all(r[k] == v for k, v in expected.items()), 'Source-to-statement reconciliation failed'
    if missing:
        assert r['bookStockBeforeReview'] == o['stock'] + e['P01']['amount'] - e['S01']['cost']
    return receipts, payments


def answer_rows():
    rows = []
    for missing in (False, True):
        for r in reconcile(missing=missing):
            if missing and r['ref'] not in ('C01', 'D01'):
                continue
            rows.append('| ' + ' | '.join([('MISSING/' if missing else '') + r['ref']] +
                        [money(r[k]) for k in ('cash', 'profit', 'stock', 'receivable', 'payable', 'debt', 'assets', 'equity')]) + ' |')
    return rows


def independent_rows():
    i = P['independent']
    cash = i['openingCash'] + i['collection']
    owed = i['sale'] - i['collection']
    stock = i['openingStock'] - i['saleCost']
    profit = i['sale'] - i['saleCost']
    position = cash + owed + stock
    return [
        '| FRESH-SALE | ' + ' | '.join(money(x) for x in (cash, owed, stock, profit, position)) + ' |',
        '| FRESH-PREPAY | ' + ' | '.join(money(x) for x in (i['prepayOpeningCash'] - i['prepayment'], i['prepayment'], 0, i['prepayOpeningCash'])) + ' |'
    ]


def check_document():
    body = (HERE / 'f7-results.md').read_text()
    for row in answer_rows() + independent_rows():
        assert row in body, 'Printed answer differs from source cards: ' + row


def main(check_text=True):
    complete, missing = reconcile()[-1], reconcile(missing=True)[-1]
    audit_final(complete)
    audit_final(missing, missing=True)
    rejected = 0
    faults = [('cash', complete['cash'] + 30000), ('cash', complete['cash'] + 90000),
              ('profit', complete['cash'] - P['opening']['cash']), ('sales', complete['sales'] + 60000),
              ('sales', complete['sales'] + 50000), ('drawings', 0), ('interest', 11000),
              ('transport', 0), ('stock', 35000), ('stock', 0), ('equipment', 0),
              ('depreciation', 0), ('prepayment', 0), ('payable', 25000), ('debt', 50000)]
    for key, wrong in faults:
        bad = deepcopy(complete)
        bad[key] = wrong
        try:
            audit_final(bad)
        except AssertionError:
            rejected += 1
        else:
            raise AssertionError('Deliberate fault was not rejected: ' + key)
    for key, wrong in [('profit', 34000), ('stock', 0), ('equity', 0)]:
        bad = deepcopy(missing)
        bad[key] = wrong
        try:
            audit_final(bad, missing=True)
        except AssertionError:
            rejected += 1
        else:
            raise AssertionError('Missing information became a number: ' + key)
    duplicate = deepcopy(P)
    duplicate['events'].insert(1, deepcopy(duplicate['events'][0]))
    try:
        reconcile(duplicate)
    except AssertionError:
        rejected += 1
    else:
        raise AssertionError('Duplicate source was accepted')
    if check_text:
        check_document()
    print(f'F7 verified: 14 in-period events, two evidence cases, independent examples; {rejected} deliberate faults rejected.')


if __name__ == '__main__':
    main()
