// Unreviewed isiZulu drafts for the weather card (components/WeatherWidget.tsx), keyed like
// WEATHER_ENGLISH_PENDING in lib/i18n-pending.ts. English is the source: the card shows each draft
// beside its English (IsiZuluDraftSource) and labels it unreviewed, and the keys are in the
// translator hand-off CSV. Rory has authorised labelled drafts before fluent review. Units and
// numbers are not translated.
import { WEATHER_ENGLISH_PENDING } from '@/lib/i18n-pending';
import { samePlaceholders } from '@/lib/records-regional-drafts';

export const WEATHER_ZU_DRAFTS: Record<string, string> = {
  weatherToday: 'Namuhla',
  weatherDaySun: 'Son',
  weatherDayMon: 'Mso',
  weatherDayTue: 'Bil',
  weatherDayWed: 'Tha',
  weatherDayThu: 'Sin',
  weatherDayFri: 'Hla',
  weatherDaySat: 'Mgq',
  weatherNoRain: 'Ayikho imvula',
  weatherFrostBanner: 'Kulindeleke isithwathwa: {days} — vikela izithombo',
  weatherHeatBanner: 'Isexwayiso sokushisa: {days} — nisela ekuseni kakhulu, umthunzi wezithombo',
  weatherHeavyRainBanner: 'Kulindeleke imvula enkulu: {days} — hlola ukuphuma kwamanzi, ulibazise ukutshala',
  weatherWaterLoss: 'Izitshalo ziyolahlekelwa amanzi angaba ngu-{mm}mm namuhla — nisela cishe lokho uma kungekho mvula',
  weatherDescClear: 'Kuyacaca',
  weatherDescPartlyCloudy: 'Amafu kancane',
  weatherDescOvercast: 'Kunamafu',
  weatherDescFog: 'Inkungu',
  weatherDescDrizzle: 'Imvula encane',
  weatherDescRain: 'Imvula',
  weatherDescSnow: 'Iqhwa',
  weatherDescShowers: 'Imvula yesikhashana',
  weatherDescSnowShowers: 'Iqhwa lesikhashana',
  weatherDescThunderstorm: 'Isivunguvungu nokuduma',
  weatherDescUnsettled: 'Isimo sezulu asizinzile',
};

const DAY_KEYS = ['weatherDaySun', 'weatherDayMon', 'weatherDayTue', 'weatherDayWed', 'weatherDayThu', 'weatherDayFri', 'weatherDaySat'];

const DESC_KEYS: Record<string, string> = {
  Clear: 'weatherDescClear',
  'Partly cloudy': 'weatherDescPartlyCloudy',
  Overcast: 'weatherDescOvercast',
  Fog: 'weatherDescFog',
  Drizzle: 'weatherDescDrizzle',
  Rain: 'weatherDescRain',
  Snow: 'weatherDescSnow',
  Showers: 'weatherDescShowers',
  'Snow showers': 'weatherDescSnowShowers',
  Thunderstorm: 'weatherDescThunderstorm',
  Unsettled: 'weatherDescUnsettled',
};

export function weatherDayKey(weekday: number, isToday: boolean): string {
  return isToday ? 'weatherToday' : DAY_KEYS[weekday];
}

/** The pending key for a describeWeatherCode() label, or null for a label it does not know. */
export function weatherDescKey(label: string): string | null {
  return DESC_KEYS[label] ?? null;
}

export function weatherEnglish(key: string): string {
  return WEATHER_ENGLISH_PENDING[key] ?? WEATHER_ERROR_COPY[key]?.english;
}

/** Existing isiZulu stays exact; a regional draft is valid only for its original source. */
export function weatherText(lang: string, key: string): string {
  const error = WEATHER_ERROR_COPY[key];
  if (error) return isWeatherDraftLanguage(lang) ? error[lang] : error.english;
  const english = WEATHER_ENGLISH_PENDING[key];
  if (lang === 'zu') return WEATHER_ZU_DRAFTS[key] || english;
  if (!isWeatherRegionalLanguage(lang)) return english;
  const row = WEATHER_REGIONAL_DRAFTS[key];
  return row?.english === english && samePlaceholders(english, row[lang]) ? row[lang] : english;
}

export function fillWeather(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

// Weather dates remain provider date identities. Full weekday words avoid introducing
// ambiguous new abbreviations for a farmer deciding when to protect seedlings.
export const WEATHER_REGIONAL_LANGUAGES = ['st', 'ts', 've'] as const;
export type WeatherRegionalLanguage = typeof WEATHER_REGIONAL_LANGUAGES[number];
export function isWeatherRegionalLanguage(lang: string): lang is WeatherRegionalLanguage {
  return (WEATHER_REGIONAL_LANGUAGES as readonly string[]).includes(lang);
}
export function isWeatherDraftLanguage(lang: string): lang is 'zu' | WeatherRegionalLanguage {
  return lang === 'zu' || isWeatherRegionalLanguage(lang);
}

export const WEATHER_REGIONAL_DRAFTS: Record<string, {english: string; st: string; ts: string; ve: string}> = {
  "weatherToday": {
    "english": "Today",
    "st": "Kajeno",
    "ts": "Namuntlha",
    "ve": "Ṋamusi"
  },
  "weatherDaySun": {
    "english": "Sun",
    "st": "Sontaha",
    "ts": "Sonto",
    "ve": "Swondaha"
  },
  "weatherDayMon": {
    "english": "Mon",
    "st": "Mantaha",
    "ts": "Musumbhunuku",
    "ve": "Musumbuluwo"
  },
  "weatherDayTue": {
    "english": "Tue",
    "st": "Labobedi",
    "ts": "Ravumbirhi",
    "ve": "Ḽavhuvhili"
  },
  "weatherDayWed": {
    "english": "Wed",
    "st": "Laboraro",
    "ts": "Ravunharhu",
    "ve": "Ḽavhuraru"
  },
  "weatherDayThu": {
    "english": "Thu",
    "st": "Labone",
    "ts": "Ravumune",
    "ve": "Ḽavhuṋa"
  },
  "weatherDayFri": {
    "english": "Fri",
    "st": "Labohlano",
    "ts": "Ravuntlhanu",
    "ve": "Ḽavhuṱanu"
  },
  "weatherDaySat": {
    "english": "Sat",
    "st": "Moqebelo",
    "ts": "Mugqivela",
    "ve": "Mugivhela"
  },
  "weatherNoRain": {
    "english": "No rain",
    "st": "Ha ho pula",
    "ts": "Ku hava mpfula",
    "ve": "A hu na mvula"
  },
  "weatherFrostBanner": {
    "english": "Frost expected {days} — protect seedlings",
    "st": "Ho lebeletswe serame se etsang leqhwa {days} — sireletsa dithopo",
    "ts": "Ku languteriwe gamboko (frost) {days} — sirhelela swimilana",
    "ve": "Hu lavhelelwa maḍaḓa {days} — tsireledzani zwimela zwiṱuku"
  },
  "weatherHeatBanner": {
    "english": "Heat warning {days} — water early morning, shade seedlings",
    "st": "Temoso ya mocheso {days} — nosetsa hoseng haholo, etsetsa dithopo moriti",
    "ts": "Xilemukiso xa ku hisa {days} — cheleta nimixo swinene, nyika swimilana ndzhuti",
    "ve": "Tsivhudzo ya mufhiso {days} — sheledzani nga matsheloni-tsheloni, itelani zwimela zwiṱuku murunzi"
  },
  "weatherHeavyRainBanner": {
    "english": "Heavy rain expected {days} — check drainage, delay planting",
    "st": "Ho lebeletswe pula e matla {days} — hlahloba ho tswa ha metsi, diehisa ho lema",
    "ts": "Ku languteriwe mpfula leyikulu {days} — kambela ku huma ka mati, hlwela ku byala",
    "ve": "Hu lavhelelwa mvula khulu {days} — ṱolani u bva ha maḓi, lengisani u ṱavha"
  },
  "weatherWaterLoss": {
    "english": "Crops will lose about {mm}mm of water today — water roughly that much if there's no rain",
    "st": "Dijalo di tla lahlehelwa ke metsi a ka bang {mm}mm kajeno — nosetsa hoo e ka bang palo eo ha ho se na pula",
    "ts": "Swibyariwa swi ta lahlekeriwa hi mati ya kwalomu ka {mm}mm namuntlha — cheleta kwalomu ka mpimo wolowo loko ku nga ri na mpfula",
    "ve": "Zwiliṅwa zwi ḓo xelelwa nga maḓi a ṱoḓaho u vha {mm}mm ṋamusi — sheledzani nga mpimo u ṱoḓaho u lingana na wonoyo arali hu si na mvula"
  },
  "weatherDescClear": {
    "english": "Clear",
    "st": "Lehodimo le hlakile",
    "ts": "Matilo ma basile",
    "ve": "Lutombo lu si na makole"
  },
  "weatherDescPartlyCloudy": {
    "english": "Partly cloudy",
    "st": "Ho na le maru dikarolong tse ding tsa lehodimo",
    "ts": "Ku ni mapapa eka swiphemu swin’wana swa matilo",
    "ve": "Lutombo lu na makole kha zwiṅwe zwipiḓa"
  },
  "weatherDescOvercast": {
    "english": "Overcast",
    "st": "Lehodimo le kwahetswe ke maru",
    "ts": "Matilo ma funengetiwe hi mapapa",
    "ve": "Lutombo lwo tibedzwa nga makole"
  },
  "weatherDescFog": {
    "english": "Fog",
    "st": "Mohodi",
    "ts": "Nkungu",
    "ve": "Khuli"
  },
  "weatherDescDrizzle": {
    "english": "Drizzle",
    "st": "Pula ya marothodi a manyenyane",
    "ts": "Mpfula ya mathonsi lamatsongo",
    "ve": "Mvula ya marotha maṱuku"
  },
  "weatherDescRain": {
    "english": "Rain",
    "st": "Pula",
    "ts": "Mpfula",
    "ve": "Mvula"
  },
  "weatherDescSnow": {
    "english": "Snow",
    "st": "Lehlwa",
    "ts": "Gamboko",
    "ve": "Mahaḓa"
  },
  "weatherDescShowers": {
    "english": "Showers",
    "st": "Dipula tsa nakwana",
    "ts": "Mpfula ya minkarhi yo koma",
    "ve": "Mvula dza zwifhinga zwiṱuku"
  },
  "weatherDescSnowShowers": {
    "english": "Snow showers",
    "st": "Lehlwa la nakwana",
    "ts": "Gamboko ya minkarhi yo koma",
    "ve": "Mahaḓa a zwifhinga zwiṱuku"
  },
  "weatherDescThunderstorm": {
    "english": "Thunderstorm",
    "st": "Sefefo sa pula e nang le diaduma",
    "ts": "Xidzedze xa mpfula leyi dzindzaka",
    "ve": "Dumbu ḽa mvula na mithathabo"
  },
  "weatherDescUnsettled": {
    "english": "Unsettled",
    "st": "Boemo ba lehodimo ha bo a tsitsa",
    "ts": "Maxelo a ma tshamisekanga",
    "ve": "Mutsho a wo dzika"
  }
};

export const WEATHER_ERROR_COPY: Record<string, {english: string; zu: string; st: string; ts: string; ve: string}> = {
  "weatherErrorHome": {
    "english": "Weather is not available right now.",
    "zu": "Isimo sezulu asitholakali okwamanje.",
    "st": "Boemo ba lehodimo ha bo fumanehe hona jwale.",
    "ts": "Maxelo a ma kumeki sweswi.",
    "ve": "Mutsho a u wanali zwino."
  },
  "weatherErrorReport": {
    "english": "Weather unavailable right now — showing site climate data below instead.",
    "zu": "Isimo sezulu asitholakali okwamanje — imininingwane yesimo sezulu yendawo iboniswa ngezansi.",
    "st": "Boemo ba lehodimo ha bo fumanehe hona jwale — ho bontshwa dintlha tsa tlelaemete ya sebaka ka tlase ho e-na le tsona.",
    "ts": "Maxelo a ma kumeki sweswi — ku kombisiwa rungula ra maxelo ya nkarhi wo leha ya ndhawu laha hansi ematshan’weni ya rona.",
    "ve": "Mutsho a u wanali zwino — hu khou sumbedzwa mafhungo a kilima ya fhethu afho fhasi vhudzuloni hazwo."
  }
};

const WEATHER_DRAFT_NOTICES: Record<string, string> = {
  "en": "Unreviewed translation draft.",
  "zu": "Unreviewed isiZulu draft.",
  "st": "Moralo wa phetolelo o so hlahlojwe.",
  "ts": "Mpfapfarhuto wa vuhundzuluxeri lowu nga si kamberiwaka.",
  "ve": "Mvetamveto ya ṱhalutshedzelo i sa athu u sedzuluswa."
};
export function weatherDraftNotice(lang: string): string {
  return WEATHER_DRAFT_NOTICES[lang] ?? WEATHER_DRAFT_NOTICES.en;
}
