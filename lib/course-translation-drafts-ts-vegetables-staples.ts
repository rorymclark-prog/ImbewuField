/** Unreviewed source-paired Xitsonga bed-preparation and staple concepts. */
import { COURSE_MODULES } from './course-modules.ts';
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});
const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
// Freeze this checked English source: canonical edits must make the learner resolver fall back.
const vegetablesL3CheckedSourceEnglish = [
  "A staple earns its place because it feeds the household beyond the day of harvest.",
  "It carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.",
  "One staple leaves you vulnerable. Two or more give you options when weather or pests hit.",
  "Grow at least two. Not one.",
  "Which staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.",
  "Each staple protects you against something different.",
  "Maize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.",
  "Beans and cowpeas give a storable protein harvest.",
  "Sweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.",
  "Amadumbe handles wetter ground, where other staples struggle.",
  "Notice that they fail in different conditions. That's the whole point.",
  "Resilience doesn't mean nothing fails.",
  "It means one failure doesn't finish your household's food plan.",
  "One crop is one point of failure.",
  "Two or more staples give you more ways to keep eating.",
  "Different crops use water, soil and seasons differently. That difference is the protection."
].join('\n\n');
const sourceParagraphs = vegetablesL3CheckedSourceEnglish.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = "Staple yi ni nkoka hikuva yi phamela ndyangu ni le ndzhaku ka siku ra ntshovelo.";
draftParagraphs[1] = "Yi nyika energy kumbe protein. Yi hlayiseka, kumbe yi sala yi ri emavuni ku fikela loko u yi lava. Hakanyingi yi tlhela yi rhwala cultural memory.";
draftParagraphs[2] = "Staple yin'we yi ku siya u nga sirhelelekanga. Swimbirhi kumbe ku fhira swi ku nyika tindlela to hlawula loko maxelo kumbe pests ti hlasela.";
draftParagraphs[3] = "Byala swimbirhi kumbe ku fhira. Ku nga ri xin'we.";
draftParagraphs[5] = "Staple yin'wana ni yin'wana yi ku sirhelela eka xilo xo hambana.";
draftParagraphs[10] = "Xiya leswaku swibyariwa leswi swi tsandzeka eka swiyimo swo hambana. Hi yona mhaka ya kona.";
draftParagraphs[11] = "Resilience a swi vuli leswaku a ku na lexi tsandzekaka.";
draftParagraphs[12] = "Swi vula leswaku ku tsandzeka kun'we a ku herisi kungu ra swakudya ra ndyangu wa wena.";
draftParagraphs[13] = "Xibyariwa xin'we i \"point of failure\" yin'we.";
draftParagraphs[15] = "Swibyariwa swo hambana swi tirhisa mati, misava na tinguva hi tindlela to hambana. Ku hambana loku hi kona ku va nsirhelelo.";

draftParagraphs[4] = "Hi xihi staple lexi ndyangu wa wena wu titshegeke ngopfu hi xona sweswi? Hi xona lexi failure ya xona a yi ta vavisa ngopfu ku hundza swin’wana — hikokwalaho hi xona lexi lavaka companion.";
draftParagraphs[6] = "Maize yi nyika calories naswona yi hlayiseka loko yi omile. Open-pollinated maize yi tlhela yi ku pfumelela ku hlayisa mbewu ya wena, loko u endla isolation na selection.";
draftParagraphs[7] = "Beans na cowpeas swi nyika protein harvest leyi nga hlayisiwa.";
draftParagraphs[8] = "Sweet potato yi kuma drought tolerance nyana endzhaku ka loko storage roots ta yona ti vumbekile. Yi lava mati eka mavhiki yo sungula ni loko storage roots ti ha vumbeka; water stress hi nkarhi wolowo yi nga hunguta harvest. young leaves ya yona na yona ya dyiwa.";
draftParagraphs[9] = "Amadumbe yi kota ku tiyisela eka wetter ground, laha other staples swi tikeriwaka.";
draftParagraphs[14] = "Staples swimbirhi kumbe ku fhira swi ku nyika tindlela to tala ta ku ya mahlweni u dya.";

export const XITSONGA_VEGETABLES_STAPLES_DRAFT: XitsongaCourseModuleDraft = {
  id: sourceModule.id,
  language: 'ts',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 30, category: 'plants' },
  title: pair("Vegetables and Staple Crops", "Matsavu na Staple Crops"),
  description: pair("Bed prep, succession planting, staple crops and pest management — the daily work of growing food.", "Ku lulamisa beds, succession planting, staple crops na pest management — ntirho wa siku ni siku wa ku rima swakudya."),
  lessons: [
    {
      id: sourceLesson.id,
      infographicAlt: pair("Three staple crops together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below the ground.", "Swirimiwa swinharhu swa staple swi ri swin’we: stalk yo leha ya grain, vine leyi khandziyaka eka nsika, ni xirimilwa xa timitsu lexi kombisiweke hafu ya xona yi ri ehansi ka misava."),
      title: pair("Staple Crops: Maize, Beans, and Root Vegetables", "Staple Crops: Maize, Beans, na Root Vegetables"),
      body: pair(vegetablesL3CheckedSourceEnglish, draftParagraphs.join('\n\n')),
      // The reviewed seed comparisons must withdraw after source or answer-key drift;
      // deriving these pairs from future canonical text would hide that change.
      keyPoints: [
        pair("Open-pollinated maize lets you save seed; hybrid seed won't breed true next season", "Open-pollinated maize yi ku pfumelela ku hlayisa mbewu; mbewu ya hybrid a yi nge breed true eka nguva leyi taka"),
        pair("Beans are the key protein crop — productive, storable, and nitrogen-fixing", "Beans i xirimilwa xa nkoka xa protein — xi humesa ntshovelo kahle, xi hlayiseka, naswona i nitrogen-fixing"),
        pair("Sweet potato develops some drought tolerance after storage roots form, but needs water early; young leaves are edible", "Sweet potato yi kuma drought tolerance nyana endzhaku ka loko storage roots ti vumbekile, kambe yi lava mati eku sunguleni; young leaves ya yona ya dyiwa"),
        pair("Amadumbe (taro) is an underused traditional staple suited to wetter KZN and coastal ground", "Amadumbe (taro) i staple ya ndhavuko leyi nga tirhisiwiki hi ndlela leyi eneleke, leyi fambisanaka ni misava ya KZN leyi tsakamaka ku hundza ni misava ya le kusuhi ni lwandle."),
      ],
      quiz: [
        {
          question: pair("Why choose open-pollinated maize over a hybrid variety if you plan to save your own seed?", "Hikokwalaho ka yini u hlawula open-pollinated maize ematshan'weni ya hybrid variety loko u kunguhata ku hlayisa mbewu ya wena?"),
          options: [
            pair("Open-pollinated varieties yield more", "Mixaka ya open-pollinated yield more."),
            pair("Hybrid seed won't breed true — the next generation won't match the parent plant", "Mbewu ya hybrid a yi nge breed true — swimilana swa xitukulwana lexi landzelaka a swi nge fani ni ximilana xa mutswari"),
            hold("Open-pollinated maize is always more drought-tolerant"),
            pair("Hybrids can't be planted in South Africa", "Hybrids a ti koti ku byariwa eAfrika-Dzonga"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Seed saved from an F1 hybrid may grow, but the next generation can vary. A stable open-pollinated variety with managed pollination is more predictable when saving seed.", "Mbewu leyi hlayisiweke eka F1 hybrid yi nga mela, kambe swimilana swa xitukulwana lexi landzelaka swi nga hambana. Mbuyelo ya muxaka wa open-pollinated lowu nga stable lowu pollination ya wona yi lawuriwaka yi olova ku bvumba ku hundza, loko u hlayisa mbewu."),
        },
        {
          question: pair("Why is amadumbe (taro) a good staple choice for parts of KZN?", "Hikokwalaho ka yini amadumbe (taro) yi ri nhlawulo lowunene wa staple eka swiphemu swa KZN?"),
          options: [
            pair("It thrives on very dry, sandy soil", "Yi kula kahle eka misava leyi omeke swinene ya sava"),
            pair("It tolerates wetter ground than maize, suiting coastal and high-rainfall conditions", "Yi tiyisela misava leyi tsakamaka ku hundza leyi maize yi yi tiyiselaka, yi fambisana ni misava ya le kusuhi ni lwandle ni swiyimo swa mpfula yo tala."),
            pair("It requires no cultivation at all", "A yi lavi cultivation nikatsongo"),
            pair("It's the only staple that stores for multiple years", "Hi yona ntsena staple leyi hlayisekaka ku ringana nkarhi wa ku hundza lembe rin’we"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Amadumbe actually prefers damper ground where maize would struggle — it fills a niche other staples can't handle well.", "Amadumbe actually prefers damper ground where maize would struggle — yi tata niche leyi other staples can't handle well."),
        },
      ],
    },
    {
      "id": "vegetables-staples-l1",
      "infographicAlt": {
        "sourceEnglish": "A raised bed about 1.2 metres wide, with paths on both sides, so a person can reach the middle from either side without ever standing on the growing soil.",
        "xitsongaDraft": "Raised bed leyi nga kwalomu ka 1.2 metres hi ku anama, yi ri ni tindlela ematlhelo hamambirhi, leswaku munhu a kota ku fika exikarhini hi tlhelo rin'wana na rin'wana a nga tshuki a yima ehenhla ka misava leyi ku byariwaka eka yona.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Preparing and Planting Your Beds",
        "xitsongaDraft": "Ku Lulamisa ni ku Byala Mabedhe ya Wena.",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nThe protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nNow think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else.\n\nThere's no single bed shape that's right everywhere.\n\nStart with the least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nLook after heavy rain. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed.\n\nSome crops resent having their roots disturbed. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.\n\nOthers do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.\n\nUse spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.\n\nBefore you plant, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nUse pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nA string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.\n\nThat bed gets easier to improve every season, because you stopped walking on it.",
        "xitsongaDraft": "Compacted soil yi lahlekeriwa hi swikhala swa yona swa moya. Timitsu ti nonoka. Mati ma tswonga hi ndlela yo hambana. Bed yi ya tika ku tirha eka nguva yin'wana ni yin'wana.\n\nNsirhelelo wu olova. Permanent paths, ni bed leyi nga anamangiki ngopfu leswaku u ta kota ku fika endzeni ka yona ku suka ematlhelweni haswimbirhi.\n\nOne metre to one point two metres hi ku anama. Lowu hi wona mpimo lowu tirhaka. Hi ku anama koloko u nga fika exikarhini ku suka eka ndlela yin'wana ni yin'wana ya letimbirhi, naswona milenge ya wena a yi khumbi growing area nikatsongo.\n\nSweswi ehleketa hi mabedhe ya wena. Xana u nga swi kota ku fika exikarhini handle ko kandziya endzeni? Famba u ya ringeta leswi u nga si byala swin'wana.\n\nA ku na xivumbeko xa bed lexi lulameke eka tindhawu hinkwato.\n\nSungula hi least disturbance leyi lulamisaka xiphiqo xa wena.\n\nNo-dig yi lulamela most garden soils. Tshika soil structure yi ri tano, kutani u aka fertility ehenhla.\n\nU nga keli wet clay. Loko compaction kumbe poor drainage swi ri severe, kuma xivangelo hi switsundzuxo swa le ndhawini u nga si hlawula deeper cultivation.\n\nRaised beds ti lulamela wet ground, laha mati ma faneleke ku kuma ndhawu yo huma ma ya kona.\n\nSunken beds ti lulamela dry ground, laha u lavaka ku khoma ni ku hlayisa mpfula leyi u yi kumaka.\n\nEndzhaku ka mpfula leyikulu, kambisisa. Mati ma yima kumbe ma khuluka ma suka kwihi? Hlanganisa leswi u swi voneke ni switsundzuxo swa misava ni drainage u nga si hlawula bed.\n\nSwibyariwa swin'wana a swi tsakeli ku kavanyetiwa ka timitsu ta swona. Swi tirha ku antswa loko swi byariwa hi ku kongoma laha swi nga ta kula kona. Beans, carrots na maize swi wela eka ntlawa wolowo.\n\nSwin'wana swi tirha ku antswa loko swi sungula swi sirhelelekile eka nursery, kutani transplanting. Tomatoes na brassicas swi wela eka ntlawa wolowo.\n\nLandzelela spacing guidance ya crop, variety na local conditions. Kambela leswi tsariweke eka phakiti ni switsundzuxo swa varimi va le ndhawini. Langutela crowding loko swibyariwa swi ri karhi swi kula.\n\nLoko u nga si byala, fungha bed.\n\nOne point two metres hi ku anama. Three metres hi ku leha. I bed yin'we ya ku titoloveta.\n\nTirhisa pegs na string. Fungha rectangle, kutani u fungha tindlela hatimbirhi to nghena.\n\nKutani lulamisa hi ku ya hi misava ya wena — sungula hi no-dig, kutani u cela ku enta ntsena loko misava ya wena hakunene yi swi lava.\n\nNtila wa ntambhu wu hundzula miehleketo wu va xiboho. Loko tindlela ti ri kona, ti hlayise. Loko ndhawu yo byala yi ri kona, yi sirhelele.\n\nBed yoleyo yi ya olova ku antswisa eka nguva yin'wana ni yin'wana, hikuva u tshike ku famba ehenhla ka yona.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Keep beds 1-1.2m wide so you never need to step on the growing area",
          "xitsongaDraft": "Hlayisa beds ti ri 1-1.2m hi ku anama leswaku u nga boheki ku kandziya growing area nikatsongo",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Assess compaction and drainage before choosing deeper cultivation; do not work wet clay",
          "xitsongaDraft": "Assess compaction na drainage u nga si hlawula deeper cultivation; u nga tirhi wet clay.",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Transplant crops needing a head start; direct-seed crops that resent root disturbance",
          "xitsongaDraft": "Transplant swibyariwa leswi lavaka head start; direct-seed swibyariwa leswi nga tsakeliki root disturbance",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Crowded plants underperform — space generously for your local climate",
          "xitsongaDraft": "Swibyariwa leswi manyaneke underperform — space generously hi ku ya hi local climate ya wena",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Why keep a vegetable bed to 1-1.2m wide rather than wider?",
            "xitsongaDraft": "Hikokwalaho ka yini u hlayisa bed ya miroho yi ri na ku anama ka 1-1.2m, ematshan’weni yo yi endla wider?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Wider beds get too much sun",
              "xitsongaDraft": "Mabedhe lama anameke ma kuma dyambu ro tala ngopfu.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "You can reach the centre from either side without stepping on the growing area, avoiding compaction",
              "xitsongaDraft": "U nga fika exikarhini ku suka eka tlhelo rin’wana ni rin’wana ra lamambirhi handle ko kandziya ndhawu leyi swibyariwa swi milaka eka yona, u papalata compaction.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Narrow beds drain better in all conditions",
              "xitsongaDraft": "Narrow beds drain better eka swiyimo hinkwato",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "It's a fixed rule with no practical reason",
              "xitsongaDraft": "I nawu lowu nga cinciki, lowu nga riki na practical reason.",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Stepping on growing soil compacts it and damages roots — a bed you can reach into from both sides means you never have to.",
            "xitsongaDraft": "Ku kandziya misava leyi swimila swi milaka eka yona swi endla compaction ni ku onha timitsu — bed leyi u nga yi fikelelaka ku suka ematlhelweni haswimbirhi yi vula leswaku a wu boheki nikatsongo ku kandziya misava leyi swimila swi milaka eka yona.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "Which crop is best suited to direct-seeding rather than transplanting?",
            "xitsongaDraft": "Hi xihi xibyariwa lexi faneleke ngopfu ku byariwa hi direct-seeding ku ri na transplanting?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Tomatoes, which need an early start",
              "xitsongaDraft": "Tomatoes, leti lavaka early start",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Brassicas, which need protection while small",
              "xitsongaDraft": "Brassicas, leti lavaka nsirhelelo loko ta ha ri titsongo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Beans, which resent root disturbance",
              "xitsongaDraft": "Beans, leti nga tsakeliki root disturbance",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Peppers, which are slow to germinate",
              "xitsongaDraft": "Peppers, leti hlwelaka ku mila",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Beans and other quick, sensitive-rooted crops establish poorly after transplant shock — sowing them straight into the bed avoids that setback entirely.",
            "xitsongaDraft": "Beans and other quick, sensitive-rooted crops establish poorly endzhaku ka transplant shock — ku swi byala hi ku kongoma eka bed ku papalata setback yoleyo hi ku helela.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    },
    {
      "id": "vegetables-staples-l4",
      "title": {
        "sourceEnglish": "Observe and Manage Pests and Disease",
        "xitsongaDraft": "Xiyisisa ni ku lawula Pests na Disease",
        "reviewStatus": "machine-draft"
      },
      "infographicAlt": {
        "sourceEnglish": "A pest on a leaf, and three ways to deal with it without chemicals: a beneficial insect, a physical barrier, and picking it off by hand.",
        "xitsongaDraft": "Pest eka tluka, ni tindlela tinharhu to yi lawula handle ka tikhemikhali: beneficial insect, physical barrier, ni ku yi susa hi voko.",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Pest pressure usually rises for a reason.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nSo before you treat anything, look at the whole system.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nWork through four steps, in order.\n\nOne. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nThree. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.\n\nFour. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.\n\nIf a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.\n\nBe honest with yourself about which step you usually skip.",
        "xitsongaDraft": "Pest pressure hi ntolovelo yi engetseka hi xivangelo.\n\nSwibyariwa leswi nga na stress. Xibyariwa xin’we lexi lawulaka ndhawu. Kumbe broad chemical use leyi se yi suseke predators leti a ti ku pfuna.\n\nKutani, loko u nga si tshungula xin'wana ni xin'wana, languta system hinkwawu.\n\nXana xibyariwa xi pfumala mati? Misava yi compacted kumbe yi pfumala swakudya? Xana predators se ti ku pfuna hi ku tirha eka xiphiqo lexi?\n\nA yellow leaf a swi vuli automatically leswaku ku ni insect. Xivangelo xi nga va mati, nutrition, kumbe ku onhaka ka timitsu. Kuma leswaku i yini u nga si teka goza.\n\nTirha hi magoza ya mune, hi ku landzelelana.\n\nXo sungula. Languta pattern ya ku onhaka, tlhelo ra le hansi ra tluka, tsinde, ni swibyariwa leswi nga ekusuhi.\n\nVumbirhi. Kambela stress. Ndzhongo wa misava, timitsu, mpfhuka wa swimilani, nutrition na drainage.\n\nVunharhu. Sirhelela leswi swi ku pfunaka. Beneficial insects (switsotswana leswi pfunaka) swi endla ntirho lowu wena a wu ta wu endla hi wexe.\n\nVumune. Hi kona ntsena u tekaka goza — sungula hi the lightest thing that works. Physical removal, barriers kumbe ku cinca ndlela yo hlayisa swibyariwa swi nga pfuna. Kambela leswaku goza ri fambisana ni xiphiqo, kutani u ya mahlweni u kambela vuyelo.\n\nLoko treatment yi laveka, tirhisa product registered for that crop and pest, kutani u landzelela label ya yona. Leswi swi katsa neem products. Kambela protection and harvest waiting instructions. U nga tiendleli swihlanganisi kumbe stronger doses.\n\nTshembeka eka wena n'winyi mayelana na goza leri u talaka ku ri tlula.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Identify the cause before treating damage",
          "xitsongaDraft": "Kuma xivangelo u nga si endla treatment ya damage",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Check water, roots, nutrition and beneficial insects",
          "xitsongaDraft": "Kambela mati, timitsu, nutrition na beneficial insects",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Use suitable physical or crop-care measures and monitor results",
          "xitsongaDraft": "Tirhisa physical kumbe crop-care measures leswi faneleke, kutani u ya mahlweni u kambela vuyelo",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "If treatment is needed, use a registered product for the crop and pest and follow the label",
          "xitsongaDraft": "Loko treatment yi laveka, tirhisa registered product for the crop and pest kutani u landzelela label",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "If a pest problem needs a treatment product, what should guide its use?",
            "xitsongaDraft": "Loko pest problem yi lava treatment product, i yini lexi faneleke ku kongomisa ku tirhisiwa ka yona?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "An improvised stronger mixture",
              "xitsongaDraft": "Mpfangano lowu endliweke hi ku improvise, lowu nga stronger.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A product registered for the crop and pest, used according to its label",
              "xitsongaDraft": "Product registered for the crop and pest, leyi tirhisiwaka hi ku landza label ya yona",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Any product described as natural",
              "xitsongaDraft": "Product yin'wana ni yin'wana leyi hlamuseriwaka yi ri natural",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A neighbour’s dose for a different crop",
              "xitsongaDraft": "Dose ya muakelani ya crop yo hambana",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Crop, pest, dose, protection and harvest waiting instructions matter. A natural origin does not make an improvised treatment safe or suitable.",
            "xitsongaDraft": "Crop, pest, dose, protection and harvest waiting instructions i swa nkoka. Natural origin a yi endli leswaku improvised treatment yi hlayiseka kumbe yi faneleka.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?",
            "xitsongaDraft": "Matluka ya brassica ya murimi ma ri karhi ma hundzuka yellow. Loko a nga si ehleketa leswaku i pests, u fanele a kambela yini ku sungula?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Whether it's actually a soil nutrient or watering issue",
              "xitsongaDraft": "Xana hakunene i xiphiqo xa soil nutrient kumbe xa ku cheleta?",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whether the moon phase is right for treatment",
              "xitsongaDraft": "Loko moon phase yi fanele treatment",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whether her neighbour has the same problem",
              "xitsongaDraft": "Loko muakelani wa yena a ri ni xiphiqo lexi fanaka",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whether it's aphids specifically",
              "xitsongaDraft": "Loko ku ri aphids specifically",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 0,
          "rationale": {
            "sourceEnglish": "Yellowing has several common causes, and a soil or watering issue needs a completely different fix than a pest does — checking first avoids wasted treatment.",
            "xitsongaDraft": "Yellowing yi ni swivangelo swo hlayanyana leswi tolovelekeke, naswona xiphiqo xa soil kumbe xa ku cheleta xi lava ku lulamisiwa hi ndlela leyi hambaneke hi ku helela ni leyi lavekaka eka pest — ku kambela ku sungula swi papalata ku tirhisa treatment swa hava.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    },
  ],
  holds: [
    ...sourceParagraphs.slice(0, 10).map((sourceText, index) => ({
      lessonId: sourceLesson.id,
      field: `body[${index}]`,
      sourceText,
      reason: 'Keep all staple recommendations and species-specific food, seed, storage, water, and growing-condition claims exact English.'
    })),
    { lessonId: sourceLesson.id, field: 'body[14]', sourceText: sourceParagraphs[14], reason: 'Keep the full “two or more staples” scope exact English until a fluent reviewer confirms wording that cannot narrow the claim.' },
    { lessonId: sourceLesson.id, field: 'infographicAlt', sourceText: sourceLesson.infographicAlt!, reason: 'The illustration names staple crop forms; retain exact English.' },
    { lessonId: sourceLesson.id, field: 'quiz', sourceText: sourceLesson.quiz.map(item => `${item.q}\n${item.rationale}`).join('\n\n'), reason: 'Keep the remaining quiz options and rationales exact English because they carry crop-specific seed-genetics and wet-ground claims; question stems are drafted separately.' },
  ],
};
