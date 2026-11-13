import assert from 'node:assert/strict';

// jsPDF embeds entered references as CID text. Decode its real ToUnicode map
// per actual page; a Latin1-only assertion would miss reference attribution.
export function pdfPages(bytes: Uint8Array, normaliseWhitespace = true): string[] {
  const raw = Buffer.from(bytes).toString('latin1'), objects = new Map<string, string>();
  for (const match of raw.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g)) objects.set(match[1], match[2]);
  const fonts = new Map<string, Map<number, string>>();
  for (const resource of raw.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
    const unicode = objects.get(resource[2])?.match(/\/ToUnicode (\d+) 0 R/); if (!unicode) continue;
    const map = new Map<number, string>();
    for (const block of (objects.get(unicode[1]) ?? '').matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const pair of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(pair[1], 16), String.fromCharCode(parseInt(pair[2], 16)));
    fonts.set(resource[1], map);
  }
  return [...objects.values()].filter(object => /\/Type \/Page\b/.test(object)).map(page => {
    const contents = page.match(/\/Contents (\d+) 0 R/); assert.ok(contents);
    const stream = objects.get(contents[1]) ?? '', lines: string[] = [];
    for (const block of stream.matchAll(/BT\b([\s\S]*?)ET\b/g)) {
      const font = block[1].match(/\/(F\d+) [\d.]+ Tf/)?.[1];
      for (const value of block[1].matchAll(/<([0-9a-f]+)>\s*Tj/gi)) {
        const map = font ? fonts.get(font) : undefined; assert.ok(map);
        lines.push((value[1].match(/.{4}/g) ?? []).map(code => { const text = map.get(parseInt(code, 16)); assert.notEqual(text, undefined); return text; }).join(''));
      }
      // Unlike pdfText's ordinary-copy projection, preserve literal spaces in
      // actual PDF text operators. The exact assertion must detect trimming.
      for (const value of block[1].matchAll(/\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|")/g))
        lines.push(value[1].replace(/\\([()\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t'));
    }
    return normaliseWhitespace ? lines.join(' ').replace(/\s+/g, ' ') : lines.join('\n');
  });
}
