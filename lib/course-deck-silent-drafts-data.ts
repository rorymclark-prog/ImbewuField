import type { IsiZuluSilentDeckDraftInput } from './course-deck-silent-drafts';
import { ISIZULU_SILENT_DECK_TEXT_CANDIDATES } from './course-deck-silent-safety-text-candidates';

// Corrected visual drafts have independent asset/text identity; the old recording stays withheld.
// Source checks and rendered-file proof are recorded in ISIZULU-SILENT-HELD-SLIDE-* review packets.
const PREVIOUSLY_RELEASED_SILENT_ROWS: readonly IsiZuluSilentDeckDraftInput[] = [
  {
    "moduleId": "intro-permaculture",
    "slide": 6,
    "sourceHeading": "Fair Share",
    "sourceEnglish": [
      "The third ethic is Fair Share.",
      "Take only what you need, and return the surplus to the system — seeds, food, water, knowledge.",
      "A farmer who sells all his surplus mielies and keeps nothing back for compost or for seed is breaking this one. Nothing goes back.",
      "A community that fences off a shared spring is breaking it too.",
      "What does your land get back from you each season?"
    ],
    "correctedTitle": "Ukwabelana Ngendlela Enobulungiswa (Fair Share)",
    "correctedTarget": [
      "I-ethic yesithathu yi-Fair Share.",
      "Thatha lokho okudingayo kuphela, bese ubuyisela okusele ohlelweni — imbewu, ukudla, amanzi nolwazi.",
      "Umlimi othengisa wonke ama-mielies akhe asele, angashiyi lutho lokwenza i-compost noma lokugcina imbewu, uyephula le-ethic. Akukho okubuyela ohlelweni.",
      "Umphakathi ovalela indawo yomthombo osetshenziswa ngokuhlanganyela nawo uyayiphula le-ethic.",
      "Umhlaba wakho utholani kuwe ngesizini ngayinye?"
    ],
    "sourceHash": "184721b482adc1558c5e06cbdecba6343592df84c5fa8aee4d52f6f520bba0e4",
    "targetHash": "82cc3f4912b35c5f2ecdd795439cc98b1238012d87aeb292325c500f0bda08e6",
    "imageUrl": "/course-decks/intro-permaculture/zu-silent/slide-06.webp",
    "imageSha256": "82c8de6a332feb2aa24844b3f381871c49c78e2b49bd497c505afeff3d22c3f1",
    "imageBytes": 576434,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 7,
    "sourceHeading": "Watch: One Decision, Three Ethics",
    "sourceEnglish": [
      "A borehole serves your household. Neighbours ask for water too.",
      "First find out if sharing is allowed. Check whether the borehole can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly and keep watching the water level. People Care and Fair Share guide the agreement. Earth Care means protecting the source. Watching the level alone does not make extra use safe or allowed.",
      "Who could help you check the rules and the water supply?"
    ],
    "correctedTitle": "Bheka: Isinqumo Esisodwa, Ama-Ethics Amathathu",
    "correctedTarget": [
      "I-borehole inikeza umndeni wakho amanzi. Omakhelwane bacela amanzi nabo.",
      "Qala uthole ukuthi ukwabelana ngamanzi kuvumelekile yini. Hlola ukuthi i-borehole ingakwazi yini ukusiza bonke abasebenzisi ngaphandle kokusebenzisa amanzi amaningi kakhulu. Uma ukwabelana kuvumelekile futhi kunamanzi anele, vumelanani ngokwabelana ngendlela enobulungiswa bese niqhubeka nibheka izinga lamanzi. I-People Care ne-Fair Share kuqondisa isivumelwano. I-Earth Care isho ukuvikela umthombo wamanzi. Ukuqapha izinga lamanzi kukodwa akusho ukuthi ukusebenzisa amanzi engeziwe kuphephile noma kuvumelekile.",
      "Ubani ongakusiza uhlole imithetho nokuthi amanzi akhona anele yini?"
    ],
    "sourceHash": "27b10b6a37078aad4cd517830b0ddb22acc67ab2f580867d25ee3239045dc12d",
    "targetHash": "fe17f0f85f58826e9eb924730622125d60dad0132e0f09bedc4e6721f04b72de",
    "imageUrl": "/course-decks/intro-permaculture/zu-silent/slide-07.webp",
    "imageSha256": "c8d213ece4bac7237218115587069553121ae702f8b11d2bd28c5a8e41c1ead0",
    "imageBytes": 372150,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "intro-permaculture",
    "slide": 22,
    "sourceHeading": "Field Action",
    "sourceEnglish": [
      "Walk out and check your sketch against the ground.",
      "Stand at the kitchen door and count what is really in Zone 1 today.",
      "Find one thing planted further away than how often you use it, and write down where it should move to.",
      "Then ask one older neighbour which direction the worst wind comes from, and compare their answer with your arrow."
    ],
    "correctedTitle": "Isenzo Sasensimini",
    "correctedTarget": [
      "Hamba uyohlola umdwebo wakho emhlabeni wangempela.",
      "Yima emnyango wasekhishini ubale okukhona ngempela ku-Zone 1 namuhla.",
      "Thola into eyodwa etshalwe kude uma uqhathanisa nokuthi uyisebenzisa\nkaningi kangakanani. Bhala ukuthi kufanele ihanjiswe kuphi.",
      "Bese ubuza umakhelwane osekhulile ukuthi umoya omubi kakhulu uvela\nngakuphi. Qhathanisa impendulo yakhe nomcibisholo wakho."
    ],
    "sourceHash": "a4590f5821c4e5578ce0cc946bda0e9b94cb8e1da17ec1f9609c862374b4dcce",
    "targetHash": "e22499cb78493757370c6afd7fa24bb8258494808eb22bb85c56ddb1fafa0efd",
    "imageUrl": "/course-decks/intro-permaculture/zu-silent/slide-22.webp",
    "imageSha256": "f1fae46cc2608410fa6f3a8f23f21dedf4e8ae8a99925434eaa3b42e0598132e",
    "imageBytes": 259382,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 5,
    "sourceHeading": "Watch: Water Slows, Sinks, and Leaves",
    "sourceEnglish": [
      "The picture shows rain moving downhill. Follow where it speeds up, spreads, sinks, gathers, and leaves the land."
    ],
    "correctedTitle": "Buka: Amanzi ahamba kancane, Sinks, Aphume",
    "correctedTarget": [
      "Isithombe sibonisa imvula yehla ngomthambeka. Bheka lapho amanzi egeleza khona ngesivinini esikhulu, esabalala khona, ecwila emhlabathini khona, eqoqana khona nalapho ephuma khona emhlabeni."
    ],
    "sourceHash": "155153089b8b638506f91e13a0d0627f1e85609144df93a996a0160667a918ae",
    "targetHash": "b94dc0c2628425f2cb739ab0b8b6334876e4ea148ded379a6749dacd62041f9a",
    "imageUrl": "/course-decks/reading-landscape/zu-silent/slide-05.webp",
    "imageSha256": "e351101433846d2720314f83e6c0007bf51b73bd07715e978260c459fb89904e",
    "imageBytes": 196820,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 15,
    "sourceHeading": "Choose Airflow and Warmth",
    "sourceEnglish": [
      "Put a frost-sensitive seedling nursery outside the cold pockets you have observed. Compare candidate places through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before choosing a permanent position. Check sun and damaging wind too. No hillside position guarantees freedom from frost.",
      "For tomatoes troubled by late blight, good airflow and morning sun can help leaves dry. Prolonged cool, damp weather can still favour the disease. Moving a bed alone does not control late blight. Seek local crop-health advice too."
    ],
    "correctedTitle": "Khetha Ukuhamba Komoya Nokufudumala",
    "correctedTarget": [
      "Beka inkulisa yezithombo ezizwela isithwathwa ngaphandle kwezindawo ezibandayo ozibonile. Qhathanisa izindawo ezingakhethwa kuyo yonke inkathi yesithwathwa yasendaweni. Hlola amarekhodi endawo okushisa okuphansi noma ubuze umeluleki wezolimo ngaphambi kokukhetha indawo ehlala njalo. Hlola nelanga nomoya olimazayo. Ayikho indawo esentabeni eqinisekisa ukuthi ngeke ibe nesithwathwa.",
      "Kumatamatisi ahlaselwe yi-late blight, ukuhamba komoya nelanga lasekuseni kungasiza amaqabunga ome. Prolonged cool, damp weather can still favour the disease. Ukususa umbhede uwuyise kwenye indawo kukodwa ngeke kusilawule i-late blight. Funa neseluleko sendawo ngempilo yezitshalo."
    ],
    "sourceHash": "d34b318bbdf18fec09f6bef6d49666debcc188ff6b77572ee9e52e81e69719ea",
    "targetHash": "157dfa61f4bd7116adca610577148a0af1a189566af6574cdc04cd8e06fa2efa",
    "imageUrl": "/course-decks/reading-landscape/zu-silent/slide-15.webp",
    "imageSha256": "ffd52807ed9a58d1cc39d75f49d994ea5ac8c27542301f52447df8649bd416ae",
    "imageBytes": 432212,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 16,
    "sourceHeading": "Lesson 4: Start Your Site Map",
    "sourceEnglish": [
      "A site map needs paper, a tape measure, a compass, and time to walk your land.",
      "Walk the boundary and make a first sketch. Mark it not to scale until you have checked its distances. Mark north. Add the house, trees, water, roads, and fences.",
      "Then draw the patterns you have observed. Your map becomes the design skeleton for the whole smallholding."
    ],
    "correctedTitle": "Isifundo 4: Qala Imephu Yendawo Yakho",
    "correctedTarget": [
      "Ukuze wenze i-site map, udinga iphepha, i-tape measure, i-compass nesikhathi sokuhamba emhlabeni wakho.",
      "Hamba emngceleni wenze umdwebo wokuqala. Maka ukuthi awukabi ngesikali kuze kube usuwahlolile amabanga. Maka inyakatho. Faka indlu, izihlahla, amanzi, imigwaqo nezicingo.",
      "Bese udweba amaphethini owabonile. Imephu yakho iba uhlaka lomklamo for the whole smallholding."
    ],
    "sourceHash": "d9654911ad3bcc6ea700d3da0a2fdf8aa9dedb7620d4119223d779bc93cfe445",
    "targetHash": "c59269f888da27cf03732252aed482e3849de029ca048648c70474423905f8bb",
    "imageUrl": "/course-decks/reading-landscape/zu-silent/slide-16.webp",
    "imageSha256": "962e884e375cad659ab2805f6193a3febd02fd68e7682c8758ec80d652c7cc33",
    "imageBytes": 282074,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "soil-health",
    "slide": 1,
    "sourceHeading": "Soil Health & Composting",
    "sourceEnglish": [
      "Soil is more than the ground under your feet.",
      "It is a living place that feeds crops, holds water, and carries your harvest.",
      "In this module, learn to read soil, make safe compost, protect bare ground, and use cover crops and worm farms."
    ],
    "correctedTitle": "Impilo Yomhlabathi Ne-Compost",
    "correctedTarget": [
      "Umhlabathi ungaphezu kokuba yindawo engaphansi kwezinyawo zakho.",
      "Uyindawo ephilayo esiza izitshalo zikhule, ebamba amanzi, futhi esekela isivuno sakho.",
      "Kule modyuli, funda ukubheka nokufunda umhlabathi, ukwenza safe compost, ukuvikela umhlabathi ongenalutho, nokusebenzisa izitshalo zokumboza umhlabathi nama-worm farm."
    ],
    "sourceHash": "740b5850d834cd6136058d3c13227f285b9f36542a08e636e5aa8416e04cc926",
    "targetHash": "1313bdaa72392b854b6d26eecbe75e346020ae38918d8142f2958e72a7ec2bf0",
    "imageUrl": "/course-decks/soil-health/zu-silent/slide-01.webp",
    "imageSha256": "61c857bf9b9c2f72848e16e5d5699620701fed6ad67a694696e2c9f1cd8f9452",
    "imageBytes": 305052,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "water-harvesting",
    "slide": 10,
    "sourceHeading": "Store Rain for the Dry Season",
    "sourceEnglish": [
      "A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.",
      "Rainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.",
      "Before changing a watercourse or building storage works, check the required authorisation with the water authority."
    ],
    "correctedTitle": "Gcina Amanzi Emvula Esikhathi Esomile",
    "correctedTarget": [
      "Idamu noma ichibi lingagcina amanzi agelezayo, kodwa inani lamanzi atholakalayo lincike emvuleni yasendaweni, endaweni eqoqa amanzi, emanzini alahleka endleleni nasekutheni usebenzisa amanzi angakanani.",
      "Izinkathi zemvula ziyahlukahluka eNingizimu Afrika. Sebenzisa amarekhodi endawo, uhlele nezikhathi ezomile; akuqinisekisiwe ukuthi idamu liyohlala ligcwele.",
      "Ngaphambi kokushintsha watercourse noma ukwakha indawo yokugcina amanzi, hlola nesiphathimandla samanzi ukuthi iyiphi imvume edingekayo."
    ],
    "sourceHash": "7862e934cb1cc4862424647ed44538096a3a860867a6f904f0cca61d66754e10",
    "targetHash": "da771c3cf4b1bce9908b25ccdc84af4fb1b1c36dbdf8b829d210951cc112676a",
    "imageUrl": "/course-decks/water-harvesting/zu-silent/slide-10.webp",
    "imageSha256": "6302ccfddd391ee15d242e13acabcd091f8fc174312dfe3e09eb9e440fd4a8bd",
    "imageBytes": 306276,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 16,
    "sourceHeading": "Treat the Cause Before the Insect",
    "sourceEnglish": [
      "Work through four steps, in order.",
      "One. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.",
      "Two. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.",
      "Three. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.",
      "Four. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.",
      "If a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.",
      "Be honest with yourself about which step you usually skip."
    ],
    "correctedTitle": "Bheka Imbangela Ngaphambi Kwesinambuzane",
    "correctedTarget": [
      "Landela izinyathelo ezine ngokulandelana.",
      "Okokuqala. Bheka. Bheka iphethini yokulimala, ngaphansi kweqabunga, isiqu nezitshalo eziseduze.",
      "Okwesibili. Hlola ukucindezeleka kwesitshalo. Hlola umswakama womhlabathi, izimpande, isikhala phakathi kwezitshalo, izakhamzimba nokuphuma kwamanzi.",
      "Okwesithathu. Vikela okusizayo. Izinambuzane ezizuzisayo zenza umsebenzi obungase uwenze wena.",
      "Okwesine. Yilapho kuphela osuthatha khona isinyathelo; start with the lightest thing that works. Ukususa izinambuzane ngesandla, ukubeka izithiyo noma ukushintsha indlela yokunakekela izitshalo kungasiza. Hlola ukuthi isenzo siyayifanele yini inkinga, bese ubheka umphumela.",
      "Uma kudingeka ukwelapha ngomkhiqizo, sebenzisa umkhiqizo obhaliswe ukuthi usetshenziswe kuleso sitshalo nakuleso sinambuzane, bese ulandela yonke imiyalelo eselebulini lawo. Lokhu kuhlanganisa nemikhiqizo ye-neem. Hlola imiyalelo yokuzivikela kanye nesikhathi sokulinda ngaphambi kokuvuna. Ungazenzeli izingxube noma usebenzise imithamo enamandla kunaleyo eselebulini.",
      "Zitshele iqiniso ngokuthi yisiphi isinyathelo ovame ukusishiya."
    ],
    "sourceHash": "ee59fde47d13321ca77613468c3c17e77d373cfc693ef186f62480d93825684c",
    "targetHash": "3f34d918479a33736e2e302d55bc57c5341e73e6e5a62c4bf95a7b0677bbd299",
    "imageUrl": "/course-decks/vegetables-staples/zu-silent/slide-16.webp",
    "imageSha256": "15d67d3ec1c477d69fd9a687a00619b2fd1422c47c30845e084b7a0bc1869524",
    "imageBytes": 596598,
    "width": 1440,
    "height": 5910,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "vegetables-staples",
    "slide": 18,
    "sourceHeading": "Field Action",
    "sourceEnglish": [
      "This week, put one bed into production.",
      "One. Mark the bed and the paths.",
      "Two. Plant, with your spacing and your sowing rhythm.",
      "Three. Return after ten days, with a photo.",
      "Then observe. Adjust. And write it down.",
      "Record the sowing date. The rain. What germinated. Pest pressure. What you harvested.",
      "Season by season, your garden becomes less dependent on guesswork — and more on what you've actually seen happen on your own ground.",
      "Use your record with reliable local advice when making the next decision."
    ],
    "correctedTitle": "Isenzo SaseNsimini",
    "correctedTarget": [
      "Kuleli sonto, put one bed into production.",
      "Okokuqala. Maka umbhede nezindlela.",
      "Okwesibili. Tshala, usebenzise isikhala nesigqi sakho sokuhlwanyela.",
      "Okwesithathu. Buya ngemva kwezinsuku eziyishumi nesithombe.",
      "Bese ubheka, ulungise, ubhale phansi.",
      "Bhala usuku lokuhlwanyela, imvula, okumilile, Pest pressure, nokuvunile.",
      "Inkathi ngayinye, ingadi yakho ingancika kancane ekuqageleni futhi incike kakhulu kulokho okubonile kwenzeka emhlabeni wakho.",
      "Sebenzisa amarekhodi akho kanye neseluleko esithembekile sendawo lapho uthatha isinqumo esilandelayo."
    ],
    "sourceHash": "9c107e2877c52cc428576a5abff1cb9dc5a6c9939f99a23d7b99a33b983b758b",
    "targetHash": "aec760aaee07bfac2476fe2518a373dc01492dfd87eb275875a39b767f6db5e6",
    "imageUrl": "/course-decks/vegetables-staples/zu-silent/slide-18.webp",
    "imageSha256": "5063c7c1d81a50ae56e6e1eec29757c33922811f249acc9fb9cff9351a029b63",
    "imageBytes": 322322,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "market-community",
    "slide": 14,
    "sourceHeading": "Watch: How Neighbours Strengthen a Harvest",
    "sourceEnglish": [
      "One farm can produce food.",
      "A group can share seed, tools, skills, and transport.",
      "Separate growers become a stronger local food network, with each household contributing what it can."
    ],
    "correctedTitle": "Buka: Ukubambisana Komakhelwane",
    "correctedTarget": [
      "Ipulazi elilodwa lingakhiqiza ukudla.",
      "Iqembu lingabelana ngembewu, amathuluzi, amakhono nezokuthutha.",
      "Abalimi abahlukene baba inethiwekhi yokudla yasendaweni enamandla, futhi ikhaya ngalinye linikela ngalokho elingakwenza."
    ],
    "sourceHash": "3d88d7a0786112ccf413e3d8aea3e05ac97f9c76265cea4e0a4184aeb767405e",
    "targetHash": "30f145880cfd02e9dd22dd4cadd5c293d48a14a1ca2d988a36a645d5aa7db0cc",
    "imageUrl": "/course-decks/market-community/zu-silent/slide-14.webp",
    "imageSha256": "287241055294f6fe510b21436297d5ea4d069a2853646f63dd357943604ff16c",
    "imageBytes": 213512,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 22,
    "sourceHeading": "Leave Room Around the Tree",
    "sourceEnglish": [
      "Keep an open establishment basin and access to the fruit tree. Place temporary support plants where their size and water use can be managed.  Put leafy cuttings where mulch is needed. Neighbouring fruit trees can share support strips between them. Can you reach both plants as they grow?"
    ],
    "correctedTitle": "Shiya Indawo Ezungeze Umuthi",
    "correctedTarget": [
      "Gcina i-open establishment basin ivulekile, kanye nendlela yokunakekela umuthi. Beka izitshalo ezisekelayo lapho ukukhula nokusebenzisa kwazo amanzi kungalawuleka khona.  Beka amaqabunga asikiwe lapho kudingeka khona i-mulch. Izihlahla zezithelo zingasebenzisa izitshalo ezisekelayo eziphakathi kwazo. Uzokwazi ukufinyelela kuzo zombili izitshalo njengoba zikhula?"
    ],
    "sourceHash": "33d6a7c8fed217d2b0a61b457d7673ae9cb637e8bae9196c4112af7f46e0f179",
    "targetHash": "3893bd7aa3302fcd6146a6fe82d59cdfff80ac8ea76524abf3e6fbc6cce4fa67",
    "imageUrl": "/course-decks/plant-guilds/zu-silent/slide-22.webp",
    "imageSha256": "1e52877baeff58a8f108c5b2d1f44b517b3f2326098aa069620aa0b3b616a480",
    "imageBytes": 277506,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 28,
    "sourceHeading": "Chop-and-Drop for Light and Mulch",
    "sourceEnglish": [
      "Prune a support tree and return suitable leafy cuttings to the soil. The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.  Match cutting to the species. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas. Which plant needs a cut—and how much?"
    ],
    "correctedTitle": "Thena Ukuze Kukhanye",
    "correctedTarget": [
      "Thena umuthi osekelayo bese ubuyisela amagatsha anamaqabunga afanele emhlabathini njenge-mulch. Kule vidiyo kusikwa igatsha; umuthi osekelayo uyasala umile. Shiya amaqabunga anempilo anele ukuze isitshalo silulame.  Thena ngokohlobo lwesitshalo. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas. Yisiphi isitshalo esidinga ukuthenwa, futhi sidinga ukuthenwa okungakanani?"
    ],
    "sourceHash": "9b2f9313aaabb9a862b479efa0bef30af91f8b47487519a66a9aefd21ada6925",
    "targetHash": "acfda0842b16cbb85ff4c41b3e80bf3c9df406bf9a39c2ab61d89e8e7455a019",
    "imageUrl": "/course-decks/plant-guilds/zu-silent/slide-28.webp",
    "imageSha256": "763c3d37fd8cb15f01a6032afe358815e3bec1d91fd2dc1cb84bf0667e110c7c",
    "imageBytes": 305016,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "plant-guilds",
    "slide": 40,
    "sourceHeading": "Food Cover Also Competes",
    "sourceEnglish": [
      "Keep its vines away from the young fruit tree and retain a route for care. Its roots also use water and nutrients.  Where resources are tight, compare living cover with an ordinary mulch basin. Is this cover helping the tree establish?"
    ],
    "correctedTitle": "Ubhatata Nawo Uyancintisana",
    "correctedTarget": [
      "Gcina iziqu ezinabayo zobhatata kude nomuthi omncane wezithelo, ushiye nendlela yokuwunakekela. Izimpande zawo nazo zisebenzisa amanzi nezakhamzimba.  Lapho lezi zidingo zinganele, qhathanisa izitshalo eziphilayo ezimboza umhlabathi with an ordinary mulch basin. Lokhu okumbozayo kuyawusiza umuthi ukuthi umile kahle?"
    ],
    "sourceHash": "6962753386e4424417c03febef51ae7452ef69f35554985cd371681959af6a7d",
    "targetHash": "0d5c2bec8ed55fb10fdb5fb8b686af582ad3406fff9bea9e5027f77b4b4b9071",
    "imageUrl": "/course-decks/plant-guilds/zu-silent/slide-40.webp",
    "imageSha256": "0b2d026aa2ed5d49f8f18f81ccb056172bf5ad931475dff9d62a7afe503055fd",
    "imageBytes": 254394,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 6,
    "sourceHeading": "Seed Sovereignty",
    "sourceEnglish": [
      "Seed sovereignty does not live in a slogan.",
      "It lives in a dry packet, a written record and knowledge of how the seed behaves.",
      "Your household begins it. Neighbours extend it. The seasons make the local seed collection more useful.",
      "Which seed does your household already save best?",
      "Draw a small map of the homes near you. Beside each home, write one crop that household could bring to a seed exchange.",
      "Sovereignty needs three things: usable seed, written information and exchange."
    ],
    "correctedTitle": "Ubukhosi Bembewu",
    "correctedTarget": [
      "Ubukhosi bembewu abuhlali esiqubulweni.",
      "Buhlala ephaketheni elomile, emlandweni obhaliwe nasolwazini lokuthi imbewu iziphatha kanjani.",
      "Ikhaya lakho liyakuqala. Omakhelwane bayakunweba. Izizini zenza the local seed collection lube usizo kakhulu.",
      "Iyiphi imbewu ikhaya lakho eliyilondoloza kahle kakhulu?",
      "Dweba imephu encane yemizi eseduze nawe. Eduze komuzi ngamunye, bhala isitshalo lowo muzi ongasiletha ekushintshaneni ngembewu.",
      "Ubukhosi budinga izinto ezintathu: imbewu esebenzisekayo, ulwazi olubhaliwe nokushintshisana."
    ],
    "sourceHash": "f719285275d71c775d4c39b39d268b0b1a132f7fee09e86ab4388197f4651dde",
    "targetHash": "32ce52113b62d361af5da8d5fa30f9b167d88deb961cfd92c0cd31e1a45ffb9e",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-06.webp",
    "imageSha256": "0de9b72a9d7151e42dc8a2678b31bba260f82591147397937ab24cd6999c126e",
    "imageBytes": 327420,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 11,
    "sourceHeading": "Dry and Wet Processing",
    "sourceEnglish": [
      "There are two broad ways to process seed.",
      "Dry seed matures in a pod, head or cob. It is collected when fully mature.",
      "Seed inside a fleshy fruit must first be separated from the flesh.",
      "Brief fermentation is especially useful for tomato seed. It is not a rule for every wet-seeded crop.",
      "Think about the crops in your area. Which fit the dry method? Which fit the wet method?",
      "If you have seed or fruit nearby, sort the examples into these two types. Explain the difference by describing what the seed is like at harvest."
    ],
    "correctedTitle": "Indlela Eyomile Nendlela Emanzi",
    "correctedTarget": [
      "Kunezindlela ezimbili ezibanzi zokulungisa imbewu.",
      "Imbewu eyomile ivuthwa emgodleni, ekhanda noma esikhwebini. Iqoqwa lapho isivuthwe ngokuphelele.",
      "Imbewu engaphakathi kwesithelo esinenyama kufanele iqale ihlukaniswe nenyama.",
      "Ukuvutshelisa isikhashana kusiza kakhulu embewini katamatisi. Akuwona umthetho wazo zonke izitshalo ezinembewu emanzi.",
      "Cabanga ngezitshalo zasendaweni yakho. Yiziphi ezihambisana nendlela eyomile? Yiziphi ezihambisana nendlela emanzi?",
      "Uma unembewu noma izithelo eziseduze, zihlukanise zibe yilezi zinhlobo ezimbili. Chaza umehluko ngokuthi imbewu injani ngesikhathi sokuvuna."
    ],
    "sourceHash": "98ae47ac8c5dc58466f00ff9b1faf0bed9ef59baff4914190ebb240971fc5f83",
    "targetHash": "11dda76b68940f54cd5d5b956503cf569181ecb389fbb09e7043d38206286fd4",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-11.webp",
    "imageSha256": "ad1ddce863cbb2bf425ea81a46466f4a589b9c58db4a1a37efd364289172e8cc",
    "imageBytes": 343614,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 12,
    "sourceHeading": "Process Dry Seed",
    "sourceEnglish": [
      "Leave dry-seeded crops on the plant until the seed is fully mature.",
      "Collect it before weather, birds or bursting pods take the harvest.",
      "Remove chaff and damaged seed.",
      "Then spread the clean seed in a single layer in moving air and shade.",
      "What tells you that dry seed is mature enough to collect?",
      "If you have a dry pod or seed head, handle it. Listen for the seed. Compare green, flexible plant material with brown, brittle material.",
      "Wait for maturity. For final drying, use shade and airflow."
    ],
    "correctedTitle": "Lungisa Imbewu Eyomile",
    "correctedTarget": [
      "Shiya izitshalo ezinembewu eyomile kuze imbewu ivuthwe ngokuphelele.",
      "Qoqa ngaphambi kokuba isimo sezulu, izinyoni noma ukuqhuma kwemigodla kuthathe isivuno.",
      "Susa amakhoba nembewu eyonakele.",
      "Bese wendlala imbewu ehlanzekile ibe ungqimba olulodwa emthunzini lapho kuhamba umoya.",
      "Yini ekutshela ukuthi imbewu eyomile isivuthwe ngokwanele ukuthi iqoqwe?",
      "Uma unomgodla noma ikhanda lembewu elomile, libambe. Lalela umsindo wembewu. Compare green, flexible plant material with brown, brittle material.",
      "Linda ukuvuthwa. Ekomiseni kokugcina, sebenzisa umthunzi nokuhamba komoya."
    ],
    "sourceHash": "b572d42c74895d6168cd31499146fc479d1505878d5c13b1d7e669c066009978",
    "targetHash": "febc92f5853135fd6b7d3353892f6c24922411c03532c0251a6f498e9215d3bd",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-12.webp",
    "imageSha256": "ed9984ad8dd7f2b906806ee3c65b15bba4cf1b160699171d4b0fee0038c3c17a",
    "imageBytes": 354956,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 14,
    "sourceHeading": "Wet Processing for Tomato Seed",
    "sourceEnglish": [
      "Scoop tomato seed and flesh into a clean jar with a little water.",
      "Leave it open or loosely covered. Keep it out of direct sun.",
      "After two to three days, a light film and a sour smell may appear.",
      "Rinse promptly. Remove debris. Then spread the clean seed thinly to dry.",
      "Do not seal an actively fermenting jar.",
      "Think about the signs that tell you the process has begun. Also think about signs that would make you discard the batch.",
      "Find a jar, a sieve and a drying plate. When you are ready, start a small batch. Remember the order: scoop, ferment briefly, rinse and dry completely."
    ],
    "correctedTitle": "Indlela Emanzi Katamatisi",
    "correctedTarget": [
      "Kha imbewu katamatisi nenyama uyifake embizeni ehlanzekile namanzi amancane.",
      "Yishiye ivulekile noma imbozwe ngokuxega. Ingabi selangeni eliqondile.",
      "Emva kwezinsuku ezimbili kuya kwezintathu kungavela ulwelwesi oluncane nephunga elimuncu.",
      "Hlambulula ngokushesha. Susa udoti. Bese wendlala imbewu ehlanzekile ibe mncane ukuze yome.",
      "Do not seal an actively fermenting jar.",
      "Cabanga ngezimpawu ezikutshela ukuthi inqubo isiqalile. Cabanga nangezimpawu ezingenza ulahle iqoqo.",
      "Thola imbiza, isisefo nepuleti lokomisa. Uma usukulungele, qala iqoqo elincane. Khumbula ukulandelana: kha, vutshelisa isikhashana, hlambulula, bese womisa ngokuphelele."
    ],
    "sourceHash": "1ab161426c4a5eaed6ed015c13040711de7b99ad99b4b3fabdb763415b5b3afb",
    "targetHash": "a15e3f67943cb37a3090ab7026419845e4cb91c493d2de01a78cf83ba6984123",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-14.webp",
    "imageSha256": "6f142591496018079f3232e36616732cdb6788e3d439a8bd877ed085e0fe9441",
    "imageBytes": 381198,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 15,
    "sourceHeading": "Watch: Wet Processing for Tomato Seed",
    "sourceEnglish": [
      "Watch the whole process in order.",
      "A ripe tomato is opened. The seed and gel are scooped into a clean jar. Only a little water is added.",
      "The jar is left open or loosely covered for two to three days.",
      "When a light film and sour smell appear, the contents are poured through a sieve. The seed is rinsed until it is clean.",
      "Finally, the seed is spread in a single layer in the shade until completely dry.",
      "Repeat the steps to yourself: scoop, ferment briefly, rinse, dry completely."
    ],
    "correctedTitle": "Buka: Indlela Emanzi Katamatisi",
    "correctedTarget": [
      "Buka yonke inqubo ngokulandelana.",
      "Utamatisi ovuthiwe uyavulwa. Imbewu nejeli kukhelwa embizeni ehlanzekile. Kufakwa amanzi amancane kuphela.",
      "Imbiza ishiywa ivulekile noma imbozwe ngokuxega izinsuku ezimbili kuya kwezintathu.",
      "Lapho kuvela ulwelwesi oluncane nephunga elimuncu, okuqukethwe kuthelwa ngesisefo. Imbewu iyahlanzwa kuze kusale ehlanzekile.",
      "Ekugcineni, imbewu yendlalwa ibe ungqimba olulodwa emthunzini ukuze yome ngokuphelele.",
      "Phinda izinyathelo kuwe: kha, vutshelisa isikhashana, hlambulula, yomisa ngokuphelele."
    ],
    "sourceHash": "d757560c01f0b09446ae5dce280c611bbd3b84dd706c01a0d3fea538d675303f",
    "targetHash": "7aaed2257d6da5c0fb315f5c342b179ca648faec2ef826c81f6473ab55700c3a",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-15.webp",
    "imageSha256": "5b1ab6ecc3fea0071e65d5335e16cbaac2fe4f93a5cd14fc09eb87ac75d54f90",
    "imageBytes": 325586,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 20,
    "sourceHeading": "Ten-Seed Germination Test",
    "sourceEnglish": [
      "A seed packet can look perfect even when the seed is losing life.",
      "Ten seeds make the calculation easy.",
      "Keep them warm and moist. Do not submerge them in water.",
      "Then count the normal seedlings.",
      "Six out of ten is about sixty percent. That tells you to sow more heavily, use the seed only as a trial, or replace it.",
      "If eight seeds out of ten germinate, what percentage is that?",
      "The answer is eighty percent.",
      "Start a ten-seed test with an old packet. Write down the date and the day when you will count."
    ],
    "correctedTitle": "Hlola Ukuhluma Kwembewu Eyishumi",
    "correctedTarget": [
      "Iphakethe lembewu lingabukeka liphelele, kodwa imbewu ibe ilahlekelwa ukuphila.",
      "Imbewu eyishumi yenza ukubala kube lula.",
      "Yigcine ifudumele futhi imanzi. Ungayicwilisi emanzini.",
      "Bese ubala amahlumela ajwayelekile.",
      "Okuyisithupha kokuyishumi cishe kungamaphesenti angamashumi ayisithupha. Lokho kukutshela ukuthi sow more heavily, usebenzise imbewu njengokuhlola kuphela, noma uyishintshe.",
      "Uma imbewu eyisishiyagalombili kokuyishumi ihluma, singamaphesenti amangaki?",
      "Impendulo ingamaphesenti angamashumi ayisishiyagalombili.",
      "Qala ukuhlolwa kwembewu eyishumi ngephakethe elidala. Bhala the date and the day when you will count."
    ],
    "sourceHash": "be9f39f4c5a8ce21f99b65308949ce103d52e6d4eefeb34cb4d0462b8dc6dd2c",
    "targetHash": "892e87b79bd63b3280a857ea237a867f367452381372b7b0dc59933c069a3cc6",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-20.webp",
    "imageSha256": "36e1ddfff3c34871472592a63f83e88c53a96279f6847f557081eacfd4de49d9",
    "imageBytes": 359332,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "seeds-sovereignty",
    "slide": 24,
    "sourceHeading": "Field Action",
    "sourceEnglish": [
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
    "correctedTitle": "Isenzo Sasensimini",
    "correctedTarget": [
      "Khetha.",
      "Lungisa.",
      "Vikela.",
      "Qinisekisa.",
      "Lezo zenzo ezine zithwala a seed collection kusukela kule nsimu ziye kwisizini elandelayo.",
      "Qala ngesitshalo esisodwa futhi ukwenze kahle.",
      "Yisiphi isitshalo ozoqala ngaso?",
      "Sisho ngokuzwakalayo. Bese ukhetha isenzo esisodwa ozosenza ngokulandelayo.",
      "Isizini elandelayo isivele ingaphakathi kwembewu oyikhetha namuhla."
    ],
    "sourceHash": "847fbfdd47b41e461021fbb6490f4ff362d3c570ef81bcf6ba5d39b2abe46594",
    "targetHash": "d860a1e238bfdbc642c6ce939f556e0b38027fc29270eddfcde3cab04ee448d1",
    "imageUrl": "/course-decks/seeds-sovereignty/zu-silent/slide-24.webp",
    "imageSha256": "b9e3fc49f272d84bd325b97b7f8f82c7db6c69c3c5aeaa51d1497a60057ea650",
    "imageBytes": 236070,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "small-livestock",
    "slide": 2,
    "sourceHeading": "Why This Matters",
    "sourceEnglish": [
      "Small livestock can do work beyond producing meat, eggs, or honey.",
      "Chickens eat some insects and weed seeds. Their manure can become compost.",
      "Ducks scratch less than chickens, but can still damage plants.",
      "Bees and other pollinators help many crops. Each animal still needs suitable food, water, shelter and care."
    ],
    "correctedTitle": "Kungani Lokhu Kubalulekile",
    "correctedTarget": [
      "Imfuyo encane ingenza okunye ngaphandle kokukhiqiza inyama, amaqanda noma uju.",
      "Izinkukhu zidla ezinye izinambuzane nembewu yokhula. Umquba wazo ungenziwa i-compost.",
      "Amadada aklwebha kancane kunezinkukhu, kodwa nawo angalimaza izitshalo.",
      "Izinyosi nezinye izinambuzane ezithutha impova zisiza izitshalo eziningi. Isilwane ngasinye sisadinga ukudla okufanele, amanzi, indawo yokukhosela nokunakekelwa."
    ],
    "sourceHash": "5ed5beb5748edec81c4df35db948d52734b7814c91a597d3c0fa2ec4bcb7299e",
    "targetHash": "3f048eacfb150e459e0a3d4e50a269c08cfd3400527995a2b03b127f5e438f27",
    "imageUrl": "/course-decks/small-livestock/zu-silent/slide-02.webp",
    "imageSha256": "24b93d84d27ac90249d35b75a943612f0bbe7a6d356a8b4060711111d7943f6a",
    "imageBytes": 258854,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "small-livestock",
    "slide": 3,
    "sourceHeading": "Learning Outcomes",
    "sourceEnglish": [
      "By the end of this module, you will understand how chickens, ducks, bees, and guinea fowl fit into a working system.",
      "You will know when chickens help a bed, and when their scratching can cause damage.",
      "You will understand pollination, hive placement, and how livestock move nutrients around a farm."
    ],
    "correctedTitle": "Imiphumela Yokufunda",
    "correctedTarget": [
      "Ekupheleni kwalesi sifundo, uzokwazi ukuthi izinkukhu, amadada, izinyosi, ne-guinea fowl zingena kanjani ohlelweni olusebenzayo.",
      "Uzokwazi ukuthi izinkukhu zisiza nini umbhede, nokuthi ukuklwebha kwazo kungadala nini umonakalo.",
      "Uzoqonda ukuthuthwa kwempova, ukubekwa kwe-hive, how livestock move nutrients around a farm."
    ],
    "sourceHash": "f63633666255c2362036e5eb7a10b30a73cf453e127b44dbe5af5cd9df993e91",
    "targetHash": "ab120d6518549fa04d00aa366d6a30886eb68bebdfbd9dc057517b8d26a7a44a",
    "imageUrl": "/course-decks/small-livestock/zu-silent/slide-03.webp",
    "imageSha256": "b40e32d4e373fa362e9827733f6f7af0b946e2a062fb134c7a9b27d6999a2ca6",
    "imageBytes": 249148,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "small-livestock",
    "slide": 8,
    "sourceHeading": "Rotate the Tractor Across the Plot",
    "sourceEnglish": [
      "A chicken tractor is a moveable, floorless pen.",
      "Move it before the ground becomes bare, muddy or heavily covered with manure.",
      "The right time depends on the birds, soil and weather. Let the ground recover between visits.",
      "There is no single number of chickens that guarantees enough fertility for every plot."
    ],
    "correctedTitle": "Rotate the Tractor Across the Plot",
    "correctedTarget": [
      "I-chicken tractor iyihhoko elihambayo elingenaphansi.",
      "Lihambise ngaphambi kokuba umhlabathi ube yize, ube nodaka noma ugcwale umquba kakhulu.",
      "Isikhathi esifanele sincike ezinkukhwini, enhlabathini nasesimweni sezulu. Vumela umhlabathi ululame ngaphambi kokubuyisa izinkukhu.",
      "Alikho inani elilodwa lezinkukhu eliqinisekisa ukuvunda okwanele kuzo zonke izingadi."
    ],
    "sourceHash": "8f66431746b839ff2f01f6fdd3c49aca8354d0df1fbb569f4de4b8b5dd9fcaa5",
    "targetHash": "eeda727ff6aece88d2d6e3bbd9360d883982888b98ab814b4df21716dbc9ef97",
    "imageUrl": "/course-decks/small-livestock/zu-silent/slide-08.webp",
    "imageSha256": "2e4f9e56602a8653c69c38afd8ac8b3e1e97f3e617dee76efeb41200d2877032",
    "imageBytes": 285994,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "small-livestock",
    "slide": 11,
    "sourceHeading": "South Africa’s Native Honeybees",
    "sourceEnglish": [
      "South Africa has two native honeybee subspecies.",
      "The Cape honeybee is found in the Western Cape and parts of the Eastern Cape. The African honeybee is native to central and most of southern Africa.",
      "These broad natural ranges are not a guide for moving bees. The Department's control measures set a demarcation line for bee movement. Check current rules before moving bees or hives."
    ],
    "correctedTitle": "Izinyosi Zoju Zomdabu ENingizimu Afrika",
    "correctedTarget": [
      "INingizimu Afrika inezinhlobo ezimbili zezinyosi zoju zomdabu ezingaphansi kohlobo olulodwa.",
      "Inyosi yoju yaseKapa itholakala eNtshonalanga Kapa nasezingxenyeni zeMpumalanga Kapa. Inyosi yoju yase-Afrika idabuka enkabeni nasezingxenyeni eziningi zeningizimu ye-Afrika.",
      "These broad natural ranges are not a guide for moving bees. Imithetho yoMnyango ibeka umngcele olawula ukuhanjiswa kwezinyosi. Check current rules before moving bees or hives."
    ],
    "sourceHash": "25ba00b9662e4842ec84316100c95d27d9067748725bd35cdd4ee87180eec827",
    "targetHash": "535665a55290f112b2be9e8cf829a3ded5c28c5177751b600916e13e036fdf3a",
    "imageUrl": "/course-decks/small-livestock/zu-silent/slide-11.webp",
    "imageSha256": "d77ca0c1b4fbe46e99f3c51b8bedb34ab3bea85bfba2669dd5c3d36d4b05e1ec",
    "imageBytes": 325384,
    "width": 1440,
    "height": 5400,
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
{
  "moduleId": "reading-landscape",
  "slide": 14,
  "sourceHeading": "Cold Air Flows Downhill",
  "sourceEnglish": [
    "On a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes.",
    "Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice.",
    "Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.",
    "Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before choosing a permanent position."
  ],
  "correctedTitle": "Umoya Obandayo Wehla Ngomthambeka",
  "correctedTarget": [
    "Ngobusuku obucacile nobungenamoya, umoya obandayo ungehla ngomthambeka uqoqane ezindaweni eziphansi. Lezi zindawo zingabanda kakhulu kunemithambeka eseduze. Isithwathwa siyizinhlayiya zeqhwa ezakheka phezu kwendawo ebandayo. Inkungu iyodwa ayisho ukuthi sekwakheke lezo zinhlayiya zeqhwa, futhi isithwathwa singalimaza izitshalo kungabonakali iqhwa. Bheka iqhwa nomonakalo ezitshalweni, uqhathanise izindawo eziphansi nemithambeka, futhi uhlole amazinga okushisa aphansi lapho ukwazi khona. Maka izindawo lapho amakhaza noma umonakalo kuhlala khona isikhathi eside kunazo zonke. Gcina izitshalo ezizwela amakhaza zikude nezindawo ezibandayo ozibonile.",
    "Qhathanisa izindawo ongakhetha kuzo zenkulisa yezithombo kuyo yonke inkathi yesithwathwa yasendaweni. Hlola amarekhodi endawo okushisa okuphansi noma ubuze umeluleki wezolimo wendawo ngaphambi kokukhetha indawo ehlala njalo."
  ],
  "sourceHash": "f79c2625a05909b216a70cd068189b6eb1f58ad317e770153024ea6ecab8f0ba",
  "targetHash": "cbe310ce2f72c3a32c01493c71c626a14efd7f561ff6ea51008ef897abec9bd7",
  "imageUrl": "/course-decks/reading-landscape/zu-silent/slide-14.webp",
  "imageSha256": "262d51fe8a03b5bf46355b79d95a73eb0271f225c5082fd135c903fa71ae5562",
  "imageBytes": 491432,
  "width": 1440,
  "height": 5482,
  "reviewStatus": "unreviewed",
  "audioBinding": "none"
}
];

const ZULU_SILENT_SAFETY_IMAGE_PROOF = {
  'intro-permaculture:14': {
    imageUrl: '/course-decks/intro-permaculture/zu-silent/slide-14.webp',
    imageSha256: '0e4f8b3bfa31c0fa1bf9df3cd816f5dbf38bb3417c40b67211d9e53aa5048f6e',
    imageBytes: 465252, width: 1440, height: 5400,
  },
  'reading-landscape:4': {
    imageUrl: '/course-decks/reading-landscape/zu-silent/slide-04.webp',
    imageSha256: '579b64b6caeae8888bee14251257a53c69d7cf30693e8c04278f2341b35f9e7c',
    imageBytes: 280664, width: 1440, height: 5400,
  },
  'reading-landscape:7': {
    imageUrl: '/course-decks/reading-landscape/zu-silent/slide-07.webp',
    imageSha256: '9305960cbede78b02c3541baf22032366027a978e958ac9b8425606950de34e0',
    imageBytes: 347366, width: 1440, height: 5400,
  },
  'food-forest:7': {
    imageUrl: '/course-decks/food-forest/zu-silent/slide-07.webp',
    imageSha256: 'd0eeb63b0934a754cee0cff86154e4ae2622139ee249d12602f6dfc5b8093aa3',
    imageBytes: 326734, width: 1440, height: 5400,
  },
  'food-forest:11': {
    imageUrl: '/course-decks/food-forest/zu-silent/slide-11.webp',
    imageSha256: 'c9eb83cbdb6280b052b3ba696cca8c901fe89094a7930036c14839c9a3a85f77',
    imageBytes: 320508, width: 1440, height: 5400,
  },
  'food-forest:12': {
    imageUrl: '/course-decks/food-forest/zu-silent/slide-12.webp',
    imageSha256: 'cb5d59ce24f5cc9367e2410d1ae80d52f715cacda6c868f2671375359d3b8d48',
    imageBytes: 334446, width: 1440, height: 5400,
  },
} satisfies Record<string, Pick<IsiZuluSilentDeckDraftInput,
  'imageUrl' | 'imageSha256' | 'imageBytes' | 'width' | 'height'>>;

export const ISIZULU_SILENT_DECK_DRAFT_ROWS: readonly IsiZuluSilentDeckDraftInput[] = [
  ...PREVIOUSLY_RELEASED_SILENT_ROWS,
  ...ISIZULU_SILENT_DECK_TEXT_CANDIDATES.map((candidate) => {
    const proof = ZULU_SILENT_SAFETY_IMAGE_PROOF[`${candidate.moduleId}:${candidate.slide}` as keyof typeof ZULU_SILENT_SAFETY_IMAGE_PROOF];
    if (!proof) throw new Error(`Missing rendered isiZulu safety still proof for ${candidate.moduleId}:${candidate.slide}`);
    return { ...candidate, ...proof };
  }),
];
