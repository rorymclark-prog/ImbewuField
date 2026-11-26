import { MANUAL_LANGS, MANUAL_LANG_NAMES, type ManualLang } from './manual';

// The longer localised readings hold a settled picture. Each pair lists the final
// picture and edition frames for a cue, so a language change can keep the same action.
export type FieldFilm = 'harvest' | 'level' | 'walk' | 'earth' | 'drip';
export const FILM_LANGUAGES = MANUAL_LANGS;
export const FILM_LANGUAGE_NAMES = MANUAL_LANG_NAMES;
export type FilmLanguage = ManualLang;

const localisedFilmTitles = {
  en: { level: 'Check the A-frame', walk: 'Peg a contour', drip: 'From the tank to the roots' },
  zu: { level: 'Hlola i-A-frame', walk: 'Bethela i-contour ngezikhonkwane', drip: 'Ukusuka ethangini kuya ezimpandeni' },
  st: { level: 'Hlahloba A-frame', walk: 'Tshwaya contour ka dithupana', drip: 'Ho tloha tankeng ho ya metsong' },
  ve: { level: 'Ṱolani A-frame', walk: 'Swayani contour nga zwiṱanda', drip: 'U bva thanngini u ya midzini' },
  ts: { level: 'Kambela A-frame', walk: 'Fungha contour hi swikhomelo', drip: 'Ku suka ethankini ku ya etimitsweni' },
};

export function fieldFilmTitle(film: FieldFilm, lang: FilmLanguage): string {
  if (film === 'harvest') return 'Where did the harvest go?';
  if (film === 'earth') return 'Raised bed and swale';
  return localisedFilmTitles[lang][film];
}

type Edition = { bytes: number; pictures: number[]; ends: number[] };
type Versions = { en: Edition; captions?: Edition } & Partial<Record<FilmLanguage, Edition>>;
const dripFrames = [144, 288, 456, 624, 816, 1008];
const versions: Record<FieldFilm, Versions> = {
  harvest: { en: { bytes: 2408019, pictures: [936], ends: [979] } },
  earth: { en: { bytes: 1844924, pictures: [720], ends: [807] } },
  drip: {
    en: { bytes: 3894033, pictures: dripFrames, ends: dripFrames },
    zu: { bytes: 3952301, pictures: dripFrames, ends: dripFrames },
    captions: { bytes: 3610429, pictures: dripFrames, ends: dripFrames },
  },
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
  const directory = film === 'drip' ? '/manual/films/drip/v1' : '/course-animations/field-films/v1';
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
