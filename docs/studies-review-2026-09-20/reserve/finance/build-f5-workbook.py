"""Render original F5 learner cards from the independently checked event pack."""
from pathlib import Path
import json,runpy
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Table,TableStyle,Spacer,PageBreak
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3]
v=runpy.run_path(str(HERE/'verify-f5.py'));v['main']();p=v['P'];money=v['money']
W,H,M=595.276,841.89,44;CW=W-2*M
GREEN=colors.HexColor('#315d40');INK=colors.HexColor('#26352c');LINE=colors.HexColor('#d4d8cd')
body=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=15,textColor=INK,spaceAfter=9)
small=ParagraphStyle('small',parent=body,fontSize=9,leading=12)
title=ParagraphStyle('title',fontName='Times-Bold',fontSize=26,leading=29,textColor=GREEN,spaceAfter=12)
cell=ParagraphStyle('cell',parent=body,fontSize=9.5,leading=12,spaceAfter=0)
story=[]
def para(t,s=body):story.append(Paragraph(t,s))
def lines(n):
 t=Table([[''] for _ in range(n)],colWidths=[CW],rowHeights=[23]*n);t.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.4,LINE)]));story.extend([t,Spacer(1,12)])
def table(rows,widths):
 t=Table([[Paragraph(escape(str(c)),cell) for c in row] for row in rows],colWidths=widths)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9eee2')),('LINEBELOW',(0,0),(-1,-1),.4,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.extend([t,Spacer(1,12)])
def page():story.append(PageBreak())
def decorate(c,d):
 c.saveState();c.setFillColor(GREEN);c.setFont('Helvetica-Bold',10);c.drawString(M,H-38,'IMBEWUFIELD / FARM FINANCE / F5');c.setFont('Helvetica',8);c.drawRightString(W-M,H-38,'ENGLISH REVIEW DRAFT');c.setStrokeColor(LINE);c.line(M,43,W-M,43);c.drawString(M,28,'Invented classroom inputs. Bookkeeping and learner review pending.');c.drawRightString(W-M,28,f'{d.page} / 4');c.restoreState()
para('One sale, an evidence trail',title)
para('Every amount and day in this workbook is invented. Each case starts separately with zero opening balances. No tax, fees or costs are supplied. These exercises do not establish profit or tax-invoice compliance.',small)
para('<b>P01 / Follow the documents.</b> Calculate cumulative money received and the recorded amount still owed after each event. A copy is the same invoice.')
table([['Day / reference','What happened','Received so far','Still owed'],['1 / O01','Order agreed: R120.00','R ______','Not invoiced'],['2 / D01-I01','Delivered and invoiced: R120.00','R ______','R ______'],['3 / R01-A','Receipt: R40.00','R ______','R ______'],['4 / I01-COPY','Copy of the same invoice','R ______','R ______'],['5 / R01-B','Another receipt: R80.00','R ______','R ______']],[92,217,100,CW-409])
para('Which document records delivery? Which proves money arrived? Why does the copy not increase sales?');lines(3)
para('<b>M01 / Keep the units.</b> Calculate 2.5 kg at R12.00 per kg, and 3 bunches at R8.00 per bunch. Add the money. Can you state a combined mass from these facts?');lines(3)
para('Explain aloud, sort cards or use a calculator. Keep private customer and bank details out of the exercise.',small);page()
para('Find the record before adding',title)
para('Practise in the sample tour, not your own farm. Identify the source before entering details. Changing Invoice type or Existing sale record starts a fresh form in the current app.')
table([['Situation','Your first action / route'],['An invoice is already saved','________________________________'],['An eligible sale exists without an invoice','________________________________'],['Produce already sold, not yet recorded','________________________________'],['A paper invoice; unsure whether its sale is recorded','________________________________']],[250,CW-250])
para('<b>Check before saving.</b> Buyer, product, quantity, original unit, agreed price, total, relevant dates and payment evidence. A suggested price is not the buyer\'s agreement. Never invent a bag-to-kilogram conversion.')
para('<b>Check after saving.</b> Read the save message. Reopen the same number and check its total and status. A pending update is not a reason to make a duplicate. A synchronised crop-sale row is not a backup of every device-local invoice detail.')
para('<b>Decision:</b> Invoice R120.00; buyer has paid R40.00. Explain why neither “paid in full” nor a new R40.00 produce sale describes the facts.');lines(3)
para('<b>Document copy:</b> A buyer requests another copy. What do you reopen and check? Does downloading send it to the buyer?');lines(2)
para('The app has paid-in-full/unpaid status only and one payment date for the whole invoice. Keep each instalment date, part payments, adjustments and credits in a separate checked schedule. App guide: imbewufield.vercel.app/student/guides/sales',small);page()
para('A deposit is received once',title)
para('<b>P02 / Separate receipt from allocation.</b> On Day 1, a buyer orders R90.00 of produce. On Day 2, an advance of R30.00 arrives. No delivery or invoice exists yet. On Day 5, the agreed produce is delivered and invoiced for R90.00. Then apply the same R30.00 advance to that invoice. On Day 6, another R60.00 arrives.')
table([['Event','Total cash received','Advance held','Recorded owed'],['O02 / order','R ______','R ______','Not invoiced'],['DEP02 / advance received','R ______','R ______','Not invoiced'],['D02-I02 / invoice before matching','R ______','R ______','R ______'],['ALLOC02 / apply advance','R ______','R ______','R ______'],['R02 / final receipt','R ______','R ______','R ______']],[213,104,92,CW-409])
para('Why does applying the advance not add another R30.00 of cash? What evidence links it to this customer and invoice?');lines(3)
para('<b>A blank customer schedule.</b> List the fields you need to trace an invoice, its dated receipts, allocations, approved adjustments and remaining balance. Keep unknown receipts and customer credits visible.');lines(4)
para('“Advance held” describes the separate obligation in this practice record, not a claim that the money is in a separate bank account. Real cancellation, refund and tax treatment need the actual agreement and appropriate review.',small);page()
para('Keep questions visible',title)
para('<b>P03 / An unresolved question.</b> Invoice R200.00; receipt R120.00. The buyer questions R40.00. No reduction is approved yet. What is the recorded balance, and what remains unresolved? Then an evidenced R20.00 reduction is approved. Recalculate. A final R60.00 receipt follows.');lines(3)
para('<b>P04 / Unknown sender.</b> R25.00 arrives with no identified customer or invoice. What is known, and what must you investigate before allocating it?');lines(2)
para('<b>P05 / Too much received.</b> Invoice R50.00, receipt R60.00. How much settles this invoice? Where does the extra amount remain while its treatment is checked?');lines(2)
para('<b>Fresh independent case.</b> Invoice R150.00, receipt R50.00. The buyer questions R30.00. Later, a R10.00 reduction is approved. Give the recorded balance before and after approval. Separately, invoice R35.00 and receipt R40.00: identify the credit.');lines(3)
para('<b>Field task.</b> Use invented or approved redacted records to prepare one customer schedule. Explain each source, one unresolved item and what evidence would resolve it. Do not contact a customer or transfer money as an automatic exercise.',small)
para('A recorded dispute is not an automatic write-off or proof of a legal right to collect. Do not turn an overpayment into additional produce sales. Keep adjustments and decisions traceable.',small)
out=REPO/'output/pdf/finance-f5-workbook.pdf';out.parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(out),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=65,bottomMargin=59,title='ImbewuField - F5 sales workbook - review draft',author='ImbewuField').build(story,onFirstPage=decorate,onLaterPages=decorate)
print(out)
