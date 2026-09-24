import { PRODUCT_TOUR, PRODUCT_TOUR_FEATURES, type ProductTourStep, type TourFeature } from './sample-tour';

type TourId = (typeof PRODUCT_TOUR)[number]['id'];
type TourFeatureId = keyof typeof PRODUCT_TOUR_FEATURES;

interface LocalizedTourStep {
  title: string;
  task: string;
  secondaryLabel?: string;
}

interface LocalizedTourFeature {
  title: string;
  text: string;
}

/** Unreviewed isiZulu proposals for the sample tour; ids and destinations stay owned by sample-tour.ts. */
export const PRODUCT_TOUR_ZU: Record<TourId, LocalizedTourStep> = {
  garden: {
    title: 'Qala ngengadi',
    task: 'Buka izithombe zengadi, izinhlelo zayo namaphrofayela abalimi. Izindawo ezilandelayo zilandela ipulazi elilodwa ongakwazi ukulihlela.',
    secondaryLabel: 'Vula ingadi ebalazweni',
  },
  planning: {
    title: 'Hlela isizini yokutshala',
    task: 'Qala kokuthi Ukutshala ku-Design Studio. Khetha umbhede noma isihlahla, usisuse kwenye indawo bese uzama ukuhlehlisa. Bese uvula uhlelo lwezitshalo ukuze uqhathanise imibhede yemifino, iziza zezitshalo eziyisisekelo nezinyanga zokutshala.',
    secondaryLabel: 'Vula uhlelo lwezitshalo',
  },
  learning: {
    title: 'Funda futhi uthole isiqondiso',
    task: 'Vula okuthi Imbewu Nobukhosi Bembewu, uzame isifundo, isilayidi esilandiswa ngezwi noma imibuzo. Bese uvula okuthi Buza uLima, ubuyekeze isithombe senkinga bese uthinta umbuzo wokulandelela.',
    secondaryLabel: 'Hlola okuthi Buza uLima',
  },
  business: {
    title: 'Rekhoda umsebenzi nokuthengisa',
    task: 'Qhathanisa okuvunyiwe, ukuthengisa nezindleko kokuthi Amashadi. Vula ama-invoyisi, khetha Okulondoloziwe bese uvula i-invoyisi ekhona ukuze uthole okuthi Yabelana nge-PDF nokuthi Phrinta. Bona indlela umlimi agcina ngayo irekhodi ledijithali; awudingi ukuthumela lutho kumthengi.',
    secondaryLabel: 'Hlola i-invoyisi',
  },
  mentor: {
    title: 'Sekela iqembu labalimi',
    task: 'Qala kokuthi Umsebenzi wasensimini ukuze ubuyekeze imisebenzi okufanele yenziwe, izingadi owabelwe zona nabalimi. Rekhoda ukuvakashela, uhlole ikhono elisebenzayo bese nivumelana ngesinyathelo esilandelayo. Sebenzisa Ukuqeqesha ukuze urekhode ukuba khona nempendulo, Ukufunda ukuze ubuke amamojula, nemilayezo ukuze nilandelele.',
  },
  organisation: {
    title: 'Landela lonke uhlelo',
    task: 'Vula okuthi Ukuqeqeshwa nenqubekelaphambili, bese uvula irejista yokuqeqeshwa. Bheka amasiginesha okuba khona, izitifiketi, imephu yendawo, izithombe nohlu lwemibuzo olufushane lwempendulo. Vula Imibiko ukuze uqhathanise imiphumela yohlelo.',
  },
  funder: {
    title: 'Buka inqubekelaphambili njengomxhasi',
    task: 'Bheka izibalo namashadi eqembu, bese ukhetha Inqubekelaphambili nezinyathelo ezibalulekile. Qhathanisa inqubekelaphambili erekhodiwe nemigomo, bese uvula ukuhlolwa noma imibiko eyabiwe.',
  },
  report: {
    title: 'Yenza umbiko ngobufakazi bendawo',
    task: 'Khetha okuthi Landa umbiko wobufakazi ukuze uthole i-PDF enophawu lohlelo, ukuhlolwa kwendawo, amanothi okuvakasha, izithombe nemiphumela yomhlabathi. Bese uhlola Amasayithi nemibiko egciniwe: khetha isayithi ukuze ubone ukuthi yiziphi izithombe, izivivinyo, izimpendulo zohlolo nomsebenzi wokuklama okungathuthukisa umbiko walo ophelele.',
    secondaryLabel: 'Hlola amasayithi nemibiko egciniwe',
  },
  next: {
    title: 'Lungisela uhlelo lwakho',
    task: 'Khetha okuthi Cela isici ukuze ubone indlela yokuchaza ushintsho olungasiza uhlelo lwakho. Hlola ifomu kuphela: ukulithumela kuthinta umthuthukisi wangempela. Vumelanani ndawonye ngobubanzi bomsebenzi nezindleko zokwenza uhlelo lufaneleke.',
  },
};

/** Each tip follows the same index as the English source so the learner sees matching guidance. */
export const PRODUCT_TOUR_FEATURES_ZU: Record<TourFeatureId, readonly LocalizedTourFeature[]> = {
  garden: [
    { title: 'Khetha ingadi', text: 'Vula ikhadi lengadi ukuze ubone umlimi wayo, izithombe nezindawo zokutshala. Sebenzisa imephu ukuze ubone ukuthi ikuphi.' },
    { title: 'Landela ipulazi elifanayo', text: 'Izindawo ezilandelayo zixhumanisa ukwakheka kwengadi nezifundo zayo, okuvunyiwe, ukuthengisa nemibiko yohlelo.' },
  ],
  planning: [
    { title: 'Bona umhlaba ongaphansi kohlelo lwakho', text: 'Isinyathelo esithi Isisekelo sigcina isithombe sesayithi. Kokuthi Glossy, sebenzisa okuthi Isendlalelo esingaphansi ukuze ushintshe phakathi kwesithombe sakho, isithombe sesathelayithi nephepha elingenalutho.' },
    { title: 'Susa into kwenye indawo bese uhlehlisa', text: 'Khetha isihlahla noma umbhede bese uwuhudula. Ukuhlehlisa kubuyisela indawo yawo yangaphambilini. Iphaneli ethi Izendlalelo ilawula ukuthi yiziphi izinto ongazikhetha uzisuse.' },
    { title: 'Beka indawo yokungena', text: 'Khetha Isango kokuthi Izakhiwo. Hudula isibambo salo esiluhlaza ukuze ulibeke; isibambo esisagolide esisekugcineni sishintsha ubude balo. Imephu ephelile ikhombisa isango livuliwe futhi lishiya indawo yokungena ocingweni.' },
    { title: 'Yenza Imephu Yokuklama ephelile', text: 'Vula i-Glossy, khetha ishidi nesendlalelo salo esingaphansi, bese wenza Imephu Yokuklama. Hlola umphumela esikrinini esigcwele bese usebenzisa okuthi Thumela futhi Yabelana kumashidi owakhethile.' },
  ],
  learning: [
    { title: 'Izifundo zakho ziqala lapha', text: 'Sebenzisa okuthi Qala ukufunda noma Qhubeka nokufunda ukuze uvule imojuli yakho elandelayo. Amakhadi anezithombe akhombisa izihloko nenqubekelaphambili yakho.' },
    { title: 'Vula isifundo esinezithombe', text: 'Vula okuthi Imbewu Nobukhosi Bembewu ukuze uzame imojuli ephelile. Khetha isithombe noma isihloko sesifundo ukuze ufunde, ulalele, ubuke izilayidi uphendule imibuzo.' },
    { title: 'Hamba nesifundo ekhaya', text: 'Vula okuthi Funda ungaxhunyiwe ku-inthanethi usenophawu lwenethiwekhi. Khetha ikhwalithi yokulanda bese ugcina isifundo noma imojuli eyodwa kule foni.' },
  ],
  business: [
    { title: 'Amakhasi amane ebhukwini lepulazi', text: 'Okukhethiwe kurekhoda isivuno; Okuthengisiwe kurekhoda ukuthengisa; Okusetshenzisiwe kugcina izindleko; Amashadi ahlanganisa izibalo. Shintsha amathebhu ukuze ulandele umsebenzi kusukela esitshalweni kuye emalini.' },
    { title: 'Gcina amaphepha ndawonye', text: 'Vula i-invoyisi, bese uvula Okulondoloziwe ukuze uhlole idokhumenti. Kokuthi Okusetshenzisiwe, vula irisidi ukuze ubone imininingwane yokuthenga ehambisana nezindleko.' },
    { title: 'Bona isifinyezo esiwusizo', text: 'Kokuthi Okukhethiwe, vula Imibiko yomabolekisi ukuze ubuke umlando wesivuno, wemali engenayo nowezindleko bese uthumela isifinyezo.' },
  ],
  mentor: [
    { title: 'Qala ngezinto ezibalulekile engadini', text: 'Umsebenzi wasensimini uvula imisebenzi okufanele yenziwe, ukumbozwa kwabahlanganyeli nomhlahlandlela wokuvakasha wokuhlola ukutholakala kokudla. Vula Abantu nezingadi ukuze uqale ukuvakasha kukhethwe umhlanganyeli ofanele.' },
    { title: 'Landela ukufunda nokuvakasha', text: 'Sebenzisa Ukufunda ukuze ubuke inqubekelaphambili yamamojuli, nokuQeqesha ukuze ubuke ukuba khona, izitifiketi nempendulo. Ekuvakasheni kwasensimini, rekhoda ikhono olibone nesinyathelo esilandelayo, umuntu ozosenza nosuku.' },
  ],
  organisation: [
    { title: 'Bona uhlelo lonke ndawonye', text: 'Qhathanisa amaqembu, izingadi nomsebenzi orekhodiwe. Vula Ukuhlolwa ukuze ubuyekeze izigaba zohlolo nezimpendulo.' },
    { title: 'Landela inqubekelaphambili iye emibikweni', text: 'Ukuqeqeshwa nenqubekelaphambili kuhlanganisa ubufakazi bokuqeqeshwa nobomsebenzi. Imibiko ilungiselela irekhodi lohlelo ukuze libuyekezwe futhi kwabelwane ngalo.' },
  ],
  funder: [
    { title: 'Bheka okungaphezu kokuba khona', text: 'Hlola izibalo namashadi eqembu, bese uvula Inqubekelaphambili nezinyathelo ezibalulekile ukuze ubone irekhodi lohlelo olubanzi.' },
    { title: 'Hlola ubufakazi', text: 'Vula ukuhlolwa nemibiko eyabiwe ukuze ubone amarekhodi asekelayo izibalo nomsebenzi okusamele wenziwe.' },
  ],
  report: [
    { title: 'Qala ngesayithi eligciniwe', text: 'Amasayithi nemibiko egciniwe ixhumanisa isayithi ngalinye nemibiko yalo. Khetha isayithi ukuze wenze umbiko ngolwazi lwalo lwamanje.' },
    { title: 'Thuthukisa umbiko olandelayo', text: 'Bheka uhlu lwesayithi lwezithombe, izivivinyo zomhlabathi nezamanzi, izimpendulo zohlolo nomsebenzi wokuklama. Landa umbiko wobufakazi ukuze ubone idokhumenti ephelile.' },
  ],
  next: [
    { title: 'Sitshele ukuthi uhlelo lwakho ludingani', text: 'Khetha okuthi Cela isici ukuze uchaze ushintsho nekhasi lohlelo oluthintekayo. Landa ikhophi yohlaka lwakho, noma ungene ngemvume ukuze uluthumele kumthuthukisi.' },
  ],
};

export function productTourStepCopy(step: ProductTourStep, language: string): LocalizedTourStep {
  if (language !== 'zu') return step;
  return PRODUCT_TOUR_ZU[step.id as TourId] ?? step;
}

export function productTourFeatureCopy(
  id: string,
  index: number,
  language: string,
  fallback: TourFeature | undefined,
): TourFeature | undefined {
  if (language !== 'zu') return fallback;
  const translated = PRODUCT_TOUR_FEATURES_ZU[id as TourFeatureId]?.[index];
  return translated ?? fallback;
}

type TourUiKey = 'tour' | 'close' | 'tip' | 'aboutMinutes' | 'tipAria' | 'nextTip' | 'tryNow' | 'openView' | 'hint' | 'exploredNext' | 'skip' | 'previous' | 'overview' | 'end' | 'stopAria' | 'buttonAria' | 'continue' | 'tryAgain' | 'start' | 'loading' | 'browseGardens' | 'unavailable' | 'opening' | 'gettingReady' | 'draftDisclosure';

const UI_ZU: Record<TourUiKey, string> = {
  tour: 'Uhambo', close: 'Vala umhlahlandlela wohambo', tip: 'Ithiphu', aboutMinutes: 'Cishe {duration}',
  tipAria: 'Ithiphu {current} kwezingu-{total}: {title}', nextTip: 'Ithiphu elilandelayo', tryNow: 'Kuzame manje',
  openView: 'Vula lesi sikrini', hint: 'Thinta Uhambo eduze kwemenyu ukuze ubuye kulawa macebiso.',
  exploredNext: 'Sengikuhlolile · Okulandelayo', skip: 'Yeqa lesi sigaba', previous: 'Isigaba esedlule',
  overview: 'Ukubuka konke kohambo', end: 'Qeda uhambo', stopAria: 'Vula isigaba {current}: {title}',
  buttonAria: 'Umhlahlandlela wohambo, isigaba {current} kwezingu-{total}', continue: 'Qhubeka nohambo · isigaba {current}',
  tryAgain: 'Zama uhambo futhi', start: 'Qala uhambo lwemizuzu engu-15', loading: 'Kulungiselelwa uhambo…',
  browseGardens: 'Buka izingadi', unavailable: 'Ayitholakali kule akhawunti', opening: 'Kuyavulwa…',
  gettingReady: 'Kuyalungiswa…', draftDisclosure: 'Uhlaka lwesiZulu olungakabuyekezwa: izihloko, imisebenzi namacebiso kuhunyushwe ngokuhambisana nombhalo wesiNgisi. Kudinga ukubuyekezwa umuntu okhuluma isiZulu kahle futhi owazi ukusetshenziswa kwalolu hlelo.',
};

export function productTourUi(key: TourUiKey, language: string, values: Record<string, string | number> = {}): string | undefined {
  if (language !== 'zu') return undefined;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), UI_ZU[key]);
}

export function productTourError(message: string, language: string): string {
  if (language !== 'zu') return message;
  const known: Record<string, string> = {
    'Your browser could not save tour progress. You can still explore the views.': 'Isiphequluli asikwazanga ukugcina inqubekelaphambili yohambo. Usengaqhubeka nokuhlola izikrini.',
    'The view could not open. Please try again.': 'Isikrini asikwazanga ukuvuleka. Sicela uzame futhi.',
    'Could not start the tour. Please allow session storage.': 'Uhambo alukwazanga ukuqala. Vumela ukugcinwa kwedatha kweseshini.',
    'The example farm could not load. Please try again.': 'Ipulazi lesibonelo alikwazanga ukuvuleka. Sicela uzame futhi.',
    'The next view could not open.': 'Isikrini esilandelayo asikwazanga ukuvuleka.',
  };
  return known[message] ?? message;
}

export function productTourLocalizationIsComplete(): boolean {
  return PRODUCT_TOUR.every(step => {
    const copy = PRODUCT_TOUR_ZU[step.id as TourId];
    const features = PRODUCT_TOUR_FEATURES[step.id] ?? [];
    const translatedFeatures = PRODUCT_TOUR_FEATURES_ZU[step.id as TourFeatureId] ?? [];
    return Boolean(copy?.title.trim() && copy.task.trim()) &&
      Boolean(step.secondaryLabel === undefined || copy.secondaryLabel?.trim()) &&
      features.length === translatedFeatures.length && translatedFeatures.every(feature => feature.title.trim() && feature.text.trim());
  });
}
