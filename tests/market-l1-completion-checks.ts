import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Language = 'st' | 'ts' | 've';
const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/MARKET-L1-ORDINARY-COMPLETION-APPLIED-2026-10-05.json', import.meta.url), 'utf8'));
export const marketCompletionRows = proof.fields as Array<{ language: Language; field: string; sourceEnglish: string; currentTarget: string; repairedTarget: string; changedFromCurrent: boolean }>;
export function marketAcceptedTarget(language: Language, field: string): string {
  const row = marketCompletionRows.find(row => row.language === language && row.field === field);
  assert.ok(row, `${language}/${field}: source-bound applied proof exists`);
  return row.repairedTarget;
}
const digits = (text: string) => text.match(/\d+/g) ?? [];
// 5 October: ordinary teaching-example framing is now localized. The rule is unchanged
// cost/sale roles and units plus an explicit non-market-price disclaimer, not an English-only paragraph.
export function checkMarketTeachingExample(language: Language, text: string, source: string) {
  assert.equal(text, marketAcceptedTarget(language, 'body.paragraphs[12]'));
  assert.deepEqual(digits(text), digits(source), 'The ordered production cost and selling price must not change');
  assert.match(text, /R18.*kilogram.*R15.*kilogram/);
  const disclaimer = { st: /Mohlala ona ke wa ho ruta, eseng theko ya mmaraka/, ts: /xo dyondzisa, a hi nxavo wa makete/, ve: /Tsumbo iyi ndi ya u funza, a si mutengo wa makete/ };
  assert.match(text, disclaimer[language], 'The farmer must see a teaching example rather than a claim about current prices');
  const belowCost = { st: /ha e koahele ditjeo tse boletsweng/, ts: /a wu hakeli ntsengo lowu boxiweke/, ve: /a u swikeli cost yo bulwaho/ };
  assert.match(text, belowCost[language], 'The selling price does not cover the stated cost');
}
export function checkMarketPriceQuestion(language: Language, text: string) {
  assert.equal(text, marketAcceptedTarget(language, 'quiz[0].question'));
  assert.match(text, /R15\/kg.*R18\/kg/, 'Sale is R15/kg, production cost R18/kg; the ordering is deliberate');
  assert.match(text, language === 'st' ? /Mohlaleng ona wa ho ruta/ : language === 'ts' ? /xo dyondzisa/ : /tsumbo iyi ya u funza/, 'The quiz keeps the teaching-example qualifier');
}
export function checkMarketGapQuestion(language: Language, text: string) {
  assert.equal(text, marketAcceptedTarget(language, 'quiz[1].question'));
  assert.match(text, language === 'st' ? /meroho.*haella.*June le July selemo se seng le se seng/ : language === 'ts' ? /matsavu a ma enelanga.*June na July lembe rin’wana ni rin’wana/ : /miroho i sa eḓanaho.*June na July ṅwaha muṅwe na muṅwe/,
    'Insufficient vegetables recur in June and July every year; absence or a single pair of months is narrower');
}
