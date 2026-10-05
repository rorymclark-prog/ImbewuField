import { createIsiZuluSilentDeckDraftRegistry, resolveIsiZuluSilentDeckDraft as resolveFromRegistry } from './course-deck-silent-drafts';
import { ISIZULU_SILENT_DECK_DRAFT_ROWS } from './course-deck-silent-drafts-data';

// Construct once from the checked release data. The pure factory rejects bad rows before any
// display resolver can see them; there is intentionally no audio field in this registry.
const checkedRegistry = createIsiZuluSilentDeckDraftRegistry(ISIZULU_SILENT_DECK_DRAFT_ROWS);

export function resolveIsiZuluSilentDeckDraft(moduleId: string, slide: number) {
  return resolveFromRegistry(checkedRegistry, moduleId, slide);
}
