import type { LocalizedLessonContent } from './course-localization';

/** Unreviewed packet proposals, kept separate from published learner translations. */
export const COURSE_TRANSLATION_DRAFTS: Record<string, LocalizedLessonContent> = {
  "seeds-sovereignty-l1": {
    title: "Kungani Ukulondoloza Imbewu Kubalulekile",
    body: "Imbewu yohlobo oluzinzile oluvulekele impova ingaveza izitshalo ezifanayo uma impova ilawulwa ngendlela efanele. Ama-hybrid e-F1 avela kubazali abakhethwe ngokukhethekile. Imbewu egcinwe kulezi zitshalo ingahluma, kodwa izitshalo zesizukulwane esilandelayo ziyahlukahluka; zingase zingabi nazo zonke izici obuzifuna.\n\nUbukhosi bembewu buhlanganisa ulwazi nokukhetha okudingekayo ukuze utshale, ulondoloze futhi wabelane ngembewu efanele. Bhala igama lesitshalo nohlobo lwaso ngeqoqo ngalinye.\n\nKhetha izitshalo ezinempilo nezinezici ozifunayo. Qala ngesitshalo osaziyo, bese ubuza umeluleki wokulondoloza imbewu ukuthi impova ingalawulwa kanjani nokuthi izitshalo zizokhethwa kanjani.",
    keyPoints: [
      "Izinhlobo ezizinzile ezivulekele impova zidinga ukulawulwa okufanele kwempova.",
      "Ubukhosi bembewu busho inkululeko yokunganciki enkampanini yembewu njalo ngesizini.",
      "Ukuhlukahluka kwezitshalo nezinhlobo zazo kungasiza ekuzivumelaniseni nokushintsha kwesimo sezulu, uma izinhlobo zifanele izimo zendawo.",
      "Khetha izitshalo ezinempilo nezinezici ozifunayo; landela isiqondiso sokulondoloza imbewu esiqondene nesitshalo ngasinye.",
    ],
    quiz: [
      {
        q: "Kungani imbewu egcinwe kutamatisi we-hybrid (F1) ingaqinisekisi ukuthi izitshalo zesizini elandelayo zizofana nesitshalo esingumzali?",
        options: [
          "Imbewu ye-hybrid ayikwazi ukumila nhlobo.",
          "I-hybrid ye-F1 iwumphumela wokuwela imigqa ethile yabazali; inzalo yayo ingahluka ngendlela engabikezeleki esitshalweni esingumzali.",
          "Ama-hybrid akhula ezindlini zokukhulisela izitshalo zezentengiselwano kuphela.",
          "Imbewu ye-hybrid ilahlekelwa amandla okuhluma ngokushesha lapho igcinwa.",
        ],
        correct: 1,
        rationale: "Ama-hybrid e-F1 atholakala ngokuwela imigqa ethile yezitshalo ezimbili ezingabazali. Imbewu yawo inenhlanganisela yofuzo engabikezeleki, ayiyona ikhophi ezinzile yesitshalo esingumzali.",
      },
      {
        q: "Uma ukhetha isitshalo esingumzali ozogcina kuso imbewu, yini okufanele iqondise ukukhetha kwakho?",
        options: [
          "Isitshalo esithele isithelo esisodwa esikhulu kunazo zonke.",
          "Isitshalo esinempilo kakhulu, esinezimpawu ezimbalwa kakhulu zesifo nesimo esihle, ngisho noma singakhiqizi isivuno esikhulu kunazo zonke.",
          "Isitshalo esivuthwe kuqala, kungakhathaliseki ukuthi sinempilo yini.",
          "Noma yisiphi isitshalo — ukukhetha akuthinti ikhwalithi yembewu yesikhathi esizayo.",
        ],
        correct: 1,
        rationale: "Ukhetha izici ofuna ziqhubekele esizukulwaneni esilandelayo. Impilo namandla esitshalo kubalulekile esikhathini eside kunokuvuna isithelo esisodwa esikhulu kunazo zonke.",
      },
    ],
  },
  "seeds-sovereignty-l2": {
    title: "Indlela Yokulondoloza Imbewu: Izindlela Ezomile Nezimanzi",
    body: "Imbewu eyomile kufanele ivuthwe ngaphambi kokuba iqoqwe. Susa amakhoba nembewu eyonakele, bese uqedela ukuyomisa emthunzini lapho kuhamba khona umoya.\n\nImbewu engaphakathi kwesithelo esinenyama idinga indlela eqondene naleso sitshalo. Imbewu katamatisi ingavutsheliswa isikhashana ukuze kususwe ijeli eyizungezile, bese iyahlanzwa futhi yomiswa ngokuphelele. Shiya imbiza lapho imbewu ivutsheliswa khona ivulekile noma uyimboze ngokuxega. Ukuvutshelisa akudingeki kuzo zonke izitshalo ezinembewu emanzi futhi akuqinisekisi ukuthi imbewu ayinazifo.\n\nIndlela impova ehamba ngayo nayo ibalulekile. Ummbila uthola impova ehamba nomoya futhi ungaxubana nezinye izinhlobo. Utamatisi uvame ukuzithuthela impova, kodwa ukuxubana kusengenzeka. Hlola isitshalo nohlobo lwaso ngaphambi kokuhlela ukusihlukanisa noma ukulondoloza imbewu yaso.",
    keyPoints: [
      "Izitshalo zendlela eyomile (ubhontshisi, ummbila, ubhekilanga) zomiswa esitshalweni ngaphambi kokuqoqwa.",
      "Ukuvutshelisa imbewu katamatisi kusiza ukususa ijeli; enye imbewu emanzi idinga indlela yayo yokuyilungisa.",
      "Utamatisi awudingi ukuhlukaniswa okukhulu; ummbila udinga ibanga elikhulu phakathi kwezinhlobo ukuze zigcine ubumsulwa bazo.",
      "Hlanza imbewu katamatisi esilungisiwe, bese uyomisa ngokuphelele ngaphambi kokuyigcina.",
    ],
    quiz: [
      {
        q: "Ukuvutshelisa imbewu katamatisi isikhashana kusiza ukususa ini?",
        options: [
          "Ukuvutshelisa kuthuthukisa ukunambitheka kwembewu.",
          "Kusiza ukususa ijeli ezungeze imbewu ngaphambi kokuyihlanza nokuyomisa.",
          "Kubulala zonke izinambuzane ezingaphakathi kwesithelo.",
          "Kuyisiko kuphela, akunamsebenzi osebenzayo.",
        ],
        correct: 1,
        rationale: "Ukuvutshelisa kusiza ukuhlukanisa imbewu katamatisi nejeli. Akuqinisekisi ukuhluma noma ukuthi imbewu ayinazifo; yomisa iqoqo, uligcine, bese ulihlola.",
      },
      {
        q: "Kungani ummbila udinga ibanga elikhulu kakhulu lokuhlukaniswa kunotamatisi ukuze uhlobo lugcine izici zalo?",
        options: [
          "Imbewu yommbila intekenteke kakhulu.",
          "Ummbila uthola impova ethwalwa umoya futhi ungaxubana kalula ngebanga; utamatisi uvame ukuzithuthela impova.",
          "Utamatisi awuxubani nempova ngaphansi kwanoma yiziphi izimo.",
          "Ummbila uqhakaza isikhathi esifushane.",
        ],
        correct: 1,
        rationale: "Umoya uthwala impova yommbila ibanga elide. Lokhu kuhlukile endleleni impova katamatisi ehamba ngayo, njengoba utamatisi uvame ukuzithuthela impova. Yile ndlela ehlukile yokuthuthwa kwempova eyenza kudingeke izindlela ezahlukene zokuhlukanisa izitshalo.",
      },
    ],
  },
  "seeds-sovereignty-l3": {
    title: "Ukomisa, Ukugcina Nokwabelana Ngembewu",
    body: "Yomisa imbewu eyomile kahle ngaphambi kokuyigcina: yifake emvilophini yephepha, hhayi kwepulasitiki, uyibeke endaweni enomthunzi nenomoya ohambayo — ungayibeki elangeni eliqondile noma endaweni evaliwe eshisayo. Izinto ezintathu ezilimaza amandla embewu okuhluma ukushisa, ukukhanya nomswakama. Yehlisa konke lokhu, imbewu ingahlala iminyaka.\n\nBhala emvilophini ngayinye igama lesitshalo, uhlobo nosuku imbewu eyalondolozwa ngalo. Gcina endaweni epholile, emnyama neyomile — isitsha esivaliwe esinelayisi elincane noma impuphu yobisi olomisiwe singasiza ukumunca umswakama.\n\nNgaphambi kwesizini entsha yokutshala, hlola iqoqo elincane ukuthi liyahluma yini ukuze unganciki embewini esilahlekelwe amandla okuhluma ungakuqapheli.\n\nHlela ukushintshisana ngembewu nomakhelwane kule sizini. Lokho ikhaya elilodwa elikulondoloze kahle, amakhaya amaningana angabelana ngakho — futhi izinhlobo ezahlukahlukene zeqembu lonke ziyakhula kukho konke ukushintshisana.",
    keyPoints: [
      "Yomisa imbewu emthunzini lapho kuhamba khona umoya; ungayibeki elangeni eliqondile noma endaweni evaliwe eshisayo.",
      "Gcina imbewu enelebula endaweni epholile, emnyama neyomile — ukushisa, ukukhanya nomswakama yizinto ezintathu ezilimaza amandla okuhluma.",
      "Hlola iqoqo elincane lembewu ukuthi liyahluma yini ngaphambi kokuncika kuyo ukuze utshale.",
      "Ukushintshisana ngembewu kwandisa izinhlobo ezahlukene zeqembu ngokushesha kunokulondoloza uwedwa.",
    ],
    quiz: [
      {
        q: "Yiziphi izinto ezintathu eziyinhloko ezilimaza amandla embewu egciniwe okuhluma?",
        options: [
          "Umoya, izinambuzane nesikhunta.",
          "Ukushisa, ukukhanya nomswakama.",
          "Ukubanda, ubumnyama nokoma.",
          "Ukuthinta inhlabathi, izinambuzane namagundane.",
        ],
        correct: 1,
        rationale: "Ukugcina imbewu ipholile, isemnyameni futhi yomile kunciphisa lezi zinto ezintathu — yingakho isitsha esivaliwe ekhabetheni elinomthunzi sisebenza kahle.",
      },
      {
        q: "Kungani kufanele uhlole iqoqo elincane lembewu egciniwe ukuthi liyahluma yini ngaphambi kwesizini yokutshala?",
        options: [
          "Kuyisidingo somthetho lapho kwabelwana ngembewu.",
          "Imbewu ingalahlekelwa amandla okuhluma ngesikhathi igciniwe ungakuqapheli; ukuhlola kusiza ukuba unganciki embewini engeke ikhule.",
          "Kuthuthukisa ukunambitheka kwembewu.",
          "Kudingeka embewini ye-hybrid kuphela.",
        ],
        correct: 1,
        rationale: "Ukuhlola ukuhluma kuveza imbewu esifile ngesikhathi igciniwe, ngaphambi kokuba uthembele kuyo ekutshaleni kwesizini yonke.",
      },
    ],
  },
  "intro-permaculture-l1": {
    "title": "Izimiso Ezintathu Zokuziphatha: Ukunakekela Umhlaba, Abantu Nokubuyisela Okusele",
    "body": "I-Permaculture isekelwe kuma-ethics amathathu. I-Earth Care isho ukuphatha inhlabathi, amanzi, izitshalo nezilwane njengezinhlelo eziphilayo okufanele zivikelwe, hhayi njengezinsiza okufanele zisetshenziswe zize ziphele. I-People Care isho ukuthi izidingo zomndeni wakho ziza kuqala, bese kulandela izidingo zomphakathi wakho. I-Fair Share isho ukuthatha lokho okudingayo kuphela, bese ubuyisela okusele ohlelweni — imbewu, ukudla, amanzi nolwazi.\n\nLa ma-ethics akuwona nje amazwi angenamsebenzi. Umlimi othengisa wonke amaqanda nayo yonke imifino, angashiyi lutho etafuleni lomndeni, uyeqa i-People Care. Umphakathi ovalela indawo yomthombo osetshenziswa ngokuhlanganyela wephula i-Fair Share.\n\nAma-ethics abalulekile ngoba akusiza wenze izinqumo lapho kungekho mithetho ecacile — njengalapho umakhelwane ecela ukwelusela izinkomo ngemva kwesomiso, noma lapho isikhukhula silimaza ama-swale akho. Faka la ma-ethics amathathu endleleni ocabanga ngayo ngaphambi kokwakha noma yini emhlabeni.",
    "keyPoints": [
      "I-Earth Care: vikela inhlabathi, amanzi nokwehlukahlukana kwezinto eziphilayo.",
      "I-People Care: izidingo zomndeni wakho ziza ngaphambi kokukhiqizela imakethe.",
      "I-Fair Share: buyisela okusele ohlelweni — imbewu, amanzi, ukudla nolwazi.",
      "Ama-ethics aqondisa izinqumo lapho kungekho mithetho ecacile."
    ],
    "quiz": [
      {
        "q": "Umlimi uthengisa wonke ama-mielies akhe asele, kodwa akashiyi lutho lokwenza i-compost noma lokugcina imbewu. Yiphi i-ethic angayilandeli kakhulu?",
        "options": [
          "I-Earth Care kuphela",
          "I-People Care kuphela",
          "I-Fair Share — akabuyiseli lutho ohlelweni",
          "Womathathu ngokulinganayo"
        ],
        "correct": 2,
        "rationale": "I-Fair Share isho ukubuyisela okunye kwalokho okuthathayo — kube imbewu, i-compost, noma ukudla kwabanye. Ukuthengisa konke ungashiyi lutho kuphula lowo mjikelezo."
      },
      {
        "q": "I-borehole inikeza umndeni wakho amanzi. Omakhelwane nabo bacela amanzi. Iyiphi indlela ebonisa kangcono womathathu ama-ethics?",
        "options": [
          "Thengisa ilungelo lokuthola amanzi kumuntu okhokha kakhulu.",
          "Gcina wonke amanzi e-borehole ukuze wandise indawo yokunisela.",
          "Thola ukuthi ukwabelana ngamanzi kuvumelekile yini nokuthi i-borehole ingakwazi yini ukusiza bonke abasebenzisi. Yilapho kuphela eningavumelana khona ngokwabelana ngokulinganayo bese niqhubeka nibheka izinga lamanzi.",
          "Vala i-borehole ukuze uvikele amanzi angaphansi komhlaba kuphela."
        ],
        "correct": 2,
        "rationale": "Qala uthole ukuthi yikuphi ukusetshenziswa kwamanzi okuvumelekile nokuthi umthombo ungakwazi yini ukusiza bonke abasebenzisi ngaphandle kokusebenzisa amanzi amaningi kakhulu. Uma ukwabelana kuvumelekile futhi kunamanzi anele, vumelanani ngendlela yokwabelana ngokulinganayo. Ukuqapha izinga lamanzi kukusiza ubone ushintsho; akukuniki imvume yokusebenzisa amanzi engeziwe."
      }
    ]
  },
  "intro-permaculture-l2": {
    "title": "Izimiso Eziyishumi Nambili: Ukuklama Ngokusebenzisana Nemvelo",
    "body": "UDavid Holmgren wabeka izimiso eziyishumi nambili zokuklama encwadini ethi *Essence of Permaculture*. UBill Mollison noDavid Holmgren basungula ndawonye umqondo we-permaculture. Kulesi sifundo, singaqala ngamaphuzu amathathu awusizo: bheka futhi ufunde ngokusebenzelana nomhlaba wakho — uwubheke isizini yonke ngaphambi kokwenza umsebenzi omkhulu wokumba noma wokushintsha umhlaba; bamba ugcine amandla — qaphela imvula, ilanga nezinto eziphilayo ezivela emhlabeni wakho ngaphambi kokuba zihambe; futhi sebenzisa imiphetho, wazise nezindawo eziseceleni — ulayini wocingo noma indawo eseceleni kwendlela kungaba indawo ewusizo yokubuka.\n\nKukhona nezinye izimiso okufanele uzazi: ungachithi lutho (izinsalela ziba umquba, umquba ube umhlabathi); khetha izixazululo ezincane nezihamba kancane (ibhakede linganisela amanzi embhedeni ngaphandle kukagesi); futhi sebenzisa ukwehlukahlukana kwezinto eziphilayo. Ukulimala kommbila yisichotho kuncike ekutheni isiphepho sinjani nokuthi ummbila ukhule kangakanani.\n\nKhetha izimiso ezimbili noma ezintathu ezihambisana nenkinga yakho enkulu, uzisebenzise. Ezinye uzoziqonda njengoba uqhubeka.",
    "keyPoints": [
      "Bheka umhlaba wakho isizini yonke ngaphambi komsebenzi omkhulu wokumba noma wokushintsha umhlaba.",
      "Bamba ugcine imvula, ilanga nezinto eziphilayo ngaphambi kokuba zihambe emhlabeni wakho.",
      "Imiphetho nezindawo eziseceleni kungaba izindawo eziwusizo zokubuka ukuthi yini ekhula kahle.",
      "Ukulimala kommbila yisichotho kuncike esiphephweni nasezingeni lokukhula kommbila."
    ],
    "quiz": [
      {
        "q": "Umlimi ufuna ukumba ama-swale ukuze abambe amanzi emvula. Yini okufanele ayenze kuqala, elandela isimiso esithi “bheka futhi ufunde ngokusebenzelana nomhlaba”?",
        "options": [
          "Yimba masinyane ngemva kwemvula yokuqala enhle",
          "Bheka lapho amanzi egeleza futhi ehlala khona okungenani kuyo yonke isizini yemvula",
          "Kopisha indlela umakhelwane ahlele ngayo ama-swale akhe",
          "Cabanga ukuthi uhlelo olulodwa lwama-swale lufanele yonke indawo"
        ],
        "correct": 1,
        "rationale": "Isizini yemvula ikukhombisa iziphepho ezingaphezu kwesisodwa, kodwa ukubuka kuyisinyathelo sokuqala kuphela. Ngaphambi kokumba, cela umeluleki wendawo oqeqeshiwe ahlole umhlabathi, umthambeka, ukugeleza kwamanzi nendlela ephephile amanzi angaphuma ngayo."
      },
      {
        "q": "Yikuphi ukuhlelwa okusebenzisa kangcono isimiso esithi “hlanganisa kunokuhlukanisa”?",
        "options": [
          "Izinkukhu zivalelwe kude nengadi",
          "Ingadi, izihlahla zezithelo nendawo yezinkukhu kuhlelwe ukuze izinkukhu zingene embhedeni ongenalutho ngemva kokuvuna; umlimi ahlole indlela ephephile yokuphatha umbhede ngaphambi kokuba izitshalo ezidliwayo zibuyele kuwo",
          "Isitshalo ngasinye sibekwe endaweni yaso ehlukile",
          "Zonke izilwane zigcinwa zingangeni endaweni elinywayo"
        ],
        "correct": 1,
        "rationale": "Ukuhlanganisa kubeka into ngayinye lapho isiza khona ezinye izinto eziseduze nayo. Lapha, izinkukhu zingadla ezinye izinambuzane futhi zengeze umquba, esikhundleni sokuhlala zinganyakazi esibayeni esisodwa. Umquba omusha ungaba namagciwane; ngakho hlola indlela ephephile yokuphatha umbhede ngaphambi kokuba kutshalwe futhi ukudla okuzodliwa."
      }
    ]
  },
  "intro-permaculture-l3": {
    "title": "Ama-Zone Nama-Sector: Ukuhlela Ipulazi Ngokuthi Uhamba Kangaki",
    "body": "Ama-zone nama-sector angakusiza unciphise ukuhamba nomsebenzi ongadingekile. Ama-zone asuka ku-0 aye ku-5, ngokuthi uvakashela indawo kangaki. I-Zone 0 yindlu. Kulesi sibonelo, i-Zone 1 iseduze kwendlu futhi inezinto ozikha kaningi, njengamakhambi nemifino yesaladi. I-Zone 2 yingadi enkulu nendawo yezinkukhu, evakashelwa kanye noma kabili ngosuku. I-Zone 3 yinsimu enkulu, evakashelwa masonto onke. I-Zone 4 i-semi-wild: izihlahla zezithelo nokudla kwezilwane okudinga ukunakekelwa ngezikhathi ezithile. I-Zone 5 ishiywa isesimweni semvelo.\n\nAma-sector akhombisa amandla afika evela ngaphandle kwendawo yakho: ilanga, umoya, imvula, izikhukhula nomlilo. Bheka ukuthi umoya onamandla uvame ukuvela ngakuphi epulazini lakho. Amarekhodi esiteshi sezulu esiseduze angakusiza uhlole uhlangothi lomoya. Bheka lapho amanzi emvula engena khona nalapho egeleza khona emhlabeni wakho. Dweba imicibisholo yalokho okubone ngempela.\n\nDweba ama-zone nama-sector ephepheni. Lokho kungaba isisekelo sokuqala sohlelo lwakho.",
    "keyPoints": [
      "Kulesi sibonelo, i-Zone 1 iseduze kwendlu futhi inamakhambi akhiwa kaningi.",
      "Ama-zone ahlela umsebenzi ngokuthi kudingeka uvakashele indawo kangaki.",
      "Ama-sector akhombisa amandla afika evela ngaphandle: ilanga, umoya, amanzi emvula, izikhukhula nomlilo.",
      "Umdwebo olula wama-zone nama-sector uyisiqalo sokuhlela."
    ],
    "quiz": [
      {
        "q": "Utshala amakhambi ku-Zone 3, insimu enkulu ekude nendlu. Iyiphi inkinga engavela?",
        "options": [
          "Amakhambi azokhula abe makhulu kakhulu.",
          "Ukuhamba ibanga elide kungasho ukuthi uwakha noma uwahlola kancane.",
          "Amakhambi azoxubana ngempova nezitshalo eziyinhloko.",
          "I-Zone 3 inelanga eliningi kakhulu kumakhambi."
        ],
        "correct": 1,
        "rationale": "Beka isitshalo osikha kaningi eduze kwendlela oyihamba nsuku zonke. Umbhede okude wengeza ukuhamba futhi ungahlolwa kancane."
      },
      {
        "q": "Ubonile ukuthi umoya olimazayo uvela enyakatho-ntshonalanga epulazini lase-Highveld. I-windbreak kufanele ibe kuphi?",
        "options": [
          "Emngceleni oseningizimu-mpumalanga.",
          "Emngceleni osenyakatho-ntshonalanga, phakathi komoya nezitshalo.",
          "Maphakathi nendawo yakho.",
          "Ama-windbreak awadingeki ngoba umoya uyashintsha ngesizini."
        ],
        "correct": 1,
        "rationale": "I-windbreak isebenza ngokuma phakathi komoya nendawo ongayifuni ilimale. Ibekwa ohlangothini umoya obonwe ngempela ukuthi uvela kulo. Lesi sibonelo asisho ukuthi wonke amapulazi ase-Highveld anomoya osuka enyakatho-ntshonalanga."
      }
    ]
  },
  "reading-landscape-l1": {
    "title": "Ukuqonda Ukugeleza Kwamanzi: Lapho Imvula Iya Khona Emhlabeni Wakho",
    "body": "Ngaphambi kokuvuna amanzi, qala ufunde ukuthi asevele eya kuphi. Ngesikhathi semvula enkulu, bheka usemhlabeni ophephile. Uma sekuphephile ngemva kwemvula, hamba uhlole umhlaba wakho. Bheka imifudlana emincane edalwe amanzi, izindawo lapho amanzi esabalala khona, lapho eba khona amachibi, nalapho ephuma khona emhlabeni wakho. Amanye amanzi amaningi adinga indlela ephephile yokuphuma ukuze angabangeli umonakalo.\n\nI-A-frame level ingakusiza umake amaphuzu asezingeni elifanayo futhi ulandele umugqa we-contour. Lezi zimpawu ziyizinto ozibonile; azilona uhlelo lomsebenzi wokushintsha umhlaba futhi azibonisi ukuthi ukumba kulungele le ndawo noma kuphephile. Ngaphambi kokumba i-swale, idamu noma esinye isakhiwo, cela ukuba indawo ihlolwe. Umhlabathi, umthambeka, ukugeleza kwamanzi, ukugeleza kwamanzi esiphepho nendlela ephephile yokuphuma kwamanzi konke kubalulekile. Cela umeluleki wendawo oqeqeshiwe akusize.\n\nAwukho umthetho owodwa wokubeka izakhiwo zamanzi osebenza kuyo yonke imithambeka. Bheka lapho amanzi ehamba khona nalapho eqoqana khona. Imigqa ye-contour ebekwe kabi ingakhulisa ukuguguleka komhlabathi, kanti umhlabathi omunca amanzi kancane ungagcina amanzi amaningi kakhulu. Khetha izakhiwo zamanzi ezifanele indawo yakho, futhi uhlele indlela ephephile yokuphuma kwamanzi amaningi.",
    "keyPoints": [
      "Ngesikhathi semvula, bheka usemhlabeni ophephile; hamba uhlole umhlaba uma sekuphephile.",
      "I-A-frame ingamaka amaphuzu asezingeni elifanayo, kodwa ayikhombisi ukuthi umsebenzi wokushintsha umhlaba uyayifanelekela yini indawo.",
      "Izakhiwo zamanzi nezindlela eziphephile zokuphuma kwamanzi amaningi kudingeka kuhlolwe indawo.",
      "Amanye amanzi amaningi adinga indlela ephephile yokuphuma ukuze avimbele umonakalo."
    ],
    "quiz": [
      {
        "q": "I-A-frame level ingakusiza uthole ini?",
        "options": [
          "Amaphuzu asezingeni elifanayo emgqeni we-contour",
          "Ukuthi kuphephile yini ukwakha i-swale kulo mthambeka",
          "Ukuthi umhlabathi ungamunca amanzi esiphepho angakanani",
          "Lapho kufanele kwakhiwe khona indlela yokuchitha amanzi edamini"
        ],
        "correct": 0,
        "rationale": "I-A-frame ingakusiza umake amaphuzu asezingeni elifanayo. Ayihloli umhlabathi, ukugeleza kwamanzi, ukugeleza kwamanzi esiphepho, noma ukuthi umsebenzi wokushintsha umhlaba uyayifanelekela yini indawo."
      },
      {
        "q": "Ubona amanzi egeleza ngokushesha emthambekeni e-KZN. Yini okufanele uyenze ngaphambi kokumba isakhiwo samanzi?",
        "options": [
          "Sibeke phezulu emthambekeni ngangokunokwenzeka",
          "Cela umeluleki wendawo oqeqeshiwe ahlole umhlabathi, umthambeka, ukugeleza kwamanzi nokugeleza kwamanzi esiphepho; nihlele nendlela ephephile yokuphuma kwamanzi amaningi.",
          "Sibeke lapho amanzi eqala ukubonakala khona",
          "Landela umthetho ofanayo osetshenziswa kwamanye amapulazi wokubeka phezulu, phakathi naphansi."
        ],
        "correct": 1,
        "rationale": "Umthetho wokubeka awukwazi ukukhombisa ukuthi isakhiwo siyayifanelekela yini indawo. Imigqa ye-contour ebekwe kabi ingakhulisa ukuguguleka komhlabathi, futhi amanzi amaningi adinga indlela ephephile yokuphuma."
      }
    ]
  },
  "reading-landscape-l2": {
    "title": "Indlela Ilanga Elihamba Ngayo, Umthunzi Nokuma Komthambeka: Ukusebenzisa Ukukhanya Kwelanga",
    "body": "Ezindaweni eziningi zaseNingizimu Afrika, ikakhulukazi ebusika, ilanga libonakala lisenyakatho. Indlela elihamba ngayo esibhakabhakeni iyashintsha ngokwenkathi nangendawo okuyo. Imithambeka ebheke enyakatho ivame ukuthola ilanga eliningi futhi ingafudumala yome kakhulu. Imithambeka ebheke eningizimu ivame ukuphola futhi ibe nomswakama omningi. I-frost ingaqoqana ezindaweni eziphansi eziyimigodi lapho kuhlala khona umoya obandayo. Bheka indawo yakho ngaphambi kokukhetha lapho uzotshala khona izitshalo ezizwela amakhaza noma ubeke khona izakhiwo.\n\nIlanga lasebusika libonakala liphansi futhi lisenyakatho kakhulu kunelasehlobo. Udonga noma i-shade cloth kungafaka umbhede emthunzini isikhathi eside ebusika kunasehlobo. Ngaphambi kokubeka into enganyakaziswa kalula, yima kuleyo ndawo ngo-8 ekuseni, emini, nango-4 ntambama ngosuku lwasebusika. Bheka lapho umthunzi uwela khona.\n\nI-pawpaw nezihlahla ezisencane ze-citrus ziyazwela ku-frost. Gcina izitshalo ezizwela amakhaza zingekho ezindaweni eziphansi ezaziwayo eziqongelela i-frost. Bheka ukuthi i-frost ivela kuphi endaweni yangakini ngaphambi kokutshala.\n\nTerminology questions: Please check whether “ilanga libonakala lisenyakatho,” “izindawo eziphansi eziyimigodi,” the borrowing `shade cloth`, and the borrowings `frost`, `pawpaw`, and `citrus` are clear in spoken isiZulu. Confirm the phrasing does not turn apparent sun position into a fixed direction rule or `low hollows` into south-facing slopes.",
    "keyPoints": [
      "Imithambeka ebheke enyakatho ivame ukuthola ilanga eliqondile eliningi; leyo ebheke eningizimu ivame ukuphola futhi ibe nomswakama omningi.",
      "Ilanga lasebusika libonakala liphansi futhi lisenyakatho kakhulu; hlola umthunzi kuleyo ndawo ngaphambi kokwakha.",
      "Umoya obandayo ungaqoqana ezindaweni eziphansi eziyimigodi; indlela umthambeka obheke ngayo ingesinye sezinto okufanele zibhekwe kuphela.",
      "Hlola ukuthi i-frost ivela kuphi endaweni yangakini ngaphambi kokubeka i-pawpaw noma izihlahla ezisencane ze-citrus ezizwela amakhaza."
    ],
    "quiz": [
      {
        "q": "Umlimi wasepulazini elincane lase-Highveld kufanele aqale abheke kuphi uma efuna indawo yesihlahla se-pawpaw esincane nesizwela i-frost?",
        "options": [
          "Indawo ephansi kunazo zonke lapho kuqoqana khona umoya obandayo",
          "Umgodi obandayo nosethunzini",
          "Indawo enelanga engaphandle komgodi owaziwayo oqongelela i-frost, ngemva kokuhlola ukuthi i-frost ivela kuphi kuleyo ndawo",
          "Indawo ekhethwe ngaphandle kokuhlola indawo"
        ],
        "correct": 2,
        "rationale": "Umoya obandayo ungaqoqana ezindaweni eziphansi. Indawo enelanga engaphandle kwendawo eyaziwayo eqongelela i-frost inganciphisa ingozi, kodwa ukubona ukuthi i-frost ivela kuphi endaweni yangakini yikho okufanele kuqondise ekukhetheni indawo yokugcina."
      },
      {
        "q": "Umlimi uhlela ukubeka i-shade cloth ohlangothini olusenyakatho lwengadi yakhe. Yini okufanele ayihlole ngaphambi kokuyiqinisa endaweni yayo?",
        "options": [
          "Lapho umthunzi wayo uwela khona embhedeni ebusika",
          "Ukuthi iyayisusa yini i-frost iyiyise kwenye indawo",
          "Ukuthi ilanga lihlala liqonde ngqo phezulu yini emini",
          "Ukuthi inciphisa yini kuphela ukuhwamuka kwamanzi ehlobo"
        ],
        "correct": 0,
        "rationale": "Ilanga lasebusika libonakala liphansi futhi lisenyakatho kakhulu. I-shade cloth ingashintsha isikhathi ilanga elifika ngaso embhedeni. Ngaphambi kokuyiqinisa endaweni yayo, hlola umthunzi okhona ngempela ngo-8 ekuseni, emini, nango-4 ntambama."
      }
    ]
  },
  "reading-landscape-l3": {
    "title": "Umoya, Isithwathwa Nokuma Komhlaba: Ukuqonda Amandla Angabonakali",
    "body": "Umoya ungalimaza izitshalo epulazini elincane. Indawo ovela kuyo namandla omoya olimazayo kuyashintsha kuye ngesifunda, inkathi yonyaka, amagquma nezikhala ezisemhlabeni wakho. Hamba uhlole umhlaba ngezinsuku ezinomoya. Bhala phansi ukuthi umoya olimazayo uvela ngakuphi nokuthi uthinta ini. Hlola amarekhodi esimo sezulu endawo ngaphambi kokunquma ukuthi kudingeka kuphi indawo yokukhosela emoyeni.\n\nNgobusuku obucacile nobungenamoya, umoya obandayo ungehla ngomthambeka uqoqane ezindaweni eziphansi. Lezi zindawo zingabanda kakhulu kunemithambeka eseduze. Indlela isithwathwa esenzeka ngayo nayo incike endaweni. Qhathanisa izindawo ongakhetha kuzo kuyo yonke inkathi yesithwathwa yasendaweni. Hlola amarekhodi endawo okushisa okuphansi, uma ekhona. Uma engekho, qhubeka ubheka okwenzeka ebusuku obubandayo futhi ubuze umeluleki wezolimo wendawo ngaphambi kokukhetha indawo ehlala njalo yezithombo ezizwela amakhaza.\n\nIsithwathwa siyizinhlayiya zeqhwa ezakheka phezu kwendawo ebandayo. Inkungu iyodwa ayisho ukuthi sekwakheke lezo zinhlayiya zeqhwa, futhi isithwathwa singalimaza izitshalo kungabonakali iqhwa. Bheka iqhwa nomonakalo ezitshalweni, uqhathanise izindawo eziphansi nemithambeka, futhi uhlole amazinga okushisa aphansi lapho ukwazi khona. Maka izindawo lapho amakhaza noma umonakalo kuhlala khona isikhathi eside. Gcina izitshalo ezizwela amakhaza zikude nezindawo ezibandayo ozibonile.\n\nKumatamatisi ahlaselwe yi-late blight, ukuhamba kahle komoya nelanga lasekuseni kungasiza amaqabunga ome. I-late blight isengasakazeka uma kuqhubeka isikhathi eside kubanda futhi kunomswakama. Ukususa umbhede uwuyise kwenye indawo kukodwa ngeke kusilawule lesi sifo; funa iseluleko sendawo ngempilo yezitshalo.",
    "keyPoints": [
      "Bheka ukuthi umoya olimazayo uvela ngakuphi endaweni yakho ngaphambi kokubeka indawo yokukhosela emoyeni.",
      "Ngobusuku obucacile nobungenamoya, umoya obandayo ungehla ngomthambeka uqoqane ezindaweni eziphansi.",
      "Qhathanisa umonakalo ezitshalweni namazinga okushisa ezindaweni ezahlukene ngemva kobusuku obubandayo; ukubona isithwathwa akuyona ukuphela kwendlela yokubona umonakalo waso.",
      "Ukuhamba komoya nokoma kwamaqabunga kungasiza ekunciphiseni amaqabunga amanzi, kodwa kukodwa akusilawuli i-late blight."
    ],
    "quiz": [
      {
        "q": "Umlimi kufanele aqale abheke kuphi lapho ekhetha indawo yenkulisa yezithombo ezizwela isithwathwa epulazini elincane lase-Highveld?",
        "options": [
          "Indawo ephansi eyaziwayo lapho kuqoqana khona isithwathwa",
          "Umugqa ophakeme wegquma ovulekele umoya, ngaphandle kokuhlola umoya",
          "Indawo enelanga nevikelekile emoyeni, engaphandle komgodi owubonile lapho kuqoqana khona isithwathwa, ngemva kokuhlola okwenzeka ebusuku obubandayo endaweni yakho",
          "Indawo enomthunzi omkhulu, ngaphandle kokuhlola isithwathwa"
        ],
        "correct": 2,
        "rationale": "Ngobusuku obucacile nobungenamoya, umoya obandayo ungaqoqana ezindaweni eziphansi. Qhathanisa izindawo ezingakhethwa zenkulisa yezithombo kuyo yonke inkathi yesithwathwa yasendaweni. Ngaphambi kokukhetha indawo ehlala njalo, hlola amarekhodi endawo okushisa okuphansi noma ubuze umeluleki wezolimo wendawo. Ukungaboni isithwathwa akusho ukuthi izitshalo azilimalanga yiso, futhi akukho ndawo esentabeni eqinisekisa ukuthi ngeke ibe nesithwathwa."
      },
      {
        "q": "Utamatisi womlimi wase-KZN uphathwa yi-late blight ngokuphindaphindiwe ngezikhathi ezibandayo nezinomswakama. Iyiphi indawo yombhede engasiza amaqabunga ome, kuhambisane nokufuna iseluleko sendawo ngempilo yezitshalo?",
        "options": [
          "Umhubhe ovaliwe ongenawo umoya odlulayo",
          "Indawo enomoya ohamba kahle nelanga lasekuseni",
          "Indawo ephansi eseduze nedamu",
          "Eduze kodonga oluseningizimu olunomthunzi"
        ],
        "correct": 1,
        "rationale": "Ukuhamba komoya nelanga lasekuseni kungasiza amaqabunga ome. Isimo sezulu esibandayo nesinomswakama esiqhubeka isikhathi eside singayisiza i-late blight ukuba isabalale. Ukususa umbhede uwuyise kwenye indawo kukodwa akulona uhlelo oluphelele lokulawula lesi sifo."
      }
    ]
  },
  "reading-landscape-l4": {
    "title": "Ukwenza Imephu Elula Yendawo: Uhlelo Lwakho Luqala Ephepheni",
    "body": "Ukuze wenze i-site map, udinga iphepha, i-tape measure, i-compass nesikhathi sokuhamba emhlabeni wakho. Hamba emngceleni wenze umdwebo wokuqala. Maka ukuthi umdwebo awukabi ngesikali kuze kube usuwahlolile amabanga awo. Maka inyakatho. Faka indlu, izihlahla, amanzi, imigwaqo nezicingo. Dweba imicibisholo ekhombisa umoya wasehlobo nowasebusika, imithunzi, nalapho amanzi egeleza khona uma lina.\n\nQaphela izindawo lapho i-frost ihlala khona isikhathi eside, nalapho umhlabathi unuka sengathi umanzi phakathi nezinyanga ezomile. Maka lapho i-khakibos noma i-blackjack ikhula khona kakhulu. Lezi zitshalo zingakhula ezindaweni eziphazamisekile, kodwa ukuba khona kwazo kukodwa akubonisi ukuthi umhlabathi ucindezelekile. Hlola umhlabathi ngaphambi kokunquma ukuthi leyo ndawo isho ukuthini ohlelweni lwakho.\n\nBeka ama-zone nama-sector ebalazweni elifanayo. Buyekeza umdwebo wakho ngokushintsha kwezinkathi zonyaka. Umdwebo wepensela owusebenzisayo uwusizo kakhulu kunomephu ephelele edwetshwe kanye kuphela.",
    "keyPoints": [
      "Ukuze wenze i-site map, udinga iphepha, i-tape measure, i-compass nokubuka indawo yakho kuphela.",
      "Maka ukugeleza kwamanzi, uhlangothi okuvela kulo umoya, izindawo eziqongelela i-frost, nezitshalo esezikhona.",
      "Maka lapho i-khakibos noma i-blackjack ikhula khona kakhulu ukuze uhlole umhlabathi eduze; lokho kukodwa akufakazeli ukuthi umhlabathi ucindezelekile.",
      "Beka ama-zone nama-sector ebalazweni eliyisisekelo ukuze uqedele uhlaka lomklamo."
    ],
    "quiz": [
      {
        "q": "Uyaqaphela ukuthi i-blackjack ikhula kakhulu ekhoneni elilodwa minyaka yonke. Yini okufanele uyenze ngokulandelayo?",
        "options": [
          "Umhlabathi lapho uvunde ngokweqile",
          "Amanzi angaphansi komhlaba asondele kakhulu kuleyo ndawo",
          "Maka leyo ndawo bese uhlola umhlabathi; lesi sitshalo sodwa asikwazi ukukhombisa ukuthi umhlabathi ucindezelekile",
          "I-blackjack ikhula emthunzini kuphela, ngakho kunamanzi avuzayo angabonakali"
        ],
        "correct": 2,
        "rationale": "I-blackjack ingakhula emhlabathini ophazamisekile, kodwa ukuba khona kwayo kukodwa akusho ukuthi umhlabathi ucindezelekile. Bheka futhi uhlole umhlabathi ngaphambi kokunquma ukuthi leyo ndawo isho ukuthini ohlelweni lwakho."
      },
      {
        "q": "Kungani kufanele umake ngokwehlukana umoya wasehlobo nowasebusika ebalazweni lendawo yakho?",
        "options": [
          "Uhlangothi okuvela kulo umoya alushintshi eNingizimu Afrika",
          "Zingavela ezinhlangothini ezahlukene, okungashintsha lapho kufanele kubekwe khona ama-windbreak nezitshalo ezizwela umoya",
          "Umoya ubalulekile ebusika kuphela e-Highveld",
          "Uhlangothi oluvela kulo umoya luthinta izakhiwo kuphela"
        ],
        "correct": 1,
        "rationale": "Njengoba uhlangothi okuvela kulo umoya lungashintsha ngokwenkathi, i-windbreak noma indawo yezitshalo esebenza kahle kwenye inkathi ingase ingafanele kwenye. Ngakho maka zombili izinkathi ngokwehlukana."
      }
    ]
  },
  "water-harvesting-l1": {
    "title": "Ama-swale Nama-berm: Ukubambezela Amanzi Agelezayo Emthambekeni",
    "body": "Olunye uhlobo lwe-swale luwumsele osendaweni elinganayo, ulandele umugqa we-contour. Lubambezela amanzi agelezayo bese luwasabalalisa, ukuze amanye amanzi akwazi ukungena emhlabathini ofanele. Amanye ama-swale aklanywa abe nomthambeka omncane olawulwayo, ohambisa amanzi amaningi kancane aye endaweni ephephile yokuphuma. Ukuthi iyiphi indlela efanele umhlaba wakho kuncike emhlabathini, emthambekeni, ekugelezeni kwamanzi nasekugelezeni kwamanzi ezikhukhula zemvula. Ngaphambi kokumba, cela umeluleki wendawo oqeqeshiwe ahlole umugqa, indlela yokuchichima nendawo ezokwamukela amanzi.\n\nUmhlabathi okhishiwe wakha i-berm ohlangothini olungaphansi komthambeka. Izihlahla zingatshalwa kuyo uma ukwakheka kwendawo kuvuma.\n\nIzihlahla ezitshalwe lapho zingasebenzisa umswakama ogcinwe emhlabathini ngemva kwemvula; lokhu kuncike endaweni.\n\nImvula enkulu ingagcwalisa i-swale ngokushesha kunokuba amanzi angene emhlabathini. Hlela indlela ephephile yokuchichima ngaphambi kokumba.\n\nIndlela yamanzi akumele igugule umthambeka noma ithumele amanzi alimazayo komakhelwane. I-swale noma idamu elingezansi kufanele likwazi ukuwamukela amanzi ngokuphepha.\n\nCela umeluleki wendawo oqeqeshiwe ahlole umhlabathi, umthambeka nokugeleza kwamanzi emvula enamandla. Isithombe asiwona umklamo wokwakha.\n\nUmthambeka wodwa awukutsheli ukuthi i-swale iyayifanelekela yini indawo. Umhlabathi, ukugeleza kwamanzi, umhlaba ongazinzile namanzi avela phezulu emthambekeni konke kubalulekile.\n\nGcina umhlabathi umbozekile. Thola ukuhlolwa kwendawo ngaphambi kokumba emhlabeni omqansa, omanzi noma ongazinzile. Imigoqo yotshani nama-terrace nakho kudinga ukwakhelwa indawo efanele.",
    "keyPoints": [
      "I-swale elandela umugqa olinganayo ingabambezela amanzi agelezayo ukuze angene emhlabathini ofanele; amanye ama-swale adinga umthambeka olawulwayo nendawo ephephile yokuphuma.",
      "Gcina umhlabathi umbozekile, uhlele nendlela ephephile yokuchichima.",
      "Ngaphambi kokumba, hlola umhlabathi, ukugeleza kwamanzi, umthambeka nokugeleza kwamanzi emvula enamandla.",
      "Isithombe esibonisa umqondo asiwona umklamo wokwakha."
    ],
    "quiz": [
      {
        "q": "Umlimi uhlele i-swale elandela umugqa we-contour olinganayo. Ngemva kwemvula enkulu, amanzi amaningi aqoqana kolunye uhlangothi. Yini okufanele ayihlole ngaphambi kokushintsha umsebenzi womhlaba?",
        "options": [
          "Ukuthi umsele ungajuliswa yini ngaphandle kokuhlola indawo",
          "Uhlelo oluhlosiwe namazinga alinganisiwe kanye nomeluleki wendawo oqeqeshiwe; kungenzeka kube nendawo ephansi ebingahlosiwe",
          "Ukuthi idamu elisha endaweni ephansi lizobamba konke yini ukuchichima",
          "Ukuthi umhlabathi kufanele ucindezelwe yini ukuze amanzi angangeni nhlobo"
        ],
        "correct": 1,
        "rationale": "I-swale eklanywe ukuba ilingane ku-contour kufanele isabalalise amanzi ngobude bayo. Ukugcwala ngokungalingani kungakhombisa indawo ephansi ebingahlosiwe, kodwa amanye ama-swale aklanywa ngamabomu abe nomthambeka oholela endaweni ephephile yokuphuma. Hlola uhlelo lwangempela, umhlabathi nendlela yokuchichima ngaphambi kokulushintsha."
      },
      {
        "q": "Umlimi ufuna ukulawula ukuguguleka komhlabathi endaweni ewummango. Yini okufanele ayenze ngaphambi kokumba?",
        "options": [
          "Ama-swale ajwayelekile ambiwe ajule ngangokunokwenzeka",
          "Gcina umhlabathi umbozekile, bese uhlola indawo ukuze kukhethwe izindlela ezifanele zokulawula ukuguguleka",
          "Idamu elikhulu ezansi ukuze libambe wonke amanzi agelezayo",
          "Cindezela ingaphezulu lomhlabathi ngerola"
        ],
        "correct": 1,
        "rationale": "Umthambeka wodwa awanele ukukhetha umsebenzi womhlaba. Umhlabathi, ukugeleza kwamanzi, ukuzinza komhlaba nokugeleza kwamanzi emvula enamandla nakho kufanele kuhlolwe."
      }
    ]
  },
  "water-harvesting-l2": {
    "title": "Amadamu Namachibi Epulazini: Ukugcina Amanzi Esikhathi Esomile",
    "body": "Idamu noma ichibi lingagcina amanzi agelezayo, kodwa inani lamanzi atholakalayo lincike emvuleni yasendaweni, endaweni eqoqa amanzi iwahambise edamini, emanzini alahleka endleleni nasekutheni usebenzisa amanzi angakanani.\n\nIzinkathi zemvula ziyahlukahluka eNingizimu Afrika. Sebenzisa amarekhodi endawo, uhlele izikhathi ezomile; akuqinisekisiwe ukuthi idamu liyohlala ligcwele.\n\nNgaphambi kokushintsha umfula noma enye indlela yemvelo yamanzi, noma ukwakha indawo yokugcina amanzi, buza isiphathimandla samanzi ukuthi iyiphi imvume edingekayo.\n\nIdamu lidinga ukuhlolwa kwendawo nokuklanywa ngumuntu oneziqu nolwazi olufanele. Amanzi agelezayo aya edamini, umhlabathi, izisekelo, ingozi engase yehlele abantu noma izindawo ezingezansi nedamu, kanye ne-spillway ephephile konke kubalulekile.\n\nUngacabangi ukuthi inani lemvula lonyaka likutshela ukuthi isikhukhula sizoba sikhulu kangakanani noma ukuthi uzogcina amanzi angakanani.\n\nAmanzi aphuma ngaphandle kokulawulwa angagugula udonga lwedamu futhi alubhidlize. Hlela indlela ephephile yokuphuma kwamanzi amaningi ngaphambi kokwakha.\n\nAmanzi angalahleka ngokuhwamuka nangokungena emhlabathini noma ukuvuza. Hlola izinga lamanzi, ubheke ukuvuza noma ukuguguleka komhlabathi.\n\nGcina i-spillway ingenamfucumfucu, futhi unakekele izitshalo ezimboze ibhange ngendlela eshiwo emklamweni. Ungatshali izihlahla odongeni lwedamu lomhlabathi.\n\nIzilwane zingalimaza amabhange zifake nobulongwe emanzini. Ukuba khona kwazo akusho ukuthi amanzi ahlanzekile noma aphephile.",
    "keyPoints": [
      "Idamu lidinga ukuhlolwa kwendawo nokuklanywa ngumuntu oneziqu nolwazi olufanele.",
      "Klama i-spillway ephephile ngaphambi kokwakha.",
      "Ngaphambi kokwakha, hlola izimvume zamanzi ezidingekayo.",
      "Nakekela izitshalo ezimboze ibhange, futhi ungatshali izihlahla odongeni lwedamu lomhlabathi."
    ],
    "quiz": [
      {
        "q": "Umlimi wakha udonga lwedamu olungenayo i-spillway. Ngemva kwesiphepho esingavamile, amanzi ayachichima. Yimuphi umphumela ongase ulandele?",
        "options": [
          "Amanzi anisela kahle amasimu angezansi",
          "Amanzi agobhoza phezu kodonga alugugule, kube nengozi yokuthi ludilike kakhulu",
          "Idamu lihlala ligcwele, amanzi aphumayo ahambe ngaphandle komonakalo",
          "Umthamo wokugcina amanzi ukhula unomphela"
        ],
        "correct": 1,
        "rationale": "Uma ingekho indlela yokuchichima eklanywe kahle, amanzi amaningi azitholela eyawo indlela yokudlula phezu kodonga. Lokho kugeleza okungalawulwa kugugula udonga, kuze kulubhidlize ekugcineni."
      },
      {
        "q": "Yisiphi isenzo esisiza ukuvikela idamu lomhlabathi?",
        "options": [
          "Idamu elijulile elingenazitshalo emabhange alo futhi elivezwe emoyeni naselangeni",
          "Nakekela izitshalo ezimboze ibhange ngokomklamo, ugcine ne-spillway ingenamfucumfucu",
          "Faka ungqimba lukakhonkolo kuyo yonke indawo bese uyimboza ngepulasitiki",
          "Yandisa indawo engaphezulu ukuze ukuhwamuka kusabalale ngokulinganayo"
        ],
        "correct": 1,
        "rationale": "I-spillway engenamfucumfucu namabhange anakekelwayo kusiza idamu lisebenze ngokomklamo walo. Izihlahla akufanele zitshalwe odongeni lwedamu lomhlabathi."
      }
    ]
  },
  "water-harvesting-l3": {
    "title": "Amathangi Amanzi Emvula Nokuwabamba Ophahleni: Ukuqoqa Nokuvikela Amanzi",
    "body": "Uphahla lwakho lungaqoqa amanzi emvula. Inani lamanzi lincike ngobukhulu bophahla, emvuleni nasekulahlekeni kwamanzi.\n\nNgaphambi kokuxhuma ithangi, hlola ukuthi impahla okwakhiwe ngayo uphahla ikulungele yini ukuqoqwa kwamanzi emvula.\n\nSebenzisa indawo yophahla uma uyibuka phezulu, kanye namarekhodi emvula endawo. Bese ubala namanzi angangeni kuma-gutter, aphambukiswayo noma aphuphuma ethangini eligcwele.\n\nInani lemvula lonyaka alikutsheli ukuthi mangakanani amanzi azotholakala ngesikhathi esomile. Qhathanisa amanzi angatholakala nalokho ohlela ukuwasebenzisela kona.\n\nAmanzi ageleza esuka ophahleni angaphatha uthuli, ubulongwe nokunye ukungcola. I-diverter yamanzi okuqala igcina amanye amanzi okuqala angangeni ethangini.\n\nInani lamanzi okufanele liphambukiswe lincike ophahleni nasohlelweni. Landela imiyalelo yomkhiqizi yokulinganisa nokunakekela i-diverter; alikho inani elilodwa elisebenza kuwo wonke amaphahla.\n\nI-diverter ayenzi amanzi asele aphephe ukuwaphuza.\n\nUsayizi wethangi uncike esidingweni samanzi, emvuleni, endaweni yophahla nobude bezikhathi ezomile.\n\nBhala izindlela ohlose ukusebenzisa ngazo amanzi, ulinganise isidingo sakho usebenzisa amarekhodi akho. Qhathanisa leso sidingo namanzi atholakalayo kuzo zonke izinkathi zonyaka.\n\nHlela ukuthi uzokwenzani lapho amanzi agciniwe esephela noma esencipha kakhulu. Igama lesifundazwe lodwa alikwazi ukukutshela usayizi wethangi olidingayo.\n\nVala ithangi, faka izisefo emigodini ukuze kungangeni izinambuzane, futhi unakekele uphahla, ama-gutter ne-diverter. Gcina amanzi emvula ehlukene namapayipi amanzi okuphuza.\n\nAmanzi abonakala ecacile asengaba namagciwane noma amakhemikhali. Buza isiphathimandla sezempilo sendawo ngokuhlolwa nokwelashwa okufanele ukusetshenziswa okuhlosiwe.\n\nIsihlungi esiyisisekelo sodwa asiqinisekisi ukuthi amanzi aphephile ukuwaphuza. Amanzi asetshenziswa ezitshalweni zokudla nawo adinga ukuhlolwa kokuphepha.",
    "keyPoints": [
      "Indawo yophahla, imvula, isidingo samanzi nokulahleka kwawo kunquma amanzi angagcinwa awusizo.",
      "Linganisa futhi unakekele i-diverter yamanzi okuqala ngokophahla lwakho.",
      "Amanzi acacile asengaba namagciwane noma amakhemikhali.",
      "Ukuhlolwa nokwelashwa kwamanzi kufanele kuhambisane nalokho ozowasebenzisela kona."
    ],
    "quiz": [
      {
        "q": "Yiluphi ulwazi oludingekayo ukuze ukhethe ithangi lamanzi emvula?",
        "options": [
          "Isifundazwe ipulazi elikuso kuphela",
          "Indawo yophahla, iphethini yemvula, isidingo samanzi nokulahleka kwamanzi lapho eqoqwa",
          "Inani lemvula yesiphepho esisodwa kuphela",
          "Intengo yethangi elikhulu kunawo wonke elitholakalayo kuphela"
        ],
        "correct": 1,
        "rationale": "Ukuhlela ithangi kudinga ukuqhathanisa amanzi angasetshenziswa nesidingo samanzi ngezikhathi zemvula nezomile. Usayizi owodwa obekelwe isifunda sonke awukwazi ukukwenza lokho."
      },
      {
        "q": "Kungani kubalulekile ukuphambukisa amanzi okuqala, ngisho noma amanzi ethangi ezosetshenziselwa ukunisela kuphela?",
        "options": [
          "Akubalulekile uma kuniselwa; kubalulekile emanzini okuphuza kuphela",
          "Amanzi okuqala athwala ubulongwe obunqwabelene, uthuli namagciwane abangela izifo angangcolisa izitshalo ezidliwayo",
          "Ane-asidi eningi futhi aguqula i-pH yomhlabathi ngokuhamba kwesikhathi",
          "Avimbela ithangi ukuba ligcwale ngokweqile ngesikhathi seziphepho"
        ],
        "correct": 1,
        "rationale": "Ukuphambukisa amanzi okuqala kunganciphisa ukungcola, kodwa akuqinisekisi ukuthi amanzi alandelayo aphephile. Hlola ikhwalithi yamanzi ngokwalokho ozowasebenzisela kona."
      }
    ]
  },
  "soil-health-l1": {
    "title": "Ukuqonda Umhlabathi Wakho: Isisekelo Sako Konke",
    "body": "Umhlabathi unezinhlobo eziningi zezinto eziphilayo. Amagciwane nesikhunta kusiza ukubolisa izinto eziphilayo nokujikeleza kwezakhamzimba.\n\nEzinye izinhlobo zesikhunta zisiza izimpande zimunce izakhamzimba. Imigudu yezibungu ingasiza amanzi nomoya kungene emhlabathini.\n\nBheka izimpande, ukwakheka komhlabathi nokuhamba kwamanzi, kanye nezinto eziphilayo ozibonayo emhlabathini.\n\nFaka umhlabathi namanzi embizeni yengilazi ecacile, ufake nenani elincane le-detergent efanele yokuhlakaza izinhlayiya zomhlabathi. Yivale uyinyakazise, bese uyishiya inganyakazi.\n\nIsihlabathi sihlala phansi kuqala. I-silt ilandela; ubumba lungahlala luntanta isikhathi eside.\n\nLolu wuvivinyo lokufunda olulinganiselwe. Izigaxa nomhlabathi wobumba ongakahlali phansi kungakudukisa. Uma kudingeka ukwazi ukuthungwa komhlabathi ngokunembile, sebenzisa ilabhorethri yomhlabathi.\n\nUngqimba olujiyile lwesihlabathi ngaphansi kwamanzi afiphele alukakutsheli izilinganiso zokugcina. Ezinye izinhlayiya ezincane kungenzeka zisantanta.\n\nQhathanisa izingqimba esezihlale phansi, futhi uzwe nokuthungwa komhlabathi osensimini.\n\nBhala lokho okubonayo nalokho okungakaqinisekiswa. Ungancomi indlela yokunisela noma yokwelapha umhlabathi ngebhodlela elilodwa kuphela.\n\nUkucinana komhlabathi, ukungaphumi kahle kwamanzi nokuncipha kwezinto eziphilayo kunganciphisa ukukhula kwezimpande nokuphila komhlabathi.\n\nUmbala ophaphathekile noma izibungu ezimbalwa akufakazeli ukuthi amakhemikhali abulale umhlabathi. Umsebenzi wezibungu nawo uyashintsha kuye ngomswakama nenkathi yonyaka.\n\nBheka amaphethini ezindaweni ezahlukene zensimu. Hlola umlando wokunakekela, ukuphuma kwamanzi nokukhula kwezitshalo ngaphambi kokukhetha ikhambi.",
    "keyPoints": [
      "Sebenzisa izimpawu eziningana ukuze uhlole isimo somhlabathi.",
      "Umbala womhlabathi nokubala izibungu kukodwa akuchazi imbangela yenkinga.",
      "Ukuhlola ngebhodlela kunikeza umbono oseduze kuphela wokuthungwa komhlabathi; akusikho ukuhlolwa komhlabathi okuphelele.",
      "Hlola ukuphuma kwamanzi, izimpande nomlando wokunakekela ngaphambi kokukhetha ikhambi."
    ],
    "quiz": [
      {
        "q": "Amanzi asengamafu ebhodleleni lomhlabathi, ngaphezu kongqimba lwesihlabathi. Yisiphi isiphetho okufanele umlimi asenze?",
        "options": [
          "Umhlabathi nakanjani udinga amanzi amancane",
          "Izinhlayiya ezincane kungenzeka zisantanta; kudingeka kuqhubeke ukubukwa",
          "Lonke ubumba seluhleli phansi kakade",
          "Isitshalo nakanjani sidinga i-gypsum"
        ],
        "correct": 1,
        "rationale": "Amanzi afiphele angase abe nezinhlayiya ezincane ezingakahlali phansi. Ukubheka kanye nje kusenesikhathi akukwazi ukukhombisa izilinganiso zokugcina noma indlela efanele yokwelapha."
      },
      {
        "q": "Umlimi uthola umhlabathi ominyene nezibungu ezimbalwa. Yisiphi isinyathelo esiwusizo esilandelayo?",
        "options": [
          "Cabanga ukuthi zonke izinto eziphilayo ezisemhlabathini zifile",
          "Faka ikhambi ngaphandle kokuhlola indawo",
          "Hlola ukuphuma kwamanzi, izimpande, umswakama nomlando wokunakekela",
          "Yeka ukuzama ngoba umhlabathi awukwazi ukuba ngcono"
        ],
        "correct": 2,
        "rationale": "Ukubheka izinto eziningana kusiza ukuthola ukuthi inkinga ingaba yini. Umsebenzi wezibungu uyashintsha kuye ngezimo, ngakho izibungu ezimbalwa zodwa azichazi imbangela yenkinga."
      }
    ]
  },
  "soil-health-l2": {
    "title": "Ukwenza Nokusebenzisa I-compost",
    "body": "I-compost yizinto eziphilayo ezibolile ngaphansi kwezimo ezilawulwayo.\n\nI-compost esilungile ingathuthukisa ukwakheka komhlabathi futhi ifake izakhamzimba kuwo.\n\nIsikhathi sokuthi i-compost ilunge siyashintsha kuye ngezinto ezifakiwe, umswakama, umoya nokushisa. Igama lesifundazwe noma inani elinqunyiwe lamasonto akusho ukuthi i-compost isilungile.\n\nHlanganisa ama-browns omile nama-greens amasha. Gwema izingqimba eziwugqinsi nezimanzi ezivimba umoya.\n\nUma inqwaba iba bushelelezi ngokushelela noma inuka kakhulu i-ammonia, faka ama-browns omile bese uyiphendula.\n\nHlola umswakama nomoya njengoba inqwaba ishintsha; iresiphi eyodwa ayifaneli zonke izingxube zezinto.\n\nUkuthi indawo emaphakathi nenqwaba iyashisa akufakazeli ukuthi yonke ingxenye yayo ithole ukwelashwa. Isikhathi, izinga lokushisa nendlela yokuphatha konke kubalulekile.\n\nUngafaki inyama, ubisi nemikhiqizo yobisi, izitshalo ezigulayo, indle yezilwane ezifuywayo noma izinto ezingcolile kule ndlela elula yasekhaya.\n\nUngacabangi ukuthi ukwenza i-compost ekhaya kuqeda yonke imbewu yokhula noma zonke izinto eziphilayo ezibangela izifo. Uma kudingeka ukuhlanzwa kwe-compost, sebenzisa inqubo eyamukelekile.\n\nGcina ama-pod embewu ye-wattle ngaphandle kwenqwaba ye-compost. Inqwaba evamile ingase ingayenzi yonke imbewu ingasakwazi ukuhluma.\n\nSebenzisa izinto ezihlanzekile kuphela, ezingakaze zelashwe. Amagxolo abola kancane; igama lawo lodwa aliqinisekisi ukuthi awangcolisiwe.\n\nHlola inqwaba, uyiphendule lapho idinga umoya owengeziwe noma ukuxutshwa. Yigcine inomswakama, ingagcwali amanzi.",
    "keyPoints": [
      "Linganisa ama-browns, ama-greens, umswakama nomoya.",
      "Ukushisa phakathi nenqwaba akufakazeli ukuthi yonke ingxenye yenqwaba ihlanzwe ngokwanele.",
      "Gcina ama-pod embewu nezinto ezingcolile kungangeni enqwabeni.",
      "Yahlulela ukuthi i-compost isilungile ngesimo sayo, hhayi ngohlelo lwesikhathi olumisiwe lwesifunda."
    ],
    "quiz": [
      {
        "q": "Inqwaba ye-compost yomlimi inuka kakhulu i-ammonia, imanzi futhi iyashelela. Yini okufanele ayenze?",
        "options": [
          "Faka izinto eziluhlaza ezengeziwe ezine-nitrogen eningi",
          "Faka izinto ezomile ezine-carbon eningi njenge-straw bese uphendula inqwaba",
          "Yeka ukuyiphendula uyiyeke iphole",
          "Faka amanzi engeziwe — iphunga lisho ukuthi yome kakhulu"
        ],
        "correct": 1,
        "rationale": "Inqwaba emanzi nebushelelezi ngokushelela ingase idinge umoya owengeziwe nezinto ezomile. Faka ama-browns omile bese uphendula inqwaba ukuze kungene umoya. Iphunga le-ammonia lingase futhi libonise ukuthi kunezinto eziningi ezine-nitrogen. Hlola ukuthi inqwaba ihlala imanzi kancane, ingacwili emanzini."
      },
      {
        "q": "Kungani kufanele ugcine ama-pod embewu ye-wattle ngaphandle kwenqwaba ye-compost evamile?",
        "options": [
          "Amagxolo enza yonke inqwaba ishise kakhulu",
          "Enye imbewu ingasinda bese isabalala lapho kusetshenziswa i-compost",
          "Ama-pod ahlala eheha umuhlwa",
          "Ama-pod akhipha igesi ebulala zonke izinto eziphilayo ezisemhlabathini"
        ],
        "correct": 1,
        "rationale": "Inqwaba evamile ingase ingayibeki yonke imbewu ezimweni eziyenza ingasakwazi ukuhluma. Ukukhipha ama-pod kunciphisa ingozi yokuthi imbewu isabalale ne-compost."
      }
    ]
  },
  "vegetables-staples-l1": {
    "title": "Ukulungisa Nokutshala Emibhedeni Yakho",
    "body": "Umhlabathi ominyene ulahlekelwa yizikhala zomoya. Izimpande zikhula kancane. Amanzi angena ngendlela ehlukile. Umbhede uba nzima ukuwusebenza inkathi ngayinye.\n\nUkuvikela kulula: yiba nezindlela ezihlala njalo, nombhede omncane ngokwanele ukuthi ufinyelele kuwo uvela ezinhlangothini zombili.\n\nUbubanzi obusebenzayo busuka kumitha elilodwa kuya kumamitha angu-1.2. Ngalobo bubanzi, ungafinyelela maphakathi uvela kunoma iyiphi indlela, izinyawo zakho zingangeni endaweni okukhulela kuyo izitshalo.\n\nManje cabanga ngamabhede akho. Ungafinyelela phakathi ngaphandle kokungena kuwo? Hamba uyokuzama lokhu ngaphambi kokutshala enye into.\n\nAwukho umumo wombhede owodwa ofanele yonke indawo.\n\nQala ngokuphazamisa umhlabathi kancane ngangokunokwenzeka ukuze uxazulule inkinga yakho.\n\nIndlela ye-no-dig ifanele inhlabathi yezingadi eminingi. Shiya ukwakheka komhlabathi kungaphazamisekile, wakhe ukuvunda phezu kwawo.\n\nUngawumbi ubumba olumanzi. Uma ukucinana noma ukungaphumi kahle kwamanzi kukukhulu, thola imbangela ngosizo lwendawo ngaphambi kokukhetha ukulima ujule.\n\nAmabhede aphakanyisiwe afanele umhlabathi omanzi, lapho amanzi edinga khona indawo yokuphuma.\n\nAmabhede acwile phansi afanele umhlabathi owomile, lapho ufuna ukubamba khona amanzi emvula uwagcine.\n\nNgemva kwemvula enkulu, bheka ukuthi amanzi ahlala kuphi noma ageleza ngakuphi. Hlanganisa lokho okubonile neseluleko ngomhlabathi nangokuphuma kwamanzi ngaphambi kokukhetha uhlobo lombhede.\n\nEzinye izitshalo azikuthandi ukuphazanyiswa kwezimpande. Zikhula kangcono uma zihlwanyelwa ngqo lapho zizokhulela khona. Izimbotyi, izaqathe nommbila kungena kulelo qembu.\n\nEzinye zikhula kangcono uma ziqala zisesitshalweni esincane endaweni evikelekile yokukhulisela izithombo, bese zitshalwa kwenye indawo. Utamatisi nezitshalo zohlobo lwe-brassica kungena kulelo qembu.\n\nSebenzisa iseluleko sebanga lokutshala esifanele isitshalo, uhlobo lwaso nezimo zendawo. Hlola iphakethe lembewu neseluleko somlimi wendawo. Njengoba izitshalo zikhula, bheka ukuthi aziminyene yini.\n\nNgaphambi kokutshala, maka indawo yombhede.\n\nUmbhede owodwa wokuzijwayeza: ububanzi obungamamitha angu-1.2 nobude obungamamitha amathathu.\n\nSebenzisa izikhonkwane nentambo. Maka unxande kanye nezindlela zokungena kuzo zombili izinhlangothi.\n\nBese ulungiselela umhlabathi wakho: qala nge-no-dig, bese umba ujule kuphela uma umhlabathi wakho ukudinga ngempela.\n\nUmugqa wentambo uguqula umbono ube yisinqumo. Uma usunezindlela, zigcine zikhona. Uma usunendawo yokukhulisela izitshalo, yivikele.\n\nLowo mbhede uba lula ukuwuthuthukisa inkathi ngayinye, ngoba uyeka ukuhamba phezu kwawo.",
    "keyPoints": [
      "Yenza imibhede ibe nobubanzi obungu-1–1.2 m ukuze ungadingi ukunyathela endaweni okukhulela kuyo izitshalo.",
      "Hlola ukucinana komhlabathi nokuphuma kwamanzi ngaphambi kokulima ujule; ungasebenzi ubumba olumanzi.",
      "Tshala kwenye indawo izitshalo ezidinga ukuqala zikhule zivikelekile; hlwanyela ngqo lezo ezingakuthandi ukuphazanyiswa kwezimpande.",
      "Izitshalo eziminyene azikhuli kahle; zinike isikhala esanele ngokwezimo zesimo sezulu sangakini."
    ],
    "quiz": [
      {
        "q": "Kungani umbhede wemifino kufanele ube nobubanzi obungu-1–1.2 m kunokuba ube banzi kakhulu?",
        "options": [
          "Imibhede ebanzi ithola ilanga eliningi kakhulu",
          "Ungafinyelela maphakathi uvela kunoma yiluphi uhlangothi ngaphandle kokunyathela endaweni okukhulela kuyo izitshalo, ngaleyo ndlela ugweme ukucinanisa umhlabathi",
          "Imibhede emincane ikhipha amanzi kangcono kuzo zonke izimo",
          "Kungumthetho ongaguquki ongenasizathu esisebenzayo"
        ],
        "correct": 1,
        "rationale": "Ukunyathela endaweni okukhulela kuyo izitshalo kucinanisa umhlabathi futhi kulimaze izimpande. Umbhede ongafinyelela kuwo uvela ezinhlangothini zombili ukusiza ukuba ungadingi ukunyathela kuwo."
      },
      {
        "q": "Yisiphi isitshalo esifaneleka kakhulu ukuhlwanyelwa ngqo kunokuba siqale sibe yisithombo bese sitshalwa kwenye indawo?",
        "options": [
          "Utamatisi, odinga ukuqala ukukhula kusenesikhathi",
          "Izitshalo zohlobo lwe-brassica, ezidinga ukuvikelwa zisencane",
          "Izimbotyi, ezingakuthandi ukuphazanyiswa kwezimpande",
          "Upelepele, othatha isikhathi eside ukuhluma"
        ],
        "correct": 2,
        "rationale": "Izimbotyi nezinye izitshalo ezikhula ngokushesha nezinezimpande ezizwelayo zingase zingamili kahle ngemva kokuphazanyiswa kokuzitshalisa kwenye indawo. Ukuzihlwanyela ngqo embhedeni kugwema ngokuphelele lokho kuphazamiseka."
      }
    ]
  },
  "vegetables-staples-l2": {
    "title": "Ukutshala Ngokulandelana Nokuxuba Izitshalo",
    "body": "Ukuhlwanyela ngokulandelana kuwumkhuba wokuhlela ikhalenda, akusona isitshalo esikhethekile.\n\nKhetha into umuzi wakho oyidla njalo ngempela. Bese uhlwanyela isilinganiso esincane sayo, uphinde wenze njalo.\n\nTshala umugqa omfushane njalo ngemva kwamaviki amabili kuya kwamathathu.\n\nLokhu kunganciphisa ukumoshakala ngesikhathi isivuno sisiningi kakhulu. Kungaletha ukudla okusha isikhathi eside futhi kusabalalise umsebenzi kuyo yonke inkathi, esikhundleni sokuwenza wonke ngesikhathi esisodwa.\n\nUkuhlwanyela ngezikhathi ezihlukene kunganciphisa ingozi yokulahlekelwa yikho konke ngesikhathi esisodwa. Kodwa akukuqinisekisi ukuvuna uma izimo ezinzima ziqhubeka.\n\nYisiphi isitshalo esikhula ngokushesha ongasihlwanyela ngamaqoqo amancane? Khetha esisodwa, bese uqala ukusihlwanyela kuleli sonto.\n\nNansi indlela esebenza ngayo.\n\nHlwanyela iqoqo lokuqala. Ngemva kwamaviki amabili kuya kwamathathu, hlwanyela elesibili. Bese uhlwanyela elesithathu, bese elesine.\n\nUma isikhathi sokukhula kwesitshalo sikuvumela, ukuvuna kwamaqoqo kungaqala ukuhlangana. Iqoqo lokuqala alihlali lilungele ukuvunwa ngesikhathi kuhlwanyelwa iqoqo lesine.\n\nAmaviki amabili kuya kwamathathu ayisiqalo sesigqi sokuhlwanyela, akuwona umthetho. Isitshalo samaqabunga senkathi epholile singathatha isikhathi eside. Ukushisa kungasheshisa ukukhula noma kubangele ukwehluleka.\n\nBheka okwenzeka engadini yakho, bese ulungisa isikhawu sokuhlwanyela. Lelo khono lokubuka nokulungisa libalulekile.\n\nUkutshala izitshalo ezahlukene ndawonye akukhona ukuminyanisa izitshalo nje. Isitshalo ngasinye sidinga umsebenzi waso nesikhala esanele sokuwenza.\n\nI-Three Sisters iyisibonelo esivela emasikweni okulima abantu boMdabu baseMelika.\n\nUmmbila unikeza ukuphakama nesakhiwo.\n\nIzimbotyi zikhwela ummbila futhi zingagcinwa njengomthombo wamaprotheni.\n\nIthanga lisabalala phansi, lenze umthunzi emhlabathini futhi lisize ukuwugcina unomswakama.\n\nIsikhathi sokutshala sibalulekile. Qala ngokutshala ummbila ukuze uqine ngokwanele ukuthwala izimbotyi lapho seziqala ukukhwela.\n\nLezi zitshalo zisengancintisana. Zinike isikhala, amanzi nokukhanya okufanele. Izimbotyi zibopha i-nitrogen ngosizo lwamagciwane asezimpandeni, kodwa ungacabangi ukuthi zondla ummbila ngokushesha; izakhamzimba ezisezinsaleleni zitholakala lapho sezibola.\n\nUmuzi ungase ube nesikhathi sokushoda kokudla: amasonto lapho ukudla okugcinwe khona sekuncipha ngaphambi kokuba isivuno esilandelayo silungele ukuvunwa.\n\nKowenu leso sikhathi singafika ngemva kokuphela kommbila ogciniwe. Singafika ngaphambi kokuba imifino yasebusika ilungele ukuvunwa. Singafika nangesikhathi esomile lapho amanzi enciphisa okungatshalwa engadini.\n\nUngakopeli ikhalenda lomunye umuntu. Qala ngokusho izinyanga zakho.\n\nZibhale phansi. Bese ukhetha isitshalo nesikhathi sokusihlwanyela ukuze ukudla kutholakale ngaleso sikhathi sokushoda.\n\nLokho ukuhlela usuka ekudingeni uye emuva. Kwenza umehluko phakathi kwengadi ebonakala ikhiqiza nomuzi othola ukudla.",
    "keyPoints": [
      "Hlwanyela ngezigaba ezilandelanayo futhi ulungise isikhawu kuye ngesitshalo, isimo sezulu nokusetshenziswa kokudla emzini.",
      "I-Three Sisters ivela emasikweni okulima abantu boMdabu baseMelika.",
      "Sebenzisa amarekhodi okudla kwasekhaya ukuze uthole futhi uhlelele isikhathi okungase kushode ngaso ukudla.",
      "Izitshalo ezitshalwe ndawonye zisengancintisana; hlela isikhala, isikhathi namanzi."
    ],
    "quiz": [
      {
        "q": "Kungani kufanele uhlwanyele ulethisi ngamaqoqo amancane njalo ngemva kwamaviki amabili kuya kwamathathu, kunokuwuhlwanyela wonke ngesikhathi esisodwa?",
        "options": [
          "Kusetshenziswa imbewu encane isiyonke",
          "Kuletha ukuvuna okuqhubekayo esikhundleni sesivuno esiningi ngesikhathi esisodwa kulandelwe isikhathi sokushoda",
          "Ulethisi uhluma kangcono uma uhlwanyelwa ngamaqoqo amancane",
          "Kunciphisa ukuhlaselwa izinambuzane"
        ],
        "correct": 1,
        "rationale": "Ukuhlwanyela okuningi ngesikhathi esisodwa kwenza izitshalo zilungele ukuvunwa ngesikhathi esifanayo. Ukuhlwanyela ngezigaba kusabalalisa ukuvuna ukuze kuhambisane nalokho umuzi ongakusebenzisa."
      },
      {
        "q": "I-nitrogen esezinsaleleni zesitshalo sezimbotyi ingatholakala nini kwezinye izitshalo?",
        "options": [
          "Ngokushesha njalo lapho izimbotyi zithinta ummbila",
          "Lapho izinto eziphilayo ezisemhlabathini zibolisa lezo nsalela",
          "Kuphela lapho amaqabunga ethanga ezenza umthunzi phezu kwazo",
          "Ayikwazi nhlobo ukutholakala"
        ],
        "correct": 1,
        "rationale": "Izimbotyi zibopha i-nitrogen ngosizo lwamagciwane afanele asezimpandeni. I-nitrogen esezinsaleleni zazo itholakala lapho sezibola; ukutshala izimbotyi eduze kommbila akuqinisekisi ukuthi ummbila uzoyithola ngokushesha."
      }
    ]
  },
  "vegetables-staples-l3": {
    "title": "Izitshalo Eziyinhloko Zokudla: Ummbila, Ubhontshisi Nezitshalo Zezimpande",
    "body": "Isitshalo esiyisisekelo sikufanele ukutshalwa uma sondla umuzi nangemva kosuku lokuvuna.\n\nSinikeza amandla okudla noma amaprotheni. Singagcinwa, noma sihlale emhlabathini size sisidinge. Sivame nokuthwala umlando wesiko.\n\nUkuthembela esitshalweni esisodwa kukushiya usengozini. Izitshalo eziyisisekelo ezimbili noma ngaphezulu zikunika izindlela ongakhetha kuzo lapho isimo sezulu noma izinambuzane zidala umonakalo.\n\nTshala okungenani ezimbili, hhayi esisodwa.\n\nYisiphi isitshalo esiyisisekelo umuzi wakho oncike kuso kakhulu njengamanje? Uma singavuni, yisona esingawulimaza kakhulu umuzi wakho ngokushoda kokudla; cabanga ngesinye esingahambisana naso.\n\nIsitshalo ngasinye esiyisisekelo singasiza ngezimo ezihlukene.\n\nUmmbila unikeza amakhalori futhi ungomiswa ugcinwe. Ummbila ovulekele impova yezinye izitshalo zohlobo olufanayo ungakuvumela ugcine imbewu yakho, uma ulawula ukuhlangana kwempova nokukhetha izitshalo zembewu.\n\nIzimbotyi nezindumba zinikeza isivuno samaprotheni esingagcinwa.\n\nUbhatata ungakhula ubekezelele ukoma ngezinga elithile ngemva kokwakheka kwezimpande zawo ezigcinela ukudla. Udinga amanzi emasontweni okuqala nangesikhathi kwakheka lezo zimpande; ukuntuleka kwamanzi ngalezo zikhathi kunganciphisa isivuno. Amaqabunga awo amancane nawo ayadliwa.\n\nAmadumbe abhekana nomhlabathi omanzi kakhulu, lapho ezinye izitshalo eziyisisekelo zingase zingakhuli kahle khona.\n\nQaphela ukuthi lezi zitshalo azihluleki ezimweni ezifanayo. Yilokho okubalulekile.\n\nUkukwazi ukuqhubeka nezinhlelo akusho ukuthi akukho lutho oluzohluleka.\n\nKusho ukuthi ukwehluleka kwesitshalo esisodwa akupheli uhlelo lokudla lomndeni wakho.\n\nUkuthembela esitshalweni esisodwa kubeka umuzi engcupheni eyodwa.\n\nIzitshalo ezimbili noma ngaphezulu zikunika izindlela eziningi zokuqhubeka uthola ukudla.\n\nIzitshalo ezahlukene zisebenzisa amanzi, umhlabathi nezinkathi ngezindlela ezahlukene. Lo mehluko unikeza ezinye izindlela uma isimo sishintsha.",
    "keyPoints": [
      "Ummbila ovulelekile empoveni ungakuvumela ugcine imbewu; imbewu ye-hybrid ayiqinisekisi ukuthi isivuno sesizukulwane esilandelayo sizofana nesitshalo esingumzali.",
      "Izimbotyi ziwumthombo obalulekile wamaprotheni; ziyakhiqiza, zingagcinwa, futhi zibopha i-nitrogen ngosizo lwamagciwane afanele asezimpandeni.",
      "Ubhatata ungabekezelela ukoma ngezinga elithile ngemva kokwakheka kwezimpande ezigcinela ukudla, kodwa udinga amanzi ekuqaleni; amaqabunga amancane ayadliwa.",
      "Amadumbe (taro) ayisitshalo esiyisisekelo sendabuko esingatshalwa ezindaweni ezimanzi kakhulu zase-KZN nasogwini, kodwa ukufaneleka kwendawo kudinga iseluleko sendawo."
    ],
    "quiz": [
      {
        "q": "Kungani ungakhetha ummbila ovulelekile empoveni kunowohlobo lwe-hybrid uma uhlela ukugcina imbewu yakho?",
        "options": [
          "Izinhlobo ezivulekele impova zikhiqiza kakhulu",
          "Imbewu ye-hybrid ayiqinisekisi ukuthi izitshalo zesizukulwane esilandelayo zizofana nesitshalo esingumzali",
          "Ummbila ovulekele impova uhlale ubekezelela ukoma kangcono",
          "Izinhlobo ze-hybrid azikwazi ukutshalwa eNingizimu Afrika"
        ],
        "correct": 1,
        "rationale": "Imbewu egcinwe esitshalweni se-F1 hybrid ingahluma, kodwa izitshalo zesizukulwane esilandelayo zingahluka. Uhlobo oluzinzile oluvulekele impova, lapho impova ilawulwa ngendlela efanele, lunikeza umphumela ongalindeleka kangcono uma kugcinwa imbewu."
      },
      {
        "q": "Kungani amadumbe (taro) engaba yisitshalo esiyisisekelo esihle kwezinye izingxenye zase-KZN?",
        "options": [
          "Ikhula kahle kakhulu emhlabathini onesihlabathi nowomile kakhulu",
          "Ibekezelela umhlabathi omanzi ngaphezu kommbila, ngakho ingase ifanele izindawo ezisogwini nezithola imvula eningi",
          "Ayidingi nhlobo ukulinywa",
          "Yisona sodwa isitshalo esiyisisekelo esingagcinwa iminyaka eminingi"
        ],
        "correct": 1,
        "rationale": "Amadumbe athanda umhlabathi omanzi kunalapho ummbila ungakhula kahle khona, ngakho agcwalisa indawo ekhethekile ezinye izitshalo eziyisisekelo ezingayifaneleki kahle."
      }
    ]
  },
  "vegetables-staples-l4": {
    "title": "Qaphela Futhi Ulawule Izinambuzane Nezifo",
    "body": "Ukwanda kwezinambuzane ezilimaza izitshalo kuvame ukuba nesizathu.\n\nIzitshalo zingacindezeleka. Uhlobo olulodwa lwesitshalo lungabusa indawo. Noma ukusetshenziswa kabanzi kwamakhemikhali kungase kube sekususe izilwane ezidla izinambuzane ezazikusiza.\n\nNgakho ngaphambi kokwelapha noma yini, bheka lonke uhlelo.\n\nIngabe isitshalo sishoda ngamanzi? Ingabe umhlabathi uminyene noma untula izakhamzimba? Ingabe izilwane ezidla izinambuzane sezisiza kule nkinga?\n\nIqabunga eliphuzi alisho ngokuzenzakalelayo ukuthi kunesinambuzane. Kungabangelwa amanzi, ukondleka noma ukulimala kwezimpande. Thola ukuthi iyiphi imbangela ngaphambi kokuthatha isinyathelo.\n\nLandela izinyathelo ezine ngokulandelana.\n\nOkokuqala. Bheka. Bheka iphethini yokulimala, ngaphansi kweqabunga, isiqu nezitshalo eziseduze.\n\nOkwesibili. Hlola ukucindezeleka kwesitshalo. Hlola umswakama womhlabathi, izimpande, isikhala phakathi kwezitshalo, izakhamzimba nokuphuma kwamanzi.\n\nOkwesithathu. Vikela okusizayo. Izinambuzane ezizuzisayo zenza umsebenzi obungase uwenze wena.\n\nOkwesine. Yilapho kuphela osuthatha khona isinyathelo; qala ngesenzo esilula kunazo zonke esifanele. Ukususa izinambuzane ngesandla, ukubeka izithiyo noma ukushintsha indlela yokunakekela izitshalo kungasiza. Hlola ukuthi isenzo siyayifanele yini inkinga, bese ubheka umphumela.\n\nUma kudingeka ukwelapha ngomkhiqizo, sebenzisa umkhiqizo obhaliswe ukuthi usetshenziswe kuleso sitshalo nakuleso sinambuzane, bese ulandela yonke imiyalelo eselebulini lawo. Lokhu kuhlanganisa nemikhiqizo ye-neem. Hlola imiyalelo yokuzivikela kanye nesikhathi sokulinda ngaphambi kokuvuna. Ungazenzeli izingxube noma usebenzise imithamo enamandla kunaleyo eselebulini.\n\nZitshele iqiniso ngokuthi yisiphi isinyathelo ovame ukusishiya.",
    "keyPoints": [
      "Thola imbangela ngaphambi kokwelapha umonakalo.",
      "Hlola amanzi, izimpande, izakhamzimba nezinambuzane ezizuzisayo.",
      "Sebenzisa izindlela ezifanele zokususa izinambuzane noma zokunakekela izitshalo, bese ubheka umphumela.",
      "Uma kudingeka ukwelapha ngomkhiqizo, sebenzisa obhaliswe kuleso sitshalo nakuleso sinambuzane, ulandele ilebula lawo."
    ],
    "quiz": [
      {
        "q": "Uma inkinga yezinambuzane idinga umkhiqizo wokwelapha, yini okufanele iqondise ukusetshenziswa kwawo?",
        "options": [
          "Ingxube enamandla eyenziwe ngaphandle kokulandela ilebula",
          "Umkhiqizo obhaliswe kuleso sitshalo nakuleso sinambuzane, osetshenziswa ngokulandela ilebula lawo",
          "Noma yimuphi umkhiqizo ochazwa ngokuthi ungowemvelo",
          "Umthamo womakhelwane wesinye isitshalo"
        ],
        "correct": 1,
        "rationale": "Isitshalo, isinambuzane, umthamo, imiyalelo yokuzivikela nesikhathi sokulinda ngaphambi kokuvuna konke kubalulekile. Ukuthi umkhiqizo ungowemvelo akuwenzi ngokuzenzakalelayo uphephe noma ufanele uma usetshenziswa ngendlela engalethwe ilebula."
      },
      {
        "q": "Amaqabunga esitshalo sohlobo lwe-brassica somlimi aphenduka aphuzi. Ngaphambi kokucabanga ukuthi izinambuzane ziyimbangela, yini okufanele ayihlole kuqala?",
        "options": [
          "Ukuthi empeleni inkinga ibangelwa izakhamzimba zomhlabathi noma ukunisela",
          "Ukuthi isigaba senyanga sisifanele yini isikhathi sokwelapha",
          "Ukuthi umakhelwane wakhe unenkinga efanayo yini",
          "Ukuthi ama-aphid ayimbangela yini ikakhulukazi"
        ],
        "correct": 0,
        "rationale": "Amaqabunga angaphuzi ngenxa yezimbangela ezahlukene. Inkinga yezakhamzimba zomhlabathi noma yokunisela idinga isixazululo esihlukile kwesesinambuzane. Ukuhlola kuqala kusiza ukugwema ukwelapha okungadingekile."
      }
    ]
  },
  "food-forest-l1": {
    "title": "Izingqimba Eziyisikhombisa: Indlela Ihlathi Elizondla Ngayo",
    "body": "Ihlathi lezitshalo zomdabu ligcwalisa indawo kusukela emagatsheni aphakeme kakhulu kuze kufike ezimpandeni.\n\nIzitshalo ezahlukene zisebenzisa ukukhanya nomswakama okutholakala ezingeni ezikhula kulo.\n\nI-food forest ilingisa le ndlela isebenzisa izitshalo ezikhiqizayo.\n\nUmphumela awusona isitshalo esisodwa emugqeni owodwa; kuba izingqimba eziningi eziwusizo ezikhula ndawonye.\n\nCabanga ngophahla lwezihlahla ezinde, izihlahla ezincane, izihlahlana nezitshalo ezineziqu ezithambile.\n\nIzitshalo ezimboza umhlabathi zivikela ingaphezulu lawo, izitshalo zezimpande zikhula ngaphansi kwalo, kanti izitshalo ezikhuphukayo zidinga izisekelo ezifanele.\n\nUkuphakama nezikhala kuncike ezitshalweni nasendaweni. Lezi yizingxenye zokuhlela, azizona izilinganiso zokuphakama ezimisiwe.\n\nIsibonelo sokuqala sase-Highveld sifaka i-Wild Fig noma i-pecan ngaphezu kukalamula, i-naartjie ne-black mulberry.\n\nSibeka i-Cape gooseberry ne-Wild Medlar kanye nemifino, i-wild garlic, ubhatata ne-granadilla.\n\nThatha lokhu njengesibonelo sokuhlela kuphela, hhayi imvume yokutshala zonke lezi zitshalo. Qinisekisa ukuthi isitshalo siyini, siyakwazi yini ukumelana nesithwathwa, sizoba sikhulu kangakanani, nokuthi ayikho yini imingcele yendawo ngaphambi kokutshala.\n\nIzitshalo ezisencane zidinga ukunakekelwa zisakhula: hlola umswakama, lawula ukhula futhi uzivikele ekulimaleni.\n\nNjengoba izitshalo zikhula, umthunzi namaqabunga awelayo kushintsha izimo ezingaphansi kwazo.\n\nHlola ukuncintisana phakathi kwezitshalo nokufinyelela kuzo. Thena, nciphisa noma ulungise izitshalo ezingezansi lapho okubukayo kukukhombisa ukuthi kudingeka; uhlelo aluyeki ukudinga ukunakekelwa ngosuku olumisiwe.",
    "keyPoints": [
      "Izingxenye eziyisikhombisa zokuhlela zingahlanganisa izitshalo eziwusizo ezikhula ngobude obuhlukene.",
      "Izitshalo zingancintisana ngokukhanya, amanzi nezakhamzimba.",
      "Ukunakekelwa ngesikhathi izitshalo zimila nangemva kwalokho kuncike ezimweni ozibonayo.",
      "Qinisekisa ukuthi izitshalo ziyifanele indawo yangakini ngaphambi kokukopisha noma yisiphi isibonelo sokutshala."
    ],
    "quiz": [
      {
        "q": "Ukhula luncintisana kakhulu nezitshalo ezisencane ezikhula ezingxenyeni ezingezansi. Yini okufanele iqondise isenzo esilandelayo?",
        "options": [
          "Linda kuze kube unyaka wesihlanu",
          "Faka ezinye izitshalo ngaphandle kokubheka ukuthi akhona yini amanzi anele",
          "Hlola izitshalo ezithintekayo bese ulawula ukuncintisana kwazo nokhula",
          "Cabanga ukuthi zonke izingxenye eziyisikhombisa ziyazinakekela"
        ],
        "correct": 2,
        "rationale": "Bheka ukuncintisana okwenzekayo nesimo sezitshalo. Ikhalenda elimisiwe lesikhathi sokukhula alikwazi ukukutshela ukuthi yiziphi izitshalo ezidinga ukunakekelwa manje."
      },
      {
        "q": "Amaqabunga awileyo nomthunzi kungasiza kanjani ukuvikela umswakama womhlabathi?",
        "options": [
          "Kuqinisekisa ukuthola amanzi angaphansi komhlaba",
          "Kunganciphisa ukulahleka kwamanzi engaphezulu lomhlabathi",
          "Kuqinisekisa isivuno esikhulu ngelitha ngalinye kuzo zonke izinhlelo",
          "Kwenza kungasadingeki ukuhlola ukuthi izitshalo zidinga ukuniselwa yini"
        ],
        "correct": 1,
        "rationale": "Umthunzi ne-mulch efanele kunganciphisa ukuhwamuka kwamanzi engaphezulu lomhlabathi. Isidingo samanzi sezitshalo nokunakekelwa kwazo zisamila kusadinga ukunakwa."
      }
    ]
  },
  "food-forest-l2": {
    "title": "Ukukhetha Izinhlobo Zezitshalo Zama-food forest ENingizimu Afrika",
    "body": "Ngaphambi kokukhetha izitshalo, hlola imvula yasendaweni, isithwathwa, ukushisa, umhlabathi nokutholakala kwamanzi.\n\nUmango ungonakaliswa yisithwathwa. I-quince idinga amakhaza asebusika afanele ukuze ithele izithelo ngokuthembekile.\n\nIgama lesifunda noma indawo evikelekile yodwa akwanele. Qinisekisa isitshalo ngasinye nohlobo lwaso ngokweseluleko esithembekile sendawo.\n\nUhlu lokuqala luhlanganisa i-pecan, i-walnut ne-indigenous fig; i-apple, i-pear, i-plum, i-black mulberry ne-loquat; i-rosemary, i-Wild Medlar, i-Cape gooseberry ne-Barbados cherry.\n\nLolu hlu alusona isincomo esisebenza kuzo zonke izindawo. Hlola isitshalo ngasinye ngokuphathelene nesithwathwa, umhlabathi, ubukhulu esizofinyelela kubo nohlu lwezitshalo olugunyazwe endaweni.\n\nQhubeka ulandela imingcele ekhona yezomthetho neyephrojekthi. Ungatshali isitshalo ngokubuka isithombe kuphela.\n\nIzibonelo zokuqala zezindawo ezifudumele zihlanganisa i-mango, i-avocado, i-Natal Mahogany, i-banana, i-pawpaw, i-litchi, i-Wild Fig, i-Barbados cherry ne-Wild Dagga.\n\nI-Marula, i-Mopane ne-baobab nazo zikhona ezibonelweni zase-Limpopo. Kusafanele kuhlolwe ukuthi ziyifanele yini indawo ngayinye.\n\nUkuba wusizo kwesihlahla akusho ukuthi singadliwa. Qinisekisa ukuthi isitshalo siyini nokuthi siphephile yini ukusetshenziswa; isithombe sendawo asiwona umhlahlandlela wokuhlonza ukudla.\n\nIzitshalo zomdabu eziyifanele indawo zingasiza indawo yokuhlala yezilwane nezinye izinto eziphilayo njengengxenye yomklamo.\n\nKhetha izitshalo ezifanele imvelo yakini nomsebenzi owusizo wesitshalo ngasinye. Lesi sifundo asibeki iphesenti elithile elisekelwe emthonjeni.\n\nVikela izitshalo zemvelo esezikhona. Ungaguquli indawo enotshani bemvelo obunempilo ibe yi-food forest ngoba nje izihlahla ziwusizo kwezinye izindawo.",
    "keyPoints": [
      "Qondanisa isitshalo ngasinye nohlobo lwaso nendawo yangempela.",
      "Qinisekisa ukuthi isitshalo siyini, siphephile yini ukusetshenziswa, nokuthi yimiphi imingcele yendawo esebenzayo manje.",
      "Isibonelo sesifunda asiyona imvume yokutshala zonke izitshalo ezisohlwini lwaso.",
      "Sebenzisa izitshalo zomdabu eziyifanele indawo, futhi uvikele izindawo zemvelo ezikhona."
    ],
    "quiz": [
      {
        "q": "Umlimi ufuna ukutshala umango osencane endaweni lapho kuba khona isithwathwa esinamandla. Iyiphi ingozi okufanele ayicabangele?",
        "options": [
          "Uzochuma — indawo imvikela esithwathweni",
          "Uzothela kusenesikhathi ngenxa yokushintsha kwamazinga okushisa",
          "Kungenzeka ubulawe noma ulimale kabi yisithwathwa, ikakhulukazi usengumuthi omncane",
          "Uyasinda uma umbozwe nge-mulch eningi, kodwa kudingeka utshalwe kabusha minyaka yonke"
        ],
        "correct": 2,
        "rationale": "Umango omncane ungalinyazwa yisithwathwa. Hlola izimo zangempela zendawo uthole neseluleko esithembekile sendawo; ungacabangi ukuthi indawo evikelekile iyayisusa le ngozi."
      },
      {
        "q": "Kungani kufanele ufake izitshalo zomdabu eziyifanele indawo yakho emklamweni?",
        "options": [
          "Zihlala zikhiqiza ukudla okuningi ngemitha-skwele ngayinye",
          "Zingasiza izindawo zokuhlala zasendaweni, izinambuzane ezithutha impova nezinye izilwane zasendle",
          "Zonke izitshalo ezilethwe zivela kwezinye izindawo azikho emthethweni",
          "Azidingi ukunakekelwa zisamila"
        ],
        "correct": 1,
        "rationale": "Khetha izitshalo ngokwemvelo yakini nangomsebenzi wazo. Lokhu akubeki iphesenti elilodwa elisebenza yonke indawo futhi akususi isidingo sokuhlola ukuthi izitshalo ziyifanele yini indawo."
      }
    ]
  },
  "food-forest-l3": {
    "title": "Ukusungula I-food forest: Bheka Bese Ulungisa",
    "body": "Qala ngokuhlola indawo, amanzi atholakalayo nokunakekela ongakwazi ukukwenza. Vikela umhlabathi oveziwe kusenesikhathi.\n\nIzitshalo zesikhashana ezisiza ezinye zingase zinikeze indawo yokukhosela nezinto eziwusizo zokuzisika, lapho lokhu kufanele khona.\n\nIzihlahla eziyinhloko nezingqimba ezingezansi zingatshalwa njengoba izimo zivuma. Akudingeki ulinde kuze kube sekugcineni ukuze utshale izitshalo ezimboza umhlabathi; gwema izitshalo ezincintisana nezihlahla ezisencane.\n\nQala ngendawo ongakwazi ukuyinisela nokuyinakekela. Hlola izitshalo esezikhona ngaphambi kokususa noma yini.\n\nLapho kufanele khona, amakhadibhodi angenalutho abekwe ngaphansi kwe-mulch efanele angasiza ukunciphisa ukukhula kwezinto ongazifuni. Vumela amanzi angene emhlabathini futhi ushiye indawo engenalutho ezungeze iziqu zezihlahla.\n\nHlela izikhala ngokobukhulu isitshalo esizofinyelela kubo sesikhulile. Lungiselela izitshalo zasenkulisa ithuba elilandelayo elifanele lokutshala.\n\nBheka ukuthi umthunzi, izimpande namanzi atholakalayo kuthinta kanjani izitshalo ezingomakhelwane.\n\nI-Comfrey ne-wild garlic zikhona esibonelweni sokuqala sokutshala izitshalo ezingaphansi; hlola ukuthi ziyifanele yini indawo yakho ngaphambi kokuzisebenzisa.\n\nThena noma unciphise izitshalo zesikhashana ezisiza ezinye uma kudingeka, usebenzise izindlela ezifanele uhlobo ngalunye. Izingcezu ezihlanzekile ezifanele zingabuyiselwa njenge-mulch. Ungalindi unyaka othile omisiwe uma ukuncintisana sekuvele kulimaza izitshalo.\n\nKhetha isikhathi sokutshala lapho umswakama womhlabathi nesimo sezulu esilindelekile kungasiza izitshalo zimile.\n\nImvula ingasiza, kodwa hlola umswakama endaweni yezimpande futhi ugcine olunye uhlelo lokunisela uma kudingeka. Gwema ukutshala emhlabathini ogcwele amanzi.\n\nHlola izitshalo ezisencane ngemva kokutshala. Isikhathi sokuvuna nezinto zangaphandle ezidingekayo kuncike ohlotsheni lwesitshalo, endaweni nasekunakekelweni; asikho isiqinisekiso sokuthi kuzovunwa ngonyaka wesihlanu.",
    "keyPoints": [
      "Vikela umhlabathi oveziwe kusenesikhathi.",
      "Hlela ukulandelana kokutshala ngokwezimo nokunakekela okutholakalayo.",
      "Hlola umswakama endaweni yezimpande ngisho nangesikhathi semvula.",
      "Lawula ukuncintisana njengoba kuvela; izinsuku zokuvuna aziqinisekisiwe."
    ],
    "quiz": [
      {
        "q": "Umlimi ubeka amakhadibhodi angenalutho ngaphansi kwe-mulch efanele lapho kukhula khona utshani. Angasiza ngani?",
        "options": [
          "Ukwakha ungqimba oluvimba umswakama namanzi ukuba kungene emhlabathini",
          "Ukuvimba ukukhanya nokusiza ukunciphisa utshani njengoba amakhadibhodi ebola; hlola ukuthi utshani buyaphinde bukhule yini",
          "Ukwenza isisekelo esiqinile ukuze izinkuni ezichotshoziwe zinganyakazi",
          "Ukubuyisela ukushisa phezulu ukuze kufudumale umhlabathi"
        ],
        "correct": 1,
        "rationale": "Amakhadibhodi angaphansi kwe-mulch efanele angavimba ukukhanya futhi anciphise ukukhula kotshani. Utshani obukhona bungaphinde bukhule, ngakho hlola indawo. Vumela amanzi angene emhlabathini futhi ungabeki i-mulch ithinte iziqu zezihlahla."
      },
      {
        "q": "Umlimi kufanele acabangele nini ukuthena noma ukunciphisa izitshalo zesikhashana ezisiza ezinye?",
        "options": [
          "Ngosuku olumisiwe kuphela njalo ngonyaka",
          "Lapho ukuncintisana okubonwayo kukwenza kudingeke, kusetshenziswa indlela efanele lolo hlobo lwesitshalo",
          "Lapho nje kuwa iqabunga elilodwa",
          "Ungalokothi, ngoba izitshalo ezisiza ezinye azikwazi ukuncintisana nazo"
        ],
        "correct": 1,
        "rationale": "Izitshalo zesikhashana ezisiza ezinye nazo zingaqala ukuncintisana nazo. Bheka ukukhanya, amanzi nokukhula kwezitshalo, bese ukhetha indlela efanele yokuzinakekela kunokuthembela onyakeni omisiwe."
      }
    ]
  },
  "small-livestock-l1": {
    "title": "Izinkukhu Ohlelweni Lwepulazi: Ukulawula Izinambuzane, Ukuvunda Komhlabathi Nokudla",
    "body": "Izinkukhu zingasiza embhedeni ongenalutho ngemva kokuvuna. Ziklwebha izinsalela zezitshalo, zidle ezinye izinambuzane nembewu yokhula. Umquba wazo nezinto zokulala kungavundiswa kwenziwe i-compost bese kubuyiselwa enhlabathini. Ukuzifunela ukudla akuthathi indawo yokudla okunomsoco, amanzi ahlanzekile, indawo yokukhosela nokunakekelwa nsuku zonke.\n\nI-chicken tractor yihhoko elihambayo elingenaphansi. Lihambise ngaphambi kokuba umhlabathi ungabi nazitshalo, ube nodaka noma umbozwe kakhulu umquba. Isikhathi esifanele sincike ezinyonini, enhlabathini nasesimweni sezulu. Alikho inani elilodwa lezinkukhu eliqinisekisa ukuvunda okwanele kuyo yonke indawo.\n\nGcina izinkukhu zikude nezithombo nezitshalo ezivunelwa ukudliwa. Umquba omusha ungathwala amagciwane. Buza umeluleki wezolimo ukuthi ungawuphatha kanjani ngokuphepha ngaphambi kokutshala isivuno esilandelayo. Amadada awaklwebhi kakhulu njengezinkukhu, kodwa nawo angalimaza izitshalo futhi enze umhlabathi omanzi ube nodaka. Wabheke, uwahambise uma kudingeka.",
    "keyPoints": [
      "Hambisa ihhoko ngaphambi kokuba izinyoni zilimaze umhlabathi noma umquba unqwabelane",
      "Qondanisa inani lezinyoni nokusetshenziswa komquba nomhlabathi, izitshalo nokudla okutholakalayo",
      "Faka izinkukhu embhedeni ngemva kokuvuna kuphela — ungazifaki eduze kwezithombo ezisencane",
      "Amadada awaklwebhi kakhulu, kodwa kusadingeka uwaqaphe eduze kwezitshalo nasemhlabathini omanzi"
    ],
    "quiz": [
      {
        "q": "Ufuna izinkukhu zilungise umbhede ongenalutho ukuze uphinde utshale. Yisiphi isikhathi esifanele sokuzifaka kuwo?",
        "options": [
          "Masinyane ngemva kokutshala izithombo, ukuze athambise umhlabathi ozizungezile",
          "Ngemva kokuvuna, lapho umbhede ususuliwe, ngaphambi kokutshala okulandelayo",
          "Ngesikhathi sokukhula, lapho amaqabunga esengakwazi ukumelana nokuklwebha",
          "Ebusika kuphela ukuze kugwenywe ukucindezeleka ngenxa yokushisa"
        ],
        "correct": 1,
        "rationale": "Sebenzisa umbhede ongenalutho ngemva kokuvuna. Gcina umquba omusha ukude nezitshalo zokudla, futhi uhlele ukuphathwa kwawo ngokuphepha ngaphambi kokutshala futhi."
      },
      {
        "q": "Kungani amadada engase afaneleke kakhulu kunezinkukhu endaweni enezitshalo ezingaphansi kwe-food forest esesimile?",
        "options": [
          "Amadada akhiqiza umquba omningi ngosuku",
          "Amadada adla ama-slug neminenke ngaphandle kokuklwebha kakhulu okuphazamisa izimpande nesembozo somhlabathi",
          "Amadada awangenwa isifo se-Newcastle",
          "Amadada alala ezihlahleni, ngaleyo ndlela anciphise ukuqina komhlabathi"
        ],
        "correct": 1,
        "rationale": "Amadada awaklwebhi njengezinkukhu. Asengazinyathela noma azidle izitshalo; ngakho qapha umhlabathi, uwahambise uma kudingeka."
      }
    ]
  },
  "small-livestock-l3": {
    "title": "Ukuhlanganisa Imijikelezo Yemfuyo: Izakhamzimba Ezihamba Epulazini",
    "body": "Ezinye izakhamzimba zingabuyela endaweni yokutshala nge-compost eyenziwe ngomquba. Umquba omusha ungathwala amagciwane ayingozi. Vumela umquba uvundiswe ngokuphelele ngaphambi kokuwusebenzisa eduze kwezitshalo zokudla. Ukudla kwezilwane okuthengwayo kuletha izakhamzimba epulazini, kuyilapho ukudla neminye imikhiqizo kususa izakhamzimba. Bhala phansi ukudla kwezilwane okuthengwayo nokudla okuthengiswayo noma okuyiswa ekhaya. Izinsalela zokudla kuphela zingase zingazanelisi izidingo zezilwane.\n\nAma-guinea fowl azifunela izinambuzane futhi angadla imikhaza. Ungathembeli kuzo ukuba zivikele abantu noma imfuyo emikhazeni noma ezifweni ezithwalwa imikhaza. Hlola izilwane bese ulandela uhlelo lwezempilo yezilwane olufanele indawo yakini.\n\nNgesilwane ngasinye, buza: singadlani lapha? Sikhiqiza ziphi izinto eziwusizo? Sidingani okunye? Faka amanzi, ukudla okufanele, indawo yokukhosela, uthango nokunakekelwa nsuku zonke.\n\nIzinkukhu ezilandela izimbuzi azikafakazelwa ukuthi zingathatha indawo yokulawula izikelemu ezimbuzini. Ukuphatha amadlelo kungasiza, kodwa izimbuzi zisadinga ukuhlolwa kwezempilo nohlelo lokulawula izimuncagazi kumeluleki wezilwane noma wezempilo yezilwane. Ungakuyeki ukwelapha ngoba izinkukhu zivakashele idlelo lezimbuzi.",
    "keyPoints": [
      "Sebenzisa izinsiza ezifanele zasepulazini, kodwa uhlangabezane nazo zonke izidingo zesilwane ngasinye",
      "Ukuzifunela ukudla kwama-guinea fowl akuthathi indawo yokuhlola imikhaza noma yohlelo lwezempilo yezilwane",
      "Buza ukuthi isilwane ngasinye sidlani, sikhiqizani futhi sidingani, kuhlanganise nezinto ezithengwayo",
      "Ungathathi indawo yokulawula izikelemu ezimbuzini ngezinkukhu ezilandela umhlambi"
    ],
    "quiz": [
      {
        "q": "Umlimi unezinyoni zama-guinea fowl. Kufanele alawule kanjani imikhaza emfuyweni yakhe?",
        "options": [
          "Yeka ukuhlola imfuyo ngoba izinyoni zikhona",
          "Qhubeka uhlola izilwane futhi ulandele uhlelo lwezempilo yezilwane olufanele indawo yakini",
          "Cabanga ukuthi amadada asusa yonke imikhaza",
          "Yelapha zonke izilwane ngaphandle kokuhlola inkinga noma ukuthola iseluleko"
        ],
        "correct": 1,
        "rationale": "Izinyoni zingadla imikhaza, kodwa lokho akuqinisekisi ukuvikeleka emikhazeni noma ezifweni eziyithwalayo."
      },
      {
        "q": "Izinkukhu ziye zafuna ukudla endaweni yezimbuzi. Umlimi kufanele enzeni ngezikelemu zezimbuzi?",
        "options": [
          "Qhubeka nokuhlola impilo yezimbuzi nokulandela uhlelo lokulawula izimuncagazi okuvunyelwene ngalo nomeluleki wezempilo yezilwane",
          "Yeka konke ukuhlola izikelemu ngoba izinkukhu bezikhona",
          "Cabanga ukuthi umquba wezinkukhu ubulala wonke amaqanda ezikelemu",
          "Cabanga ukuthi ukuhambisa umhlambi kuhlale kwenza ukwelapha kungadingeki"
        ],
        "correct": 0,
        "rationale": "Izinkukhu azikafakazelwa ukuthi zingathatha indawo yokulawula izikelemu ezimbuzini. Ukuphatha amadlelo nokuhlola impilo yezilwane kufanele kusebenze ndawonye."
      }
    ]
  },
  "market-community-l1": {
    "title": "Ukugcina Amarekhodi: Ukwazi Lokho Okukhiqizwa Yipulazi Lakho Ngempela",
    "body": "Isivuno singondla umuzi, sithengiswe, sabelwane ngaso noma silahleke.\n\nUkubhala lezi zindlela esisetshenziswe ngazo kukusiza ubone ukuthi ipulazi likhiqiza ini nokuthi yini efinyelela kubathengi.\n\nSebenzisa lolo lwazi ukuze uvikele ukudla komuzi futhi wenze izinqumo ezingcono zebhizinisi.\n\nBhala phansi konke ukuvunwa ngesikhathi kwenzeka.\n\nQopha amakhilogremu katamatisi, amaqanda ngama-dozen, nezinyanda ze-morogo, bese ubhala ukuthi ngakunye kuyephi.\n\nSebenzisa lo mkhuba ekudleni okugcinelwe umuzi, emkhiqizweni othengisiwe, onikezwe abanye, noma ofakwe ku-compost.\n\nUngathembeli enkumbulweni ekupheleni kwenkathi.\n\nIrekhodi lenkathi eyodwa liphendula imibuzo ewusizo.\n\nYiziphi izitshalo ezikhiqiza kakhulu embhedeni ngamunye? Yiziphi ezibuyisa imali eningi ngehora lomsebenzi?\n\nYiziphi izitshalo ezisebenzisa imbewu, amanzi ne-compost eningi kunalokho ezikubuyisayo?\n\nIrekhodi libuye libonise izinyanga umuzi othenga ngazo ukudla ngoba esawo siphelile.\n\nNgaphambi kokubeka inani lokuthengisa, qopha izindleko zokukhiqiza, ukupakisha nokuthengisa, kuhlanganise nomsebenzi nezokuthutha.\n\nNasi isibonelo sokufundisa, asiyona inani lentengo yamanje emakethe: utamatisi ubiza u-R18 ngekhilogremu ukuwukhiqiza, kodwa uthengiswa ngo-R15 ngekhilogremu. Lelo nani alizikhokhi izindleko ezishiwo.\n\nBuyekeza inani lokuthengisa, izindleko nokuthi uzotshala ini ngokulandelayo. Hlola ukuthi abathengi bazothengani ngempela; inani eliphakeme elicelwayo aliqinisekisi ukuthi umkhiqizo uzothengiswa.\n\nSebenzisa irekhodi lakho ukuthola ukuthi ukudla komuzi kushoda nini.\n\nKhetha izitshalo ezifanele indawo yangakini, uhlele uhlehle usuka esikhathini sokuvuna osidingayo. Hlola izimo zokutshala nesikhathi esilindelekile kuze kuvunwe.\n\nUsuku olusebenza kwelinye ipulazi lungase lungasebenzi lapha. Yiba nohlelo lwesibili uma imvula, amanzi noma izitshalo kungahambi kahle.",
    "keyPoints": [
      "Qopha inani lesivuno nalapho siye khona ngokwehlukana nemali engenile.",
      "Faka izindleko zokukhiqiza nokuthengisa lapho uhlola inani lokuthengisa.",
      "Bhala ngokucacile ukuthi izibonelo ziyizibonelo; sebenzisa izindleko zakho zangempela lapho wenza izinqumo.",
      "Hlela izikhathi zokushoda kokudla ngokwezimo zokutshala zendawo nesikhathi sokuvuna."
    ],
    "quiz": [
      {
        "q": "Kulesi sibonelo sokufundisa, utamatisi uthengiswa ngo-R15/kg kodwa kubiza u-R18/kg ukuwukhiqiza. Yini okufanele umlimi ayibuyekeze?",
        "options": [
          "Qhubeka uthengisa ngo-R15 — ukulahlekelwa okwesikhashana kwakha ubudlelwano",
          "Yeka ngokuphelele ukutshala utamatisi",
          "Inani lokuthengisa, izindleko nokuthi esinye isitshalo singabuyisa inzuzo engcono yini",
          "Faka isicelo soxhaso ukuze kuvalwe umehluko"
        ],
        "correct": 2,
        "rationale": "Kulesi sibonelo inani lokuthengisa lingaphansi kwezindleko ezishiwo. Buyekeza lo mehluko nokufunwa ngabathengi ngaphambi kokwenza isinqumo esilandelayo sokukhiqiza."
      },
      {
        "q": "Amarekhodi omlimi abonisa ukuthi uphelelwa imifino njalo ngoJuni nangoJulayi. Yisiphi isinyathelo esiwusizo?",
        "options": [
          "Thenga imifino emakethe njalo ngoJuni nangoJulayi",
          "Hlela uhlehle usuka kuleli gebe lokudla, usebenzise izitshalo ezifanele zendawo nesikhathi sazo sokuvuna",
          "Yamukela ukuthi ipulazi lakhe alikwazi ukukhiqiza ebusika",
          "Amarekhodi abonisa inkinga yokuvunda komhlabathi"
        ],
        "correct": 1,
        "rationale": "Amarekhodi akhomba isikhathi sokushoda. Ukukhetha izitshalo nezinsuku zokuzihlwanyela kufanele kuhambisane nesimo sezulu sendawo, amanzi nesikhathi esilindelekile sokuvuna."
      }
    ]
  },
  "market-community-l2": {
    "title": "Ukuthengisa Umkhiqizo Osele: Lapho Ungathengisa Khona Nendlela Yokubeka Intengo",
    "body": "Buza ukuthi umthengi udingani: umkhiqizo, inani, ikhwalithi, ukulethwa nosuku lokukhokha.\n\nQhathanisa izimali zemakethe, ezokuthutha, ukupakisha nomkhiqizo ongathengiswanga kanye nenani lokuthengisa.\n\nHlola imithetho yemakethe nezimfuneko zendawo zokuhweba nokudla. Ukuthi itafula lokuthengisa alihlelekile akusho ngokuzenzakalelayo ukuthi alinayo imithetho noma izindleko.\n\nUkuthengisa ngqo kungagcina ingxenye enkulu yenani lokuthengisa kumlimi, kodwa kudinga nesikhathi, ukupakisha, ukuthutha nokunakekela amakhasimende.\n\nI-box scheme iletha izinhlobo ezivamile zemikhiqizo kumakhasimende okuvunyelwene nawo.\n\nVumelanani ngokuqukethwe kwebhokisi, inani, ukukhokha nokuthi kuzokwenzekani uma isivuno sishoda. Ama-oda avamile asiza ukuhlela kuphela uma amakhasimende nabalimi bekwazi ukugcina isivumelwano.\n\nQala ngalokho ongakuhlinzeka ngokwethembeka kanye nalokho okufunwa amakhasimende.\n\nHlola izindleko nezidingo zokudla komuzi ngaphambi kokuthembisa amabhokisi avamile.\n\nUbukhulu bengadi noma inani lamakhasimende kukodwa akubikezeli imali engenayo. Zama indlela ongakwazi ukuyiphatha, bese uqopha imiphumela.\n\nUma ukukhiqiza kushintsha isonto nesonto, gwema ukuthembisa ukulethwa okungaguquki ongeke ukwazi ukukufeza.\n\nNikeza ngomkhiqizo osele onawo bese nivumelana ngemigomo ecacile namakhasimende.\n\nChaza ngokwethembeka izindlela okhulisa ngazo izitshalo. Ngaphambi kokufaka ilebula, hlola isitifiketi noma isimangalo esidingwa umthengi.",
    "keyPoints": [
      "Vumelanani ngomkhiqizo, inani, ikhwalithi, ukulethwa nokukhokha.",
      "Qhathanisa izindleko nokulahleka komkhiqizo kanye nenani lokuthengisa.",
      "Thembisa amabhokisi avamile kuphela uma umkhiqizo okwazi ukuwuhlinzeka nemigomo yamakhasimende kuvumela.",
      "Hlola imithetho yemakethe futhi uchaze ngokwethembeka izindlela zokukhulisa izitshalo."
    ],
    "quiz": [
      {
        "q": "Ukukhiqiza komlimi omncane akufani masonto onke — amanye amasonto uba nomkhiqizo osele omningi, kwamanye ube mncane. Iyiphi indlela yokuthengisa engamfanela kakhulu?",
        "options": [
          "Itafula emakethe ehlelekile elidinga umkhiqizo ofanayo masonto onke",
          "I-box scheme edinga umkhiqizo ofanayo masonto onke",
          "Ukuthengisa emakethe engahlelekile noma komakhelwane ngaphandle kwesibopho senani elingaguquki",
          "Isivumelwano sesikole esidinga ukulethwa nsuku zonke"
        ],
        "correct": 2,
        "rationale": "Lena yindlela engamdingi ukuthi athembise inani elingaguquki masonto onke; uthengisa lokho anakho ngempela."
      },
      {
        "q": "Ama-oda avamile okuvunyelwene ngawo angamsiza kanjani umlimi ahlele?",
        "options": [
          "Amakhasimende e-box scheme ahlala ekhokha imali eningi ngekhilogremu",
          "I-box scheme ikuvumela ukukhokhisa imali eyengeziwe yokupakisha",
          "Ama-oda avunyelwene ngawo akunikeza ulwazi ngesidingo sangempela, ukuze uhlele ukukhiqiza esikhundleni sokutshala ungazi ukuthi kuzothengwa yini",
          "Ama-box scheme akususa ezibophweni zentela"
        ],
        "correct": 2,
        "rationale": "Ama-oda aqinisekisiwe akunikeza ulwazi ngokufunwa komkhiqizo. Ayasiza kuphela uma umkhiqizo uhlinzekeka ngokwethembeka, kukhokhwa, futhi izindleko zokufeza ama-oda zicatshangelwa."
      }
    ]
  },
  "market-community-l3": {
    "title": "Ukwakha Amanethiwekhi Okudla Omphakathi: Amandla Ngokubambisana",
    "body": "Omakhelwane bangabelana ngezinhlobo ezahlukene zezitshalo nangomsebenzi wokugcina imbewu.\n\nBhala isitshalo, uhlobo lwaso, lapho imbewu ivela khona nosuku eyabuthwa ngalo. Hlela ukuhlukanisa impova, ukukhetha izitshalo zembewu, ukomisa nokugcina ngokwendlela efanele isitshalo ngasinye.\n\nUkwabelana akukhulisi ukuhlukahluka ngokuzenzakalelayo futhi akuqinisekisi ikhwalithi engcono. Hlola ukuthi imbewu ingeyaluphi uhlobo nokuthi iyahluma yini ngaphambi kokuthembela kuyo. Ngaphambi kokushintshisana ngembewu, hlola ukuthi uhlobo luvikelwe yini nokuthi imvume iyadingeka yini.\n\nUkwabelana ngamathuluzi kwenza imishini ebizayo ifinyeleleke eqenjini.\n\nIphampu yamanzi noma umshini wokugaya okusanhlamvu kungase kubize kakhulu ukuba umuzi owodwa ukwazi ukukuthenga.\n\nUkusetshenziswa ngokuhlanganyela kusabalalisa inzuzo yethuluzi eqenjini futhi kusiza ipulazi ngalinye lenze umsebenzi ebelingeke liwenze lodwa.\n\nPhatha umkhiqizo ngobumnene futhi uwugcine emthunzini ofanele, upakishwe futhi ugcinwe kahle ngesikhathi sokulethwa.\n\nUmthengi oseduze anganciphisa uhambo, kodwa ukulahleka komkhiqizo nezindleko zokuthengisa kusadinga ukubalwa.\n\nQhathanisa imali engenile ngemva kwezimali ezikhokhiwe, ezokuthutha nokonakala komkhiqizo endleleni ngayinye. Ungacabangi ukuthi umthengi oseduze uhlala enikeza inzuzo engcono.\n\nOmakhelwane bangakhombisa amakhono awusizo futhi baqhathanise okwenzeke emapulazini abo.\n\nQopha indlela esetshenzisiwe, izimo nomphumela ukuze abanye bakwazi ukwahlulela ukuthi leyo ndlela ingase iwafanele yini umhlaba wabo.\n\nFuna iseluleko sochwepheshe abafanele ngezifo ezingajwayelekile noma izinkinga zobuchwepheshe. Ulwazi lomphakathi lungasebenza kanye nosizo lochwepheshe.",
    "keyPoints": [
      "Qopha uhlobo lwembewu, imvelaphi nekhwalithi yayo; ngaphambi kokwabelana hlola ukuthi imvume iyadingeka yini.",
      "Vumelanani ngokunakekela, ukubhukha nokulungisa amathuluzi enabelana ngawo.",
      "Linganisa ukulahleka kwempahla nembuyiselo esele ngemva kwezindleko endleleni ngayinye yokuthengisa.",
      "Hlanganisa ulwazi enabelana ngalo nosizo lochwepheshe abafanele lapho ludingeka."
    ],
    "quiz": [
      {
        "q": "Omakhelwane bafuna ukwabelana ngembewu abayigcinile. Yini esiza ukwenza le mbewu ibe wusizo?",
        "options": [
          "Hlanganisa zonke izinhlobo ngaphandle kokuzilebula",
          "Vumelanani ngokuhlola ikhwalithi yembewu, futhi nihlole ukuthi imvume iyadingeka yini ukuze nabelane ngalolo hlobo",
          "Cabanga ukuthi ukwabelana kuthuthukisa yonke inqwaba yembewu ngokuzenzakalelayo",
          "Thembela kuphela enanini labantu abaseqenjini"
        ],
        "correct": 1,
        "rationale": "Ikhwalithi yembewu incike ekuhlukaniseni impova, ekukhetheni, ekulebuleni, ekuyigcineni nasekuhloleni ukuthi iyahluma yini, ngendlela efanele isitshalo ngasinye. Lokho kuhlola akusho ukuthi imvume yokushintshisana ngohlobo oluvikelwe ikhona; hlola amalungelo nemvume efanele ngaphambi kokwabelana."
      },
      {
        "q": "Umlimi uqhathanisa imakethe ekude namakhasimende aseduze. Yini okufanele iqondise isinqumo?",
        "options": [
          "Hlala ukhetha inani eliphakeme elibonakala libhalwe kuqala",
          "Hlala ukhetha uhambo olufushane kakhulu",
          "Qhathanisa imali esalayo ngemva kwezimali ezikhokhiwe, ezokuthutha, umkhiqizo ongathengiswanga nokunye ukulahleka",
          "Cabanga ukuthi ukujoyina iqembu kususa zonke izindleko"
        ],
        "correct": 2,
        "rationale": "Ibanga lithinta izindleko, kodwa akulona lodwa elibalulekile. Sebenzisa imali etholakele yangempela nokulahleka ukuze uqhathanise izindlela."
      }
    ]
  }
};
