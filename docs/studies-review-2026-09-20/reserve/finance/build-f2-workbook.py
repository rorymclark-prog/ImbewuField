"""Render the four-page reserve learner workbook from the checked F2 pack.

Answers stay in f2-records.md. Keep generous writing space and explicit practice
labels so a polished handout cannot be mistaken for real records or a released
accounting course. Requires ReportLab; no network or private documents are read.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import json

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
PACK = json.loads((ROOT / 'f2-practice.json').read_text())
OUT = REPO / 'output/pdf/finance-f2-workbook.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H, M = 595.276, 841.890, 44
CW = W - 2 * M
GREEN = colors.HexColor('#284F38')
INK = colors.HexColor('#26352C')
MUTED = colors.HexColor('#626A5F')
LINE = colors.HexColor('#D4D8CD')
PALE = colors.HexColor('#F0F4EA')
GOLD = colors.HexColor('#A9894E')
BODY = ParagraphStyle('body', fontName='Helvetica', fontSize=11, leading=15, textColor=INK, alignment=TA_LEFT)
SMALL = ParagraphStyle('small', parent=BODY, fontSize=9, leading=12, textColor=MUTED)
CELL = ParagraphStyle('cell', parent=BODY, fontSize=10, leading=13)
HEAD = ParagraphStyle('head', parent=CELL, fontName='Helvetica-Bold', textColor=GREEN)
C = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1, invariant=1)
C.setTitle('ImbewuField - F2 learner workbook - review draft')
C.setAuthor('ImbewuField')
C.setSubject('Synthetic classroom exercises: stock, sales, payments and reconciliation')


def rand(cents):
    return f'R{cents / 100:,.2f}'


def kg(grams):
    return f'{grams / 1000:g}'


def paragraph(text, x, top, width, style=BODY, max_height=None):
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    if max_height is not None:
        assert height <= max_height, f'Text exceeds its reserved space: {text[:60]}'
    assert top - height >= 54, f'Text enters footer: {text[:60]}'
    p.drawOn(C, x, top - height)
    return top - height


def header(page, title, subtitle):
    C.setFillColor(GREEN); C.setFont('Helvetica-Bold', 10)
    C.drawString(M, H - 42, 'IMBEWUFIELD  /  FARM FINANCE  /  F2')
    C.setFillColor(MUTED); C.setFont('Helvetica', 8)
    C.drawRightString(W - M, H - 42, 'ENGLISH REVIEW DRAFT')
    C.setFillColor(GREEN); C.setFont('Times-Bold', 27)
    C.drawString(M, H - 84, title)
    paragraph(subtitle, M, H - 100, CW, SMALL, 36)
    C.setStrokeColor(LINE); C.line(M, 43, W - M, 43)
    C.setFillColor(MUTED); C.setFont('Helvetica', 8)
    C.drawString(M, 28, 'Practice only. Invented values. Bookkeeping and learner review pending.')
    C.drawRightString(W - M, 28, f'{page} / 4')


def section(label, top):
    C.setFillColor(GREEN); C.setFont('Helvetica-Bold', 11)
    C.drawString(M, top, label)


def writing_lines(top, count=2, width=CW):
    C.setStrokeColor(LINE)
    for i in range(count):
        y = top - i * 25
        assert y >= 58
        C.line(M, y, M + width, y)


def table(rows, top, widths, row_heights=None):
    cells = [[Paragraph(escape(str(value)), HEAD if i == 0 else CELL) for value in row] for i, row in enumerate(rows)]
    t = Table(cells, colWidths=widths, rowHeights=row_heights, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PALE),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GREEN),
        ('LINEBELOW', (0, 1), (-1, -1), .4, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    _, height = t.wrap(CW, H)
    assert top - height >= 57, 'Table enters footer'
    t.drawOn(C, M, top - height)
    return top - height


def new_page():
    C.showPage()


header(1, 'Follow the produce', 'Use the same unit. Keep the source reference. Compare the book with a separate count.')
paragraph('Begin with <b>4 kg of carrots already in store</b>. Follow the cards below in order. Write what remains after each event. The amounts are practice inputs, not a harvest recommendation.', M, 693, 303, max_height=86)
hero = ImageReader(str(REPO / 'public/course-images/market-community/market-community-l1.jpg'))
C.drawImage(hero, W - M - 171, 600, width=171, height=96, preserveAspectRatio=True, anchor='c', mask='auto')
paragraph('Illustrated context, not evidence.', W - M - 171, 594, 171, SMALL, 24)
labels = {'harvest':'picked', 'sale':'delivered for sale', 'home':'used at home', 'gift':'given away', 'loss':'recorded spoilage'}
rows = [['Source', 'What happened', 'Stock left (kg)'], ['Opening', f'{kg(PACK["openingStock"])} kg already here', kg(PACK['openingStock'])]]
for row in PACK['stockEvents']:
    rows.append([row['reference'], f'{kg(row["quantity"])} kg {labels[row["kind"]]}', '________________'])
table(rows, 553, [86, 295, CW - 381], [32] * len(rows))
paragraph('<b>Separate closing count: 9 kg.</b> Does your book agree? Name one check you still need even if the total agrees.', M, 217, CW, max_height=36)
writing_lines(169, 1)
paragraph('<b>Try a new case:</b> 10 kg available; 3 kg sold; 2 kg used at home; 4 kg counted at closing. How much is unexplained? What would you check before naming a cause?', M, 146, CW, max_height=45)
writing_lines(85, 1)
new_page()

header(2, 'Follow the buyer\'s payment', 'A delivery, sale and payment can be linked records of one transaction.')
section('READ THESE TWO SOURCE CARDS', 685)
cards = [
    ('S02 - delivery and sale', 'Day 2', '5 kg delivered', 'Agreed value R100.00'),
    ('PAY02 - payment', 'Day 4', 'R60.00 received in the wallet', 'For sale S02'),
]
card_w = (CW - 18) / 2
for i, card in enumerate(cards):
    x = M + i * (card_w + 18)
    C.setFillColor(PALE); C.roundRect(x, 531, card_w, 132, 8, fill=1, stroke=0)
    paragraph(f'<b>{card[0]}</b><br/>{card[1]}<br/><br/>{card[2]}<br/>{card[3]}', x + 14, 648, card_w - 28, max_height=102)
table([
    ['Question', 'Your answer'],
    ['What was the sale value?', 'R __________________'],
    ['How much money arrived?', 'R __________________'],
    ['How much is still owed?', 'R __________________'],
    ['Delivery day / payment day', '__________ / __________'],
], 508, [310, CW - 310], [32, 38, 38, 38, 38])
paragraph('Explain why PAY02 is not another 5 kg sold. Does <b>paid in full</b> describe this sale correctly?', M, 302, CW, max_height=36)
writing_lines(252, 2)
section('TRY A NEW CASE', 194)
paragraph('A sale is R90.00. The buyer pays R30.00. Write the sale value, money received and amount still owed.', M, 179, CW, max_height=36)
writing_lines(132, 1)
paragraph('App boundary: part-payments need the workbook. Do not mark the whole invoice paid or enter its payment as another sale.', M, 106, CW, SMALL, 36)
new_page()

header(3, 'Move money without inventing income', 'Keep a separate record for each place money is held. Match both sides of a transfer.')
section('MOVE01 - BOTH SIDES ARE COMPLETE', 685)
paragraph('Before the transfer: cash R607.50; wallet R100.00. Move R100.00 from cash to the wallet. Fill the ending balances and the combined amount.', M, 667, CW, max_height=45)
table([
    ['Place', 'Before', 'Movement', 'After'],
    ['Cash tin', 'R607.50', '- R100.00', 'R __________'],
    ['Wallet', 'R100.00', '+ R100.00', 'R __________'],
    ['Combined money', 'R __________', 'No new money', 'R __________'],
], 606, [133, 115, 125, CW - 373], [34, 46, 46, 46])
paragraph('What new produce sale occurred? What new expense occurred? Explain your answers using MOVE01.', M, 414, CW, max_height=36)
writing_lines(363, 2)
section('KEEP A SEPARATE FEE SEPARATE', 303)
paragraph('FEE01 later shows a R2.50 charge paid from the wallet. Which account changes? What source supports it? Do not invent a fee when the evidence does not show one.', M, 286, CW, max_height=45)
writing_lines(224, 2)
section('TRY A NEW CASE', 168)
paragraph('Move R20.00 between two accounts owned by the practice farm. Does combined money change? If a separate source shows a R1.00 fee, what changes then?', M, 151, CW, max_height=45)
writing_lines(87, 1)
new_page()

header(4, 'Find the mistake and keep the evidence', 'Each row is a separate case. Correct only what the source supports.')
rows = [
    ['Source', 'Altered copy', 'Correction and reason'],
    ['PACK01: R12.50 paid', 'R125.00 paid', ''],
    ['H02: 8 kg weighed', '8 bunches', ''],
    ['S02 delivered Day 2; PAY02 paid Day 4', 'Both entered as Day 4 delivery', ''],
    ['One PAY02 payment', 'Two PAY02 records', ''],
    ['1 kg unexplained; no cause documented', '1 kg stolen', ''],
]
table(rows, 690, [154, 154, CW - 308], [34, 53, 53, 66, 53, 66])
section('WRITE ONE CORRECTION NOTE', 341)
paragraph('Record reference: __________________  Correction date: __________________<br/>Old entry: __________________________________________________________<br/>Correct entry: _______________________________________________________<br/>Source used: ________________________  Checked by: ____________________', M, 325, CW, max_height=80)
paragraph('<b>What remains unknown?</b> A guessed entry that makes the total agree is not an explanation.', M, 235, CW, max_height=36)
writing_lines(190, 1)
section('TRY IT IN THE SAMPLE FARM', 157)
paragraph('Use a published app guide to save and reopen a practice entry in the same session. Check its amount, unit and source. A full reload resets sample data; it does not test a real account\'s backup. Do not create a duplicate to retry a save.', M, 141, CW, SMALL, 48)
paragraph('Guide links: imbewufield.vercel.app/student/guides/harvest<br/>/student/guides/expenses  |  /student/guides/invoices', M, 84, CW, SMALL, 24)
C.save()
print(OUT)
