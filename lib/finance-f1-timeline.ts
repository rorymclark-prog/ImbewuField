export type F1Card = {
  id: string;
  day: number;
  kind: string;
  reference: string;
  cashIn: number;
  cashOut: number;
  sale?: number;
  settles?: string;
  principalReceived?: number;
  principalPaid?: number;
  interestPaid?: number;
};

export type F1Position = {
  card: F1Card | null;
  cash: number;
  sales: number;
  buyerOwes: number;
  loanOwes: number;
};

export type F1Practice = { openingCash: number; events: F1Card[] };

// The cards are the source of the practice figures. A receipt linked to an existing
// sale clears its remaining balance; it must never create a second sale.
export function f1Positions(practice: F1Practice): F1Position[] {
  const cards = practice.events;
  const openSales = new Map<string, number>();
  let cash = practice.openingCash;
  let sales = 0;
  let loanOwes = 0;
  const positions: F1Position[] = [{ card: null, cash, sales, buyerOwes: 0, loanOwes }];

  for (const card of cards) {
    cash += card.cashIn - card.cashOut;
    if (card.sale !== undefined) {
      sales += card.sale;
      openSales.set(card.reference, card.sale - card.cashIn);
    }
    if (card.settles) {
      const open = openSales.get(card.settles);
      if (open === undefined || card.cashIn > open) throw new Error(`Invalid F1 settlement ${card.id}`);
      openSales.set(card.settles, open - card.cashIn);
    }
    loanOwes += (card.principalReceived ?? 0) - (card.principalPaid ?? 0);
    positions.push({ card, cash, sales, buyerOwes: [...openSales.values()].reduce((sum, value) => sum + value, 0), loanOwes });
  }
  return positions;
}
