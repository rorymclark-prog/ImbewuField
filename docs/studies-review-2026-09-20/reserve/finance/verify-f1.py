"""Reconcile original teaching cards and the independently printed running answers.

This checks cents, evidence links, buyer balances and loan splits. It deliberately
fails on duplicate payments and table drift; it does not calculate missing profit.
"""
import copy
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parent
pack = json.loads((root / 'f1-practice.json').read_text())
text = (root / 'f1-foundations.md').read_text()

def reconcile(data):
    seen, invoices, loans, balances = set(), {}, {}, {}
    cash = data['openingCash']
    receipts = payments = sales = buyer_payments = 0
    for row in data['events']:
        assert row['reference'] not in seen, 'Duplicate source reference'
        seen.add(row['reference'])
        for name in ['cashIn', 'cashOut', 'sale', 'principalReceived', 'principalPaid', 'interestPaid']:
            value = row.get(name, 0)
            assert type(value) is int and value >= 0, 'Use nonnegative whole cents'
        assert not (row['cashIn'] and row['cashOut']), 'Split opposing cash movements'
        receipts += row['cashIn']; payments += row['cashOut']
        cash += row['cashIn'] - row['cashOut']; balances[row['id']] = cash
        if row['kind'] == 'sale':
            sales += row['sale']; buyer_payments += row['cashIn']
            invoices[row['reference']] = row['sale'] - row['cashIn']
        elif row['kind'] == 'buyer-payment':
            assert row['settles'] in invoices, 'Payment must identify an earlier sale'
            invoices[row['settles']] -= row['cashIn']; buyer_payments += row['cashIn']
        elif row['kind'] == 'loan-received':
            assert row['cashIn'] == row['principalReceived']
            loans[row['reference']] = row['principalReceived']
        elif row['kind'] == 'loan-payment':
            assert row['cashOut'] == row['principalPaid'] + row['interestPaid'], 'Loan split must match cash'
            loans[row['loan']] -= row['principalPaid']
        assert all(v >= 0 for v in invoices.values()), 'Payment exceeds sale balance'
        assert all(v >= 0 for v in loans.values()), 'Principal overpayment'
    assert sales == buyer_payments + sum(invoices.values())
    assert data['profit'] is None and data['missingForProfit'], 'Do not invent profit'
    return dict(cashIn=receipts, cashOut=payments, closing=cash, sales=sales,
                buyerPayments=buyer_payments, owed=sum(invoices.values()),
                principal=sum(loans.values()), balances=balances)

result = reconcile(pack)
for card, value in result['balances'].items():
    line = next(line for line in text.splitlines() if line.startswith(f'| {card} |'))
    printed = re.search(r'R([\d,]+)\.(\d\d)\s*\|$', line)
    assert printed, f'No running answer for {card}'
    cents = int(printed[1].replace(',', '')) * 100 + int(printed[2])
    assert cents == value, f'Printed balance differs at {card}'
expected = dict(cashIn=115000, cashOut=77000, closing=138000, sales=47000,
                buyerPayments=35000, owed=12000, principal=40000)
assert {k: result[k] for k in expected} == expected
# A verifier that accepts duplicate evidence or a zero profit would not protect a lesson.
for fault in ['duplicate', 'overpayment', 'invented-profit']:
    bad = copy.deepcopy(pack)
    if fault == 'duplicate': bad['events'].append(copy.deepcopy(bad['events'][6]))
    if fault == 'overpayment': bad['events'][6]['cashIn'] += 1
    if fault == 'invented-profit': bad['profit'] = 0
    try: reconcile(bad)
    except AssertionError: pass
    else: raise AssertionError(f'Failed to detect {fault}')
print('F1 verified: 11 running balances, receipt/payment totals, buyer balances, loan split; 3 deliberate errors rejected.')
