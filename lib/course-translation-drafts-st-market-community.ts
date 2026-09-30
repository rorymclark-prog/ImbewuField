/** Unreviewed, source-paired Sesotho learner draft for selected Market lesson fields. */
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
  description: machineDraft(
    'Record-keeping, selling surplus and building local food networks.',
    'Ho boloka direkoto, ho rekisa dihlahiswa tse fetang tlhoko le ho aha marang-rang a dijo tsa lehae.',
  ),
  lessons: [
    {
      id: 'market-community-l1',
      infographicAlt: hold(
        'A person holds a pencil over a blank record grid in an open notebook, beside a basket and loose vegetables.',
      ),
      title: machineDraft(
        'Record-Keeping: Knowing What Your Farm Is Actually Producing',
        'Ho Boloka Direkoto: Ho Tseba Hantle Seo Polasi ya Hao e se Hlahisang',
      ),
      // Paragraphs 1–4, 7–8 and 11 are proposed. Ambiguous units and downstream
      // yield, cost, pricing and timing claims stay in English for review.
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
          'Rekoto e boetse e bontsha dikgwedi tseo lelapa le qetellang le reka dijo ka tsona.',
          'Before setting a price, record production, packing and selling costs, including labour and transport.',
          'Here is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.',
          'Review the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale.',
          'Sebelisa rekoto ya hao ho fumana hore na dijo tsa lelapa di a haella neng.',
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
    {
      id: 'market-community-l2',
      infographicAlt: machineDraft(
        'Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.',
        'Mekgwa e meraro ya ho rekisa ho tswa polasing e le nngwe: setala se pela tsela, thomelo ya sehlopha lebenkeleng, le lebokose le yang ka kotloloho lapeng.',
      ),
      title: hold('Selling Surplus: Where to Sell and How to Price'),
      body: machineDraft(
        [
          'Ask what the customer needs: product, quantity, quality, delivery and payment date.',
          'Compare market fees, transport, packing and unsold produce as well as the selling price.',
          'Check the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.',
          'Direct selling can retain more of the sale price, but it also takes time, packing, transport and customer care.',
          'A box scheme supplies a regular selection to agreed customers.',
          'Agree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement.',
          'Start from what you can reliably supply and what customers want.',
          'Check the costs and household food needs before promising regular boxes.',
          'Garden area or customer count alone does not predict income. Try a manageable arrangement and record the results.',
          'If production changes from week to week, avoid promising a fixed delivery you cannot supply.',
          'Offer the surplus you have and agree clear terms with customers.',
          'Describe your growing practices honestly. Check any certification or claim the buyer requires before using a label.',
        ].join('\n\n'),
        [
          'Botsa hore moreki o hloka eng: sehlahiswa, bongata, boleng, ho tliswa le letsatsi la tefo.',
          'Compare market fees, transport, packing and unsold produce as well as the selling price.',
          'Check the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.',
          'Direct selling can retain more of the sale price, but it also takes time, packing, transport and customer care.',
          'Mokgwa wa mabokose o fa bareki ba dumellaneng kgetho ya dihlahiswa kgafetsa.',
          'Agree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement.',
          'Start from what you can reliably supply and what customers want.',
          'Check the costs and household food needs before promising regular boxes.',
          'Garden area or customer count alone does not predict income. Try a manageable arrangement and record the results.',
          'Ha tlhahiso e fetoha beke le beke, qoba ho tshepisa phano e tsitsitseng eo o ke keng wa e fana.',
          'Offer the surplus you have and agree clear terms with customers.',
          'Describe your growing practices honestly. Check any certification or claim the buyer requires before using a label.',
        ].join('\n\n'),
      ),
      keyPoints: [
        hold('Agree product, quantity, quality, delivery and payment'),
        machineDraft(
          'Compare costs and losses as well as selling price',
          'Bapisa ditshenyehelo le ditahlehelo mmoho le theko ya thekiso',
        ),
        hold('Promise regular boxes only when supply and customer terms support them'),
        hold('Check market rules and describe growing practices honestly'),
      ],
      quiz: [
        {
          question: hold('A smallholder has inconsistent weekly production — surplus some weeks, little in others. Which channel suits her best?'),
          options: [
            hold('A formal market stall needing consistent weekly supply'),
            hold('A box scheme needing the same produce weekly'),
            hold('An informal market or neighbour sales with no fixed commitment'),
            hold('A daily-delivery school contract'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold("This is the one channel that doesn't require her to promise a fixed amount every week — she sells what she actually has."),
        },
        {
          question: hold('How can agreed regular orders help a grower plan?'),
          options: [
            hold('Box customers always pay more per kilogram'),
            hold('Box schemes let you charge extra for packaging'),
            hold('Committed subscription income lets you plan production around real demand instead of growing speculatively'),
            hold('Box schemes avoid tax obligations'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('Confirmed orders give information about demand. Their value still depends on reliable supply, payment and the costs of fulfilling them.'),
        },
      ],
    },
    {
      id: 'market-community-l3',
      infographicAlt: machineDraft(
        'Five small planted beds with arrows pointing toward a central crate of produce; a hand trowel and seed jar sit below it.',
        'Dibethe tse hlano tse nyane tse jetsweng, tse nang le metsu e lebang lebokoseng la bohareng le tletseng dihlahiswa; kharafu e nyane ya letsoho le nkgo ya dipeo di behilwe ka tlase.',
      ),
      title: machineDraft(
        'Building Community Food Networks: Strength in Numbers',
        'Ho Aha Marang-rang a Dijo tsa Setjhaba: Matla a Kopanelo',
      ),
      body: hold(
        [
          'Neighbours can share different varieties and the work of saving seed.',
          'Record the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.',
          'Sharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed. Before exchanging seed, check whether the variety is protected and whether permission is needed.',
          'Tool sharing puts expensive equipment within reach of the group.',
          'A water pump or grain mill may be beyond one household’s budget.',
          'Shared use spreads the value across the group and helps each farm do work it could not do alone.',
          'Handle produce gently and keep suitable shade, packaging and storage through delivery.',
          'A nearby buyer may reduce the journey, but losses and selling costs still need measuring.',
          'Compare the money received after fees, transport and spoilage for each option. Do not assume the nearest buyer always gives the best return.',
          'Neighbours can demonstrate useful skills and compare what happened on their own farms.',
          'Record the method, conditions and result so others can judge whether it may suit their land.',
          'Seek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.',
        ].join('\n\n'),
      ),
      keyPoints: [
        hold('Record seed identity, source and quality, and check if permission is needed before sharing'),
        machineDraft(
          'Agree care, booking and repair responsibilities for shared tools',
          'Dumellanang ka boikarabelo ba tlhokomelo, ho behela nako le ho lokisa disebediswa tse arolelwanwang',
        ),
        hold('Measure losses and net returns for each selling route'),
        hold('Combine shared experience with qualified help when needed'),
      ],
      quiz: [
        {
          question: machineDraft(
            'Neighbours want to share saved seed. What helps make the shared seed useful?',
            'Baahelani ba batla ho arolelana dipeo tseo ba di bolokileng. Ke eng e thusang hore peo e arolelwanwang e be molemo?',
          ),
          options: [
            hold('Mix all varieties without labels'),
            hold('Agree seed-quality checks and check whether permission is needed to share the variety'),
            hold('Assume sharing automatically improves every seed lot'),
            hold('Rely only on the size of the group'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('Seed quality depends on crop-specific isolation, selection, labelling, storage and germination checks. Those checks do not establish permission to exchange a protected variety; check the applicable rights before sharing.'),
        },
        {
          question: machineDraft(
            'A grower is comparing a distant market with nearby customers. What should guide the decision?',
            'Molemi o bapisa mmaraka o hole le bareki ba haufi. Ke eng e lokelang ho tataisa qeto?',
          ),
          options: [
            hold('Always choose the highest headline price'),
            hold('Always choose the shortest journey'),
            hold('Compare money received after fees, transport, unsold produce and losses'),
            hold('Assume joining a group removes all costs'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('Distance affects costs, but it is not the only factor. Use actual returns and losses to compare the options.'),
        },
      ],
    },
  ],
};
