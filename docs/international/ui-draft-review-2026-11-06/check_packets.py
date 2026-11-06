# Review-packet content checks only: source binding and inactive AI draft structure.
# A structural pass supplies no fluent approval or runtime language activation.
# Publication adapter preserves the coordinator validation body; output is stdout only.
if not __debug__:
    raise SystemExit('Run without Python optimization so all packet checks execute.')

from pathlib import Path
import copy, datetime, hashlib, json, re, sys

root = Path(sys.argv[1])
expected = sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'packets'
expected_count = int(sys.argv[4]) if len(sys.argv) > 4 else 13
assert expected_count in (13, 26) and mode in ('packets', 'bundle')
receipt_suffix = sys.argv[5] if len(sys.argv) > 5 else ''
assert not receipt_suffix or re.fullmatch(r'[a-z0-9-]{1,40}', receipt_suffix)
raw = (root / 'source.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected
source = json.loads(raw)
assert len(source['messages']) == expected_count
assert len(set(source['locales'])) == len(source['locales'])
for row in source['messages']:
    assert hashlib.sha256(row['english'].encode()).hexdigest() == row['sha256']

def validate(packet, locale):
    assert set(packet) == {'locale', 'sourceSha256', 'reviewStatus', 'runtimeActivation', 'messages'}
    assert packet['locale'] == locale and packet['sourceSha256'] == expected
    assert packet['reviewStatus'] == 'unreviewed-ai-draft' and packet['runtimeActivation'] is False
    assert isinstance(packet['messages'], list) and len(packet['messages']) == expected_count
    for actual, frozen in zip(packet['messages'], source['messages']):
        assert set(actual) == {'key', 'english', 'sha256', 'translation'}
        assert all(actual[k] == frozen[k] for k in ('key', 'english', 'sha256'))
        text = actual['translation']
        assert isinstance(text, str) and text.strip() and text != frozen['english']
        assert not any(ord(c) < 32 or 0x202a <= ord(c) <= 0x202e or 0x2066 <= ord(c) <= 0x2069 for c in text)
        assert sorted(re.findall(r'\{[^{}]+\}|\d+(?:[.,]\d+)?', text)) == sorted(re.findall(r'\{[^{}]+\}|\d+(?:[.,]\d+)?', frozen['english']))
        for literal in ('DEMO', 'CSV', 'UTC'):
            assert text.count(literal) == frozen['english'].count(literal)

def controls(packet):
    cases = []
    def add(name, mutate):
        damaged = copy.deepcopy(packet); mutate(damaged); cases.append((name, damaged))
    add('stale-source', lambda p: p.update(sourceSha256='0'*64))
    add('wrong-locale', lambda p: p.update(locale='wrong'))
    add('false-human-approval', lambda p: p.update(reviewStatus='human-approved'))
    add('runtime-activation', lambda p: p.update(runtimeActivation=True))
    add('missing-row', lambda p: p['messages'].pop())
    add('extra-row', lambda p: p['messages'].append(copy.deepcopy(p['messages'][0])))
    add('row-order', lambda p: p['messages'].reverse())
    add('wrong-key', lambda p: p['messages'][0].update(key='different'))
    add('changed-English', lambda p: p['messages'][0].update(english='Different source'))
    add('changed-message-hash', lambda p: p['messages'][0].update(sha256='0'*64))
    add('blank-translation', lambda p: p['messages'][0].update(translation=' '))
    add('English-as-translation', lambda p: p['messages'][0].update(translation=p['messages'][0]['english']))
    add('invented-token', lambda p: p['messages'][0].update(translation=p['messages'][0]['translation']+' {farm}'))
    for literal in ('DEMO', 'CSV', 'UTC'):
        indices = [i for i, row in enumerate(source['messages']) if literal in row['english']]
        if indices:
            index = indices[0]
            add('missing-'+literal, lambda p, i=index, token=literal: p['messages'][i].update(translation=p['messages'][i]['translation'].replace(token,'')))
        else:
            add('unexpected-'+literal, lambda p, token=literal: p['messages'][0].update(translation=p['messages'][0]['translation']+' '+token))
    add('invented-number', lambda p: p['messages'][0].update(translation=p['messages'][0]['translation']+' 17'))
    add('hidden-direction', lambda p: p['messages'][0].update(translation=p['messages'][0]['translation']+'\u202e'))
    add('nonstring-translation', lambda p: p['messages'][0].update(translation=17))
    add('unknown-private-metadata', lambda p: p.update(privateHandle='private'))
    add('extra-message-field', lambda p: p['messages'][0].update(approved=True))
    add('duplicate-key', lambda p: p['messages'][1].update(key=p['messages'][0]['key']))
    return cases

if mode == 'bundle':
    bundle = json.loads((root / 'drafts.json').read_text())
    assert set(bundle) == {'sourceSha256', 'reviewStatus', 'runtimeActivation', 'packets', 'reviewNotes'}
    assert bundle['sourceSha256'] == expected and bundle['reviewStatus'] == 'unreviewed-ai-draft' and bundle['runtimeActivation'] is False
    assert isinstance(bundle['packets'], list) and len(bundle['packets']) == len(source['locales'])
    packets = bundle['packets']; notes = bundle['reviewNotes']
    files = ['source.json', 'drafts.json', 'status.json']
else:
    packets = [json.loads((root / (locale+'.json')).read_text()) for locale in source['locales']]
    notes = (root / 'review-notes.md').read_text()
    files = ['source.json', *[locale+'.json' for locale in source['locales']], 'review-notes.md', 'status.json']
assert isinstance(notes, str) and len(notes.split()) <= 250
status = json.loads((root / 'status.json').read_text())
assert status.get('workers') == 0 and status.get('workersActive', 0) == 0
checks = []
for locale, packet in zip(source['locales'], packets):
    validate(packet, locale)
    rejected = []
    for name, bad in controls(packet):
        try: validate(bad, locale)
        except (AssertionError, TypeError, KeyError): rejected.append(name)
        else: raise AssertionError('Damaged packet accepted: '+locale+'/'+name)
    checks.append({'locale': locale, 'pairs': expected_count, 'rejectedControls': rejected})
receipt = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceSha256': expected, 'messageCount': expected_count, 'validatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'checks': checks, 'pairs': expected_count*len(packets), 'actualNotesWords': len(notes.split()),
    'scope': 'Exact source/structure/token/literal validation only; not semantic/fluent/human certification or runtime language approval.',
    'files': [{'file': f, 'sha256': hashlib.sha256((root/f).read_bytes()).hexdigest(), 'bytes': (root/f).stat().st_size} for f in files]}
print(json.dumps(receipt, ensure_ascii=False, indent=2))
