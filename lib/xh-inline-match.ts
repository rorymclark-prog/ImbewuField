// isiXhosa for sentences that a lib module has ALREADY built from a template and some values
// ("Frost has been observed here in Jun, Jul. Check …"), when the English text itself must stay
// byte-identical because the PDF and the tests read it.
//
// The caller lists the English TEMPLATES the module can produce, with {placeholders} where its
// values go. A sentence that matches a template is translated through inlineTemplate (so the
// isiXhosa lives in lib/locales/xh-inline/*.ts, keyed by the template, like every other draft)
// and the captured values are put back untouched: crop names, bed labels, numbers, months.
// Anything that matches nothing stays English, which is the safe failure.
//
// Free of React and lib/i18n.tsx, like lib/xh-inline.ts.

import { inlineTemplate, inlineText } from './xh-inline';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compiled = new Map<string, { pattern: RegExp; names: string[] }>();
function compile(template: string): { pattern: RegExp; names: string[] } {
  let hit = compiled.get(template);
  if (!hit) {
    const names: string[] = [];
    const source = template.split(/(\{[a-zA-Z]+\})/).map((part) => {
      const placeholder = /^\{([a-zA-Z]+)\}$/.exec(part);
      if (!placeholder) return escapeRegex(part);
      names.push(placeholder[1]);
      return '([\\s\\S]+?)';
    }).join('');
    hit = { pattern: new RegExp(`^${source}$`), names };
    compiled.set(template, hit);
  }
  return hit;
}

/**
 * The isiXhosa draft of `english`: a fixed sentence by exact match, else the first template it
 * fits (values kept, or translated by `value` when a captured value is itself a fixed phrase such
 * as "not recorded"). Every other language gets the English back unchanged.
 */
export function inlineBuilt(
  lang: string,
  english: string,
  templates: readonly string[],
  value?: (name: string, captured: string) => string,
): string {
  if (lang !== 'xh') return english;
  const fixed = inlineText(lang, english);
  if (fixed !== english) return fixed;
  for (const template of templates) {
    const { pattern, names } = compile(template);
    const match = pattern.exec(english);
    if (!match) continue;
    const vars: Record<string, string> = {};
    names.forEach((name, i) => { vars[name] = value ? value(name, match[i + 1]) : match[i + 1]; });
    const translated = inlineTemplate(lang, template, null, vars);
    // No draft for this template: the English the caller gave us, not a half-filled copy.
    return translated === inlineTemplate('en', template, null, vars) ? english : translated;
  }
  return english;
}

/**
 * Like inlineBuilt, for text that joins several parts with `separator` ("Not planted yet; Farm
 * yield schedule"): a drafted whole sentence wins, otherwise each part is translated on its own so
 * a {placeholder} can never swallow the separator and the parts after it.
 */
export function inlineBuiltList(
  lang: string,
  english: string,
  templates: readonly string[],
  separator = '; ',
  value?: (name: string, captured: string) => string,
): string {
  if (lang !== 'xh') return english;
  const fixed = inlineText(lang, english);
  if (fixed !== english) return fixed;
  const parts = english.split(separator);
  return parts.map((part) => inlineBuilt(lang, part, templates, value)).join(separator);
}
