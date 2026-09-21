import type projectData from './course-finance-project.json';

export type FinanceProjectCase = typeof projectData.cases[number];
export type ProjectAnswers = Record<string, string>;
export const PROJECT_NUMBER_QUESTIONS = [
  { id: 'closingGrams', label: 'Harvest left at month end', unit: 'kg', places: 3 },
  { id: 'knownPlannedCosts', label: 'Total of the two included packaging and transport quotes', unit: 'R', places: 2 },
  { id: 'plannedMinimum', label: 'Lowest forecast cash balance, including any gap as a negative number', unit: 'R', places: 2 },
  { id: 'plannedClosing', label: 'Closing cash in the original forecast', unit: 'R', places: 2 },
  { id: 'actualSales', label: 'Value of produce actually delivered and invoiced', unit: 'R', places: 2 },
  { id: 'received', label: 'Payment received from the buyer within this month', unit: 'R', places: 2 },
  { id: 'owed', label: 'Amount the buyer still owes at month end', unit: 'R', places: 2 },
  { id: 'actualClosing', label: 'Actual closing cash after all supplied cash movements', unit: 'R', places: 2 },
  { id: 'cashDifference', label: 'Actual closing cash minus original forecast closing cash', unit: 'R', places: 2 },
] as const;
export const PROJECT_REASONING = [
  { id: 'trail', label: 'Show your evidence trail', prompt: 'Name the order, delivery, invoice and payment references. Explain why they describe one sale. Keep the later payment outside this month. Explain how you would show the unpaid balance without marking the invoice paid in full.' },
  { id: 'plan', label: 'Explain the plan and the shortfall', prompt: 'Keep the original forecast. Identify when cash first falls short and what evidence would be needed before changing the plan. Compare the basket alternative, keeping items and kilograms separate. Check buyer commitment and available work hours.' },
  { id: 'review', label: 'Explain what actually changed', prompt: 'Explain the effects of quantity, payment timing, actual expenses, funding and household withdrawal. A matching closing total does not prove the plan was followed. Name the source of each difference.' },
  { id: 'limits', label: 'Keep the unknowns visible', prompt: 'Explain why the water charge cannot be entered as zero, why closing cash is not full profit, and what evidence is missing. Explain why a mapped plot does not prove land rights or harvest. Classify the funding card as its stated owner contribution or loan, not sales.' },
  { id: 'action', label: 'Write a practical next step', prompt: 'Write one action, the evidence needed, who would obtain it, and a review date. Use classroom roles and dates only. Do not put real customer, household or bank details here.' },
] as const;

export function deriveProject(c: FinanceProjectCase) {
  const knownPlannedCosts = c.plan.payments.reduce((sum, row) => sum + row.amountCents, 0);
  let forecast = c.opening.cashCents;
  const forecastRows = c.plan.payments.map(row => ({ ...row, amountCents: -row.amountCents }));
  forecastRows.push({ reference: c.plan.marketReference, date: c.plan.receiptDate, label: 'Assumed buyer receipt', amountCents: c.plan.quantityGrams * c.plan.pricePerKgCents / 1000 });
  forecastRows.sort((a, b) => a.date.localeCompare(b.date));
  const plannedBalances = forecastRows.map(row => ({ ...row, balance: forecast += row.amountCents }));
  const inPeriod = (date: string) => date >= c.period.start && date <= c.period.end;
  const cashRows = [...c.cashEvents].sort((a, b) => a.date.localeCompare(b.date)).filter(row => inPeriod(row.date));
  let cash = c.opening.cashCents;
  const actualBalances = cashRows.map(row => ({ ...row, balance: cash += row.amountCents }));
  const received = cashRows.filter(row => row.invoiceReference === c.invoice.reference).reduce((sum, row) => sum + row.amountCents, 0);
  const actualSales = c.invoice.quantityGrams * c.invoice.pricePerKgCents / 1000;
  const closingGrams = c.opening.stockGrams + c.harvest.quantityGrams - c.destinations.reduce((sum, row) => sum + row.quantityGrams, 0);
  const bridge = [
    { label: 'Owner contribution or loan received', cents: cashRows.filter(r => r.kind === 'owner contribution' || r.kind === 'loan received').reduce((sum, r) => sum + r.amountCents, 0) },
    { label: 'Household cash withdrawal', cents: cashRows.filter(r => r.kind === 'household withdrawal').reduce((sum, r) => sum + r.amountCents, 0) },
    { label: 'Delivered sales compared with the original sales assumption', cents: actualSales - c.plan.quantityGrams * c.plan.pricePerKgCents / 1000 },
    { label: 'Part of this sale not collected within the month', cents: received - actualSales },
    { label: 'Quoted costs minus actual packaging and transport payments', cents: knownPlannedCosts + cashRows.filter(r => r.kind === 'packaging paid' || r.kind === 'transport paid').reduce((sum, r) => sum + r.amountCents, 0) },
  ];
  return { knownPlannedCosts, plannedMinimum: Math.min(c.opening.cashCents, ...plannedBalances.map(row => row.balance)), plannedClosing: forecast, actualClosing: cash, actualSales, received, owed: c.opening.buyerOwesCents + actualSales - received, closingGrams, cashDifference: cash - forecast, fullProfit: null, actualPaidCosts: knownPlannedCosts - bridge[4].cents, nonSaleFunding: bridge[0].cents, householdWithdrawal: -bridge[1].cents, plannedBalances, actualBalances, bridge };
}

// Whole-input validation matters: parseFloat would accept "40 apples" or silently
// truncate a second decimal separator, awarding a correct answer to an invalid entry.
export function projectNumber(raw: string, places: number): number | null {
  const clean = raw.trim().replace(/^R\s*/i, '').replace('−', '-').replace(',', '.');
  if (!new RegExp(`^-?\\d+(?:\\.\\d{1,${places}})?$`).test(clean)) return null;
  const [whole, fraction = ''] = clean.replace('-', '').split('.');
  const value = (Number(whole) * 10 ** places + Number(fraction.padEnd(places, '0'))) * (clean.startsWith('-') ? -1 : 1);
  return Number.isSafeInteger(value) ? value : null;
}

export function checkProjectAnswers(c: FinanceProjectCase, answers: ProjectAnswers) {
  const result = deriveProject(c);
  return PROJECT_NUMBER_QUESTIONS.map(question => {
    const entered = projectNumber(answers[question.id] ?? '', question.places);
    return { ...question, entered, expected: result[question.id], correct: entered !== null && entered === result[question.id] };
  });
}

export function readProjectDraft(raw: string | null): ProjectAnswers {
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid practice draft');
  const allowed: Set<string> = new Set([...PROJECT_NUMBER_QUESTIONS, ...PROJECT_REASONING].map(q => q.id));
  const answers: ProjectAnswers = {};
  for (const [key, text] of Object.entries(value)) {
    if (!allowed.has(key)) continue;
    // A partly damaged known answer must not look safely restored: the next save
    // would otherwise erase the learner's original text without a recovery choice.
    if (typeof text !== 'string' || text.length > 3000) throw Error(`Invalid saved answer: ${key}`);
    answers[key] = text;
  }
  return answers;
}

/** A stale worksheet view must never overwrite a newer save from another tab. */
export function canSaveProjectDraft(baseline: string | null, current: string | null) {
  return baseline === current;
}

/** A device-only recovery copy; it deliberately contains no account or household identity. */
export function projectDraftText(c: FinanceProjectCase, answers: ProjectAnswers) {
  const questions = [...PROJECT_NUMBER_QUESTIONS, ...PROJECT_REASONING];
  return [
    'IMBEWUFIELD FARM FINANCE PRACTICE',
    'Synthetic classroom case. This is not a farm record, financial advice or a submitted assessment.',
    `Case: ${c.title} (${c.id})`,
    `Practice period: ${c.period.start} to ${c.period.end}`,
    ...questions.map(question => `${question.label}\n${answers[question.id]?.trim() || '[Not yet entered]'}`),
  ].join('\n\n') + '\n';
}

export function projectMoney(cents: number) { return `${cents < 0 ? '−' : ''}R${(Math.abs(cents) / 100).toFixed(2)}`; }

/** Refuse an internally inconsistent classroom case before it can teach a wrong answer. */
export function projectProblems(c: FinanceProjectCase): string[] {
  const problems: string[] = [];
  const need = (condition: boolean, reason: string) => { if (!condition) problems.push(reason); };
  const inside = (date: string) => date >= c.period.start && date <= c.period.end;
  const amounts = [c.opening.cashCents, c.opening.stockGrams, c.opening.buyerOwesCents, c.plan.quantityGrams, c.plan.pricePerKgCents, ...c.plan.payments.map(r => r.amountCents), ...c.alternative.payments.map(r => r.amountCents), c.alternative.quantity, c.alternative.pricePerItemCents, c.harvest.quantityGrams, ...c.destinations.map(r => r.quantityGrams), c.stockCount.quantityGrams, c.invoice.amountCents, c.invoice.quantityGrams, c.invoice.pricePerKgCents, ...c.cashEvents.map(r => r.amountCents), c.laterPayment.amountCents, c.cashCount.amountCents];
  need(amounts.every(Number.isSafeInteger), 'Use exact whole cents and grams in source cards.');
  const refs = [c.opening.reference, c.site.reference, c.plan.version, c.plan.marketReference, ...c.plan.payments.map(r => r.reference), c.alternative.reference, ...c.alternative.payments.map(r => r.reference), c.harvest.reference, ...c.destinations.map(r => r.reference), c.stockCount.reference, c.invoice.reference, c.invoice.orderReference, ...c.cashEvents.map(r => r.reference), c.cashCount.reference, c.laterPayment.reference, c.unknownCost.reference];
  need(new Set(refs).size === refs.length, 'Every source card needs a unique reference.');
  need(c.harvest.plotReference === c.site.reference, 'Link the harvest to its supplied site card.');
  need(c.site.plot.xM >= 0 && c.site.plot.yM >= 0 && c.site.plot.xM + c.site.plot.widthM <= c.site.widthM && c.site.plot.yM + c.site.plot.heightM <= c.site.heightM, 'The practice plot must fit inside the drawn site.');
  need(c.invoice.unit === 'kg' && c.plan.unit === 'kg' && c.alternative.unit === 'item', 'Keep kilograms separate from the alternative item count.');
  need(c.plan.marketStatus === 'enquiry, not an order' && c.alternative.marketStatus === 'enquiry, not an order', 'Do not turn the original enquiry into a confirmed order.');
  const delivery = c.destinations.find(r => r.reference === c.invoice.deliveryReference);
  need(Boolean(delivery && delivery.kind === 'delivered sale' && delivery.quantityGrams === c.invoice.quantityGrams && delivery.date === c.invoice.date), 'Delivery and invoice must describe the same quantity and date.');
  need(inside(c.invoice.orderDate) && c.invoice.orderDate <= c.invoice.date && inside(c.invoice.date), 'Keep the order and delivered sale inside their stated period.');
  need(c.opening.date === c.period.start && c.cashCount.date === c.period.end && c.stockCount.date === c.period.end, 'Opening and counted closing records must use the period boundaries.');
  need(inside(c.harvest.date) && c.destinations.every(r => inside(r.date) && r.date >= c.harvest.date), 'Harvest must precede its in-period destinations.');
  need(c.cashEvents.every(r => inside(r.date)), 'The supplied actual cash table contains only this month.');
  need(c.cashEvents.filter(r => r.kind === 'buyer payment').every(r => r.invoiceReference === c.invoice.reference && r.amountCents > 0), 'A receipt must settle its existing invoice, not create a new sale.');
  need(c.laterPayment.date > c.period.end && c.laterPayment.invoiceReference === c.invoice.reference, 'The later receipt belongs outside this month and to the same invoice.');
  need(c.unknownCost.amountCents === null && c.unknownCost.paid === false, 'Keep the missing unpaid charge unknown, not zero or a fabricated cash movement.');
  const result = deriveProject(c);
  need(result.actualSales === c.invoice.amountCents, 'Invoice amount must equal delivered kilograms times the agreed price.');
  need(result.actualClosing === c.cashCount.amountCents, 'Cash movements must reconcile to the independent counted cash card.');
  need(result.closingGrams === c.stockCount.quantityGrams, 'Harvest destinations must reconcile to the independent stock count.');
  need(result.owed >= 0 && result.owed === c.laterPayment.amountCents, 'The later payment must settle exactly the outstanding amount in this case.');
  need(result.actualBalances.every(r => r.balance >= 0), 'Actual cash cannot contain unfunded negative notes.');
  need(result.bridge.reduce((sum, row) => sum + row.cents, 0) === result.cashDifference, 'Every difference between planned and actual cash must have an explained source.');
  for (const [name, expected] of Object.entries(c.expected)) need(result[name as keyof typeof c.expected] === expected, `Worked answer does not reconcile: ${name}.`);
  return problems;
}
