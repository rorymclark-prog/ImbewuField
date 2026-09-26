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
    "Melao ya boitshwaro (ethics), melao-motheo le mekgwa (patterns) — motheo wa tsohle tseo o tla di haha.",
  ),
  lessons: [
    {
      id: "intro-permaculture-l1",
      infographicAlt: pair(
        "The three ethics as three linked circles of equal size: a hand holding soil for Earth Care, two people for People Care, and a basket passing between hands for Fair Share.",
        "Melao e meraro ya boitshwaro e le diserekela tse tharo tse kopaneng tsa boholo bo lekanang: letsoho le tshwereng mobu bakeng sa Tlhokomelo ya Lefatshe (Earth Care), batho ba babedi bakeng sa Tlhokomelo ya Batho (People Care), le seroto se fetang dipakeng tsa matsoho bakeng sa Karolelano e Lokileng (Fair Share).",
      ),
      title: pair(
        "The Three Ethics: Earth Care, People Care, Fair Share",
        "Melao e Meraro ya Boitshwaro: Tlhokomelo ya Lefatshe, Tlhokomelo ya Batho, Karolelano e Lokileng",
      ),
      body: hold(
        "Permaculture rests on three ethics. Earth Care means treating soil, water, plants and animals as living systems to protect, not resources to use up. People Care means your family's needs come first, then your community's. Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.\n\nThese aren't abstract ideas. A farmer who sells every egg and vegetable but keeps nothing back for the family table is skipping People Care. A community that fences off a shared spring is breaking Fair Share.\n\nEthics matter because they help you decide when there's no rulebook — a neighbour asking to graze cattle after a drought, a flood damaging your swales. Build these three into how you think before you build anything on the ground.",
      ),
      keyPoints: [
        pair(
          "Earth Care: protect soil, water, and biodiversity",
          "Tlhokomelo ya Lefatshe: sireletsa mobu, metsi, le mefuta-futa ya dintho tse phelang (biodiversity)",
        ),
        pair(
          "People Care: your family's needs come before market production",
          "Tlhokomelo ya Batho: ditlhoko tsa lelapa la hao di tla pele ho dihlahiswa tse yang mmarakeng",
        ),
        pair(
          "Fair Share: return surplus to the system — seeds, water, food, knowledge",
          "Karolelano e Lokileng: kgutlisetsa tse setseng ka hara tsamaiso — dipeo, metsi, dijo, tsebo",
        ),
        pair(
          "Ethics guide decisions when there's no rulebook",
          "Melao ya boitshwaro e tataisa diqeto ha ho se na buka ya melao",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
            "Molemi o rekisa poone (maize) yohle ya hae e setseng empa ha a boloke letho bakeng sa ho etsa kompose (composting) kapa ho boloka dipeo. Ke ofe molao wa boitshwaro oo a o tlolang haholo?",
          ),
          options: [
            pair(
              "Earth Care only",
              "Tlhokomelo ya Lefatshe feela",
            ),
            pair(
              "People Care only",
              "Tlhokomelo ya Batho feela",
            ),
            pair(
              "Fair Share — he returns nothing to the system",
              "Karolelano e Lokileng — ha a kgutlisetse letho tsamaisong",
            ),
            pair(
              "All three equally",
              "Tse tharo kaofela ka ho lekana",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "Fair Share means returning some of what you take — as seed, compost, or food for others. Selling everything and keeping nothing back breaks that cycle.",
            "Karolelano e Lokileng e bolela ho kgutlisa karolo ya seo o se nkang — e le peo, kompose, kapa dijo bakeng sa ba bang. Ho rekisa tsohle le ho se boloke letho morao ho roba potoloho eo.",
          ),
        },
        {
          question: pair(
            "Your borehole serves your household. Neighbours ask for water too. Which action best reflects all three ethics?",
            "Borehole ya hao e sebeletsa ntlo ya hao. Baahelani le bona ba kopa metsi. Ke ketso efe e bontshang hantle melao e meraro ya boitshwaro?",
          ),
          options: [
            pair(
              "Sell access to the highest bidder",
              "Rekisa phihlello ho motho ya lefang tjhelete e ngata ka ho fetisisa",
            ),
            pair(
              "Keep all the borehole water for a larger irrigation area",
              "Boloka metsi ohle a borehole bakeng sa sebaka se seholo sa nosetso",
            ),
            pair(
              "Find out if sharing is allowed and if the borehole can serve all users. Only then agree how to share fairly and keep watching the water level.",
              "Fumana hore na ho arolelana ho dumelletswe le hore na borehole e ka kgona ho sebeletsa basebedisi bohle. Ke hona feela o dumellanang ka mokgwa wa ho arolelana ka toka le ho dula o lekola bophahamo ba metsi.",
            ),
            pair(
              "Cap the borehole to preserve groundwater only",
              "Kwala borehole ka sekwahelo e le ho boloka feela metsi a ka tlasa lefatshe",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "First find out what water use is allowed and whether the source can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly. Monitoring helps you notice change; it does not give permission to take more water.",
            "Pele fumana hore na ke tshebediso efe ya metsi e dumelletsweng le hore na mohlodi o ka kgona ho sebeletsa basebedisi bohle ntle le ho nka ho hoholo. Haeba ho arolelana ho dumelletswe mme metsi a lekane, dumellanang ka mokgwa wa ho arolelana ka toka. Ho dula o lekola ho o thusa ho hlokomela diphetoho; ha ho fane ka tumello ya ho nka metsi a mangata.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l2",
      infographicAlt: pair(
        "Twelve design principles arranged as segments around a central seedling, each shown as a simple picture — an eye for observing, a droplet for catching water, a sun for energy, a loop for returning waste.",
        "Melao-motheo ya moralo e leshome le metso e mmedi e hlophisitsweng e le dikarolo ho potoloha semela se senyenyane se bohareng, e nngwe le e nngwe e bontshitswe e le setshwantsho se bonolo — leihlo bakeng sa ho shebella, lerothodi bakeng sa ho tshwara metsi, letsatsi bakeng sa matla, le sedikadikwe bakeng sa ho kgutlisetsa ditshila.",
      ),
      title: pair(
        "Twelve Principles: Designing with Nature",
        "Melao-motheo e Leshome le Metso e Mmedi: Ho Rala le Tlhaho",
      ),
      body: hold(
        "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
      ),
      keyPoints: [
        pair(
          "Observe your land for a full season before major earthworks",
          "Shebella naha ya hao sehla se feletseng pele o etsa mesebetsi e meholo ya mobu",
        ),
        pair(
          "Catch and store rain, sun, and biomass before they leave your property",
          "Tshwara le ho boloka pula, letsatsi, le biomass pele di tloha setsheng sa hao",
        ),
        pair(
          "Edges and margins can be useful places to observe what grows well",
          "Mathoko le dibaka tse ka thoko e ka ba dibaka tse sebetsang tsa ho shebella se melang hantle",
        ),
        pair(
          "Hail injury to maize depends on the storm and the crop’s growth stage",
          "Tshenyo ya sefako hodima poone (maize) e itshetlehile ka sefefo le boemo ba kgolo ya dijalo",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            "Molemi o batla ho tjheka mekero (swales) ho kotula metsi a pula. O lokela ho etsa eng pele, a latela 'sheba mme o sebedisane' (observe and interact)?",
          ),
          options: [
            pair(
              "Dig immediately after the first good rain",
              "Tjheka hang-hang ka mora pula ya pele e ntle",
            ),
            pair(
              "Watch where water flows and pools across at least one wet season",
              "Shebella moo metsi a phallang teng le moo a bokellanang teng bonyane nakong ya sehla se le seng sa dipula",
            ),
            pair(
              "Copy a neighbour's swale layout",
              "Kopitsa moralo wa mekero ya moahelani",
            ),
            pair(
              "Assume the same swale design fits every site",
              "Nka hore moralo o tshwanang wa mokero (swale) o lekana sebaka se seng le se seng",
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
            "Ke moralo ofe o sebedisang hantle 'kopanya ho e na le ho arola' (integrate rather than segregate)?",
          ),
          options: [
            pair(
              "Chickens penned far from the garden",
              "Dikgoho tse kwaletsweng hole le serapa",
            ),
            hold(
              "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
            ),
            pair(
              "Separate paddocks for each crop",
              "Dikotwana tse arohaneng bakeng sa sejalo ka seng",
            ),
            pair(
              "All animals kept off the cultivated zone",
              "Diphoofolo tsohle di behellwa ka thoko ho sebaka se lengwang",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "Kopanyo e etsa hore karolo ka nngwe e sebeletse baahisani ba yona — mona, dikgoho di hlwekisa dikokwanyana mme di eketsa menontsha ho e na le ho dula feela ka lesakeng le sa sisinyeheng. Manyolo a matjha a ka jara dikokwana-hloko, kahoo hlahloba tsamaiso e bolokehileng pele dijalo tse jewang di kgutla.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l3",
      infographicAlt: pair(
        "Rings spreading outward from a house. The ring closest to the door is tended every day; each ring further out is visited less often and left wilder.",
        "Masale a phatlaletseng ho tloha ntlong ho ya kantle. Lesale le haufi haholo le monyako le hlokomelwa letsatsi le leng le le leng; lesale ka leng le fetang kantle le etelwa ka sewelo mme le siuwa le hlaha le ho feta.",
      ),
      title: pair(
        "Zones and Sectors: Organising Your Farm by Energy",
        "Dibaka (Zones) le Makala (Sectors): Ho Hlophisa Polasi ya Hao ka Matla",
      ),
      body: pair(
        "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        "Dibaka (zones) le makala (sectors) di o thusa ho fokotsa mosebetsi o senyehang. Dibaka di tloha ho 0 ho ya ho 5 ho latela hore na o di etela hangata hakae. Zone 0 ke ntlo. Mohlaleng ona, Zone 1 e haufi le ntlo mme e tshwere tseo o di kgolang kgafetsa — ditlama (herbs), meroho ya salate. Zone 2 ke serapa se seholo le lesaka la dikgoho (chicken run), tse etelwang hanngwe kapa habedi ka letsatsi. Zone 3 ke tshimo e kgolo, e etelwang beke le beke. Zone 4 ke sebaka se batlang se le hlaha — difate tsa ditholwana le furu tse hlokang tlhokomelo ya sewelo. Zone 5 e siilwe e le hlaha.\n\nMakala (sectors) ke matla a tswang kantle — letsatsi, moya, pula, morwallo, mollo. Shebella moo moya o matla o tswang teng polasing ya hao. Ditlaleho tsa seteishene sa boemo ba lehodimo se haufi di ka o thusa ho hlahloba tsela ya moya. Shebella moo metsi a pula a kenang teng le moo a phallang ho pholletsa le naha ya hao. Thala metsu bakeng sa seo o se hlokomelang.\n\nThala dibaka le makala pampiring mme o na le sebopeho sa motheo (skeleton) sa moralo wa hao.",
      ),
      keyPoints: [
        pair(
          "In this example, Zone 1 near the house holds often-picked herbs",
          "Mohlaleng ona, Zone 1 e haufi le ntlo e tshwere ditlama tse kgolwang kgafetsa",
        ),
        pair(
          "Zones organise labour by how often you need to visit",
          "Dibaka di hlophisa mosebetsi ho latela hore na o lokela ho etela hangata hakae",
        ),
        pair(
          "Sectors map incoming sun, wind, rainwater, flood and fire",
          "Makala a etsa mmapa wa letsatsi le kenang, moya, metsi a pula, morwallo le mollo",
        ),
        pair(
          "A simple sketch of zones and sectors is enough to start designing",
          "Setshwantsho se bonolo sa dibaka le makala se lekane ho qala ho rala",
        ),
      ],
      quiz: [
        {
          question: pair(
            "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            "O lema ditlama ho Zone 3, tshimo e kgolo e hole le ntlo. See se baka bothata bofe?",
          ),
          options: [
            pair(
              "Herbs grow too large",
              "Ditlama di hola haholo ho feta tekano",
            ),
            pair(
              "The extra walk may mean you pick or check them less often",
              "Ho tsamaya ho eketsehileng ho ka bolela hore o di kgola kapa o di hlahloba ka sewelo",
            ),
            pair(
              "Herbs cross-pollinate with main crops",
              "Ditlama di tswakana peo (cross-pollinate) le dijalo tse kgolo",
            ),
            pair(
              "Zone 3 gets too much sun for herbs",
              "Zone 3 e fumana letsatsi le lengata haholo bakeng sa ditlama",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "Beha sejalo seo o se kgolang kgafetsa haufi le tselana ya letsatsi le letsatsi. Jarete e hole e eketsa ho tsamaya mme e ka hlahlojwa ka sewelo.",
          ),
        },
        {
          question: pair(
            "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?",
            "O hlokomela moya o senyang o tswang leboya-bophirima (north-west) polasing ya Highveld. Sesireletsi sa moya (windbreak) se lokela ho kena kae?",
          ),
          options: [
            pair(
              "South-east boundary",
              "Moeding wa borwa-botjhabela (south-east)",
            ),
            pair(
              "North-west boundary, between the wind and the crops",
              "Moeding wa leboya-bophirima (north-west), dipakeng tsa moya le dijalo",
            ),
            pair(
              "Centre of the property",
              "Bohareng ba setsha",
            ),
            pair(
              "Windbreaks aren't needed since winds are seasonal",
              "Disireletsi tsa moya ha di hlokahale kaha meya ke ya dinako tsa selemo",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "Sesireletsi sa moya se sebetsa ka ho ema dipakeng tsa mohlodi wa moya le seo se ka se senyang — kahoo se sebakeng seo moya o hlileng o tswang ho sona.",
          ),
        },
      ],
    },
  ],
};

// Learner wiring follows in a separate PR and must retain the draft label and paired English source.
