import { marketAcceptedTarget, checkMarketTeachingExample } from './market-l1-completion-checks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';

const market = COURSE_MODULES.find(module => module.id === 'market-community')!;
const sourceLesson = (id: string) => market.lessons.find(lesson => lesson.id === id)!;

test('Market L1–L2 assessment drafts preserve answer order, false-claim polarity, and exact held anchors', () => {
  const veL1Source = sourceLesson('market-community-l1');
  const veL1 = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === veL1Source.id)!;
  const recordPoint = veL1.keyPoints[0];
  assert.equal(recordPoint.sourceEnglish, 'Record harvest amounts and destinations separately from cash');
  assert.equal(recordPoint.reviewStatus, 'machine-draft');
  assert.equal(recordPoint.tshivendaDraft, marketAcceptedTarget('ve', 'keyPoints[0]'));
  assert.ok(recordPoint.tshivendaDraft.includes('harvest amounts na hune khaṋo ya ya hone'),
    'physical harvest amounts stay English while their destination and separate-from-cash framing are drafted');
  assert.ok(recordPoint.tshivendaDraft.endsWith('cash.'), 'cash remains a separate accounting category');
  assert.equal(resolveLearnerLessonPresentation(veL1Source, 've').content.keyPoints[0], recordPoint.tshivendaDraft);
  const changedRecordSource = {
    ...veL1Source,
    keyPoints: veL1Source.keyPoints.map((point, index) => index === 0 ? `${point} Changed.` : point),
  };
  assert.equal(resolveLearnerLessonPresentation(changedRecordSource, 've').status, 'english-fallback',
    'changing the record/cash source withdraws its paired key point');

  const veGap = veL1.quiz[1];
  assert.deepEqual(veGap.options.map(option => option.sourceEnglish), veL1Source.quiz[1].options,
    'the translated food-gap answer keeps the canonical option order');
  assert.equal(veGap.sourceCorrectIndex, 1);
  assert.equal(veGap.options[1].reviewStatus, 'machine-draft');
  assert.equal(veGap.options[1].tshivendaDraft,
    marketAcceptedTarget('ve', 'quiz[1].options[1]'));
  for (const anchor of ['tshikhala tsha zwiḽiwa', 'zwimela zwi fanelaho vhupo ha henefho', 'tshifhinga tshazwo tsha u kaṋa']) {
    assert.ok(veGap.options[1].tshivendaDraft.includes(anchor), `the correct answer retains ${anchor}`);
  }
  assert.equal(resolveLearnerLessonPresentation(veL1Source, 've').content.quiz[1].correct, 1,
    'localization does not move the keyed answer');

  const taxSource = 'Box schemes avoid tax obligations';
  const taxRows = [
    {
      language: 'st' as const,
      source: sourceLesson('market-community-l2'),
      draft: SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l2')!,
      option: SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l2')!.quiz[1].options[3],
      target: 'Box schemes di qoba tax obligations',
      resolve: (source: typeof market.lessons[number]) => resolveLearnerLessonPresentation(source, 'st'),
    },
    {
      language: 've' as const,
      source: sourceLesson('market-community-l2'),
      draft: TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l2')!,
      option: TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l2')!.quiz[1].options[3],
      target: 'Box schemes dzi iledza tax obligations',
      resolve: (source: typeof market.lessons[number]) => resolveLearnerLessonPresentation(source, 've'),
    },
    {
      language: 'ts' as const,
      source: sourceLesson('market-community-l2'),
      draft: XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l2')!,
      option: XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l2')!.quiz[1].options[3],
      target: 'Box schemes ti papalata tax obligations',
      resolve: (source: typeof market.lessons[number]) => resolveLearnerLessonPresentation(source, 'ts'),
    },
  ];

  for (const row of taxRows) {
    const sourceQuestion = row.source.quiz[1];
    assert.deepEqual(row.draft.quiz[1].options.map(option => option.sourceEnglish), sourceQuestion.options,
      `${row.language}: the false tax claim stays in its original position`);
    assert.equal(row.draft.quiz[1].sourceCorrectIndex, 2);
    assert.equal(row.option.sourceEnglish, taxSource);
    assert.equal(row.option.reviewStatus, 'machine-draft');
    const target = 'sesothoDraft' in row.option ? row.option.sesothoDraft
      : 'tshivendaDraft' in row.option ? row.option.tshivendaDraft : row.option.xitsongaDraft;
    assert.equal(target, row.target);
    assert.ok(target.startsWith('Box schemes ') && target.endsWith(' tax obligations'),
      `${row.language}: the named arrangement and tax obligation remain exact English anchors`);
    const resolvedQuestion = row.resolve(row.source).content.quiz[1];
    assert.equal(resolvedQuestion.correct, 2,
      `${row.language}: the false tax assertion remains a distractor`);
    assert.equal(resolvedQuestion.options[3], row.target,
      `${row.language}: the learner sees the reviewed source-paired false-tax wording`);
  }
  assert.ok(taxRows[0].target.includes('qoba') && taxRows[1].target.includes('iledza') && taxRows[2].target.includes('papalata'),
    'each draft keeps the positive avoid direction instead of preventing, prohibiting, or negating the claim');

  const tsL1Source = sourceLesson('market-community-l1');
  const tsL1 = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === tsL1Source.id)!;
  const soilClaim = tsL1.quiz[1].options[3];
  assert.equal(tsL1.quiz[1].sourceCorrectIndex, 1);
  assert.equal(soilClaim.sourceEnglish, 'The records show a soil fertility problem');
  assert.equal(soilClaim.reviewStatus, 'machine-draft');
  assert.equal(soilClaim.xitsongaDraft, marketAcceptedTarget('ts', 'quiz[1].options[3]'));
  assert.ok(soilClaim.xitsongaDraft.includes('xiphiqo xa soil fertility'),
    'the false soil-diagnosis claim remains explicit while its exact technical anchor stays English');
  assert.equal(resolveLearnerLessonPresentation(tsL1Source, 'ts').content.quiz[1].correct, 1,
    'the false soil-fertility claim remains a distractor');

  const tsL3 = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === 'market-community-l3')!;
  const unchangedAssume = tsL3.quiz[0].options[2];
  assert.equal(unchangedAssume.sourceEnglish, 'Assume sharing automatically improves every seed lot');
  assert.equal(unchangedAssume.reviewStatus, 'hold',
    'the uncertain “Assume” framing stays held rather than weakening it to “think”');
  assert.equal(unchangedAssume.xitsongaDraft, unchangedAssume.sourceEnglish);

  const changedVeGap = {
    ...veL1Source,
    quiz: veL1Source.quiz.map((question, questionIndex) => questionIndex === 1
      ? { ...question, options: question.options.map((option, optionIndex) => optionIndex === 1 ? `${option} changed` : option) }
      : question),
  };
  assert.equal(resolveLearnerLessonPresentation(changedVeGap, 've').status, 'english-fallback',
    'changing the keyed food-gap source removes its paired draft');
  for (const row of taxRows) {
    const changedTaxSource = {
      ...row.source,
      quiz: row.source.quiz.map((question, questionIndex) => questionIndex === 1
        ? { ...question, options: question.options.map((option, optionIndex) => optionIndex === 3 ? `${option} changed` : option) }
        : question),
    };
    assert.equal(row.resolve(changedTaxSource).status, 'english-fallback',
      `${row.language}: changing the false tax-claim source withdraws its paired quiz`);
  }
  const changedSoilSource = {
    ...tsL1Source,
    quiz: tsL1Source.quiz.map((question, questionIndex) => questionIndex === 1
      ? { ...question, options: question.options.map((option, optionIndex) => optionIndex === 3 ? `${option} changed` : option) }
      : question),
  };
  assert.equal(resolveLearnerLessonPresentation(changedSoilSource, 'ts').status, 'english-fallback',
    'changing the diagnostic distractor source withdraws its paired quiz');
});

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
  assert.ok(paragraphs[13].includes('mutengo wa nṱha une na u humbela a u khwaṱhisedzi uri zwi ḓo rengiswa.'), 'higher prices remain explicitly non-guaranteed');
  assert.notEqual(paragraphs[15], sourceParagraphs[15], 'ordinary crop and work-backwards framing is paired as a draft');
  assert.ok(paragraphs[15].includes('zwimela') && paragraphs[15].includes('harvest') && paragraphs[15].includes('Ṱolani nyimele dza u zwala') && paragraphs[15].includes('tshifhinga tsho lavhelelwaho tsha u kaṋa'), 'crop choice and backwards planning keep planting conditions and expected harvest timing');
  checkMarketTeachingExample('ve', paragraphs[12], sourceParagraphs[12]);
  assert.ok(paragraphs[16].includes('Ḓuvha ḽine ḽa shuma bulasini ḽiṅwe ḽi nga kha ḽi sa shumi fhano.'), 'preserve the may-not comparison');
  assert.ok(paragraphs[16].includes('arali mvula, maḓi kana zwimela zwa kundelwa') && paragraphs[16].includes('a backup plan'), 'the backup plan is triggered when rain, water or crops fail');
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
