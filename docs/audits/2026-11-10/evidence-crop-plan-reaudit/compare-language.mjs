// How much of an isiZulu view of the Production plan is still English, and what kind of text it is.
//
//   node --import ./tests/register-alias.mjs \
//     docs/audits/2026-11-10/evidence-crop-plan-reaudit/compare-language.mjs <english.json> <isizulu.json> [out.json]
//
// Inputs are two measure-page.cjs outputs of the SAME view (same viewport, level, sections and
// site-climate state) in English and isiZulu. The script refuses a pair whose fixtures differ.
//
// A text run that is identical in both languages is "unchanged". Unchanged is not the same as
// "untranslated interface": a number, a unit, a month, a crop name or a bed label is unchanged in
// any language, and sourced farming copy is kept in English on purpose until it is reviewed
// (AGENTS.md §4). So unchanged runs are sorted into categories by the published rules below.
// The sorting is a heuristic, which is why every run of the two categories that matter is listed
// in the output for a reader to check, and why the record quotes counts, not a single percentage.
import fs from 'node:fs';
import { CROPS } from '@/lib/crop-catalog';

const [enPath, zuPath, outPath] = process.argv.slice(2);
if (!enPath || !zuPath) { console.error('usage: compare-language.mjs <english.json> <isizulu.json> [out.json]'); process.exit(2); }
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const zu = JSON.parse(fs.readFileSync(zuPath, 'utf8'));

const same = (k) => JSON.stringify(en.config[k]) === JSON.stringify(zu.config[k]);
const fixtureProblems = ['viewport', 'level', 'sectionsOpened', 'countryHold', 'appTextScale'].filter((k) => !same(k));
if (en.config.siteClimate?.fruitReferenceBarsShown !== zu.config.siteClimate?.fruitReferenceBarsShown) fixtureProblems.push('siteClimate.fruitReferenceBarsShown');
if (en.config.lang !== 'en' || zu.config.lang !== 'zu') fixtureProblems.push('lang');
if (fixtureProblems.length) { console.error('The two files are not the same view: ' + fixtureProblems.join(', ')); process.exit(1); }

const MONTHS = 'jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?';
const UNITS = 'kg|g|m²|m2|m|cm|mm|ha|l|lb|ft²|%|r|x|×|a4|a3|a2';
const figuresOnly = (t) => !/[A-Za-z]/.test(t) || t.toLowerCase().replace(new RegExp(`\\b(${MONTHS})\\b`, 'g'), '').replace(new RegExp(`(^|[\\s\\d(/])(${UNITS})(?=$|[\\s\\d)/.,])`, 'g'), '$1').replace(/[\d\s.,:;·–—\-+*/()%≈~<>↻▸▾|'"’]/g, '') === '';

// Names: catalogue crop names, the sample farm's four mapped plants, bed and plot labels, the app's own names.
const NAMES = new Set([...CROPS.map((c) => c.name), 'Avocado', 'Mango', 'Moringa', 'Num-num', 'ImbewuField', 'Lima', 'Ubhejane Crèche', 'English', 'IsiZulu'].map((s) => s.toLowerCase()));
const isName = (t) => { const s = t.toLowerCase().replace(/\s*[(·].*$/, '').trim(); return NAMES.has(t.toLowerCase()) || (NAMES.has(s) && figuresOnly(t.slice(s.length).replace(/[()·]/g, ' ').replace(/\b(plants?|bed|beds|existing|proposed|reference)\b/gi, ''))) || /^(bed|plot) \d+$/i.test(t); };
const words = (t) => t.split(/\s+/).filter(Boolean).length;

const enSet = new Set(en.textCorpus.map((r) => r.text));
const groups = { translated: [], 'figures, units and dates': [], 'crop, plant, bed and app names': [], 'sentences of 9 or more words': [], 'short labels of 8 words or fewer': [] };
for (const run of zu.textCorpus) {
  const t = run.text;
  const key = !enSet.has(t) ? 'translated'
    : figuresOnly(t) ? 'figures, units and dates'
    : isName(t) ? 'crop, plant, bed and app names'
    : words(t) >= 9 ? 'sentences of 9 or more words' : 'short labels of 8 words or fewer';
  groups[key].push(run);
}
const tally = (rows) => ({ distinctRuns: rows.length, occurrences: rows.reduce((n, r) => n + r.count, 0) });
const summary = Object.fromEntries(Object.entries(groups).map(([k, rows]) => [k, tally(rows)]));
const labels = groups['short labels of 8 words or fewer']; const sentences = groups['sentences of 9 or more words']; const translated = groups.translated;
const result = {
  view: { ...zu.config, lang: 'en vs zu' },
  method: 'Text runs identical in the English and isiZulu captures of the same view, sorted by rule. Heuristic: check the lists.',
  rules: {
    translated: 'the isiZulu run does not occur in the English capture',
    'figures, units and dates': 'only digits, punctuation, units and month names remain',
    'crop, plant, bed and app names': 'a catalogue crop name, one of the sample farm\'s four plants, "Bed n"/"Plot n", or an app name, optionally followed by figures',
    'sentences of 9 or more words': 'guidance, caveats and explanations. Some of this is sourced farming copy that must stay English until reviewed; this script cannot tell which',
    'short labels of 8 words or fewer': 'headings, buttons, field labels and status words, and fragments of them where a label is split across elements: the interface text that could carry an isiZulu draft',
  },
  summary,
  interfaceLabels: {
    translatedRuns: translated.length, unchangedShortLabels: labels.length,
    statement: `${labels.length} distinct short labels or label fragments are unchanged English and ${translated.length} distinct runs are translated (${labels.reduce((n, r) => n + r.count, 0)} and ${translated.reduce((n, r) => n + r.count, 0)} occurrences).`,
  },
  translated: translated.map((r) => r.text),
  unchangedShortLabels: labels.sort((a, b) => b.count - a.count),
  unchangedSentences: sentences.map((r) => r.text),
};
if (outPath) fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log(result.interfaceLabels.statement);
