/** Unpublished, source-paired Sesotho draft for Reading the Landscape. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const pair = (sourceEnglish: string, sesothoDraft: string, reviewStatus: SesothoSourcePair['reviewStatus'] = 'machine-draft'): SesothoSourcePair => ({
  sourceEnglish, sesothoDraft, reviewStatus,
});

export const SESOTHO_READING_LANDSCAPE_DRAFT: SesothoCourseModuleDraft = {
  id: 'reading-landscape', language: 'st', reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 25, category: "design" },
  title: pair("Reading the Landscape", "Ho Bala Sebopeho sa Naha (Reading the Landscape)", "machine-draft"),
  description: pair("Identify water flow, sun angles, wind patterns and topography on your site.", "Hlokomela phallo ya metsi, di-angle tsa letsatsi, mekgwa ya moya le boemo ba naha (topography) setsheng sa hao.", "machine-draft"),
  lessons: [
    {
      id: "reading-landscape-l1",
      infographicAlt: pair("A hillside seen from the side, with arrows showing where rain runs down the slope, where it collects in a hollow, and where it soaks in as the ground flattens.", "Motheo wa leralla o bonwang ka thoko, o nang le metsu e bontshang moo pula e phallang tlase letswapong, moo e bokellanang sekotong, le moo e kenang mobung ha fatshe ho batalala.", "machine-draft"),
      title: pair("Understanding Water Flow: Where Rain Goes on Your Land", "Ho Utlwisisa Phallo ya Metsi: Moo Pula e Yang Teng Lefatsheng la Hao", "machine-draft"),
      body: pair("Before you harvest water, learn where it already goes. Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, where it ponds, and where it leaves your property. Some excess water needs a safe route away so it does not cause damage.\n\nAn A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.\n\nThere is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.", "Pele o kotula metsi, ithute moo a seng a ntse a ya teng. Shebella o le sebakeng se sireletsehileng nakong ya pula e matla. Ha ho se ho sireletsehile kamora moo, tsamaya lefatsheng la hao. Batla dikotopo tse nyane (rills), dibaka tseo metsi a phallelang ho tsona a hasana, moo a emang teng, le moo a tlohang setsheng sa hao. Metsi a mang a mangata haholo a hloka tsela e sireletsehileng ya ho tswa e le hore a se ke a baka tshenyo.\n\nLevel ya A-frame e ka o thusa ho tshwaya dintlha tse bophahamong bo lekanang le ho latela mola wa contour. Matshwao a yona ke tlhokomelo feela, eseng moralo kapa tumello ya ho tjheka mobu (earthworks). Pele o tjheka mokero (swale), letamo, kapa sebopeho se seng, etsa hore sebaka se hlahlojwe. Mofuta wa mobu, letswapo, tsamaiso ya metsi, phallo ya sefefo, le tsela e sireletsehileng ya ho phalla ha metsi a tletse (overflow route) kaofela di a hlokahala. Botsa moeletsi wa lehae ya kwetlisitsweng (trained local adviser).\n\nHa ho na molao o le mong wa sebaka bakeng sa letswapo le leng le le leng. Hlokomela moo metsi a tsamayang le ho bokellana teng. Di-contour tse entsweng hampe di ka eketsa kgoholeho ya mobu, mme mobu o monyang metsi butle o ka tshwara metsi a mangata haholo. Kgetha mosebetsi ofe kapa ofe wa metsi o loketseng setsha mme o rale tsela e sireletsehileng ya metsi a mangata haholo.", "machine-draft"),
      keyPoints: [
        pair("Watch from a safe place during rain, then walk the land when it is safe", "Shebella o le sebakeng se sireletsehileng nakong ya pula, ebe o tsamaya lefatsheng ha ho se ho sireletsehile", "machine-draft"),
        pair("An A-frame can mark points at the same height, but it does not show whether earthworks are suitable", "A-frame e ka tshwaya dintlha tse bophahamong bo lekanang, empa ha e bontshe hore na mesebetsi ya ho tjheka mobu (earthworks) e loketse", "machine-draft"),
        pair("Water works and safe overflow routes need a site assessment", "Mesebetsi ya metsi le ditsela tse sireletsehileng tsa ho phalla ha metsi a tletse (safe overflow routes) di hloka tlhahlobo ya setsha", "machine-draft"),
        pair("Some excess water needs a safe route away to prevent damage", "Metsi a mang a mangata haholo a hloka tsela e sireletsehileng ya ho tswa ho thibela tshenyo", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What can an A-frame level help you find?", "Level ya A-frame e ka o thusa ho fumana eng?", "machine-draft"),
          options: [
            pair("Points at the same height along a contour", "Dintlha tse bophahamong bo lekanang ho bapa le contour", "machine-draft"),
            pair("Whether a swale is safe to build on this slope", "Hore na mokero (swale) o bolokehile ho hahwa letswapong lena", "machine-draft"),
            pair("How much stormwater the soil can absorb", "Bongata ba metsi a pula ao mobu o ka a monyang", "machine-draft"),
            pair("Where a dam spillway should be built", "Moo spillway ya letamo e lokelang ho hahwa teng", "machine-draft"),
          ],
          sourceCorrectIndex: 0,
          rationale: pair("An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.", "A-frame e ka thusa ho tshwaya dintlha tse bophahamong bo lekanang. Ha e hlahlobe mobu, tsamaiso ya metsi, phallo ya sefefo, kapa hore na mesebetsi ya mobu (earthworks) e loketse.", "machine-draft"),
        },
        {
          question: pair("You observe fast runoff on a sloped KZN site. What should you do before digging a water structure?", "O hlokomela phallo e potlakileng ya metsi setsheng se nang le letswapo KZN. O lokela ho etsa eng pele o tjheka sebopeho sa metsi?", "machine-draft"),
          options: [
            pair("Put it as high on the slope as possible", "E behe hodimo ka hohle kamoo ho ka kgonehang letswapong", "machine-draft"),
            pair("Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser", "Hlahloba mobu, letswapo, tsamaiso ya metsi le phallo ya sefefo, mme o rale tsela e sireletsehileng ya ho phalla ha metsi a tletse (safe overflow) le moeletsi wa lehae ya kwetlisitsweng (trained local adviser)", "machine-draft"),
            pair("Put it wherever water first appears", "E behe hohle moo metsi a qalang ho hlaha teng", "machine-draft"),
            pair("Follow the same high, middle and bottom rule used on other farms", "Latela molao o tshwanang wa hodimo, mahareng le tlase o sebediswang mapolasing a mang", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.", "Molao wa sebaka o ke ke wa bontsha hore na sebopeho se loketse setsha. Di-contour tse entsweng hampe di ka eketsa kgoholeho ya mobu, mme metsi a mangata a hloka tsela e sireletsehileng.", "machine-draft"),
        },
      ],
    },
    {
      id: "reading-landscape-l2",
      infographicAlt: pair("A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.", "Letswapo le nang le letsatsi le ka leboya. Meriti e tswang mohahong le sefateng e wela ka borwa, ho theohela letswapong.", "machine-draft"),
      title: pair("Sun Angles, Shade, and Aspect: Getting the Most from Sunlight", "Di-angle tsa Letsatsi, Moriti, le Pono ya Sebaka (Aspect): Ho Fumana Molemo o Moholo Letsatsing", "machine-draft"),
      body: pair("In much of South Africa, especially in winter, the sun is to the north. Its path changes with the season and your location. North-facing slopes often receive more sun and can be warmer and drier. South-facing slopes are often cooler and moister. Frost can collect in low hollows where cold air settles. Watch your own site before choosing where to plant tender crops or place buildings.\n\nWinter sun is lower and farther north than summer sun. A wall or shade cloth can shade a bed longer in winter than in summer. Before placing anything permanent, stand in the spot at 8am, midday, and 4pm on a winter's day and watch where the shade falls.\n\nPawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.", "Dikarolong tse ngata tsa South Africa, haholo mariha, letsatsi le ba ka leboya. Tsela ya lona e fetoha ho latela sehla le sebaka sa hao. Matswapo a shebileng leboya hangata a fumana letsatsi le lengata mme a ka futhumala le ho omella haholwanyane. Matswapo a shebileng borwa hangata a phodile haholwanyane ebile a na le mongobo. Serame (frost) se ka bokellana dikotong tse tlase moo moya o batang o dulang teng. Shebella setsha sa hao pele o kgetha moo o ka jalang dijalo tse bonolo (tender crops) kapa ho beha meaho.\n\nLetsatsi la mariha le tlase haholo ebile le hole ka leboya ho feta letsatsi la lehlabula. Lebota kapa lesela la moriti (shade cloth) le ka etsa moriti hodima bethe ya serapa nako e telele mariha ho feta lehlabula. Pele o beha ntho leha e le efe ya nako e telele, ema sebakeng seo ka 8am, motshehare, le 4pm ka letsatsi la mariha mme o shebelle moo moriti o welang teng.\n\nPawpaw le citrus tse nyane di kotsing habonolo ke serame (frost). Boloka dimela tse bonolo hole le dibaka tse tlase tse tsejwang ka dipokotho tsa serame (frost pockets). Hlokomela serame sa lehae pele o jala.", "machine-draft"),
      keyPoints: [
        pair("North-facing slopes often get more direct sun; south-facing slopes are often cooler and moister", "Matswapo a shebileng leboya hangata a fumana letsatsi le tobileng haholwanyane; matswapo a shebileng borwa hangata a phodile haholwanyane ebile a na le mongobo", "machine-draft"),
        pair("Winter sun is lower and farther north; check local shade before building", "Letsatsi la mariha le tlase ebile le hole ka leboya; hlahloba moriti wa lehae pele o haha", "machine-draft"),
        pair("Cold air can collect in low hollows; aspect is only one site factor", "Moya o batang o ka bokellana dikotong tse tlase; pono ya sebaka (aspect) ke ntlha e le nngwe feela ya setsha", "machine-draft"),
        pair("Check local frost before placing tender pawpaw or young citrus", "Hlahloba serame (frost) sa lehae pele o beha pawpaw e bonolo kapa citrus e nyane", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("Where should a farmer first look for a frost-tender young pawpaw on a Highveld smallholding?", "Molemi o lokela ho qala ka ho batla hokae bakeng sa pawpaw e nyane e kotsing ya serame (frost-tender) polasing e nyane Highveld?", "machine-draft"),
          options: [
            pair("The lowest point where cold air collects", "Sebaka se tlase-tlase moo moya o batang o bokellanang teng", "machine-draft"),
            pair("A cold, shaded hollow", "Sekoting se batang, se nang le moriti", "machine-draft"),
            pair("A sunny spot outside a known frost hollow, after checking the site's frost pattern", "Sebakeng se tjhabetsweng ke letsatsi kantle ho sekoti se tsejwang sa serame (frost hollow), kamora ho hlahloba mokgwa wa serame sa setsha", "machine-draft"),
            pair("A position chosen without checking the site", "Sebakeng se kgethilweng ntle le ho hlahloba setsha", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.", "Moya o batang o ka bokellana dibakeng tse tlase. Setsha se nang le letsatsi haholo kantle ho pokotho e tsejwang ya serame (frost pocket) se ka fokotsa kotsi, empa ditlhokomelo tsa serame sa lehae di tlameha ho tataisa sebaka sa ho qetela.", "machine-draft"),
        },
        {
          question: pair("A farmer plans shade cloth on the north side of her garden. What should she check before fixing it in place?", "Molemi o rera lesela la moriti (shade cloth) lehlakoreng le ka leboya la jarete ya hae. O lokela ho hlahloba eng pele a le lokisa sebakeng sa lona?", "machine-draft"),
          options: [
            pair("Where its shadow falls on the bed in winter", "Moo moriti wa lona o welang teng hodima bethe ya serapa mariha", "machine-draft"),
            pair("Whether it redirects frost away", "Hore na le kgelosa serame (frost) ho ya thoko", "machine-draft"),
            pair("Whether the sun is always overhead at noon", "Hore na letsatsi le dula le le kahodimo ho hlooho motshehare", "machine-draft"),
            pair("Only whether it reduces summer evaporation", "Feela hore na le fokotsa ho fetoha ha metsi mouwane lehlabula", "machine-draft"),
          ],
          sourceCorrectIndex: 0,
          rationale: pair("Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.", "Letsatsi la mariha le tlase ebile le hole ka leboya. Lesela la moriti (shade cloth) le ka fetola dihora tsa letsatsi hodima bethe ya serapa. Hlahloba meriti ya sebele ka 8am, motshehare, le 4pm pele o le tiisa sebakeng sa lona.", "machine-draft"),
        },
      ],
    },
    {
      id: "reading-landscape-l3",
      infographicAlt: pair("A farm from above with arrows showing wind direction, cold air draining downhill into a frost hollow, and the direction of the slope.", "Polasi e bonwang ho tloha hodimo e nang le metsu e bontshang nqa ya moya, moya o batang o phallelang tlase letswapong ho kena sekoting sa serame (frost hollow), le nqa ya letswapo.", "machine-draft"),
      title: pair("Wind, Frost, and Topography: Reading the Invisible Forces", "Moya, Serame, le Boemo ba Naha: Ho Bala Matla a sa Bonweng (Topography)", "machine-draft"),
      body: pair("Wind can damage crops on a smallholding. The direction and strength of damaging wind change with region, season and your site's ridges and gaps. Walk the land on windy days. Record where the wind comes from and what it affects. Check local weather records before deciding where shelter is needed.\n\nOn a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes. Frost patterns also depend on the site. Compare candidate places through the local frost season. Check local minimum-temperature records where available. If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.\n\nFrost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.\n\nFor tomatoes troubled by late blight, airflow and morning sun can help leaves dry. Late blight can still spread during prolonged cool, damp weather. Moving a bed alone will not control it; seek local crop-health guidance too.", "Moya o ka senya dijalo polasing e nyane. Nqa le matla a moya o senyang di fetoha ho latela sebaka, sehla le matswapo le dikgeo tsa setsha sa hao. Tsamaya lefatsheng matsatsing a nang le moya. Rekota moo moya o tswang teng le seo o se amang. Hlahloba ditlaleho tsa boemo ba lehodimo tsa lehae pele o etsa qeto ya moo tshireletso e hlokwang teng.\n\nBosiu bo hlakileng, bo kgutsitseng, moya o batang o ka phalla ho theosa leralla mme wa bokellana dibakeng tse tlase. Dibaka tsena di ka bata haholo ho feta matswapo a haufi. Mekgwa ya serame (frost) le yona e itshetlehile ka setsha. Bapisa dibaka tseo e ka bang tsona nakong ya sehla sa serame sa lehae. Hlahloba ditlaleho tsa lehae tsa motjheso o tlase-tlase (minimum-temperature records) moo di fumanehang teng. Haeba ditlaleho di sa fumanehe, tswela pele ho shebella masiu a batang mme o botse moeletsi wa temo wa lehae pele o kgetha lehae la nako e telele bakeng sa dipeo tse bonolo.\n\nSerame (frost) ke leqhwa le iphelang hodima ntho e batang. Mohodi o le mong ha o bontshe hore leqhwa le entswe, mme tshenyo ya serame e ka etsahala ntle le leqhwa le bonwang. Batla leqhwa le tshenyo ya dimela, bapisa mobu o tlase le matswapo, mme o hlahlobe motjheso o tlase-tlase moo o ka kgonang. Tshwaya dibaka tseo ho bata kapa tshenyo e nkang nako e telele ka ho fetisisa. Boloka dimela tse kotsing habonolo hole le dipokotho tse batang (cold pockets) tseo o di hlokomelang.\n\nBakeng sa tamati (tomatoes) e tshwenngwang ke late blight, phallo ya moya le letsatsi la hoseng di ka thusa mahlaku ho oma. Late blight e ntse e ka ata nakong ya lehodimo le phodileng, le nang le mongobo le nkang nako e telele. Ho suthisa bethe ya serapa feela ho ke ke ha e laola; batla le tataiso ya bophelo bo botle ba dijalo sebakeng sa heno.", "machine-draft"),
      keyPoints: [
        pair("Observe damaging wind direction on your site before placing shelter", "Hlokomela nqa ya moya o senyang setsheng sa hao pele o beha tshireletso ya moya (shelter)", "machine-draft"),
        pair("Cold air can drain downhill on clear, still nights and collect in low ground", "Moya o batang o ka theosa leralla masiu a hlakileng, a kgutsitseng mme wa bokellana mobung o tlase", "machine-draft"),
        pair("Compare cold-night plant damage and temperatures across your site; visible frost is not the only sign", "Bapisa tshenyo ya dimela ya bosiu bo batang le motjheso ho pholletsa le setsha sa hao; serame (frost) se bonwang hase sesupo se le seng feela", "machine-draft"),
        pair("Airflow and drying may help reduce wet leaves, but do not alone control late blight", "Phallo ya moya le ho omisa di ka thusa ho fokotsa mahlaku a mongobo, empa tsona feela ha di laole late blight", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("Where should a farmer first look when placing a frost-sensitive seedling nursery on a Highveld smallholding?", "Molemi o lokela ho qala ka ho batla hokae ha a beha kereche ya dimela tse nyane tse kotsing ya serame polasing e nyane Highveld?", "machine-draft"),
          options: [
            pair("A known frost hollow at the valley bottom", "Sekoting sa serame (frost hollow) se tsejwang botlaseng ba phula", "machine-draft"),
            pair("An exposed ridgeline without checking the wind", "Molaong o pepesitsweng wa leralla ntle le ho hlahloba moya", "machine-draft"),
            pair("A sunny, sheltered place outside an observed frost hollow, after checking the site's cold-night pattern", "Sebakeng se tjhabetsweng ke letsatsi, se sireletsehileng kantle ho sekoti sa serame se hlokometsweng, kamora ho hlahloba mokgwa wa bosiu bo batang wa setsha", "machine-draft"),
            pair("The place with the most shade, without checking frost", "Sebakeng se nang le moriti o mongata haholo, ntle le ho hlahloba serame", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Cold air can settle in low places on clear, still nights. Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before making a permanent choice. Visible frost is not the only sign of frost damage, and no hillside position guarantees freedom from frost.", "Moya o batang o ka dula dibakeng tse tlase masiu a hlakileng, a kgutsitseng. Bapisa dibaka tsa kereche tseo e ka bang tsona nakong ya sehla sa serame sa lehae. Hlahloba ditlaleho tsa motjheso o tlase-tlase tsa lehae kapa o botse moeletsi wa temo wa lehae pele o etsa qeto ya nako e telele. Serame se bonwang hase sesupo se le seng feela sa tshenyo ya serame, mme ha ho na sebaka sa lehlakoreng la leralla se tiisang ho se be le serame.", "machine-draft"),
        },
        {
          question: pair("A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?", "Tamati (tomatoes) ya molemi wa KZN e dula e tshwarwa ke late blight nakong ya maemo a phodileng, a mongobo. Ke sebaka sefe sa bethe ya serapa se ka thusang mahlaku ho oma, hammoho le keletso ya bophelo bo botle ba dijalo ya lehae?", "machine-draft"),
          options: [
            pair("A sealed, unventilated tunnel", "Tonele e kwetsweng, e se nang moya (unventilated tunnel)", "machine-draft"),
            pair("A place with good airflow and morning sun", "Sebaka se nang le phallo e ntle ya moya le letsatsi la hoseng", "machine-draft"),
            pair("A low spot near a dam", "Sebaka se tlase haufi le letamo", "machine-draft"),
            pair("A shaded south wall", "Lebota le ka borwa le nang le moriti", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.", "Phallo ya moya le letsatsi la hoseng di ka thusa mahlaku ho oma. Late blight e ratwa ke lehodimo le phodileng, le mongobo le nkang nako e telele, mme ho suthisa bethe ya serapa feela hase moralo o feletseng wa taolo.", "machine-draft"),
        },
      ],
    },
    {
      id: "reading-landscape-l4",
      infographicAlt: pair("A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.", "Mmapa wa setsha (site map) o takilweng ka letsoho pampiring o bontshang leboya, meaho, metsi, le moedi — e matsapa, jwalo ka ha molemi a ka e taka.", "machine-draft"),
      title: pair("Making a Simple Site Map: Your Design Starts on Paper", "Ho Etsa Mmapa o Bonolo wa Setsha (Site Map): Moralo wa Hao o Qala Pampiring", "machine-draft"),
      body: pair("A site map needs paper, a tape measure, a compass, and time to walk your land. Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.", "Mmapa wa setsha (site map) o hloka pampiri, tepi e methang (tape measure), khampase (compass), le nako ya ho tsamaya lefatsheng la hao. Tsamaya moeding mme o etse setshwantsho sa pele sa letsoho (sketch). Se tshwaye 'not to scale' ho fihlela o hlahlobile bohole ba sona. Tshwaya leboya. Kenya ntlo, difate, metsi, ditsela, diterata. Taka metsu bakeng sa moya wa lehlabula le wa mariha, mekgwa ya moriti, le moo metsi a phallang teng ha pula e na.\n\nHlokomela moo serame se dulang nako e telele ka ho fetisisa, moo fatshe ho nkgang mongobo dikgweding tse omileng, le moo khakibos kapa blackjack di melang di le ngata haholo. Dimela tsena di ka mela dibakeng tse tshwenngweng (disturbed places), empa boteng ba tsona feela ha bo bontshe hore na mobu o kitlane (compacted). Hlahloba mobu pele o etsa qeto ya hore na sebaka seo se bolela eng bakeng sa moralo wa hao.\n\nBeha dibaka tsa hao (zones) le makala (sectors) hodima sona setshwantsho seo sa pele. Se ntjhafatse sehla ka sehla. Setshwantsho sa pentshele seo o hlileng o se sebedisang se na le boleng bo boholo ho feta se setle haholo se takilweng hanngwe feela.", "machine-draft"),
      keyPoints: [
        pair("A site map needs only paper, a tape measure, a compass, and observation", "Mmapa wa setsha (site map) o hloka feela pampiri, tepi e methang, khampase, le tlhokomelo", "machine-draft"),
        pair("Mark water flow, wind direction, frost pockets, and existing vegetation", "Tshwaya phallo ya metsi, nqa ya moya, dipokotho tsa serame, le dimela tse teng", "machine-draft"),
        pair("Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction", "Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction", "hold"),
        pair("Overlay zones and sectors on your base map to complete the design skeleton", "Beha di-zone le makala (sectors) hodima mmapa wa hao wa motheo ho phethela masapo a moralo", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("You notice thick blackjack growing in one corner every year. What should you do next?", "O hlokomela blackjack e teteaneng e mela sekgutlong se seng selemo le selemo. O lokela ho etsa eng e latelang?", "machine-draft"),
          options: [
            pair("The soil there is exceptionally fertile", "Mobu o teng o nonne ka mokgwa o ikgethang", "machine-draft"),
            pair("That area has a higher water table", "Sebaka seo se na le metsi a ka tlasa lefatshe a phahameng haholo (higher water table)", "machine-draft"),
            pair("Mark the patch and check the soil; the plant alone cannot show compaction", "Tshwaya sebaka seo mme o hlahlobe mobu; semela ka bosona se ke ke sa bontsha ho kitlana ha mobu (compaction)", "machine-draft"),
            pair("Blackjack only grows in shade, so there's a hidden seep", "Blackjack e mela feela moriting, kahoo ho na le seretse se patilweng (hidden seep)", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.", "Blackjack e ka mela mobung o tshwenngweng (disturbed ground), empa boteng ba yona feela ha bo hlahlobe ho kitlana ha mobu (compaction). Hlokomela le ho hlahloba mobu pele o etsa qeto ya hore na sebaka seo se bolela eng bakeng sa moralo wa hao.", "machine-draft"),
        },
        {
          question: pair("Why mark summer and winter wind separately on your site map?", "Ke hobaneng ha o tshwaya moya wa lehlabula le wa mariha ka thoko mmapeng wa hao wa setsha (site map)?", "machine-draft"),
          options: [
            pair("Wind direction never changes in SA", "Nqa ya moya ha e mohla e fetohang SA", "machine-draft"),
            pair("They can come from different directions, changing where windbreaks and tender crops should go", "E ka tswa nqeng tse fapaneng, e fetola moo disireletsi tsa moya (windbreaks) le dijalo tse bonolo di lokelang ho ya teng", "machine-draft"),
            pair("Wind only matters in winter on the Highveld", "Moya o bohlokwa feela mariha Highveld", "machine-draft"),
            pair("Wind direction only affects buildings", "Nqa ya moya e ama feela meaho", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.", "Diphetoho tsa moya ho latela sehla di bolela hore sesireletsi sa moya (windbreak) kapa sebaka sa dijalo se sebetsang hantle sehleng se seng se ka ba fosahetseng sehleng se seng — kahoo ka bobedi di hloka ho tshwauwa ka thoko.", "machine-draft"),
        },
      ],
    },
  ],
};
