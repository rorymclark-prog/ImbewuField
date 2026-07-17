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
    body: `${k.desc}. Zone ${z} sits ${distance}. Zones plan your energy, not just your space — keep things you use ${cadence} at this distance and you save yourself hundreds of walking hours a year.`,
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
  'crops:planner': {
    id: 'crops:planner',
    title: 'Planning what to grow',
    body: 'The crop planner turns your beds into a season plan: what to sow, when, and how much. Rotating families through your beds — leaf, then fruit, then root, then legume — keeps pests guessing and the soil fed.',
    principle: 'Use and value diversity — a rotation is a garden that heals itself.',
    tip: 'Never grow the same family in the same bed two seasons running.',
    courseModuleId: 'plant-guilds',
    draft: true,
  },
  'finances:overview': {
    id: 'finances:overview',
    title: 'Making the numbers work',
    body: 'A farm that does not pay is a hobby. Track what you sell and what you spend so you can see, in real numbers, which crops and which choices actually earn — and put more energy there.',
    principle: 'Obtain a yield — a plan you can measure is a plan you can grow.',
    tip: 'Log every sale and every expense as it happens; a month of guessing hides your best and worst crops.',
    courseModuleId: 'market-community',
    draft: true,
  },
  'community:overview': {
    id: 'community:overview',
    title: 'Growing together',
    body: 'No farmer thrives alone. Sharing seed, labour, tools and what you have learned multiplies every one of them. The community layer is where your plan meets other people’s.',
    principle: 'Integrate rather than segregate — a network of gardens beats a lonely one.',
    tip: 'Trade a surplus for a skill — the cheapest fertiliser is a neighbour who owes you a hand.',
    courseModuleId: 'market-community',
    draft: true,
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
