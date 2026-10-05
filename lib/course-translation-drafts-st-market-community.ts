/** Unreviewed, source-paired Sesotho ordinary-wording drafts for Market L1/L2; technical anchors remain English. */
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
      infographicAlt: { sourceEnglish: "A person holds a pencil over a blank record grid in an open notebook, beside a basket and loose vegetables.", sesothoDraft: "Motho o tshwere pentshele hodima record grid e se nang letho bukeng e bulehileng; haufi le basket le loose vegetables.", reviewStatus: 'machine-draft' },
      title: machineDraft(
        'Record-Keeping: Knowing What Your Farm Is Actually Producing',
        'Ho Boloka Direkoto: Ho Tseba Hantle Seo Polasi ya Hao e se Hlahisang',
      ),
      // Ordinary record questions and food-gap framing are paired; keep the comparative yield/return and numeric price anchors exact so the lesson does not imply an unverified ranking or local market price.
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
          'Ngola kilograms tsa tamati, dozens tsa mahe le bundles tsa morogo, ebe u ngola hore e nngwe le e nngwe e ile hokae.',
          "Sebedisa mokgwa ona o bonolo o tshwanang bakeng sa dijo tse bolokwang lapeng, dihlahiswa tse rekisitsweng, tse fanweng e le mpho, le tse entsweng compost.",
          'O se ke wa itshetleha ka mohopolo qetellong ya sehla.',
          'Sehla se le seng sa direkoto se araba dipotso tse sebetsang.',
          "Ke dijalo dife tse fanang ka best yield per bed? Ke dife tse fanang ka the most return for each hour of work?",
          "Ke dijalo dife tse sebedisang dipeo, metsi le compost tse ngata ho feta seo di se kgutlisang?",
          'Rekoto e boetse e bontsha dikgwedi tseo lelapa le qetellang le reka dijo ka tsona.',
          "Pele o beha theko, rekota ditjeo tsa tlhahiso, ho paka le ho rekisa, ho kenyeletsa mosebetsi le dipalangoang.",
          "Mohlala ona ke wa ho ruta, eseng theko ya mmaraka: ditamati di bitsa R18 ka kilogram ho di hlahisa, empa di rekiswa ka R15 ka kilogram. Theko eo ha e koahele ditjeo tse boletsweng.",
          "Hlahloba theko, ditjeo le ho lema ho latelang. Sheba seo bareki ba tla se reka e le kannete; theko e hodimo eo o e kopang ha e tiise thekiso.",
          'Sebelisa rekoto ya hao ho fumana hore na dijo tsa lelapa di a haella neng.',
          "Khetha dijalo tse loketseng sebaka sa heno, mme o rale o kgutlela morao ho tloha kotulong eo o e hlokang. Hlahloba maemo a ho jala le nako e lebelletsweng ya kotulo.",
          "Letsatsi le sebetsang polasing e nngwe le ka nna la se sebetse mona. Kenyelletsa leano la bobedi haeba pula, metsi kapa dijalo di hloleha.",
        ].join('\n\n'),
      ),
      keyPoints: [
        machineDraft(
          'Record harvest amounts and destinations separately from cash',
          'Rekota bongata ba kotulo le moo e yang teng ka thoko ho tjhelete',
        ),
        machineDraft('Include production and selling costs when assessing a price', "Kenyelletsa ditjeo tsa tlhahiso le thekiso ha o lekola theko."),
        machineDraft('Label worked examples; use your actual costs for decisions', "Tshwaya worked examples; sebedisa ditjeo tsa hao tsa nnete ha o etsa diqeto."),
        machineDraft('Plan for food gaps using local growing conditions and harvest timing', 'Rera bakeng sa dikgeo tsa dijo o sebedisa maemo a ho lema a lehae le nako ya kotulo.'),
      ],
      quiz: [
        {
          question: machineDraft('In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce. What should the farmer review?', "Mohlaleng ona wa ho ruta, ditamati di rekiswa ka R15/kg mme di bitsa R18/kg ho di hlahisa. Ke eng seo molemi a lokelang ho se hlahloba?"),
          options: [
            machineDraft('Keep selling at R15 — short-term loss builds relationships', 'Tswela pele o rekisa ka R15 — tahlehelo ya nako e khutshwane e aga dikamano.'),
            machineDraft('Stop growing tomatoes entirely', 'Emisa ho lema tamati ka ho felletseng.'),
            machineDraft('The selling price, costs and whether another crop would give a better return', "Theko ya thekiso, ditjeo, le hore na sejalo se seng se ka fana ka better return."),
            machineDraft('Apply for a subsidy to cover the gap', "Etsa kopo ya subsidy ho kwahela phapang ya ditjeo."),
          ],
          sourceCorrectIndex: 2,
          rationale: machineDraft('The example price is below the stated cost. Review the gap and customer demand before making the next production decision.', "Theko ya mohlaleng e ka tlase ho ditjeo tse boletsweng. Hlahloba phapang le seo bareki ba se batlang pele o etsa qeto ya tlhahiso e latelang."),
        },
        {
          question: machineDraft("A farmer's records show she's short of vegetables every June and July. What's the useful action here?", "Direkoto tsa molemi di bontsha hore meroho ya hae e a haella ka June le July selemo se seng le se seng. Ke kgato efe e thusang?"),
          options: [
            machineDraft("Buy vegetables at market each June and July", "Reka meroho mmarakeng ka June le July e nngwe le e nngwe."),
            machineDraft("Work backwards from the food gap using suitable local crops and their harvest timing", "Rera o kgutlela morao ho tloha kgaellong ya dijo, o sebedisa dijalo tse loketseng sebaka sa heno le nako ya tsona ya kotulo."),
            machineDraft("Accept her farm can't produce in winter", "Amohela hore polasi ya hae e ke ke ya hlahisa dijalo mariha."),
            machineDraft("The records show a soil fertility problem", "Direkoto di bontsha bothata ba monono wa mobu."),
          ],
          sourceCorrectIndex: 1,
          rationale: machineDraft("Records identify the gap. Crop choice and sowing dates must then match the local climate, water and expected harvest time.", "Direkoto di bontsha kgaello. Kgetho ya dijalo le matsatsi a ho jala di lokela ho dumellana le tlelaemete ya sebaka, metsi le nako e lebelletsweng ya kotulo."),
        },
      ],
    },
    {
      id: 'market-community-l2',
      infographicAlt: machineDraft(
        'Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.',
        'Mekgwa e meraro ya ho rekisa ho tswa polasing e le nngwe: setala se pela tsela, thomelo ya sehlopha lebenkeleng, le lebokose le yang ka kotloloho lapeng.',
      ),
      title: { sourceEnglish: "Selling Surplus: Where to Sell and How to Price", sesothoDraft: "Ho rekisa surplus: moo o ka rekisang le kamoo o ka behang theko.", reviewStatus: 'machine-draft' },
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
          "Botsa hore moreki o hloka eng: sehlahiswa, bongata, boleng, ho tliswa le letsatsi la tefo.",
          "Bapisa ditefello tsa mmaraka, dipalangoang, ho paka le dihlahiswa tse sa rekiswang, hammoho le theko ya thekiso.",
          "Hlahloba melao ya mmaraka le ditlhoko tsa lehae tsa kgwebo le dijo. Setala sa informal ha se bolele ka boyona hore ha ho na melao kapa ditjeo.",
          "Ho rekisa ka kotloloho ho ka retain more of the sale price, empa ho boetse ho hloka nako, packing, transport le customer care.",
          "Mokgwa wa mabokose o fa bareki ba dumellaneng kgetho ya dihlahiswa kgafetsa.",
          "Dumellanang ka box contents, price, payment le se tla etsahala ha crops di haella. Regular orders di thusa ho rera feela ha customers le growers ba ka phethahatsa agreement.",
          "Qala ka seo o ka reliably supply le seo bareki ba se batlang.",
          "Sheba costs le ditlhoko tsa dijo tsa lelapa pele o tshepisa ho fana ka mabokose kgafetsa.",
          "Sebaka sa tshingwana kapa palo ya bareki feela ha e bolele esale pele hore na income e tla ba bokae. Leka mokgwa oo o ka o laolang, mme o ngole diphetho.",
          "Ha tlhahiso e fetoha beke le beke, qoba ho tshepisa phano e tsitsitseng eo o ke keng wa e fana.",
          "Fana ka surplus eo o nang le yona, mme le dumellane ka terms tse hlakileng le bareki.",
          "Hlalosa ditsela tseo o lemang ka tsona ka botshepehi. Pele o sebedisa label, hlahloba certification efe kapa efe kapa claim eo moreki a e hlokang.",
        ].join('\n\n'),
      ),
      keyPoints: [
        machineDraft("Agree product, quantity, quality, delivery and payment", "Dumellanang ka sehlahiswa, bongata, boleng, thomello le tefo."),
        machineDraft(
          'Compare costs and losses as well as selling price',
          'Bapisa ditshenyehelo le ditahlehelo mmoho le theko ya thekiso',
        ),
        machineDraft('Promise regular boxes only when supply and customer terms support them', 'Tshepisa regular boxes feela ha supply le customer terms di di tshehetsa.'),
        machineDraft('Check market rules and describe growing practices honestly', 'Hlahloba market rules mme o hlalose growing practices tsa hao ka botshepehi.'),
      ],
      quiz: [
        {
          question: machineDraft('A smallholder has inconsistent weekly production — surplus some weeks, little in others. Which channel suits her best?', 'Molemi ea nang le polasi e nyenyane o na le tlhahiso e sa tšoaneng beke le beke — ho ba le masalla libekeng tse ling, ’me ho be le ho fokolang libekeng tse ling. Ke channel efe e mo loketseng ka ho fetisisa?'),
          options: [
            machineDraft('A formal market stall needing consistent weekly supply', "Formal market stall e hlokang supply e tsitsitseng beke le beke."),
            machineDraft('A box scheme needing the same produce weekly', 'Box scheme e hlokang produce e tshwanang beke le beke.'),
            machineDraft('An informal market or neighbour sales with no fixed commitment', 'Informal market kapa thekiso ho baahisani ntle le fixed commitment.'),
            machineDraft('A daily-delivery school contract', 'Konteraka ya sekolo e hlokang ho tlisa letsatsi le letsatsi.'),
          ],
          sourceCorrectIndex: 2,
          rationale: machineDraft("This is the one channel that doesn't require her to promise a fixed amount every week — she sells what she actually has.", "Ena ke yona feela channel e sa mo hlokeng ho tshepisa fixed amount beke le beke — o rekisa seo a nang le sona ka nnete."),
        },
        {
          question: machineDraft('How can agreed regular orders help a grower plan?', 'Ditaelo tsa kamehla tseo ho dumellanweng ka tsona di ka thusa molemi jwang ho rera?'),
          options: [
            machineDraft('Box customers always pay more per kilogram', 'Bareki ba box ba dula ba lefa tjhelete e ngata ka kilogram.'),
            machineDraft('Box schemes let you charge extra for packaging', 'Box schemes di dumella hore o lefise tjhelete e eketsehileng bakeng sa ho paka.'),
            machineDraft('Committed subscription income lets you plan production around real demand instead of growing speculatively', 'Committed subscription income e o dumella ho rera production ho potoloha real demand ho e-na le ho lema ka ho hakanya.'),
            machineDraft('Box schemes avoid tax obligations', 'Box schemes di qoba tax obligations'),
          ],
          sourceCorrectIndex: 2,
          rationale: machineDraft('Confirmed orders give information about demand. Their value still depends on reliable supply, payment and the costs of fulfilling them.', 'Ditaelo tse netefaditsweng di fana ka tlhahisoleseding ka demand. Boleng ba tsona bo ntse bo itshetlehile ka reliable supply, payment le costs tsa ho di phethahatsa.'),
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
      body: machineDraft(
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
        [
          'Baahisani ba ka arolelana mefuta e fapaneng ya dijalo le mosebetsi wa ho boloka peo.',
          "Ngola crop, variety, source le collection date. Rera isolation, selection, drying le storage tse loketseng crop e nngwe le e nngwe.",
          "Ho arolelana ha ho bolele hore diversity e tla eketseha kapa quality e ntlafale ka boyona. Hlahloba identity le germination pele o itshetleha ka shared seed. Pele o fapanyetsana peo, hlahloba hore na variety e sireleditswe le hore na permission e a hlokahala.",
          'Ho arolelana lisebelisoa ho etsa hore sehlopha se khone ho sebelisa lisebelisoa tse turang.',
          'Pompo ea metsi kapa leloala la mabele li ka ’na tsa feta chelete eo lelapa le le leng le ka e khonang.',
          'Ho sebelisa lisebelisoa hammoho ho abela sehlopha sohle molemo oa tsona, ’me ho thusa polasi ka ’ngoe ho etsa mosebetsi oo e neng e ke ke ea khona ho o etsa e le ’ngoe.',
          "Tshwara produce ka bonolo mme o boloke moriti o loketseng, packaging le storage nakong yohle ya delivery.",
          'Moreki wa haufi a ka fokotsa leeto, empa losses le selling costs di sa ntse di lokela ho lekanngwa.',
          "Bapisa tjhelete e amohetsweng ka mora fees, transport le spoilage bakeng sa option e nngwe le e nngwe. O se ke wa nka hore nearest buyer ka mehla o fana ka best return.",
          'Baahisani ba ka bontsha bokgoni bo molemo mme ba bapisa se etsahetseng mapolasing a bona.',
          "Ngola method, conditions le result hore ba bang ba kgone ho ahlola hore na e ka tshwanela naha ya bona.",
          "Kopa qualified advice bakeng sa unfamiliar disease kapa technical problems. Shared experience le specialist help di ka sebetsa mmoho.",
        ].join('\n\n'),
      ),
      keyPoints: [
        machineDraft(
          "Record seed identity, source and quality, and check if permission is needed before sharing",
          "Ngola seed identity, source le quality, mme o hlahlobe hore na permission e a hlokahala pele o arolelana.",
        ),
        machineDraft(
          'Agree care, booking and repair responsibilities for shared tools',
          'Dumellanang ka boikarabelo ba tlhokomelo, ho behela nako le ho lokisa disebediswa tse arolelwanwang',
        ),
        machineDraft(
          "Measure losses and net returns for each selling route",
          "Lekanya losses le net returns bakeng sa selling route ka nngwe.",
        ),
        machineDraft(
          "Combine shared experience with qualified help when needed",
          "Kopanya shared experience le qualified help ha ho hlokahala.",
        ),
      ],
      quiz: [
        {
          question: machineDraft(
            'Neighbours want to share saved seed. What helps make the shared seed useful?',
            'Baahelani ba batla ho arolelana dipeo tseo ba di bolokileng. Ke eng e thusang hore peo e arolelwanwang e be molemo?',
          ),
          options: [
            machineDraft(
              "Mix all varieties without labels",
              "Kopanya mefuta yohle ntle le labels.",
            ),
            machineDraft(
              "Agree seed-quality checks and check whether permission is needed to share the variety",
              "Lumellanang ka seed-quality checks, mme le hlahlobe hore na permission e a hlokahala ho arolelana variety.",
            ),
            machineDraft(
              "Assume sharing automatically improves every seed lot",
              "Nka hore sharing e ntlafatsa seed lot e nngwe le e nngwe ka boyona.",
            ),
            machineDraft(
              "Rely only on the size of the group",
              "Itshetlehe feela ka size ya group.",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: machineDraft('Seed quality depends on crop-specific isolation, selection, labelling, storage and germination checks. Those checks do not establish permission to exchange a protected variety; check the applicable rights before sharing.', "Boleng ba peo bo itshetlehile ka crop-specific isolation, selection, labelling, storage le germination checks. Ditshekatsheko tseo ha di netefatse permission ya ho fapanyetsana protected variety; hlahloba applicable rights pele o arolelana."),
        },
        {
          question: machineDraft(
            'A grower is comparing a distant market with nearby customers. What should guide the decision?',
            'Molemi o bapisa mmaraka o hole le bareki ba haufi. Ke eng e lokelang ho tataisa qeto?',
          ),
          options: [
            machineDraft(
              "Always choose the highest headline price",
              "Khetha kamehla headline price e phahameng ka ho fetisisa.",
            ),
            machineDraft(
              "Always choose the shortest journey",
              "Khetha kamehla tsela e kgutshwane ka ho fetisisa.",
            ),
            machineDraft(
              "Compare money received after fees, transport, unsold produce and losses",
              "Bapisa tjhelete e amohetsweng ka mora fees, transport, dihlahiswa tse sa rekiswang le tahlehelo.",
            ),
            machineDraft(
              "Assume joining a group removes all costs",
              "Nka hore ho kena group ho tlosa costs tsohle.",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: machineDraft("Distance affects costs, but it is not the only factor. Use actual returns and losses to compare the options.", "Distance e ama costs, empa ha se yona feela factor. Sebedisa actual returns le losses ho bapisa options."),
        },
      ],
    },
  ],
};
