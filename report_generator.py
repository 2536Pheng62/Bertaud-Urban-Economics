from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as ReportLabImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import os

class PDFReportGenerator:
    """
    Generates an 'Official Audit Report' PDF using ReportLab.
    Supports Thai language via THSarabunNew font.
    """

    def __init__(self, output_filename: str):
        self.output_filename = output_filename
        self.styles = getSampleStyleSheet()
        self.font_name = 'Helvetica' # Default fallback
        self._register_thai_font()
        self._setup_custom_styles()

    def _register_thai_font(self):
        """
        Attempts to register THSarabunNew font for Thai support.
        Looks in 'assets/fonts/' relative to this script.
        """
        base_dir = os.path.dirname(os.path.abspath(__file__))
        font_path = os.path.join(base_dir, "assets", "fonts", "THSarabunNew.ttf")
        
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont('THSarabunNew', font_path))
                self.font_name = 'THSarabunNew'
                print(f"Successfully registered Thai font: {self.font_name}")
            except Exception as e:
                print(f"Failed to register Thai font: {e}")
        else:
            print(f"Warning: Thai font not found at '{font_path}'. Using default Helvetica (Thai text will not render correctly).")

    def _setup_custom_styles(self):
        self.title_style = ParagraphStyle(
            'ReportTitle',
            parent=self.styles['Heading1'],
            fontName=self.font_name,
            fontSize=20 if self.font_name == 'THSarabunNew' else 18,
            alignment=TA_CENTER,
            spaceAfter=20,
            leading=24
        )
        self.header_style = ParagraphStyle(
            'SectionHeader',
            parent=self.styles['Heading2'],
            fontName=self.font_name,
            fontSize=16 if self.font_name == 'THSarabunNew' else 14,
            spaceBefore=15,
            spaceAfter=10,
            textColor=colors.darkblue,
            leading=20
        )
        self.normal_style = ParagraphStyle(
            'NormalThai',
            parent=self.styles['Normal'],
            fontName=self.font_name,
            fontSize=14 if self.font_name == 'THSarabunNew' else 12,
            leading=18
        )

    def generate_report(self, audit_data: dict, chart_image_path: str = None):
        """
        Generates the PDF report based on audit_data.
        """
        doc = SimpleDocTemplate(self.output_filename, pagesize=A4)
        elements = []

        # --- 1. Header (Thai Translated) ---
        elements.append(Paragraph("รายงานผลการตรวจสอบโครงการพัฒนาที่ดินราชพัสดุ", self.title_style))
        elements.append(Paragraph(f"ชื่อโครงการ: {audit_data.get('project_name', 'N/A')}", self.normal_style))
        elements.append(Paragraph(f"วันที่พิมพ์รายงาน: {datetime.now().strftime('%Y-%m-%d %H:%M')}", self.normal_style))
        elements.append(Spacer(1, 0.2 * inch))

        # --- 2. Executive Summary (Thai Translated) ---
        elements.append(Paragraph("1. บทสรุปผู้บริหาร (Executive Summary)", self.header_style))
        
        status = audit_data.get('overall_status', 'รอการพิจารณา')
        status_color = "green" if status == "ผ่านเกณฑ์ (Pass)" or status == "Pass" else "red"
        
        summary_text = f"""
        โครงการนี้ได้รับการตรวจสอบตามแบบจำลองเศรษฐศาสตร์เมือง (Bertaud Model) และระเบียบกรมธนารักษ์
        <br/><br/>
        <b>สถานะภาพรวม:</b> <font color='{status_color}'><b>{status}</b></font>
        <br/><br/>
        {audit_data.get('summary_text', '')}
        """
        elements.append(Paragraph(summary_text, self.normal_style))
        elements.append(Spacer(1, 0.2 * inch))

        # --- 3. Spatial Analysis (Thai Translated) ---
        elements.append(Paragraph("2. การวิเคราะห์เชิงพื้นที่ (Bertaud Density Analysis)", self.header_style))
        elements.append(Paragraph(f"<b>ดัชนีประสิทธิภาพ (Efficiency Index):</b> {audit_data.get('efficiency_index', 'N/A')}", self.normal_style))
        elements.append(Paragraph(f"<b>สถานะความหนาแน่น:</b> {audit_data.get('density_status', 'N/A')}", self.normal_style))
        elements.append(Spacer(1, 0.1 * inch))

        if chart_image_path and os.path.exists(chart_image_path):
            try:
                img = ReportLabImage(chart_image_path, width=6*inch, height=3*inch) 
                elements.append(img)
            except Exception as e:
                elements.append(Paragraph(f"[Error loading chart image: {str(e)}]", self.normal_style))
        else:
            elements.append(Paragraph("[Spatial Analysis Chart Placeholder]", self.normal_style))
        
        elements.append(Spacer(1, 0.2 * inch))

        # --- 4. Financial Analysis (Thai Translated) ---
        elements.append(Paragraph("3. การวิเคราะห์ทางการเงิน (Financial Analysis)", self.header_style))
        
        financial_data = [
            ['ตัวชี้วัด (Metric)', 'ค่า (Value)', 'สถานะ (Status)'],
            ['NPV รัฐ (30 ปี)', f"{audit_data.get('state_npv', 0):,.2f} THB", 'เป็นบวก (Positive)' if audit_data.get('state_npv', 0) > 0 else 'ติดลบ (Negative)'],
            ['ผลตอบแทนต่อสินทรัพย์ (ROA)', f"{audit_data.get('roa_percent', 0):.2f}%", audit_data.get('roa_status', 'N/A')],
            ['ตรวจสอบค่าก่อสร้าง', f"{audit_data.get('cost_deviation', 0):.2f}% (Deviation)", audit_data.get('cost_status', 'N/A')]
        ]

        t = Table(financial_data, colWidths=[3*inch, 2*inch, 1.5*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), self.font_name), # Apply Thai font to table
            ('FONTSIZE', (0, 0), (-1, -1), 12 if self.font_name == 'THSarabunNew' else 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(t)

        # --- Footer Logic ---
        doc.build(elements, onFirstPage=self._footer, onLaterPages=self._footer)
        print(f"Report generated: {self.output_filename}")

    def _footer(self, canvas, doc):
        canvas.saveState()
        canvas.setFont(self.font_name, 10)
        canvas.drawString(inch, 0.75 * inch, f"สร้างโดยระบบตรวจสอบ Bertaud - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        canvas.drawString(7 * inch, 0.75 * inch, f"หน้า {doc.page}")
        canvas.restoreState()

if __name__ == "__main__":
    # Test Run
    pass
