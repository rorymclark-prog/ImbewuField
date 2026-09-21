import content from './course-finance-content.json' with { type: 'json' };

export interface FinanceSection { title: string; text: string }
export interface FinanceLesson {
  id: string; code: string; title: string; outcome: string | null;
  reading: string; practice: FinanceSection[];
}
export interface FinanceUnit {
  id: string; number: number; title: string; summary: string; image: string;
  sourceFile: string; sourceSha256: string; lessons: FinanceLesson[];
  shared: FinanceSection[]; sources: { label: string; url: string }[]; workbook: string | null;
}

// Separate from COURSE_MODULES: a finance reading checklist must never change the
// existing permaculture sequence, mentor sign-off or capstone eligibility.
export const FINANCE_UNITS: readonly FinanceUnit[] = content.units;
export const FINANCE_LESSONS = FINANCE_UNITS.flatMap(unit => unit.lessons.map(lesson => ({ unit, lesson })));

export function financeLesson(id: string) {
  return FINANCE_LESSONS.find(entry => entry.lesson.id === id) ?? null;
}

export const FINANCE_APP_GUIDES: Record<string, { title: string; href: string }[]> = {
  f1: [{ title: 'Find your way and keep work safe', href: '/student/guides/getting-started' }, { title: 'Make and manage an invoice', href: '/student/guides/invoices' }],
  f2: [{ title: 'Record a harvest', href: '/student/guides/harvest' }, { title: 'Record a sale once', href: '/student/guides/sales' }],
  f3: [{ title: 'Record a cost and keep its receipt', href: '/student/guides/expenses' }, { title: 'Read Charts', href: '/student/guides/charts' }],
  f4: [{ title: 'Check a crop plan', href: '/student/guides/crop-planning' }, { title: 'Read Charts', href: '/student/guides/charts' }],
  f5: [{ title: 'Make and manage an invoice', href: '/student/guides/invoices' }, { title: 'Review payment', href: '/student/guides/payments' }, { title: 'Bring in paper and past sales', href: '/student/guides/past-sales' }],
  f6: [{ title: 'Record a paid cost', href: '/student/guides/expenses' }],
  f7: [{ title: 'Export records and prepare evidence', href: '/student/guides/exports' }, { title: 'Read Charts', href: '/student/guides/charts' }],
  f8: [{ title: 'Map your site', href: '/student/guides/mapping' }, { title: 'Check a crop plan', href: '/student/guides/crop-planning' }, { title: 'Keep field evidence', href: '/student/guides/evidence' }],
};
