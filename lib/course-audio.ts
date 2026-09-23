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
    // Slide 19 re-recorded 2026-09-21 with the same Luke voice at -12%, verified against
    // returned word boundaries for the authored windbreak motion; full.mp3 rebuilt with it.
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
      { slide: 13, lesson: 'intro-permaculture-l2', title: 'Use and Value Diversity' },
      { slide: 14, lesson: 'intro-permaculture-l2', title: 'Integrate Rather Than Segregate' },
      { slide: 15, lesson: 'intro-permaculture-l3', title: 'Zones: Organising by How Often You Visit' },
      { slide: 16, lesson: 'intro-permaculture-l3', title: 'Keep Daily Crops Close' },
      { slide: 17, lesson: 'intro-permaculture-l3', title: 'Zones Plan Your Labour' },
      { slide: 18, lesson: 'intro-permaculture-l3', title: 'Sectors: The Energies Arriving From Outside' },
      { slide: 19, lesson: 'intro-permaculture-l3', title: 'Watch: Shelter Between Wind and Crops' },
      { slide: 20, lesson: 'intro-permaculture-l3', title: 'Sketch It And You Have A Design' },
      { slide: 21, lesson: null,                    title: 'Field Assignment' },
      { slide: 22, lesson: null,                    title: 'Field Action' },
    ],
  },
  'reading-landscape': {
    languages: ['en'],
    // The original 21 clips were recorded 2026-08-03. Slides 16 and 18 were
    // re-recorded 2026-09-22 with en-ZA-LukeNeural after the map-scale and soil
    // inference correction; their word boundaries matched the new script and the
    // rebuilt full narration decoded. Human listening review remains open.
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
      { slide: 14, lesson: 'reading-landscape-l3', title: 'Cold Air Flows Downhill' },
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
    // 24 slides, corrected and re-recorded 2026-09-20 with en-ZA-LukeNeural. Verified by
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
      { slide: 8,  lesson: 'water-harvesting-l1', title: 'Check the Site Before Digging' },
      { slide: 9,  lesson: 'water-harvesting-l1', title: 'Watch: Roots Help Hold Soil' },
      { slide: 10, lesson: 'water-harvesting-l2', title: 'Store Rain for the Dry Season' },
      { slide: 11, lesson: 'water-harvesting-l2', title: 'Design the Spillway Before the Wall' },
      { slide: 12, lesson: 'water-harvesting-l2', title: 'Watch: Dam and Spillway' },
      { slide: 13, lesson: 'water-harvesting-l2', title: 'Care for the Dam and Its Banks' },
      { slide: 14, lesson: 'water-harvesting-l3', title: 'Your Roof Is a Harvesting Surface' },
      { slide: 15, lesson: 'water-harvesting-l3', title: 'Divert the Dirty First Flush' },
      { slide: 16, lesson: 'water-harvesting-l3', title: 'Watch: First Flush to Tank' },
      { slide: 17, lesson: 'water-harvesting-l3', title: 'Match Tank Size to Water Demand' },
      { slide: 18, lesson: 'water-harvesting-l3', title: 'Keep Stored Water Protected' },
      { slide: 19, lesson: 'water-harvesting-l4', title: 'Greywater Is Used Washwater' },
      { slide: 20, lesson: 'water-harvesting-l4', title: 'Keep Greywater Away from People and Food' },
      { slide: 21, lesson: 'water-harvesting-l4', title: 'Watch: Greywater Under Mulch' },
      { slide: 22, lesson: 'water-harvesting-l4', title: 'Use Greywater Only Where It Is Safe' },
      { slide: 23, lesson: null,                  title: 'Field Assignment' },
      { slide: 24, lesson: null,                  title: 'Check Your Work' },
    ],
  },
  'soil-health': {
    languages: ['en'],
    // Corrected English recorded 2026-09-20, en-ZA-LukeNeural at -12%.
    // Word-boundary/script matching and full decode passed; fluent listening review is separate.
    tracks: [
      { slide: 1,  lesson: null,             title: 'Soil Health & Composting' },
      { slide: 2,  lesson: null,             title: 'Why This Matters' },
      { slide: 3,  lesson: null,             title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'soil-health-l1', title: 'Soil Is Alive' },
      { slide: 5,  lesson: 'soil-health-l1', title: 'Watch: Read Your Soil' },
      { slide: 6,  lesson: 'soil-health-l1', title: 'Explore Soil Texture with a Jar' },
      { slide: 7,  lesson: 'soil-health-l1', title: 'Read the Jar Carefully' },
      { slide: 8,  lesson: 'soil-health-l1', title: 'Investigate Before You Treat' },
      { slide: 9,  lesson: 'soil-health-l2', title: 'Compost Feeds the Soil' },
      { slide: 10, lesson: 'soil-health-l2', title: 'Watch: Build the Compost Heap' },
      { slide: 11, lesson: 'soil-health-l2', title: 'Balance Browns and Greens' },
      { slide: 12, lesson: 'soil-health-l2', title: 'Heat Alone Is Not a Safety Check' },
      { slide: 13, lesson: 'soil-health-l2', title: 'Keep Seed Pods and Contaminants Out' },
      { slide: 14, lesson: 'soil-health-l3', title: 'Watch: Bare Soil and Mulch' },
      { slide: 15, lesson: 'soil-health-l3', title: 'Mulch Protects the Ground' },
      { slide: 16, lesson: 'soil-health-l3', title: 'Cover Crops Between Seasons' },
      { slide: 17, lesson: 'soil-health-l3', title: 'Worm Castings and Liquid Drainage' },
      { slide: 18, lesson: 'soil-health-l3', title: 'Protect Soil All Year' },
      { slide: 19, lesson: null,             title: 'Field Assignment' },
      { slide: 20, lesson: null,             title: 'Field Action' },
    ],
  },
  'vegetables-staples': {
    languages: ['en'],
    // Corrected English recorded 2026-09-20, en-ZA-LukeNeural at -12%.
    // Word-boundary/script matching and full decode passed; fluent listening review is separate.
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
    // 51 slides: Leah / Thando. Owner authorized both languages on 9 September.
    // Fluent review remains pending in NARRATION_RELEASE_EXCEPTIONS, not certified.
    languages: ['en', 'zu'],
    tracks: [
      {
            "slide": 1,
            "lesson": null,
            "title": "Plant Selection and Guilds",
            "titleByLang": {
                  "zu": "Ukukhetha Izitshalo Nama-Guilds"
            }
      },
      {
            "slide": 2,
            "lesson": null,
            "title": "Plant Selection and Guilds",
            "titleByLang": {
                  "zu": "Ukukhetha Izitshalo Nama-Guilds"
            }
      },
      {
            "slide": 3,
            "lesson": null,
            "title": "Start With the Site",
            "titleByLang": {
                  "zu": "Qala Ngokubheka Indawo"
            }
      },
      {
            "slide": 4,
            "lesson": null,
            "title": "Start With the Site",
            "titleByLang": {
                  "zu": "Qala Ngokubheka Indawo"
            }
      },
      {
            "slide": 5,
            "lesson": null,
            "title": "Give Every Plant a Job",
            "titleByLang": {
                  "zu": "Nikeza Isitshalo Ngasinye Umsebenzi"
            }
      },
      {
            "slide": 6,
            "lesson": null,
            "title": "Give Every Plant a Job",
            "titleByLang": {
                  "zu": "Nikeza Isitshalo Ngasinye Umsebenzi"
            }
      },
      {
            "slide": 7,
            "lesson": "plant-guilds-l1",
            "title": "Look for Root Nodules",
            "titleByLang": {
                  "zu": "Bheka Ama-Nodule Ezimpandeni"
            }
      },
      {
            "slide": 8,
            "lesson": "plant-guilds-l1",
            "title": "Look for Root Nodules",
            "titleByLang": {
                  "zu": "Bheka Ama-Nodule Ezimpandeni"
            }
      },
      {
            "slide": 9,
            "lesson": "plant-guilds-l1",
            "title": "Return Leaves to the Soil",
            "titleByLang": {
                  "zu": "Buyisela Amaqabunga Emhlabathini"
            }
      },
      {
            "slide": 10,
            "lesson": "plant-guilds-l1",
            "title": "Return Leaves to the Soil",
            "titleByLang": {
                  "zu": "Buyisela Amaqabunga Emhlabathini"
            }
      },
      {
            "slide": 11,
            "lesson": "plant-guilds-l1",
            "title": "Sesbania Has a Useful Role",
            "titleByLang": {
                  "zu": "I-Sesbania Inomsebenzi Owusizo"
            }
      },
      {
            "slide": 12,
            "lesson": "plant-guilds-l1",
            "title": "Sesbania Has a Useful Role",
            "titleByLang": {
                  "zu": "I-Sesbania Inomsebenzi Owusizo"
            }
      },
      {
            "slide": 13,
            "lesson": "plant-guilds-l1",
            "title": "Check the Full Plant Name",
            "titleByLang": {
                  "zu": "Hlola Igama Eligcwele Lesitshalo"
            }
      },
      {
            "slide": 14,
            "lesson": "plant-guilds-l1",
            "title": "Check the Full Plant Name",
            "titleByLang": {
                  "zu": "Hlola Igama Eligcwele Lesitshalo"
            }
      },
      {
            "slide": 15,
            "lesson": "plant-guilds-l1",
            "title": "Pigeon Pea Gives Food Too",
            "titleByLang": {
                  "zu": "I-Pigeon Pea Inika Nokudla"
            }
      },
      {
            "slide": 16,
            "lesson": "plant-guilds-l1",
            "title": "Pigeon Pea Gives Food Too",
            "titleByLang": {
                  "zu": "I-Pigeon Pea Inika Nokudla"
            }
      },
      {
            "slide": 17,
            "lesson": "plant-guilds-l1",
            "title": "Choose for Place and Size",
            "titleByLang": {
                  "zu": "Khetha Ngokwendawo Nobukhulu"
            }
      },
      {
            "slide": 18,
            "lesson": "plant-guilds-l1",
            "title": "Choose for Place and Size",
            "titleByLang": {
                  "zu": "Khetha Ngokwendawo Nobukhulu"
            }
      },
      {
            "slide": 19,
            "lesson": "plant-guilds-l1",
            "title": "Annual Cover Has a Place",
            "titleByLang": {
                  "zu": "Ukumboza Ngezitshalo Zonyaka"
            }
      },
      {
            "slide": 20,
            "lesson": "plant-guilds-l1",
            "title": "Annual Cover Has a Place",
            "titleByLang": {
                  "zu": "Ukumboza Ngezitshalo Zonyaka"
            }
      },
      {
            "slide": 21,
            "lesson": "plant-guilds-l1",
            "title": "Leave Room Around the Tree",
            "titleByLang": {
                  "zu": "Shiya Indawo Ezungeze Umuthi"
            }
      },
      {
            "slide": 22,
            "lesson": "plant-guilds-l1",
            "title": "Leave Room Around the Tree",
            "titleByLang": {
                  "zu": "Shiya Indawo Ezungeze Umuthi"
            }
      },
      {
            "slide": 23,
            "lesson": "plant-guilds-l1",
            "title": "Build a Layered Support Guild",
            "titleByLang": {
                  "zu": "Hlanganisa Izingqimba Ezisekelayo"
            }
      },
      {
            "slide": 24,
            "lesson": "plant-guilds-l1",
            "title": "Build a Layered Support Guild",
            "titleByLang": {
                  "zu": "Hlanganisa Izingqimba Ezisekelayo"
            }
      },
      {
            "slide": 25,
            "lesson": "plant-guilds-l1",
            "title": "How Many Support Plants?",
            "titleByLang": {
                  "zu": "Zingaki Izitshalo Ezisekelayo?"
            }
      },
      {
            "slide": 26,
            "lesson": "plant-guilds-l1",
            "title": "How Many Support Plants?",
            "titleByLang": {
                  "zu": "Zingaki Izitshalo Ezisekelayo?"
            }
      },
      {
            "slide": 27,
            "lesson": "plant-guilds-l2",
            "title": "Chop-and-Drop for Light and Mulch",
            "titleByLang": {
                  "zu": "Thena Ukuze Kukhanye"
            }
      },
      {
            "slide": 28,
            "lesson": "plant-guilds-l2",
            "title": "Chop-and-Drop for Light and Mulch",
            "titleByLang": {
                  "zu": "Thena Ukuze Kukhanye"
            }
      },
      {
            "slide": 29,
            "lesson": "plant-guilds-l2",
            "title": "Keep Mulch Off the Trunk",
            "titleByLang": {
                  "zu": "I-Mulch Mayingathinti Isiqu"
            }
      },
      {
            "slide": 30,
            "lesson": "plant-guilds-l2",
            "title": "Keep Mulch Off the Trunk",
            "titleByLang": {
                  "zu": "I-Mulch Mayingathinti Isiqu"
            }
      },
      {
            "slide": 31,
            "lesson": "plant-guilds-l2",
            "title": "Choose the Right Comfrey",
            "titleByLang": {
                  "zu": "Khetha I-Comfrey Efanele"
            }
      },
      {
            "slide": 32,
            "lesson": "plant-guilds-l2",
            "title": "Choose the Right Comfrey",
            "titleByLang": {
                  "zu": "Khetha I-Comfrey Efanele"
            }
      },
      {
            "slide": 33,
            "lesson": "plant-guilds-l2",
            "title": "Observe Helpful Insects",
            "titleByLang": {
                  "zu": "Bheka Izinambuzane Eziwusizo"
            }
      },
      {
            "slide": 34,
            "lesson": "plant-guilds-l2",
            "title": "Observe Helpful Insects",
            "titleByLang": {
                  "zu": "Bheka Izinambuzane Eziwusizo"
            }
      },
      {
            "slide": 35,
            "lesson": "plant-guilds-l2",
            "title": "Give Flowers Their Space",
            "titleByLang": {
                  "zu": "Nikeza Izimbali Indawo Yazo"
            }
      },
      {
            "slide": 36,
            "lesson": "plant-guilds-l2",
            "title": "Give Flowers Their Space",
            "titleByLang": {
                  "zu": "Nikeza Izimbali Indawo Yazo"
            }
      },
      {
            "slide": 37,
            "lesson": "plant-guilds-l3",
            "title": "Bring the Jobs Together",
            "titleByLang": {
                  "zu": "Hlanganisa Imisebenzi"
            }
      },
      {
            "slide": 38,
            "lesson": "plant-guilds-l3",
            "title": "Bring the Jobs Together",
            "titleByLang": {
                  "zu": "Hlanganisa Imisebenzi"
            }
      },
      {
            "slide": 39,
            "lesson": "plant-guilds-l3",
            "title": "Food Cover Also Competes",
            "titleByLang": {
                  "zu": "Ubhatata Nawo Uyancintisana"
            }
      },
      {
            "slide": 40,
            "lesson": "plant-guilds-l3",
            "title": "Food Cover Also Competes",
            "titleByLang": {
                  "zu": "Ubhatata Nawo Uyancintisana"
            }
      },
      {
            "slide": 41,
            "lesson": "plant-guilds-l3",
            "title": "First, Establish the Guild",
            "titleByLang": {
                  "zu": "Qala Ngokumilisa I-Guild"
            }
      },
      {
            "slide": 42,
            "lesson": "plant-guilds-l3",
            "title": "First, Establish the Guild",
            "titleByLang": {
                  "zu": "Qala Ngokumilisa I-Guild"
            }
      },
      {
            "slide": 43,
            "lesson": "plant-guilds-l3",
            "title": "Thin as the Fruit Tree Grows",
            "titleByLang": {
                  "zu": "Nciphisa Njengoba Umuthi Ukhula"
            }
      },
      {
            "slide": 44,
            "lesson": "plant-guilds-l3",
            "title": "Move Support Into the Light",
            "titleByLang": {
                  "zu": "Hambisa Ezisekelayo Ekukhanyeni"
            }
      },
      {
            "slide": 45,
            "lesson": "plant-guilds-l3",
            "title": "Move Support Into the Light",
            "titleByLang": {
                  "zu": "Hambisa Ezisekelayo Ekukhanyeni"
            }
      },
      {
            "slide": 46,
            "lesson": "plant-guilds-l3",
            "title": "Let Observation Decide",
            "titleByLang": {
                  "zu": "Nquma Ngokubonile"
            }
      },
      {
            "slide": 47,
            "lesson": "plant-guilds-l3",
            "title": "Let Observation Decide",
            "titleByLang": {
                  "zu": "Nquma Ngokubonile"
            }
      },
      {
            "slide": 48,
            "lesson": null,
            "title": "Plan One Real Guild",
            "titleByLang": {
                  "zu": "Hlela I-Guild Eyodwa Yangempela"
            }
      },
      {
            "slide": 49,
            "lesson": null,
            "title": "Plan One Real Guild",
            "titleByLang": {
                  "zu": "Hlela I-Guild Eyodwa Yangempela"
            }
      },
      {
            "slide": 50,
            "lesson": null,
            "title": "Plant, Observe, Adjust",
            "titleByLang": {
                  "zu": "Tshala, Qaphela, Lungisa"
            }
      },
      {
            "slide": 51,
            "lesson": null,
            "title": "Plant, Observe, Adjust",
            "titleByLang": {
                  "zu": "Tshala, Qaphela, Lungisa"
            }
      }
],
  },
  'food-forest': {
    languages: ['en'],
    // Corrected English recorded 2026-09-20, en-ZA-LukeNeural at -12%.
    // Word-boundary/script matching and full decode passed; fluent listening review is separate.
    tracks: [
      { slide: 1,  lesson: null,             title: 'Food Forest Design' },
      { slide: 2,  lesson: null,             title: 'Why This Matters' },
      { slide: 3,  lesson: null,             title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'food-forest-l1', title: 'The Forest Uses Every Layer' },
      { slide: 5,  lesson: 'food-forest-l1', title: 'Watch: Read the Seven Planting Layers' },
      { slide: 6,  lesson: 'food-forest-l1', title: 'The Seven Layers' },
      { slide: 7,  lesson: 'food-forest-l1', title: 'Read a Layered Planting Example' },
      { slide: 8,  lesson: 'food-forest-l1', title: 'Care Changes as Plants Grow' },
      { slide: 9,  lesson: 'food-forest-l2', title: 'Choose for Your Site' },
      { slide: 10, lesson: 'food-forest-l2', title: 'Watch: Match the Species to the Climate' },
      { slide: 11, lesson: 'food-forest-l2', title: 'Check the Highveld Examples' },
      { slide: 12, lesson: 'food-forest-l2', title: 'Check the Warm-Region Examples' },
      { slide: 13, lesson: 'food-forest-l2', title: 'Include Locally Appropriate Indigenous Plants' },
      { slide: 14, lesson: 'food-forest-l3', title: 'Plan the Sequence for the Site' },
      { slide: 15, lesson: 'food-forest-l3', title: 'Watch: Care for a Young Food Forest' },
      { slide: 16, lesson: 'food-forest-l3', title: 'Prepare a Manageable First Area' },
      { slide: 17, lesson: 'food-forest-l3', title: 'Adjust as the Trees Grow' },
      { slide: 18, lesson: 'food-forest-l3', title: 'Plant with Reliable Moisture' },
      { slide: 19, lesson: null,             title: 'Field Assignment' },
      { slide: 20, lesson: null,             title: 'Field Action' },
    ],
  },
  'small-livestock': {
    languages: ['en'],
    // Targeted factual corrections re-recorded in September 2026; source review is
    // docs/studies-review-2026-09-20/FACT-CHECK.md. Same en-ZA-LukeNeural voice.
    // The "Watch" clip leads each lesson here rather than following its opening slide (4, 9, 14),
    // which is why every lesson run starts on a Watch.
    tracks: [
      { slide: 1,  lesson: null,                 title: 'Small Livestock Integration' },
      { slide: 2,  lesson: null,                 title: 'Why This Matters' },
      { slide: 3,  lesson: null,                 title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'small-livestock-l1', title: 'Watch: Hens Foraging After Harvest' },
      { slide: 5,  lesson: 'small-livestock-l1', title: 'Chickens Turn Scratching Into Useful Work' },
      { slide: 6,  lesson: 'small-livestock-l1', title: 'Use Chickens at the Right Time' },
      { slide: 7,  lesson: 'small-livestock-l1', title: 'Ducks Suit Established Understorey' },
      { slide: 8,  lesson: 'small-livestock-l1', title: 'Rotate the Tractor Across the Plot' },
      { slide: 9,  lesson: 'small-livestock-l2', title: 'Watch: Bees Moving Between Hive and Crops' },
      { slide: 10, lesson: 'small-livestock-l2', title: 'Bees Help Pollinate Many Crops' },
      { slide: 11, lesson: 'small-livestock-l2', title: 'South Africa’s Native Honeybees' },
      { slide: 12, lesson: 'small-livestock-l2', title: 'Place the Hive With Care' },
      { slide: 13, lesson: 'small-livestock-l2', title: 'Strong Colonies Need Care and Flowers' },
      { slide: 14, lesson: 'small-livestock-l3', title: 'Nutrients Moving Through the Farm' },
      { slide: 15, lesson: 'small-livestock-l3', title: 'Some Nutrients Return; Others Enter and Leave' },
      { slide: 16, lesson: 'small-livestock-l3', title: 'Guinea Fowl Forage, but Health Checks Still Matter' },
      { slide: 17, lesson: 'small-livestock-l3', title: 'Ask Three Questions for Every Animal' },
      { slide: 18, lesson: 'small-livestock-l3', title: 'Grazing and Goat Worm Control' },
      { slide: 19, lesson: null,                 title: 'Field Assignment: Draw Your Farm Loop' },
      { slide: 20, lesson: null,                 title: 'Field Action: Put One Link to Work' },
    ],
  },
  'market-community': {
    languages: ['en'],
    // Corrected English recorded 2026-09-20, en-ZA-LukeNeural at -12%.
    // Word-boundary/script matching and full decode passed; fluent listening review is separate.
    tracks: [
      { slide: 1,  lesson: null,                  title: 'Market Gardening & Community' },
      { slide: 2,  lesson: null,                  title: 'Why This Matters' },
      { slide: 3,  lesson: null,                  title: 'Learning Outcomes' },
      { slide: 4,  lesson: 'market-community-l1', title: 'Watch: What the Farm Record Shows' },
      { slide: 5,  lesson: 'market-community-l1', title: 'Record Every Harvest' },
      { slide: 6,  lesson: 'market-community-l1', title: 'Let One Season Answer Questions' },
      { slide: 7,  lesson: 'market-community-l1', title: 'Find the True Cost' },
      { slide: 8,  lesson: 'market-community-l1', title: 'Plan for the Food Gap' },
      { slide: 9,  lesson: 'market-community-l2', title: 'Watch: Where Surplus Can Go' },
      { slide: 10, lesson: 'market-community-l2', title: 'Know Your Customer' },
      { slide: 11, lesson: 'market-community-l2', title: 'Count the Work of Direct Selling' },
      { slide: 12, lesson: 'market-community-l2', title: 'Plan Around Real Orders' },
      { slide: 13, lesson: 'market-community-l2', title: 'Match the Channel to Your Supply' },
      { slide: 14, lesson: 'market-community-l3', title: 'Watch: How Neighbours Strengthen a Harvest' },
      { slide: 15, lesson: 'market-community-l3', title: 'Save Seed Together' },
      { slide: 16, lesson: 'market-community-l3', title: 'Share Expensive Tools' },
      { slide: 17, lesson: 'market-community-l3', title: 'Reduce Loss Between Harvest and Sale' },
      { slide: 18, lesson: 'market-community-l3', title: 'Share Skills and Check Results' },
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

/** App help has its own recording collection: listening to a guide must never count as
 * completing an assessed farming module. Keep all audio promises in this manifest. */
export interface AppGuideAudioTrack {
  section: string;
  seconds: number;
  bytes: number;
  sourceSha256: string;
  audioSha256: string;
}
export interface AppGuideNarration {
  language: 'en';
  voice: string;
  rate: string;
  tracks: AppGuideAudioTrack[];
}

export const APP_GUIDE_NARRATION: Record<string, AppGuideNarration> = {
  "getting-started": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 28.368,
        "bytes": 170208,
        "sourceSha256": "8e8332e1235e25e62cb51befba23fdc8548e8584c7ea7408f255c5e67febaf08",
        "audioSha256": "4f76e64bf5fcce7bd8fd87b0d4e0ef5851510d171f63bc4ac8949a0163f90c31"
      },
      {
        "section": "sample",
        "seconds": 47.016,
        "bytes": 282096,
        "sourceSha256": "b72e991d94af95961e509f122e865d4408231f0b6ae80a2665eb79d35b14570d",
        "audioSha256": "4a8a4cc5389f687ab607d6831012d5b621f364b98af1bb7eaba34c46cf5c64d3"
      },
      {
        "section": "navigate",
        "seconds": 43.248,
        "bytes": 259488,
        "sourceSha256": "c531de5aa4f8af8969d52bbcfc0b79b47b283eade19ab06ce74ed43d3fcca313",
        "audioSha256": "073f1fe03c7abf6b1b7cbd6fbe79fb2564720dc2508342c1a522a8c1f4166eb0"
      },
      {
        "section": "reopen",
        "seconds": 48.336,
        "bytes": 290016,
        "sourceSha256": "c089f7598e79984d85feeaae99065e19675b5ef77166bb668af4758f7539a7db",
        "audioSha256": "60c4facfb7c6154eac7cebc215799867f1ef9e8d6b329075aa94fdb18d54eb13"
      },
      {
        "section": "save-check",
        "seconds": 55.392,
        "bytes": 332352,
        "sourceSha256": "1bd1d15e1744f565390c1b7a874b8de725f6ac469db099d32244b542cb7a0820",
        "audioSha256": "c7c8603422ad4a6125f43760a2d46395c81eec96522b7a9334f82b7881edd3e8"
      },
      {
        "section": "keep-copy",
        "seconds": 61.368,
        "bytes": 368208,
        "sourceSha256": "64ccc30cdeb06235b5968b7f0a0aafcc05e2edaea3598b6e6986245156c98eb0",
        "audioSha256": "dfd3710a9ace291d9c8ff50ce3556d56da662144b00e75c0c0fa16e5f52e9223"
      },
      {
        "section": "own-work",
        "seconds": 50.568,
        "bytes": 303408,
        "sourceSha256": "0260ad1cdad70f0a5a29d68b4d82d0afdcb6fad93e48a144a85118b5253174f1",
        "audioSha256": "e92c1cb0bf7cbb248f19336a61f22ac2c89e411baf0ae15980d6ba1494adcb08"
      },
      {
        "section": "practice",
        "seconds": 29.136,
        "bytes": 174816,
        "sourceSha256": "48771469233ce893d9cadd7c7861553946c83eab615378c718292cf5e99705c5",
        "audioSha256": "f944d8c811649eb87d68bcdda1b6a4b096774fb082aadbea2f9bfcc119230913"
      },
      {
        "section": "feedback-1",
        "seconds": 6.456,
        "bytes": 38736,
        "sourceSha256": "3bfa40ea10d868da7e0d977fc8589f77b5ff9848e7432ddbb3ca3a21f9e36b45",
        "audioSha256": "9db7cc2489f47b95689d4178b056a424a0f946a9854047a843057aedd09d3eb0"
      },
      {
        "section": "feedback-2",
        "seconds": 9.912,
        "bytes": 59472,
        "sourceSha256": "d73c29a71c625971904021e8c545d197e7b1b740e0b7adbadb2bcbc219f0620b",
        "audioSha256": "9c56ab9b031a8fcae442829dc0a00453db8d1de19e3de05ce649e032c1f0a953"
      },
      {
        "section": "feedback-3",
        "seconds": 8.28,
        "bytes": 49680,
        "sourceSha256": "a22200ed85f86b903a4343992ee7851138143058d6ef74917c41314cd83e0849",
        "audioSha256": "b6d26eeede21364f49b21e3720c9565d9ebeb29acad0c72cc9c747e7525584c2"
      },
      {
        "section": "next",
        "seconds": 40.44,
        "bytes": 242640,
        "sourceSha256": "107994c355fce5850393c1790425833ad12a74ee8be546affb4b071ba9b6da3f",
        "audioSha256": "1e01687c311a5a8b299f25e2fc540bafbfff25dc64412f2a326f6f9909a0d8e9"
      }
    ]
  },
  "mapping": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 40.224,
        "bytes": 241344,
        "sourceSha256": "09c71103f7d0732c02ca419478d1a219414fccea21578af3af14affd4a9759c2",
        "audioSha256": "5732ff683895d92484e21b701247d117b6a6d10f79aff470076bcf72f8505889"
      },
      {
        "section": "find",
        "seconds": 50.448,
        "bytes": 302688,
        "sourceSha256": "fc0fe3dffb4d29943d8bb15cff9d0d3627b2da99645fe85d30190daaf3ba16b4",
        "audioSha256": "942a558528a0e85c2a9f0212de736463b4302ac672d5d1cd893b8161fc62f3c6"
      },
      {
        "section": "save-place",
        "seconds": 49.752,
        "bytes": 298512,
        "sourceSha256": "20289bdbca433b9cadf90b7a4a04fb6cd83c4a90393dc6074a7731968b3c4f8c",
        "audioSha256": "5c36372f839080c5412a55919f534b95afd4daf136ff74fab90825e6ae4c0108"
      },
      {
        "section": "trace",
        "seconds": 50.808,
        "bytes": 304848,
        "sourceSha256": "484957119200d011756b9cdd77b22a8f89abbb2fa4ab606811529b07665ced0b",
        "audioSha256": "5e583e906ca72303a858a7d1f20aea5c24c685203bae54edd46be8a7aa39eb07"
      },
      {
        "section": "name-boundary",
        "seconds": 58.704,
        "bytes": 352224,
        "sourceSha256": "51f0787a3007b5c8fd6bdea5b522c4eb6417b69b36948e0a45556b7f9348d62f",
        "audioSha256": "471c1a8c640ac8c59bc87061dd9f3036ec522a1fb1b8e592390f2e438a73890d"
      },
      {
        "section": "growing-area",
        "seconds": 53.424,
        "bytes": 320544,
        "sourceSha256": "9f3b072f37f14a7f04a56219728f26b269cb2b923b7c74ada7b4c6541aa4f74e",
        "audioSha256": "439a1c3958384d5c842bf7f6dae0d724669e6158f53cf59b9b999d4846a20ab5"
      },
      {
        "section": "reopen",
        "seconds": 51.336,
        "bytes": 308016,
        "sourceSha256": "f37f66f156354ac34bc282f5b8adff365595b8e279c5eadd89736e47ab323495",
        "audioSha256": "b36ce2166e1ee3d89d376326b95767a714b6ce12ebf42de480712a814b0a465f"
      },
      {
        "section": "practice",
        "seconds": 29.808,
        "bytes": 178848,
        "sourceSha256": "4389d178d8b1a1ad1c5991fe140fcdcf7297b0258f3fb94952c932fbed508c4a",
        "audioSha256": "09f922c73b209861aa071c8d8d3643b23558223b3581ed59fb1184c63cc20ee8"
      },
      {
        "section": "feedback-1",
        "seconds": 8.424,
        "bytes": 50544,
        "sourceSha256": "949403bd85bf8b026dba0f61100b3fabfbf7335c2a17d585e085f4e7b30ae535",
        "audioSha256": "b217cb5b6a6befe79686fc5910b328d7b682b6c726ffa952112ae9db216ffc44"
      },
      {
        "section": "feedback-2",
        "seconds": 11.592,
        "bytes": 69552,
        "sourceSha256": "25f0b383e2540b832063d925115bba8afad8b72b785f1863e556b76e0d93a696",
        "audioSha256": "7c5f412c58614e5e4720c40be3ff31f1cfe091f368aa7b69e1f162ff1c31649f"
      },
      {
        "section": "feedback-3",
        "seconds": 7.224,
        "bytes": 43344,
        "sourceSha256": "f9213b96d8742fda06e14d8430e9b327bc8e7235119f9cd4e171644502571a6f",
        "audioSha256": "71dadd9f039f8564f2273dc3529963542c248cc1b548c15606d5c1c39dac5b11"
      },
      {
        "section": "next",
        "seconds": 38.88,
        "bytes": 233280,
        "sourceSha256": "6e1bbd53de0352e54199947488fa1ad7dd2538678ee69a726f171354d82c3022",
        "audioSha256": "96dd5e4b4468e32588739735776604bb0906e1fa741947fcfaf67c7f0ae593d2"
      }
    ]
  },
  "design": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 33.024,
        "bytes": 198144,
        "sourceSha256": "c5fd1471b70fdff760fac763e4b2ffb5a57451935464c60ba7cefe417f079d05",
        "audioSha256": "f35a994ef41a34a99be46f066df592b9ff934a9dcd6624917f2e2eda3e02cde9"
      },
      {
        "section": "site-base",
        "seconds": 50.112,
        "bytes": 300672,
        "sourceSha256": "9b924546e0c8be358ad538022da4b2b6688956bd6d8406b6628435ae05335d53",
        "audioSha256": "e5fdb2f7e393d6a27d16ffff8151ef1f0a524c8c2e5c4f33e5852bc771e3fa1b"
      },
      {
        "section": "read-sectors",
        "seconds": 49.848,
        "bytes": 299088,
        "sourceSha256": "1a0dc9169291bd3062a34c8c9b5dd247848ac056db210cfe4837987f61cee3e0",
        "audioSha256": "d9daac4f7197e22efb6c9fdbda07573438bd3f4485e650fd25967861cbc4c0f0"
      },
      {
        "section": "place-systems",
        "seconds": 54.888,
        "bytes": 329328,
        "sourceSha256": "10a60428e79ceed4107c3f0fed5b8d52f56bb2a3e12415803f10fe66908f6a3e",
        "audioSha256": "e24d8c0a4e119c7f4f514ab256a7b24ab0eb7a4815b3d23a5819ac22550ebc08"
      },
      {
        "section": "edit-undo",
        "seconds": 56.88,
        "bytes": 341280,
        "sourceSha256": "ba5591338111b41677c9681b4a882ed704d3d93d662fc19984dda8635eeb0831",
        "audioSha256": "a3924c818d2ef21bbbffb6035ac585ad189221dc43508a36f23f643a0610296d"
      },
      {
        "section": "review-save",
        "seconds": 60.12,
        "bytes": 360720,
        "sourceSha256": "5096b84a4543ac084ef76edeedc4b7aa60fc57bd339badc2b2b5860883aae511",
        "audioSha256": "912db51e2186ddce688c64cfff238e578381de9f6131512ad85a0ed809e7c5d9"
      },
      {
        "section": "preview-sheet",
        "seconds": 60.264,
        "bytes": 361584,
        "sourceSha256": "6fd9de37b7c2fe6d61e71884588a90fb620e1e207419a08765e8c65e90475adc",
        "audioSha256": "d08ac4a364988bc17c370f45c07ab11b59348bacaef9744a656c909ac97eedba"
      },
      {
        "section": "export-plan",
        "seconds": 56.352,
        "bytes": 338112,
        "sourceSha256": "bbe59a21e9a24b10f755784628ac86fd9258ade71f2df74a9a6e3efbe39362e6",
        "audioSha256": "24c6c88b2334b8b14c5bc073e4fcd393a44464cdc7e17847a5fa860c00df1876"
      },
      {
        "section": "practice",
        "seconds": 28.872,
        "bytes": 173232,
        "sourceSha256": "b2821e854da895136a233b2aa6879e87899a81f74dc0e77d9583a5635895bfa7",
        "audioSha256": "3ce58154b72be820a78069ba84978281a390191f1c34a82bb4740cf290ed8070"
      },
      {
        "section": "feedback-1",
        "seconds": 7.056,
        "bytes": 42336,
        "sourceSha256": "4313758310acb89ce48563f06f9b5238a4c5ccbe45286c249ca9893955a088c3",
        "audioSha256": "5b40c2e116e4986b013cc36881025602ba166024e7c33b3edf8d1f873a5d28d3"
      },
      {
        "section": "feedback-2",
        "seconds": 9.504,
        "bytes": 57024,
        "sourceSha256": "4a59a4e81b85a18533c8e101664f171360fef4c2b7db0157f5c4ba753cb529f2",
        "audioSha256": "9c1c80b3459e11b0b826493167cb4d594cd977ad94c5f3c713526962a2d53903"
      },
      {
        "section": "feedback-3",
        "seconds": 9.624,
        "bytes": 57744,
        "sourceSha256": "1629f5e48e134b77e7606c5e4a752896e528fe0792c9b0f7960a3dff170389f3",
        "audioSha256": "133609c12087ba045128a6080b8207ec093b4078d4a85e53e2e4cd7922ed9a99"
      },
      {
        "section": "next",
        "seconds": 55.056,
        "bytes": 330336,
        "sourceSha256": "ed924551a9118f0edbcd371e5e88803e0edd06fd103495e0724a4bb9e04ba35a",
        "audioSha256": "2c2fa31211693491642beef8854525ecf5244b99c0d7ca89804de8fe7442dd25"
      }
    ]
  },
  "crop-planning": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 36.168,
        "bytes": 217008,
        "sourceSha256": "923f3679174ae588d6a3c152b2c661cf16b0d9e9a44aeccf330119dbbf11ef84",
        "audioSha256": "439fa834aed9a4802bcddc452985df81799dcce142d9cdff5bdd354ea9d98fd5"
      },
      {
        "section": "check-areas",
        "seconds": 56.16,
        "bytes": 336960,
        "sourceSha256": "04498471ec32d4544a6731caa5e90570f3d9e9c438911829dbc932b662d9c255",
        "audioSha256": "f8a0590f733e76956cf7d6d19f3dcac93d41c1df40ca884d5ab45fdfa7157918"
      },
      {
        "section": "choose-planting",
        "seconds": 53.616,
        "bytes": 321696,
        "sourceSha256": "eb46aeb14951b2216e4e47ab537153a0a33b4b811307c95d54ff6728de519444",
        "audioSha256": "85ff6f24f6ebe232c969d3260b1b0d265742b3d296cee178afb104cdd5fbf85e"
      },
      {
        "section": "timing-space",
        "seconds": 56.496,
        "bytes": 338976,
        "sourceSha256": "98c89b60a9b26a90da24b352a91c4fdc435d82e9e6757b9b93114fd27abe0d2a",
        "audioSha256": "e24274acda3d7d64126011955fadea6cb052402b3de8ad5dd9b0e805a2623a25"
      },
      {
        "section": "save-check",
        "seconds": 57.768,
        "bytes": 346608,
        "sourceSha256": "d9423acc438d889f9615fc2a165de1b0227fa9914f550dc3ef9013630eb77d4d",
        "audioSha256": "5626d5b7a6dde344313c53fc8a43571238c37c4258e9e50d4a9595cca7d2b8e5"
      },
      {
        "section": "suggest-review",
        "seconds": 68.4,
        "bytes": 410400,
        "sourceSha256": "3c60fd461470889f1b067fc62f56dd8aec30681058c54fd7e4841b218a1748dc",
        "audioSha256": "ad83c77966cec945117720010a7c8b074807d782b6a64442cf8bc67847f883b9"
      },
      {
        "section": "read-calendar",
        "seconds": 63.624,
        "bytes": 381744,
        "sourceSha256": "bc908f8455981dad4bf931dc5389601f47220cd89b1af44e988ffd611eddedb6",
        "audioSha256": "de2d1f146d01156526cb6139e1f21cf882453a4fed5278b521dcf387682c87f3"
      },
      {
        "section": "take-plan",
        "seconds": 63.24,
        "bytes": 379440,
        "sourceSha256": "253509ea59adf840e327674f7aa4cde9271489f4262795cd5ea1425c4f3e4eda",
        "audioSha256": "e884c9365f615285b03c03959be11867961039bdc74f40bb234da38287dc6e57"
      },
      {
        "section": "practice",
        "seconds": 28.296,
        "bytes": 169776,
        "sourceSha256": "da4d3458f0997556cbaa82b913235dcba32ef4b4ae2f8d1b0ecbfd1322c0a40a",
        "audioSha256": "b37fa76bf5d6488508c58647942f2ad39595e643b03b97777e56cf4f47bd429c"
      },
      {
        "section": "feedback-1",
        "seconds": 6.072,
        "bytes": 36432,
        "sourceSha256": "a1c2c446218355c693ad809c23966edbe08d5378df11ba530e074e1599e28644",
        "audioSha256": "ce11c141d4aa1e73f660cb921a7c3a40ccecdf62ba9de5fd503831a7bae1e747"
      },
      {
        "section": "feedback-2",
        "seconds": 9.528,
        "bytes": 57168,
        "sourceSha256": "b35dfcae9a1d65512934398a523a421b3e671ffa01390c74cf7ef1018d0b7c2e",
        "audioSha256": "c7c97a4b6aca67c58547e23bc8f7ba6684f7d34619ade4bf647240788d863374"
      },
      {
        "section": "feedback-3",
        "seconds": 7.176,
        "bytes": 43056,
        "sourceSha256": "265ee20828a600b81ec7569cdb9982a68299b878b9346ebf9e702f25fc980466",
        "audioSha256": "4872df5a24dfb817e409f82a726a90a5d875d221b9b63c59e4e17f5f2d102fdd"
      },
      {
        "section": "next",
        "seconds": 48.768,
        "bytes": 292608,
        "sourceSha256": "1cd0cda88e9ae5e210514ab788ffdf634aa1ac0af61f057e3be739c28d3eefbd",
        "audioSha256": "2bdb552416c716eaaa5bf777f59c5f532abe5c387976aee76147844f13fd17a7"
      }
    ]
  },
  "harvest": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 34.32,
        "bytes": 205920,
        "sourceSha256": "37485592231d13f8cfa3e1cb021e51473b5d6aece7459429d55f3a0ed6dd6016",
        "audioSha256": "e73cd6f8730ebc8f96e1bbfd394750cf7601ce3825caba234666baded2faf174"
      },
      {
        "section": "find",
        "seconds": 31.848,
        "bytes": 191088,
        "sourceSha256": "1116dc09942fdcfcb69f796d693784af12458fd6a2ec146abd2e7ab4a434b3ce",
        "audioSha256": "6faa0a4f3e6fcda669e78f030138ff9e0eb2b9769ea407df4adeb604ebf5568c"
      },
      {
        "section": "measure",
        "seconds": 45.048,
        "bytes": 270288,
        "sourceSha256": "17f40318fdf59af55313e8742aab890b3675092e7ff730d949d07905e3acc12a",
        "audioSha256": "da69f234597eafce62be502f377b9df8e37eb800e165b1f0eee09aa2f85a0d42"
      },
      {
        "section": "photo",
        "seconds": 34.248,
        "bytes": 205488,
        "sourceSha256": "a5a229923e7dc172d4ea0c94941ff2bf1948628043fba166e3228db56f1ac018",
        "audioSha256": "af0c89770a97777e27e684c809847c87356d116fef388bcff35c72f5e08c013f"
      },
      {
        "section": "save",
        "seconds": 50.208,
        "bytes": 301248,
        "sourceSha256": "38881ed880f37c9c3a47d2a3788a52de8617415a74eb9858f1d49627acf1d29b",
        "audioSha256": "15eba56b7f5a60b103fb6d300672699f6b728d3eaa942bc61fdec71ab8c9907e"
      },
      {
        "section": "compare",
        "seconds": 48.288,
        "bytes": 289728,
        "sourceSha256": "db48aee8d71e77c0bb47effacde08d8d6de4f75b6634450c1a9aecb808533759",
        "audioSha256": "e5063c80ea424de14723290687dcdbd273d04f31efbd0b6c7c11edd87e9940f7"
      },
      {
        "section": "practice",
        "seconds": 28.608,
        "bytes": 171648,
        "sourceSha256": "c6230575489ea55c8fb64585f88e96d94945c074d43c3f80181884144d7b116e",
        "audioSha256": "3a08075410cd6cd6eda3c65f9f8de9c00d2336caeddd98bfedf9aca25991d263"
      },
      {
        "section": "feedback-1",
        "seconds": 7.608,
        "bytes": 45648,
        "sourceSha256": "ddb57250c55a6ae554680f072a873266d6a34fe8c61d211be2573fc5387af99d",
        "audioSha256": "3f322d7c06a498a8d59cd2b32f7517f7149920bd1d8257128e62890d22d03b1c"
      },
      {
        "section": "feedback-2",
        "seconds": 6.864,
        "bytes": 41184,
        "sourceSha256": "75f9d99c0d8952b621c08c8403542dff7368c24e30ea6813ccd52c7082849218",
        "audioSha256": "527e5fc69e773a074268abcca4077d855a0f43daae168c69a923d273f20be811"
      },
      {
        "section": "feedback-3",
        "seconds": 6.6,
        "bytes": 39600,
        "sourceSha256": "5bcfb756d8438af75030252b75846015c4655b2eb242b7d3c39b3012cd854580",
        "audioSha256": "00e980f10c2caa8215ab05b6513b844e1a493e2bd40d8ffac1897718696c7b95"
      },
      {
        "section": "next",
        "seconds": 33.168,
        "bytes": 199008,
        "sourceSha256": "a35c137a33e218c76fc981b24f25b343b574b02e54f2855045fdfd7d34598c9e",
        "audioSha256": "bec635cc629f679e86d6b240b1bdc48a39dc37ca0a71035b98cb08bc80abb43b"
      }
    ]
  },
  "sales": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 34.752,
        "bytes": 208512,
        "sourceSha256": "ee4238f1fe95382645a6f100b186fb3cad68a2ac2c7896d0aa3ff871bc5fd865",
        "audioSha256": "b44d4fe9823824b021cf603b6522e07731b8202fad250d5810b215fa7223c487"
      },
      {
        "section": "find-sale",
        "seconds": 51.84,
        "bytes": 311040,
        "sourceSha256": "38945ce80fee3d6577211c4b2c132a1cd465f01ab4e418c9644fa270e6027a0a",
        "audioSha256": "a0b43b51a39b4aa2f42c921337f41f19a677aacb0c432335fbfa04fd211bd6e1"
      },
      {
        "section": "choose-source",
        "seconds": 46.752,
        "bytes": 280512,
        "sourceSha256": "14afcc7d4024fc54cab6c448910d4354803cca0f6e9b8b3d65bfd5339413c88b",
        "audioSha256": "9b875e837f86207cccefa3dc2a4456b72f403070515b4376aab8d894d1444bd8"
      },
      {
        "section": "check-sale",
        "seconds": 51.048,
        "bytes": 306288,
        "sourceSha256": "562407cc80a74422fe81ea5c3d75956a2857c34bca138ac3253bff1ca92dbff8",
        "audioSha256": "377942f60e35c341e3e6dc1a3f1e629c479f87331c487f3486ce5eea5ac5ba24"
      },
      {
        "section": "check-payment",
        "seconds": 64.032,
        "bytes": 384192,
        "sourceSha256": "51a4f8cf1b320f8b5129a7b6c089aa88127758686f2a90c07840656fb8f6c883",
        "audioSha256": "d36fcf257f0e50964dc10b4bf51cbba960f0a1b5ac578681d39b20bcfc2a7b89"
      },
      {
        "section": "save-sale",
        "seconds": 50.52,
        "bytes": 303120,
        "sourceSha256": "b996e44300cb8757d7b2d461a825532404b21d597b59f1362ea81e1daafe3056",
        "audioSha256": "298f4d8de2e6067eb35f1e7af967037292102b67b39dbbfe1522db2c08632ac9"
      },
      {
        "section": "follow-sale",
        "seconds": 49.944,
        "bytes": 299664,
        "sourceSha256": "90e0faf2ce1fd5ec1a6a4a0da108b4f387c9642a685ce9b8131df8d868224b72",
        "audioSha256": "3524d489d84d98d54441f7c0e911728bd4982189179eb67a04046ccfd4650a69"
      },
      {
        "section": "practice",
        "seconds": 34.104,
        "bytes": 204624,
        "sourceSha256": "62ebae520fdbdc984546f6e531a29db7213e2c73417948a232250f78e1838b66",
        "audioSha256": "2fc71b843333690a3b4afe0cc2508271346c3b6017cd9d88f6166eb55f5c85cb"
      },
      {
        "section": "feedback-1",
        "seconds": 8.712,
        "bytes": 52272,
        "sourceSha256": "d0cd29fe4d03f0539ed7c834cfcda330baf04bd072cc508a130032307fb14cdc",
        "audioSha256": "37f6a8c2fcca58b9a33e3713d68644ddb998b80fffa702ac1d41f3feb44c9ff4"
      },
      {
        "section": "feedback-2",
        "seconds": 12.576,
        "bytes": 75456,
        "sourceSha256": "75164b15a3507bf197edfbcdcec2d5faa8a34ebb435ccdec2895ece771db3e80",
        "audioSha256": "e0d10c69790c10ac345fc8614cc0a7cdbcb98523416c161f916f62e6f20c0723"
      },
      {
        "section": "feedback-3",
        "seconds": 7.176,
        "bytes": 43056,
        "sourceSha256": "aae2e6d4d2b4df121f809821c35ccc4a2143f5920810bfccd1079ae83f4ef6d7",
        "audioSha256": "5cd7dcc2a1734ad18cda845a380dbac8a3a7380bd7860e26e618c818c6c55385"
      },
      {
        "section": "next",
        "seconds": 37.104,
        "bytes": 222624,
        "sourceSha256": "a82f74b9daf1a460b8f6304b70cf2e81d77945d56f966ec48e13578e3d63f3d2",
        "audioSha256": "ad00d47233833f5e13150211a551d8e1c711b992aba43b972af7b58990c7234e"
      }
    ]
  },
  "expenses": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 33.48,
        "bytes": 200880,
        "sourceSha256": "4d21fed5ead5c5ac8ec4e451a7f7811153349a8c3c0936d0b9717841928f897b",
        "audioSha256": "c3dc1780e0f2fafdf3e20438d06a8276f2cd19a0f646fdccb5ed941cf41e2c24"
      },
      {
        "section": "find",
        "seconds": 31.464,
        "bytes": 188784,
        "sourceSha256": "2c2b5c8bf92cc2769750e85bf474a092ca58a918a9001be3904a6f41c6029d7b",
        "audioSha256": "ab461ee72b066e080564cdf626f6d7de91aac472526c6c045ce63d11118780f0"
      },
      {
        "section": "amount",
        "seconds": 44.448,
        "bytes": 266688,
        "sourceSha256": "1e9ba40c5c922aec594e67da1b8b9bc8e1d822fb44a67354d3dcc049809cc720",
        "audioSha256": "032b1763cada80d2b7eca6df3ec04041a9500be26028ee002c26d3fcbd79e930"
      },
      {
        "section": "assign",
        "seconds": 38.592,
        "bytes": 231552,
        "sourceSha256": "44bc6acde1e245bfd0c9475a551171befadcb2c2132f5f70ca259cfe43e7cfee",
        "audioSha256": "017302ea0acb8b53a6ffe6d542b106d11abb6d5d513f61abc13803f1f1c6347f"
      },
      {
        "section": "receipt",
        "seconds": 48.048,
        "bytes": 288288,
        "sourceSha256": "17aad3e06ee35801f979d8bb423b76c9c9e5af4970edc23f5a33b1d2725bd0dc",
        "audioSha256": "f2f0be2c104a2dab742ef2787801b30eda815cad437b9e73d1966665f92f922e"
      },
      {
        "section": "save",
        "seconds": 47.808,
        "bytes": 286848,
        "sourceSha256": "71bb7afc98d365fbbc3f645496ca3dc787745ca2bcf80d697833956e1bae2afe",
        "audioSha256": "6f081d9d60ea0e3c630d51255cb805f26784c4389cbb5192f5a90426c8dfdbdb"
      },
      {
        "section": "practice",
        "seconds": 29.784,
        "bytes": 178704,
        "sourceSha256": "915c75020ef7334f67bf09f1c417b1b6dc3045d730bb54587e532079176a5421",
        "audioSha256": "c5c934f43ddbb7d09adc52d93f3d28f694e199a752176743e86e38342e0a4513"
      },
      {
        "section": "feedback-1",
        "seconds": 6.36,
        "bytes": 38160,
        "sourceSha256": "951c82938ee0d786e6432146d0bbe03405d894a4519c878ddf3d5b6e57fc7591",
        "audioSha256": "97ea270ee3ab826d717eda5cdc4a48729e11d9d68868c25938e49358bb5b714a"
      },
      {
        "section": "feedback-2",
        "seconds": 9.048,
        "bytes": 54288,
        "sourceSha256": "328b0e49c11514b729f7b007d3603f1f9b2a5f7764df1c387776930cfed397e1",
        "audioSha256": "53af5ddd6c09ca284a21821890a0e2bac8dfeaf0b1139c81ba08ec13920364f8"
      },
      {
        "section": "feedback-3",
        "seconds": 6.456,
        "bytes": 38736,
        "sourceSha256": "d2e6eccee88b8825fbc63ff0e6b5db4a8e44e0094ef525515244f29ca5768885",
        "audioSha256": "32e2850a98a106c8db9daca8ddf85355fb62bb3fc53176f7598b8f73a81337ba"
      },
      {
        "section": "next",
        "seconds": 39.12,
        "bytes": 234720,
        "sourceSha256": "b624851fd66f394411eb7278751b90d0c7773661b63eb7dcfc2646d84d864b80",
        "audioSha256": "15c8b524dc13f100f88371c57b71edae3a9ce64531571546d42a785b82c0030a"
      }
    ]
  },
  "invoices": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 32.424,
        "bytes": 194544,
        "sourceSha256": "7cff82fa21cc9d6839cfa90ae1976fe6408c3dbde6a7a96d9464b28b17fd6ceb",
        "audioSha256": "8dd627c653af1931d29802f7ef11dc2890ec9588cc5cbd5ef36ec12329afed76"
      },
      {
        "section": "find",
        "seconds": 48.264,
        "bytes": 289584,
        "sourceSha256": "fc09c765aec58fe2cc389cccd4f0b0e65b4dcecb8271f1679a8a80678a25d6c6",
        "audioSha256": "dd12f02f86127cd75f61d9bd45beebfb9753d14762b6dfd7f7667c122d7e914e"
      },
      {
        "section": "details",
        "seconds": 51.168,
        "bytes": 307008,
        "sourceSha256": "9dd8a7d3a7828fc6b34fabfd2a1ebba7234fd7d66689d596f705d150d1136619",
        "audioSha256": "7a43e6f325ef82a8f32b35f210fe40f16ce31c6c2ca71e5f7d17c10a1066d192"
      },
      {
        "section": "payment",
        "seconds": 47.76,
        "bytes": 286560,
        "sourceSha256": "8dcb19a1f3c3ab736a1d8fff69b5ad704cc8dc50c72db7092660a7226bbd8f3f",
        "audioSha256": "1696eac12a57da7e34c3ecaf77f3675fce52bcecfabfe55fd017c109ecbeef00"
      },
      {
        "section": "save",
        "seconds": 49.488,
        "bytes": 296928,
        "sourceSha256": "f6cfe427be05a4f2a8d548379b6e5d82b149a3c83d4490f408ff7b74e7987c5d",
        "audioSha256": "e302defa7e7d9c40eab76b9f0ad0e133a5f71a51587fc6639ac9dfda3fe32a03"
      },
      {
        "section": "share",
        "seconds": 46.272,
        "bytes": 277632,
        "sourceSha256": "6b1ba733267c3dbd638b29273f6e78b5752593371008e7408555e4d28edfcf99",
        "audioSha256": "56a75431367c3dab7550a46ae36c39b93aa4602957e339cf6728079d42f925c4"
      },
      {
        "section": "practice",
        "seconds": 26.904,
        "bytes": 161424,
        "sourceSha256": "3a39c556cfb709dfa8a32a3b2583cb42b803444299fa90fa40cad39bb1836224",
        "audioSha256": "c70b310e89990b692bb5c43b892cdcc8496a64ebfc109f5e0c9a8c7aad3ce240"
      },
      {
        "section": "feedback-1",
        "seconds": 6.648,
        "bytes": 39888,
        "sourceSha256": "aa33d4ca8c7d040a174dc2ece72f31b37be0c59e02b2017d254c5f24251f61c2",
        "audioSha256": "0dea0d1f05806541e11fb96d56106c0af1706cbca938dc8d09f5ea41b9a73c31"
      },
      {
        "section": "feedback-2",
        "seconds": 9.072,
        "bytes": 54432,
        "sourceSha256": "25c8ac70e39e002373682cdf9e6f8ace8c9e64fd0818fdff70fb77199ebb593b",
        "audioSha256": "0529a93b49ddfdc1d45080541b9a5b4cb2329cc07df8c1dd89f0fd5bc6687844"
      },
      {
        "section": "feedback-3",
        "seconds": 7.512,
        "bytes": 45072,
        "sourceSha256": "2817074d7cbdb10b7e783372b46e773bb77d52f36f1818842bf13d76fa009acd",
        "audioSha256": "b6ff582f5d1c7794485f5897ec5647542b3b8d3facbe96cbd7e1bb37936ec813"
      },
      {
        "section": "next",
        "seconds": 38.712,
        "bytes": 232272,
        "sourceSha256": "d29e3bce1dc4751699838e1e3f5518182aaf804f2ac91fa85762cc0140e28e3f",
        "audioSha256": "11922868a035ed86bea0b31a1698a974c6d76f83485dcef787a54d89aa815532"
      }
    ]
  },
  "past-sales": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 39.336,
        "bytes": 236016,
        "sourceSha256": "12c380a546639fd56e7e576fa0edf9a01c9d45d0c9d4cb5092ef3e7326e8fdb2",
        "audioSha256": "8701fec9f0ff4005828761327f32b9ee38b457885e42a6d6eb021a61e99ad134"
      },
      {
        "section": "check-existing",
        "seconds": 35.304,
        "bytes": 211824,
        "sourceSha256": "cd620109740164abdd0180170f701a86616692dce2d360f9b706d3db10980ba2",
        "audioSha256": "9bfe32ccf2e9413e9f39891b1f6f18c4ad8502a937414cf1bc556a282791d48b"
      },
      {
        "section": "choose-entry",
        "seconds": 49.272,
        "bytes": 295632,
        "sourceSha256": "309e32897dadc00b2ed678be34ecae35d85462d6cc104a75719fd81d569dcc5b",
        "audioSha256": "58a0dd26227108260bfb382c1aa101f45d0ea5ef22baf1c77a95c7053d9223fa"
      },
      {
        "section": "link-sale",
        "seconds": 57.672,
        "bytes": 346032,
        "sourceSha256": "aa3cba07fce5c360af168a173348e5d7f11f888993ad4c765e1fd4eef6f50a84",
        "audioSha256": "7e8915ca65e1cefdac588d64c9f7bab88993f6efb5a3d9a0c64905eb2331a61a"
      },
      {
        "section": "source-details",
        "seconds": 52.776,
        "bytes": 316656,
        "sourceSha256": "e47434bd4227a6558c0542307779137d19e73c5bbe8443827794021d614926d8",
        "audioSha256": "8d095b516e292ea59f42830d00a16b5a26b61eee301862464a952c99e315b451"
      },
      {
        "section": "old-payment",
        "seconds": 53.064,
        "bytes": 318384,
        "sourceSha256": "aa6da5da3e75022f9c98ffc882d248ef8c011553908dd9dec70488e82ce00cb7",
        "audioSha256": "7b6074fdab64d679dc76a9e5242f1b3d5b2b99c63c075f74af6fae61d59145dd"
      },
      {
        "section": "verify-copy",
        "seconds": 49.68,
        "bytes": 298080,
        "sourceSha256": "66a545fc00526d6b0c67879c3710ccfda36d79c5a88c6818e211ba132304bac2",
        "audioSha256": "a388de331a695e1e99ccf84a5061789c0c50774e03957ff7c098726339112072"
      },
      {
        "section": "practice",
        "seconds": 30.624,
        "bytes": 183744,
        "sourceSha256": "263cd1410870ce603736ca0fc52d2c7e345d5d4e9f08f2ac69eb9d14548f8229",
        "audioSha256": "90527e0a25ab60ec6da57ed8e1e02c09468f67a080bbe2a5698ddb4217b9b1c8"
      },
      {
        "section": "feedback-1",
        "seconds": 7.248,
        "bytes": 43488,
        "sourceSha256": "da0777832bbfbd14b66ce65226f17d59cdd3910322096921b4161dc3e129d81d",
        "audioSha256": "06a67ed5346c552faf20a20f37eb77aec1bff36464d8caee4bffb2d4849177df"
      },
      {
        "section": "feedback-2",
        "seconds": 9.816,
        "bytes": 58896,
        "sourceSha256": "c5e2056e76b011f99ef9cdd6f234d7b25d2f1412c1e516c03f3d8179a5e55c17",
        "audioSha256": "8691c4e40e9f09dbc6e5d88997fab9cd557fadcd6a61641a62c1432c4503bb95"
      },
      {
        "section": "feedback-3",
        "seconds": 7.2,
        "bytes": 43200,
        "sourceSha256": "23f79c6af9dc21d3c901a56405350b81ea7eb9eafa527452c1e246a6d51743ae",
        "audioSha256": "3fe43e59aaa8e183366b623181eb2f7cda169e0074836c8bba0e98b5e1f09f56"
      },
      {
        "section": "next",
        "seconds": 37.128,
        "bytes": 222768,
        "sourceSha256": "f654b8da86bd4e32b0e007ffe14dbd0124eb4afb603e06ca088c34fbcd4c5262",
        "audioSha256": "2cb5e3c3c6b877c93ec847a93c98b40eb7312dac29301083e6a294927a45677f"
      }
    ]
  },
  "payments": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 32.76,
        "bytes": 196560,
        "sourceSha256": "656ff176153d9a6e5da70c05cb607c009089642763a6934c822cf3440b397bcb",
        "audioSha256": "af0309ab3f774ce1781bf6e2e81c2e20915ce0a6185a36401ff41cc66848b67e"
      },
      {
        "section": "right-invoice",
        "seconds": 31.56,
        "bytes": 189360,
        "sourceSha256": "3ba63599005ff0bd30bbb5316ba2c312b1718d907b2258ab29612e9baf825997",
        "audioSha256": "ca1fb5e2f52d13b50d0a150ee8fb4cbe899b7f6289b4ab8a46b2c9ee60c21c01"
      },
      {
        "section": "payment-evidence",
        "seconds": 45.6,
        "bytes": 273600,
        "sourceSha256": "2e3598fcf0d733457cb22a978ff64124b50a4e7a0c4f9472fb9808878ffc6269",
        "audioSha256": "d48c6545980844901664c3f074afef3a49c37b195df5120101fce7d70a7aad3a"
      },
      {
        "section": "update-payment",
        "seconds": 53.304,
        "bytes": 319824,
        "sourceSha256": "d905fa3eef4f8082b7cfb6ac967fb2ed7c9883dfecf8667a7691c85c033b4fa4",
        "audioSha256": "587e7f600e26363cb6716e23510c3034360e90c8da1356fc1e9b3fa66cce8529"
      },
      {
        "section": "check-book",
        "seconds": 49.056,
        "bytes": 294336,
        "sourceSha256": "b16f1303eb41ff4c4b87ca1a047ea099470796a3d66ace7fca5175d6a94ef85e",
        "audioSha256": "24a8dfa6a469ca62b219ee0fb810da02e3243da63804321d483bd96f771a533a"
      },
      {
        "section": "inspect-copy",
        "seconds": 56.592,
        "bytes": 339552,
        "sourceSha256": "df3306611f6c33da924e6d9121db48d2c6b31e6241bb1cee2bc662a61b6f7e6b",
        "audioSha256": "e77a904f8a579648d94c3248e275851dd8f82ad6b0255b30145f36270edcfa92"
      },
      {
        "section": "share-copy",
        "seconds": 42.24,
        "bytes": 253440,
        "sourceSha256": "ae4baf615fec38fae3df56fb8f6b45353ae43cd978a0301d11ee5593039bd4cf",
        "audioSha256": "7c3c5cdf209717213480cb59499b709dc07e094fee67f4599ae74c5f2cca8db6"
      },
      {
        "section": "practice",
        "seconds": 29.064,
        "bytes": 174384,
        "sourceSha256": "7982d4d60aafb6a02009d0f4441a1b38a02883fecbd9f98b9a0114dfa61f15f4",
        "audioSha256": "d3597c5fd5e7ff4cc40c371a7e9e3939aa30178136445e4aaef23d43161450b5"
      },
      {
        "section": "feedback-1",
        "seconds": 5.64,
        "bytes": 33840,
        "sourceSha256": "a4a7e4ded7aaa7affb64be90f063d787ea796505a86ddc47bcacda6169130657",
        "audioSha256": "35cb3af25620cf61009ccac6ffe724e1edb598b470512bab1b0cb752e17f550a"
      },
      {
        "section": "feedback-2",
        "seconds": 9.456,
        "bytes": 56736,
        "sourceSha256": "c8b57c6bf1510cd91077af742eab46d926d8feb8de6cd316e1727aeb89cf614e",
        "audioSha256": "d2e1fc634626faac351fa83c4f3e804f4fc9475b874541c310ab72df15ed806c"
      },
      {
        "section": "feedback-3",
        "seconds": 7.776,
        "bytes": 46656,
        "sourceSha256": "fb2635696e150e950b164ead26571c47f008d931c0fc5e2b500d2121e94330b2",
        "audioSha256": "7300661e207f47d7d6e74fc76acd03a0cad7b885d37f3c43d707b1a83b9fc1e0"
      },
      {
        "section": "next",
        "seconds": 40.56,
        "bytes": 243360,
        "sourceSha256": "81c486b9cfc72fa0455a37a4519e8d067d98f7b1174d88b10bd08ec8efa339ed",
        "audioSha256": "2b53ccd0533e140161b0c3404656b6fe5f89b7b70e025e96d9fc195be9e503f3"
      }
    ]
  },
  "charts": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 42.696,
        "bytes": 256176,
        "sourceSha256": "f2a314466975e07c5e909e131b5d6297d0d682b59e98e06462df7c160d0e4fc3",
        "audioSha256": "d90ab3d9ade9ec2a8b8d8197b8a3a3bf4890135523837b4e2a8d3985293650b0"
      },
      {
        "section": "chart-window",
        "seconds": 53.664,
        "bytes": 321984,
        "sourceSha256": "986d614eab4878338da40c183f0edc1522d14641bc55e638cc3ddfb06c8de9b8",
        "audioSha256": "dc36d33c2d723ba9565eef2bd9127f69808b007aa43dc4c32210e22947924e59"
      },
      {
        "section": "cash-meaning",
        "seconds": 62.856,
        "bytes": 377136,
        "sourceSha256": "1735dd639b8d155b6763f0da16c2e92e10cbd2ee5131b0bd367374b2a607eaad",
        "audioSha256": "883caa08281c67292f21a0e9eec32a5e484ace5a3d7cb0a80fa4a56875dffd36"
      },
      {
        "section": "harvest-meaning",
        "seconds": 55.248,
        "bytes": 331488,
        "sourceSha256": "788c5a691fdcf052bcc7534e16c2e668f0ed8502ccdbf4bb06e64a79ff957845",
        "audioSha256": "4ef1620d5ff6406ebaaabd1727cb74d23f6cdcb282a87707dc1e7ac4eed120b3"
      },
      {
        "section": "plan-meaning",
        "seconds": 55.44,
        "bytes": 332640,
        "sourceSha256": "a592814f916d3490cfacfb791abc5357546cf77b849e28b9a58c8415afa34201",
        "audioSha256": "51599c615110b4b068ce114542c6ddf484296109ecbf832e43af59c37c004191"
      },
      {
        "section": "area-meaning",
        "seconds": 52.896,
        "bytes": 317376,
        "sourceSha256": "30817b0f68f7c43bc12dda19d185ea161c133c8f63ba6df8c83471be46906b14",
        "audioSha256": "b8af4187a9148889b4f967f9546d4ee6bf8de4936c486df618befc7e378cf5d6"
      },
      {
        "section": "trace-figure",
        "seconds": 70.776,
        "bytes": 424656,
        "sourceSha256": "e4d5f96be4c8901bf9cc341ae8dc94ca8fe51b2e909a5094282b867077573a55",
        "audioSha256": "b9851510342b832acb19f7a04a7d081d61fc6a7d3cd6734e81782fc3ea4da653"
      },
      {
        "section": "practice",
        "seconds": 33.192,
        "bytes": 199152,
        "sourceSha256": "95b49b74fa79d03f6a7243b3aa7d700e030ae0f6f817f8e14d28e36da05a5c81",
        "audioSha256": "cd1abf2224e25b65862426e9a75a4003fdb03fd79b4762ef812dbd20e3ce3f0a"
      },
      {
        "section": "feedback-1",
        "seconds": 9.72,
        "bytes": 58320,
        "sourceSha256": "8e8f35a53d07a5f9ea5f7cce4eeae4c9a5ddc57cd72abf466980ceca5d3aa924",
        "audioSha256": "93dc0992c92ff843b1a37b13e75d28c58e809918840fb6557024ae8754c14ce9"
      },
      {
        "section": "feedback-2",
        "seconds": 10.152,
        "bytes": 60912,
        "sourceSha256": "bbf3f2d17e6aa1a6d018c217168d16acc285b8c61eb0562cd5a4b8df128e876d",
        "audioSha256": "76893e131a815a298c9558d17e707a46938c28cbd699b20a0041dd7132d8f569"
      },
      {
        "section": "feedback-3",
        "seconds": 8.016,
        "bytes": 48096,
        "sourceSha256": "d42f7ee69b00ba918af262ca92f491adfa00b2b65cd8c8c9c04b519b70c43b6b",
        "audioSha256": "f856b6de10acdd033af59363c1b08e8cc9aa9cf878d6881ff63da5a15b73005e"
      },
      {
        "section": "next",
        "seconds": 41.952,
        "bytes": 251712,
        "sourceSha256": "abead6f2754f22b9de586a66252960ef5609f86cc838c29fe431a0ac7e86b846",
        "audioSha256": "abb6569e5753971a130ae6156b2a5f40a5d2c1fa2ab9a5998434b1d7dc467969"
      }
    ]
  },
  "exports": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 31.128,
        "bytes": 186768,
        "sourceSha256": "75ca0374bbb2f9f0c40ccf522e3024ceee661dd7039448eba40f480049ca7e7e",
        "audioSha256": "057c12d2fa884080ad400b8d60e355d9283912d4a16d3ecd533eb1f5b68e7e0f"
      },
      {
        "section": "choose-copy",
        "seconds": 45.048,
        "bytes": 270288,
        "sourceSha256": "f2b451e74ea2fb966ccbca841519b086468881177166d98d7e39ab8594b5d81c",
        "audioSha256": "5d55ff527bfcb99913f0b52922118c9173f8a148c1f83bdc700910df28838589"
      },
      {
        "section": "check-period",
        "seconds": 55.248,
        "bytes": 331488,
        "sourceSha256": "cfcae2b78cbebef74a6823f515a48687bc9da8abb5519a1d1c8edd3b249f6020",
        "audioSha256": "1ceba33c2817413a6cc899b2c2284ffb744682588535ce9f65d0b6b6e93786d8"
      },
      {
        "section": "inspect-csv",
        "seconds": 67.416,
        "bytes": 404496,
        "sourceSha256": "c5fdad1e330a3a26324ae26eed1c5bc47951c08eec5978ed98d0dedbea55ee67",
        "audioSha256": "3ea83e5484b6c0ee5630ca74c9b77b4cf8fc33b37b7784372ff767f92ec1a80d"
      },
      {
        "section": "inspect-summary",
        "seconds": 59.616,
        "bytes": 357696,
        "sourceSha256": "20fa0e497b2516cfc524c151fa317acb897d3c876bf0b3a1c13efcaf8e284252",
        "audioSha256": "82ebc433a3e62942cc6d48f7356222033c1cdaa72c81f7fc62cad4717d6b7b27"
      },
      {
        "section": "collect-evidence",
        "seconds": 51.72,
        "bytes": 310320,
        "sourceSha256": "51e23e81c4b2457ece5888b87df222382bb602c6f35fe83b37c0cc61762f31c3",
        "audioSha256": "0e78e787d0791010cbe861832429ff1d9fc34267b94022b19faccdf7411523ed"
      },
      {
        "section": "keep-share",
        "seconds": 57.408,
        "bytes": 344448,
        "sourceSha256": "6ede962766dab0d0f4e8879ae7b60fc8e5a3b3a0e8f33bb9f47a819f84f6cc62",
        "audioSha256": "e2319eaa21b1765aa2fc3ed740e5596f0f2d5742aa8edbd209acb16a11cc6b08"
      },
      {
        "section": "practice",
        "seconds": 29.04,
        "bytes": 174240,
        "sourceSha256": "38929a4bd80b59d6d64236454b6d8b2e59929f7be73ffe89620986b9dd021223",
        "audioSha256": "139e62681434f5fa0637f1f6c8d6c7a818cd54a186a5b535619acfcee0c9f32c"
      },
      {
        "section": "feedback-1",
        "seconds": 7.344,
        "bytes": 44064,
        "sourceSha256": "270c1436b519d0c5da405a1637a870f5b504b348851ff39449a1f2f510dc6ea0",
        "audioSha256": "ddb67e038d4c61193f056e06d907bdc1476eea533bee3a8dbc0eef9501305732"
      },
      {
        "section": "feedback-2",
        "seconds": 9.72,
        "bytes": 58320,
        "sourceSha256": "b1c4879d8ef7a402d9a7f695253296aa858159c09ea6265f1d06b5df6828703d",
        "audioSha256": "80b24311097fa62b2c505cf3108966b46de0058f6643dc1f9c68e6c094c9fee7"
      },
      {
        "section": "feedback-3",
        "seconds": 7.92,
        "bytes": 47520,
        "sourceSha256": "320f18cfee1fc3ae3ee551077ee2ba4c8e977e383aa6db6df8c2546ca652691f",
        "audioSha256": "26da13103f8f1a369565284bc52c7f50ea706013af8431411ad2c6ad42b2efa7"
      },
      {
        "section": "next",
        "seconds": 44.376,
        "bytes": 266256,
        "sourceSha256": "749282efe77e524b387f0665405ad6cd43becb9f63f4810d5a426074f6e4c2bd",
        "audioSha256": "cd26800f4a85631d1f564541f8f230598c0a8572aeb1a8b77e8a0119414d05d6"
      }
    ]
  },
  "evidence": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 40.056,
        "bytes": 240336,
        "sourceSha256": "b455b447c392b3ad07000e5e74c2211b6c31800a5071b0531de05e47db102082",
        "audioSha256": "a44d86fd92da192cbc7370e890a1bbed9a68617ec6224ea3b42b3748457bd702"
      },
      {
        "section": "right-site",
        "seconds": 45.24,
        "bytes": 271440,
        "sourceSha256": "b1158f0e45d02b2bc988b8470c22954eeebe4a62eed4a83613d0550f39bcdd29",
        "audioSha256": "61bc4c66cd71c88a9a7bc2eef6c37ec2bef7900dfbdc721480fffec41918ef91"
      },
      {
        "section": "observations",
        "seconds": 55.992,
        "bytes": 335952,
        "sourceSha256": "c12d9076af5a275b07a5e3408100e07ca18fbe37f5b25bddd2719253008439a7",
        "audioSha256": "4eb167a1ce47d537770741ad813666316292f798d3c656bc72afbf8337a90156"
      },
      {
        "section": "test-sources",
        "seconds": 61.632,
        "bytes": 369792,
        "sourceSha256": "c9db9dc4a15d8ef1d6092592320a7b23826a741cdd187dcb98fab126f14fe44a",
        "audioSha256": "1c8a2124bf1a73ac1ca10861a5f329f1250bd017142845e81ed5362a47b43bd0"
      },
      {
        "section": "review-advice",
        "seconds": 58.512,
        "bytes": 351072,
        "sourceSha256": "36517c8f8a2b7aefc6f9135e06e0ca7c57b22a316b570e0e839d93e28583e8d1",
        "audioSha256": "9f437040e2b154c00f7f352d5e83ea59e67bbe5076bd80fa287407ae8d7bd4be"
      },
      {
        "section": "save-version",
        "seconds": 55.176,
        "bytes": 331056,
        "sourceSha256": "823966e5f709ecf0522c91ab66234e483daf947ae4221cd4eb31a883d5a463fd",
        "audioSha256": "8d302139a38aa31cbc8c18f6b53950aa974e0552360ad645317087e4e80b7dfd"
      },
      {
        "section": "inspect-report",
        "seconds": 60.432,
        "bytes": 362592,
        "sourceSha256": "0975282321db30366c0871f9b73db6c932427ca5ed1e71c6b9e423bf67729e54",
        "audioSha256": "d9ae67e028f50c9e320b9a88a79c9efb9f1a0db8ad35e0b866c6851059bd07f2"
      },
      {
        "section": "practice",
        "seconds": 29.64,
        "bytes": 177840,
        "sourceSha256": "1596f7ff14e4fd35ea0e606887d30b91279b9ce6377e29f7662decc2c285c17d",
        "audioSha256": "65a98e10ea193c193656489acfdc08847b4de9aabc95e7a4bdda99d78cc56dc5"
      },
      {
        "section": "feedback-1",
        "seconds": 9.024,
        "bytes": 54144,
        "sourceSha256": "a4b5d26e4e63a3b52f60f2d050aa91d261d0642aca8975280b123415d67a8805",
        "audioSha256": "0c30652db609991070e624b50e3d4b14b44a6bd608875ffcdf877608207265d0"
      },
      {
        "section": "feedback-2",
        "seconds": 7.848,
        "bytes": 47088,
        "sourceSha256": "c14f4b3eee32f3d48a488c127b5dea37e8c95f165edd48ee3882fdd6d308b7cb",
        "audioSha256": "36091747909f0749cab9fd38bfae9de30b72e2ed1687f151b4bcf605996f01d8"
      },
      {
        "section": "feedback-3",
        "seconds": 9.768,
        "bytes": 58608,
        "sourceSha256": "fb81e8c72244ed0c16027ff1e2bbcce50a6dd7c2e24777313ee32d39109af709",
        "audioSha256": "c35c999efe1dedca9cba06be38ea13cb375956d2d4bb490cc40dfbfb60e841af"
      },
      {
        "section": "next",
        "seconds": 63.192,
        "bytes": 379152,
        "sourceSha256": "2659d1d37c7b82117e400a54b8ed078b7010cf185fb3d7fb8d5b35cf2464a983",
        "audioSha256": "ada134cb8400c0378bb34903802690884fb728472ac3aa34af54327fba2d223b"
      }
    ]
  },
  "offline-learning": {
    "language": "en",
    "voice": "en-ZA-LukeNeural",
    "rate": "-12%",
    "tracks": [
      {
        "section": "prepare",
        "seconds": 37.008,
        "bytes": 222048,
        "sourceSha256": "75469d6649874af6cec243b8a3cc509f268313bf9be555047a59918d4fe6086c",
        "audioSha256": "f4068b592d7982fefc4f0a2f4831a45a76e2d867e8aea90583bbe8771b5b0f08"
      },
      {
        "section": "choose-pack",
        "seconds": 49.992,
        "bytes": 299952,
        "sourceSha256": "7a330d6238c9b9fdb1e36387353eca90c641f013a76c510245640083f3371f96",
        "audioSha256": "b41531cd12a50e497a24f218c39a19e0b934a42ca6287748f416759c136af150"
      },
      {
        "section": "finish-download",
        "seconds": 50.4,
        "bytes": 302400,
        "sourceSha256": "f7bd60334234b0527940720a7c27c0ac33df85fe402215e241d62fd1d32ca2b6",
        "audioSha256": "e1375a165f89d4a344ff426eab35b9c0f8f5aa25dd517bf03d21402bf8873ed9"
      },
      {
        "section": "test-offline",
        "seconds": 55.464,
        "bytes": 332784,
        "sourceSha256": "a80dc1dcc87464ab26b74e1e0e2e547636c5e605c4c322c6b49e0dd1bdbaa9ae",
        "audioSha256": "274f439bee3c4cb01674af0c98d9edb8e2d5dcd41af3f31f0c556e3c3afc6e35"
      },
      {
        "section": "learn-practise",
        "seconds": 50.472,
        "bytes": 302832,
        "sourceSha256": "70f4f4def3a4f3119a1e5c4f186c187b587837aa741032f5038de0c0f9f7bc2c",
        "audioSha256": "55641cd5e9743041dda492ed48b7ec2f045292eae270230d28c4efa3761179a7"
      },
      {
        "section": "keep-evidence",
        "seconds": 59.328,
        "bytes": 355968,
        "sourceSha256": "510ad44a0a4650f9160bea678a50b6c9187011e5020eb943df4c3b8bf993be99",
        "audioSha256": "4ae459994877aba1322af789c9a7affa3f7c13b3a7e2f464abf42bae6b6e0218"
      },
      {
        "section": "reconnect",
        "seconds": 64.464,
        "bytes": 386784,
        "sourceSha256": "7a64280d4090f85208ec8691a1d1c4e3f5029fa37db25368f3e47eba24ef6737",
        "audioSha256": "525275e32715ea25fb306891402a5ce200a6ebd0898b397de04bdd30fa5bfa60"
      },
      {
        "section": "practice",
        "seconds": 31.344,
        "bytes": 188064,
        "sourceSha256": "a480ffd60a82cad5dd4673d0ee03c2f1c4a852877a249ac9e313a9332db76eba",
        "audioSha256": "5d170adea6d2b339ec8410af19d12e45c6d8cdc7c51527f1eacbe790c266b50f"
      },
      {
        "section": "feedback-1",
        "seconds": 7.056,
        "bytes": 42336,
        "sourceSha256": "0ec23ccc0e3b3e1e3e4db8080971b585217344b06d435c8a028f343f252214a6",
        "audioSha256": "bbda7e006ebe363d3f45b7842a49554f0d911be9bc93aacdd4b9c8db39faffcb"
      },
      {
        "section": "feedback-2",
        "seconds": 9.072,
        "bytes": 54432,
        "sourceSha256": "eb5ee7050eed32f946193493331770de334ddc970008be5ba1c0157f6046bfe7",
        "audioSha256": "290ed9554c6bc86293b8a783fab61aa4c72a203089c4ea1bd9c1d783a86f6e1c"
      },
      {
        "section": "feedback-3",
        "seconds": 7.632,
        "bytes": 45792,
        "sourceSha256": "599092cb5bfc41a902877d57dae06c99bc1fd22267b7b1170aaca516f10c6828",
        "audioSha256": "df0dae0e31843752b5738ac33cc5a2871e160b416586e0b0fe96339d495a1c69"
      },
      {
        "section": "next",
        "seconds": 57.048,
        "bytes": 342288,
        "sourceSha256": "1567e1e958ba8fd935aea4b4740b17ab4e166c2d41ca2efc29bce4d830049123",
        "audioSha256": "ba32a4bed5bce95053a117e68244773b6879128822695a481fa3ef1eac2e9e78"
      }
    ]
  }
};

export function appGuideTrack(guideId: string, section: string): (AppGuideAudioTrack & { url: string }) | null {
  const narration = APP_GUIDE_NARRATION[guideId];
  const track = narration?.tracks.find(item => item.section === section);
  // A newly recorded instruction must not replay the older download under the same filename.
  return track ? { ...track, url: `/app-guide-audio/${guideId}/${section}.mp3?v=${track.audioSha256}` } : null;
}
