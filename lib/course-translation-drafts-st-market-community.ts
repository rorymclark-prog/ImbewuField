/** Unreviewed, source-paired Sesotho learner draft for the first Market lesson. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const machineDraft = (sourceEnglish: string, sesothoDraft: string): SesothoSourcePair => ({
  sourceEnglish,
  sesothoDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): SesothoSourcePair => ({
  sourceEnglish,
  sesothoDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const SESOTHO_MARKET_COMMUNITY_DRAFT: SesothoCourseModuleDraft = {
  id: 'market-community',
  language: 'st',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'business' },
  title: machineDraft('Market Gardening & Community', 'Temo ya Marakeng le Setjhaba'),
  description: hold('Record-keeping, selling surplus and building local food networks.'),
  lessons: [
    {
      id: 'market-community-l1',
      infographicAlt: machineDraft(
        'A simple ruled record sheet with columns for what was harvested and where it went, beside a pile of harvested produce.',
        'Leqephe le bonolo la direkoto le nang le mela le dikholomo tsa se kotutsweng le moo se ileng teng, pela qubu ya dihlahiswa tse kotutsweng.',
      ),
      title: machineDraft(
        'Record-Keeping: Knowing What Your Farm Is Actually Producing',
        'Ho Boloka Direkoto: Ho Tseba Hantle Seo Polasi ya Hao e se Hlahisang',
      ),
      // Paragraphs 1–4 and 7–8 are proposed. Paragraph 5–6 and 9–17 stay in English
      // because the unit wording and downstream yield, finance, and timing claims need review.
      body: machineDraft(
        [
          'A harvest can feed the household, be sold, be shared, or be lost.',
          'Recording these different uses helps you see what the farm produces and what reaches customers.',
          'Use that information to protect household food and make better business decisions.',
          'Write down every harvest as it happens.',
          'Record kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.',
          'Use the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.',
          'Do not rely on memory at the end of the season.',
          'One season of records answers practical questions.',
          'Which crops give the best yield per bed? Which return the most for each hour of work?',
          'Which crops use more seeds, water, and compost than they return?',
          'The record also shows which months leave the household buying food.',
          'Before setting a price, record production, packing and selling costs, including labour and transport.',
          'Here is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.',
          'Review the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale.',
          'Use your record to find when household food runs short.',
          'Choose locally suitable crops and work backwards from the harvest you need. Check planting conditions and expected time to harvest.',
          'A date that works on another farm may not work here. Include a backup plan when rain, water or crops fail.',
        ].join('\n\n'),
        [
          'Kotulo e ka fepa lelapa, ya rekiswa, ya arolelanwa, kapa ya senyeha (ya lahleha).',
          'Ho rekota ditsela tsena tse fapaneng tsa tshebediso ho o thusa ho bona seo polasi e se hlahisang le se fihlang ho bareki.',
          'Sebedisa lesedi leo ho sireletsa dijo tsa lelapa le ho etsa diqeto tse betere tsa kgwebo.',
          "Ngola fatshe kotulo e nngwe le e nngwe hang ha e etsahala.",
          'Record kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.',
          'Use the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.',
          'O se ke wa itshetleha ka mohopolo qetellong ya sehla.',
          'Sehla se le seng sa direkoto se araba dipotso tse sebetsang.',
          'Which crops give the best yield per bed? Which return the most for each hour of work?',
          'Which crops use more seeds, water, and compost than they return?',
          'The record also shows which months leave the household buying food.',
          'Before setting a price, record production, packing and selling costs, including labour and transport.',
          'Here is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.',
          'Review the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale.',
          'Use your record to find when household food runs short.',
          'Choose locally suitable crops and work backwards from the harvest you need. Check planting conditions and expected time to harvest.',
          'A date that works on another farm may not work here. Include a backup plan when rain, water or crops fail.',
        ].join('\n\n'),
      ),
      keyPoints: [
        machineDraft(
          'Record harvest amounts and destinations separately from cash',
          'Rekota bongata ba kotulo le moo e yang teng ka thoko ho tjhelete',
        ),
        hold('Include production and selling costs when assessing a price'),
        hold('Label worked examples; use your actual costs for decisions'),
        hold('Plan for food gaps using local growing conditions and harvest timing'),
      ],
      quiz: [
        {
          question: hold('In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce. What should the farmer review?'),
          options: [
            hold('Keep selling at R15 — short-term loss builds relationships'),
            hold('Stop growing tomatoes entirely'),
            hold('The selling price, costs and whether another crop would give a better return'),
            hold('Apply for a subsidy to cover the gap'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('The example price is below the stated cost. Review the gap and customer demand before making the next production decision.'),
        },
        {
          question: hold("A farmer's records show she's short of vegetables every June and July. What's the useful action here?"),
          options: [
            hold('Buy vegetables at market each June and July'),
            hold('Work backwards from the food gap using suitable local crops and their harvest timing'),
            hold("Accept her farm can't produce in winter"),
            hold('The records show a soil fertility problem'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('Records identify the gap. Crop choice and sowing dates must then match the local climate, water and expected harvest time.'),
        },
      ],
    },
  ],
};
