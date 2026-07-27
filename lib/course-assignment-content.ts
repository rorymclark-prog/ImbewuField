// AUTHORED assignment content for the 10 course modules + the capstone.
//
// This is CONTENT, not logic: every prompt describes real work on real land, and every
// self-check item is something a farmer can tick by looking at their own land or their own
// photograph. It was authored and paced by Rory (Imbewu Yoshintso NPC) against South African
// conditions — figures, timings and practices are his, not generated. Do NOT rewrite, "tidy",
// or regenerate any of it, and do not add items that require reading a document.
//
// A NOTE ON WRITING, since it looks like an exception to the no-typing rule: three modules
// legitimately involve a pen — labelling seed envelopes, keeping a harvest record, and sketching
// zones/site maps/guilds. Those ARE the practice being taught, and they happen on paper or on the
// land and are then photographed. The app itself still asks a farmer to type nothing, anywhere:
// the submission screen is a tick list plus a photo plus an optional voice note. That constraint
// is unchanged and load-bearing (low-literacy, isiZulu-first audience).
//
// minGateDays is the realistic minimum number of days the real-world task needs (compost has to
// actually rot; you have to wait for rain to watch water move). It is INFORMATIONAL — it is shown
// to set expectations and it never blocks a submission or locks a farmer out. Total: 70 module
// days + 10 capstone = 80 days at the fastest realistic pace, which is why the course spans
// roughly nine months in practice despite holding only about four hours of reading.

export interface ModuleAssignment {
  moduleId: string;
  /** Optional display title — only the capstone carries one; modules use their own title. */
  title?: string;
  /** What the farmer physically does, in plain language. */
  prompt: string;
  /** Tickable from looking at their own land or photo — never from reading a document. */
  selfCheckItems: string[];
  /** Realistic minimum days the real work needs. Informational only; never gates or blocks. */
  minGateDays: number;
}

export const MODULE_ASSIGNMENTS: ModuleAssignment[] = [
  {
    moduleId: 'intro-permaculture',
    prompt:
      'Draw your zones. Mark your house, then the areas you visit every day, every week, and hardly ever. Photograph your drawing.',
    selfCheckItems: [
      'My house or kitchen door is marked on the drawing',
      'I have marked at least Zone 1 and Zone 2',
      'Zone 1 is the area closest to my door',
    ],
    minGateDays: 2,
  },
  {
    moduleId: 'reading-landscape',
    prompt:
      'Make a simple site map. Mark north, your buildings, your water, and where rain runs across your land. Photograph it.',
    selfCheckItems: [
      'North is marked on my map',
      'I have marked where water runs or collects when it rains',
      'I have marked which way my strongest wind comes from',
      'I walked my land during or just after rain to see the water',
    ],
    minGateDays: 10,
  },
  {
    moduleId: 'water-harvesting',
    prompt:
      'Build an A-frame level from three poles and a weighted string. Use it to find one level line across your slope. Photograph the A-frame and the line you marked.',
    selfCheckItems: [
      'My A-frame is built and I have tested it (turn it around — it should read the same)',
      'I have marked at least three points at the same height across my slope',
      'My marked line runs across the slope, not down it',
    ],
    minGateDays: 5,
  },
  {
    moduleId: 'soil-health',
    prompt:
      'Start a compost heap. Layer your browns and greens. Photograph it when you build it, then photograph it again after your first turn.',
    selfCheckItems: [
      'I layered dry brown material and fresh green material',
      'My heap is moist, not wet',
      'I turned it after five to seven days',
      'I kept meat, dairy, and wattle seed pods out of the heap',
    ],
    minGateDays: 14,
  },
  {
    moduleId: 'vegetables-staples',
    prompt: 'Prepare and plant one bed, about 1.2m wide and 3m long. Photograph it planted.',
    selfCheckItems: [
      'My bed is about 1.2m wide, so I can reach the middle from both sides',
      'I have not walked on the growing area',
      'I spaced my plants for my climate, not the smallest spacing on the packet',
      'I have mulched the bed',
    ],
    minGateDays: 10,
  },
  {
    moduleId: 'seeds-sovereignty',
    prompt:
      'Set up your seed storage. Paper envelopes, labelled, in a cool dark dry container. Photograph it, and say which plant you will save seed from this season.',
    selfCheckItems: [
      'I am using paper envelopes, not plastic',
      'Every envelope is labelled with the crop and the date',
      'My container is somewhere cool, dark, and dry',
      'I have chosen which plant I am saving seed from — my healthiest one',
    ],
    minGateDays: 5,
  },
  {
    moduleId: 'plant-guilds',
    prompt:
      'Choose one tree on your land. Draw a guild around it — what you would plant for nitrogen, for mulch, for pest control, and for ground cover. Photograph your drawing.',
    selfCheckItems: [
      'I have named my central tree',
      'I have chosen at least one nitrogen-fixing plant',
      'I have chosen at least one plant for pest control',
      'I have chosen something to cover the ground',
    ],
    minGateDays: 5,
  },
  {
    moduleId: 'food-forest',
    prompt:
      'Write a species list for your own climate zone. Name what you would plant in each layer, from canopy down to ground cover. Photograph your list.',
    selfCheckItems: [
      'I know my region — Highveld, KZN coast, Lowveld, or other',
      'I have named plants for at least three different layers',
      'At least a third of my list is indigenous',
      'I have checked nothing on my list is a listed invasive plant',
    ],
    minGateDays: 7,
  },
  {
    moduleId: 'small-livestock',
    prompt:
      'Photograph your chicken housing, hive, or animal area. If you have no animals yet, draw where they would go and how they would move across your land.',
    selfCheckItems: [
      'I have shown where the animals are kept or would be kept',
      'I have thought about how they move — rotation, not one fixed spot',
      'I have kept them away from young seedlings',
      'If I keep bees, I know I must register with DALRRD',
    ],
    minGateDays: 7,
  },
  {
    moduleId: 'market-community',
    prompt:
      'Start a record sheet. Write down what you harvested this week and where it went — family, sold, or shared. Photograph it.',
    selfCheckItems: [
      'I have recorded at least one harvest',
      'I wrote down where it went — family, sold, gifted, or composted',
      'I have somewhere to keep this record going',
    ],
    minGateDays: 5,
  },
];

/** The capstone is completed in the existing Design Studio — it is not a separate tool. */
export const CAPSTONE: ModuleAssignment = {
  moduleId: 'capstone',
  title: 'Your Site Plan',
  prompt:
    'Complete your plan in the Design Studio. Your boundary, your water, your zones, your planting, your structures. Export the plan set and print it.',
  selfCheckItems: [
    'My boundary is traced and my buildings are marked',
    'I have placed my water — tanks, swales, or basins',
    'My zones are marked',
    'I have placed my trees and beds',
    'I have exported the plan set',
  ],
  minGateDays: 10,
};

/** Assignment for a module id, or undefined when none is authored yet. */
export function assignmentFor(moduleId: string): ModuleAssignment | undefined {
  return MODULE_ASSIGNMENTS.find((a) => a.moduleId === moduleId);
}

/** Fastest realistic completion in days: every module's real work plus the capstone. */
export function minimumCourseDays(): number {
  return MODULE_ASSIGNMENTS.reduce((sum, a) => sum + a.minGateDays, 0) + CAPSTONE.minGateDays;
}
