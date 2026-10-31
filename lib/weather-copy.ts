// Unreviewed isiZulu drafts for the weather card (components/WeatherWidget.tsx), keyed like
// WEATHER_ENGLISH_PENDING in lib/i18n-pending.ts. English is the source: the card shows each draft
// beside its English (IsiZuluDraftSource) and labels it unreviewed, and the keys are in the
// translator hand-off CSV. Rory has authorised labelled drafts before fluent review. Units and
// numbers are not translated.
import { WEATHER_ENGLISH_PENDING } from '@/lib/i18n-pending';

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

// Unreviewed isiXhosa machine drafts, same keys (PR #1090). A table of its own rather than the
// English-keyed lib/locales/xh-inline/ lookup, because short words like "Clear" already have a
// different meaning there (the Clear button).
export const WEATHER_XH_DRAFTS: Record<string, string> = {
  weatherToday: 'Namhlanje',
  weatherDaySun: 'Caw',
  weatherDayMon: 'Mvu',
  weatherDayTue: 'Bin',
  weatherDayWed: 'Tha',
  weatherDayThu: 'Sin',
  weatherDayFri: 'Hla',
  weatherDaySat: 'Mgq',
  weatherNoRain: 'Akukho mvula',
  weatherFrostBanner: 'Kulindeleke iqabaka: {days} — khusela izithole zezityalo',
  weatherHeatBanner: 'Isilumkiso sobushushu: {days} — nkcenkceshela kusasa kakhulu, uthunzele izithole zezityalo',
  weatherHeavyRainBanner: 'Kulindeleke imvula enkulu: {days} — jonga ukuphuma kwamanzi, ulibazise ukutyala',
  weatherWaterLoss: 'Izityalo ziza kuphulukana namanzi amalunga no-{mm}mm namhlanje — nkcenkceshela malunga nalo mlinganiselo ukuba akukho mvula',
  weatherDescClear: 'Kucwengile',
  weatherDescPartlyCloudy: 'Kunamafu kancinci',
  weatherDescOvercast: 'Kuguqubele',
  weatherDescFog: 'Inkungu',
  weatherDescDrizzle: 'Imvula encinci',
  weatherDescRain: 'Imvula',
  weatherDescSnow: 'Ikhephu',
  weatherDescShowers: 'Imvula yexeshana',
  weatherDescSnowShowers: 'Ikhephu lexeshana',
  weatherDescThunderstorm: 'Isaqhwithi neendudumo',
  weatherDescUnsettled: 'Imozulu engazinzanga',
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
  return WEATHER_ENGLISH_PENDING[key];
}

/** The isiZulu (or isiXhosa) draft for `key` in that language, else the English. */
export function weatherText(lang: string, key: string): string {
  return (lang === 'zu' && WEATHER_ZU_DRAFTS[key]) || (lang === 'xh' && WEATHER_XH_DRAFTS[key]) || WEATHER_ENGLISH_PENDING[key];
}

export function fillWeather(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
