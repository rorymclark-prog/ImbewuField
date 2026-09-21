"""Create the F8 learner pack with source cards and room for independent answers."""
from pathlib import Path
import runpy
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak, Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
v = runpy.run_path(str(HERE / 'verify-f8.py')); v['main']()
p, money = v['P'], v['money']
W, H, M = 595.276, 841.89, 44
CW = W - 2*M
GREEN, INK, LINE = [colors.HexColor(x) for x in ('#315d40','#26352c','#d4d8cd')]
body = ParagraphStyle('body',fontName='Helvetica',fontSize=10.5,leading=14,textColor=INK,spaceAfter=8)
small = ParagraphStyle('small',parent=body,fontSize=9,leading=12)
title = ParagraphStyle('title',fontName='Times-Bold',fontSize=25,leading=28,textColor=GREEN,spaceAfter=12)
cell = ParagraphStyle('cell',parent=small,spaceAfter=0)
story=[]
def para(s,style=body): story.append(Paragraph(s,style))
def lines(n):
 t=Table([[''] for _ in range(n)],colWidths=[CW],rowHeights=[21]*n)
 t.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.4,LINE)])); story.extend([t,Spacer(1,9)])
def table(rows,widths):
 t=Table([[Paragraph(escape(str(c)),cell) for c in row] for row in rows],colWidths=widths)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9eee2')),('LINEBELOW',(0,0),(-1,-1),.4,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
 story.extend([t,Spacer(1,10)])
def page(): story.append(PageBreak())
def decorate(canvas,doc):
 canvas.saveState(); canvas.setFillColor(GREEN); canvas.setFont('Helvetica-Bold',10)
 canvas.drawString(M,H-38,'IMBEWUFIELD / FARM FINANCE / F8'); canvas.setFont('Helvetica',8)
 canvas.drawRightString(W-M,H-38,'ENGLISH REVIEW DRAFT'); canvas.setStrokeColor(LINE); canvas.line(M,43,W-M,43)
 canvas.drawString(M,28,'Invented practice records. Bookkeeping and learner review pending.'); canvas.drawRightString(W-M,28,f'{doc.page} / 5'); canvas.restoreState()

para('Start with a buyer, not a guess.',title)
para('January 2027. Two alternatives each use the same R300 opening cash and eight available owner hours. Do not spend that opening money twice. All prices, quantities, dates and hours are invented exercise inputs, not local recommendations.',small)
story.append(Image(str(REPO/'docs/media/studies-illustrated-release/art/market-community/know-the-customer.jpg'),width=CW,height=CW*941/1672)); story.append(Spacer(1,7))
para('Context illustration: ask about demand, units, quality, delivery and payment.',small)
for q in p['plans']: para(q['marketEvidence'],small)
para('Mark one documented fact, one assumption and one missing answer.'); lines(2)
para('A kg and an item are different units. What can you compare across the two plans?'); lines(2)
page()
para('Can the earlier bills be paid?',title)
para('Start each alternative with R300. A needs six owner hours. B needs ten, in addition to the paid helper. Only eight owner hours are available. No funding is approved. Quote cards below are future payments, not actual costs already paid.',small)
table([['Date','Plan A: produce','Plan B: baskets'], *[[x['date'][8:]+' January',x['evidence'],y['evidence']] for x,y in zip(p['plans'][0]['payments'],p['plans'][1]['payments'])],['30 January','Assume 40 kg x R12 = R480 received.','Assume 20 items x R30 = R600 received.']], [69,219,CW-288])
table([['After this event','A: cash','B: cash'],['Opening','R300.00','R300.00'],['5 January','R ______','R ______'],['10 January','R ______','R ______'],['20 January','R ______','R ______'],['30 January','R ______','R ______']], [CW-200,100,100])
para('Name the first unfunded payment and the deepest gap. Does the higher sales total settle this decision?'); lines(2)
para('<b>Delay:</b> Move A\'s whole R480 receipt to 5 February. What is January closing cash? Does projected sales value change?'); lines(2)
para('<b>Funding:</b> F-ASK is an R180 application with no approval or payment date. Can it fill B\'s gap? What else must be checked?'); lines(2)
page()
para('Keep plan and records apart.',title)
para('These actual records are also invented. Begin with the same R300. The full cash scope has no other movements. Source ACT-C1 independently checks the closing balance. Full profit is not supplied.',small)
a=p['actual']; events=sorted(a['payments']+a['receipts']+a['contributions']+[a['invoice'],a['closingCashEvidence']],key=lambda e:e['date'])
table([['Reference / date','Actual evidence'],*[[e['ref']+' / '+e['date'][5:],e['evidence']] for e in events]], [100,CW-100])
para('Find January sales, buyer receipts, payments, owner funds, closing cash and the amount still owed. Explain which February record stays outside January.'); lines(3)
para('Why is the R20 not a sale? Why does the invoice plus two payments not mean three sales?'); lines(2)
page()
para('Explain the difference.',title)
para('Keep the R500 original closing forecast. Show each adjustment to reach the checked actual R310. Use planned price for the quantity change, then actual quantity for the price change. This explains amounts, not why a buyer or grower acted.',small)
table([['Difference','Calculation / cash effect'],['Quantity','(36 - 40) kg x R12 = R ______'],['Price','36 kg x (R11 - R12) = R ______'],['January amount still owed','R ______'],['Purchase / packaging / transport changes','R ______ / R ______ / R ______'],['Owner contribution','R ______'],['Actual closing cash','R ______']], [196,CW-196])
para('<b>Missing case:</b> ACT-P2\'s amount and ACT-C1\'s closing reconciliation are unavailable. Which totals become unknown? Which sales and customer-balance figures remain supported?'); lines(2)
para('<b>Fresh items case:</b> Plan ten items x R15, R60 payments, R80 opening. Actual eight items x R14; R90 received, R70 paid, R20 owner contribution. No other movements, adjustments or opening customer balances. Find actual sales, amount owed, closing cash and the difference from plan.'); lines(3)
para('Explain the quantity and price effects in the fresh case. Does the cash difference prove a full profit or loss?'); lines(2)
page()
para('A plan someone can check.',title)
para('Use a practice or redacted pack. Link each claim to evidence and mark actual, quoted, assumed or missing. A map, export or application does not establish title, full profit, compliance or funding approval.',small)
table([['Plan section','Evidence / status / next question'],['Purpose and activity',''],['Buyer, units, quality and terms',''],['Site, resources and access',''],['Work, hours and delivery',''],['Costs, exclusions and source dates',''],['Dated cash and funding conditions',''],['Risk, trigger and feasible response',''],['Review date and responsible person','']], [203,CW-203])
para('Choose one original assumption, compare its actual evidence and propose a checked next action. Do not rewrite the original plan.'); lines(3)
para('If a receipt is delayed or a cost is missing, what stops you committing now? What evidence would change that decision?'); lines(3)
para('Practice review date: 10 February 2027. This is an exercise date, not a prescribed interval. Use the relevant actual operating cycle for a real plan.',small)
para('App companions: imbewufield.vercel.app/student/guides/mapping and /student/guides/charts. Retain separate part-payment schedules; the app\'s paid-in-full date does not supply instalment history.',small)
para('Learning sources: FAO Farm Business School (fao.org/4/i2136e/i2136e00.htm) and historic DAFF Agricultural Business Plan Guidelines. Source scope and checked answers accompany this reserve unit.',small)
out=REPO/'output/pdf/finance-f8-workbook.pdf'
SimpleDocTemplate(str(out),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=65,bottomMargin=59,title='ImbewuField F8 - business planning - review workbook',author='ImbewuField').build(story,onFirstPage=decorate,onLaterPages=decorate)
print(out)
