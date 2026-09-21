"""Check the F2 evidence links and independently printed teaching answers.

A matching combined cash total cannot catch a missing transfer leg or offsetting
errors. Reconcile each account, each buyer and stock separately, then deliberately
break evidence, units, timing and the printed key to show these checks can fail.
"""
import copy
import json
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def nonnegative_integer(value, label):
    assert type(value) is int and value >= 0, f'{label}: whole nonnegative units required'


def unique(rows, field, label):
    values = [row[field] for row in rows]
    assert all(values) and len(values) == len(set(values)), f'{label}: duplicate or empty {field}'


def reconcile(pack):
    assert pack['moneyUnit'] == 'cents' and pack['quantityUnit'] == 'g'
    assert pack['openingBuyerBalances'] == 0, 'This bounded pack starts with no buyer balance'
    assert pack['profit'] is None and pack['missingForProfit'], 'Missing profit is not zero'
    sales_rows = pack['sales']
    unique(sales_rows, 'id', 'Sales')
    sales = {row['id']: row for row in sales_rows}
    owed = {}
    for row in sales_rows:
        assert row['unit'] == 'g', 'Do not add a bunch count to weighed stock'
        nonnegative_integer(row['quantity'], 'Sale quantity')
        nonnegative_integer(row['amount'], 'Sale amount')
        assert row['quantity'] > 0 and row['amount'] > 0
        owed[row['id']] = row['amount']

    stock_rows = pack['stockEvents']
    unique(stock_rows, 'id', 'Stock'); unique(stock_rows, 'reference', 'Stock evidence')
    stock = pack['openingStock']
    nonnegative_integer(stock, 'Opening stock')
    stock_balances, dispatched = {}, set()
    destinations = dict(harvest=0, sale=0, home=0, gift=0, loss=0)
    previous_day = 0
    for row in stock_rows:
        assert row['day'] >= previous_day, 'Stock cards must retain their order'
        previous_day = row['day']
        assert row['unit'] == 'g', 'Stock units must match the measured source'
        nonnegative_integer(row['quantity'], 'Stock quantity')
        assert row['kind'] in destinations and row['quantity'] > 0
        if row['kind'] == 'sale':
            sale_id = row['saleRef']
            assert sale_id in sales and sale_id not in dispatched, 'Delivery counted twice or unlinked'
            sale = sales[sale_id]
            assert row['quantity'] == sale['quantity'], 'Sale and delivery quantities differ'
            assert row['day'] == sale['day'], 'Preserve the delivery date'
            dispatched.add(sale_id)
        else:
            assert 'saleRef' not in row, 'A destination is not an invented sale'
        destinations[row['kind']] += row['quantity']
        stock += row['quantity'] if row['kind'] == 'harvest' else -row['quantity']
        assert stock >= 0, 'Stock leaves before it is available'
        stock_balances[row['id']] = stock
    assert dispatched == set(sales), 'Every sale in this pack has one supplied delivery'
    assert stock == pack['countedClosingStock'], 'Book stock differs from separate count'

    accounts = pack['openingAccounts'].copy()
    assert set(accounts) == {'cash', 'wallet'}
    for value in accounts.values(): nonnegative_integer(value, 'Opening money')
    opening_total = sum(accounts.values())
    money_rows = pack['moneyEvents']
    unique(money_rows, 'id', 'Money'); unique(money_rows, 'reference', 'Money evidence')
    received = paid = transferred = 0
    money_balances = {}
    previous_day = 0
    for row in money_rows:
        assert row['day'] >= previous_day, 'Money cards must retain their order'
        previous_day = row['day']
        amount = row['amount']
        nonnegative_integer(amount, 'Money movement')
        assert amount > 0
        before = sum(accounts.values())
        if row['kind'] == 'customer-payment':
            assert 'from' not in row and row['to'] in accounts, 'Payment must enter from a buyer'
            sale_id = row['saleRef']
            assert sale_id in sales, 'Payment needs an existing sale reference'
            assert row['day'] >= sales[sale_id]['day'], 'No advance payments in this exercise'
            owed[sale_id] -= amount
            assert owed[sale_id] >= 0, 'Payment exceeds this sale balance'
            accounts[row['to']] += amount
            received += amount
        elif row['kind'] == 'expense':
            assert 'to' not in row and 'saleRef' not in row and row['from'] in accounts
            accounts[row['from']] -= amount
            paid += amount
        elif row['kind'] == 'transfer':
            assert 'saleRef' not in row, 'Own-account transfer is not another sale'
            assert row['from'] in accounts and row['to'] in accounts
            assert row['from'] != row['to'], 'A transfer needs two different accounts'
            accounts[row['from']] -= amount
            accounts[row['to']] += amount
            transferred += amount
            assert sum(accounts.values()) == before, 'Internal transfer must conserve combined money'
        else:
            raise AssertionError('Unsupported movement: do not silently classify it')
        assert all(v >= 0 for v in accounts.values()), 'Cash/wallet overspent in the practice pack'
        money_balances[row['id']] = accounts.copy()
    assert accounts == pack['observedClosingAccounts'], 'Reconcile each account to its own evidence'
    sale_total = sum(row['amount'] for row in sales_rows)
    assert sale_total == received + sum(owed.values()), 'Sale/payment/balance identity differs'
    assert sum(accounts.values()) == opening_total + received - paid
    return dict(stock=stock, stockBalances=stock_balances, destinations=destinations,
                accounts=accounts, moneyBalances=money_balances, owed=owed,
                received=received, paid=paid, transferred=transferred, sales=sale_total)


def printed_rows(markdown, section):
    body = markdown.split(section, 1)[1].split('\n## ', 1)[0]
    return [line.strip('|').split('|') for line in body.splitlines() if line.startswith('| ')]


def cents(value):
    value = value.strip()
    assert value.startswith('R'), 'Printed money must retain its currency'
    exact = Decimal(value[1:].replace(',', '')) * 100
    assert exact == exact.to_integral_value(), 'Printed money lost exact cents'
    return int(exact)


def grams(value):
    exact = Decimal(value.strip()) * 1000
    assert exact == exact.to_integral_value(), 'Printed kg cannot add unknown precision'
    return int(exact)


def check_printed(pack, result, markdown):
    stock_rows = printed_rows(markdown, '## Stock cards and worked answers')
    stock_by_id = {row[0].strip(): row for row in stock_rows}
    assert grams(stock_by_id['Opening'][-1]) == pack['openingStock']
    for row in pack['stockEvents']:
        printed = stock_by_id[row['id']]
        assert int(printed[1]) == row['day'] and row['reference'] in printed[2]
        amount_column = 3 if row['kind'] == 'harvest' else 4
        empty_column = 4 if row['kind'] == 'harvest' else 3
        assert grams(printed[amount_column]) == row['quantity'], 'Printed quantity differs'
        assert printed[empty_column].strip() == '—', 'Printed stock movement direction differs'
        assert grams(printed[-1]) == result['stockBalances'][row['id']], 'Printed stock balance differs'

    money_rows = printed_rows(markdown, '## Money cards and worked answers')
    money_by_id = {row[0].strip(): row for row in money_rows}
    for row in [dict(id='Opening'), *pack['moneyEvents']]:
        printed = money_by_id[row['id']]
        expected = pack['openingAccounts'] if row['id'] == 'Opening' else result['moneyBalances'][row['id']]
        assert [cents(v) for v in printed[-3:]] == [expected['cash'], expected['wallet'], sum(expected.values())], 'Printed money balance differs'
        if row['id'] != 'Opening':
            assert int(printed[1]) == row['day'] and row['reference'] in printed[2]

    sale_rows = printed_rows(markdown, '## Sales and buyer balances')
    sale_by_id = {row[0].strip(): row for row in sale_rows}
    for sale in pack['sales']:
        printed = sale_by_id[sale['id']]
        assert int(printed[1]) == sale['day'] and grams(printed[2]) == sale['quantity']
        assert cents(printed[3]) == sale['amount']
        balance = result['owed'][sale['id']]
        assert [cents(v) for v in printed[-2:]] == [sale['amount'] - balance, balance], 'Printed buyer balance differs'
        for payment in pack['moneyEvents']:
            if payment.get('saleRef') == sale['id']:
                assert payment['reference'] in printed[4] and f"Day {payment['day']}" in printed[4], 'Printed payment evidence/date differs'


def expect_failure(name, action, expected):
    try:
        action()
    except AssertionError as error:
        assert expected in str(error), f'{name} failed for the wrong reason: {error}'
        return
    raise AssertionError(f'Failed to detect deliberate fault: {name}')


def main():
    pack = json.loads((ROOT / 'f2-practice.json').read_text())
    markdown = (ROOT / 'f2-records.md').read_text()
    result = reconcile(pack)
    check_printed(pack, result, markdown)
    faults = {
        'duplicate-payment': 'duplicate or empty reference',
        'missing-fee': 'Reconcile each account',
        'missing-harvest': 'Book stock differs',
        'wrong-unit': 'Stock units must match',
        'delivery-mismatch': 'Sale and delivery quantities differ',
        'payment-before-sale': 'No advance payments',
        'overpayment': 'Payment exceeds',
        'transfer-as-sale': 'Payment must enter from a buyer',
        'same-account-transfer': 'two different accounts',
        'invented-profit': 'Missing profit is not zero',
    }
    for fault, expected in faults.items():
        bad = copy.deepcopy(pack)
        if fault == 'duplicate-payment':
            extra = copy.deepcopy(bad['moneyEvents'][5]); extra['id'] = 'M08'
            bad['moneyEvents'].append(extra)
        elif fault == 'missing-fee': del bad['moneyEvents'][4]
        elif fault == 'missing-harvest': del bad['stockEvents'][5]
        elif fault == 'wrong-unit': bad['stockEvents'][5]['unit'] = 'bunches'
        elif fault == 'delivery-mismatch': bad['stockEvents'][3]['quantity'] += 1000
        elif fault == 'payment-before-sale':
            bad['moneyEvents'][5]['day'] = 1
            bad['moneyEvents'].sort(key=lambda row: (row['day'], row['id']))
        elif fault == 'overpayment': bad['moneyEvents'][5]['amount'] = 10001
        elif fault == 'transfer-as-sale': bad['moneyEvents'][2]['kind'] = 'customer-payment'
        elif fault == 'same-account-transfer': bad['moneyEvents'][2]['to'] = 'cash'
        elif fault == 'invented-profit': bad['profit'] = 0
        expect_failure(fault, lambda: reconcile(bad), expected)
    expect_failure('printed-cents', lambda: check_printed(pack, result, markdown.replace('R477.50 | R337.50 | R815.00 |', 'R478.00 | R337.50 | R815.50 |')), 'Printed money balance differs')
    expect_failure('printed-stock', lambda: check_printed(pack, result, markdown.replace('| Q08 | 3 | D03 delivered for S03 | — | 4 | 9 |', '| Q08 | 3 | D03 delivered for S03 | — | 4 | 10 |')), 'Printed stock balance differs')
    print('F2 verified: 8 stock balances, 7 two-account balances, 3 buyer balances; 12 deliberate faults rejected.')
    print('Closing: 9 kg stock; cash R477.50 + wallet R337.50 = R815.00; sales R300.00, received R260.00, owed R40.00; profit unknown.')


if __name__ == '__main__':
    main()
