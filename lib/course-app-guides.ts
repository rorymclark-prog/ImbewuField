/** Published task guides are separate from assessed modules: reading app help must
 * not mark a farming skill complete or change a learner's course progress. */
export const INVOICE_GUIDE = {
  href: '/student/guides/invoices',
  title: 'Make an invoice. Keep the sale together.',
  summary: 'Create an invoice, check payment and find the saved document again.',
  image: '/course-images/market-community/market-community-l1.jpg',
  imageAlt: 'Illustration of a grower keeping a harvest record beside a basket of produce',
  steps: [
    {
      id: 'find', title: 'Start with the right record', action: 'My Records → Invoice → Saved or New invoice',
      paragraphs: [
        'If the invoice already exists, open Saved and choose that document. A buyer asking for another copy does not mean another sale.',
        'For a new document, read “What are you recording?” Choose A new invoice, Produce already sold, or An invoice already written on paper.',
        'For a past sale or paper copy, answer whether the sale is already in My Records. If it is, link the exact available recorded sale. Keep the original paper reference and issue date.',
      ],
      check: 'You can explain whether this is a new sale, an existing sale or another copy of a document.',
    },
    {
      id: 'details', title: 'Check the buyer, units and price', action: 'Bill to → Line items → Payment due',
      paragraphs: [
        'Check your seller details and choose the correct buyer. For each line, check the product, Quantity, Unit and Price each. Use Add line item for another product.',
        'Use the price you agreed with the buyer. A suggested guide price is not an agreement. Kilograms, bags and bunches are different units; do not change the unit without checking the quantity and price.',
        'Check the issue date, payment terms and any buyer reference. Compare the preview with your source record before saving.',
      ],
      check: 'The buyer, product, quantity, unit, agreed price and total match the source record.',
    },
    {
      id: 'payment', title: 'Say whether payment arrived', action: 'Has the buyer paid? → Payment received on',
      paragraphs: [
        'Choose Not yet — payment outstanding when payment is still due. Choose Yes — paid in full only after the full payment has been received and checked.',
        'For a paid invoice, check Payment received on and the payment method. The payment date can be different from the invoice issue date.',
        'A deposit is not payment in full. This screen does not track partial balances. Keep a checked supporting record of deposits and amounts still owed; do not mark the whole invoice paid to represent a deposit.',
      ],
      check: 'The payment status and receipt date describe what actually happened.',
    },
    {
      id: 'save', title: 'Save, then find it again', action: 'Save invoice → Saved → Open the same invoice',
      paragraphs: [
        'Choose Save invoice and read the result. Then open Saved, find the same invoice and check it again.',
        'If the app says the document is saved on this device but the crop sale book still needs an update, reconnect and follow that message. Do not create another invoice as a retry.',
        'Paid invoice kilogram lines can appear in My Records. Other units keep their original quantities; the app does not guess their weight. Check for the linked record before entering another sale.',
      ],
      check: 'You can reopen the invoice and identify any save or synchronisation message that still needs attention.',
    },
    {
      id: 'share', title: 'Check the copy before sharing', action: 'Saved invoice → Share PDF or Print',
      paragraphs: [
        'On the saved invoice, choose Share PDF or Print. Check the buyer, reference, dates, line items, total, payment status and payment details in the output.',
        'Downloading a PDF does not mean the buyer received it. Choose the intended recipient yourself when you are ready to send a real invoice.',
        'When an unpaid invoice is later paid in full, reopen that same invoice or use Review payment. Check the actual receipt date and save the update.',
      ],
      check: 'You have the right document for the right buyer, and have not recorded the sale twice.',
    },
  ],
} as const;

export interface AppGuide {
  id: string;
  href: string;
  cardTitle: string;
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
  caption: string;
  prepareTitle: string;
  prepare: readonly string[];
  steps: readonly { id: string; title: string; action: string; paragraphs: readonly string[]; check: string }[];
  practice: {
    title: string;
    question: string;
    choices: readonly { label: string; feedback: string; correct: boolean }[];
  };
  limits: { title: string; paragraphs: readonly string[]; reference?: { href: string; label: string } };
  finish: { title: string; text: string; href: string; label: string };
}

export const INVOICE_APP_GUIDE: AppGuide = {
  ...INVOICE_GUIDE,
  id: 'invoices',
  cardTitle: 'Make and manage an invoice',
  caption: 'Keep the produce and its record together · illustrated example',
  prepareTitle: 'Have your source record ready',
  prepare: [
    'Bring the buyer, product, quantity, unit, agreed price and dates. Check payment evidence before choosing paid. For practice, open the sample tour and choose Record the work and the sale.',
    'Use sample details in a group lesson. Keep real customer and banking details private.',
  ],
  practice: {
    title: 'The buyer wants another copy.', question: 'You already saved the invoice yesterday. What should you do?',
    choices: [
      { label: 'Create a new sale and invoice', feedback: 'That would risk counting the sale again. The buyer needs another copy of the existing document.', correct: false },
      { label: 'Open the invoice from Saved', feedback: 'Yes. Reopen the same invoice, check it and use Share PDF or Print. Another copy is not another sale.', correct: true },
      { label: 'Mark an unpaid invoice as paid', feedback: 'A request for a copy is not evidence of payment. Check the payment separately and keep its status accurate.', correct: false },
    ],
  },
  limits: {
    title: 'Know what the app keeps',
    paragraphs: [
      'Invoices are saved on this device. Do not assume the complete document is available on another device because a linked sale has synchronised. Keep the source record and a checked copy.',
      'The VAT/tax-number field prints a reference; it does not calculate VAT or establish that the document meets tax-invoice requirements. Check current SARS guidance with your bookkeeper.',
    ],
    reference: { href: 'https://www.sars.gov.za/types-of-tax/value-added-tax/', label: 'Current SARS VAT guidance' },
  },
  finish: { title: 'Now try it with your own source record', text: 'Open Invoice when you are ready to work in your current workspace. Check whether the sale or invoice already exists before adding anything.', href: '/invoice', label: 'Open Invoice' },
};

export const HARVEST_GUIDE: AppGuide = {
  id: 'harvest', href: '/student/guides/harvest', cardTitle: 'Record and check a harvest',
  title: 'Record what you picked.',
  summary: 'Save the crop and kilograms, find the entry again and read the harvest comparison carefully.',
  image: '/course-images/market-community/market-community-l1.jpg',
  imageAlt: 'Illustration of a grower recording produce beside a harvest basket',
  caption: 'A harvest and a sale are different records · illustrated example',
  prepareTitle: 'Have the crop and measured weight ready',
  prepare: [
    'Use the crop name and weight from your harvest record. This form records kilograms. A count of bunches or crates is not a measured weight.',
    'To practise safely, open the sample tour, choose Record the work and the sale, then Try it now. Choose Picked. Use sample details rather than adding a practice harvest to your own farm.',
  ],
  steps: [
    { id: 'find', title: 'Open the harvest page', action: 'My Records → Picked', paragraphs: [
      'Choose Picked to record produce harvested. Sold records sales and Spent records costs. Picking food does not by itself mean a buyer paid you.',
      'Check Recent harvests before adding an entry. If you already saved this picking, another entry would count it twice.',
    ], check: 'You are in the right workspace and this picking is not already recorded.' },
    { id: 'measure', title: 'Choose the crop and check kilograms', action: 'Crop → Kg harvested', paragraphs: [
      'Choose the matching crop from the list and enter the kilograms harvested. Check the decimal carefully before saving.',
      'Weigh produce sold in bunches or crates before entering kilograms. Do not invent a conversion or enter the number of bunches as its weight.',
      'There is no harvest-date field on this form yet. It records the day you enter it. Keep the real picking date in your source record if you are catching up later; that late entry will appear in the month you enter it.',
    ], check: 'The crop and kilograms match your source, and you understand which date the app will record.' },
    { id: 'photo', title: 'Add your own evidence if useful', action: 'Produce photo (optional) → Choose photo', paragraphs: [
      'You may attach a clear photo of this harvest. You can also save the kilograms without a photo.',
      'The crop picture shown by the app may be an AI-generated reference. It is not evidence that you harvested that crop. Read the label and keep reference art separate from your own photograph.',
    ], check: 'You can tell a crop reference picture from a photo of your actual harvest.' },
    { id: 'save', title: 'Save and find the entry again', action: 'Save harvest → Recent harvests', paragraphs: [
      'Choose Save harvest once. Read any message, then find the new row in Recent harvests. Check its crop, kilograms and displayed date.',
      'Switch to another tab and return to Picked to check the entry again. If the app reports a queued or offline save, follow that message; do not add the same picking again as a retry.',
      'If an entry is wrong, keep the source record and note the correction needed. This harvest list does not currently offer an Edit button. A second guessed entry will not correct the first one.',
    ], check: 'The saved row matches the source, or you have identified the exact correction needed.' },
    { id: 'compare', title: 'Read the difference without guessing', action: 'Charts → Harvest graphs → Picked & sold', paragraphs: [
      'Choose the period you want to compare. Check the Orchard in setting so you know which produce is included.',
      'The chart calculates kept as picked minus sold. It does not separately record food eaten at home, gifts, storage, seed, feed or loss. Keep those destinations in a supporting notebook if you need to explain them.',
      'More sold than picked can mean a missing harvest record or a sale from an earlier harvest. Investigate the dates and records; do not change a weight just to make the chart look tidy.',
    ], check: 'You can explain what the chart shows and what still needs a supporting record.' },
  ],
  practice: {
    title: 'A bunch count is not a weight.',
    question: 'You picked six bunches but have not weighed them. What belongs in Kg harvested?',
    choices: [
      { label: 'Enter 6 kg', feedback: 'Six bunches does not establish six kilograms. The form needs a weight, not a count of bunches.', correct: false },
      { label: 'Weigh them before entering kilograms', feedback: 'Yes. Keep the bunch count in your source record and enter the measured kilograms when you have them.', correct: true },
      { label: 'Enter zero so the record is complete', feedback: 'Zero would say there was no weight. An unknown weight must not be turned into zero.', correct: false },
    ],
  },
  limits: { title: 'Keep dates and destinations beside the app', paragraphs: [
    'The harvest form records kilograms and an entry date. It does not backdate a picking or divide it into home food, stored produce and losses. Keep those details in your source record.',
    'A harvest total is not sales income or profit. Follow a later sale and its payment separately.',
  ] },
  finish: { title: 'Now record a real picking', text: 'Open Picked when you have the crop and weight ready. Confirm your workspace and check the existing entries first.', href: '/records?tab=picked', label: 'Open Picked' },
};

export const EXPENSE_GUIDE: AppGuide = {
  id: 'expenses', href: '/student/guides/expenses', cardTitle: 'Record a cost and keep its receipt',
  title: 'Keep the cost and its evidence together.',
  summary: 'Record what you paid, check the cents and reopen the cost with its supporting receipt.',
  image: '/studies-guides/expense-record.jpg',
  imageAlt: 'Illustration of a grower considering costs with a notebook, calculator and produce at a homestead table',
  caption: 'Check the source before saving a cost · illustrated example',
  prepareTitle: 'Bring the receipt or payment record',
  prepare: [
    'Have the item, amount paid and supplier ready. Keep the original payment date. This form records today’s entry date and has no date picker yet.',
    'For practice, open the sample tour, choose Record the work and the sale, then Try it now. Choose Spent. Use sample details in a group lesson.',
  ],
  steps: [
    { id: 'find', title: 'Check the book before adding a cost', action: 'My Records → Spent → Log a cost', paragraphs: [
      'Look for the cost in Spent first. If it already exists, use Edit on that row to correct it. Do not add another copy of the same payment.',
      'For a new cost, choose Log a cost. The form is headed Money you paid out.',
    ], check: 'You know whether to add a new payment or edit an existing cost.' },
    { id: 'amount', title: 'Copy the amount and describe the cost', action: 'What for → Amount (R) → Supplier → Category', paragraphs: [
      'Write what the payment was for and enter the full amount, including cents. Compare it with the receipt or checked payment evidence.',
      'Supplier and Category are optional. Choose them when you know them. If the amount is unknown, find the evidence before saving; do not enter zero as a substitute.',
      'Keep the original date in your source record when entering an older cost. The app places this entry in the month you type it.',
    ], check: 'The description, amount and supplier match your source record.' },
    { id: 'assign', title: 'Assign the cost only when you know', action: 'Growing area for this entry → Crop this cost was for', paragraphs: [
      'Choose the growing area only when the cost belongs to it. Shared by beds and staple plots is available for a genuinely shared cost; Unassigned leaves it unallocated.',
      'Only fill Crop this cost was for when the payment was just for that crop. Leave it blank for a whole-garden cost. Do not invent a split to make a crop appear more profitable.',
    ], check: 'Any growing-area or crop assignment is supported by what the payment actually covered.' },
    { id: 'receipt', title: 'Keep the original receipt photo', action: 'Receipt photo → Take photo or Choose photo', paragraphs: [
      'A receipt photo is optional. You can attach it and fill in the cost yourself. Check that the important details are readable.',
      'Read this photo with Lima is an optional online helper. Compare any suggested item, supplier and total with the photo before saving. In the sample tour, Read a receipt with Lima uses a prepared example.',
      'The original receipt photo stays on this device. A cost appearing elsewhere does not mean its original photo is available there too.',
    ], check: 'The saved details agree with the source; you have not treated an AI suggestion as proof.' },
    { id: 'save', title: 'Save, reopen and compare', action: 'Log cost → Spent → Edit or View slip', paragraphs: [
      'Choose Log cost and read the save result. Find that same cost in Spent and compare its amount with your evidence.',
      'Use Edit to check or correct the fields, then Save changes. Use View slip to open a receipt photo saved on this device. The sample tour may show a prepared receipt instead.',
      'If a receipt is unavailable, keep the original and check the device where you saved it. Do not create another cost simply to retry a photo or a queued save.',
    ], check: 'You can find the cost again, verify its cents and identify where the original evidence is kept.' },
  ],
  practice: {
    title: 'The receipt total and suggestion differ.',
    question: 'Lima suggests an amount that does not match the readable receipt. What should you do?',
    choices: [
      { label: 'Save the suggestion because it is automatic', feedback: 'An automatic reading can be wrong. Compare the source and check the amount before saving.', correct: false },
      { label: 'Check the receipt and correct the amount', feedback: 'Yes. Use the checked source. If the total is unclear, obtain better evidence before recording an amount.', correct: true },
      { label: 'Save both amounts as separate costs', feedback: 'That would risk counting the same payment twice. Resolve the difference on the one cost.', correct: false },
    ],
  },
  limits: { title: 'A useful record is not complete accounts', paragraphs: [
    'Spent records payments, but the app cannot know which costs you have not entered. Sales minus recorded costs does not establish full profit when information is missing.',
    'Keep original dates and evidence. Equipment, borrowing and household money need distinct treatment when preparing full accounts; use the finance workbook and your bookkeeper rather than treating every cash movement as a crop cost.',
  ] },
  finish: { title: 'Now record a checked cost', text: 'Open Spent in your current workspace. Find an existing entry first, or add the payment once from its source record.', href: '/records?tab=spent', label: 'Open Spent' },
};

export const APP_GUIDES: readonly AppGuide[] = [HARVEST_GUIDE, EXPENSE_GUIDE, INVOICE_APP_GUIDE];
