// Lesson registry — the single wiring point that connects EVERYTHING the farmer does in the app
// (steps, elements, ground features, zones, drawn lines, crop planning, finances, community) to a
// short teaching lesson. Rory's ask: "anything we do on the app must connect to a lesson… a very
// brief lesson for everything now until we do it properly later."
//
// HOW IT STAYS LOW-MAINTENANCE:
//   • getLesson(id) is a TOTAL function — it always returns a MicroLesson, never null. Most
//     lessons are DERIVED for free from data that already exists (the element catalog's `tip`,
//     ground-feature labels, the zone key, line lore). Derived lessons carry `draft: true`.
//   • To upgrade any lesson to real teaching copy, add ONE entry to OVERRIDES below, keyed by the
//     same stable id. No UI code changes — every LessonLink in the app picks it up automatically,
//     and the "draft" badge disappears.
//
// LessonRef id grammar (stable — safe to hardcode in <LessonLink id="…"/>):
//   step:<base|water|zones|planting|structures|review>
//   element:<catalog id>          e.g. element:jojo_2500
//   feature:<ground feature kind> e.g. feature:driveway
//   zone:<0..5>                   e.g. zone:1
//   line:<swale|fence|path|pipe|drip|windbreak>
//   crops:planner  ·  finances:overview  ·  community:overview
//   map:overview  ·  surveys:overview  ·  print:planset

import type { StepLesson } from '@/lib/design-lessons';
import { DESIGN_STEP_LESSONS } from '@/lib/design-lessons';
import type { GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import {
  CATEGORY_META,
  ELEMENTS_BY_ID,
  GROUND_FEATURES,
  ZONE_KEY,
  type DesignElementDef,
  type ElementCategory,
} from '@/lib/design-elements';

/** A lesson is a superset of StepLesson so the existing <LessonPanel> renders it unchanged. */
export interface MicroLesson extends StepLesson {
  id: string;
  /** true = auto-derived placeholder (shows a "draft" hint until an OVERRIDE is written). */
  draft?: boolean;
}

// ── category → teaching context (used by derived element/line lessons) ───────────
const CATEGORY_PRINCIPLE: Record<ElementCategory, string> = {
  water: 'Catch and store energy — hold water high on your land and let it soak in slowly.',
  earthworks: 'Shape the land once, on contour, so water and soil stay where you put them.',
  structure: 'Integrate rather than segregate — site each building so what it makes feeds the next thing.',
  growing: 'Use and value diversity — the right plant in the right place needs far less work.',
  animal: 'Produce no waste — an animal’s manure is the next bed’s fertility.',
  access: 'Design from patterns to details — paths and gates decide how the whole site flows.',
};

const CATEGORY_MODULE: Partial<Record<ElementCategory, string>> = {
  water: 'water-harvesting',
  earthworks: 'water-harvesting',
  growing: 'food-forest',
  animal: 'small-livestock',
  // structure / access have no single best module — left unlinked until an OVERRIDE says otherwise.
};

function elementLesson(def: DesignElementDef): MicroLesson {
  const cat = CATEGORY_META[def.category];
  const zoneWords =
    def.zoneRec && def.zoneRec.length
      ? ` It usually belongs in ${def.zoneRec.map((z) => `Zone ${z}`).join(' or ')}.`
      : '';
  return {
    id: `element:${def.id}`,
    title: def.name,
    body: `${def.name} is part of your ${cat.label.toLowerCase()} layer.${zoneWords} Place it well and it works for you for years; place it badly and you fight it every season.`,
    principle: CATEGORY_PRINCIPLE[def.category],
    tip: def.tip,
    courseModuleId: CATEGORY_MODULE[def.category],
    draft: true,
  };
}

function featureLesson(kind: GroundFeatureKind): MicroLesson {
  const f = GROUND_FEATURES[kind];
  return {
    id: `feature:${kind}`,
    title: f.label,
    body: `${f.label} is something already on your land. Marking it accurately matters because every bed, path and zone you plan is measured against what is really there.`,
    principle: 'Observe and interact — record what exists before you change it.',
    tip: `Trace the real outline of your ${f.label.toLowerCase()} — the plan measures everything from it.`,
    courseModuleId: 'reading-landscape',
    draft: true,
  };
}

function zoneLesson(z: 0 | 1 | 2 | 3 | 4 | 5): MicroLesson {
  const k = ZONE_KEY.find((e) => e.z === z) ?? ZONE_KEY[0];
  const distance = z <= 1 ? 'closest to your kitchen door' : z >= 4 ? 'on the outer edges you visit least' : 'a short walk from the house';
  const cadence = z <= 1 ? 'most days' : z === 2 ? 'several times a week' : z === 3 ? 'about weekly' : 'now and then';
  return {
    id: `zone:${z}`,
    title: `Zone ${z} — ${k.label}`,
    body: `${k.desc}. Zone ${z} sits ${distance}. Zones plan your energy, not just your space — keep things you use ${cadence} at this distance and it cuts real walking time over a season.`,
    principle: 'Zone planning — the more often you use something, the closer it should live.',
    tip: z === 1
      ? 'Stand at your kitchen door and count 20 steps — the ground you can reach is Zone 1.'
      : `Reserve Zone ${z} for what you tend ${cadence}.`,
    courseModuleId: 'intro-permaculture',
    draft: true,
  };
}

// Short lore for each kind of line the farmer can draw.
const LINE_LORE: Record<LineShape['kind'], Omit<MicroLesson, 'id' | 'draft'>> = {
  greywater: {
    title: 'Greywater line — bath and laundry water, put to work',
    body: 'The run from the diverter at the house to the basins it feeds. Bath, shower and laundry water is most of a household\u2019s daily water and it leaves the house whether you use it or not. Buried just below the surface and discharged UNDER mulch, it waters fruit trees and bananas through the dry months for nothing.',
    principle: 'Every output is an input somewhere else — greywater is the easiest one to catch.',
    tip: 'Run it to the banana circles first, then on to the tree basins. Discharge below mulch, never onto edible leaves, and keep it out of the veg beds. No kitchen or toilet water on this line.',
    courseModuleId: 'water-harvesting',
  },
  swale: {
    title: 'Swale — a ditch on contour',
    body: 'A swale is a shallow level ditch dug ACROSS the slope. Rain runs into it, stops, and soaks down into the soil right where your trees and beds can reach it — instead of racing downhill and taking your topsoil with it.',
    principle: 'Slow it, spread it, sink it — every drop should walk, not run.',
    tip: 'Draw the line level end to end, above the beds and trees you want to water. Down-slope swales become erosion channels.',
    courseModuleId: 'water-harvesting',
  },
  drip: {
    title: 'Drip line — water to the roots',
    body: 'A drip line carries water straight to each plant’s roots, slowly, with almost nothing lost to evaporation. It is the most water-thrifty way to irrigate — vital in a dry South African season.',
    principle: 'Catch and store energy — then spend it where it counts, drop by drop.',
    tip: 'Run drip lines from your tank or tap to the veg beds along the shortest sensible path.',
    courseModuleId: 'water-harvesting',
  },
  pipe: {
    title: 'Pipe — moving water across the site',
    body: 'A pipe moves water under gravity or pump from where you store it to where you use it. Plan the run before you dig so it takes the shortest, lowest-fuss path.',
    principle: 'Catch and store energy — connect the store to the need.',
    tip: 'Keep pipe runs short and, where you can, let gravity do the work from an uphill tank.',
    courseModuleId: 'water-harvesting',
  },
  fence: {
    title: 'Fence — keeping in and keeping out',
    body: 'A fence protects young trees and beds from animals and marks who tends what. A living fence (spekboom, thorn hedge) does the same job while feeding the soil and stock.',
    principle: 'Use edges — a boundary is also a resource if you plant it.',
    tip: 'Fence the areas animals must stay out of first — a single browsing goat can undo a season overnight.',
  },
  path: {
    title: 'Path — how you move through it all',
    body: 'Paths decide how easily you work the land. Put them where your feet already go, wide enough for a wheelbarrow, and they save effort on every single trip.',
    principle: 'Design from patterns to details — the paths come before the beds.',
    tip: 'Walk your daily round first, then draw the paths along the lines you naturally take.',
  },
  windbreak: {
    title: 'Windbreak — a living shield',
    body: 'A row of tough trees or shrubs slows the wind, cutting the drying and damage it does to everything downwind. A good windbreak lifts yields across the whole area it shelters.',
    principle: 'Use and value diversity — a mixed windbreak shelters, feeds and hosts.',
    tip: 'Plant across the direction your hardest wind comes from; it shelters a strip about ten times its height.',
    courseModuleId: 'food-forest',
  },
};

function lineLesson(kind: LineShape['kind']): MicroLesson {
  return { id: `line:${kind}`, ...LINE_LORE[kind], draft: true };
}

// ── HAND-WRITTEN OVERRIDES ───────────────────────────────────────────────────────
// Add an entry here (same id) to replace any derived placeholder with real teaching copy; the
// "draft" hint then disappears automatically everywhere that lesson is shown. These three are the
// surfaces with no catalog to derive from, so they live here as brief starter lessons.
const OVERRIDES: Record<string, MicroLesson> = {
  'home:overview': {
    id: 'home:overview',
    title: 'Choose where to work',
    body: 'This is your starting point. Open the part of ImbewuField that matches the job in front of you, then return here when you need to change roles or tools.',
    principle: 'Design from patterns to details — begin with the job, then choose the tool.',
    tip: 'Start with the land map if this is a new site; start with your saved work if you are continuing a plan.',
  },
  'design:overview': {
    id: 'design:overview',
    title: 'Build the design one layer at a time',
    body: 'The Design Studio keeps your real site geometry underneath every layer. Work from the existing site through water, zones, planting and structures, then review before creating finished maps.',
    principle: 'Design from patterns to details — protect what is real, then add one system at a time.',
    tip: 'Finish the existing site and boundary first. Every later map depends on those shapes being accurate.',
    courseModuleId: 'reading-landscape',
  },
  'account:overview': {
    id: 'account:overview',
    title: 'Keep your account current',
    body: 'Your account connects your name, role and saved work. Accurate details help the app show the right tools and keep plans attached to the right person.',
    principle: 'Good records protect good work.',
    tip: 'Check your name, role and contact details whenever your responsibilities change.',
  },
  'crops:calendar': {
    id: 'crops:calendar',
    title: 'Work with the season',
    body: 'The calendar turns a crop plan into timely actions: sowing, transplanting, feeding, harvesting and follow-up. A useful plan tells you what needs attention next.',
    principle: 'Observe and interact — timing is part of every crop design.',
    tip: 'Review the coming two weeks, not only today, so seedlings and beds are ready in time.',
    courseModuleId: 'plant-guilds',
  },
  'journal:overview': {
    id: 'journal:overview',
    title: 'Record what the land teaches',
    body: 'The journal keeps observations, work completed and results together. These notes turn one season of experience into better decisions next season.',
    principle: 'Apply self-regulation and accept feedback — the land answers through results.',
    tip: 'Record the date, weather, action and result; those four details make a note useful later.',
  },
  'vision:overview': {
    id: 'vision:overview',
    title: 'Set the direction first',
    body: 'A clear vision helps every later design choice answer the same question: what should this land provide, for whom, and over what time?',
    principle: 'Design from patterns to details — agree on the destination before drawing the route.',
    tip: 'Write outcomes you can recognise on the ground, not only broad hopes.',
    courseModuleId: 'intro-permaculture',
  },
  'contact:overview': {
    id: 'contact:overview',
    title: 'Ask for help with context',
    body: 'A useful support message explains where you were, what you expected, what happened and which device you used.',
    principle: 'Clear observations make problems easier to solve.',
    tip: 'Include the page name and a screenshot whenever the issue is visual.',
  },
  'survey:garden': {
    id: 'survey:garden',
    title: 'Describe the garden as it is',
    body: 'This survey captures the real condition of the site so advice and support can respond to evidence rather than assumptions.',
    principle: 'Observe and interact — honest information is the beginning of useful help.',
    tip: 'Answer from what you can see and measure today; note anything you are unsure about.',
    courseModuleId: 'reading-landscape',
  },
  'student:overview': {
    id: 'student:overview',
    title: 'Learn, test, apply',
    body: 'Lessons explain the principle, short checks confirm understanding, and the Design Studio lets you apply it to a real site.',
    principle: 'Learning becomes valuable when it changes what you do.',
    tip: 'After each lesson, find one place in your own design where the principle applies.',
  },
  'mentor:overview': {
    id: 'mentor:overview',
    title: 'Guide with evidence',
    body: 'The mentor view brings learner progress and field work together so feedback can be specific, timely and grounded in the actual site.',
    principle: 'Observe first, then advise.',
    tip: 'Comment on one clear strength and one practical next step at a time.',
  },
  'ngo:overview': {
    id: 'ngo:overview',
    title: 'See progress across projects',
    body: 'The NGO view helps teams compare sites, surveys and outcomes without losing the local context behind each number.',
    principle: 'Measure patterns without erasing place.',
    tip: 'Use summaries to find where to look, then open the underlying site before acting.',
  },
  'funder:overview': {
    id: 'funder:overview',
    title: 'Follow evidence to outcomes',
    body: 'The funder view connects resources to visible plans, activity and results so support can be directed where it has the strongest effect.',
    principle: 'Obtain a yield — define and verify the change an investment should produce.',
    tip: 'Compare progress with the site plan and starting condition, not only a headline total.',
  },
  'facilitator:overview': {
    id: 'facilitator:overview',
    title: 'Keep field work moving',
    body: 'The facilitator view brings people, plans and follow-up tasks together so practical support reaches the right site at the right time.',
    principle: 'Integrate rather than segregate — connect learning, planning and field action.',
    tip: 'Check unresolved actions before starting a new round of work.',
  },
  'finances:invoices': {
    id: 'finances:invoices',
    title: 'Make every invoice traceable',
    body: 'An invoice should clearly connect who supplied what, when, in what quantity and at what price. That makes payment and later reporting much easier.',
    principle: 'Good records turn activity into evidence.',
    tip: 'Check names, dates, quantities and totals before sending.',
    courseModuleId: 'market-community',
  },
  'community:profile': {
    id: 'community:profile',
    title: 'Share enough to connect safely',
    body: 'Your community profile helps nearby farmers understand what you grow and what knowledge or surplus you may be able to share.',
    principle: 'Integrate rather than segregate — useful connections begin with useful context.',
    tip: 'Share your general area, not private household details or an exact home location.',
    courseModuleId: 'market-community',
  },
  'community:messages': {
    id: 'community:messages',
    title: 'Turn a message into cooperation',
    body: 'Clear, respectful messages make it easier to exchange seed, tools, knowledge and labour without misunderstandings.',
    principle: 'Cooperation grows through clear expectations.',
    tip: 'State what you need or offer, the approximate place and the time frame.',
    courseModuleId: 'market-community',
  },
  'crops:planner': {
    id: 'crops:planner',
    title: 'Planning what to grow',
    body: 'The crop planner turns your beds into a season plan: what to sow, when, and how much. Rotating families through your beds — leaf, then fruit, then root, then legume — keeps pests guessing and the soil fed.',
    principle: 'Use and value diversity — a rotation is a garden that heals itself.',
    tip: 'Never grow the same family in the same bed two seasons running.',
    courseModuleId: 'plant-guilds',
  },
  'finances:overview': {
    id: 'finances:overview',
    title: 'Making the numbers work',
    body: 'A farm that does not pay is a hobby. Track what you sell and what you spend so you can see, in real numbers, which crops and which choices actually earn — and put more energy there.',
    principle: 'Obtain a yield — a plan you can measure is a plan you can grow.',
    tip: 'Log every sale and every expense as it happens; a month of guessing hides your best and worst crops.',
    courseModuleId: 'market-community',
  },
  'community:overview': {
    id: 'community:overview',
    title: 'Growing together',
    body: 'No farmer thrives alone. Sharing seed, labour, tools and what you have learned multiplies every one of them. The community layer is where your plan meets other people’s.',
    principle: 'Integrate rather than segregate — a network of gardens beats a lonely one.',
    tip: 'Trade a surplus for a skill — the cheapest fertiliser is a neighbour who owes you a hand.',
    courseModuleId: 'market-community',
  },
  'map:overview': {
    id: 'map:overview',
    title: 'Read the land first',
    body: 'Tap anywhere on your land and the map reads it back to you: real rainfall, soil, slope and climate for that exact spot — not a guess. Look before you plan. The land already tells you what it wants; your job is to notice it. Save the place, then open the Design Studio to turn what you see into beds, water and trees.',
    principle: 'Observe and interact — read the land before you plan it.',
    tip: 'Tap your own plot, not the road — every reading is for the exact point you press.',
    courseModuleId: 'reading-landscape',
  },
  'surveys:overview': {
    id: 'surveys:overview',
    title: 'Why these surveys matter',
    body: 'The organisations you work with send these surveys to learn what is really happening on the ground. Your answers become the evidence they use to bring seed, tools, training and funding to farmers like you. Answer as it truly is — a hard season told plainly brings more help than a rosy one made up. A clear photo says more than a paragraph.',
    principle: 'Apply self-regulation and accept feedback — honest answers are how help finds you.',
    tip: 'Fill it in soon after the work, while the real numbers are still fresh in your head.',
    courseModuleId: 'market-community',
  },
  'print:planset': {
    id: 'print:planset',
    title: 'Your plan set',
    body: 'The plan set is your whole design as eight numbered sheets, from 01 Existing Site through to 08 Implementation & Phasing — the analysis first, then the design that answers it. Every sheet is drawn to exact scale by the app’s own rules, not by AI, so what you print is true to the metre. Save the PDF and put a real document in people’s hands. Give it to your extension officer, a funder or your mentor — a plan they can hold is a plan they can back.',
    principle: 'Design from patterns to details — the plan set shows the whole site before the single bed.',
    tip: 'Export the PDF and take it to your next meeting — a printed plan set is taken more seriously than a phone screen.',
  },
};

/** Total function: always returns a MicroLesson for any id. Unknown ids yield a safe generic. */
export function getLesson(id: string): MicroLesson {
  if (OVERRIDES[id]) return OVERRIDES[id];

  const sep = id.indexOf(':');
  const ns = sep === -1 ? id : id.slice(0, sep);
  const key = sep === -1 ? '' : id.slice(sep + 1);

  switch (ns) {
    case 'step': {
      const lesson = DESIGN_STEP_LESSONS[key as Exclude<WizardStep, 'glossy'>];
      if (lesson) return { id, ...lesson }; // step lessons are real copy — not draft
      break;
    }
    case 'element': {
      const def = ELEMENTS_BY_ID[key];
      if (def) return elementLesson(def);
      break;
    }
    case 'feature': {
      if (key in GROUND_FEATURES) return featureLesson(key as GroundFeatureKind);
      break;
    }
    case 'zone': {
      const z = Number(key);
      if (Number.isFinite(z) && z >= 0 && z <= 5) return zoneLesson(z as 0 | 1 | 2 | 3 | 4 | 5);
      break;
    }
    case 'line': {
      if (key in LINE_LORE) return lineLesson(key as LineShape['kind']);
      break;
    }
  }

  // Safe generic — a link is never dead even if a caller passes an id we don't know yet.
  return {
    id,
    title: 'About this',
    body: 'A short lesson for this part of your plan is on the way.',
    principle: 'Every choice on your land is a chance to learn.',
    tip: 'Keep going — you can always come back to this.',
    draft: true,
  };
}
