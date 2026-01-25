from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import cm
from reportlab.lib import colors
import os
import datetime

# ลงทะเบียนฟอนต์ภาษาไทย (Windows)
try:
    font_path = "C:/Windows/Fonts/Noto Sans Thai/NotoSansThai-Regular.ttf"
    pdfmetrics.registerFont(TTFont("ThaiFont", font_path))
    font_name = "ThaiFont"
except:
    # ถ้าไม่เจอ ใช้ฟอนต์ default
    font_name = "Helvetica"
    print("⚠️ ไม่พบฟอนต์ภาษาไทย ใช้ Helvetica แทน")

# กำหนด output path (Windows)
out_path = "เฉลย_DataViz_OCSC_DS28-DOC02.pdf"

# สร้างเอกสาร PDF
doc = SimpleDocTemplate(
    out_path,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm, bottomMargin=2*cm
)

# สไตล์ต่างๆ
title_style = ParagraphStyle(
    "title",
    fontName=font_name,
    fontSize=18,
    leading=24,
    textColor=colors.HexColor("#0B2E4B"),
    spaceAfter=12,
    alignment=1,  # center
)

sub_style = ParagraphStyle(
    "sub",
    fontName=font_name,
    fontSize=12,
    leading=16,
    textColor=colors.grey,
    spaceAfter=16,
    alignment=1,
)

h_style = ParagraphStyle(
    "h",
    fontName=font_name,
    fontSize=14,
    leading=18,
    textColor=colors.HexColor("#0B2E4B"),
    spaceBefore=10,
    spaceAfter=6,
)

body_style = ParagraphStyle(
    "body",
    fontName=font_name,
    fontSize=14,
    leading=19,
    textColor=colors.black,
    spaceAfter=6,
)

ans_style = ParagraphStyle(
    "ans",
    fontName=font_name,
    fontSize=14,
    leading=19,
    textColor=colors.HexColor("#0A5A2A"),
    spaceAfter=4,
)

reason_style = ParagraphStyle(
    "reason",
    fontName=font_name,
    fontSize=14,
    leading=19,
    textColor=colors.HexColor("#333333"),
    leftIndent=14,
    spaceAfter=10,
)

# ข้อมูลเฉลย
solutions = [
    ("S__65814652_0.jpg", [
        (1, "ความสำคัญของการแสดงผลข้อมูล (Data Visualization) ในที่ทำงานคืออะไร",
         "ตอบ: A) เพื่อเปลี่ยนการตัดสินใจที่อิงจากความรู้สึกให้เป็นการตัดสินใจที่อิงจากข้อมูล",
         "เหตุผล: Data Visualization ทำให้เห็นภาพรวมและข้อค้นพบ (insight) ชัดขึ้น จึงช่วยสนับสนุนการตัดสินใจได้ดีขึ้น"),
        (2, "ข้อใดคือเป้าหมายหลักของการใช้ตาราง (Tables) ในการนำเสนอข้อมูล",
         "ตอบ: B) เพื่อแสดงค่าตัวเลขที่แม่นยำและให้ผู้ใช้ค้นหาข้อมูลเฉพาะได้",
         "เหตุผล: ตารางเหมาะกับข้อมูลเชิงรายการ/ตัวเลขที่ต้องดูค่าแบบละเอียดและค้นหาได้ตรงจุด"),
    ]),
    ("S__65814653_0.jpg", [
        (3, "องค์ประกอบหลักของ Data Visualization ที่ช่วยให้ผู้รับสารเข้าใจความหมายของข้อมูลคืออะไร",
         "ตอบ: A) บริบท (Context) และเรื่องราว (Narrative)",
         "เหตุผล: การเล่าเรื่องด้วยข้อมูลต้องมีบริบทและการเชื่อมโยง เพื่อให้ผู้ฟังเข้าใจว่าข้อมูลกำลังบอกอะไร"),
        (4, "หากต้องการเปรียบเทียบยอดขายของสินค้า 5 ชนิดในเดือนที่ผ่านมา ควรเลือกใช้รูปแบบใด",
         "ตอบ: แผนภูมิแท่ง (Bar Chart)",
         "เหตุผล: Bar Chart เหมาะที่สุดกับการเปรียบเทียบค่าระหว่างหมวดหมู่หลาย ๆ หมวดในช่วงเวลาเดียวกัน"),
    ]),
    ("S__65814654_0.jpg", [
        (5, "การนำ Data Visualization มาใช้เพิ่มประสิทธิภาพในการทำงานหมายความว่าอย่างไร",
         "ตอบ: A) ทำให้การประชุมสั้นลงเพราะทุกคนดูภาพแล้วเข้าใจตรงกันเร็วขึ้น",
         "เหตุผล: การทำให้ข้อมูลเข้าใจง่ายขึ้นช่วยลดเวลาตีความและทำให้สื่อสารตรงกันเร็ว"),
        (6, "ข้อมูลรายชื่อพนักงานในแต่ละแผนกควรใช้รูปแบบใดนำเสนอเพื่อให้เห็นภาพรวมและค้นหาชื่อได้ง่าย",
         "ตอบ: ตาราง (Table) ที่จัดกลุ่มตามแผนก",
         "เหตุผล: เป็นข้อมูลแบบรายชื่อ (รายการ) ตารางจะอ่านง่าย ค้นหาและจัดกลุ่มตามแผนกได้ชัด"),
    ]),
    ("S__65814655_0.jpg", [
        (7, "ตามหลักการแล้ว ข้อใดคือความเข้าใจที่ถูกต้องเกี่ยวกับ Data Visualization",
         "ตอบ: C) เป็นการผสมผสานระหว่างศาสตร์และศิลป์เพื่อสื่อสารเรื่องราวจากข้อมูล",
         "เหตุผล: Data Visualization ไม่ใช่แค่กราฟสวย แต่คือการออกแบบเพื่อสื่อสารและทำให้เข้าใจข้อมูลได้เร็วและลึกขึ้น"),
        (8, "ข้อมูลอุณหภูมิเฉลี่ยรายเดือนจัดเป็นข้อมูลประเภทใดตามลักษณะของข้อมูล (Nature of Data)",
         "ตอบ: ข้อมูลเชิงปริมาณ (Quantitative Data)",
         "เหตุผล: อุณหภูมิเป็นค่าตัวเลข วัดและคำนวณได้ (มักเป็นข้อมูลต่อเนื่อง)"),
    ]),
    ("S__65814656_0.jpg", [
        (9, "ข้อใดคือวัตถุประสงค์หลักของการนำเสนอข้อมูลตามแนวทางของ Data Visualization",
         "ตอบ: C) เพื่อสื่อสารข้อมูลให้เข้าใจง่ายและสนับสนุนการตัดสินใจ",
         "เหตุผล: เป้าหมายหลักคือทำให้ข้อมูลซับซ้อนเข้าใจง่ายและนำไปใช้ตัดสินใจได้"),
        (10, "หากต้องการแสดงความสัมพันธ์ระหว่างจำนวนชั่วโมงที่อ่านหนังสือกับคะแนนสอบควรใช้รูปแบบใด",
         "ตอบ: กราฟกระจาย (Scatter Plot)",
         "เหตุผล: Scatter Plot เหมาะกับการดูความสัมพันธ์ของตัวแปรเชิงปริมาณ 2 ตัว"),
    ]),
    ("S__65814658_0.jpg", [
        (13, "ขั้นตอนแรกที่สำคัญที่สุดในการเล่าเรื่องด้วยข้อมูลคืออะไร",
         "ตอบ: การเลือก/กำหนดกลุ่มเป้าหมายผู้ฟัง",
         "เหตุผล: ต้องรู้ผู้ฟังก่อนเพื่อกำหนดเป้าหมายการสื่อสารและเลือกวิธีเล่าให้เหมาะ"),
        (14, "หากต้องการแสดงสัดส่วนของค่าใช้จ่ายประเภทต่าง ๆ จากงบประมาณทั้งหมด ควรเลือกใช้แผนภูมิชนิดใด",
         "ตอบ: แผนภูมิวงกลม (Pie Chart)",
         "เหตุผล: Pie Chart ใช้สื่อสารสัดส่วนของแต่ละส่วนเมื่อเทียบกับทั้งหมด (100%) ได้ชัด"),
    ]),
    ("S__65814659_0.jpg", [
        (15, "ในการเล่าเรื่องด้วยข้อมูล การเลือก Visual ที่เหมาะสมทำหน้าที่เปรียบได้กับอะไร",
         "ตอบ: การเลือกภาพประกอบในหนังสือเรียน",
         "เหตุผล: Visual ที่ดีช่วยอธิบายเรื่องยากให้เข้าใจง่าย เหมือนภาพประกอบช่วยให้เรียนรู้เร็วขึ้น"),
        (16, "ทำไมการเข้าใจกลุ่มเป้าหมายผู้รับสารจึงสำคัญต่อการเล่าเรื่องด้วยข้อมูล",
         "ตอบ: A) เพื่อที่จะได้ใช้คำศัพท์และยกตัวอย่างที่พวกเขาสามารถเข้าใจและเชื่อมโยงได้",
         "เหตุผล: เมื่อเข้าใจผู้ฟัง จะเลือกภาษา ตัวอย่าง และระดับรายละเอียดให้เหมาะ ทำให้สื่อสารได้ผล"),
    ]),
    ("S__65814660_0.jpg", [
        (17, "ข้อใดไม่ใช่เทคนิคการเล่าเรื่องด้วยข้อมูลที่ดี",
         "ตอบ: การแสดงข้อมูลทุกอย่างที่มีเพื่อแสดงความโปร่งใส",
         "เหตุผล: การเล่าเรื่องด้วยข้อมูลควรคัดเลือกสิ่งสำคัญ ลดความรก เพื่อให้เห็นประเด็นชัด"),
        (18, "ข้อมูลจากรายงานวิจัยของหน่วยงานภายนอกจัดเป็นข้อมูลประเภทใดตามแหล่งที่มา (Source of Data)",
         "ตอบ: ข้อมูลทุติยภูมิ (Secondary Data)",
         "เหตุผล: เป็นข้อมูลที่ผู้อื่นเก็บ/สรุปไว้แล้ว เช่น รายงาน งานวิจัย นำมาใช้ต่อ"),
    ]),
    ("S__65814663_0.jpg", [
        (21, "ข้อใดไม่ใช่องค์ประกอบหลักของ Data Visualization",
         "ตอบ: อัลกอริทึม (Algorithm)",
         "เหตุผล: องค์ประกอบหลักเน้นข้อมูล + เรื่องราว + เป้าหมาย + รูปแบบภาพ ไม่ได้จัด Algorithm เป็นองค์ประกอบหลัก"),
        (22, "Data Visualization และ Data Storytelling ช่วยสนับสนุนการตัดสินใจได้อย่างไร",
         "ตอบ: โดยการเปลี่ยนข้อมูลที่ซับซ้อนให้เป็น Insight ที่ชัดเจนและนำไปปฏิบัติได้",
         "เหตุผล: เมื่อ insight ชัด คนตัดสินใจได้เร็วขึ้นและนำไปลงมือทำได้จริง"),
    ]),
    ("S__65814664_0.jpg", [
        (23, "การออกแบบ Data Visualization ที่ดี ควรเริ่มต้นจากอะไรเป็นอันดับแรก",
         "ตอบ: การกำหนดวัตถุประสงค์การสื่อสารและกลุ่มเป้าหมายผู้รับสาร",
         "เหตุผล: ต้องเริ่มจากจะสื่อสารอะไรให้ใครแล้วค่อยเลือกกราฟ/รูปแบบให้ตอบโจทย์"),
        (24, "หลักการใช้ Data Visualization เพื่อสื่อสารให้เข้าใจง่ายนั้น ตรงกับข้อใดมากที่สุด",
         "ตอบ: Less is more (น้อยแต่มาก)",
         "เหตุผล: เน้นความชัด ลดสิ่งรบกวน เพื่อให้ผู้ฟังเข้าใจประเด็นสำคัญได้เร็ว"),
    ]),
]

# สร้างเนื้อหาเอกสาร
story = []
story.append(Paragraph("เฉลยแบบทดสอบ Data Visualization", title_style))
story.append(Paragraph("อ้างอิงจากเอกสาร DS28-DOC02 (Data Visualization & Data Storytelling)", sub_style))

for img_name, qs in solutions:
    story.append(Paragraph(f"รูป: {img_name}", h_style))
    for qno, qtext, ans, reason in qs:
        story.append(Paragraph(f"<b>ข้อ {qno}:</b> {qtext}", body_style))
        story.append(Paragraph(f"<b>{ans}</b>", ans_style))
        story.append(Paragraph(f"{reason}", reason_style))
    story.append(Spacer(1, 6))

# ฟังก์ชันเพิ่ม footer
def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(font_name, 10)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(A4[0]-2*cm, 1.2*cm, f"หน้า {doc.page}")
    canvas.restoreState()

# สร้างไฟล์ PDF
try:
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f"✅ สร้างไฟล์สำเร็จ: {out_path}")
except PermissionError:
    print(f"❌ Error: ไม่มีสิทธิ์เขียนไฟล์: {out_path}")
    raise SystemExit(1)
except OSError as e:
    print(f"❌ Error: ไม่สามารถสร้างไฟล์ PDF: {e}")
    raise SystemExit(1)