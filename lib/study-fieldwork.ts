// These are discussion cases for the existing curriculum. They describe an imagined
// household so learners can reason first, then compare the example with their own evidence.
import type { ManualChapter } from './manual';

type Copy = { en: string; zu: string };
const copy = (en: string, zu: string): Copy => ({ en, zu });

interface FieldCase {
  title: Copy;
  scene: Copy;
  question: Copy;
  reasoning: Copy;
  chapter: ManualChapter;
  /** Same zero-based heading order the manual uses for its figures. */
  section: number;
  figure?: string;
}

export const FIELD_CASES: Readonly<Record<string, FieldCase>> = {
  'intro-permaculture': {
    title: copy('Who gets the last basket?', 'Ubani othola ubhasikidi wokugcina?'),
    scene: copy('At the kitchen door there is a basket from the garden. A buyer wants the lot. Someone at home has already planned supper around it. A neighbour asks for seed. Everyone is looking at the same basket and seeing a different need.',
      'Emnyango wekhishi kukhona ubhasikidi ovela engadini. Umthengi ufuna konke okukuwo. Othile ekhaya ubehlele ukupheka ngakho kusihlwa. Umakhelwane ucela imbewu. Bonke babona ubhasikidi owodwa kodwa izidingo zabo zihlukene.'),
    question: copy('What would you ask before calling any of it surplus?', 'Ungabuzani ngaphambi kokuthi uthi kukhona okusele?'),
    reasoning: copy('Ask the cook what the household needs. Ask the grower what should go back into the garden. Find out what the neighbour actually wants to grow. Only then can the family discuss what to sell or share. A fair decision begins with those conversations.',
      'Buza ophekayo ukuthi umndeni udingani. Buza umlimi ukuthi yini okufanele ibuyele engadini. Thola ukuthi umakhelwane ufuna ukutshalani. Ngemva kwalokho umndeni ungaxoxa ngokudayisa noma ngokwabelana. Isinqumo esinobulungisa siqala ngalezo zingxoxo.'),
    chapter: '01-what-is-permaculture', section: 2, figure: '02-planning-together',
  },
  'reading-landscape': {
    title: copy('The path tells a different story after rain', 'Indlela ixoxa enye indaba ngemva kwemvula'),
    scene: copy('On a dry morning the yard looks level. After rain, a streak of silt crosses the footpath and ends against the gate. The family sketch shows the path and gate, but gives no clue where that soil came from.',
      'Ekuseni komile igceke libukeka liyisicaba. Ngemva kwemvula kunomkhondo wenhlabathi enqamulayo endleleni uze uyofika esangweni. Umdwebo womndeni ukhombisa indlela nesango kodwa awusho ukuthi le nhlabathi ivelaphi.'),
    question: copy('Where would you put the first arrow on the sketch?', 'Ungawudweba kuphi umcibisholo wokuqala?'),
    reasoning: copy('Start where you can see a mark. Trace it back from the gate while it is still visible and safe to walk. Draw a solid arrow for flow you saw and a question mark where the trail disappears. Ask someone who uses the gate what happens in other storms.',
      'Qala lapho ubona khona umkhondo. Wulandele ubuyele emuva usuka esangweni uma kusabonakala futhi kuphephile ukuhamba. Dweba umcibisholo lapho ubone amanzi egeleza khona. Faka uphawu lombuzo lapho umkhondo unyamalala khona. Buza osebenzisa isango ukuthi kwenzekani ngezinye izimvula.'),
    chapter: '02-planning-your-farm', section: 0, figure: '02-base-map',
  },
  'water-harvesting': {
    title: copy('The tank is full. Where does the next rain go?', 'Ithangi ligcwele. Imvula elandelayo iya kuphi?'),
    scene: copy('The family can point out the gutter, tank and tap. During a storm someone notices water leaving the full tank and running across a neighbour’s path. The drawing ends at the tank.',
      'Umndeni ungakhomba ugadasi, ithangi nompompi. Ngesikhathi semvula othile ubona amanzi ephuma ethangini eligcwele enqamula indlela yomakhelwane. Umdwebo uphelela ethangini.'),
    question: copy('What is missing from the water plan?', 'Yini eshodayo ohlelweni lwamanzi?'),
    reasoning: copy('Follow the overflow on paper as carefully as the water coming in. Mark what it crosses, where it pools and who uses that ground. A wet patch is evidence to investigate. You still need to check the site and downstream effects before deciding whether any earthwork belongs there.',
      'Landela emdwebeni amanzi achichimayo ngendlela olandela ngayo angenayo. Maka ukuthi awela kuphi, abuthana kuphi nokuthi ubani osebenzisa leyo ndawo. Indawo emanzi iwubufakazi okufanele buhlolwe. Hlola indawo nomphumela ezansi ngaphambi kokunquma ngokumba.'),
    chapter: '07-earthworks-and-water', section: 1, figure: '07-linked-tanks',
  },
  'soil-health': {
    title: copy('Same rain, different ground', 'Imvula iyefana, umhlabathi wehlukile'),
    scene: copy('Rain has fallen across the whole garden. Beneath the old mulch the surface crumbles in the hand. Beside the path the surface has dried into a crust. A visitor wants to order compost straight away.',
      'Imvula ine engadini yonke. Ngaphansi kwesembozo esidala inhlabathi iyavuthuluka esandleni. Eceleni kwendlela ingaphezulu lomile laqina. Isivakashi sifuna uku-oda umquba ngaso leso sikhathi.'),
    question: copy('What could you learn from these patches before spending money?', 'Ungafundani kulezi zindawo ngaphambi kokusebenzisa imali?'),
    reasoning: copy('Look beneath each surface. Record cover, moisture, roots and signs of foot traffic. Compare the feel of the soil under similar conditions. A difference gives you a question to test. It cannot by itself tell you whether the cause was mulch, soil texture or people walking there.',
      'Bheka ngaphansi kwengaphezulu lendawo ngayinye. Bhala ngesembozo, umswakama, izimpande nezimpawu zokunyathelwa. Qhathanisa ukuthinteka kwenhlabathi ezimweni ezifanayo. Umehluko ukunika umbuzo wokuhlola. Wodwa awusho ukuthi imbangela isembozo, uhlobo lwenhlabathi noma ukuhamba kwabantu.'),
    chapter: '08-soil', section: 0, figure: '08-soil-profile',
  },
  'vegetables-staples': {
    title: copy('Plan backwards from the kitchen door', 'Qala emnyango wekhishi lapho uhlela'),
    scene: copy('There is room for a new bed at the far boundary. Someone cooking supper wants leaves close enough to pick on the way home. The person carrying the watering can has a different map in mind again.',
      'Kunesikhala sombhede omusha emngceleni okude. Opheka isidlo sakusihlwa ufuna amaqabunga angawakha esendleleni eya ekhaya. Ophethe ikani lokunisela yena ucabanga ngomunye umdwebo.'),
    question: copy('Which journeys would you draw before choosing the bed?', 'Yiziphi izindlela ongazidweba ngaphambi kokukhetha indawo yombhede?'),
    reasoning: copy('Walk the route from the kitchen, then the route from the water source. Ask who will weed, water and harvest, and when they can come. Space for a bed is only part of the decision. A plan the household can tend is worth more than a full page of beds nobody can reach.',
      'Hamba usuka ekhishini, bese uhamba usuka emthonjeni wamanzi. Buza ukuthi ubani ozosusa ukhula, anisele futhi avune, nokuthi angafika nini. Isikhala sombhede siyingxenye nje yesinqumo. Uhlelo umndeni ongalunakekela lulungele ukusetshenziswa.'),
    chapter: '04-vegetable-and-staple-crops', section: 1, figure: '04-kitchen-garden',
  },
  'seeds-sovereignty': {
    title: copy('Two envelopes with the same name', 'Izimvilophu ezimbili ezinegama elifanayo'),
    scene: copy('At a seed exchange two envelopes carry the same crop name. One grower remembers the garden and harvest the seed came from. The other received it already packed. The envelopes look alike on the table.',
      'Lapho kushintshaniswa imbewu, izimvilophu ezimbili zinegama elifanayo lesitshalo. Omunye umlimi uyayikhumbula ingadi nesivuno okuvela kuso imbewu. Omunye wayithola isipakishiwe. Etafuleni izimvilophu zibukeka zifana.'),
    question: copy('What would you write down before taking either envelope home?', 'Ungabhalani ngaphambi kokuthatha imvilophu uye nayo ekhaya?'),
    reasoning: copy('Keep the lots separate. Ask about their origin, variety, harvest and storage. Record what the giver knows and leave gaps where nobody knows. A name on paper cannot tell the next grower whether a seed will germinate or whether its offspring will resemble the parent.',
      'Gcina imbewu yemvilophu ngayinye yodwa. Buza ngemvelaphi, uhlobo, ukuvuna nokugcina. Bhala okwaziwa onikelayo bese ushiya izikhala lapho kungaziwa khona. Igama ephepheni alisho ukuthi imbewu izohluma noma ukuthi izitshalo ezintsha zizofana nesitshalo esingumzali.'),
    chapter: '01-what-is-permaculture', section: 3,
  },
  'plant-guilds': {
    title: copy('When the helper starts competing', 'Lapho isitshalo esisizayo siqala ukuncintisana'),
    scene: copy('A grower planted beneath a young tree to cover bare soil. Now the cover crowds the trunk and it is hard to see where the water goes. The neighbour’s planting list says the combination works.',
      'Umlimi watshala ngaphansi kwesihlahla esincane ukuze amboze inhlabathi. Manje izitshalo ziminyanise isiqu futhi kunzima ukubona ukuthi amanzi aya kuphi. Uhlu lukamakhelwane luthi le nhlanganisela iyasebenza.'),
    question: copy('How would you decide which plants are helping here?', 'Unganquma kanjani ukuthi yiziphi izitshalo ezisizayo lapha?'),
    reasoning: copy('Name the job expected of each plant. Look for evidence of that job and for costs such as shade, water competition or lost access. Compare a crowded spot with an open one. Choose what to adjust from those observations, and come back to see what changed.',
      'Yisho umsebenzi olindelwe esitshalweni ngasinye. Bheka ubufakazi balowo msebenzi nezinkinga ezifana nomthunzi, ukuncintisana ngamanzi noma ukuvaleka kwendlela. Qhathanisa indawo eminyene nevulekile. Sebenzisa okubonile ukukhetha okuzolungiswa, bese ubuya ubheke ushintsho.'),
    chapter: '09-balanced-ecology', section: 3, figure: '09-cowpea-ground-cover',
  },
  'food-forest': {
    title: copy('A path that disappears as the trees grow', 'Indlela enyamalalayo njengoba izihlahla zikhula'),
    scene: copy('On the drawing there is a clear path between the new trees. A person carrying a harvest basket can walk between the young trunks. The family has drawn each tree as a dot, leaving its future shade off the page.',
      'Emdwebeni kukhona indlela ecacile phakathi kwezihlahla ezintsha. Othwele ubhasikidi angahamba phakathi kweziqu ezincane. Umndeni udwebe isihlahla ngasinye njengechashaza, engawufakanga umthunzi waso wesikhathi esizayo.'),
    question: copy('What would you add to the drawing before buying trees?', 'Yini obungayengeza emdwebeni ngaphambi kokuthenga izihlahla?'),
    reasoning: copy('Find a reliable mature size for the trees being considered. Sketch their future crowns, the route for harvest and the places that still need sunlight. Mark where water and care will come from. Keep an unknown size or an unconfirmed planting site as an open question.',
      'Thola ubukhulu obuthembekile bezihlahla lapho sezikhulile. Dweba imiqhele yazo, indlela yokuvuna nezindawo ezisadinga ilanga. Maka lapho kuzovela khona amanzi nokunakekelwa. Shiya uphawu lombuzo uma ubukhulu noma indawo yokutshala kungakaqinisekiswa.'),
    chapter: '06-tree-systems', section: 4, figure: '06-food-forest-layers',
  },
  'small-livestock': {
    title: copy('The same scratching, in a different bed', 'Ukukhuhla okufanayo emibhedeni eyehlukene'),
    scene: copy('A hen scratches up a new seedling. Later the family watches her scratch through leftovers on a harvested patch. The hen has done the same thing twice. Only the place and the timing have changed.',
      'Isikhukhukazi sikhuhla umhlabathi sikhiphe isithombo esisha. Kamuva umndeni usibona sikhuhla izinsalela endaweni esivuniwe. Senze into efanayo. Okushintshile indawo nesikhathi.'),
    question: copy('What goes on the plan besides the job you want the hen to do?', 'Ngaphandle komsebenzi wesikhukhukazi, yini enye efakwa ohlelweni?'),
    reasoning: copy('Draw the animal’s needs alongside the work: water, suitable feed, shelter, protection and someone to check it. Mark growing crops and where food is handled. Think through how people will keep animals and manure away from produce before choosing a place.',
      'Dweba izidingo zaso kanye nomsebenzi: amanzi, ukudla okufanele, indawo yokukhosela, ukuvikeleka nomuntu ozosihlola. Maka izitshalo ezikhulayo nalapho kuphathwa khona ukudla. Cabanga ngendlela yokugcina izilwane nomquba kude nokudla ngaphambi kokukhetha indawo.'),
    chapter: '05-animal-systems', section: 0, figure: '05-chicken-needs-yields',
  },
  'market-community': {
    title: copy('A full basket can come home empty of cash', 'Ubhasikidi ogcwele ungabuya ungenamali'),
    scene: copy('The grower remembers a good harvest. The cash tin tells a different story. Some food stayed in the kitchen, some went to a neighbour and some came home unsold. The bus fare was paid before anything sold.',
      'Umlimi ukhumbula isivuno esihle. Ibhokisi lemali lixoxa enye indaba. Okunye ukudla kwasala ekhishini, okunye kwaya kumakhelwane kanti okunye kwabuya kungathengiswanga. Imali yebhasi yakhokhwa ngaphambi kokuba kudayiswe.'),
    question: copy('Which records would help the family explain the day?', 'Yimaphi amarekhodi angasiza umndeni uchaze okwenzekile?'),
    reasoning: copy('Start with what was picked and account for where it went. Then record money actually received and the cost of the trip. The household food and gifts still have a place in the harvest record. Treating every picked basket as a cash sale would hide both their value and the cost of selling.',
      'Qala ngalokho okuvuniwe bese ubhala ukuthi kuye kuphi. Bhala imali etholakele ngempela nezindleko zohambo. Ukudla kwasekhaya nezipho nakho kubhalwa kwirekhodi lesivuno. Ukubala wonke ubhasikidi ovuniwe njengendali yemali kungafihla ukubaluleka kokudla nezindleko zokudayisa.'),
    chapter: '04-vegetable-and-staple-crops', section: 4, figure: '04-market-garden-rows',
  },
};

// The field task sits beside its lesson's quiz. Stable lesson IDs keep an activity with
// the right reading when a mentor changes the display order.
export const LESSON_FIELD_TASKS: Readonly<Record<string, Copy>> = {
  'intro-permaculture-l1': copy('Draw a harvest basket. Around it, write who needs food, what the garden needs back and what could be shared. Which decision needs a conversation first?', 'Dweba ubhasikidi wesivuno. Bhala ukuthi ubani odinga ukudla, yini ebuyiselwa engadini nokungabelwana ngakho. Yisiphi isinqumo esidinga ingxoxo kuqala?'),
  'intro-permaculture-l2': copy('Choose a place you often pass without stopping. Describe what you see before naming anything you would change. Which principle could help you investigate it?', 'Khetha indawo ovame ukudlula kuyo ungami. Chaza okubonayo ngaphambi kokusho ongakushintsha. Yisiphi isimiso esingakusiza uyihlole?'),
  'intro-permaculture-l3': copy('Trace a daily walk from your door. Add a different arrow for wind or water coming from outside. Explain which mark describes a zone decision and which describes a sector.', 'Landela indlela oyihamba nsuku zonke usuka emnyango. Faka omunye umcibisholo womoya noma wamanzi angenayo. Chaza ukuthi yiluphi uphawu oluphathelene ne-zone nokuthi yiluphi oluphathelene ne-sector.'),
  'reading-landscape-l1': copy('On your sketch, join a visible runoff mark to the place water collects. Mark any part of the route you have only guessed. What would you watch for in the next rain?', 'Emdwebeni hlanganisa umkhondo wamanzi nendawo abuthana kuyo. Maka lapho uqagela khona. Ungabhekani emvuleni elandelayo?'),
  'reading-landscape-l2': copy('Pick a fixed landmark and sketch its shadow. Return at a different time and mark it again. Which part of the proposed bed changed from sun to shade?', 'Khetha into enganyakazi bese udweba umthunzi wayo. Buya ngesinye isikhathi uwumake futhi. Yiyiphi ingxenye yombhede ohlosiwe esuke elangeni yaba semthunzini?'),
  'reading-landscape-l3': copy('Ask someone who walks the site early where frost lingers or wind causes damage. Put their account on the map in a different mark from anything you have seen yourself.', 'Buza umuntu ohamba lapha ekuseni ukuthi isithwathwa sihlala kuphi noma umoya ulimaza kuphi. Maka akushoyo ngokwehlukile kulokho ozibonele khona.'),
  'reading-landscape-l4': copy('Give your sketch to someone who uses the site. Ask them to point out the gate, water source and path without your help. Add the landmark they needed but could not find.', 'Nikeza umuntu osebenzisa indawo umdwebo wakho. Mcele akhombe isango, umthombo wamanzi nendlela ngaphandle kosizo lwakho. Engeza uphawu abeludinga angalutholi.'),
  'water-harvesting-l1': copy('Trace a possible contour on paper only. Mark where water arrives, where overflow could go and what is below it. Which missing observation stops you from choosing a swale?', 'Dweba umugqa wekhontolo ongaba khona ephepheni kuphela. Maka lapho kufika amanzi khona, lapho angachichimela khona nokungaphansi. Yini esadinga ukubonwa ngaphambi kokukhetha i-swale?'),
  'water-harvesting-l2': copy('Sketch a proposed pond from a safe observation point. Mark downstream homes, paths and drainage. List what a qualified local adviser would need to check before any digging.', 'Dweba indawo ehloselwe ichibi usesendaweni ephephile. Maka amakhaya, izindlela nokugeleza kwamanzi ezansi. Bhala lokho uchwepheshe wendawo okufanele akuhlole ngaphambi kokumba.'),
  'water-harvesting-l3': copy('Follow a roof-to-tank route on paper from catchment to use. Add the overflow when the tank is full. Which part of the route can you verify from the ground?', 'Dweba indlela yamanzi kusukela ophahleni kuya ethangini nalapho esetshenziswa khona. Faka indlela yokuchichima uma seligcwele. Yiyiphi ingxenye ongayiqinisekisa umi phansi?'),
  'water-harvesting-l4': copy('Choose a household water source and list what may have entered it. Circle what is unknown. Explain why you would pause a reuse plan until those questions are answered.', 'Khetha umthombo wamanzi asekhaya bese ubhala okungenzeka kungene kuwo. Zungelezela okungaziwa. Chaza ukuthi kungani umisa uhlelo lokuphinda uwasebenzise kuze kuphendulwe imibuzo.'),
  'soil-health-l1': copy('Compare soil from a well-used path with soil in a bed. Record cover, feel and visible roots for each. Separate what your hands tell you from what a test would need to confirm.', 'Qhathanisa inhlabathi yendlela esetshenziswa kakhulu neyombhede. Bhala ngesembozo, ukuthinteka nezimpande ozibonayo. Hlukanisa okuzwa ngezandla kulokho okudinga ukuhlolwa.'),
  'soil-health-l2': copy('Sketch your compost area and list the materials actually available there. Use the lesson to explain what you would check if a heap stayed dry or smelled unpleasant.', 'Dweba indawo yakho yomquba bese ubhala izinto ezitholakala khona. Usebenzisa isifundo, chaza ongakuhlola uma inqwaba yomile noma inuka kabi.'),
  'soil-health-l3': copy('Mark a covered patch and a bare patch you can revisit. After the same rain, compare the soil beneath the surface. Record the date and one other difference that might explain the result.', 'Maka indawo emboziwe nengenalutho ongabuyela kuzo. Ngemva kwemvula efanayo qhathanisa inhlabathi engaphansi. Bhala usuku nomunye umehluko ongachaza umphumela.'),
  'vegetables-staples-l1': copy('Walk from the water source to a proposed bed as if carrying a full can. Draw where you would stand to tend it. Can you reach the planting area without stepping onto the soil?', 'Hamba usuka emanzini uya endaweni yombhede sengathi uphethe ikani eligcwele. Dweba lapho ungama khona ukunakekela izitshalo. Ungafinyelela ngaphandle kokunyathela umbhede?'),
  'vegetables-staples-l2': copy('Use paper strips to show what occupies a bed now and what follows at harvest. Mark any overlap. What must you find out about light, space or timing before committing?', 'Sebenzisa amapheshana ukukhombisa okusembhedeni manje nokuzolandela ngemva kokuvuna. Maka lapho kuhlangana khona. Yini okufanele uyazi ngokukhanya, isikhala noma isikhathi ngaphambi kokunquma?'),
  'vegetables-staples-l3': copy('Ask the person who cooks which staple the household regularly buys. Trace where you would grow, harvest and store it. Which part of that route is still uncertain?', 'Buza ophekayo ukuthi yikuphi ukudla okuyisisekelo umndeni ovame ukukuthenga. Landela indawo ongakutshala, ukuvune bese ukugcina kuyo. Yikuphi okungakaqinisekiswa?'),
  'vegetables-staples-l4': copy('Sketch damage on a leaf and note what else you can actually see. Can you distinguish the damage from its cause? Say what evidence you need before treating the bed.', 'Dweba umonakalo osehlamvini bese ubhala okunye okubonayo. Ungawuhlukanisa umonakalo nembangela yawo? Yisho ubufakazi obudingayo ngaphambi kokwelapha umbhede.'),
  'seeds-sovereignty-l1': copy('Ask where a seed lot came from and what the grower values about it. Write their account separately from anything the packet or your own records confirm.', 'Buza ukuthi imbewu ivelaphi nokuthi umlimi uthandani ngayo. Bhala impendulo yakhe ngokwehlukile kokubhalwe ephaketheni noma okuqinisekiswa amarekhodi akho.'),
  'seeds-sovereignty-l2': copy('Choose a seed lot whose crop you can identify. Use the lesson to explain which collection and cleaning method fits it. What would make you stop and check before mixing it with another lot?', 'Khetha imbewu osaziyo isitshalo sayo. Sebenzisa isifundo uchaze indlela efanele yokuyiqoqa nokuyihlanza. Yini engakwenza ume uhlole ngaphambi kokuyixuba nenye?'),
  'seeds-sovereignty-l3': copy('Make a label a neighbour could still understand next season. Include the crop, variety if known, source and collection date. Leave an honest blank for anything you cannot verify.', 'Yenza ilebula umakhelwane angayiqonda ngesizini ezayo. Faka isitshalo, uhlobo uma lwaziwa, imvelaphi nosuku lokuqoqa. Shiya isikhala kulokho ongeke ukuqinisekise.'),
  'plant-guilds-l1': copy('Name the job expected from a support plant. Draw where it would grow in relation to the crop. List what you need to confirm about identity, local suitability and management before planting.', 'Yisho umsebenzi olindelwe esitshalweni esisekelayo. Dweba indawo yaso eduze kwesilimo. Bhala okufanele ukuqinisekise ngobunjalo baso, ukufaneleka kwendawo nokunakekelwa ngaphambi kokutshala.'),
  'plant-guilds-l2': copy('Watch a flowering patch and describe a visitor without guessing its job. Where did it land and what did it do? What would you need to see again to support your explanation?', 'Buka indawo eqhakazile uchaze isivakashi ungawuqageli umsebenzi waso. Sihlalephi futhi senzeni? Yini okufanele uphinde uyibone ukuze usekele incazelo yakho?'),
  'plant-guilds-l3': copy('Draw a guild as you see it now and mark access for watering and harvest. Beside each plant write its intended role. Which role is visible, and which is still an assumption?', 'Dweba iqoqo lezitshalo njengoba ulibona manje. Maka izindlela zokunisela nokuvuna. Bhala umsebenzi ohlosiwe wesitshalo ngasinye. Yimuphi umsebenzi obonakalayo nosacatshangwayo?'),
  'food-forest-l1': copy('Draw a side view from the soil upward. Mark existing plants at their actual heights and leave a gap where a layer is absent. Where might one canopy shade another?', 'Dweba ubheke eceleni usuka emhlabathini uye phezulu. Maka izitshalo ezikhona ngobude bazo bese ushiya isikhala lapho kungekho ungqimba. Imiqhele ingathunzisana kuphi?'),
  'food-forest-l2': copy('For a tree you are considering, write down what you know about the site’s frost, water and space. Which details about the tree still need a reliable local source?', 'Ngesihlahla osicabangayo, bhala okwaziyo ngesithwathwa, amanzi nesikhala saleyo ndawo. Yini osadinga ukuyiqinisekisa emthonjeni othembekile wendawo?'),
  'food-forest-l3': copy('Walk the proposed maintenance route with someone who would use it. Ask them to point out where they would check water, protect a young tree and carry a harvest out.', 'Hamba indlela ehloselwe ukunakekela izihlahla nomuntu ozoyisebenzisa. Mcele akhombe lapho ezohlola amanzi, avikele isihlahla esincane futhi akhiphe isivuno khona.'),
  'small-livestock-l1': copy('Make separate lists of what a hen needs, what she produces and what she does. Link a behaviour to a suitable task, then name a crop or place that needs protection from it.', 'Hlukanisa uhlu lwezidingo zesikhukhukazi, esikunikezayo nesikwenzayo. Hlanganisa ukuziphatha kwaso nomsebenzi ofanele, bese usho isilimo noma indawo edinga ukuvikelwa kuso.'),
  'small-livestock-l2': copy('From a safe distance away from hives, observe flower visits. Mark the flowers and the paths people use. What would need an experienced beekeeper’s judgement before anyone chose a hive site?', 'Ubuka ukude ngokuphepha nezidleke, bheka ukuvakashelwa kwezimbali. Maka izimbali nezindlela zabantu. Yini okufanele ihlolwe ngumfuyi wezinyosi onolwazi ngaphambi kokukhetha indawo yesidleke?'),
  'small-livestock-l3': copy('Draw an arrow for material moving from an animal area to a growing area. Add the handling steps needed before it reaches crops. Circle any place where people, water or food could be exposed.', 'Dweba umcibisholo wento esuka endaweni yezilwane iye endaweni yezitshalo. Faka izinyathelo zokuyiphatha ngaphambi kokufika ezitshalweni. Zungelezela lapho ingathinta abantu, amanzi noma ukudla.'),
  'market-community-l1': copy('Take a real or remembered harvest. Draw separate lines for food kept, shared, sold and lost. Mark which entries have a measured amount and which you only remember approximately.', 'Khetha isivuno sangempela noma osikhumbulayo. Dweba imigqa ehlukene yokudla okugciniwe, okwabelwe, okuthengisiwe nokulahlekile. Maka okulinganisiwe nokulinganiselwa ngekhanda.'),
  'market-community-l2': copy('Trace a basket from the bed to a potential buyer. Write each cost beside the point it occurs. What would you ask the buyer before deciding whether the trip is worthwhile?', 'Landela ubhasikidi kusuka embhedeni uya kumuntu ongathenga. Bhala izindleko lapho zenzeka khona. Ungambuzani umthengi ngaphambi kokunquma ukuthi kufanelekile yini ukuhamba?'),
  'market-community-l3': copy('Imagine neighbours sharing a delivery. Write a short agreement covering what each person brings, who records the sale, how costs are shared and what happens to unsold produce.', 'Cabanga ngomakhelwane abahambisa isivuno ndawonye. Bhala isivumelwano esifushane salokho umuntu ngamunye azokuletha, ozobhala indali, ukwabelana ngezindleko nokuzokwenzeka ngesivuno esingathengiswanga.'),
};
