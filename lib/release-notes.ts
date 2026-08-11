// What changed in the build the farmer is about to refresh into.
//
// The update banner used to say only "New version available" — which tells you a number changed,
// not whether it is worth interrupting your work for, and gives you nothing to check afterwards.
// (Rory: "when you refresh i want the changes listed underneath the refresh button and in brief".)
//
// RULES FOR WRITING THESE. One line per change, in the farmer's language, describing what is
// different ON THEIR SCREEN — never the mechanism. "Zone maps now follow the zones you drew", not
// "buildZoneOverlay is composited on the model-chrome path". Newest build at the top, and keep the
// list to the last few builds: this is a "should I refresh, and what do I look at" note, not a
// changelog. Anything longer belongs in the repo's docs.
export interface ReleaseNote {
  /** Short human date — no clock time; the farmer only needs the ordering. */
  when: string;
  changes: string[];
  /**
   * The newest commit this entry covers.
   *
   * WHY A SHA IS IN A FARMER-FACING FILE. This list is written by hand, and on 2026-08-02 Rory
   * reported the banner "keeps showing me old updates not the new ones". Nothing was broken: the
   * banner faithfully renders the newest notes it has, and the newest notes were from 1 August
   * while FIFTY-FIVE commits touching app/, components/ and lib/ had landed since — a whole day
   * of money bugs, sheet fixes and a Mentor privilege hole, none of it written down. A build
   * number that moves while the notes stand still is worse than no notes, because it tells the
   * farmer these ARE the changes.
   *
   * So each entry records where it was written from, and `npm run notes:pending` lists what has
   * shipped since. The drift is now a question anyone can ask in one command instead of something
   * you notice weeks later from a screenshot.
   */
  sha?: string;
}

/** Shown newest-first under the Refresh button. The banner renders at most MAX_SHOWN lines total. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    when: '10 August',
    // STAMPED. An unstamped top entry does not mean "not yet released" to the gate — it means the
    // gate falls through to the NEXT entry's sha and reports every commit since as unnoted. That
    // is how main sat red for 27 commits while every PR went green: the notes were written, the
    // stamp was not. Stamp at merge, always.
    //
    // AND THE STAMP CAN ONLY BE APPLIED AFTER THE MERGE, because the sha it names does not exist
    // until then — so a green PR is never evidence that this line is current. Main went red again
    // on 10 August with all 2247 tests passing and all three notes already written, purely
    // because this read fbecef9 while main had moved to 81d424c. A commit touching ONLY this file
    // is ignored by the gate (IGNORE in scripts/release-notes-pending.mjs), which is what makes a
    // follow-up restamp commit both safe and, after every merge, necessary.
    sha: '8f6d8a0',
    changes: [
      'Shade tunnels and shade houses are see-through, so the beds under them still show',
      'Your design maps are now printed in the report, one to a page at the back',
      'Reports you download now have a contents page and numbered sections',
      'Tree and crop advice now matches the vegetation the map finds at your spot',
      'Fire risk is judged on that same vegetation, so fire-prone veld is told so',
      'The planting palette shows three drawings a row, so you scroll less to find one',
      'The species list now opens where there is room instead of off the top of the screen',
      'AI Polished now really is polished — the app no longer paints over what you paid for',
      'Your plants are the AI\u2019s artwork; ground, roofs and boundary stay exact as before',
      'A design that keeps closing the app now opens without its background photo',
      'Everything you drew, and every measurement, stays exactly the same when it does',
      'Add &safe=1 to a design link to open it that light way straight away',
      'If opening an AI render keeps crashing the app, it now stops retrying and tells you',
      'Finishing an AI render uses far less phone memory, so it should now survive',
      'The Seeds and Vegetables modules show their names instead of the word Title',
      'Making a sheet no longer throws you back to the start of the studio on phones',
      'Course module covers now show their real titles instead of "Title"',
      'The picture the AI is given is now white paper too, not a tan field',
      'On plain paper the AI now leaves the paper white instead of inventing a field',
      'Every building on your plan keeps its name and its legend row',
      'Pressing AI Polished now says AI Polished on the result, not hybrid',
      'Big numbers read the same way all through your report',
      'The "get a local quote" warning no longer prints stray underscores',
      'Your report sections are numbered in order, and every one of them is in the Contents',
      'The exported PDF starts with one cover page instead of two',
      'The report cover names only the map, survey and crop plan you actually gave it',
      'Plain paper plans now print on white, so your drawing is no longer tinted twice',
      'The Sector sheet draws its arrows and arcs on white instead of dark grey',
      'Buildings are painted once, so no roof on a plan comes out darker than another',
      'With 50 reports saved, the app asks you to delete one instead of dropping the oldest',
      'Round beds are measured as circles, so their size and cost are honest',
      'Your crop planner warns you the moment it can no longer keep your changes',
      'If your phone is too full to save, the app now says so instead of Saved',
      'Rain arrows now show on the roof itself, running down to each gutter',
      'The month calendar now matches the crop guide, so nothing is listed too early',
      'Your bill no longer charges you for tanks and trees you already have',
      'Water runs off the roof, into your tank, and spreads out in the swale',
      'Every drawing on your plans is now the new artwork — sheds, hives, basins and beds',
      'Beds sit under tree canopies, and their vegetables are finally big enough to see',
      'Big canopies sit over small trees, and every plant carries a label',
      'Vetiver looks ragged and real, and berms have grassy edges',
      'Underlay always offers all three: your photo, satellite, or plain paper',
      'Your design now shows on the farmer map, read-only',
      'Two sheet finishes: Exact Canvas, free and instant, or AI Polished for one paid render',
      'Sheet labels and legend are never handed to the AI, so they stay sharp',
      'The labels and underlay buttons fit properly on a phone now',
    ],
  },
  {
    when: '9 August',
    sha: 'fbecef9',
    changes: [
      'Water tanks now wear their real colours — black, green, teal and sandstone by size',
      'The rain barrel card shows its typical size (about 200 litres)',
      'New Greywater section on the Water step — diverter, outlet, basin and soakaway',
      'Try the new card palette with the "New look" button — switch back any time',
      'Saved maps open faster and no longer crash the app on phones',
      'Ten identical beds now share one label with a count, instead of ten',
      'New Quality setting: High redraws sheets at 1.5x resolution for printing',
      'Buildings on plain-paper sheets now show a corrugated iron roof',
      'Staple plots are now painted fields — maize, beans and pumpkin in rows',
      'Staple rows now run with each plot, roofs are bolder, bed veg drawn bigger',
      'Sharper maps are now the default on computers; phones can switch in Quality',
      'Roofs lose their outline and gain real corrugated ribs',
      'The dashed circle around big trees is gone — plants still show on top',
      'Water arrows now stop and spread at swales and beds instead of crossing them',
      'Bed rows are painted vegetables now — cabbages, tomatoes, beans and more',
      'Tanks on the water map now wear their capacity colours from above',
    ],
  },
  {
    when: '9 August',
    sha: 'a4611f7',
    changes: [
      'Every tree in the palette now has its own drawing instead of an emoji',
      'Taps, filters, kraals and terraces are drawn instead of shown as symbols',
    ],
  },
  {
    when: '9 August',
    sha: '9c7243d',
    changes: [
      'Every element in the palette now has its own drawing instead of an emoji',
      'Water tanks are drawn at their real sizes, so you can tell 1000L from 10000L',
    ],
  },
  {
    when: '9 August',
    sha: '540c025',
    changes: [
      'Indigenous fruit trees now have their own section in the planting palette',
      'Marula and kei apple added — both with their own drawing on the planting sheet',
      'The planting palette is split into sections instead of one long row',
    ],
  },
  {
    when: '8 August',
    sha: '2179fd7',
    changes: [
      'Try Finance with sample data before you sign in',
      'Home and Finance have a lighter, cleaner background',
      'Avocado trees now have their own drawing on the planting sheet',
      'Your crop plan reads rain and frost from your mapped site instead of asking you',
      'Beds can be planted in full, half, third or quarter sections again',
    ],
  },
  {
    when: '7 August',
    changes: [
      'Invoices print on a full A4 page instead of a narrow tinted strip',
      'An invoice keeps the date it was issued, even if you reopen it later',
      'Cents print correctly — R37.50 no longer prints as R37,5',
      'A long invoice no longer loses items off the bottom of the page',
      'A family food plan is ready without choosing crops first',
      'Fewer long gaps between harvests, and less repeated garlic',
    ],
  },
  {
    when: '6 August',
    changes: [
      'Choose Satellite, your drone photo, or Blank to see the same plan on paper',
      'Blank keeps the same measurements as the base you just left',
      'Finance now shows yield, turnover and price per planted square metre',
      'Crop costs stay unassigned until you choose the crop they were for',
      'Moved the chat button and Add buttons so they do not cover the map logo',
    ],
  },
  {
    when: '6 August',
    sha: 'f28f34b',
    changes: [
      'Crop suggestions use only crops you choose; coriander is never assumed',
      'One crop no longer takes every bed while another chosen crop is available',
      'A one-bed plan starts a full crop now instead of reserving a tiny strip',
      'Sowing and harvest dates stay in order when a crop crosses New Year',
      'Unknown yield, spacing and storage figures are now shown as unknown',
    ],
  },
  {
    when: '6 August',
    sha: '78df299',
    changes: [
      'Your survey can now record food, livestock and sales you report yourself',
      'Food groups say what you reported, never a made-up nutrition score',
    ],
  },
  {
    when: '6 August',
    sha: 'df2a98d',
    changes: [
      'Design Studio tools now sit beside your map on a tablet or computer',
      'Water marks can be shown one at a time or faded while you explain the plan',
      'Element tiles show their real size and are ready for hand-drawn pictures',
    ],
  },
  {
    when: '6 August',
    sha: '41774a4',
    changes: [
      'Card and panel outlines are all the same colour now, instead of two shades',
      'When you sold more than you logged picking, Finance now says the kept amount is not known',
      'It no longer blames a short harvest on you when the picking was simply not written down',
      'The printed crop plan shows your climate again, instead of saying "Not set"',
      'The work-load chart no longer counts mulching twice, so busy months are not overstated',
      'The year summary now says when crops already growing are not counted in its total',
    ],
  },
  {
    when: '6 August',
    sha: 'aaa19e1',
    changes: [
      'Harvests, sales and invoices now have crop pickers with honest guide prices',
      'Paid invoice kg lines now appear in My Records automatically and count once',
    ],
  },
  {
    when: '6 August',
    sha: 'f19d925',
    changes: [
      'Log harvest now opens a full records page, without the map beside it',
    ],
  },
  {
    when: '6 August',
    sha: 'a5d9cc0',
    changes: [
      'Sample finance never shows income dated later today',
    ],
  },
  {
    when: '6 August',
    sha: 'a3f0977',
    changes: [
      'Money: Log harvest now opens your crop record, even before you map a site',
    ],
  },
  {
    when: '5 August (night)',
    sha: '96f0250',
    changes: [
      'Money: sales you log now appear in your sales total and recent-sales list',
    ],
  },
  {
    when: '5 August (night)',
    sha: '66b5ba2',
    changes: [
      'Money: log a harvest straight from Finance — no need to find a hidden screen',
    ],
  },
  {
    when: '6 August (evening)',
    sha: '451cd18',
    changes: [
      'Your report now opens with a cover page and contents, and its sections are numbered',
      'It ends with a costed bill of quantities, measured off your own map',
      'It says plainly which items it could not price, instead of leaving them out',
      'It now carries a monitoring plan and a risk list, both built from your own figures',
      'New Network map: every farm in the programme - open one to read its record',
      'New Exchange and Field Journal pages, both in the menu',
      'New Atlas: look up growing conditions anywhere in the world',
      'Seed quantities corrected for 11 crops, from the KZN agriculture spacing table',
    ],
  },
  {
    when: '6 August',
    changes: [
      'The crop plan timeline now runs two full years - pan sideways to see year two',
      'Year two is drawn faded: the same cycle again, not a plan you have decided on',
      'No more empty months at the end of the timeline',
    ],
  },
  {
    when: '5 August (late night)',
    sha: '092e10a',
    changes: [
      'Bed 1 keeps its July planting - one crop no longer swallows a whole bed',
      'Every bed now sows into the winter tail - July is planted, not skipped',
      'The AI-polished map gets its legend and labels back, without ghost ribbons',
    ],
  },
  {
    when: '5 August (night)',
    sha: '5b7d3b5',
    changes: [
      'Gardens of 25-75 beds waste less bed space and plan more food',
      'The field sheet says "Beds 3, 7, 12" once, not the same job per bed',
    ],
  },
  {
    when: '5 August (evening)',
    sha: '36d41c9',
    changes: [
      'Beds no longer end up with a strip too small to plant anything in',
      'Bed 1 goes from 78% to 89% used, and July is no longer bare',
    ],
  },
  {
    when: '5 August (later)',
    sha: '038bfcc',
    changes: [
      'The printed plan now opens with your year at a glance, not a wall of text',
      'One page shows every bed and plot across all twelve months',
      'Each month is a tick-off field sheet with room to write what you did',
      'Sowing into trays and planting into the bed are now separate jobs',
    ],
  },
  {
    when: '5 August',
    sha: 'e84e988',
    changes: [
      'The kg beside each bed now add up to the year total on the cover',
      'The plan no longer says more beds are staggered than your farm has',
    ],
  },
  {
    when: '4 August (late night)',
    sha: 'd12447a',
    changes: [
      'A bed now stays busy while its crop is still being picked, so no bed is planned twice over',
      'Seed amounts match the spacing printed beside them — beans, peas and garlic were too high',
      'The harvest figure in the chart and in the words beside it are now the same number',
      'On a computer the plan saves to your downloads, or opens ready to print',
    ],
  },
  {
    when: '4 August (night)',
    sha: 'c76dbc0',
    changes: [
      'Send your whole crop plan to your phone calendar, with a reminder before each job',
      'Print the crop plan, including when to buy each seed and seedling',
      'The "(tr)" mark on the timeline now says "transplant" — tap it to see what it means',
    ],
  },
  {
    when: '4 August (late)',
    sha: 'f56e4b7',
    changes: [
      'Your staple plots now grow staples — maize, beans, pumpkin, potatoes — not salad crops',
      'Maize goes in the field where it can be block-planted, never in a narrow raised bed',
      'One crop can no longer take over half your beds, and more of your crops get planted',
      'Site reports no longer describe a dam or borehole your farm does not have',
      'Export PDF works on the report, and the report now fits and reads properly on a phone',
      'Saving the course to your phone now includes the spoken lessons, not just the pictures',
    ],
  },
  {
    when: '4 August (evening)',
    sha: 'f8f98dd',
    changes: [
      'The crop plan now plants something in every sowable month — winter included',
      'Charts show "An established year" by default: the full rhythm once your plan repeats',
      'Your staple plots from the map are now rows in the crop plan — one crop, full plot',
      'Auto-suggest gives four plots four different courses and rotates them each season',
      'A beds button in the crop plan header lists every bed and plot with its real size',
    ],
  },
  {
    when: '4 August (afternoon)',
    sha: 'c22fa37',
    changes: [
      'Generate report and photo analysis work again — both were failing with a plain "500"',
      'The old Design canvas is retired — the Design Studio is the one place designs are made',
      '"What’s new" in the menu keeps the full list of updates and fixed bugs',
    ],
  },
  {
    when: '4 August',
    // Stamped at commit time by the same push that carries these changes.
    sha: 'e79c07e',
    changes: [
      'The crop plan no longer rests half the garden all winter — long crops bridge May–August',
      'Suggested sowings can start later in the year and flow into next season',
      'Field utilization no longer counts crops that already finished — it matches your beds',
      'The questionnaire fills in roof areas from your traced roofs — store room included',
      '"Boundary traced" now accepts a boundary drawn in the Design Studio',
      'The "Your land" card shows area and perimeter from your Studio boundary too',
      'iPhone HEIC photos convert automatically; an unreadable photo now says so',
      'Comprehensive reports no longer fail with a plain "500"',
    ],
  },
  {
    when: '3 August',
    sha: '40bc865',
    changes: [
      'The Studio drew narrow things too wide — a hedge is now its real width',
      'Printed and exported sheets are half as sharp again (150 dpi pages were the cause)',
      'Trees on the fence line are no longer sliced off by the edge of the page',
      'Vegetable beds get their name back on the plan',
      'An area like a staple garden is named across the area, not on a line off the side',
      'Plant labels have a third choice: the name printed under each plant',
      'A tree with planting under it now has a dashed edge, so you can see what is beneath it',
      'Every tree is now named on the plan — no more "Moringa x5" pointing at one of them',
      'Labels moved off the drawing into a clear margin down each side of the map',
      'Beds, rows and strips stay grouped with a count, so a big garden is one label not thirty',
      'Plant labels are now a choice: short codes on every plant, or names in the margin',
      'Vetiver hedges are drawn at the width you set them, not wider',
      'On plain paper the house and driveway sit back — the planting is the subject',
      'New "Plain paper" choice: your plan drawn on paper, with no photo behind it',
      'Every tree now stands in a mulched basin instead of on a white disc',
      'Each staple plot is one crop — maize on one, beans on the next',
      'Vetiver is drawn as a hedge seen from above, not a photo taken from the side',
      'Map callouts keep one size — a long name drops one step, never five sizes',
      'Trees wear a thin dark outline instead of a white halo',
      'Unassigned veg beds show a mixed garden, not seven identical patches',
      'The swale is back on the water sheet, so the runoff arrows point at something',
      'The property line no longer draws across tree canopies',
      'Summer sun is warm and winter sun cool, and the two noon suns no longer overlap',
    ],
  },
  {
    when: '2 August',
    sha: 'a6d035f',
    changes: [
      'Plan sheets fill the whole page now — the blank border is real aerial photo instead',
      'Money: one sale could be counted twice, and the app pushed you into doing it',
      'Money: with no signal the app showed R0 as if it were true, and offered to write it in',
      'Clearing a crop price no longer wipes that crop\'s income for good',
      'Invoices: 12.5 kg was billed as 12 kg, and a save that failed still printed',
      'Only invited mentors can see your farm — signing up as one no longer works',
      'The bill of quantities stops charging you for things already standing on your land',
      'Save several sheets at once: pick the format and size, then download or share',
      'Zones are flat colour you can tell apart, and your buildings are no longer black holes',
      'Water sheet shows where rain runs on the ground, separately from where it runs off a roof',
      'Earthworks 05: what you dig now appears on the sheet that tells you to dig it',
      'The legend says which parts of the plan are already there and which are still to build',
      'Map callouts sit on their own plaque, and merge when crowded instead of vanishing',
      'Nothing on a sheet with a scale bar is drawn bigger than it really is',
      'Printed PDFs use the same renderer as the screen — that is why fixes kept missing paper',
      'Trees in the examples are drawn as trees; the artwork was never being loaded',
    ],
  },
  {
    when: '1 August',
    sha: '1ec415e',
    changes: [
      'NEW: Earthworks is its own step — swales, berms and terraces have their own place',
      'NEW: a Staple garden — mielies, beans and pumpkin grow there on the AI maps',
      'Earthworks 05 prints the Earthworks sheet, not the masterplan',
      'Preview map opens with all nine sheets, so Earthworks is one tap away',
      'Zone numbers stop landing on top of each other, and stay where you drag them',
      'Pick a tree species and it goes down as a tree, not a square',
      'The winter sun path is drawn at its real angle, with a sun at each end',
      'Vegetable beds on the AI maps grow vegetables instead of turning into a hedge',
      'On a Photo Plan your real photo stays sharp — the design sits on top of it',
      'The staple garden turns off with your planting, not with what was already here',
      'Map labels stop marching all the way to the edge of the sheet',
    ],
  },
  {
    when: '31 July',
    changes: [
      'The sun diagram shows summer and winter paths, at your latitude\'s real angles',
      'It also gives the midwinter shadow length — where a shade tree can stand',
      'Zone numbers no longer land on top of each other',
      'NEW: a Playground, so play areas are on the plan and kept clear',
      'The bed-block row only appears when you are actually placing beds',
      'Your traced house and driveway now follow the Fill slider like everything else',
      'Fill and Plants sliders go all the way to 100%',
      'Drip all beds in one tap — a line down the centre of each; you add the mainline',
      'Tidy now squares up a slab or shed you traced by hand',
      'Legend text is bigger and in one clear typeface on every sheet',
      'Snap reaches further when nothing is close enough, and says so',
      'Snap to neighbour works — the update notice was sitting on top of its Confirm button',
      'The update notice shrinks out of the way, and you can close it',
      'Zone numbers sit on top of the shapes instead of being buried under them',
      'Select anything and its chip lights up, so you can tell what it is',
      'Zones can be see-through colour instead of hatching, with a strength slider',
      'Pick a shape and the ones around it stop grabbing your taps — tap the map to let it go',
      'A shape only moves once your finger really moves, so a tap no longer nudges it',
      'Zone numbers grow with the Size slider like every other label',
      'The ruler is now the only thing listening — measuring never selects a shape by mistake',
      'The selected chip is unmistakable now, on every colour',
      'Drag the edge handle and the panel follows your finger — down to just the map',
      'Every section has an ×, so you can close the one that is in your way and keep the rest',
      'The photo controls now stay while everything else folds away, instead of going first',
      'Your own photo now goes in at the right size, not leaving your farm a tiny patch',
      'Photos keep their detail instead of being shrunk when you add them',
      'Switch between satellite and your photo freely — your photo is kept either way',
      'Turn and resize your photo to line it up, without changing any measurement',
      'Hold an arrow down to keep nudging, instead of tapping over and over',
      'You can remove a photo you no longer want',
      'The studio no longer freezes while you are working on your photo',
      'Bed paths show up between your beds',
      'Your parcels stay with their own place, instead of showing under every place',
      'Every screen has a way back',
      'Tips close themselves, and you can close them yourself',
      'Plan sheets know which shapes are buildings, so slabs stop growing roofs',
    ],
  },
  {
    when: 'Earlier',
    changes: [
      'Paid AI maps are checked — if one comes back unchanged, you are told, not shown a copy',
      'Water sheets stop numbering the beds your irrigation feeds',
      'Zone maps keep zone names in the key instead of scattering them over the map',
      'Water notes say where the overflow goes, instead of implying your tank is too small',
      'A plan area nobody measured is left unpriced instead of printed as free',
      'The whole design studio speaks your language now, not just parts of it',
      'The same design gives the same advice every time you open it',
      'Snap now works on zones — it reaches the gaps, and stops claiming moves it never made',
      'Map labels are readable: they now match the size the AI picks on the same plan',
      'AI maps stop numbering your beds — seven beds get one label, not "×1" to "×7"',
      'Plan sheets print evenly: the phasing sheet is now the same shape as the rest',
      'The phasing schedule no longer strikes a line through its own week dates',
      'Map labels grow and shrink with the sheet instead of staying one size',
      'Long labels stay on the map on every sheet, not just Water',
      'Hand-drawn shapes read as clean plan lines — your saved drawing is untouched',
      'Crop rotation really rotates: the same plant family cannot follow itself in a bed',
      'The design studio steps can now speak your language',
      'Slide 13 now shows the dry method it teaches, not the wet one',
      'NEW: a Higher quality download for facilitators and funders on wifi — more data',
      'Plan sheets now take the shape of your farm — a long thin plot fills the page',
      'NEW: Open a module and the slides are there — press Play and it teaches itself through',
      'Downloaded clips now play by themselves; ones you have not downloaded still ask first',
      'NEW: Download a module, or the whole course, and use it with no airtime',
      'A downloaded module now survives app updates instead of being cleared',
      'Lessons are half the size to download — isiZulu slides and clips are much smaller',
      'The size on every play button is now the real size of the file',
      'The isiZulu deck is complete — slide 13 no longer shows in English',
      'Long water labels no longer run off the edge of the map',
      'Finished-map labels are larger and feature art no longer has white sticker outlines',
      'Sector maps now use three large slope arrows instead of five thin ones',
      'Sector wind and driving rain now stand out over a quieter aerial photo',
      'AI polish now keeps your selected style',
      'AI polish now paints your saved trees, beds, tanks and structures',
      'Protected roofs, driveways and boundaries are restored exactly',
      'The exact master stays in Saved maps while AI polish runs',
      'One press now continues from the exact map into paid AI polish',
      'AI-polished and Exact-only finishes are both clearly shown',
      'Sector maps now have bold marks, labels and illustrated keys',
      'Small Structures symbols now print clearly and paths no longer border the driveway',
      'Planting now distinguishes banana, pawpaw, moringa, keyhole beds, herb spirals and hedges',
      'Ponds, tree basins, greywater basins, taps, pumps and diverters now use painted artwork',
      'Hand-painted tanks, beds, trees and planting strips stay inside their saved footprints',
      'Structures now show painted compost, hives, chicken tractors, nursery tables and gates',
      'Drip is clear blue with fewer emitters; filtered greywater is now a solid purple line',
      'Water, Planting and Structures now share grouped editorial legends',
      'Unknown elements keep their safe exact symbol instead of becoming a guessed object',
      'Water uses a dark illustrated forest around a clear olive and moss property',
      'Blue, purple and drip routes now use slimmer technical ink',
      'Route labels name each network once; tank and basin counts stay factual',
      'Driveways stay quiet, flat and charcoal; traced geometry stays exact',
    ],
  },
  {
    when: 'Previous',
    changes: [
      'Water artwork is brighter and more natural; exact routes stay locked',
      'Illustrated Water maps keep the driveway and traced ground quieter behind the water system',
      'JoJo tanks and colour-coded water lines are now much easier to read on phones',
      'Water legends are now grouped into rainwater, irrigation, greywater and earthworks',
      'Geometry Lock Water sheets now use the full Water, Greywater & Irrigation title',
      'Water tanks, fittings and routes now stand out clearly over illustrated ground',
      'Rendered driveways are quieter, without a heavy decorative border',
      'Tiny aligned gaps in matching Water routes now close neatly on rendered maps',
      'AI receives only the Water features you saved; missing systems stay absent',
      'Drip and greywater routes now read as real tubing, emitters and inspection points',
      'Water sheets now stay focused: Vetiver Bank appears on Planting and Whole',
      'Vetiver banks now read as dense green hedges instead of brown strips',
      'Trees use finer top-down canopy texture instead of large circular blobs',
      'Duck ponds, animal pens and site fixtures now use their own plan symbols',
      'Sector numbers now separate cleanly when sun, wind and access share a bearing',
      'Refresh update now detects the new build even when it arrives before the first check',
      'Sector numbers now match the exact sun, wind, fire, access and fall marks on the map',
      'Water and infrastructure now use clear illustrated plan symbols',
      'Water maps now name and draw the old Mulch Bank correctly as Vetiver Bank',
      'Planting and Whole use fewer callouts; their legends still list everything',
      'Sector energies are decluttered and fully explained in the numbered legend',
      'The driveway is quieter and the full Phasing schedule now fits its cream panel',
      'Sector analysis now shows driveway access as its own energy, when a driveway is traced',
      'Stacked terraces each get their own fall arrow, not just one for the whole hillside',
      'You can now duplicate a placed, sized element instead of re-placing it from scratch',
      'Drawn lines (swales and the rest) can finally be named and labelled on the canvas',
      'A placed element no longer gets stuck locked the moment you place it, on some steps',
      'AI Sector: the data-strip and sources line stay readable, not just the title',
      'Placing a terrace now tells you the right method for your slope, and when to ask an expert',
      'Sector analysis shows real sun arcs, named winds and a fuller numbered legend',
      'A new Master Atlas style joins the style picker',
      'Sector title stays readable on AI, and labels can no longer hide behind the legend',
      'AI renders finally know what a tree basin, banana circle and greywater line look like',
      'Sector analysis can now be AI-styled too — the bearings are still measured, never guessed',
      'Sector analysis: your ground is drawn quietly so the sun, wind and water arrows read first',
      'Sector labels no longer print on top of each other, and the fire note is no longer cut off',
      'Sector analysis is exact-only again — the AI version kept drawing it off-register',
      'Fire sector removed until we can point it the right way — see below',
      'Sector analysis now shows and names your lawn, veg garden and cleared ground',
      'Picking a style on Site or Sector actually switches that sheet to AI',
      'One legend row per element — four taps no longer take three lines',
      'You can now draw a greywater line — Water step, next to Drip',
      'The driveway draws as tar on the ground, not as another roof',
      'Tree basins draw as the earthwork alone — no invented plant on the mound',
      'Your driveway now stays on every sheet',
      'Water plans stop drawing taps, valves and greywater pipes you never placed',
      'Tree basins draw correctly: tree up on a mound, mulched moat around it',
      'Planting and Structures sheets stop inventing irrigation lines that were never drawn',
      'Older saved maps are now marked, so you can tell them from freshly rendered ones',
      'The property boundary draws as a fence line, not a hatch over the whole plot',
      'Label leaders point at the edge of the area they name, not its middle',
      'Traced areas now nest — lawn cuts out the house, house cuts out the patio',
      'Area labels no longer pile on top of each other (drag one to move it)',
      'New "Other" element on Water, Planting and Structures — place it, then name it yourself',
      'Driveways draw flat, not as a raised slab beside the house',
      'Water plans name the beds and basins the irrigation feeds, under EXISTING',
      'The house, driveway and lawn stay unlabelled so the design stands out',
      'Sector analysis now reads on a light paper base instead of a dark one',
      'The boundary is now a proper post-and-wire fence, not a ticked line',
      'No more invented trees scattered across your plan',
      'Your driveway stays on every sheet',
      'Water plans now show the beds and basins your irrigation runs to',
      'Driveways stay driveways instead of being repainted as lawn',
      'Site and Sector sheets can now be AI-styled, not just exact',
      'Zone maps follow the zones you actually drew',
      'Your rendered maps are saved on this device and survive closing the app',
      'Fixed the phantom hedge along the fence, and the driveway merging into the house',
      'Beds, banana circles and tree basins moved to the Planting sheet where they belong',
    ],
  },
];

/** Never let the banner become a wall of text over the map. */
export const MAX_SHOWN = 5;

/** The lines to render, flattened and capped. Kept pure so it is testable without a DOM. */
export function visibleNotes(notes: ReleaseNote[] = RELEASE_NOTES, max = MAX_SHOWN): string[] {
  return notes.flatMap((n) => n.changes).slice(0, max);
}
