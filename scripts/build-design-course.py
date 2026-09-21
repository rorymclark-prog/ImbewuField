#!/usr/bin/env python3
"""Preserve the reviewed design manuscripts in the reading preview, including limitations."""
from pathlib import Path
import hashlib
import json
import re
import sys

root = Path(__file__).resolve().parent.parent
base = root / 'docs/studies-review-2026-09-20/reserve/design'
files = ['d1-people-and-place.md', 'd2-patterns-and-constraints.md', 'd3-connections-and-options.md', 'd4-develop-and-check.md', 'd5-work-and-care.md', 'd6-review-and-revise.md']
outputs = ['An agreed brief, evidence notes and an existing-features map.', 'Analysis overlays and design questions with their missing checks.', 'Connections, alternative concepts and a reasoned choice.', 'A checked layout, connected systems and a readable plan set.', 'A feasible sequence, cost record and agreed care plan.', 'An explained design, monitoring approach and justified revision.']
guides = [['getting-started', 'mapping', 'evidence'], ['mapping', 'design', 'crop-planning'], ['design', 'evidence'], ['mapping', 'design', 'exports'], ['expenses', 'crop-planning'], ['evidence', 'design', 'exports']]
required = ['Question to show', 'Teaching text', 'Worked example', 'Learner task', 'Check', 'Evidence for feedback']
units = []
for number, filename in enumerate(files, 1):
    path = base / filename
    manuscript = path.read_text()
    headings = list(re.finditer(r'^## (D\d\.\d) — (.+)$', manuscript, re.M))
    assert len(headings) == 3, f'{filename}: unexpected lesson structure'
    lessons = []
    for index, heading in enumerate(headings):
        assert heading[1] == f'D{number}.{index + 1}', 'Lesson order or identity changed'
        body = manuscript[heading.end():headings[index + 1].start() if index + 1 < len(headings) else len(manuscript)].strip()
        labels = list(re.finditer(r'^\*\*([^*]+)\.\*\*\s*', body, re.M))
        assert labels and labels[0].start() == 0, f'{heading[1]}: unparsed text before first section'
        sections = []
        for j, label in enumerate(labels):
            content = body[label.end():labels[j + 1].start() if j + 1 < len(labels) else len(body)].strip()
            assert content, f'{heading[1]}: empty section {label[1]}'
            sections.append({'title': label[1], 'text': content})
        titles = [section['title'] for section in sections]
        assert len(titles) == len(set(titles)), f'{heading[1]}: duplicate section'
        assert all(title in titles for title in required), f'{heading[1]}: missing teaching or practice'
        assert all(title in required or title.startswith('App companion') for title in titles), f'{heading[1]}: unknown section needs display review'
        check = next(section['text'] for section in sections if section['title'] == 'Check')
        assert '**Answer:**' in check and '**Reason:**' in check, f'{heading[1]}: check loses corrective explanation'
        lessons.append({'id': heading[1].lower().replace('.', '-'), 'code': heading[1], 'title': heading[2], 'sections': sections})
    units.append({'id': f'd{number}', 'number': number, 'title': manuscript.splitlines()[0].split(' — ', 1)[1], 'output': outputs[number - 1], 'guides': guides[number - 1], 'context': manuscript[manuscript.index('\n') + 1:headings[0].start()].strip(), 'sourceFile': str(path.relative_to(root)), 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'lessons': lessons})
casepath = base / 'CASEBOOK.md'
case = casepath.read_text()
sources = base / 'SOURCES.md'
links = [{'label': label, 'url': url} for label, url in re.findall(r'\[([^\]]+)\]\((https://[^)]+)\)', sources.read_text())]
payload = {'status': 'teaching-preview', 'units': units, 'case': {'text': case, 'sourceFile': str(casepath.relative_to(root)), 'sourceSha256': hashlib.sha256(casepath.read_bytes()).hexdigest()}, 'sources': links, 'sourceReviewSha256': hashlib.sha256(sources.read_bytes()).hexdigest()}
serialized = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
target = root / 'lib/course-design-content.json'
if '--check' in sys.argv:
    assert target.read_text() == serialized, 'Design preview differs from source manuscripts; regenerate deliberately'
else:
    target.write_text(serialized)
print(json.dumps({'stages': len(units), 'lessons': sum(len(unit['lessons']) for unit in units)}))
