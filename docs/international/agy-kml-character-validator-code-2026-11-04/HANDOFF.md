# Implementation Handoff: Shared XML Character Authority

This handoff covers the extraction and delegation of the shared XML 1.0 character admissibility check.

### Changed Files
1. `lib/xml-character-text.ts` (new):
   - Exports `isXml10CharacterText(value: unknown): value is string`.
   - Checks `typeof value === 'string'` and matches against `!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u`.
   - Permits valid astral code points (surrogate pairs with `/u`), while rejecting C0 controls (except TAB, LF, CR), lone surrogates, and noncharacters U+FFFE / U+FFFF.
   - Enforces no length limit; empty strings are valid character text.
   - Strictly scoped to character admissibility; does not assert XML well-formedness, DTD/entity safety, parser safety, KML schema support, or document size limits.

2. `lib/field-layout-export.ts`:
   - Imports `isXml10CharacterText` from `./xml-character-text`.
   - Updates `xmlText` predicate to delegate character admissibility check to `isXml10CharacterText(value)` while preserving the existing `typeof value === 'string'` check and `value.length <= 2000` label limit.
   - Preserves all existing builder semantics, error reasons, data detachment, geometry math, escaping, and sourceKey logic verbatim.

### Operational Notes
- Main-only implementation with 0 active workers (workers stopped).
- Zero shell commands, test executions, Git commands, or network operations performed.
- Codex owns test execution, packaging, and validation checks.
