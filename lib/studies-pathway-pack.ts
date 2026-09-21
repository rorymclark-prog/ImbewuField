// Static, public reading routes for the two teaching previews. This is deliberately separate
// from account pages: a download may prepare authored reading, never a learner's records.

import { FINANCE_LESSONS, FINANCE_UNITS } from '@/lib/course-finance';
import { DESIGN_LESSONS } from '@/lib/course-design';
import type { OfflinePack, PackEntry } from '@/lib/offline-pack';

export type StudiesPathwayId = 'finance' | 'design';

export interface StudiesPathwayPack {
  id: StudiesPathwayId;
  title: string;
  pages: readonly string[];
  pack: OfflinePack;
}

const entry = (url: string, bytes: number, kind: PackEntry['kind']): PackEntry => ({ url, bytes, kind });

const FINANCE_MEDIA = [
  entry('/studies-guides/expense-record.jpg', 870477, 'image'),
  entry('/studies-guides/record-sale.jpg', 894454, 'image'),
  entry('/studies-guides/sketch-the-site.jpg', 791967, 'image'),
  entry('/finance-course/workbooks/f2.pdf', 845499, 'image'),
  entry('/finance-course/workbooks/f3.pdf', 848152, 'image'),
  entry('/finance-course/workbooks/f4.pdf', 9227, 'image'),
  entry('/finance-course/workbooks/f5.pdf', 9250, 'image'),
  entry('/finance-course/workbooks/f6.pdf', 9547, 'image'),
  entry('/finance-course/workbooks/f7.pdf', 10934, 'image'),
  entry('/finance-course/workbooks/f8.pdf', 1129652, 'image'),
] as const;

const DESIGN_MEDIA = [entry('/studies-guides/sketch-the-site.jpg', 791967, 'image')] as const;

function pack(moduleId: string, entries: readonly PackEntry[]): OfflinePack {
  return {
    moduleId,
    lang: 'en',
    quality: 'standard',
    entries: [...entries],
    bytes: entries.reduce((sum, item) => sum + item.bytes, 0),
    missing: [],
  };
}

const FINANCE_PAGES = [
  '/student',
  '/student/finance',
  ...FINANCE_LESSONS.map(({ lesson }) => `/student/finance/${lesson.id}`),
  '/student/finance/project/guided',
  '/student/finance/project/independent',
  '/student/finance/project/retry',
] as const;

const DESIGN_PAGES = [
  '/student',
  '/student/design',
  ...DESIGN_LESSONS.map(({ lesson }) => `/student/design/${lesson.id}`),
  '/student/design/case',
  '/student/design/folder',
  '/student/design/scale',
  '/student/design/worked',
] as const;

export const STUDIES_PATHWAY_PACKS: Record<StudiesPathwayId, StudiesPathwayPack> = {
  finance: { id: 'finance', title: 'Farm Finance', pages: FINANCE_PAGES, pack: pack('pathway:finance', FINANCE_MEDIA) },
  design: { id: 'design', title: 'Design a working homestead', pages: DESIGN_PAGES, pack: pack('pathway:design', DESIGN_MEDIA) },
};

/** The worker uses this same static list to prepare the page and its startup assets. */
export const STUDIES_PATHWAY_PAGES = [...new Set(Object.values(STUDIES_PATHWAY_PACKS).flatMap(pathway => pathway.pages))];

export function studiesPathwayPack(id: StudiesPathwayId): StudiesPathwayPack {
  return STUDIES_PATHWAY_PACKS[id];
}

// Finance media is unit-owned. This makes an added workbook/image force the registry to change,
// rather than silently offering a route that loses its practice material offline.
export const FINANCE_PATHWAY_MEDIA_URLS = [...new Set(
  FINANCE_UNITS.flatMap(unit => [unit.image, unit.workbook].filter((url): url is string => Boolean(url))),
)];
