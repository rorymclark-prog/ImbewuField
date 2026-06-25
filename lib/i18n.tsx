'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const APP_LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zu', label: 'isiZulu', native: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa', native: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans', native: 'Afrikaans' },
  { code: 'st', label: 'Sesotho', native: 'Sesotho' },
  { code: 'nso', label: 'Sepedi', native: 'Sepedi' },
  { code: 'tn', label: 'Setswana', native: 'Setswana' },
  { code: 'ts', label: 'Xitsonga', native: 'Xitsonga' },
  { code: 've', label: 'Tshivenda', native: 'Tshivenḓa' },
  { code: 'ss', label: 'siSwati', native: 'siSwati' },
  { code: 'nr', label: 'isiNdebele', native: 'isiNdebele' },
] as const;

type Dict = Record<string, string>;

const T: Record<string, Dict> = {
  en: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Permaculture Intelligence',
    welcomeTitle: 'Welcome to ImbewuField',
    welcomeSub: 'Smart permaculture planning for South African land.',
    pickLang: 'Choose your language',
    pickLangSub: 'You can change it any time from the top bar.',
    start: 'Start',
    heroSub: 'Tap anywhere in South Africa to get a full permaculture plan for your land.',
    clickAnalyse: 'Tap the map to analyse',
    dataSources: 'Data sources',
    language: 'Language',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Overview',
    tabAsk: 'Ask',
    tabReports: 'Reports',
    tabPeople: 'People',
    tabWater: 'Water',
    tabSoil: 'Soil',
    tabClimate: 'Climate',
    tabNature: 'Nature',
    tabArea: 'Area',
    tabPhotos: 'Photos',
    tabDesign: 'Design',
    tabAI: 'AI',
    tabPlaces: 'Places',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Home',
    tabMap: 'Map',
    tabFinance: 'Finance',
    tabAccount: 'Account',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Find your land',
    parcelsWater: 'Parcels & water',
    siteReport: 'Site report',
    goodFit: 'Good fit',
    fairSite: 'Fair site',
    challenging: 'Challenging',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Annual rainfall',
    soilTexture: 'Soil texture',
    frostRisk: 'Frost risk',
    elevation: 'Elevation',
    yourLand: 'Your land',
    harvestingAreas: 'Harvesting areas',
    hectares: 'hectares',
    parcels: 'parcels',
    perimeter: 'perimeter',
    catchmentArea: 'catchment area',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Planting calendar',
    grow: 'Grow',
    dry: 'Dry',
    frost: 'Frost',
    rest: 'Rest',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Generate full report',
    savedReports: 'SAVED REPORTS',
    reportsEmpty: 'Generate a report above, then tap Save report inside it to keep it here.',
    saveReport: 'Save report',
    open: 'Open',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'No team members found. Invite colleagues to join your organisation.',
    yourProfile: 'Your profile',
    youBadge: 'You',
    onMap: 'On map',
    // ── Water tab ─────────────────────────────────────────────────────────────
    waterBalance: 'Water balance',
    roofCatchment: 'Roof catchment',
    totalDemand: 'Total demand',
    tankLevel: 'Tank level',
    minSafeLevel: 'Min safe level',
  },

  af: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Permakultuur-Intelligensie',
    welcomeTitle: 'Welkom by ImbewuField',
    welcomeSub: 'Slim permakultuur-beplanning vir Suid-Afrikaanse grond.',
    pickLang: 'Kies jou taal',
    pickLangSub: 'Jy kan dit enige tyd bo verander.',
    start: 'Begin',
    heroSub: "Tik enige plek in Suid-Afrika om 'n volledige permakultuurplan vir jou grond te kry.",
    clickAnalyse: 'Tik die kaart om te ontleed',
    dataSources: 'Databronne',
    language: 'Taal',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Oorsig',
    tabAsk: 'Vra',
    tabReports: 'Verslae',
    tabPeople: 'Mense',
    tabWater: 'Water',
    tabSoil: 'Grond',
    tabClimate: 'Klimaat',
    tabNature: 'Natuur',
    tabArea: 'Oppervlak',
    tabPhotos: "Foto's",
    tabDesign: 'Ontwerp',
    tabAI: 'KI',
    tabPlaces: 'Plekke',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Tuis',
    tabMap: 'Kaart',
    tabFinance: 'Finansies',
    tabAccount: 'Rekening',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Vind jou grond',
    parcelsWater: 'Persele en water',
    siteReport: 'Terreinverslag',
    goodFit: 'Goeie passing',
    fairSite: 'Redelike terrein',
    challenging: 'Uitdagend',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Jaarlikse reënval',
    soilTexture: 'Grondtekstuur',
    frostRisk: 'Ryswaar-risiko',
    elevation: 'Hoogte',
    yourLand: 'Jou grond',
    harvestingAreas: 'Oesvlaktes',
    hectares: 'hektaar',
    parcels: 'persele',
    perimeter: 'omtrek',
    catchmentArea: 'opvangsgebied',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Plantkalender',
    grow: 'Groei',
    dry: 'Droog',
    frost: 'Ryp',
    rest: 'Rus',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Genereer volledige verslag',
    savedReports: 'GESTOORDE VERSLAE',
    reportsEmpty: "Genereer 'n verslag hierbo, druk dan Stoor verslag daarin om dit hier te hou.",
    saveReport: 'Stoor verslag',
    open: 'Oopmaak',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'Geen spanlede gevind nie. Nooi kollegas om by jou organisasie aan te sluit.',
    yourProfile: 'Jou profiel',
    youBadge: 'Jy',
    onMap: 'Op kaart',
    // ── Water tab ─────────────────────────────────────────────────────────────
    waterBalance: 'Waterbalans',
    roofCatchment: 'Dakvangs',
    totalDemand: 'Totale vraag',
    tankLevel: 'Tankpeil',
    minSafeLevel: 'Min veilige peil',
  },

  zu: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Ubuhlakani be-Permaculture',
    welcomeTitle: 'Wamukelekile ku-ImbewuField',
    welcomeSub: 'Ukuhlela kwe-permaculture okuhlakaniphile komhlaba waseNingizimu Afrika.',
    pickLang: 'Khetha ulimi lwakho',
    pickLangSub: 'Ungalushintsha noma nini ngenhla.',
    start: 'Qala',
    heroSub: 'Thepha noma kuphi eNingizimu Afrika ukuthola uhlelo olugcwele lomhlaba wakho.',
    clickAnalyse: 'Thepha imephu ukuze uhlaziye',
    dataSources: 'Imithombo yedatha',
    language: 'Ulimi',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Ukubuka Konke',
    tabAsk: 'Buza',
    tabReports: 'Imibiko',
    tabPeople: 'Abantu',
    tabWater: 'Amanzi',
    tabSoil: 'Umhlabathi',
    tabClimate: 'Isimo Sezulu',
    tabNature: 'Imvelo',
    tabArea: 'Indawo',
    tabPhotos: 'Izithombe',
    tabDesign: 'Uhlelo',
    tabAI: 'AI',
    tabPlaces: 'Izindawo',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Ekhaya',
    tabMap: 'Imephu',
    tabFinance: 'Imali',
    tabAccount: 'I-Akhawunti',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Thola umhlabathi wakho',
    parcelsWater: 'Izigaba namanzi',
    siteReport: 'Umbiko wendawo',
    goodFit: 'Kufanele kahle',
    fairSite: 'Indawo enhle',
    challenging: 'Kunzima',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Imvula Yonyaka',
    soilTexture: 'Isimo Somhlabathi',
    frostRisk: 'Ingozi Yeqhwa',
    elevation: 'Ukuphakama',
    yourLand: 'Umhlabathi Wakho',
    harvestingAreas: 'Izindawo Zokuqoqa',
    hectares: 'izindlwana',
    parcels: 'izigaba',
    perimeter: 'umkhawulo',
    catchmentArea: 'indawo yokubamba amanzi',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Ikhalenda Lokuhlanyela',
    grow: 'Khula',
    dry: 'Omile',
    frost: 'Qhwa',
    rest: 'Phumula',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Yenza umbiko ophelele',
    savedReports: 'IMIBIKO ELONDOLOZIWE',
    reportsEmpty: 'Yenza umbiko ngenhla, bese uthinta Londoloza umbiko ngaphakathi ukuze ugcine lapha.',
    saveReport: 'Londoloza umbiko',
    open: 'Vula',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'Awukho amalungu eqembu atholakele. Mema izinsakazo ukuba zihlanganyele nenhlangano yakho.',
    yourProfile: 'Iphrofayela Yakho',
    youBadge: 'Wena',
    onMap: 'Emephini',
    // ── Water tab ─────────────────────────────────────────────────────────────
    waterBalance: 'Ukuhlangana Kwamanzi',
    roofCatchment: 'Ukubamba Amanzi Phezu Kwendlu',
    totalDemand: 'Isidingo Esiphelele',
    tankLevel: 'Izinga Lethanki',
    minSafeLevel: 'Izinga Eliphephile',
  },

  xh: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Ubukrelekrele be-Permaculture',
    welcomeTitle: 'Wamkelekile ku-ImbewuField',
    welcomeSub: 'Ucwangciso lwe-permaculture olukrelekrele lomhlaba waseMzantsi Afrika.',
    pickLang: 'Khetha ulwimi lwakho',
    pickLangSub: 'Ungalutshintsha nanini na ngentla.',
    start: 'Qalisa',
    heroSub: 'Cofa naphi na eMzantsi Afrika ufumane isicwangciso esipheleleyo somhlaba wakho.',
    clickAnalyse: 'Cofa imephu ukuze uhlalutye',
    dataSources: 'Imithombo yedatha',
    language: 'Ulwimi',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Ukubona Konke',
    tabAsk: 'Buza',
    tabReports: 'Iingxelo',
    tabPeople: 'Abantu',
    tabWater: 'Amanzi',
    tabSoil: 'Umhlaba',
    tabClimate: 'Imozulu',
    tabNature: 'Imvelo',
    tabArea: 'Indawo',
    tabPhotos: 'Iifoto',
    tabDesign: 'Isakhiwo',
    tabAI: 'AI',
    tabPlaces: 'Iindawo',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Ekhaya',
    tabMap: 'Imephu',
    tabFinance: 'Imali',
    tabAccount: 'I-Akhawunti',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Fumana umhlaba wakho',
    parcelsWater: 'Iziqwenga namanzi',
    siteReport: 'Ingxelo yendawo',
    goodFit: 'Ifanelekile kakuhle',
    fairSite: 'Indawo entle',
    challenging: 'Kunzima',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Imvula Yonyaka',
    soilTexture: 'Ubume Bomhlaba',
    frostRisk: 'Ingozi Yeqhwa',
    elevation: 'Ukuphakama',
    yourLand: 'Umhlaba Wakho',
    harvestingAreas: 'Iindawo Zokuvuna',
    hectares: 'iikhekithare',
    parcels: 'iziqwenga',
    perimeter: 'umda',
    catchmentArea: 'indawo yokubamba amanzi',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Ikhalenda Lokutyala',
    grow: 'Khula',
    dry: 'Omile',
    frost: 'Qhwa',
    rest: 'Phumla',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Yenza ingxelo epheleleyo',
    savedReports: 'IINGXELO EZIGCINIWEYO',
    reportsEmpty: 'Yenza ingxelo ngentla, ucofe Gcina ingxelo ngaphakathi ukuze uyigcine apha.',
    saveReport: 'Gcina ingxelo',
    open: 'Vula',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'Akukho malungu eqela afumanekileyo. Mema izifundo ukuba zijoyine umbutho wakho.',
    yourProfile: 'Iphrofayile Yakho',
    youBadge: 'Wena',
    onMap: 'Emephini',
    // ── Water tab ─────────────────────────────────────────────────────────────
    waterBalance: 'Ulungiselwano Lwamanzi',
    roofCatchment: 'Ukubamba Amanzi Uphahla',
    totalDemand: 'Isidingo Esipheleleyo',
    tankLevel: 'Izinga Lethanki',
    minSafeLevel: 'Izinga Eliphephileyo',
  },

  st: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Bohlale ba Permaculture',
    welcomeTitle: 'O amohelehile ho ImbewuField',
    welcomeSub: 'Moralo o bohlale oa permaculture bakeng sa naha ea Afrika Boroa.',
    pickLang: 'Khetha puo ea hau',
    pickLangSub: 'O ka e fetola neng kapa neng ka holimo.',
    start: 'Qala',
    heroSub: 'Tobetsa kae kapa kae Afrika Boroa ho fumana moralo o felletseng oa naha ea hau.',
    clickAnalyse: "Tobetsa 'mapa ho hlahloba",
    dataSources: 'Mehloli ea data',
    language: 'Puo',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Kakaretso',
    tabAsk: 'Botsa',
    tabReports: 'Dipego',
    tabPeople: 'Batho',
    tabWater: 'Metsi',
    tabSoil: 'Mobu',
    tabClimate: 'Leholimo',
    tabNature: 'Tlhaho',
    tabArea: 'Sebaka',
    tabPhotos: 'Difoto',
    tabDesign: 'Moralo',
    tabAI: 'AI',
    tabPlaces: 'Dibaka',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Lapeng',
    tabMap: 'Mmapa',
    tabFinance: 'Lichelete',
    tabAccount: "Ak'haonte",
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Fumana lefatshe la hao',
    parcelsWater: 'Dibaka le metsi',
    siteReport: 'Pego ea sebaka',
    goodFit: 'E tshwanetse',
    fairSite: 'Sebaka se tsepahetseng',
    challenging: 'Thata',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Pula ea Selemo',
    soilTexture: 'Sebōpeho sa Mobu',
    frostRisk: 'Kotsi ea Leqhoa',
    elevation: 'Boeleele',
    yourLand: 'Lefatshe la Hao',
    harvestingAreas: 'Libaka la Kotulo',
    hectares: 'hektare',
    parcels: 'dibaka',
    perimeter: 'molapo',
    catchmentArea: 'sebaka sa ho phuthela metsi',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Khalenda ea ho Jala',
    grow: 'Hola',
    dry: 'Omelele',
    frost: 'Leqhoa',
    rest: 'Phomola',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Etsa pego e tletseng',
    savedReports: 'DIPEGO TSE BOLOKILWENG',
    reportsEmpty: 'Etsa pego ka holimo, ebe o tobetsa Boloka pego ho e boloka mona.',
    saveReport: 'Boloka pego',
    open: 'Bula',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'Ha ho bahlankedi ba sehlopha. Mema bahlankedi ho hlakana le mokhatlo wa hao.',
    yourProfile: 'Profaele ya Hao',
    youBadge: 'Wena',
    onMap: 'Ho mmapa',
    // ── Water tab ─────────────────────────────────────────────────────────────
    waterBalance: 'Tekanelo ea Metsi',
    roofCatchment: 'Phuthelo ea Metsi Holimo',
    totalDemand: 'Tlhokahalo Kaofela',
    tankLevel: 'Boemo ba Tanki',
    minSafeLevel: 'Boemo bo Bolokelang',
  },

  nso: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Bohlale bja Permaculture',
    welcomeTitle: 'O amogetšwe go ImbewuField',
    welcomeSub: 'Moralo wa go šiša wa permaculture bakeng sa naga ya Afrika Borwa.',
    pickLang: 'Kgetha puo ya gago',
    pickLangSub: 'O ka e fetola nako efe le efe godimo.',
    start: 'Thoma',
    heroSub: 'Tobetša kae le kae go Afrika Borwa go hwetša moralo wo o feletseng wa naga ya gago.',
    clickAnalyse: 'Tobetša mmapa go sekaseka',
    dataSources: 'Methopo ya data',
    language: 'Puo',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Kakaretšo',
    tabAsk: 'Botša',
    tabReports: 'Dipego',
    tabPeople: 'Batho',
    tabWater: 'Meetse',
    tabSoil: 'Mobu',
    tabClimate: 'Bašika',
    tabNature: 'Tlhago',
    tabArea: 'Sebaka',
    tabPhotos: 'Difoto',
    tabDesign: 'Moralo',
    tabAI: 'AI',
    tabPlaces: 'Dibaka',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Gae',
    tabMap: 'Mmapa',
    tabFinance: 'Chelete',
    tabAccount: 'Akhaonte',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Hwetša naga ya gago',
    parcelsWater: 'Dibaka le meetse',
    siteReport: 'Pego ya sebaka',
    goodFit: 'E swanele',
    fairSite: 'Sebaka se sepetseng',
    challenging: 'Thata',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Pula ya Ngwaga',
    soilTexture: 'Sebopego sa Mobu',
    frostRisk: 'Kotsi ya Leqhoa',
    elevation: 'Bogodimo',
    yourLand: 'Naga ya Gago',
    harvestingAreas: 'Dibaka tša Kotulo',
    hectares: 'hektare',
    parcels: 'dibaka',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Khalenthara ya go Bjala',
    grow: 'Gola',
    dry: 'Omile',
    frost: 'Leqhoa',
    rest: 'Phomola',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Dira pego ye e feletseng',
    savedReports: 'DIPEGO TSE BOLOKILWEGO',
    reportsEmpty: 'Dira pego ka godimo, o tobetše Boloka pego go e boloka mo.',
    saveReport: 'Boloka pego',
    open: 'Bula',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'Ga go na maloko a sehlopha ao a hwetšwago. Mema bahlankedi ho hlakana le mokgatlo wa gago.',
    yourProfile: 'Profaele ya Gago',
    youBadge: 'Wena',
    onMap: 'Go mmapa',
  },

  tn: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Botlhale jwa Permaculture',
    welcomeTitle: 'O amogetswe mo ImbewuField',
    welcomeSub: 'Thulaganyo e e botlhale ya permaculture ya lefatshe la Aforika Borwa.',
    pickLang: 'Tlhopha puo ya gago',
    pickLangSub: 'O ka e fetola nako nngwe le nngwe kwa godimo.',
    start: 'Simolola',
    heroSub: 'Tobetsa gongwe le gongwe mo Aforika Borwa go bona thulaganyo e e feletseng ya lefatshe la gago.',
    clickAnalyse: 'Tobetsa mmapa go sekaseka',
    dataSources: 'Metswedi ya data',
    language: 'Puo',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Kakaretso',
    tabAsk: 'Botsa',
    tabReports: 'Dipego',
    tabPeople: 'Batho',
    tabWater: 'Metsi',
    tabSoil: 'Mobu',
    tabClimate: 'Boemo jwa Lefaufau',
    tabNature: 'Tlhago',
    tabArea: 'Sebaka',
    tabPhotos: 'Ditshwantsho',
    tabDesign: 'Moralo',
    tabAI: 'AI',
    tabPlaces: 'Dibaka',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Gae',
    tabMap: 'Mmapa',
    tabFinance: 'Tšhelete',
    tabAccount: "Ak'haonte",
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Bona lefatshe la gago',
    parcelsWater: 'Dibaka le metsi',
    siteReport: 'Pego ya sebaka',
    goodFit: 'E tshwanetse',
    fairSite: 'Sebaka se gaisang',
    challenging: 'Thata',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Pula ya Ngwaga',
    soilTexture: 'Sebopego sa Mobu',
    frostRisk: 'Kotsi ya Leqhoa',
    elevation: 'Bogodimo',
    yourLand: 'Lefatshe la Gago',
    harvestingAreas: 'Dibaka tša Kotulo',
    hectares: 'hektare',
    parcels: 'dibaka',
    // ── Planting calendar ─────────────────────────────────────────────────────
    plantingCalendar: 'Khalenthara ya go Jala',
    grow: 'Gola',
    dry: 'Omile',
    frost: 'Leqhoa',
    rest: 'Phomola',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Dira pego e e feletseng',
    savedReports: 'DIPEGO TSE BOLOKILWENG',
    reportsEmpty: 'Dira pego ka godimo, o tobetse Boloka pego go e boloka foo.',
    saveReport: 'Boloka pego',
    open: 'Bula',
    // ── People tab ────────────────────────────────────────────────────────────
    noTeamMembers: 'Ga go na maloko a sehlopha. Mema balekane go tsena mo mokgatlhong wa gago.',
    yourProfile: 'Profaele ya Gago',
    youBadge: 'Wena',
    onMap: 'Go mmapa',
  },

  ts: {
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Vukomberi',
    tabAsk: 'Botsa',
    tabReports: 'Swipego',
    tabPeople: 'Vanhu',
    tabWater: 'Manzi',
    tabSoil: 'Misava',
    tabClimate: 'Leholimo',
    tabNature: 'Ntumbuluko',
    tabArea: 'Ndzhawu',
    tabPhotos: 'Swifaniso',
    tabDesign: 'Xivindzo',
    tabAI: 'AI',
    tabPlaces: 'Tindzhawu',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Kaya',
    tabMap: 'Mhaka',
    tabFinance: 'Xuma',
    tabAccount: "Ak'haonti",
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Kuma misava ya wena',
    parcelsWater: 'Tindzhawu ni manzi',
    siteReport: 'Ripego ra ndzhawu',
    goodFit: 'Yi fanele',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Endla ripego ro helela',
    savedReports: 'SWIPEGO SWO VIRIWA',
    reportsEmpty: 'Endla ripego ehenhla, ucofa Viriwa ripego eka rona ku ri byi sala laha.',
    saveReport: 'Viriwa ripego',
    open: 'Vula',
    // ── People tab ────────────────────────────────────────────────────────────
    yourProfile: 'Profayili ya wena',
    youBadge: 'Wena',
    noTeamMembers: 'Ku ri na vanhu va xihlangano. Loma vadyandyameri ku nghena eka muganga wa wena.',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Mvula ya Lembe',
    soilTexture: 'Xivumbeko xa Misava',
    frostRisk: 'Xivangelo xa Nyelo',
    elevation: 'Ku Phakama',
    yourLand: 'Misava ya Wena',
    harvestingAreas: 'Tindzhawu to Vuna',
    plantingCalendar: 'Khalenda ya Ku Byala',
    grow: 'Kula',
    dry: 'Woma',
    frost: 'Nyelo',
    rest: 'Khomisa',
  },

  ve: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Vhuḓifhinduleli ha Permaculture',
    welcomeTitle: 'Wo tanganedzwa kha ImbewuField',
    welcomeSub: 'Mbuno ya permaculture ya vhuḓivhudzisi vha musanda wa Afrika Tshipembe.',
    pickLang: 'Nanga luambo lwa lwe',
    pickLangSub: 'Ndi nga lu shandukisa nthihi nthihi godimo.',
    start: 'Thoma',
    heroSub: 'Dzhena fhiṅwe na fhiṅwe Afrika Tshipembe u wana mbuno ya musanda wa lwe.',
    clickAnalyse: 'Dzhena maepu u ṱalutshedzea',
    dataSources: 'Mveledziso ya data',
    language: 'Luambo',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Muono',
    tabAsk: 'Vhudzisa',
    tabReports: 'Zwitatiso',
    tabPeople: 'Vhatu',
    tabWater: 'Madi',
    tabSoil: 'Tshitaka',
    tabClimate: 'Vhuimo',
    tabNature: 'Mbilo',
    tabArea: 'Nḓuvha',
    tabPhotos: 'Tshifanyiso',
    tabDesign: 'Ndaedzo',
    tabAI: 'AI',
    tabPlaces: 'Zwiḓoroboni',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Hayani',
    tabMap: 'Maepu',
    tabFinance: 'Tshelede',
    tabAccount: 'Akaunthi',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Wana nḓuvha yavho',
    parcelsWater: 'Nḓuvha na madi',
    siteReport: 'Ripoto ya nḓuvha',
    goodFit: 'Yo konḓea',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Ita ripoto yo fhelaho',
    savedReports: 'ZWITATISO ZWO SETWAHO',
    reportsEmpty: 'Ita ripoto nṱha, u kanda Setwa ripoto nḓotshi u i vhea fhano.',
    saveReport: 'Setwa ripoto',
    open: 'Vhula',
    // ── People tab ────────────────────────────────────────────────────────────
    yourProfile: 'Profaili ya lwe',
    youBadge: 'Lwe',
    noTeamMembers: 'A hu na malugwa a tshenzhelo. Ṱavhidzela vhaṅwe u ḓa kha muvhuso wavo.',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Mvula ya Nwaha',
    soilTexture: 'Vhumbeo ha Tshitaka',
    frostRisk: 'Tshivhangelo tsha Lukunguni',
    elevation: 'Vhuimo',
    yourLand: 'Nḓuvha Yavho',
    harvestingAreas: 'Zwiḓoroboni zwa u Vhuna',
    plantingCalendar: 'Khalentha ya u Ṱavha',
    grow: 'Mela',
    dry: 'Ima',
    frost: 'Lukunguni',
    rest: 'Vhusa',
  },

  ss: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Buhlakaniphi be-Permaculture',
    welcomeTitle: 'Wamukelwa ku-ImbewuField',
    welcomeSub: 'Luhlelo lwe-permaculture loluhlakaniphile lomhlabatsi weNingizimu Afrika.',
    pickLang: 'Khetsa lulwimi lwakho',
    pickLangSub: 'Ungalushintsha noma nini ngenhla.',
    start: 'Cala',
    heroSub: 'Cindzeta noma kuphi eNingizimu Afrika kutfola luhlelo lolugcwele lomhlabatsi wakho.',
    clickAnalyse: 'Cindzeta imephu kutsi uhlole',
    dataSources: 'Imithombo yedatha',
    language: 'Lulwimi',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Umbono',
    tabAsk: 'Budzisa',
    tabReports: 'Imibiko',
    tabPeople: 'Bantfu',
    tabWater: 'Emanti',
    tabSoil: 'Umhlabatsi',
    tabClimate: 'Isimo Sezulu',
    tabNature: 'Imvelo',
    tabArea: 'Indzawo',
    tabPhotos: 'Tifoto',
    tabDesign: 'Umklamo',
    tabAI: 'AI',
    tabPlaces: 'Tindzawo',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Ekhaya',
    tabMap: 'Imephu',
    tabFinance: 'Imali',
    tabAccount: 'I-Akhawunti',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Thola umhlabatsi wakho',
    parcelsWater: 'Tindlela namanzi',
    siteReport: 'Umbiko wendzawo',
    goodFit: 'Kufanele kahle',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Yenta umbiko lophelele',
    savedReports: 'IMIBIKO LELONDOLOZIWE',
    reportsEmpty: 'Yenta umbiko ngenhla, bese ucindzeta Londoloza umbiko ngaphakathi ukuze ugugcine lapha.',
    saveReport: 'Londoloza umbiko',
    open: 'Vula',
    // ── People tab ────────────────────────────────────────────────────────────
    yourProfile: 'Iphrofayela Yakho',
    youBadge: 'Wena',
    noTeamMembers: 'Awukho amalungu elicinco. Mema bangani kuba bahlanganyele nenhlangano yakho.',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Imvula Yomnyaka',
    soilTexture: 'Isimo Somhlabatsi',
    frostRisk: 'Ingoti Yeqhwa',
    elevation: 'Ukuphakama',
    yourLand: 'Umhlabatsi Wakho',
    harvestingAreas: 'Tindzawo Tokukhumulisa',
    plantingCalendar: 'Ikhalenda Lokuhlanyela',
    grow: 'Khula',
    dry: 'Omile',
    frost: 'Qhwa',
    rest: 'Phumula',
  },

  nr: {
    // ── Onboarding ────────────────────────────────────────────────────────────
    tagline: 'Ukuhlakanipha kwe-Permaculture',
    welcomeTitle: 'Wamukelekile ku-ImbewuField',
    welcomeSub: 'Uhlelo lwe-permaculture oluhlakaniphile lomhlabathi weNingizimu Afrika.',
    pickLang: 'Khetha ulimi lwakho',
    pickLangSub: 'Ungalushintsha noma nini ngenhla.',
    start: 'Qala',
    heroSub: 'Thepha noma kuphi eNingizimu Afrika ukuthola uhlelo olugcwele lomhlabathi wakho.',
    clickAnalyse: 'Thepha imephu ukuze uhlole',
    dataSources: 'Imithombo yedatha',
    language: 'Ulimi',
    // ── DataPanel tabs ────────────────────────────────────────────────────────
    tabOverview: 'Ukubona',
    tabAsk: 'Buza',
    tabReports: 'Imibiko',
    tabPeople: 'Abantu',
    tabWater: 'Amanzi',
    tabSoil: 'Umhlabathi',
    tabClimate: 'Isimo',
    tabNature: 'Imvelo',
    tabArea: 'Indawo',
    tabPhotos: 'Izithombe',
    tabDesign: 'Uhlelo',
    tabAI: 'AI',
    tabPlaces: 'Izindawo',
    // ── Bottom tab bar ────────────────────────────────────────────────────────
    tabHome: 'Ekhaya',
    tabMap: 'Imephu',
    tabFinance: 'Imali',
    tabAccount: 'I-Akhawunti',
    // ── Map toolbar ───────────────────────────────────────────────────────────
    findYourLand: 'Thola umhlabathi wakho',
    parcelsWater: 'Izigaba namanzi',
    siteReport: 'Umbiko wendawo',
    goodFit: 'Kufanele kahle',
    // ── Reports tab ───────────────────────────────────────────────────────────
    generateFullReport: 'Yenza umbiko ophelele',
    savedReports: 'IMIBIKO ELONDOLOZIWE',
    reportsEmpty: 'Yenza umbiko ngenhla, bese uthinta Londoloza umbiko ngaphakathi ukuze ugcine lapha.',
    saveReport: 'Londoloza umbiko',
    open: 'Vula',
    // ── People tab ────────────────────────────────────────────────────────────
    yourProfile: 'Iphrofayela Yakho',
    youBadge: 'Wena',
    noTeamMembers: 'Awukho amalungu eqembu atholakele. Mema izinsakazo ukuba zihlanganyele nenhlangano yakho.',
    // ── Overview stats ────────────────────────────────────────────────────────
    annualRainfall: 'Imvula Yonyaka',
    soilTexture: 'Isimo Somhlabathi',
    frostRisk: 'Ingozi Yeqhwa',
    elevation: 'Ukuphakama',
    yourLand: 'Umhlabathi Wakho',
    harvestingAreas: 'Izindawo Zokuqoqa',
    plantingCalendar: 'Ikhalenda Lokuhlanyela',
    grow: 'Khula',
    dry: 'Omile',
    frost: 'Qhwa',
    rest: 'Phumula',
  },
};

// Look up a string in any language (used by onboarding to preview before committing)
export function translate(lang: string, key: string): string {
  return T[lang]?.[key] ?? T.en[key] ?? key;
}

interface LangCtx {
  lang: string;
  setLang: (code: string) => void;
  t: (key: string) => string;
  onboarded: boolean;
  completeOnboarding: (code: string) => void;
}

const Ctx = createContext<LangCtx>({
  lang: 'en', setLang: () => {}, t: (k) => k, onboarded: true, completeOnboarding: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState('en');
  const [onboarded, setOnboarded] = useState(true); // assume true until we check, avoids modal flash on SSR

  useEffect(() => {
    const saved = localStorage.getItem('permamap_lang');
    const done = localStorage.getItem('permamap_onboarded') === '1';
    if (saved) setLangState(saved);
    setOnboarded(done);
  }, []);

  const setLang = (code: string) => {
    setLangState(code);
    localStorage.setItem('permamap_lang', code);
  };
  const completeOnboarding = (code: string) => {
    setLang(code);
    localStorage.setItem('permamap_onboarded', '1');
    setOnboarded(true);
  };
  const t = (key: string) => T[lang]?.[key] ?? T.en[key] ?? key;

  return <Ctx.Provider value={{ lang, setLang, t, onboarded, completeOnboarding }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
