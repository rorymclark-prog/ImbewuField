/** Unreviewed, source-paired Sesotho (South African orthography, Free State/QwaQwa) machine draft of Seeds and Seed Sovereignty:
 * module card and all lessons, key points, quizzes and answer explanations. The exact English
 * source stays beside every draft. Each passage had a blind back-translation and an independent
 * semantic check; no fluent-speaker, local-farming or community review has approved it yet.
 * Back-translations: docs/study-translation-reviews/seeds-livestock-regional-2026-10-02/seeds-sovereignty.st.back-translations.json */
import type { SesothoCourseModuleDraft } from './course-translation-drafts-st.ts';

export const SESOTHO_SEEDS_SOVEREIGNTY_DRAFT: SesothoCourseModuleDraft = {
  "id": "seeds-sovereignty",
  "language": "st",
  "reviewStatus": "machine-draft",
  "sourceMetadata": {
    "durationMins": 25,
    "category": "seeds"
  },
  "title": {
    "sourceEnglish": "Seeds and Seed Sovereignty",
    "sesothoDraft": "Dipeo le Boikemelo ba Peo (seed sovereignty)",
    "reviewStatus": "machine-draft"
  },
  "description": {
    "sourceEnglish": "Save, store and share seed — freedom from buying seed every season.",
    "sesothoDraft": "Boloka, boloka hantle le ho arolelana peo — tokoloho ya ho se reke peo sehla se seng le se seng.",
    "reviewStatus": "machine-draft"
  },
  "lessons": [
    {
      "id": "seeds-sovereignty-l1",
      "infographicAlt": {
        "sourceEnglish": "Two seed packets above a simplified comparison: five similar-looking plants on the left and five varied plants on the right. Actual offspring depend on variety and pollination.",
        "sesothoDraft": "Dipakete tse pedi tsa peo hodima papiso e bonolo: dimela tse hlano tse shebahalang di tshwana ka lehlakoreng le letshehadi, le dimela tse hlano tse fapaneng ka lehlakoreng le letona. Dimela tse tla hlaha ho tswa peong di itshetlehile ka mofuta (variety) le pollination.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Why Seed Saving Matters",
        "sesothoDraft": "Hobaneng Ho Boloka Peo Ho Bohlokwa",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Open-pollinated seed from a stable variety can produce similar plants when pollination is properly managed. F1 hybrids come from selected parents. Their saved seed can germinate, but the next generation varies; it may not keep the combination you wanted.\n\nSeed sovereignty includes the knowledge and choices needed to grow, save and share suitable seed. Keep the crop and variety identity with each batch.\n\nChoose healthy plants with useful traits. Start with a crop you know and ask a seed-saving mentor how to manage its pollination and selection.",
        "sesothoDraft": "Peo ya open-pollinated e tswang ho stable variety e ka hlahisa dimela tse tshwanang ha pollination e laolwa hantle. F1 hybrid di tswa ho batswadi ba kgethilweng. Peo ya tsona e bolokilweng e ka mela, empa moloko o latelang o a fapana; e kanna ya se boloke motswako oo o neng o o batla.\n\nBoikemelo ba peo (seed sovereignty) bo akaretsa tsebo le dikgetho tse hlokahalang ho lema, ho boloka le ho arolelana peo e loketseng. Boloka tsebo ya hore sejalo (crop) le mofuta (variety) ke eng hammoho le sehlopha ka seng sa peo.\n\nKgetha dimela tse phetseng hantle tse nang le ditshobotsi tse thusang. Qala ka sejalo seo o se tsebang, o be o botse mentor wa ho boloka peo hore na pollination le kgetho ya sona di laolwa jwang.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Stable open-pollinated varieties need suitable pollination management",
          "sesothoDraft": "Di-stable variety tsa open-pollinated di hloka taolo e loketseng ya pollination",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Seed sovereignty means freedom from depending on a seed company every season",
          "sesothoDraft": "Boikemelo ba peo (seed sovereignty) bo bolela tokoloho ya ho se itshetlehe ka khamphani ya peo sehla se seng le se seng",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Crop and variety diversity can support adaptation to climate change when varieties are suited to local conditions",
          "sesothoDraft": "Phapang ya dijalo le ya mefuta (varieties) e ka tshehetsa ho ikamahanya le phetoho ya boemo ba lehodimo ha mefuta e loketse maemo a sebaka",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Select healthy plants with useful traits; use crop-specific seed-saving guidance",
          "sesothoDraft": "Kgetha dimela tse phetseng hantle tse nang le ditshobotsi tse thusang; sebedisa tataiso ya ho boloka peo e itseng ya sejalo ka seng",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Why won't seed saved from a hybrid (F1) tomato breed true next season?",
            "sesothoDraft": "Hobaneng peo e bolokilweng ho tamati ya F1 hybrid e sa tle e hlahise dimela tse tshwanang le motswadi (breed true) sehleng se latelang?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Hybrid seed is sterile and won't germinate at all",
              "sesothoDraft": "Peo ya hybrid ha e na bokgoni ba ho tswala mme ha e mele ho hang",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Hybrid seed is a one-time genetic cross — its offspring vary unpredictably from the parent",
              "sesothoDraft": "Peo ya hybrid ke motswako wa lefutso wa nako e le nngwe — bana ba yona ba fapana le motswadi ka tsela e sa lebellwang",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Hybrids only grow in commercial greenhouses",
              "sesothoDraft": "Di-hybrid di hola feela ka di-greenhouse tsa kgwebo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Hybrid seed loses viability faster in storage",
              "sesothoDraft": "Peo ya hybrid e lahlehelwa ke bokgoni ba ho mela (viability) ka potlako haholwanyane ha e bolokwa",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "F1 hybrids are bred by crossing two specific parent lines — their seed carries a mixed, unpredictable genetic recombination, not a stable copy of the parent.",
            "sesothoDraft": "Di-F1 hybrid di entswe ka ho kopanya mela e mmedi e itseng ya batswadi — peo ya tsona e nka motswako o fetohang, o sa lebellwang wa lefutso, e seng kopi e tsitsitseng ya motswadi.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "When selecting a parent plant to save seed from, what should guide your choice?",
            "sesothoDraft": "Ha o kgetha semela sa motswadi seo o tla boloka peo ho sona, ke eng e lokelang ho tataisa kgetho ya hao?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Whichever plant produced the single largest fruit",
              "sesothoDraft": "Semela leha e le sefe se hlahisitseng tholwana e kgolo ka ho fetisisa e le nngwe",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "The healthiest, most disease-free, well-shaped plant, even if not the biggest yielder",
              "sesothoDraft": "Semela se phetseng hantle ka ho fetisisa, se se nang malwetse ka ho fetisisa, se bopehileng hantle, leha e se sona se hlahisang haholo ka ho fetisisa",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whichever plant matured first, regardless of health",
              "sesothoDraft": "Semela leha e le sefe se butsitseng pele, ho sa tsotellwe bophelo ba sona",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Any plant — selection doesn't affect future seed quality",
              "sesothoDraft": "Semela leha e le sefe — kgetho ha e ame boleng ba peo ya nako e tlang",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "You're selecting for the traits you want to carry forward — health and vigour matter more long-term than one plant's single biggest harvest.",
            "sesothoDraft": "O kgetha ditshobotsi tseo o batlang ho di tsamaisa pele — ka nako e telele, bophelo bo botle le matla di bohlokwa ho feta kotulo e kgolo ka ho fetisisa ya semela se le seng.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    },
    {
      "id": "seeds-sovereignty-l2",
      "infographicAlt": {
        "sourceEnglish": "Dry seed is collected from mature pods. The tomato wet-method example shows brief fermentation, rinsing and drying.",
        "sesothoDraft": "Peo e omileng e bokelwa ho di-pod tse butsitseng. Mohlala wa mokgwa o metsi wa tamati o bontsha fermentation ya nakwana, ho hlatswa le ho omisa.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "How to Save Seed: Dry and Wet Methods",
        "sesothoDraft": "Ho Boloka Peo Jwang: Mekgwa e Omileng le e Metsi",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Dry seed must mature before collection. Clean away chaff and damaged seed, then finish drying with shade and airflow.\n\nSeed in fleshy fruit needs a crop-specific method. Tomato seed can be briefly fermented to help remove its gel, then rinsed and dried thoroughly. Keep an active jar open or loosely covered. Fermentation is not required for every wet-seeded crop and does not guarantee disease-free seed.\n\nPollination matters too. Maize is wind-pollinated and can cross with other varieties. Tomatoes mostly self-pollinate, but crossing is possible. Check the crop and variety before planning isolation or saving seed.",
        "sesothoDraft": "Peo e omileng e tshwanetse ho butsa pele e bokellwa. Tlosa chaff (makgapetla a omileng le dikarolo tsa semela) le peo e senyehileng, ebe o qeta ho omisa ka moriti le moya.\n\nPeo e ka hara tholwana e nang le nama e hloka mokgwa o ikgethileng ho ya ka sejalo (crop). Peo ya tamati e ka tlohelwa nakwana hore e ferment ho thusa ho tlosa gel ya yona, ebe e a hlatsuwa mme e omiswa ka botlalo. Jar e ntseng e ferment e boloke e bulehile kapa e kwahetswe hanyane feela. Ha se dijalo tsohle tse nang le peo e metsi tse hlokang fermentation, mme fermentation ha e tiise hore peo ha e na malwetse.\n\nPollination le yona e bohlokwa. Pollen ya poone e tsamaiswa ke moya (wind-pollinated), mme poone e ka tswakana (cross) le mefuta e meng (varieties). Ditamati hangata di etsa self-pollination, empa ho tswakana (crossing) ho a kgoneha. Hlahloba sejalo le mofuta pele o rera isolation (sebaka sa ho arolwa) kapa ho boloka peo.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Dry-method crops (beans, maize, sunflower) simply dry on the plant before collection",
          "sesothoDraft": "Dijalo tsa mokgwa o omileng (dinawa, poone, sunflower) di ikomisa feela semeleng pele di bokellwa",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Tomato fermentation removes gel; other wet seeds need their own processing method",
          "sesothoDraft": "Fermentation ya tamati e tlosa gel; peo e meng e metsi e hloka mekgwa ya yona ya ho sebetsa",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Tomatoes mostly self-pollinate but can cross; maize is wind-pollinated. Check crop- and variety-specific isolation guidance before saving seed",
          "sesothoDraft": "Ditamati hangata di etsa self-pollination empa di ka tswakana (cross); pollen ya poone e tsamaiswa ke moya (wind-pollinated). Hlahloba tataiso ya isolation e itseng ya sejalo le ya mofuta (variety) pele o boloka peo",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Rinse processed tomato seed and dry it thoroughly before storage",
          "sesothoDraft": "Hlatswa peo ya tamati e sebeditsweng mme o e omise ka botlalo pele e bolokwa",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "What does brief fermentation help remove when processing tomato seed?",
            "sesothoDraft": "Fermentation ya nakwana e thusa ho tlosa eng ha peo ya tamati e sebetswa?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Fermentation improves the seed's flavour",
              "sesothoDraft": "Fermentation e ntlafatsa tatso ya peo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "It helps remove the gel around the seed before rinsing and drying",
              "sesothoDraft": "E thusa ho tlosa gel e potapotileng peo pele e hlatswa le ho omiswa",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "It kills any pests inside the fruit",
              "sesothoDraft": "E bolaya dikokwanyana tse senyang leha e le dife tse ka hara tholwana",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "It's purely traditional with no practical function",
              "sesothoDraft": "Ke setso feela, ha e na tshebetso ya sebele",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Fermentation helps separate tomato seed from its gel. It is not a guarantee of germination or disease-free seed; dry, store and test the batch.",
            "sesothoDraft": "Fermentation e thusa ho arolwa ha peo ya tamati le gel ya yona. Ha se tiisetso ya hore peo e tla mela kapa ha e na malwetse; omisa, boloka le ho leka sehlopha.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "Why does maize need much greater isolation distance than tomatoes to keep a variety pure?",
            "sesothoDraft": "Hobaneng poone e hloka sebaka se seholo haholo sa isolation ho feta ditamati ho boloka mofuta (variety) o hlwekile?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Maize seed is more fragile",
              "sesothoDraft": "Peo ya poone e senyeha habonolo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Maize is wind-pollinated and crosses easily over distance; tomatoes mostly self-pollinate",
              "sesothoDraft": "Pollen ya poone e tsamaiswa ke moya (wind-pollinated) mme poone e tswakana (cross) habonolo le hole; ditamati hangata di etsa self-pollination",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Tomatoes don't cross-pollinate at all under any conditions",
              "sesothoDraft": "Ditamati ha di etse cross-pollination ho hang tlasa maemo afe kapa afe",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Maize flowers for a shorter period",
              "sesothoDraft": "Poone e thunya nako e kgutshwanyane",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Wind carries maize pollen far further than insect or self-pollination moves tomato pollen — that difference in pollination method drives the isolation requirement.",
            "sesothoDraft": "Moya o jara pollen ya poone hole ho feta kamoo pollen ya tamati e tsamaiswang ke dikokwanyana kapa ke self-pollination — phapang eo ya mokgwa wa pollination e susumetsa tlhokeho ya isolation.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    },
    {
      "id": "seeds-sovereignty-l3",
      "infographicAlt": {
        "sourceEnglish": "Seed envelopes stored in a sealed container, kept cool, dark and dry. Beside it, ten seeds on a damp cloth — some sprouted, some not — as a germination test.",
        "sesothoDraft": "Dienfelopo tsa peo di bolokilwe setshelong se kwetsweng, sebakeng se phodileng, se lefifi mme se omileng. Haufi le sona, dipeo tse leshome di hodima lesela le nang le mongobo; tse ding di mele, tse ding ha di a mela — e le teko ya ho mela.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Drying, Storing, and Sharing Seed",
        "sesothoDraft": "Ho Omisa, ho Boloka le ho Arolelana Peo",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Dry seed properly before storing it: paper envelopes, not plastic, in a shaded, airy spot — never direct sun or sealed heat. The three enemies of seed viability are heat, light, and moisture. Storage life varies by crop and conditions, so test germination before relying on saved seed.\n\nLabel every envelope with crop, variety, and date saved. Keep thoroughly dry seed in a sealed container in a cool, dark, dry place. Sealing damp seed can trap moisture and damage it.\n\nBefore a new planting season, test a small batch for germination so you're not relying on seed that's quietly lost its viability.\n\nOrganise a seed swap with neighbours this season. What one household saves well, several households can share — and the whole group's variety diversity grows with every swap.",
        "sesothoDraft": "Omisa peo hantle pele o e boloka: dienfelopo tsa pampiri, e seng tsa polasetiki, sebakeng se nang le moriti le moya — le ka mohla o se ke wa e beha letsatsing le tobileng kapa motjhesong o kwetsweng. Dira tse tharo tsa bokgoni ba peo ba ho mela (viability) ke motjheso, lesedi le mongobo. Nako ya ho boloka e fapana ka sejalo le maemo, ka hona leka ho mela ha peo pele o tshepa peo e bolokilweng.\n\nNgola enfelopo e nngwe le e nngwe ka sejalo, mofuta (variety) le letsatsi leo peo e bolokilweng ka lona. Boloka peo e omileng ka botlalo setshelong se kwetsweng sebakeng se phodileng, se lefifi mme se omileng. Ho kwala peo e nang le mongobo ho ka kwala mongobo ka hare mme ya e senya.\n\nPele sehla se setjha sa ho jala, leka sehlopha se senyenyane bakeng sa ho mela, e le hore o se ke wa tshepa peo e seng e lahlehetswe ke viability ntle le ho tsebahala.\n\nHlophisa phapanyetsano ya peo (seed swap) le baahisane sehleng sena. Seo lelapa le le leng le se bolokang hantle, malapa a mmalwa a ka se arolelana — mme phapang ya mefuta (varieties) ya sehlopha sohle e hola ka phapanyetsano e nngwe le e nngwe.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Dry seed in shade with good airflow; never in direct sun or sealed heat",
          "sesothoDraft": "Omisa peo moriting le moyeng o lekaneng; le ka mohla letsatsing le tobileng kapa motjhesong o kwetsweng",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Store labelled seed cool, dark, and dry — heat, light, and moisture are the three enemies of viability",
          "sesothoDraft": "Boloka peo e ngotsweng sebakeng se phodileng, se lefifi mme se omileng — motjheso, lesedi le mongobo ke dira tse tharo tsa viability",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Test a small batch for germination before relying on stored seed for planting",
          "sesothoDraft": "Leka sehlopha se senyenyane bakeng sa ho mela pele o tshepa peo e bolokilweng bakeng sa ho jala",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Seed swaps grow everyone's variety diversity faster than saving alone",
          "sesothoDraft": "Diphapanyetsano tsa peo di hodisa phapang ya mefuta (varieties) ya bohle kapele ho feta ho boloka o le mong",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "What are the three main enemies of stored seed viability?",
            "sesothoDraft": "Dira tse tharo tse kgolo tsa viability ya peo e bolokilweng ke dife?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Wind, insects, and fungus",
              "sesothoDraft": "Moya, dikokwanyana le fungus",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Heat, light, and moisture",
              "sesothoDraft": "Motjheso, lesedi le mongobo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Cold, darkness, and dryness",
              "sesothoDraft": "Serame, lefifi le komello",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Soil contact, pests, and rodents",
              "sesothoDraft": "Ho kopana le mobu, dikokwanyana tse senyang le rodents",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Keeping thoroughly dry seed cool and dark counters all three. A sealed container helps keep dry seed dry, but can trap moisture if seed is packed while damp.",
            "sesothoDraft": "Ho boloka peo e omileng ka botlalo e phodile le e lefifi ho thibela tse tharo kaofela. Setshelo se kwetsweng se thusa ho boloka peo e omileng e omile, empa se ka kwala mongobo ha peo e kentswe e ntse e na le mongobo.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "Why test a small batch of stored seed for germination before planting season?",
            "sesothoDraft": "Hobaneng ho leka sehlopha se senyenyane sa peo e bolokilweng bakeng sa ho mela pele ho sehla sa ho jala?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "It's a legal requirement for seed sharing",
              "sesothoDraft": "Ke tlhoko ya molao ho arolelana peo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Seed can quietly lose viability in storage, and testing avoids relying on seed that won't grow",
              "sesothoDraft": "Peo e ka lahlehelwa ke viability ka kgutso ha e bolokilwe, mme teko e thibela ho tshepa peo e ke keng ya mela",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "It improves the seed's flavour",
              "sesothoDraft": "E ntlafatsa tatso ya peo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "It's only necessary for hybrid seed",
              "sesothoDraft": "Ho hlokahala feela bakeng sa peo ya hybrid",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "A germination test catches seed that's died in storage before you've committed a whole season's planting to it.",
            "sesothoDraft": "Teko ya ho mela e tshwara peo e shweleng polokong pele o beha sehla sohle sa ho jala ho yona.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    }
  ]
};
