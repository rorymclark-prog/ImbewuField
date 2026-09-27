/**
 * A proposed ACT delivery rehearsal, adapted from the reserve facilitator guide and
 * the unmerged five-day Teach the Teachers draft. Two days cannot assess every
 * permaculture skill in the core course or establish a facilitator credential.
 */
export interface RefresherSession {
  time: string;
  title: string;
  outcome: string;
  run: string[];
  app?: { label: string; href: string; task: string };
  paper: string;
  evidence: string;
}

export interface RefresherDay {
  number: 1 | 2;
  theme: string;
  promise: string;
  sessions: RefresherSession[];
}

export const ACT_FACILITATOR_DAYS: RefresherDay[] = [
  {
    number: 1,
    theme: 'Make the learning visible',
    promise: 'Each participant plans and tries a short lesson that starts with a farmer’s observation.',
    sessions: [
      {
        time: '09:00–09:30', title: 'Welcome and learning agreement',
        outcome: 'Name the group’s language, access and practical learning needs.',
        run: [
          'Invite each person to share one farm question and one teaching concern. Offer a spoken or drawn response.',
          'Agree how to ask questions, share time and give feedback. Explain attendance separately from photo or app consent.',
        ],
        paper: 'Register and a blank flipchart for the group agreement.',
        evidence: 'A group agreement and a list of questions to revisit.',
      },
      {
        time: '09:30–10:30', title: 'Model a lesson: look, try, talk, take home',
        outcome: 'Identify what the learner does at each part of a practical lesson.',
        run: [
          'Use two prepared photos or soil samples from a permitted practice site. Ask what is visible before offering an explanation.',
          'Let pairs describe one observation and one uncertainty; then model a safe action whose exact core-lesson source and local limits you have checked.',
          'Unpack the teaching method: What did learners see, try, discuss and plan to check later?',
        ],
        app: { label: 'Open the core Study course', href: '/student', task: 'Choose an available Introduction or Reading the Landscape lesson. Compare its words and media with what you can actually observe outside.' },
        paper: 'Use a printed course still and the same four prompts when signal or a device is unavailable.',
        evidence: 'Each pair can state an observation, an inference and an unknown separately.',
      },
      {
        time: '10:30–10:45', title: 'Break', outcome: '', run: [], paper: '', evidence: '',
      },
      {
        time: '10:45–12:15', title: 'Refresh the agroecology course in the field',
        outcome: 'Connect land, water, soil and planting as decisions rather than isolated facts.',
        run: [
          'Walk a permitted site or use a supplied fictional site. Mark what was measured, reported, estimated and still unknown.',
          'Ask groups to trace a possible water route, identify where soil is exposed and explain one planting question that needs local checking.',
          'Return to the core modules for the relevant teaching point. Do not turn an illustration into proof of a site condition.',
        ],
        app: { label: 'Use the mapping guide', href: '/student/guides/mapping', task: 'Practise finding and reopening a trainer-provided demo site; keep proposed features distinct from observed ones.' },
        paper: 'Draw the same site on paper and mark every uncertain feature with a question mark.',
        evidence: 'A site sketch with sources and unknowns, plus one justified question for a farmer.',
      },
      {
        time: '12:15–13:00', title: 'Lunch', outcome: '', run: [], paper: '', evidence: '',
      },
      {
        time: '13:00–14:00', title: 'Try the app as a learner',
        outcome: 'Open a lesson, change language, test media and prepare an offline fallback.',
        run: [
          'In pairs, open My Studies, choose an available lesson, play a slide and its narration, then find the written explanation and question.',
          'Change language in Settings. Check the language shown on the written lesson, slide and narrator separately; a machine draft or English fallback must be named honestly.',
          'Save an available lesson to the phone and test it briefly without signal while still at the venue.',
        ],
        app: { label: 'Follow the offline learning guide', href: '/student/guides/offline-learning', task: 'Test on a trainer device or demo account; do not sign in as a farmer or use someone else’s records.' },
        paper: 'Use the printed still, transcript and question if the app or download fails.',
        evidence: 'Each pair can show its chosen lesson and explain its language and offline limits.',
      },
      {
        time: '14:00–14:15', title: 'Break', outcome: '', run: [], paper: '', evidence: '',
      },
      {
        time: '14:15–15:40', title: 'First teach-back in pairs',
        outcome: 'Give every participant a turn to facilitate and receive specific feedback.',
        run: [
          'Pairs choose one core lesson whose action and local limits have been checked. Each person leads a short section with a question, a learner action and a check for understanding.',
          'Observers record what the learner did, what the facilitator asked, whose voice was missing and where advice needed a local check.',
          'Repeat one part after feedback. Use the app, a still or a real object; the learning action stays the same.',
        ],
        paper: 'Printed lesson card and observer sheet; arrange parallel small groups so everyone teaches.',
        evidence: 'One observation note and one revised teaching move per person.',
      },
      {
        time: '15:40–16:00', title: 'Close and prepare for Day 2',
        outcome: 'Choose a specific facilitation skill to improve tomorrow.',
        run: ['Ask for one useful change and one unanswered question. Invite spoken, written or drawn reflection.'],
        paper: 'Collect question cards and keep the group agreement visible.',
        evidence: 'A personal practice goal, without a competence or certificate claim.',
      },
    ],
  },
  {
    number: 2,
    theme: 'Practise, assess and hand over',
    promise: 'Each participant leads part of a real core lesson and leaves with a practical delivery plan.',
    sessions: [
      {
        time: '09:00–09:30', title: 'Revisit questions and demonstrate a good check',
        outcome: 'Distinguish a learner’s explanation from a demonstrated action.',
        run: [
          'Return to Day 1 questions. Name the ones that need a local practitioner, measurement or source before advice is given.',
          'Ask a volunteer to explain a method; then ask what action an observer would need to see before calling it demonstrated.',
        ],
        paper: 'Question cards and an observation checklist.',
        evidence: 'One clear evidence rule for the lesson chosen by each group.',
      },
      {
        time: '09:30–10:30', title: 'Run a practical without leaving people watching',
        outcome: 'Assign a role and a safe action to every learner.',
        run: [
          'Model a simple soil, water or seed observation using local materials after checking the method and site; pause if the action is unsafe.',
          'Groups redesign a trainer demonstration so learners handle, point, sort, explain or record something themselves.',
          'Check accessibility: a learner can answer orally or by drawing and can opt out of a photo.',
        ],
        app: { label: 'Open field evidence guide', href: '/student/guides/evidence', task: 'Compare a practice observation with a photo or report; a photo alone does not establish competence or a farm outcome.' },
        paper: 'Use real objects or printed photos with a source label and a simple observation sheet.',
        evidence: 'A revised practical with a safe role for each learner.',
      },
      {
        time: '10:30–10:45', title: 'Break', outcome: '', run: [], paper: '', evidence: '',
      },
      {
        time: '10:45–12:15', title: 'App and paper practice: a farm decision',
        outcome: 'Guide a learner through evidence, a choice and a justified next step.',
        run: [
          'Use a supplied practice site or a consenting participant’s own site. Label every entry as demo or real before entering it.',
          'Compare an observation with a proposed design. Keep measurements, plant names, water and animal advice within the checked core lesson.',
          'Discuss what to do when media is inaccurate, the translation is unclear, the app is offline or the answer is unknown.',
        ],
        app: { label: 'Open the design learning pathway', href: '/student/design', task: 'Try a worked practice case and explain what remains to verify before any real construction or purchase.' },
        paper: 'Use the same case on a printed base map; do not enter a private household’s data into a shared trainer device.',
        evidence: 'One proposed next step with its evidence and unresolved checks.',
      },
      {
        time: '12:15–13:00', title: 'Lunch', outcome: '', run: [], paper: '', evidence: '',
      },
      {
        time: '13:00–14:15', title: 'Plan a short farmer lesson',
        outcome: 'Prepare an outcome, activity, question and paper fallback.',
        run: [
          'Pairs choose one core module that fits their ACT group. Plan a short session with look, try, talk and take home.',
          'Identify the local language to use, the exact English source when a translation is a draft, materials, access support and a stop point for unsafe or unverified advice.',
          'Agree who will lead each part; prepare one question that reveals learning rather than recall.',
        ],
        app: { label: 'Reopen the Study course', href: '/student', task: 'Open the lesson you will teach and check that its written text, slide and narration say what your plan assumes.' },
        paper: 'Write the same plan on one sheet and keep a printed lesson still ready.',
        evidence: 'A one-page lesson plan that another facilitator can follow.',
      },
      {
        time: '14:15–14:30', title: 'Break', outcome: '', run: [], paper: '', evidence: '',
      },
      {
        time: '14:30–15:35', title: 'Final teach-back and observation',
        outcome: 'Observe a learner action and revise the next teaching move.',
        run: [
          'Run parallel teach-backs so each participant leads part of the lesson. Peers play learners and ask realistic questions.',
          'The observer records what was seen: invitation to participate, safe practical action, source/uncertainty, check for understanding and response to feedback.',
          'Give one supported strength and one specific next practice step. A retry is part of the course.',
        ],
        paper: 'Use printed lesson cards and observation sheets if devices are unavailable.',
        evidence: 'An observation record per participant, marked practised or needs another attempt—not a professional qualification.',
      },
      {
        time: '15:35–16:00', title: 'ACT delivery plan and close',
        outcome: 'Name the next session, support needed and follow-up owner.',
        run: [
          'Each pair names its first ACT teaching session, venue materials, language support, app/offline check, co-facilitator and follow-up date.',
          'Keep attendance, consent, skill observation and any programme certificate decision as separate records under ACT’s policy.',
        ],
        paper: 'Take home the one-page plan and a printed lesson card.',
        evidence: 'A delivery plan with owners and unresolved support requests.',
      },
    ],
  },
];

export const ACT_OBSERVATION_CRITERIA = [
  'Invites the learner’s existing experience and uses a language the group can follow.',
  'Shows an observation or source-checked action, then lets learners try or explain it.',
  'Keeps measured facts, reported facts, estimates and unknowns distinct.',
  'Checks the actual lesson, slide and narration before using them; names draft translations.',
  'Pauses unsafe or unverified farming advice and identifies the next source or practitioner check.',
  'Asks a question or observes an action that shows learning, then offers another attempt.',
] as const;
