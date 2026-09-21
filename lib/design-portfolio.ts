export const PORTFOLIO_LIMIT = 8000;
export const PORTFOLIO_STAGES = [
  {
    id: 'd1', title: 'People, place and evidence', lesson: 'd1-1',
    purpose: 'Agree the task before drawing a solution.',
    fields: [
      { id: 'brief', label: 'What matters to the household?', prompt: 'Record the agreed needs, who uses and cares for the place, and what must remain usable. Note what is outside this phase. Use roles or initials if you prefer.' },
      { id: 'evidence', label: 'What do you know, and where did it come from?', prompt: 'Give each note a reference. Include its date, source and whether it was observed, reported, measured or proposed. Record limits, disagreements and permission to use someone’s information.' },
      { id: 'base', label: 'Which base map and measurements will you use?', prompt: 'Record the drawing name and revision. Keep existing features, access, boundary status, orientation, units and measurement method with it. List missing measurements. Keep the actual drawing separately with this folder.' },
    ],
    review: 'Ask the learner to trace a need to the household brief and a mapped feature to its evidence. A tidy map with an unexplained boundary or no measurement source needs more work.',
    example: 'In the busy-yard case, BRIEF-A requires food, usable access and manageable care. WALK-A records a water point beside the home. TALK-A is a resident’s rain report. MAP-A remains not to scale; there is no verified boundary or dimension pack.',
  },
  {
    id: 'd2', title: 'Patterns and design questions', lesson: 'd2-1',
    purpose: 'Explain what the evidence means for the design.',
    fields: [
      { id: 'patterns', label: 'Which patterns affect the plan?', prompt: 'Refer to evidence about movement, water, shade, seasons, soil and exposure. Distinguish frequency of use from outside influences. Keep one visit separate from a seasonal pattern.' },
      { id: 'questions', label: 'What decisions need investigation?', prompt: 'Turn observations into questions. Explain whose needs each question serves and which options remain open.' },
      { id: 'checks', label: 'What must be checked next?', prompt: 'Name the missing evidence, a suitable way to obtain it, who can help and which decision depends on it. Keep unsafe or specialist work for appropriate help.' },
    ],
    review: 'Ask why a pattern matters and how it was established. A slope arrow drawn from a rain story, or a seasonal conclusion from one photograph, needs correction.',
    example: 'The watering journey makes care and access worth investigating. It does not prove a new location is suitable. The eastern shade observation and reported rain crossing still need follow-up evidence.',
  },
  {
    id: 'd3', title: 'Alternatives and a reasoned choice', lesson: 'd3-1',
    purpose: 'Compare ways to meet the same brief.',
    fields: [
      { id: 'connections', label: 'What does each proposed part need and give?', prompt: 'Follow water, materials, people and care between features. Identify a useful connection and a possible conflict. Do not assume an output meets another part’s needs without checking suitability.' },
      { id: 'alternatives', label: 'How do your alternatives compare?', prompt: 'Name the alternative drawing sheets. Compare them against the same household needs, access, care, water and cost evidence. Include keeping the present arrangement or deferring work where relevant.' },
      { id: 'choice', label: 'Which option will you investigate or develop, and why?', prompt: 'Give the evidence for your preference, the trade-offs, the unknowns and what could change the choice. A provisional preference is not permission to build.' },
    ],
    review: 'Ask the learner to explain a genuine trade-off between alternatives. More features or a prettier picture do not establish a better response to the brief.',
    example: 'Concept A investigates care of the existing patch. Concept B considers another location while retaining access. The case provisionally favours investigating A; it does not establish that A is cheaper or B produces more.',
  },
  {
    id: 'd4', title: 'A plan that can be checked', lesson: 'd4-1',
    purpose: 'Show what fits, what connects and what is still unresolved.',
    fields: [
      { id: 'plans', label: 'Which drawings show the developed proposal?', prompt: 'List the base, analysis, proposal and detail sheets with their revision, scale status, units, legend and sources. Reference the actual files or paper sheets; typing their names here does not attach them.' },
      { id: 'fit', label: 'How have you checked fit and access?', prompt: 'Identify the measured dimensions and relevant technical sources used. Explain how you checked the drawing and exported copy. Record a reading test with another person and any correction.' },
      { id: 'dependencies', label: 'What work is conditional or on hold?', prompt: 'List unresolved water, soil, access, technical or permission questions. Explain downstream effects and the evidence or advice needed before the affected work can proceed.' },
    ],
    review: 'Ask the learner to demonstrate fit from measurements and follow a daily journey through the actual proposal. A software placement or attractive export alone does not establish suitability.',
    example: 'The busy-yard case has no measured source pack. A learner should mark the scaled layout as unfinished. The completed drawing and fit check cannot be demonstrated from MAP-A alone.',
  },
  {
    id: 'd5', title: 'Work, money and ongoing care', lesson: 'd5-1',
    purpose: 'Connect the drawing to feasible work and agreed responsibilities.',
    fields: [
      { id: 'sequence', label: 'What must happen first?', prompt: 'List the phases, their prerequisites and who agrees that a phase is ready. Include checks before spending or starting work. Keep items with unresolved dependencies on hold.' },
      { id: 'costs', label: 'What resources and money will each phase need?', prompt: 'Use the same feature references as the drawings. Record measured quantities, quotation references, dates and when money is needed. Label estimates and missing costs. Refer to your finance worksheet; do not turn an unknown into zero.' },
      { id: 'care', label: 'Who has agreed to care for the system?', prompt: 'Describe the tasks, agreed roles, available time and materials, and what happens if water, money or a usual carer is unavailable. Record agreement rather than assigning someone else’s labour.' },
    ],
    review: 'Trace one proposed item from the drawing into its sequence, resource record and care agreement. A total cost with no timing, missing costs or an unconsulted carer needs revision.',
    example: 'RESOURCES-A gives no care time, reliable water quantity or budget. The next phase must establish those resources with the household. The person carrying water cannot automatically be assigned every new task.',
  },
  {
    id: 'd6', title: 'Feedback, monitoring and revision', lesson: 'd6-1',
    purpose: 'Explain the design and keep improving it against the brief.',
    fields: [
      { id: 'presentation', label: 'What did the household or reviewer say?', prompt: 'Record the date, role of the reviewer, the drawing revision discussed, what they understood and what needs another attempt. Explain how your choices answer the original brief.' },
      { id: 'monitoring', label: 'How will you find out whether it is working?', prompt: 'Choose observations connected to the household’s needs. Record the starting evidence, who agrees to observe, when or after which event, and what would prompt a review. Do not invent results.' },
      { id: 'revision', label: 'What changed, why, and what is the next step?', prompt: 'Keep the earlier version. Identify the new evidence or feedback, the changed decision and affected drawing, cost or care records. Record remaining checks and the next review.' },
    ],
    review: 'Ask what evidence would change the learner’s choice. Review a real explanation and revision record; filled boxes do not demonstrate competence or certify construction work.',
    example: 'The busy-yard case supplies no later field results. A learner can propose what to observe, but cannot claim that harvests, access or costs improved. Keep a monitoring plan separate from observed results.',
  },
] as const;

export type PortfolioAnswers = Record<string, string>;
const fieldIds = new Set<string>(PORTFOLIO_STAGES.flatMap(stage => stage.fields.map(field => field.id)));
export const PORTFOLIO_NOTICE = 'Design learning folder — English teaching preview. Notes are not a submitted assessment, a verified site survey or approval to implement a plan. Keep the actual drawings and evidence with this record.';

export function portfolioStorageKey(uid: string | null, sample: boolean) {
  return `imbewu:design-portfolio:v1:${sample ? 'sample' : uid ? `user:${uid}` : 'guest'}`;
}

export function readPortfolio(raw: string | null): PortfolioAnswers {
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid portfolio');
  const record = value as { version?: unknown; answers?: unknown };
  if (record.version !== 1 || !record.answers || typeof record.answers !== 'object' || Array.isArray(record.answers)) throw new Error('Unsupported portfolio');
  const answers: PortfolioAnswers = {};
  for (const [id, answer] of Object.entries(record.answers)) {
    // A newer or damaged draft must remain recoverable instead of being silently shortened on save.
    if (!fieldIds.has(id) || typeof answer !== 'string' || answer.length > PORTFOLIO_LIMIT) throw new Error('Unrecognised portfolio answer');
    answers[id] = answer;
  }
  return answers;
}

export function portfolioText(answers: PortfolioAnswers): string {
  return [PORTFOLIO_NOTICE, 'Paper or drawing references below are not attachments. Keep a separate copy of those sources.',
    ...PORTFOLIO_STAGES.flatMap(stage => [
      `${stage.id.toUpperCase()} — ${stage.title}`, stage.purpose,
      ...stage.fields.map(field => `${field.label}\n${field.prompt}\n\n${answers[field.id]?.trim() || '[Not yet recorded]'}`),
      `For discussion with a reviewer: ${stage.review}`,
    ]),
  ].join('\n\n') + '\n';
}
