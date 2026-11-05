# Generates public/sample-statement.pdf: a fictional corporate card statement for demos.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

FX = 88.40
rows = [
    ("01 Oct 2026", "UBER INDIA SYSTEMS PVT LTD BANGALORE", None, 482.00),
    ("02 Oct 2026", "GOOGLE*WORKSPACE ACMELABS.IN", None, 16560.00),
    ("03 Oct 2026", "SLACK T03ACME DUBLIN IE", 218.75, None),
    ("03 Oct 2026", "SWIGGY BANGALORE", None, 1236.00),
    ("04 Oct 2026", "NOTION LABS INC SAN FRANCISCO US", 300.00, None),
    ("05 Oct 2026", "FIGMA* MONTHLY SAN FRANCISCO US", 225.00, None),
    ("06 Oct 2026", "CANVA PTY LTD SURRY HILLS AU", None, 3999.00),
    ("07 Oct 2026", "GITHUB, INC. SAN FRANCISCO US", 84.00, None),
    ("08 Oct 2026", "AWS EMEA AWS.AMAZON.CO LU", 1842.37, None),
    ("09 Oct 2026", "VERCEL INC. WALNUT US", 60.00, None),
    ("09 Oct 2026", "INDIGO 6E BLR-DEL GURGAON", None, 8940.00),
    ("10 Oct 2026", "HUBSPOT INC. CAMBRIDGE US", 890.00, None),
    ("11 Oct 2026", "ZOOM.US 888-799-9666 US", 149.90, None),
    ("12 Oct 2026", "MIRO.COM AMSTERDAM NL", 80.00, None),
    ("13 Oct 2026", "AMAZON IN OFFICE FURNITURE", None, 23450.00),
    ("14 Oct 2026", "ANTHROPIC CLAUDE TEAM SAN FRANCISCO US", 150.00, None),
    ("15 Oct 2026", "JETBRAINS ALL PRODUCTS PACK ANNUAL PRAGUE CZ", 779.00, None),
    ("16 Oct 2026", "THIRD WAVE COFFEE KORAMANGALA", None, 840.00),
    ("17 Oct 2026", "REFUND SWIGGY BANGALORE", None, -320.00),
    ("18 Oct 2026", "LINEAR ORBIT INC SAN FRANCISCO US", 96.00, None),
    ("19 Oct 2026", "UBER INDIA SYSTEMS PVT LTD BANGALORE", None, 612.00),
    ("20 Oct 2026", "ZOHO CORPORATION BOOKS CHENNAI", None, 4999.00),
    ("21 Oct 2026", "MAKEMYTRIP HOTEL BOOKING GURGAON", None, 12300.00),
    ("22 Oct 2026", "CALENDLY LLC ATLANTA US", 48.00, None),
    ("24 Oct 2026", "SWIGGY INSTAMART BANGALORE", None, 2180.00),
    ("25 Oct 2026", "1PASSWORD BUSINESS ANNUAL TORONTO CA", 1428.00, None),
    ("27 Oct 2026", "WEWORK DAY PASS BANGALORE", None, 1500.00),
    ("28 Oct 2026", "LOOM INC SAN FRANCISCO US", 75.00, None),
]

usd_total = sum(r[2] for r in rows if r[2])
markup = round(usd_total * FX * 0.035, 2)
gst = round(markup * 0.18, 2)

def inr(v):
    s = f"{abs(v):,.2f}"
    return ("-" if v < 0 else "") + "Rs " + s

out = sys.argv[1]
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=16*mm, rightMargin=16*mm, topMargin=14*mm, bottomMargin=14*mm,
                        title="Sample corporate card statement (fictional)")
ss = getSampleStyleSheet()
h = ParagraphStyle("h", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=16, alignment=0, spaceAfter=2)
sm = ParagraphStyle("sm", parent=ss["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#444444"))
cell = ParagraphStyle("c", parent=sm, fontSize=8, leading=10, textColor=colors.black)

story = [
    Paragraph("Northbank Corporate Card - Monthly Statement", h),
    Paragraph("SAMPLE FOR DEMO PURPOSES ONLY. Fictional bank, company and card.", sm),
    Spacer(1, 6),
]
info = Table([
    ["Company", "Acme Labs Pvt Ltd", "Statement period", "01 Oct 2026 - 31 Oct 2026"],
    ["Card", "XXXX XXXX XXXX 4821 (Founders card)", "Statement date", "01 Nov 2026"],
    ["Cardholder", "Rohan Mehta", "Payment due", "21 Nov 2026"],
], colWidths=[24*mm, 64*mm, 30*mm, 60*mm])
info.setStyle(TableStyle([
    ("FONT", (0,0), (-1,-1), "Helvetica", 8.5),
    ("FONT", (0,0), (0,-1), "Helvetica-Bold", 8.5), ("FONT", (2,0), (2,-1), "Helvetica-Bold", 8.5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3), ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#999999")),
    ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f3f4f6")),
]))
story += [info, Spacer(1, 10)]

data = [["Date", "Transaction details", "Foreign amount", "Amount (INR)"]]
total = 0
for d, desc, usd, rs in rows:
    amt = round(usd * FX, 2) if usd else rs
    total += amt
    data.append([d, Paragraph(desc, cell), f"USD {usd:,.2f}" if usd else "", inr(amt)])
data.append(["31 Oct 2026", Paragraph("FOREIGN CURRENCY MARKUP FEE 3.5%", cell), "", inr(markup)])
data.append(["31 Oct 2026", Paragraph("IGST @18% ON MARKUP FEE", cell), "", inr(gst)])
total += markup + gst
data.append(["", Paragraph("<b>Total amount due</b>", cell), "", inr(round(total, 2))])

t = Table(data, colWidths=[24*mm, 92*mm, 30*mm, 32*mm], repeatRows=1)
t.setStyle(TableStyle([
    ("FONT", (0,0), (-1,0), "Helvetica-Bold", 8.5),
    ("FONT", (0,1), (-1,-1), "Helvetica", 8),
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1f2a44")), ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("ALIGN", (2,0), (-1,-1), "RIGHT"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#f7f8fa")]),
    ("LINEABOVE", (0,-1), (-1,-1), 0.8, colors.black),
    ("FONT", (3,-1), (3,-1), "Helvetica-Bold", 8.5),
    ("TOPPADDING", (0,0), (-1,-1), 3.5), ("BOTTOMPADDING", (0,0), (-1,-1), 3.5),
]))
story += [t, Spacer(1, 8), Paragraph(f"Foreign transactions converted at INR {FX:.2f} per USD on the transaction date.", sm)]
doc.build(story)
print("ok", round(total, 2))
