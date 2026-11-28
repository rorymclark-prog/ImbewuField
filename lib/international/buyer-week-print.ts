export interface BuyerWeekPrint {
  readonly site: string;
  readonly buyer: string;
  readonly crop: string;
  readonly start: string;
  readonly through: string;
  readonly practice: boolean;
  readonly totals: readonly { label: string; value: string }[];
  readonly work: readonly { date: string; bed: string; task: string; basis: string }[];
  readonly entries: readonly { date: string; kind: string; quantity: string; status: string }[];
}

const html = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));

export function buildBuyerWeekPrint(week: BuyerWeekPrint): string {
  const totals = week.totals.map(({ label, value }) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join('');
  const tasks = week.work.map(row => `<tr><td>${html(row.date)}</td><td>${html(row.bed)}</td><td>${html(row.task)}</td><td>${html(row.basis)}</td></tr>`).join('');
  const records = week.entries.map(row => `<tr><td>${html(row.date)}</td><td>${html(row.kind)}</td><td>${html(row.quantity)}</td><td>${html(row.status)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Weekly work and buyer summary</title><style>
@page{size:A4;margin:15mm}*{box-sizing:border-box}
body{margin:0 auto;max-width:850px;padding:24px;font:14px/1.45 system-ui,sans-serif;color:#21302a;background:#fff}
h1,h2,p,dl{margin:0}h1{font-size:25px;line-height:1.18}h2{font-size:16px;margin:24px 0 8px}
header{border-bottom:3px solid #38614c;padding-bottom:14px}header p{margin-top:6px}
dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:6px;margin-top:16px}
dl div{border:1px solid #b6c6bb;padding:7px}dt{font-size:12px}dd{margin:2px 0 0;font-weight:700}
table{width:100%;border-collapse:collapse;overflow-wrap:anywhere}thead{display:table-header-group}
th,td{border-bottom:1px solid #b6c6bb;padding:7px;text-align:left;vertical-align:top}
tr{break-inside:avoid}small{display:block;margin-top:16px} @media print{body{padding:0}}
</style></head><body><header><h1>Weekly work and buyer summary</h1><p>${html(week.site)} · ${html(week.start)} to ${html(week.through)}</p>
<p>${html(week.buyer)} · ${html(week.crop)}${week.practice ? ' · Fictional practice records' : ''}</p></header>
<dl>${totals}</dl><h2>Work on the mapped beds</h2>${tasks
    ? `<table><thead><tr><th>Date</th><th>Bed</th><th>Work</th><th>Basis</th></tr></thead><tbody>${tasks}</tbody></table>`
    : '<p>No checked work dates in this period.</p>'}
<h2>Buyer entries</h2>${records
    ? `<table><thead><tr><th>Date</th><th>Entry</th><th>Quantity</th><th>Evidence</th></tr></thead><tbody>${records}</tbody></table>`
    : '<p>No buyer entries are recorded for this week.</p>'}
<small>Harvested quantity is the linked crop subtotal in this garden. Delivery completeness is unknown.</small></body></html>`;
}
