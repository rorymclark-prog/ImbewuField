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
