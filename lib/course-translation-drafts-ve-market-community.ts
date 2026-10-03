/** Source-paired Tshivenda learner draft for one Market lesson field. */
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
  title: hold('Market Gardening & Community'),
  description: hold('Record-keeping, selling surplus and building local food networks.'),
  lessons: [
    {
      "id": "market-community-l1",
      "infographicAlt": {
        "sourceEnglish": "A person holds a pencil over a blank record grid in an open notebook, beside a basket and loose vegetables.",
        "tshivendaDraft": "A person holds a pencil over a blank record grid in an open notebook, beside a basket and loose vegetables.",
        "reviewStatus": "hold"
      },
      "title": {
        "sourceEnglish": "Record-Keeping: Knowing What Your Farm Is Actually Producing",
        "tshivendaDraft": "Record-Keeping: U Ḓivha Zwine Bulasi Yaṋu Ya Bveledza Zwa Vhukuma",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "A harvest can feed the household, be sold, be shared, or be lost.\n\nRecording these different uses helps you see what the farm produces and what reaches customers.\n\nUse that information to protect household food and make better business decisions.\n\nWrite down every harvest as it happens.\n\nRecord kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.\n\nUse the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.\n\nDo not rely on memory at the end of the season.\n\nOne season of records answers practical questions.\n\nWhich crops give the best yield per bed? Which return the most for each hour of work?\n\nWhich crops use more seeds, water, and compost than they return?\n\nThe record also shows which months leave the household buying food.\n\nBefore setting a price, record production, packing and selling costs, including labour and transport.\n\nHere is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.\n\nReview the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale.\n\nUse your record to find when household food runs short.\n\nChoose locally suitable crops and work backwards from the harvest you need. Check planting conditions and expected time to harvest.\n\nA date that works on another farm may not work here. Include a backup plan when rain, water or crops fail.",
        "tshivendaDraft": "Khaṋo i nga vha zwiḽiwa zwa muṱa, ya rengiswa, ya kovhelwa, kana ya xela.\n\nU ṅwala nḓila dzo fhambanaho dza u shumisa zwibveledzwa zwi ni thusa u vhona zwine bulasi ḽa bveledza na zwine zwa swika kha vharengi.\n\nShumisani mafhungo eneo u tsireledza zwiḽiwa zwa muṱa na u ita tsheo dza bindu dza khwine.\n\nṄwalani khaṋo iṅwe na iṅwe musi i tshi itea.\n\nṄwalani kilograms dza matamatisi, dozens dza makumba, na bundles dza morogo; ni dovhe ni ṅwale uri tshiṅwe na tshiṅwe tsho ya ngafhi.\n\nShumisani maitele a sa lemelaho a fanaho kha food kept at home, produce sold, produce gifted, and produce composted.\n\nMusi khalanwaha i tshi fhela, ni songo ḓitika nga zwine na zwi humbula.\n\nRekhodo dza khalanwaha nthihi dzi fhindula mbudziso dzine dza thusa.\n\nWhich crops give the best yield per bed? Which return the most for each hour of work?\n\nWhich crops use more seeds, water, and compost than they return?\n\nRekhodo i dovha ya sumbedza miṅwedzi ine muṱa wa renga zwiḽiwa.\n\nMusi ni sa athu vhea price, ṅwalani production, packing and selling costs, including labour and transport.\n\nHere is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.\n\nSedzani price, costs na u ṱavha hu tevhelaho. Ṱolani zwine vharengi vha ḓo zwi renga zwa vhukuma; a higher asking price is not a guaranteed sale.\n\nShumisani rekhodo yaṋu u wana tshifhinga tshine zwiḽiwa zwa muṱa zwa vha zwi siho nga ho eḓanaho.\n\nNangani locally suitable crops and work backwards from the harvest you need. Ṱolani planting conditions and expected time to harvest.\n\nA date that works on another farm may not work here. Engedzani a backup plan when rain, water or crops fail.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Record harvest amounts and destinations separately from cash",
          "tshivendaDraft": "Record harvest amounts and destinations separately from cash",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Include production and selling costs when assessing a price",
          "tshivendaDraft": "Include production and selling costs when assessing a price",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Label worked examples; use your actual costs for decisions",
          "tshivendaDraft": "Label worked examples; use your actual costs for decisions",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Plan for food gaps using local growing conditions and harvest timing",
          "tshivendaDraft": "Plan for food gaps using local growing conditions and harvest timing",
          "reviewStatus": "hold"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce. What should the farmer review?",
            "tshivendaDraft": "In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce. What should the farmer review?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Keep selling at R15 — short-term loss builds relationships",
              "tshivendaDraft": "Keep selling at R15 — short-term loss builds relationships",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Stop growing tomatoes entirely",
              "tshivendaDraft": "Stop growing tomatoes entirely",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "The selling price, costs and whether another crop would give a better return",
              "tshivendaDraft": "The selling price, costs and whether another crop would give a better return",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Apply for a subsidy to cover the gap",
              "tshivendaDraft": "Apply for a subsidy to cover the gap",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "The example price is below the stated cost. Review the gap and customer demand before making the next production decision.",
            "tshivendaDraft": "The example price is below the stated cost. Review the gap and customer demand before making the next production decision.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "A farmer's records show she's short of vegetables every June and July. What's the useful action here?",
            "tshivendaDraft": "A farmer's records show she's short of vegetables every June and July. What's the useful action here?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Buy vegetables at market each June and July",
              "tshivendaDraft": "Buy vegetables at market each June and July",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Work backwards from the food gap using suitable local crops and their harvest timing",
              "tshivendaDraft": "Work backwards from the food gap using suitable local crops and their harvest timing",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Accept her farm can't produce in winter",
              "tshivendaDraft": "Accept her farm can't produce in winter",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "The records show a soil fertility problem",
              "tshivendaDraft": "The records show a soil fertility problem",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Records identify the gap. Crop choice and sowing dates must then match the local climate, water and expected harvest time.",
            "tshivendaDraft": "Records identify the gap. Crop choice and sowing dates must then match the local climate, water and expected harvest time.",
            "reviewStatus": "hold"
          }
        }
      ]
    },
    {
      "id": "market-community-l3",
      "infographicAlt": {
        "sourceEnglish": "Five small planted beds with arrows pointing toward a central crate of produce; a hand trowel and seed jar sit below it.",
        "tshivendaDraft": "Five small planted beds with arrows pointing toward a central crate of produce; a hand trowel and seed jar sit below it.",
        "reviewStatus": "hold"
      },
      "title": {
        "sourceEnglish": "Building Community Food Networks: Strength in Numbers",
        "tshivendaDraft": "Building Community Food Networks: Strength in Numbers",
        "reviewStatus": "hold"
      },
      "body": {
        "sourceEnglish": "Neighbours can share different varieties and the work of saving seed.\n\nRecord the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.\n\nSharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed. Before exchanging seed, check whether the variety is protected and whether permission is needed.\n\nTool sharing puts expensive equipment within reach of the group.\n\nA water pump or grain mill may be beyond one household’s budget.\n\nShared use spreads the value across the group and helps each farm do work it could not do alone.\n\nHandle produce gently and keep suitable shade, packaging and storage through delivery.\n\nA nearby buyer may reduce the journey, but losses and selling costs still need measuring.\n\nCompare the money received after fees, transport and spoilage for each option. Do not assume the nearest buyer always gives the best return.\n\nNeighbours can demonstrate useful skills and compare what happened on their own farms.\n\nRecord the method, conditions and result so others can judge whether it may suit their land.\n\nSeek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.",
        "tshivendaDraft": "Vhahura vha nga kovhelana mifuda yo fhambanaho na mushumo wa u vhulunga mbeu.\n\nRecord the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.\n\nSharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed. Before exchanging seed, check whether the variety is protected and whether permission is needed.\n\nU kovhelana zwishumiswa zwi ita uri zwishumiswa zwi ḓuraho zwi swikelele tshigwada.\n\nPhampu ya maḓi kana tshigayo tsha thoro zwi nga vha zwi sa swikeleliho nga masheleni a muṱa muthihi.\n\nU zwi shumisa roṱhe zwi phaḓaladza ndeme yazwo kha tshigwada, zwa thusa bulasi ḽiṅwe na ḽiṅwe u ita mushumo une ḽi si kone u u ita ḽoṱhe.\n\nFarani zwibveledzwa nga vhulenda. Keep suitable shade, packaging and storage through delivery.\n\nMukengi wa tsini a nga fhungudza lwendo, fhedzi losses and selling costs still need measuring.\n\nVhambedzani money received after fees, transport and spoilage kha option iṅwe na iṅwe. Ni songo humbula uri the nearest buyer always gives the best return.\n\nVhahura vha nga sumbedza vhukoni vhu thusaho nahone vha vhambedza zwe zwa itea bulasini ḽavho.\n\nṄwalani method, conditions and result so others can judge whether it may suit their land.\n\nSeek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.",
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
          "tshivendaDraft": "Agree care, booking and repair responsibilities for shared tools",
          "reviewStatus": "hold"
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
            "tshivendaDraft": "Seed quality depends on crop-specific isolation, selection, labelling, storage and germination checks. Those checks do not establish permission to exchange a protected variety; check the applicable rights before sharing.",
            "reviewStatus": "hold"
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
      infographicAlt: hold(
        'Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.',
      ),
      title: hold('Selling Surplus: Where to Sell and How to Price'),
      body: pair(
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
          'Vhudzisani uri mutengi u ṱoḓa mini: product, tshivhalo, quality, delivery na ḓuvha ḽa payment.',
          'Compare market fees, transport, packing and unsold produce as well as the selling price.',
          'Check the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.',
          'Direct selling can retain more of the sale price, but it also takes time, packing, transport and customer care.',
          'A box scheme supplies a regular selection to agreed customers.',
          'Agree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement.',
          'Thomani nga zwine na nga kona u tshi zwi ṋetshedza nga u fulufhedzea na zwine vharengi vha zwi ṱoḓa.',
          'Check the costs and household food needs before promising regular boxes.',
          'Garden area or customer count alone does not predict income. Try a manageable arrangement and record the results.',
          'If production changes from week to week, avoid promising a fixed delivery you cannot supply.',
          'Offer the surplus you have and agree clear terms with customers.',
          'Describe your growing practices honestly. Check any certification or claim the buyer requires before using a label.',
        ].join('\n\n'),
      ),
      keyPoints: [
        hold('Agree product, quantity, quality, delivery and payment'),
        pair(
          'Compare costs and losses as well as selling price',
          'Vhambedzani tsengo na ndozwo khathihi na mutengo wa u rengisa.',
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
  ],
};
