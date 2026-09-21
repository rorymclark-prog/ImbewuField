// This checklist records reading only; it does not grant course or assessment credit.
export function readFinanceChecklist(raw: string | null, lessonIds: readonly string[]): string[] {
  const value: unknown = JSON.parse(raw ?? '[]');
  if (!Array.isArray(value)) throw new Error('Invalid reading checklist');
  const allowed = new Set(lessonIds);
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))];
}
