// Source pairing is deliberately separate from the legacy slide summary parser. A translated
// draft must be checked against the words a farmer would hear, including later paragraphs.
import { READING_7_SILENT_IMAGE_CUE } from '../lib/course-deck-silent-cues.ts';

export function englishSlideRecords(raw) {
  const heading = /^\*\*Slide\s+(\d+)\s*[—-]\s*([^*\n]+?)\s*\*\*\s*$/gm;
  const matches = [...raw.matchAll(heading)];
  if (!matches.length) throw new Error('English narration has no numbered slide headings');
  const headingStarts = [...raw.matchAll(/^\*\*Slide\s+\d+/gm)];
  if (headingStarts.length !== matches.length) throw new Error('English narration has a malformed slide heading');
  return matches.map((match, index) => {
    const n = Number(match[1]);
    if (n !== index + 1) throw new Error(`English narration slide ${index + 1}: found number ${n}`);
    const end = matches[index + 1]?.index ?? raw.length;
    const body = raw.slice(match.index + match[0].length, end)
      .split(/^#{1,6}\s/m)[0]
      .replace(/\[pause\]/gi, '')
      .replace(/^---\s*$/gm, '')
      .split('\n').map((line) => line.trim()).filter(Boolean);
    if (!body.length) throw new Error(`English narration slide ${n}: empty body`);
    return { n, heading: match[2].trim(), body };
  });
}

export const PAIRED_DRAFT_LANGUAGE_LABELS = Object.freeze({
  st: 'SESOTHO',
  ts: 'XITSONGA',
  ve: 'TSHIVENḒA',
  zu: 'ISIZULU',
});

export function pairedDraftLanguageLabel(language) {
  return Object.hasOwn(PAIRED_DRAFT_LANGUAGE_LABELS, language)
    ? PAIRED_DRAFT_LANGUAGE_LABELS[language]
    : null;
}

export function pairedTargetHasEnglishHolds(target) {
  return target?.heading?.status === 'english-hold' || (target?.body ?? []).some((part) =>
    part.status === 'english-hold' ||
    (part.status === 'mixed' && part.segments?.some((segment) => segment.status === 'english-hold')));
}

export function validatePairedDraft(draft, source, language = 'st') {
  if (!pairedDraftLanguageLabel(language)) {
    throw new Error(`Paired draft language is unsupported: ${language}`);
  }
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('Paired draft must be a JSON object');
  if (draft.language !== language) throw new Error(`Paired draft language must be ${language}`);
  if (draft.sourceLanguage !== 'en') throw new Error('Paired draft sourceLanguage must be en');
  if (draft.reviewStatus !== 'unreviewed') throw new Error('Paired draft reviewStatus must be unreviewed');
  if (!Array.isArray(draft.slides) || draft.slides.length !== source.length) {
    throw new Error(`Paired draft slide count differs from English narration (${source.length})`);
  }
  return draft.slides.map((slide, index) => {
    const original = source[index];
    if (!slide || typeof slide !== 'object' || slide.n !== original.n) {
      throw new Error(`Paired draft slide ${index + 1}: missing, duplicate, or out of order number`);
    }
    if (slide.english?.heading !== original.heading) {
      throw new Error(`Paired draft slide ${slide.n}: English heading differs from narration`);
    }
    if (!Array.isArray(slide.english.body) ||
        JSON.stringify(slide.english.body) !== JSON.stringify(original.body)) {
      throw new Error(`Paired draft slide ${slide.n}: English body differs from narration`);
    }
    const target = slide.target;
    if (!target || !Array.isArray(target.body) || target.body.length !== original.body.length) {
      throw new Error(`Paired draft slide ${slide.n}: target paragraph count differs from English narration`);
    }
    const checkPart = (part, location, english) => {
      if (!part || !['draft', 'english-hold', 'mixed'].includes(part.status)) {
        throw new Error(`Paired draft slide ${slide.n} ${location}: review status is missing or invalid`);
      }
      if (part.status === 'mixed') {
        if (!Array.isArray(part.segments) || part.segments.length < 2 ||
            part.segments.some((segment) => !segment || !['draft', 'english-hold'].includes(segment.status) ||
              typeof segment.sourceEnglish !== 'string' || !segment.sourceEnglish)) {
          throw new Error(`Paired draft slide ${slide.n} ${location}: mixed text needs source-paired segments`);
        }
        if (part.segments.map((segment) => segment.sourceEnglish).join('') !== english) {
          throw new Error(`Paired draft slide ${slide.n} ${location}: mixed segments do not preserve exact English`);
        }
        for (const segment of part.segments) {
          if (segment.status === 'draft' && (typeof segment.text !== 'string' || !segment.text.trim())) {
            throw new Error(`Paired draft slide ${slide.n} ${location}: mixed draft segment is empty`);
          }
          if (segment.status === 'english-hold' && segment.text !== undefined) {
            throw new Error(`Paired draft slide ${slide.n} ${location}: English hold segment must not have target text`);
          }
        }
        return;
      }
      if (part.status === 'draft' && (typeof part.text !== 'string' || !part.text.trim())) {
        throw new Error(`Paired draft slide ${slide.n} ${location}: target draft text is missing`);
      }
      if (part.status === 'draft' && part.text.trim() === english) {
        throw new Error(`Paired draft slide ${slide.n} ${location}: unchanged English needs an explicit hold`);
      }
      if (part.status === 'english-hold' && part.text !== undefined) {
        throw new Error(`Paired draft slide ${slide.n} ${location}: English hold must not masquerade as target copy`);
      }
    };
    checkPart(target.heading, 'heading', original.heading);
    target.body.forEach((part, paragraph) => checkPart(part, `paragraph ${paragraph + 1}`, original.body[paragraph]));
    let supplementalImageCue;
    const isActiveZuluReading7Target = language === 'zu' && slide.n === 7 &&
      original.heading === 'Observe Water Before You Build' &&
      (target.heading.status !== 'english-hold' || target.body.some((part) => part.status !== 'english-hold'));
    if (isActiveZuluReading7Target && slide.supplementalImageCue === undefined) {
      throw new Error(`Paired draft slide ${slide.n}: supplemental source-image cue is required`);
    }
    if (slide.supplementalImageCue !== undefined) {
      if (language !== 'zu' || slide.n !== 7 || original.heading !== 'Observe Water Before You Build' ||
          JSON.stringify(slide.supplementalImageCue) !== JSON.stringify(READING_7_SILENT_IMAGE_CUE) ||
          original.body.some((paragraph) => paragraph.includes(READING_7_SILENT_IMAGE_CUE.text)) ||
          target.body.some((part) => part.text === READING_7_SILENT_IMAGE_CUE.text ||
            part.segments?.some((segment) => segment.text === READING_7_SILENT_IMAGE_CUE.text))) {
        throw new Error(`Paired draft slide ${slide.n}: supplemental source-image cue identity drifted`);
      }
      supplementalImageCue = READING_7_SILENT_IMAGE_CUE;
    }
    return { n: original.n, english: original, target, ...(supplementalImageCue ? { supplementalImageCue } : {}) };
  });
}

/** Parse an explicit subset without changing the source packet's slide numbering. */
export function pairedSlideSelection(value, total) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('--slides needs a comma-separated list of slide numbers');
  }
  const parts = value.split(',').map((part) => part.trim());
  if (parts.some((part) => !/^[1-9]\d*$/.test(part))) {
    throw new Error('--slides accepts positive slide numbers separated by commas');
  }
  const slides = parts.map(Number);
  if (new Set(slides).size !== slides.length) {
    throw new Error('--slides cannot contain duplicate slide numbers');
  }
  const outside = slides.find((slide) => slide > total);
  if (outside !== undefined) {
    throw new Error(`--slides contains ${outside}, but the source has only ${total} slides`);
  }
  return slides;
}

/** Select already-validated records by original slide number, preserving requested order. */
export function selectPairedSlides(slides, selection) {
  if (selection === null) return slides;
  const byNumber = new Map(slides.map((slide) => [slide.n, slide]));
  return selection.map((number) => byNumber.get(number));
}
