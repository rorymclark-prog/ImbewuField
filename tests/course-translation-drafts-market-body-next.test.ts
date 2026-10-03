import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';

const market = COURSE_MODULES.find(module => module.id === 'market-community')!;
const sourceLesson = (id: string) => market.lessons.find(lesson => lesson.id === id)!;

test('Tshivenda Market L1 body keeps record examples and sale limits paired to the source', () => {
  const source = sourceLesson('market-community-l1');
  const draft = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === source.id)!;
  const sourceParagraphs = source.body.split('\n\n');
  const paragraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, 17);
  assert.equal(paragraphs[6], 'Musi khalanwaha i tshi fhela, ni songo ḓitika nga zwine na zwi humbula.');
  assert.ok(paragraphs[13].startsWith('Sedzani price, costs na u ṱavha hu tevhelaho.'));
  assert.ok(paragraphs[13].includes('higher asking price is not a guaranteed sale.'));
  assert.ok(paragraphs[15].includes('locally suitable crops and work backwards from the harvest you need.'));
  assert.ok(paragraphs[15].includes('planting conditions and expected time to harvest.'));
  assert.equal(paragraphs[12], sourceParagraphs[12], 'preserve the teaching-example disclaimer and exact R18/R15 comparison');
  assert.ok(paragraphs[16].startsWith('A date that works on another farm may not work here.'), 'preserve the may-not comparison');
  assert.ok(paragraphs[16].endsWith('Engedzani a backup plan when rain, water or crops fail.'), 'preserve the failure-triggered backup condition');
  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.tshivendaDraft);
  const changed = { ...source, body: source.body.replace('A harvest can feed the household', 'A harvest may feed the household') };
  const fallback = resolveLearnerLessonPresentation(changed, 've');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});

test('Xitsonga Market L2 body preserves reliability, conditional commitments and compliance scope', () => {
  const source = sourceLesson('market-community-l2');
  const draft = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === source.id)!;
  const sourceParagraphs = source.body.split('\n\n');
  const paragraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, 12);
  assert.equal(paragraphs[0], 'Vutisa leswaku muxavi u lava yini: product, nhlayo, quality, delivery na siku ra ku hakela.');
  assert.ok(paragraphs[3].includes('can retain more of the sale price'));
  assert.ok(paragraphs[3].includes('swi tlhela swi teka nkarhi, packing, transport na ku khathalela vaxavi'));
  assert.ok(paragraphs[5].includes('what happens when crops are short.'));
  assert.ok(paragraphs[5].includes('Regular orders help planning only when customers and growers can keep the agreement.'));
  assert.ok(paragraphs[6].includes('what you can reliably supply'));
  assert.ok(paragraphs[6].includes('na leswi vaxavi va swi lavaka.'));
  assert.ok(paragraphs[7].includes('swilaveko swa swakudya swa ndyangu before promising regular boxes.'));
  assert.ok(paragraphs[8].startsWith('Garden area or customer count alone does not predict income.'));
  assert.ok(paragraphs[8].includes('Ringeta ndlela leyi u nga kotaka ku yi lawula, kutani u tsala results.'));
  assert.ok(paragraphs[10].startsWith('Offer surplus leyi u nga na yona'));
  assert.ok(paragraphs[10].includes('terms leti nga erivaleni ni vaxavi.'));
  assert.equal(paragraphs[2], 'Kambisisa market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.', 'preserve the existing mixed market-rule caveat');
  // Paragraph 11 was already mixed at base 00abeeb7; preserve that draft and its exact compliance condition.
  for (const index of [4, 9]) assert.equal(paragraphs[index], sourceParagraphs[index], `retain the exact commitment hold at paragraph ${index}`);
  assert.equal(paragraphs[11], 'Hlamusela maendlelo ya wena ya ku byala hi vutshembeki. Check any certification or claim the buyer requires before using a label.', 'leave the existing mixed honesty/compliance paragraph unchanged');
  assert.ok(paragraphs[11].includes('Check any certification or claim the buyer requires before using a label.'), 'buyer-required claim check must still precede using a label');
  const changed = { ...source, body: source.body.replace('what you can reliably supply', 'what you might supply') };
  const fallback = resolveLearnerLessonPresentation(changed, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});

test('Sesotho Market L2 body retains business conditions around localized framing', () => {
  const source = sourceLesson('market-community-l2');
  const draft = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === source.id)!;
  const sourceParagraphs = source.body.split('\n\n');
  const paragraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, 12);
  assert.equal(paragraphs[0], 'Botsa hore moreki o hloka eng: sehlahiswa, bongata, boleng, ho tliswa le letsatsi la tefo.');
  assert.ok(paragraphs[1].startsWith('Bapisa market fees, transport, packing'));
  assert.ok(paragraphs[1].includes('le theko ya thekiso.'));
  assert.ok(paragraphs[2].startsWith('Hlahloba market rules'));
  assert.ok(paragraphs[2].includes('Informal stall ha e bolele ka boyona hore ha ho na rules kapa costs.'));
  assert.ok(paragraphs[3].includes('can retain more of the sale price'));
  // Punctuation is not the rule: contents, price, payment and the crop-shortage condition must all survive.
  assert.ok(paragraphs[5].includes('contents, price, payment'));
  assert.ok(paragraphs[5].includes('what happens when crops are short.'));
  assert.ok(paragraphs[5].includes('Regular orders help planning only when customers and growers can keep the agreement.'));
  assert.ok(paragraphs[6].includes('what you can reliably supply'));
  assert.ok(paragraphs[7].includes('pele o tshepisa regular boxes.'));
  assert.ok(paragraphs[8].startsWith('Garden area or customer count alone does not predict income.'));
  assert.ok(paragraphs[8].includes('Leka mokgwa o ka laolehang mme o ngole diphetho.'));
  assert.ok(paragraphs[11].includes('Hlahloba certification efe kapa efe kapa claim eo moreki a e hlokang pele o sebedisa label.'));
  // These neighbors were already Sesotho/mixed at base 00abeeb7, not English holds.
  assert.equal(paragraphs[9], 'Ha tlhahiso e fetoha beke le beke, qoba ho tshepisa phano e tsitsitseng eo o ke keng wa e fana.', 'preserve the existing conditional warning against an unsupplyable fixed delivery');
  assert.equal(paragraphs[10], 'Fana ka surplus eo o nang le yona, mme le dumellane ka terms tse hlakileng le bareki.', 'preserve the existing actual-surplus and clear-customer-terms wording');
  const changed = { ...source, body: source.body.replace('what you can reliably supply', 'what you may supply') };
  const fallback = resolveLearnerLessonPresentation(changed, 'st');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});
