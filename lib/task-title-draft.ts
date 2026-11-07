// isiXhosa and Afrikaans wording for the crop-plan task lines (title 'Harvest Onions', subtitle 'Bed 1 · Due this month').
// Shared by the crop plan page (app/cropplan/page.tsx) and the Home upcoming-tasks list so the two
// screens read the same. English, isiZulu and every other language are untouched: both helpers
// return undefined unless lang is 'xh' or 'af' and the line is one of the generated crop-task shapes.
// (The helper names predate Afrikaans and stay, because the tests and both pages import them.)
import type { BoardTask } from '@/lib/task-board';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';

export const ACTION_SOURCE_VERB: Partial<Record<NonNullable<BoardTask['action']>, string>> = {
  prep: 'Prep bed for',
  sow: 'Sow',
  transplant: 'Transplant',
  mulch: 'Water in & mulch',
  harvest: 'Harvest',
  'terminate-cover': 'Cut or roll down',
  'weed-early': 'Weed around',
  'weed-mid': 'Weed & check on',
};

// isiXhosa for the same task lines. A local table, not shard entries: the English verbs are bare words
// ('Sow', 'Harvest') that other screens use as nouns, and the shard is keyed by English alone.
const ACTION_XH_VERB: Partial<Record<NonNullable<BoardTask['action']>, string>> = {
  prep: 'Lungisa umbhede:',
  sow: 'Tyala',
  transplant: 'Tyala izithole:',
  mulch: 'Nisela uze ugqume ngengca:',
  harvest: 'Vuna',
  'terminate-cover': 'Sika okanye jikelisa phantsi:',
  'weed-early': 'Sula ukhula ejikeleze:',
  'weed-mid': 'Sula ukhula uze ukhangele:',
};

// Afrikaans for the same task titles: the same verbs as the dictionary's taskVerb* lines (lib/locales/af.ts), as a
// prefix so the crop name can go through the inline drafts ('Harvest Onions' reads 'Oes Uie').
const ACTION_AF_VERB: Partial<Record<NonNullable<BoardTask['action']>, string>> = {
  prep: 'Berei bedding voor vir',
  sow: 'Saai',
  transplant: 'Verplant',
  mulch: 'Gee water en deklaag:',
  harvest: 'Oes',
  'terminate-cover': 'Sny of rol plat:',
  'weed-early': 'Skoffel rondom',
  'weed-mid': 'Skoffel en kyk na',
};

export function taskTitleXh(task: BoardTask, lang: string): string | undefined {
  if ((lang !== 'xh' && lang !== 'af') || task.kind !== 'crop' || !task.action) return undefined;
  const verb = (lang === 'af' ? ACTION_AF_VERB : ACTION_XH_VERB)[task.action];
  const sourceVerb = ACTION_SOURCE_VERB[task.action];
  if (!verb || !sourceVerb || !task.title.startsWith(sourceVerb)) return undefined;
  const cropName = task.title.slice(sourceVerb.length).trim();
  return `${verb} ${inlineText(lang, cropName)}`;
}

// The untouched default bed label ('Bed 3') reads 'Umbhede 3' / 'Bedding 3'; a bed the farmer renamed is shown as typed.
function bedLabelXh(bedLabel: string, lang: string): string {
  const match = /^Bed (\d+)$/.exec(bedLabel);
  return match ? inlineTemplate(lang, 'Bed {n}', null, { n: match[1] }) : bedLabel;
}

export function taskSubtitleXh(task: BoardTask, lang: string): string | undefined {
  if ((lang !== 'xh' && lang !== 'af') || task.kind !== 'crop') return undefined;
  const separator = ' · ';
  const splitAt = task.subtitle.lastIndexOf(separator);
  if (splitAt < 0) return undefined;
  const bedLabel = bedLabelXh(task.subtitle.slice(0, splitAt), lang);
  const dueSource = task.subtitle.slice(splitAt + separator.length);
  const months = dueSource.match(/^Due in (\d+) months$/);
  const due = dueSource === 'Due this month' || dueSource === 'Due next month'
    ? inlineText(lang, dueSource)
    : months ? inlineTemplate(lang, 'Due in {n} months', null, { n: months[1] }) : null;
  return due && due !== dueSource ? `${bedLabel}${separator}${due}` : undefined;
}
