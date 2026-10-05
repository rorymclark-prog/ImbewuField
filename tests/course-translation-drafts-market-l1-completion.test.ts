import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT as st } from '../lib/course-translation-drafts-st-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT as ts } from '../lib/course-translation-drafts-ts-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT as ve } from '../lib/course-translation-drafts-ve-market-community.ts';

type Pair = { sourceEnglish: string; reviewStatus: string; [key: string]: unknown };
const accepted = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/MARKET-L1-ORDINARY-COMPLETION-ACCEPTED-2026-10-05.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/MARKET-L1-ORDINARY-COMPLETION-BASELINE-2026-10-05.json', import.meta.url), 'utf8'));
const entries = [{ code: 'st', key: 'sesothoDraft', module: st }, { code: 'ts', key: 'xitsongaDraft', module: ts }, { code: 've', key: 'tshivendaDraft', module: ve }];
const canonical = COURSE_MODULES.find(module => module.id === 'market-community')!;
const source = canonical.lessons[0];
const target = (value: unknown, key: string) => String((value as Pair)[key]);
const numbers = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];

test('Market completion keeps exact sources, 17 ordered paragraphs, quiz indices and every checked target unreviewed', () => {
  assert.deepEqual(canonical, baseline.canonical, 'Regional completion cannot rewrite the farming lesson authority');
  for (const entry of entries) {
    const lesson = entry.module.lessons[0];
    const getPair = (field: string): Pair => {
      if (field.startsWith('card.')) return entry.module[field.slice(5) as 'title' | 'description'] as unknown as Pair;
      if (field === 'title') return lesson.title as unknown as Pair;
      const kp = field.match(/^keyPoints\[(\d+)\]$/);
      if (kp) return lesson.keyPoints[Number(kp[1])] as unknown as Pair;
      const quiz = field.match(/^quiz\[(\d+)\]\.(question|rationale|options)(?:\[(\d+)\])?$/)!;
      const question = lesson.quiz[Number(quiz[1])];
      return (quiz[2] === 'options' ? question.options[Number(quiz[3])] : question[quiz[2] as 'question' | 'rationale']) as unknown as Pair;
    };
    assert.equal(lesson.body.sourceEnglish, source.body);
    assert.equal(target(lesson.body, entry.key), accepted.appliedBodies[entry.code]);
    assert.equal(target(lesson.body, entry.key).split('\n\n').length, source.body.split('\n\n').length);
    assert.equal(source.body.split('\n\n').length, 17);
    for (const row of accepted.fields.filter((row: { language: string }) => row.language === entry.code)) {
      if (row.field.startsWith('body.')) {
        const index = Number(row.field.match(/\[(\d+)\]/)[1]);
        assert.equal(source.body.split('\n\n')[index], row.sourceEnglish);
        assert.equal(target(lesson.body, entry.key).split('\n\n')[index], row.repairedTarget);
      } else {
        const pair = getPair(row.field);
        assert.equal(pair.sourceEnglish, row.sourceEnglish, `${entry.code} ${row.field}: source drift withdraws this draft`);
        assert.equal(target(pair, entry.key), row.repairedTarget, `${entry.code} ${row.field}: accepted semantic repair`);
        assert.equal(pair.reviewStatus, 'machine-draft', 'A checked candidate is still unreviewed by a fluent speaker');
      }
    }
    assert.deepEqual(lesson.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
    assert.deepEqual(lesson.quiz.map(question => question.sourceCorrectIndex), [2, 1]);
    for (const [index, question] of lesson.quiz.entries()) {
      assert.deepEqual(question.options.map(option => option.sourceEnglish), source.quiz[index].options, 'Distractor order must not change correct-answer meaning');
    }
  }
});

test('Teaching tomato prices preserve cost versus sale and kilograms without claiming a current market price', () => {
  for (const entry of entries) {
    const lesson = entry.module.lessons[0];
    const example = target(lesson.body, entry.key).split('\n\n')[12];
    const question = target(lesson.quiz[0].question, entry.key);
    assert.deepEqual(numbers(example), ['18', '15'], 'R18 is cost; R15 is sale, in that order in the body');
    assert.deepEqual(numbers(question), ['15', '18'], 'The question states sale then production cost');
    assert.equal((example.match(/kilogram/g) ?? []).length, 2);
    assert.equal((question.match(/\/kg/g) ?? []).length, 2);
    const teaching = entry.code === 'st' ? /Mohlala ona ke wa ho ruta, eseng theko ya mmaraka/ : /Tsumbo iyi ndi ya u funza, a si mutengo wa makete/;
    if (entry.code === 'ts') assert.ok(example.startsWith('Lexi i ' + 'xikombiso xo dyondzisa, a hi nxavo wa makete:'));
    else assert.match(example, teaching, 'The numbers describe a labelled teaching example, not a current market price');
  }
});

test('Harvest quantities stay separate from cash and annual food gaps preserve insufficient vegetables', () => {
  assert.match(ve.lessons[0].keyPoints[0].tshivendaDraft, /harvest amounts na hune khaṋo ya ya hone/);
  assert.match(ve.lessons[0].keyPoints[0].tshivendaDraft, /nga u fhambana na cash/);
  assert.doesNotMatch(ve.lessons[0].keyPoints[0].tshivendaDraft, /masheleni/, 'Physical harvest amounts cannot become monetary amounts');
  assert.match(ve.lessons[0].quiz[1].question.tshivendaDraft, /miroho i sa eḓanaho/);
  assert.match(ve.lessons[0].quiz[1].question.tshivendaDraft, /June na July ṅwaha muṅwe na muṅwe/);
  assert.match(ts.lessons[0].quiz[1].question.xitsongaDraft, /matsavu a ma enelanga/);
  assert.match(ts.lessons[0].quiz[1].question.xitsongaDraft, /June na July lembe rin’wana ni rin’wana/);
  assert.match(st.lessons[0].quiz[1].question.sesothoDraft, /June le July selemo se seng le se seng/);
});

test('Business decisions retain actual purchases, no guaranteed sale and all labour and transport costs', () => {
  const body = ts.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(body[11], /U nga si veka nxavo.*production, packing and selling costs, ku katsa labour ni transport/);
  assert.match(body[13], /vaxavi va nga ta swi xava hakunene/);
  assert.match(body[13], /a wu tiyisisi ku xavisiwa/);
  assert.doesNotMatch(body[13], /leswi vaxavi va swi lavaka|ku ta va ni vaxavi/, 'Demand or presence of customers cannot replace actual purchases or a completed sale');
  for (const entry of entries) {
    const paragraphs = target(entry.module.lessons[0].body, entry.key).split('\n\n');
    assert.match(paragraphs[8], /best yield per bed/);
    assert.match(paragraphs[8], /the most return for each hour of work/);
  }
});

test('Market L2/L3, illustration descriptions and every other registry property retain their prior authority', () => {
  for (const entry of entries) {
    assert.deepEqual(entry.module.lessons.slice(1), baseline.drafts[entry.code].lessons.slice(1), 'Completion is limited to L1; selling rules and food safety instructions remain unchanged');
    assert.deepEqual(entry.module.lessons[0].infographicAlt, baseline.drafts[entry.code].lessons[0].infographicAlt);
    const actual = structuredClone(entry.module) as unknown as Record<string, unknown>;
    const prior = structuredClone(baseline.drafts[entry.code]);
    delete actual.title; delete actual.description; delete prior.title; delete prior.description;
    (actual.lessons as unknown[])[0] = null; prior.lessons[0] = null;
    assert.deepEqual(actual, prior, 'Module identity, source metadata and unreviewed classification are preserved');
  }
});
