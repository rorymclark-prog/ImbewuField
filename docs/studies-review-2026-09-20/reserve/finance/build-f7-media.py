"""Build a self-contained, source-derived F7 visual aid without generated numbers."""
from pathlib import Path
import base64
import json
import runpy
import subprocess

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
v = runpy.run_path(str(HERE / 'verify-f7.py'))
v['main']()
p = v['P']
events = {e['ref']: e for e in p['events']}
cases = []
for missing in (False, True):
    frames = []
    for row in v['reconcile'](missing=missing):
        e = events.get(row['ref'])
        frame = {**row, 'body': e['evidence'] if e else 'Opening balances belong to this stall. Equity is the residual interest after liabilities; it is not extra cash.',
                 'documentDate': e['documentDate'] if e else p['period']['start']}
        if missing and row['ref'] == 'C01':
            frame['title'] = 'Stop at the missing stock evidence'
            frame['body'] = p['missingCase']['reason']
        if missing and row['ref'] == 'D01':
            frame['body'] += ' The stock evidence is still missing, so the complete period result and position stay unknown.'
        frame['display'] = {k: v['money'](row[k]) for k in (*v['ASSETS'], *v['CHARGES'], 'sales', 'drawings', 'profit', 'assets', 'liabilities', 'equity', 'payable', 'debt')}
        frame['bookStockDisplay'] = v['money'](row.get('bookStockBeforeReview'))
        frames.append(frame)
    cases.append({'id': 'missing' if missing else 'complete', 'label': 'Stock evidence missing' if missing else 'All supplied evidence', 'frames': frames})
final = v['reconcile']()[-1]
receipts, payments = v['audit_final'](final)
m = v['money']
summary = f"<p>Opening {m(p['opening']['cash'])} + receipts {m(receipts)} − payments {m(payments)} = closing {m(final['cash'])}. Cash increased {m(final['cash'] - p['opening']['cash'])}. The {m(p['outsidePeriod'][0]['amount'])} receipt on 5 February stays outside January.</p><p>After all supplied checks, the complete case has a {m(final['profit'])} result before tax, assets {m(final['assets'])}, liabilities {m(final['liabilities'])} and equity {m(final['equity'])}. The missing-stock case cannot establish complete profit or position.</p>"
hero = REPO / 'docs/media/studies-illustrated-release/art/market-community/true-cost.jpg'
html = (HERE / 'f7-results.template.html').read_text().replace('__DATA__', json.dumps(cases)).replace('__SUMMARY__', summary).replace('__HERO__', 'data:image/jpeg;base64,' + base64.b64encode(hero.read_bytes()).decode())
subprocess.run(['node', '--check'], input=html.split('<script>')[1].split('</script>')[0], text=True, check=True)
out = REPO / 'output/html/finance-f7-results.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html)
print(out)
