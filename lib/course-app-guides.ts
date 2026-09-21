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

export const CHARTS_GUIDE: AppGuide = {
  id: 'charts', href: '/student/guides/charts', cardTitle: 'Read Charts and check the evidence',
  title: 'Read the chart. Check the story.',
  summary: 'Choose the right period, separate plans from records and trace a figure back to its source.',
  image: '/studies-guides/expense-record.jpg',
  imageAlt: 'Illustration of a grower reviewing a notebook and calculator in a homestead garden',
  caption: 'Keep the record beside the decision · illustrated example',
  prepareTitle: 'Start with the right workspace',
  prepare: [
    'Open My Records, then Charts. Check whether you are using demonstration records or your own farm. From the sign-in prompt, Preview with demonstration records opens the prepared example without changing a real farm.',
    'For your own records, have a receipt, sale or harvest entry to compare. Read loading, offline and save messages before deciding that a missing figure means zero. Keep private customer and banking details out of group practice.',
  ],
  steps: [
    { id: 'chart-window', title: 'Choose the window on this chart', action: 'Charts → Cash flow → 6m, 12m or 24m', paragraphs: [
      'The buttons choose how many months the Cash flow graph shows. Read the dates on that graph. Tap a month to inspect its money in, money out and running total.',
      'The Harvest graphs card has its own window buttons. On a wide screen, the Financial sheet also has separate Month, Season and Year buttons. Changing one control does not set every other view to that period.',
      'On a phone, the summary at the top says this month. Read the period beside each lower card as well. Check the labels again after changing screen size or reopening the page.',
    ], check: 'You can name the period for the exact figure you are reading.' },
    { id: 'cash-meaning', title: 'Explain the running total', action: 'Cash flow → Money in, money out and the lower running-total band', paragraphs: [
      'The running total starts at zero at the left edge of the selected window. It adds recorded money in and subtracts recorded spending across those months. It is not your bank balance, because it has no opening bank balance.',
      'Cash surplus and Recorded cash margin describe the included records. Missing expenses, stock, equipment treatment, debt and other accounts can change the complete business result. Do not call one chart a full profit-and-loss statement.',
      'A cut mark means a tall bar has been shortened to keep other months readable. Read the accompanying amount rather than estimating it from the height. The two bands use different scales: monthly movements and their running total answer different questions.',
    ], check: 'You can explain why a negative running total does not by itself prove an overdrawn account.' },
    { id: 'harvest-meaning', title: 'Read picked, sold and the remainder', action: 'Harvest graphs → Picked & sold → Read the month and orchard setting', paragraphs: [
      'Check the selected window and whether Orchard in or Orchard out is shown. That setting changes which kilograms are counted; it does not remove all those activities from the money totals.',
      'Kept is the picked-minus-sold remainder in the records. It does not identify how much was eaten, given away, stored, used elsewhere or lost. Keep those destinations separately when needed.',
      'A dashed outline can mark a month with more sold than logged as picked. Read the explanation and check missing harvests or sales from earlier stock. Do not enter an invented harvest to make the bars agree.',
    ], check: 'You know the units, included produce and what the remainder cannot tell you.' },
    { id: 'plan-meaning', title: 'Compare the plan with the right actuals', action: 'Harvest graphs → Plan vs actual', paragraphs: [
      'This view places logged picking this year beside a benchmark for one complete crop cycle on the planned ground. The benchmark is not automatically a target for the whole calendar year.',
      'Check the crop, mapped growing area and stage of the cycle. A shorter actual bar can mean the cycle is unfinished or records are missing; it is not proof that produce was lost. A larger bar also needs a fair period and area comparison.',
      'The plan comes from the main saved site’s mapped beds when available. A place pin or whole parcel is not the bed area. Orchard produce has no comparable bed-cycle benchmark here; read the separate explanation.',
    ], check: 'You can state one reason the bars may differ before judging the growing result.' },
    { id: 'area-meaning', title: 'Check what a return per area includes', action: 'What your growing space returns → Read period, mapped m² and assigned entries', paragraphs: [
      'This card uses recorded sales minus assigned costs and today’s mapped area. Its square metres are not a historical measurement of harvested ground.',
      'Read the shared-cost and unassigned-cost notes. Missing overheads or labour are not silently included. Crop performance may say Cost per m²: not attributed rather than supplying a full crop profit.',
      'Compare the same period, units and growing area before drawing a conclusion. Keep uncertain or missing values visible and check the underlying map and records.',
    ], check: 'You can name an included cost, an excluded or unknown cost, and the area used.' },
    { id: 'trace-figure', title: 'Trace one figure back to evidence', action: 'My Records → Sold, Spent or Picked → Reopen the source record', paragraphs: [
      'Choose one amount or harvest and find its record. On a wide screen, the Financial sheet also lists dated entries with invoice and receipt links. Reopen the matching document instead of adding another entry.',
      'Harvest and cost logging forms stamp the entry date. Paid invoices use their recorded payment date. Check the actual source dates and keep late-entry evidence; do not assume every chart month is the date work happened.',
      'A paid invoice has one payment date for its whole amount. The app cannot show a full instalment history from that field. Keep separate evidence for part payments and do not mark a deposit as full payment.',
      'Write down one question the evidence can answer and one gap still to resolve. Follow the harvest, expense or invoice guide if an actual supported entry needs correction.',
    ], check: 'You can link the figure to its source and explain a remaining uncertainty without inventing an entry.' },
  ],
  practice: {
    title: 'The running total is below zero.',
    question: 'The selected cash-flow window shows −R50.00. Does that prove the bank account is overdrawn?',
    choices: [
      { label: 'Yes, the chart is the bank balance', feedback: 'The running total begins at zero for the selected months. Without the opening balance and all account movements, it cannot establish the bank balance.', correct: false },
      { label: 'No; check the opening balance and complete account evidence', feedback: 'Correct. The chart shows the net movement of its included records. Reconcile the account separately before concluding what cash is available.', correct: true },
      { label: 'Add an extra sale to bring it above zero', feedback: 'Do not invent a sale to change a chart. Investigate the period, missing records and original evidence.', correct: false },
    ],
  },
  limits: { title: 'A useful view still has a boundary', paragraphs: [
    'Charts helps you investigate recorded cash, harvests and planning assumptions. It does not produce a complete balance sheet, stock valuation, bank reconciliation or tax return.',
    'Keep checked supporting schedules for amounts the app does not track, and ask for appropriate bookkeeping help with complete accounts. A map, chart or export does not prove profitability or funding approval.',
  ] },
  finish: { title: 'Choose one figure and explain it', text: 'Open Charts in your current workspace. Read its period, inspect one month and trace a figure to a source. Use demonstration records for practice.', href: '/records?tab=charts', label: 'Open Charts' },
};

export const START_GUIDE: AppGuide = {
  id: 'getting-started', href: '/student/guides/getting-started', cardTitle: 'Start, find your way and keep work safe',
  title: 'Find your way. Keep your work safe.',
  summary: 'Practise with the sample farm, return to a record and check what has saved before you move on.',
  image: '/studies-guides/sketch-the-site.jpg',
  imageAlt: 'Illustration of two growers using a sketch and notebook to discuss their homestead',
  caption: 'Keep a source record beside your app · illustrated example',
  prepareTitle: 'Start with practice details',
  prepare: [
    'Use the sample farm for your first try. Keep real customer details, payments and private photographs out of a group demonstration.',
    'Have a notebook ready. Write down which page you used and how you will find the same item again.',
  ],
  steps: [
    { id: 'sample', title: 'Enter the sample farm', action: 'Menu → Take a tour → Record the work and the sale → Try it now', paragraphs: [
      'Open Take a tour. Choose Record the work and the sale, then Try it now. You will see prepared records in My Records.',
      'Look for Tour beside the menu. Open the menu and read Tour workspace. You are practising with example data. The sample farm is not a place to keep your own records.',
      'Sample changes reset on a full reload. Practise and check the result in the same tab; do not rely on a practice entry being there tomorrow.',
    ], check: 'You can show the Tour workspace label before practising.' },
    { id: 'navigate', title: 'Choose the page for the task', action: 'Home · Map · My Records · Menu → Study', paragraphs: [
      'Use Map for places and plans. Use My Records for Picked, Sold, Spent and Charts. Choose Study in the menu for lessons and these app guides.',
      'The Tour guide button brings the tips back. Closing a tip does not leave the sample farm. Read the page title when you move to another screen.',
      'Some pages depend on your role. A page seen in a sample role does not mean your own account has access to it.',
    ], check: 'You can name the page for a harvest, an invoice and a lesson.' },
    { id: 'reopen', title: 'Find the same record again', action: 'My Records → Invoice → Saved → Choose an existing invoice', paragraphs: [
      'In the sample farm, open Invoice and choose an existing document from Saved. Read its number, buyer, date, total and payment status. You do not need to change or send it.',
      'Return to the list and reopen that same invoice. Compare the details with your note. A request for another copy is not a new sale.',
      'For your own work, check the site name and account as well as the record. A similar name is not enough to identify the right item.',
    ], check: 'You can reopen the same document and explain how you recognised it.' },
    { id: 'save-check', title: 'Read the save result', action: 'Save once → Read the message → Reopen the same item', paragraphs: [
      'When you later save real work, read the result before leaving. Check the saved row or document against your source. If there is an error, keep the source and note what failed.',
      'Saved on this device means a local copy. Waiting to send means the server save still needs confirmation. Reconnect and follow the message; do not add the same record again as a retry.',
      'Menu → Offline & sync shows the fieldwork queue. Offline or a waiting count beside the menu can open it too. The money book has its own sync system: an empty fieldwork queue does not prove every invoice or sale is backed up.',
    ], check: 'You can distinguish a reopened local record from a confirmed server save.' },
    { id: 'keep-copy', title: 'Keep the evidence you need', action: 'Reopen → Check → Keep a copy', paragraphs: [
      'Complete invoice documents and original money-book receipt photos stay on their original device. A linked sale appearing elsewhere does not prove the full invoice or photo is there.',
      'Keep your source records and checked document copies. Follow the invoice guide to preview a PDF before sharing. Downloading a copy does not send it to a buyer.',
      'Before leaving signal, prepare the pages you need in Offline & sync. Save lesson media separately through Study offline. Read what is available and test reopening it; a connection icon alone does not prove it was downloaded.',
      'Do not clear site data to fix a waiting save. It can remove downloads and unsent work. Keep the device protected and resolve the save message first.',
    ], check: 'You know where your record and its original evidence are kept.' },
    { id: 'own-work', title: 'Leave practice before real work', action: 'Menu → Exit tour → Check your own account and site', paragraphs: [
      'Open the menu and choose Exit tour. This returns you to Home. Check that the Tour workspace label has gone, then check your own account and selected site before entering real details.',
      'End tour in the tips stops the guided checklist; it does not leave the sample workspace. Use Exit tour in the menu when you want your own work.',
      'If you need to sign in, use your own account. If the account or site is wrong, resolve it before saving. Keep practising in the sample farm until you can follow the task confidently.',
    ], check: 'You can explain whether your next entry belongs to practice or to your own farm.' },
  ],
  practice: {
    title: 'A save is still waiting.',
    question: 'An item says Saved on this device — waiting to send. What should you do?',
    choices: [
      { label: 'Add the same item again', feedback: 'That risks a duplicate. Keep the source and follow the original item’s save message.', correct: false },
      { label: 'Keep the item, reconnect and check its save result', feedback: 'Yes. Reopen the same item and resolve its message. An empty fieldwork queue alone does not confirm the separate money book.', correct: true },
      { label: 'Clear site data and start again', feedback: 'Clearing site data can remove unsent work and downloads. Preserve the record and resolve the save problem first.', correct: false },
    ],
  },
  limits: { title: 'Practise the task, then check the evidence', paragraphs: [
    'Exploring a tour stop is your checklist choice. It is not a training certificate or proof that you can perform a farming skill.',
    'For an independent try, enter the sample farm, find a different existing invoice, note its reference, leave the list and reopen it. Explain the workspace and payment status to a partner. Finish with Exit tour; do not send the document.',
  ] },
  finish: { title: 'Try your first task with the sample farm', text: 'Start the tour, find an existing record and return to it. Keep these steps beside you until you can do it independently.', href: '/tour', label: 'Open the sample tour' },
};

export const PAPER_SALES_GUIDE: AppGuide = {
  id: 'past-sales', href: '/student/guides/past-sales', cardTitle: 'Bring paper and past sales into the app',
  title: 'Keep the old paper. Record the sale once.',
  summary: 'Bring an earlier sale into the app with its original evidence, date and reference.',
  image: '/course-images/market-community/market-community-l1.jpg',
  imageAlt: 'Illustration of a grower keeping a written record beside a basket of produce',
  caption: 'The source record comes first · illustrated example',
  prepareTitle: 'Have the paper and payment evidence ready',
  prepare: [
    'Bring the original reference, issue date, buyer, goods, quantities, units and agreed prices. Check whether payment arrived and on which date. Do not guess missing details.',
    'For practice, use the sample tour → Record the work and the sale → Try it now. Use a clearly marked fictional example. Sample changes reset on a full reload.',
  ],
  steps: [
    { id: 'check-existing', title: 'Look for the sale before entering it', action: 'My Records → Sold → Invoice → Saved', paragraphs: [
      'Check both Sold and Saved. Match the reference, buyer, date, goods and amount. A paper copy and an app entry can describe the same sale.',
      'If an invoice already exists, reopen it from Saved or its View link. Do not create a new sale because the buyer wants another copy.',
    ], check: 'You know whether the sale and an invoice are already recorded.' },
    { id: 'choose-entry', title: 'Choose the right kind of entry', action: 'Sold → Past sale / paper invoice → What are you recording?', paragraphs: [
      'Choose An invoice already written on paper to copy an existing paper invoice. Choose Produce already sold when you are documenting an earlier sale without that paper invoice.',
      'Answer Is this sale already in My Records? Choose Yes — link the existing sale if it is recorded. Choose No — record it with this invoice only after checking that it is absent.',
      'Choose the entry type and existing-sale answer before filling the rest. Changing these choices starts a fresh form, so check all the details again.',
    ], check: 'The choice describes the source, not just the page you happened to open.' },
    { id: 'link-sale', title: 'Link only the exact recorded sale', action: 'Yes — link the existing sale → Recorded sale', paragraphs: [
      'Select the exact available sale in kilograms. Read its crop, weight, amount, buyer and date. Its recorded crop, kilograms, total and payment date stay together.',
      'An empty list is not proof that the sale never happened. It may already have an invoice or may not be an eligible kilogram record. Check Saved and your original evidence. Never pick a similar sale as a substitute.',
      'If the app says the invoice is on another device, reopen it there. A linked sale can synchronise without copying the full invoice document. Connect to the internet before linking a real existing sale.',
    ], check: 'You have an exact match, or you have stopped to resolve why it is unavailable.' },
    { id: 'source-details', title: 'Preserve the reference, date and units', action: 'Original paper invoice reference → Invoice issue date → Line items', paragraphs: [
      'For a paper copy, enter the original paper number and date. The app gives its copy an app invoice number too. Keep both references; the buyer’s order reference is a separate field.',
      'Check the date in the document preview before saving. Copy the goods, quantities, units and agreed prices. A suggested price is not the price on your paper.',
      'Bunches, bags and kilograms are different units. Keep the unit on the source. Do not invent a weight to make an old record fit.',
    ], check: 'The preview agrees with the paper, including the original date and exact cents.' },
    { id: 'old-payment', title: 'Record what actually happened to payment', action: 'Has the buyer paid? → Payment received on', paragraphs: [
      'Choose Yes — paid in full only when full payment is supported by checked evidence. Use its actual receipt date and method. An old invoice date does not prove the buyer paid that day.',
      'Choose Not yet — payment outstanding when payment remains due. This app does not keep an instalment ledger. Keep deposits and the remaining balance separately; do not mark a deposit as full payment.',
      'For a linked recorded sale, preserve its recorded paid status and payment date. If they disagree with your evidence, resolve the original record instead of making a duplicate.',
    ], check: 'The invoice date and payment date each describe their own event.' },
    { id: 'verify-copy', title: 'Save and reopen the same copy', action: 'Save invoice → Saved → Open the same invoice', paragraphs: [
      'Save once and read the result. Find the same invoice again and compare the paper reference, issue date, buyer, units, total and payment status.',
      'A saved invoice’s issue date is locked. Check it before saving; keep the original evidence and seek help with that record if it is wrong. Do not add another sale as a correction.',
      'If the message says the crop sale book still needs updating, reconnect and save the same invoice again. Keep the paper even after the app copy is saved.',
    ], check: 'You can connect one source sale to its app document without counting its income twice.' },
  ],
  practice: {
    title: 'The old sale is already recorded.',
    question: 'Your paper describes a sale already in My Records. What should you do first?',
    choices: [
      { label: 'Enter a second sale with today’s date', feedback: 'That can duplicate income and change the story of when it happened. Find the existing record first.', correct: false },
      { label: 'Reopen its invoice, or link the exact eligible sale', feedback: 'Yes. Match the source first. If an invoice exists, reopen it; otherwise use the supported existing-sale link.', correct: true },
      { label: 'Link another sale with a similar amount', feedback: 'A similar amount does not establish the same sale. Keep the evidence and resolve the missing match.', correct: false },
    ],
  },
  limits: { title: 'Keep gaps visible', paragraphs: [
    'An app copy does not replace missing source evidence. It does not convert units, establish tax compliance or repair an incorrect old record by itself.',
    'Independent practice: find one existing sample invoice and identify its issue date and payment status. Explain which entry route you would use for a paper copy and when you must stop to check a possible duplicate.',
  ] },
  finish: { title: 'Start by checking Sold', text: 'Look for the existing sale before opening a past-sale or paper-copy form. Use the sample workspace until you can explain your choice.', href: '/records?tab=sold', label: 'Open Sold' },
};

export const PAYMENT_GUIDE: AppGuide = {
  id: 'payments', href: '/student/guides/payments', cardTitle: 'Review payment and share the right invoice',
  title: 'Check payment. Send the right copy.',
  summary: 'Update the existing invoice from checked payment evidence and inspect the document before sharing.',
  image: '/studies-guides/expense-record.jpg',
  imageAlt: 'Illustration of a grower checking a notebook and calculator at a homestead table',
  caption: 'Check the amount against its evidence · illustrated example',
  prepareTitle: 'Bring the invoice reference and payment evidence',
  prepare: [
    'Have the buyer, invoice number and payment evidence ready. A buyer asking for a copy is not proof of payment.',
    'Practise in the sample tour. Keep real banking and customer details private. A practice export ends with checking the copy; do not send it to a real customer.',
  ],
  steps: [
    { id: 'right-invoice', title: 'Reopen the correct invoice', action: 'Invoice → Saved → Invoice number or Review payment', paragraphs: [
      'Find the existing invoice by number, buyer, issue date and total. Choose its row or Review payment to open it.',
      'Check that you are editing that invoice. Do not start New invoice to record payment for goods already invoiced.',
    ], check: 'The document and buyer match the payment you are investigating.' },
    { id: 'payment-evidence', title: 'Check the whole payment', action: 'Compare the payment record with the invoice', paragraphs: [
      'Check that the money was actually received and belongs to this invoice. Compare the amount and reference with your checked payment record.',
      'A promise, payment request or screenshot that you have not verified is not enough to say paid in full. Resolve differences before changing the status.',
      'This screen supports paid in full or unpaid. For a deposit or instalment, keep the amounts, dates and balance in a separate supporting record. Do not mark the whole invoice paid.',
    ], check: 'You can explain why the evidence supports full payment, or what remains unresolved.' },
    { id: 'update-payment', title: 'Update the same document', action: 'Has the buyer paid? → Payment received on → Payment method → Save invoice', paragraphs: [
      'Once full payment is checked, choose Yes — paid in full. Check Payment received on and choose the method when known. Keep the original issue date.',
      'Save and read the result. Reopen the same invoice from Saved. Check the paid status, receipt date and method. The invoice number should stay the same.',
      'A sale linked from an existing record keeps its recorded payment details together. If these need correction, resolve that original record rather than making a new invoice.',
    ], check: 'One invoice now carries the checked payment, with no extra sale added.' },
    { id: 'check-book', title: 'Check the money book once', action: 'My Records → Sold → View the related invoice', paragraphs: [
      'Check the related invoice and amount in Sold. Paid invoice income is included in the money book. Do not enter another quick sale for the same payment.',
      'Kilogram lines can provide crop-sale evidence. Bunches and bags keep their own units; the app does not guess their kilograms. Read the units beside the amount.',
      'If the invoice is saved on this device but its crop sale book update is pending, reconnect and save that same invoice again. Keep the source evidence while resolving the message.',
    ], check: 'The money and units still describe the original sale, counted once.' },
    { id: 'inspect-copy', title: 'Inspect the output before sharing', action: 'Saved invoice → Share PDF or Print', paragraphs: [
      'Review the on-screen document first: seller and buyer, both references where relevant, dates, goods, units, prices, total, payment status and banking details.',
      'Share PDF and Print save the current form before producing output. Check your edits first. A paid document shows Invoice total and its Paid stamp; an unpaid document shows Total due.',
      'Share PDF opens a device share sheet where supported, or downloads a PDF. Check the generated copy. If PDF creation reports an error, the invoice may already be saved; follow the message and try Print rather than creating a duplicate.',
    ], check: 'You have inspected the correct document, not merely pressed an export button.' },
    { id: 'share-copy', title: 'Choose the recipient yourself', action: 'Check the copy → Choose the intended recipient', paragraphs: [
      'For a real invoice, check the recipient and attachment before sending through your chosen app. Downloading or printing does not mean the buyer received it.',
      'If the buyer needs another copy, reopen and share the same invoice. Keep a checked copy with the source records.',
      'The complete invoice stays on its original device. Seeing the sale on another device does not prove the full document is there too.',
    ], check: 'You can identify which copy was sent, to whom, and which invoice it belongs to.' },
  ],
  practice: {
    title: 'Only part of the invoice was paid.',
    question: 'The buyer paid a deposit. Which action keeps the record honest?',
    choices: [
      { label: 'Mark the invoice paid in full', feedback: 'A deposit is not full payment. That would hide the amount still owed.', correct: false },
      { label: 'Keep the part payment and balance in a supporting record', feedback: 'Correct. The app has no instalment ledger. Keep the evidence separately and do not mark full payment until it is supported.', correct: true },
      { label: 'Create another sale for the deposit', feedback: 'A deposit towards the existing invoice is not a second sale. Keep it linked in your supporting payment record.', correct: false },
    ],
  },
  limits: { title: 'A paid label is a record, not independent proof', paragraphs: [
    'The app relies on the payment details you enter. It does not check your bank account or establish that a transfer cleared. Keep the evidence that supports your update.',
    'Independent practice: reopen one paid and one unpaid sample invoice. Explain the date and status on each, then identify the document and recipient you would check before sharing. Do not send the examples.',
  ] },
  finish: { title: 'Find the invoice you want to review', text: 'Open Saved, match the reference and compare the payment evidence. Follow the same record through review and sharing.', href: '/invoice', label: 'Open Invoice' },
};

export const EXPORT_GUIDE: AppGuide = {
  id: 'exports', href: '/student/guides/exports', cardTitle: 'Export records and prepare the evidence',
  title: 'Take a checked copy of your records.',
  summary: 'Choose the right period, inspect the file and keep the evidence behind its figures.',
  image: '/studies-guides/expense-record.jpg',
  imageAlt: 'Illustration of a grower checking a notebook and calculator at a homestead table',
  caption: 'Keep the figures beside their evidence · illustrated example',
  prepareTitle: 'Bring the records and their supporting papers',
  prepare: [
    'Have the period you need, your invoices, receipts and payment records ready. First check which farm and account you are using.',
    'Practise with the sample tour. Its figures belong to an example farm. Keep practice files separate from your own records and do not send them to a lender or customer.',
  ],
  steps: [
    { id: 'choose-copy', title: 'Choose what you need to take away', action: 'My Records → Charts or Picked', paragraphs: [
      'Charts can export a CSV: a table that a spreadsheet app can open. It contains dated harvest, sale, paid-invoice and cost rows for its selected period.',
      'Picked has Records for a lender: a PDF summary of the records entered. It is useful for discussing those records. It is not a credit score or loan approval.',
      'Neither file is a complete backup of the app. Keep original invoices, receipt photos and other evidence separately.',
    ], check: 'You know whether you need the row-by-row table, a summary, or both.' },
    { id: 'check-period', title: 'Check the export period', action: 'Charts → Financial sheet → month, season or year', paragraphs: [
      'On a wide screen, the Financial sheet has month, season and year buttons. Export uses that sheet’s choice: the current calendar month, current season or current calendar year.',
      'The app groups seasons as September–November, December–February, March–May and June–August. This is a reporting window, not your own crop’s growing season.',
      'On a phone or compact screen, Export this month (CSV) exports the current calendar month. The chart’s 6m, 12m and 24m buttons do not change that export. Use the wide Financial sheet when you need its other periods.',
    ], check: 'You can name the months the file should include, before exporting.' },
    { id: 'inspect-csv', title: 'Open and check the table', action: 'Export or Export this month (CSV) → Open the downloaded file', paragraphs: [
      'Find and open the file on your device. Check the Date, Description, Qty, In, Source, Out and Check columns. If the file is missing, export again after checking the browser’s download controls. Pressing Export alone does not prove you have a usable copy.',
      'Match a row to its saved invoice, harvest or receipt. Keep its units: a bunch is not a kilogram. A harvest row records produce, not money received. Paid invoices use the recorded payment date; unpaid invoices are not cash income here.',
      'Read any Check warning before adding totals. A possible duplicate needs investigation against its source. If there are no rows, check the period and saved records before concluding that nothing happened.',
    ], check: 'You can trace a row, explain its date and units, and identify any warning.' },
    { id: 'inspect-summary', title: 'Read the summary’s own dates', action: 'Picked → Records for a lender → View summary → Export records for a lender', paragraphs: [
      'View summary shows monthly income, costs and balance. The cash summary covers up to twelve months including the current month, starting no earlier than the first dated sale, paid invoice or cost in your records.',
      'Export records for a lender creates a PDF. Depending on the device, it downloads or opens a share sheet. Save a copy and inspect every page, including the farm name, generation date and Covers dates.',
      'The harvest and sales track record can cover different dates from the monthly cash summary. Read the dates in each section. A blank or zero in these records does not prove that nothing happened outside the app.',
    ], check: 'You can explain which dates each section covers and whose records it shows.' },
    { id: 'collect-evidence', title: 'Keep the evidence and gaps together', action: 'Match the export to the source records', paragraphs: [
      'Keep invoices, receipts and checked payment records beside the exported files. A CSV does not include the original receipt pictures or complete invoice documents.',
      'Write down missing costs, unpaid amounts and records entered late. The harvest and cost forms use the entry date, so keep the original event date in your supporting papers too.',
      'Income minus the costs entered is not complete profit or your bank balance. The app cannot include costs you have not recorded, or check your bank for you. Explain what is missing instead of filling gaps with guesses.',
    ], check: 'Someone helping you can follow the figures to evidence and see what is still unknown.' },
    { id: 'keep-share', title: 'Keep the checked copy, then choose who sees it', action: 'Check the files → Keep a dated copy → Review the intended recipient', paragraphs: [
      'The CSV dates show day and month, without a year. Name your saved copy with the farm and full period, including the year, so it stays clear later. Keep the original exported file unchanged; make a separate working copy if you need to add notes in a spreadsheet.',
      'For real records, check what your bookkeeper or adviser needs and choose the recipient yourself. Review the attachments and private details before sending. Saving or downloading does not send the file to them.',
      'For this practice, stop with your checked sample copy. Explain its limits; do not submit example records as your own.',
    ], check: 'You have a usable copy with its period and sources, and control who receives it.' },
  ],
  practice: {
    title: 'The chart shows twelve months.',
    question: 'On a phone, you choose Export this month (CSV). Which period should you check in the file?',
    choices: [
      { label: 'The twelve months visible in the chart', feedback: 'The chart window and compact-screen export are separate. That button exports the current calendar month.', correct: false },
      { label: 'The current calendar month', feedback: 'Correct. Check the rows and their dates. For the current season or year, use the wide Financial sheet’s period choice and Export.', correct: true },
      { label: 'Every record the farm has ever entered', feedback: 'This is a period export, not a complete backup. Keep the source records and check the file’s actual coverage.', correct: false },
    ],
  },
  limits: { title: 'A clear summary still needs its source records', paragraphs: [
    'The exports summarise entered records. They do not verify payment, certify complete accounts or establish eligibility for finance. Keep the evidence and unresolved questions available for the person helping you.',
    'Independent practice: in the sample tour, compare the CSV period with View summary. Open an exported copy, trace one figure to its source, and name one item the file does not contain. Stop before sharing.',
  ] },
  finish: { title: 'Choose the period you want to check', text: 'Open Charts for the CSV, or switch to Picked for Records for a lender. Start with sample records if you are practising.', href: '/records?tab=charts', label: 'Open My Records' },
};

export const EVIDENCE_GUIDE: AppGuide = {
  id: 'evidence', href: '/student/guides/evidence', cardTitle: 'Keep field evidence and check a report',
  title: 'Keep the report connected to the land.',
  summary: 'Choose the right site, keep the source evidence and check what a saved report actually includes.',
  image: '/studies-guides/sketch-the-site.jpg',
  imageAlt: 'Illustration of two growers checking a site sketch together beside a homestead garden',
  caption: 'Check the site together before trusting the plan · illustrated example',
  prepareTitle: 'Bring observations, dates and original records',
  prepare: [
    'Have the site name, visit notes, photographs and any original test reports ready. Know when and where each record was made. Use only pictures and information you have permission to include.',
    'For practice, open the sample tour and choose Turn site evidence into a report. Its pictures, household interview and soil values are examples. Do not use them as evidence about your own land.',
  ],
  steps: [
    { id: 'right-site', title: 'Start with the correct saved site', action: 'Saved sites & reports → Saved sites → Open site & generate report', paragraphs: [
      'Match the name and map position to the place you intend to describe. Open that site’s report workspace, then open Improve this report.',
      'If the site has not been saved, name it and use Save site before attaching evidence. A familiar name alone is not enough if the map position is wrong.',
      'The checklist shows whether records are present. It does not establish that they are accurate, checked or complete.',
    ], check: 'The report workspace belongs to the place you visited, and you know which evidence is still missing.' },
    { id: 'observations', title: 'Keep observations separate from plans', action: 'Improve this report → Add site photos and Complete or review survey', paragraphs: [
      'Use Add site photos to include clear views of the actual site. Keep the original files with their dates, locations and notes. The app stores smaller copies; it is not your only photo archive.',
      'Review the site and household survey. Write what was observed or reported, and identify what you still need to check. Do not invent an answer to fill a gap.',
      'Review Boundary & measurements, Site design and Planting plan too. A drawn tank, bed or crop can be planned work. Check on the ground before describing it as installed, planted or harvested.',
    ], check: 'You can distinguish a real observation, a planned item and an illustration.' },
    { id: 'test-sources', title: 'Enter the results from their source', action: 'Add soil test results or Add water test results → Results and sampling details → Save test results', paragraphs: [
      'Keep the original laboratory report. The test folder accepts its PDF or a clear photograph, but uploading the file does not make the app read its results automatically.',
      'Enter the sampling date, sample location or ID, laboratory, results, units and relevant method or comments in Results and sampling details. Copy these from the source, then compare them with it before choosing Save test results.',
      'Reopen the same test folder and check the saved entry. A filename alone is not a measured result. Keep missing results unknown. Regional soil and climate layers are context, not a test of your own sample.',
    ], check: 'Every entered result has a source, a unit and a sample you can identify.' },
    { id: 'review-advice', title: 'Review the information before generating', action: 'Improve this report → Review settings and included maps → Generate report', paragraphs: [
      'Check the source records, selected sections, language, wording and depth. Review the maps selected for the report. A map saved on another device may not be available here.',
      'Generate report creates the advice from the available information. Read it against your actual site and records. Investigate conflicts or missing evidence before acting on the advice.',
      'If you add evidence after a report was written, the earlier text stays as it was. Use Generate new report when you need updated advice. Changing the screen, print layout or summary view does not rewrite the full report.',
    ], check: 'You know which information supports the advice, and which questions still need an answer.' },
    { id: 'save-version', title: 'Save a version you can return to', action: 'Save → Check the result → Saved sites & reports → Saved reports', paragraphs: [
      'Choose Save and read the result. If the app says Not saved or reports a storage problem, keep the report open and retain a copy while you resolve it.',
      'Use the report’s Back control to return. In Saved sites & reports, open Saved reports or use Read latest saved report on the site card. Check the site, saved date and text without generating it again.',
      'An older saved report is a snapshot. The current evidence checklist and photographs can be newer than its text. Read those labels and dates before assuming the advice used the latest evidence.',
    ], check: 'You can reopen the intended version and tell what has changed since it was written.' },
    { id: 'inspect-report', title: 'Inspect the copy before sharing', action: 'Export PDF → Open the file → Compare it with the source records', paragraphs: [
      'Choose the view and image options you need. On a phone, open View and print options to find these choices. Then use Export PDF and open the saved file.',
      'Inspect every page: site name, dates, measurements, units, included maps and pictures, source labels and gaps. Check that text and tables are readable. Keep original evidence separately; a report is not a complete backup.',
      'Keep a dated copy. Before sending a real report, check the intended recipient and any household details, faces or precise locations it includes. Downloading a file does not mean anyone else received it.',
    ], check: 'You have inspected the right version, understand its limits and know who should see it.' },
  ],
  practice: {
    title: 'The test PDF has been uploaded.',
    question: 'Does the attached file mean its results are ready for the report to use?',
    choices: [
      { label: 'Yes, every result is read automatically', feedback: 'This test folder stores the file but does not automatically read its contents. You still need to enter and check the relevant results.', correct: false },
      { label: 'Enter and check the results, units and sample details', feedback: 'Correct. Use the original report as the source, save the entered results and reopen the folder to check them.', correct: true },
      { label: 'Use the sample farm’s values for now', feedback: 'The sample values are invented for practice. They say nothing about your land. Leave your unknown results missing until you have evidence.', correct: false },
    ],
  },
  limits: { title: 'Practise the evidence pack, then check the site report', paragraphs: [
    'In the sample farm, change Mentor notes and follow-up to a clearly labelled practice note. Use Save edits, then Download evidence report. Open the file and find that note and the example-picture labels. Stop before sharing.',
    'That practice evidence pack is separate from the full Site Analysis Report. Its prepared pictures are not photographs of the real garden, and its soil values are not laboratory findings. The practice workspace resets on reload; it is not a place to keep real records.',
    'Independent practice: explain one recorded fact, one planned item and one gap. Then save and reopen a sample site report, check its date, and explain why adding a later photo does not prove its earlier advice was updated.',
  ] },
  finish: { title: 'Start with a site you can identify', text: 'Open your saved sites and review the evidence checklist. Use the sample tour first if you are practising.', href: '/reports', label: 'Open saved sites & reports' },
};

export const OFFLINE_GUIDE: AppGuide = {
  id: 'offline-learning', href: '/student/guides/offline-learning', cardTitle: 'Study offline, practise and get guidance',
  title: 'Take your lessons home.',
  summary: 'Save available lessons, check them without a connection and keep learning at your own pace.',
  image: '/studies-guides/sketch-the-site.jpg',
  imageAlt: 'Illustration of two growers studying a site sketch together beside a homestead garden',
  caption: 'Learn together, then practise on your own site · illustrated example',
  prepareTitle: 'Prepare on the device you will use',
  prepare: [
    'Start while connected, with enough data, battery and free storage. Use the same normal browser or installed app that you will take with you. Stay signed in for your own coursework.',
    'Use the sample tour for practice. Its progress is disposable. Do not keep your real course evidence in the sample workspace. Ask your facilitator which module and practical task to work on.',
  ],
  steps: [
    { id: 'choose-pack', title: 'Choose the lessons and language', action: 'My Studies → Open a module, or Study offline', paragraphs: [
      'Open the module you need to find its download control. Study offline offers the available lessons together. It does not unlock modules you have not been given access to.',
      'Check the language shown for the slides and narration. Some translated material is not available yet, so the app may offer English instead. Downloading does not create a missing translation.',
      'Read the download size before starting. Standard uses less data where a higher-quality version is offered. Choose what suits your connection and storage.',
    ], check: 'You know which module, language and download size you are choosing.' },
    { id: 'finish-download', title: 'Wait for the download to finish', action: 'Download → Check for On this phone', paragraphs: [
      'Keep the page open while files arrive. If you need to interrupt the download, use Stop. Files already saved can be used when you finish the download later.',
      'Finish download means some files are still missing. Reconnect and use that button, then check again. A progress bar or a few working slides does not mean the whole module is ready.',
      'Check the module’s own On this phone message. If you downloaded one module, the whole-course control may still show missing files for other modules. Read which pack each message describes.',
    ], check: 'The module you need says On this phone, with no unfinished download for that pack.' },
    { id: 'test-offline', title: 'Try it before leaving signal', action: 'Open the module online → Briefly disconnect → Reopen My Studies', paragraphs: [
      'While still somewhere you can reconnect, open the module once. Then briefly turn off your connection and reopen My Studies in the same browser or app.',
      'Check that a slide picture loads. Open Read this slide and read its text. Choose Play to check the narration. Use Stop when you want to read quietly; Back and Next start narration on the selected slide.',
      'If the page, picture or voice fails, reconnect and check the download and device storage. Resolve the gap before travelling. Repeat this check when you change devices or find that saved files are missing.',
    ], check: 'You have actually reopened the lesson and used its picture, text and voice without a connection.' },
    { id: 'learn-practise', title: 'Read, listen and explain it yourself', action: 'Open a lesson → Read or listen → Try its questions', paragraphs: [
      'The slide presentation and the lesson list are different ways into the topic. Open a named lesson below the slides to find its reading and questions.',
      'Read the feedback after answering. If an idea is unclear, return to the explanation and describe it in your own words. Use the practical task to connect it with your own site.',
      'Downloading a pack does not mark a module done or submit its practical work. Mark done is your progress marker; it is not proof that a facilitator has assessed your work.',
    ], check: 'You can explain the idea and the practical work still needed, rather than only recognising the slide.' },
    { id: 'keep-evidence', title: 'Keep your practical evidence', action: 'Submit this module → Read the task and self-checks', paragraphs: [
      'Read the actual assignment before taking a photograph. Keep the original photo and any notes on your device. Use evidence of your own work, with permission for any people shown.',
      'The submission form requires a photo and offers an optional voice note. Adding a file only prepares it; Submit sends it. Reconnect before submitting and check the result. An error is not confirmation that your facilitator received it.',
      'Resubmit replaces the previous submission’s photo and voice note. Check which version you intend to send and keep your originals. If you need help, show your facilitator the task, your attempt and the question you still have.',
    ], check: 'Your evidence belongs to the task, and you distinguish a prepared file from a confirmed submission.' },
    { id: 'reconnect', title: 'Check what needs a connection', action: 'Reconnect → Read save messages → Offline & sync if needed', paragraphs: [
      'Ask for help on Studies opens Lima. AI chat and AI reports need a connection. A saved lesson can still be read while you wait; keep a note of your question for a facilitator.',
      'For fieldwork, Offline & sync has a separate Prepare fieldwork on this device action. Read its results and open saved designs, crop plans and reports online before relying on them away from signal. A lesson download is not a download of every app page or all your farm records.',
      'Use the same device and normal browser. Clearing site data removes downloads and can remove unsent work. Low storage can also cause the browser to clear saved files. Keep original evidence and check readiness again before your next visit.',
    ], check: 'You know what is ready here, what is still waiting to send and what requires a connection.' },
  ],
  practice: {
    title: 'One slide opens, but files are still missing.',
    question: 'The module says Finish download. Is the whole module ready to take offline?',
    choices: [
      { label: 'Yes, because the first picture loads', feedback: 'A working picture only proves that picture is available. Other slides or narration may still be missing.', correct: false },
      { label: 'Finish the download and test it without a connection', feedback: 'Correct. Check On this phone for that module, then reopen and try its picture, text and narration while briefly disconnected.', correct: true },
      { label: 'Mark the module done to finish the download', feedback: 'Mark done records your progress. It does not download missing files or submit your practical evidence.', correct: false },
    ],
  },
  limits: { title: 'A saved lesson is one part of learning', paragraphs: [
    'Independent practice: choose an available module, explain its size and language, download it and demonstrate its picture, text and voice without a connection. Reconnect afterwards. Name one action that still needs a connection.',
    'These app guides are separate from assessed modules. Reading this guide does not submit coursework. For your real course, check progress and submission messages in your own account; ask a facilitator about assessment and feedback.',
    'The fieldwork queue and money book have separate save systems. No entries in the fieldwork queue does not prove that every financial record has synchronised. Follow the result shown by the feature you used.',
  ], reference: { href: '/offline', label: 'Open Offline & sync' } },
  finish: { title: 'Choose a lesson to take with you', text: 'Open My Studies while connected. Start with one available module and test the saved lesson on this device.', href: '/student', label: 'Open My Studies' },
};

export const APP_GUIDES: readonly AppGuide[] = [START_GUIDE, MAPPING_GUIDE, HARVEST_GUIDE, SALES_GUIDE, EXPENSE_GUIDE, INVOICE_APP_GUIDE, PAPER_SALES_GUIDE, PAYMENT_GUIDE, CHARTS_GUIDE, EXPORT_GUIDE, EVIDENCE_GUIDE, OFFLINE_GUIDE];
