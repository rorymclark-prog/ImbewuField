"""Build the five-page learner workbook from F3's checked source cards.

Printed amounts come from the exercise pack. Answers remain in the facilitator
draft, preserving an independent attempt instead of a filled-in demonstration.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import json
import subprocess
import sys

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak, Image

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[3]
subprocess.run([sys.executable,str(ROOT/'verify-f3.py')],check=True)
PACK=json.loads((ROOT/'f3-practice.json').read_text())
OUT=REPO/'output/pdf/finance-f3-workbook.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
W,H,M=595.276,841.890,44
CW=W-2*M
GREEN=colors.HexColor('#284f38');INK=colors.HexColor('#26352c')
MUTED=colors.HexColor('#626a5f');LINE=colors.HexColor('#d4d8cd');PALE=colors.HexColor('#f0f4ea')
BODY=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=15,textColor=INK,spaceAfter=9)
SMALL=ParagraphStyle('small',parent=BODY,fontSize=9,leading=12,textColor=MUTED,spaceAfter=8)
TITLE=ParagraphStyle('title',fontName='Times-Bold',fontSize=26,leading=29,textColor=GREEN,spaceAfter=8)
HEAD=ParagraphStyle('head',parent=BODY,fontName='Helvetica-Bold',textColor=GREEN,spaceBefore=8,spaceAfter=9)
CELL=ParagraphStyle('cell',parent=BODY,fontSize=10,leading=13,spaceAfter=0)
CELLHEAD=ParagraphStyle('cellhead',parent=CELL,fontName='Helvetica-Bold',textColor=GREEN)
STORY=[]


def rand(cents): return f'R{cents//100:,}.{cents%100:02}'
def kg(g): return f'{g/1000:g}'
def para(text,style=BODY): STORY.append(Paragraph(text,style))


def title(name,subtitle):
    para(name,TITLE);para(subtitle,SMALL);STORY.append(Spacer(1,6))


def table(rows,widths,heights=None):
    assert abs(sum(widths)-CW)<.1
    t=Table([[Paragraph(escape(str(v)),CELLHEAD if i==0 else CELL) for v in row] for i,row in enumerate(rows)],colWidths=widths,rowHeights=heights,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,0),1,GREEN),
        ('LINEBELOW',(0,1),(-1,-1),.4,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
    ]));STORY.append(t);STORY.append(Spacer(1,12))


def lines(count=2):
    t=Table([[''] for _ in range(count)],colWidths=[CW],rowHeights=[23]*count)
    t.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.4,LINE)]));STORY.append(t);STORY.append(Spacer(1,10))


def page(): STORY.append(PageBreak())


def decorate(c,doc):
    c.saveState();c.setFillColor(GREEN);c.setFont('Helvetica-Bold',10)
    c.drawString(M,H-38,'IMBEWUFIELD / FARM FINANCE / F3')
    c.setFillColor(MUTED);c.setFont('Helvetica',8)
    c.drawRightString(W-M,H-38,'ENGLISH REVIEW DRAFT')
    c.setStrokeColor(LINE);c.line(M,43,W-M,43)
    c.drawString(M,28,'Practice only. Invented values. Bookkeeping and learner review pending.')
    c.drawRightString(W-M,28,f'{doc.page} / 5');c.restoreState()


a=PACK['allocation'];b=PACK['breakEven'];c=PACK['buyers'];transfer=PACK['transfer']
title('Share one cost once','Exercise A / Choose a product, a period and a reason for dividing each shared bill.')
intro=Paragraph('All amounts and work records are invented for practice. They are not local prices or recommended wages. Each bill below belongs to practice cycle A. All listed cash bills were paid in this cycle.',BODY)
hero=Image(str(REPO/'public/course-images/market-community/market-community-l1.jpg'),width=171,height=96)
intro_table=Table([[intro,hero]],colWidths=[CW-184,184]);intro_table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),10)]));STORY.append(intro_table)
para('Illustrated context only; the cards supply the exercise evidence.',SMALL)
rows=[['Source card','Allocation evidence','Carrots','Second crop']]
for r in a['direct']:
    product='Carrots' if r['product']=='carrots' else 'Second crop'
    rows.append([f"{r['id']} / {r['label']}\n{rand(r['cents'])}",f'{product} only','R ______','R ______'])
for r in a['shared']:
    rows.append([f"{r['id']} / {r['label']}\n{rand(r['cents'])}",f"{r['basis']}:\ncarrots {r['units']['carrots']}; other {r['units']['second-crop']}",'R ______','R ______'])
table(rows,[155,177,87,CW-419])
para('<b>Add assigned paid costs:</b> carrots R __________; second crop R __________.<br/>Combined R __________. Does that equal the total of the six source cards?')
para('Explain why the hire bill and market trip use different allocation records. What would you do if a usage record were missing?')
lines(2);page()

title('Name the unit and the costs','Exercise A continued / A marketable kilogram and a kilogram sold are different quantities.')
para(f"Carry forward the two assigned cash totals from page 1. Family members were not paid for the work below. For this exercise only, compare their time at <b>{rand(a['familyComparisonCentsPerHour'])}/hour</b>. This is not a wage recommendation.")
table([
    ['Product','Unpaid hours','Time comparison value','Cash actually paid'],
    ['Carrots',a['familyHours']['carrots'],'R __________',rand(a['familyCashPaid'])],
    ['Second crop',a['familyHours']['second-crop'],'R __________',rand(a['familyCashPaid'])],
],[122,88,167,CW-377])
para('<b>Carrot costs including this time comparison:</b> R __________.<br/>Explain why this amount is not another cash payment.');lines(1)
para(f"The practice carrot batch has <b>{kg(a['carrotMarketableGrams'])} kg marketable</b>. Only <b>{kg(a['carrotExpectedSoldGrams'])} kg is expected to sell</b>. No area or yield prediction is supplied.")
table([
    ['Calculation','Quantity to divide by','Your result'],
    ['Assigned paid carrot costs per marketable kg',f"{kg(a['carrotMarketableGrams'])} kg",'R ______ / kg'],
    ['With time comparison per marketable kg',f"{kg(a['carrotMarketableGrams'])} kg",'R ______ / kg'],
    ['Recover those included costs through expected sales',f"{kg(a['carrotExpectedSoldGrams'])} kg",'R ______ / kg sold'],
],[260,133,CW-393])
para('The last answer is a sales-recovery target for this budget, not inventory valuation or a guaranteed buyer price. Explain what you still need to know about the produce that has not sold.');lines(2)
para('<b>Missing for full profit:</b> land, owned-equipment use, general administration, finance costs and tax. Name one missing source you would seek.');lines(1);page()

title('Can the plan break even?','Exercise B / A separate model: do not carry forward the carrot budget.')
para('Each unit is one 1 kg pack prepared <b>and sold</b>. All packs prepared are sold in this model. Price and variable cost stay constant; included fixed costs do not change within the stated capacity. No unsold-stock or tax calculation is supplied.',SMALL)
table([
    ['Model input','Supplied practice value'],
    ['Included fixed costs for this cycle',rand(b['fixedCents'])],
    ['Included variable cost per pack',rand(b['variableCentsPerUnit'])],
    ['Selling price per pack',rand(b['priceCentsPerUnit'])],
    ['Capacity',f"{b['capacityUnits']} whole packs"],
],[320,CW-320])
para('<b>1.</b> Price minus variable cost = contribution per pack: R __________.<br/><b>2.</b> Fixed costs divided by contribution = __________ packs.<br/><b>3.</b> Round up to whole packs: __________. Is that within capacity? __________.')
para('Check by multiplying. Result = sales value minus variable costs minus fixed costs.',SMALL)
table([
    ['Packs prepared and sold','Sales value','Total variable cost','Model result'],
    *[[q,'R ______','R ______','R ______'] for q in [23,24,b['expectedSalesUnits'],b['cases'][0]['expectedSalesUnits']]],
],[153,113,127,CW-393])
para(f"<b>What changes?</b> If capacity is only {b['cases'][1]['capacityUnits']} packs, can the original break-even sales be achieved? If price falls to {rand(b['cases'][2]['priceCentsPerUnit'])}, will selling more cover the positive fixed costs?");lines(2)
para('If the variable-cost card is missing, write what is unknown. Do not enter zero. These results cover only the stated model, not full farm profit.',SMALL);lines(1);page()

title('Compare the whole offer','Exercise C / Choose one buyer for the same produce. The offers are alternatives.')
offers=c['offers'];oa,ob=offers
para(f"Both buyers accept the same <b>{kg(c['quantityGrams'])} kg</b> of the same quality. Common costs already incurred are <b>{rand(c['commonIncurredCents'])}</b>. Extra selling work below is unpaid; its separate comparison value is {rand(c['familyComparisonCentsPerHour'])}/hour.")
table([
    ['Offer terms',oa['buyer'],ob['buyer']],
    ['Price per kg',rand(oa['priceCentsPerKg']),rand(ob['priceCentsPerKg'])],
    ['Extra delivery paid by grower',rand(oa['deliveryCents']),rand(ob['deliveryCents'])],
    ['Extra packaging paid by grower',rand(oa['packagingCents']),rand(ob['packagingCents'])],
    ['Additional family selling hours',oa['additionalFamilyHours'],ob['additionalFamilyHours']],
    ['Payment promised',f"Day {oa['paymentDay']} (today)",f"Day {ob['paymentDay']}"],
],[251,128,CW-379])
table([
    ['Calculate for each offer',oa['id'],ob['id']],
    ['Sales value','R __________','R __________'],
    ['Less extra delivery and packaging','R __________','R __________'],
    ['Left after those cash costs','R __________','R __________'],
    ['Left after the common cost as well','R __________','R __________'],
    ['Additional family-time comparison','R __________','R __________'],
    ['Left after that time value as well','R __________','R __________'],
],[251,128,CW-379])
para('Which offer does this evidence favour, and why? Name a fact you would confirm before agreeing. A payment promise is not cash received.');lines(2)
para('These are partial management comparisons, not full profit. Do not record both alternative offers as completed sales.',SMALL);page()

title('Try a fresh set of decisions','Independent attempt / Explain the answer. You may use a calculator or answer aloud.')
t=transfer['allocation']
para(f"<b>1 / Share a bill.</b> A {rand(t['poolCents'])} hire bill served one activity for {t['hours']['one']} hour and another for {t['hours']['two']} hours. Divide it. Show that the shares still equal the original bill.");lines(2)
t=transfer['breakEven']
para(f"<b>2 / Check capacity.</b> Fixed costs {rand(t['fixedCents'])}; price {rand(t['priceCentsPerUnit'])}/pack; variable cost {rand(t['variableCentsPerUnit'])}/pack; capacity {t['capacityUnits']} packs. Use Exercise B's assumptions. Find break-even packs and the result at capacity. What prevents the plan from reaching break-even?");lines(2)
t=transfer['markup']
para(f"<b>3 / Name the denominator.</b> Included cost {rand(t['includedCostCents'])}; selling price {rand(t['sellingPriceCents'])}. Find the difference, markup on cost and margin on selling price. Explain why they are not the same percentage.");lines(2)
t=transfer['buyers']
para(f"<b>4 / Leave the unknown visible.</b> For the same {kg(t['quantityGrams'])} kg, one buyer collects at {rand(t['collectionCentsPerKg'])}/kg. Another offers {rand(t['deliveryCentsPerKg'])}/kg but delivery cost is missing. At what delivery charge do the cash results tie? Can you rank them yet?");lines(2)
para('<b>5 / Transfer to your own evidence.</b> A buyer quotes per crate but gives no weight. What must you check before comparing a per-kg offer? Name one dated source you would bring to a future price discussion.');lines(1)
para('After feedback, try a new example. Companion guides: imbewufield.vercel.app/student/guides/expenses and /student/guides/invoices. Forecasts and alternative offers stay in the workbook, not actual sales records.',SMALL)

doc=SimpleDocTemplate(str(OUT),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=64,bottomMargin=59,
    title='ImbewuField - F3 learner workbook - review draft',author='ImbewuField',pageCompression=1)
doc.build(STORY,onFirstPage=decorate,onLaterPages=decorate)
print(OUT)
