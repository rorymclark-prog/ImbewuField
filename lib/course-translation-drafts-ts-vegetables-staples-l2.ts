/** Unreviewed source-paired Xitsonga body and assessment drafts for Vegetables & Staple Crops L2. */
import { COURSE_MODULES } from './course-modules.ts';
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});
const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
// Keep the checked source literal so changed canonical wording cannot inherit this draft.
const bodySourceEnglish = "Succession planting is a calendar habit, not a special crop.\n\nChoose something your household actually eats often. Then sow a small amount of it, again and again.\n\nPlant a short row every two to three weeks.\n\nLess waste during a glut. Fresh food for longer. And the labour spreads out across the season instead of landing on you all at once.\n\nSeparate sowings may reduce the risk of losing everything at once. They do not guarantee a harvest if difficult conditions continue.\n\nWhich fast crop could you sow in small batches? Decide on one, and start it this week.\n\nHere's what it looks like in practice.\n\nSow one. Then two to three weeks later, sow two. Then sow three. Then sow four.\n\nWith suitable crop timing, harvests can begin to overlap. The first batch will not always be ready by the fourth sowing.\n\nTwo to three weeks is a starting rhythm, not a law. A cool-season leaf crop may hold longer. Heat may speed things up, or cause a failure.\n\nWatch what your own garden does, and adjust the interval. That observation is the skill.\n\nIntercropping is not just crowding different plants together. Each plant needs a job, and enough space to do it.\n\nThe Three Sisters is an example from Indigenous farming traditions in the Americas.\n\nMaize gives height and structure.\n\nBeans climb the maize, and store as protein.\n\nPumpkin spreads across the ground, shading the soil and holding moisture.\n\nTiming matters. Establish the maize first, so it's strong enough to carry the beans when they start to climb.\n\nThe plants can still compete. Give them suitable space, water and light. Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition.\n\nA household may have a hungry gap: weeks when stored food runs low before the next harvest is ready.\n\nYours might come after stored maize runs out. It might come before winter greens are ready. It might come in a dry period when water limits the garden.\n\nDon't copy somebody else's calendar. Name your own months first.\n\nWrite them down. Then choose the crop and the sowing date that puts food into that gap.\n\nThat's planning backwards, and it's the difference between a garden that looks productive and a household that eats.";
const sourceParagraphs = bodySourceEnglish.split('\n\n');
const draftParagraphs = [
  "Ku byala swibyariwa hi ku landzelelana i ntolovelo wa khalendara, a hi xibyariwa xo hlawuleka.",
  "Hlawula swakudya leswi ndyangu wa wena wu talaka ku swi dya. Kutani byala xitsongo xa swona, u tlhela u endla tano hi ku phindha-phindha.",
  "Byala ntila wo koma mavhiki man’wana ni man’wana mambirhi ku ya eka manharhu.",
  "Ku lahleka ka swakudya ka hunguteka loko ku ri na ntshovelo wo tala. Ku va na swakudya swo tenga nkarhi wo leha. Ntirho wu hangalaka hi nkarhi wa nguva, ematshan'weni yo ku wu humelela hinkwawo hi nkarhi wun'we.",
  "Ku byala hi minkarhi leyi hambaneke swi nga hunguta khombo ra ku lahlekeriwa hi swilo hinkwaswo hi nkarhi wun'we. A swi tiyisisi ntshovelo loko swiyimo swo tika swi ya mahlweni.",
  "Hi xihi fast crop lexi u nga xi sow hi swiphemu leswitsongo? Hlawula xin'we, u sungula hi vhege leyi.",
  "Hi leswi swi langutekaka hakona hi ku tirhisa.",
  "Sow xo sungula. Endzhaku ka two to three weeks, sow xa vumbirhi. Kutani sow xa vunharhu. Kutani sow xa vumune.",
  "Loko nkarhi wa crop wu lulamile, minkarhi ya ntshovelo yi nga sungula ku overlap. A hi minkarhi hinkwako laha ntlawa wo sungula wu nga vaka wu lunghekele ku tshoveriwa loko ku byariwa ka vumune ku endliwa.",
  "Mavhiki mambirhi ku ya eka manharhu i starting rhythm, a hi nawu. A cool-season leaf crop may hold longer. Ku hisa ku nga endla leswaku swilo swi hatlisa kumbe swi tsandzeka.",
  "Languta leswi humelelaka ensin'wini ya wena, u lulamisa interval. Ku xiyisisa leswi hi swona vutshila.",
  "Intercropping a hi crowding ntsena ka swibyariwa swo hambana endhawini yin’we. Xibyariwa xin'wana ni xin'wana xi lava role ya xona, ni space leyi eneleke ku yi endla.",
  "The Three Sisters i xifaniso lexi humaka eka Indigenous farming traditions in the Americas.",
  "Maize yi nyika ku leha ni structure.",
  "Beans ti khandziya maize, and store as protein.",
  "Pumpkin yi hangalaka ehenhla ka misava, yi endla ndzhuti ehenhla ka misava, yi tlhela yi hlayisa moisture.",
  "Nkarhi wu ni nkoka. Sungulani hi ku byala maize yi rhanga, leswaku yi tiya ku ringana ku rhwala beans loko ti sungula ku khandziya.",
  "Swibyariwa swi nga ha phikizana. Nyika swibyariwa ndhawu leyi faneleke, mati ni ku vonakala. Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition.",
  "Ndyangu wu nga va na hungry gap: mavhiki lawa swakudya leswi hlayisiweke swi nga va switsongo ku nga si lungheka ntshovelo lowu landzelaka.",
  "Hungry gap ya wena yi nga fika endzhaku ka loko maize leyi hlayisiweke yi herile. Yi nga fika loko winter greens ti nga si lulama. Yi nga fika hi nkarhi wo oma loko water limits the garden.",
  "U nga tekeleli calendar ya munhu un'wana. Rhanga hi ku vula tin'hweti ta wena.",
  "Ti tsale ehansi. Kutani hlawula xibyariwa ni siku ro byala leri nga tisa swakudya eka nkarhi wolowo.",
  "Leswi i planning backwards, naswona hi swona swi hambanisaka garden leyi vonakaka yi ri productive ni ndyangu lowu dyaka."
];

export const XITSONGA_VEGETABLES_STAPLES_L2_DRAFT: XitsongaCourseModuleDraft = {
  id: sourceModule.id,
  language: 'ts',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: sourceModule.durationMins, category: sourceModule.category },
  title: hold(sourceModule.title),
  description: hold(sourceModule.description),
  lessons: [
    {
      id: sourceLesson.id,
      infographicAlt: hold(sourceLesson.infographicAlt!),
      title: pair("Succession Planting and Intercropping", "Succession planting na intercropping"),
      body: pair(bodySourceEnglish, draftParagraphs.join('\n\n')),
      keyPoints: sourceLesson.keyPoints.map((sourceText, index) => index === 0
        ? pair('Stagger sowings and adjust the interval for crop, weather and household use', 'Byalani staggered sowings, mi lulamisa interval hi ku ya hi crop, weather na household use.')
        : index === 1 && sourceText === 'The Three Sisters comes from Indigenous farming traditions in the Americas'
          ? pair(sourceText, 'The Three Sisters yi huma eka Indigenous farming traditions in the Americas.')
          : index === 2
            ? pair('Use household food records to identify and plan for a hungry gap', 'Tirhisani household food records ku kuma ni ku pulanela hungry gap.')
            : index === 3
              ? pair('Intercropped plants can still compete; manage space, timing and water', 'Swibyariwa leswi byariwe swin’we swi nga ha phikizana; lawulani ndhawu, nkarhi na mati.')
              : hold(sourceText)),
      quiz: sourceLesson.quiz.map((question, questionIndex) => ({
        question: questionIndex === 0
          ? pair('Why sow lettuce in small batches every 2-3 weeks instead of all at once?', "Hikokwalaho ka yini u byala lettuce hi swiphemu leswitsongo mavhiki man’wana ni man’wana mambirhi ku ya eka manharhu, ematshan’weni yo yi byala hinkwayona hi nkarhi wun’we?")
          : hold(question.q),
        options: question.options.map((option, optionIndex) => questionIndex === 0 && optionIndex === 0 && option === 'It uses less seed overall'
          ? pair(option, 'Yi tirhisa less seed hi ku angarhela.')
          : questionIndex === 0 && optionIndex === 1 && option === 'It gives a steady harvest instead of a glut followed by a gap'
            ? pair(option, 'Yi nyika ntshovelo leyi tshamaka yi ri kona hi ku landzelelana, ku nga ri ntshovelo wo tala ngopfu kutani ku landzela nkarhi wa ku pfumaleka.')
            : questionIndex === 0 && optionIndex === 2 && option === 'Lettuce germinates better in small batches'
              ? pair(option, 'Lettuce yi mila better hi swiphemu leswitsongo.')
              : questionIndex === 0 && optionIndex === 3 && option === 'It reduces pest pressure'
                ? pair(option, 'Yi hunguta pest pressure.')
                : questionIndex === 1 && optionIndex === 2 && option === 'Only when pumpkin leaves shade them'
                  ? pair(option, 'Only loko matluka ya pumpkin ma endla ndzhuti eka them.')
                  : questionIndex === 1 && optionIndex === 3 && option === 'It can never be released'
                    ? pair(option, 'Yi nga never be released.')
                    : hold(option)),
        sourceCorrectIndex: question.correct,
        rationale: questionIndex === 0
          ? pair('A single large sowing matures all at once — staggering the sowing spreads the harvest out to match what a household can actually use.', 'Ku byala lokukulu kan’we ku endla leswaku swimilani swi vupfa hi nkarhi wun’we — ku byala hi ku hambanisa minkarhi swi hangalasa ntshovelo leswaku wu fambisana ni leswi ndyangu wu nga swi tirhisaka hakunene.')
          : hold(question.rationale),
      })),
    },
  ],
  holds: sourceParagraphs.flatMap((sourceText, index) => draftParagraphs[index] !== sourceText ? [] : [{
    lessonId: sourceLesson.id,
    field: `body[${index}]`,
    sourceText,
    reason: index === 10
      ? 'Keep garden observation and interval adjustment exact until the active observation meaning is clear.'
      : index >= 11
          ? 'Keep intercropping, Indigenous Three Sisters context, crop-specific species and timing, nitrogen/residue claims, and household crop-planning advice exact English.'
          : 'Keep household sowing instructions, practice sequences, timing, and harvest uncertainty exact English.',
  }]),
};
