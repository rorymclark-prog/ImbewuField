"""Build learner pages and an accessible timeline from the checked F4 cards."""
from pathlib import Path
import base64,json,runpy
from datetime import date
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Table,TableStyle,Spacer,PageBreak

HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3]
v=runpy.run_path(str(HERE/'verify-f4.py'));v['main']();p=v['PACK'];money=v['money']
results=[dict(v['forecast'](p,s),label=s['label']) for s in p['scenarios']]
hero=REPO/'public/course-images/market-community/market-community-l1.jpg'
html=(HERE/'f4-timeline.template.html').read_text().replace('__DATA__',json.dumps(results)).replace('__HERO__','data:image/jpeg;base64,'+base64.b64encode(hero.read_bytes()).decode())
htmlout=REPO/'output/html/finance-f4-timeline.html';htmlout.parent.mkdir(parents=True,exist_ok=True);htmlout.write_text(html)
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
 c.saveState();c.setFillColor(GREEN);c.setFont('Helvetica-Bold',10);c.drawString(M,H-38,'IMBEWUFIELD / FARM FINANCE / F4');c.setFont('Helvetica',8);c.drawRightString(W-M,H-38,'ENGLISH REVIEW DRAFT');c.setStrokeColor(LINE);c.line(M,43,W-M,43);c.drawString(M,28,'Invented classroom inputs. Bookkeeping and learner review pending.');c.drawRightString(W-M,28,f'{d.page} / 4');c.restoreState()
para('Plan the whole activity',title)
para('All amounts, hours and dates are invented. This is a new January-March 2027 practice plan, not a recommended growing season. No crop, land area or yield is supplied.',small)
b=p['budget'];a,z=b['activities']
table([['Budget input','Activity A','Activity B'],['Expected sales',money(a['salesCents']),money(z['salesCents'])],['Direct inputs',money(a['directCents']),money(z['directCents'])],['Planned hire use',f"{a['hireHours']} hours",f"{z['hireHours']} hours"],['Equal-size crate spaces',a['tripSpaces'],z['tripSpaces']],['Unpaid family work',f"{a['familyHours']} hours",f"{z['familyHours']} hours"]],[241,133,CW-374])
para(f"Share one hire bill of <b>{money(b['hireCents'])}</b> by its hours. Share one trip bill of <b>{money(b['tripCents'])}</b> by crate spaces. For this exercise only, compare family time at <b>{money(b['familyComparisonCentsPerHour'])}/hour</b>. No wages are paid.")
table([['Your budget','A','B','Combined'],['Hire share','R ______','R ______','R ______'],['Trip share','R ______','R ______','R ______'],['Total specified cash inputs','R ______','R ______','R ______'],['Unpaid-time comparison','R ______','R ______','R ______'],['Sales less these included costs','R ______','R ______','R ______']],[227,93,93,CW-413])
para('Why is the last line not full farm profit? Name a missing cost and one capacity check needed before both activities can run.');lines(2);page()
para('Follow each payment date',title)
para(f"Opening 1 January: cash tin <b>{money(p['opening']['cashTinCents'])}</b> and bank <b>{money(p['opening']['bankCents'])}</b>, both assumed available. Start with their combined amount. The cards are forecasts, not payments already made.")
table([['Source / date','Expected movement','In / out','Projection'],*[[r['id']+' / '+date.fromisoformat(r['date']).strftime('%d %b'),r['label'],('+' if r['direction']=='in' else '-')+money(r['cents']),'R ______'] for r in p['events']]],[88,232,92,CW-412])
para('<b>First shortage date:</b> __________. <b>Lowest projection:</b> R __________.<br/><b>Deepest gap:</b> R __________. <b>31 March projection:</b> R __________.')
para('A negative number is an unfunded gap, not available cash or an approved overdraft. Continuing the calculation does not prove those payments can be made. What must change before the first shortage?');lines(2);page()
para('Carry forward, then change',title)
para('Use the dated cards. Opening + receipts - payments = closing. Carry each closing balance to the next opening. Never add the three closing balances as money available.',small)
table([['Month','Opening','Receipts','Payments','Closing'],*[[m,'R _____','R _____','R _____','R _____'] for m in ['January','February','March']]],[91,104,104,104,CW-403])
para('<b>Keep these separate from combined cash receipts:</b>',body)
for r in p['excluded']:para(f"{r['id']} / {money(r['cents'])}: {escape(r['label'])}.",small)
para('Compare each change with BASE. Use the original cards each time; do not add scenario balances together.',body)
table([['Change','31 March','Deepest gap'],*[[s['label'],'R ______','R ______'] for s in p['scenarios'][1:]]],[321,93,CW-414])
para('Which change keeps the ending balance but makes the earlier gap worse? Why does a later equipment purchase not solve a January shortage?');lines(2);page()
para('Make a decision with evidence',title)
para('<b>1 / Fresh allocation.</b> Share a R60.00 bill by recorded use of one unit and two units. Check that the two shares still equal the original bill.');lines(2)
t=p['transfer']
para(f"<b>2 / Fresh dates.</b> Start with {money(t['openingCents'])}. Pay {money(t['events'][0]['cents'])} on Day 2; receive {money(t['events'][1]['cents'])} on Day 10; pay {money(t['events'][2]['cents'])} on Day 20. Find the closing amount, lowest projection and first shortage. Does a positive ending prove every earlier bill can be paid?");lines(3)
para('<b>3 / Missing evidence.</b> An additional payment fee will apply, but its amount is missing. Can the forecast still be described as complete? What source would resolve it?');lines(2)
para('<b>4 / A reasoned response.</b> A buyer pays late. Name an option to investigate, the date it must work by, what needs agreement and what other amounts would change. An application for funding is not available cash.');lines(3)
para('<b>5 / Your field task.</b> Prepare a redacted short forecast. Label the opening money, dates, source references, unknowns and one adverse case. Keep the original plan for comparison with later evidence. Do not put forecast sales into actual My Records.',body)
para('Companions: imbewufield.vercel.app/student/guides/expenses and /student/guides/invoices. Keep hypothetical records in this workbook. This practice is not a certification of farm viability.',small)
out=REPO/'output/pdf/finance-f4-workbook.pdf';out.parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(out),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=65,bottomMargin=59,title='ImbewuField - F4 cash-flow workbook - review draft',author='ImbewuField').build(story,onFirstPage=decorate,onLaterPages=decorate)
print(out);print(htmlout)
