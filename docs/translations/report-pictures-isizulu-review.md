# Site report pictures: isiZulu awaiting first-language review

## What this is

The site report now carries pictures drawn from the site's own saved data (site plan, rain by month,
water budget, sun and wind, soil, land use, progress, build order) and captions for the concept pictures.
Every label, caption and note on them has an isiZulu version, written in the same inline
`t(English, isiZulu)` style the report code already used.

**None of the isiZulu below has been checked by a first-language speaker.** It was written by the
same AI session that wrote the English. Treat every line as a draft.

## Who should review this

A fluent first-language isiZulu speaker who also knows smallholder farming. The words for "swale",
"bed", "tank", "windbreak", "greywater" and "topsoil" must be the ones a farmer actually says, not the
dictionary-literal ones. Where the everyday word is an English loan, keep the loan.

## How to correct a line

Each line is `isiZulu  <=  English`. The English is the source of truth. Search the named file for the
English text; the isiZulu is the second string in the same `t(...)` call.

Some lines contain `${...}`. That is a number or a name the app fills in: keep it exactly as it is and
move it to wherever it reads naturally in isiZulu.

## `lib/report-figures.ts` (208)

- Indlu  <=  House
- Isitubhi  <=  Patio
- Indlela yemoto  <=  Driveway
- Utshani  <=  Lawn
- Ingadi yemifino  <=  Veg garden
- Insimu yezithelo  <=  Orchard
- Indawo evulekile  <=  Cleared ground
- Umsele wokubamba amanzi  <=  Swale
- Uthango  <=  Fence
- Indlela  <=  Path
- Indlela yemibhede  <=  Bed path
- Ipayipi lamanzi  <=  Water pipe
- Ipayipi lokuconsa  <=  Drip line
- Isivikelo somoya  <=  Windbreak
- Amanzi asetshenzisiwe  <=  Greywater line
- INyakatho  <=  North
- Umngcele wendawo  <=  Site boundary
- Izakhiwo  <=  Buildings
- umbhede wemifino, unenombolo  <=  vegetable bed, numbered
- imibhede yemifino, inezinombolo  <=  vegetable beds, numbered
- isiza esiyisisekelo esi-1 (P1)  <=  1 staple plot (P1)
- iziza eziyisisekelo ezi-${plotNumber} (P1–P${plotNumber})  <=  ${plotNumber} staple plots (P1–P${plotNumber})
- isihlahla noma isitshalo, ngesikali  <=  tree or planting, to scale
- izihlahla nezitshalo, ngesikali  <=  trees and plantings, to scale
- ithangi noma indawo yamanzi  <=  water tank or water point
- amathangi nezindawo zamanzi  <=  water tanks and points
- Indawo egandayiwe  <=  Paving and driveway
- Udonga lwethala  <=  Terrace bank
- isakhiwo esincane  <=  structure
- izakhiwo ezincane  <=  structures
- into yomhlabathi  <=  soil or earthworks item
- izinto zomhlabathi  <=  soil and earthworks items
- indawo yezilwane  <=  animal shelter
- izindawo zezilwane  <=  animal shelters
- isango noma indlela  <=  gate or access item
- amasango nezindlela  <=  gates and access items
- Okugcwele = sekukhona.  Umugqa onamachashaza = kuhleliwe, akukakhiwa.  <=  Solid = already there.  Dashed outline = planned, not built yet.
- Imigqa enamachashaza: konke okukuleli pulani kuhleliwe, akukakhiwa.  <=  Dashed outlines: everything on this plan is planned, not built yet.
- Amakhodi ezitshalo  <=  Plant codes
- Amagama emibhede  <=  Bed names
- umbhede wemifino  <=  vegetable bed
- imibhede yemifino  <=  vegetable beds
- isiza esiyisisekelo  <=  staple plot
- iziza eziyisisekelo  <=  staple plots
- isihlahla  <=  tree or planting
- izihlahla nezitshalo  <=  trees and plantings
- into yamanzi  <=  water item
- izinto zamanzi  <=  water items
- Ipulani lendawo  <=  Site plan
- Kudwetshwe ngesikali kusuka kumklamo ogciniwe.  <=  Drawn to scale from the saved design.
- INyakatho iphezulu.   <=  North is up. 
- Izinombolo zemibhede ziyafana nezasohlwini lwemibhede.   <=  Bed numbers match the bed list. 
- Umngcele udlulela ngale kwalo mdwebo, osondele endaweni eklanyiwe.   <=  The boundary runs beyond this drawing, which closes in on the designed area. 
- Izinto ezincane kakhulu zidwetshwe zaba zinkulu ukuze zibonakale.   <=  Very small items are drawn larger so they can be seen. 
- Akusikho ukuhlolwa komhlaba.  <=  It is not a land survey.
- Umklamo ogciniwe  <=  Saved design
- ; umngcele nezakhiwo njengoba kudwetshwe kumephu  <=  ; boundary and buildings as traced on the map
- Ipulani lendawo elidwetshwe kumklamo ogciniwe  <=  Site plan drawn from the saved design
- Isikali  <=  Scale bar
- isevisi yedatha yesimo sezulu  <=  climate data service
- yemvula ngonyaka ojwayelekile  <=  of rain in an average year
- Inyanga enemvula kakhulu  <=  Wettest month
- Inyanga eyome kakhulu  <=  Driest month
- Isikhathi semvula  <=  Wet season
- Isikhathi sesomiso  <=  Dry season
- Izinga lokushisa elijwayelekile ngenyanga (°C)  <=  Average temperature each month (°C)
- Inyanga efudumele kakhulu  <=  Warmest month
- ebanda kakhulu  <=  coolest
- Imvula nokufudumala phakathi nonyaka  <=  Rain and warmth through the year
- Izilinganiso zesikhathi eside zale ndawo, akusona isibikezelo. Noma yimuphi unyaka ungaba nemvula eningi noma ube womile kakhulu kunalokhu.  <=  Long-term monthly averages for this location, not a forecast. Any one year can be much wetter or much drier than this.
- Imvula ngenyanga  <=  Rain by month
- ngonyaka  <=  a year
- enemvula kakhulu  <=  wettest
- eyome kakhulu  <=  driest
- Lolu phahla lungabamba  <=  This roof can catch
- ngonyaka ojwayelekile  <=  in an average year
- yophahla oludwetshiwe  <=  of traced roof
- yemvula  <=  of rain
- okunye kulahleka ngokuchaphazela nangamanzi okuqala angcolile  <=  the rest is lost to splash and the first dirty flush
- amalitha  <=  litres
- Imvula ebanjwa uphahla ngaleyo nyanga  <=  Rain the roof catches that month
- Amanzi asetshenziswa ngaleyo nyanga  <=  Water used that month
- ngosuku  <=  a day
- Ukushoda: kumele kuvele ethangini noma komunye umthombo  <=  Short: must come from the tank or another source
- Isitoreji samathangi  <=  Tank storage
- Kupulani  <=  On the plan
- sekufakiwe  <=  already installed
- kuhleliwe, akukafakwa  <=  planned, not installed yet
- ithangi elingaziwa usayizi, alibalwanga  <=  tank of unknown size, not counted
- Okudingekayo ukuze kudlule izinyanga ezomile (Isibali Sethangi)  <=  Needed to carry this use through the dry months (Tank Calculator)
- Ukusetshenziswa kwamanzi kwansuku zonke akukaqoshwa kule ndawo, ngakho lo mdwebo awukwazi ukukhombisa izinyanga ezishodayo. Kufake ku-Design Studio, isinyathelo Samanzi.  <=  Daily water use has not been recorded for this site, so this figure cannot show which months run short. Add it in the Design Studio, Water step.
- Uphahla lubamba okuncane kunalokho okusetshenziswayo ngo  <=  The roof catches less than is used in
- Esikhathini eside esomile igebe lifinyelela ku  <=  Over the longest dry run the gap adds up to
- Ngonyaka wonke lolu phahla lubamba okuncane kunalokho okusetshenziswa indawo. Ithangi elikhulu liyasiza, kodwa kudingeka uphahla olwengeziwe noma omunye umthombo wamanzi.  <=  Over the whole year this roof catches less than the site uses. A bigger tank helps, but more roof or another water source is needed to close the gap.
- Ngonyaka ojwayelekile uphahla lubamba okungaphezu kwalokho okusetshenziswayo nyanga zonke.  <=  In an average year the roof catches more than is used in every month.
- Amanzi ophahla: okungenayo nokuphumayo  <=  Roof water: what comes in and what goes out
- Izibalo zonyaka ojwayelekile, akusona isithembiso semvula. Kubalwa kuphela uphahla oludwetshiwe namathangi asepulanini; akusho lutho ngokuphepha kwamanzi okuphuzwa.  <=  Average-year arithmetic, not a promise of rain. It counts only the roof that has been traced and only the tanks drawn on the plan; it says nothing about whether the water is safe to drink.
- Uphahla  <=  Roof
- indawo edwetshiwe  <=  traced area
- Imvula  <=  Rain
- Ukusetshenziswa kwansuku zonke: njengoba kuqoshwe ku-Design Studio.  <=  Daily use: as recorded in the Design Studio.
- Okubanjwa uphahla ngenyanga  <=  Roof catch by month
- kuyashoda ngo  <=  short in
- isitoreji esikupulani  <=  storage on the plan
- isitoreji esidingekayo  <=  storage needed
- eningizimu  <=  to the south
- enyakatho  <=  to the north
- phezulu ngqo  <=  overhead
- Ilanga lasemini licishe libe phezulu ngqo  <=  The midday sun stands almost overhead
- Ilanga lasemini lima  <=  The midday sun stands
- isigxobo esingu-1 m senza isithunzi esingu-${n} m  <=  a 1 m post throws a ${n} m shadow
- Ubusika  <=  Winter
- ngaphezu komkhathizwe  <=  above the horizon
- Ihlobo  <=  Summer
- liphuma  <=  rises
- lishona  <=  sets
- ngaphezu komkhathizwe emini  <=  above the horizon at midday
- Ilanga lasehlobo  <=  Summer sun
- Ilanga lasebusika  <=  Winter sun
- uvela e  <=  from the
- umlilo ulandela lo moya  <=  fire follows this wind
- iphethini yesifunda  <=  regional pattern
- Ingozi yomlilo  <=  Fire risk
- Umlilo kungenzeka ufike uvela e  <=  Fire is most likely to arrive from the
- Umoya oqoshwe kule ndawo: uvame ukuvela e  <=  Wind recorded on this site: usually from the
- onamandla kakhulu uvela e  <=  strongest from the
- Umoya owuqophe lapha: uvela e  <=  Wind you recorded here: from the
- onamandla  <=  strongest
- Umhlaba wehlela e  <=  The ground falls toward the
- umthambeka  <=  slope
- Ukwehla, ngase  <=  Downhill, toward the
- hlola ngelevela  <=  check with a level
- Umhlaba ubonakala ucishe ube yisicaba, ngakho akukho ndlela yokwehla edwetshiwe.  <=  The ground reads as nearly flat, so no downhill direction is drawn.
- Cishe yisicaba: akukho ndlela yokwehla — hlola ngelevela  <=  Nearly flat: no downhill direction drawn — check with a level
- Umoya wesifunda — awulinganiswanga kule ndawo  <=  Wind of the region — not measured on this site
- Lapho umlilo ungavela khona (isifunda)  <=  Where fire is most likely to come from (regional)
- Ilanga, umoya nomthambeka  <=  Sun, wind and slope
- INyakatho iphezulu; uphawu lwendlu yile ndawo. Izindlela zelanga zibalwa ngokwe-latitude. Izimpawu ezinemidwa ziyiphethini yesifunda, aziyona imilinganiso: ziqinisekise ngalokho wena nomakhelwane enikubonayo.  <=  North is up; the house mark is this site. Sun paths are calculated from the latitude. Hatched marks are regional patterns, not measurements: check them against what you and your neighbours see.
- Ilanga: kubalwe nge-latitude  <=  Sun: calculated for latitude
- Umoya nomlilo: iphethini yesifunda  <=  Wind and fire: regional pattern
- Umthambeka: imodeli yokuphakama.  <=  Slope: elevation model.
- Umoya obonwe: uqoshwe ku-Design Studio.  <=  Observed wind: recorded in the Design Studio.
- Umdwebo wamasekta  <=  Sector diagram
- akulinganiswanga  <=  not measured
- Umhlabathi walapha awukalinganiswa  <=  The soil here has not been measured yet
- Ukuhlolwa komhlabathi kugcwalisa lezi zilinganiso ezintathu.  <=  A soil test fills in these three readings.
- Ubumuncu noma ubumnandi (pH)  <=  How sour or sweet (pH)
- Isihlabathi, udaka nobumba  <=  Sand, silt and clay
- Ikhabhoni yemvelo  <=  Organic carbon
- Umhlabathi ngamafuphi  <=  Soil at a glance
- Akukho ukulinganiswa komhlabathi okuqoshiwe kule ndawo, ngakho akukho okudwetshiwe. Hlela ukuhlolwa komhlabathi kusampula yamasentimitha angu-30 aphezulu.  <=  No soil measurement is recorded for this site, so nothing is plotted. Arrange a soil test on a sample from the top 30 cm.
- Akukho ukulinganiswa komhlabathi okuqoshiwe  <=  No soil measurement recorded
- Umhlabathi awulinganiswanga.  <=  Soil not measured.
- Ukuthi umhlabathi umuncu noma umnandi kangakanani (pH)  <=  How sour or sweet the soil is (pH)
- ← umuncu kakhulu  <=  ← more acid (sour)
- une-alkali kakhulu →  <=  more alkaline →
- imifino eminingi: 6 kuya ku-7  <=  most vegetables: 6 to 7
- Isihlabathi  <=  Sand
- Udaka olucolekile  <=  Silt
- Ubumba  <=  Clay
- Ukuthi umhlabathi wenziwe ngani  <=  What the soil is made of
- Ikhabhoni yemvelo: ukuthi umhlabathi uphethe izinto zezitshalo ezibolile ezingakanani  <=  Organic carbon: how much rotted plant matter the soil holds
- Ichashazi eligcwele: kulinganiswe yilabhorethri kusampula yale ndawo.  <=  Filled dot: measured by a laboratory on a sample from this site.
- Ichashazi elingenalutho nemidwa enqamukayo: kulinganiselwe le ndawo yimodeli yomhlabathi yomhlaba i-SoilGrids, akulinganiswanga lapha. Ukuhlolwa komhlabathi wakho kuzokuvala lokhu.  <=  Hollow dot and dashed outlines: estimated for this location by the SoilGrids world soil model, not measured here. A soil test on your own sample will replace them.
- Akukho ukulinganiswa komhlabathi okuqoshiwe kule ndawo, ngakho akukho okudwetshiwe. Hlela ukuhlolwa komhlabathi: umphumela uzogcwalisa zonke izikali ezintathu.  <=  No soil measurement is recorded for this site, so nothing is plotted. Arrange a soil test: the result fills in all three scales.
- Amasentimitha angu-30 aphezulu omhlabathi. Ayikho imigqa ethi "kuhle" noma "kubi" yekhabhoni yemvelo ngoba izinga elifanele lincike ohlotsheni lomhlabathi nesimo sezulu.  <=  Top 30 cm of soil. No "good" or "bad" bands are drawn for organic carbon because the right level depends on the soil type and climate.
- Ukuhlolwa kwakho komhlabathi kwelabhorethri okulayishiwe  <=  Your uploaded laboratory soil test
- Imodeli yomhlabathi yomhlaba i-SoilGrids (ISRIC), igridi engu-250 m: isilinganiso, akusona isilinganiso sangempela  <=  SoilGrids world soil model (ISRIC), 250 m grid: an estimate, not a measurement
- Umhlabathi  <=  Soil
- ikhabhoni yemvelo  <=  organic carbon
- umphumela welabhorethri  <=  laboratory result
- isilinganiso se-SoilGrids  <=  SoilGrids estimate
- izigaba zomsebenzi. Esokugcina siqala cishe ngeviki  <=  stages of work. The last one starts around week
- Izigaba ziyadlulana: esilandelayo singaqala ngaphambi kokuba esandulelayo siphele.  <=  Stages overlap: the next one can start before the one before it is finished.
- Isigaba ngasinye siqala lapho esandulelayo sesiphelile.  <=  Each stage starts when the one before it is finished.
- amaviki kusukela ngosuku umsebenzi oqala ngalo  <=  weeks from the day work starts
- Umsebenzi ohleliwe, awukaqali  <=  Planned work, not started
- Iphuzu lokuma: yima uhlole ngaphambi kwesigaba esilandelayo  <=  Hold point: stop and check before the next phase
- Kuyaqhubeka  <=  Carries on
- Ukulandelana komsebenzi  <=  Order of work
- Ukulandelana nobude obulinganiselwe besigaba ngasinye, kubalwe kulokho okusemklamweni ogciniwe. Amaviki ayisiqondiso sokuhlela, akusona isithembiso: isimo sezulu, imali nabasebenzi kuzowashintsha. Ukulandelana akufanele kushintshe.  <=  The order and rough length of each phase, worked out from what is on the saved design. The weeks are a planning guide, not a promise: weather, money and labour will move them. The order should not change.
- Izigaba zokwakha ezithathwe kumklamo ogciniwe  <=  Build phases derived from the saved design
- Imibhede yemifino  <=  Vegetable beds
- Iziza zezitshalo eziyisisekelo  <=  Staple crop plots
- Konke okunye: izindlela, izihlahla, igceke, umhlaba ovulekile  <=  Everything else: paths, trees, yard, open ground
- Indawo yonke  <=  The whole site
- Ukuthi umhlaba usetshenziswa kanjani  <=  How the ground is used
- Izindawo njengoba zidwetshwe kumklamo ogciniwe nakumephu, noma sezakhiwe noma cha. Izihlahla, izindlela namathangi akubalwa njengezindawo.  <=  Areas as drawn on the saved design and traced on the map, whether built yet or not. Trees, paths and tanks are not counted as areas.
- Umngcele  <=  Boundary
- udwetshwe kumephu  <=  traced on the map
- Imibhede neziza: umklamo ogciniwe.  <=  Beds and plots: saved design.
- Ukusetshenziswa komhlaba  <=  Land use
- Izihlahla nezitshalo  <=  Trees and plants
- Amanzi  <=  Water
- Izakhiwo  <=  Structures
- Imisebenzi yomhlaba  <=  Earthworks
- Izilwane  <=  Animals
- Ukufinyelela  <=  Access
- Izindlela, imisele namapayipi  <=  Paths, swales and pipes
- sekukhona  <=  already there
- kusazokwakhiwa noma kutshalwe  <=  still to build or plant
- Sekukhona  <=  Already there
- Kuhleliwe, akukakhiwa noma kutshalwe  <=  Planned, not built or planted yet
- Izinombolo: okukhona manje / isamba  <=  Numbers: there now / total
- Okwakhiwe, nokusazokwakhiwa  <=  Built, and still to build
- Uphawu olulodwa lwento ngayinye esemklamweni ogciniwe, njengoba yaphawulwa khona. Shintsha into ibe "ekhona" ku-Design Studio uma isisemhlabathini.  <=  One mark for each thing on the saved design, as it was marked there. Change an item to "existing" in the Design Studio once it is in the ground.
- Okwakhiwe nokuhleliwe  <=  Built and planned
- Umklamo ushintshile selokhu kwabhalwa lo mbiko. Lesi sithombe sikhombisa umklamo njengoba unjalo namuhla.  <=  The design has changed since this report was written. This picture shows the design as it is today.

## Outside the pictures (9)

- Shelelezisa eceleni ukuze ubone konke  <=  Slide to see more  (`lib/report-visuals.ts`, the cue on a wide picture on a phone)
- Umthombo  <=  Source  (`lib/report-visuals.ts`, before the source of each picture)
- Izinketho zokubuka nokuphrinta  <=  View and print options  (`components/ReportView.tsx`, the folded options on a phone)
- IPULANI YENDAWO  <=  SITE PLAN  (`lib/report-visuals.ts`, the small label above a picture; the next four are the same)
- OKWAKHIWE / OKUHLELIWE  <=  BUILT / PLANNED
- ILANGA · UMOYA · UMTHAMBEKA  <=  SUN · WIND · SLOPE
- AMALITHA  <=  LITRES
- UMHLABATHI  <=  SOIL; AMASONTO  <=  WEEKS

## Still English only

The titles and captions of the concept pictures (`lib/report-chapter-visuals.ts`), including "Concept
illustration, the same in every report. It is not a picture of this site.", have no isiZulu yet. The
chapter graphics in that file were English only before this change, and these follow them. They need
translating, not reviewing.
