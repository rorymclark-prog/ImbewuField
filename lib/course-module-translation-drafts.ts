import type { CourseModule } from './course-modules';

/** Source-paired learner card copy. These isiZulu strings are drafts pending language and local farming review. */
export const COURSE_MODULE_TRANSLATION_DRAFTS = {
  'intro-permaculture': {
    sourceTitle: 'Introduction to Permaculture',
    sourceDescription: 'Ethics, principles and patterns — the foundation for everything else you will build.',
    title: 'Isingeniso se-Permaculture',
    description: 'Funda izimiso zokuziphatha, izimiso zokuklama namaphethini azokusiza ukuhlela ipulazi lakho.',
  },
  'reading-landscape': {
    sourceTitle: 'Reading the Landscape',
    sourceDescription: 'Identify water flow, sun angles, wind patterns and topography on your site.',
    title: 'Ukufunda Indawo',
    description: 'Bheka indlela amanzi ahamba ngayo, ukukhanya kwelanga, imimoya nokuma komhlaba endaweni yakho.',
  },
  'water-harvesting': {
    sourceTitle: 'Water Harvesting',
    sourceDescription: 'Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop.',
    title: 'Ukuvunwa Kwamanzi',
    description: 'Funda ngezindlela zokubamba nokusebenzisa amanzi: ama-swale, ama-berm, amadamu, amathangi emvula namanzi ampunga. Khetha indlela efanele indawo yakho.',
  },
  'soil-health': {
    sourceTitle: 'Soil Health & Composting',
    sourceDescription: 'Build living soil with compost, mulch, cover crops and worm farms.',
    title: 'Impilo Yomhlabathi Ne-Compost',
    description: 'Funda ngomhlabathi, wenze i-compost, usebenzise i-mulch nezitshalo zokumboza umhlabathi, futhi unakekele amapulazi ezikelemu.',
  },
  'vegetables-staples': {
    sourceTitle: 'Vegetables and Staple Crops',
    sourceDescription: 'Bed prep, succession planting, staple crops and pest management — the daily work of growing food.',
    title: 'Imifino Nezitshalo Eziyisisekelo',
    description: 'Lungisa imibhede, hlela ukutshala okulandelanayo, khulisa izitshalo eziyisisekelo futhi ulawule izinambuzane ngokubheka imbangela.',
  },
  'seeds-sovereignty': {
    sourceTitle: 'Seeds and Seed Sovereignty',
    sourceDescription: 'Save, store and share seed — freedom from buying seed every season.',
    title: 'Imbewu Nobukhosi Bembewu',
    description: 'Funda ukugcina, ukomisa nokwabelana ngembewu ukuze ube nokukhetha nokuzimela ekutholeni imbewu.',
  },
  'plant-guilds': {
    sourceTitle: 'Plant Selection & Guilds',
    sourceDescription: 'Choose useful plant partners, return mulch and manage the guild as trees grow.',
    title: 'Ukukhetha Izitshalo Nama-Guilds',
    description: 'Khetha izitshalo ezisebenzisanayo, buyisela izinsalela ezifanele emhlabathini njenge-mulch, futhi ulungise i-guild njengoba izihlahla zikhula.',
  },
  'food-forest': {
    sourceTitle: 'Food Forest Design',
    sourceDescription: 'Layer a multi-storey food system from tall canopy right down to root crops.',
    title: 'Ukuklama I-Food Forest',
    description: 'Hlela izitshalo zokudla ngamazinga ahlukene, kusukela ezihlahleni ezinde kuya ezitshalweni ezikhula ngaphansi komhlabathi.',
  },
  'small-livestock': {
    sourceTitle: 'Small Livestock Integration',
    sourceDescription: 'Chickens, ducks and bees as system components — not afterthoughts.',
    title: 'Ukuhlanganiswa Kwemfuyo Encane',
    description: 'Bheka ukuthi izinkukhu, amadada nezinyosi zingaba kanjani izingxenye zohlelo lwepulazi, ngokuhambisana nezidingo nokunakekelwa kwazo.',
  },
  'market-community': {
    sourceTitle: 'Market Gardening & Community',
    sourceDescription: 'Record-keeping, selling surplus and building local food networks.',
    title: 'Ingadi Yezimakethe Nomphakathi',
    description: 'Gcina amarekhodi omkhiqizo, uthengise okusele ngemva kwezidingo zasekhaya, futhi wakhe amanethiwekhi okudla asendaweni.',
  },
} as const;

export type CourseModuleTranslationDraftId = keyof typeof COURSE_MODULE_TRANSLATION_DRAFTS;

export interface CourseModulePresentation {
  title: string;
  description: string;
  status: 'draft' | 'english-fallback';
}

/** Use a draft only while its English source pair still matches the canonical module record. */
export function resolveCourseModulePresentation(module: CourseModule, language: string): CourseModulePresentation {
  if (language === 'zu') {
    const draft = COURSE_MODULE_TRANSLATION_DRAFTS[module.id as CourseModuleTranslationDraftId];
    if (draft && module.title === draft.sourceTitle && module.description === draft.sourceDescription) {
      return { title: draft.title, description: draft.description, status: 'draft' };
    }
  }
  return { title: module.title, description: module.description, status: 'english-fallback' };
}
