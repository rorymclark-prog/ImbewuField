/**
 * Unreviewed isiZulu drafts paired by position with MONTHLY_ADVICE in
 * app/calendar/page.tsx. Keep the English there as the source until a fluent
 * agricultural reviewer approves these translations.
 */
export const CALENDAR_MAINTAIN_ZU = [
  [
    // Held at the exact source: the draft lost the difference between depth and amount.
    'Water deeply early morning — evaporation peaks this month',
    'Mboza umhlabathi nge-mulch ewugqinsi ukuze ugcine umswakama enhlabathini.',
    'Hlola izinambuzane nsuku zonke: ama-aphid, i-whitefly ne-cutworm.',
    'Phendula i-compost njalo ngemva kwamasonto amabili — ukushisa kusheshisa ukubola.',
  ],
  [
    // Held at the exact source: the draft lost the difference between depth and amount.
    'Continue deep watering — soil dries fast',
    'Faka i-compost eduze kwe-maize uma ukukhula kuhamba kancane.',
    // Held at the exact source: curing is not the same instruction as drying.
    'Begin curing pumpkins and sweet potatoes for storage',
    'Susa tomato plants eseziqedile ukuthela ngaphambi kokuba isifo sisabalale.',
  ],
  [
    'Susa izitshalo zasehlobo emibhedeni bese ufaka i-compost ngaphambi kwenkathi epholile.',
    'Lungisa umhlabathi wezitshalo zasebusika — khulula imigqa eqinile.',
    'Qoqa tomato seeds, beans, ne-pumpkin seeds uyomise.',
    'Hlola izinhlelo zokunisela ngaphambi kwezinyanga ezomile.',
  ],
  [
    'Tshala ama-clove kagalikhi ebheke phezulu, ajule ngo-10 cm.',
    'Hlwanyela spinach ne-carrots emibhedeni efakwe i-compost kahle.',
    'Nciphisa izikhathi zokunisela njengoba amazinga okushisa ehla.',
    'Faka i-mulch ye-compost ukuze uvikele umhlabathi ebusuku obupholile.',
  ],
  [
    'Hlakula njalo — ukhula lwasebusika luncintisana kakhulu.',
    'Faka umanyolo owuketshezi wasolwandle ezitshalweni ezintsha.',
    'Hlola ukuthi amanzi ayaphuma yini emhlabathini ngaphambi kokufika kwezimvula zasebusika.',
    'Qala inqwaba yesibili ye-compost ngamaqabunga omile asekwindla.',
  ],
  [
    'Vikela izithombo ezintekenteke esithwathweni usebenzisa indwangu yomthunzi noma isembozo semigqa.',
    'Nisela kuphela lapho umhlabathi womile — ukunisela ngokweqile ebusika kubangela ukubola kwezimpande.',
    'Susa ukhula ngaphambi kokuba lukhiphe imbewu.',
    'Sebenzisa ukusa okubandayo ukuhlela isizini ezayo — dweba uhlelo lokushintshanisa izitshalo.',
  ],
  [
    'Gcina imibhede ingenalo ukhula — ukhula oluncane lushiya imisoco eminingi enhlabathini yezitshalo zakho.',
    'Hlola ama-pumpkins nama-sweet potatoes agciniwe ukuthi akubolanga yini.',
    'Lungisa i-compost ngezinto ezomile ukuze yondle izitshalo entwasahlobo.',
    'Oda noma thola imbewu yokutshala entwasahlobo — ayisatholakali kalula uma sekunguSepthemba.',
  ],
  [
    'Qala i-tomato ne-pepper seed emathreyini afudumele endlini.',
    'Lungisa imibhede yasentwasahlobo — faka i-compost ngaphambi kokufika kokushisa.',
    'Ithuba lokugcina lokutshala carrots ngaphambi kokuba ukufudumala kwentwasahlobo kubambezele ukuhluma.',
    'Susa indwangu evikela esithwathweni njengoba izinsuku zifudumala — vumela ilanga liqinise izithombo.',
  ],
  [
    'Qinisa izithombo ze-tomato ngaphambi kokuzitshala ngaphandle — zikhiphele ngaphandle amahora ambalwa usuku ngalunye.',
    'Lungisa izisekelo namakheji e-beans ekhuphukayo nawe-tomato.',
    'Qala uhlelo lokunisela oluvamile njengoba amazinga okushisa enyuka.',
    'Faka itiye le-compost emibhedeni ngaphambi kokutshala izithombo.',
  ],
  [
    'Khulisa ukunisela njengoba kushisa.',
    'Nquma amahlumela aseceleni e-tomato ukuze isiqu esikhulu sikhule siqine.',
    // Held at the exact source: the draft said "tie" and could change the staking action.
    'Stake maize in pairs — cross-pollination needs plant proximity',
    'Mboza yonke imibhede nge-mulch ewugqinsi ukuze uyilungiselele ukushisa kwehlobo.',
  ],
  [
    'Qaphela ukuwa kwezimbali ze-tomato lapho kushisa ntambama — i-mulch nokunisela njalo kuyasiza.',
    'Bophela iziqu ze-beans nama-pumpkins njengoba zisabalala.',
    'Hlola i-cutworm ebusuku — yicoshe ngesandla noma usebenzise i-DE eduze kweziqu.',
    'Gcina i-compost imanzi lapho kushisa.',
  ],
  [
    'Vuna ama-tomatoes ngaphambi kokuba avuthwe ngokweqile lapho kushisa.',
    'Nisela njalo ekuseni — ukunisela kusihlwa kukhuthaza izifo zesikhunta.',
    'Bophela amaqoqo e-tomato asindayo ukuze iziqu zingaphuki.',
    'Bhala phansi okusebenzile kule sizini ungakakukhohlwa — kuzokusiza ngonyaka ozayo.',
  ],
] as const;

/** Safety-sensitive month/task entries kept in English pending fluent farming review. */
export const CALENDAR_MAINTAIN_HOLD_KEYS: ReadonlySet<string> = new Set([
  '0:0', // watering depth
  '1:0', // watering depth
  '1:2', // curing versus drying
  '9:2', // staking versus tying
]);

export const CALENDAR_LIMA_ADVICE_ZU = [
  'Ihlobo eliphakathi nendawo eNingizimu Nenkabazwe liyisikhathi esihle sokuvuna. Gxila ekuniseleni nasekuhloleni izinambuzane. Noma yimuphi umhlabathi ongenazitshalo kufanele umbozwe nge-mulch ngokushesha — lokhu yikho okuvikela kakhulu isivuno onakho ngoJanuwari.',
  // Held at the exact source: curing was translated as drying, changing the storage instruction.
  'Late-summer rains can bring fungal pressure. Increase airflow around tomatoes by removing lower leaves. Cure harvested sweet potatoes in a warm shaded spot for 10 days before storage — this heals the skin and extends shelf life greatly.',
  'UMashi uyinyanga yoshintsho: izitshalo zasehlobo ziyaphela, ezasebusika sezizoqala. Zinike usuku lokuhlela ukuthi yimiphi imibhede ozoyisebenzisela spinach, carrots ne-garlic — umhlabathi opholile kusukela ngo-Ephreli kuya phambili uzisiza ukuba zihlume kahle.',
  'U-Ephreli yisikhathi esihle kakhulu sokutshala garlic ezindaweni eziningi zaseNingizimu Afrika. Sebenzisa ama-clove amakhulu anempilo avela esitokweni esingenazo izifo. I-spinach ihluma kahle manje — nciphisa izithombo ukuze ziqhelelane ngo-15 cm ukuze kutholeke amaqabunga amakhulu. Ubusuku obupholile busho izinambuzane ezimbalwa: kuyinzuzo yakho.',
  'Hlwanyela spinach ngokulandelana njalo ngemva kwamasonto amathathu kusukela ngoMeyi kuya kuJulayi ukuze uqhubeke nokuvuna. Ama-carrots ahlwanyelwe manje azolunga ngo-Agasti. Ikwindla nayo yisikhathi esihle sokuthuthukisa umhlabathi — mba i-compost evuthiwe uyifake manje, bese imisundu iqhubeka nomsebenzi ebusika.',
  'UJuni uyinyanga ebanda kakhulu eHighveld. Ezindaweni ezivame ukuba nesithwathwa, vikela izithombo zesipinashi ebusuku usebenzisa indwangu yoboya noma utshani obomile. Ogwini naseKapa, uJuni uyisikhathi esihle sokutshala — gxila ekwandiseni isivuno ngaphambi kokufika kokushisa kwentwasahlobo.',
  'UJulayi uyisikhathi lapho ukukhula kwezitshalo kuncipha kakhulu. Sisebenzise kahle: thola imbewu ye-tomato, ye-beans neye-maize esezingeni elihle manje isatholakala ngobuningi futhi ishibhile. Maphakathi noJulayi, qala i-tomato seed emathreyini endlini uma unendawo efudumele — izobe isilungele ukutshalwa ngoSepthemba.',
  'U-Agasti ubonisa ushintsho. Hlwanyela i-tomato seeds endlini manje — ukuyiqala emasontweni angu-6 kuya kwangu-8 ngaphambi kwesithwathwa sokugcina kuzinikeza isiqalo esihle izithombo. Ezindaweni ezisogwini ezingenaso isithwathwa, ungahlwanyela i-tomatoes ngqo emhlabathini ngasekupheleni kuka-Agasti. Qala ukukhulula umhlabathi oqiniswe ubusika kuyo yonke imibhede.',
  // Held at the exact source: curing was translated as drying, changing the garlic instruction.
  'Spring arrives quickly in South Africa — do not rush tomato transplants into cold soil. Wait until night temperatures stay above 12 °C. September is also garlic harvest month: leaves yellowing from the base means the bulb is ready. Cure harvested garlic in a shaded, airy spot for two weeks.',
  // Held at the exact source: the draft's staggered two-to-three-week window and blossom-end-rot term need review.
  'October is the most active planting month in summer-rainfall regions. Get everything in the ground before the real heat arrives. Stagger maize sowing over two to three weeks to spread the harvest. Water tomatoes consistently — irregular watering now causes blossom-end rot in January.',
  'UNovemba uletha izimvula zokuqala zasehlobo ezindaweni eziningi — kukhululeka ngemva kwezikhathi ezomile zasentwasahlobo. Ungayeki ukunisela: imvula ayibikezeleki futhi ingena kancane ebusweni bomhlabathi. Ukunisela okujulile masonto onke kusiza izimpande kangcono kunemvula engangeni ijule. Vikela i-maize encane emoyeni onamandla ngemva kwemvula.',
  // Held at the exact source: the draft reversed the indoor/off-vine ripening claim.
  'The first tomatoes of the season are a milestone. Pick them at first blush and let them ripen indoors — they develop more flavour off the vine in the heat of December. This is also the month to take stock: what germinated well, what failed, what variety performed. That knowledge is your most valuable harvest.',
] as const;

/** Advice paragraphs with curing, ripening, timing, or specialist terms held for fluent farming review. */
export const CALENDAR_LIMA_HOLD_MONTHS: ReadonlySet<number> = new Set([
  1, // February: curing translated as drying.
  8, // September: curing translated as drying.
  9, // October: staggered sowing interval and blossom-end-rot term need review.
  11, // December: the draft reversed the indoors/off-vine ripening claim.
]);

export const CROP_PLAN_MONTH_FOCUS_ZU = [
  // Held at the exact source: the draft lost the difference between depth and amount.
  'Peak summer harvest — water deeply, mulch, watch for pests daily.',
  // Held at the exact source: "cure" was again translated as drying.
  'Late summer — cure pumpkins & sweet potato, clear spent beds.',
  'Ukuqala kwekwindla — hlwanyela spinach, carrots ne-garlic; faka i-compost.',
  'Ukutshala kwasekwindla — faka i-garlic nemifino enamaqabunga manje.',
  'Maphakathi nekwindla — hlwanyela spinach ngokulandelana; thuthukisa umhlabathi ukuze ulungele ubusika.',
  'Ubusika — vikela izithombo esithwathweni; vuna imifino enamaqabunga nezimpande.',
  'Ubusika obujulile — thola imbewu yasentwasahlobo; qala i-tomato endlini.',
  'Ukuphela kobusika — qala izithombo zezitshalo zesikhathi esifudumele; lungisa imibhede yasentwasahlobo.',
  'Intwasahlobo — tshala kabusha i-tomato, hlwanyela i-beans; vuna i-garlic.',
  'Isikhathi esimatasa sokutshala entwasahlobo — hlwanyela i-maize; tshala konke ngaphambi kokushisa.',
  'Ukuphela kwentwasahlobo — hlwanyela i-tomato okokugcina; faka i-mulch yasehlobo.',
  'Ukuqala kwehlobo — ama-tomato okuqala; nisela nsuku zonke, bophela amaqoqo.',
] as const;

/** Crop-plan summaries kept in English until their depth and curing wording is reviewed. */
export const CROP_PLAN_MONTH_FOCUS_HOLD_MONTHS: ReadonlySet<number> = new Set([0, 1]);
