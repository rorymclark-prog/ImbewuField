import { MANUAL_LANGS, MANUAL_LANG_NAMES, type ManualLang } from './manual';

// The longer localised readings hold a settled picture. Each pair lists the final
// picture and edition frames for a cue, so a language change can keep the same action.
export type FieldFilm = 'harvest' | 'level' | 'walk' | 'earth' | 'drip' | 'roof' | 'bottle' | 'jar' | 'shadow'
  | 'zones' | 'windbreak' | 'tree' | 'mulch' | 'succession' | 'rotation';
export const FILM_LANGUAGES = MANUAL_LANGS;
export const FILM_LANGUAGE_NAMES = MANUAL_LANG_NAMES;
export type FilmLanguage = ManualLang;

const localisedFilmTitles = {
  en: {
    level: 'Check the A-frame', walk: 'Peg a contour', drip: 'From the tank to the roots',
    roof: 'From the roof to the tank', bottle: 'Water the roots with a bottle',
    jar: 'The soil jar test', shadow: 'How the shadow changes with the seasons',
    zones: 'Plan a farm by visits', windbreak: 'Plan a windbreak',
    tree: 'Plant a tree at the right depth', mulch: 'Mulch a garden bed',
    succession: 'Watch bare ground recover', rotation: 'Move crop families between beds',
  },
  zu: {
    level: 'Hlola i-A-frame', walk: 'Bethela i-contour ngezikhonkwane', drip: 'Ukusuka ethangini kuya ezimpandeni',
    roof: 'Ukusuka ophahleni kuya ethangini', bottle: 'Nisela izimpande ngebhodlela',
    jar: 'Ukuhlola umhlabathi ngembiza', shadow: 'Indlela umthunzi oshintsha ngayo ngezinkathi',
    zones: 'Hlela ipulazi ngokuvakashela izindawo', windbreak: 'Hlela isivimbamoya',
    tree: 'Tshala isihlahla ekujuleni okufanele', mulch: 'Mboza umbhede nge-mulch',
    succession: 'Buka umhlabathi ongenalutho uvuseleleka', rotation: 'Shintshanisa imindeni yezitshalo emibhedeni',
  },
  st: {
    level: 'Hlahloba A-frame', walk: 'Tshwaya contour ka dithupana', drip: 'Ho tloha tankeng ho ya metsong',
    roof: 'Ho tloha marulelong ho ya tankeng', bottle: 'Nosetsa metso ka botlolo',
    jar: 'Teko ya mobu ka nkgo', shadow: 'Kamoo moriti o fetohang ka dinako tsa selemo',
    zones: 'Rala di-zone ka makgetlo a ketelo', windbreak: 'Rala thibelo ya moya',
    tree: 'Lema sefate botebong bo loketseng', mulch: 'Kwahela bethe ya serapa ka mulch',
    succession: 'Shebella mobu o feela o fola', rotation: 'Fapanyetsana malapa a dijalo dibetheng',
  },
  ve: {
    level: 'Ṱolani A-frame', walk: 'Swayani contour nga zwiṱanda', drip: 'U bva thanngini u ya midzini',
    roof: 'U bva kha mutombo u ya thanngini', bottle: 'Sheledzani midzi nga bodelo',
    jar: 'Ndingo ya mavu nga khali', shadow: 'Murunzi u shanduka hani nga zwifhinga zwa ṅwaha',
    zones: 'Pulana dzi-zone nga u dalela', windbreak: 'Vhekanyani windbreak',
    tree: 'Ṱavhani muri nga vhudzivha ho teaho', mulch: 'Fukedzani ndima nga mulch',
    succession: 'Sedzani mavu a si na tshithu a tshi fhola', rotation: 'Sudzulusani mashaka a zwiliṅwa kha ndima',
  },
  ts: {
    level: 'Kambela A-frame', walk: 'Fungha contour hi swikhomelo', drip: 'Ku suka ethankini ku ya etimitsweni',
    roof: 'Ku suka elwangwini ku ya ethankini', bottle: 'Cheleta timitsu hi bodlhela',
    jar: 'Ku kambela misava hi xibya xa ngilazi', shadow: 'Ndzhuti wu cinca njani hi tinguva',
    zones: 'Hlela ti-zone hi minkarhi ya ku endzela', windbreak: 'Hlela swisirhelelo swa moya',
    tree: 'Byala murhi eku enteni loku faneleke', mulch: 'Funengeta mubhedhi hi mulch',
    succession: 'Vona misava ya hava yi tlhela yi funengetiwa', rotation: 'Cincana mindyangu ya swimilana emibedhini',
  },
};

export function fieldFilmTitle(film: FieldFilm, lang: FilmLanguage): string {
  if (film === 'harvest') return 'Where did the harvest go?';
  if (film === 'earth') return 'Raised bed and swale';
  return localisedFilmTitles[lang][film];
}

type Edition = { bytes: number; pictures: number[]; ends: number[] };
type Versions = { en: Edition; captions?: Edition; manualVersion?: number } & Partial<Record<FilmLanguage, Edition>>;
// These films share one picture clock across all spoken and captioned editions.
function manualEditions(cueEnds: number[], bytes: { en: number; zu: number; captions: number }, version = 1): Versions {
  const frames = cueEnds.map(seconds => seconds * 24);
  const edition = (size: number): Edition => ({ bytes: size, pictures: frames, ends: frames });
  return { manualVersion: version, en: edition(bytes.en), zu: edition(bytes.zu), captions: edition(bytes.captions) };
}

const versions: Record<FieldFilm, Versions> = {
  harvest: { en: { bytes: 2408019, pictures: [936], ends: [979] } },
  earth: { en: { bytes: 1844924, pictures: [720], ends: [807] } },
  drip: manualEditions([6, 12, 19, 26, 34, 42], { en: 3894033, zu: 3952301, captions: 3610429 }),
  roof: manualEditions([6, 12, 19, 26, 34, 42], { en: 4946589, zu: 4952807, captions: 4648115 }),
  bottle: manualEditions([5, 11, 17, 23, 29, 36], { en: 4027171, zu: 4042186, captions: 3756504 }, 3),
  jar: manualEditions([9, 17, 24, 32, 43, 50], { en: 2268056, zu: 2301309, captions: 1870613 }),
  shadow: manualEditions([6, 13, 21, 29, 36, 42], { en: 1563921, zu: 1608098, captions: 1236974 }),
  zones: manualEditions([7, 14, 21, 28, 35, 43], { en: 1435596, zu: 1430914, captions: 1100658 }),
  windbreak: manualEditions([7, 14, 21, 29, 37, 45], { en: 2974251, zu: 3018094, captions: 2674011 }),
  tree: manualEditions([8, 16, 24, 33, 42, 51], { en: 2321034, zu: 2385081, captions: 1985110 }),
  mulch: manualEditions([6, 13, 21, 29, 36, 43], { en: 3167161, zu: 3202218, captions: 2857069 }),
  succession: manualEditions([7, 14, 22, 30, 38, 46], { en: 7418357, zu: 7431577, captions: 7096426 }),
  rotation: manualEditions([7, 14, 21, 28, 35, 45], { en: 2569765, zu: 2601141, captions: 2267659 }),
  level: {
    en: { bytes: 4826644, pictures: [84, 180, 312, 396, 480, 594, 672], ends: [110, 206, 343, 435, 519, 674, 752] },
    zu: { bytes: 4659422, pictures: [180, 396, 480, 672], ends: [180, 396, 517, 715] },
    captions: { bytes: 4336192, pictures: [180, 396, 480, 672], ends: [180, 396, 544, 778] },
  },
  walk: {
    en: { bytes: 6104299, pictures: [109, 138, 194, 341, 486, 635, 720], ends: [160, 201, 257, 442, 587, 736, 859] },
    zu: { bytes: 6250107, pictures: [36, 138, 194, 341, 635, 720], ends: [181, 379, 449, 666, 960, 1123] },
    captions: { bytes: 5892768, pictures: [36, 138, 194, 341, 635, 720], ends: [194, 428, 496, 749, 1043, 1251] },
  },
};

export function filmEdition(film: FieldFilm, requested: string) {
  const all = versions[film];
  const languages = FILM_LANGUAGES.filter(code => all[code] || all.captions);
  const lang = languages.find(code => code === requested) ?? 'en';
  const kind = all[lang] ? lang : 'captions';
  const edition = all[kind] ?? all.en;
  const directory = all.manualVersion ? `/manual/films/${film}/v${all.manualVersion}` : '/course-animations/field-films/v1';
  const base = directory + '/' + film + '-';
  return {
    ...edition, lang, languages, src: base + kind + '.mp4', track: base + lang + '.vtt',
    seconds: Math.round(edition.ends[edition.ends.length - 1] / 24),
    size: (edition.bytes / 1_000_000).toFixed(1) + ' MB',
    captionOnly: kind === 'captions',
  };
}

export function matchingFilmTime(from: Edition, to: Edition, seconds: number): number {
  const frame = Math.max(0, Math.floor(seconds * 24));
  const cue = from.ends.findIndex(end => frame < end);
  if (cue < 0) return (to.ends[to.ends.length - 1] - 1) / 24;
  const picture = Math.min(from.pictures[cue] - 1,
    (from.pictures[cue - 1] ?? 0) + frame - (from.ends[cue - 1] ?? 0));
  const nextCue = to.pictures.findIndex(end => picture < end);
  return ((to.ends[nextCue - 1] ?? 0) + picture - (to.pictures[nextCue - 1] ?? 0)) / 24;
}
