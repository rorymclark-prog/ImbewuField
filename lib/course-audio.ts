// Course narration — pre-recorded audio for a module, per language.
//
// WHY THIS EXISTS: lib/tts.ts reads lessons aloud with the browser's SpeechSynthesis API and
// its own header is honest that this barely works for South African languages — most devices
// ship no isiZulu voice at all, so isiZulu text gets read out in an English voice or not at
// all. Pre-recorded narration side-steps the device entirely. Where a recording exists it is
// always better than SpeechSynthesis; where one doesn't, the old path still stands.
//
// The recordings are narrated from the facilitator deck, one clip per slide, so a module's
// audio is a short ordered playlist rather than one long file. That is deliberate: a learner
// on a metered rural connection downloads the two minutes they want, not fifteen.
//
// Adding a module: run `node scripts/import-course-audio.mjs <moduleId> <exportDir>`, then
// paste the block it prints below and fill in the titles and lesson ids.
//
// PURE MODULE — no react, no firebase, no fetch. Just the manifest and lookups over it.

export interface NarrationTrack {
  /** Slide number in the facilitator deck. Also the filename: slide-07.mp3. */
  slide: number;
  /** English title. */
  title: string;
  /** Per-language title, so a learner listening in isiZulu reads isiZulu track names. */
  titleByLang?: Record<string, string>;
  /** Lesson this slide belongs to, or null for module-level intro/recap. */
  lesson: string | null;
}

export interface ModuleNarration {
  /** Recorded languages, best first. Codes match lib/tts.ts LANG_TO_BCP47 keys. */
  languages: string[];
  tracks: NarrationTrack[];
  /**
   * Optional absolute origin for the files. Unset = served from this app's own /public.
   * Set it when a module's audio moves to Firebase Storage or a CDN — the whole point of
   * routing every URL through trackUrl() is that the move is a one-line data change and no
   * component needs touching.
   */
  baseUrl?: string;
}

/** Keyed by module id from lib/course-modules.ts. A module absent here simply has no
 *  recording yet — that is the normal state, not an error. */
export const COURSE_NARRATION: Record<string, ModuleNarration> = {
  'seeds-sovereignty': {
    languages: ['zu', 'en'],
    // 24 slides, re-recorded 2026-07-28 to match the rewritten home-study scripts in
    // docs/narration/. The earlier 10-clip take was cut from a 10-slide deck written in
    // FACILITATOR voice — it addressed "the participants" and told the listener to pause the
    // animation so the group could discuss, on a module a farmer studies alone on a phone.
    // Voices: en-ZA-LeahNeural and zu-ZA-ThandoNeural at rate 0.88. Verified here rather than
    // trusted: each clip's duration divided by its script block's word count came out at
    // 2.00 w/s (sd 0.15) for English and 1.19 w/s (sd 0.07) for isiZulu. The isiZulu figure is
    // lower because the language is agglutinative — one word carries what English needs three
    // or four for — and the TIGHTNESS, not the rate, is what proves no clip was cut from the
    // wrong block.
    tracks: [
      // The isiZulu here is REUSED VERBATIM from slide 6's reviewer-signed title for "Seed
      // Sovereignty". It is not a new translation of the fuller English cover title: nothing in
      // this reviewed script renders "Seeds and Seed Sovereignty" as a phrase, and composing one
      // would be coining a term inside the only file a first-language speaker has signed off.
      // The reviewer may want the longer form; this is the safe stand-in until they say so.
      { slide: 1,   lesson: null,                        title: 'Seeds and Seed Sovereignty',                  titleByLang: { zu: 'Ubukhosi Bembewu' } },
      { slide: 2,   lesson: 'seeds-sovereignty-l1',      title: 'Why Saving Seed Matters',                     titleByLang: { zu: 'Kungani Ukulondoloza Imbewu Kubalulekile' } },
      { slide: 3,   lesson: null,                        title: 'Learning Outcomes',                           titleByLang: { zu: 'Imiphumela Yokufunda' } },
      { slide: 4,   lesson: 'seeds-sovereignty-l1',      title: 'Open-Pollinated Seed and F1 Seed',            titleByLang: { zu: 'Imbewu Evulekele Impova Ne-F1' } },
      { slide: 5,   lesson: 'seeds-sovereignty-l1',      title: 'Watch: Open-Pollinated Seed and F1 Seed',     titleByLang: { zu: 'Buka: Imbewu Evulekele Impova Ne-F1' } },
      { slide: 6,   lesson: 'seeds-sovereignty-l1',      title: 'Seed Sovereignty',                            titleByLang: { zu: 'Ubukhosi Bembewu' } },
      { slide: 7,   lesson: 'seeds-sovereignty-l1',      title: 'Watch: Household Seed Network',               titleByLang: { zu: 'Buka: Inethiwekhi Yembewu Yasemakhaya' } },
      { slide: 8,   lesson: 'seeds-sovereignty-l1',      title: 'Select Several Parent Plants',                titleByLang: { zu: 'Khetha Izitshalo Zabazali Eziningana' } },
      { slide: 9,   lesson: 'seeds-sovereignty-l1',      title: 'Control Pollination',                         titleByLang: { zu: 'Lawula Impova' } },
      { slide: 10,  lesson: 'seeds-sovereignty-l1',      title: 'Watch: Self-Pollination and Crossing',        titleByLang: { zu: 'Buka: Ukuzithuthela Impova Nokuxubana' } },
      { slide: 11,  lesson: 'seeds-sovereignty-l2',      title: 'Dry and Wet Processing',                      titleByLang: { zu: 'Indlela Eyomile Nendlela Emanzi' } },
      { slide: 12,  lesson: 'seeds-sovereignty-l2',      title: 'Process Dry Seed',                            titleByLang: { zu: 'Lungisa Imbewu Eyomile' } },
      { slide: 13,  lesson: 'seeds-sovereignty-l2',      title: 'Watch: Dry Processing',                       titleByLang: { zu: 'Buka: Indlela Eyomile' } },
      { slide: 14,  lesson: 'seeds-sovereignty-l2',      title: 'Wet Processing for Tomato Seed',              titleByLang: { zu: 'Indlela Emanzi Katamatisi' } },
      { slide: 15,  lesson: 'seeds-sovereignty-l2',      title: 'Watch: Wet Processing for Tomato Seed',       titleByLang: { zu: 'Buka: Indlela Emanzi Katamatisi' } },
      { slide: 16,  lesson: 'seeds-sovereignty-l2',      title: 'Practical Activity',                          titleByLang: { zu: 'Umsebenzi Wokwenza' } },
      { slide: 17,  lesson: 'seeds-sovereignty-l3',      title: 'Dry First, Seal Later',                       titleByLang: { zu: 'Yomisa Kuqala, Vala Kamuva' } },
      { slide: 18,  lesson: 'seeds-sovereignty-l3',      title: 'Protect Seed from Heat, Light and Moisture',  titleByLang: { zu: 'Vikela Imbewu Ekushiseni, Ekukhanyeni Nakwumswakama' } },
      { slide: 19,  lesson: 'seeds-sovereignty-l3',      title: 'Label Every Packet',                          titleByLang: { zu: 'Bhala Imininingwane Ephaketheni' } },
      { slide: 20,  lesson: 'seeds-sovereignty-l3',      title: 'Ten-Seed Germination Test',                   titleByLang: { zu: 'Hlola Ukuhluma Kwembewu Eyishumi' } },
      { slide: 21,  lesson: 'seeds-sovereignty-l3',      title: 'Watch: Ten-Seed Germination Test',            titleByLang: { zu: 'Buka: Ukuhlolwa Kwembewu Eyishumi' } },
      { slide: 22,  lesson: 'seeds-sovereignty-l3',      title: 'Share Seed with Its Information',             titleByLang: { zu: 'Yabelana Ngembewu Kanye Nolwazi' } },
      { slide: 23,  lesson: null,                        title: 'Field Assignment',                            titleByLang: { zu: 'Umsebenzi Wasensimini' } },
      { slide: 24,  lesson: null,                        title: 'Field Action',                                titleByLang: { zu: 'Isenzo Sasensimini' } },
    ],
  },
  'intro-permaculture': {
    languages: ['en'],
    // 22 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural (Antigravity's batch run) and
    // verified by import-course-audio: 22/22 clips matched their script blocks, median 3.22 w/s.
    // NOTE the voice differs from seeds-sovereignty's en-ZA-LeahNeural — the eight modules
    // recorded after this one share Luke, so seeds is the odd one out; Rory decides whether to
    // re-record seeds EN for a single course voice.
    tracks: [
      { slide: 1,  lesson: null,                    title: 'Introduction to Permaculture' },
      { slide: 2,  lesson: null,                    title: 'Why This Matters' },
      { slide: 3,  lesson: null,                    title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'intro-permaculture-l1', title: 'Earth Care' },
      { slide: 5,  lesson: 'intro-permaculture-l1', title: 'People Care' },
      { slide: 6,  lesson: 'intro-permaculture-l1', title: 'Fair Share' },
      { slide: 7,  lesson: 'intro-permaculture-l1', title: 'Watch: One Decision, Three Ethics' },
      { slide: 8,  lesson: 'intro-permaculture-l1', title: 'When There Is No Rulebook' },
      { slide: 9,  lesson: 'intro-permaculture-l2', title: 'Twelve Principles' },
      { slide: 10, lesson: 'intro-permaculture-l2', title: 'Observe and Interact' },
      { slide: 11, lesson: 'intro-permaculture-l2', title: 'Catch and Store Energy' },
      { slide: 12, lesson: 'intro-permaculture-l2', title: 'Use Edges and Value the Marginal' },
      { slide: 13, lesson: 'intro-permaculture-l2', title: 'Watch: Diversity Against One Bad Day' },
      { slide: 14, lesson: 'intro-permaculture-l2', title: 'Integrate Rather Than Segregate' },
      { slide: 15, lesson: 'intro-permaculture-l3', title: 'Zones: Organising by How Often You Visit' },
      { slide: 16, lesson: 'intro-permaculture-l3', title: 'Why Zone 1 Is Not Negotiable' },
      { slide: 17, lesson: 'intro-permaculture-l3', title: 'Zones Plan Your Labour' },
      { slide: 18, lesson: 'intro-permaculture-l3', title: 'Sectors: The Energies Arriving From Outside' },
      { slide: 19, lesson: 'intro-permaculture-l3', title: 'Watch: A Windbreak Belongs On The Wind Side' },
      { slide: 20, lesson: 'intro-permaculture-l3', title: 'Sketch It And You Have A Design' },
      { slide: 21, lesson: null,                    title: 'Field Assignment' },
      { slide: 22, lesson: null,                    title: 'Field Action' },
    ],
  },
  'reading-landscape': {
    languages: ['en'],
    // 21 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    // This deck labels its own boundaries — slides 4, 8, 12 and 16 open "Lesson 1" to "Lesson 4" —
    // so the mapping below is read off the slides rather than inferred.
    tracks: [
      { slide: 1,  lesson: null,                   title: 'Reading the Landscape' },
      { slide: 2,  lesson: null,                   title: 'Why This Matters' },
      { slide: 3,  lesson: null,                   title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'reading-landscape-l1', title: 'Lesson 1: Where Rain Goes' },
      { slide: 5,  lesson: 'reading-landscape-l1', title: 'Watch: Water Slows, Sinks, and Leaves' },
      { slide: 6,  lesson: 'reading-landscape-l1', title: 'Trace Contours with an A-Frame' },
      { slide: 7,  lesson: 'reading-landscape-l1', title: 'Slow It High, Sink It Mid, Control It Low' },
      { slide: 8,  lesson: 'reading-landscape-l2', title: 'Lesson 2: Read Sun and Shade' },
      { slide: 9,  lesson: 'reading-landscape-l2', title: 'Watch: Follow the Sun Across the Site' },
      { slide: 10, lesson: 'reading-landscape-l2', title: 'Check Winter Shadows Before Building' },
      { slide: 11, lesson: 'reading-landscape-l2', title: 'Protect Frost-Tender Plants' },
      { slide: 12, lesson: 'reading-landscape-l3', title: 'Lesson 3: Read Wind, Frost, and Slope' },
      { slide: 13, lesson: 'reading-landscape-l3', title: 'Watch: See Wind and Cold Air on the Map' },
      { slide: 14, lesson: 'reading-landscape-l3', title: 'Frost Flows Downhill' },
      { slide: 15, lesson: 'reading-landscape-l3', title: 'Choose Airflow and Warmth' },
      { slide: 16, lesson: 'reading-landscape-l4', title: 'Lesson 4: Start Your Site Map' },
      { slide: 17, lesson: 'reading-landscape-l4', title: 'Watch: Draw the Land You Already Have' },
      { slide: 18, lesson: 'reading-landscape-l4', title: 'Let Plants Help You Read Soil' },
      { slide: 19, lesson: 'reading-landscape-l4', title: 'Add Seasons, Zones, and Sectors' },
      { slide: 20, lesson: null,                   title: 'Field Assignment' },
      { slide: 21, lesson: null,                   title: 'Field Action' },
    ],
  },
  'water-harvesting': {
    languages: ['en'],
    // 24 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    // No "Why This Matters" slide here: slide 2 is Learning Outcomes covering all four lessons, and
    // slide 24 "Check Your Work" is the field-action self-check. Both sit at module level.
    tracks: [
      { slide: 1,  lesson: null,                  title: 'Water Harvesting' },
      { slide: 2,  lesson: null,                  title: 'Learning Outcomes' },
      { slide: 3,  lesson: 'water-harvesting-l1', title: 'Swales Slow Water on the Slope' },
      { slide: 4,  lesson: 'water-harvesting-l1', title: 'Watch: A Swale Sinks Water' },
      { slide: 5,  lesson: 'water-harvesting-l1', title: 'Plant on the Downhill Berm' },
      { slide: 6,  lesson: 'water-harvesting-l1', title: 'Storms Need a Safe Overflow' },
      { slide: 7,  lesson: 'water-harvesting-l1', title: 'Watch: The Overflow Point' },
      { slide: 8,  lesson: 'water-harvesting-l1', title: 'Know When Swales Fit the Slope' },
      { slide: 9,  lesson: 'water-harvesting-l1', title: 'Watch: Vetiver Takes Over' },
      { slide: 10, lesson: 'water-harvesting-l2', title: 'Store Rain for the Dry Season' },
      { slide: 11, lesson: 'water-harvesting-l2', title: 'Design the Spillway Before the Wall' },
      { slide: 12, lesson: 'water-harvesting-l2', title: 'Watch: Dam and Spillway' },
      { slide: 13, lesson: 'water-harvesting-l2', title: 'Turn a Dam into a Working Ecosystem' },
      { slide: 14, lesson: 'water-harvesting-l3', title: 'Your Roof Is a Harvesting Surface' },
      { slide: 15, lesson: 'water-harvesting-l3', title: 'Divert the Dirty First Flush' },
      { slide: 16, lesson: 'water-harvesting-l3', title: 'Watch: First Flush to Tank' },
      { slide: 17, lesson: 'water-harvesting-l3', title: 'Match Tank Size to the Dry Season' },
      { slide: 18, lesson: 'water-harvesting-l3', title: 'Keep Stored Water Protected' },
      { slide: 19, lesson: 'water-harvesting-l4', title: 'Greywater Is Washwater, Not Toilet Water' },
      { slide: 20, lesson: 'water-harvesting-l4', title: 'Keep Greywater Safe for Soil' },
      { slide: 21, lesson: 'water-harvesting-l4', title: 'Watch: Greywater Under Mulch' },
      { slide: 22, lesson: 'water-harvesting-l4', title: 'Use Greywater Only Where It Is Safe' },
      { slide: 23, lesson: null,                  title: 'Field Assignment' },
      { slide: 24, lesson: null,                  title: 'Check Your Work' },
    ],
  },
  'soil-health': {
    languages: ['en'],
    // 20 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    tracks: [
      { slide: 1,  lesson: null,             title: 'Soil Health & Composting' },
      { slide: 2,  lesson: null,             title: 'Why This Matters' },
      { slide: 3,  lesson: null,             title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'soil-health-l1', title: 'Soil Is Alive' },
      { slide: 5,  lesson: 'soil-health-l1', title: 'Watch: Look at the Soil' },
      { slide: 6,  lesson: 'soil-health-l1', title: 'Test Your Soil with a Jar' },
      { slide: 7,  lesson: 'soil-health-l1', title: 'Read the Jar Layers' },
      { slide: 8,  lesson: 'soil-health-l1', title: 'Degraded Soil Can Recover' },
      { slide: 9,  lesson: 'soil-health-l2', title: 'Compost Feeds the Soil' },
      { slide: 10, lesson: 'soil-health-l2', title: 'Watch: Build the Compost Heap' },
      { slide: 11, lesson: 'soil-health-l2', title: 'Balance Browns and Greens' },
      { slide: 12, lesson: 'soil-health-l2', title: 'Keep the Compost Safe' },
      { slide: 13, lesson: 'soil-health-l2', title: 'Keep Wattle Pods Out' },
      { slide: 14, lesson: 'soil-health-l3', title: 'Watch: Bare Soil and Mulch' },
      { slide: 15, lesson: 'soil-health-l3', title: 'Mulch Protects the Ground' },
      { slide: 16, lesson: 'soil-health-l3', title: 'Cover Crops Between Seasons' },
      { slide: 17, lesson: 'soil-health-l3', title: 'Worm Farms Make Root Feed' },
      { slide: 18, lesson: 'soil-health-l3', title: 'Protect Soil All Year' },
      { slide: 19, lesson: null,             title: 'Field Assignment' },
      { slide: 20, lesson: null,             title: 'Field Action' },
    ],
  },
  'vegetables-staples': {
    languages: ['en'],
    // 18 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    tracks: [
      { slide: 1,  lesson: null,                    title: 'Vegetables and Staple Crops' },
      { slide: 2,  lesson: null,                    title: 'Why This Matters' },
      { slide: 3,  lesson: null,                    title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'vegetables-staples-l1', title: 'Roots Need Loose Soil, Paths Need Your Feet' },
      { slide: 5,  lesson: 'vegetables-staples-l1', title: 'Choose the Bed for the Soil and Rainfall' },
      { slide: 6,  lesson: 'vegetables-staples-l1', title: 'Seed or Seedling?' },
      { slide: 7,  lesson: 'vegetables-staples-l1', title: 'Mark the Working Shape' },
      { slide: 8,  lesson: 'vegetables-staples-l2', title: 'A Sowing Rhythm Keeps Food Moving' },
      { slide: 9,  lesson: 'vegetables-staples-l2', title: 'Sow Little and Often' },
      { slide: 10, lesson: 'vegetables-staples-l2', title: 'Each Crop Earns Its Place' },
      { slide: 11, lesson: 'vegetables-staples-l2', title: 'Plan Backwards From Your Hungry Gap' },
      { slide: 12, lesson: 'vegetables-staples-l3', title: 'Staples Are Food Insurance' },
      { slide: 13, lesson: 'vegetables-staples-l3', title: 'Different Staples Protect Against Different Risks' },
      { slide: 14, lesson: 'vegetables-staples-l3', title: 'Diversity Keeps Food Moving' },
      { slide: 15, lesson: 'vegetables-staples-l4', title: 'Pests Are Messengers Before They Are Enemies' },
      { slide: 16, lesson: 'vegetables-staples-l4', title: 'Treat the Cause Before the Insect' },
      { slide: 17, lesson: null,                    title: 'Field Assignment' },
      { slide: 18, lesson: null,                    title: 'Field Action' },
    ],
  },
  'plant-guilds': {
    languages: ['en'],
    // 20 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    // Slide 2 is this deck's "Why This Matters", under a module-specific name.
    tracks: [
      { slide: 1,  lesson: null,              title: 'Plant Selection and Guilds' },
      { slide: 2,  lesson: null,              title: 'Why Plant Guilds Matter' },
      { slide: 3,  lesson: null,              title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'plant-guilds-l1', title: 'How Legumes Feed the Soil' },
      { slide: 5,  lesson: 'plant-guilds-l1', title: 'Watch: Roots That Feed the Soil' },
      { slide: 6,  lesson: 'plant-guilds-l1', title: 'Nitrogen-Fixing Trees' },
      { slide: 7,  lesson: 'plant-guilds-l1', title: 'Sunn Hemp and the Waiting Soil' },
      { slide: 8,  lesson: 'plant-guilds-l1', title: 'Where to Place Nitrogen Fixers' },
      { slide: 9,  lesson: 'plant-guilds-l2', title: 'Mulch Plants and Chop and Drop' },
      { slide: 10, lesson: 'plant-guilds-l2', title: 'Watch: Chop and Drop' },
      { slide: 11, lesson: 'plant-guilds-l2', title: 'Choose the Right Comfrey' },
      { slide: 12, lesson: 'plant-guilds-l2', title: 'Work With Helpful Insects' },
      { slide: 13, lesson: 'plant-guilds-l2', title: 'Wild Garlic for Pest Control' },
      { slide: 14, lesson: 'plant-guilds-l3', title: 'What Makes a Plant Guild' },
      { slide: 15, lesson: 'plant-guilds-l3', title: 'Watch: A Mango Guild' },
      { slide: 16, lesson: 'plant-guilds-l3', title: 'Place and Cut the Sesbania' },
      { slide: 17, lesson: 'plant-guilds-l3', title: 'Fill the Guild’s Other Jobs' },
      { slide: 18, lesson: 'plant-guilds-l3', title: 'Let Every Plant Earn Its Place' },
      { slide: 19, lesson: null,              title: 'Field Assignment' },
      { slide: 20, lesson: null,              title: 'Field Action' },
    ],
  },
  'food-forest': {
    languages: ['en'],
    // 20 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    // Slide 8 reads back l1's closing lines about the canopy closing by year three to five, so it
    // belongs to the layers lesson — l3's establishment sequence only opens at slide 14.
    tracks: [
      { slide: 1,  lesson: null,             title: 'Food Forest Design' },
      { slide: 2,  lesson: null,             title: 'Why This Matters' },
      { slide: 3,  lesson: null,             title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'food-forest-l1', title: 'The Forest Uses Every Layer' },
      { slide: 5,  lesson: 'food-forest-l1', title: 'Watch: The Seven Layers Working Together' },
      { slide: 6,  lesson: 'food-forest-l1', title: 'The Seven Layers' },
      { slide: 7,  lesson: 'food-forest-l1', title: 'A Highveld Example' },
      { slide: 8,  lesson: 'food-forest-l1', title: 'From Establishment to Self-Care' },
      { slide: 9,  lesson: 'food-forest-l2', title: 'Choose for Your Region' },
      { slide: 10, lesson: 'food-forest-l2', title: 'Watch: Match the Species to the Climate' },
      { slide: 11, lesson: 'food-forest-l2', title: 'Highveld Food Forest Choices' },
      { slide: 12, lesson: 'food-forest-l2', title: 'KZN Coast, Lowveld, and Limpopo' },
      { slide: 13, lesson: 'food-forest-l2', title: 'Indigenous Species Build the Ecosystem' },
      { slide: 14, lesson: 'food-forest-l3', title: 'Plant in Sequence' },
      { slide: 15, lesson: 'food-forest-l3', title: 'Watch: From Bare Ground to Food Forest' },
      { slide: 16, lesson: 'food-forest-l3', title: 'Year One on a 500m² Plot' },
      { slide: 17, lesson: 'food-forest-l3', title: 'Years Two to Four' },
      { slide: 18, lesson: 'food-forest-l3', title: 'Plant With the Rain' },
      { slide: 19, lesson: null,             title: 'Field Assignment' },
      { slide: 20, lesson: null,             title: 'Field Action' },
    ],
  },
  'small-livestock': {
    languages: ['en'],
    // 20 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    // The "Watch" clip leads each lesson here rather than following its opening slide (4, 9, 14),
    // which is why every lesson run starts on a Watch.
    tracks: [
      { slide: 1,  lesson: null,                 title: 'Small Livestock Integration' },
      { slide: 2,  lesson: null,                 title: 'Why This Matters' },
      { slide: 3,  lesson: null,                 title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'small-livestock-l1', title: 'Watch: A Chicken Tractor Moving Across a Bed' },
      { slide: 5,  lesson: 'small-livestock-l1', title: 'Chickens Turn Scratching Into Useful Work' },
      { slide: 6,  lesson: 'small-livestock-l1', title: 'Use Chickens at the Right Time' },
      { slide: 7,  lesson: 'small-livestock-l1', title: 'Ducks Suit Established Understorey' },
      { slide: 8,  lesson: 'small-livestock-l1', title: 'Rotate the Tractor Across the Plot' },
      { slide: 9,  lesson: 'small-livestock-l2', title: 'Watch: Bees Moving Between Hive and Crops' },
      { slide: 10, lesson: 'small-livestock-l2', title: 'Bees Make Food Forests More Productive' },
      { slide: 11, lesson: 'small-livestock-l2', title: 'South Africa’s Native Honeybees' },
      { slide: 12, lesson: 'small-livestock-l2', title: 'Place the Hive With Care' },
      { slide: 13, lesson: 'small-livestock-l2', title: 'Strong Colonies Need Space and Flowers' },
      { slide: 14, lesson: 'small-livestock-l3', title: 'Watch: Nutrients Moving in a Closed Livestock Loop' },
      { slide: 15, lesson: 'small-livestock-l3', title: 'Close the Nutrient Loop' },
      { slide: 16, lesson: 'small-livestock-l3', title: 'Guinea Fowl Hunt Ticks and Grasshoppers' },
      { slide: 17, lesson: 'small-livestock-l3', title: 'Ask Three Questions for Every Animal' },
      { slide: 18, lesson: 'small-livestock-l3', title: 'Chickens Following Goats Break the Parasite Cycle' },
      { slide: 19, lesson: null,                 title: 'Field Assignment: Draw Your Farm Loop' },
      { slide: 20, lesson: null,                 title: 'Field Action: Put One Link to Work' },
    ],
  },
  'market-community': {
    languages: ['en'],
    // 20 slides, recorded 2026-08-03 via edge-tts en-ZA-LukeNeural and verified by
    // import-course-audio: every clip matched its script block.
    // Same deck shape as small-livestock: each lesson opens on its "Watch" clip (4, 9, 14).
    tracks: [
      { slide: 1,  lesson: null,                  title: 'Market Gardening & Community' },
      { slide: 2,  lesson: null,                  title: 'Why This Matters' },
      { slide: 3,  lesson: null,                  title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'market-community-l1', title: 'Watch: What the Farm Record Shows' },
      { slide: 5,  lesson: 'market-community-l1', title: 'Record Every Harvest' },
      { slide: 6,  lesson: 'market-community-l1', title: 'Let One Season Answer Questions' },
      { slide: 7,  lesson: 'market-community-l1', title: 'Find the True Cost' },
      { slide: 8,  lesson: 'market-community-l1', title: 'Plant for the Food Gap' },
      { slide: 9,  lesson: 'market-community-l2', title: 'Watch: Where Surplus Can Go' },
      { slide: 10, lesson: 'market-community-l2', title: 'Know Your Customer' },
      { slide: 11, lesson: 'market-community-l2', title: 'Keep More Through Direct Selling' },
      { slide: 12, lesson: 'market-community-l2', title: 'Plan Around Box Customers' },
      { slide: 13, lesson: 'market-community-l2', title: 'Match the Channel to Your Supply' },
      { slide: 14, lesson: 'market-community-l3', title: 'Watch: How Neighbours Strengthen a Harvest' },
      { slide: 15, lesson: 'market-community-l3', title: 'Save Seed Together' },
      { slide: 16, lesson: 'market-community-l3', title: 'Share Expensive Tools' },
      { slide: 17, lesson: 'market-community-l3', title: 'Sell Locally to Reduce Loss' },
      { slide: 18, lesson: 'market-community-l3', title: 'Share Skills as Well as Things' },
      { slide: 19, lesson: null,                  title: 'Field Assignment: Make a Farm Record' },
      { slide: 20, lesson: null,                  title: 'Field Action: Use the Record' },
    ],
  },
};

export function narrationFor(moduleId: string): ModuleNarration | null {
  return COURSE_NARRATION[moduleId] ?? null;
}

export function hasNarration(moduleId: string): boolean {
  const n = COURSE_NARRATION[moduleId];
  return Boolean(n && n.languages.length > 0 && n.tracks.length > 0);
}

export interface ResolvedLang {
  lang: string;
  /** false = we are playing a different language from the one the app is set to. The UI must
   *  say so rather than quietly playing English at someone who chose isiZulu. */
  exact: boolean;
}

/** Pick the language to actually play: the app language if it was recorded, else English,
 *  else whatever exists. Null when the module has no recording at all. */
export function resolveNarrationLang(moduleId: string, appLang: string): ResolvedLang | null {
  const n = COURSE_NARRATION[moduleId];
  if (!n || n.languages.length === 0) return null;
  if (n.languages.includes(appLang)) return { lang: appLang, exact: true };
  if (n.languages.includes('en')) return { lang: 'en', exact: false };
  return { lang: n.languages[0], exact: false };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function base(n: ModuleNarration, moduleId: string, lang: string): string {
  const root = n.baseUrl ? n.baseUrl.replace(/\/+$/, '') : '/course-audio';
  return `${root}/${moduleId}/${lang}`;
}

/** URL for one slide clip, or null if the module or slide isn't in the manifest. */
export function trackUrl(moduleId: string, lang: string, slide: number): string | null {
  const n = COURSE_NARRATION[moduleId];
  if (!n || !n.languages.includes(lang)) return null;
  if (!n.tracks.some((t) => t.slide === slide)) return null;
  return `${base(n, moduleId, lang)}/slide-${pad2(slide)}.mp3`;
}

/** URL for the single continuous narration of the whole module. */
export function fullNarrationUrl(moduleId: string, lang: string): string | null {
  const n = COURSE_NARRATION[moduleId];
  if (!n || !n.languages.includes(lang)) return null;
  return `${base(n, moduleId, lang)}/full.mp3`;
}

/** Track title in the requested language, falling back to the English title. */
export function trackTitle(track: NarrationTrack, lang: string): string {
  return track.titleByLang?.[lang] ?? track.title;
}

/** Tracks belonging to one lesson, in deck order. Empty when the lesson has no audio. */
export function tracksForLesson(moduleId: string, lessonId: string): NarrationTrack[] {
  const n = COURSE_NARRATION[moduleId];
  if (!n) return [];
  return n.tracks.filter((t) => t.lesson === lessonId).sort((a, b) => a.slide - b.slide);
}

/** Intro/recap tracks that belong to the module rather than any one lesson. */
export function moduleLevelTracks(moduleId: string): NarrationTrack[] {
  const n = COURSE_NARRATION[moduleId];
  if (!n) return [];
  return n.tracks.filter((t) => t.lesson === null).sort((a, b) => a.slide - b.slide);
}

/** All tracks in deck order. */
export function allTracks(moduleId: string): NarrationTrack[] {
  const n = COURSE_NARRATION[moduleId];
  if (!n) return [];
  return [...n.tracks].sort((a, b) => a.slide - b.slide);
}

/** Human duration for the audio controls, e.g. 92 -> "1:32". Guards NaN/Infinity, which is
 *  what an <audio> element reports before metadata has loaded. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}
