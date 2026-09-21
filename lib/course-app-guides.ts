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

export const MAPPING_GUIDE: AppGuide = {
  id: 'mapping', href: '/student/guides/mapping', cardTitle: 'Find, map and reopen your site',
  title: 'Start with the right piece of land.',
  summary: 'Find a place, save its pin, trace a boundary and check the work before planning beds.',
  image: '/studies-guides/sketch-the-site.jpg',
  imageAlt: 'Illustration of two growers comparing a paper sketch with the homestead in front of them',
  caption: 'Compare the map with the ground · illustrated example, not a surveyed plan',
  prepareTitle: 'Know which place you are mapping',
  prepare: [
    'Bring a name you recognise, a sketch and any checked measurements. Identify familiar roads, buildings and corners on the ground. A satellite picture alone may not show the current boundary clearly.',
    'To practise, open the sample tour. Choose Start with a garden, then Open the garden on the map. The Tour button shows that you are practising. Use a clearly named practice outline; sample changes reset on a full reload.',
  ],
  steps: [
    { id: 'find', title: 'Find and check the location', action: 'Map → Show map tools → Find your land', paragraphs: [
      'If the tools are closed, choose Show map tools. For a saved site, open Places and choose its name. Let the map finish moving, then check the site name and landmarks.',
      'For a new location, use Search town or address, then zoom in and tap the correct spot. A town search is a starting point, not the exact position of your garden.',
      'Locate me uses the device location if you choose to allow it. It is useful only when you are at the intended site. You can use search and the map without granting location access.',
    ], check: 'The name, buildings and roads match the place you mean to work on.' },
    { id: 'save-place', title: 'Save the pin once', action: 'Save place → Name and label → Save place', paragraphs: [
      'Choose Save place for the selected spot. Give it a recognisable name and choose a label such as Home or Field. Save the place.',
      'If the app finds an existing place nearby, read its name. Update it when it is the same site. Save as new place only when you really mean a different place; do not create a second record just to try saving again.',
      'Open Places and choose the saved name again. Check where the map goes. The pin saves a location; it does not trace the land around it.',
    ], check: 'You can find the same named place again, and have not accidentally duplicated it.' },
    { id: 'trace', title: 'Trace the land you can identify', action: 'Add to my map → Land boundary', paragraphs: [
      'If the right outline already exists, inspect it under Parcels first. Use Edit shape for a correction instead of drawing the same parcel again.',
      'For a new outline, choose Land boundary, or Add parcel under Parcels. Tap each corner in order around the edge. You can also move the map until the crosshair is on a corner, then choose Add corner.',
      'Use Undo if the last corner is wrong. Keep following the edge without crossing your own line. Choose Finish to close the shape. Cancel stops the unfinished drawing without adding it.',
    ], check: 'The outline follows the intended edge, and you can explain any uncertain corner.' },
    { id: 'name-boundary', title: 'Name and review the parcel', action: 'Finish → Name your land → Save name → Parcels', paragraphs: [
      'After Finish, give the parcel a clear name, choose what it represents and check the optional link to a saved place. Choose Save name. Finish has already created the outline; Skip in the naming form does not undo it.',
      'Find the named entry under Parcels. Check its units and shape against your sketch and measurements. A displayed area comes from the drawn shape, so a misplaced corner can change the result.',
      'For a correction, choose that parcel’s Edit shape. Move the intended corner and review it before choosing Done. Use Cancel if you do not want those edits. A plausible total does not prove every corner is right.',
    ], check: 'The named parcel, its location and its drawn edge agree with your evidence.' },
    { id: 'growing-area', title: 'Keep growing beds separate', action: 'Design Studio → Review the site and its growing areas', paragraphs: [
      'A land boundary can include paths, a house and places where nothing is planted. It is not automatically the area of your vegetable beds.',
      'In Design Studio, check the site and map the actual growing areas before using the crop plan. The financial charts use the main saved site’s mapped beds when available; do not assume that selecting another map pin changes every financial chart.',
      'Check the area and units used in a forecast. Planned harvests are estimates, not proof of what was picked or sold. Use the harvest, expense and invoice guides for actual records.',
    ], check: 'You can point separately to the place pin, the parcel edge and the growing beds.' },
    { id: 'reopen', title: 'Reopen and explain your work', action: 'Places → Saved place → Parcels', paragraphs: [
      'Return to Places and open the same site. Find the parcel by name. Explain one corner you checked and one uncertainty that still needs checking on the ground.',
      'In the sample tour, do this in the same session. A full reload restores the sample starting data. This exercise does not test your own account’s backup or another device.',
      'For your own work, check the saved result and any connection messages. Do not draw a duplicate because you are unsure whether the first save worked. Keep your source sketch and measurements.',
    ], check: 'You can find the saved work and explain what is measured, estimated or still unknown.' },
  ],
  practice: {
    title: 'The pin is in the right place.',
    question: 'Does that mean the whole area around it is ready to use as vegetable-bed area in a forecast?',
    choices: [
      { label: 'Yes, use the whole parcel as growing area', feedback: 'A parcel may include a house, paths and unplanted land. Its area is not automatically the area of the beds.', correct: false },
      { label: 'Check the boundary and map the actual beds', feedback: 'Yes. A pin locates the site, a boundary outlines land, and beds describe the growing area. Check which site and areas the forecast uses.', correct: true },
      { label: 'Add another pin to increase the area', feedback: 'Another pin does not measure more growing space. Reopen the correct place and check its mapped beds.', correct: false },
    ],
  },
  limits: { title: 'Keep the evidence beside the map', paragraphs: [
    'This is a planning map. Traced lines, satellite imagery and device GPS do not by themselves establish a surveyed or legal boundary. Check uncertain edges and permissions before acting on them.',
    'The sample uses prepared records. A completion badge shows recorded steps, not an independent check that a drawing or a financial forecast is accurate.',
  ], reference: { href: 'https://ngi.dlrrd.gov.za/index.php/what-we-do/prof', label: 'NGI mapping and boundary-verification support' } },
  finish: { title: 'Now find and check your site', text: 'Open Map in your current workspace. Start with Places if the site is already saved. Use the sample tour above for practice.', href: '/farmer', label: 'Open Map' },
};

export const SALES_GUIDE: AppGuide = {
  id: 'sales', href: '/student/guides/sales', cardTitle: 'Record a sale once',
  title: 'Keep the sale and its payment together.',
  summary: 'Choose the right starting record, check the payment, then find the same sale again.',
  image: '/studies-guides/record-sale.jpg',
  imageAlt: 'Illustration of a grower and buyer discussing vegetables at a rural market stall',
  caption: 'Agree the produce, price and payment terms · illustrated example',
  prepareTitle: 'Start with what actually happened',
  prepare: [
    'Have the buyer, product, quantity, unit, agreed price and dates beside you. Check whether an invoice or sale already exists before adding anything.',
    'For practice, open the sample tour and choose Record the work and the sale. Choose Try it now if the tour tips cover the screen. Sample changes are practice only and reset on a full reload.',
  ],
  steps: [
    { id: 'find-sale', title: 'Look for the existing record', action: 'My Records → Sold → Recent sales or the money list', paragraphs: [
      'If the sale already has an invoice, choose its View or View invoice link. A buyer asking for another copy does not mean another sale.',
      'If a recorded sale has no invoice, use Create invoice on that sale when available. Keep its recorded crop, kilograms, amount and payment date. Do not start another sale to create its paperwork.',
      'For a sale that is not recorded, choose New sale & invoice. For an older sale or paper document, choose Past sale / paper invoice and keep the original reference and date.',
    ], check: 'You know whether you are opening an existing record or adding a genuinely unrecorded sale.' },
    { id: 'choose-source', title: 'Choose the source before filling the details', action: 'What are you recording? → Is this sale already in My Records?', paragraphs: [
      'Read the selected Invoice type. For Produce already sold or An invoice already written on paper, answer whether the sale is already recorded. Choose the exact existing sale when linking one.',
      'Make these choices first. Changing the invoice type or existing-sale choice starts a fresh form, so check the details again before saving.',
      'For a paper copy, enter the original paper reference. The invoice issue date is not automatically the day the buyer paid.',
    ], check: 'The source choice and any linked sale match your evidence.' },
    { id: 'check-sale', title: 'Check the agreed quantity and total', action: 'Bill to → Crop or product → Quantity → Unit → Price each', paragraphs: [
      'Check the buyer and every line. Keep kilograms, bags, bunches and other units as they were agreed. The app does not know a bag’s weight unless you have measured and recorded it.',
      'Use the agreed price. A suggested crop price is a guide, not the buyer’s agreement. Compare the line amounts and total with your source.',
      'Choose a growing area only when the invoice belongs to it. Keep a mixed invoice unassigned rather than giving one bed income from another activity.',
    ], check: 'The buyer, units, quantity, agreed price and total agree with the source record.' },
    { id: 'check-payment', title: 'Record whether the full payment arrived', action: 'Has the buyer paid? → Payment received on → Payment method', paragraphs: [
      'Choose Not yet — payment outstanding if the money is still due. Choose Yes — paid in full only after checking that the full payment arrived.',
      'For full payment, check the actual receipt date and method. A payment promise or screenshot from the buyer needs checking against your own receipt evidence.',
      'A deposit or instalment is not payment in full. This app does not keep a partial-payment balance schedule. Keep a separate checked record of amounts received and still owed; do not mark the invoice fully paid for a deposit.',
      'Keep every instalment’s actual receipt date in that separate record. The app gives a paid invoice one payment date for its whole amount, so its charts cannot show the separate instalment dates.',
    ], check: 'The status describes the evidence, and a part payment has not been represented as full payment.' },
    { id: 'save-sale', title: 'Save and check the same invoice', action: 'Save invoice → Saved → Open the same number', paragraphs: [
      'Choose Save invoice and read the message. Open Saved and find the same invoice number, buyer, amount and payment status.',
      'If the document is saved on this device but the crop sale book still needs updating, reconnect and follow the message on that same invoice. Creating another document is not a safe retry.',
      'Paid invoices contribute income to My Records; paid kilogram lines can create linked crop-sale records. Other units retain their quantities. An unpaid invoice is not cash received.',
    ], check: 'The saved document is the one you intended, and any pending update is visible.' },
    { id: 'follow-sale', title: 'Follow the record back to Sold', action: 'My Records → Sold → View invoice', paragraphs: [
      'For a paid invoice, check the amount in Sold and reopen its invoice link. Do not manually add its income again because a linked crop record also exists.',
      'When an unpaid invoice is later paid in full, open that existing invoice or its Review payment button, check the receipt date and save the update. Keep the same invoice number.',
      'To send another copy, reopen the saved invoice and check Share PDF or Print. Downloading a copy does not send it to a customer. Review the destination yourself before sending.',
    ], check: 'You can trace the sale, payment and document without creating a duplicate.' },
  ],
  practice: {
    title: 'Only part of the payment has arrived.',
    question: 'The invoice is for R120.00. The buyer pays R40.00. What should you do?',
    choices: [
      { label: 'Mark the invoice paid in full', feedback: 'R80.00 is still owed. Paid in full would misstate the payment; this screen does not track a partial balance.', correct: false },
      { label: 'Keep a separate payment record and leave full payment unconfirmed', feedback: 'Yes. Link the R40.00 evidence to the invoice and keep R80.00 outstanding in a checked supporting record. Do not create a second produce sale.', correct: true },
      { label: 'Create another R40.00 produce sale', feedback: 'The payment settles part of the existing sale. It does not describe another delivery of produce.', correct: false },
    ],
  },
  limits: { title: 'Keep the original evidence', paragraphs: [
    'The invoice document is saved on this device. A synchronised crop-sale row is not a backup of every document detail. Retain the source and a checked copy.',
    'A saved invoice or payment status does not by itself prove receipt, full profit or tax compliance. For deposits, adjustments or disputed amounts, keep a checked supporting balance record and get bookkeeping help.',
  ] },
  finish: { title: 'Find your sale before adding another', text: 'Open Sold in your current workspace. Reopen an existing record when there is one.', href: '/records?tab=sold', label: 'Open Sold' },
};

export const APP_GUIDES: readonly AppGuide[] = [MAPPING_GUIDE, HARVEST_GUIDE, SALES_GUIDE, EXPENSE_GUIDE, INVOICE_APP_GUIDE];
