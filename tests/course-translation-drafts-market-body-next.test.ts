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
  assert.ok(paragraphs[13].startsWith('Sedzani mutengo, costs na u ṱavha hu tevhelaho.'));
  assert.ok(paragraphs[13].includes('mutengo wa nṱha une na u humbela a u fulufhedzisi uri hu ḓo rengiswa.'), 'higher prices remain explicitly non-guaranteed');
  assert.notEqual(paragraphs[15], sourceParagraphs[15], 'ordinary crop and work-backwards framing is paired as a draft');
  assert.ok(paragraphs[15].includes('crops') && paragraphs[15].includes('harvest') && paragraphs[15].includes('Ṱolani nyimele dza u zwala') && paragraphs[15].includes('tshifhinga tsho lavhelelwaho tsha u kaṋa'), 'crop choice and backwards planning keep planting conditions and expected harvest timing');
  assert.equal(paragraphs[12], sourceParagraphs[12], 'preserve the teaching-example disclaimer and exact R18/R15 comparison');
  assert.ok(paragraphs[16].startsWith('A date that works on another farm may not work here.'), 'preserve the may-not comparison');
  assert.ok(paragraphs[16].includes('musi mvula, maḓi kana zwimela zwi tshi kundelwa'), 'the backup plan is triggered when rain, water or crops fail');
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
  assert.ok(paragraphs[5].includes('crops are short'), 'the crop-shortage condition remains source paired');
  assert.ok(paragraphs[5].includes('only when customers and growers can keep the agreement.'), 'regular-order planning stays conditional on both parties keeping the agreement');
  assert.ok(paragraphs[6].includes('what you can reliably supply'));
  assert.ok(paragraphs[6].includes('na leswi vaxavi va swi lavaka.'));
  assert.ok(paragraphs[7].includes('swilaveko swa swakudya swa ndyangu') && paragraphs[7].includes('u nga se') && paragraphs[7].includes('regular boxes'), 'check household food needs before a regular-box promise');
  assert.ok(paragraphs[8].includes('nhlayo ya vaxavi ntsena') && paragraphs[8].includes('a swi vhumbi mali leyi nghenaka'), 'area or customer count alone cannot predict income');
  assert.ok(paragraphs[8].includes('Ringeta') && paragraphs[8].includes('results'), 'the grower is still advised to try a manageable arrangement and record its results');
  assert.ok(paragraphs[10].startsWith('Offer surplus leyi u nga na yona'));
  assert.ok(paragraphs[10].includes('terms leti nga erivaleni ni vaxavi.'));
  assert.notEqual(paragraphs[2], sourceParagraphs[2], 'ordinary market-rule framing is now a paired draft');
  assert.ok(paragraphs[2].includes('milawu ya makete') && paragraphs[2].includes('local trading and food requirements') && paragraphs[2].includes('a ku na milawu kumbe costs'), 'the informal-trade caveat remains explicit');
  // Paragraph 11 was already mixed at base 00abeeb7; preserve that draft and its exact compliance condition.
  assert.ok(paragraphs[4].includes('regular') && paragraphs[4].includes('vaxavi'), 'box schemes are described as serving customers who agreed to them');
  assert.ok(paragraphs[9].includes('fixed delivery') && paragraphs[9].includes('u nga ta ka u nga swi koti ku yi nyika'), 'variable production does not become a promise the grower cannot meet');
  assert.ok(paragraphs[11].startsWith('Hlamusela') && paragraphs[11].includes('certification') && paragraphs[11].includes('label'), 'honest practice descriptions still require checking buyer claims before labeling');
  assert.ok(paragraphs[11].includes('Loko u nga se tirhisa label') && paragraphs[11].includes('any certification or claim the buyer requires'), 'buyer-required claims are checked before a label is used');
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
  assert.ok(paragraphs[1].includes('ditefello tsa mmaraka') && paragraphs[1].includes('dipalangoang') && paragraphs[1].includes('ho paka') && paragraphs[1].includes('dihlahiswa tse sa rekiswang') && paragraphs[1].includes('theko ya thekiso'), 'compare market fees, transport, packing and unsold produce alongside sale price');
  assert.ok(paragraphs[1].includes('theko ya thekiso'), 'selling price remains part of the comparison');
  assert.notEqual(paragraphs[2], sourceParagraphs[2], 'ordinary market-rule wording is paired as a draft');
  assert.ok(paragraphs[2].toLowerCase().includes('informal') && paragraphs[2].includes('ha ho na melao kapa ditjeo'), 'an informal stall is not treated as having no rules or costs');
  assert.ok(paragraphs[3].includes('can retain more of the sale price'));
  // Punctuation is not the rule: contents, price, payment and the crop-shortage condition must all survive.
  assert.ok(paragraphs[5].includes('contents, price, payment'));
  assert.ok(paragraphs[5].includes('what happens when crops are short.'));
  assert.ok(paragraphs[5].includes('Regular orders help planning only when customers and growers can keep the agreement.'));
  assert.ok(paragraphs[6].includes('what you can reliably supply'));
  assert.ok(paragraphs[7].includes('ditlhoko tsa dijo tsa lelapa') && paragraphs[7].includes('pele o tshepisa') && paragraphs[7].includes('kgafetsa'), 'household food needs come before a recurring-box promise');
  assert.ok(paragraphs[8].startsWith('Garden area or customer count alone does not predict income.'));
  assert.ok(paragraphs[8].includes('Leka mokgwa o ka laolehang mme o ngole diphetho.'));
  assert.ok(paragraphs[11].includes('Pele o sebedisa label') && paragraphs[11].includes('certification efe kapa efe kapa claim'), 'the buyer requirement is checked before using a label');
  // These neighbors were already Sesotho/mixed at base 00abeeb7, not English holds.
  assert.equal(paragraphs[9], 'Ha tlhahiso e fetoha beke le beke, qoba ho tshepisa phano e tsitsitseng eo o ke keng wa e fana.', 'preserve the existing conditional warning against an unsupplyable fixed delivery');
  assert.equal(paragraphs[10], 'Fana ka surplus eo o nang le yona, mme le dumellane ka terms tse hlakileng le bareki.', 'preserve the existing actual-surplus and clear-customer-terms wording');
  const changed = { ...source, body: source.body.replace('what you can reliably supply', 'what you may supply') };
  const fallback = resolveLearnerLessonPresentation(changed, 'st');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});
