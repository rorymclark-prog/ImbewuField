"""Render F6 learner practice from the checked source cards."""
from pathlib import Path
import runpy
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Table,TableStyle,Spacer,PageBreak
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[3]
v=runpy.run_path(str(HERE/'verify-f6.py'));v['main']();p=v['P'];money=v['money']
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
 c.saveState();c.setFillColor(GREEN);c.setFont('Helvetica-Bold',10);c.drawString(M,H-38,'IMBEWUFIELD / FARM FINANCE / F6');c.setFont('Helvetica',8);c.drawRightString(W-M,H-38,'ENGLISH REVIEW DRAFT');c.setStrokeColor(LINE);c.line(M,43,W-M,43);c.drawString(M,28,'Invented classroom inputs. Bookkeeping and learner review pending.');c.drawRightString(W-M,28,f'{d.page} / 4');c.restoreState()
para('What must be paid first?',title)
para('All amounts and dates are invented for learning. Compare the same suitable tool service on Days 2, 10 and 20. Each option starts with R500.00 available cash and no other receipts. No crop, yield or machine is supplied.',small)
table([['Case','Dated source cards'],['BUY','Day 1: R900 purchase. Day 10: R60 operating inputs. Day 20: R40 maintenance. Remaining asset value unknown.'],['HIRE','Day 1: R210 for all three uses + R60 transport + R150 security. Day 30: security returned in full. Operating and maintenance service costs included; no other charges in this case.'],['SHARE','Day 1: R300 ownership contribution. Day 10: R30 operating contribution. Day 20: R20 maintenance. Day 10 access unconfirmed; remaining share value unknown.']],[75,CW-75])
para('BUY and HIRE access/suitability are assumed confirmed for this exercise only. SHARE is conditional until its booking is resolved. A cash total does not prove that work can be done.',small)
table([['Your comparison','BUY','HIRE','SHARE'],['Gross payments','R _____','R _____','R _____'],['Deposit returned','R _____','R _____','R _____'],['Net cash paid','R _____','R _____','R _____'],['Peak cash needed','R _____','R _____','R _____'],['Closing cash projection','R _____','R _____','R _____']],[206,100,100,CW-406])
para('Which option needs more cash first than its net payment? What is unknown before claiming a lifetime cost winner?');lines(3);page()
para('Read every repayment part',title)
para('Separate practice case: R600.00 advanced on 1 January 2027. A R30.00 fee is paid separately. The schedule below includes principal, interest, service and required insurance. No other charges or optional insurance are supplied. These are invented charge amounts, not an interest-rate calculation or actual credit offer.',small)
s=p['borrowing']['schedules'][0]
table([['Due date','Principal','Interest','Service','Insurance','Total'],*[[r['date'],money(r['principal']),money(r['interest']),money(r['service']),money(r['insurance']),'R _____']for r in s['rows']]],[86,84,78,72,83,CW-403])
para('<b>Net initial funds:</b> R __________<br/><b>Total scheduled repayments:</b> R __________<br/><b>Total charges including the initial fee:</b> R __________')
para('After each payment, how much principal remains? Why is remaining principal different from a complete early-settlement quote?');lines(2)
para('<b>Same fee, withheld once:</b> Principal is still R600.00, but only R570.00 is credited because the R30.00 fee was withheld. The later schedule is unchanged. Do you subtract another R30.00 from that credited amount? Reconcile total charges.');lines(2)
para('<b>Missing evidence:</b> Another quote has three R200 principal and R10 interest components, no service fee and a separate R30 initial fee. Required insurance applies, but its amount is missing. Which complete totals cannot yet be given?');lines(2)
para('Read actual terms and dates with appropriate help. This exercise cannot establish affordability, lawful terms or credit approval. Do not sign or apply as an automatic course task.',small);page()
para('Set aside is still your money',title)
para('Start a new case with R800.00 total: R600.00 for daily work and R200.00 reserved. Both are inside the same cash scope. No fees or legal restrictions apply in this model. The R500.00 reserve target is invented, not a recommended amount.',small)
table([['Day / event','Daily work','Set aside','Total'],['Opening','R600.00','R200.00','R800.00'],['5 / allocate R100 to reserve','R _____','R _____','R _____'],['10 / pay R120 maintenance from reserve','R _____','R _____','R _____'],['15 / evidenced R80 operating receipt','R _____','R _____','R _____'],['25 / R550 essential bill from daily work','R _____','R _____','R _____']],[222,95,95,CW-412])
para('Why does allocation not reduce total cash? How far below target is the remaining reserve?');lines(2)
para('<b>Keep outside the cash movements:</b> D01 is a R50 non-cash equipment-use estimate. G01 is a R300 unapproved funding application. Explain why neither adds money to the reserve.');lines(2)
para('<b>Test a shock:</b> Insert a R250 repair on Day 20. Use R180 reserved and R70 from daily work. Recalculate the later R550 bill. What fails, and when must a response be workable?');lines(3)
para('A negative projection is an unfunded shortage, not a completed payment, spendable money or approved overdraft. Keep real restrictions and access conditions visible.',small);page()
para('Explain a fresh case',title)
para('<b>1 / Hire.</b> R80 service charge plus a R50 deposit, fully returned later. Find the cash needed before hire and net paid after return. What changes if the return agreement is missing?');lines(3)
para('<b>2 / Repayment.</b> R100 principal + R10 interest + R2 service already included in the instalment. Find the instalment. Explain why adding the service twice gives the wrong result.');lines(2)
para('<b>3 / Reserve.</b> Start with R400 total and no reserve. Set aside R90, then pay R20 from it. State total cash after allocation and after payment, and the amount still reserved.');lines(3)
para('<b>4 / A real decision.</b> Find an approved redacted quote or prepare questions. Record the job, dates, included charges, ownership, access and repair responsibilities. Identify an unknown that prevents a reliable comparison.');lines(3)
para('<b>Evidence check.</b> Keep estimates separate from actual records. Link each payment to its source. The app does not supply this loan schedule, asset register or reserve ledger. Bring questions to a qualified local adviser before a real commitment.',small)
para('Companion: imbewufield.vercel.app/student/guides/expenses. No private balances, customer details or identity documents are needed for group practice.',small)
out=REPO/'output/pdf/finance-f6-workbook.pdf';out.parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(out),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=65,bottomMargin=59,title='ImbewuField - F6 equipment and finance workbook - review draft',author='ImbewuField').build(story,onFirstPage=decorate,onLaterPages=decorate)
print(out)
