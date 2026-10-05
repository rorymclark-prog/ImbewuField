/** Unreviewed, source-paired Tshivenda ordinary-wording drafts for Market L1/L2; technical anchors remain English. */
import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

const pair = (sourceEnglish: string, tshivendaDraft: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const TSHIVENDA_MARKET_COMMUNITY_DRAFT: TshivendaCourseModuleDraft = {
  id: 'market-community',
  language: 've',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'business' },
  title: pair('Market Gardening & Community', "U Ṱavha Zwimela U Itela Maraga na Vhadzulapo"),
  description: pair('Record-keeping, selling surplus and building local food networks.', "U vhulunga rekhodo, u rengisa zwo salaho, na u fhaṱa local food networks."),
  lessons: [
    {
      "id": "market-community-l1",
      "infographicAlt": { sourceEnglish: "A person holds a pencil over a blank record grid in an open notebook, beside a basket and loose vegetables.", tshivendaDraft: "Muthu u fara pencil nga nṱha ha record grid i si na tshithu kha notebook yo vuleaho, tsini na basket na loose vegetables.", reviewStatus: 'machine-draft' },
      "title": {
        "sourceEnglish": "Record-Keeping: Knowing What Your Farm Is Actually Producing",
        "tshivendaDraft": "Record-Keeping: U Ḓivha Zwine Bulasi Yaṋu Ya Bveledza Zwa Vhukuma",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "A harvest can feed the household, be sold, be shared, or be lost.\n\nRecording these different uses helps you see what the farm produces and what reaches customers.\n\nUse that information to protect household food and make better business decisions.\n\nWrite down every harvest as it happens.\n\nRecord kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.\n\nUse the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.\n\nDo not rely on memory at the end of the season.\n\nOne season of records answers practical questions.\n\nWhich crops give the best yield per bed? Which return the most for each hour of work?\n\nWhich crops use more seeds, water, and compost than they return?\n\nThe record also shows which months leave the household buying food.\n\nBefore setting a price, record production, packing and selling costs, including labour and transport.\n\nHere is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.\n\nReview the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale.\n\nUse your record to find when household food runs short.\n\nChoose locally suitable crops and work backwards from the harvest you need. Check planting conditions and expected time to harvest.\n\nA date that works on another farm may not work here. Include a backup plan when rain, water or crops fail.",
        "tshivendaDraft": "Khaṋo i nga vha zwiḽiwa zwa muṱa, ya rengiswa, ya kovhelwa, kana ya xela.\n\nU ṅwala nḓila dzo fhambanaho dza u shumisa zwibveledzwa zwi ni thusa u vhona zwine bulasi ḽa bveledza na zwine zwa swika kha vharengi.\n\nShumisani mafhungo eneo u tsireledza zwiḽiwa zwa muṱa na u ita tsheo dza bindu dza khwine.\n\nṄwalani khaṋo iṅwe na iṅwe musi i tshi itea.\n\nṄwalani kilograms dza matamatisi, dozens dza makumba, na bundles dza morogo; ni dovhe ni ṅwale uri tshiṅwe na tshiṅwe tsho ya ngafhi.\n\nShumisani maitele a sa lemelaho a fanaho kha zwiḽiwa zwine zwa dzula hayani, zwibveledzwa zwo rengiswaho, zwo ṋewaho vhaṅwe nga mpho, na zwo itwaho compost.\n\nMusi khalanwaha i tshi fhela, ni songo ḓitika nga zwine na zwi humbula.\n\nRekhodo dza khalanwaha nthihi dzi fhindula mbudziso dzine dza thusa.\n\nNdi zwimela zwifhio zwine zwa bveledza best yield per bed? Ndi zwimela zwifhio zwine zwa vhuisa the most return for each hour of work?\n\nNdi zwimela zwifhio zwine zwa shumisa mbeu, maḓi na compost zwinzhi u fhira zwine zwa vhuisa?\n\nRekhodo i dovha ya sumbedza miṅwedzi ine muṱa wa renga zwiḽiwa.\n\nMusi ni sa athu vhea mutengo, ṅwalani masheleni a u bveledza, u paka na u rengisa, hu tshi katelwa mushumo na transport.\n\nTsumbo iyi ndi ya u funza, a si mutengo wa makete: tomatoes cost R18 per kilogram to produce but sell for R15 per kilogram. Mutengo wonoyo a u swikeli cost yo bulwaho.\n\nSedzani mutengo, costs na u ṱavha hu tevhelaho. Sedzani zwine vharengi vha ḓo zwi renga zwa vhukuma; mutengo wa nṱha une na u humbela a u khwaṱhisedzi uri zwi ḓo rengiswa.\n\nShumisani rekhodo yaṋu u wana tshifhinga tshine zwiḽiwa zwa muṱa zwa vha zwi siho nga ho eḓanaho.\n\nNangani zwimela zwine zwa tea vhupo haṋu, ni dzudzanye ni tshi vhalela murahu u bva kha harvest ine na i ṱoḓa. Ṱolani nyimele dza u zwala na tshifhinga tsho lavhelelwaho tsha u kaṋa.\n\nḒuvha ḽine ḽa shuma bulasini ḽiṅwe ḽi nga kha ḽi sa shumi fhano. Katelani a backup plan arali mvula, maḓi kana zwimela zwa kundelwa.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Record harvest amounts and destinations separately from cash",
          "tshivendaDraft": "Ṅwalani harvest amounts na hune khaṋo ya ya hone, nga u fhambana na cash.",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Include production and selling costs when assessing a price",
          "tshivendaDraft": "Katelani masheleni a u bveledza na u rengisa musi ni tshi sedza mutengo.",
          "reviewStatus": 'machine-draft'
        },
        {
          "sourceEnglish": "Label worked examples; use your actual costs for decisions",
          "tshivendaDraft": "Label worked examples; shumisani costs dzaṋu dza vhukuma u dzhia tsheo.",
          "reviewStatus": 'machine-draft'
        },
        {
          "sourceEnglish": "Plan for food gaps using local growing conditions and harvest timing",
          "tshivendaDraft": "Pulani nga ha zwikhala zwa zwiḽiwa ni tshi shumisa nyimele dza u alusa dza henefho na tshifhinga tsha khanwiwa.",
          "reviewStatus": 'machine-draft'
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce. What should the farmer review?",
            "tshivendaDraft": "Kha tsumbo iyi ya u funza, tomatoes sell at R15/kg and cost R18/kg to produce. Mulimi u fanela u sedza mini?",
            "reviewStatus": 'machine-draft'
          },
          "options": [
            {
              "sourceEnglish": "Keep selling at R15 — short-term loss builds relationships",
              "tshivendaDraft": "Bvelani phanḓa ni tshi rengisa nga R15 — short-term loss i fhaṱa vhushaka.",
              "reviewStatus": 'machine-draft'
            },
            {
              "sourceEnglish": "Stop growing tomatoes entirely",
              "tshivendaDraft": "Litshani u tavha matamatisi nga hoṱhe.",
              "reviewStatus": 'machine-draft'
            },
            {
              "sourceEnglish": "The selling price, costs and whether another crop would give a better return",
              "tshivendaDraft": "Mutengo wa u rengisa, costs, na uri tshimela tshiṅwe tshi nga netshedza return i khwine.",
              "reviewStatus": 'machine-draft'
            },
            {
              "sourceEnglish": "Apply for a subsidy to cover the gap",
              "tshivendaDraft": "Iteni khumbelo ya subsidy u lifha phambano.",
              "reviewStatus": 'machine-draft'
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "The example price is below the stated cost. Review the gap and customer demand before making the next production decision.",
            "tshivendaDraft": "Mutengo wa tsumbo u fhasi ha cost yo ambiwaho. Sedzani phambano na zwine vharengi vha zwi ṱoḓa ni sa athu dzhia tsheo ya u bveledza hu tevhelaho.",
            "reviewStatus": 'machine-draft'
          }
        },
        {
          "question": pair("A farmer's records show she's short of vegetables every June and July. What's the useful action here?", "Rekhodo dza mulimi dzi sumbedza uri u na miroho i sa eḓanaho nga June na July ṅwaha muṅwe na muṅwe. Ndi vhukando vhufhio vhune ha thusa?"),
          "options": [
            pair("Buy vegetables at market each June and July", "Rengani miroho makete nga June na July ṅwaha muṅwe na muṅwe."),
            {
              "sourceEnglish": "Work backwards from the food gap using suitable local crops and their harvest timing",
              "tshivendaDraft": "Pulani ni tshi humela murahu u bva kha tshikhala tsha zwiḽiwa, ni tshi shumisa zwimela zwi fanelaho vhupo ha henefho na tshifhinga tshazwo tsha u kaṋa.",
              "reviewStatus": "machine-draft"
            },
            pair("Accept her farm can't produce in winter", "Tanganedzani uri bulasi ḽawe a ḽi nga bveledzi zwimela nga vhuria."),
            pair("The records show a soil fertility problem", "Rekhodo dzi sumbedza thaidzo ya pfushi ya mavu.")
          ],
          "sourceCorrectIndex": 1,
          "rationale": pair("Records identify the gap. Crop choice and sowing dates must then match the local climate, water and expected harvest time.", "Rekhodo dzi sumbedza u shaya. U nanga zwimela na maḓuvha a u zwala zwi tea u tendelana na mutsho wa henefho, maḓi na tshifhinga tsho lavhelelwaho tsha u kaṋa.")
        }
      ]
    },
    {
      "id": "market-community-l3",
      "infographicAlt": { sourceEnglish: "Five small planted beds with arrows pointing toward a central crate of produce; a hand trowel and seed jar sit below it.", tshivendaDraft: "Mibedo miṱuku miṱanu yo ṱavhiwaho i na misevhe i tshi livha kha crate ya produce i re vhukati; hand trowel na jar ya seeds zwi re nga fhasi.", reviewStatus: 'machine-draft' },
      "title": { sourceEnglish: "Building Community Food Networks: Strength in Numbers", tshivendaDraft: "U fhaṱa network ya zwiḽiwa zwa tshitshavhani: Strength in Numbers", reviewStatus: 'machine-draft' },
      "body": {
        "sourceEnglish": "Neighbours can share different varieties and the work of saving seed.\n\nRecord the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.\n\nSharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed. Before exchanging seed, check whether the variety is protected and whether permission is needed.\n\nTool sharing puts expensive equipment within reach of the group.\n\nA water pump or grain mill may be beyond one household’s budget.\n\nShared use spreads the value across the group and helps each farm do work it could not do alone.\n\nHandle produce gently and keep suitable shade, packaging and storage through delivery.\n\nA nearby buyer may reduce the journey, but losses and selling costs still need measuring.\n\nCompare the money received after fees, transport and spoilage for each option. Do not assume the nearest buyer always gives the best return.\n\nNeighbours can demonstrate useful skills and compare what happened on their own farms.\n\nRecord the method, conditions and result so others can judge whether it may suit their land.\n\nSeek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.",
        "tshivendaDraft": "Vhahura vha nga kovhelana mifuda yo fhambanaho na mushumo wa u vhulunga mbeu.\n\nṄwalani crop, variety, source na datumu ya u kuvhanganya. Pulani suitable isolation, selection, drying and storage kha crop iṅwe na iṅwe.\n\nU kovhekana a zwi ambi uri diversity i ḓo engedzea automatically kana quality i khwinifhale automatically. Ṱolani identity na germination ni sa athu ḓitika nga shared seed. Before exchanging seed, check whether the variety is protected and whether permission is needed.\n\nU kovhelana zwishumiswa zwi ita uri zwishumiswa zwi ḓuraho zwi swikelele tshigwada.\n\nPhampu ya maḓi kana tshigayo tsha thoro zwi nga vha zwi sa swikeleliho nga masheleni a muṱa muthihi.\n\nU zwi shumisa roṱhe zwi phaḓaladza ndeme yazwo kha tshigwada, zwa thusa bulasi ḽiṅwe na ḽiṅwe u ita mushumo une ḽi si kone u u ita ḽoṱhe.\n\nFarani zwibveledzwa nga vhulenda. Keep suitable shade, packaging and storage through delivery.\n\nMukengi wa tsini a nga fhungudza lwendo, fhedzi losses and selling costs still need measuring.\n\nVhambedzani money received after fees, transport and spoilage kha option iṅwe na iṅwe. Ni songo humbula uri the nearest buyer always gives the best return.\n\nVhahura vha nga sumbedza vhukoni vhu thusaho nahone vha vhambedza zwe zwa itea bulasini ḽavho.\n\nṄwalani method, conditions and result so others can judge whether it may suit their land.\n\nṰoḓani qualified advice nga ha unfamiliar disease or technical problems. Tshenzhemo yo kovhekaniwaho na specialist help zwi nga shuma khathihi.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Record seed identity, source and quality, and check if permission is needed before sharing",
          "tshivendaDraft": "Ṅwalani seed identity, source and quality, nahone ni sedze arali permission i tshi ṱoḓea musi ni sa athu u kovhelana.",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Agree care, booking and repair responsibilities for shared tools",
          "tshivendaDraft": "Tendelani nga vhuḓifhinduleli ha u ṱhogomela zwishumiswa zwine zwa kovhekanywa, booking yazwo, na u zwi lugisa.",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Measure losses and net returns for each selling route",
          "tshivendaDraft": "Measure losses and net returns kha selling route iṅwe na iṅwe.",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Combine shared experience with qualified help when needed",
          "tshivendaDraft": "Ṱanganyisani shared experience na qualified help musi zwi tshi ṱoḓea.",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Neighbours want to share saved seed. What helps make the shared seed useful?",
            "tshivendaDraft": "Vhahura vha ṱoḓa u kovhelana saved seed. What helps make the shared seed useful?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Mix all varieties without labels",
              "tshivendaDraft": "Ṱanganyisani mifuda yoṱhe ni songo i ṅwala labels.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Agree seed-quality checks and check whether permission is needed to share the variety",
              "tshivendaDraft": "Thendelanani nga seed-quality checks nahone ni sedze arali permission i tshi ṱoḓea u kovhelana variety.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Assume sharing automatically improves every seed lot",
              "tshivendaDraft": "Humbulani uri sharing automatically improves every seed lot.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Rely only on the size of the group",
              "tshivendaDraft": "Fulufhelani fhedzi kha size ya group.",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Seed quality depends on crop-specific isolation, selection, labelling, storage and germination checks. Those checks do not establish permission to exchange a protected variety; check the applicable rights before sharing.",
            "tshivendaDraft": "Kwalithi ya mbeu i ḓitika nga crop-specific isolation, selection, labelling, storage and germination checks. Those checks do not establish permission to exchange a protected variety; check the applicable rights before sharing.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "A grower is comparing a distant market with nearby customers. What should guide the decision?",
            "tshivendaDraft": "Mulimi u khou vhambedza distant market na nearby customers. Ndi mini tshine tsha tea u livhisa phetho?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Always choose the highest headline price",
              "tshivendaDraft": "Khethani tshifhinga tshoṱhe highest headline price.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Always choose the shortest journey",
              "tshivendaDraft": "Khethani tshifhinga tshoṱhe shortest journey.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Compare money received after fees, transport, unsold produce and losses",
              "tshivendaDraft": "Vhambedzani money received after fees, transport, unsold produce and losses.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Assume joining a group removes all costs",
              "tshivendaDraft": "Humbulani uri u dzhena kha group zwi fhelisa costs dzoṱhe.",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Distance affects costs, but it is not the only factor. Use actual returns and losses to compare the options.",
            "tshivendaDraft": "Distance affects costs, but it is not the only factor. Shumisani actual returns and losses u vhambedza options.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    },
    {
      id: 'market-community-l2',
      infographicAlt: { sourceEnglish: "Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.", tshivendaDraft: "Nḓila tharu dza u rengisa zwi tshi bva kha farm nthihi: roadside stall, u isa produce shop nga tshigwada, na box i yaho nga ho livhaho muṱani.", reviewStatus: 'machine-draft' },
      title: { sourceEnglish: "Selling Surplus: Where to Sell and How to Price", tshivendaDraft: "U rengisa surplus: Hune wa nga rengisa hone na uri wa vhea mutengo hani", reviewStatus: 'machine-draft' },
      body: pair(
        [
          "Ask what the customer needs: product, quantity, quality, delivery and payment date.",
          "Compare market fees, transport, packing and unsold produce as well as the selling price.",
          "Check the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.",
          "Direct selling can retain more of the sale price, but it also takes time, packing, transport and customer care.",
          "A box scheme supplies a regular selection to agreed customers.",
          "Agree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement.",
          "Start from what you can reliably supply and what customers want.",
          "Check the costs and household food needs before promising regular boxes.",
          "Garden area or customer count alone does not predict income. Try a manageable arrangement and record the results.",
          "If production changes from week to week, avoid promising a fixed delivery you cannot supply.",
          "Offer the surplus you have and agree clear terms with customers.",
          "Describe your growing practices honestly. Check any certification or claim the buyer requires before using a label.",
        ].join('\n\n'),
        [
          "Vhudzisani uri mutengi u ṱoḓa mini: product, tshivhalo, quality, delivery na ḓuvha ḽa payment.",
          "Vhambedzani market fees, transport, u paka na zwibveledzwa zwi sa rengiswi, na mutengo wa u rengisa.",
          "Sedzani milayo ya market na ṱhoḓea dza henefho dza u rengisa na zwiḽiwa. Informal stall a zwi sokou amba uri a hu na milayo kana costs.",
          "Direct selling can retain more of the sale price, fhedzi zwi dzhia tshifhinga, packing, transport na customer care.",
          "Box scheme i ṋetshedza regular selection kha vharengi vho tendelanaho.",
          "Tendelani nga contents, price, payment, na uri hu itea mini when crops are short. Regular orders a thusa u pulana only when customers and growers can keep the agreement.",
          "Thomani nga zwine na nga kona u tshi zwi ṋetshedza nga u fulufhedzea na zwine vharengi vha zwi ṱoḓa.",
          "Ṱolani costs na household food needs musi ni sa athu fulufhedzisa regular boxes.",
          "Tshikalo tsha ngade kana tshivhalo tsha vharengi, zwone fhedzi, a zwi anganyeli income. Ringetani arrangement ine na nga kona u i langula, ni ṅwale results.",
          "Arali production i tshi shanduka vhege nga vhege, avoid promising a fixed delivery you cannot supply.",
          "Offer the surplus you have and tendelanani nga clear terms na vharengi.",
          "Ṱalusani growing practices dzaṋu nga u fulufhedzea. Musi ni sa athu shumisa label, sedzani certification kana claim ine murengi a i ṱoḓa.",
        ].join('\n\n'),
      ),
      keyPoints: [
        pair("Agree product, quantity, quality, delivery and payment", "Tendelani nga ha tshibveledzwa, tshivhalo, quality, delivery na payment."),
        pair(
          'Compare costs and losses as well as selling price',
          'Vhambedzani tsengo na ndozwo khathihi na mutengo wa u rengisa.',
        ),
        pair('Promise regular boxes only when supply and customer terms support them', 'Fulufhedzisani regular boxes fhedzi musi supply na customer terms zwi tshi zwi tendela.'),
        pair('Check market rules and describe growing practices honestly', 'Sedzani market rules, nahone ni ṱaluse growing practices dzaṋu nga u fulufhedzea.'),
      ],
      quiz: [
        {
          question: pair('A smallholder has inconsistent weekly production — surplus some weeks, little in others. Which channel suits her best?', 'Mulimi wa bulasi ḽiṱuku u na production ine ya fhambana vhege nga vhege — surplus vhege dziṅwe, ya vha ṱhukhu kha dziṅwe. Ndi channel ifhio ine ya mu tea nga maanḓa?'),
          options: [
            pair('A formal market stall needing consistent weekly supply', 'Formal market stall ine ya ṱoḓa consistent weekly supply.'),
            pair('A box scheme needing the same produce weekly', 'Box scheme ine ya ṱoḓa produce i fanaho vhege iṅwe na iṅwe.'),
            pair('An informal market or neighbour sales with no fixed commitment', 'Informal market kana u rengisa kha vhahura hu si na fixed commitment.'),
            pair('A daily-delivery school contract', 'Thendelano ya tshikolo ine ya ṱoḓa u isa zwithu ḓuvha ḽiṅwe na ḽiṅwe.'),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("This is the one channel that doesn't require her to promise a fixed amount every week — she sells what she actually has.", "Iyi ndi yone channel nthihi ine ya si ṱoḓe uri a fulufhedzise fixed amount vhege iṅwe na iṅwe — u rengisa zwe a vha nazwo zwa vhukuma."),
        },
        {
          question: pair('How can agreed regular orders help a grower plan?', 'Agreed regular orders zwi nga thusa hani mulimi u pulana?'),
          options: [
            pair('Box customers always pay more per kilogram', 'Vharengi vha box vha badela tshifhinga tshoṱhe tshelede nnzhi nga kilogram.'),
            pair('Box schemes let you charge extra for packaging', 'Box schemes dzi ni tendela u badelisa tshelede yo engedzeaho ya packaging.'),
            pair('Committed subscription income lets you plan production around real demand instead of growing speculatively', 'Committed subscription income i ni thusa u pulana production u tevhela real demand, nṱhani ha u alusa nga speculation.'),
            pair('Box schemes avoid tax obligations', 'Box schemes dzi iledza tax obligations'),
          ],
          sourceCorrectIndex: 2,
          rationale: pair('Confirmed orders give information about demand. Their value still depends on reliable supply, payment and the costs of fulfilling them.', 'Dzioda dzo khwaṱhiswaho dzi ni fha mafhungo nga ha demand. Ndeme yadzo i kha ḓi dzhia uri hu vhe na reliable supply, payment na costs dza u dzi swikisa.'),
        },
      ],
    },
  ],
};
