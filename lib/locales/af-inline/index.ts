// Afrikaans drafts for the app's inline English, keyed by the EXACT English (see lib/xh-inline.ts).
// Unreviewed machine drafts; shards are added per screen group. Later shards win on a duplicate key.

const SHARDS: Record<string, string>[] = [];

export const AF_INLINE_SOURCE: Record<string, string> = Object.assign({}, ...SHARDS);
