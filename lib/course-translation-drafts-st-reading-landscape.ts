/** Unpublished, source-paired Sesotho draft for Reading the Landscape. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const pair = (sourceEnglish: string, sesothoDraft: string, reviewStatus: SesothoSourcePair['reviewStatus'] = 'machine-draft'): SesothoSourcePair => ({
  sourceEnglish, sesothoDraft, reviewStatus,
});

export const SESOTHO_READING_LANDSCAPE_DRAFT: SesothoCourseModuleDraft = {
  id: 'reading-landscape', language: 'st', reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 25, category: "design" },
  title: pair("Reading the Landscape", "Ho Bala Sebopeho sa Naha (Reading the Landscape)", "machine-draft"),
  description: pair("Identify water flow, sun angles, wind patterns and topography on your site.", "Hlokomela phallo ea metsi, li-angle tsa letsatsi, mekhoa ea moea le boemo ba naha (topography) setšeng sa hao.", "machine-draft"),
  lessons: [
    {
      id: "reading-landscape-l1",
      infographicAlt: pair("A hillside seen from the side, with arrows showing where rain runs down the slope, where it collects in a hollow, and where it soaks in as the ground flattens.", "Motheo oa leralla o bonoang ka thoko, o nang le metsu e bontšang moo pula e phallang tlaase moepeng, moo e bokellanang sekotong, le moo e kenang mobung ha fatše ho batalala.", "machine-draft"),
      title: pair("Understanding Water Flow: Where Rain Goes on Your Land", "Ho Utloisisa Phallo ea Metsi: Moo Pula e Eang Teng Lefatšeng la Hao", "machine-draft"),
      body: pair("Before you harvest water, learn where it already goes. Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, where it ponds, and where it leaves your property. Some excess water needs a safe route away so it does not cause damage.\n\nAn A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.\n\nThere is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.", "Pele o kotula metsi, ithute moo a seng a ntse a e-ea teng. Shebella u le sebakeng se sireletsehileng nakong ea pula e matla. Ha ho se ho sireletsehile kamora moo, tsamaea lefatšeng la hao. Batla likotopo tse nyane (rills), libaka tseo metsi a phallelang ho tsona a hasana, moo a emang teng, le moo a tlohang setšeng sa hao. Metsi a mang a mangata haholo a hloka tsela e sireletsehileng ea ho tsoa e le hore a se ke a baka tšenyo.\n\nLevel ea A-frame e ka u thusa ho tšoaea lintlha tse bophahamong bo lekanang le ho latela mola oa contour. Matshwao a yona ke tlhokomelo feela, eseng moralo kapa tumello ea ho cheka mobu (earthworks). Pele o cheka swale, letamo, kapa sebopeho se seng, etsa hore sebaka se hlahlojoe. Mofuta oa mobu, moepa, tsamaiso ea metsi, phallo ea sefefo, le tsela e sireletsehileng ea ho phalla ha metsi a tletse (overflow route) kaofela lia hlokahala. Botsa moeletsi oa lehae ea koetlisitsoeng (trained local adviser).\n\nHa ho na molao o le mong oa sebaka bakeng sa moepa o mong le o mong. Hlokomela moo metsi a tsamaeang le ho bokellana teng. Li-contour tse entsoeng hampe li ka eketsa khoholeho ea mobu, 'me mobu o monyang metsi butle o ka tšoara metsi a mangata haholo. Khetha mosebetsi ofe kapa ofe oa metsi o loketseng setša 'me u rale tsela e sireletsehileng ea metsi a mangata haholo.", "machine-draft"),
      keyPoints: [
        pair("Watch from a safe place during rain, then walk the land when it is safe", "Shebella u le sebakeng se sireletsehileng nakong ea pula, ebe u tsamaea lefatšeng ha ho se ho sireletsehile", "machine-draft"),
        pair("An A-frame can mark points at the same height, but it does not show whether earthworks are suitable", "A-frame e ka tšoaea lintlha tse bophahamong bo lekanang, empa ha e bontše hore na mesebetsi ea ho cheka mobu (earthworks) e loketse", "machine-draft"),
        pair("Water works and safe overflow routes need a site assessment", "Mesebetsi ea metsi le litsela tse sireletsehileng tsa ho phalla ha metsi a tletse (safe overflow routes) li hloka tlhahlobo ea setša", "machine-draft"),
        pair("Some excess water needs a safe route away to prevent damage", "Metsi a mang a mangata haholo a hloka tsela e sireletsehileng ea ho tsoa ho thibela tšenyo", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What can an A-frame level help you find?", "Level ea A-frame e ka u thusa ho fumana eng?", "machine-draft"),
          options: [
            pair("Points at the same height along a contour", "Lintlha tse bophahamong bo lekanang ho bapa le contour", "machine-draft"),
            pair("Whether a swale is safe to build on this slope", "Hore na swale e bolokehile ho hahoa moepeng ona", "machine-draft"),
            pair("How much stormwater the soil can absorb", "Bongata ba metsi a pula ao mobu o ka a monyang", "machine-draft"),
            pair("Where a dam spillway should be built", "Moo spillway ea letamo e lokelang ho hahoa teng", "machine-draft"),
          ],
          sourceCorrectIndex: 0,
          rationale: pair("An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.", "A-frame e ka thusa ho tšoaea lintlha tse bophahamong bo lekanang. Ha e hlahlobe mobu, tsamaiso ea metsi, phallo ea sefefo, kapa hore na mesebetsi ea mobu (earthworks) e loketse.", "machine-draft"),
        },
        {
          question: pair("You observe fast runoff on a sloped KZN site. What should you do before digging a water structure?", "U hlokomela phallo e potlakileng ea metsi setšeng se nang le moepa KZN. U lokela ho etsa eng pele u cheka sebopeho sa metsi?", "machine-draft"),
          options: [
            pair("Put it as high on the slope as possible", "E behe holimo ka hohle kamoo ho ka khonehang moepeng", "machine-draft"),
            pair("Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser", "Hlahloba mobu, moepa, tsamaiso ea metsi le phallo ea sefefo, 'me u rale tsela e sireletsehileng ea ho phalla ha metsi a tletse (safe overflow) le moeletsi oa lehae ea koetlisitsoeng (trained local adviser)", "machine-draft"),
            pair("Put it wherever water first appears", "E behe hohle moo metsi a qalang ho hlaha teng", "machine-draft"),
            pair("Follow the same high, middle and bottom rule used on other farms", "Latela molao o tšoanang oa holimo, mahareng le tlase o sebelisoang mapolasing a mang", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.", "Molao oa sebaka o ke ke oa bontša hore na sebopeho se loketse setša. Li-contour tse entsoeng hampe li ka eketsa khoholeho ea mobu, 'me metsi a mangata a hloka tsela e sireletsehileng.", "machine-draft"),
        },
      ],
    },
    {
      id: "reading-landscape-l2",
      infographicAlt: pair("A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.", "Moepa o nang le letsatsi le ka leboea. Meriti e tsoang mohahong le sefateng e oela ka boroa, ho theohela moepeng.", "machine-draft"),
      title: pair("Sun Angles, Shade, and Aspect: Getting the Most from Sunlight", "Li-angle tsa Letsatsi, Moriti, le Pono ea Sebaka (Aspect): Ho Fumana Molemo o Moholo Letsatsing", "machine-draft"),
      body: pair("In much of South Africa, especially in winter, the sun is to the north. Its path changes with the season and your location. North-facing slopes often receive more sun and can be warmer and drier. South-facing slopes are often cooler and moister. Frost can collect in low hollows where cold air settles. Watch your own site before choosing where to plant tender crops or place buildings.\n\nWinter sun is lower and farther north than summer sun. A wall or shade cloth can shade a bed longer in winter than in summer. Before placing anything permanent, stand in the spot at 8am, midday, and 4pm on a winter's day and watch where the shade falls.\n\nPawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.", "Likarolong tse ngata tsa South Africa, haholo mariha, letsatsi le ba ka leboea. Tsela ea lona e fetoha ho latela sehla le sebaka sa hao. Miepa e shebileng leboea hangata e fumana letsatsi le lengata 'me e ka futhumala le ho omella haholoanyane. Miepa e shebileng boroa hangata e pholile haholoanyane ebile e na le mongobo. Serame sa phoka (frost) se ka bokellana likotong tse tlaase moo moea o batang o lulang teng. Shebella setša sa hao pele u khetha moo u ka jalang lijalo tse bonolo (tender crops) kapa ho beha meaho.\n\nLetsatsi la mariha le tlase haholo ebile le hole ka leboea ho feta letsatsi la lehlabula. Lebota kapa lesela la moriti (shade cloth) le ka etsa moriti holim'a bethe nako e telele mariha ho feta lehlabula. Pele u beha ntho leha e le efe ea nako e telele, ema sebakeng seo ka 8am, mots'eare, le 4pm ka letsatsi la mariha 'me u shebelle moo moriti o oelang teng.\n\nPawpaw le citrus tse nyane li kotsing habonolo ke serame sa phoka (frost). Boloka limela tse bonolo hole le libaka tse tlaase tse tsejoang ka lipokotho tsa serame (frost pockets). Hlokomela serame sa lehae pele u jala.", "machine-draft"),
      keyPoints: [
        pair("North-facing slopes often get more direct sun; south-facing slopes are often cooler and moister", "Miepa e shebileng leboea hangata e fumana letsatsi le tobileng haholoanyane; miepa e shebileng boroa hangata e pholile haholoanyane ebile e na le mongobo", "machine-draft"),
        pair("Winter sun is lower and farther north; check local shade before building", "Letsatsi la mariha le tlase ebile le hole ka leboea; hlahloba moriti oa lehae pele o haha", "machine-draft"),
        pair("Cold air can collect in low hollows; aspect is only one site factor", "Moea o batang o ka bokellana likotong tse tlaase; pono ea sebaka (aspect) ke ntlha e le 'ngoe feela ea setša", "machine-draft"),
        pair("Check local frost before placing tender pawpaw or young citrus", "Hlahloba serame sa phoka (frost) sa lehae pele u beha pawpaw e bonolo kapa citrus e nyane", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("Where should a farmer first look for a frost-tender young pawpaw on a Highveld smallholding?", "Molemi o lokela ho qala ka ho batla hokae bakeng sa pawpaw e nyane e kotsing ea serame sa phoka (frost-tender) polasing e nyane Highveld?", "machine-draft"),
          options: [
            pair("The lowest point where cold air collects", "Sebaka se tlaase-tlaase moo moea o batang o bokellanang teng", "machine-draft"),
            pair("A cold, shaded hollow", "Sekoting se batang, se nang le moriti", "machine-draft"),
            pair("A sunny spot outside a known frost hollow, after checking the site's frost pattern", "Sebakeng se chabetsoeng ke letsatsi kantle ho sekoti se tsejoang sa serame (frost hollow), kamora ho hlahloba mokhoa oa serame sa setša", "machine-draft"),
            pair("A position chosen without checking the site", "Sebakeng se khethiloeng ntle le ho hlahloba setša", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.", "Moea o batang o ka bokellana libakeng tse tlaase. Setša se nang le letsatsi haholo kantle ho pokotho e tsejoang ea serame (frost pocket) se ka fokotsa kotsi, empa litlhokomelo tsa serame sa lehae li tlameha ho tataisa sebaka sa ho qetela.", "machine-draft"),
        },
        {
          question: pair("A farmer plans shade cloth on the north side of her garden. What should she check before fixing it in place?", "Molemi o rera lesela la moriti (shade cloth) lehlakoreng le ka leboea la jarete ea hae. O lokela ho hlahloba eng pele a le lokisa sebakeng sa lona?", "machine-draft"),
          options: [
            pair("Where its shadow falls on the bed in winter", "Moo moriti oa lona o oelang teng holim'a bethe mariha", "machine-draft"),
            pair("Whether it redirects frost away", "Hore na le khelosa serame sa phoka (frost) ho ea thoko", "machine-draft"),
            pair("Whether the sun is always overhead at noon", "Hore na letsatsi le lula le le kaholimo ho hlooho mots'eare", "machine-draft"),
            pair("Only whether it reduces summer evaporation", "Feela hore na le fokotsa ho fetoha ha metsi mouoane lehlabula", "machine-draft"),
          ],
          sourceCorrectIndex: 0,
          rationale: pair("Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.", "Letsatsi la mariha le tlaase ebile le hole ka leboea. Lesela la moriti (shade cloth) le ka fetola lihora tsa letsatsi holim'a bethe. Hlahloba meriti ea sebele ka 8am, mots'eare, le 4pm pele u le tiisa sebakeng sa lona.", "machine-draft"),
        },
      ],
    },
    {
      id: "reading-landscape-l3",
      infographicAlt: pair("A farm from above with arrows showing wind direction, cold air draining downhill into a frost hollow, and the direction of the slope.", "Polasi e bonoang ho tloha holimo e nang le metsu e bontšang nqa ea moea, moea o batang o phallelang tlaase moepeng ho kena sekoting sa serame (frost hollow), le nqa ea moepa.", "machine-draft"),
      title: pair("Wind, Frost, and Topography: Reading the Invisible Forces", "Moea, Serame sa Phoka, le Boemo ba Naha: Ho Bala Matla a sa Bonoeng (Topography)", "machine-draft"),
      body: pair("Wind can damage crops on a smallholding. The direction and strength of damaging wind change with region, season and your site's ridges and gaps. Walk the land on windy days. Record where the wind comes from and what it affects. Check local weather records before deciding where shelter is needed.\n\nOn a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes. Frost patterns also depend on the site. Compare candidate places through the local frost season. Check local minimum-temperature records where available. If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.\n\nFrost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.\n\nFor tomatoes troubled by late blight, airflow and morning sun can help leaves dry. Late blight can still spread during prolonged cool, damp weather. Moving a bed alone will not control it; seek local crop-health guidance too.", "Moea o ka senya lijalo polasing e nyane. Nqa le matla a moea o senyang li fetoha ho latela sebaka, sehla le matsoapo le likheo tsa setša sa hao. Tsamaea lefatšeng matsatsing a nang le moea. Rekota moo moea o tsoang teng le seo o se amang. Hlahloba litlaleho tsa boemo ba leholimo tsa lehae pele u etsa qeto ea moo tšireletso e hlokoang teng.\n\nBosiu bo hlakileng, bo khutsitseng, moea o batang o ka phalla ho theosa leralla 'me oa bokellana libakeng tse tlaase. Libaka tsena li ka bata haholo ho feta miepa e haufi. Mekhoa ea serame sa phoka (frost) le eona e itšetlehile ka setša. Bapisa libaka tseo e ka bang tsona nakong ea sehla sa serame sa lehae. Hlahloba litlaleho tsa lehae tsa mocheso o tlaase-tlaase (minimum-temperature records) moo li fumanehang teng. Haeba litlaleho li sa fumanehe, tsoela pele ho shebella masiu a batang 'me u botse moeletsi oa temo oa lehae pele u khetha lehae la nako e telele bakeng sa lipeo tse bonolo.\n\nSerame sa phoka (frost) ke leqhoa le iphelang holim'a ntho e batang. Moholi o le mong ha o bontše hore leqhoa le entsoe, 'me tšenyo ea serame e ka etsahala ntle le leqhoa le bonoang. Batla leqhoa le tšenyo ea limela, bapisa mobu o tlaase le miepa, 'me u hlahlobe mocheso o tlaase-tlaase moo u ka khonang. Tšoaea libaka tseo ho bata kapa tšenyo e nkang nako e telele ka ho fetisisa. Boloka limela tse kotsing habonolo hole le lipokotho tse batang (cold pockets) tseo u li hlokomelang.\n\nBakeng sa tamati (tomatoes) e tšoenngoang ke late blight, phallo ea moea le letsatsi la hoseng li ka thusa mahlaku ho oma. Late blight e ntse e ka ata nakong ea leholimo le pholileng, le nang le mongobo le nkang nako e telele. Ho suthisa bethe feela ho ke ke ha e laola; batla le tataiso ea bophelo bo botle ba lijalo sebakeng sa heno.", "machine-draft"),
      keyPoints: [
        pair("Observe damaging wind direction on your site before placing shelter", "Hlokomela nqa ea moea o senyang setšeng sa hao pele u beha tšireletso ea moea (shelter)", "machine-draft"),
        pair("Cold air can drain downhill on clear, still nights and collect in low ground", "Moea o batang o ka theosa leralla masiu a hlakileng, a khutsitseng 'me oa bokellana mobung o tlaase", "machine-draft"),
        pair("Compare cold-night plant damage and temperatures across your site; visible frost is not the only sign", "Bapisa tšenyo ea limela ea bosiu bo batang le mocheso ho pholletsa le setša sa hao; serame sa phoka (frost) se bonoang hase sesupo se le seng feela", "machine-draft"),
        pair("Airflow and drying may help reduce wet leaves, but do not alone control late blight", "Phallo ea moea le ho omisa li ka thusa ho fokotsa mahlaku a mongobo, empa tsona feela ha li laole late blight", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("Where should a farmer first look when placing a frost-sensitive seedling nursery on a Highveld smallholding?", "Molemi o lokela ho qala ka ho batla hokae ha a beha kereche ea lipeo tse kotsing ea serame polasing e nyane Highveld?", "machine-draft"),
          options: [
            pair("A known frost hollow at the valley bottom", "Sekoting sa serame (frost hollow) se tsejoang botlaaseng ba phula", "machine-draft"),
            pair("An exposed ridgeline without checking the wind", "Molaong o pepesitsoeng oa leralla ntle le ho hlahloba moea", "machine-draft"),
            pair("A sunny, sheltered place outside an observed frost hollow, after checking the site's cold-night pattern", "Sebakeng se chabetsoeng ke letsatsi, se sireletsehileng kantle ho sekoti sa serame se hlokometsoeng, kamora ho hlahloba mokhoa oa bosiu bo batang oa setša", "machine-draft"),
            pair("The place with the most shade, without checking frost", "Sebakeng se nang le moriti o mongata haholo, ntle le ho hlahloba serame", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Cold air can settle in low places on clear, still nights. Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before making a permanent choice. Visible frost is not the only sign of frost damage, and no hillside position guarantees freedom from frost.", "Moea o batang o ka lula libakeng tse tlaase masiu a hlakileng, a khutsitseng. Bapisa libaka tsa kereche tseo e ka bang tsona nakong ea sehla sa serame sa lehae. Hlahloba litlaleho tsa mocheso o tlaase-tlaase tsa lehae kapa u botse moeletsi oa temo oa lehae pele u etsa qeto ea nako e telele. Serame sa phoka se bonoang hase sesupo se le seng feela sa tšenyo ea serame, 'me ha ho na sebaka sa lehlakoreng la leralla se tiisang ho se be le serame.", "machine-draft"),
        },
        {
          question: pair("A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?", "Tamati (tomatoes) ea molemi oa KZN e lula e tšoaroa ke late blight nakong ea maemo a pholileng, a mongobo. Ke sebaka sefe sa bethe se ka thusang mahlaku ho oma, hammoho le keletso ea bophelo bo botle ba lijalo ea lehae?", "machine-draft"),
          options: [
            pair("A sealed, unventilated tunnel", "Kotopo e koetsoeng, e se nang moea (unventilated tunnel)", "machine-draft"),
            pair("A place with good airflow and morning sun", "Sebaka se nang le phallo e ntle ea moea le letsatsi la hoseng", "machine-draft"),
            pair("A low spot near a dam", "Sebaka se tlaase haufi le letamo", "machine-draft"),
            pair("A shaded south wall", "Lebota le ka boroa le nang le moriti", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.", "Phallo ea moea le letsatsi la hoseng li ka thusa mahlaku ho oma. Late blight e ratoa ke leholimo le pholileng, le mongobo le nkang nako e telele, 'me ho suthisa bethe feela hase moralo o feletseng oa taolo.", "machine-draft"),
        },
      ],
    },
    {
      id: "reading-landscape-l4",
      infographicAlt: pair("A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.", "Mmapa oa setša (site map) o toroileng ka letsoho pampiring o bontšang leboea, meaho, metsi, le moeli — e matsapa, joalo ka ha molemi a ka e toroa.", "machine-draft"),
      title: pair("Making a Simple Site Map: Your Design Starts on Paper", "Ho Etsa Mmapa o Bonolo oa Setša (Site Map): Moralo oa Hao o Qala Pampiring", "machine-draft"),
      body: pair("A site map needs paper, a tape measure, a compass, and time to walk your land. Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.", "Mmapa oa setša (site map) o hloka pampiri, tepi e methang (tape measure), khampase (compass), le nako ea ho tsamaea lefatšeng la hao. Tsamaea moeling 'me u etse setšoantšo sa pele sa letsoho (sketch). Se tšoaee 'not to scale' ho fihlela u hlahlobile bohole ba sona. Tšoaea leboea. Kenya ntlo, lifate, metsi, litsela, literata. Toroa metsu bakeng sa moea oa lehlabula le oa mariha, mekhoa ea moriti, le moo metsi a phallang teng ha pula e na.\n\nHlokomela moo serame sa phoka se lulang nako e telele ka ho fetisisa, moo fatše ho nkhang mongobo likhoeling tse omileng, le moo khakibos kapa blackjack li melang li le ngata haholo. Limela tsena li ka mela libakeng tse tšoenngoeng (disturbed places), empa boteng ba tsona feela ha bo bontše hore na mobu o teteane (compacted). Hlahloba mobu pele u etsa qeto ea hore na sebaka seo se bolela eng bakeng sa moralo oa hao.\n\nBeha libaka tsa hao (zones) le likarolo (sectors) holim'a sona setšoantšo seo sa pele. Se nchafatse sehla ka sehla. Setšoantšo sa pentšele seo u hlileng u se sebelisang se na le boleng bo boholo ho feta se setle haholo se toroilweng hanngoe feela.", "machine-draft"),
      keyPoints: [
        pair("A site map needs only paper, a tape measure, a compass, and observation", "Mmapa oa setša (site map) o hloka feela pampiri, tepi e methang, khampase, le tlhokomelo", "machine-draft"),
        pair("Mark water flow, wind direction, frost pockets, and existing vegetation", "Tšoaea phallo ea metsi, nqa ea moea, lipokotho tsa serame, le limela tse teng", "machine-draft"),
        pair("Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction", "Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction", "hold"),
        pair("Overlay zones and sectors on your base map to complete the design skeleton", "Beha li-zone le li-sector holim'a mmapa oa hao oa motheo ho phethela masapo a moralo", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("You notice thick blackjack growing in one corner every year. What should you do next?", "U hlokomela blackjack e teteaneng e mela sekhutlong se seng selemo le selemo. U lokela ho etsa eng e latelang?", "machine-draft"),
          options: [
            pair("The soil there is exceptionally fertile", "Mobu o teng o nonne ka mokhoa o ikhethang", "machine-draft"),
            pair("That area has a higher water table", "Sebaka seo se na le metsi a ka tlas'a lefatše a phahameng haholo (higher water table)", "machine-draft"),
            pair("Mark the patch and check the soil; the plant alone cannot show compaction", "Tšoaea sebaka seo 'me u hlahlobe mobu; semela ka bosona se ke ke sa bontša ho teteana ha mobu (compaction)", "machine-draft"),
            pair("Blackjack only grows in shade, so there's a hidden seep", "Blackjack e mela feela moriting, kahoo ho na le seretse se patiloeng (hidden seep)", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.", "Blackjack e ka mela mobung o tšoenngoeng (disturbed ground), empa boteng ba eona feela ha bo hlahlobe ho teteana ha mobu (compaction). Hlokomela le ho hlahloba mobu pele u etsa qeto ea hore na sebaka seo se bolela eng bakeng sa moralo oa hao.", "machine-draft"),
        },
        {
          question: pair("Why mark summer and winter wind separately on your site map?", "Ke hobane'ng ha u tšoaea moea oa lehlabula le oa mariha ka thoko mmapeng oa hao oa setša (site map)?", "machine-draft"),
          options: [
            pair("Wind direction never changes in SA", "Nqa ea moea ha e mohla e fetohang SA", "machine-draft"),
            pair("They can come from different directions, changing where windbreaks and tender crops should go", "E ka tsoa nqeng tse fapaneng, e fetola moo litšireletso tsa moea (windbreaks) le lijalo tse bonolo li lokelang ho ea teng", "machine-draft"),
            pair("Wind only matters in winter on the Highveld", "Moea o bohlokoa feela mariha Highveld", "machine-draft"),
            pair("Wind direction only affects buildings", "Nqa ea moea e ama feela meaho", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.", "Liphetoho tsa moea ho latela sehla li bolela hore tšireletso ea moea (windbreak) kapa sebaka sa lijalo se sebetsang hantle sehleng se seng se ka ba fosahetseng sehleng se seng — kahoo ka bobeli li hloka ho tšoauoa ka thoko.", "machine-draft"),
        },
      ],
    },
  ],
};
