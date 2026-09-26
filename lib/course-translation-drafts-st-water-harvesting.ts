/** Unpublished, source-paired Sesotho draft for Water Harvesting. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const pair = (sourceEnglish: string, sesothoDraft: string, reviewStatus: SesothoSourcePair['reviewStatus'] = 'machine-draft'): SesothoSourcePair => ({
  sourceEnglish, sesothoDraft, reviewStatus,
});

export const SESOTHO_WATER_HARVESTING_DRAFT: SesothoCourseModuleDraft = {
  id: 'water-harvesting', language: 'st', reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 35, category: "water" },
  title: pair("Water Harvesting", "Ho Kotula Metsi (Water Harvesting)", "machine-draft"),
  description: pair("Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop.", "Meralo ya mekero le marako a mobu (swales le berms), matamo, ditanka tsa metsi a pula le metsi a ditshila a malapeng (greywater) — fokotsa lebelo, phatlalatsa mme o tebise lerothodi le leng le le leng.", "machine-draft"),
  lessons: [
    {
      id: "water-harvesting-l1",
      infographicAlt: pair("Concept cross-section of a level contour swale with a raised mound below it. Arrows show runoff slowing and spreading; infiltration depends on the soil and site.", "Karolo e sehilweng ya mohopolo ya mokero o lekaneng o latelang contour (level contour swale) o nang le qubu e phahamisitsweng ka tlase ho wona. Metsu e bontsha metsi a phallang a fokotsa lebelo le ho phatlalala; ho teba ha metsi ho itshetlehile ka mobu le setsha.", "machine-draft"),
      title: pair("Swales and Berms: Slowing Water on the Slope", "Mekero le Marako a Mobu (Swales le Berms): Ho Fokotsa Lebelo la Metsi Letswapong", "machine-draft"),
      body: pair("One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.", "One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.", "hold"),
      keyPoints: [
        pair("A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet", "Mokero o lekaneng o latelang contour (level contour swale) o ka tshwara metsi a phallang hore a tebe setsheng se loketseng; mekero e meng e hloka tshekamo e radilweng le sebaka se bolokehileng sa ho tswela kantle", "machine-draft"),
        pair("Keep good ground cover and plan a safe overflow", "Boloka sekwahelo se setle sa mobu mme o rale tsela e bolokehileng ya metsi a mangata a tswelang kantle", "machine-draft"),
        pair("Assess soil, drainage, slope and storm flow before digging", "Lekola mobu, tsamaiso ya metsi (drainage), letswapo le phallo ya sefefo pele o tjheka", "machine-draft"),
        pair("A concept picture is not a construction design", "Setshwantsho sa mohopolo hase moralo wa kaho", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("A farmer planned a level contour swale. After heavy rain, one end holds most of the water. What should the farmer check before changing the earthwork?", "Sehwai se radile mokero o lekaneng o latelang contour (level contour swale). Kamora pula e matla, ntlha e nngwe e tshwara boholo ba metsi. Sehwai se lokela ho hlahloba eng pele se fetola mosebetsi wa mobu?", "machine-draft"),
          options: [
            pair("Whether the trench can be made deeper without a site check", "Hore na mokero o ka etswa o tebileng haholwanyane ntle le tlhahlobo ya setsha", "machine-draft"),
            pair("The intended design and measured levels with a trained local adviser; an unintended low point may be present", "Moralo o neng o rerilwe le maemo a lekotsweng le moeletsi ya rutilweng wa sebaka seo; ho ka ba le sebaka se tlase se neng se sa rerwa", "machine-draft"),
            pair("Whether a new dam at the lowest point will catch every overflow", "Hore na letamo le letjha sebakeng se tlase ka ho fetisisa le tla tshwara phallo e nngwe le e nngwe ya metsi a tletseng", "machine-draft"),
            pair("Whether the soil should be compacted to stop all infiltration", "Hore na mobu o lokela ho pitlwa ho emisa ho teba hohle ha metsi", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A level contour design should spread water along its length. Uneven filling may indicate an unintended low point, but some swales are intentionally graded to a safe outlet. Check the actual design, soil and overflow route before altering it.", "Moralo o lekaneng o latelang contour (level contour design) o lokela ho phatlalatsa metsi bolelele ba wona. Ho tlala ho sa lekanang ho ka bontsha sebaka se tlase se sa rerwang, empa mekero e meng (swales) e etsetswa ho sekama ka morero ho ya sebakeng se bolokehileng sa ho tswela kantle. Hlahloba moralo wa sebele, mobu le tsela ya metsi a mangata pele o e fetola.", "machine-draft"),
        },
        {
          question: pair("A farmer wants to control erosion on steep land. What should she do before digging?", "A farmer wants to control erosion on steep land. What should she do before digging?", "hold"),
          options: [
            pair("Standard swales dug as deep as possible", "Mekero (swales) e tlwaelehileng e tjhekilweng ka botebo bo phahameng ka hohle kamoo ho ka kgonehang", "machine-draft"),
            pair("Keep ground covered and get a site assessment for suitable erosion controls", "Ho boloka mobu o kwahetswe le ho fumana tlhahlobo ya setsha bakeng sa taolo e loketseng ya kgoholeho", "machine-draft"),
            pair("A large dam at the bottom to catch all runoff", "Letamo le leholo tlase ho tshwara metsi ohle a phallang", "machine-draft"),
            pair("Compacting the soil surface with a roller", "Ho pitla bokahodimo ba mobu ka rolara", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Slope alone is not enough to choose an earthwork. Soil, drainage, stability and storm flow must also be assessed.", "Letswapo feela ha le a lekana ho kgetha mosebetsi wa mobu. Mobu, tsamaiso ya metsi (drainage), botsitso le phallo ya sefefo le tsona di tlameha ho lekolwa.", "machine-draft"),
        },
      ],
    },
    {
      id: "water-harvesting-l2",
      infographicAlt: pair("A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.", "Letamo la polasi le sehilweng hara: metsi a kenang ntlheng e nngwe, bongata ba metsi a bolokilweng, tsela ya metsi a tletseng (spillway) ntlheng e kahodimo bakeng sa phallo e tletseng, le lebopo le jetsweng le tshwereng mobu.", "machine-draft"),
      title: pair("Farm Dams and Ponds: Storing Water for the Dry Season", "Matamo a Polasi le Matangwana: Ho Boloka Metsi Bakeng sa Sehla sa Komelelo", "machine-draft"),
      body: pair("A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.\n\nRainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.\n\nBefore changing a watercourse or building storage works, check the required authorisation with the water authority.\n\nA dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.\n\nDo not assume that annual rainfall tells you the size of a flood or the storage you will have.\n\nAn uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction.\n\nWater can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.\n\nAnimals can damage banks and add manure to the water. Their presence does not make the water clean or safe.", "Letamo kapa letangwana le ka boloka metsi a phallang, empa bongata bo fumanehang bo itshetlehile ka pula ya sebaka seo, sebaka se kgoboketsang metsi (catchment), tahlehelo le hore na o sebedisa metsi a makae.\n\nDihla tsa pula di fapana ho pholletsa le Afrika Borwa (South Africa). Sebedisa ditlaleho tsa sebaka seo mme o rale bakeng sa dinako tsa komelelo; letamo le tletseng ha le a tiisetswa.\n\nPele o fetola tsela ya noka kapa molatswana (watercourse) kapa o haha meaho ya polokelo, hlahloba tumello e hlokahalang le balaodi ba metsi.\n\nLetamo le hloka dipatlisiso tsa setsha le moralo o entsweng ke motho ya nang le ditshwaneleho tse loketseng. Metsi a phallang ho tswa sebakeng sa pokellelo (catchment runoff), mobu, metheo, kotsi e ka tlase (downstream risk) le tsela e bolokehileng ya metsi a tletseng (safe spillway) kaofela a bohlokwa.\n\nO se ke wa nka hore pula ya selemo le selemo e o jwetsa boholo ba morwallo kapa polokelo eo o tla ba le yona.\n\nPhallo e sa laolweng ya metsi a tletseng e ka kgohola le ho pshatla lerako. Rala tsela e bolokehileng bakeng sa metsi a feteletseng pele ho kaho.\n\nMetsi a ka lahleha ka mouwane le ho dutla. Hlahloba boemo ba metsi mme o batle dibaka tse dutlang kapa kgoholeho.\n\nBoloka tsela ya metsi a tletseng (spillway) e hlwekile mme o hlokomele sekwahelo sa lebopo se boletsweng moralong. O se ke wa jala difate hodima lerako la letamo la mobu.\n\nDiphoofolo di ka senya mabopo mme tsa eketsa mantle ka hara metsi. Ho ba teng ha tsona ha ho etse hore metsi a hlweke kapa a bolokehe.", "machine-draft"),
      keyPoints: [
        pair("A dam needs a site assessment and qualified design", "Letamo le hloka tlhahlobo ya setsha le moralo o tswang ho motho ya nang le ditshwaneleho", "machine-draft"),
        pair("Design a safe spillway before construction", "Rala tsela e bolokehileng ya metsi a tletseng (spillway) pele ho kaho", "machine-draft"),
        pair("Check required water authorisations before building", "Hlahloba ditumello tse hlokahalang tsa metsi pele o haha", "machine-draft"),
        pair("Maintain bank cover and keep trees off an earth dam wall", "Hlokomela sekwahelo sa lebopo mme o se ke wa lema difate hodima lerako la letamo la mobu", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("A farmer builds a dam wall with no spillway. After an exceptional storm it overflows. What's the likely result?", "Sehwai se haha lerako la letamo le se nang tsela ya metsi a tletseng (spillway). Kamora sefefo se sa tlwaelehang le a kgaphatseha. Ke eng se ka bang sephetho?", "machine-draft"),
          options: [
            pair("The water irrigates lower fields beneficially", "Metsi a nosetsa masimo a ka tlase ka mokgwa o molemo", "machine-draft"),
            pair("It overtops and erodes the wall, risking a catastrophic breach", "A tlola hodimo mme a kgohola lerako, a beha kotsing ya ho pshatleha ho hoholo", "machine-draft"),
            pair("The dam stays full and overflow drains harmlessly", "Letamo le dula le tletse mme metsi a tletseng a tswa ntle le kotsi", "machine-draft"),
            pair("Storage capacity increases permanently", "Bokgoni ba polokelo bo eketseha ka ho sa feleng", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Without a designed overflow route, excess water finds its own way over the wall — and that uncontrolled flow is what erodes and eventually breaches it.", "Ntle le tsela e radilweng ya metsi a feteletseng, metsi a feteletseng a iphumanela tsela hodima lerako — mme phallo eo e sa laolweng ke yona e kgoholang le ho qetella e pshatla lerako.", "machine-draft"),
        },
        {
          question: pair("Which action helps protect an earth dam?", "Ke ketso efe e thusang ho sireletsa letamo la mobu?", "machine-draft"),
          options: [
            pair("A deep, exposed dam with no bank vegetation", "Letamo le tebileng, le pepesitsweng le se nang dimela tsa lebopo", "machine-draft"),
            pair("Maintain the designed bank cover and keep the spillway clear", "Ho hlokomela sekwahelo sa lebopo se radilweng le ho boloka tsela ya metsi a tletseng (spillway) e hlwekile", "machine-draft"),
            pair("A full concrete lining and plastic cover", "Ho le kwahela ka konkreite ka botlalo le sekwahelo sa polasetiki", "machine-draft"),
            pair("A larger surface area to spread evaporation evenly", "Sebaka se seholwanyane sa bokahodimo ho phatlalatsa mouwane ka ho lekana", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A clear spillway and maintained banks help the dam work as designed. Trees should not be planted on an earth dam wall.", "Tsela ya metsi a tletseng (spillway) e hlwekileng le mabopo a hlokometsweng di thusa letamo ho sebetsa jwalo ka ha le radilwe. Difate ha di a lokela ho jalwa hodima lerako la letamo la mobu.", "machine-draft"),
        },
      ],
    },
    {
      id: "water-harvesting-l3",
      infographicAlt: pair("Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.", "Pula e phallang hodima marulelo e kena ka hara koto ebe e theoha ka phala ho kena ka hara tanka, e nang le sekgelo se senyenyane sa ho qala ha phallo (first-flush diverter) se kgelohang pele ho tanka ho lahla metsi a pele a ditshila.", "machine-draft"),
      title: pair("Rainwater Tanks and Roof Catchment: Collecting and Protecting Water", "Ditanka tsa Metsi a Pula le Pokello ya Marulelo: Ho Bokella le ho Sireletsa Metsi", "machine-draft"),
      body: pair("Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nCheck whether the roof material is suitable for rainwater collection before connecting a tank.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.", "Marulelo a hao a ka bokella metsi a pula. Bongata bo itshetlehile ka boholo ba marulelo, pula le tahlehelo.\n\nHlahloba hore na thepa ya marulelo e loketse ho bokella metsi a pula pele o hokela tanka.\n\nSebedisa boholo ba marulelo jwalo ka ha bo bonwa ho tloha hodimo le ditlaleho tsa pula ya sebaka seo. Ebe o dumella metsi a fosang koto, a kgelohang kapa a kgaphatsehang ha tanka e tletse.\n\nPalo yohle ya selemo le selemo ha e o jwetse hore na metsi a makae a tla fumaneha nakong ya komello. Bapisa phepelo le tshebediso eo o e rerileng.\n\nMetsi a theohang marulelong a ka nka lerole, mantle le tshilafalo e nngwe. Sekgelo sa ho qala ha phallo (first-flush diverter) se boloka karolo e nngwe ya metsi a pele a phallang kantle ho tanka.\n\nBongata bo hlokahalang ba ho kgeloha bo itshetlehile ka marulelo le tsamaiso. Sebedisa ditaelo tsa boholo le tlhokomelo tse tswang ho mofani wa thepa; ha ho na bophahamo bo le bong bakeng sa marulelo a mang le a mang.\n\nSekgelo (diverter) ha se etse hore metsi a setseng a bolokehele ho nowa.\n\nBoholo ba tanka bo itshetlehile ka tlhoko ya metsi, pula, boholo ba marulelo le bolelele ba dinako tsa komello.\n\nNgola tshebediso e rerilweng mme o hakanye tlhoko ya yona ho tswa ditlalehong tsa hao. Bapisa seo le phepelo ho pholletsa le dihla.\n\nRala seo o tla se etsa ha metsi a bolokilweng a qala ho fela. Lebitso la provense feela le ke ke la o jwetsa boholo ba tanka eo o e hlokang.\n\nBoloka tanka e kwahetswe, sefa menyako kgahlanong le dikokwanyana, mme o hlokomele marulelo, dikoto le sekgelo (diverter). Boloka metsi a pula a arohane le diphaephe tsa metsi a nowang.\n\nMetsi a shebahalang a hlwekile a ka nna a ba le dikokwana-hloko (germs) kapa dikhemikhale. Botsa balaodi ba bophelo bo botle ba sebaka seo ka diteko le kalafo tse loketseng tshebediso e rerilweng.\n\nSefa sa mantlha feela hase tiiso ya metsi a nowang. Metsi a sebediswang dijalong tsa dijo le ona a hloka tlhahlobo ya polokeho.", "machine-draft"),
      keyPoints: [
        pair("Roof area, rain, demand and losses determine useful storage", "Boholo ba marulelo, pula, tlhoko le tahlehelo di lekanya polokelo e nang le molemo", "machine-draft"),
        pair("Size and maintain the first-flush diverter for the roof", "Bontsha boholo le ho hlokomela sekgelo sa ho qala ha phallo (first-flush diverter) bakeng sa marulelo", "machine-draft"),
        pair("Clear water can still contain germs or chemicals", "Metsi a hlakileng a ka nna a ba le dikokwana-hloko kapa dikhemikhale", "machine-draft"),
        pair("Testing and treatment must match the intended use", "Diteko le kalafo di tlameha ho tsamaisana le tshebediso e rerilweng", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What information is needed to choose a rainwater tank?", "Ke tlhahisoleseding efe e hlokahalang ho kgetha tanka ya metsi a pula?", "machine-draft"),
          options: [
            pair("Only the province where the farm is located", "Feela provense moo polasi e leng teng", "machine-draft"),
            pair("Roof area, rainfall pattern, water demand and collection losses", "Boholo ba marulelo, mokgwa wa pula, tlhoko ya metsi le tahlehelo ya pokello", "machine-draft"),
            pair("Only the amount of rain in one storm", "Feela bongata ba pula sefefong se le seng", "machine-draft"),
            pair("Only the price of the biggest available tank", "Feela theko ya tanka e kgolo ka ho fetisisa e fumanehang", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Tank planning must compare usable supply with demand through wet and dry periods. One fixed regional size cannot do that.", "Moralo wa tanka o tlameha ho bapisa phepelo e ka sebediswang le tlhoko ho pholletsa le dinako tsa pula le komello. Boholo bo le bong bo tsitsitseng ba sebaka bo ke ke ba etsa seo.", "machine-draft"),
        },
        {
          question: pair("Why does a first-flush diverter matter even for irrigation-only tank water?", "Hobaneng sekgelo sa ho qala ha phallo (first-flush diverter) se le bohlokwa le bakeng sa metsi a tanka a sebedisetswang nosetso feela?", "machine-draft"),
          options: [
            pair("It doesn't matter for irrigation, only drinking water", "Ha se na taba bakeng sa nosetso, feela metsing a nowang", "machine-draft"),
            pair("The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops", "Phallo ya pele e jara mantle a teteaneng, lerole le dikokwana-hloko tse bakang mafu tse ka silafatsang dijalo tse jewang", "machine-draft"),
            pair("It's more acidic and changes soil pH over time", "E na le asiti e ngata mme e fetola pH ya mobu ha nako e ntse e ya", "machine-draft"),
            pair("It stops the tank overfilling in storms", "E thibela tanka ho tlala ho tlola meeding nakong ya difefo", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Diverting early runoff can reduce contamination, but it does not guarantee that later water is safe. Assess quality for the intended use.", "Ho kgelosa metsi a pele a phallang ho ka fokotsa tshilafalo, empa ha ho tiise hore metsi a morao a bolokehile. Lekola boleng bakeng sa tshebediso e rerilweng.", "machine-draft"),
        },
      ],
    },
    {
      id: "water-harvesting-l4",
      title: pair("Greywater: Check Before Reuse", "Metsi a Ditshila a Malapeng (Greywater): Hlahloba Pele o Sebedisa Hape", "machine-draft"),
      body: pair("Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.", "Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.", "hold"),
      keyPoints: [
        pair("Water sources and greywater guidance can differ", "Mehlodi ya metsi le ditaelo tsa metsi a ditshila (greywater) di ka fapana", "machine-draft"),
        pair("Check the source, service status, intended use and site locally before any reuse", "Hlahloba mohlodi, boemo ba ditshebeletso, tshebediso e rerilweng le setsha sebakeng sa heno pele ho tshebediso efe kapa efe hape", "machine-draft"),
        pair("Soil and mulch do not disinfect wastewater", "Mobu le mulch ha di bolae dikokwana-hloko metsing a ditshila", "machine-draft"),
        pair("Prevent contact, spray, pooling, runoff and drinking-water cross-connections", "Thibela ho amana, ho fafatsa, ho bokellana ha matangwana, phallo e tswelang kantle le dikgokahano tse fapaneng le metsi a nowang", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What should happen before any household washwater is reused?", "Ho lokela ho etsahala eng pele metsi afe kapa afe a ho hlatswa a lapeng a sebediswa hape?", "machine-draft"),
          options: [
            pair("Direct it below mulch around a tree", "A ise ka tlase ho mulch ho potoloha sefate", "machine-draft"),
            pair("Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site", "Kopa masepala le moeletsi ya nang le ditshwaneleho wa dikgwerekgwere (sanitation) ho hlahloba mohlodi, boemo ba ditshebeletso, tshebediso e rerilweng le setsha", "machine-draft"),
            pair("Use it if it looks clear", "A sebedise haeba a shebahala a hlwekile", "machine-draft"),
            pair("Use it only on plants that are not eaten raw", "A sebedise feela dimeleng tse sa jeweng di le tala", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.", "Ditaelo di a fapana ka mehlodi e meng ya metsi le ka maemo a ditshebeletso bakeng sa ho sebedisa hape. Tlhahlobo ya sebaka seo e tswang ho motho ya nang le ditshwaneleho ya hlokahala pele ho etswa qeto ya hore na mohlodi ofe kapa ofe le tshebediso di a lokela kapa di a dumellwa.", "machine-draft"),
        },
        {
          question: pair("Why check the exact water source and cleaning products before considering reuse?", "Hobaneng ho lokela ho hlahlojwa mohlodi o tobileng wa metsi le dihlahiswa tsa ho hlwekisa pele ho nahanwa ka ho a sebedisa hape?", "machine-draft"),
          options: [
            pair("All cleaning products are safe if the water is diluted", "Dihlahiswa tsohle tsa ho hlwekisa di bolokehile haeba metsi a hlapolotswe", "machine-draft"),
            pair("Water composition and product effects vary, so the actual source and products need assessment", "Sebopeho sa metsi le ditlamorao tsa dihlahiswa di a fapana, kahoo mohlodi wa sebele le dihlahiswa di hloka tlhahlobo", "machine-draft"),
            pair("The water can be reused when it has no smell", "Metsi a ka sebediswa hape ha a se na monko", "machine-draft"),
            pair("Mulch removes every harmful substance", "Mulch e tlosa ntho e nngwe le e nngwe e kotsi", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.", "Metsi a sebedisitsweng a ka ba le dikokwana-hloko tse fapaneng, matswai le dikhemikhale. Ha ho ponahalo e hlakileng, ho hloka monko leha e le mulch e pakang hore a bolokehile kapa a loketse.", "machine-draft"),
        },
      ],
    },
  ],
};
