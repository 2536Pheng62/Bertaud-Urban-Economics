from report_generator import PDFReportGenerator
import os
from PIL import Image, ImageDraw

def create_dummy_chart_image(filename="dummy_chart.png"):
    try:
        img = Image.new('RGB', (600, 300), color = (255, 255, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([10, 10, 590, 290], outline="black", width=2)
        d.text((20, 20), "Bertaud Density Chart (Thai Verification)", fill="black")
        # Corrected coordinates y0 < y1
        d.rectangle([50, 100, 100, 250], fill="blue", outline="black")
        d.rectangle([150, 150, 200, 250], fill="green", outline="black")
        d.rectangle([250, 50, 300, 250], fill="red", outline="black")
        img.save(filename)
        return filename
    except Exception as e:
        print(f"Image creation failed: {e}")
        return None

def verify_report_generation():
    print("--- Verifying PDF Report Generator (Thai) ---")
    
    chart_path = create_dummy_chart_image()
    
    audit_data = {
        'project_name': 'โครงการสยามสแควร์ทาวเวอร์ (ทดสอบ)',
        'overall_status': 'ผ่านเกณฑ์ (Pass)',
        'summary_text': (
            "โครงการมีการใช้ประโยชน์ที่ดินอย่างเหมาะสม (Optimal) ตามดัชนี Bertaud "
            "ผลตอบแทนทางการเงินเป็นบวกและค่าก่อสร้างอยู่ในเกณฑ์มาตรฐาน"
        ),
        
        # Spatial
        'efficiency_index': 0.95,
        'density_status': 'เหมาะสม (Optimal)',
        
        # Financial
        'state_npv': 1250000000.00,
        'roa_percent': 12.5,
        'roa_status': 'ตามเป้าหมาย (Target)',
        'cost_deviation': 5.2,
        'cost_status': 'ผ่านเกณฑ์ (Pass)'
    }

    output_pdf = "Official_Audit_Report_Thai.pdf"
    generator = PDFReportGenerator(output_pdf)
    generator.generate_report(audit_data, chart_image_path=chart_path)
    
    print(f"--- Verification Complete: Check {output_pdf} ---")

if __name__ == "__main__":
    verify_report_generation()
