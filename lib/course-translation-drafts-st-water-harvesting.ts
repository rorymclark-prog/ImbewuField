/** Unpublished, source-paired Sesotho draft for Water Harvesting. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const pair = (sourceEnglish: string, sesothoDraft: string, reviewStatus: SesothoSourcePair['reviewStatus'] = 'machine-draft'): SesothoSourcePair => ({
  sourceEnglish, sesothoDraft, reviewStatus,
});

export const SESOTHO_WATER_HARVESTING_DRAFT: SesothoCourseModuleDraft = {
  id: 'water-harvesting', language: 'st', reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 35, category: "water" },
  title: pair("Water Harvesting", "Ho Kotula Metsi (Water Harvesting)", "machine-draft"),
  description: pair("Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop.", "Meralo ea mekoting le mekoallo (swales le berms), matamo, ditanka tsa metsi a pula le metsi a litšila a malapeng (greywater) — fokotsa lebelo, phatlalatsa mme o tebise lerotholi le leng le le leng.", "machine-draft"),
  lessons: [
    {
      id: "water-harvesting-l1",
      infographicAlt: pair("Concept cross-section of a level contour swale with a raised mound below it. Arrows show runoff slowing and spreading; infiltration depends on the soil and site.", "Concept cross-section of a level contour swale with a raised mound below it. Arrows show runoff slowing and spreading; infiltration depends on the soil and site.", "hold"),
      title: pair("Swales and Berms: Slowing Water on the Slope", "Mekoti le Mekoallo (Swales le Berms): Ho Fokotsa Lebelo la Metsi Letsoapong", "machine-draft"),
      body: pair("One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.", "One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.", "hold"),
      keyPoints: [
        pair("A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet", "A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet", "hold"),
        pair("Keep good ground cover and plan a safe overflow", "Boloka sekoaelo se setle sa mobu mme o rale tsela e bolokehileng ea metsi a mangata a tsoelang kantle", "machine-draft"),
        pair("Assess soil, drainage, slope and storm flow before digging", "Lekola mobu, tsamaiso ea metsi (drainage), letsoapo le phallo ea sefefo pele o cheka", "machine-draft"),
        pair("A concept picture is not a construction design", "Setšoantšo sa mohopolo hase moralo oa kaho", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("A farmer planned a level contour swale. After heavy rain, one end holds most of the water. What should the farmer check before changing the earthwork?", "A farmer planned a level contour swale. After heavy rain, one end holds most of the water. What should the farmer check before changing the earthwork?", "hold"),
          options: [
            pair("Whether the trench can be made deeper without a site check", "Hore na foro e ka etsoa e tebileng haholoanyane ntle le tlhahlobo ea setsha", "machine-draft"),
            pair("The intended design and measured levels with a trained local adviser; an unintended low point may be present", "Moralo o neng o reriloe le maemo a lekotsoeng le moeletsi ea rutiloeng oa sebaka seo; ho ka ba le sebaka se tlase se neng se sa rerwa", "machine-draft"),
            pair("Whether a new dam at the lowest point will catch every overflow", "Hore na letamo le lecha sebakeng se tlase ka ho fetisisa le tla tšoara phallo e 'ngoe le e 'ngoe ea metsi a tletseng", "machine-draft"),
            pair("Whether the soil should be compacted to stop all infiltration", "Hore na mobu o lokela ho pitloa ho emisa ho teba hohle ha metsi", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A level contour design should spread water along its length. Uneven filling may indicate an unintended low point, but some swales are intentionally graded to a safe outlet. Check the actual design, soil and overflow route before altering it.", "A level contour design should spread water along its length. Uneven filling may indicate an unintended low point, but some swales are intentionally graded to a safe outlet. Check the actual design, soil and overflow route before altering it.", "hold"),
        },
        {
          question: pair("A farmer wants to control erosion on steep land. What should she do before digging?", "A farmer wants to control erosion on steep land. What should she do before digging?", "hold"),
          options: [
            pair("Standard swales dug as deep as possible", "Mekoti (swales) e tloaelehileng e chekiloeng ka botebo bo phahameng ka hohle kamoo ho ka khonehang", "machine-draft"),
            pair("Keep ground covered and get a site assessment for suitable erosion controls", "Ho boloka mobu o koahetsoe le ho fumana tlhahlobo ea setsha bakeng sa taolo e loketseng ea khoholeho", "machine-draft"),
            pair("A large dam at the bottom to catch all runoff", "Letamo le leholo tlase ho tšoara metsi ohle a phallang", "machine-draft"),
            pair("Compacting the soil surface with a roller", "Ho pitla bokaholimo ba mobu ka rolara", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Slope alone is not enough to choose an earthwork. Soil, drainage, stability and storm flow must also be assessed.", "Letsoapo feela ha lea lekana ho khetha mosebetsi oa mobu. Mobu, tsamaiso ea metsi (drainage), botsitso le phallo ea sefefo le tsona li tlameha ho lekolwa.", "machine-draft"),
        },
      ],
    },
    {
      id: "water-harvesting-l2",
      infographicAlt: pair("A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.", "Letamo la polasi le sehiloeng har'a: metsi a kenang ntlheng e 'ngoe, bongata ba metsi a bolokiloeng, tsela ea metsi a tletseng (spillway) ntlheng e kaholimo bakeng sa phallo e tletseng, le lebopo le jetsweng le ts'oereng mobu.", "machine-draft"),
      title: pair("Farm Dams and Ponds: Storing Water for the Dry Season", "Matamo a Polasi le Matangwana: Ho Boloka Metsi Bakeng sa Sehla sa Komelelo", "machine-draft"),
      body: pair("A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.\n\nRainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.\n\nBefore changing a watercourse or building storage works, check the required authorisation with the water authority.\n\nA dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.\n\nDo not assume that annual rainfall tells you the size of a flood or the storage you will have.\n\nAn uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction.\n\nWater can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.\n\nAnimals can damage banks and add manure to the water. Their presence does not make the water clean or safe.", "Letamo kapa letangwana le ka boloka metsi a phallang, empa bongata bo fumanehang bo itshetlehile ka pula ea sebaka seo, sebaka se kgoboketsang metsi (catchment), tahlehelo le hore na o sebelisa metsi a makae.\n\nLihla tsa pula li fapana ho pholletsa le Afrika Boroa (South Africa). Sebelisa litlaleho tsa sebaka seo mme o rale bakeng sa linako tsa komelelo; letamo le tletseng ha lea tiisetsoa.\n\nPele o fetola mokero oa metsi kapa o haha meaho ea polokelo, hlahloba tumello e hlokahalang le balaoli ba metsi.\n\nLetamo le hloka lipatlisiso tsa setsha le moralo o entsoeng ke motho ea nang le litšoaneleho tse loketseng. Metsi a phallang ho tsoa sebakeng sa pokellelo (catchment runoff), mobu, metheo, kotsi e ka tlase (downstream risk) le tsela e bolokehileng ea metsi a tletseng (safe spillway) kaofela a bohlokwa.\n\nU se ke ua nka hore pula ea selemo le selemo e u joetsa boholo ba moroallo kapa polokelo eo u tla ba le eona.\n\nPhallo e sa laoloeng ea metsi a tletseng e ka khohola le ho pshatla lerako. Rala tsela e bolokehileng bakeng sa metsi a feteletseng pele ho kaho.\n\nMetsi a ka lahleha ka mouoane le ho dutla. Hlahloba boemo ba metsi 'me u batle libaka tse dutlang kapa khoholeho.\n\nBoloka tsela ea metsi a tletseng (spillway) e hloekile 'me u hlokomele sekoaelo sa lebopo se boletsoeng moralong. U se ke ua jala lifate holim'a lerako la letamo la mobu.\n\nLiphofoolo li ka senya mabopo 'me tsa eketsa mantle ka har'a metsi. Ho ba teng ha tsona ha ho etse hore metsi a hloeke kapa a bolokehe.", "machine-draft"),
      keyPoints: [
        pair("A dam needs a site assessment and qualified design", "Letamo le hloka tlhahlobo ea setsha le moralo o tsoang ho motho ea nang le litšoaneleho", "machine-draft"),
        pair("Design a safe spillway before construction", "Rala tsela e bolokehileng ea metsi a tletseng (spillway) pele ho kaho", "machine-draft"),
        pair("Check required water authorisations before building", "Hlahloba litumello tse hlokahalang tsa metsi pele o haha", "machine-draft"),
        pair("Maintain bank cover and keep trees off an earth dam wall", "Hlokomela sekoaelo sa lebopo 'me u se ke ua lema lifate holim'a lerako la letamo la mobu", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("A farmer builds a dam wall with no spillway. After an exceptional storm it overflows. What's the likely result?", "Sehoai se haha lerako la letamo le se nang tsela ea metsi a tletseng (spillway). Kamora sefefo se sa tloaelehang lea khaphatseha. Ke eng se ka bang sephetho?", "machine-draft"),
          options: [
            pair("The water irrigates lower fields beneficially", "Metsi a nosetsa masimo a ka tlase ka mokhoa o molemo", "machine-draft"),
            pair("It overtops and erodes the wall, risking a catastrophic breach", "A tlola holimo 'me a khohola lerako, a beha kotsing ea ho pshatleha ho hoholo", "machine-draft"),
            pair("The dam stays full and overflow drains harmlessly", "Letamo le lula le tletse 'me metsi a tletseng a tsoa ntle le kotsi", "machine-draft"),
            pair("Storage capacity increases permanently", "Bokhoni ba polokelo bo eketseha ka ho sa feleng", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Without a designed overflow route, excess water finds its own way over the wall — and that uncontrolled flow is what erodes and eventually breaches it.", "Ntle le tsela e raliloeng ea metsi a feteletseng, metsi a feteletseng a iphumanela tsela holim'a lerako — 'me phallo eo e sa laoloeng ke eona e khoholang le ho qetella e pshatla lerako.", "machine-draft"),
        },
        {
          question: pair("Which action helps protect an earth dam?", "Ke ketso efe e thusang ho sireletsa letamo la mobu?", "machine-draft"),
          options: [
            pair("A deep, exposed dam with no bank vegetation", "Letamo le tebileng, le pepesitsoeng le se nang limela tsa lebopo", "machine-draft"),
            pair("Maintain the designed bank cover and keep the spillway clear", "Ho hlokomela sekoaelo sa lebopo se raliloeng le ho boloka tsela ea metsi a tletseng (spillway) e hloekile", "machine-draft"),
            pair("A full concrete lining and plastic cover", "Ho le koahela ka konkreite ka botlalo le sekoaelo sa polasetiki", "machine-draft"),
            pair("A larger surface area to spread evaporation evenly", "Sebaka se seholoanyane sa bokaholimo ho phatlalatsa mouoane ka ho lekana", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A clear spillway and maintained banks help the dam work as designed. Trees should not be planted on an earth dam wall.", "Tsela ea metsi a tletseng (spillway) e hloekileng le mabopo a hlokometsoeng li thusa letamo ho sebetsa joalo ka ha le raliloe. Lifate ha lia lokela ho jaloa holim'a lerako la letamo la mobu.", "machine-draft"),
        },
      ],
    },
    {
      id: "water-harvesting-l3",
      infographicAlt: pair("Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.", "Pula e phallang holim'a marulelo e kena ka har'a koto ebe e theoha ka phala ho kena ka har'a tanka, e nang le sekhelo se senyenyane sa ho qala ha phallo (first-flush diverter) se khelohang pele ho tanka ho lahla metsi a pele a litšila.", "machine-draft"),
      title: pair("Rainwater Tanks and Roof Catchment: Collecting and Protecting Water", "Ditanka tsa Metsi a Pula le Pokello ea Marulelo: Ho Bokella le ho Sireletsa Metsi", "machine-draft"),
      body: pair("Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nCheck whether the roof material is suitable for rainwater collection before connecting a tank.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.", "Marulelo a hau a ka bokella metsi a pula. Bongata bo itshetlehile ka boholo ba marulelo, pula le tahlehelo.\n\nHlahloba hore na thepa ea marulelo e loketse ho bokella metsi a pula pele o hokela tanka.\n\nSebelisa boholo ba marulelo joalo ka ha bo bonoa ho tloha holimo le litlaleho tsa pula ea sebaka seo. Ebe o lumella metsi a fosang koto, a khelohang kapa a khaphatsehang ha tanka e tletse.\n\nPalo eohle ea selemo le selemo ha e u joetse hore na metsi a makae a tla fumaneha nakong ea komello. Bapisa phepelo le ts'ebeliso eo u e rerileng.\n\nMetsi a theohang marulelong a ka nka lerole, mantle le tšilafalo e 'ngoe. Sekhelo sa ho qala ha phallo (first-flush diverter) se boloka karolo e 'ngoe ea metsi a pele a phallang kantle ho tanka.\n\nBongata bo hlokahalang ba ho kheloha bo itshetlehile ka marulelo le tsamaiso. Sebelisa litaelo tsa boholo le tlhokomelo tse tsoang ho mofani oa thepa; ha ho na bophahamo bo le bong bakeng sa marulelo a mang le a mang.\n\nSekhelo (diverter) ha se etse hore metsi a setseng a bolokehele ho nooa.\n\nBoholo ba tanka bo itshetlehile ka tlhoko ea metsi, pula, boholo ba marulelo le bolelele ba linako tsa komello.\n\nNgola ts'ebeliso e reriloeng mme o hakanye tlhoko ea eona ho tsoa litlalehong tsa hau. Bapisa seo le phepelo ho pholletsa le lihla.\n\nRala seo o tla se etsa ha metsi a bolokiloeng a qala ho fela. Lebitso la provense feela le ke ke la u joetsa boholo ba tanka eo u e hlokang.\n\nBoloka tanka e koahetsoe, sefa menyako khahlanong le likokoanyana, mme o hlokomele marulelo, likoto le sekhelo (diverter). Boloka metsi a pula a arohane le liphaephe tsa metsi a nooang.\n\nMetsi a shebahalang a hloekile a ka nna a ba le likokoana-hloko (germs) kapa lik'hemik'hale. Botsa balaoli ba bophelo bo botle ba sebaka seo ka liteko le kalafo tse loketseng ts'ebeliso e reriloeng.\n\nSefa sa mantlha feela hase tiiso ea metsi a nooang. Metsi a sebelisoang lijalong tsa lijo le 'ona a hloka tlhahlobo ea polokeho.", "machine-draft"),
      keyPoints: [
        pair("Roof area, rain, demand and losses determine useful storage", "Boholo ba marulelo, pula, tlhoko le tahlehelo li lekanya polokelo e nang le molemo", "machine-draft"),
        pair("Size and maintain the first-flush diverter for the roof", "Bontsha boholo le ho hlokomela sekhelo sa ho qala ha phallo (first-flush diverter) bakeng sa marulelo", "machine-draft"),
        pair("Clear water can still contain germs or chemicals", "Metsi a hlakileng a ka nna a ba le likokoana-hloko kapa lik'hemik'hale", "machine-draft"),
        pair("Testing and treatment must match the intended use", "Liteko le kalafo li tlameha ho tsamaisana le ts'ebeliso e reriloeng", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What information is needed to choose a rainwater tank?", "Ke tlhahisoleseling efe e hlokahalang ho khetha tanka ea metsi a pula?", "machine-draft"),
          options: [
            pair("Only the province where the farm is located", "Feela provense moo polasi e leng teng", "machine-draft"),
            pair("Roof area, rainfall pattern, water demand and collection losses", "Boholo ba marulelo, mokhoa oa pula, tlhoko ea metsi le tahlehelo ea pokello", "machine-draft"),
            pair("Only the amount of rain in one storm", "Feela bongata ba pula sefefong se le seng", "machine-draft"),
            pair("Only the price of the biggest available tank", "Feela theko ea tanka e kholo ka ho fetisisa e fumanehang", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Tank planning must compare usable supply with demand through wet and dry periods. One fixed regional size cannot do that.", "Moralo oa tanka o tlameha ho bapisa phepelo e ka sebelisoang le tlhoko ho pholletsa le linako tsa pula le komello. Boholo bo le bong bo tsitsitseng ba sebaka bo ke ke ba etsa seo.", "machine-draft"),
        },
        {
          question: pair("Why does a first-flush diverter matter even for irrigation-only tank water?", "Hobaneng sekhelo sa ho qala ha phallo (first-flush diverter) se le bohlokwa le bakeng sa metsi a tanka a sebelisetsoang nosetso feela?", "machine-draft"),
          options: [
            pair("It doesn't matter for irrigation, only drinking water", "Ha se na taba bakeng sa nosetso, feela metsing a nooang", "machine-draft"),
            pair("The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops", "Phallo ea pele e jara mantle a teteaneng, lerole le likokoana-hloko tse bakang mafu tse ka silafatsang lijalo tse jeoang", "machine-draft"),
            pair("It's more acidic and changes soil pH over time", "E na le asiti e ngata mme e fetola pH ea mobu ha nako e ntse e ea", "machine-draft"),
            pair("It stops the tank overfilling in storms", "E thibela tanka ho tlala ho tlola meeling nakong ea lifefo", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Diverting early runoff can reduce contamination, but it does not guarantee that later water is safe. Assess quality for the intended use.", "Ho khelosa metsi a pele a phallang ho ka fokotsa tšilafalo, empa ha ho tiise hore metsi a morao a bolokehile. Lekola boleng bakeng sa ts'ebeliso e reriloeng.", "machine-draft"),
        },
      ],
    },
    {
      id: "water-harvesting-l4",
      title: pair("Greywater: Check Before Reuse", "Metsi a Litšila a Malapeng (Greywater): Hlahloba Pele o Sebelisa Hape", "machine-draft"),
      body: pair("Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.", "Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.", "hold"),
      keyPoints: [
        pair("Water sources and greywater guidance can differ", "Mehloli ea metsi le litaelo tsa metsi a litšila (greywater) li ka fapana", "machine-draft"),
        pair("Check the source, service status, intended use and site locally before any reuse", "Hlahloba mohloli, boemo ba lits'ebeletso, ts'ebeliso e reriloeng le setsha sebakeng sa heno pele ho ts'ebeliso efe kapa efe hape", "machine-draft"),
        pair("Soil and mulch do not disinfect wastewater", "Mobu le mulch ha li bolaee likokoana-hloko metsing a litšila", "machine-draft"),
        pair("Prevent contact, spray, pooling, runoff and drinking-water cross-connections", "Thibela ho amana, ho fafatsa, ho bokellana ha matangwana, phallo e tsoelang kantle le likhokahano tse fapaneng le metsi a nooang", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What should happen before any household washwater is reused?", "Ho lokela ho etsahala eng pele metsi afe kapa afe a ho hlatsoa a lapeng a sebelisoa hape?", "machine-draft"),
          options: [
            pair("Direct it below mulch around a tree", "A ise ka tlase ho mulch ho potoloha sefate", "machine-draft"),
            pair("Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site", "Kopa masepala le moeletsi ea nang le litšoaneleho oa likhoerekhoere (sanitation) ho hlahloba mohloli, boemo ba lits'ebeletso, ts'ebeliso e reriloeng le setsha", "machine-draft"),
            pair("Use it if it looks clear", "A sebelise haeba a shebahala a hloekile", "machine-draft"),
            pair("Use it only on plants that are not eaten raw", "A sebelise feela limeleng tse sa jeoeng li le tala", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.", "Litaelo lia fapana ka mehloli e meng ea metsi le ka maemo a litšebeletso bakeng sa ho sebelisa hape. Tlhahlobo ea sebaka seo e tsoang ho motho ea nang le litšoaneleho ea hlokahala pele ho etsoa qeto ea hore na mohloli ofe kapa ofe le ts'ebeliso lia lokela kapa lia lumelloa.", "machine-draft"),
        },
        {
          question: pair("Why check the exact water source and cleaning products before considering reuse?", "Hobaneng ho lokela ho hlahlojoa mohloli o tobileng oa metsi le lihlahisoa tsa ho hloekisa pele ho nahanoa ka ho a sebelisa hape?", "machine-draft"),
          options: [
            pair("All cleaning products are safe if the water is diluted", "Lihlahisoa tsohle tsa ho hloekisa li bolokehile haeba metsi a hlapolotsoe", "machine-draft"),
            pair("Water composition and product effects vary, so the actual source and products need assessment", "Sebopeho sa metsi le litlamorao tsa lihlahisoa lia fapana, kahoo mohloli oa sebele le lihlahisoa li hloka tlhahlobo", "machine-draft"),
            pair("The water can be reused when it has no smell", "Metsi a ka sebelisoa hape ha a se na monko", "machine-draft"),
            pair("Mulch removes every harmful substance", "Mulch e tlosa ntho e 'ngoe le e 'ngoe e kotsi", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.", "Metsi a sebelisitsoeng a ka ba le likokoana-hloko tse fapaneng, matsoai le lik'hemik'hale. Ha ho ponahalo e hlakileng, ho hloka monko leha e le mulch e pakang hore a bolokehile kapa a loketse.", "machine-draft"),
        },
      ],
    },
  ],
};
