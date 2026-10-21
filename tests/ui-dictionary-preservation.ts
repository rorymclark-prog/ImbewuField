import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface DictionaryPacket {
  entries: Array<{ key: string; [field: string]: unknown }>;
  supplementalEntries?: Array<{ key: string; [field: string]: unknown }>;
  notices?: Record<string, Record<string, string>>;
  beforeValues?: Record<string, Record<string, string | null>>;
}

/** Historical object checks need the same bounded UI exception as source-byte checks. */
export function beforeUiDictionary(actual: unknown, locale: string, packet: DictionaryPacket): unknown {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return actual;
  const original = actual;
  actual = beforeControlIconDictionary(actual,locale);
  const expected: Record<string, string> = {};
  for (const entry of [...packet.entries, ...(packet.supplementalEntries ?? [])]) {
    if (typeof entry[locale] === 'string') expected[entry.key] = entry[locale];
  }
  Object.assign(expected, packet.notices?.[locale] ?? {});
  assert.ok(Object.keys(expected).length, `${locale}: a declared dictionary batch cannot be empty`);
  const beforeValues = packet.beforeValues?.[locale];
  assert.ok(beforeValues, `${locale}: exact prior UI values must be recorded`);
  assert.deepEqual(Object.keys(beforeValues).sort(), Object.keys(expected).sort(), `${locale}: record only and every declared change`);
  const dict = actual as Record<string, unknown>;
  // Older snapshots and altered callers must remain visible to the original full-object guard.
  // Project only the complete exact draft layer, never a partial or corrupted approximation.
  if (!Object.entries(expected).every(([key, value]) => Object.hasOwn(dict, key) && dict[key] === value)) return original;
  const before = { ...dict };
  for (const key of Object.keys(expected)) {
    if (beforeValues[key] === null) delete before[key];
    else before[key] = beforeValues[key];
  }
  return before;
}

// Fixed app controls may change presentation without rewriting a calibrated Study dictionary.
// Reverse only the complete exact declared layer; partial/altered layers remain visible to hashes.
interface ControlIconPacket extends DictionaryPacket {
  beforeLines: Record<string, Record<string, Array<{file:string;text:string}>>>;
}
let controlIcons: ControlIconPacket | undefined;
function controlIconPacket(): ControlIconPacket {
  return controlIcons ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/control-icon-drafts.json',import.meta.url),'utf8'));
}
const iconOpening='\n  // Native design controls: unreviewed drafts; control-icon-drafts.json.\n';
const iconClosing='  // End native design controls.\n';
export function beforeControlIconDictionary(actual:unknown,locale:string):unknown {
  if(!actual||typeof actual!=='object'||Array.isArray(actual))return actual;
  const packet=controlIconPacket();
  const entries=packet.entries.filter(row=>typeof row[locale]==='string');
  if(!entries.length)return actual;
  const dict=actual as Record<string,unknown>;
  if(!entries.every(row=>Object.hasOwn(dict,row.key)&&dict[row.key]===row[locale]))return actual;
  const before={...dict};
  for(const row of entries){const value=packet.beforeValues![locale][row.key];if(value===null)delete before[row.key];else before[row.key]=value;}
  return before;
}
export function beforeControlIconTranslations(source:string,locale:string):string {
  const packet=controlIconPacket();
  const entries=packet.entries.filter(row=>typeof row[locale]==='string');
  if(!entries.length)return source;
  const lines=packet.beforeLines[locale];
  const added=entries.filter(row=>!lines[row.key].length);
  const block=iconOpening+added.map(row=>`  ${row.key}: ${JSON.stringify(row[locale])},\n`).join('')+iconClosing;
  const inline=entries.filter(row=>lines[row.key].length);
  if(added.length&&!source.includes(block))return source;
  if(!inline.every(row=>source.split(`  ${row.key}: ${JSON.stringify(row[locale])},\n`).length===2))return source;
  let before=added.length?source.replace(block,'\n'):source;
  for(const row of inline){assert.equal(lines[row.key].length,1,'each replaced control has exactly one recorded source line');before=before.replace(`  ${row.key}: ${JSON.stringify(row[locale])},\n`,lines[row.key][0].text);}
  return before;
}
