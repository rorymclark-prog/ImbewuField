# IsiZulu app readiness — 23 September 2026

## 24 September verification batch

The current preview batch adds isiZulu controls to the Design Studio and
programme evidence/reports, plus clearer English-content notices in the NGO,
funder and mentor workspaces. The report composer still preserves authored
English evidence and PDF body text; the notice says so before export. These
interface translations are drafts pending fluent review.

`node scripts/course-isizulu-audit.mjs` now emits a read-only, per-lesson
English-source fingerprint and review-packet inventory. On the 24 September
source there are 33 core lessons: 25 review drafts, 2 source-held lessons,
and 6 lessons with published isiZulu audio but no approved lesson/quiz text.
The audit does not certify meaning, fluency or approval. The older 165 Thando
review takes predate the English corrections and must be matched against
accepted scripts before any learner import. The course content gate remains
in place; this batch does not turn review drafts into learner lessons.

**Status: work in progress, not a whole-app isiZulu release.** Selecting
isiZulu already loads a shared interface dictionary, but missing keys fall
back to English. A language switch by itself does not mean a course, form,
audio track, report or offline copy is localized.

## Additional interface preview pass — 23 September

Lower-cost parallel agents prepared isiZulu control and status text for the
lesson player, narration fallback, offline pack, Records desktop and phone
views, CSV/receipt labels, home, account, community, sample chooser and sample
garden/farm screens, crop planner, calendar, surveys and staff dashboards. A
separate pass covers the tour controls. These remain preview drafts, pending
fluent review. The lesson player states the actual language
of each slide and narration fallback; the Student page states that module
names/descriptions, lesson text and quizzes remain English. Sourced farming
tips, detailed programme evidence, high-risk finance explanations, sample
evidence and authored course/guide material retain their English meaning and are marked where a
translated shell could otherwise be mistaken for translated teaching.
The sample workspace now retains its chosen interface language across hard
navigation and reloads without changing the real account preference.
The Journal and Lima Vision controls have a further draft pass. Journal notes,
fieldwork examples and storage warnings remain in their authored English;
Vision retains English AI results and the original estimates, with an isiZulu
notice beside the result.

This pass does not change role permissions, saved measurements, prices,
calculations or learner course publication status. Route-level work continues;
the interface dictionary and translated controls do not establish whole-app
coverage. The exact preview commit, CI result and visual checks should be
recorded in the continuation log after deployment.

## Core learning

- The ten core modules contain 33 English lesson bodies and quizzes. Seeds
  and Plant Guilds have existing isiZulu slide audio, 24 and 51 clips
  respectively; Plant Guilds remains pending fluent review.
- Review-only full isiZulu lesson/quiz/narration drafts cover 25 of the other
  27 lessons. Water Harvesting L4 needs qualified local greywater and
  municipal reconciliation; Soil Health L3 needs its documented English
  mulch/leachate source correction authorized. See the
  [lesson review queue](../narration-reviews/CORE-ISIZULU-REVIEW-QUEUE.md).
- The other eight modules have 165 English slide clips and no isiZulu audio
  files. Their old isiZulu scripts are drafts, not ready-made recording text.
  See the [audio readiness handoff](ISIZULU-AUDIO-RECORDING-READINESS.md).
- Lesson title, body, key points, quiz question, options and rationale must
  move together. `lib/course-localization.ts` records per-lesson review state
  and exposes a learner resolver that requires published copy and recorded
  language and farming approvals. No draft is marked published or made
  learner-visible by that plumbing.
- The Student page's controls and progress language are being localized in
  the current branch. With isiZulu selected it must explicitly say when the
  actual lesson and quiz content remains in English.

## Wider app audit

The shared `lib/i18n.tsx` provider loads the isiZulu dictionary on demand and
falls back to English for missing keys. Home, map, account, records, community
and parts of design already use it, with untranslated keys still possible.
Assessments has a separate bilingual switch; reports use another language
state and map. Much of the route-level copy remains hardcoded English.

| Priority | Routes and surfaces | Why this is a separate pass |
| --- | --- | --- |
| Access and fieldwork | `/login`, `/offline`, auth, consent, queued entries | A translated save, sync, conflict or remove message must preserve its exact consequence. |
| Daily work | `/records`, `/finances`, `/invoice`, `/prices`, `/cropplan`, `/calendar`, `/survey`, `/surveys` | Crop and money terms, validation and transaction outcomes need paired screen/export checks. Farm Finance *course content* remains outside this pass. |
| Reports and PDFs | `/reports`, saved reports, printed/PDF output | A translated control must not silently produce an English or mixed-language document. |
| Planning | `/design`, `/design/lite`, `/design-studio-2`, `/plan`, `/atlas` | Instructions, measurements, save status and safety wording must stay tied to their source. |
| Staff and guides | `/assessments`, facilitator, mentor, NGO, funder, network, `/student/guides/*` | Independent language state and role-specific workflows need end-to-end checks; published guide prose remains English until reviewed. |

The current branch has preview-only isiZulu control work on the Student,
login, offline, prices, reports, invoice and records routes, plus the shared
navigation, Lima labels and consent accessibility. The invoice document's
screen/print/PDF labels now follow the app language; the sample report's
language metadata and fixed boilerplate have been aligned. A phone-width
Student and price detail were opened and inspected locally. The crop catalog
still displays its source names in English; the Student course notice says
lesson and quiz content is English. Desktop finance sheets, chart/reconciliation
components, parts of report preparation, crop-plan components, many planning
and staff routes, and unknown server errors still contain English. This table
is a scope map, not a claim those routes or the whole app are finished.
User-entered records and notes stay in the author's language.

The direct UI dictionary currently has more isiZulu entries than before this
pass, but dictionary coverage is not route coverage. `node
scripts/course-i18n-status.mjs` counts direct keys and real audio files; it
does not attest meaning, fluency or every rendered state. All new control and
document translations remain review drafts on this branch.

## Release gate

For each farming lesson, a first-language isiZulu reviewer with local farming
knowledge must return exact corrections, scope and an accepted/revise/hold
decision. Resolve specialist/source holds separately. Then add the approved
lesson/quiz data, slide text, transcript, audio and manifest in the same
lesson sequence; inspect the actual phone player, narration and saved offline
pack. App control translations also need fluent review, especially farming,
finance, safety, consent and data-loss language. Automated checks and AI
agents do not constitute human language or practitioner approval.
