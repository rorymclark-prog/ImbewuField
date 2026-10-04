"""Inline wrapping for exact-source mixed segments in paired study slides."""

import re
import unicodedata


def layout_mixed_segments(segments, measure, max_width, slide_number):
    """Wrap whole whitespace-delimited words while retaining exact text and colored runs."""
    logical_parts = []
    spans = []
    offset = 0
    for segment in segments:
        status = segment.get('status')
        text = segment.get('text')
        if status not in ('draft', 'english-hold') or not isinstance(text, str):
            raise ValueError('slide %d has an invalid mixed text run' % slide_number)
        logical_parts.append(text)
        spans.append((offset, offset + len(text), status))
        offset += len(text)
    logical_text = ''.join(logical_parts)

    def styled_word(start, end):
        runs = []
        for span_start, span_end, status in spans:
            left, right = max(start, span_start), min(end, span_end)
            if left >= right:
                continue
            text = logical_text[left:right]
            if runs and runs[-1]['status'] == status:
                runs[-1]['text'] += text
                runs[-1]['rawText'] += text
            else:
                runs.append({'status': status, 'text': text, 'rawText': text})
        return runs

    def append_runs(destination, additions):
        for run in additions:
            if destination and destination[-1]['status'] == run['status']:
                destination[-1]['text'] += run['text']
                destination[-1]['rawText'] += run['rawText']
            else:
                destination.append(dict(run))

    def line_width(runs):
        # The renderer draws once per merged color run, so measure those exact draw calls.
        return sum(measure(run['text']) for run in runs)

    lines = []
    line = []
    pending_space = ''
    for match in re.finditer(r'\s+|\S+', logical_text):
        token = match.group(0)
        if token.isspace():
            pending_space += token
            continue

        word_runs = styled_word(match.start(), match.end())
        if not word_runs:
            raise ValueError('slide %d mixed layout lost a word' % slide_number)
        candidate = [dict(run) for run in line]
        word_with_space = [dict(run) for run in word_runs]
        if pending_space and line:
            word_with_space[0]['text'] = ' ' + word_with_space[0]['text']
        word_with_space[0]['rawText'] = pending_space + word_with_space[0]['rawText']
        append_runs(candidate, word_with_space)

        if line and line_width(candidate) > max_width:
            lines.append(line)
            line = []
            word_with_space = [dict(run) for run in word_runs]
            word_with_space[0]['rawText'] = pending_space + word_with_space[0]['rawText']
            candidate = word_with_space

        if line_width(candidate) > max_width:
            raise ValueError('slide %d has a word wider than its paired panel' % slide_number)
        line = candidate
        pending_space = ''

    if pending_space and line:
        line[-1]['rawText'] += pending_space
    if line:
        lines.append(line)

    if ''.join(run['rawText'] for wrapped_line in lines for run in wrapped_line) != logical_text:
        raise ValueError('slide %d mixed layout lost source-ordered target text' % slide_number)
    return lines, logical_text


def body_pitches(lines):
    """Leave clearance under combining under-marks between wrapped body lines."""
    pitches = []
    for index, line in enumerate(lines):
        has_under_mark = any(
            unicodedata.combining(char) == 220
            for char in unicodedata.normalize('NFD', line)
        )
        pitches.append(66 + (12 if index < len(lines) - 1 and has_under_mark else 0))
    return pitches
