import content from './course-design-content.json';

export const DESIGN_COURSE = content;
export const DESIGN_LESSONS = content.units.flatMap(unit => unit.lessons.map(lesson => ({ unit, lesson })));
export function designLesson(id: string) { return DESIGN_LESSONS.find(entry => entry.lesson.id === id); }
export const DESIGN_GUIDE_NAMES: Record<string, string> = {
  'getting-started': 'Getting started', mapping: 'Map the site', evidence: 'Keep evidence',
  design: 'Use Design Studio', 'crop-planning': 'Plan crops', exports: 'Export and check a plan',
  expenses: 'Record expenses',
};
