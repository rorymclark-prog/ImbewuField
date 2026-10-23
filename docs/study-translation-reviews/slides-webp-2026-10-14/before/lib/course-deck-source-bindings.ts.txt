import { COURSE_TRANSCRIPTS } from './course-transcripts';

/**
 * Immutable, source-bound snapshot for the existing isiZulu deck transcript.
 * It verifies exact text, order, count, registered titles and media identity.
 * The snapshot proves pairing only; it does not establish translation quality.
 */
export interface IsiZuluDeckSourceBinding {
  readonly moduleId: string;
  readonly slide: number;
  readonly source: readonly string[];
  readonly recordedTarget: readonly string[];
  readonly sourceHeading: string;
  readonly registeredEnglishTitle: string;
  readonly registeredZuluTitle: string;
  readonly sourceHash: string;
  readonly targetHash: string;
  readonly imageUrl: string;
  readonly imageSha256: string;
  readonly audioUrl: string;
  readonly audioSha256: string;
  readonly reviewStatus: 'unreviewed';
  readonly semanticReview: 'not-established-by-inventory';
}

const bindings = [
  {
    "moduleId": "intro-permaculture",
    "slide": 1,
    "source": [
      "Before you dig anything, it helps to know how the decisions get made.",
      "This module is the foundation for everything else in the course. Three ethics, a set of design principles, and one simple way to organise your land.",
      "None of it needs money. All of it changes where you put things, and how far you walk every day.",
      "Think about your own plot. Which part of it do you visit most often?"
    ],
    "recordedTarget": [
      "Ngaphambi kokumba noma yini, kuyasiza ukwazi ukuthi izinqumo zenziwa kanjani. Le module iyisisekelo sakho konke okunye okukulesi sifundo: ama-ethics amathathu, ama-design principles, nendlela elula yokuhlela umhlaba wakho. Akukho kulokhu okudinga imali. Konke kushintsha ukuthi ubeka kuphi izinto nokuthi uhamba ibanga elingakanani nsuku zonke.",
      "Cabanga ngendawo yakho. Iyiphi ingxenye oyivakashela kakhulu?"
    ],
    "sourceHeading": "Introduction to Permaculture",
    "registeredEnglishTitle": "Introduction to Permaculture",
    "registeredZuluTitle": "Isingeniso Se-Permaculture",
    "sourceHash": "518e148693dcf0b74ad8f594a6c18681077d339700c0b899d3ca178d2b9f4133",
    "targetHash": "b4542476100ee76e63085d44f63e55472d39a25bc844b333c86358c40e1d5ce4",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-01.jpg",
    "imageSha256": "3b2a53c79e058fad6ce2e3f4324854794c29d9f7e4e0e06b1b7b094e77a3024a",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-01.mp3",
    "audioSha256": "bf5122c67ee1cdebdff8705e9e64932e0df63a04ede983b334f0e5f4654c2c47",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 2,
    "source": [
      "A good design saves work before you pick up a spade.",
      "Most of the effort on a smallholding is not planting or harvesting. It is walking, carrying and fixing what was put in the wrong place.",
      "Permaculture is a way of deciding where things go, so the land works with you instead of against you.",
      "Think of one job on your farm that takes longer than it should. Where does the time actually go?"
    ],
    "recordedTarget": [
      "Ukuhlela kahle konga umsebenzi ungakathathi ifosholo. Umsebenzi omningi epulazini elincane awukho ekutshaleni nasekuvuneni. Usekuhambeni, ekuthwaleni nasekulungiseni izinto ezibekwe endaweni engafanele. I-Permaculture iyindlela yokunquma ukuthi izinto zibekwa kuphi, ukuze umhlaba usebenze nawe esikhundleni sokukuvimba.",
      "Cabanga ngomsebenzi owodwa epulazini lakho othatha isikhathi eside kunalokho okufanele. Isikhathi sihambephi ngempela?"
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "9e15f4c8ba363f133e9db01ba88ea8205342ddd09cd866648640da498d18ae22",
    "targetHash": "ec14d80ce6e664484c077f792aa814fef2e7aa768a2cf60a65bdcc1a9704a473",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-02.jpg",
    "imageSha256": "b6e40a20da7c498b4ee081631143748507ac0b286a2a14dfcdaaf2280f4060d4",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-02.mp3",
    "audioSha256": "049c37059fc1df745a992b325dd7ed0da254537e8be2b51bdf689291fe74fbbf",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 3,
    "source": [
      "By the end of this module you will be able to do three things.",
      "Name the three ethics, and use them to settle a decision that has no obvious answer.",
      "Name the design principles that matter most on your land, and say why.",
      "Sketch your zones and your sectors on one sheet of paper.",
      "That sketch is the skeleton of every plan you make after this."
    ],
    "recordedTarget": [
      "Ekupheleni kwale module uzokwazi ukwenza izinto ezintathu: ukusho ama-ethics amathathu, uwasebenzise ekwenzeni isinqumo esingenayo impendulo esobala; ukusho ama-design principles abaluleke kakhulu emhlabeni wakho uchaze nokuthi kungani ebalulekile; nokudweba ama-zone nama-sector akho ephepheni elilodwa.",
      "Lowo mdwebo uyisisekelo sawo wonke amapulani ozowenza emva kwalokhu."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "c82b67c66a80b7cc687e36678398fee9e495bdc82315cc52baeb400b1ca71fab",
    "targetHash": "1126f3a3477f601b3db45c15d5422655b3d864a1508be4e8285dda6ac54e214b",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-03.jpg",
    "imageSha256": "19305071271778fb20cd5009394cf91ff695b4b81ad50b4880b9dfea28d26be8",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-03.mp3",
    "audioSha256": "9878d825a92f1f49f6f9ac68ee982e3c870a9dbe4369eb91eec412320e1b10db",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 4,
    "source": [
      "The first ethic is Earth Care.",
      "It means treating soil, water, plants and animals as living systems to protect, not resources to use up.",
      "A system you use up stops paying you. A system you protect keeps paying you.",
      "Look at one patch of bare soil on your land. Is anything protecting it right now?"
    ],
    "recordedTarget": [
      "I-ethic yokuqala yi-Earth Care. Kusho ukuphatha inhlabathi, amanzi, izitshalo nezilwane njengezinhlelo eziphilayo okufanele zivikelwe, hhayi njengezinsiza okufanele uzisebenzise zize ziphele. Uma usebenzisa uhlelo uluphelelisa, luyayeka ukukusiza. Uma uluvikela, luyaqhubeka lukusiza.",
      "Bheka indawo eyodwa yomhlabathi ongenalutho emhlabeni wakho. Kukhona yini okuyivikelayo njengamanje?"
    ],
    "sourceHeading": "Earth Care",
    "registeredEnglishTitle": "Earth Care",
    "registeredZuluTitle": "Ukunakekela Umhlaba",
    "sourceHash": "c21db604c1f7dd5e3cc8f6498eacfebe06aa21de3fcca36ef14d624b61cbc0a0",
    "targetHash": "c9752cea654e5c01f4fb0fd6e344800cd389708e1d7fe7e37058cb2dca7e00ef",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-04.jpg",
    "imageSha256": "c10a35e6dbe8f9364dea4ddf2005cd991172198e98cb342b9cee51dca3a6f27e",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-04.mp3",
    "audioSha256": "e94c1ab45c08747139c095dfabdb54dc230442f1105dd6f1a575a02bc1d0c08c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 5,
    "source": [
      "The second ethic is People Care.",
      "Your family's needs come first, then your community's.",
      "A farmer who sells every egg and every vegetable, and keeps nothing back for the family table, is skipping People Care.",
      "The farm is meant to feed the household that runs it.",
      "What comes off your land that your own family never eats?"
    ],
    "recordedTarget": [
      "I-ethic yesibili yi-People Care. Izidingo zomndeni wakho ziza kuqala, bese kulandela ezomphakathi wakho. Umlimi othengisa wonke amaqanda nayo yonke imifino, angashiyi lutho etafuleni lomndeni, uyeqa i-People Care. Ipulazi kufanele londle umndeni olisebenzayo.",
      "Yini ephuma emhlabeni wakho kodwa umndeni wakho ungayidli?"
    ],
    "sourceHeading": "People Care",
    "registeredEnglishTitle": "People Care",
    "registeredZuluTitle": "Ukunakekela Abantu",
    "sourceHash": "3b4604f2269a2abc7dd966a1551884db61c0b194e7c2fbd462cbc00abfc3b0de",
    "targetHash": "73d7ba6dfcb7829b2f9802c9b594c66604f174d96d4f012a2ab272a8f4342bf1",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-05.jpg",
    "imageSha256": "9ba3e9b07750477ba62738d16cbfe15b94de708b374c3823a4a20ae00cd60d67",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-05.mp3",
    "audioSha256": "28e58d3f12829514e70bd03fcd40683a559bf7f16e4f2cf53f1f37d408de1151",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 6,
    "source": [
      "The third ethic is Fair Share.",
      "Take only what you need, and return the surplus to the system — seeds, food, water, knowledge.",
      "A farmer who sells all his surplus mielies and keeps nothing back for compost or for seed is breaking this one. Nothing goes back.",
      "A community that fences off a shared spring is breaking it too.",
      "What does your land get back from you each season?"
    ],
    "recordedTarget": [
      "I-ethic yesithathu yi-Fair Share. Thatha lokho okudingayo kuphela, bese ubuyisela okusele ohlelweni — imbewu, ukudla, amanzi nolwazi. Umlimi othengisa wonke ama-mielies akhe asele, angashiyi lutho lokwenza i-compost noma lokugcina imbewu, uyephula le-ethic. Akukho okubuyela ohlelweni. Umphakathi ovalela indawo yomthombo osetshenziswa ngokuhlanganyela nawo uyayiphula le-ethic.",
      "Umhlaba wakho utholani kuwe ngesizini ngayinye?"
    ],
    "sourceHeading": "Fair Share",
    "registeredEnglishTitle": "Fair Share",
    "registeredZuluTitle": "Ukwabelana Ngokulinganayo",
    "sourceHash": "184721b482adc1558c5e06cbdecba6343592df84c5fa8aee4d52f6f520bba0e4",
    "targetHash": "27b825f086600b5a814c46b4f51eb17b7fe8ee872e993e235906a4f036b415d4",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-06.jpg",
    "imageSha256": "137c00d576570a6beab3df072ed60edd8d7a3d1b3eedf3dfe060192968272535",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-06.mp3",
    "audioSha256": "30562db482235d6b465a0fa9ce5b6a7763d36428042d75fc23890f5a9a5315c7",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 7,
    "source": [
      "A borehole serves your household. Neighbours ask for water too.",
      "First find out if sharing is allowed. Check whether the borehole can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly and keep watching the water level. People Care and Fair Share guide the agreement. Earth Care means protecting the source. Watching the level alone does not make extra use safe or allowed.",
      "Who could help you check the rules and the water supply?"
    ],
    "recordedTarget": [
      "I-borehole inikeza umndeni wakho amanzi. Omakhelwane bacela amanzi nabo. Qala uthole ukuthi ukwabelana ngamanzi kuvumelekile yini. Hlola ukuthi i-borehole ingakwazi yini ukusiza bonke abasebenzisi ngaphandle kokusebenzisa amanzi amaningi kakhulu. Uma ukwabelana kuvumelekile futhi kunamanzi anele, vumelanani ngokwabelana ngokulinganayo bese niqhubeka nibheka izinga lamanzi. I-People Care ne-Fair Share kuqondisa isivumelwano. I-Earth Care isho ukuvikela umthombo wamanzi. Ukuqapha izinga lamanzi kukodwa akusho ukuthi ukusebenzisa amanzi engeziwe kuphephile noma kuvumelekile.",
      "Ubani ongakusiza uhlole imithetho nokuthi amanzi akhona anele yini?"
    ],
    "sourceHeading": "Watch: One Decision, Three Ethics",
    "registeredEnglishTitle": "Watch: One Decision, Three Ethics",
    "registeredZuluTitle": "Bheka: Isinqumo Esisodwa, Ama-Ethics Amathathu",
    "sourceHash": "27b10b6a37078aad4cd517830b0ddb22acc67ab2f580867d25ee3239045dc12d",
    "targetHash": "053ee8914baae13f38cdfe0f4cd1744ec8c1d99136494cabc3d4f664465d49c1",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-07.jpg",
    "imageSha256": "0524978e63be0e533ae45ba94802bbf1f52edec78766b532a41ff87c738ee0d6",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-07.mp3",
    "audioSha256": "e25aa23792efd4d2543148078533557373178d26689fab9d6fd8a51c58e7234b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 8,
    "source": [
      "This is what the ethics are actually for.",
      "A neighbour asks to graze cattle after a drought. A flood damages your swales. Nobody has written down the answer.",
      "The ethics help you weigh the choices and explain your decision. Check the rules and ask permission where it is needed.",
      "Build these three into how you think before you build anything on the ground."
    ],
    "recordedTarget": [
      "Yilokho kanye ama-ethics akusiza ngakho. Umakhelwane ucela ukwelusela izinkomo ngemva kwesomiso. Isikhukhula silimaza ama-swale akho. Akekho obhale impendulo phansi. Ama-ethics akusiza ulinganise izinketho bese uchaza isinqumo sakho. Hlola imithetho futhi ucele imvume lapho kudingeka khona.",
      "Faka la ma-ethics amathathu endleleni ocabanga ngayo ngaphambi kokwakha noma yini emhlabeni."
    ],
    "sourceHeading": "When There Is No Rulebook",
    "registeredEnglishTitle": "When There Is No Rulebook",
    "registeredZuluTitle": "Lapho Kungekho Rulebook",
    "sourceHash": "c084e3c5bec8840f51de1b80e086c42379e6ba81ed2175b77a4c21b42506ff02",
    "targetHash": "f0219cf733412ea1d5b26b69c76dda401af51269ea40bb5f375773c6bea048e9",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-08.jpg",
    "imageSha256": "d6e4061fbf9905f2ce62c925a27f010881bcfa59327f6378183d312fdbdf26d9",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-08.mp3",
    "audioSha256": "bd7aaac8b222c770068b22157d97eea0dce8572d0c9b0025bedf42b020b68e03",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 9,
    "source": [
      "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept.",
      "You do not need all twelve to start. Three useful starting points for this lesson are: observe and interact, catch and store energy, and use edges and value the marginal.",
      "We will take those three one at a time."
    ],
    "recordedTarget": [
      "UDavid Holmgren wabeka izimiso eziyishumi nambili zokuklama encwadini ethi *Essence of Permaculture*. UBill Mollison noDavid Holmgren basungula ndawonye umqondo we-permaculture.",
      "Awudingi ukuqala ngazo zonke izimiso eziyishumi nambili. Kulesi sifundo sizoqala ngezintathu eziwusizo: bheka futhi ufunde ngokusebenzelana nomhlaba wakho; bamba ugcine amandla; futhi sebenzisa imiphetho, wazise nezindawo eziseceleni.",
      "Sizoxoxa ngalezi ezintathu, sinye ngesikhathi."
    ],
    "sourceHeading": "Twelve Principles",
    "registeredEnglishTitle": "Twelve Principles",
    "registeredZuluTitle": "Izimiso Eziyishumi Nambili",
    "sourceHash": "4f1bfb51545144fdde5ecfab67d8f431e042e5998582d35153846d26078358b5",
    "targetHash": "e034e0ab16a32433928964c76138b61459ea98b136544a6c2fa88affc246aad9",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-09.jpg",
    "imageSha256": "f7cd56351a00ab8dad2eba62fb061f12d2d6fb1941fa64f0219144aebb819440",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-09.mp3",
    "audioSha256": "3f77854754c52debde9727bfe232a5d5b3c488bb42878ce947d5c066f78f958d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 10,
    "source": [
      "Watch your land through a full season before you commit to major earthworks.",
      "One storm shows you one moment. A full wet season shows you the pattern — where water runs, where it pools, where it never reaches.",
      "This helps you understand the site. It does not by itself show that a swale is suitable or safe to build. Before digging, check the soil, slope, drainage and a safe overflow route that will not cause erosion or send damaging water to neighbours. Ask a trained local adviser to assess the site.",
      "Where does water leave your land? Do you actually know, or are you guessing?"
    ],
    "recordedTarget": [
      "Bheka umhlaba wakho isizini yonke ngaphambi kokunquma ukwenza umsebenzi omkhulu wokumba noma wokushintsha umhlaba.",
      "Isiphepho esisodwa sikukhombisa isikhathi esisodwa. Isizini yemvula yonke ikukhombisa iphethini — lapho amanzi egeleza khona, lapho ehlala khona, nalapho engafiki khona.",
      "Lokhu kukusiza uqonde indawo yakho. Kodwa ukubuka kukodwa akusho ukuthi ukumba ama-swale kulungele noma kuphephile kuleyo ndawo. Ngaphambi kokumba, hlola umhlabathi, umthambeka, ukugeleza kwamanzi nendlela ephephile amanzi angaphuma ngayo, engeke ibangele ukuguguleka komhlaba noma ithumele amanzi alimazayo komakhelwane. Cela umeluleki wendawo oqeqeshiwe ahlole indawo.",
      "Amanzi aphuma ngakuphi emhlabeni wakho? Uyazi ngempela, noma uyaqagela?"
    ],
    "sourceHeading": "Observe and Interact",
    "registeredEnglishTitle": "Observe and Interact",
    "registeredZuluTitle": "Bheka Bese Uxhumana Nomhlaba Wakho",
    "sourceHash": "8ecc07df84242f461187ff79e41cc3b9daf29eade625a79bf3e144768b422889",
    "targetHash": "afb6985805b5ba334fda26eb50ebd023509bf2a3e45184aad306c568157cde15",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-10.jpg",
    "imageSha256": "4ba8ce2ca760fa1457d864d72dbc400eb7bb526ffe5606a180a4190f33ee795c",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-10.mp3",
    "audioSha256": "adc264918c47df9823f6d74a4a40a80bb1ed57fa28045e176457f663a4fe2e72",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 11,
    "source": [
      "Harvest rain, sun and biomass before they leave your property.",
      "Every one of those arrives free and leaves free. Water runs off, leaves blow away, sun falls on bare ground.",
      "Compare the cost and work with the benefit on your own farm.",
      "Name one thing that arrives on your land free and leaves again without being used."
    ],
    "recordedTarget": [
      "Bamba futhi ugcine imvula, ilanga ne-biomass (njengamaqabunga nezinsalela zezitshalo) ngaphambi kokuba zihambe emhlabeni wakho.",
      "Konke lokhu kufika mahhala futhi kungahamba kungasetshenziswanga.",
      "Amanzi ayageleza aphume, amaqabunga aphephuka ahambe, nelanga likhanyise umhlabathi ongenalutho.",
      "Qhathanisa izindleko nomsebenzi kanye nenzuzo ongayithola epulazini lakho.",
      "Yisho into eyodwa efika emhlabeni wakho mahhala iphinde ihambe ingasetshenziswanga."
    ],
    "sourceHeading": "Catch and Store Energy",
    "registeredEnglishTitle": "Catch and Store Energy",
    "registeredZuluTitle": "Bamba Ugcine Amandla",
    "sourceHash": "a267616f08635507ebf55edecb96adc2f123a96a92b58381b721e8ae3c7c49b1",
    "targetHash": "4ec5121fcb6bacd0d52e4f5941abe9c43e711bf58e01cc5bfab221cc726e8b85",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-11.jpg",
    "imageSha256": "e7e47aa66346b54876e304cf9e8c0b88e87b031b0c7106ad37c136eccb16c808",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-11.mp3",
    "audioSha256": "e964f54bf933039b7aa0e55a6d402beea1d54f024f8a2ff6162ff675c8024ffb",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 12,
    "source": [
      "The edge is where two things meet — a fence line or the strip beside a path.",
      "These can be useful places to observe. Look at what already grows well along yours. That is the land telling you something.",
      "Which edge on your plot is doing nothing at the moment?"
    ],
    "recordedTarget": [
      "Umngcele yindawo lapho kuhlangana khona izinto ezimbili — njengolayini wocingo noma indawo eseceleni kwendlela.",
      "Lezi zingaba izindawo eziwusizo zokubuka. Bheka ukuthi yini esivele ikhula kahle ngasemngceleni wakho. Lokhu kungakufundisa okuthile ngomhlaba wakho.",
      "Imuphi umphetho endaweni yakho ongakasetshenziselwa lutho okwamanje?"
    ],
    "sourceHeading": "Use Edges and Value the Marginal",
    "registeredEnglishTitle": "Use Edges and Value the Marginal",
    "registeredZuluTitle": "Sebenzisa Imiphetho Nezindawo Eziseceleni",
    "sourceHash": "aed3caa411c4662c2875b93a059b5f7a70f4f1877617b4ecc84dde1c401a1389",
    "targetHash": "30a7b070ba3a4301632aced305257cdbb5e08ed1d25340abff4f302d05c3f99a",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-12.jpg",
    "imageSha256": "e9ac919c864ed5525cf9ee1ec999cc05031d801f35c81a114d0f6df79ffe0b6c",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-12.mp3",
    "audioSha256": "7ac44511453763100d6804a7ac4b66e0ba335884acb1fd02888c84575aeb0a68",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 13,
    "source": [
      "Use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage. This principle does not promise that a crop will survive every event.",
      "Two others worth knowing: produce no waste, so scraps become compost and compost becomes soil. And use small and slow solutions — a bucket can irrigate a bed with no electricity at all.",
      "What would one bad day cost you right now?"
    ],
    "recordedTarget": [
      "Sebenzisa futhi wazise ukwehlukahlukana kwezinto eziphilayo. Ukulimala kommbila yisichotho kuncike ekutheni isiphepho sinjani nokuthi ummbila ukhule kangakanani. Lesi simiso asithembisi ukuthi isitshalo sizosinda kuzo zonke izenzakalo.",
      "Ezinye izimiso ezimbili ongazazi: ungachithi lutho — izinsalela ziba umquba, umquba ube umhlabathi. Khetha izixazululo ezincane nezihamba kancane — ibhakede linganisela amanzi embhedeni ngaphandle kukagesi.",
      "Usuku olulodwa olubi lungakubiza ngani epulazini lakho manje?"
    ],
    "sourceHeading": "Use and Value Diversity",
    "registeredEnglishTitle": "Use and Value Diversity",
    "registeredZuluTitle": "Sebenzisa futhi wazise ukwehlukahlukana kwezinto eziphilayo",
    "sourceHash": "2ef37f0c1b2bdfaa5849b3705436b659db6ee6e3913c96c841a1538293292db5",
    "targetHash": "412880160853e1795b76a70f7bad58c909b795b889d8011963a1a551b21ff190",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-13.jpg",
    "imageSha256": "ae049fb97441baa8d676ef39239918feebf8406997377b5bf2ac1689158435d4",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-13.mp3",
    "audioSha256": "3836132d3226ebaa9ee8c3c4b5079ffc41974c968b644f828d8fbe309528828d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 14,
    "source": [
      "Put each element where it works for its neighbours.",
      "A garden, fruit trees and a chicken run arranged so the chickens rotate through the beds after harvest is integration. Keep chickens away from crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage the bed safely before edible crops return. The chickens can clean up pests and add fertility instead of sitting idle in a fixed pen.",
      "The same three things, fenced apart, do only their own job.",
      "Pick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go."
    ],
    "recordedTarget": [
      "Beka into ngayinye lapho isiza khona izinto eziseduze nayo.",
      "Ingadi, izihlahla zezithelo nendawo yezinkukhu kungahlelwa ukuze izinkukhu zijikeleze emibhedeni ngemva kokuvuna. Gcina izinkukhu zingasondeli ezitshalweni ezivunelwa ukudliwa. Umquba omusha ungaba namagciwane. Ngaphambi kokutshala futhi ukudla okuzodliwa, cela umeluleki wezolimo akutshele ukuthi umbhede ungaphathwa kanjani ngokuphepha.",
      "Izinkukhu zingasiza ekudleni ezinye izinambuzane nasekufakeni umquba, esikhundleni sokuhlala zinganyakazi esibayeni esisodwa.",
      "Lezi zinto ezintathu uma zibiyelwe zahlukaniswa, ngayinye yenza umsebenzi wayo kuphela.",
      "Khetha izimiso ezimbili noma ezintathu ezihambisana nenkinga yakho enkulu, uzisebenzise. Ezinye uzoziqonda njengoba uqhubeka."
    ],
    "sourceHeading": "Integrate Rather Than Segregate",
    "registeredEnglishTitle": "Integrate Rather Than Segregate",
    "registeredZuluTitle": "Hlanganisa, Ungahlukanisi",
    "sourceHash": "2a52f920c0efd500f63cc1d0e5e44328c637e474c8a74c0e6dbb60a0987c01d0",
    "targetHash": "23dde6f3a52046ce19ba8f94314d2516e108c8d9f2758f7ea957486e2c0600c5",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-14.jpg",
    "imageSha256": "001d5cd83dd878f354edfa60a0b59a9a269826256383ebc84c2d69d145f6f66a",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-14.mp3",
    "audioSha256": "3d6abe7faa9fded9a1cfc5c7f747fcaf049abdfcd654c8c177219db1d3006d36",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 15,
    "source": [
      "Zones run from 0 to 5, and they are about your feet, not your fences.",
      "Zone 0 is the house. In this example, Zone 1 is near the house and holds herbs and salad greens picked often.",
      "Zone 2 is the main garden and the chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly.",
      "Zone 4 is semi-wild — fruit trees and fodder that need occasional attention. Zone 5 is left wild."
    ],
    "recordedTarget": [
      "Ama-zone asuka ku-0 aye ku-5. Akhuluma ngokuhamba kwakho, hhayi ngezicingo.",
      "I-Zone 0 yindlu. Kulesi sibonelo, i-Zone 1 iseduze kwendlu futhi inamakhambi\nnemifino yesaladi oyikha kaningi.",
      "I-Zone 2 yingadi enkulu nendawo yezinkukhu, evakashelwa kanye noma kabili\nngosuku. I-Zone 3 yinsimu enkulu, evakashelwa masonto onke.",
      "I-Zone 4 i-semi-wild: izihlahla zezithelo nokudla kwezilwane\nokudinga ukunakekelwa ngezikhathi ezithile. I-Zone 5 ishiywa isesimweni\nsemvelo."
    ],
    "sourceHeading": "Zones: Organising by How Often You Visit",
    "registeredEnglishTitle": "Zones: Organising by How Often You Visit",
    "registeredZuluTitle": "Ama-Zone: Ukuhlela Ngokuthi Uvakashela Kangaki",
    "sourceHash": "496ea29c2cbb62d652402857715adaea4a14b93f89c45cb40bff2e3b2d0625c1",
    "targetHash": "18b4239d0ae07a46fd105795f332376716423a0faebb5dadd7008ced738cb42d",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-15.jpg",
    "imageSha256": "6f57d9be42e56ff501d9f0cdd477eaddf6b9cd00fd2ecc58d2508f386ba61f75",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-15.mp3",
    "audioSha256": "2dea661cd8ead0252295e1ec6280a51c234c0ac352a0686742e1f5665728eb6c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 16,
    "source": [
      "Herbs you pick often are easier to tend near the house.",
      "Put them far away, and the long walk may mean you miss a visit. The herbs may be neglected.",
      "Think about the paths you walk each day.",
      "What do you visit often that could be closer?"
    ],
    "recordedTarget": [
      "Amakhambi owakha kaningi kulula ukuwanakekela uma eseduze kwendlu.",
      "Uma ukude nawo, ukuhamba ibanga elide kungakwenza uphuthelwe ukuwavakashela.\nAngase anganakekelwa kahle.",
      "Cabanga ngezindlela ozihamba nsuku zonke.",
      "Yini oyivakashela kaningi engase isondezwe?"
    ],
    "sourceHeading": "Keep Daily Crops Close",
    "registeredEnglishTitle": "Keep Daily Crops Close",
    "registeredZuluTitle": "Gcina Izinto Ozikha Kaningi Ziseduze",
    "sourceHash": "402b9c7ed6e0986129cd0d08970d7f20c56f32d830d447c82fcb202f90aafb79",
    "targetHash": "82952edb1bfd5e2cb834a5492215c226799e307cb83ee1669b2a603dc5230604",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-16.jpg",
    "imageSha256": "c0c372608bd62f3a9da86450d27e98ab19b912e41f895442e7824efa744bd269",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-16.mp3",
    "audioSha256": "4c776e7a0f20cb1ea1a2f00a68ecccda0a8d2d6887271ec80a70212971cf1030",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 17,
    "source": [
      "This is the point of the whole exercise.",
      "Zones help organise space around your effort — the walking, the carrying and the checking that fills a real day.",
      "The more often something needs you, the closer it lives. That can save walking and work over a season.",
      "Stand at your kitchen door. What can you reach without thinking about it?"
    ],
    "recordedTarget": [
      "Yilona iphuzu lalo msebenzi.",
      "Ama-zone asiza ukuhlela izindawo ngokomsebenzi wakho: ukuhamba, ukuthwala\nnokuhlola okugcwalisa usuku.",
      "Into ekudinga kaningi ingabekwa eduze. Lokho kunganciphisa ukuhamba\nnomsebenzi phakathi nesizini.",
      "Yima emnyango wasekhishini. Yini ongayifinyelela kalula?"
    ],
    "sourceHeading": "Zones Plan Your Labour",
    "registeredEnglishTitle": "Zones Plan Your Labour",
    "registeredZuluTitle": "Ama-Zone Asiza Ukuhlela Umsebenzi",
    "sourceHash": "9dec584b9d0df2793fe19fc50189d138655f106a5d0c3883a63cd818aa8e7eb8",
    "targetHash": "92cfbb4600a8ba370556fdd289661f006e9225a7365115ec5e5970bea163f7d5",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-17.jpg",
    "imageSha256": "d122cc346850181bf587f9ebbdcc76dd9b9b987a0ffd253f2c0d19b53fd8c674",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-17.mp3",
    "audioSha256": "b3d75461dbf9de6172e123c4d2b7399c61a0b74953a159099372f5bd133b6f06",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 18,
    "source": [
      "Zones come from inside your land. Sectors come from outside it.",
      "Sun, wind, rain, flood and fire all arrive across your boundary whether you plan for them or not.",
      "Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land.",
      "Which direction does the weather that damages you come from?"
    ],
    "recordedTarget": [
      "Ama-zone aqala ngaphakathi kwendawo yakho. Ama-sector akhombisa amandla\nezivela ngaphandle kwayo.",
      "Ilanga, umoya, imvula, izikhukhula nomlilo kungafika kunqamule umngcele\nwakho, noma ungakuhlelelanga.",
      "Bheka ukuthi umoya onamandla uvela ngakuphi epulazini lakho. Amarekhodi\nesiteshi sezulu esiseduze angakusiza uhlole uhlangothi lomoya. Bheka lapho\namanzi emvula engena khona nalapho egeleza khona emhlabeni wakho.",
      "Isimo sezulu esikulimazayo sivela ngakuphi?"
    ],
    "sourceHeading": "Sectors: The Energies Arriving From Outside",
    "registeredEnglishTitle": "Sectors: The Energies Arriving From Outside",
    "registeredZuluTitle": "Ama-Sector: Izinto Ezifika Zivela Ngaphandle",
    "sourceHash": "ffb24e1167185fe86e56390a5df92548d9c2e9d5319c8ff8a077cfa5e709e461",
    "targetHash": "c69a73880299f187dbe05d003a4c882be0433a0112e987086f9011d18bc0d675",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-18.jpg",
    "imageSha256": "c95a9f1bf820adfb6126cb1f5ad9a31535ebdb6d16880f2c58fa894d82df3ed2",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-18.mp3",
    "audioSha256": "e55390b99852d9daa67c01353ed19033b9ff281adef74f40752212770c085ae6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 19,
    "source": [
      "Look at this example. The wind comes from the north-west.",
      "The trees and shrubs stand between that wind and the crops.",
      "Some air passes through the windbreak. Other air moves over it or around its ends.",
      "The shelter can reduce wind speed behind it. The design and care of the windbreak matter.",
      "On your own site, observe the damaging winds before choosing where to plant. This picture is not a planting plan."
    ],
    "recordedTarget": [
      "Bheka lesi sibonelo. Umoya uvela enyakatho-ntshonalanga.",
      "Izihlahla nezihlahlana zimi phakathi kwalowo moya nezitshalo.",
      "Omunye umoya udlula phakathi kwe-windbreak. Omunye udlula phezu kwayo noma\nuzungeze iziphetho zayo.",
      "I-windbreak inganciphisa ijubane lomoya ngemuva kwayo. Indlela eyakhiwe\nfuthi enakekelwa ngayo ibalulekile.",
      "Endaweni yakho, qala ngokubheka umoya olimazayo ngaphambi kokukhetha lapho\nuzotshala khona. Lesi sithombe asilona uhlelo lokutshala ipulazi lakho."
    ],
    "sourceHeading": "Watch: Shelter Between Wind and Crops",
    "registeredEnglishTitle": "Watch: Shelter Between Wind and Crops",
    "registeredZuluTitle": "Buka: I-Windbreak Phakathi Komoya Nezitshalo",
    "sourceHash": "4aca140235c45bad1657456cd7505053670e7ba55c1a5e4af7cf02482a1ad452",
    "targetHash": "b1ceefb2b52116cd5a4d575c0629941048786e40cf2abc73a9198f0bbd5f7145",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-19.jpg",
    "imageSha256": "dff3ac76d4e5a24771af7f677c2f5db90abe329f1a2f46ddb79f335dc7023595",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-19.mp3",
    "audioSha256": "c1da3a5024c945953f22d08182829fa993b4830606d57827026f7bdc270d8d85",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 20,
    "source": [
      "Draw your boundary. Mark the house. Draw the rings outward by how often you visit.",
      "Then draw arrows in from outside for sun, wind, fire and water.",
      "That sheet of paper is the skeleton of your design. Everything else in this course hangs on it.",
      "It does not need to be neat. It needs to be true."
    ],
    "recordedTarget": [
      "Dweba umngcele wakho. Maka indlu. Dweba izindawo ezisuka eduze ziye kude\nngokuthi uvakashela kangaki.",
      "Bese udweba imicibisholo engena ivela ngaphandle, ekhombisa ilanga,\numoya, umlilo namanzi.",
      "Lelo phepha liyisisekelo sohlelo lwakho. Okunye okulesi sifundo kungakhiwa\nphezu kwalo.",
      "Akudingeki libe lihle kakhulu. Kudingeka likhombise indawo yakho ngokunembile."
    ],
    "sourceHeading": "Sketch It And You Have A Design",
    "registeredEnglishTitle": "Sketch It And You Have A Design",
    "registeredZuluTitle": "Dweba Ukuze Uqale Uhlelo",
    "sourceHash": "845a0c352b061bd875cdb2cab06c919d06949553492909b454c076dd98dcff81",
    "targetHash": "07b708705c2ac103258a82d64636201a47ac55f8010f7ca7382cfb7ab85f238d",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-20.jpg",
    "imageSha256": "4e39c78c7ecf9c5d39ff6b81bd8d0351b46c67416785fc6a4db86a829b83bf83",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-20.mp3",
    "audioSha256": "8e9f15e760677a6e812e365283df94d32db2b08f3b4a3d0253ed1c3ddc2aff33",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 21,
    "source": [
      "Sketch your own zones and sectors on one sheet of paper.",
      "Mark Zone 0 and Zone 1 first, then work outward as far as your land goes.",
      "Add an arrow for each energy that arrives from outside, and label where it comes from.",
      "Photograph the sketch."
    ],
    "recordedTarget": [
      "Dweba ama-zone nama-sector akho ephepheni elilodwa.",
      "Qala ngokumaka i-Zone 0 ne-Zone 1, bese uqhubeka ngaphandle kuze kufike\nemngceleni wendawo yakho.",
      "Faka umcibisholo wento ngayinye efika ivela ngaphandle, ubhale ukuthi\nivela ngakuphi.",
      "Thatha isithombe somdwebo."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wasensimini",
    "sourceHash": "338943132b28d0a5b67a4c68906f4a5a3a0402f6cb6419dc5b981556418c14bb",
    "targetHash": "43fa913484de7dc2d97c54eab01a33ae08d7c9aacf1cff81449e30c6bbe0408e",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-21.jpg",
    "imageSha256": "198240d37fd85dbc060a3fbce3657c36ae75d3f632119aba01cdf41388849c8e",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-21.mp3",
    "audioSha256": "6a0f9a393afa3a53d1fb83be0db511879099abc7bdc7b6257e30dd8b76295847",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 22,
    "source": [
      "Walk out and check your sketch against the ground.",
      "Stand at the kitchen door and count what is really in Zone 1 today.",
      "Find one thing planted further away than how often you use it, and write down where it should move to.",
      "Then ask one older neighbour which direction the worst wind comes from, and compare their answer with your arrow."
    ],
    "recordedTarget": [
      "Hamba uyohlola umdwebo wakho emhlabeni wangempela.",
      "Yima emnyango wasekhishini ubale okukhona ngempela ku-Zone 1 namuhla.",
      "Thola into eyodwa etshalwe kude uma uqhathanisa nokuthi uyisebenzisa\nkaningi kangakanani. Bhala ukuthi ingabekwa kuphi.",
      "Bese ubuza umakhelwane osekhulile ukuthi umoya olimazayo uvela\nngakuphi. Qhathanisa impendulo yakhe nomcibisholo wakho."
    ],
    "sourceHeading": "Field Action",
    "registeredEnglishTitle": "Field Action",
    "registeredZuluTitle": "Isenzo Sasensimini",
    "sourceHash": "a4590f5821c4e5578ce0cc946bda0e9b94cb8e1da17ec1f9609c862374b4dcce",
    "targetHash": "b5e4868d0a0b70751aaa159dae1e9ef39452c461d4a1cf8b7001c382651a2ed8",
    "imageUrl": "/course-decks/intro-permaculture/zu/slide-22.jpg",
    "imageSha256": "594d43839fbd23119dd1fe976bf596d3f852b377f83045365deef8b62498b067",
    "audioUrl": "/course-audio/intro-permaculture/zu/slide-22.mp3",
    "audioSha256": "4b0af9688744a95a084b5699a8c6fa9101c74562a086c9b9eb985d3db342e7af",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 1,
    "source": [
      "A permaculture course for South African smallholder farmers.",
      "Read the land before you change it. Find where water moves, where sunlight falls, where wind travels, and where cold air settles.",
      "These observations guide practical choices for crops, trees, buildings, roads, and water. They are the start of good design."
    ],
    "recordedTarget": [
      "Lesi yisifundo se-Permaculture sabalimi abancane baseNingizimu Afrika. Funda umhlaba ngaphambi kokuwushintsha. Thola lapho amanzi ehamba khona, lapho ukukhanya kwelanga kuwela khona, lapho umoya udlula khona nalapho umoya obandayo uqoqana khona. Lokhu okubukayo kukuqondisa ekukhetheni indawo yezitshalo, izihlahla, izakhiwo, imigwaqo namanzi. Kuyisiqalo sokuhlela kahle."
    ],
    "sourceHeading": "Reading the Landscape",
    "registeredEnglishTitle": "Reading the Landscape",
    "registeredZuluTitle": "Ukufunda Indawo",
    "sourceHash": "90519c5148524ea07f5dbd0b1d0cfe55547e2cf20107bde4eba75d15acd7623b",
    "targetHash": "fa67b598f96a06192b6da1fbaea967e3bd5b5da5eb8cd95f259329d77833918e",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-01.jpg",
    "imageSha256": "07ac3db0e4cef80a4f9093c6bfa3054b25db381e57be7a28031be415a0be072b",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-01.mp3",
    "audioSha256": "af4e167b6af15f71742d326d2230c8f9efc9ff0024d9a930a86256bc19866c79",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 2,
    "source": [
      "Every farm has patterns that work before we add anything.",
      "Rain already follows lines across the land. The sun already warms some places more than others. Wind already finds gaps and ridges. Cold air already settles in hollows.",
      "When you read these patterns first, you place water, crops, trees, and buildings where they can work with the land."
    ],
    "recordedTarget": [
      "Ipulazi ngalinye selinendlela izinto ezihamba ngayo ngaphambi kokuba sengeze noma yini. Imvula isivele ilandela imigqa emhlabeni. Ilanga lifudumeza ezinye izindawo ngaphezu kwezinye. Umoya uthola izikhala namagquma, kanti umoya obandayo uqoqana ezindaweni eziphansi. Funda lezi zindlela kuqala, bese ubeka amanzi, izitshalo, izihlahla nezakhiwo lapho zingasebenzisana khona nomhlaba."
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "1243dec0fa347562a4f133dbab49dd039f73e446de16bc2ba6abd23a9ca6853c",
    "targetHash": "2527c5a3954d5616f2603d15626ca0f3526772e73022c1402007a1f56d2f106e",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-02.jpg",
    "imageSha256": "69232d4c724d5e26504a790852e84f0e2f124e5eebd0e82aa084e7a6a3816255",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-02.mp3",
    "audioSha256": "c5dedb087b4d7cc511435a8530907cf018ea16717cbcbbc389a6e329ce742770",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 3,
    "source": [
      "By the end of this module, you will be able to follow water across your land and find where it leaves.",
      "You will read sun angles, shade, wind, frost, and slope.",
      "You will use an A-frame level to trace contours.",
      "You will draw a simple site map with water flow, seasonal winds, frost pockets, existing vegetation, zones, and sectors."
    ],
    "recordedTarget": [
      "Ekupheleni kwale module, uzokwazi ukulandela amanzi emhlabeni wakho uthole nalapho ephuma khona. Uzokwazi ukufunda indlela ilanga elimi ngayo, imithunzi, umoya, isithwathwa nemithambeka. Uzokwazi ukusebenzisa i-A-frame level ukulandela imigqa ye-contour. Uzodweba imephu elula yendawo ebonisa ukuhamba kwamanzi, imimoya yezinkathi zonyaka, izindawo eziqoqana kuzo isithwathwa, izitshalo ezikhona, ama-zone nama-sector."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "ca5da4f3660893881376bd53032b3c7626f265e115d71ac0c4ca63bcc0635484",
    "targetHash": "8b5a6258676487ce31bf95a6b458f04ee58e40c7fba5972812bf424e618b850b",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-03.jpg",
    "imageSha256": "8d3988e5b7b209689a92a271807182a30da7ddf53b602e48f0894cd92eb449ca",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-03.mp3",
    "audioSha256": "0cdcec0ddf41296e4597bb7cf118189489179b64de6841a11db254ba1afaa31d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 4,
    "source": [
      "Before you harvest water, learn where it already goes.",
      "Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, ponds, and where water leaves your property.",
      "Some excess water needs a safe route away so it does not cause damage."
    ],
    "recordedTarget": [
      "Ngaphambi kokuvuna amanzi, qala ufunde ukuthi asevele eya kuphi. Ngesikhathi semvula enkulu, bheka usemhlabeni ophephile. Hamba uhlole umhlaba kuphela uma sekuphephile ngemva kwemvula. Bheka imifudlana emincane, izindawo lapho amanzi esabalala khona, amachibi, nalapho ephuma khona emhlabeni wakho. Amanye amanzi amaningi adinga indlela ephephile yokuphuma ukuze angabangeli umonakalo."
    ],
    "sourceHeading": "Lesson 1: Where Rain Goes",
    "registeredEnglishTitle": "Lesson 1: Where Rain Goes",
    "registeredZuluTitle": "Isifundo 1: Lapho Imvula Iya Khona",
    "sourceHash": "b11268a2dcf7909d3859cf33e97dca753939f10ce0c83cbae9defd2b760dc1e4",
    "targetHash": "098ee4ef28fa5c9e880556c562264a92ceef873de615e057fff7ea59f48ae7f8",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-04.jpg",
    "imageSha256": "955d3c7eee8397ed63c0ba71ffa888e80779e2402f9ed4b5d34145691786b5d8",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-04.mp3",
    "audioSha256": "10e2418ffc8dae69fd7d8c0217b59127e187eca261475fb0256d7cf76fb95083",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 5,
    "source": [
      "The picture shows rain moving downhill. Follow where it speeds up, spreads, sinks, gathers, and leaves the land."
    ],
    "recordedTarget": [
      "Isithombe sibonisa imvula yehla ngomthambeka. Bheka lapho amanzi egeleza khona ngesivinini esikhulu, esabalala khona, ecwila emhlabathini khona, eqoqana khona nalapho ephuma khona emhlabeni."
    ],
    "sourceHeading": "Watch: Water Slows, Sinks, and Leaves",
    "registeredEnglishTitle": "Watch: Water Slows, Sinks, and Leaves",
    "registeredZuluTitle": "Buka: Amanzi Ayancipha, Angene, Aphume",
    "sourceHash": "155153089b8b638506f91e13a0d0627f1e85609144df93a996a0160667a918ae",
    "targetHash": "b7ae46a8370e3edb9e57723b7698446f531da20a5eb7584e91a624442a92a04e",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-05.jpg",
    "imageSha256": "4b6dc697fd52821de19a99b2459e9a53efa77c1abfb330e42cbd2638eb104c52",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-05.mp3",
    "audioSha256": "a203d7e38f6ba77549f0773740a3ad572385f8fed1e08885ff916c450c899f74",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 6,
    "source": [
      "Build an A-frame level from three poles and a weighted string.",
      "Walk it across the land to find points at the same height. Join these points to trace a contour line.",
      "An A-frame can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser."
    ],
    "recordedTarget": [
      "Yakha i-A-frame level ngezigxobo ezintathu nentambo enesisindo esilengayo. Hambisa i-A-frame emhlabeni ukuze uthole amaphuzu asezingeni elifanayo. Xhuma la maphuzu ukuze ulandele umugqa we-contour. I-A-frame ingakusiza umake amaphuzu asezingeni elifanayo futhi ulandele umugqa we-contour, kodwa izimpawu zayo ziyizinto ozibonile; azilona uhlelo lokwakha izakhiwo zomhlaba futhi azibonisi ukuthi ukumba kulungele le ndawo noma kuphephile. Ngaphambi kokumba, cela ukuba indawo ihlolwe. Umhlabathi, umthambeka, ukugeleza kwamanzi, ukugeleza kwamanzi esiphepho nendlela ephephile yokuphuma kwamanzi konke kubalulekile. Cela umeluleki wendawo oqeqeshiwe akusize."
    ],
    "sourceHeading": "Trace Contours with an A-Frame",
    "registeredEnglishTitle": "Trace Contours with an A-Frame",
    "registeredZuluTitle": "Landela Amaphuzu Asezingeni Elilodwa Nge-A-Frame",
    "sourceHash": "d20a40707dda8c940f61d5d368c08ab6914c65efc2fb74c633d5806477e6e993",
    "targetHash": "9bc475632159219d1ed6fd3b28736d23fbf3d01fa1559ece435b1f175c321b6e",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-06.jpg",
    "imageSha256": "8ffaf70625733434283eec6a7654c5ab5812fc98f5d4b2b1537caf712f283781",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-06.mp3",
    "audioSha256": "1ddc2ea085344cd99411354c7f36d545c5c728f0febfc2ed4aa84f51593b3f94",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 7,
    "source": [
      "Water picks up speed and erosive force as it runs downhill.",
      "There is no one placement rule for every slope. Observe where water moves and gathers.",
      "Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water."
    ],
    "recordedTarget": [
      "Amanzi athola isivinini namandla okuguguleka komhlabathi njengoba ehla ngomthambeka. Awukho umthetho owodwa wokubeka izakhiwo zamanzi osebenza kuyo yonke imithambeka. Bheka lapho amanzi ehamba khona nalapho eqoqana khona. Imigqa ye-contour ebekwe kabi ingakhulisa ukuguguleka komhlabathi, kanti umhlabathi omunca amanzi kancane ungagcina amanzi amaningi kakhulu. Khetha izakhiwo zamanzi ezifanele indawo yakho, bese uhlela indlela ephephile yokuphuma kwamanzi amaningi."
    ],
    "sourceHeading": "Observe Water Before You Build",
    "registeredEnglishTitle": "Observe Water Before You Build",
    "registeredZuluTitle": "Bheka Amanzi Ngaphambi Kokwakha",
    "sourceHash": "87212edf7482ab13f2163196ff17d8ea11242c40f31299a20f2c2a19d88dad99",
    "targetHash": "c66ad2fe6b1f96e388ae10285b5aecbe8b0d6ea977879c14a2ace5f69d030a95",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-07.jpg",
    "imageSha256": "f4528a9ccbc4495800c9bfe74c207448c1bacf5b5cb9d41b02ef907fcfa088da",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-07.mp3",
    "audioSha256": "9026d9b17f64a9711a3af8da366647135a7d26d498e3484bf5e462dbc8acb644",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 8,
    "source": [
      "In much of South Africa, especially in winter, the sun is to the north. Its path changes with the season and your location.",
      "North-facing slopes often get more sun and can be warmer and drier. South-facing slopes are often cooler and moister. Frost can collect in low hollows where cold air settles.",
      "Watch your own site before choosing where to place tender crops, trees, or buildings."
    ],
    "recordedTarget": [
      "Ezindaweni eziningi zaseNingizimu Afrika, ikakhulukazi ebusika, ilanga libonakala lisenyakatho. Indlela elihamba ngayo esibhakabhakeni iyashintsha ngokwenkathi nangendawo okuyo.",
      "Imithambeka ebheke enyakatho ivame ukuthola ilanga eliningi futhi ingafudumala yome kakhulu. Imithambeka ebheke eningizimu ivame ukuphola futhi ibe nomswakama omningi. I-frost ingaqoqana ezindaweni eziphansi eziyimigodi lapho kuhlala khona umoya obandayo.",
      "Bheka indawo yakho ngaphambi kokukhetha lapho uzobeka khona izitshalo ezizwela amakhaza, izihlahla noma izakhiwo."
    ],
    "sourceHeading": "Lesson 2: Read Sun and Shade",
    "registeredEnglishTitle": "Lesson 2: Read Sun and Shade",
    "registeredZuluTitle": "Isifundo 2: Funda Ilanga Nomthunzi",
    "sourceHash": "26b1c169470d6a46a8db5105b98845f4b907dbfe24a622cfa601a69b9c691d5d",
    "targetHash": "6753cae91dff456448b0502bccd1fc4faf68de1cf495ede44f1d8da6a5f2cf74",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-08.jpg",
    "imageSha256": "68f45ee34af4b02001ba58bc663a57051317f897e7d488cb9680e3de949519ed",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-08.mp3",
    "audioSha256": "524e9052191eb1b3c447735775c2341f7658e74c7203a1660609948142b76232",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 9,
    "source": [
      "Follow the sun, building, tree, and their shadows across the slope. Compare summer’s high sun with winter’s lower sun."
    ],
    "recordedTarget": [
      "Landela ilanga, isakhiwo, isihlahla nemithunzi yazo emthambekeni. Qhathanisa ilanga lasehlobo elibonakala liphezulu nelasebusika elibonakala liphansi."
    ],
    "sourceHeading": "Watch: Follow the Sun Across the Site",
    "registeredEnglishTitle": "Watch: Follow the Sun Across the Site",
    "registeredZuluTitle": "Buka: Landela Ilanga Endaweni",
    "sourceHash": "b9790bf43181114536069814c58d8b6a316a0991463f1796b6e8d5039a27cf73",
    "targetHash": "4cc3b062bb46741c11e7b7c835cacb2b54c5e29d157f43f9fd01eecb2d938403",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-09.jpg",
    "imageSha256": "64b884914b75f8409816546e80a32f747ec712586221516be1dd8312f55d6f0b",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-09.mp3",
    "audioSha256": "b18e3904d9938fa3c7b19fa0fd71dcd5dd2796abe9ded3f892c79e82aa9e44f0",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 10,
    "source": [
      "Winter sun is lower and farther north than summer sun.",
      "A wall or shade cloth can shade a bed longer in winter than in summer. Check the actual shadows before you build or fix a shade structure in place.",
      "Stand in the spot at 8am, midday, and 4pm on a winter's day. Watch where the shade falls."
    ],
    "recordedTarget": [
      "Ilanga lasebusika libonakala liphansi futhi lisenyakatho kakhulu kunelasehlobo.",
      "Udonga noma i-shade cloth kungafaka umbhede emthunzini isikhathi eside ebusika kunasehlobo. Ngaphambi kokwakha noma yisiphi isakhiwo esihlala endaweni yaso, hlola imithunzi ebonakala kuleyo ndawo ngempela.",
      "Yima kuleyo ndawo ngo-8 ekuseni, emini, nango-4 ntambama ngosuku lwasebusika. Bheka lapho umthunzi uwela khona."
    ],
    "sourceHeading": "Check Winter Shadows Before Building",
    "registeredEnglishTitle": "Check Winter Shadows Before Building",
    "registeredZuluTitle": "Hlola Imithunzi Yasebusika Ngaphambi Kokwakha",
    "sourceHash": "fef96bb394177e6567d1b2f178b59be73c354a13e85723c210db8d613803cf80",
    "targetHash": "552207079267286e73dc82024c58338b6afdcfc214984dab94adef18e645f590",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-10.jpg",
    "imageSha256": "34d0840eb7575bfbd2a52c235f9d1cb9570a1cda21b2e8ba82a4356f5f5c06ef",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-10.mp3",
    "audioSha256": "c05c4ed3c4e3b6ff66d46f284960cd5867d6c58dff67d70d8a37be17f2f369e7",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 11,
    "source": [
      "Pawpaw and young citrus are sensitive to frost.",
      "Keep tender plants out of known low frost pockets. Observe local frost before planting."
    ],
    "recordedTarget": [
      "I-pawpaw nezihlahla ezisencane ze-citrus ziyazwela ku-frost.",
      "Gcina izitshalo ezizwela amakhaza zingekho ezindaweni eziphansi ezaziwayo eziqongelela i-frost. Bheka ukuthi i-frost ivela kuphi endaweni yangakini ngaphambi kokutshala."
    ],
    "sourceHeading": "Protect Frost-Tender Plants",
    "registeredEnglishTitle": "Protect Frost-Tender Plants",
    "registeredZuluTitle": "Vikela Izitshalo Ezizwela Isithwathwa",
    "sourceHash": "d05c85879705d56d2b10c661f3029d01f065dbbd748bfd0d84b484888a7c5ebe",
    "targetHash": "0f99f103c6d77ac45a5a26b13a528d83a02bf4b96e8dd1f28ff35db07938b9a9",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-11.jpg",
    "imageSha256": "1788814857897c37bda367931239b2eb2261f340ad1f49fe38ffc5136e0cead9",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-11.mp3",
    "audioSha256": "bf7b42cf7eeafcb24877230cb88054b2c75dcd74bff4250d3391157870028933",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 12,
    "source": [
      "Wind can damage crops on a smallholding.",
      "The direction and strength of damaging wind change with region, season and your site's ridges and gaps. Walk the land on windy days. Record where damaging wind comes from and what it affects. Check local weather records before placing a windbreak.",
      "Wind, cold air and slope all matter when choosing places for crops and shelter."
    ],
    "recordedTarget": [
      "Umoya ungalimaza izitshalo epulazini elincane. Indawo ovela kuyo namandla omoya olimazayo kuyashintsha kuye ngesifunda, inkathi yonyaka, amagquma nezikhala ezisemhlabeni wakho. Hamba uhlole umhlaba ngezinsuku ezinomoya. Bhala phansi ukuthi umoya olimazayo uvela ngakuphi nokuthi uthinta ini. Hlola amarekhodi esimo sezulu endawo ngaphambi kokubeka i-windbreak. Umoya, umoya obandayo nomthambeka konke kubalulekile lapho ukhetha izindawo zezitshalo nezokukhosela."
    ],
    "sourceHeading": "Lesson 3: Read Wind, Frost, and Slope",
    "registeredEnglishTitle": "Lesson 3: Read Wind, Frost, and Slope",
    "registeredZuluTitle": "Isifundo 3: Funda Umoya, Isithwathwa Nomthambeka",
    "sourceHash": "d42d14a57002d72913dee90bc10c49a6be9d0774d167e7194f007eabbb5962cc",
    "targetHash": "9de0396df12fe87baa948f253563c65c517db882157345b67c1f28750badae96",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-12.jpg",
    "imageSha256": "4040e1d3884bcd6341eefe32406dcb07d07616d0ed331b3077966575d37e11f6",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-12.mp3",
    "audioSha256": "67cbfb1d86e497f2cd566aba66be3ef22f4c3813e7474be65bd5fc0dd62b3cd9",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 13,
    "source": [
      "A place sheltered from wind can still collect cold air. Check wind shelter and frost risk separately."
    ],
    "recordedTarget": [
      "Indawo evikelekile emoyeni isengaba yindawo lapho kuqoqana khona umoya obandayo. Hlola ukuvikeleka emoyeni nobungozi besithwathwa ngokwehlukana."
    ],
    "sourceHeading": "Watch: See Wind and Cold Air on the Map",
    "registeredEnglishTitle": "Watch: See Wind and Cold Air on the Map",
    "registeredZuluTitle": "Buka: Bona Umoya Nomoya Obandayo Kumephu",
    "sourceHash": "36b06f8546d6a33979ba4818ac3d4ea775ed34e935a16941630fe1c2bd26ef59",
    "targetHash": "95a3746716376b5b7960472e5ec44278a906517dc729646883da3a5492666560",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-13.jpg",
    "imageSha256": "f9cb5112e5ac230e62a55ee92237f70911f5826300deb11c52c70a33150b85c1",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-13.mp3",
    "audioSha256": "a9b9cbccf30a59e5fd426dcaf90ab239cef97fc10d3ffe81b93f682644f85ed8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 14,
    "source": [
      "On a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes.",
      "Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice.",
      "Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.",
      "Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before choosing a permanent position."
    ],
    "recordedTarget": [
      "Ngobusuku obucacile nobungenamoya, umoya obandayo ungehla ngomthambeka uqoqane ezindaweni eziphansi. Lezi zindawo zingabanda kakhulu kunemithambeka eseduze. Isithwathwa siyizinhlayiya zeqhwa ezakheka phezu kwendawo ebandayo. Inkungu iyodwa ayisho ukuthi sekwakheke lezo zinhlayiya zeqhwa, futhi isithwathwa singalimaza izitshalo kungabonakali iqhwa. Bheka iqhwa nomonakalo ezitshalweni, uqhathanise izindawo eziphansi nemithambeka, futhi uhlole amazinga okushisa aphansi lapho ukwazi khona. Maka izindawo lapho amakhaza noma umonakalo kuhlala khona isikhathi eside. Gcina izitshalo ezizwela amakhaza zikude nezindawo ezibandayo ozibonile.",
      "Qhathanisa izindawo ongakhetha kuzo zenkulisa yezithombo kuyo yonke inkathi yesithwathwa yasendaweni. Hlola amarekhodi endawo okushisa okuphansi noma ubuze umeluleki wezolimo wendawo ngaphambi kokukhetha indawo ehlala njalo."
    ],
    "sourceHeading": "Cold Air Flows Downhill",
    "registeredEnglishTitle": "Cold Air Flows Downhill",
    "registeredZuluTitle": "Umoya Obandayo Wehla Ngomthambeka",
    "sourceHash": "f79c2625a05909b216a70cd068189b6eb1f58ad317e770153024ea6ecab8f0ba",
    "targetHash": "c96461c9a5fca43efd2c1a0d99c59fb9980afed89663576b2f83f16eb49e02c7",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-14.jpg",
    "imageSha256": "de84d16da97425a71e4766489160138ac5b8fe6509729c8ba8c1e0211ba79ceb",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-14.mp3",
    "audioSha256": "c7fd2eca151716a9ed19efb3e340f1f3789c00636d8b0071fc5ec081a5c33915",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 15,
    "source": [
      "Put a frost-sensitive seedling nursery outside the cold pockets you have observed. Compare candidate places through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before choosing a permanent position. Check sun and damaging wind too. No hillside position guarantees freedom from frost.",
      "For tomatoes troubled by late blight, good airflow and morning sun can help leaves dry. Prolonged cool, damp weather can still favour the disease. Moving a bed alone does not control late blight. Seek local crop-health advice too."
    ],
    "recordedTarget": [
      "Beka inkulisa yezithombo ezizwela isithwathwa ngaphandle kwezindawo ezibandayo ozibonile. Qhathanisa izindawo ezingakhethwa kuyo yonke inkathi yesithwathwa yasendaweni. Hlola amarekhodi endawo okushisa okuphansi noma ubuze umeluleki wezolimo ngaphambi kokukhetha indawo ehlala njalo. Hlola nelanga nomoya olimazayo. Ayikho indawo esentabeni eqinisekisa ukuthi ngeke ibe nesithwathwa.",
      "Kumatamatisi ahlaselwe yi-late blight, ukuhamba komoya nelanga lasekuseni kungasiza amaqabunga ome. Isimo sezulu esibandayo nesinomswakama esiqhubeka isikhathi eside sisengasivumela lesi sifo ukuba sisabalale. Ukususa umbhede uwuyise kwenye indawo kukodwa ngeke kusilawule i-late blight. Funa neseluleko sendawo ngempilo yezitshalo."
    ],
    "sourceHeading": "Choose Airflow and Warmth",
    "registeredEnglishTitle": "Choose Airflow and Warmth",
    "registeredZuluTitle": "Khetha Ukuhamba Komoya Nokufudumala",
    "sourceHash": "d34b318bbdf18fec09f6bef6d49666debcc188ff6b77572ee9e52e81e69719ea",
    "targetHash": "94a9ae28a6c39416c671fd8fa5ea0c8a8e83a55ddc479e68b0d3f3d73cfcfc59",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-15.jpg",
    "imageSha256": "874ad9e74aff2f2f20012b023b1f126fd2fbaf866c15381d73069e59cd318179",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-15.mp3",
    "audioSha256": "e5364c56cdf2774d681bf10321de5b44a3f0e28e1c3c0c3b90608e1de2e03704",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 16,
    "source": [
      "A site map needs paper, a tape measure, a compass, and time to walk your land.",
      "Walk the boundary and make a first sketch. Mark it not to scale until you have checked its distances. Mark north. Add the house, trees, water, roads, and fences.",
      "Then draw the patterns you have observed. Your map becomes the design skeleton for the whole smallholding."
    ],
    "recordedTarget": [
      "Ukuze wenze i-site map, udinga iphepha, i-tape measure, i-compass nesikhathi sokuhamba emhlabeni wakho.",
      "Hamba emngceleni wenze umdwebo wokuqala. Maka ukuthi awukabi ngesikali kuze kube usuwahlolile amabanga. Maka inyakatho. Faka indlu, izihlahla, amanzi, imigwaqo nezicingo.",
      "Bese udweba amaphethini owabonile. Imephu yakho iba uhlaka lomklamo wesiqeshana sakho sonke somhlaba."
    ],
    "sourceHeading": "Lesson 4: Start Your Site Map",
    "registeredEnglishTitle": "Lesson 4: Start Your Site Map",
    "registeredZuluTitle": "Isifundo 4: Qala Imephu Yendawo Yakho",
    "sourceHash": "d9654911ad3bcc6ea700d3da0a2fdf8aa9dedb7620d4119223d779bc93cfe445",
    "targetHash": "3ee78e0485599253a14165f40b37db17e7b10a7706e91b72c556a315648337a4",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-16.jpg",
    "imageSha256": "3b8309701852a7d3e2b6fa59ef1a9b45f32a11ebd54715caab181fc9ff69fcbb",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-16.mp3",
    "audioSha256": "9ebd784b29beaf2c171fabbd745ac8a74e392e0d721e01ff252566fd6c7aa328",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 17,
    "source": [
      "Use the picture as a guide: boundary, buildings, roads, water, slopes, and direction arrows. Draw what already exists before planning changes."
    ],
    "recordedTarget": [
      "Sebenzisa isithombe njengesiqondiso: umngcele, izakhiwo, imigwaqo, amanzi, imithambeka nemicibisholo ekhombisa izinkomba. Dweba okukhona kakade ngaphambi kokuhlela izinguquko."
    ],
    "sourceHeading": "Watch: Draw the Land You Already Have",
    "registeredEnglishTitle": "Watch: Draw the Land You Already Have",
    "registeredZuluTitle": "Buka: Dweba Umhlaba Osuvele Unawo",
    "sourceHash": "ffba292a492e3a4c303f174087be4d131e7d4009e74c075cc9c7ddad19f4c288",
    "targetHash": "ed99e96654d69bb69af05f868caf5b70aa66cccd7d0a698dba4359c54e95031e",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-17.jpg",
    "imageSha256": "d550e9fc4563e968e9dd5e596880d0e7701079b66e2cb2f6ff54ae2b44ec1a4c",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-17.mp3",
    "audioSha256": "8ea251d2093e3bce4ae25def8551b837ebb92f00e77e77350bc872df574ac27b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 18,
    "source": [
      "Look for places where frost sits longest and where the ground smells damp during dry months.",
      "Notice existing vegetation. Mark where khakibos or blackjack grows thick.",
      "These plants can grow in disturbed places, but their presence alone does not show whether the soil is compacted. Check the soil before deciding what the patch means for your design."
    ],
    "recordedTarget": [
      "Bheka izindawo lapho i-frost ihlala khona isikhathi eside, nalapho umhlabathi unuka sengathi umanzi phakathi nezinyanga ezomile.",
      "Qaphela izitshalo ezikhona. Maka lapho i-khakibos noma i-blackjack ikhula khona kakhulu.",
      "Lezi zitshalo zingakhula ezindaweni eziphazamisekile, kodwa ukuba khona kwazo kukodwa akubonisi ukuthi umhlabathi ucindezelekile. Hlola umhlabathi ngaphambi kokunquma ukuthi leyo ndawo isho ukuthini ohlelweni lwakho."
    ],
    "sourceHeading": "Let Plants Help You Read Soil",
    "registeredEnglishTitle": "Let Plants Help You Read Soil",
    "registeredZuluTitle": "Vumela Izitshalo Zikusize Ufunde Umhlabathi",
    "sourceHash": "20faf75294716d1cde69e17d433daac79c709889fb315d990ce35154070b3644",
    "targetHash": "6895e139ca959f9de11a24c09e3c22fab7e2c12d0d9c7e2381cd01fc87cf81eb",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-18.jpg",
    "imageSha256": "8cbe07a15f009ee77cc49d72bfba4c8e5d60c7deb3536608d8184093a48239f0",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-18.mp3",
    "audioSha256": "2e015c166458890f54b6361e6ef306953dc93e8c1401390d40a8774ddbfdb232",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 19,
    "source": [
      "Mark summer and winter wind separately. They can come from different directions, so a windbreak or crop position that works in one season may be wrong in the other.",
      "Overlay your zones and sectors on the same base map.",
      "Update the sketch season by season. A pencil map you actually use is worth more than a perfect map drawn once."
    ],
    "recordedTarget": [
      "Maka ngokwehlukana umoya wasehlobo nowasebusika. Ungavela ezinhlangothini ezahlukene, ngakho i-windbreak noma indawo yezitshalo esebenza kwenye inkathi ingase ingafanele kwenye.",
      "Beka ama-zone nama-sector ebalazweni eliyisisekelo elifanayo.",
      "Buyekeza umdwebo wakho ngokushintsha kwezinkathi zonyaka. Imephu yepensela oyisebenzisayo iwusizo kakhulu kunemephu ephelele edwetshwe kanye kuphela."
    ],
    "sourceHeading": "Add Seasons, Zones, and Sectors",
    "registeredEnglishTitle": "Add Seasons, Zones, and Sectors",
    "registeredZuluTitle": "Faka Izinkathi, Ama-Zone Nama-Sector",
    "sourceHash": "3b5a515c0af732c49a8bd8e1364b733bd2cdab33a971ebb3113e6e238468b681",
    "targetHash": "1379d7226f916df82c156191b42ab1f070c0cfc8bb78b740b993e5b22aac726f",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-19.jpg",
    "imageSha256": "7dcde68048180ed847c65de9849d9b0a5b74deed021310f499aa2861eb33b14b",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-19.mp3",
    "audioSha256": "a2e28050f2714e1c3f94ee2d50d3794f11806252be5581a81e8fbdbf613e8f0a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 20,
    "source": [
      "When it is safe after heavy rain, walk your land. Mark rills, spreading water, ponds, and where water leaves your property. Note where excess water may need a safe route away.",
      "Return at dawn on a cold June morning. Mark mist, frozen dew, and the places frost lasts longest.",
      "On paper, draw your boundary, mark north, and add the house, water, roads, fences, slopes, and existing vegetation."
    ],
    "recordedTarget": [
      "Ngemva kwemvula enkulu, hamba emhlabeni wakho kuphela uma sekuphephile. Maka imisele emincane egejwe amanzi, izindawo lapho amanzi esabalala khona, amachibi, nalapho amanzi ephuma khona endaweni yakho. Qaphela izindawo lapho amanzi amaningi angase adinge khona indlela ephephile yokuphuma.",
      "Buyela entathakusa ekuseni okubandayo kuka-June. Maka inkungu, amazolo afriziwe nezindawo lapho i-frost ihlala khona isikhathi eside.",
      "Ephepheni, dweba umngcele wendawo yakho, maka inyakatho, bese wengeza indlu, amanzi, imigwaqo, izicingo, imithambeka nezitshalo esezikhona."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wensimu",
    "sourceHash": "00c2adf60d169ac65e689408618765566d894d91bcecbf07c4dc51848c883eba",
    "targetHash": "ff21f9899ccd0cd2e7483db536156edad4eb7c4595b1c0747850d0eac4f3b2bc",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-20.jpg",
    "imageSha256": "67a244ff387e01e50891d13f0d0130ddd93b6f6f07a8df7e6c3fed67ff5f650b",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-20.mp3",
    "audioSha256": "820646de67ee4717698c9f636b849b184d81d9353c8e7b101356cf84e12a513b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 21,
    "source": [
      "Build an A-frame level from three poles and a weighted string.",
      "Use it to mark points at the same height and trace a contour line. This is an observation, not a design for earthworks. Before digging, ask a trained local adviser to assess the site and plan a safe route for excess water.",
      "Add summer and winter wind arrows, shade observations from 8am, midday, and 4pm, and your zones and sectors. Keep the map and update it."
    ],
    "recordedTarget": [
      "Yakha ithuluzi lokulinganisa i-A-frame ngezigxobo ezintathu nangentambo enesisindo.",
      "Lisebenzise ukumaka amaphuzu asezingeni elifanayo nokulandela umugqa we-contour. Lokhu kuwukubuka nokurekhoda kuphela; akuwona umklamo womsebenzi womhlaba. Ngaphambi kokumba, cela umeluleki wendawo oqeqeshiwe ahlole indawo futhi ahlele indlela ephephile yokuphuma kwamanzi amaningi.",
      "Faka imicibisholo ebonisa umoya wasehlobo nowasebusika, okubonile ngemithunzi ngo-8 ekuseni, emini, nango-4 ntambama, kanye nama-zone nama-sector akho. Gcina imephu yakho futhi uyibuyekeze."
    ],
    "sourceHeading": "Field Action",
    "registeredEnglishTitle": "Field Action",
    "registeredZuluTitle": "Isenzo SaseNsimini",
    "sourceHash": "fd5da075ec1e39d93bf923d7664a8edf38f4f738af84106c5c2cb20c9fd9fcb1",
    "targetHash": "29ed7eec009149318a09c8dbff6be807a93566163d211006ef5ef173e48201e8",
    "imageUrl": "/course-decks/reading-landscape/zu/slide-21.jpg",
    "imageSha256": "671ffe898204d0c0def188c41beec6ed09565dfe82d44491a6a3f3d2513e5cb2",
    "audioUrl": "/course-audio/reading-landscape/zu/slide-21.mp3",
    "audioSha256": "ada28c7e101efeda5ad48b678f52cd4b2ca1fdc82a977b70401638314eb10558",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 1,
    "source": [
      "Soil is more than the ground under your feet.",
      "It is a living place that feeds crops, holds water, and carries your harvest.",
      "In this module, learn to read soil, make safe compost, protect bare ground, and use cover crops and worm farms."
    ],
    "recordedTarget": [
      "Umhlabathi ungaphezu kokuba yindawo engaphansi kwezinyawo zakho.",
      "Uyindawo ephilayo esiza izitshalo zikhule, ebamba amanzi, futhi esekela isivuno sakho.",
      "Kule modyuli, funda ukubheka nokufunda umhlabathi, ukwenza i-compost, ukuvikela umhlabathi ongenalutho, nokusebenzisa izitshalo zokumboza umhlabathi nama-worm farm."
    ],
    "sourceHeading": "Soil Health & Composting",
    "registeredEnglishTitle": "Soil Health & Composting",
    "registeredZuluTitle": "Impilo Yomhlabathi Ne-Compost",
    "sourceHash": "740b5850d834cd6136058d3c13227f285b9f36542a08e636e5aa8416e04cc926",
    "targetHash": "c1b4421d3f1cb7de72b47df1fe53fd87f2d4b7fffe9dedd35f7c0cd1bb35703e",
    "imageUrl": "/course-decks/soil-health/zu/slide-01.jpg",
    "imageSha256": "4e48ea48e82b4558f35ee3a7720b4cdf54e398a77c5939d41f18d4427532b55d",
    "audioUrl": "/course-audio/soil-health/zu/slide-01.mp3",
    "audioSha256": "17e9f22f4cece15b51ee25c62d4752b9008aa9f9aee1a9e972beec45ea1bfb17",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 2,
    "source": [
      "Soil condition affects roots, water and the harvest.",
      "Repeated bare ground, compaction and loss of organic matter can damage it. Colour alone does not tell the whole story.",
      "Observe your soil, then choose ways to protect and improve it."
    ],
    "recordedTarget": [
      "Isimo somhlabathi sithinta izimpande, amanzi nesivuno.",
      "Ukushiya umhlabathi ungenalutho ngokuphindaphindiwe, ukuwucinanisa nokuncipha kwezinto eziphilayo kungawulimaza. Umbala wodwa awuchazi konke.",
      "Bheka umhlabathi wakho, bese ukhetha izindlela zokuwuvikela nokuwuthuthukisa."
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "86498790d643b7150dcddf1b6c75f351dbf6c99ba9ced478329ca955197d93b2",
    "targetHash": "d98751450868656b522e8969366e4462b2fdd9f9fc8bb4296c01c9aa1ddf6f9e",
    "imageUrl": "/course-decks/soil-health/zu/slide-02.jpg",
    "imageSha256": "3dd67490729f0a4162cfe9e2ab62257439e78e9f75761d39194c58b7fd618146",
    "audioUrl": "/course-audio/soil-health/zu/slide-02.mp3",
    "audioSha256": "1b54dcd7881e439d3c614e8b63f7f2aff07e368794c0ab8c3912d2fa92dc6fce",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 3,
    "source": [
      "Look for several clues about soil condition.",
      "Use a jar to explore soil texture, while recognising its limits.",
      "Care for a compost heap, protect bare ground, and distinguish worm castings from liquid drainage."
    ],
    "recordedTarget": [
      "Bheka izimpawu eziningana zesimo somhlabathi.",
      "Sebenzisa ibhodlela ukuze uhlole ukuthungwa komhlabathi, kodwa uqaphele imingcele yalolu vivinyo.",
      "Nakekela inqwaba ye-compost, vikela umhlabathi ongenalutho, futhi uhlukanise ama-worm castings noketshezi oluphuma emgqonyeni wezikelemu."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "e41a7b9ac0f5d43ab7dc9be4ddf96351130ae67a99f294a3050a3b5fc22c9cdf",
    "targetHash": "6a7fd4d006be905d858aa1b7f0bbc58e3eeade5e76774bb15d2dba578a35a159",
    "imageUrl": "/course-decks/soil-health/zu/slide-03.jpg",
    "imageSha256": "2a11be14ff7bb12d115854b80551648118c656fa09042523e5216a214e29f1cd",
    "audioUrl": "/course-audio/soil-health/zu/slide-03.mp3",
    "audioSha256": "ec5beb6e31cfc42ff1d2734940aaab234752376e5613e309f6975ce08da48919",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 4,
    "source": [
      "Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.",
      "Some fungi help roots take up nutrients. Worm channels can help water and air enter soil.",
      "Look at roots, soil structure and water movement as well as visible soil life."
    ],
    "recordedTarget": [
      "Umhlabathi unezinhlobo eziningi zezinto eziphilayo. Amagciwane nesikhunta kusiza ukubolisa izinto eziphilayo nokujikeleza kwezakhamzimba.",
      "Ezinye izinhlobo zesikhunta zisiza izimpande zimunce izakhamzimba. Imigudu yezibungu ingasiza amanzi nomoya kungene emhlabathini.",
      "Bheka izimpande, ukwakheka komhlabathi nokuhamba kwamanzi, kanye nezinto eziphilayo ozibonayo emhlabathini."
    ],
    "sourceHeading": "Soil Is Alive",
    "registeredEnglishTitle": "Soil Is Alive",
    "registeredZuluTitle": "Umhlabathi Uyaphila",
    "sourceHash": "9932790509bc2b9817b164346d13f0f5dde25446743481cf00449b5d68d7398e",
    "targetHash": "0091eeed6029f9f5a764597643cdcc9c013cc2e90292ea6a9d7e4e21d3c96496",
    "imageUrl": "/course-decks/soil-health/zu/slide-04.jpg",
    "imageSha256": "31d2e4d68b6b789062d6839343fc84e1f5d7eb03736331ded9a91957ab51f647",
    "audioUrl": "/course-audio/soil-health/zu/slide-04.mp3",
    "audioSha256": "3b9c60b827686256c06e1e4095b0a0599cfd2e90d1c1ee06016bb4f9ea5e1cc1",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 5,
    "source": [
      "Look closely at these two soil examples.",
      "First, look at soil structure. In the field, feel how a moist piece breaks apart.",
      "Look at the roots and the spaces around them.",
      "Look at the surface cover. Loose mulch covers one example.",
      "Use several clues together. Colour alone cannot tell you soil health. Check moisture, plant growth and how water enters the ground."
    ],
    "recordedTarget": [
      "Bhekisisa lezi zibonelo ezimbili zomhlabathi.",
      "Okokuqala, bheka ukwakheka kwawo. Ensimini, thinta ucezu olunomswakama ubone ukuthi luphuka kanjani.",
      "Bheka izimpande nezikhala ezizizungezile.",
      "Bheka okumboze umhlabathi phezulu. Esinye isibonelo simbozwe nge-mulch exegayo.",
      "Sebenzisa izimpawu eziningana ndawonye. Umbala wodwa awukutsheli impilo yomhlabathi. Hlola umswakama, ukukhula kwezitshalo nokungena kwamanzi emhlabathini."
    ],
    "sourceHeading": "Watch: Read Your Soil",
    "registeredEnglishTitle": "Watch: Read Your Soil",
    "registeredZuluTitle": "Bheka Umhlabathi",
    "sourceHash": "6702a2d31368f1b05f9b1340574df37f7a8dbb7a8781cdd5f7199f1fb9a9a138",
    "targetHash": "26c71be3bfbf1d43100451f47e7ae7dcdb1e5d2facb82f9413a0765b2dc8c1dd",
    "imageUrl": "/course-decks/soil-health/zu/slide-05.jpg",
    "imageSha256": "c870d633b04bb7a716723ce4cc9c98d7350fa9f552a05897f0dec7c63b196489",
    "audioUrl": "/course-audio/soil-health/zu/slide-05.mp3",
    "audioSha256": "8d4d31ea5ddeee429ceae0ded3ec021a55e7feb00a54fc9abe78b68e02f57d74",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 6,
    "source": [
      "Put soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.",
      "Sand settles first. Silt settles next, while clay can remain suspended much longer.",
      "This is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed."
    ],
    "recordedTarget": [
      "Faka umhlabathi namanzi embizeni yengilazi ecacile, ufake nenani elincane le-detergent efanele yokuhlakaza izinhlayiya zomhlabathi. Yivale uyinyakazise, bese uyishiya inganyakazi.",
      "Isihlabathi sihlala phansi kuqala. I-silt ilandela; ubumba lungahlala luntanta isikhathi eside.",
      "Lolu wuvivinyo lokufunda olulinganiselwe. Izigaxa nobumba olungakahlali phansi kungakudukisa. Uma kudingeka ukwazi ukuthungwa komhlabathi ngokunembile, sebenzisa ilabhorethri yomhlabathi."
    ],
    "sourceHeading": "Explore Soil Texture with a Jar",
    "registeredEnglishTitle": "Explore Soil Texture with a Jar",
    "registeredZuluTitle": "Hlola Ukuthungwa Komhlabathi Ngebhodlela",
    "sourceHash": "b7750d2f025ce13ed23f69ff54313b8f8a7525487714a5a67c8a3beae6d08b34",
    "targetHash": "b22171581a8decb875c7993c3552a28a57b2fe0366bb893de327b46ac727499b",
    "imageUrl": "/course-decks/soil-health/zu/slide-06.jpg",
    "imageSha256": "78ef52df55addfbff4402d2b5baa227c407b6f804391f5ba5023dbe0956aa558",
    "audioUrl": "/course-audio/soil-health/zu/slide-06.mp3",
    "audioSha256": "145ea45a3d0857bf3613a02c73a984a832116833482e4240e42248d953ae605e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 7,
    "source": [
      "A thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.",
      "Compare the settled layers and feel the soil in the field.",
      "Record what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone."
    ],
    "recordedTarget": [
      "Ungqimba olujiyile lwesihlabathi ngaphansi kwamanzi afiphele alukakutsheli izilinganiso zokugcina. Ezinye izinhlayiya ezincane kungenzeka zisantanta.",
      "Qhathanisa izingqimba esezihlale phansi, futhi uzwe nokuthungwa komhlabathi osensimini.",
      "Bhala lokho okubonayo nalokho okungakaqinisekiswa. Ungancomi indlela yokunisela noma yokwelapha umhlabathi ngebhodlela elilodwa kuphela."
    ],
    "sourceHeading": "Read the Jar Carefully",
    "registeredEnglishTitle": "Read the Jar Carefully",
    "registeredZuluTitle": "Funda Izingqimba Zasebhodleleni Ngokucophelela",
    "sourceHash": "567baadce1dd0057c00d0c2e986d69d021b3e9847aaeb333aa8d5fdc63e01eef",
    "targetHash": "65bbc38ffc7fd1c3c5ba59047497c197e867825350e8113c15b58d698bea4f1c",
    "imageUrl": "/course-decks/soil-health/zu/slide-07.jpg",
    "imageSha256": "6909dd9870145bfcd54eb8d7a5365bbbd7badb478d506a7e67a729cf50913f53",
    "audioUrl": "/course-audio/soil-health/zu/slide-07.mp3",
    "audioSha256": "2627ba055865d08c4ea6c810ff06b4b782f9a7b4e86a34039ad740dde1679197",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 8,
    "source": [
      "Compaction, poor drainage and loss of organic matter can limit roots and soil life.",
      "Pale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.",
      "Look for patterns across the field. Check management history, drainage and plant growth before choosing a remedy."
    ],
    "recordedTarget": [
      "Ukucinana komhlabathi, ukungaphumi kahle kwamanzi nokuncipha kwezinto eziphilayo kunganciphisa ukukhula kwezimpande nokuphila komhlabathi.",
      "Umbala ophaphathekile noma izibungu ezimbalwa akufakazeli ukuthi amakhemikhali abulale umhlabathi. Umsebenzi wezibungu nawo uyashintsha kuye ngomswakama nenkathi yonyaka.",
      "Bheka amaphethini ezindaweni ezahlukene zensimu. Hlola umlando wokunakekela, ukuphuma kwamanzi nokukhula kwezitshalo ngaphambi kokukhetha ikhambi."
    ],
    "sourceHeading": "Investigate Before You Treat",
    "registeredEnglishTitle": "Investigate Before You Treat",
    "registeredZuluTitle": "Hlola Ngaphambi Kokwelapha",
    "sourceHash": "a96e535995341684e4347da6b39af6facb6cceae58c13a1ba25c29da24978dc8",
    "targetHash": "f2cb5de036be1645df4cc84988367c3d2db7c9c5b04d36be6f3ecfa04e3d7446",
    "imageUrl": "/course-decks/soil-health/zu/slide-08.jpg",
    "imageSha256": "022eb3adac689c3a7477ac63a24cc42b30cc088808efb4c4f526723f42c664f7",
    "audioUrl": "/course-audio/soil-health/zu/slide-08.mp3",
    "audioSha256": "39b5cb955bbb3ba48d626011ce7395cc646285be35de3d016a4a3d578d6cc03f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 9,
    "source": [
      "Compost is organic matter broken down under managed conditions.",
      "Finished compost can improve soil structure and contribute nutrients.",
      "Time to readiness varies with materials, moisture, air and temperature. A province name or a fixed number of weeks is not a readiness test."
    ],
    "recordedTarget": [
      "I-compost yizinto eziphilayo ezibolile ngaphansi kwezimo ezilawulwayo.",
      "I-compost esilungile ingathuthukisa ukwakheka komhlabathi futhi ifake izakhamzimba kuwo.",
      "Isikhathi sokuthi i-compost ilunge siyashintsha kuye ngezinto ezifakiwe, umswakama, umoya nokushisa. Igama lesifundazwe noma inani elinqunyiwe lamasonto akusho ukuthi i-compost isilungile."
    ],
    "sourceHeading": "Compost Feeds the Soil",
    "registeredEnglishTitle": "Compost Feeds the Soil",
    "registeredZuluTitle": "I-Compost Yondla Umhlabathi",
    "sourceHash": "dedf45c2cc28dea47804be44a07bb8d405bd0034f72f1777aad5cef3e0d09796",
    "targetHash": "1607c80b02b2a2066c72e705f52fad439f8c78e651f3391f375414dfcf11da62",
    "imageUrl": "/course-decks/soil-health/zu/slide-09.jpg",
    "imageSha256": "e0b7c8367c055816fced089b63f300751fccbf07cee9748359a2010ea3c7d7a5",
    "audioUrl": "/course-audio/soil-health/zu/slide-09.mp3",
    "audioSha256": "c179ca28f3e7218f74208afa3b5b088ee26785e2613692ac0c25329f359d4ef2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 10,
    "source": [
      "Build the heap with dry browns and fresh greens.",
      "Keep the layers moist, not wet, so air and decomposers can work."
    ],
    "recordedTarget": [
      "Yakha inqwaba ngama-browns omile nama-greens amasha.",
      "Gcina izingqimba zimanzi kodwa zingacwili, ukuze kungene umoya futhi izinto ezibolisa inqwaba zisebenze."
    ],
    "sourceHeading": "Watch: Build the Compost Heap",
    "registeredEnglishTitle": "Watch: Build the Compost Heap",
    "registeredZuluTitle": "Yakha Inqwaba Ye-Compost",
    "sourceHash": "e08d46d6f0289cf557df07b888a2681ef995238f07903822a5a0a337c55c03f0",
    "targetHash": "2c000100793a262afa30b36e3ae8b7573ca8168611cc816fd942f54f820d88c5",
    "imageUrl": "/course-decks/soil-health/zu/slide-10.jpg",
    "imageSha256": "d4ab87aefce98f59eefc4db5aff2c58b654c3bf52ea05cec2b1724b30b9b7b8e",
    "audioUrl": "/course-audio/soil-health/zu/slide-10.mp3",
    "audioSha256": "3f26005a949a897965aa22bd125555a552fab76f5e80c9af9e696a92be362ce6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 11,
    "source": [
      "Mix dry browns with fresh greens. Avoid thick, wet layers that keep air out.",
      "If the heap becomes slimy or smells strongly of ammonia, add dry browns and turn it.",
      "Check moisture and air as the heap changes; one recipe does not suit every mix of materials."
    ],
    "recordedTarget": [
      "Hlanganisa ama-browns omile nama-greens amasha. Gwema izingqimba eziwugqinsi nezimanzi ezivimba umoya.",
      "Uma inqwaba iba bushelelezi ngokushelela noma inuka kakhulu i-ammonia, faka ama-browns omile bese uyiphendula.",
      "Hlola umswakama nomoya njengoba inqwaba ishintsha; iresiphi eyodwa ayifaneli zonke izingxube zezinto."
    ],
    "sourceHeading": "Balance Browns and Greens",
    "registeredEnglishTitle": "Balance Browns and Greens",
    "registeredZuluTitle": "Linganisa Ama-Browns Nama-Greens",
    "sourceHash": "a73178ff18b5bd67f6307d2be18252f3e03e1a6f1769d9e3bbe5155ab06313bb",
    "targetHash": "57d62f47c17367323b1a74c3b40809b6bee9819096b10f379a0ad2a8a331509c",
    "imageUrl": "/course-decks/soil-health/zu/slide-11.jpg",
    "imageSha256": "1f0c60175923e8979a5d58c5ebf9dc4b75c1ad81849e30d48131325c3d81377e",
    "audioUrl": "/course-audio/soil-health/zu/slide-11.mp3",
    "audioSha256": "f37b7522b66ac635cad2b7d78d0aa64bb94e6bedbeeb2a117fdb71a039401b45",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 12,
    "source": [
      "A hot centre does not prove that every part of a heap has been treated. Time, temperature and management all matter.",
      "Keep meat, dairy, diseased plants, pet waste and contaminated materials out of this simple household system.",
      "Do not assume home composting destroys every weed seed or disease organism. Use a recognised process where sanitation is required."
    ],
    "recordedTarget": [
      "Ukuthi indawo emaphakathi nenqwaba iyashisa akufakazeli ukuthi yonke ingxenye yayo ithole ukwelashwa. Isikhathi, izinga lokushisa nendlela yokuphatha konke kubalulekile.",
      "Ungafaki inyama, ubisi nemikhiqizo yobisi, izitshalo ezigulayo, indle yezilwane ezifuywayo noma izinto ezingcolile kule ndlela elula yasekhaya.",
      "Ungacabangi ukuthi ukwenza i-compost ekhaya kuqeda yonke imbewu yokhula noma zonke izinto eziphilayo ezibangela izifo. Uma kudingeka ukuhlanzwa kwe-compost, sebenzisa inqubo eyamukelekile."
    ],
    "sourceHeading": "Heat Alone Is Not a Safety Check",
    "registeredEnglishTitle": "Heat Alone Is Not a Safety Check",
    "registeredZuluTitle": "Ukushisa Kukodwa Akufakazeli Ukuphepha",
    "sourceHash": "83bdc085dd19c897d55440aed86d19de1cf4baf1c92cdd8d08f2d9bf7afc7ae9",
    "targetHash": "a37b2a52cebb5ddc31b47b8926bab7f7a21b27f565588c20f5fe27d517388e5e",
    "imageUrl": "/course-decks/soil-health/zu/slide-12.jpg",
    "imageSha256": "25e5343856ead9240c4ec821d67b8560409ecfe97d6aeb4c52bbfc273264d381",
    "audioUrl": "/course-audio/soil-health/zu/slide-12.mp3",
    "audioSha256": "01d975bca33f691be3ead850222ce7c8d480d9d0a6e10164cc8b95c94cf9be11",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 13,
    "source": [
      "Keep wattle seed pods out of the compost heap. An ordinary heap may not make every seed non-viable.",
      "Use only clean, untreated materials. Bark breaks down slowly; its name alone is not proof that it is free of contamination.",
      "Check the heap and turn when it needs more air or mixing. Keep it moist rather than waterlogged."
    ],
    "recordedTarget": [
      "Gcina ama-pod embewu ye-wattle ngaphandle kwenqwaba ye-compost. Inqwaba evamile ingase ingayenzi yonke imbewu ingasakwazi ukuhluma.",
      "Sebenzisa izinto ezihlanzekile kuphela, ezingakaze zelashwe. Amagxolo abola kancane; igama lawo lodwa aliqinisekisi ukuthi awangcolisiwe.",
      "Hlola inqwaba, uyiphendule lapho idinga umoya owengeziwe noma ukuxutshwa. Yigcine inomswakama, ingagcwali amanzi."
    ],
    "sourceHeading": "Keep Seed Pods and Contaminants Out",
    "registeredEnglishTitle": "Keep Seed Pods and Contaminants Out",
    "registeredZuluTitle": "Gcina Ama-Pod Embewu Nezinto Ezingcolile Ngaphandle",
    "sourceHash": "0bbcaaa053b19a9360490ad4a0918c7401e4715a9e55632992f962b25ff97e37",
    "targetHash": "7e0e70e37163f7f3d54de357f0233ead235447f9922cc4e263c60a22bf881cef",
    "imageUrl": "/course-decks/soil-health/zu/slide-13.jpg",
    "imageSha256": "2b0c24561c0978b441fa132b8a6fe2aa2af8eefc014010a7381e8ce6aa674863",
    "audioUrl": "/course-audio/soil-health/zu/slide-13.mp3",
    "audioSha256": "728de617050929e3dd5c8a5ba440c5c37b9df0a2203988dc0f1ef7fae2c19772",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 14,
    "source": [
      "Compare bare soil with mulched soil.",
      "When rain hits mulch instead of bare soil, much of the raindrop energy is dissipated. This diagram shows that surface-impact idea only; it does not predict how water will move at a particular site."
    ],
    "recordedTarget": [
      "Qhathanisa umhlabathi ongenalutho nomhlabathi ombozwe nge-mulch.",
      "Uma imvula ishaya i-mulch esikhundleni sokushaya umhlabathi ongenalutho, ingxenye enkulu yamandla amaconsi emvula ingadamba. Lo mdwebo ukhombisa lo mbono wokushaya kwemvula kuphela; awusho ukuthi amanzi azongena, azogeleza noma azogcinwa kanjani endaweni ethile."
    ],
    "sourceHeading": "Watch: Bare Soil and Mulch",
    "registeredEnglishTitle": "Watch: Bare Soil and Mulch",
    "registeredZuluTitle": "Umhlabathi Ongenalutho Ne-Mulch",
    "sourceHash": "b27e079cb4be9f186742bd93728828fef102f1bf5d7f5a994518b26408f8a5ab",
    "targetHash": "a807b4bb6ede94f83b3e0af47a5750c5b410bfbf5b8789902622b58abd7da60f",
    "imageUrl": "/course-decks/soil-health/zu/slide-14.jpg",
    "imageSha256": "71985552dbee152f76cab425f6d2a4421ad5106aa3a36e9568a5770d560f7d96",
    "audioUrl": "/course-audio/soil-health/zu/slide-14.mp3",
    "audioSha256": "7dc3370762be919864d9923a721a287e7359ab0206b6f5757e38609d8d409c4f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 15,
    "source": [
      "Cover bare soil with suitable clean mulch, such as straw, dry grass or wood chips.",
      "Mulch can reduce evaporation, soften the impact of rain and suppress weeds.",
      "Keep it clear of trunks and stems. Check moisture underneath and adjust the layer; more mulch is not always better."
    ],
    "recordedTarget": [
      "Mboza umhlabathi ongenalutho nge-mulch ehlanzekile nefanele, njenge-straw, utshani obomile noma ama-wood chips.",
      "I-mulch inganciphisa ukuhwamuka, ithambise ukushaya kwemvula futhi icindezele ukhula.",
      "Yigcine ingathinti iziqu zezihlahla nezitshalo. Hlola umswakama ngaphansi kwayo bese ulungisa ungqimba. I-mulch eningi ayihlali ingcono."
    ],
    "sourceHeading": "Mulch Protects the Ground",
    "registeredEnglishTitle": "Mulch Protects the Ground",
    "registeredZuluTitle": "I-Mulch Ivikela Umhlabathi",
    "sourceHash": "279f2c18f354690aceddbe51071c2fdf7c2a30f51ddab77fea835c6386eb80e8",
    "targetHash": "38eb7261182e3d6c68c769713b43cb3319b4f1f32e3dcc20c565e54848362e8f",
    "imageUrl": "/course-decks/soil-health/zu/slide-15.jpg",
    "imageSha256": "ae08441643009885635d27276d5d55d94acc4a32fa751780c68e2da861c368e9",
    "audioUrl": "/course-audio/soil-health/zu/slide-15.mp3",
    "audioSha256": "4a8e80153d93ec63e2438ff0f9b9e6ddbb4dd05cd707822094c91d79f976a37f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 16,
    "source": [
      "Cover crops can protect ground between main crops. Choose for local weather, available water and the next planting.",
      "The course examples include oats, lupins, sunn hemp and cowpea. Check local suitability before sowing.",
      "Legumes need suitable bacteria and growing conditions to fix nitrogen. Nutrients in their residues become available as the material decomposes."
    ],
    "recordedTarget": [
      "Izitshalo zokumboza umhlabathi zingawuvikela phakathi kwezilimo eziyinhloko. Khetha ngokwesimo sezulu sendawo, amanzi atholakalayo nesitshalo esizolandela.",
      "Izibonelo ezikulesi sifundo zifaka ama-oats, ama-lupins, i-sunn hemp ne-cowpea. Hlola ukuthi zifanele yini indawo yakho ngaphambi kokuzihlwanyela.",
      "Izitshalo zomndeni wama-legume zidinga amagciwane afanele nezimo zokukhula ezifanele ukuze zibophe i-nitrogen. Izakhamzimba ezinsaleleni zazo zitholakala njengoba lezo zinsalela zibola."
    ],
    "sourceHeading": "Cover Crops Between Seasons",
    "registeredEnglishTitle": "Cover Crops Between Seasons",
    "registeredZuluTitle": "Izitshalo Zokumboza Umhlabathi Phakathi Kwezilimo",
    "sourceHash": "d28d9976a32ec70aa1275fae7d009174c85f79a9fece6c79ab47b1fdd540080f",
    "targetHash": "910edba9cbc4ec7f5736c20f82286436a67b9b0d902da8a0fbad1e198e3e5ac3",
    "imageUrl": "/course-decks/soil-health/zu/slide-16.jpg",
    "imageSha256": "014e0310a5edd5898b5c684347c0f57b2326b9f243a166db5a13d9fda67a285f",
    "audioUrl": "/course-audio/soil-health/zu/slide-16.mp3",
    "audioSha256": "31e270eb4d50a43655a05f9efd5f9c553c4fb399adbb9c9b2f9e9d7d65726b23",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 17,
    "source": [
      "Worm farms can turn suitable food scraps and bedding into castings. Check the bin rather than expecting a fixed harvest date.",
      "Liquid that drains naturally from a worm bin is called leachate. It is not the same as a prepared worm-casting tea.",
      "Leachate can contain harmful organisms or substances. Do not use it on edible plants or assume that dilution makes it safe."
    ],
    "recordedTarget": [
      "Amapulazi ezikelemu angaguqula izinsalela zokudla ezifanele nezinto zokulala kwezikelemu zibe ama-castings. Hlola umgqomo; ungalindeli usuku oluqondile lokuvuna.",
      "Uketshezi oluphuma ngokwemvelo emgqonyeni wezikelemu lubizwa nge-leachate. Alufani netiye lezikelemu elilungiswe ngendlela ethile.",
      "I-leachate ingaba nezinto eziphilayo noma ezinye izinto eziyingozi. Ungayisebenzisi ezitshalweni ezidliwayo futhi ungacabangi ukuthi ukuyixuba namanzi kuyenza iphephe."
    ],
    "sourceHeading": "Worm Castings and Liquid Drainage",
    "registeredEnglishTitle": "Worm Castings and Liquid Drainage",
    "registeredZuluTitle": "Ama-Worm Castings Noketshezi Oluphuma Emgqonyeni",
    "sourceHash": "c0454d0d4c497d4a5e7fb7cd166f4dcdf30508958b81ac7af3a13b66d2ac81f6",
    "targetHash": "04d8a0824a8f1c0806e90accdf75656b0f9e22a0af74be18035191d56e8981d8",
    "imageUrl": "/course-decks/soil-health/zu/slide-17.jpg",
    "imageSha256": "76523b29993ae3fbf278a23408ae76c8f6d31c01540dbab51538cb92943beda3",
    "audioUrl": "/course-audio/soil-health/zu/slide-17.mp3",
    "audioSha256": "0280525a60ca231f341ddd07619bdc75b86c7abff67e003b107a76c4fc09f45b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 18,
    "source": [
      "A Highveld field left bare after the maize harvest faces two main risks.",
      "Winter wind can carry away dry topsoil.",
      "The first heavy spring storm can strike bare ground and damage its surface and structure. If water runs over the field, it can carry loosened soil away.",
      "Cover crops, mulch, and organic matter can help hold soil in place and help it stay alive."
    ],
    "recordedTarget": [
      "Insimu yase-Highveld eshiywe ingenalutho ngemva kokuvuna ummbila ibhekana nezingozi ezimbili ezinkulu.",
      "Umoya wasebusika ungathwala umhlabathi ongaphezulu owomile uwususe.",
      "Isiphepho sokuqala esinamandla sentwasahlobo singashaya umhlabathi ongenalutho silimaze ingaphezulu lawo nokwakheka kwawo. Uma amanzi egeleza phezu kwensimu, angathwala umhlabathi osuxegisiwe awususe.",
      "Izitshalo zokumboza umhlabathi, i-mulch nezinto zemvelo zingasiza ukubamba umhlabathi endaweni yawo futhi ziwusize uhlale uphila."
    ],
    "sourceHeading": "Protect Soil All Year",
    "registeredEnglishTitle": "Protect Soil All Year",
    "registeredZuluTitle": "Vikela Umhlabathi Unyaka Wonke",
    "sourceHash": "895fb8ecec11804e2c1c70d2d22b6dd176362606b0a2f0f166fe8470e47048d2",
    "targetHash": "2ffc86924faa240b39b07f3ea428a44c5da802fb5a3f61975e5fe686bbf78be8",
    "imageUrl": "/course-decks/soil-health/zu/slide-18.jpg",
    "imageSha256": "3a466fc44da504ca9fc30b06d9efdc04b4047d3bfeae21fac7f9e7be68cffc15",
    "audioUrl": "/course-audio/soil-health/zu/slide-18.mp3",
    "audioSha256": "a812e2fb0639c99a885137ebf3befd331f6a88b6671b07efd61e4bec23e102f8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 19,
    "source": [
      "Inspect soil in a working area. Record colour, structure, roots, moisture and any worm channels.",
      "Compare another spot and note recent weather and management.",
      "Try the jar exercise. Write what it suggests, what is uncertain, and whether a laboratory test or local adviser could help."
    ],
    "recordedTarget": [
      "Hlola umhlabathi endaweni osebenza kuyo. Bhala umbala, ukwakheka, izimpande, umswakama nanoma yimiphi imigudu yezibungu.",
      "Qhathanisa nenye indawo, ubhale ngesimo sezulu sakamuva nangendlela indawo ebiphethwe ngayo.",
      "Zama ukuhlola ngebhodlela. Bhala ukuthi yini okubonakala sengathi iyavela, yini engakaqinisekiswa, nokuthi ukuhlolwa kwelabhorethri noma iseluleko somuntu wendawo onguchwepheshe kungasiza yini."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wensimu",
    "sourceHash": "9e18ff3e20a56e970ff0ba6eae888cbd0082dba6b9f748cbbddf7967d60bfc2a",
    "targetHash": "75edee6a2266d0285d30ccbe46fa9d82c64a1a28f94e78d75bacd54a3d7e09a6",
    "imageUrl": "/course-decks/soil-health/zu/slide-19.jpg",
    "imageSha256": "646c16afd0674aaee0bede36b591ba7c69b3df4efc55021c0463024fdc345d6a",
    "audioUrl": "/course-audio/soil-health/zu/slide-19.mp3",
    "audioSha256": "5c39f958891f3ff2bdcdf0ee2a80ba917a715569d53d39ae3ecc0d8e3cce5e16",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "soil-health",
    "slide": 20,
    "source": [
      "Start one soil-building action from this module.",
      "Cover bare ground with mulch, begin a balanced compost heap, sow a suitable cover crop, or prepare a worm farm.",
      "If your compost smells of ammonia and feels slimy, add dry carbon such as straw and turn it.",
      "Build soil life step by step."
    ],
    "recordedTarget": [
      "Qala isenzo esisodwa sokwakha umhlabathi esikule modyuli.",
      "Mboza umhlabathi ongenalutho nge-mulch, qala inqwaba ye-compost elinganiselayo, hlwanyela isitshalo sokumboza esifanele, noma lungisa i-worm farm.",
      "Uma i-compost yakho inuka i-ammonia futhi ishelela, faka izinto ezomile ezine-carbon njenge-straw bese uphendula inqwaba.",
      "Yakha impilo yomhlabathi kancane kancane."
    ],
    "sourceHeading": "Field Action",
    "registeredEnglishTitle": "Field Action",
    "registeredZuluTitle": "Isenzo SasePulazini",
    "sourceHash": "4c29552133a532445dcf5443e00f2c974f57359e5c2b854fd22e9b2deb09233d",
    "targetHash": "76b7dd4e157f423db34da58f27a358003344681975485eb3bd3cc3ecd2da1b8a",
    "imageUrl": "/course-decks/soil-health/zu/slide-20.jpg",
    "imageSha256": "c6a5996c546e346014c9f2afa0a266be697f0e48f58789d0b51ef703107e8208",
    "audioUrl": "/course-audio/soil-health/zu/slide-20.mp3",
    "audioSha256": "3846b87cf5aba10150747ea3daa9a10b9a3717d07ed0a7aeeb64319a6e24d9a9",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 1,
    "source": [
      "Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop."
    ],
    "recordedTarget": [
      "Ama-swale, ama-berm, amadamu, amathangi amanzi emvula kanye namanzi asetshenzisiwe asekhaya — nciphisa ukugeleza, usakaze amanzi, futhi uwavumele angene lapho umhlabathi nendawo kukufanele."
    ],
    "sourceHeading": "Water Harvesting",
    "registeredEnglishTitle": "Water Harvesting",
    "registeredZuluTitle": "Ukuvunwa Kwamanzi",
    "sourceHash": "a3f950411203bc4823dbf351ade97745e31bb9011c5daa52e74a2cc25925b64d",
    "targetHash": "fdb681b3c867a9e07dca58ef9be4304c1a2b9b1e5131e857e8a07efa5b1d90e0",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-01.jpg",
    "imageSha256": "aae74464299874b2c64e4ec6653f3c5a0af30394647e4752f814a2f98d789156",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-01.mp3",
    "audioSha256": "63f71b13043eefd453921686f2b71209a01ec2b3a4851f51c229e0997874ac01",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 2,
    "source": [
      "Explain how a level contour swale can slow and spread runoff for infiltration on a suitable site.",
      "Explain why dams need a designed spillway and a site assessment.",
      "Explain what a first-flush diverter does and why tank water still needs a safety check.",
      "Keep greywater away from people, food and drinking-water pipes."
    ],
    "recordedTarget": [
      "Chaza ukuthi i-swale elandela umugqa olinganayo ingabambezela futhi isabalalise kanjani amanzi agelezayo ukuze angene emhlabathini ofanele.",
      "Chaza ukuthi kungani idamu lidinga i-spillway eklanyiwe nokuhlolwa kwendawo.",
      "Chaza umsebenzi wesiphambukisi samanzi okuqala nokuthi kungani amanzi ethangi esadinga ukuhlolwa kokuphepha.",
      "Gcina amanzi asetshenzisiwe kude nabantu, nokudla, namapayipi amanzi okuphuza."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "bb15cbe6e9d44008294b2fa57b97790f6df85df6f8bf8be5aca7c254b2b014e3",
    "targetHash": "793adb2a58fcbd61134a04b369135b74c13c5ea5d2f954bb6614232a7111be0f",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-02.jpg",
    "imageSha256": "ca98aed7ab463e765fdcea8d923c8409432b95cd2efddd3060323477c9f2fdba",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-02.mp3",
    "audioSha256": "5b8da7fa22b8663ff29cb7ee09463f00ea99171ca12644548182187574fa77dd",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 3,
    "source": [
      "A level contour swale is one design for slowing runoff. Its trench follows a level contour so water can spread and soak into suitable soil.",
      "Some swales are deliberately given a slight grade, with a designed safe outlet. Soil, slope, drainage and storm flow decide which approach is suitable. Ask a trained local adviser to assess the site before digging."
    ],
    "recordedTarget": [
      "I-swale elandela umugqa olinganayo we-contour ingenye indlela yokubambezela amanzi agelezayo. Umsele wayo ulandela umugqa olinganayo ukuze amanzi asabalale futhi angene emhlabathini ofanele.",
      "Amanye ama-swale aklanywa abe nomthambeka omncane olawulwayo, nendawo yokuphuma ephephile eklanyiwe. Umhlabathi, umthambeka, ukugeleza kwamanzi nokugeleza kwamanzi eziphepho kunquma ukuthi iyiphi indlela efanele. Cela umeluleki wendawo oqeqeshiwe ahlole indawo ngaphambi kokumba."
    ],
    "sourceHeading": "Two Swale Designs",
    "registeredEnglishTitle": "Two Swale Designs",
    "registeredZuluTitle": "Izinhlobo Ezimbili Zama-Swale",
    "sourceHash": "80f2df09eca9b8f9eabbcc47adfb504f457daea8151eeef501192945ff4a4e8a",
    "targetHash": "6db1e58fb42257c77afb9520aaea7ca19c7f9b7b63404c1884f3351411124f50",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-03.jpg",
    "imageSha256": "ee93c05e20cc0390363774d28e35720ccb80dc911867ae3621438e6f0e89f2e9",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-03.mp3",
    "audioSha256": "09225932390eaf3095df12a782a7454e9265a9fac8d114d4d2f4e9d6be11d91f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 4,
    "source": [
      "This picture shows a level contour swale as a concept. Water may spread along the trench and soak in where the soil allows it.",
      "It does not show how deep moisture reaches on your land. Check the soil, slope and overflow route before building."
    ],
    "recordedTarget": [
      "Lesi sithombe sibonisa i-swale elinganayo ku-contour njengomqondo. Amanzi angasabalala emseleni futhi angene emhlabathini lapho umhlabathi ukuvumela khona.",
      "Isithombe asibonisi ukuthi umswakama uzofika ujule kangakanani emhlabeni wakho. Hlola umhlabathi, umthambeka nendlela yokuchichima ngaphambi kokwakha."
    ],
    "sourceHeading": "A Swale May Let Water Soak In",
    "registeredEnglishTitle": "A Swale May Let Water Soak In",
    "registeredZuluTitle": "I-Swale Ingavumela Amanzi Angene Emhlabathini",
    "sourceHash": "28a204203ed6838bdd2bea4ecb1b62aafe68b2d8a6f96551dda4aa46ef80b217",
    "targetHash": "64a1deb05a1dbb3979af360ec4d8a54e6723facb3d3f0e32c256db155cc54439",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-04.jpg",
    "imageSha256": "46e68f83802c4410bb723bfa3a6a6cb3f0898cebe508e558d11b3d1f1016c04d",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-04.mp3",
    "audioSha256": "11ddc1c6c025b6210bdd08289f283020dfdab19e5839c20d90076c0564b4a9d8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 5,
    "source": [
      "The excavated soil forms a berm on the downhill side. It is where trees may be planted when the site design is suitable.",
      "Trees may draw on moisture stored in nearby soil after rain; the result varies by site."
    ],
    "recordedTarget": [
      "Umhlabathi ombiwe wakha i-berm ohlangothini olungaphansi komthambeka. Izihlahla zingatshalwa lapho uma uhlelo lwendawo lufanele.",
      "Izihlahla zingasebenzisa umswakama ogcinwe emhlabathini oseduze ngemva kwemvula; umphumela uyashiyana kuye ngendawo."
    ],
    "sourceHeading": "The Downhill Berm",
    "registeredEnglishTitle": "The Downhill Berm",
    "registeredZuluTitle": "I-Berm Esehlangothini Eliphansi",
    "sourceHash": "c183750cc4e0c365183601c0f2d970e06d182682fcc040f80d74c7a78e7c37f4",
    "targetHash": "c19a20393ff2f25c3e8bbd39108bf41881562ef86fb2627865547969e38a2ae0",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-05.jpg",
    "imageSha256": "2d50a5742bbd93a8a25bfb13fc47f529ddce33665227dcfe1819a016d5169a36",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-05.mp3",
    "audioSha256": "24a27a2663dac1ef129e8268d6e519377c5557bc52bd66043b47ae7c3e45df86",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 6,
    "source": [
      "Heavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.",
      "The route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.",
      "Ask a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design."
    ],
    "recordedTarget": [
      "Imvula enkulu ingagcwalisa i-swale ngokushesha kunokuba amanzi angene emhlabathini. Hlela indlela ephephile yokuchichima ngaphambi kokumba.",
      "Indlela akufanele igugule umthambeka noma ithumele amanzi alimazayo komakhelwane. I-swale noma idamu elingezansi kufanele likwazi ukwamukela la manzi ngokuphepha.",
      "Cela umeluleki wendawo oqeqeshiwe ahlole umhlabathi, umthambeka nokugeleza kwamanzi eziphepho. Isithombe asiwona umklamo wokwakha."
    ],
    "sourceHeading": "Storms Need a Safe Overflow",
    "registeredEnglishTitle": "Storms Need a Safe Overflow",
    "registeredZuluTitle": "Iziphepho Zidinga Indlela Ephephile Yokuchichima",
    "sourceHash": "5c96144043c1c1b0d3adc2c54e3403ff9ce8bc865b13e86b7b97bdbb4a2130ff",
    "targetHash": "8eefd0191bdc1718219776b85597e80a54cd06656efaea4d3c07f70b386f9911",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-06.jpg",
    "imageSha256": "654507ef1b024af59db4f5d00ad6dc842cf02fab454366d81af41efadf914568",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-06.mp3",
    "audioSha256": "4e45be6e25f281a7751bacf92d3ae80909cefac627c2640e714491b44144e0a4",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 7,
    "source": [
      "A swale needs a planned overflow route for heavy rain. Check it before digging.",
      "Water may go to another swale or a dam only when a site assessment shows that the route, outlet and receiver can take the flow without damage."
    ],
    "recordedTarget": [
      "I-swale idinga indlela yokuchichima ehleliwe uma kunemvula enkulu. Yihlole ngaphambi kokumba.",
      "Amanzi angaya kwenye i-swale noma edamini kuphela uma ukuhlolwa kwendawo kukhombisa ukuthi indlela, indawo yokuphuma nendawo ezowamukela kungawamukela amanzi ngaphandle komonakalo."
    ],
    "sourceHeading": "Assess the Overflow Before Digging",
    "registeredEnglishTitle": "Assess the Overflow Before Digging",
    "registeredZuluTitle": "Hlola Indlela Yokuchichima Ngaphambi Kokumba",
    "sourceHash": "bae223c0152772e28098ee82645e56ca90bb861fcd677f1672c03f599df4ee0c",
    "targetHash": "2d11bb5e02dd50c36b67924627fba3d1dac6b5fe28c879f28da39e843ee5ff05",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-07.jpg",
    "imageSha256": "45f3f74701d7589abd19d731804742983229c588ab4ca338f60e7a87c49e0622",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-07.mp3",
    "audioSha256": "cfb3e973d2595a4d8aafe3f4dcf3bb58fba20ebbe4afe2346ac274f1444b476f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 8,
    "source": [
      "Slope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.",
      "Keep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site."
    ],
    "recordedTarget": [
      "Umthambeka wodwa awusho ukuthi i-swale iyayifanelekela yini indawo. Umhlabathi, ukugeleza kwamanzi, umhlaba ongazinzile namanzi afika evela phezulu komthambeka kubalulekile.",
      "Gcina umhlabathi umbozekile. Thola ukuhlolwa kwendawo ngaphambi kokumba endaweni ewummango, emanzi noma engazinzile. Imigoqo yotshani nama-terrace nakho kudinga ukwakhelwa indawo efanele."
    ],
    "sourceHeading": "Check the Site Before Digging",
    "registeredEnglishTitle": "Check the Site Before Digging",
    "registeredZuluTitle": "Hlola Indawo Ngaphambi Kokumba",
    "sourceHash": "60462c3873b8f621bbc59d15cfbc396a574d7fca410e642eb09aeeb829da50a3",
    "targetHash": "711a809e08db028bcdd9416f6d35746e0de4e66646b90106209245beb6a4ff72",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-08.jpg",
    "imageSha256": "45ef39001ca49a62d758e067f8a79a64bddebf3a17a516d92331ebac0d2e2a43",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-08.mp3",
    "audioSha256": "40eb559492410080e2726957d47d29c3397fbaa077ad913a9734bed772a8885c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 9,
    "source": [
      "Roots help hold soil along a planted contour line.",
      "Choose erosion controls with local advice; steep land needs a site assessment."
    ],
    "recordedTarget": [
      "Izimpande zisiza ukubamba umhlabathi emgqeni otshaliwe we-contour.",
      "Khetha izindlela zokulawula ukuguguleka komhlabathi ngosizo lwendawo; umhlaba omqansa udinga ukuhlolwa kwendawo."
    ],
    "sourceHeading": "Watch: Roots Help Hold Soil",
    "registeredEnglishTitle": "Watch: Roots Help Hold Soil",
    "registeredZuluTitle": "Buka: Izimpande Zisiza Ukubamba Umhlabathi",
    "sourceHash": "38b116a49add5b2b62bb539f97925547e029d319299be379fab8858f5b605849",
    "targetHash": "c24b2c30de02003db637a2606dbd444e37113d3f736c6a087526ed5623dc42af",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-09.jpg",
    "imageSha256": "6ad348ae37473f42c61bd9525e70d33d144bfe930d98f27ed60a92b696048cf0",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-09.mp3",
    "audioSha256": "49ae251e3f705d15a6feb3bbcedecd29648e0507b70f0848ef0899f9a8b53c75",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 10,
    "source": [
      "A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.",
      "Rainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.",
      "Before changing a watercourse or building storage works, check the required authorisation with the water authority."
    ],
    "recordedTarget": [
      "Idamu noma ichibi lingagcina amanzi agelezayo, kodwa inani lamanzi atholakalayo lincike emvuleni yasendaweni, endaweni eqoqa amanzi, emanzini alahleka endleleni nasekutheni usebenzisa amanzi angakanani.",
      "Izinkathi zemvula ziyahlukahluka eNingizimu Afrika. Sebenzisa amarekhodi endawo, uhlele nezikhathi ezomile; akuqinisekisiwe ukuthi idamu liyohlala ligcwele.",
      "Ngaphambi kokushintsha umfula noma ukwakha indawo yokugcina amanzi, hlola nesiphathimandla samanzi ukuthi iyiphi imvume edingekayo."
    ],
    "sourceHeading": "Store Rain for the Dry Season",
    "registeredEnglishTitle": "Store Rain for the Dry Season",
    "registeredZuluTitle": "Gcina Amanzi Emvula Esikhathi Esomile",
    "sourceHash": "7862e934cb1cc4862424647ed44538096a3a860867a6f904f0cca61d66754e10",
    "targetHash": "ea477113e2d3fbb728645ddbb62677d7988665f3f12c1b7e826c539e6d3be38e",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-10.jpg",
    "imageSha256": "4bb378ae72964d22464563f5fe0a0b2c30f9f25eaf5106f17409483117d8e344",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-10.mp3",
    "audioSha256": "954826bc076f2091e0357e9ae68b5e63c9a2ef37075334dd0be7cb76be6d579f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 11,
    "source": [
      "A dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.",
      "Do not assume that annual rainfall tells you the size of a flood or the storage you will have.",
      "An uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction."
    ],
    "recordedTarget": [
      "Idamu lidinga ukuhlolwa kwendawo nokuklanywa ngumuntu oneziqu nolwazi olufanele. Amanzi agelezayo aya edamini, umhlabathi, izisekelo, ingozi engase yehlele ezindaweni ezingezansi, kanye ne-spillway ephephile konke kubalulekile.",
      "Ungacabangi ukuthi imvula yonyaka ikutshela ubukhulu besikhukhula noma inani lamanzi ozowagcina.",
      "Amanzi aphuma ngaphandle kokulawulwa angagugula futhi abhidlize udonga. Hlela indlela ephephile yokuphuma kwamanzi amaningi ngaphambi kokwakha."
    ],
    "sourceHeading": "Design the Spillway Before the Wall",
    "registeredEnglishTitle": "Design the Spillway Before the Wall",
    "registeredZuluTitle": "Klama I-Spillway Ngaphambi Kodonga",
    "sourceHash": "c2f5a9ed5b6a35bf2c5bce33302c8c84eadf924fcb8832ce08b425843e7df30c",
    "targetHash": "fec6ad93c1bcbec71aff1ce6c2b14ea50d50db76ff2e1acddbfe860d705e9d4f",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-11.jpg",
    "imageSha256": "e431ba88f09ae00dafa105daa778dd282f40aaf973f4bb676ecbfcbdfa3c25ca",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-11.mp3",
    "audioSha256": "ac804e4ee2520e0da20ef2fd69ba841b8ba719704bf26a80e5732e63e4fe9017",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 12,
    "source": [
      "Design the spillway before the wall — an overtopped wall can breach catastrophically.",
      "Catchment runoff is one input. A suitably qualified person must assess the site, dam and spillway design before construction."
    ],
    "recordedTarget": [
      "Klama i-spillway ngaphambi kodonga — udonga oluchichimelwe lungabhodloka ngendlela eyinhlekelele.",
      "Ukugeleza kwamanzi avela endaweni eqoqela amanzi kuyisici esisodwa. Umuntu oneziqu nolwazi olufanele kufanele ahlole indawo, idamu nomklamo we-spillway ngaphambi kokwakha."
    ],
    "sourceHeading": "Dam and Spillway: A Concept",
    "registeredEnglishTitle": "Dam and Spillway: A Concept",
    "registeredZuluTitle": "Idamu Ne-Spillway: Umqondo",
    "sourceHash": "965956c320588d25bfeb7c6c60b3e47d4480629077bfcb2f9ae2fd40e22c0dbd",
    "targetHash": "a10b57c711940f5fb279edf21be691661856272a12a1ddacd91e995cbcd53f95",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-12.jpg",
    "imageSha256": "981b26bba76a6e64542a56ffe7bb7bbf727ccdab4e0c56b18abc0f48d5bbb341",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-12.mp3",
    "audioSha256": "3c740cf3eecc2e543aece6ebfec4d0517faec256d00413cf562b78581cf3b95a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 13,
    "source": [
      "Water can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.",
      "Keep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.",
      "Animals can damage banks and add manure to the water. Their presence does not make the water clean or safe."
    ],
    "recordedTarget": [
      "Amanzi angalahleka ngokuhwamuka noma ngokungena emhlabathini. Hlola izinga lamanzi, ubheke ukuvuza nokuguguleka.",
      "Gcina i-spillway ingenamfucumfucu futhi unakekele izitshalo ezimboze ibhange ngendlela eshiwo emklamweni. Ungatshali izihlahla odongeni lwedamu lomhlabathi.",
      "Izilwane zingalimaza amabhange zifake nobulongwe emanzini. Ukuba khona kwazo akusho ukuthi amanzi ahlanzekile noma aphephile."
    ],
    "sourceHeading": "Care for the Dam and Its Banks",
    "registeredEnglishTitle": "Care for the Dam and Its Banks",
    "registeredZuluTitle": "Nakekela Idamu Namabhange Alo",
    "sourceHash": "04d98724ffa1f938e380c845dc678c27979d6583154ad4ea879484672109f93a",
    "targetHash": "db0a9c18397afa8bef0f6e25b54137b7eed816e7f51872f68d1b8f602af6a0b1",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-13.jpg",
    "imageSha256": "def04c35e03c2986d8d9345d87f66963aeead2b364504268858021f030e7cfb9",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-13.mp3",
    "audioSha256": "d2a271b099cd28f778a82b97f2d92f48571dd6c347667e5fe362cf2b947765ed",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 14,
    "source": [
      "Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.",
      "Check whether the roof material is suitable for rainwater collection before connecting a tank.",
      "Use the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.",
      "An annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan."
    ],
    "recordedTarget": [
      "Uphahla lwakho lungaqoqa amanzi emvula. Inani lincike endaweni yophahla, emvuleni nasekulahlekeni kwamanzi.",
      "Hlola ukuthi uphahla lwakho lufanele yini ukuqoqa amanzi emvula ngaphambi kokuxhuma ithangi.",
      "Sebenzisa indawo yophahla oyibona uma ulubuka phezulu kanye namarekhodi emvula endawo. Bese ubala amanzi angangeni emseleni wamanzi, aphambukiswayo noma achichima ethangini eligcwele.",
      "Ingqikithi yonyaka ayisho ukuthi uzoba namanzi angakanani ngesikhathi esomile. Qhathanisa amanzi ongawaqoqa nalokho ohlela ukuwasebenzisa."
    ],
    "sourceHeading": "Your Roof Is a Harvesting Surface",
    "registeredEnglishTitle": "Your Roof Is a Harvesting Surface",
    "registeredZuluTitle": "Uphahla Lwakho Lungavuna Amanzi",
    "sourceHash": "4bb44d5b7e3a4e67242128cfb7abb2c170aee3ea9a60e663f3bc7dd6390169c1",
    "targetHash": "1edf0ed188b65de41223ddfabbddf67562bd9b35c9e569d606576b864bbe941c",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-14.jpg",
    "imageSha256": "1223eb744d207dde7257642c89ad2f1a83a57744a679534bcf587e36a4c86c8b",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-14.mp3",
    "audioSha256": "bb558c0057e49b08dc329b3470c32b90c2d9e0a790315d0c69dd696d8854494c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 15,
    "source": [
      "Roof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.",
      "The required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.",
      "A diverter does not make the remaining water safe to drink."
    ],
    "recordedTarget": [
      "Amanzi ageleza ophahleni angathwala uthuli, ubulongwe bezinyoni nokunye ukungcola. Isiphambukisi samanzi okuqala sigcina amanye ala manzi okuqala engangeni ethangini.",
      "Inani okufanele liphambukiswe lincike ophahleni nasohlelweni lwakho. Landela imiyalelo yomthengisi yokulinganisa nokunakekela; alikho inani elilodwa elifanele lonke uphahla.",
      "Isiphambukisi asiqinisekisi ukuthi amanzi asele aphephile ukuphuzwa."
    ],
    "sourceHeading": "Divert the Dirty First Flush",
    "registeredEnglishTitle": "Divert the Dirty First Flush",
    "registeredZuluTitle": "Phambukisa Amanzi Okuqala Angcolile",
    "sourceHash": "c46428ae9a30f365e16e51a0711a4e60fd40524e6b2aae8a9720aaab9ad3cbc5",
    "targetHash": "aa302fb5f3f3cd2f26ebd26dc6c72241de95e10f4c7e3e4c60cfc3dee4765eed",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-15.jpg",
    "imageSha256": "5aefaf351310280596983e0ef556427d8d03a1924457523c9eb8f26a89edf1f3",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-15.mp3",
    "audioSha256": "443a82cc602262f8cb79a2230ae6e878281fbd4351e32176eb30952968da3523",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 16,
    "source": [
      "A first-flush diverter keeps early roof runoff out of the tank.",
      "Size and maintain it for your roof; later runoff still needs a safety check."
    ],
    "recordedTarget": [
      "Isiphambukisi samanzi okuqala sigcina amanye amanzi okuqala ageleza ophahleni engangeni ethangini.",
      "Silungiselele futhi usinakekele ngokophahla lwakho; amanzi alandelayo nawo asadinga ukuhlolwa kokuphepha."
    ],
    "sourceHeading": "First Flush to Tank: A Concept",
    "registeredEnglishTitle": "First Flush to Tank: A Concept",
    "registeredZuluTitle": "Amanzi Okuqala Aya Ethangini: Umqondo",
    "sourceHash": "1f94fa0761ee3f12293aba9e37553ac02cac9e34d38976b0b99d5f5e4fca4bc0",
    "targetHash": "e67cd36299bb27f93204b243aa00d0206da910bdbe9c49f9f555ae3b0cf2c615",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-16.jpg",
    "imageSha256": "27967447640824c6e6934238a78f1d63fd5448fb79e39db49001574a1603ac3a",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-16.mp3",
    "audioSha256": "041d50e56c585f9cd1a9f83723f52d40251c551064e6aea862e4f1a7af7b5b6e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 17,
    "source": [
      "Tank size depends on water demand, rain, roof area and the length of dry periods.",
      "List the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.",
      "Plan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need."
    ],
    "recordedTarget": [
      "Usayizi wethangi uncike esidingweni samanzi, emvuleni, endaweni yophahla nasekutheni izikhathi ezomile zinde kangakanani.",
      "Bhala ukuthi uzowasebenzisela ini amanzi, bese ulinganisela isidingo ngerekhodi lakho. Qhathanisa nalokho ongakuqoqa ngezinkathi zonyaka.",
      "Hlela ozokwenza uma amanzi agciniwe esephela. Igama lesifundazwe lodwa alikwazi ukukutshela usayizi wethangi oludingayo."
    ],
    "sourceHeading": "Match Tank Size to Water Demand",
    "registeredEnglishTitle": "Match Tank Size to Water Demand",
    "registeredZuluTitle": "Qhathanisa Usayizi Wethangi Nesidingo Samanzi",
    "sourceHash": "67a3b37a44593e3f6a58665ddb8238712d6edd14db8abbb4591d740a8595912e",
    "targetHash": "95d5c23a2e8e42d33cc7c073894df111590f9fbe41ec5c4db9f00dcb65097847",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-17.jpg",
    "imageSha256": "24a1c861dc2384f2b2e423401242e69bcd347988b8f2bc78289202092302a3ba",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-17.mp3",
    "audioSha256": "3f8e1afd99bbd7abe4182085201e0dde8b68499427e08d24b86236ae7273531a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 18,
    "source": [
      "Keep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.",
      "Water that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.",
      "A basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment."
    ],
    "recordedTarget": [
      "Gcina ithangi limboziwe, faka izisefo ezivimbela izinambuzane emigodini, futhi unakekele uphahla, imisele yesiphepho nesiphambukisi. Gcina la manzi ehlukile emapayipini amanzi okuphuza.",
      "Amanzi abonakala ecacile asengaba namagciwane noma amakhemikhali. Buza abezempilo bendawo ngokuhlolwa nokwelashwa okufanele ukusetshenziswa okuhlosiwe.",
      "Isihlungi esilula sodwa asiqinisekisi ukuthi amanzi aphephile ukuphuzwa. Amanzi asetshenziswa ezitshalweni zokudla nawo adinga ukuhlolwa kokuphepha."
    ],
    "sourceHeading": "Keep Stored Water Protected",
    "registeredEnglishTitle": "Keep Stored Water Protected",
    "registeredZuluTitle": "Vikela Amanzi Agciniwe",
    "sourceHash": "49d6e26e63499987c130b33054695c9fb617796e7649ef02f9e1a9c5db4f16bf",
    "targetHash": "d29a356697754d4bde2b6907866d052d5c52baa319d386a99a1363549d260a10",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-18.jpg",
    "imageSha256": "b08305592bea14c7688f94a5e6587ab666801db6a62bd6abc5b6b82742148dcd",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-18.mp3",
    "audioSha256": "49bdf07691acef3561af0e66bb4f768040d59253b68746c4df7570eea154fd8e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 19,
    "source": [
      "Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way.",
      "South African guidance differs on kitchen water and laundry water. Do not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals."
    ],
    "recordedTarget": [
      "Amanzi asetshenzisiwe asekhaya angaqukatha amagciwane, usawoti, imikhiqizo yokuhlanza nezinye izinto. Imihlahlandlela ayichazi yonke imithombo ngendlela efanayo.",
      "Imihlahlandlela yaseNingizimu Afrika iyahluka ngamanzi asekhishini nangawelondolo. Ungafaki emgomweni wokuphinda usebenzise amanzi asendlini yangasese, avela kumanabukeni, ekugezeni umuntu ogulayo noma ukugeza izilwane. Ungawasebenzisi amanzi anamakhemikhali ayingozi."
    ],
    "sourceHeading": "Used Water Varies by Source",
    "registeredEnglishTitle": "Used Water Varies by Source",
    "registeredZuluTitle": "Amanzi Asetshenzisiwe Ayahluka Ngomthombo",
    "sourceHash": "83211cd0b71668b0c1e17b922b0e33abbb2512319f9909539e7bf5f4f6cea73c",
    "targetHash": "c1252bf6cb79ac3b30edc01a1451c6317cf4406af0afab70255ebfe3eba5dd8d",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-19.jpg",
    "imageSha256": "d5c5a15fb8c714a10db923ac01390c24bfd2facd089c228cdee1cde4f34d1670",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-19.mp3",
    "audioSha256": "14ecb056a9cc6db89c265788419f24f76a3dab05e3d506a224c7acfe31634e00",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 20,
    "source": [
      "Before any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site.",
      "If this advice is unavailable or unclear, do not reuse the water. Soil and mulch do not disinfect wastewater."
    ],
    "recordedTarget": [
      "Ngaphambi kokuphinda usebenzise noma yimaphi amanzi, cela umasipala nomeluleki oqeqeshiwe wokukhucululwa kwendle bahlole umthombo oqondile, izinsiza zamanzi nezokukhucululwa kwendle zasekhaya, ukusetshenziswa okuhlosiwe nendawo.",
      "Uma lesi seluleko singatholakali noma singacacile, ungawasebenzisi kabusha amanzi. Umhlabathi ne-mulch akuwabulali amagciwane asemanzini angcolile."
    ],
    "sourceHeading": "Get Local Advice Before Any Reuse",
    "registeredEnglishTitle": "Get Local Advice Before Any Reuse",
    "registeredZuluTitle": "Thola Iseluleko Sendawo Ngaphambi Kokuphinda Usebenzise Amanzi",
    "sourceHash": "de7ad1aff2abec8f4f2c7073aac0f743551f2c521f2643c86c08f6183b67abd3",
    "targetHash": "444e3d4682891608633a9e5a9bc412816b75de79e3505e241b836bac82148abb",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-20.jpg",
    "imageSha256": "f2ed8e7874746d069036ceaf682f7fa9f84072d88c65d6b1e2246a516a5a28f9",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-20.mp3",
    "audioSha256": "6d930d34c67377aa72333e9177620eeaecd9deabac2ce2485286050c74047a4d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 21,
    "source": [
      "This generic picture is not a tested or approved farm design. It does not prove that the source, route or destination is safe.",
      "Check with qualified local advisers before any reuse. Soil and mulch do not disinfect wastewater."
    ],
    "recordedTarget": [
      "Lesi sithombe esijwayelekile asiwona umklamo wepulazi ohloliwe noma ogunyaziwe. Asifakazeli ukuthi umthombo, indlela noma indawo yokugcina amanzi iphephile.",
      "Thola iseluleko kubeluleki bendawo abaqeqeshiwe ngaphambi kokuphinda usebenzise amanzi. Umhlabathi ne-mulch akuwabulali amagciwane asemanzini angcolile."
    ],
    "sourceHeading": "A Picture Is Not a Farm Design",
    "registeredEnglishTitle": "A Picture Is Not a Farm Design",
    "registeredZuluTitle": "Isithombe Asiwona Umklamo Wepulazi",
    "sourceHash": "9c28123c04bbea5234cabf80bda1971cfefff70dc3b83877d56c83b60b0114db",
    "targetHash": "90c83a8105a83c1045bb6df8e0ddcb8ba0a1e1301bda9b9a7f28d9103ac1c188",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-21.jpg",
    "imageSha256": "ff3e56c00afab4bd2527ea37f9bc41a48f3cd7b61e37d36e2726859368977e2e",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-21.mp3",
    "audioSha256": "d4770737eda0510ecf338b26b8115a9726160ea75dcb3b9f4f9106a46958bd71",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 22,
    "source": [
      "Prevent contact with people or animals. Do not connect washwater to drinking-water plumbing, spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.",
      "If a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice."
    ],
    "recordedTarget": [
      "Vimbela abantu nezilwane ukuthi zingathintani namanzi. Ungawaxhumi emapayipini amanzi okuphuza, ungawafafazi, ungawavumeli ukuthi aqoqane abe yichibi, futhi ungawavumeli agelezele emgwaqweni, emseleni noma emfuleni ngaphandle kwendawo yakho.",
      "Uma uhlelo lokuphinda lusebenzise amanzi selusebenza kodwa amanzi enuka kabi, eqoqana noma elimaza izitshalo, yeka ukuwasebenzisa bese ucela iseluleko sendawo esiqeqeshiwe."
    ],
    "sourceHeading": "Prevent Contact and Pollution",
    "registeredEnglishTitle": "Prevent Contact and Pollution",
    "registeredZuluTitle": "Vimbela Ukuthintana Nokungcolisa",
    "sourceHash": "a306dc9493bb95ae69cbc726ff76d7b962c780b08954a602cd7d0631a15bae50",
    "targetHash": "f0e7014e22e1cf1b23d1cb53c0b35f854e8a2f23646f3edbc9736a4d39ec5ca6",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-22.jpg",
    "imageSha256": "19368b4ebe7936d03366e07ef473bdc8ac0da6c6be385fa95b7f3c7f72ecdc52",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-22.mp3",
    "audioSha256": "ccffbd64b6dbc98008b824838959d175f787999e208c62bef6575497901de794",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 23,
    "source": [
      "Build an A-frame level from three poles and a weighted string.",
      "Use it to find one level line across your slope.",
      "Photograph the A-frame and the line you marked."
    ],
    "recordedTarget": [
      "Yakha ileveli ye-A-frame ngezigxobo ezintathu nentambo enesisindo.",
      "Yisebenzise ukuthola umugqa owodwa olinganayo onqamula umthambeka wakho.",
      "Thatha isithombe se-A-frame kanye nomugqa owumakile."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wasensimini",
    "sourceHash": "19635d198226356d5eae3e7da4e6aed583652af20238a3298eefaa381659a091",
    "targetHash": "bd1247bed4fdeda25e08b2e1745e2f7b72f78a7346f6866faffb5c92f884faa4",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-23.jpg",
    "imageSha256": "972eff27fe2723f338428232631fe0b71404e2be7ace042766ddcb4e946bd218",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-23.mp3",
    "audioSha256": "8c985d95773cf4ac266fbd8648a76443b69635dd402981a8877fd1f349cd90ea",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 24,
    "source": [
      "My A-frame is built and I have tested it.",
      "Turn it around — it should read the same.",
      "I have marked at least three points at the same height across my slope.",
      "My marked line runs across the slope, not down it.",
      "Realistic minimum time for the real work: 5 days."
    ],
    "recordedTarget": [
      "I-A-frame yami yakhiwe futhi ngiyihlolile.",
      "Yiphendule ngakolunye uhlangothi — kufanele ikhombise okufanayo.",
      "Ngimake okungenani amaphuzu amathathu asezingeni elifanayo anqamula umthambeka wami.",
      "Umugqa engiwumakile unqamula umthambeka, awehli nawo.",
      "Isikhathi esincane esingokoqobo somsebenzi wangempela: izinsuku ezi-5."
    ],
    "sourceHeading": "Check Your Work",
    "registeredEnglishTitle": "Check Your Work",
    "registeredZuluTitle": "Hlola Umsebenzi Wakho",
    "sourceHash": "c9eb1ac735a01ec9ea647a1f71eacf45375f7115e42e818b8a11b8b6451d2605",
    "targetHash": "eb0e1a53de2100d3a0515d1316c7dfe1fc289ffc3dd1c6a1974ed453c2c0449f",
    "imageUrl": "/course-decks/water-harvesting/zu/slide-24.jpg",
    "imageSha256": "c85f1fe60deb98e049d6f6affb3f4a24097e0471dba3cc4a55ec979880eac65d",
    "audioUrl": "/course-audio/water-harvesting/zu/slide-24.mp3",
    "audioSha256": "cbac724f1ad1090f2f020534a0ad25e0daf064d438f3792f3544dfc6f0ea3244",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 1,
    "source": [
      "Welcome. This is Vegetables and Staple Crops. It's one of the ten modules in the ImbewuField training.",
      "A productive garden is not the one that looks fullest on one day. It's the one that keeps food moving into the household, week after week.",
      "In the next few minutes, we'll cover four things. How to build a bed. How to keep harvests coming. Which staples to grow. And what to do when pests arrive."
    ],
    "recordedTarget": [
      "Siyakwamukela. Lesi isifundo Semifino Nezitshalo Eziyisisekelo. Singesinye sezingxenye eziyishumi zokuqeqeshwa kwe-ImbewuField.",
      "Ingadi ekhiqizayo akuyona egcwele kakhulu ngosuku olulodwa. Yileyo eqhubeka iletha ukudla ekhaya, isonto ngalinye.",
      "Emizuzwini embalwa ezayo, sizokhuluma ngezinto ezine: indlela yokwenza umbhede; indlela yokugcina isivuno siqhubeka; ukuthi yiziphi izitshalo eziyisisekelo ongazitshala; nokuthi wenzeni uma kuvela izinambuzane."
    ],
    "sourceHeading": "Vegetables and Staple Crops",
    "registeredEnglishTitle": "Vegetables and Staple Crops",
    "registeredZuluTitle": "Imifino Nezitshalo Eziyisisekelo",
    "sourceHash": "4cdf94324580b4eeceb9d64b5142e65b29823db9556f71fcb9bd03c44f6c6ed9",
    "targetHash": "4d9d608c741fa1d99d4bb7b462972a79b64c6b396bc600f45767837890fe5f93",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-01.jpg",
    "imageSha256": "107c4e2d2c3a46adc2234e30d2e05e2d6cf5e094231df00379edac606b756be4",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-01.mp3",
    "audioSha256": "aa4cea0e5bff86d38aa330389090e4b894342ba631c0396f395e7784bee1374c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 2,
    "source": [
      "Let's start with the problem.",
      "One big sowing gives you a glut. Everything is ready at once. You eat what you can, you give some away, and the rest is wasted.",
      "Then comes the gap. Nothing is ready. The garden is full of plants, but there's no food in it.",
      "Small sowings create a rhythm instead. Planting, tending and harvesting overlap. Something is always coming ready.",
      "That rhythm is what feeds a household. Not the size of the garden."
    ],
    "recordedTarget": [
      "Ake siqale ngenkinga.",
      "Ukuhlwanyela okuningi ngesikhathi esisodwa kungaletha isivuno esiningi esilungele ukuvunwa ngesikhathi esisodwa. Udla ongakudla, uphe abanye, bese okunye kumoshakala.",
      "Bese kufika isikhathi lapho kungekho okuvuthiwe. Ingadi igcwele izitshalo, kodwa akukho ukudla okulungele ukuvunwa.",
      "Ukuhlwanyela okuncane ngezikhathi ezihlukene kudala isigqi. Ukutshala, ukunakekela nokuvuna kuyagqagqana. Kuhlala kunokuthile okusondela esikhathini sokuvunwa.",
      "Yileso sigqi esiletha ukudla ekhaya, hhayi ubukhulu bengadi."
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "0123b170fcdab7a5759bc33792051a24d78778211984461f0fd3094ae9ee29ea",
    "targetHash": "a84666074ca2afa0feae78f2ecdcaa47105976772a9449a699513d6ccaccc765",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-02.jpg",
    "imageSha256": "0066fd8dd45839a8e55bfb863dad8625e307b6f76a3b6ea17b6a64bb1648101f",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-02.mp3",
    "audioSha256": "ebc6a373e87c56841d4dc2b67cd5a188d755b61a6d2ab391c9761f2ea4c680d5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 3,
    "source": [
      "By the end of this module, you'll be able to make four decisions in your own field.",
      "One. Build the right bed — matching the width and the bed type to your soil and your rainfall.",
      "Two. Keep harvests moving, using succession planting and intercropping.",
      "Three. Choose staples that protect you when one crop fails.",
      "Four. Read a pest problem before you treat it.",
      "These four belong together. A well-shaped bed still fails if everything goes in on one day. A diverse planting still struggles if you treat every yellow leaf as an insect problem."
    ],
    "recordedTarget": [
      "Ekupheleni kwale mojuli, uzokwazi ukwenza izinqumo ezine ensimini yakho.",
      "Okokuqala. Yakha umbhede ofanele, uhambisanise ububanzi nohlobo lombhede nomhlabathi wakho nemvula etholwa indawo yakho.",
      "Okwesibili. Gcina ukuvunwa kuqhubeka ngokuhlwanyela ngezigaba nangokutshala izitshalo ezahlukene ndawonye.",
      "Okwesithathu. Khetha izitshalo eziyisisekelo ezikunika ezinye izindlela uma esinye isitshalo sihluleka.",
      "Okwesine. Funda inkinga yezinambuzane ngaphambi kokwelapha.",
      "Lezi zinto ezine zihambisana. Umbhede omuhle usengahluleka uma yonke into itshalwa ngosuku olulodwa. Ukutshala izitshalo ezahlukene nakho kungaba nenkinga uma wonke amaqabunga aphuzi ethathwa njengomonakalo wezinambuzane."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "b082b2c45e722e115445efcc4ee5d8c11fa18b69c785ddaf17230d25767d3d22",
    "targetHash": "b2e0ff916d00bf4b00dd774024c393904cde5375640931d1d4ff9bf05fc1a261",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-03.jpg",
    "imageSha256": "bba565891e656257b6cad02f5a0e06425ee9338ebd654708c46fb8bda3e91d4c",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-03.mp3",
    "audioSha256": "b822fb97a227e9548dbe4144562d35cc28d1c472aad364c225a5d093929f1503",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 4,
    "source": [
      "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.",
      "The protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.",
      "One metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.",
      "Now think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else."
    ],
    "recordedTarget": [
      "Umhlabathi ominyene ulahlekelwa yizikhala zomoya. Izimpande zikhula kancane. Amanzi angena ngendlela ehlukile. Umbhede uba nzima ukuwusebenza inkathi ngayinye.",
      "Ukuvikela kulula: yiba nezindlela ezihlala njalo, nombhede omncane ngokwanele ukuthi ufinyelele kuwo uvela ezinhlangothini zombili.",
      "Ububanzi obusebenzayo busuka kumitha elilodwa kuya kumamitha angu-1.2. Ngalobo bubanzi ungafinyelela maphakathi uvela kunoma iyiphi indlela, izinyawo zakho zingangeni endaweni okukhulela kuyo izitshalo.",
      "Manje cabanga ngamabhede akho. Ungafinyelela phakathi ngaphandle kokungena kuwo? Hamba uyokuzama lokhu ngaphambi kokutshala enye into."
    ],
    "sourceHeading": "Roots Need Loose Soil, Paths Need Your Feet",
    "registeredEnglishTitle": "Roots Need Loose Soil, Paths Need Your Feet",
    "registeredZuluTitle": "Izimpande Zidinga Inhlabathi Etshelekile, Izindlela Zidinga Izinyawo Zakho",
    "sourceHash": "d66247cf75c93d3ae5da6eff83de7ebea0e56d00a4c518b4fcee4914e67e33dd",
    "targetHash": "5f384b9e92616b9a2ad261c61f708635f95ed74ee541337818be66d9bbd53b5d",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-04.jpg",
    "imageSha256": "1c52e3879d3a7481ec9ca70cd0a6b1ed9fd73229faceed2d22ae531c0902fcd7",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-04.mp3",
    "audioSha256": "2d7122bdff1868f2c17c5c693c64c733fc096dbeb9ad96265195349615468d1c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 5,
    "source": [
      "There's no single bed shape that's right everywhere.",
      "Start with the least disturbance that solves your problem.",
      "No-dig suits most garden soils. Leave the structure alone and build fertility on top.",
      "Do not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.",
      "Raised beds suit wet ground, where water needs somewhere to drain away to.",
      "Sunken beds suit dry ground, where you want to catch and hold what rain you get.",
      "Look after heavy rain. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed."
    ],
    "recordedTarget": [
      "Awukho umumo wombhede owodwa ofanele yonke indawo.",
      "Qala ngokuphazamisa umhlabathi kancane ngangokunokwenzeka ukuze uxazulule inkinga yakho.",
      "Indlela ye-no-dig ifanele inhlabathi yezingadi eminingi. Shiya ukwakheka komhlabathi kungaphazamisekile, wakhe ukuvunda phezu kwawo.",
      "Ungawumbi ubumba olumanzi. Uma ukucinana noma ukungaphumi kahle kwamanzi kukukhulu, thola imbangela ngosizo lwendawo ngaphambi kokukhetha ukulima ujule.",
      "Amabhede aphakanyisiwe afanele umhlabathi omanzi, lapho amanzi edinga khona indawo yokuphuma.",
      "Amabhede acwile phansi afanele umhlabathi owomile, lapho ufuna ukubamba khona amanzi emvula uwagcine.",
      "Ngemva kwemvula enkulu, bheka ukuthi amanzi ahlala kuphi noma ageleza ngakuphi. Hlanganisa lokho okubonile neseluleko ngomhlabathi nangokuphuma kwamanzi ngaphambi kokukhetha uhlobo lombhede."
    ],
    "sourceHeading": "Choose the Bed for the Soil and Rainfall",
    "registeredEnglishTitle": "Choose the Bed for the Soil and Rainfall",
    "registeredZuluTitle": "Khetha Ibhedi Ngokwenhlabathi Nemvula",
    "sourceHash": "ab22f7011bba0d456fa54c7093684c953db5ccf217035b678959e57be0d0c7e1",
    "targetHash": "238433f54a07e30844f9eeb6564fd607376798bfa164c89172d4e0edf8714b4b",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-05.jpg",
    "imageSha256": "473285046e2668faaa35594f4e19148dc3604b5bbd215e5355a5c79fd93a16f9",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-05.mp3",
    "audioSha256": "4064bd3de6f0353abec264f8eac6cc074b932264ddffcad50f26eeaa44dab512",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 6,
    "source": [
      "Some crops resent having their roots disturbed. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.",
      "Others do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.",
      "Use spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop."
    ],
    "recordedTarget": [
      "Ezinye izitshalo azikuthandi ukuphazanyiswa kwezimpande. Zikhula kangcono uma zihlwanyelwa ngqo lapho zizokhulela khona. Izimbotyi, izaqathe nommbila kungena kulelo qembu.",
      "Ezinye zikhula kangcono uma ziqala zisesitshalweni esincane endaweni evikelekile yokukhulisela izithombo, bese zitshalwa kwenye indawo. Utamatisi nezitshalo zohlobo lwe-brassica kungena kulelo qembu.",
      "Sebenzisa iseluleko sebanga lokutshala esifanele isitshalo, uhlobo lwaso nezimo zendawo. Hlola iphakethe lembewu neseluleko somlimi wendawo. Njengoba izitshalo zikhula, bheka ukuthi aziminyene yini."
    ],
    "sourceHeading": "Seed or Seedling?",
    "registeredEnglishTitle": "Seed or Seedling?",
    "registeredZuluTitle": "Imbewu Noma Isithombo?",
    "sourceHash": "480e4fbbc372cc2c5e177ed895d2d251de815a66bde2a04469c5c96428b7f48c",
    "targetHash": "6404397e6ac2e4148cb367456f4ce4d45f2dc8767d9fdb52b78dc25fbaea0553",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-06.jpg",
    "imageSha256": "30f39adc7709aef39f94921592c7c5c0fee9c3fde9dc05f546ef12520a4a10c8",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-06.mp3",
    "audioSha256": "64443f20c9f6fd42a37b87e49150905d0f1e09f66a235e4f4677eb2add3157d9",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 7,
    "source": [
      "Before you plant, mark the bed out.",
      "One point two metres wide. Three metres long. One practice bed.",
      "Use pegs and string. Mark the rectangle, and mark both access paths.",
      "Then prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.",
      "A string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.",
      "That bed gets easier to improve every season, because you stopped walking on it."
    ],
    "recordedTarget": [
      "Ngaphambi kokutshala, maka indawo yombhede.",
      "Umbhede owodwa wokuzijwayeza: ububanzi obungamamitha angu-1.2 nobude obungamamitha amathathu.",
      "Sebenzisa izikhonkwane nentambo. Maka unxande kanye nezindlela zokungena kuzo zombili izinhlangothi.",
      "Bese ulungiselela umhlabathi wakho: qala nge-no-dig, bese umba ujule kuphela uma umhlabathi wakho ukudinga ngempela.",
      "Umugqa wentambo uguqula umbono ube yisinqumo. Uma usunezindlela, zigcine zikhona. Uma usunendawo yokukhulisela izitshalo, yivikele.",
      "Lowo mbhede uba lula ukuwuthuthukisa inkathi ngayinye ngoba uyeka ukuhamba phezu kwawo."
    ],
    "sourceHeading": "Mark the Working Shape",
    "registeredEnglishTitle": "Mark the Working Shape",
    "registeredZuluTitle": "Maka Umumo Wombhede",
    "sourceHash": "1efd67b54821f799ecc2b03888c0613da38ff58be5e2d7437e59fa472abc999a",
    "targetHash": "9639fb30494c911f8364562485e08c83a7b9fbc109d624be700485797ee8adc4",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-07.jpg",
    "imageSha256": "a9698b857ba236ac52bb5d9b313567364a3e083079e141fdbe6dbac32dd185b4",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-07.mp3",
    "audioSha256": "b4c36398741b2e0d83f65e0c62ae6ba9abbcabd845fa5a0cdbae7131ab9f53ce",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 8,
    "source": [
      "Succession planting is a calendar habit, not a special crop.",
      "Choose something your household actually eats often. Then sow a small amount of it, again and again.",
      "Plant a short row every two to three weeks.",
      "Less waste during a glut. Fresh food for longer. And the labour spreads out across the season instead of landing on you all at once.",
      "Separate sowings may reduce the risk of losing everything at once. They do not guarantee a harvest if difficult conditions continue.",
      "Which fast crop could you sow in small batches? Decide on one, and start it this week."
    ],
    "recordedTarget": [
      "Ukuhlwanyela ngokulandelana kuwumkhuba wokuhlela ikhalenda, akusona isitshalo esikhethekile.",
      "Khetha into umuzi wakho oyidla njalo ngempela. Bese uhlwanyela isilinganiso esincane sayo, uphinde wenze njalo.",
      "Tshala umugqa omfushane njalo ngemva kwamaviki amabili kuya kwamathathu.",
      "Lokhu kunganciphisa ukumoshakala ngesikhathi isivuno sisiningi kakhulu. Kungaletha ukudla okusha isikhathi eside futhi kusabalalise umsebenzi kuyo yonke inkathi, esikhundleni sokuwenza wonke ngesikhathi esisodwa.",
      "Ukuhlwanyela ngezikhathi ezihlukene kunganciphisa ingozi yokulahlekelwa yikho konke ngesikhathi esisodwa. Kodwa akukuqinisekisi ukuvuna uma izimo ezinzima ziqhubeka.",
      "Yisiphi isitshalo esikhula ngokushesha ongasihlwanyela ngamaqoqo amancane? Khetha esisodwa, bese uqala ukusihlwanyela kuleli sonto."
    ],
    "sourceHeading": "A Sowing Rhythm Keeps Food Moving",
    "registeredEnglishTitle": "A Sowing Rhythm Keeps Food Moving",
    "registeredZuluTitle": "Isigqi Sokuhlwanyela Sigcina Ukudla Kuqhubeka",
    "sourceHash": "86d2e357a2f8529d800dda5ed22066bde8c375001b41c74eae26dcaf416f504d",
    "targetHash": "069f39c9e7785a6c3e13efed9558f760d9921febcb9ae9b15173f98439495083",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-08.jpg",
    "imageSha256": "6ce9f3931ae7099be2e375c972eb30afe93ffcb3e9b89f0bd2c32f59b398cdab",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-08.mp3",
    "audioSha256": "28209a573288df9091e45dc3b273eecdb3abaedd37eaee2aa9c7e036802b0af6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 9,
    "source": [
      "Here's what it looks like in practice.",
      "Sow one. Then two to three weeks later, sow two. Then sow three. Then sow four.",
      "With suitable crop timing, harvests can begin to overlap. The first batch will not always be ready by the fourth sowing.",
      "Two to three weeks is a starting rhythm, not a law. A cool-season leaf crop may hold longer. Heat may speed things up, or cause a failure.",
      "Watch what your own garden does, and adjust the interval. That observation is the skill."
    ],
    "recordedTarget": [
      "Nansi indlela esebenza ngayo.",
      "Hlwanyela iqoqo lokuqala. Ngemva kwamaviki amabili kuya kwamathathu, hlwanyela elesibili. Bese uhlwanyela elesithathu, bese elesine.",
      "Uma isikhathi sokukhula kwesitshalo sikuvumela, ukuvuna kwamaqoqo kungaqala ukuhlangana. Iqoqo lokuqala alihlali lilungele ukuvunwa ngesikhathi kuhlwanyelwa iqoqo lesine.",
      "Amaviki amabili kuya kwamathathu ayisiqalo sesigqi sokuhlwanyela, akuwona umthetho. Isitshalo samaqabunga senkathi epholile singathatha isikhathi eside. Ukushisa kungasheshisa ukukhula noma kubangele ukwehluleka.",
      "Bheka okwenzeka engadini yakho, bese ulungisa isikhawu sokuhlwanyela. Lelo khono lokubuka nokulungisa libalulekile."
    ],
    "sourceHeading": "Sow Little and Often",
    "registeredEnglishTitle": "Sow Little and Often",
    "registeredZuluTitle": "Hlwanyela Kancane Futhi Njalo",
    "sourceHash": "fb462910f95e0f635810c2bb398b7dc5758780a48fd16f026d08119f65769e41",
    "targetHash": "cac7132c455b31bb1791e3ddfb3e3c6f04f5a59ed9d46be4f788ccd54aab927f",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-09.jpg",
    "imageSha256": "8e6399322b5360aabf53891dcda1bca68b559c8ecb11fd2625a069a0552ae750",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-09.mp3",
    "audioSha256": "947b85c8ac6f9d4c87f6473bae4e27ab47042a0d15ac56cb6329d2dc9ef3b146",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 10,
    "source": [
      "Intercropping is not just crowding different plants together. Each plant needs a job, and enough space to do it.",
      "The Three Sisters is an example from Indigenous farming traditions in the Americas.",
      "Maize gives height and structure.",
      "Beans climb the maize, and store as protein.",
      "Pumpkin spreads across the ground, shading the soil and holding moisture.",
      "Timing matters. Establish the maize first, so it's strong enough to carry the beans when they start to climb.",
      "The plants can still compete. Give them suitable space, water and light. Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition."
    ],
    "recordedTarget": [
      "Ukutshala izitshalo ezahlukene ndawonye akukhona ukuminyanisa izitshalo nje. Isitshalo ngasinye sidinga umsebenzi waso nesikhala esanele sokuwenza.",
      "I-Three Sisters iyisibonelo esivela emasikweni okulima abantu boMdabu baseMelika.",
      "Ummbila unikeza ukuphakama nesakhiwo.",
      "Izimbotyi zikhwela ummbila futhi zingagcinwa njengomthombo wamaprotheni.",
      "Ithanga lisabalala phansi, lenze umthunzi emhlabathini futhi lisize ukuwugcina unomswakama.",
      "Isikhathi sokutshala sibalulekile. Qala ngokutshala ummbila ukuze uqine ngokwanele ukuthwala izimbotyi lapho seziqala ukukhwela.",
      "Lezi zitshalo zisengancintisana. Zinike isikhala, amanzi nokukhanya okufanele. Izimbotyi zibopha i-nitrogen ngosizo lwamagciwane asezimpandeni, kodwa ungacabangi ukuthi zondla ummbila ngokushesha; izakhamzimba ezisezinsaleleni zitholakala lapho sezibola."
    ],
    "sourceHeading": "Each Crop Earns Its Place",
    "registeredEnglishTitle": "Each Crop Earns Its Place",
    "registeredZuluTitle": "Isitshalo Ngasinye Sidinga Isizathu Sendawo Yaso",
    "sourceHash": "26c4b528b899f2820a55209b7a58da2de7b5434be2841a2fca548ecae990f776",
    "targetHash": "5237d857d4c2714916753b03eb3931821767cb344c989637dd9e17a2405ee46e",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-10.jpg",
    "imageSha256": "74a47759c0ababaec2051549b691e3c0e63d39ec8820c8527ffb70df63601d51",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-10.mp3",
    "audioSha256": "8d9e5681065fc94261fef383d2cde19d602015f72cda94f56697f8fe166bc15e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 11,
    "source": [
      "A household may have a hungry gap: weeks when stored food runs low before the next harvest is ready.",
      "Yours might come after stored maize runs out. It might come before winter greens are ready. It might come in a dry period when water limits the garden.",
      "Don't copy somebody else's calendar. Name your own months first.",
      "Write them down. Then choose the crop and the sowing date that puts food into that gap.",
      "That's planning backwards, and it's the difference between a garden that looks productive and a household that eats."
    ],
    "recordedTarget": [
      "Umuzi ungase ube nesikhathi sokushoda kokudla: amasonto lapho ukudla okugcinwe khona sekuncipha ngaphambi kokuba isivuno esilandelayo silungele ukuvunwa.",
      "Kowenu leso sikhathi singafika ngemva kokuphela kommbila ogciniwe. Singafika ngaphambi kokuba imifino yasebusika ilungele ukuvunwa. Singafika nangesikhathi esomile lapho amanzi enciphisa okungatshalwa engadini.",
      "Ungakopeli ikhalenda lomunye umuntu. Qala ngokusho izinyanga zakho.",
      "Zibhale phansi. Bese ukhetha isitshalo nesikhathi sokusihlwanyela ukuze ukudla kutholakale ngaleso sikhathi sokushoda.",
      "Lokho ukuhlela usuka ekudingeni uye emuva. Kwenza umehluko phakathi kwengadi ebonakala ikhiqiza nomuzi othola ukudla."
    ],
    "sourceHeading": "Plan Backwards From Your Hungry Gap",
    "registeredEnglishTitle": "Plan Backwards From Your Hungry Gap",
    "registeredZuluTitle": "Hlela Usuka Emuva Esikhathini Sokushoda Kokudla",
    "sourceHash": "dc99ab5544c321fc4a9ce23a9967ecd7689c2cc1b55c803853b1dbc99aa20df1",
    "targetHash": "59c89e7771bd967ef8af2dd64a1fde4725dd73fa1bc5d2912fa197b9c0415495",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-11.jpg",
    "imageSha256": "9307e0f18ab96711890de25e7b786a55199c65cac1a47a4c8a38cc7ec610e3a0",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-11.mp3",
    "audioSha256": "ad7f60599575dcd1fc29e5e4ebfbf7193fcdffc6307dbfb2a6e914db83e09740",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 12,
    "source": [
      "A staple earns its place because it feeds the household beyond the day of harvest.",
      "It carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.",
      "One staple leaves you vulnerable. Two or more give you options when weather or pests hit.",
      "Grow at least two. Not one.",
      "Which staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion."
    ],
    "recordedTarget": [
      "Isitshalo esiyisisekelo sikufanele ukutshalwa uma sondla umuzi nangemva kosuku lokuvuna.",
      "Sinikeza amandla okudla noma amaprotheni. Singagcinwa, noma sihlale emhlabathini size sisidinge. Sivame nokuthwala umlando wesiko.",
      "Ukuthembela esitshalweni esisodwa kukushiya usengozini. Izitshalo eziyisisekelo ezimbili noma ngaphezulu zikunika izindlela ongakhetha kuzo lapho isimo sezulu noma izinambuzane zidala umonakalo.",
      "Tshala okungenani ezimbili, hhayi esisodwa.",
      "Yisiphi isitshalo esiyisisekelo umuzi wakho oncike kuso kakhulu njengamanje? Uma singavuni, yisona esingawulimaza kakhulu umuzi wakho ngokushoda kokudla; cabanga ngesinye esingahambisana naso."
    ],
    "sourceHeading": "Staples Are Food Insurance",
    "registeredEnglishTitle": "Staples Are Food Insurance",
    "registeredZuluTitle": "Izitshalo Eziyisisekelo Ziwukuvikeleka Kokudla",
    "sourceHash": "8e3c96b8ac7b2d993054185380feb45ea360bf390ef2f2e4fc260ff14ea1a37c",
    "targetHash": "4004ddaec513fccb8e302c811f73b980cbda4ccf62551079d5548e967f8f88db",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-12.jpg",
    "imageSha256": "727ce77fe810e36bbbd9faabf60ca366ef016e82da9bc859d307eafb43c77d7e",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-12.mp3",
    "audioSha256": "09bd968b93b266608a4e06a5fb4e6fbf38b13e0e4b277456d12c3edf98ab11c9",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 13,
    "source": [
      "Each staple protects you against something different.",
      "Maize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.",
      "Beans and cowpeas give a storable protein harvest.",
      "Sweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.",
      "Amadumbe handles wetter ground, where other staples struggle.",
      "Notice that they fail in different conditions. That's the whole point."
    ],
    "recordedTarget": [
      "Isitshalo ngasinye esiyisisekelo singasiza ngezimo ezihlukene.",
      "Ummbila unikeza amakhalori futhi ungomiswa ugcinwe. Ummbila ovulekele impova yezinye izitshalo zohlobo olufanayo ungakuvumela ugcine imbewu yakho, uma ulawula ukuhlangana kwempova nokukhetha izitshalo zembewu.",
      "Izimbotyi nezindumba zinikeza isivuno samaprotheni esingagcinwa.",
      "Ubhatata ungakhula ubekezelele ukoma ngezinga elithile ngemva kokwakheka kwezimpande zawo ezigcinela ukudla. Udinga amanzi emasontweni okuqala nangesikhathi kwakheka lezo zimpande; ukuntuleka kwamanzi ngalezo zikhathi kunganciphisa isivuno. Amaqabunga awo amancane nawo ayadliwa.",
      "Amadumbe abhekana nomhlabathi omanzi kakhulu, lapho ezinye izitshalo eziyisisekelo zingase zingakhuli kahle khona.",
      "Qaphela ukuthi lezi zitshalo azihluleki ezimweni ezifanayo. Yilokho okubalulekile."
    ],
    "sourceHeading": "Different Staples Protect Against Different Risks",
    "registeredEnglishTitle": "Different Staples Protect Against Different Risks",
    "registeredZuluTitle": "Izitshalo Eziyisisekelo Ezahlukene Zivikela Ezingozini Ezahlukene",
    "sourceHash": "b7271cb7196f0462d3def105805cc8248a73a721c8d00c2a04b1431a544250f2",
    "targetHash": "8eb3d28f8b72605816ca093fc2fbfd3278157285d453f9f84780e9d728d09de3",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-13.jpg",
    "imageSha256": "1368022830d05d0a7a6f76179c861f5d11bccf8d79029c803b81494e3ee67e50",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-13.mp3",
    "audioSha256": "495d4791ca2445b41a6e22bb17b6083c40b4f14310ca7827c5071a451e2d9313",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 14,
    "source": [
      "Resilience doesn't mean nothing fails.",
      "It means one failure doesn't finish your household's food plan.",
      "One crop is one point of failure.",
      "Two or more staples give you more ways to keep eating.",
      "Different crops use water, soil and seasons differently. That difference is the protection."
    ],
    "recordedTarget": [
      "Ukukwazi ukuqhubeka nezinhlelo akusho ukuthi akukho lutho oluzohluleka.",
      "Kusho ukuthi ukwehluleka kwesitshalo esisodwa akupheli uhlelo lokudla lomndeni wakho.",
      "Ukuthembela esitshalweni esisodwa kubeka umuzi engcupheni eyodwa.",
      "Izitshalo ezimbili noma ngaphezulu zikunika izindlela eziningi zokuqhubeka uthola ukudla.",
      "Izitshalo ezahlukene zisebenzisa amanzi, umhlabathi nezinkathi ngezindlela ezahlukene. Lo mehluko unikeza ezinye izindlela uma isimo sishintsha."
    ],
    "sourceHeading": "Diversity Keeps Food Moving",
    "registeredEnglishTitle": "Diversity Keeps Food Moving",
    "registeredZuluTitle": "Ukwahlukahluka Kugcina Ukudla Kuqhubeka",
    "sourceHash": "c1e6fc1bf0663128f6a5c1731c091dc779f5af238c9fb1e5e1c73450576c0abf",
    "targetHash": "747b2c899e84361fb0367fc4ec042debf2122b46e9c86a3577d9812059073309",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-14.jpg",
    "imageSha256": "eba73f80acd23f297b56dc7cbdc96216fb5af3b6abf8ccafbaeb8afb432ecf11",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-14.mp3",
    "audioSha256": "5a04a59e354f4a9011e2fe8009e361a37bbd0c3f3a1898a476a3dabc62ee8396",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 15,
    "source": [
      "Pest pressure usually rises for a reason.",
      "Plants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.",
      "So before you treat anything, look at the whole system.",
      "Is the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?",
      "A yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act."
    ],
    "recordedTarget": [
      "Ukwanda kwezinambuzane ezilimaza izitshalo kuvame ukuba nesizathu.",
      "Izitshalo zingacindezeleka. Uhlobo olulodwa lwesitshalo lungabusa indawo. Noma ukusetshenziswa kabanzi kwamakhemikhali kungase kube sekususe izilwane ezidla izinambuzane ezazikusiza.",
      "Ngakho ngaphambi kokwelapha noma yini, bheka lonke uhlelo.",
      "Ingabe isitshalo sishoda ngamanzi? Ingabe umhlabathi uminyene noma untula izakhamzimba? Ingabe izilwane ezidla izinambuzane sezisiza kule nkinga?",
      "Iqabunga eliphuzi alisho ngokuzenzakalelayo ukuthi kunesinambuzane. Kungabangelwa amanzi, ukondleka noma ukulimala kwezimpande. Thola ukuthi iyiphi imbangela ngaphambi kokuthatha isinyathelo."
    ],
    "sourceHeading": "Pests Are Messengers Before They Are Enemies",
    "registeredEnglishTitle": "Pests Are Messengers Before They Are Enemies",
    "registeredZuluTitle": "Izinambuzane Ziyizithunywa Ngaphambi Kokuba Zibe Yizitha",
    "sourceHash": "0c107bc3c83b14fae5a19284d5f7049f1fa61fa1e9eaf0563874a348c5eb0b5e",
    "targetHash": "77adf1701e72850486fe4372748b943215158b5bb3755057263ed3f244ffc9d2",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-15.jpg",
    "imageSha256": "1cbd2fe2a69f01ea4c406c7e321a662c175b83e275465322b18036a1e9bd9161",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-15.mp3",
    "audioSha256": "1d0b62ff4ee5d51189a28f1cb98012731536081825102fa93b2c1a5fe1070f84",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 16,
    "source": [
      "Work through four steps, in order.",
      "One. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.",
      "Two. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.",
      "Three. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.",
      "Four. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.",
      "If a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.",
      "Be honest with yourself about which step you usually skip."
    ],
    "recordedTarget": [
      "Landela izinyathelo ezine ngokulandelana.",
      "Okokuqala. Bheka. Bheka iphethini yokulimala, ngaphansi kweqabunga, isiqu nezitshalo eziseduze.",
      "Okwesibili. Hlola ukucindezeleka kwesitshalo. Hlola umswakama womhlabathi, izimpande, isikhala phakathi kwezitshalo, izakhamzimba nokuphuma kwamanzi.",
      "Okwesithathu. Vikela okusizayo. Izinambuzane ezizuzisayo zenza umsebenzi obungase uwenze wena.",
      "Okwesine. Yilapho kuphela osuthatha khona isinyathelo; qala ngesenzo esilula kunazo zonke esifanele. Ukususa izinambuzane ngesandla, ukubeka izithiyo noma ukushintsha indlela yokunakekela izitshalo kungasiza. Hlola ukuthi isenzo siyayifanele yini inkinga, bese ubheka umphumela.",
      "Uma kudingeka ukwelapha ngomkhiqizo, sebenzisa umkhiqizo obhaliswe ukuthi usetshenziswe kuleso sitshalo nakuleso sinambuzane, bese ulandela yonke imiyalelo eselebulini lawo. Lokhu kuhlanganisa nemikhiqizo ye-neem. Hlola imiyalelo yokuzivikela kanye nesikhathi sokulinda ngaphambi kokuvuna. Ungazenzeli izingxube noma usebenzise imithamo enamandla kunaleyo eselebulini.",
      "Zitshele iqiniso ngokuthi yisiphi isinyathelo ovame ukusishiya."
    ],
    "sourceHeading": "Treat the Cause Before the Insect",
    "registeredEnglishTitle": "Treat the Cause Before the Insect",
    "registeredZuluTitle": "Bheka Imbangela Ngaphambi Kwesinambuzane",
    "sourceHash": "ee59fde47d13321ca77613468c3c17e77d373cfc693ef186f62480d93825684c",
    "targetHash": "d0498946fce3d69a339971d0976a20ab2f034619bba94585a01a325a565bf210",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-16.jpg",
    "imageSha256": "fed229945cc4f826f779d5104ea1162bf36ec6dcfcfbc7f4c1749669ce335cb0",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-16.mp3",
    "audioSha256": "0c98dc0292d82e71dded1e46547c0e56ea598bfe6300b80384209aaafa4dede5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 17,
    "source": [
      "Now the lesson finishes in the soil.",
      "Build one bed that can keep feeding you. One point two metres by three metres.",
      "Reach the middle from both sides. Keep every foot on the paths. Space your plants for your own climate. Mulch the bed.",
      "Check the bed regularly from planting. Use the ten-day photograph as an assignment checkpoint, not a reason to delay care.",
      "Photograph it when it's planted. Then come back after ten days with what you observed.",
      "The aim isn't a perfect picture. The aim is a bed whose shape, spacing and rhythm you chose on purpose."
    ],
    "recordedTarget": [
      "Manje isifundo siphetha ngomsebenzi emhlabathini.",
      "Yenza umbhede owodwa ongakusiza uqhubeke uthola ukudla. Ububanzi obungamamitha angu-1.2 nobude obungamamitha amathathu.",
      "Finyelela maphakathi uvela ezinhlangothini zombili. Hamba ezindleleni kuphela. Shiya isikhala esifanele phakathi kwezitshalo ngokwesimo sezulu sendawo yakho. Mboza umbhede nge-mulch.",
      "Bheka umbhede njalo kusukela ngosuku otshalwe ngalo. Isithombe sezinsuku eziyishumi siyisikhathi sokuhlola umsebenzi; akusona isizathu sokulinda ngaphambi kokunakekela umbhede.",
      "Thatha isithombe lapho usanda kutshalwa. Buya ngemva kwezinsuku eziyishumi nokubone kwenzeka.",
      "Inhloso akusona isithombe esiphelele. Inhloso umbhede omumo wawo, isikhala sezitshalo nesigqi sokuhlwanyela okukhethe ngamabomu."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wensimu",
    "sourceHash": "f1d90954adab74e5a2a2f505b5425794cec2e6cbf3a881d11cc162a5dbccde3d",
    "targetHash": "460d7ed71e4ffece7b13acf017e81804e8569e69cc9ddd4a721405d0aa0deca6",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-17.jpg",
    "imageSha256": "8d6c0b86e337a0b6a306fa28ec2a7402a483d49d7d6e50dee80abd473501f762",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-17.mp3",
    "audioSha256": "2d08b917878c10e7a9ce1fde9146900bcf58cd07080a640bd84cf096c904ce18",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 18,
    "source": [
      "This week, put one bed into production.",
      "One. Mark the bed and the paths.",
      "Two. Plant, with your spacing and your sowing rhythm.",
      "Three. Return after ten days, with a photo.",
      "Then observe. Adjust. And write it down.",
      "Record the sowing date. The rain. What germinated. Pest pressure. What you harvested.",
      "Season by season, your garden becomes less dependent on guesswork — and more on what you've actually seen happen on your own ground.",
      "Use your record with reliable local advice when making the next decision."
    ],
    "recordedTarget": [
      "Kuleli sonto, sebenzisa umbhede owodwa.",
      "Okokuqala. Maka umbhede nezindlela.",
      "Okwesibili. Tshala, usebenzise isikhala nesigqi sakho sokuhlwanyela.",
      "Okwesithathu. Buya ngemva kwezinsuku eziyishumi nesithombe.",
      "Bese ubheka, ulungise, ubhale phansi.",
      "Bhala usuku lokuhlwanyela, imvula, okumilile, ukwanda kwezinambuzane, nokuvunile.",
      "Inkathi ngayinye, ingadi yakho ingancika kancane ekuqageleni futhi incike kakhulu kulokho okubonile kwenzeka emhlabeni wakho. Sebenzisa amarekhodi akho kanye neseluleko esithembekile sendawo lapho uthatha isinqumo esilandelayo."
    ],
    "sourceHeading": "Field Action",
    "registeredEnglishTitle": "Field Action",
    "registeredZuluTitle": "Isenzo SaseNsimini",
    "sourceHash": "9c107e2877c52cc428576a5abff1cb9dc5a6c9939f99a23d7b99a33b983b758b",
    "targetHash": "8571b7a56b8692a40b42d9fb8a2a0964657e988afa54faeeac286654aac87cd9",
    "imageUrl": "/course-decks/vegetables-staples/zu/slide-18.jpg",
    "imageSha256": "df0445384e7f1733f06bed7e1d0ddd61d6a38c1c61201fe184706e81934dcfbe",
    "audioUrl": "/course-audio/vegetables-staples/zu/slide-18.mp3",
    "audioSha256": "1fc801d605e69a3409393105ede021aa6551085e92368f825798b9412bd00ec3",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 1,
    "source": [
      "Build a living food system in layers.",
      "Grow food from tall canopy down to root crops.",
      "Use vertical space, soil life, shade, and moisture together.",
      "Learn how to design and establish a food forest for your farm."
    ],
    "recordedTarget": [
      "Yakha uhlelo lokudla oluphilayo olunezingqimba. Khulisa ukudla kusukela ku-canopy ende kuye ezitshalweni zezimpande. Sebenzisa indawo eya phezulu, ukuphila komhlabathi, umthunzi nomswakama ndawonye. Funda ukuklama nokusungula i-food forest yepulazi lakho."
    ],
    "sourceHeading": "Food Forest Design",
    "registeredEnglishTitle": "Food Forest Design",
    "registeredZuluTitle": "Ukuklama I-Food Forest",
    "sourceHash": "76c2590595d6fbfa6e7d683ed7da240255c796e2a4efd09611aebe391f409919",
    "targetHash": "07201511dad580cb1a5c670c87dd4247caff0e9c6a635976f30cf896455ee7d5",
    "imageUrl": "/course-decks/food-forest/zu/slide-01.jpg",
    "imageSha256": "48285c05304568ca344853d4355877b38a2fdde1ed605d3d29cc4790d1f54111",
    "audioUrl": "/course-audio/food-forest/zu/slide-01.mp3",
    "audioSha256": "76c8d2369deaec5dae44c8536ee003a218350e8c05bfb56c1df3bbb9cb809656",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 2,
    "source": [
      "A food forest grows useful plants at different heights.",
      "Good design can combine harvests, shade and soil cover. Plants still compete for light, water and nutrients.",
      "Plan the care you can provide and watch how the planting changes."
    ],
    "recordedTarget": [
      "I-food forest ikhula izitshalo eziwusizo ezindaweni eziphakeme ezahlukene. Umklamo omuhle ungahlanganisa isivuno, umthunzi nesembozo somhlabathi. Izitshalo zisancintisana ngokukhanya, amanzi nezakhamzimba. Hlela ukunakekela ongakwazi ukukwenza, bese ubheka ukuthi ukutshala kushintsha kanjani."
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "c3b5593cca0071bb1158db49e5679b41d9eb541dfc193ae68cfee236dba5f911",
    "targetHash": "cb509a46c2bbe50b43ad256285f026c3ebf60728b43066b50ef037ad26293ea9",
    "imageUrl": "/course-decks/food-forest/zu/slide-02.jpg",
    "imageSha256": "bb57c0ab1e60e6ac4aa1fd6ca8bf7555a172bb7a43d14a74bbfb49977f7b3f6d",
    "audioUrl": "/course-audio/food-forest/zu/slide-02.mp3",
    "audioSha256": "ab979048b4abc8bcb259f4a0bca33c47af5e031b64540e01794ef6ce72616291",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 3,
    "source": [
      "Name the seven commonly described food-forest layers.",
      "Check plants against your site, local ecology and the approved project list.",
      "Plan establishment and ongoing care without assuming a fixed date for harvest or canopy closure."
    ],
    "recordedTarget": [
      "Yisho izingxenye eziyisikhombisa ezivame ukuchazwa ze-food forest. Hlola ukuthi izitshalo ziyifanele yini indawo yakho, imvelo yangakini nohlu lwezitshalo olugunyazwe yiphrojekthi. Hlela ukunakekelwa ngesikhathi izitshalo zimila nangemva kwalokho, ungacabangi ukuthi kukhona usuku olumisiwe lokuvuna noma lokuvaleka kophahla lwezihlahla."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "8bcf7c8c0fd550f09f9afadca6fa86f113418de80eca2fc8ee4b7a9661573963",
    "targetHash": "85738d66c66a331766b36979df9ce3b6c9f2b045ba6ed7f2829518f08e9611bd",
    "imageUrl": "/course-decks/food-forest/zu/slide-03.jpg",
    "imageSha256": "582360b6d3336f08eb90972b7263632063730d0c39a3ec48f654323b96df028d",
    "audioUrl": "/course-audio/food-forest/zu/slide-03.mp3",
    "audioSha256": "c413613e50472d48742773ad28b73015c99a85b5bb7a2f62a1679c42900b7eb4",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 4,
    "source": [
      "An indigenous forest fills the space from the highest branches to the roots.",
      "Different plants use the light and moisture available at their level.",
      "A food forest copies this pattern with productive species.",
      "The result is not one crop in one row, but many useful layers growing together."
    ],
    "recordedTarget": [
      "Ihlathi lezitshalo zomdabu ligcwalisa indawo kusukela emagatsheni aphakeme kakhulu kuze kufike ezimpandeni. Izitshalo ezahlukene zisebenzisa ukukhanya nomswakama okutholakala ezingeni ezikhula kulo. I-food forest ilingisa le ndlela ngezitshalo ezikhiqizayo: izingqimba eziningi eziwusizo zikhula ndawonye esikhundleni sesitshalo esisodwa emugqeni owodwa."
    ],
    "sourceHeading": "The Forest Uses Every Layer",
    "registeredEnglishTitle": "The Forest Uses Every Layer",
    "registeredZuluTitle": "Ihlathi Lisebenzisa Wonke Ama-Layer",
    "sourceHash": "10b4b6f9e5c00d616dbeced569a16c9876f98ec8e2363a5a1fb6e5aee9f91cc2",
    "targetHash": "96c1b6f0bf6d79ab09d706a4b822ae3f58551b2d7625bf917d0b63dc5dd05e35",
    "imageUrl": "/course-decks/food-forest/zu/slide-04.jpg",
    "imageSha256": "6b851f7acbc5062a542eb522b032d5ac363b2776c2398122ca9af79c6a6d313f",
    "audioUrl": "/course-audio/food-forest/zu/slide-04.mp3",
    "audioSha256": "62b25bfa9420a28acf86f53dc48dea75ac08af6f4bf97aa2e4d6bbb0abbf7d05",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 5,
    "source": [
      "Find seven planting layers.",
      "Tall trees form the canopy.",
      "Smaller trees grow below it.",
      "Then look for woody shrubs.",
      "Herbaceous plants have soft stems.",
      "Ground cover spreads across the surface.",
      "Root crops grow below the surface.",
      "Climbers use suitable supports.",
      "These are planning layers, not fixed height bands. Choose plants and spacing for your site."
    ],
    "recordedTarget": [
      "Isithombe esimile nokulandisa kuveza izingxenye eziyisikhombisa zokuhlela: Uphahla lwezihlahla ezinde, Izihlahla ezincane, Izihlahlana ezinamagatsha aqinile, Izitshalo ezineziqu ezithambile, Izitshalo ezimboza umhlabathi, Izitshalo zezimpande nezitshalo ezikhuphukayo. Lezi akuzona izilinganiso zokuphakama ezimisiwe; khetha izitshalo nezikhala ngokwendawo yakho."
    ],
    "sourceHeading": "Watch: Read the Seven Planting Layers",
    "registeredEnglishTitle": "Watch: Read the Seven Planting Layers",
    "registeredZuluTitle": "Buka: Funda Izendlalelo Eziyisikhombisa Zokutshala",
    "sourceHash": "e74c982ec6a4b7050b8f4bb69fe367dbab12fa05d1d8a722444299307e3a649b",
    "targetHash": "c8bc423cb15b84c1558d3419adc9efe9e422ab36a9a83badeb2990c9a78e50ef",
    "imageUrl": "/course-decks/food-forest/zu/slide-05.jpg",
    "imageSha256": "8079c1e6bbe9b5d4616279d5ab04d4e1c35d138d19bc73cddcf4808de1122124",
    "audioUrl": "/course-audio/food-forest/zu/slide-05.mp3",
    "audioSha256": "5b4c8607ba9cd34d389c7fcda8e729036e4d075808d49640b50689267d20b1c2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 6,
    "source": [
      "Think of tall canopy, smaller trees, shrubs and herbaceous plants.",
      "Ground cover protects the surface, root crops grow below it, and climbers use suitable supports.",
      "The heights and spacing depend on the plants and site. These are planning layers, not fixed height bands."
    ],
    "recordedTarget": [
      "Cabanga ngophahla lwezihlahla ezinde, izihlahla ezincane, izihlahlana nezitshalo ezineziqu ezithambile. Izitshalo ezimboza umhlabathi zivikela ingaphezulu lawo, izitshalo zezimpande zikhula ngaphansi kwalo, kanti izitshalo ezikhuphukayo zidinga izisekelo ezifanele. Ukuphakama nezikhala kuncike ezitshalweni nasendaweni; lezi yizingxenye zokuhlela, azizona izilinganiso zokuphakama ezimisiwe."
    ],
    "sourceHeading": "The Seven Layers",
    "registeredEnglishTitle": "The Seven Layers",
    "registeredZuluTitle": "Ama-Layer Ayisikhombisa",
    "sourceHash": "ae303b68c2fda9d9eeddce36b8102339ec09489da9db02d998ed96b8a0af86e5",
    "targetHash": "7ca29e2306dc9ea2c8abd795831ac037c93c4b4d4b6ecda3b45a2dd4859a85c4",
    "imageUrl": "/course-decks/food-forest/zu/slide-06.jpg",
    "imageSha256": "e3a49409b969a1260df655bf3c6df01824095ad72379861cfd9425bdf4e9b210",
    "audioUrl": "/course-audio/food-forest/zu/slide-06.mp3",
    "audioSha256": "0165e0abd48446590aa3e678edbb1d868726dfe12a258024d65d019efd495c7e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 7,
    "source": [
      "The original Highveld example includes Wild Fig or pecan above lemon, naartjie and black mulberry.",
      "It places Cape gooseberry and Wild Medlar with vegetables, wild garlic, sweet potato and granadilla.",
      "Treat this as a layout example, not permission to plant every species. Check identity, frost tolerance, mature size and local restrictions first."
    ],
    "recordedTarget": [
      "Isibonelo sokuqala sase-Highveld sifaka i-Wild Fig noma i-pecan ngaphezu kukalamula, i-naartjie ne-black mulberry. Sihlanganisa i-Cape gooseberry ne-Wild Medlar nemifino, i-wild garlic, ubhatata ne-granadilla. Lesi yisibonelo sokuhlela kuphela; asiyona imvume yokutshala zonke izinhlobo zezitshalo ezisohlwini. Qinisekisa ukuthi isitshalo siyini, siyakwazi yini ukumelana nesithwathwa, sizoba sikhulu kangakanani nokuthi ayikho yini imingcele yendawo ngaphambi kokutshala."
    ],
    "sourceHeading": "Read a Layered Planting Example",
    "registeredEnglishTitle": "Read a Layered Planting Example",
    "registeredZuluTitle": "Funda Isibonelo Sokutshala Ngezendlalelo",
    "sourceHash": "f6b21e56484270100291113f8426253f9aabe96087222915bc3a493bcab7a5df",
    "targetHash": "e7f4a11e24a9e5bc45a38919de71c976acf2393a176f64c8492c78f5ab915ddb",
    "imageUrl": "/course-decks/food-forest/zu/slide-07.jpg",
    "imageSha256": "b4acb77f227b2149290a079721ea8872b110a3acfe59c56550226745fa966c87",
    "audioUrl": "/course-audio/food-forest/zu/slide-07.mp3",
    "audioSha256": "30e78e212ea69a722c38372e594168a26bf57aa6ac799a7bc0a38d3250030ab0",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 8,
    "source": [
      "Young plants need establishment care: moisture checks, weed control and protection from damage.",
      "As plants grow, shade and leaf litter change conditions below them.",
      "Check competition and access. Prune, thin or adjust lower planting when observations call for it; the system does not become care-free on a fixed birthday."
    ],
    "recordedTarget": [
      "Izitshalo ezisencane zidinga ukuhlolwa komswakama, ukulawulwa kokhula nokuvikelwa ekulimaleni. Njengoba zikhula, umthunzi namaqabunga awelayo kushintsha izimo ezingaphansi kwazo. Hlola ukuncintisana phakathi kwezitshalo nokufinyelela kuzo. Thena, nciphisa noma ulungise izitshalo ezingezansi lapho okubukayo kukukhombisa ukuthi kudingeka; ukunakekela akupheli ngosuku olumisiwe."
    ],
    "sourceHeading": "Care Changes as Plants Grow",
    "registeredEnglishTitle": "Care Changes as Plants Grow",
    "registeredZuluTitle": "Ukunakekela Kuyashintsha Njengoba Izitshalo Zikhula",
    "sourceHash": "20370de2872e3cb39d5df4cf66000b65a90124b0ceafbeb65832b78ee5a2a0da",
    "targetHash": "ef7ad5fac1e0dad33e8860dcb608a9d1d4c324dbbf2a34118bf658692c28c041",
    "imageUrl": "/course-decks/food-forest/zu/slide-08.jpg",
    "imageSha256": "ce03c8f5edabfa6e35a687b169d594b7655901c76ffcf0c0a9064030b87acd68",
    "audioUrl": "/course-audio/food-forest/zu/slide-08.mp3",
    "audioSha256": "5775757957421c0e572d1dbc74d0ff79045248fc58d12fe419802d62bdc90cd5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 9,
    "source": [
      "Check local rainfall, frost, heat, soil and water availability before choosing plants.",
      "Mango can suffer frost damage. Quince needs suitable winter chilling for reliable cropping.",
      "A regional label or a sheltered corner is not enough. Confirm each plant and variety with reliable local guidance."
    ],
    "recordedTarget": [
      "Ngaphambi kokukhetha izitshalo, hlola imvula yasendaweni, isithwathwa, ukushisa, umhlabathi namanzi atholakalayo. Umango ungonakaliswa yisithwathwa. I-quince idinga amakhaza asebusika afanele ukuze ithele ngokuthembekile. Igama lesifunda noma indawo evikelekile yodwa akwanele; qinisekisa isitshalo ngasinye nohlobo lwaso ngokweseluleko esithembekile sendawo."
    ],
    "sourceHeading": "Choose for Your Site",
    "registeredEnglishTitle": "Choose for Your Site",
    "registeredZuluTitle": "Khetha Ngokwendawo Yakho",
    "sourceHash": "51debc88c7d415632a09419577b7051ab44cc003b5b1ab498399e1572716e6f5",
    "targetHash": "217a79f0ae2fae08843acbdeac2107c6fe2811555963caf1e3c28a01fc273b7f",
    "imageUrl": "/course-decks/food-forest/zu/slide-09.jpg",
    "imageSha256": "43c2c077dfccc2539a93ffd4ae754f26abceb7fbde48e13d31c688f79d0b90c9",
    "audioUrl": "/course-audio/food-forest/zu/slide-09.mp3",
    "audioSha256": "821b28e69074cdc4496b8028a4170db32c0a6ae433e83e6dc80f053b93f3a2a4",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 10,
    "source": [
      "Climate decides which species belong.",
      "On the Highveld, choose cold-tolerant trees and shrubs; on the KZN coast and Lowveld, choose warm-climate species.",
      "Match every plant to your site."
    ],
    "recordedTarget": [
      "Isimo sezulu siyasiza ekunqumeni ukuthi yiziphi izitshalo ezingase ziyifanele indawo. E-Highveld, khetha izihlahla nezihlahlana ezimelana namakhaza; ogwini lwase-KZN nase-Lowveld khetha izitshalo ezithanda izindawo ezifudumele. Qondanisa isitshalo ngasinye nendawo yakho."
    ],
    "sourceHeading": "Watch: Match the Species to the Climate",
    "registeredEnglishTitle": "Watch: Match the Species to the Climate",
    "registeredZuluTitle": "Buka: Qondanisa Izinhlobo Nesimo Sezulu",
    "sourceHash": "10b3996f51ecfb661737d1b5a794fafdba41668bae0f945b3fd8742f49bfaa84",
    "targetHash": "fc6a66c60036d855f8ce4f255b95d2f9a3db9e321a83082fa3095b754fd54505",
    "imageUrl": "/course-decks/food-forest/zu/slide-10.jpg",
    "imageSha256": "225c6c645ea9131669cda440608b8e2514bfb66b4870700ce55f1d3e1ccbc02f",
    "audioUrl": "/course-audio/food-forest/zu/slide-10.mp3",
    "audioSha256": "45c347e97cc0fd287a73acacd80ba03726a4e9eb1a33830ebf9f1120f9840158",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 11,
    "source": [
      "The original list includes pecan, walnut and indigenous fig; apple, pear, plum, black mulberry and loquat; rosemary, Wild Medlar, Cape gooseberry and Barbados cherry.",
      "This list is not a blanket recommendation. Check each plant against frost, soil, mature size and the approved local species list.",
      "Keep existing legal and project restrictions in force. Do not plant from a picture alone."
    ],
    "recordedTarget": [
      "Izibonelo zokuqala zifaka i-pecan, i-walnut ne-indigenous fig; i-apple, i-pear, i-plum, i-black mulberry ne-loquat; i-rosemary, i-Wild Medlar, i-Cape gooseberry ne-Barbados cherry. Lezi akuzona izincomo ezisebenza kuzo zonke izindawo. Hlola isitshalo ngasinye ngokuphathelene nesithwathwa, umhlabathi, ubukhulu esizofinyelela kubo nohlu lwendawo olugunyaziwe. Qhubeka ulandela imingcele ekhona yezomthetho neyephrojekthi; ungatshali isitshalo ngokubuka isithombe kuphela."
    ],
    "sourceHeading": "Check the Highveld Examples",
    "registeredEnglishTitle": "Check the Highveld Examples",
    "registeredZuluTitle": "Hlola Izibonelo Zase-Highveld",
    "sourceHash": "5ba4359839d3beac6e20a9c32f3a23b9b14ee0b669de9d81426984580b51f5a2",
    "targetHash": "67ec87f3973fa6ebb91e23934bf669c55b30231fc8106d3c4683722a422be9c2",
    "imageUrl": "/course-decks/food-forest/zu/slide-11.jpg",
    "imageSha256": "173ceba6ac26d8b4fa0cfaff18c07a137ff9bc587949e329d8029d8571af9b91",
    "audioUrl": "/course-audio/food-forest/zu/slide-11.mp3",
    "audioSha256": "fb8c6e7ba3fde974aed83c7750dc3b149e3c73c5c8be7d9019f0dbfb947ab428",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 12,
    "source": [
      "The original warm-region examples include mango, avocado, Natal Mahogany, banana, pawpaw, litchi, Wild Fig, Barbados cherry and Wild Dagga.",
      "Marula, Mopane and baobab also appear in the Limpopo examples. Local suitability still needs checking.",
      "Useful trees are not automatically edible. Confirm identity and safe use; a landscape photograph is not a food-identification guide."
    ],
    "recordedTarget": [
      "Izibonelo zokuqala zezindawo ezifudumele zihlanganisa i-mango, i-avocado, i-Natal Mahogany, i-banana, i-pawpaw, i-litchi, i-Wild Fig, i-Barbados cherry ne-Wild Dagga. I-Marula, i-Mopane ne-baobab nazo zikhona ezibonelweni zase-Limpopo. Hlola ukufaneleka kwendawo yangakini. Ukuba wusizo kwesihlahla akusho ukuthi singadliwa; qinisekisa ukuthi isitshalo siyini nokuthi siphephile yini ukusetshenziswa, ngoba isithombe sendawo asiwona umhlahlandlela wokuhlonza ukudla."
    ],
    "sourceHeading": "Check the Warm-Region Examples",
    "registeredEnglishTitle": "Check the Warm-Region Examples",
    "registeredZuluTitle": "Hlola Izibonelo Zezifunda Ezifudumele",
    "sourceHash": "59865300ad3c32e009ea04e0b90a1733de80d306ffcd9ce4c35b609d8cb0dfe7",
    "targetHash": "712317a8d5974ffc18a133ed292935eb04fa5ea023a279238023302c4af6280a",
    "imageUrl": "/course-decks/food-forest/zu/slide-12.jpg",
    "imageSha256": "e43f774a80c2d4534599619c1533355221a5db286dd3a2d029d45c1938ca06d8",
    "audioUrl": "/course-audio/food-forest/zu/slide-12.mp3",
    "audioSha256": "a00b3b61fe878e035af8a862b9f016f3229b805f968d258eaaf158d49419f572",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 13,
    "source": [
      "Locally appropriate indigenous plants can support habitat as part of the design.",
      "Choose for your ecosystem and the useful role of each plant. There is no sourced percentage target in this lesson.",
      "Protect existing natural vegetation. Do not turn healthy grassland into a food forest simply because trees are useful elsewhere."
    ],
    "recordedTarget": [
      "Izitshalo zomdabu eziyifanele indawo zingasiza indawo yokuhlala yezilwane nezinye izinto eziphilayo. Khetha izitshalo ngokwemvelo yakini nangomsebenzi wesitshalo ngasinye; lesi sifundo asibeki iphesenti elithile elisekelwe emthonjeni. Vikela izitshalo zemvelo esezikhona. Ungaguquli indawo enotshani bemvelo obunempilo ibe yi-food forest ngoba nje izihlahla ziwusizo kwezinye izindawo."
    ],
    "sourceHeading": "Include Locally Appropriate Indigenous Plants",
    "registeredEnglishTitle": "Include Locally Appropriate Indigenous Plants",
    "registeredZuluTitle": "Faka Izitshalo Zomdabu Ezifanele Indawo",
    "sourceHash": "c90268c6f64e23a2a4ebd5476294febc516931da1ee1331a0c30249f25859eda",
    "targetHash": "49d7168f76acd3ac705a4bf164a037bb2d82c0ffd93175fd0684652a56a6d52f",
    "imageUrl": "/course-decks/food-forest/zu/slide-13.jpg",
    "imageSha256": "4cfd2a66676c1af6a1095b8b0d93251876e8a51782b4aa788ce1a7ac9517511e",
    "audioUrl": "/course-audio/food-forest/zu/slide-13.mp3",
    "audioSha256": "6c42670007909bdea6486e6d9a224d050730b0bed0658fcb27f8b9226dce2d5e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 14,
    "source": [
      "Start by checking the site, water supply and care available. Protect exposed soil early.",
      "Temporary support plants may provide shelter and useful cut material where appropriate.",
      "Main trees and lower layers can be introduced as conditions allow. Ground cover need not wait until the end; avoid plants competing with young trees."
    ],
    "recordedTarget": [
      "Hlola indawo, amanzi nokunakekela okutholakalayo; vikela umhlabathi oveziwe kusenesikhathi. Izitshalo zesikhashana ezisiza ezinye zingase zinikeze indawo yokukhosela nezinto eziwusizo zokuzisika lapho kufanele khona. Tshala izihlahla eziyinhloko nezingqimba ezingezansi njengoba izimo zivuma. Izitshalo ezimboza umhlabathi zingatshalwa ngaphambi kokufika ekugcineni; gwema ukuncintisana nezihlahla ezisencane."
    ],
    "sourceHeading": "Plan the Sequence for the Site",
    "registeredEnglishTitle": "Plan the Sequence for the Site",
    "registeredZuluTitle": "Hlela Ukulandelana Ngokwendawo",
    "sourceHash": "0e83fe5bd05068e9f3f3695c23fe16a44ce2889922859776c5db9ca0a89009b7",
    "targetHash": "a73cffde459e5d977260d4c05d544b8707a3a1b5391167fa9a993b460350199d",
    "imageUrl": "/course-decks/food-forest/zu/slide-14.jpg",
    "imageSha256": "d6a95ccb17faa76798613a89ce6a30f44cbbeb733e36c5d1cf137a0d8ca2ab84",
    "audioUrl": "/course-audio/food-forest/zu/slide-14.mp3",
    "audioSha256": "11bbe937c4f67f2c176bb2a78c7abdd71309d0b5140ec1634fafa10bb98c7385",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 15,
    "source": [
      "This picture shows a young food forest. Start with an area you can care for.",
      "Protect exposed soil early. Here, loose mulch covers the soil.",
      "Keep mulch away from the trunk. Notice the clear space at the tree's base.",
      "Watch for competition. The farmer is removing grass near the young tree.",
      "Before adding more plants, check moisture, shelter and the care you can provide. Let what you observe guide your next step."
    ],
    "recordedTarget": [
      "Isithombe sibonisa i-food forest esencane. Qala ngendawo okwazi ukuyinakekela. Vikela umhlabathi oveziwe nge-mulch exegayo. Shiya indawo engenalutho ezungeze isiqu sesihlahla. Bheka ukuncintisana; kulesi sithombe umlimi ususa utshani eduze kwesihlahla esincane. Ngaphambi kokufaka ezinye izitshalo, hlola umswakama, indawo yokukhosela nokunakekela okutholakalayo. Vumela okubukayo kuqondise isinyathelo esilandelayo."
    ],
    "sourceHeading": "Watch: Care for a Young Food Forest",
    "registeredEnglishTitle": "Watch: Care for a Young Food Forest",
    "registeredZuluTitle": "Buka: Nakekela I-Food Forest Encane",
    "sourceHash": "e62e401a052daa71f300c1115b485874bee8c699c611f56d18a02563e650945b",
    "targetHash": "13f7ac42cb4d60d21169366b9c59f344d9b8934e263ce6a7a940d6efc607c098",
    "imageUrl": "/course-decks/food-forest/zu/slide-15.jpg",
    "imageSha256": "4f0afe8c8ca6338145c1cfa398bd497ab5049b48493180965dade7a618af0f3b",
    "audioUrl": "/course-audio/food-forest/zu/slide-15.mp3",
    "audioSha256": "e7f73437414e8dd8ea40534d263240ff01a420e784a9c2e61323f3bbdf31241d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 16,
    "source": [
      "Begin with an area you can water and maintain. Check existing vegetation before clearing.",
      "Where appropriate, plain cardboard under suitable mulch can suppress unwanted growth. Keep water able to enter the soil and leave trunks clear.",
      "Plan spacing from mature plant size. Prepare nursery plants for the next suitable planting opportunity."
    ],
    "recordedTarget": [
      "Qala ngendawo ongakwazi ukuyinisela nokuyinakekela; hlola izitshalo ezikhona ngaphambi kokususa noma yini. Lapho kufanele khona, amakhadibhodi angenalutho ngaphansi kwe-mulch efanele angasiza ukunciphisa ukukhula kwezinto ongazifuni. Vumela amanzi angene emhlabathini futhi ushiye indawo engenalutho ezungeze iziqu. Hlela izikhala ngokobukhulu izitshalo ezizofinyelela kubo sezikhulile; lungiselela izitshalo zasenkulisa ithuba elilandelayo elifanele."
    ],
    "sourceHeading": "Prepare a Manageable First Area",
    "registeredEnglishTitle": "Prepare a Manageable First Area",
    "registeredZuluTitle": "Lungisa Indawo Yokuqala Elawulekayo",
    "sourceHash": "624d3cafaf1390fc636930cf051e47cb92cf5019f4f4bdda2867256aa01e8854",
    "targetHash": "dc21672f16d07386a747949142ce4905c3c14f60b6b6c0e424f620175d2dacf1",
    "imageUrl": "/course-decks/food-forest/zu/slide-16.jpg",
    "imageSha256": "f667204f6273b23541f99077b9a941efadcb11488fdebc52741c8522e40f27e0",
    "audioUrl": "/course-audio/food-forest/zu/slide-16.mp3",
    "audioSha256": "76f0acce81fdc9e5e6cbb7b88285261ac0bbd5f94a0b96254c76d06cbe8ad9d5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 17,
    "source": [
      "Watch how shade, roots and available water affect neighbouring plants.",
      "Comfrey and wild garlic appear in the original underplanting example; check their local suitability before use.",
      "Prune or thin support plants when needed, using methods suited to each species. Suitable clean cuttings can return as mulch. Do not wait for a fixed year if competition is already harming plants."
    ],
    "recordedTarget": [
      "Bheka ukuthi umthunzi, izimpande namanzi kuthinta kanjani izitshalo ezingomakhelwane. I-Comfrey ne-wild garlic kuvela esibonelweni sokuqala; hlola ukuthi kuyifanele yini indawo yakho. Thena noma unciphise izitshalo ezisiza ezinye uma kudingeka, usebenzise izindlela ezifanele uhlobo lwesitshalo. Izingcezu ezihlanzekile ezifanele zingasetshenziswa njenge-mulch. Ungalindi unyaka omisiwe uma ukuncintisana sekulimaza izitshalo."
    ],
    "sourceHeading": "Adjust as the Trees Grow",
    "registeredEnglishTitle": "Adjust as the Trees Grow",
    "registeredZuluTitle": "Lungisa Ukutshala Njengoba Izihlahla Zikhula",
    "sourceHash": "07f1ac28e25738b091eae8a4bc90fedc5909c336b117d44403c028343f510fb0",
    "targetHash": "9e25255878343f22bb9632a94e9f75dee19cbbafccc612a044b0e507a8464ab7",
    "imageUrl": "/course-decks/food-forest/zu/slide-17.jpg",
    "imageSha256": "ff47cd9d5db47bd57b9bdc8ec0348a51118897d6fe4b111f08b548dec572a1bd",
    "audioUrl": "/course-audio/food-forest/zu/slide-17.mp3",
    "audioSha256": "bde79ef3d78e0277d833ab30b04b8535bb8321f1e38c1412d2e4e09f8cdd0772",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 18,
    "source": [
      "Choose a planting opportunity when soil moisture and expected weather support establishment.",
      "Rain can help, but check the root zone and keep a backup watering plan. Avoid planting into waterlogged ground.",
      "Check young plants after planting. Harvest timing and outside inputs depend on the species, site and care; there is no guaranteed fifth-year result."
    ],
    "recordedTarget": [
      "Khetha isikhathi sokutshala lapho umswakama womhlabathi nesimo sezulu esilindelekile kungasiza izitshalo zimile. Imvula ingasiza, kodwa hlola umswakama endaweni yezimpande futhi ugcine olunye uhlelo lokunisela. Gwema umhlabathi ogcwele amanzi. Hlola izitshalo ezisencane ngemva kokutshala. Isikhathi sokuvuna nezinto zangaphandle ezidingekayo kuncike ohlotsheni lwesitshalo, endaweni nasekunakekelweni; asikho isiqinisekiso somphumela ngonyaka wesihlanu."
    ],
    "sourceHeading": "Plant with Reliable Moisture",
    "registeredEnglishTitle": "Plant with Reliable Moisture",
    "registeredZuluTitle": "Tshala Uma Kukhona Umswakama Othembekile",
    "sourceHash": "ce7d6a0e939503246a6ca00391273efa30bd25f06c59384cc49d0c79aa81e027",
    "targetHash": "a16715857269b5809c75e4c8346441c7449d33d0c25ed4858b64cb525601466c",
    "imageUrl": "/course-decks/food-forest/zu/slide-18.jpg",
    "imageSha256": "ddc4ad09934c0c478d877dd5fe4b1c09153d479c13512f3f4f04856286c9cb20",
    "audioUrl": "/course-audio/food-forest/zu/slide-18.mp3",
    "audioSha256": "069657b23b18f86d02b623702501671abccb28ac2ef625fc8f8f2e8525355b66",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 19,
    "source": [
      "Draw the layers for your own proposed planting. Mark access, water and existing natural vegetation.",
      "Record local frost, rain, soil and available care.",
      "For each plant from the approved list, record its intended role and the local advice still needed before planting."
    ],
    "recordedTarget": [
      "Dweba izendlalelo zokutshala ozihlelile. Maka izindlela zokungena, amanzi nezitshalo zemvelo ezikhona.",
      "Bhala phansi isithwathwa sendawo, imvula, umhlabathi nokunakekela okutholakalayo.",
      "Esitshalweni ngasinye esisohlwini olugunyaziwe, bhala umsebenzi osihlelele wona neseluleko sendawo esisadingeka ngaphambi kokutshala."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wasepulazini",
    "sourceHash": "ffc48b88484a281c4938cb9cd8d115b5be8e96185ae7020924491d1172f3d854",
    "targetHash": "758a7afa8de7bf257391c7acd843613ce4146a58a32700caf12aea3ac712e182",
    "imageUrl": "/course-decks/food-forest/zu/slide-19.jpg",
    "imageSha256": "bcc7b055774aa8a2f4e00e7ac3811fc855d68e230ec306f8761679dab2d67f42",
    "audioUrl": "/course-audio/food-forest/zu/slide-19.mp3",
    "audioSha256": "80255bfdeda60c043a43551954133294428bf8393edf05bea9c1e027eaec015a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "food-forest",
    "slide": 20,
    "source": [
      "Inspect a manageable area and choose one next step.",
      "Protect exposed soil, check plant suitability, or prepare nursery plants.",
      "Plant only when conditions and follow-up care are suitable. Return to the same spot to check survival, soil moisture and competition."
    ],
    "recordedTarget": [
      "Hlola indawo ongakwazi ukuyinakekela, bese ukhetha isinyathelo esisodwa esilandelayo.",
      "Vikela umhlabathi oveziwe, hlola ukufaneleka kwesitshalo, noma lungiselela izithombo zasenkulisa.",
      "Tshala kuphela uma izimo nokunakekela okulandelayo kufanelekile. Buyela endaweni efanayo uhlole ukuthi izitshalo zisaphila yini, umswakama womhlabathi nokuncintisana."
    ],
    "sourceHeading": "Field Action",
    "registeredEnglishTitle": "Field Action",
    "registeredZuluTitle": "Isenzo SasePulazini",
    "sourceHash": "71de9e3055f92d05db984691a7762dd427bd1946ca5eae8396dc071b9d58fe1b",
    "targetHash": "27c99f38053ba80f9ce85334e365605982f529f2ad06e8bdc911f23f01f03838",
    "imageUrl": "/course-decks/food-forest/zu/slide-20.jpg",
    "imageSha256": "d7297a7a885def9d95a5f96b05f87f8266f34309feac9c974e3adac27d536c24",
    "audioUrl": "/course-audio/food-forest/zu/slide-20.mp3",
    "audioSha256": "347254bd37d7f385622a341a6d2644ed9f6e7bc3870147e7f7f2a094ab87d367",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 1,
    "source": [
      "Choose plants that work together—and change the planting as it grows."
    ],
    "recordedTarget": [
      "Khetha izitshalo ezisebenzisana kahle—ulungise ukutshala njengoba zikhula."
    ],
    "sourceHeading": "Plant Selection and Guilds",
    "registeredEnglishTitle": "Plant Selection and Guilds",
    "registeredZuluTitle": "Ukukhetha Izitshalo Nama-Guilds",
    "sourceHash": "bb2159820f30a693d797e0cba9dd60503f374d7209af6f1ee776d5fc89fe3f67",
    "targetHash": "bfaf0465724f51d938a0290da31458b7cbb51bb16ecf1591391cdf1421b99269",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-01.jpg",
    "imageSha256": "6b6a23bbce7d38f2b369ae6b05b089da6857832582be6426200d3441e1c4a095",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-01.mp3",
    "audioSha256": "0b588feff56ba05c58b8295ebd326913f03ea73e382d66bffea9cd720361e3e2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 2,
    "source": [
      "A fruit tree needs light, water, soil nutrients and room. Support plants can supply food, leafy mulch, flowers and living cover.  Give each plant a useful job. Keep observing whether it helps the tree and the household. Which jobs does your planting need?"
    ],
    "recordedTarget": [
      "Umuthi wezithelo udinga ukukhanya, amanzi, izakhamzimba zomhlabathi nendawo. Izitshalo eziwusekelayo zinganika ukudla, amaqabunga okumboza umhlabathi, izimbali nezitshalo ezimboza umhlabathi.  Nikeza isitshalo ngasinye umsebenzi owusizo. Qhubeka ubheka ukuthi sisiza kanjani umuthi nabantu basekhaya. Yimiphi imisebenzi edingwa yile ndawo oyitshalayo?"
    ],
    "sourceHeading": "Plant Selection and Guilds",
    "registeredEnglishTitle": "Plant Selection and Guilds",
    "registeredZuluTitle": "Ukukhetha Izitshalo Nama-Guilds",
    "sourceHash": "cefc1d7fc58a8c59b767d6e3a81d36dca2f5c9d41722d052258c811ffe103cb9",
    "targetHash": "e50db7a0f518d8425e9df5d6c04ae922bc767738ebbb4ffea2e80af07b866de4",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-02.jpg",
    "imageSha256": "e43147966c9530ccf585401f4d8eb0da771d025b5586821c9842a4e5883c646f",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-02.mp3",
    "audioSha256": "abbc57b19800620db1babb70598f89282c2298a453a7d64294cc676f9dd50fe8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 3,
    "source": [
      "Find out what is limiting growth before choosing a plant."
    ],
    "recordedTarget": [
      "Thola ukuthi yini evimbela ukukhula ngaphambi kokukhetha isitshalo."
    ],
    "sourceHeading": "Start With the Site",
    "registeredEnglishTitle": "Start With the Site",
    "registeredZuluTitle": "Qala Ngokubheka Indawo",
    "sourceHash": "f2639b17c0dbc67dbd0db88f160c92cf20b2e295ef91be0659460928e0f25206",
    "targetHash": "cdb07ae098d4d963e8040e243d5e5e5fffe5ac18e2c9a574076f31c7b543a263",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-03.jpg",
    "imageSha256": "4926376d56d8d8e31335d92e04473f4948d8c2283e6cbf8a71233635fcf49ae3",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-03.mp3",
    "audioSha256": "a02d3fa89dfcc322bbc1badf94b8ce185e5cd4df9478ecdb46d368991198b7ed",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 4,
    "source": [
      "Check sunlight, drainage, soil condition and water availability. Nitrogen is only one possible limitation.  Compare the soil beneath mulch with exposed soil. Choose support plants that fit the actual conditions. What does this site need first?"
    ],
    "recordedTarget": [
      "Hlola ukukhanya kwelanga, ukuphuma kwamanzi emhlabathini, isimo somhlabathi nokutholakala kwamanzi. Ukushoda kwe-nitrogen kungenye nje yezinto ezingavimbela ukukhula.  Qhathanisa umhlabathi ongaphansi kwe-mulch nongamboziwe. Khetha izitshalo ezisekelayo ezifanele izimo ezikhona. Yini edingwa yile ndawo kuqala?"
    ],
    "sourceHeading": "Start With the Site",
    "registeredEnglishTitle": "Start With the Site",
    "registeredZuluTitle": "Qala Ngokubheka Indawo",
    "sourceHash": "d60f6a9883768bf4748cd8e6a0aebf0889bcfd834e0027493c870e88dde602f4",
    "targetHash": "a3aa4c99d4c5dca6a4539954a6d1d4e63e41b85f05e6862fec12944b16f92e20",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-04.jpg",
    "imageSha256": "17231108242a935234e89419a0ecd6a818652d100777ece142597c4509b95705",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-04.mp3",
    "audioSha256": "8f6a519f5aea2a7840d63b34f31342201fe6bb5eb9d9320c22abfc8c2b6c296b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 5,
    "source": [
      "A useful guild produces benefits you can observe."
    ],
    "recordedTarget": [
      "I-guild ewusizo iletha izinzuzo ongazibona."
    ],
    "sourceHeading": "Give Every Plant a Job",
    "registeredEnglishTitle": "Give Every Plant a Job",
    "registeredZuluTitle": "Nikeza Isitshalo Ngasinye Umsebenzi",
    "sourceHash": "1b601b998000ec72c3d7742d6240cb9887eb718f98940c0ff16053447e7a1a51",
    "targetHash": "1c05a406883b83cdc99881f0f1103a8627a18467f81a483e6c1845d4c7fcd202",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-05.jpg",
    "imageSha256": "c247045c55e5bc5a84bbc670a6a2b1f7ff56cf4965c5f008a4e3de9367459a09",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-05.mp3",
    "audioSha256": "d0fc8ad440122c558a48b0bff7a4646781be941c8362ec54e0f50d981f35d9bd",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 6,
    "source": [
      "Choose members for food, nitrogen fixation, mulch, flowers or ground cover. One plant may do several jobs.  By the end, plan a guild, explain how residues feed soil, and decide which support plants to keep, cut or remove. Which job is still missing?"
    ],
    "recordedTarget": [
      "Khetha izitshalo zokudla, zokubopha i-nitrogen, ze-mulch, zezimbali noma zokumboza umhlabathi. Isitshalo esisodwa singenza imisebenzi eminingana.  Ekupheleni kwesifundo, hlela i-guild, uchaze ukuthi izinsalela zondla kanjani umhlabathi, unqume nokuthi yiziphi izitshalo ezisekelayo ozozigcina, ozozisika noma ozozisusa. Yimuphi umsebenzi osashodayo?"
    ],
    "sourceHeading": "Give Every Plant a Job",
    "registeredEnglishTitle": "Give Every Plant a Job",
    "registeredZuluTitle": "Nikeza Isitshalo Ngasinye Umsebenzi",
    "sourceHash": "704af0df5674d7841404b0da94ef66cd20627a2c7ff6515c7f2e7d29118116e0",
    "targetHash": "0db475f4a9171976c57ecf8535451cc93b1139b8f172a54cd4f7f02d3855ace6",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-06.jpg",
    "imageSha256": "71aa24c3cb5b171f09099a7266f537bab5458e0c17851479d41007d6d4c68f15",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-06.mp3",
    "audioSha256": "9652c0cac4e6091a4048efbe69bfc484be3aeabf29e4e32f4d0395c3061235d5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 7,
    "source": [
      "Legumes work with rhizobia in nodules on their roots."
    ],
    "recordedTarget": [
      "Ama-legumes asebenzisana nama-rhizobia kuma-nodule asezimpandeni zawo."
    ],
    "sourceHeading": "Look for Root Nodules",
    "registeredEnglishTitle": "Look for Root Nodules",
    "registeredZuluTitle": "Bheka Ama-Nodule Ezimpandeni",
    "sourceHash": "3425c53ac627f90b44a80aea23a031442135f5922aa2b5f6630c70acfab863d3",
    "targetHash": "87dc9f26ebae468704f333f2aeb9f08b21ea431a7365c71e78b71d400efd7326",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-07.jpg",
    "imageSha256": "a66e64a42ae97160f23d4b7a38475ed8c60b811f9e6e2647b086ae492d8d101b",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-07.mp3",
    "audioSha256": "d6d66ca009b65840d8e8bdb1bdebaa90497b359c67fa290a669faea277945f1e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 8,
    "source": [
      "These bacteria convert nitrogen from the air into forms the legume can use.  Find nodules on a spare legume plant. Nodulation and growth depend on the plant, suitable bacteria and growing conditions. Can you find the nodules?"
    ],
    "recordedTarget": [
      "La mabhaktheriya aguqula i-nitrogen esemoyeni ibe yizinhlobo i-legume engazisebenzisa.  Bheka ama-nodule esitshalweni se-legume esingasetshenziswa ukuhlola. Ukwakheka kwama-nodule nokukhula kuncike esitshalweni, emabhaktheriyeni afanele nasezimweni zokukhula. Uyawabona ama-nodule?"
    ],
    "sourceHeading": "Look for Root Nodules",
    "registeredEnglishTitle": "Look for Root Nodules",
    "registeredZuluTitle": "Bheka Ama-Nodule Ezimpandeni",
    "sourceHash": "e8fdf97fe8c6cc864b40bd0e2235505c93abc8c48d64204a6bad1f9d87c12553",
    "targetHash": "eb8a8c4ebdd283e0113e8a2eabef33d19d9badece9a0d40fd783d1ddc69a22b5",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-08.jpg",
    "imageSha256": "045f1bcb604dc766c627054719688ef2ee242935df0fc7afed864838a46e0058",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-08.mp3",
    "audioSha256": "65b6b1e718c0923c656a12504c10f26f86aa6bb8c190eccf96d05cf4e0cb37fa",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 9,
    "source": [
      "Nitrogen in plant material becomes useful as that material breaks down."
    ],
    "recordedTarget": [
      "I-nitrogen esezingxenyeni zezitshalo iyatholakala njengoba lezo zingxenye zibola."
    ],
    "sourceHeading": "Return Leaves to the Soil",
    "registeredEnglishTitle": "Return Leaves to the Soil",
    "registeredZuluTitle": "Buyisela Amaqabunga Emhlabathini",
    "sourceHash": "023d3376baf06a99a29ae41d10c5c4bf7563e4fa09e14ffa14c99b3ab94a1170",
    "targetHash": "d95def7e3713a31fc0678f2668479628fe8b46abc0b93fa0418859e61b05b1d6",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-09.jpg",
    "imageSha256": "0b6d669a990661784d11ecc925489e6d2dda24f926730ed1e0a96df383c44538",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-09.mp3",
    "audioSha256": "7ca149279f9cc9f6f5a54538dea3d39a60732ec9fce0b0c98daef5b27b95062f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 10,
    "source": [
      "Return suitable leafy prunings, fallen leaves and crop residues as mulch. Soil organisms release nutrients during decomposition.  This takes time. A living legume is not an instant fertiliser pipe into the fruit tree. Which residues can you return?"
    ],
    "recordedTarget": [
      "Buyisela amagatsha athenwe anamaqabunga, amaqabunga awile nezinsalela zezitshalo ezifanele emhlabathini njenge-mulch. Izidalwa zomhlabathi zikhulula izakhamzimba ngesikhathi sokubola.  Lokhu kuthatha isikhathi. I-legume ephilayo ayilona ipayipi eliyisa umanyolo ngokushesha emuthini wezithelo. Yiziphi izinsalela ongazibuyisela emhlabathini?"
    ],
    "sourceHeading": "Return Leaves to the Soil",
    "registeredEnglishTitle": "Return Leaves to the Soil",
    "registeredZuluTitle": "Buyisela Amaqabunga Emhlabathini",
    "sourceHash": "ac7c6733addc040f355749004227d1c2ab745215bc115ab164be1ec33cb9f2f7",
    "targetHash": "78961dc80d3c560b0f2124acf1dd5a00c5a4847847c4e30f9ac82d7b889d1828",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-10.jpg",
    "imageSha256": "0a458829f26e2819bc1b92e1d67213751156de03e2eb31db638ed75674bea3ea",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-10.mp3",
    "audioSha256": "c899ef6cb7e3f716cc30bd79a721097f3ea7810e90d30531a31a918c159860b0",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 11,
    "source": [
      "Sesbania sesban can supply fast growth and leafy mulch."
    ],
    "recordedTarget": [
      "I-Sesbania sesban ingakhula ngokushesha inike namaqabunga e-mulch."
    ],
    "sourceHeading": "Sesbania Has a Useful Role",
    "registeredEnglishTitle": "Sesbania Has a Useful Role",
    "registeredZuluTitle": "I-Sesbania Inomsebenzi Owusizo",
    "sourceHash": "58bccdddc00feee69ca89082283cce167daff04927f410283d6b593d8e89c397",
    "targetHash": "8f29c7ab4e8efe8f467e47cfaa52d0430e3c8222c29384be4ac866dedf6afe78",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-11.jpg",
    "imageSha256": "bad82cd0482ecb362c948b6bd4f0ffa86112be8f0cd79a2c09dca827cbacf0eb",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-11.mp3",
    "audioSha256": "c3951acfc9885caac3320afb64aca6a5b8555663a07f1e82ce4b7553c536036f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 12,
    "source": [
      "It is indigenous to KwaZulu-Natal. In suitable warm conditions, manage this short-lived shrub or small tree as a support plant.  Allow room for its growth. Prune for mulch and reassess it when shade or water competition increases. Where could you manage its growth?"
    ],
    "recordedTarget": [
      "Idabuka kwaZulu-Natali. Ezimweni ezifudumele ezifanele, phatha lesi sihlahlana noma umuthi omncane ophila isikhathi esifushane njengesitshalo esisekelayo.  Shiya indawo yokukhula kwayo. Yithene ukuze uthole i-mulch, uphinde uyihlole uma umthunzi noma ukuncintisana ngamanzi kukhula. Ungakwazi ukuphatha ukukhula kwayo kuphi?"
    ],
    "sourceHeading": "Sesbania Has a Useful Role",
    "registeredEnglishTitle": "Sesbania Has a Useful Role",
    "registeredZuluTitle": "I-Sesbania Inomsebenzi Owusizo",
    "sourceHash": "007bddcbd40beda4d7dd69d519a80b4f3c5b8ddd7884d38712e45ca1e3cd73fe",
    "targetHash": "7b13bc80c204197f9676fbfada1d61399f6e0113be48d8225d8ff3fb256f99f1",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-12.jpg",
    "imageSha256": "811e7d30e495aba5722ceca88068fb81436865d64681621e8a90c9e552684e4f",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-12.mp3",
    "audioSha256": "8f92f1423d505da75ed2ec673153088549f043309a90a3ed47f6ba26e7a5279c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 13,
    "source": [
      "Sesbania sesban and Sesbania punicea are different species."
    ],
    "recordedTarget": [
      "I-Sesbania sesban ne-Sesbania punicea yizinhlobo ezahlukene."
    ],
    "sourceHeading": "Check the Full Plant Name",
    "registeredEnglishTitle": "Check the Full Plant Name",
    "registeredZuluTitle": "Hlola Igama Eligcwele Lesitshalo",
    "sourceHash": "f17bcb3403f6345f0c0985149e0111a1cec1e55d1edb9d651b0432b31acfca92",
    "targetHash": "e7757ac191b49ba5ae71cad2551c4251bffce9d4f8919d7bd3ade757d4c3152a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-13.jpg",
    "imageSha256": "e50c0bec1ee490d3ddeebdecdd9c744dc7300ac7cd2921837bd3f1c822015d07",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-13.mp3",
    "audioSha256": "de1fa84cc803792a8dc52eaa4f152366ee11b036c0faf7bd0be77b91a8f8556d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 14,
    "source": [
      "Sesbania punicea is the invasive red sesbania. Its pods have four lengthwise wings. Confirm identity using reliable botanical guidance.  Check the full name before planting. Respect the agreed project species list, including any restriction on Sesbania sesban. Can the supplier verify the species?"
    ],
    "recordedTarget": [
      "I-Sesbania punicea yisitshalo esihlaselayo esibizwa nge-red sesbania. Izithelo zayo ezomile zinamaphiko amane ahamba ngobude. Qinisekisa uhlobo ngomhlahlandlela othembekile.  Hlola igama eligcwele. Landela uhlu lwezitshalo oluvunyelwe yiphrojekthi, kuhlanganise nemikhawulo ye-Sesbania sesban. Umthengisi angaluqinisekisa yini uhlobo lwesitshalo?"
    ],
    "sourceHeading": "Check the Full Plant Name",
    "registeredEnglishTitle": "Check the Full Plant Name",
    "registeredZuluTitle": "Hlola Igama Eligcwele Lesitshalo",
    "sourceHash": "26f5a300a44b0eb23c5f3ca1e59f96c12fb1b2f62d8c2d8b022cc839dad2751c",
    "targetHash": "2e96024365316ad6729c52a2645e969805de51b0ca08a4aa7a9ae218d7eaeb64",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-14.jpg",
    "imageSha256": "746b611a3727911d0b578f8c0f49c76ed936035d3d83d380b0e7533cc43c204e",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-14.mp3",
    "audioSha256": "835eb07b7a45af4a92b595f39d28f6fdaacd59fdab2b9addc72d8b38703bb095",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 15,
    "source": [
      "Pigeon pea—Cajanus cajan—can provide peas, leafy material and nitrogen fixation."
    ],
    "recordedTarget": [
      "I-pigeon pea (Cajanus cajan) inganika uphizi, amaqabunga futhi ibophe i-nitrogen."
    ],
    "sourceHeading": "Pigeon Pea Gives Food Too",
    "registeredEnglishTitle": "Pigeon Pea Gives Food Too",
    "registeredZuluTitle": "I-Pigeon Pea Inika Nokudla",
    "sourceHash": "a95fbdee4852963ba67fd0d2d44b534f4bd097afe6449680c8982fbca30d883f",
    "targetHash": "b6ac99b13155bcf1225d81eed85ef5e44592a04299b1d8d103b89998543fd22c",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-15.jpg",
    "imageSha256": "f83121c89d1fa28075f04b3e1fcd62880028502a1d64c2fb452a8a1249d0b2bb",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-15.mp3",
    "audioSha256": "0ffdb974965bd97473e2af729975526e71ac4d0da35825fb94197dcdccc8912b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 16,
    "source": [
      "Use a sunny, freely draining position. It is a short-lived support shrub; frost and waterlogging can limit it.  Decide whether each plant mainly supplies peas or leafy material. Frequent severe cutting can damage it and reduce the food harvest. Are you growing this plant for peas or mulch?"
    ],
    "recordedTarget": [
      "Yitshale endaweni enelanga nalapho amanzi ephuma kahle emhlabathini. Iyisihlahlana esisekelayo esiphila isikhathi esifushane; isithwathwa namanzi ame emhlabathini kungayiphazamisa.  Nquma ukuthi isitshalo ngasinye sisetshenziselwa kakhulu uphizi noma amaqabunga. Ukusika kakhulu nangokuvamile kungasilimaza kunciphise nesivuno sokudla. Lesi sitshalo usitshalele uphizi noma i-mulch?"
    ],
    "sourceHeading": "Pigeon Pea Gives Food Too",
    "registeredEnglishTitle": "Pigeon Pea Gives Food Too",
    "registeredZuluTitle": "I-Pigeon Pea Inika Nokudla",
    "sourceHash": "389e6eccac3ee93b7dae7081dd50dbbe84ec3929dc2602be32e3116384c8c071",
    "targetHash": "5963c99ce407f74e4a76de1cc7a52363463d0dc4768da929b474ed911768aebf",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-16.jpg",
    "imageSha256": "7a6921fb22c4934349d043d5ab3979635813aa021bf77dcbdcf1d764e590d4fa",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-16.mp3",
    "audioSha256": "6c285eed7e903a31f13aa744b0aa0485fd5103b3fc3369435b8b4d730a594327",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 17,
    "source": [
      "A useful support tree in one place may be too large or unsuitable in another."
    ],
    "recordedTarget": [
      "Umuthi osekela kahle endaweni ethile ungaba mkhulu kakhulu noma ungafaneleki kwenye."
    ],
    "sourceHeading": "Choose for Place and Size",
    "registeredEnglishTitle": "Choose for Place and Size",
    "registeredZuluTitle": "Khetha Ngokwendawo Nobukhulu",
    "sourceHash": "3a8b9e0159488778e090945286ae6543c77bba683ceabf7d9c7806a76992407b",
    "targetHash": "0e8aa29d7ae876f0d9df6f0ac16ec9eff0d1881ae8a2d4a0792119beabcf333e",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-17.jpg",
    "imageSha256": "c14d1d3c2193bdbba1be910f842c0b961a46ff3dd8e359cce71ad8bed3bd511c",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-17.mp3",
    "audioSha256": "a1f92e12f2ef3246c6e859c374130814b45cae16c83715bc61bb8bb131eee18b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 18,
    "source": [
      "Compare mature crown, roots, shade, rainfall and temperature. Check locally appropriate species and planting rules.  Put large support trees where they have space. For a small young guild, a manageable shrub may be easier to maintain. How large will this plant become?"
    ],
    "recordedTarget": [
      "Qhathanisa ukusabalala kwamagatsha uma umuthi usukhulile, izimpande, umthunzi, imvula nezinga lokushisa. Hlola izinhlobo ezifanele indawo nemithetho yokutshala.  Beka imithi emikhulu esekelayo lapho inendawo eyanele khona. Ku-guild encane esaqala, isihlahlana esilawulekayo singaba lula ukusinakekela. Lesi sitshalo sizoba sikhulu kangakanani?"
    ],
    "sourceHeading": "Choose for Place and Size",
    "registeredEnglishTitle": "Choose for Place and Size",
    "registeredZuluTitle": "Khetha Ngokwendawo Nobukhulu",
    "sourceHash": "d7d4b1ef55f3dfaaf19991289ec32438e4ab8b02530e4cd6f5828f19e09ee480",
    "targetHash": "38e581abf7edcf92f1b3c95bedda0eac2b263bdbe6bdc698c41f69897a38e4b0",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-18.jpg",
    "imageSha256": "c19c519dc4788ac83dbd841fce593fb47980e0b54637964624de6350cc7df4c1",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-18.mp3",
    "audioSha256": "16862c83249f142629918bcf7e4e76b8448d2eb1e3923749787548f8e4bdc9a2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 19,
    "source": [
      "Sunn hemp can cover a suitable warm-season gap before the next crop."
    ],
    "recordedTarget": [
      "I-sunn hemp ingamboza indawo engenazitshalo ngesikhathi esifudumele, ngaphambi kwesitshalo esilandelayo."
    ],
    "sourceHeading": "Annual Cover Has a Place",
    "registeredEnglishTitle": "Annual Cover Has a Place",
    "registeredZuluTitle": "Ukumboza Ngezitshalo Zonyaka",
    "sourceHash": "b561e8dc6432b4cbed0481fb97a7d8b19923f94d1a48afb8ea7ddb1921ae0260",
    "targetHash": "75d69f2bbd82f9b8e11e9d19f685e2f9b11a5ed6f38d4662602655ea5eac6ff5",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-19.jpg",
    "imageSha256": "fc18c80bd03f8271fb934e9bc830e9f37a98ce36d88870dc3cc6c86648b8e468",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-19.mp3",
    "audioSha256": "75bd132acbc9d90cbc4acf5f3236413b763524cd8dc9d18f3eb1170fc97fa5c5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 20,
    "source": [
      "Grow it where its season and space fit the plan. Its contribution depends on growth, nodulation and the material returned.  After cutting, allow for decomposition. An annual cover crop plays a different role from a longer-lived support shrub. When will this space be needed again?"
    ],
    "recordedTarget": [
      "Yitshale lapho isizini yayo nendawo ekuyo kuhambisana nohlelo. Usizo lwayo luncike ekukhuleni, ekwakhekeni kwama-nodule nasezinsaleleni ezibuyiselwa emhlabathini.  Ngemva kokusika, nikeza izinsalela isikhathi sokubola. Isitshalo sonyaka esimboza umhlabathi senza umsebenzi ohlukile kowesihlahlana esisekelayo esiphila isikhathi eside. Le ndawo izodingeka nini futhi?"
    ],
    "sourceHeading": "Annual Cover Has a Place",
    "registeredEnglishTitle": "Annual Cover Has a Place",
    "registeredZuluTitle": "Ukumboza Ngezitshalo Zonyaka",
    "sourceHash": "b331fe7a1bd821ef2c4f0175fc013e5479c0b8a1ff791f2ba0c854ee42c1c37a",
    "targetHash": "8df1ff0d3967df4516b5d307714cbf7f21c00ae70d0068ed4cb63d2aaa970336",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-20.jpg",
    "imageSha256": "3d1c465fcdd84c44bee34ec02c171f06203b60ed096e0fe56c7ca9e86a21cc3c",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-20.mp3",
    "audioSha256": "86def2e0213f807d68d2e8e9bf28f32e189f7a895cfeb6b0131a2d8fc94d51b2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 21,
    "source": [
      "Keep the young fruit tree in light and retain access for care."
    ],
    "recordedTarget": [
      "Gcina umuthi omncane wezithelo uthola ukukhanya, ushiye nendlela yokuwunakekela."
    ],
    "sourceHeading": "Leave Room Around the Tree",
    "registeredEnglishTitle": "Leave Room Around the Tree",
    "registeredZuluTitle": "Shiya Indawo Ezungeze Umuthi",
    "sourceHash": "75a73750c2debd14a6bfbdd4da98b89ecbcb9097b231460818d0287e59264777",
    "targetHash": "b6d700ad8f36150e9fad8ff85708673238d0550971d31230c6b4df32302d792f",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-21.jpg",
    "imageSha256": "37b5bd9e60970a2f66bc101ded4f02448f4670debd9a2fbb1a919ec8472a8cfb",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-21.mp3",
    "audioSha256": "072f8d16dba74c97c28793db9773619432c55fe4bdad76ca41edf3bc759842a7",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 22,
    "source": [
      "Keep an open establishment basin and access to the fruit tree. Place temporary support plants where their size and water use can be managed.  Put leafy cuttings where mulch is needed. Neighbouring fruit trees can share support strips between them. Can you reach both plants as they grow?"
    ],
    "recordedTarget": [
      "Shiya indawo ezungeze isiqu ingenazitshalo, kanye nendlela yokunakekela umuthi. Beka izitshalo ezisekelayo lapho ukukhula nokusebenzisa kwazo amanzi kungalawuleka khona.  Beka amaqabunga asikiwe lapho kudingeka khona i-mulch. Izihlahla zezithelo zingasebenzisa izitshalo ezisekelayo eziphakathi kwazo. Uzokwazi ukufinyelela kuzo zombili izitshalo njengoba zikhula?"
    ],
    "sourceHeading": "Leave Room Around the Tree",
    "registeredEnglishTitle": "Leave Room Around the Tree",
    "registeredZuluTitle": "Shiya Indawo Ezungeze Umuthi",
    "sourceHash": "33d6a7c8fed217d2b0a61b457d7673ae9cb637e8bae9196c4112af7f46e0f179",
    "targetHash": "ff22056fc380ee570c7cc767d9978388d967299513b1e22c1e967efa64f51090",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-22.jpg",
    "imageSha256": "7e6f6969a73e382e5c77c8142e3a18a87012433d37b6617cf1b1402de7fab3fd",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-22.mp3",
    "audioSha256": "4ab2b5c8dbcb3a529cb12868c52c93b4be9b472fe1d0e5b09455a975f4d6dd98",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 23,
    "source": [
      "Combine seasonal cover, support shrubs and temporary small trees."
    ],
    "recordedTarget": [
      "Hlanganisa izitshalo ezimbozayo, izihlahlana nemithi emincane yesikhashana."
    ],
    "sourceHeading": "Build a Layered Support Guild",
    "registeredEnglishTitle": "Build a Layered Support Guild",
    "registeredZuluTitle": "Hlanganisa Izingqimba Ezisekelayo",
    "sourceHash": "7989463e6953eef606a958b6171f6216624cefc3119d010c6c6befac0d6e7be0",
    "targetHash": "f14ddb19a0e6e2e242e9dc2d820cabf37f7aa379421f63a205cea9d4ac100139",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-23.jpg",
    "imageSha256": "04dda4cadaa7f4579c56ad57258edcab15e7089440a098d4bcca478b5ccd9b03",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-23.mp3",
    "audioSha256": "2fa4e03a778628630d5c69ab2b3bd1131b7409dd1993da40f5343052bd73dccc",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 24,
    "source": [
      "Cowpea covers sunny gaps. Pigeon pea provides food and leafy material. Managed Sesbania sesban can supply taller temporary support.  Add suitable flowering and mulch plants. Keep the mango trunk clear and manage light, water and access. Which layers fit your site?"
    ],
    "recordedTarget": [
      "I-cowpea imboza izikhala ezinelanga. I-pigeon pea inikeza ukudla namaqabunga. I-Sesbania sesban elawulwayo inikeza ukusekela okude kwesikhashana.  Faka izitshalo zezimbali ne-mulch. Gcina isiqu sikamango sivulekile; lawula umthunzi, amanzi nendlela yokungena. Yiziphi izingqimba ezifanele indawo yakho?"
    ],
    "sourceHeading": "Build a Layered Support Guild",
    "registeredEnglishTitle": "Build a Layered Support Guild",
    "registeredZuluTitle": "Hlanganisa Izingqimba Ezisekelayo",
    "sourceHash": "d85a876af05e4d121ce8054197b0c14b5f62ff3f541d77ee1d265be7fc2746d3",
    "targetHash": "a0525107c929fc4f542c477f3ee7dd50cf28defa4c38c71fb2406b0af7df5cb3",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-24.jpg",
    "imageSha256": "8403112acf117da6644c83d3b86c567b4e36aa3da0b863e933f5624a214d9fd2",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-24.mp3",
    "audioSha256": "112bc9a8aef89d615bc965c6493c23c925342d32761d8a94c484c0e553d05903",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 25,
    "source": [
      "Plan abundant support where the site and your care can sustain it."
    ],
    "recordedTarget": [
      "Tshala eziningi lapho indawo nokunakekela kwakho kungazisekela khona."
    ],
    "sourceHeading": "How Many Support Plants?",
    "registeredEnglishTitle": "How Many Support Plants?",
    "registeredZuluTitle": "Zingaki Izitshalo Ezisekelayo?",
    "sourceHash": "299955d3bedc00f4f495b2657ea8216cb6b4b2c265f3c99d6fbe7e56d93dec5a",
    "targetHash": "8e6f68ad57bbd25d6393f1127c7b729c88c7fbc1b7d61b5e6e8255dafe195fb6",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-25.jpg",
    "imageSha256": "d5d8e23497a85af5f72b421dfe135258a5b9d03e8788e2822aa3652a4edae8e8",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-25.mp3",
    "audioSha256": "af7aef5dc620f0b6eaf115f31ed3c00cc4801ec1609bf8228e10f29f04a2270f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 26,
    "source": [
      "Count woody supports across the spaces between fruit trees. Sow suitable ground cover by area.  There is no universal number per fruit tree. Adjust density to water, soil, plant size and your ability to prune and thin. How much support can you maintain?"
    ],
    "recordedTarget": [
      "Bala izihlahlana nemithi ezisekelayo phakathi kwezihlahla zezithelo. Hlwayela izitshalo ezimbozayo ngokwendawo.  Alikho inani elilodwa elifanele zonke izihlahla. Bheka amanzi, umhlabathi, ubukhulu bezitshalo namandla akho okuthena nokunciphisa. Zingaki ongakwazi ukuzinakekela?"
    ],
    "sourceHeading": "How Many Support Plants?",
    "registeredEnglishTitle": "How Many Support Plants?",
    "registeredZuluTitle": "Zingaki Izitshalo Ezisekelayo?",
    "sourceHash": "45dab8b62fa5ab39029c06c7e02c09d1b724f9c780d8ae53de5d1c2c0b0c30ba",
    "targetHash": "a901906960975dac3f1683f667714cff2820ea531e17ab0c1b2d0788022cc673",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-26.jpg",
    "imageSha256": "06d54f0712586b2c5ad4507e41e5ba8e23f78e9e0f27711e041995265972bcc3",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-26.mp3",
    "audioSha256": "7d1bc33d2846fee27c08c1d0503c30623409fb01a5be6a38b2f55bf388f413b8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 27,
    "source": [
      "Watch the branch fall onto the cut leaves."
    ],
    "recordedTarget": [
      "Buka igatsha liwela phezu kwamaqabunga asikiwe."
    ],
    "sourceHeading": "Chop-and-Drop for Light and Mulch",
    "registeredEnglishTitle": "Chop-and-Drop for Light and Mulch",
    "registeredZuluTitle": "Thena Ukuze Kukhanye",
    "sourceHash": "aad2ccfb4d28d07d677360f1354f0947f272b7d970cbe7c62bd2e8bc4b88098f",
    "targetHash": "f8f03af7c78d1b20c8d81499aab8e25bf51e58e614586aa5a33ff87abeb9edc8",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-27.jpg",
    "imageSha256": "0f0188e6b206b8bec42c2f802b98ff9af5f059771e06451be841e369a103dc2c",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-27.mp3",
    "audioSha256": "5cb4e603c1dfb4e936f7d7475ffaaab05e47bce499e8664594b8dfdf1254045c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 28,
    "source": [
      "Prune a support tree and return suitable leafy cuttings to the soil. The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.  Match cutting to the species. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas. Which plant needs a cut—and how much?"
    ],
    "recordedTarget": [
      "Buyisela amagatsha anamaqabunga afanele emhlabathini njenge-mulch. Kule vidiyo kusikwa igatsha; umuthi osekelayo uyasala umile. Shiya amaqabunga anempilo anele ukuze ululame.  Thena ngokohlobo lwesitshalo. Gwema ukuthena kakhulu i-pigeon pea njalo, ikakhulukazi uma ufuna ukuvuna izinhlamvu. Yisiphi isitshalo esidinga ukuthenwa?"
    ],
    "sourceHeading": "Chop-and-Drop for Light and Mulch",
    "registeredEnglishTitle": "Chop-and-Drop for Light and Mulch",
    "registeredZuluTitle": "Thena Ukuze Kukhanye",
    "sourceHash": "9b2f9313aaabb9a862b479efa0bef30af91f8b47487519a66a9aefd21ada6925",
    "targetHash": "6dea76a96732732a8ae74c78cadbfee5badc1ed07f42a7f5b36059edfbbeff8d",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-28.jpg",
    "imageSha256": "4bb33eaeeaad4af438d805c3824018ab2188dca41fe7a6a007ce77a34369a364",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-28.mp3",
    "audioSha256": "48a6d067d0f6cd14cb222c9edd56d2f410b04f66aa17d4e058c30dea6cdb388a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 29,
    "source": [
      "Spread suitable cut material over the soil, with the trunk and root collar clear."
    ],
    "recordedTarget": [
      "Sabalalisa izinsalela ezifanele ezisikiwe phezu komhlabathi, ushiye isiqu nendawo lapho sihlangana khona nezimpande kungamboziwe."
    ],
    "sourceHeading": "Keep Mulch Off the Trunk",
    "registeredEnglishTitle": "Keep Mulch Off the Trunk",
    "registeredZuluTitle": "I-Mulch Mayingathinti Isiqu",
    "sourceHash": "c88f13734d3e2baa1fc978661af475d614b45389c87b66ced9d452776f907b7f",
    "targetHash": "e411366ca8348b765e8477f4a1e769ac87cb5410e80597d94ba456f07dc10a3a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-29.jpg",
    "imageSha256": "e67a561f4a389c40aaf31d9c62327f56d542206a184cbf4844906b9b413c705d",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-29.mp3",
    "audioSha256": "57d49b7bc09ae6798f91739c4cf6ef6c7b88ec346e66daef6befae7983dc32b4",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 30,
    "source": [
      "Mulch protects the surface, helps conserve moisture and returns organic material.  Leave access for watering and inspection. Cut material into manageable pieces and keep observing moisture and decomposition. Is the root collar still clear?"
    ],
    "recordedTarget": [
      "I-mulch ivikela ubuso bomhlabathi, isize ukugcina umswakama futhi ibuyisele izinsalela zezinto eziphilayo emhlabathini.  Shiya indawo yokunisela nokuhlola. Sika izinsalela zibe izingcezu ezilawulekayo, uqhubeke ubheka umswakama nokubola. Indawo lapho isiqu sihlangana nezimpande isavulekile?"
    ],
    "sourceHeading": "Keep Mulch Off the Trunk",
    "registeredEnglishTitle": "Keep Mulch Off the Trunk",
    "registeredZuluTitle": "I-Mulch Mayingathinti Isiqu",
    "sourceHash": "4389224f98917adb2364d6c8423a52eee24d48cd37bc0decd49e47627f3c817d",
    "targetHash": "a15b198120b11e2c7f617db253de826f329444387f8f23cef6b8e7ec15be5006",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-30.jpg",
    "imageSha256": "4efa63a2cc29bf0bbf16f5db0326449a104e74d04e47cedc9d5c44c924e2dcf1",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-30.mp3",
    "audioSha256": "641b6eb9536f47689acf83f756d5bee49e112819e5e03478a846bfda8f85da82",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 31,
    "source": [
      "Bocking 14 comfrey can supply cut leaves for mulch."
    ],
    "recordedTarget": [
      "I-Bocking 14 comfrey inganika amaqabunga asikwayo asetshenziswe njenge-mulch."
    ],
    "sourceHeading": "Choose the Right Comfrey",
    "registeredEnglishTitle": "Choose the Right Comfrey",
    "registeredZuluTitle": "Khetha I-Comfrey Efanele",
    "sourceHash": "fcbaa10016e7c957caf7ccc4041ddc65a855fb378f997cd1ceceb0122ad4d85d",
    "targetHash": "199581b827dcccf22567c3c1d8027a00e03b972c1d648e7b99bad5f85cebf77a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-31.jpg",
    "imageSha256": "683fc28c2fe966a8132c26b6024c004a04a781f914a95b950abc71467d177a07",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-31.mp3",
    "audioSha256": "15611f975bad0c3ea87ce48aedf732463062e4cc53fa7394370228e853651389",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 32,
    "source": [
      "Obtain the correct cultivar. Bocking 14 does not spread by viable seed, but root pieces can regrow.  Place it where it has room and sufficient moisture. Cut leaves as it recovers; do not crowd the young fruit tree. Is this a good permanent place for the clump?"
    ],
    "recordedTarget": [
      "Thola uhlobo olulinywayo oluqondile. I-Bocking 14 ayisakazeki ngembewu ekwazi ukuhluma, kodwa izingcezu zezimpande zingaphinde zikhule.  Yibeke lapho inendawo nomswakama owanele khona. Sika amaqabunga njengoba isibuyela esimweni sayo; ungaminyanisi umuthi omncane wezithelo. Le yindawo enhle yini yokuthi lesi sixha sihlale isikhathi eside?"
    ],
    "sourceHeading": "Choose the Right Comfrey",
    "registeredEnglishTitle": "Choose the Right Comfrey",
    "registeredZuluTitle": "Khetha I-Comfrey Efanele",
    "sourceHash": "073bb4c7776b0c4f897bb58b5c5fed14235bd01489e118a44fa1a40b22a15227",
    "targetHash": "2d5b7ce8a4af5a88fe80f0368e2086ab79f143d5e6a691d574ca029f22c3c33f",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-32.jpg",
    "imageSha256": "825a6a5521d98bbe00e6e38515805e8aec353b455684a06f9ccd2cac20c4b81c",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-32.mp3",
    "audioSha256": "6cd434bfe90f24f3bfc6697a68d788c4246b72b1db29622540da7cd59eae76b5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 33,
    "source": [
      "Flowers can provide resources for useful insects."
    ],
    "recordedTarget": [
      "Izimbali zinganika izinambuzane eziwusizo izinto ezizidingayo."
    ],
    "sourceHeading": "Observe Helpful Insects",
    "registeredEnglishTitle": "Observe Helpful Insects",
    "registeredZuluTitle": "Bheka Izinambuzane Eziwusizo",
    "sourceHash": "04d7ea4e012048ac9de7b912ade77e6ca87496b4e9c53c5dfe8f9fef67276fcd",
    "targetHash": "5e31e296c3aad9024f4c4ef5fe995c161cb51bcbc62397878d45e1e25b41a09c",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-33.jpg",
    "imageSha256": "6a75c9bbd0d834bdb5c077e0e9e555e550831b1983e1e6437ba75ed1c65813b7",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-33.mp3",
    "audioSha256": "814846adbf7ace6aa88bc1f1fff84f6cf2af58c313009c0d7ca1def3d5bbe8dd",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 34,
    "source": [
      "Many ladybirds eat aphids; some parasitoid wasps attack crop pests. Flowering members such as African basil can add resources.  Watch which insects visit and whether damage changes. A flowering plant does not guarantee pest control. What is the insect actually doing?"
    ],
    "recordedTarget": [
      "Ama-ladybird amaningi adla ama-aphid; amanye ama-parasitoid wasp ahlasela izinambuzane ezilimaza izitshalo. Izitshalo eziqhakazayo njenge-African basil zinganika lezi zinambuzane izinto ezizidingayo.  Bheka ukuthi yiziphi izinambuzane ezivakashelayo nokuthi umonakalo uyashintsha yini. Isitshalo esiqhakazayo asiqinisekisi ukulawula izinambuzane ezilimazayo. Inambuzane yenzani ngempela?"
    ],
    "sourceHeading": "Observe Helpful Insects",
    "registeredEnglishTitle": "Observe Helpful Insects",
    "registeredZuluTitle": "Bheka Izinambuzane Eziwusizo",
    "sourceHash": "22f05aeb59b515bd6cae101bb818e17d677d9d54bea7f3ab07de986f45f67f5d",
    "targetHash": "05a3d076214351869dc66f48b00b51b6b974164d9df07a93c43963ec1d20145d",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-34.jpg",
    "imageSha256": "d17ed6df91f3f0c0df8e414b087cd480d61ad605995e47083f13b97f2095a1e7",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-34.mp3",
    "audioSha256": "a98cfbacd3908c53f621f942814ee7c92c9469f9dc3cb2b22989aa1a635da5ac",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 35,
    "source": [
      "Wild garlic can be a flowering member where the site suits it."
    ],
    "recordedTarget": [
      "I-wild garlic ingaba isitshalo esiqhakazayo ku-guild lapho indawo iyifanele."
    ],
    "sourceHeading": "Give Flowers Their Space",
    "registeredEnglishTitle": "Give Flowers Their Space",
    "registeredZuluTitle": "Nikeza Izimbali Indawo Yazo",
    "sourceHash": "c96c4984d07c265f469aa5d1a16887d16b33cff299f91d1e18d773b4cf74e485",
    "targetHash": "e45597f5fb8b6bc7587bc522d345ec6a350f6c752172ff3929ebdcb3b9a5b00a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-35.jpg",
    "imageSha256": "698fc6b1581d728d0c8ec0a34dca72e849c1a1c71cdd685e6bf1c1504c15d926",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-35.mp3",
    "audioSha256": "de593948b35b92a0fddb52ccae15ea08fe6d48fe4a80301e15695a8611e90af4",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 36,
    "source": [
      "Tulbaghia violacea has narrow leaves and lilac flowers. Place a clump where it has light and room to grow.  Observe visiting insects. Do not promise that a ring of wild garlic will repel pests or cure an outbreak. Where can flowers grow without crowding?"
    ],
    "recordedTarget": [
      "I-Tulbaghia violacea inamaqabunga amancane ngobubanzi nezimbali ezinsomi ngokukhanyayo. Beka isixha lapho sithola ukukhanya nendawo yokukhula.  Bheka izinambuzane ezivakashelayo. Ungathembisi ukuthi indilinga ye-wild garlic izoxosha izinambuzane ezilimazayo noma iqede ukuhlasela kwazo. Izimbali zingakhula kuphi ngaphandle kokuminyanisa ezinye izitshalo?"
    ],
    "sourceHeading": "Give Flowers Their Space",
    "registeredEnglishTitle": "Give Flowers Their Space",
    "registeredZuluTitle": "Nikeza Izimbali Indawo Yazo",
    "sourceHash": "83ac3560cd9c4d87906117b6e0a0937b02e09b43e04b24efbfc07ab8409335e1",
    "targetHash": "610d5e8f7989f7384af75155603a036b1d5302fb3a3154a7ce9228143b1194e4",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-36.jpg",
    "imageSha256": "a811bfcba2911fa786ca1ddc4f33cccc0636bff8f08ee0d6e6f56cbc6eba5788",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-36.mp3",
    "audioSha256": "33936c600887141a86407b07b0383e2389cc87d5d3b63aaa1680fdd6e2377efb",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 37,
    "source": [
      "Choose useful partners while protecting the mango's growing space."
    ],
    "recordedTarget": [
      "Khetha izitshalo eziwusizo, uvikele indawo yokukhula kukamango."
    ],
    "sourceHeading": "Bring the Jobs Together",
    "registeredEnglishTitle": "Bring the Jobs Together",
    "registeredZuluTitle": "Hlanganisa Imisebenzi",
    "sourceHash": "be5431c5655bb499cb2deac682768fd0155368ddb00d77a1197af7e521f6ffb9",
    "targetHash": "d3045a2e0a56e9c90985cd3991a13d6745ce28ec306083e267ce1d6b72cb246a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-37.jpg",
    "imageSha256": "123dddd618c89649157b92af43022d661b5777de8b271a6c49adfa46e8579203",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-37.mp3",
    "audioSha256": "24eb1249cf1115a0e8345ea65ee2e78066242a977dbc07af5162de82e036e000",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 38,
    "source": [
      "Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Some plants serve several functions.  Keep the trunk area and path open. Reassess each member as the mango and its neighbours grow. Does each member have space and a job?"
    ],
    "recordedTarget": [
      "Hlanganisa imisebenzi edingekayo: ukufaka i-nitrogen, ukudla, i-mulch, izimbali nokumboza umhlabathi. Isitshalo esisodwa singaba nemisebenzi eminingi.  Gcina indawo yesiqu nendlela kuvulekile. Hlola ilungu ngalinye njengoba umango nezinye izitshalo zikhula. Isitshalo ngasinye sinendawo nomsebenzi?"
    ],
    "sourceHeading": "Bring the Jobs Together",
    "registeredEnglishTitle": "Bring the Jobs Together",
    "registeredZuluTitle": "Hlanganisa Imisebenzi",
    "sourceHash": "1fded62bef9597881099c864e627d53bf9712a893de9d1e4459706436f57d524",
    "targetHash": "4c2f775506fa64198fea3cb41ffee01092a5f034edfecd360f39d2f90139fb81",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-38.jpg",
    "imageSha256": "0e972c16185bfbcdc0d092b43d93d1f6cefd3fffdecf4b473ffaff4c95e611f3",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-38.mp3",
    "audioSha256": "a5d488a3112240567cd270df75f5eaf8eb254806427e1819b637667b51b056e2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 39,
    "source": [
      "Sweet potato can cover ground and provide food in a suitable sunny space."
    ],
    "recordedTarget": [
      "Ubhatata ungamboza umhlabathi unike nokudla endaweni efanele enelanga."
    ],
    "sourceHeading": "Food Cover Also Competes",
    "registeredEnglishTitle": "Food Cover Also Competes",
    "registeredZuluTitle": "Ubhatata Nawo Uyancintisana",
    "sourceHash": "c7fae7bcae0b00cb0fb546805a374d648341fb43804db93308d00705dcce5cd2",
    "targetHash": "3d5b4ff246cd0bd1543f7621b57834211d61731dec77c691f4e17193935e3b1a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-39.jpg",
    "imageSha256": "5cf77f4a478e6ece24c8b12cb045e45dbc7a311b1b9201cdbbc88d7a16824a3c",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-39.mp3",
    "audioSha256": "ec2146f7a014990017cf84dd1746a8e896ff252da907cf69bf7e667189fff370",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 40,
    "source": [
      "Keep its vines away from the young fruit tree and retain a route for care. Its roots also use water and nutrients.  Where resources are tight, compare living cover with an ordinary mulch basin. Is this cover helping the tree establish?"
    ],
    "recordedTarget": [
      "Gcina iziqu ezinabayo zobhatata kude nomuthi omncane wezithelo, ushiye nendlela yokuwunakekela. Izimpande zawo nazo zisebenzisa amanzi nezakhamzimba.  Lapho lezi zidingo zinganele, qhathanisa izitshalo eziphilayo ezimboza umhlabathi nesitsha sokunisela esimbozwe nge-mulch evamile. Lokhu okumbozayo kuyawusiza umuthi ukuthi umile kahle?"
    ],
    "sourceHeading": "Food Cover Also Competes",
    "registeredEnglishTitle": "Food Cover Also Competes",
    "registeredZuluTitle": "Ubhatata Nawo Uyancintisana",
    "sourceHash": "6962753386e4424417c03febef51ae7452ef69f35554985cd371681959af6a7d",
    "targetHash": "a2b0da2ab10cf0331de50edaef04b66e37838c20430974547cd824b6bd859ac9",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-40.jpg",
    "imageSha256": "d12c0a6a4d4a13f19ea2d05eb85f996ed6467fd5c23a6b518989c0c620c8d79e",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-40.mp3",
    "audioSha256": "7d92638ce21cb0a9a8c6dc78278dce754ea0b149b0a0a4d144bda7c8435aa696",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 41,
    "source": [
      "Start while the young fruit tree and its support plants have enough light and water."
    ],
    "recordedTarget": [
      "Qala ngesikhathi lapho kunokukhanya namanzi okwanele umuthi omncane wezithelo nezitshalo eziwusekelayo."
    ],
    "sourceHeading": "First, Establish the Guild",
    "registeredEnglishTitle": "First, Establish the Guild",
    "registeredZuluTitle": "Qala Ngokumilisa I-Guild",
    "sourceHash": "8e9557dcfc47686db6598643178156dd4ec6d3ce906e189f2d6702e1270484f8",
    "targetHash": "0276a341807df0f894460e6e6e275fe02eb4e3c6b8ec8a2eaaa9441784063f8d",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-41.jpg",
    "imageSha256": "f664b86db1e863c2fc11f0752ef7b5289086cca33304a6f00c483b4dabb0cdb1",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-41.mp3",
    "audioSha256": "48b9b13f99171ae2b4b82a5e3880ecbd88bbaddfc4b77c1c8585cd8395ed2cbc",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 42,
    "source": [
      "Plant into a suitable season, mulch and maintain establishment water. Keep the access gap open.  Start with the number of support plants you can care for. Observe survival and growth before adding more. Can you care for every plant through establishment?"
    ],
    "recordedTarget": [
      "Tshala ngesizini efanele, faka i-mulch futhi unike amanzi adingekayo ngesikhathi izitshalo ziqala ukumila. Gcina indlela yokungena ivulekile.  Qala ngenani lezitshalo ezisekelayo ongakwazi ukuzinakekela. Bheka ukuthi ziyasinda futhi zikhula kanjani ngaphambi kokwengeza ezinye. Ungakwazi ukunakekela zonke izitshalo zize zimile kahle?"
    ],
    "sourceHeading": "First, Establish the Guild",
    "registeredEnglishTitle": "First, Establish the Guild",
    "registeredZuluTitle": "Qala Ngokumilisa I-Guild",
    "sourceHash": "2c12a709009d92ee23cb282dbc79d872dc24811eea1baa7f68a531538845cc38",
    "targetHash": "eb4a99d216beb954066af7d7a94e16863292068951bb125c56647c31c2098aef",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-42.jpg",
    "imageSha256": "cb63e3521ceedddcc6a538649dddf0206e451ec47dd74cd16b634f9040133b53",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-42.mp3",
    "audioSha256": "058f1155d7451428dac60aa1fef25c7917d19dca7741d9eb5195216daa87884b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 43,
    "source": [
      "When pruning is no longer enough, reduce selected support plants. Cut down selected competing supports to open space. Suitable cut material can stay as mulch: this is thinning through chop-and-drop.  Manage regrowth to keep the opening. Check light, soil moisture and growth; thinning does not instantly stop root competition. Which support plants should now give way?"
    ],
    "recordedTarget": [
      "Uma ukuthena kungasanele, nciphisa izitshalo ezisekelayo ezikhethiwe. Sika ezinye ezincintisanayo phansi ukuze kuvuleke indawo. Izinsalela ezifanele zingasala njenge-mulch.  Lawula amahlumela amasha. Bheka ukukhanya, umswakama nokukhula. Ukusika akukuqedi ngokushesha ukuncintisana kwezimpande. Yiziphi ezisekelayo okufanele zisuswe manje?"
    ],
    "sourceHeading": "Thin as the Fruit Tree Grows",
    "registeredEnglishTitle": "Thin as the Fruit Tree Grows",
    "registeredZuluTitle": "Nciphisa Njengoba Umuthi Ukhula",
    "sourceHash": "03db7440adf87a068f7135bf9e08fda89a7c24030fe19d9cc34350c2d637372e",
    "targetHash": "74b6a926d41bfe2954cafce559ba6e5c72e68b2c457ce71b1bf810726a8fd4ff",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-43.jpg",
    "imageSha256": "be6ad51c72a166f55f45a28081a0d21e3236e22873ae06b380428c693a211f97",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-43.mp3",
    "audioSha256": "a39201269f882c0b31d9e9075343c1a2f97dead440fbd24b4514a4b69f671731",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 44,
    "source": [
      "As shade increases, renew sun-loving support plants in open edges and younger plantings."
    ],
    "recordedTarget": [
      "Njengoba umthunzi wanda, tshala kabusha izitshalo ezisekelayo ezithanda ilanga emaphethelweni avulekile nasezindaweni ezinemithi emincane."
    ],
    "sourceHeading": "Move Support Into the Light",
    "registeredEnglishTitle": "Move Support Into the Light",
    "registeredZuluTitle": "Hambisa Ezisekelayo Ekukhanyeni",
    "sourceHash": "cd2a3fa28a0628702bffdbe3e53c567e137a24f5a701ed357a925c717da49c0e",
    "targetHash": "b3461e6467042e18e90bfac5a18684bd2dc070157e10f5f1773952fd9e2a84fc",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-44.jpg",
    "imageSha256": "86d7cd651bf525eebec1e7eb62f891105ddf818df21a3c7fa9ab7b3e025cb894",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-44.mp3",
    "audioSha256": "ed35d9d1f17f53c926e50849e53389c3b777a8825bdad8c2c5ebfd2496bc7002",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 45,
    "source": [
      "Carry useful prunings back to established trees. Keep nearby plants only where they still perform well.  Mature fruit trees still need nutrients. Monitor growth, harvest and soil conditions; support plants do not remove that need. Where is the next useful sunny space?"
    ],
    "recordedTarget": [
      "Thwala amagatsha athenwe awusizo uwabuyisele emithini esikhulile. Gcina izitshalo eziseduze kuphela lapho zisaqhubeka zenza kahle.  Imithi yezithelo esikhulile isazidinga izakhamzimba. Bheka ukukhula, isivuno nesimo somhlabathi; izitshalo ezisekelayo azisiqedi leso sidingo. Ikuphi enye indawo enelanga engasetshenziswa?"
    ],
    "sourceHeading": "Move Support Into the Light",
    "registeredEnglishTitle": "Move Support Into the Light",
    "registeredZuluTitle": "Hambisa Ezisekelayo Ekukhanyeni",
    "sourceHash": "ed904b807f37dbc54b94e89c8f533b635da3acde9f1dbea5286a85eac0458da6",
    "targetHash": "2e8dde528319c70a1d6f498a40173e8d701b9b4dad9b5607aba5a5a5ff12b1c3",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-45.jpg",
    "imageSha256": "bf92e4674de66eb47cbf35045e1ff39b6f1326f1d5b860f2924f84a1d067fbc0",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-45.mp3",
    "audioSha256": "cd4abc96c57102da57cef0cb6f67c720c50421c1c4e314a9c2517cf6d1e0e4aa",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 46,
    "source": [
      "Keep a short record of how the guild performs."
    ],
    "recordedTarget": [
      "Gcina umbhalo omfushane wokuthi i-guild isebenza kanjani."
    ],
    "sourceHeading": "Let Observation Decide",
    "registeredEnglishTitle": "Let Observation Decide",
    "registeredZuluTitle": "Nquma Ngokubonile",
    "sourceHash": "c0ebed0eca6835af0101a0f3e6c292b650f7404ece5e83e9d5f2e42beaa44b6f",
    "targetHash": "3e945bb5c007c919f327dd8e76a8bfe0e93302f05d3967bf709355cb6015275b",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-46.jpg",
    "imageSha256": "6ee0d1c09e9a6afefc03513b718defc4c5b75ad5326204947a725db3a62c291d",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-46.mp3",
    "audioSha256": "5193d9712945a0c2aa4f321d0ccb63ff8306b0d83521c90e4a248f579eef32c6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 47,
    "source": [
      "Check fruit-tree growth, shade, soil moisture, useful harvests and pest damage. Note what was cut, returned or removed.  Use these observations to change the layout and care. A plant earns its place through what it does here. What evidence would make you change the guild?"
    ],
    "recordedTarget": [
      "Hlola ukukhula komuthi wezithelo, umthunzi, umswakama womhlabathi, izivuno eziwusizo nomonakalo wezinambuzane. Bhala ukuthi yini esikiwe, ebuyiselwe emhlabathini noma esusiwe.  Sebenzisa lokho okubonile ukulungisa ukuhlelwa kwendawo nokunakekela. Isitshalo sifanele indawo yaso ngalokho esikwenzayo lapha. Yibuphi ubufakazi obungakwenza ushintshe i-guild?"
    ],
    "sourceHeading": "Let Observation Decide",
    "registeredEnglishTitle": "Let Observation Decide",
    "registeredZuluTitle": "Nquma Ngokubonile",
    "sourceHash": "8f55cf7328c4f0b4408479ca42fc54164a27ec08a5defdb20ff1b7c06bf6aa8d",
    "targetHash": "608c8b84f5312fa7e776a2101d702d6056046a74fc9f80bd0d53058b5e3b79f0",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-47.jpg",
    "imageSha256": "343b441c8ec91433de983e65ad98b7f248edf1334824f1d8946162fbf8109a81",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-47.mp3",
    "audioSha256": "fd157970b5c2eec864bdf451566e4d9770421ee01ea138dd025e22b4bf7e21d8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 48,
    "source": [
      "Choose one fruit tree and mark a layout you can manage."
    ],
    "recordedTarget": [
      "Khetha umuthi owodwa wezithelo, umake ukuhlelwa kwendawo ongakwazi ukukuphatha."
    ],
    "sourceHeading": "Plan One Real Guild",
    "registeredEnglishTitle": "Plan One Real Guild",
    "registeredZuluTitle": "Hlela I-Guild Eyodwa Yangempela",
    "sourceHash": "271d8a4c7b97166ddb18d83a105f6a54fa38470f94c3c3736c1e7ef2f8c80430",
    "targetHash": "6e57a8e81b8f9b66e8a77acc4659a3320b82a50b3d44b15bda90818687d25d7a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-48.jpg",
    "imageSha256": "b8fbfbd5e513d93f966d53a8196d79944f71e20a3eb090318fe42a4b0fe4b3e4",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-48.mp3",
    "audioSha256": "9b006b1ebdbe2867d7e807d44010870f0e0a374efbad68b0aaaf5f1f0ad1e10e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 49,
    "source": [
      "Record the tree, site conditions and missing jobs. Name the support species fully, mark the starting number and leave access.  Write down what will trigger pruning or thinning. Agree the species list with the project team where required. Can someone else explain your plan back to you?"
    ],
    "recordedTarget": [
      "Bhala umuthi, izimo zendawo nemisebenzi eshodayo. Bhala amagama agcwele ezinhlobo ezisekelayo, umake inani lokuqala, ushiye nendlela yokufinyelela.  Bhala ukuthi yiziphi izimpawu ezizokwenza uthene noma unciphise izitshalo. Vumelanani nohlu lwezitshalo nethimba lephrojekthi lapho kudingeka khona. Omunye umuntu angakwazi ukukuchazela uhlelo lwakho ngendlela ayiluqonda ngayo?"
    ],
    "sourceHeading": "Plan One Real Guild",
    "registeredEnglishTitle": "Plan One Real Guild",
    "registeredZuluTitle": "Hlela I-Guild Eyodwa Yangempela",
    "sourceHash": "1b32811c30540f9ada92331a2b4f59806430511a004ea7a6ce5d04071ee92604",
    "targetHash": "40e8c5cd07cddcb6edb3917d434f6be7079c681a34e1578499dc3238649e213b",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-49.jpg",
    "imageSha256": "a9b948839103de7dafe2cdf4815fff7c0f31d658eb03419969e2a60f89a7233b",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-49.mp3",
    "audioSha256": "03c864b867c0eac1076a4633e97052ca08b1d72a7e9290a3fce659082bea9baa",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 50,
    "source": [
      "Start one suitable guild and care for it through its first stage."
    ],
    "recordedTarget": [
      "Qala i-guild eyodwa efanele, uyinakekele esigabeni sayo sokuqala."
    ],
    "sourceHeading": "Plant, Observe, Adjust",
    "registeredEnglishTitle": "Plant, Observe, Adjust",
    "registeredZuluTitle": "Tshala, Qaphela, Lungisa",
    "sourceHash": "cf173dd4579ebbbe2a849c8242700142df2af9d719919b31538bd3ac1ea57630",
    "targetHash": "c6801b80b3d4882c0678a6b6478f981d76ef7a9b3c9e67dca0ba25a363dfcd4a",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-50.jpg",
    "imageSha256": "dbfabe666a48a84a91f73bcdca622593f29fe472da8a55f32e16e256dba03da9",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-50.mp3",
    "audioSha256": "660ddd9db9a80c2b44d4baf198d6e84e26533b8a96d757c090cfb9caea91c2be",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 51,
    "source": [
      "Use the right species, a manageable number of plants and room to grow. Return useful biomass and protect the fruit tree.  Review the planting as crowns expand. Keep, cut, replace or remove each support plant when its role changes. What will you do first—and when will you review it?"
    ],
    "recordedTarget": [
      "Sebenzisa izinhlobo ezifanele, inani lezitshalo olilawulekayo nendawo yokukhula. Buyisela izinsalela zezitshalo eziwusizo, uvikele umuthi wezithelo.  Buyekeza okutshaliwe njengoba amagatsha esabalala. Gcina, sika, shintsha noma ususe isitshalo ngasinye esisekelayo lapho umsebenzi waso ushintsha. Uzokwenzani kuqala—futhi uzokubuyekeza nini?"
    ],
    "sourceHeading": "Plant, Observe, Adjust",
    "registeredEnglishTitle": "Plant, Observe, Adjust",
    "registeredZuluTitle": "Tshala, Qaphela, Lungisa",
    "sourceHash": "4de602af49e5cdb987561b160e086bfa3b78e92110c809385e1d64f2161227c4",
    "targetHash": "76f0f62fc53f0254d934554e6ab85c7d24867123c1059ede3bf34675479e3bf7",
    "imageUrl": "/course-decks/plant-guilds/zu/slide-51.jpg",
    "imageSha256": "ce6242028876c944a6e3800956a9dd1be41cca73ae9605dc23affb066412c6e0",
    "audioUrl": "/course-audio/plant-guilds/zu/slide-51.mp3",
    "audioSha256": "093b3f74597617d12f2255a921efb51c062d14f7802ff03c2f77f90e0226c010",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 1,
    "source": [
      "Seed is where the next season begins.",
      "When your household can save, store and share good seed, it carries more than a crop forward. It also carries the freedom to choose.",
      "In this lesson, you will follow seed from the parent plant to the packet, the germination test and a neighbour’s hand.",
      "Think about the crops in your area. Which ones do you already save seed from? Which seed do you buy? Which seed do you exchange?",
      "Try to name at least one crop whose seed is already being saved in your area."
    ],
    "recordedTarget": [
      "Imbewu yilapho kuqala khona isizini elandelayo.",
      "Uma ikhaya lakho likwazi ukulondoloza, ukugcina nokwabelana ngembewu enhle, alidluliseli isivuno kuphela. Liphinde lidlulisele inkululeko yokukhetha.",
      "Kulesi sifundo uzolandela imbewu kusukela esitshalweni esingumzali iye ephaketheni, ekuhlolweni kokuhluma nasezandleni zikamakhelwane.",
      "Cabanga ngezitshalo zasendaweni yakho. Yiziphi osuvele ulondoloza imbewu yazo? Yiziphi ozithengayo? Yiziphi enishintshisana ngazo?",
      "Zama ukusho okungenani isitshalo esisodwa imbewu yaso esivele ilondolozwa endaweni yakho."
    ],
    "sourceHeading": "Seeds and Seed Sovereignty",
    "registeredEnglishTitle": "Seeds and Seed Sovereignty",
    "registeredZuluTitle": "Ubukhosi Bembewu",
    "sourceHash": "9d19e088d79172f9080ff5d0efa52d73447505cb6993be726366b1bf185fd8fe",
    "targetHash": "80c78d2efec93692ab0e51bc7620f355a4b1c564c9f6cdfbf328b6ec8621c9fa",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-01.jpg",
    "imageSha256": "a8b7ff8a9b89dbee1076b0829d96eb906de35ac2b7a1be35b130668e51095404",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-01.mp3",
    "audioSha256": "eff0820362d40f11c4aa2719e86b465714649990e4f46aaf7ae201c6e4ae37a4",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 2,
    "source": [
      "Saving seed does not mean rejecting all bought seed. It means building practical choices.",
      "Each crop you learn to save well removes one repeated purchase. It also begins a local record of what performs well in your soil and your season.",
      "Think about the seed you buy again and again. Which repeated seed purchase costs your household the most each year?",
      "Choose one crop from your planting list. Make it your practical starting point for seed saving. Do not try to save everything at once."
    ],
    "recordedTarget": [
      "Ukulondoloza imbewu akusho ukwenqaba yonke imbewu ethengwayo. Kusho ukwakha ukukhetha okusebenzayo.",
      "Isitshalo ngasinye okwazi ukusilondoloza kahle sisusa ukuthenga okukodwa okuphindaphindwayo. Siphinde siqale umlando wendawo wokuthi yini eyenza kahle emhlabathini nangesizini yakho.",
      "Cabanga ngembewu oyithenga futhi njalo. Yikuphi ukuthenga okubiza kakhulu ekhaya lakho ngonyaka?",
      "Khetha isitshalo esisodwa ohlwini lwakho lokutshala. Senze isiqalo sakho esingokoqobo sokulondoloza imbewu. Ungazami ukulondoloza yonke into ngesikhathi esisodwa."
    ],
    "sourceHeading": "Why Saving Seed Matters",
    "registeredEnglishTitle": "Why Saving Seed Matters",
    "registeredZuluTitle": "Kungani Ukulondoloza Imbewu Kubalulekile",
    "sourceHash": "160f394cf7ffa4618a3c504b6097cfd0f6fe70e3e4f3722b7b31b72f60a1f2d1",
    "targetHash": "d2e6a9914dfc6065d82c3b00d6f155212dd297c6e67aa1feed973232641e8e1b",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-02.jpg",
    "imageSha256": "6608e60521ed6361d3a90dd0616b965a2981a53268e14fbc03199ee04e05175c",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-02.mp3",
    "audioSha256": "6c2c1c2f6bdd118312b1dddab095e9434346f57a074d872b3d8a9f4a2527c737",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 3,
    "source": [
      "This lesson ends with a working seed store, not a list of facts.",
      "You will make four decisions.",
      "What will you save?",
      "How will you process it?",
      "How will you protect it?",
      "And how will you know it is still alive before you depend on it?",
      "Which of these four decisions is least familiar to you?",
      "Say them again in your own words: select, process, protect and verify."
    ],
    "recordedTarget": [
      "Lesi sifundo siphetha ngendawo yokugcina imbewu esebenzayo, hhayi ngohlu lwamaqiniso.",
      "Uzokwenza izinqumo ezine.",
      "Yini ozoyilondoloza?",
      "Uzoyilungisa kanjani?",
      "Uzoyivikela kanjani?",
      "Futhi uzokwazi kanjani ukuthi isaphila ngaphambi kokuyethemba?",
      "Yisiphi kulezi zinqumo ezine ongakajwayelani kakhulu naso?",
      "Zisho futhi ngamazwi akho: khetha, lungisa, vikela, bese uqinisekisa."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "c9a668fd7235c93d64916745fef67ed0cae312f442c1683f4e5b214f9bb2d205",
    "targetHash": "663ae7653493ec2ec24e5e16e8711fb748846090814ed12b43a4ad9900fc693b",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-03.jpg",
    "imageSha256": "f9cb2e7b087fc4ab46503a819df35e4db41f6ca7da103ce61288a997e4b1fddc",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-03.mp3",
    "audioSha256": "1a52f34ee074d8c3478c519b8cebecf4597e364bd9bab37e6b983388c1438b18",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 4,
    "source": [
      "Open-pollinated seed is not magic.",
      "A stable variety can produce similar generations when it is properly isolated or self-pollinated.",
      "F1 seed usually remains alive. But the next generation separates into different combinations of the parent traits.",
      "The problem is unpredictability, not failure to germinate.",
      "Think about one small bed on your own plot. Why could unpredictable plants be a risk when space is limited?",
      "If you have seed packets, check whether they are marked open-pollinated or F1. Which would you choose for saving dependable seed?",
      "Remember: the next F1 generation varies. It does not automatically die."
    ],
    "recordedTarget": [
      "Imbewu evulekele impova ayenzi umlingo.",
      "Uhlobo oluzinzile lungaveza izizukulwane ezifanayo uma luhlukaniswe kahle noma luzithuthela impova.",
      "Imbewu ye-F1 ivamise ukuhlala iphila. Kodwa isizukulwane esilandelayo sihlukana sibe izinhlanganisela ezahlukene zezimpawu zabazali.",
      "Inkinga ukungabikezeleki, hhayi ukungahlumi.",
      "Cabanga ngombhede owodwa omncane ekhaya lakho. Kungani izitshalo ezingabikezeleki zingaba yingozi lapho indawo incane?",
      "Uma unamaphakethe embewu, bheka ukuthi abhalwe ukuthi avulekele impova noma i-F1. Yikuphi ongakhetha kukho ukuze ulondoloze imbewu ethembekile?",
      "Khumbula: izizukulwane ze-F1 ziyahlukahluka. Azifi ngokuzenzakalelayo."
    ],
    "sourceHeading": "Open-Pollinated Seed and F1 Seed",
    "registeredEnglishTitle": "Open-Pollinated Seed and F1 Seed",
    "registeredZuluTitle": "Imbewu Evulekele Impova Ne-F1",
    "sourceHash": "94a0056ccb36ce459a68085c156a98f2e66d11ec7f5968755f9cbb22ca1d7d7d",
    "targetHash": "ce98fc2ecc085addaee53de869f1aa0d58791d1c4a5aaefaacff06cc9965bfa8",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-04.jpg",
    "imageSha256": "20b1c361dedf13b710745b50f86504b9739682fff8ddcb94c4427b1e4d2e8e37",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-04.mp3",
    "audioSha256": "da7a2899de05af3861a533c00aabf6ec92adeb4383153c49d478799eeba1d65f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 5,
    "source": [
      "Watch both sides.",
      "Both kinds of seed germinate.",
      "Open-pollinated seed produces similar plants when the variety is stable and pollination is properly managed.",
      "Seed saved from an F1 plant also germinates. But its next generation varies. Some plants may be tall. Others may be short. Their vigour and yield may differ.",
      "Ask yourself what this means when choosing seed to save.",
      "If you understand the difference, you can explain it in one sentence: both germinate, but the next F1 generation is unpredictable."
    ],
    "recordedTarget": [
      "Qaphela izinhlangothi zombili.",
      "Zombili izinhlobo zembewu ziyahluma.",
      "Imbewu evulekele impova ikhiqiza izitshalo ezifanayo uma uhlobo luzinzile futhi impova ilawulwa kahle.",
      "Imbewu egcinwe esitshalweni se-F1 nayo iyahluma. Kodwa isizukulwane esilandelayo siyahlukahluka. Ezinye izitshalo zingaba zinde. Ezinye zibe zimfushane. Amandla nesivuno kungahluka.",
      "Zibuze ukuthi lokhu kusho ukuthini lapho ukhetha imbewu ozoyilondoloza.",
      "Uma ukuqonda kahle, ungachaza lo mehluko ngomusho owodwa: zombili ziyahluma, kodwa isizukulwane se-F1 asibikezeleki."
    ],
    "sourceHeading": "Watch: Open-Pollinated Seed and F1 Seed",
    "registeredEnglishTitle": "Watch: Open-Pollinated Seed and F1 Seed",
    "registeredZuluTitle": "Buka: Imbewu Evulekele Impova Ne-F1",
    "sourceHash": "3ed8b98821a9cc8c57e96a92a9bff4eca5e5e8e52fb1b935f2de9f08ecc9c45e",
    "targetHash": "fb4e1f14173a561cfbf5287779d826ca32977a8254fc1b0309ce089358d48965",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-05.jpg",
    "imageSha256": "d635e94af7c94d5885037ae7dc308b9ac81f37f550c66e8a928c15250b0b86fb",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-05.mp3",
    "audioSha256": "33306c8c24a1404cc5629aea26cf4033b8b79bda57f6d059a5d3309e52c955d0",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 6,
    "source": [
      "Seed sovereignty does not live in a slogan.",
      "It lives in a dry packet, a written record and knowledge of how the seed behaves.",
      "Your household begins it. Neighbours extend it. The seasons make the local seed collection more useful.",
      "Which seed does your household already save best?",
      "Draw a small map of the homes near you. Beside each home, write one crop that household could bring to a seed exchange.",
      "Sovereignty needs three things: usable seed, written information and exchange."
    ],
    "recordedTarget": [
      "Ubukhosi bembewu abuhlali esiqubulweni.",
      "Buhlala ephaketheni elomile, emlandweni obhaliwe nasolwazini lokuthi imbewu iziphatha kanjani.",
      "Ikhaya lakho liyakuqala. Omakhelwane bayakunweba. Izizini zenza uhlu lwembewu yendawo lube usizo kakhulu.",
      "Iyiphi imbewu ikhaya lakho eliyilondoloza kahle kakhulu?",
      "Dweba imephu encane yemizi eseduze nawe. Eduze komuzi ngamunye, bhala isitshalo lowo muzi ongasiletha ekushintshaneni ngembewu.",
      "Ubukhosi budinga izinto ezintathu: imbewu esebenzisekayo, ulwazi olubhaliwe nokushintshisana."
    ],
    "sourceHeading": "Seed Sovereignty",
    "registeredEnglishTitle": "Seed Sovereignty",
    "registeredZuluTitle": "Ubukhosi Bembewu",
    "sourceHash": "f719285275d71c775d4c39b39d268b0b1a132f7fee09e86ab4388197f4651dde",
    "targetHash": "b223dc390c6cab585252dc83dca613313f594adb2712f781eec93f3cf3fde511",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-06.jpg",
    "imageSha256": "e9faff0e7c095548970da2c9e081ebef1dacbb35867f9a2bc5f00f5b56eedcf7",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-06.mp3",
    "audioSha256": "b35684ea5614549084ab7d459086027a8a12eec80ab717452445702ce34c0934",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 7,
    "source": [
      "Well-saved seed becomes more powerful when it is known and shared.",
      "Watch one household begin by saving seed well from one crop. Dry seed goes into clean packets. Some packets move to neighbouring homes. The neighbours share different seed in return.",
      "By the end, each household holds more varieties than it had before.",
      "Think about which seed you could share and which seed you might receive from a neighbour. Seed moves. Knowledge and trust must move with it."
    ],
    "recordedTarget": [
      "Imbewu egcinwe kahle iba namandla uma yaziwa futhi kwabelwana ngayo.",
      "Buka ikhaya elilodwa liqala ngokulondoloza imbewu yesitshalo esisodwa kahle. Imbewu eyomile ingena emaphaketheni ahlanzekile. Amanye amaphakethe aya komakhelwane. Omakhelwane nabo babelana ngembewu ehlukile.",
      "Ekugcineni, ikhaya ngalinye selinezinhlobo eziningi kunakuqala.",
      "Cabanga ukuthi iyiphi imbewu ongabelana ngayo nokuthi iyiphi ongayithola komakhelwane. Imbewu iyasabalala. Ulwazi nokwethembana kufanele kusabalale nayo."
    ],
    "sourceHeading": "Watch: Household Seed Network",
    "registeredEnglishTitle": "Watch: Household Seed Network",
    "registeredZuluTitle": "Buka: Inethiwekhi Yembewu Yasemakhaya",
    "sourceHash": "29692a076f08bace16592439b48b72489d58542dc3628a51d51dd0c007d15028",
    "targetHash": "8e3fb4259a2be0de1dc74b4161ec55ade96f52c2e38855959826cd83b896aef7",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-07.jpg",
    "imageSha256": "2aab40f1431d74dc3f3d568ff185ad8efcd493202cfb456e20e7e3e377eb956c",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-07.mp3",
    "audioSha256": "e3cec5e7191599f43bdd8bcdba77104d1eeeff4f458909a5cd2f1387b5ad1167",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 8,
    "source": [
      "The largest fruit is not always the best seed parent.",
      "Look at the whole plant.",
      "Was it healthy?",
      "Did it mature at the right time?",
      "Was it true to type?",
      "Save from several good plants, especially in cross-pollinated crops. This prevents the next generation from coming from only one parent.",
      "What would make you reject a seed plant even if its fruit were large?",
      "Go to your own plot. Point out the plants you would select and the plants you would reject. Choose several healthy, true-to-type plants. Reject diseased plants and those that are not true to type."
    ],
    "recordedTarget": [
      "Isithelo esikhulu kunazo zonke asihlali siyisizali sembewu esingcono kakhulu.",
      "Bheka isitshalo sonke.",
      "Besinempilo yini?",
      "Sivuthwe ngesikhathi esifanele yini?",
      "Siyahambisana yini nohlobo?",
      "Londoloza ezitshalweni eziningana ezinhle, ikakhulukazi ezitshalweni ezixubana ngempova. Lokhu kuvimbela isizukulwane esilandelayo ukuba sivele kumzali oyedwa kuphela.",
      "Yini engenza wenqabe isitshalo sembewu noma isithelo saso sikhulu?",
      "Phuma uye engadini yakho. Khomba izitshalo ongakhetha kuzo nezitshalo ongazenqaba. Khetha eziningana ezinempilo nezihambisana nohlobo. Yenqaba ezigulayo noma ezingahambisani nohlobo."
    ],
    "sourceHeading": "Select Several Parent Plants",
    "registeredEnglishTitle": "Select Several Parent Plants",
    "registeredZuluTitle": "Khetha Izitshalo Zabazali Eziningana",
    "sourceHash": "79f838b77bf72612aae3d4fa8456636b40ee74c63188a485d20f3cc8b52f37d0",
    "targetHash": "98b992a1af8df4d66d0660ac126c0ab8611d421e80fc09f2ff8d356f2a383bd8",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-08.jpg",
    "imageSha256": "4c316371267beaabb81cff47d392296352197a3515a1ae56a98825a9f0ee0784",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-08.mp3",
    "audioSha256": "29af674e22722a3cf78aacb47b2ceda81164d2e378a2da3d06d57f4b463d1088",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 9,
    "source": [
      "Some crops mostly self-pollinate. A small garden can therefore keep the variety similar.",
      "Crops pollinated by wind or insects can cross over long distances.",
      "The distance needed depends on the crop, the place and the purpose of the seed. Do not promise varietal purity until you have checked the crop.",
      "How can you separate two varieties without using distance?",
      "You can plant them at different times so they do not flower together. You can also control pollination by hand or with covers.",
      "Remember the three tools: distance, flowering time or controlled pollination."
    ],
    "recordedTarget": [
      "Ezinye izitshalo zivame ukuzithuthela impova. Ngakho ingadi encane ingagcina uhlobo lufana.",
      "Izitshalo ezithuthelwa impova ngumoya noma izinambuzane zingaxubana ngamabanga amade.",
      "Ibanga elidingekayo lincike esitshalweni, endaweni nasenhlosweni yembewu. Ungathembisi ukuhlanzeka kohlobo ungakasihloli isitshalo.",
      "Ungazihlukanisa kanjani izinhlobo ezimbili ngaphandle kwebanga?",
      "Ungazitshala ngezikhathi ezahlukene ukuze zingaqhakazi ndawonye. Ungaphinde ulawule impova ngesandla noma ngokumboza.",
      "Khumbula amathuluzi amathathu: ibanga, isikhathi sokuqhakaza, noma impova elawulwayo."
    ],
    "sourceHeading": "Control Pollination",
    "registeredEnglishTitle": "Control Pollination",
    "registeredZuluTitle": "Lawula Impova",
    "sourceHash": "2c1391d68c67b0fb418861e0de34128319ebb808f0585b97a6e52e9fd384931f",
    "targetHash": "dd1e78410f9bee67286837795aa53aff7f70a37a85702fbfbe08d7585ffab951",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-09.jpg",
    "imageSha256": "7a4363482536f99f1c5348038fa572dedda9246039da0215d7717769be1ecc2b",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-09.mp3",
    "audioSha256": "bd193a4152ca856717cb0c5cf528c68c38de4676723248962952452b6f2ee37f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 10,
    "source": [
      "Follow the path of the pollen.",
      "In self-pollination, pollen moves within one flower from the part that produces it to the part that receives it. This often helps the variety remain similar.",
      "In a maize field, wind carries pollen from the tassels to the silks. If two varieties are close together and flower at the same time, they can cross.",
      "Think about how distance or different flowering times could prevent that on your own plot."
    ],
    "recordedTarget": [
      "Landela indlela impova ehamba ngayo.",
      "Lapho impova ihamba ngaphakathi kwembali eyodwa, isuka esithweni esiyikhiqizayo iye lapho yamukelwa khona. Lokhu kuvame ukusiza uhlobo luhlale lufana.",
      "Emasimini ommbila, umoya uthwala impova isuka ezihlokweni iye ezinweleni zesikhwebu. Uma izinhlobo zisondelene futhi ziqhakaza ngesikhathi esifanayo, zingaxubana.",
      "Cabanga ukuthi ibanga noma izikhathi ezahlukene zokuqhakaza kungakuvimba kanjani lokho engadini yakho."
    ],
    "sourceHeading": "Watch: Self-Pollination and Crossing",
    "registeredEnglishTitle": "Watch: Self-Pollination and Crossing",
    "registeredZuluTitle": "Buka: Ukuzithuthela Impova Nokuxubana",
    "sourceHash": "26c1793bc4b020d039ecd1ebc62fb844c535b35ff2f6e98b908787e5f91cb8ca",
    "targetHash": "21191553ecd3092e0a727279d0d771dfc20c7fe511e28133e1041d0f118ecbcd",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-10.jpg",
    "imageSha256": "cb5be04dc14343d196f932168c2d912b65e0e052f634577b7337f7bb35c452cf",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-10.mp3",
    "audioSha256": "e0091cba1012f6e0d054e7d29fa3c50e7a4036e5a4edd047e30738d232962451",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 11,
    "source": [
      "There are two broad ways to process seed.",
      "Dry seed matures in a pod, head or cob. It is collected when fully mature.",
      "Seed inside a fleshy fruit must first be separated from the flesh.",
      "Brief fermentation is especially useful for tomato seed. It is not a rule for every wet-seeded crop.",
      "Think about the crops in your area. Which fit the dry method? Which fit the wet method?",
      "If you have seed or fruit nearby, sort the examples into these two types. Explain the difference by describing what the seed is like at harvest."
    ],
    "recordedTarget": [
      "Kunezindlela ezimbili ezibanzi zokulungisa imbewu.",
      "Imbewu eyomile ivuthwa emgodleni, ekhanda noma esikhwebini. Iqoqwa lapho isivuthwe ngokuphelele.",
      "Imbewu engaphakathi kwesithelo esinenyama kufanele iqale ihlukaniswe nenyama.",
      "Ukubilisa kancane kusiza kakhulu embewini katamatisi. Akuwona umthetho wazo zonke izitshalo ezinembewu emanzi.",
      "Cabanga ngezitshalo zasendaweni yakho. Yiziphi ezihambisana nendlela eyomile? Yiziphi ezihambisana nendlela emanzi?",
      "Uma unembewu noma izithelo eziseduze, zihlukanise zibe yilezi zinhlobo ezimbili. Chaza umehluko ngokuthi imbewu injani ngesikhathi sokuvuna."
    ],
    "sourceHeading": "Dry and Wet Processing",
    "registeredEnglishTitle": "Dry and Wet Processing",
    "registeredZuluTitle": "Indlela Eyomile Nendlela Emanzi",
    "sourceHash": "98ae47ac8c5dc58466f00ff9b1faf0bed9ef59baff4914190ebb240971fc5f83",
    "targetHash": "614640021e4c43af3ecb77a8b7a75662a3dda7a28867f336dc536d2a6ef58f93",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-11.jpg",
    "imageSha256": "de45199ba7754264b5184ae66235c0798b54f54bcc3f4c7706db784cfd18773d",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-11.mp3",
    "audioSha256": "af60cd544ffb58a67b4c0bd17025a3008a6f344f1412c621233942679596c526",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 12,
    "source": [
      "Leave dry-seeded crops on the plant until the seed is fully mature.",
      "Collect it before weather, birds or bursting pods take the harvest.",
      "Remove chaff and damaged seed.",
      "Then spread the clean seed in a single layer in moving air and shade.",
      "What tells you that dry seed is mature enough to collect?",
      "If you have a dry pod or seed head, handle it. Listen for the seed. Compare green, flexible plant material with brown, brittle material.",
      "Wait for maturity. For final drying, use shade and airflow."
    ],
    "recordedTarget": [
      "Shiya izitshalo ezinembewu eyomile kuze imbewu ivuthwe ngokuphelele.",
      "Qoqa ngaphambi kokuba isimo sezulu, izinyoni noma ukuqhuma kwemigodla kuthathe isivuno.",
      "Susa amakhoba nembewu eyonakele.",
      "Bese wendlala imbewu ehlanzekile ibe ungqimba olulodwa emthunzini lapho kuhamba umoya.",
      "Yini ekutshela ukuthi imbewu eyomile isivuthwe ngokwanele ukuthi iqoqwe?",
      "Uma unomgodla noma ikhanda lembewu elomile, libambe. Lalela umsindo wembewu. Qhathanisa inyama eluhlaza egobekayo neyinsundu ephukayo.",
      "Linda ukuvuthwa. Ekomiseni kokugcina, sebenzisa umthunzi nokuhamba komoya."
    ],
    "sourceHeading": "Process Dry Seed",
    "registeredEnglishTitle": "Process Dry Seed",
    "registeredZuluTitle": "Lungisa Imbewu Eyomile",
    "sourceHash": "b572d42c74895d6168cd31499146fc479d1505878d5c13b1d7e669c066009978",
    "targetHash": "e0cabb252cb5a8d5749292e349285863f5d3f0fbdfffe49dad07c0015affa4ec",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-12.jpg",
    "imageSha256": "c3df5b7815313b0522e455b6ee9ad5a57e499116ea51c7ed9ec0eb764fadd92b",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-12.mp3",
    "audioSha256": "96ae68ccd0f098b5bb63119aa9e3304bcc7262f8a5485eb7dd4c07398e4127f7",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 13,
    "source": [
      "Allow the seed to mature on the plant before collecting it.",
      "Watch how it is collected once mature. Chaff and debris are removed. Damaged seed is taken out.",
      "The clean seed is then spread in a single layer in moving air and shade.",
      "Follow the steps in order: mature, collect, clean, dry.",
      "Think about where you could carry out each part of this process."
    ],
    "recordedTarget": [
      "Vumela imbewu ivuthwe esitshalweni ngaphambi kokuyiqoqa.",
      "Buka ukuthi iqoqwa kanjani lapho isivuthiwe. Amakhoba nodoti kuyasuswa. Imbewu eyonakele iyakhishwa.",
      "Imbewu ehlanzekile ibe isendlalwa ibe ungqimba olulodwa emthunzini lapho kuhamba umoya.",
      "Zilandelele ngokulandelana lezi zinyathelo: vuthwa, qoqa, hlanza, yomisa.",
      "Cabanga ukuthi iyiphi ingxenye yale nqubo ongayenza endaweni yakho."
    ],
    "sourceHeading": "Watch: Dry Processing",
    "registeredEnglishTitle": "Watch: Dry Processing",
    "registeredZuluTitle": "Buka: Indlela Eyomile",
    "sourceHash": "609caffd7f3badb6d172c395987fa25e5b45f152b1e09d5a61ff7c1c632f3513",
    "targetHash": "ce21c4f3dec8d2aeca7e5f5a72e5a7f59bbc82046445f5321a64e47d4f2d08ef",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-13.jpg",
    "imageSha256": "0f483956f1f71da4708dcabfc02eac8bc5d385dcddaca9d3799a8d9bda4753a1",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-13.mp3",
    "audioSha256": "2b8e375246cff7cc5235e563d12afe4981d17455c2e19db1d59165dfad1532ab",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 14,
    "source": [
      "Scoop tomato seed and flesh into a clean jar with a little water.",
      "Leave it open or loosely covered. Keep it out of direct sun.",
      "After two to three days, a light film and a sour smell may appear.",
      "Rinse promptly. Remove debris. Then spread the clean seed thinly to dry.",
      "Do not seal an actively fermenting jar.",
      "Think about the signs that tell you the process has begun. Also think about signs that would make you discard the batch.",
      "Find a jar, a sieve and a drying plate. When you are ready, start a small batch. Remember the order: scoop, ferment briefly, rinse and dry completely."
    ],
    "recordedTarget": [
      "Kha imbewu katamatisi nenyama uyifake embizeni ehlanzekile namanzi amancane.",
      "Yishiye ivulekile noma imbozwe ngokuxega. Ingabi selangeni eliqondile.",
      "Emva kwezinsuku ezimbili kuya kwezintathu kungavela ulwelwesi oluncane nephunga elimuncu.",
      "Hlambulula ngokushesha. Susa udoti. Bese wendlala imbewu ehlanzekile ibe mncane ukuze yome.",
      "Ungavali imbiza esabilayo.",
      "Cabanga ngezimpawu ezikutshela ukuthi inqubo isiqalile. Cabanga nangezimpawu ezingenza ulahle iqoqo.",
      "Thola imbiza, isisefo nepuleti lokomisa. Uma usukulungele, qala iqoqo elincane. Khumbula ukulandelana: kha, bilisa kancane, hlambulula, bese womisa ngokuphelele."
    ],
    "sourceHeading": "Wet Processing for Tomato Seed",
    "registeredEnglishTitle": "Wet Processing for Tomato Seed",
    "registeredZuluTitle": "Indlela Emanzi Katamatisi",
    "sourceHash": "1ab161426c4a5eaed6ed015c13040711de7b99ad99b4b3fabdb763415b5b3afb",
    "targetHash": "b9c1b106f4b3d559fe51ae445b96cfadba4e24bf70e7fa73f4750691d7bb3680",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-14.jpg",
    "imageSha256": "128ad9e11f0642ea18c3bcc65da5c93fffde40a35abbd2be0d98381d37e973e6",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-14.mp3",
    "audioSha256": "5e9a715e3576c31df4afd7547b854512083a910e2963e48db1c4c0079c932a2e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 15,
    "source": [
      "Watch the whole process in order.",
      "A ripe tomato is opened. The seed and gel are scooped into a clean jar. Only a little water is added.",
      "The jar is left open or loosely covered for two to three days.",
      "When a light film and sour smell appear, the contents are poured through a sieve. The seed is rinsed until it is clean.",
      "Finally, the seed is spread in a single layer in the shade until completely dry.",
      "Repeat the steps to yourself: scoop, ferment briefly, rinse, dry completely."
    ],
    "recordedTarget": [
      "Buka yonke inqubo ngokulandelana.",
      "Utamatisi ovuthiwe uyavulwa. Imbewu nejeli kukhelwa embizeni ehlanzekile. Kufakwa amanzi amancane kuphela.",
      "Imbiza ishiywa ivulekile noma imbozwe ngokuxega izinsuku ezimbili kuya kwezintathu.",
      "Lapho kuvela ulwelwesi oluncane nephunga elimuncu, okuqukethwe kuthelwa ngesisefo. Imbewu iyahlanzwa kuze kusale ehlanzekile.",
      "Ekugcineni, imbewu yendlalwa ibe ungqimba olulodwa emthunzini ukuze yome ngokuphelele.",
      "Phinda izinyathelo kuwe: kha, bilisa kancane, hlambulula, yomisa ngokuphelele."
    ],
    "sourceHeading": "Watch: Wet Processing for Tomato Seed",
    "registeredEnglishTitle": "Watch: Wet Processing for Tomato Seed",
    "registeredZuluTitle": "Buka: Indlela Emanzi Katamatisi",
    "sourceHash": "d757560c01f0b09446ae5dce280c611bbd3b84dd706c01a0d3fea538d675303f",
    "targetHash": "006a65624469eb322341f8d837a4b959a72e6d2341480ad49c82bed6c6a49921",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-15.jpg",
    "imageSha256": "a0549454df9da70bcbe0bf24221e5a2e61c3a5386bd91819189285478c73573d",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-15.mp3",
    "audioSha256": "716a94ffb9b96a6bc38d3ab85cccb086287a162028384cf042e341457696ef06",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 16,
    "source": [
      "This is where the lesson leaves the screen and reaches your hands.",
      "Start one real batch of wet-processed seed.",
      "Use one ripe, healthy fruit, a clean jar, a spoon, a little water, a sieve and a drying plate.",
      "Put the seed, flesh and a little water into the jar. Add a label with the date.",
      "You will look after this jar after the lesson. Decide now when you will inspect it, when you will rinse it and when you will dry the seed.",
      "Your jar needs a date and a return plan. Write down the date when you will inspect it after two days."
    ],
    "recordedTarget": [
      "Yilapho isifundo siphuma khona esikrinini siye ezandleni zakho.",
      "Qala iqoqo elilodwa langempela lembewu emanzi.",
      "Sebenzisa isithelo esivuthiwe nesinempilo, imbiza ehlanzekile, isipuni, amanzi amancane, isisefo nepuleti lokomisa.",
      "Faka imbewu, inyama namanzi amancane embizeni. Beka ilebula enosuku.",
      "Nguwe ozobhekana nale mbiza emva kwalesi sifundo. Khetha manje ukuthi uzoyibheka nini, uyihlambulule nini futhi uyomise nini imbewu.",
      "Imbiza yakho kufanele ibe nosuku nohlelo lokubuya. Bhala usuku ozoyibheka ngalo emva kwezinsuku ezimbili."
    ],
    "sourceHeading": "Practical Activity",
    "registeredEnglishTitle": "Practical Activity",
    "registeredZuluTitle": "Umsebenzi Wokwenza",
    "sourceHash": "1e5c94d9bb3ce39ed56e826f1c0a89f9bab8af28084ad2a774516d8be5099882",
    "targetHash": "d8878251d2c073795bcb239d85ad2becb5315e06a3459ffb9a2193b3a168ff9f",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-16.jpg",
    "imageSha256": "dd336e2bf5e7f72945b0c2b2004a0382f6a37c79da7d42b22721e7d039bb6bfa",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-16.mp3",
    "audioSha256": "94cea58275eeb32afa5594f380220f768c0947c5c8c407116c1dced4581a8426",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 17,
    "source": [
      "Drying is not a decorative final step.",
      "Moist seed keeps breathing. It can heat, rot or die in storage.",
      "Use shade, moving air and time.",
      "Seal seed only when you are sure it is dry.",
      "Which place in your home has shade and airflow, but is protected from rain and cooking steam?",
      "Choose one safe drying place. Then identify one unsafe place.",
      "Repeat this to check your understanding: dry first, seal later."
    ],
    "recordedTarget": [
      "Ukomisa akusona isinyathelo sokuhlobisa ekugcineni.",
      "Imbewu emanzi iyaqhubeka nokuphefumula. Ingashisa, ibole noma ife lapho igcinwe.",
      "Sebenzisa umthunzi, umoya ohambayo nesikhathi.",
      "Vala imbewu kuphela uma uqinisekile ukuthi yomile.",
      "Iyiphi indawo ekhaya lakho enomthunzi nokuhamba komoya, kodwa engenayo imvula noma isitimu sokupheka?",
      "Khetha indawo eyodwa ephephile yokomisa. Bese ukhomba indawo eyodwa engaphephile.",
      "Phinda lokhu ukuze uzihlole: yomisa kuqala, vala kamuva."
    ],
    "sourceHeading": "Dry First, Seal Later",
    "registeredEnglishTitle": "Dry First, Seal Later",
    "registeredZuluTitle": "Yomisa Kuqala, Vala Kamuva",
    "sourceHash": "831d2ab543914a268c9ca1ca7caa75a15e50a979e758ebee2a124831ab85fbf8",
    "targetHash": "dfd3f3ea26fcb7ece57d7383b099f0da8cce4c44806c9786eb1b98b200910d8a",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-17.jpg",
    "imageSha256": "0e396ce087c158e3bf03dfd51a900f6e07336bd3fea493295963ce794a9749b1",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-17.mp3",
    "audioSha256": "22591fdea7edb9c2291de13014e15da1c8d288057ca6794bea72897bee093b74",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 18,
    "source": [
      "Paper packets breathe and organise seed. But they are not enough in a humid climate.",
      "Once the seed is completely dry, place the labelled packets inside a sealed, moisture-proof container. If available, include a food-safe desiccant.",
      "Keep the container as cool and dark as possible in your home.",
      "Which room or cupboard in your home stays coolest and driest?",
      "Compare a paper envelope on its own with an envelope inside a sealed container.",
      "Safe storage has two layers: a labelled paper packet inside a dry, sealed container."
    ],
    "recordedTarget": [
      "Amaphakethe ephepha ayaphefumula futhi ahlele imbewu. Kodwa awanele esimweni sezulu esinomswakama.",
      "Uma imbewu seyome ngokuphelele, faka amaphakethe anamalebula esitsheni esivaliwe esingangenwa umswakama. Uma unakho, sebenzisa isomisi esiphephile ekudleni.",
      "Gcina isitsha sipholile futhi sisemnyama ngangokunokwenzeka ekhaya.",
      "Iliphi igumbi noma ikhabethe ekhaya lakho elihlala lipholile futhi lome kakhulu?",
      "Qhathanisa imvilophu yephepha yodwa nemvilophu engaphakathi kwesitsha esivaliwe.",
      "Indlela ephephile inezingqimba ezimbili: iphakethe lephepha elinelebula ngaphakathi kwesitsha esomile esivaliwe."
    ],
    "sourceHeading": "Protect Seed from Heat, Light and Moisture",
    "registeredEnglishTitle": "Protect Seed from Heat, Light and Moisture",
    "registeredZuluTitle": "Vikela Imbewu Ekushiseni, Ekukhanyeni Nakwumswakama",
    "sourceHash": "fc9c199381453343fb7768af571ef179c78ebb4d88621f0e254c51cf6c895026",
    "targetHash": "541e1174a3874c43bbba56a381393a1783f260858c7e6f21edaa434ec2f97ad8",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-18.jpg",
    "imageSha256": "567f7ee1de14aa2535970d9275c3377960948eeea769f7689199e824bf6be24e",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-18.mp3",
    "audioSha256": "4fee383f8ced5f41bdc16f4dacc15bcca52ccf1088571952761107dea154577a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 19,
    "source": [
      "Storage protects the seed physically. Written information protects its meaning.",
      "The packet must tell the next person what crop it is.",
      "It must give the variety or local name.",
      "It must say when the seed was saved and where it came from.",
      "Which local names could be lost if you write only the crop name?",
      "Take a blank packet. Practise writing the four pieces of information: crop, variety or local name, date and source.",
      "Check again that all four are present."
    ],
    "recordedTarget": [
      "Ukugcina kuvikela imbewu ngokomzimba. Ulwazi olubhaliwe luvikela incazelo yayo.",
      "Iphakethe kufanele litshele umuntu ozotshala ukuthi yisiphi isitshalo.",
      "Kufanele lisho uhlobo noma igama lendawo.",
      "Kufanele lisho ukuthi imbewu yalondolozwa nini nokuthi yavela kuphi.",
      "Yimaphi amagama endawo angalahleka uma ubhala igama lesitshalo kuphela?",
      "Thatha iphakethe elingenalutho. Zijwayeze ukubhala izingxenye ezine zolwazi: isitshalo, uhlobo noma igama lendawo, usuku nomthombo.",
      "Bheka futhi ukuthi zonke izingxenye ezine zikhona."
    ],
    "sourceHeading": "Label Every Packet",
    "registeredEnglishTitle": "Label Every Packet",
    "registeredZuluTitle": "Bhala Imininingwane Ephaketheni",
    "sourceHash": "177050a37db8ae42288f4fabef8bfe6fe3cc4369244356524ad028b65cb8bca1",
    "targetHash": "9ac0b36227b03a072c7eed495ee870046c563fd6635f5404a36dae29b6da7a90",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-19.jpg",
    "imageSha256": "9ce2943c41c8579a547d221bce31f122c16ef971ca759c16ffcb966d099ebb74",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-19.mp3",
    "audioSha256": "11713e6e6c322ff20440b03e75f8631978bf2edb5b1d40f57445bc6c14065e52",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 20,
    "source": [
      "A seed packet can look perfect even when the seed is losing life.",
      "Ten seeds make the calculation easy.",
      "Keep them warm and moist. Do not submerge them in water.",
      "Then count the normal seedlings.",
      "Six out of ten is about sixty percent. That tells you to sow more heavily, use the seed only as a trial, or replace it.",
      "If eight seeds out of ten germinate, what percentage is that?",
      "The answer is eighty percent.",
      "Start a ten-seed test with an old packet. Write down the date and the day when you will count."
    ],
    "recordedTarget": [
      "Iphakethe lembewu lingabukeka liphelele, kodwa imbewu ibe ilahlekelwa ukuphila.",
      "Imbewu eyishumi yenza ukubala kube lula.",
      "Yigcine ifudumele futhi imanzi. Ungayicwilisi emanzini.",
      "Bese ubala amahlumela ajwayelekile.",
      "Okuyisithupha kokuyishumi cishe kungamaphesenti angamashumi ayisithupha. Lokho kukutshela ukuthi utshale kakhulu, usebenzise imbewu njengokuhlola kuphela, noma uyishintshe.",
      "Uma imbewu eyisishiyagalombili kokuyishumi ihluma, singamaphesenti amangaki?",
      "Impendulo ingamaphesenti angamashumi ayisishiyagalombili.",
      "Qala ukuhlolwa kwembewu eyishumi ngephakethe elidala. Bhala usuku nangesikhathi ozobala ngaso."
    ],
    "sourceHeading": "Ten-Seed Germination Test",
    "registeredEnglishTitle": "Ten-Seed Germination Test",
    "registeredZuluTitle": "Hlola Ukuhluma Kwembewu Eyishumi",
    "sourceHash": "be9f39f4c5a8ce21f99b65308949ce103d52e6d4eefeb34cb4d0462b8dc6dd2c",
    "targetHash": "2449a1248a0480a73cd7db8358e90501a11cfd9940ec58dcae5c989d91b1d172",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-20.jpg",
    "imageSha256": "ec040d93218952255f5445cf4fc046cb6554c125aa45361d0330adbe7df3b00f",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-20.mp3",
    "audioSha256": "084c4f6482167aee135a1db94c9629133ae8abbfd2291b518e6ab8ec77414775",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 21,
    "source": [
      "Count exactly ten seeds.",
      "Place them in two rows of five.",
      "Keep them on moist paper or cloth. Do not submerge them in water.",
      "After some time, count again.",
      "Here, six have germinated. Four have not. The total is still ten.",
      "The germination rate is therefore sixty percent.",
      "Check yourself. Did you count ten at the start, six germinated seeds and four ungerminated seeds at the end?"
    ],
    "recordedTarget": [
      "Bala imbewu eyishumi ngokuqondile.",
      "Yibeke emigqeni emibili enezinhlamvu ezinhlanu.",
      "Yigcine ephepheni noma endwangwini emanzi. Ungayicwilisi emanzini.",
      "Emva kwesikhathi, bala futhi.",
      "Lapha kuhlume eziyisithupha. Ezine azihlumi. Ingqikithi iseyishumi.",
      "Ngakho izinga lokuhluma lingamaphesenti angamashumi ayisithupha.",
      "Zihlole. Ingabe ubale eziyishumi ekuqaleni, eziyisithupha ezihlumile nezine ezingahlumile ekugcineni?"
    ],
    "sourceHeading": "Watch: Ten-Seed Germination Test",
    "registeredEnglishTitle": "Watch: Ten-Seed Germination Test",
    "registeredZuluTitle": "Buka: Ukuhlolwa Kwembewu Eyishumi",
    "sourceHash": "9288cf75aa3d204c3f8f5ab40c051b74137c7bbe3ab1c5478728614b2bdc141a",
    "targetHash": "f63c15a12efb10f128f4764a4cd7a5775546e7a5c3dabc17f49aabf24f8a3e7c",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-21.jpg",
    "imageSha256": "23263f144ba999b0f8ea1bd84ba4649b936f995ead13ad50b6c60ae9149a8aba",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-21.mp3",
    "audioSha256": "5c132b22efa4727a2bdd5894a7057b744027393d5a7ea891f2ea30c1b2a12c0c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 22,
    "source": [
      "A seed exchange is not a table of unknown packets.",
      "A good exchange moves information with the seed.",
      "It tells you what the seed is. Where it came from. When it was saved. And whether it has been tested.",
      "This honesty strengthens the whole network.",
      "What information would help you trust seed from another household?",
      "Take one of your packets. Practise describing it before sharing it. Give the seed and its basic history together."
    ],
    "recordedTarget": [
      "Ukushintshisana ngembewu akulona itafula lamaphakethe angaziwa.",
      "Ukushintshisana okuhle kuhambisa ulwazi kanye nembewu.",
      "Kusho ukuthi imbewu iyini. Ivela kuphi. Yalondolozwa nini. Nokuthi isihloliwe yini.",
      "Lobu buqotho buqinisa yonke inethiwekhi.",
      "Yiluphi ulwazi olungakwenza wethembe imbewu evela kwelinye ikhaya?",
      "Thatha elinye lamaphakethe akho. Zijwayeze ukulichaza ngaphambi kokwabelana ngalo. Yisho imbewu nomlando wayo oyisisekelo."
    ],
    "sourceHeading": "Share Seed with Its Information",
    "registeredEnglishTitle": "Share Seed with Its Information",
    "registeredZuluTitle": "Yabelana Ngembewu Kanye Nolwazi",
    "sourceHash": "7ccd02e8fa046ff1a630688b71b7cb6ca64395323d228ae546255f1625dfd477",
    "targetHash": "c217f4869d07f9787d6b4f46543c2a13e1295046df0114f1f7a6a3e5a3ee40c2",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-22.jpg",
    "imageSha256": "5cb0b52186b80d2e471e892772dfd4c4bfaa3cc5165ffa568bcebb3eb5c292a2",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-22.mp3",
    "audioSha256": "82c179e39086dd0e7bfedc3f971b61a665caed2d96e1a0aa8b296d5850e4bc22",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 23,
    "source": [
      "This task is small enough to finish. It is important enough to matter.",
      "Build one working seed-storage container.",
      "Put labelled paper packets inside a dry, sealed container.",
      "Take a photograph of it.",
      "Then name the crop whose seed you will save this season.",
      "The photograph is evidence. The packet is a beginning.",
      "What do you still need to finish this at home?",
      "Write a short materials list. Choose a completion date.",
      "Before sealing the container, check your work: the seed is completely dry; every packet has the crop, variety and date; the container is cool, dark and protected from moisture; and you selected several healthy parent plants."
    ],
    "recordedTarget": [
      "Lo msebenzi mncane ngokwanele ukuthi uqedwe. Futhi ubalulekile ngokwanele ukuthi ube nomthelela.",
      "Yakha isitsha esisodwa sokugcina imbewu esisebenzayo.",
      "Faka amaphakethe ephepha anamalebula ngaphakathi kwesitsha esomile esivaliwe.",
      "Sithathe isithombe.",
      "Bese usho isitshalo ozolondoloza imbewu yaso kule sizini.",
      "Isithombe siwubufakazi. Iphakethe liyisiqalo.",
      "Yini osayidinga ukuze uqede lokhu ekhaya?",
      "Bhala uhlu olufushane lwezinto. Khetha usuku lokuqeda.",
      "Ngaphambi kokuvala isitsha, zihlole: imbewu yome ngokuphelele; iphakethe linegama, uhlobo nosuku; isitsha sipholile, simnyama futhi sivikelekile kumswakama; futhi ukhethe izitshalo zabazali eziningana ezinempilo."
    ],
    "sourceHeading": "Field Assignment",
    "registeredEnglishTitle": "Field Assignment",
    "registeredZuluTitle": "Umsebenzi Wasensimini",
    "sourceHash": "9f28bb97d8a3b40e5daa256392fe19b423a3965222af68c8b72337a69e21c659",
    "targetHash": "7a78675d7cdcac09d48c4e13f6efadecc05b9b302fb9e3633a76ab3f07785028",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-23.jpg",
    "imageSha256": "09de5e376677f3a416ec09e5cfc4f06a477453d28f5f8b4fc8485db551f3e888",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-23.mp3",
    "audioSha256": "84462f50021f82851adbb16486fd54eb54cc577c68fde1fc19f76b2a27a24b03",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 24,
    "source": [
      "Select.",
      "Process.",
      "Protect.",
      "Verify.",
      "Those four actions carry a seed collection from this field into the next season.",
      "Begin with one crop and do it well.",
      "Which crop will you begin with?",
      "Say it aloud. Then choose one action you will take next.",
      "The next season is already inside the seed you choose today."
    ],
    "recordedTarget": [
      "Khetha.",
      "Lungisa.",
      "Vikela.",
      "Qinisekisa.",
      "Lezo zenzo ezine zithwala uhlu lwembewu kusukela kule nsimu ziye kwisizini elandelayo.",
      "Qala ngesitshalo esisodwa futhi ukwenze kahle.",
      "Yisiphi isitshalo ozoqala ngaso?",
      "Sisho ngokuzwakalayo. Bese ukhetha isenzo esisodwa ozosenza ngokulandelayo.",
      "Isizini elandelayo isivele ingaphakathi kwembewu oyikhetha namuhla."
    ],
    "sourceHeading": "Field Action",
    "registeredEnglishTitle": "Field Action",
    "registeredZuluTitle": "Isenzo Sasensimini",
    "sourceHash": "847fbfdd47b41e461021fbb6490f4ff362d3c570ef81bcf6ba5d39b2abe46594",
    "targetHash": "d73e599ecbe870ccccce2ec7c4942ed6809b96f24baea822e5b8b3b7a966939a",
    "imageUrl": "/course-decks/seeds-sovereignty/zu/slide-24.jpg",
    "imageSha256": "cb020d4e0388e05012798dd0f93a894c543539d9175e872d760a3c2b9adc10dc",
    "audioUrl": "/course-audio/seeds-sovereignty/zu/slide-24.mp3",
    "audioSha256": "f7bf310de78e6851de516c09f572e734f76b362affd13ade8298a492596e45e2",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 1,
    "source": [
      "Small livestock integration turns chickens, ducks, and bees into working parts of the farm.",
      "Learn how animals can control pests, build fertility, support pollination, and return value to the soil.",
      "Use the system you already have: food, manure, flowers, grazing, and careful movement across the land."
    ],
    "recordedTarget": [
      "Ukuhlanganisa imfuyo encane kwenza izinkukhu, amadada, nezinyosi kube izingxenye ezisebenzayo zepulazi.",
      "Funda ukuthi izilwane zingalawula izinambuzane, zakhe ukuvunda, zisize ukuthuthwa kwempova, futhi zibuyisele inani enhlabathini.",
      "Sebenzisa uhlelo osunalo: ukudla, umquba, izimbali, amadlelo, nokuhamba ngokucophelela kuyo yonke indawo."
    ],
    "sourceHeading": "Small Livestock Integration",
    "registeredEnglishTitle": "Small Livestock Integration",
    "registeredZuluTitle": "Ukuhlanganiswa Kwemfuyo Encane",
    "sourceHash": "2a55afd111c4c145c56558b0bc42f1e2e3a194f05cbc89b832cdb282babacdf2",
    "targetHash": "8a15d0d7dc69d67c98a624e3401e298949cf4d358e06ffcfde19b4ede1784ddf",
    "imageUrl": "/course-decks/small-livestock/zu/slide-01.jpg",
    "imageSha256": "60ed1f3e8d61463e5131917de0a4fb61cb5be8284f490f49d0ac105a753bf3ee",
    "audioUrl": "/course-audio/small-livestock/zu/slide-01.mp3",
    "audioSha256": "7c493a7b2951aabdb95ace2e635f97e805197db7eadf796a222eaa4f22bc6e9d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 2,
    "source": [
      "Small livestock can do work beyond producing meat, eggs, or honey.",
      "Chickens eat some insects and weed seeds. Their manure can become compost.",
      "Ducks scratch less than chickens, but can still damage plants.",
      "Bees and other pollinators help many crops. Each animal still needs suitable food, water, shelter and care."
    ],
    "recordedTarget": [
      "Imfuyo encane ingenza okunye ngaphandle kokukhiqiza inyama, amaqanda noma uju.",
      "Izinkukhu zidla ezinye izinambuzane nembewu yokhula. Umquba wazo ungenziwa i-compost.",
      "Amadada awaklwebhi njengezinkukhu, kodwa nawo angalimaza izitshalo.",
      "Izinyosi nezinye izinambuzane ezithutha impova zisiza izitshalo eziningi. Isilwane ngasinye sisadinga ukudla okufanele, amanzi, indawo yokukhosela nokunakekelwa."
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "5ed5beb5748edec81c4df35db948d52734b7814c91a597d3c0fa2ec4bcb7299e",
    "targetHash": "d2801b0d9bf4e2ec3501aed3a6b6f651d818501675adabe059ead23bc4725654",
    "imageUrl": "/course-decks/small-livestock/zu/slide-02.jpg",
    "imageSha256": "ed90d62d93b708e251c43fd21f6e8cf2b3a77582f5034ae8183c10d5c911af50",
    "audioUrl": "/course-audio/small-livestock/zu/slide-02.mp3",
    "audioSha256": "95ea54938adc595deb46ac403e42209ab14ebe690358d6c341fc25fefd36a50c",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 3,
    "source": [
      "By the end of this module, you will understand how chickens, ducks, bees, and guinea fowl fit into a working system.",
      "You will know when chickens help a bed, and when their scratching can cause damage.",
      "You will understand pollination, hive placement, and how livestock move nutrients around a farm."
    ],
    "recordedTarget": [
      "Ekupheleni kwalesi sifundo, uzokwazi ukuthi izinkukhu, amadada, izinyosi, ne-guinea fowl zingena kanjani ohlelweni olusebenzayo.",
      "Uzokwazi ukuthi izinkukhu zisiza nini umbhede, nokuthi ukuklwebha kwazo kungadala nini umonakalo.",
      "Uzoqonda ukuthuthwa kwempova, ukubekwa kwe-hive, nokubaluleka kokuvala imijikelezo yezakhamzimba."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "f63633666255c2362036e5eb7a10b30a73cf453e127b44dbe5af5cd9df993e91",
    "targetHash": "4b214a6ae6d67dd1b3bb414ef75780651f12c0144ba593fd353cd96bf2138a62",
    "imageUrl": "/course-decks/small-livestock/zu/slide-03.jpg",
    "imageSha256": "57c2236d196049be0daf4bcd1f5389db2db5ae599430c74a57b8ceb9dda9696b",
    "audioUrl": "/course-audio/small-livestock/zu/slide-03.mp3",
    "audioSha256": "898c8aae2c281fb5e7aa5b50fda09099e318ca28601852a5c7f2c5194e3a3591",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 4,
    "source": [
      "Watch the hens peck at the ground among dry plant remains.",
      "Chickens may eat some insects and weed seeds. They still need balanced feed, clean water and shelter.",
      "Keep them away from seedlings and food ready to harvest."
    ],
    "recordedTarget": [
      "Buka izinkukhu zicosha ukudla phansi phakathi kwezinsalela ezomile zezitshalo.",
      "Izinkukhu zingadla ezinye izinambuzane nembewu yokhula. Zisadinga ukudla okunomsoco, amanzi ahlanzekile nendawo yokukhosela.",
      "Zigcine zikude nezithombo nokudla okulungele ukuvunwa."
    ],
    "sourceHeading": "Watch: Hens Foraging After Harvest",
    "registeredEnglishTitle": "Watch: Hens Foraging After Harvest",
    "registeredZuluTitle": "Buka: Izinkukhu Zicosha Phakathi Kwezinsalela Ngemva Kokuvuna",
    "sourceHash": "c45a063ebc890ada467a055140904d6827e90ec405388cee7d7a54807c584227",
    "targetHash": "82170637106e1627b3cc733452fb16eed73c33d9677fba9778d264452d7c265b",
    "imageUrl": "/course-decks/small-livestock/zu/slide-04.jpg",
    "imageSha256": "8a90b5bfedbe2367539b02c5d051de54c9c414180bdabaf1ac30e5fd73909fbb",
    "audioUrl": "/course-audio/small-livestock/zu/slide-04.mp3",
    "audioSha256": "309c060d15d234e0637b1e01677b221510f8775587b4a73eea817a57cba654e0",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 5,
    "source": [
      "Chickens can help an empty bed after harvest.",
      "They scratch through plant remains and eat some insects and weed seeds.",
      "Their manure and bedding can be composted and returned to the soil.",
      "Foraging does not replace a balanced diet, clean water, shelter or daily care."
    ],
    "recordedTarget": [
      "Izinkukhu zingasiza embhedeni ongenalutho ngemva kokuvuna.",
      "Ziklwebha izinsalela zezitshalo futhi zidle ezinye izinambuzane nembewu yokhula.",
      "Umquba wazo nezinto ezibekwa phansi ehhokweni kungenziwa i-compost ebuyiselwa enhlabathini.",
      "Ukuzifunela ukudla akuthathi indawo yokudla okunomsoco ofanele, amanzi ahlanzekile, indawo yokukhosela nokunakekelwa nsuku zonke."
    ],
    "sourceHeading": "Chickens Turn Scratching Into Useful Work",
    "registeredEnglishTitle": "Chickens Turn Scratching Into Useful Work",
    "registeredZuluTitle": "Ukuklwebha Kwezinkukhu Kungasiza",
    "sourceHash": "82182ac8cd1fb90798dab1e70a0a2b08387b8c2ed9ff12d4939ffb618cecd6c9",
    "targetHash": "398f53ae435400921dae856d969701f626a600c80f04823a24e52373197fa0ca",
    "imageUrl": "/course-decks/small-livestock/zu/slide-05.jpg",
    "imageSha256": "fe0ff8c7e320e1f8f4bf2261eb9d9fb1748af785c771cec582c40b5351cae62b",
    "audioUrl": "/course-audio/small-livestock/zu/slide-05.mp3",
    "audioSha256": "014637ea3fa0a7c6133630c014ae4a0649af3b8b7449791d8a332c1cc9256dbe",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 6,
    "source": [
      "Use chickens in an empty bed after harvest.",
      "Keep them away from seedlings and crops being harvested for food.",
      "Fresh manure can carry germs. Ask an extension adviser how to manage manure safely before the next crop.",
      "Move the birds before they damage the ground."
    ],
    "recordedTarget": [
      "Sebenzisa izinkukhu embhedeni ongenalutho ngemva kokuvuna.",
      "Zigcine zikude nezithombo nezitshalo ezivunelwa ukudliwa.",
      "Umquba omusha ungaba namagciwane. Buza umeluleki wezolimo ukuthi ungawusebenzisa kanjani ngokuphepha ngaphambi kwesivuno esilandelayo.",
      "Hambisa izinkukhu ngaphambi kokuba zilimaze umhlabathi."
    ],
    "sourceHeading": "Use Chickens at the Right Time",
    "registeredEnglishTitle": "Use Chickens at the Right Time",
    "registeredZuluTitle": "Sebenzisa Izinkukhu Ngesikhathi Esifanele",
    "sourceHash": "763c4186556c8b7b04e589377133022b42c89969b2141b3094a9d7b9c45ce484",
    "targetHash": "50ddac905d20c51070a2998793574f3ef0fcfdf0b51acc304a857eeabb81095c",
    "imageUrl": "/course-decks/small-livestock/zu/slide-06.jpg",
    "imageSha256": "f82b47de84d94426806802fce7fb9eb0a32ba718d76ad955061e23e095fdd7b9",
    "audioUrl": "/course-audio/small-livestock/zu/slide-06.mp3",
    "audioSha256": "998e6877143a6006caf05d8050563ce0f5d23cc897acac04e8ac604880424b1e",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 7,
    "source": [
      "Ducks eat slugs and snails without the heavy scratching of chickens.",
      "They may suit an established food forest understorey.",
      "They can still eat or trample plants and make wet ground muddy. Watch the birds and move them when needed.",
      "Provide clean water and suitable feed; foraging alone may not be enough."
    ],
    "recordedTarget": [
      "Amadada adla ama-slug neminenke ngaphandle kokuklwebha kakhulu njengezinkukhu.",
      "Angafaneleka phakathi kwezitshalo esezimile ngaphansi kwezihlahla ehlathini lokudla.",
      "Nawo angadla noma anyathele izitshalo, enze indawo emanzi ibe nodaka. Wabheke, uwahambise uma kudingeka.",
      "Wanike amanzi ahlanzekile nokudla okufanele. Ukuzifunela ukudla kuphela kungase kunganeli."
    ],
    "sourceHeading": "Ducks Suit Established Understorey",
    "registeredEnglishTitle": "Ducks Suit Established Understorey",
    "registeredZuluTitle": "Amadada Phakathi Kwezitshalo Esezimile",
    "sourceHash": "ea0b9007a50abcf608b90117829eb82e5a57268e51f8eeb99a1ddf525244792d",
    "targetHash": "2fa55028b184b0204ba9a71a21adbff147268947f4c9a547c7bf93bedb81a622",
    "imageUrl": "/course-decks/small-livestock/zu/slide-07.jpg",
    "imageSha256": "6e86608db72ee3f1b4d31e913ce49cc567c6727ecea4adba15d2467633b9f28c",
    "audioUrl": "/course-audio/small-livestock/zu/slide-07.mp3",
    "audioSha256": "bc9d7b6f7fd5e1ca290b3c91657f9cbc63192f2a3f9c0b1b53b64344a6ff37cc",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 8,
    "source": [
      "A chicken tractor is a moveable, floorless pen.",
      "Move it before the ground becomes bare, muddy or heavily covered with manure.",
      "The right time depends on the birds, soil and weather. Let the ground recover between visits.",
      "There is no single number of chickens that guarantees enough fertility for every plot."
    ],
    "recordedTarget": [
      "I-chicken tractor iyihhoko elihambayo elingenaphansi.",
      "Lihambise ngaphambi kokuba umhlabathi ube yize, ube nodaka noma ugcwale umquba kakhulu.",
      "Isikhathi esifanele sincike ezinkukhwini, enhlabathini nasesimweni sezulu. Vumela umhlabathi ululame ngaphambi kokubuyisa izinkukhu.",
      "Alikho inani elilodwa lezinkukhu eliqinisekisa ukuvunda okwanele kuzo zonke izingadi."
    ],
    "sourceHeading": "Rotate the Tractor Across the Plot",
    "registeredEnglishTitle": "Rotate the Tractor Across the Plot",
    "registeredZuluTitle": "Hambisa Ihhoko Endaweni",
    "sourceHash": "8f66431746b839ff2f01f6fdd3c49aca8354d0df1fbb569f4de4b8b5dd9fcaa5",
    "targetHash": "5187bb4a059895c2c6a10a2e8bc32cc6479767e51e664f5093526f7939cd9d2f",
    "imageUrl": "/course-decks/small-livestock/zu/slide-08.jpg",
    "imageSha256": "996fd6d08018455c2d37460395a898719929c845ab1700760505be0d1988b35e",
    "audioUrl": "/course-audio/small-livestock/zu/slide-08.mp3",
    "audioSha256": "756564929b5603c5bbefe94e32b798f2dc91f73dcb3885254a9bbadb7ea3c7c3",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 9,
    "source": [
      "Watch one bee move from one blossom to another.",
      "Bees can carry pollen as they visit flowers."
    ],
    "recordedTarget": [
      "Buka inyosi eyodwa isuka kwenye imbali iye kwenye.",
      "Izinyosi zingathwala impova lapho zivakashela izimbali."
    ],
    "sourceHeading": "Watch: A Bee Moves Between Two Blossoms",
    "registeredEnglishTitle": "Watch: A Bee Moves Between Two Blossoms",
    "registeredZuluTitle": "Buka: Inyosi Isuka Embalini Eyodwa Iya Kwenye",
    "sourceHash": "b99bc5ebb46d93800391dad7d33fe202402d171ffc28ebff426bb80145909074",
    "targetHash": "0715f0dc403ea1a6c75a45ceadc49cc1ae9276f84a8694c2b62adb6f84e23924",
    "imageUrl": "/course-decks/small-livestock/zu/slide-09.jpg",
    "imageSha256": "bf793a0d87a43eead23e9d4278afe0d30de5dbfd286d76a0a5a1335080cef089",
    "audioUrl": "/course-audio/small-livestock/zu/slide-09.mp3",
    "audioSha256": "b5a230f7d1f5f99a73be3d2941c443dc3218f820fd51f45abb366a5a097ca7a3",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 10,
    "source": [
      "Honeybees and other insects carry pollen between flowers.",
      "This helps many fruit and vegetable crops, including avocado. Different crops and varieties have different pollination needs.",
      "A hive does not guarantee higher yields everywhere. Weather, water, plant health and other pollinators also matter."
    ],
    "recordedTarget": [
      "Izinyosi zoju nezinye izinambuzane zithwala impova phakathi kwezimbali.",
      "Lokhu kusiza izitshalo eziningi zezithelo nemifino, kuhlanganise nokwatapheya. Izitshalo nezinhlobo zazo zinezidingo ezingafani zokuthuthwa kwempova.",
      "Ukuba ne-hive akuqinisekisi ukuthi isivuno sizokwanda yonke indawo. Isimo sezulu, amanzi, impilo yezitshalo nezinye izinambuzane ezithutha impova nakho kunendima."
    ],
    "sourceHeading": "Bees Help Pollinate Many Crops",
    "registeredEnglishTitle": "Bees Help Pollinate Many Crops",
    "registeredZuluTitle": "Izinyosi Zisiza Ekuthutheni Impova Ezitshalweni Eziningi",
    "sourceHash": "9216fabcc28bf337053f8bb88ad84c0b466b5532f30a5bbb449beb563e46075b",
    "targetHash": "2804d7c4f48136fdd3d1e06d35d56dfed0c5484675b21b6c39ce0670412c74e8",
    "imageUrl": "/course-decks/small-livestock/zu/slide-10.jpg",
    "imageSha256": "86171548710dd806b248092b7aa94fb10b156299295b48a28ca3be1bb6c0dda1",
    "audioUrl": "/course-audio/small-livestock/zu/slide-10.mp3",
    "audioSha256": "4eef96ce1f43a74f252f48c0e5c6c650a4558b28f65e03a51ebe58395f5a95bf",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 11,
    "source": [
      "South Africa has two native honeybee subspecies.",
      "The Cape honeybee is found in the Western Cape and parts of the Eastern Cape. The African honeybee is native to central and most of southern Africa.",
      "These broad natural ranges are not a guide for moving bees. The Department's control measures set a demarcation line for bee movement. Check current rules before moving bees or hives."
    ],
    "recordedTarget": [
      "INingizimu Afrika inezinhlobo ezimbili zezinyosi zoju zomdabu ezingaphansi kohlobo olulodwa.",
      "Inyosi yoju yaseKapa itholakala eNtshonalanga Kapa nasezingxenyeni zeMpumalanga Kapa. Inyosi yoju yase-Afrika idabuka enkabeni nasezingxenyeni eziningi zeningizimu ye-Afrika.",
      "Lezi izindawo ezibanzi ezivamile; aziyona imingcele yokuthi izinyosi zingahanjiswa kuphi. Imithetho yoMnyango ibeka umngcele olawula ukuhanjiswa kwezinyosi. Ngaphambi kokuhambisa izinyosi noma ama-hive, hlola imithetho yamanje noMnyango kanye nomfuyi wezinyosi wendawo onolwazi."
    ],
    "sourceHeading": "South Africa’s Native Honeybees",
    "registeredEnglishTitle": "South Africa’s Native Honeybees",
    "registeredZuluTitle": "Izinyosi Zoju Zomdabu ENingizimu Afrika",
    "sourceHash": "25ba00b9662e4842ec84316100c95d27d9067748725bd35cdd4ee87180eec827",
    "targetHash": "d44cb0d6a4e74275946b8e506e581b091a95257c31fa10746d0b616663776194",
    "imageUrl": "/course-decks/small-livestock/zu/slide-11.jpg",
    "imageSha256": "0d9b50186bd85ce13b01c4b38c10d875e69b7ee6019b071fd096e32be1ce9948",
    "audioUrl": "/course-audio/small-livestock/zu/slide-11.mp3",
    "audioSha256": "9495358f0078c81079275798f70c174f40d40d70367ead7db751248e9d0095fc",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 12,
    "source": [
      "Learn from an experienced local beekeeper before getting a hive.",
      "Keep hives away from busy paths, homes and places where children play.",
      "Morning sun can help, but a safe location comes first.",
      "Plan how people and animals will move around the site."
    ],
    "recordedTarget": [
      "Ngaphambi kokuthola i-hive, funda kumfuyi wezinyosi wendawo onolwazi.",
      "Beka ama-hive kude nezindlela ezihanjwa abantu abaningi, amakhaya nezindawo ezidlalwa kuzo izingane.",
      "Ilanga lasekuseni lingasiza, kodwa indawo ephephile iza kuqala.",
      "Hlela indlela abantu nezilwane abazohamba ngayo kule ndawo."
    ],
    "sourceHeading": "Place the Hive With Care",
    "registeredEnglishTitle": "Place the Hive With Care",
    "registeredZuluTitle": "Beka I-hive Ngokucophelela",
    "sourceHash": "b77fda7ca2a9f3867a15c3e7461d38558f85930c6dd78362ddc98513ea68ae11",
    "targetHash": "694255cf120ef9a183ea6615404f95b87029840ca8563ae3585caf615468f13a",
    "imageUrl": "/course-decks/small-livestock/zu/slide-12.jpg",
    "imageSha256": "c458a5a61bfd77ba89be3106b721ed45ba25b3bb77b40d8369631a96333cd899",
    "audioUrl": "/course-audio/small-livestock/zu/slide-12.mp3",
    "audioSha256": "1a71d8c7361e357c5806721fc422b835221ba47848f30ebb0b791b6e75587bfd",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 13,
    "source": [
      "Provide flowering plants through the seasons and avoid exposing bees to pesticides.",
      "Active bees do not prove that the farm is free of chemicals or disease.",
      "Registration is required for activities defined by the national honey-bee control measures. These include keeping managed hives for bee products, queen rearing, commercial pollination, and removing, eradicating or relocating colonies. Check with the Department if you are unsure whether your activity is covered.",
      "If a colony swarms repeatedly, ask a trained beekeeper to inspect it. Crowding is one possible cause, not a diagnosis."
    ],
    "recordedTarget": [
      "Hlinzeka ngezitshalo eziqhakaza ngezikhathi ezahlukene zonyaka, futhi ugweme ukubeka izinyosi engozini yezibulala-zinambuzane.",
      "Ukubona izinyosi zisebenza akufakazeli ukuthi ipulazi alinawo amakhemikhali noma izifo.",
      "Imithetho kazwelonke yokulawula izinyosi zoju idinga ukubhalisa emisebenzini ethile yokufuya izinyosi. Lokhu kuhlanganisa ukugcina ama-hive aphethwe ukuze kukhiqizwe imikhiqizo yezinyosi, ukukhulisa izindlovukazi, ukuhambisa impova ngokohwebo, nokususa, ukuqeda noma ukuhambisa ikoloni lezinyosi. Uma ungaqiniseki ukuthi umsebenzi wakho uyathinteka yini, buza uMnyango.",
      "Uma ikoloni liphuma ngamaqoqo kaningi, cela umfuyi wezinyosi oqeqeshiwe alihlole. Ukuminyana kungenye yezimbangela ezingaba khona; akusikho ukuxilongwa."
    ],
    "sourceHeading": "Strong Colonies Need Care and Flowers",
    "registeredEnglishTitle": "Strong Colonies Need Care and Flowers",
    "registeredZuluTitle": "Amakoloni Aqinile Adinga Ukunakekelwa Nezimbali",
    "sourceHash": "30c07c1777688e4d2ad4dac3b0245b3b27f7894a5fc9adbeb45bc4374cb6b1e1",
    "targetHash": "33421c077dd3d2613b42e249efe4b8b9edaa9a0b756a8a71b195343d7b3069e3",
    "imageUrl": "/course-decks/small-livestock/zu/slide-13.jpg",
    "imageSha256": "800d827be389a23c594a690082b2cb166117d7c249a19770e16c13c1eea5edf9",
    "audioUrl": "/course-audio/small-livestock/zu/slide-13.mp3",
    "audioSha256": "93da8a1ff7133c268651dfbbf4688a2ea6d3b6c03a8c493b0a2b5bf7480889a8",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 14,
    "source": [
      "Some nutrients move from plants to animals. Bought feed also brings nutrients into the farm. Some nutrients may return to the growing area through compost made from manure. Food and other products carry nutrients away."
    ],
    "recordedTarget": [
      "Ezinye izakhamzimba zisuka ezitshalweni ziye ezilwaneni. Ukudla kwezilwane okuthengwayo nakho kuletha izakhamzimba epulazini. Ezinye zingabuyela endaweni yokutshala nge-compost eyenziwe ngomquba. Ukudla neminye imikhiqizo kuthwala izakhamzimba kuziphume epulazini."
    ],
    "sourceHeading": "Nutrients Moving Through the Farm",
    "registeredEnglishTitle": "Nutrients Moving Through the Farm",
    "registeredZuluTitle": "Izakhamzimba Ezihamba Epulazini",
    "sourceHash": "f81b219ee2fb129d627f113fab2228f7e03f66ebd573ce9af8ed683f3868c496",
    "targetHash": "2fa0dfa3be6c961c5362e16c95ef0f64390179a82af7577026f21bc30acca3af",
    "imageUrl": "/course-decks/small-livestock/zu/slide-14.jpg",
    "imageSha256": "e269d20d78224b961e42427b2c8efa0279028a33362fe0fe69fa55cf72e6783f",
    "audioUrl": "/course-audio/small-livestock/zu/slide-14.mp3",
    "audioSha256": "aff28f59082f74ead41937eb2807db50c5ecab3ce2c66f1198bb0ae7cec1c457",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 15,
    "source": [
      "Animals can return some nutrients through compost made from manure. Fresh manure can carry harmful germs. Compost manure fully before using it around food crops.",
      "Chickens eat suitable farm produce and insects.",
      "Bought feed brings nutrients into the farm. Food sold or taken home and other products carry nutrients away. Keep track of feed bought in and food sold or taken home.",
      "Scraps alone may not meet the animals’ needs."
    ],
    "recordedTarget": [
      "Izilwane zingabuyisela ezinye izakhamzimba nge-compost eyenziwe ngomquba. Umquba omusha ungaba namagciwane ayingozi. Vumela umquba uvundiswe ngokuphelele ngaphambi kokuwusebenzisa ezitshalweni zokudla.",
      "Izinkukhu zidla ukudla okufanele okuvela epulazini nezinambuzane.",
      "Ukudla kwezilwane okuthengwayo kuletha izakhamzimba epulazini. Ukudla okuthengiswayo noma okuyiswa ekhaya neminye imikhiqizo kuthwala izakhamzimba kuziphume. Bhala phansi ukudla kwezilwane okuthengwayo nokudla okuthengiswayo noma okuyiswa ekhaya.",
      "Izinsalela zokudla kuphela zingase zinganelisi izidingo zezilwane."
    ],
    "sourceHeading": "Some Nutrients Return; Others Enter and Leave",
    "registeredEnglishTitle": "Some Nutrients Return; Others Enter and Leave",
    "registeredZuluTitle": "Ezinye Izakhamzimba Ziyabuya; Ezinye Ziyangena Futhi Ziphume",
    "sourceHash": "467c35e958e7be21dc687f7002b2aab061a0fb1588dd493b1aa1bd4023626d0a",
    "targetHash": "bd5ab7c2231a587904bd3e274a2ec0cd9efa0f636db876c4f3e944e10a618973",
    "imageUrl": "/course-decks/small-livestock/zu/slide-15.jpg",
    "imageSha256": "3d50ff5fb29dad11333462f3d896e4437f2c7b460b9941870bf4b14705a003f1",
    "audioUrl": "/course-audio/small-livestock/zu/slide-15.mp3",
    "audioSha256": "7b3d2cf50b462277bd1b8bb70b8e266df49f5e82b65b9d401785f18419eaf558",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 16,
    "source": [
      "Guinea fowl forage for insects and may eat ticks.",
      "Do not rely on them to protect people or livestock from ticks or tick-borne disease.",
      "Keep checking animals and follow a local animal-health plan.",
      "Foraging birds are one part of the farm, not a replacement for health care."
    ],
    "recordedTarget": [
      "Ama-guinea fowl azifunela izinambuzane futhi angadla imikhaza.",
      "Ungathembeli kuwo ukuvikela abantu noma imfuyo emikhazeni noma ezifweni ezithwalwa yimikhaza.",
      "Qhubeka uhlola izilwane, ulandele uhlelo lwezempilo yezilwane olufanele indawo yakini.",
      "Izinyoni ezizifunela ukudla ziyingxenye yepulazi, azithathi indawo yokunakekelwa kwezempilo."
    ],
    "sourceHeading": "Guinea Fowl Forage, but Health Checks Still Matter",
    "registeredEnglishTitle": "Guinea Fowl Forage, but Health Checks Still Matter",
    "registeredZuluTitle": "Ukuzifunela Ukudla Akuthathi Indawo Yokuhlola Impilo",
    "sourceHash": "d97aec7a0d2bec12e78ee34a94992bae9ff4c4363ab26904e66c8ceccc1120b4",
    "targetHash": "1eacc22a7808fa75b60fc17ea362a2966e8a0f7041fd15401421b89951070ade",
    "imageUrl": "/course-decks/small-livestock/zu/slide-16.jpg",
    "imageSha256": "bcc8598024d3c30d04f56e4f9fd6c3e87307f0aca404bbab16788c56ddcab034",
    "audioUrl": "/course-audio/small-livestock/zu/slide-16.mp3",
    "audioSha256": "bd82c7fa7e1170caa30aae67a2625ba5aa432817a5ee6fefd166d5081e260d60",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 17,
    "source": [
      "For each animal, ask what it can eat here.",
      "Ask what useful things it produces.",
      "Then ask what else it needs. Include water, suitable feed, shelter, fencing and daily care.",
      "Some needs may require bought inputs. Plan for them before bringing animals onto the land."
    ],
    "recordedTarget": [
      "Ngesilwane ngasinye, buza ukuthi singadlani lapha.",
      "Buza ukuthi sikhiqiza ziphi izinto eziwusizo.",
      "Bese ubuza ukuthi sidingani okunye. Faka amanzi, ukudla okufanele, indawo yokukhosela, ucingo nokunakekelwa nsuku zonke.",
      "Ezinye izidingo zingadinga izinto ezithengwayo. Zihlele ngaphambi kokuletha izilwane endaweni."
    ],
    "sourceHeading": "Ask Three Questions for Every Animal",
    "registeredEnglishTitle": "Ask Three Questions for Every Animal",
    "registeredZuluTitle": "Buza Imibuzo Emithathu Ngesilwane Ngasinye",
    "sourceHash": "4ad5214870029ffad99431001e4c62a0adb18ea01b45491a7f67923a74ce0431",
    "targetHash": "a25593b12104360affe5c654d4f340e2cb475433487ad36483dcaa889c0a1596",
    "imageUrl": "/course-decks/small-livestock/zu/slide-17.jpg",
    "imageSha256": "9e0f10d3994347f1a170181a3434da562f31c1a2bafa54fc674a737b5e188007",
    "audioUrl": "/course-audio/small-livestock/zu/slide-17.mp3",
    "audioSha256": "e60ada7d9d5742c483358d273b8ba1fbc4744c7ecb6460a9934614c9d45988df",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 18,
    "source": [
      "Chickens following goats are not a proven replacement for goat worm control.",
      "Grazing management can help, but goats still need health checks.",
      "Work with a veterinary or animal-health adviser on a parasite plan for your herd.",
      "Do not stop treatment because chickens have visited the grazing camp."
    ],
    "recordedTarget": [
      "Ukulandela kwezinkukhu ngemva kwezimbuzi akufakazeli ukuthi sezithatha indawo yokulawulwa kwezikelemu ezimbuzini.",
      "Ukuphatha amadlelo kungasiza, kodwa izimbuzi zisadinga ukuhlolwa kwezempilo.",
      "Sebenzisana nodokotela wezilwane noma umeluleki wezempilo yezilwane ukuhlela ukulawulwa kwezikelemu emhlambini wakho.",
      "Ungayeki ukwelapha ngenxa yokuthi izinkukhu bezikade zisekamu ledlelo."
    ],
    "sourceHeading": "Grazing and Goat Worm Control",
    "registeredEnglishTitle": "Grazing and Goat Worm Control",
    "registeredZuluTitle": "Amadlelo Nokulawulwa Kwezikelemu Ezimbuzini",
    "sourceHash": "39a739154daced8d5a437b09030d2f9c9c257145392451d9fdd8083643a260da",
    "targetHash": "9a56829887df798145bfde7bdcf3395cc0fe4f75a72a146589d82edeca56fb9c",
    "imageUrl": "/course-decks/small-livestock/zu/slide-18.jpg",
    "imageSha256": "4b62bc8d1bb2ca0e3962dd4caddc72b693cf4be8a935dd59d0ab9b06c4689b22",
    "audioUrl": "/course-audio/small-livestock/zu/slide-18.mp3",
    "audioSha256": "589c09b995475dbeeaa8b5d238619c128c2cb0472284a0f054d942c359c22c78",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 19,
    "source": [
      "Walk your smallholding and choose an area where livestock could support another part of the system.",
      "Record what food, scraps, pests, surplus produce, manure, or flowering resources are already present.",
      "Then note what each animal could produce, and what it would need from the farm.",
      "Draw one useful link between livestock and the rest of your farm. Show what comes in and what leaves."
    ],
    "recordedTarget": [
      "Hamba epulazini lakho elincane, ukhethe indawo lapho imfuyo ingase isekele enye ingxenye yohlelo.",
      "Bhala phansi ukudla, izinsalela, izinambuzane, umkhiqizo oweqile, umquba noma izimbali ezikhona kakade.",
      "Bese ubhala ukuthi isilwane ngasinye singakhiqizani, nokuthi sidingani epulazini.",
      "Dweba ukuxhumana okukodwa okuwusizo phakathi kwemfuyo nayo yonke ipulazi lakho. Bonisa okungenayo nokuphumayo."
    ],
    "sourceHeading": "Field Assignment: Draw Where Resources Go",
    "registeredEnglishTitle": "Field Assignment: Draw Where Resources Go",
    "registeredZuluTitle": "Umsebenzi Wensimu: Dweba Ukuthi Izinsiza Ziya Kuphi",
    "sourceHash": "c5fafebaa51b13b98b20b6bf63030c7c19b78a070af7000d20127313171af269",
    "targetHash": "e76413c1cc8b57b4b70af62d2f9e264f74ebd5937cf1859c7324dcee578f6395",
    "imageUrl": "/course-decks/small-livestock/zu/slide-19.jpg",
    "imageSha256": "d1a99d3cf337ae851847402964d980434b9af25b335b6a338a71d707d9166a11",
    "audioUrl": "/course-audio/small-livestock/zu/slide-19.mp3",
    "audioSha256": "f927e2936993d4de2fc732ae8ecd21830fda0e7eb6c41173a5950ad7fc41eed9",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "small-livestock",
    "slide": 20,
    "source": [
      "Choose one safe action from this module.",
      "Plan how chickens could use an empty bed after harvest, ask a beekeeper about a safe hive position, or check your animals’ daily needs.",
      "Record the food, water, shelter and care that the action requires.",
      "Start with the resources and help you can reliably provide."
    ],
    "recordedTarget": [
      "Khetha isenzo esisodwa esiphephile kulesi sifundo.",
      "Hlela ukuthi izinkukhu zingawusebenzisa kanjani umbhede ongenalutho ngemva kokuvuna, buza umfuyi wezinyosi ngendawo ephephile ye-hive, noma hlola izidingo zansuku zonke zezilwane zakho.",
      "Bhala ukudla, amanzi, indawo yokukhosela nokunakekelwa okudingekayo.",
      "Qala ngezinto nosizo ongakwazi ukukuhlinzeka njalo."
    ],
    "sourceHeading": "Field Action: Put One Link to Work",
    "registeredEnglishTitle": "Field Action: Put One Link to Work",
    "registeredZuluTitle": "Isenzo Esisodwa Epulazini",
    "sourceHash": "38f7f0af54b029f2be974fe13ce9dd89f647314f0af4c52121657a44ef12ae8e",
    "targetHash": "2bde08b117f3251ee64f38846ce2732a1379bc525687636ae260f09c92101b9a",
    "imageUrl": "/course-decks/small-livestock/zu/slide-20.jpg",
    "imageSha256": "f70d366cd49d3fb392eaec057a756de7c9b50f2e772626af8af02a7730f5e94f",
    "audioUrl": "/course-audio/small-livestock/zu/slide-20.mp3",
    "audioSha256": "9ba19ad4d52af2c3d4cd41d5479ff861bf810c43194b7bb8faecdc10ddd39ec6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 1,
    "source": [
      "Your garden gives food, income, and useful knowledge.",
      "This module shows how to keep records, sell surplus, and build local food networks.",
      "The aim is a farm that feeds the household and works as a small, clear economy."
    ],
    "recordedTarget": [
      "Ingadi yakho inikeza umndeni ukudla, imali, nolwazi oluwusizo.",
      "Kule module uzofunda ukugcina amarekhodi, ukuthengisa okusele, nokwakha amanethiwekhi okudla aseduze.",
      "Inhloso yipulazi elondla umuzi futhi lisebenze njengomnotho omncane ocacile."
    ],
    "sourceHeading": "Market Gardening & Community",
    "registeredEnglishTitle": "Market Gardening & Community",
    "registeredZuluTitle": "Ingadi Yezimakethe Nomphakathi",
    "sourceHash": "6b1433703dccbde312424fefd58879f103e353cfb27ecd79cb2762f80a4414ed",
    "targetHash": "f52d184232aed395eb1e9658c29b6b4bb9d78fff15628ea72e9fcf085ed5e6b2",
    "imageUrl": "/course-decks/market-community/zu/slide-01.jpg",
    "imageSha256": "127f302a34f3ab8ed1101ffb60889fd48134ea512d77507f67cf73b3c00d997b",
    "audioUrl": "/course-audio/market-community/zu/slide-01.mp3",
    "audioSha256": "a59a7e675f4f9ed17a696860063ba9323f2603ce1dc7a3191ad5f5b7eea76867",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 2,
    "source": [
      "A harvest can feed the household, be sold, be shared, or be lost.",
      "Recording these different uses helps you see what the farm produces and what reaches customers.",
      "Use that information to protect household food and make better business decisions."
    ],
    "recordedTarget": [
      "Isivuno singondla umuzi, sithengiswe, sabelwane ngaso noma silahleke.",
      "Ukubhala lezi zindlela esisetshenziswe ngazo kukusiza ubone ukuthi ipulazi likhiqiza ini nokuthi yini efinyelela kubathengi.",
      "Sebenzisa lolo lwazi ukuze uvikele ukudla komuzi futhi wenze izinqumo ezingcono zebhizinisi."
    ],
    "sourceHeading": "Why This Matters",
    "registeredEnglishTitle": "Why This Matters",
    "registeredZuluTitle": "Kungani Lokhu Kubalulekile",
    "sourceHash": "5c1c77f0857f5ec53d8fd7d7a32af44e2dd706ec106da85f6cc814e3d3d77973",
    "targetHash": "865666c2be059dcc08dd9b0b3dad1623d2af1965f16e05393d0d85dae74a387c",
    "imageUrl": "/course-decks/market-community/zu/slide-02.jpg",
    "imageSha256": "40f54d5e56ac5d891b9e68cde07ab28a4878c20206e71e16b9bc6ed32d53ba82",
    "audioUrl": "/course-audio/market-community/zu/slide-02.mp3",
    "audioSha256": "9f62e5f556e2a5ab2d3185d925a14f91f081030a644fcc327188e12de0966291",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 3,
    "source": [
      "By the end, you can record harvests and where they go.",
      "You can work out the true cost of production before setting a price.",
      "You can match surplus to a suitable customer or selling channel.",
      "You can build a local network for seeds, tools, skills, and food."
    ],
    "recordedTarget": [
      "Ekupheleni kwale module uzokwazi ukubhala isivuno nokuthi siyephi.",
      "Uzokwazi ukubala izindleko zangempela zokukhiqiza ngaphambi kokubeka inani lokuthengisa.",
      "Uzokwazi ukuqhathanisa okusele nomthengi noma nendlela efanele yokuthengisa.",
      "Uzokwazi ukwakha inethiwekhi yasendaweni yezimbewu, amathuluzi, amakhono, nokudla."
    ],
    "sourceHeading": "Learning Outcomes",
    "registeredEnglishTitle": "Learning Outcomes",
    "registeredZuluTitle": "Imiphumela Yokufunda",
    "sourceHash": "c0841678848e33c9141353efb855973b072fb4de8eb6935ff5841a2c82a3ace9",
    "targetHash": "b99cc512b1c291482825c42c52ab2d94364e7ef8f044c54a51b1342d619ef599",
    "imageUrl": "/course-decks/market-community/zu/slide-03.jpg",
    "imageSha256": "c0b1c1cd3d77b386b642353694af09785916d56e6ffe252abd2ce527a8509e0d",
    "audioUrl": "/course-audio/market-community/zu/slide-03.mp3",
    "audioSha256": "6ecafb8808d351c3d7794059b7f3350204a859a3ca9ecd9dbab34c29ca4c2ba6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 4,
    "source": [
      "The record follows each harvest to family food, sales, gifts, or compost.",
      "Read across the season to see the farm as an economy before making a business decision."
    ],
    "recordedTarget": [
      "Irekhodi lilandela isivuno esiya emndenini, ekuthengisweni, ekunikezweni noma ku-compost.",
      "Funda irekhodi lonke lesizini ukuze ubone ipulazi njengomnotho ngaphambi kwesinqumo sebhizinisi."
    ],
    "sourceHeading": "Watch: What the Farm Record Shows",
    "registeredEnglishTitle": "Watch: What the Farm Record Shows",
    "registeredZuluTitle": "Buka: Okuboniswa Irekhodi Lepulazi",
    "sourceHash": "128997babf7b0207a97ba3041d87bc3ea6f76d204de662d16a4cd8dc29dd4012",
    "targetHash": "b9ec46b44bd561ecdb22fe0a501ef8b1406def01afb0dc64b5633f41b6acf69b",
    "imageUrl": "/course-decks/market-community/zu/slide-04.jpg",
    "imageSha256": "3b25e3a0cc9ad2e13ff60ffb775bfca6ae688300aca1f36f8f23fd334b74e0b2",
    "audioUrl": "/course-audio/market-community/zu/slide-04.mp3",
    "audioSha256": "5278c244a4cc6b7d91b42c1bcea4248f976103c413412e07f93c6e76ba60b9d3",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 5,
    "source": [
      "Write down every harvest as it happens.",
      "Record kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.",
      "Use the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.",
      "Do not rely on memory at the end of the season."
    ],
    "recordedTarget": [
      "Bhala phansi sonke isivuno ngesikhathi sivunwa.",
      "Qopha amakhilogremu katamatisi, ama-dozen amaqanda, nezinyanda ze-morogo, bese ubhala ukuthi ngakunye kuyephi.",
      "Sebenzisa lo mkhuba ekudleni okugcinelwe umuzi, umkhiqizo othengisiwe, onikezwe omunye, noma ofakwe ku-compost.",
      "Ungathembeli enkumbulweni ekupheleni kwesizini."
    ],
    "sourceHeading": "Record Every Harvest",
    "registeredEnglishTitle": "Record Every Harvest",
    "registeredZuluTitle": "Bhala Phansi Sonke Isivuno",
    "sourceHash": "1f442ab3cd62d2a6294a1c1bb06fc1916a503782f6c0cb51e400ece9bc15cb42",
    "targetHash": "b494447b3f669776d6b62bfb3199a74766534b64dc259c5b9f207b40edf9278b",
    "imageUrl": "/course-decks/market-community/zu/slide-05.jpg",
    "imageSha256": "b9ee6b369524f936dce7c6ae06b1201e3a91ebf660958a214092be605fba66d6",
    "audioUrl": "/course-audio/market-community/zu/slide-05.mp3",
    "audioSha256": "1023b008393aec19010295e90ef8a05688931dabcd3fb7089de6fa8156fa184b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 6,
    "source": [
      "One season of records answers practical questions.",
      "Which crops give the best yield per bed? Which return the most for each hour of work?",
      "Which crops use more seeds, water, and compost than they return?",
      "The record also shows which months leave the household buying food."
    ],
    "recordedTarget": [
      "Irekhodi lesizini eyodwa liphendula imibuzo ebalulekile.",
      "Yiziphi izitshalo ezinikeza isivuno esingcono embhedeni ngamunye? Yiziphi ezibuyisa imali eningi ngehora lomsebenzi?",
      "Yiziphi ezisebenzisa imbewu, amanzi, ne-compost eningi kunalokho ezikubuyisayo?",
      "Irekhodi libuye libonise izinyanga lapho umuzi ugcina uthenga khona ukudla."
    ],
    "sourceHeading": "Let One Season Answer Questions",
    "registeredEnglishTitle": "Let One Season Answer Questions",
    "registeredZuluTitle": "Isizini Eyodwa Iphendula Imibuzo",
    "sourceHash": "285977679bd219af6371b88d7fec514f46acaaa8dbb38fb5735c862a63364cab",
    "targetHash": "bad39c11f4333d3cb9539d1894651fd6f01c84e5893cc0ba8885dd584f8007fb",
    "imageUrl": "/course-decks/market-community/zu/slide-06.jpg",
    "imageSha256": "c89c172122f292f06f179e26bc7089989764d74260ea69d23c613a41fc42671d",
    "audioUrl": "/course-audio/market-community/zu/slide-06.mp3",
    "audioSha256": "f04066492a597143e28a021c71f9b5c6135ab3a677ae1dc81edcef361d1bc07d",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 7,
    "source": [
      "Before setting a price, record production, packing and selling costs, including labour and transport.",
      "Here is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.",
      "Review the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale."
    ],
    "recordedTarget": [
      "Ngaphambi kokubeka inani lokuthengisa, qopha izindleko zokukhiqiza, ukupakisha nokuthengisa, kuhlanganise nomsebenzi nezokuthutha.",
      "Nasi isibonelo sokufundisa, asiyona inani lentengo yamanje emakethe: utamatisi ubiza u-R18 ngekhilogremu ukuwukhiqiza, kodwa uthengiswa ngo-R15 ngekhilogremu. Lelo nani alizikhokhi izindleko ezishiwo.",
      "Buyekeza inani lokuthengisa, izindleko nokuthi uzotshala ini ngokulandelayo. Hlola ukuthi abathengi bazothengani ngempela; inani eliphakeme elicelwayo aliqinisekisi ukuthi umkhiqizo uzothengiswa."
    ],
    "sourceHeading": "Find the True Cost",
    "registeredEnglishTitle": "Find the True Cost",
    "registeredZuluTitle": "Thola Izindleko Zangempela",
    "sourceHash": "ea2bcb33a29282a18bfe6165babef6d4d5c695a08f9bf9726a7120db87e15c65",
    "targetHash": "46e782ca0ba9238af4b1271fc1f9cc1fac9523c3818c2c1dcf97e65422118656",
    "imageUrl": "/course-decks/market-community/zu/slide-07.jpg",
    "imageSha256": "6f3ec3132e49a313f3bfa47175dd9f23b0cd2c88686eea0c1a8646ba4fbad21b",
    "audioUrl": "/course-audio/market-community/zu/slide-07.mp3",
    "audioSha256": "5395bb2d0fd274c390da840d02dafceedc77fbf712be045448c694631cb5404f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 8,
    "source": [
      "Use your record to find when household food runs short.",
      "Choose locally suitable crops and work backwards from the harvest you need. Check planting conditions and expected time to harvest.",
      "A date that works on another farm may not work here. Include a backup plan when rain, water or crops fail."
    ],
    "recordedTarget": [
      "Sebenzisa irekhodi lakho ukuthola ukuthi ukudla komuzi kushoda nini.",
      "Khetha izitshalo ezifanele indawo yangakini, uhlele uhlehle usuka esikhathini sokuvuna osidingayo. Hlola izimo zokutshala nesikhathi esilindelekile kuze kuvunwe.",
      "Usuku olusebenza kwelinye ipulazi lungase lungasebenzi lapha. Yiba nohlelo lwesibili uma imvula, amanzi noma izitshalo kungahambi kahle."
    ],
    "sourceHeading": "Plan for the Food Gap",
    "registeredEnglishTitle": "Plan for the Food Gap",
    "registeredZuluTitle": "Hlela Ngesikhathi Sokushoda Kokudla",
    "sourceHash": "a4df0d4d6951f1cf616b05c9e9688f016be44a5955ddf041d514b78c58890ed8",
    "targetHash": "0e65020d4764019bf03e438e1e5bcf541a97cbb2265d837235cae4d216201bc1",
    "imageUrl": "/course-decks/market-community/zu/slide-08.jpg",
    "imageSha256": "8e020e1b431aa54550c48d2825d0806cea9162c38ee44c96d4df1f58bb7c89c1",
    "audioUrl": "/course-audio/market-community/zu/slide-08.mp3",
    "audioSha256": "d522a848a9380690c5e6b271df3d4f23135177eed6cab6d7561b056a48d67f1b",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 9,
    "source": [
      "Surplus can leave the farm through a roadside stall, a group delivery to a shop, or a box delivered to a household.",
      "The arrows show each route."
    ],
    "recordedTarget": [
      "Okusele kungaya esitolo esiseceleni komgwaqo, ekulethweni kweqembu esitolo, noma ebhokisini elilethwa emzini.",
      "Imicibisholo ikhombisa indlela ngayinye."
    ],
    "sourceHeading": "Watch: Where Surplus Can Go",
    "registeredEnglishTitle": "Watch: Where Surplus Can Go",
    "registeredZuluTitle": "Buka: Lapho Okusele Kungaya Khona",
    "sourceHash": "ef438f4e2bdd953113f388b4b0a50a7b6369b0892b12796942a807142cd945f7",
    "targetHash": "5c5ae754d90e9f80742c76b68ed55d71a79a0497d6b94b86c1d6ec336cbe1819",
    "imageUrl": "/course-decks/market-community/zu/slide-09.jpg",
    "imageSha256": "eb07a5e3a95687527b6525dc7bea8561ed6aa90268bf9556a6aa6e098a0abc7b",
    "audioUrl": "/course-audio/market-community/zu/slide-09.mp3",
    "audioSha256": "eef62c03f93bfe89468a8e57c770ad47258db6880e6ab08c7b153efdf61cd184",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 10,
    "source": [
      "Ask what the customer needs: product, quantity, quality, delivery and payment date.",
      "Compare market fees, transport, packing and unsold produce as well as the selling price.",
      "Check the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs."
    ],
    "recordedTarget": [
      "Buza ukuthi umthengi udingani: umkhiqizo, inani, ikhwalithi, ukulethwa nosuku lokukhokha.",
      "Qhathanisa izimali zemakethe, ezokuthutha, ukupakisha nomkhiqizo ongathengiswanga kanye nenani lokuthengisa.",
      "Hlola imithetho yemakethe nezimfuneko zendawo zokuhweba nokudla. Ukuthi itafula lokuthengisa alihlelekile akusho ngokuzenzakalelayo ukuthi alinayo imithetho noma izindleko."
    ],
    "sourceHeading": "Know Your Customer",
    "registeredEnglishTitle": "Know Your Customer",
    "registeredZuluTitle": "Yazi Umthengi Wakho",
    "sourceHash": "7edfa272bcef766068ba85cd6ceeb5739809301be9056fcf7a683aac93e6629a",
    "targetHash": "7cd71e9b28d8c186f7eb5757609b3367e4561af79b70b101dab969bb644749fb",
    "imageUrl": "/course-decks/market-community/zu/slide-10.jpg",
    "imageSha256": "35cf2659ab6811a2c7ff787ea87bf109fe4f7637ba3f7c015a047d5bd68f8cb6",
    "audioUrl": "/course-audio/market-community/zu/slide-10.mp3",
    "audioSha256": "a23c9f83c5e026812e3298b479114a013a8b332927c3b4be1246c19a9dc8c64f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 11,
    "source": [
      "Direct selling can retain more of the sale price, but it also takes time, packing, transport and customer care.",
      "A box scheme supplies a regular selection to agreed customers.",
      "Agree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement."
    ],
    "recordedTarget": [
      "Ukuthengisa ngqo kungagcina ingxenye enkulu yenani lokuthengisa kumlimi, kodwa kudinga nesikhathi, ukupakisha, ukuthutha nokunakekela amakhasimende.",
      "I-box scheme iletha izinhlobo ezivamile zemikhiqizo kumakhasimende okuvunyelwene nawo.",
      "Vumelanani ngokuqukethwe kwebhokisi, inani, ukukhokha nokuthi kuzokwenzekani uma isivuno sishoda. Ama-oda avamile asiza ukuhlela kuphela uma amakhasimende nabalimi bekwazi ukugcina isivumelwano."
    ],
    "sourceHeading": "Count the Work of Direct Selling",
    "registeredEnglishTitle": "Count the Work of Direct Selling",
    "registeredZuluTitle": "Bala Umsebenzi Wokuthengisa Ngqo",
    "sourceHash": "a96a34dc144d36c41f176615066bebb7a1f1f4a5167b9a3f8f82240f00ae7378",
    "targetHash": "8dabc80073a1b5190bfc644bc10224a91558d464ee3cc16edc6297948028a63c",
    "imageUrl": "/course-decks/market-community/zu/slide-11.jpg",
    "imageSha256": "88d3e61844af989d8be3de23f6828f42db88c1dc19ef3b38da8bd463f52ec420",
    "audioUrl": "/course-audio/market-community/zu/slide-11.mp3",
    "audioSha256": "dd498059d47487ae6ac94214fdb62a82270d75c08ba47df0e4efc1c90b09d88a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 12,
    "source": [
      "Start from what you can reliably supply and what customers want.",
      "Check the costs and household food needs before promising regular boxes.",
      "Garden area or customer count alone does not predict income. Try a manageable arrangement and record the results."
    ],
    "recordedTarget": [
      "Qala ngalokho ongakuhlinzeka ngokwethembeka kanye nalokho okufunwa amakhasimende.",
      "Hlola izindleko nezidingo zokudla komuzi ngaphambi kokuthembisa amabhokisi avamile.",
      "Ubukhulu bengadi noma inani lamakhasimende kukodwa akubikezeli imali engenayo. Zama indlela ongakwazi ukuyiphatha bese uqopha imiphumela."
    ],
    "sourceHeading": "Plan Around Real Orders",
    "registeredEnglishTitle": "Plan Around Real Orders",
    "registeredZuluTitle": "Hlela Ngama-oda Angempela",
    "sourceHash": "59a8668db87066abd3c66ddf6c41bddfc1d538533450e4e42df2a9c880994e5b",
    "targetHash": "be22d8c7fe82742c97cb53fd1c979288b290059e1ad7d876eff58ecc60a7f236",
    "imageUrl": "/course-decks/market-community/zu/slide-12.jpg",
    "imageSha256": "9380a6151f7acd7a246c13434346b11c9b27b9b62ffa286b5177640a8a1fe92c",
    "audioUrl": "/course-audio/market-community/zu/slide-12.mp3",
    "audioSha256": "fa4b7935708012727606cb4e0d44dd98785f91d98a05ec722549e10341820b2a",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 13,
    "source": [
      "If production changes from week to week, avoid promising a fixed delivery you cannot supply.",
      "Offer the surplus you have and agree clear terms with customers.",
      "Describe your growing practices honestly. Check any certification or claim the buyer requires before using a label."
    ],
    "recordedTarget": [
      "Uma ukukhiqiza kushintsha isonto nesonto, gwema ukuthembisa ukulethwa okungaguquki ongeke ukwazi ukukufeza.",
      "Nikeza ngomkhiqizo osele onawo bese nivumelana ngemigomo ecacile namakhasimende.",
      "Chaza ngokwethembeka izindlela okhulisa ngazo izitshalo. Ngaphambi kokufaka ilebula, hlola isitifiketi noma isimangalo esidingwa umthengi."
    ],
    "sourceHeading": "Match the Channel to Your Supply",
    "registeredEnglishTitle": "Match the Channel to Your Supply",
    "registeredZuluTitle": "Qondanisa Indlela Nokukhiqiza Kwakho",
    "sourceHash": "4f08be9945c36f61785c300ab2bf670e2bde9d179fe80c4ca0fc6abda050852c",
    "targetHash": "222209ddb43e6c2be98f693d67bbc894655b2802029f73c645ae551544c4089b",
    "imageUrl": "/course-decks/market-community/zu/slide-13.jpg",
    "imageSha256": "baf55ac87ad7d10ee5663dcbd32183dbe412f188edc112a9e10cb13a8529f2fa",
    "audioUrl": "/course-audio/market-community/zu/slide-13.mp3",
    "audioSha256": "63bc7a05d19a3722b3df9d0693f2d8dc22a075a3eb3fe11c4ab52fa0c15d9cfc",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 14,
    "source": [
      "One farm can produce food.",
      "A group can share seed, tools, skills, and transport.",
      "Separate growers become a stronger local food network, with each household contributing what it can."
    ],
    "recordedTarget": [
      "Ipulazi elilodwa lingakhiqiza ukudla.",
      "Iqembu lingabelana ngembewu, amathuluzi, amakhono nezokuthutha.",
      "Abalimi abahlukene baba inethiwekhi yokudla yasendaweni enamandla."
    ],
    "sourceHeading": "Watch: How Neighbours Strengthen a Harvest",
    "registeredEnglishTitle": "Watch: How Neighbours Strengthen a Harvest",
    "registeredZuluTitle": "Buka: Ukubambisana Komakhelwane",
    "sourceHash": "3d88d7a0786112ccf413e3d8aea3e05ac97f9c76265cea4e0a4184aeb767405e",
    "targetHash": "927127ffa09359eba0fad1bbcda4caeca1e73acd0ef608da84ee19d19a894a93",
    "imageUrl": "/course-decks/market-community/zu/slide-14.jpg",
    "imageSha256": "6a935180a5d86dad2bbe9725107cf1ec795aa2d734934c459f903beb11a918f9",
    "audioUrl": "/course-audio/market-community/zu/slide-14.mp3",
    "audioSha256": "a168c14c2f6b2366482d03f6b2d5a145d2445afba79ee4105dae0e69513ca2c6",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 15,
    "source": [
      "Neighbours can share different varieties and the work of saving seed.",
      "Record the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.",
      "Sharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed.",
      "Before exchanging seed, check whether the variety is protected and whether permission is needed."
    ],
    "recordedTarget": [
      "Omakhelwane bangabelana ngezinhlobo ezahlukene zezitshalo nangomsebenzi wokugcina imbewu.",
      "Bhala isitshalo, uhlobo lwaso, lapho imbewu ivela khona nosuku eyabuthwa ngalo. Hlela ukuhlukanisa impova, ukukhetha izitshalo zembewu, ukomisa nokugcina ngokwendlela efanele isitshalo ngasinye.",
      "Ukwabelana akukhulisi ukuhlukahluka ngokuzenzakalelayo futhi akuqinisekisi ikhwalithi engcono. Hlola ukuthi imbewu ingeyaluphi uhlobo nokuthi iyahluma yini ngaphambi kokuthembela kuyo.",
      "Ngaphambi kokushintshisana ngembewu, hlola ukuthi uhlobo luvikelwe yini nokuthi imvume iyadingeka yini."
    ],
    "sourceHeading": "Save Seed Together",
    "registeredEnglishTitle": "Save Seed Together",
    "registeredZuluTitle": "Gcinani Imbewu Ndawonye",
    "sourceHash": "2b7b481fb884b392b67918b7428cfb636c80788dec943864114791b635c6ea5d",
    "targetHash": "f4254721e5b8459b5c37bc5b20024abcdb7ea8ab87eed426467fa6d1f71c487d",
    "imageUrl": "/course-decks/market-community/zu/slide-15.jpg",
    "imageSha256": "cbe38c2674856845f4df2b95d51729ce0a19cf8ed6ad6fd2d659257fc8048cbd",
    "audioUrl": "/course-audio/market-community/zu/slide-15.mp3",
    "audioSha256": "93750f9ded249290f4f287d1a0a3da537986d2a988085be889c50aa25b3e0273",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 16,
    "source": [
      "Tool sharing puts expensive equipment within reach of the group.",
      "A water pump or grain mill may be beyond one household’s budget.",
      "Shared use spreads the value across the group and helps each farm do work it could not do alone."
    ],
    "recordedTarget": [
      "Ukwabelana ngamathuluzi kwenza imishini ebizayo ifinyeleleke eqenjini lonke.",
      "I-water pump noma i-grain mill ingaba ngaphezu kwamandla emuzi owodwa.",
      "Ukusetshenziswa ngokuhlanganyela kusabalalisa inzuzo yethuluzi futhi kusize ipulazi ngalinye lenze umsebenzi ebelingeke liwenze lodwa."
    ],
    "sourceHeading": "Share Expensive Tools",
    "registeredEnglishTitle": "Share Expensive Tools",
    "registeredZuluTitle": "Yabelanani Ngamathuluzi Abizayo",
    "sourceHash": "1350e3b93c851bb3ab21db30b02dc6d54f548d2a8b0b66f5bd19b43f4967356f",
    "targetHash": "52b464c3cd33025443ed7adac428cf6756e43f99f99e0566899f133d79dc3c79",
    "imageUrl": "/course-decks/market-community/zu/slide-16.jpg",
    "imageSha256": "9c6e1f306da0a5572dbc16a01fac67f6c37e404a488e99189543ddc406f066d1",
    "audioUrl": "/course-audio/market-community/zu/slide-16.mp3",
    "audioSha256": "0b22b80994a88b5a71aae1c8c91e80c587d9833408034ad3a6eda0a8be50144f",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 17,
    "source": [
      "Handle produce gently and keep suitable shade, packaging and storage through delivery.",
      "A nearby buyer may reduce the journey, but losses and selling costs still need measuring.",
      "Compare the money received after fees, transport and spoilage for each option. Do not assume the nearest buyer always gives the best return."
    ],
    "recordedTarget": [
      "Phatha umkhiqizo ngobumnene futhi uwugcine emthunzini ofanele, upakishwe futhi ugcinwe kahle ngesikhathi sokulethwa.",
      "Umthengi oseduze anganciphisa uhambo, kodwa ukulahleka komkhiqizo nezindleko zokuthengisa kusadinga ukubalwa.",
      "Qhathanisa imali engenile ngemva kwezimali ezikhokhiwe, ezokuthutha nokonakala komkhiqizo endleleni ngayinye. Ungacabangi ukuthi umthengi oseduze uhlala enikeza inzuzo engcono."
    ],
    "sourceHeading": "Reduce Loss Between Harvest and Sale",
    "registeredEnglishTitle": "Reduce Loss Between Harvest and Sale",
    "registeredZuluTitle": "Nciphisa Ukulahleka Phakathi Kokuvuna Nokuthengisa",
    "sourceHash": "b436469a7356482c3acb937c98341f98d2e1dbf99c13ea32e448ca1a534ffb64",
    "targetHash": "266cc2437942e9ffeee330b4d1e7de3a09b9d95e81e3d4cab08f042110b1b85f",
    "imageUrl": "/course-decks/market-community/zu/slide-17.jpg",
    "imageSha256": "bab12a4b781411828fcd63e1a32d89c18fad0434ff536499784191ea32b839a4",
    "audioUrl": "/course-audio/market-community/zu/slide-17.mp3",
    "audioSha256": "6b91112d63d15ca871b7eb31e863db2926b2cb7c721374dd66b00ccc42bd22b5",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 18,
    "source": [
      "Neighbours can demonstrate useful skills and compare what happened on their own farms.",
      "Record the method, conditions and result so others can judge whether it may suit their land.",
      "Seek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together."
    ],
    "recordedTarget": [
      "Omakhelwane bangakhombisa amakhono awusizo futhi baqhathanise okwenzeke emapulazini abo.",
      "Qopha indlela esetshenzisiwe, izimo nomphumela ukuze abanye bakwazi ukwahlulela ukuthi leyo ndlela ingase iwafanele yini umhlaba wabo.",
      "Funa iseluleko sochwepheshe abafanele ngezifo ezingajwayelekile noma izinkinga zobuchwepheshe. Ulwazi lomphakathi lungasebenza kanye nosizo lochwepheshe."
    ],
    "sourceHeading": "Share Skills and Check Results",
    "registeredEnglishTitle": "Share Skills and Check Results",
    "registeredZuluTitle": "Yabelanani Ngamakhono Niphinde Nihlole Imiphumela",
    "sourceHash": "7969931fb53832cecabdc8cb311fcfec39f4bbcca1f72a9e1a67a6193a9054dd",
    "targetHash": "b4791b1b89212eed431f99c18c59bcd4bbf36c53ee832e965b3914f095b96c93",
    "imageUrl": "/course-decks/market-community/zu/slide-18.jpg",
    "imageSha256": "fbc461537a8039a546078953e3e51bdd3fa3eed3a0be85022e84b04e8271ca30",
    "audioUrl": "/course-audio/market-community/zu/slide-18.mp3",
    "audioSha256": "cef1de04c78aab2160862d16e48a251ef952fb4d361b083c750eb62a1ce50334",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 19,
    "source": [
      "Use headings for harvest, where it went, costs, and labour.",
      "Record every kilogram, dozen, or bundle as it leaves the farm.",
      "Include food kept by the household, produce sold, produce gifted, and produce composted.",
      "At the end of one season, identify a crop that returns well and a month when the household buys food."
    ],
    "recordedTarget": [
      "Sebenzisa izigaba ezibhalwe ukuthi isivuno, lapho siye khona, izindleko, nomsebenzi.",
      "Qopha wonke amakhilogremu, ama-dozen, noma izinyanda njengoba ziphuma epulazini.",
      "Faka ukudla okugcinelwe umuzi, okuthengisiwe, okunikezwe abanye, nokufakwe ku-compost.",
      "Ekupheleni kwesizini eyodwa, thola isivuno esibuyisa kahle kanye nenyanga lapho umuzi uthenga khona ukudla."
    ],
    "sourceHeading": "Field Assignment: Make a Farm Record",
    "registeredEnglishTitle": "Field Assignment: Make a Farm Record",
    "registeredZuluTitle": "Umsebenzi Wasepulazini: Yenza Irekhodi Lepulazi",
    "sourceHash": "959619f1e5babb21872fd172431f9e8058a2c0a074674b3d0b54e38b603f6caa",
    "targetHash": "f3b52e3d1b4b8437a50a904ac0e422158a7ed163842b6556db4b08a16c1792c7",
    "imageUrl": "/course-decks/market-community/zu/slide-19.jpg",
    "imageSha256": "f0aa079b2b354f0b47e86dd6be4e4689aa7de2cdacfd3287adf2591be746d431",
    "audioUrl": "/course-audio/market-community/zu/slide-19.mp3",
    "audioSha256": "6ce95e329ee7963375978d785b6baa07eff3d0583f0d37a404d3ebc59bb6e7d1",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  },
  {
    "moduleId": "market-community",
    "slide": 20,
    "source": [
      "Choose one real decision from your farm record.",
      "Compare the cost and return of a crop or selling route, or plan for a household food gap using local growing conditions.",
      "Then agree one practical seed swap, tool share, shared delivery or skills session with neighbours. Before a seed swap, check whether the variety is protected and whether permission is needed. Record responsibilities and review what happens."
    ],
    "recordedTarget": [
      "Khetha isinqumo esisodwa sangempela esivela kurekhodi lepulazi lakho.",
      "Qhathanisa izindleko nembuyiselo yesitshalo noma yendlela yokuthengisa, noma uhlelele isikhathi sokushoda kokudla komuzi usebenzisa izimo zokutshala zendawo.",
      "Bese nivumelana nomakhelwane ngesinyathelo esisodwa esisebenzayo: ukushintshisana ngembewu, ukwabelana ngethuluzi, ukuletha umkhiqizo ndawonye noma ukufunda ikhono. Ngaphambi kokushintshisana ngembewu, hlolani ukuthi uhlobo luvikelwe yini nokuthi imvume iyadingeka yini. Qophani izibopho zomuntu ngamunye bese nibuyekeza okwenzekile."
    ],
    "sourceHeading": "Field Action: Use the Record",
    "registeredEnglishTitle": "Field Action: Use the Record",
    "registeredZuluTitle": "Isenzo Sasepulazini: Sebenzisa Irekhodi",
    "sourceHash": "4a8f5afe6e2282dc64f55f1a49b1ad891bf691cbdd565da4727d7f43918ad226",
    "targetHash": "2f359059161167c29a4e36ec0d0766c92cec51c45712fe79f6747164379ac643",
    "imageUrl": "/course-decks/market-community/zu/slide-20.jpg",
    "imageSha256": "5a5c44847b589b81ec4d2a77f33c22c0238a5f6e73bc08d1703c8666d639b4f6",
    "audioUrl": "/course-audio/market-community/zu/slide-20.mp3",
    "audioSha256": "05cfc34594f3500e129ae8828caeefa3742c9a595cda3529f67e16c33c5dce11",
    "reviewStatus": "unreviewed",
    "semanticReview": "not-established-by-inventory"
  }
] as const satisfies readonly IsiZuluDeckSourceBinding[];

export const ISIZULU_DECK_SOURCE_BINDINGS: readonly IsiZuluDeckSourceBinding[] = Object.freeze(
  bindings.map((binding) => Object.freeze({
    ...binding,
    source: Object.freeze([...binding.source]),
    recordedTarget: Object.freeze([...binding.recordedTarget]),
  })),
);

export type DeckTranscriptRegistry = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<number, readonly string[]>>>>>
>;

export interface IsiZuluDeckSourceTitles {
  readonly en: string;
  readonly zu: string;
}

export interface ResolvedIsiZuluDeckSourcePair {
  readonly source: readonly string[];
  readonly recordedTarget: readonly string[];
  readonly sourceHeading: string;
  readonly registeredEnglishTitle: string;
  readonly registeredZuluTitle: string;
  readonly reviewStatus: 'unreviewed';
}

function sameOrderedText(actual: readonly string[] | undefined, expected: readonly string[]): boolean {
  return Array.isArray(actual) && actual.length === expected.length
    && expected.every((paragraph, index) => actual[index] === paragraph);
}

/**
 * Return the exact registered English source and recorded isiZulu wording only
 * while both live transcript arrays still match this immutable snapshot. Pass
 * current manifest titles to fail closed if either displayed title has drifted.
 * A null result means the pair is unavailable; no hold policy lives here.
 */
export function resolveIsiZuluDeckSourcePair(
  moduleId: string,
  slide: number,
  registry: DeckTranscriptRegistry = COURSE_TRANSCRIPTS,
  titles?: IsiZuluDeckSourceTitles,
): ResolvedIsiZuluDeckSourcePair | null {
  const expected = ISIZULU_DECK_SOURCE_BINDINGS.find(
    (binding) => binding.moduleId === moduleId && binding.slide === slide,
  );
  if (!expected) return null;

  const source = registry[moduleId]?.en?.[slide];
  const recordedTarget = registry[moduleId]?.zu?.[slide];
  if (!sameOrderedText(source, expected.source) || !sameOrderedText(recordedTarget, expected.recordedTarget)) {
    return null;
  }
  if (titles && (titles.en !== expected.registeredEnglishTitle || titles.zu !== expected.registeredZuluTitle)) {
    return null;
  }

  return Object.freeze({
    source: expected.source,
    recordedTarget: expected.recordedTarget,
    sourceHeading: expected.sourceHeading,
    registeredEnglishTitle: expected.registeredEnglishTitle,
    registeredZuluTitle: expected.registeredZuluTitle,
    reviewStatus: 'unreviewed',
  });
}
