/** Source-paired Tshivenda learner draft for one Market lesson field. */
import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

const pair = (sourceEnglish: string, tshivendaDraft: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const TSHIVENDA_MARKET_COMMUNITY_DRAFT: TshivendaCourseModuleDraft = {
  id: 'market-community',
  language: 've',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'business' },
  title: hold('Market Gardening & Community'),
  description: hold('Record-keeping, selling surplus and building local food networks.'),
  lessons: [
    {
      id: 'market-community-l2',
      infographicAlt: hold(
        'Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.',
      ),
      title: hold('Selling Surplus: Where to Sell and How to Price'),
      body: hold([
        'Ask what the customer needs: product, quantity, quality, delivery and payment date.',
        'Compare market fees, transport, packing and unsold produce as well as the selling price.',
        'Check the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.',
        'Direct selling can retain more of the sale price, but it also takes time, packing, transport and customer care.',
        'A box scheme supplies a regular selection to agreed customers.',
        'Agree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement.',
        'Start from what you can reliably supply and what customers want.',
        'Check the costs and household food needs before promising regular boxes.',
        'Garden area or customer count alone does not predict income. Try a manageable arrangement and record the results.',
        'If production changes from week to week, avoid promising a fixed delivery you cannot supply.',
        'Offer the surplus you have and agree clear terms with customers.',
        'Describe your growing practices honestly. Check any certification or claim the buyer requires before using a label.',
      ].join('\n\n')),
      keyPoints: [
        hold('Agree product, quantity, quality, delivery and payment'),
        pair(
          'Compare costs and losses as well as selling price',
          'Vhambedzani tsengo na ndozwo khathihi na mutengo wa u rengisa.',
        ),
        hold('Promise regular boxes only when supply and customer terms support them'),
        hold('Check market rules and describe growing practices honestly'),
      ],
      quiz: [
        {
          question: hold('A smallholder has inconsistent weekly production — surplus some weeks, little in others. Which channel suits her best?'),
          options: [
            hold('A formal market stall needing consistent weekly supply'),
            hold('A box scheme needing the same produce weekly'),
            hold('An informal market or neighbour sales with no fixed commitment'),
            hold('A daily-delivery school contract'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold("This is the one channel that doesn't require her to promise a fixed amount every week — she sells what she actually has."),
        },
        {
          question: hold('How can agreed regular orders help a grower plan?'),
          options: [
            hold('Box customers always pay more per kilogram'),
            hold('Box schemes let you charge extra for packaging'),
            hold('Committed subscription income lets you plan production around real demand instead of growing speculatively'),
            hold('Box schemes avoid tax obligations'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('Confirmed orders give information about demand. Their value still depends on reliable supply, payment and the costs of fulfilling them.'),
        },
      ],
    },
  ],
};
