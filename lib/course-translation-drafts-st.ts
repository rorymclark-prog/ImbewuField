/** Source-paired Sesotho review draft; selected fields are learner-visible with English source. */
export type SesothoDraftReviewStatus = 'machine-draft' | 'hold';

export interface SesothoSourcePair {
  sourceEnglish: string;
  sesothoDraft: string;
  reviewStatus: SesothoDraftReviewStatus;
}

export interface SesothoCourseQuizDraft {
  question: SesothoSourcePair;
  options: SesothoSourcePair[];
  /** Answer index copied unchanged from the English source. */
  sourceCorrectIndex: number;
  rationale: SesothoSourcePair;
}

export interface SesothoCourseLessonDraft {
  id: string;
  infographicAlt?: SesothoSourcePair;
  title: SesothoSourcePair;
  body: SesothoSourcePair;
  keyPoints: SesothoSourcePair[];
  quiz: SesothoCourseQuizDraft[];
}

export interface SesothoCourseModuleDraft {
  id: string;
  language: 'st';
  reviewStatus: 'machine-draft';
  sourceMetadata: { durationMins: number; category: string };
  title: SesothoSourcePair;
  description: SesothoSourcePair;
  lessons: SesothoCourseLessonDraft[];
}

const pair = (sourceEnglish: string, sesothoDraft: string): SesothoSourcePair => ({
  sourceEnglish,
  sesothoDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): SesothoSourcePair => ({
  sourceEnglish,
  sesothoDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const SESOTHO_INTRO_PERMACULTURE_DRAFT: SesothoCourseModuleDraft = {
  id: "intro-permaculture",
  language: 'st',
  reviewStatus: 'machine-draft',
  sourceMetadata: {
    durationMins: 20,
    category: "foundation",
  },
  title: pair(
    "Introduction to Permaculture",
    "Kenyelletso ho Permaculture",
  ),
  description: pair(
    "Ethics, principles and patterns — the foundation for everything else you will build.",
    "Melao ea boitshwaro (ethics), melao-motheo le mekhoa (patterns) — motheo oa tsohle tseo u tla li haha.",
  ),
  lessons: [
    {
      id: "intro-permaculture-l1",
      infographicAlt: pair(
        "The three ethics as three linked circles of equal size: a hand holding soil for Earth Care, two people for People Care, and a basket passing between hands for Fair Share.",
        "Melao e meraro ea boitshwaro e le liserekela tse tharo tse kopaneng tsa boholo bo lekanang: letsoho le tšoereng mobu bakeng sa Tlhokomelo ea Lefatše (Earth Care), batho ba babeli bakeng sa Tlhokomelo ea Batho (People Care), le seroto se fetang lipakeng tsa matsoho bakeng sa Karolelano e Lokileng (Fair Share).",
      ),
      title: pair(
        "The Three Ethics: Earth Care, People Care, Fair Share",
        "Melao e Meraro ea Boitshwaro: Tlhokomelo ea Lefatše, Tlhokomelo ea Batho, Karolelano e Lokileng",
      ),
      body: hold(
        "Permaculture rests on three ethics. Earth Care means treating soil, water, plants and animals as living systems to protect, not resources to use up. People Care means your family's needs come first, then your community's. Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.\n\nThese aren't abstract ideas. A farmer who sells every egg and vegetable but keeps nothing back for the family table is skipping People Care. A community that fences off a shared spring is breaking Fair Share.\n\nEthics matter because they help you decide when there's no rulebook — a neighbour asking to graze cattle after a drought, a flood damaging your swales. Build these three into how you think before you build anything on the ground.",
      ),
      keyPoints: [
        pair(
          "Earth Care: protect soil, water, and biodiversity",
          "Tlhokomelo ea Lefatše: sireletsa mobu, metsi, le mefuta-futa ea lintho tse phelang (biodiversity)",
        ),
        pair(
          "People Care: your family's needs come before market production",
          "Tlhokomelo ea Batho: litlhoko tsa lelapa la hao li tla pele ho lihlahisoa tse eang 'marakeng",
        ),
        pair(
          "Fair Share: return surplus to the system — seeds, water, food, knowledge",
          "Karolelano e Lokileng: khutlisetsa tse setseng ka har'a tsamaiso — lipeo, metsi, lijo, tsebo",
        ),
        pair(
          "Ethics guide decisions when there's no rulebook",
          "Melao ea boitshwaro e tataisa liqeto ha ho se na buka ea melao",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
            "Molemi o rekisa poone (maize) eohle ea hae e setseng empa ha a boloke letho bakeng sa ho etsa manyolo a litlama (composting) kapa ho boloka lipeo. Ke ofe molao oa boitshwaro oo a o tlolang haholo?",
          ),
          options: [
            pair(
              "Earth Care only",
              "Tlhokomelo ea Lefatše feela",
            ),
            pair(
              "People Care only",
              "Tlhokomelo ea Batho feela",
            ),
            pair(
              "Fair Share — he returns nothing to the system",
              "Karolelano e Lokileng — ha a khutlisetse letho tsamaisong",
            ),
            pair(
              "All three equally",
              "Tse tharo kaofela ka ho lekana",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "Fair Share means returning some of what you take — as seed, compost, or food for others. Selling everything and keeping nothing back breaks that cycle.",
            "Karolelano e Lokileng e bolela ho khutlisa karolo ea seo u se nkang — e le peo, compost, kapa lijo bakeng sa ba bang. Ho rekisa tsohle le ho se boloke letho morao ho roba potoloho eo.",
          ),
        },
        {
          question: pair(
            "Your borehole serves your household. Neighbours ask for water too. Which action best reflects all three ethics?",
            "Borehole ea hao e sebeletsa ntlo ea hao. Baahelani le bona ba kopa metsi. Ke ketso efe e bontšang hantle melao e meraro ea boitshwaro?",
          ),
          options: [
            pair(
              "Sell access to the highest bidder",
              "Rekisa phihlello ho motho ea lefang chelete e ngata ka ho fetisisa",
            ),
            pair(
              "Keep all the borehole water for a larger irrigation area",
              "Boloka metsi 'ohle a borehole bakeng sa sebaka se seholo sa nosetso",
            ),
            pair(
              "Find out if sharing is allowed and if the borehole can serve all users. Only then agree how to share fairly and keep watching the water level.",
              "Fumana hore na ho arolelana ho lumelletsoe le hore na borehole e ka khona ho sebeletsa basebelisi bohle. Ke hona feela u lumellanang ka mokhoa oa ho arolelana ka toka le ho lula u lekola bophahamo ba metsi.",
            ),
            pair(
              "Cap the borehole to preserve groundwater only",
              "Koala borehole ka sekoahelo e le ho boloka feela metsi a ka tlas'a lefatše",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "First find out what water use is allowed and whether the source can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly. Monitoring helps you notice change; it does not give permission to take more water.",
            "Pele fumana hore na ke tšebeliso efe ea metsi e lumelletsoeng le hore na mohloli o ka khona ho sebeletsa basebelisi bohle ntle le ho nka ho hoholo. Haeba ho arolelana ho lumelletsoe mme metsi a lekane, lumellanang ka mokhoa oa ho arolelana ka toka. Ho lula u lekola ho u thusa ho hlokomela liphetoho; ha ho fane ka tumello ea ho nka metsi a mangata.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l2",
      infographicAlt: pair(
        "Twelve design principles arranged as segments around a central seedling, each shown as a simple picture — an eye for observing, a droplet for catching water, a sun for energy, a loop for returning waste.",
        "Melao-motheo ea moralo e leshome le metso e 'meli e hlophisitsoeng e le likarolo ho potoloha semela se senyenyane se bohareng, e 'ngoe le e 'ngoe e bontšitsoe e le setšoantšo se bonolo — leihlo bakeng sa ho shebella, lerotholi bakeng sa ho tšoara metsi, letsatsi bakeng sa matla, le selikalikoe bakeng sa ho khutlisetsa litšila.",
      ),
      title: pair(
        "Twelve Principles: Designing with Nature",
        "Melao-motheo e Leshome le Metso e 'Meli: Ho Rala le Tlhaho",
      ),
      body: hold(
        "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
      ),
      keyPoints: [
        pair(
          "Observe your land for a full season before major earthworks",
          "Shebella naha ea hao sehla se feletseng pele u etsa mesebetsi e meholo ea mobu",
        ),
        pair(
          "Catch and store rain, sun, and biomass before they leave your property",
          "Tšoara le ho boloka pula, letsatsi, le biomass pele li tloha setšeng sa hao",
        ),
        pair(
          "Edges and margins can be useful places to observe what grows well",
          "Mathoko le libaka tse ka thoko e ka ba libaka tse sebetsang tsa ho shebella se melang hantle",
        ),
        pair(
          "Hail injury to maize depends on the storm and the crop’s growth stage",
          "Tšenyo ea sefako holim'a poone (maize) e itšetlehile ka sefefo le boemo ba kholo ea lijalo",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            "Molemi o batla ho cheka li-swale ho kotula metsi a pula. O lokela ho etsa eng pele, a latela 'sheba 'me u sebelisane' (observe and interact)?",
          ),
          options: [
            pair(
              "Dig immediately after the first good rain",
              "Cheka hang-hang ka mor'a pula ea pele e ntle",
            ),
            pair(
              "Watch where water flows and pools across at least one wet season",
              "Shebella moo metsi a phallang teng le moo a bokellanang teng bonyane nakong ea sehla se le seng sa lipula",
            ),
            pair(
              "Copy a neighbour's swale layout",
              "Kopitsa moralo oa li-swale tsa moahelani",
            ),
            pair(
              "Assume the same swale design fits every site",
              "Nka hore moralo o tšoanang oa swale o lekana sebaka se seng le se seng",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: hold(
            "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
          ),
        },
        {
          question: pair(
            "Which layout best applies 'integrate rather than segregate'?",
            "Ke moralo ofe o sebelisang hantle 'kopanya ho e-na le ho arola' (integrate rather than segregate)?",
          ),
          options: [
            pair(
              "Chickens penned far from the garden",
              "Likhoho tse koaletsoeng hole le serapa",
            ),
            hold(
              "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
            ),
            pair(
              "Separate paddocks for each crop",
              "Likotoana tse arohaneng bakeng sa sejalo ka seng",
            ),
            pair(
              "All animals kept off the cultivated zone",
              "Liphoofolo tsohle li behelloa ka thoko ho sebaka se lengoang",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "Kopanyo e etsa hore karolo ka 'ngoe e sebeletse baahisani ba eona — mona, likhoho li hloekisa likokoanyana 'me li eketsa menontsha ho e-na le ho lula feela ka lesakeng le sa sisinyeheng. Manyolo a macha a ka jara likokoana-hloko, kahoo hlahloba tsamaiso e bolokehileng pele lijalo tse jeoang li khutla.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l3",
      infographicAlt: pair(
        "Rings spreading outward from a house. The ring closest to the door is tended every day; each ring further out is visited less often and left wilder.",
        "Masale a phatlaletseng ho tloha ntlong ho ea kantle. Lesale le haufi haholo le monyako le hlokomeloa letsatsi le leng le le leng; lesale ka leng le fetang kantle le eteloa ka sewelo 'me le siuoa le hlaha le ho feta.",
      ),
      title: pair(
        "Zones and Sectors: Organising Your Farm by Energy",
        "Libaka (Zones) le Makala (Sectors): Ho Hlophisa Polasi ea Hao ka Matla",
      ),
      body: pair(
        "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        "Libaka (zones) le makala (sectors) li u thusa ho fokotsa mosebetsi o senyehang. Libaka li tloha ho 0 ho ea ho 5 ho latela hore na u li etela hangata hakae. Zone 0 ke ntlo. Mohlaleng ona, Zone 1 e haufi le ntlo 'me e tšoere tseo u li kholang khafetsa — litlama (herbs), meroho ea salate. Zone 2 ke serapa se seholo le lesaka la likhoho (chicken run), tse eteloang hanngoe kapa habeli ka letsatsi. Zone 3 ke tšimo e kholo, e eteloang beke le beke. Zone 4 ke sebaka se batlang se le hlaha — lifate tsa litholoana le furu tse hlokang tlhokomelo ea sewelo. Zone 5 e siiloe e le hlaha.\n\nMakala (sectors) ke matla a tsoang kantle — letsatsi, moea, pula, moroallo, mollo. Shebella moo moea o matla o tsoang teng polasing ea hao. Litlaleho tsa seteishene sa boemo ba leholimo se haufi li ka u thusa ho hlahloba tsela ea moea. Shebella moo metsi a pula a kenang teng le moo a phallang ho pholletsa le naha ea hao. Thala metsu bakeng sa seo u se hlokomelang.\n\nThala libaka le makala pampiring 'me u na le sebopeho sa motheo (skeleton) sa moralo oa hao.",
      ),
      keyPoints: [
        pair(
          "In this example, Zone 1 near the house holds often-picked herbs",
          "Mohlaleng ona, Zone 1 e haufi le ntlo e tšoere litlama tse kholoang khafetsa",
        ),
        pair(
          "Zones organise labour by how often you need to visit",
          "Libaka li hlophisa mosebetsi ho latela hore na u lokela ho etela hangata hakae",
        ),
        pair(
          "Sectors map incoming sun, wind, rainwater, flood and fire",
          "Makala a etsa 'mmapa oa letsatsi le kenang, moea, metsi a pula, moroallo le mollo",
        ),
        pair(
          "A simple sketch of zones and sectors is enough to start designing",
          "Setšoantšo se bonolo sa libaka le makala se lekane ho qala ho rala",
        ),
      ],
      quiz: [
        {
          question: pair(
            "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            "U lema litlama ho Zone 3, tšimo e kholo e hole le ntlo. See se baka bothata bofe?",
          ),
          options: [
            pair(
              "Herbs grow too large",
              "Litlama li hōla haholo ho feta tekano",
            ),
            pair(
              "The extra walk may mean you pick or check them less often",
              "Ho tsamaea ho eketsehileng ho ka bolela hore u li khola kapa u li hlahloba ka sewelo",
            ),
            pair(
              "Herbs cross-pollinate with main crops",
              "Litlama li tsoakana peo (cross-pollinate) le lijalo tse kholo",
            ),
            pair(
              "Zone 3 gets too much sun for herbs",
              "Zone 3 e fumana letsatsi le lengata haholo bakeng sa litlama",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "Beha sejalo seo u se kholang khafetsa haufi le tselana ea letsatsi le letsatsi. Jarete e hole e eketsa ho tsamaea 'me e ka hlahlojoa ka sewelo.",
          ),
        },
        {
          question: pair(
            "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?",
            "U hlokomela moea o senyang o tsoang leboea-bophirima (north-west) polasing ea Highveld. Sesireletsi sa moea (windbreak) se lokela ho kena kae?",
          ),
          options: [
            pair(
              "South-east boundary",
              "Moeling oa boroa-bochabela (south-east)",
            ),
            pair(
              "North-west boundary, between the wind and the crops",
              "Moeling oa leboea-bophirima (north-west), lipakeng tsa moea le lijalo",
            ),
            pair(
              "Centre of the property",
              "Bohareng ba setša",
            ),
            pair(
              "Windbreaks aren't needed since winds are seasonal",
              "Lisireletsi tsa moea ha li hlokahale kaha meea ke ea linako tsa selemo",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "Sesireletsi sa moea se sebetsa ka ho ema lipakeng tsa mohloli oa moea le seo se ka se senyang — kahoo se sebakeng seo moea o hlileng o tsoang ho sona.",
          ),
        },
      ],
    },
  ],
};

// Learner wiring follows in a separate PR and must retain the draft label and paired English source.
