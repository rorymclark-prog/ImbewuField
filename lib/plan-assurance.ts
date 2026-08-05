/**
 * WHAT WE TELL THE FARMER ABOUT HOW MUCH TO TRUST A GENERATED PLAN.
 *
 * One source of truth, because the alternative is three: the crop-plan PDF,
 * the site report and the in-app view would each grow their own wording and
 * drift, and the weakest one becomes the promise. Every document that puts
 * numbers in front of a farmer imports from here.
 *
 * WHY THIS EXISTS AT ALL. On 2026-08-06 an external agronomic review of a
 * generated Ubhejane plan returned "REVISE — AGRONOMIC APPROVAL WITHHELD".
 * Its yield model was judged sound; underneath it, seed quantities were
 * 3-6x over on several crops, rotation ignored botanical families, and the
 * soil section had been built on a hardcoded constant. None of that was
 * disclosed to the reader, because the document had no voice for saying
 * "here is how far you should trust me".
 *
 * THE TONE THIS HAS TO STRIKE, and it is a narrow one:
 *  - Not a legal shield. A farmer who cannot parse "no warranties, express or
 *    implied" is not warned by it, only excluded.
 *  - Not frightening. A plan nobody dares act on has failed differently.
 *  - Honest about the specific thing most likely to be wrong (soil), and
 *    ACTIONABLE about it — every caution below names something to do.
 *
 * ON THE EXTENSION OFFICER. Most smallholders will never see an agronomist;
 * that is a real access problem and telling them to "consult a professional"
 * mostly reads as "you are on your own". Nearly every South African farming
 * district has an agricultural extension officer whose job this is, at no
 * cost. Pointing there is the difference between a disclaimer and advice.
 *
 * NOT A LICENCE. Saying "this may contain errors" does not make it acceptable
 * to ship errors we already know about. As of this writing the seed
 * quantities are still wrong (see task #67) and this text must not be treated
 * as covering them.
 */

/** Headline shown above any generated plan or report. */
export const ASSURANCE_TITLE = 'How much to trust this plan';

/**
 * The full statement, in the order a farmer reads it: what this is, what it
 * cannot see, what to do about that, and why it is still worth having.
 * Plain language and short sentences throughout — these strings are
 * translation targets (isiZulu first), and a subclause does not survive
 * translation the way a full stop does.
 */
export const ASSURANCE_PARAGRAPHS: string[] = [
  'No agronomist has checked this plan. It is built from your own map, from climate and soil data measured by satellites and global models, and from published South African growing guidelines. It is put together carefully and in good faith — but it is a starting point, not an instruction.',

  'Use your own judgement alongside it. A computer cannot see your land. It does not know where the water stands after heavy rain, which corner the frost settles in, what failed here last year, or what your family will actually eat. You do.',

  'Soil is the figure most likely to be wrong. Ours comes from a global model that reads a wide area, and real soil can change from one end of a single field to the other. If any number here matters to a decision you are spending money on, a soil test is the only way to know. You can upload one and the plan will be rebuilt around your real numbers.',

  'Show this to your local agricultural extension officer. They know your district, your rainfall and your pests in a way no model does, and they can correct in ten minutes what would otherwise cost you a season. It costs nothing, and it is the single most useful thing you can do with this document.',

  'Expect some of it to be wrong. Write down what you actually planted and what you actually harvested. Every season you record makes the next plan fit your land more closely than this one does — that is the point of it.',
];

/** One line for a footer or a tight space, where the full statement will not fit. */
export const ASSURANCE_ONE_LINE =
  'Not checked by an agronomist — a planning guide, not an instruction. '
  + 'Show it to your extension officer, and get a soil test before spending on soil.';

/**
 * Shown at the point the farmer meets a soil number.
 *
 * Deliberately placed where the figure is, not only in the front matter: a
 * caution twelve pages away from the number it qualifies is not a caution.
 * Pair with the soilSource on the reading itself (see SoilData) so the two
 * never disagree — 'estimate' means no soil data existed for this point at
 * all, which is a stronger warning than the general one.
 */
export const SOIL_CAUTION = {
  soilgrids:
    'From the SoilGrids global model, which reads an area far wider than your field. '
    + 'Treat it as the district, not your soil. A soil test is the only way to know your own.',
  estimate:
    'NOT A READING. No soil data was available for this point, so these are the app\'s general '
    + 'figures — the same numbers it would show anywhere. Do not spend money on the strength of them. '
    + 'A soil test is the only way to know.',
  lab:
    'From a soil test you uploaded for this site. This is the most reliable soil figure '
    + 'in the app and it overrides the global model.',
} as const;

/** Prompt inviting the upload, wherever soil is shown without a lab result. */
export const SOIL_TEST_INVITE =
  'Had your soil tested? Upload the report and every soil figure, amendment quantity and '
  + 'crop suggestion here will be rebuilt from your real numbers instead of a global model.';
