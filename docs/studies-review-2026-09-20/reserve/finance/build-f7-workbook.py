"""Print the F7 source cards beside space for a learner's own reasoning."""
from pathlib import Path
import runpy
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
v = runpy.run_path(str(HERE / 'verify-f7.py'))
v['main']()
p, money = v['P'], v['money']
W, H, M = 595.276, 841.89, 44
CW = W - 2 * M
GREEN, INK, LINE = [colors.HexColor(x) for x in ('#315d40', '#26352c', '#d4d8cd')]
body = ParagraphStyle('body', fontName='Helvetica', fontSize=11, leading=15, textColor=INK, spaceAfter=9)
small = ParagraphStyle('small', parent=body, fontSize=9, leading=12)
title = ParagraphStyle('title', fontName='Times-Bold', fontSize=26, leading=29, textColor=GREEN, spaceAfter=12)
cell = ParagraphStyle('cell', parent=body, fontSize=9.3, leading=12, spaceAfter=0)
story = []


def para(text, style=body):
    story.append(Paragraph(text, style))


def lines(count):
    t = Table([[''] for _ in range(count)], colWidths=[CW], rowHeights=[22] * count)
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), .4, LINE)]))
    story.extend([t, Spacer(1, 10)])


def table(rows, widths):
    t = Table([[Paragraph(escape(str(c)), cell) for c in row] for row in rows], colWidths=widths)
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9eee2')),
                          ('LINEBELOW', (0, 0), (-1, -1), .4, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                          ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    story.extend([t, Spacer(1, 10)])


def page():
    story.append(PageBreak())


def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(GREEN)
    canvas.setFont('Helvetica-Bold', 10)
    canvas.drawString(M, H - 38, 'IMBEWUFIELD / FARM FINANCE / F7')
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(W - M, H - 38, 'ENGLISH REVIEW DRAFT')
    canvas.setStrokeColor(LINE)
    canvas.line(M, 43, W - M, 43)
    canvas.drawString(M, 28, 'Invented practice case. Bookkeeping and learner review pending.')
    canvas.drawRightString(W - M, 28, f'{doc.page} / 5')
    canvas.restoreState()


para('One month. Three views.', title)
para('A small market stall buys finished goods for resale. All amounts and dates are invented. This is a separate teaching case, not a valuation of growing crops, animals or a whole farm. Period: 1-31 January 2027. No VAT or income-tax calculation.', small)
para('<b>Opening position:</b> cash R1000; customers owe R200; stock R300; equipment R600. Suppliers are owed R300; no loan. Assets R2100, liabilities R300, equity R1800. No other opening balances are supplied.', small)
table([['Ref / day', 'Source evidence'], *[[e['ref'] + ' / ' + e['date'][8:], e['evidence']] for e in p['events'][:7]]], [73, CW - 73])
para('For S01 and R02, explain why receiving money does not create a second sale.'); lines(2)
page()
para('Keep the dates together', title)
para('Continue the same January case. The assumptions below apply only to this exercise. A document date and a payment date may differ from the event date.', small)
table([['Ref / day', 'Source evidence'], *[[e['ref'] + ' / ' + e['date'][8:], e['evidence']] for e in p['events'][7:]]], [73, CW - 73])
para('<b>X01 / 5 February:</b> the remaining R300 of S01 is received. Does it belong in January cash? Why?', small); lines(2)
para('Which January cost is unpaid? Which January payment buys a future service?', small); lines(2)
page()
para('Build the three summaries', title)
para('Use the opening balances and all January cards. Keep X01 outside the January cash total. These are simplified model summaries, not a complete set of financial statements.', small)
table([['January cash', 'Your amount'], ['Opening cash', 'R1000.00'], ['Receipts: R01 + R02 + L01', 'R __________'], ['Payments: P01 cash part + P02 + E01 + L02 + H01 + F01 + U01', 'R __________'], ['Closing cash', 'R __________'], ['Change from opening cash', 'R __________']], [CW - 135, 135])
table([['January result before tax in this model', 'Your amount'], ['Sales S01', 'R __________'], ['Less goods supplied, interest, transport and utilities', 'R __________'], ['Less reviewed stock loss and depreciation', 'R __________'], ['Result', 'R __________']], [CW - 135, 135])
para('<b>Position at 31 January:</b> add cash, customers owing, stock, equipment and prepayment. Then compare with payables, loan and equity.'); lines(2)
para('Why are the change in cash and the period result different? Explain one source card that causes a difference.'); lines(2)
page()
para('Do not finish a missing number', title)
para('<b>Stock bridge:</b> opening R300 + purchases R400 - goods supplied R350. What is the book value before C01? Then use the reviewed R300 closing value to find the loss.'); lines(2)
para('<b>Remove C01:</b> the closing count and valuation are unavailable. Which balances remain supported? Which complete totals must stay unknown? Do not reuse the other case\'s closing stock.'); lines(3)
para('<b>Equipment:</b> opening R600 + new tool R300 - supplied January charge R60. What is the closing carrying amount? Why is the charge not another cash payment?'); lines(2)
para('<b>Fresh sale case:</b> opening cash R400 and resale stock R120, no debt. Deliver the whole stock for a R300 credit sale, then collect R200. Find cash, amount owed, stock, result and total assets.'); lines(3)
para('<b>Fresh prepayment:</b> opening cash R200 only. Pay R90 for a service wholly next month, still unused now. Find cash, prepayment, period result and assets. What evidence is needed if the service dates are missing?'); lines(3)
page()
para('Prepare an evidence pack', title)
para('Use invented or approved redacted documents for group work. Keep private identifiers and real customer finances out of the class. Record what is supplied, what is missing, and who can help resolve it.', small)
table([['Document group', 'Reference / period', 'Missing evidence or question'], ['Opening balances', '', ''], ['Sales, deliveries and receipts', '', ''], ['Bills and payments', '', ''], ['Stock and equipment', '', ''], ['Amounts owed and loan schedule', '', ''], ['App export and reconciliation', '', '']], [175, 140, CW - 315])
para('<b>Discuss:</b> Does a printed VAT number prove a compliant tax invoice? Does an app export prove complete accounts or loan approval? Does no return automatically mean no records?'); lines(3)
para('<b>Find the right source:</b> record an official SARS page, the date checked and one exact question for suitable local help. Do not infer a universal retention period, tax rate or registration result.'); lines(3)
para('Start with sars.gov.za/client-segments/record-keeping/ and sars.gov.za/businesses-and-employers/government/tax-invoices/. Current applicability still needs checking. An app field is not a compliance decision.', small)
para('App companions: imbewufield.vercel.app/student/guides/invoices and /student/guides/sales. Keep exercise figures outside actual My Records.', small)

out = REPO / 'output/pdf/finance-f7-workbook.pdf'
out.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(out), pagesize=(W, H), leftMargin=M, rightMargin=M, topMargin=65,
                  bottomMargin=59, title='ImbewuField F7 - read results - review workbook',
                  author='ImbewuField').build(story, onFirstPage=decorate, onLaterPages=decorate)
print(out)
