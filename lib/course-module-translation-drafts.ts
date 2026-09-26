import type { CourseModule } from './course-modules';
import { SESOTHO_INTRO_PERMACULTURE_DRAFT } from './course-translation-drafts-st.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from './course-translation-drafts-st-reading-landscape.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from './course-translation-drafts-st-water-harvesting.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from './course-translation-drafts-st-soil-health.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from './course-translation-drafts-st-vegetables-staples.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from './course-translation-drafts-st-food-forest.ts';
import { SESOTHO_PLANT_GUILDS_DRAFT } from './course-translation-drafts-st-plant-guilds.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from './course-translation-drafts-st-market-community.ts';
import { SESOTHO_SMALL_LIVESTOCK_DRAFT } from './course-translation-drafts-st-small-livestock.ts';
import { SESOTHO_SEEDS_SOVEREIGNTY_DRAFT } from './course-translation-drafts-st-seeds-sovereignty.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT, XITSONGA_READING_LANDSCAPE_DRAFT } from './course-translation-drafts-ts.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from './course-translation-drafts-ve.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from './course-translation-drafts-ve-reading-landscape.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from './course-translation-drafts-ve-water-harvesting.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from './course-translation-drafts-ve-food-forest.ts';
import { TSHIVENDA_SMALL_LIVESTOCK_DRAFT } from './course-translation-drafts-ve-small-livestock.ts';

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
    description: 'Funda ngezindlela zokubamba nokusebenzisa amanzi: ama-swale, ama-berm, amadamu, amathangi emvula namanzi asetshenzisiwe (greywater). Khetha indlela efanele indawo yakho.',
  },
  'soil-health': {
    sourceTitle: 'Soil Health & Composting',
    sourceDescription: 'Build living soil with compost, mulch, cover crops and worm farms.',
    title: 'Impilo Yomhlabathi Ne-Compost',
    description: 'Funda ngomhlabathi, wenze i-compost, usebenzise i-mulch nezitshalo zokumboza umhlabathi, futhi unakekele amapulazi emisundu.',
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

const REGIONAL_MODULE_DRAFTS = {
  st: [SESOTHO_INTRO_PERMACULTURE_DRAFT, SESOTHO_READING_LANDSCAPE_DRAFT, SESOTHO_WATER_HARVESTING_DRAFT, SESOTHO_SOIL_HEALTH_DRAFT, SESOTHO_VEGETABLES_STAPLES_DRAFT, SESOTHO_FOOD_FOREST_DRAFT, SESOTHO_PLANT_GUILDS_DRAFT, SESOTHO_MARKET_COMMUNITY_DRAFT, SESOTHO_SMALL_LIVESTOCK_DRAFT, SESOTHO_SEEDS_SOVEREIGNTY_DRAFT],
  ts: [XITSONGA_INTRO_PERMACULTURE_DRAFT, XITSONGA_READING_LANDSCAPE_DRAFT],
  ve: [TSHIVENDA_INTRO_PERMACULTURE_DRAFT, TSHIVENDA_READING_LANDSCAPE_DRAFT, TSHIVENDA_WATER_HARVESTING_DRAFT, TSHIVENDA_FOOD_FOREST_DRAFT, TSHIVENDA_SMALL_LIVESTOCK_DRAFT],
};

/** Use a draft only while its English source pair still matches the canonical module record. */
export function resolveCourseModulePresentation(module: CourseModule, language: string): CourseModulePresentation {
  if (language === 'zu') {
    const draft = COURSE_MODULE_TRANSLATION_DRAFTS[module.id as CourseModuleTranslationDraftId];
    if (draft && module.title === draft.sourceTitle && module.description === draft.sourceDescription) {
      return { title: draft.title, description: draft.description, status: 'draft' };
    }
  }
  if (language === 'st' || language === 'ts' || language === 've') {
    const draft = REGIONAL_MODULE_DRAFTS[language].find(candidate => candidate.id === module.id);
    if (draft && module.title === draft.title.sourceEnglish &&
      module.description === draft.description.sourceEnglish &&
      module.durationMins === draft.sourceMetadata.durationMins &&
      module.category === draft.sourceMetadata.category) {
      const moduleDraft = draft as typeof SESOTHO_INTRO_PERMACULTURE_DRAFT |
        typeof SESOTHO_FOOD_FOREST_DRAFT | typeof SESOTHO_PLANT_GUILDS_DRAFT | typeof SESOTHO_MARKET_COMMUNITY_DRAFT | typeof SESOTHO_SMALL_LIVESTOCK_DRAFT | typeof SESOTHO_SEEDS_SOVEREIGNTY_DRAFT | typeof XITSONGA_INTRO_PERMACULTURE_DRAFT |
        typeof TSHIVENDA_INTRO_PERMACULTURE_DRAFT | typeof TSHIVENDA_READING_LANDSCAPE_DRAFT |
        typeof TSHIVENDA_WATER_HARVESTING_DRAFT | typeof TSHIVENDA_FOOD_FOREST_DRAFT |
        typeof TSHIVENDA_SMALL_LIVESTOCK_DRAFT;
      const title = moduleDraft.title.reviewStatus === 'hold' ? module.title : language === 'st' ? (moduleDraft as typeof SESOTHO_INTRO_PERMACULTURE_DRAFT).title.sesothoDraft :
        language === 'ts' ? (moduleDraft as typeof XITSONGA_INTRO_PERMACULTURE_DRAFT).title.xitsongaDraft :
          (moduleDraft as typeof TSHIVENDA_INTRO_PERMACULTURE_DRAFT | typeof TSHIVENDA_READING_LANDSCAPE_DRAFT | typeof TSHIVENDA_WATER_HARVESTING_DRAFT | typeof TSHIVENDA_FOOD_FOREST_DRAFT | typeof TSHIVENDA_SMALL_LIVESTOCK_DRAFT).title.tshivendaDraft;
      const description = moduleDraft.description.reviewStatus === 'hold' ? module.description : language === 'st' ? (moduleDraft as typeof SESOTHO_INTRO_PERMACULTURE_DRAFT).description.sesothoDraft :
        language === 'ts' ? (moduleDraft as typeof XITSONGA_INTRO_PERMACULTURE_DRAFT).description.xitsongaDraft :
          (moduleDraft as typeof TSHIVENDA_INTRO_PERMACULTURE_DRAFT | typeof TSHIVENDA_READING_LANDSCAPE_DRAFT | typeof TSHIVENDA_WATER_HARVESTING_DRAFT | typeof TSHIVENDA_FOOD_FOREST_DRAFT | typeof TSHIVENDA_SMALL_LIVESTOCK_DRAFT).description.tshivendaDraft;
      const heldSesothoSeedsCard = language === 'st' && draft.id === 'seeds-sovereignty' &&
        moduleDraft.title.reviewStatus === 'hold' && moduleDraft.description.reviewStatus === 'hold';
      const status = heldSesothoSeedsCard ? 'english-fallback' : 'draft';
      return { title, description, status };
    }
  }
  return { title: module.title, description: module.description, status: 'english-fallback' };
}
