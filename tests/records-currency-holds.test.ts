import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React, { createElement, useState, useEffect, useMemo, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { formatInvoiceZar } from '../lib/invoice-document.ts';
import * as invoiceSales from '../lib/invoice-sales.ts';
import * as currency from '../lib/invoice-currency.ts';
import * as formatting from '../lib/international/locales/formatting.ts';
import * as records from '../lib/farm-records.ts';
import { buildFarmMetrics, isInFinancePeriod } from '../lib/farm-metrics.ts';
import { buildFinanceSeries } from '../lib/finance-series.ts';
import * as credit from '../lib/credit-pack.ts';
import { suspectedDuplicateIncomeIds, DUPLICATE_ROW_NOTE, DUPLICATE_LEDGER_FOOTER } from '../lib/duplicate-income.ts';
import { randCentsLabel } from '../lib/format-figures.ts';
import { recordsDate } from '../lib/records-months.ts';
import type { SavedInvoice } from '../lib/invoices.ts';
import type { SalesLog, ExpenseLog, ProductionLog } from '../lib/db/types.ts';

const now = new Date();
const iso = new Date(now.getFullYear(), now.getMonth(), 2, 12).toISOString();
const sale: SalesLog = { id:'sale-a', profile_id:'fixture', garden_id:null, crop:'Line A', kg:2, amount:10, buyer:'Buyer', sold_at:iso, created_at:iso };
const cost: ExpenseLog = { id:'cost-a', profile_id:'fixture', garden_id:null, item:'Cost A', amount:4, supplier:null, spent_at:iso, created_at:iso };
const produce: ProductionLog = { id:'produce-a', profile_id:'fixture', garden_id:null, crop:'Line A', kg:3, photo_url:null, logged_at:iso, created_at:iso };
const invoice = (extra: Partial<SavedInvoice> & {currencyCode?: unknown} = {}): SavedInvoice & {currencyCode?:unknown} => ({
 id:'invoice-a', no:1, billTo:'Buyer', items:[{desc:'Line A', qty:2, unit:'kg', price:20}], total:40, dateISO:iso, paidAt:iso, status:'paid', ...extra,
});
const source = (path:string) => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const pageTree=ts.createSourceFile('page.tsx',source('app/records/page.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const myTree=ts.createSourceFile('MyRecords.tsx',source('components/MyRecords.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const icon=()=>createElement('i');
const identity=(_lang:string,text:string)=>text;
let download: Blob | undefined;
const scope:Record<string,unknown>={
 React,useState,useEffect,useMemo,useRef,...invoiceSales,...currency,...formatting,...records,...credit,
 formatInvoiceZar,buildFarmMetrics,isInFinancePeriod,randCentsLabel,recordsDate,
 suspectedDuplicateIncomeIds,DUPLICATE_ROW_NOTE,DUPLICATE_LEDGER_FOOTER,
 useLanguage:()=>({lang:'en'}),useRecordsT:()=>({lang:'en',t:(key:string)=>key}),
 recordsFill:identity,recordsPaired:identity,recordsUi:identity,recordsUiZuFirst:identity,
 recordsQuantityLabel:(row:SalesLog)=>`${records.recordQuantity(row)} ${records.recordUnit(row)}`,
 recordsTemplate:(_lang:string,en:string,_zu:string,values:Record<string,unknown>)=>en.replace(/\{(\w+)\}/g,(_,key)=>String(values[key])),
 DEFAULT_INCLUDE_PERENNIALS:true,loadIncludePerennials:()=>true,countsWithScope:()=>true,produceDisplayName:(name:string)=>name,
 RecordQuantitySummary:({totals}:{totals:Array<{unit:string;quantity:number}>})=>createElement('span',null,totals.map(row=>`${row.quantity} ${row.unit}`).join(', ')),
 CropIcon:icon,ReceiptPreview:()=>null,RecordZuluDraft:({english}:{english:string})=>english,
 Link:({children,href}:{children:React.ReactNode;href:string})=>createElement('a',{href},children),
 styles:{},isSampleMode:()=>false,loadInvoices:()=>[],harvestCropLabel:(name:string)=>name,
 paymentMethodLabel:(value:string)=>value,
 URL:{createObjectURL:(blob:Blob)=>{download=blob;return 'blob:fixture';},revokeObjectURL:()=>{}},
 document:{createElement:()=>({click:()=>{}})},
 buildCreditPackPdf:()=>{throw new Error('held export must not reach builder');},
 buildCreditPackPreviewPdf:()=>{throw new Error('held export must not reach builder');},
 CreditPackSampleModeError:class extends Error{},CreditPackCurrencyHeldError:class extends Error{},
};
for(const name of ['TrendingUp','Scale','Receipt','Plus','Sprout','FileText','Download','Camera','Loader2','Pencil','Trash2','Sparkles','BarChart3','Eye','Upload','X','Landmark','Banknote'])scope[name]=icon;

// Compile the real local helpers and components. Framework navigation, decorative
// child widgets and download transport are bounded above; money/period/quantity
// builders and the actual row/CSV/UI branches remain real.
function selected(tree:ts.SourceFile,names:string[]):string {
 return tree.statements.filter(node=>ts.isFunctionDeclaration(node)?names.includes(node.name?.text??''):ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&names.includes(d.name.text))).map(n=>n.getText(tree)).join('\n');
}
const pageNames=['fmtZAR','nullableRand','CurrencyReviewNotice','invoiceMoneyLabel','fmtDate','isThisMonth','categoryLabel','recordsText','recordsInstruction','Skeleton','useIncludePerennials','scopeKg','SummaryCards','SimpleMoneySummary','RecordDocument','toPhoneRows','SalesLedger','buildLedgerRows','filterLedgerRows','csvLang','exportLedgerCsv','FinancialSheet','metricNumber','FarmMetrics'];
const myNames=['Card','CreditPackCard','SalesList'];
const code=ts.transpileModule(selected(pageTree,pageNames)+'\n'+selected(myTree,myNames)+'\nreturn {'+[...pageNames,...myNames].join(',')+'};',{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const actual=new Function('scope',`with(scope){${code}}`)(scope) as Record<string,any>;
const render=(name:string,props:Record<string,unknown>)=>renderToStaticMarkup(createElement(actual[name],props));
const props=(invoices:SavedInvoice[])=>({sales:[sale],expenses:[cost],production:[produce],invoices,loading:false});
const sheetProps=(invoices:SavedInvoice[])=>({...props(invoices),name:'Fixture',period:'month',setPeriod:()=>{},onAddEntry:()=>{},onEditSale:()=>{},onEditExpense:()=>{},onLogHarvest:()=>{}});
const text=(html:string)=>html.replace(/<[^>]*>/g,'').replace(/\u00a0/g,' ');

test('summary and desktop sheet show a currency hold instead of a partial Rand income/margin, while retaining costs and produce',()=>{
 for(const name of ['SummaryCards','FinancialSheet']) {
  const html=text(render(name,name==='FinancialSheet'?sheetProps([invoice({currencyCode:'USD'})]):props([invoice({currencyCode:'USD'})])));
  assert.ok(html.includes('Unavailable'));
  assert.ok(html.includes('No exchange conversion is assumed'));
  assert.ok(html.includes('R4,00'),'the cost record remains visible');
  assert.ok(!html.includes('R50,00'),'10 Rand plus 40 USD must not look like Rand income');
  assert.ok(!html.includes('R46,00'),'no mixed-currency net');
  assert.ok(html.includes('3 kg'),'physical harvest evidence remains visible');
 }
});

test('legacy and recorded ZAR keep the ready cash totals, and deduplication uses invoices outside the chosen month too',()=>{
 for(const marker of [{},{currencyCode:'ZAR'}]) {
  const html=text(render('FinancialSheet',sheetProps([invoice(marker)])));
  assert.ok(html.includes('R50,00'));
  assert.ok(html.includes('R46,00'));
  assert.ok(!html.includes('No exchange conversion'));
 }
 const old = invoice({id:'old-invoice',paidAt:'2020-01-01T12:00:00Z',dateISO:'2020-01-01T12:00:00Z'});
 const linked={...sale,invoice_id:old.id};
 const html=text(render('SummaryCards',{...props([old]),sales:[linked]}));
 assert.ok(html.includes('R0,00'),'an invoice-linked quantity row is not fresh cash just because its invoice is outside this month');
 assert.ok(!html.includes('R10,00'));
});

test('undated paid foreign or malformed metadata holds the period; unpaid or conclusively older foreign invoices do not',()=>{
 for(const marker of [{currencyCode:'KES'},{currencyCode:undefined}]) {
  const held=invoice({...marker,paidAt:undefined});
  for(const name of ['SummaryCards','FinancialSheet']) {
   const html=text(render(name,name==='FinancialSheet'?sheetProps([held]):props([held])));
   assert.ok(html.includes('Unavailable'));
   assert.ok(html.includes('lack a usable date'));
  }
 }
 for(const foreign of [invoice({currencyCode:'USD',status:'unpaid'}),invoice({currencyCode:'USD',paidAt:'2020-01-01T00:00:00Z'})]) {
  assert.ok(!text(render('FinancialSheet',sheetProps([foreign]))).includes('No exchange conversion'));
 }
});

test('actual phone and desktop invoice rows preserve denomination, quantity and original identity without making foreign Rand inAmt',()=>{
 for(const code of ['ZAR','KES','GBP','USD','EUR','BRL']) {
  const inv=invoice({currencyCode:code});
  const phone=actual.toPhoneRows([],[],[inv]);
  const rows=actual.buildLedgerRows([],[],[],[inv],'month',now);
  assert.equal(phone[0].id,inv.id);assert.equal(rows[0].id,inv.id);
  assert.ok(phone[0].moneyLabel.includes(code));assert.ok(rows[0].inLabel.includes(code));
  assert.ok(rows[0].qty.includes('2 kg'));
  assert.equal(rows[0].inAmt,code==='ZAR'?40:null);
  const html=text(render('SalesLedger',{...props([inv]),sales:[],expenses:[],onEditSale:()=>{},onEditExpense:()=>{},onDeleteSale:()=>{},onDeleteExpense:()=>{}}));
  assert.ok(html.includes(`${code} 40.00`));assert.ok(!html.includes('R40,00'));
 }
 const malformed=invoice({currencyCode:undefined});
 assert.equal(actual.toPhoneRows([],[],[malformed])[0].moneyLabel,'Currency unavailable');
 assert.equal(actual.buildLedgerRows([],[],[],[malformed],'month',now)[0].inAmt,null);
});

test('downloaded CSV retains each invoice currency and original produce, with a visible period hold including omitted undated gaps',async()=>{
 const inv=invoice({currencyCode:'BRL'});
 const undated=invoice({id:'undated',currencyCode:'USD',paidAt:undefined});
 const rows=actual.buildLedgerRows([sale],[cost],[produce],[inv,undated],'month',now);
 const review=invoiceSales.reviewInvoiceRandPeriod([inv,undated],{status:'paid',dateField:'paidAt',inPeriod:date=>isInFinancePeriod(date,'month',now)});
 actual.exportLedgerCsv(rows,'month','en',review);
 assert.ok(download);
 const csv=await download.text();
 assert.ok(csv.includes('BRL 40.00'));
 assert.ok(csv.includes('2 kg'));
 assert.ok(csv.includes('Unavailable'));
 assert.ok(csv.includes('lack a usable date'));
 assert.ok(!csv.includes('R40,00'));
});

test('simple money headline suppresses a held net, retaining the independently recorded expenses',()=>{
 const series=buildFinanceSeries([produce],[sale],[cost],[invoice({currencyCode:'EUR'})],now,12);
 const html=text(render('SimpleMoneySummary',{series,lang:'en'}));
 assert.ok(html.includes('Unavailable'));
 assert.ok(html.includes('R4,00'));
 assert.ok(!html.includes('You kept'));
 assert.ok(!html.includes('R46,00'));
});

test('crop/orchard/garden money is unavailable under review while physical production survives',()=>{
 const html=text(render('FarmMetrics',{...props([invoice({currencyCode:'USD'})]),period:'month',now,plantings:[],beds:[],planLoaded:true}));
 assert.ok(html.includes('No exchange conversion is assumed'));
 assert.ok(html.includes('Unavailable'));
 assert.ok(!html.includes('R40,00'));
 assert.ok(html.includes('Yield'));
});

test('lender card visibly holds income and disables export while keeping costs and harvest evidence',()=>{
 const html=render('CreditPackCard',{...props([invoice({currencyCode:'USD'})]),profile:null});
 assert.ok(text(html).includes('Unavailable'));
 assert.ok(text(html).includes('No exchange conversion is assumed'));
 assert.ok(text(html).includes('R4,00'));
 assert.match(html,/<button[^>]*disabled=""[^>]*>[\s\S]*?Export records for a lender/);
});

test('invoice-linked crop rows never relabel retained old foreign amount fields as Rand',()=>{
 const inv=invoice({currencyCode:'USD'});
 const html=text(render('SalesList',{items:[{...sale,invoice_id:inv.id,amount:40}],invoices:[inv]}));
 assert.ok(html.includes('USD · See invoice'));
 assert.ok(html.includes('2 kg'));
 assert.ok(!html.includes('R 40.00'));
});


test('My Records actual sales summary withdraws its cash sparkline and total on a held currency basis',()=>{
 const expressions:ts.CallExpression[]=[];
 function visit(node:ts.Node):void {
  if(ts.isCallExpression(node) && ts.isParenthesizedExpression(node.expression) && ts.isArrowFunction(node.expression.expression) && node.getText(myTree).includes('const totalRev = cashIncomeTotal(sales, invoices);')) expressions.push(node);
  ts.forEachChild(node,visit);
 }
 visit(myTree);const expression=expressions[0];assert.ok(expression,'the actual sales-summary closure must be exercised');
 const js=ts.transpileModule('return ('+expression.getText(myTree)+');',{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 function Summary({invoices}:{invoices:SavedInvoice[]}) {
  return new Function('scope',`with(scope){${js}}`)({...scope,Card:actual.Card,sales:[sale],invoices,inScope:()=>true,lang:'en',t:(key:string)=>key});
 }
 const held=renderToStaticMarkup(createElement(Summary,{invoices:[invoice({currencyCode:'USD'})]}));
 assert.ok(text(held).includes('Unavailable'));
 assert.ok(text(held).includes('No exchange conversion is assumed'));
 assert.ok(!held.includes('<polyline'),'no partial cash sparkline is presented as the held total');
 const ready=renderToStaticMarkup(createElement(Summary,{invoices:[invoice()]}));
 assert.ok(text(ready).includes('R50'));
 assert.ok(ready.includes('<polyline'));
});
