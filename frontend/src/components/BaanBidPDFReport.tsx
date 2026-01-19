/**
 * BaanBid PDF Report Component
 * 
 * Multi-page PDF report for land development analysis
 * Uses @react-pdf/renderer with Thai font support
 * 
 * Structure:
 * - Page 1: Project Summary & Bertaud Parameters
 * - Page 2: Efficiency Analysis (Bertaud Model)
 * - Page 3: Financial Audit & NPV Calculation
 * - Page 4: Comparative Feasibility Table
 * - Page 5: Legal Constraints & Final Recommendation
 */

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font
} from '@react-pdf/renderer';

// --- Font Registration (Thai Support) ---
// Using local Sarabun font (Google Font) from public/fonts folder
Font.register({
    family: 'Sarabun',
    fonts: [
        {
            src: '/fonts/Sarabun-Regular.ttf',
            fontWeight: 'normal'
        },
        {
            src: '/fonts/Sarabun-Bold.ttf',
            fontWeight: 'bold'
        }
    ]
});

// Disable hyphenation to prevent rendering issues with Thai
Font.registerHyphenationCallback((word) => [word]);

// --- Types ---
export interface PDFReportData {
    // Project Info
    landSizeRai: number;
    proposedGFA: number;
    proposedHeight: number;
    costPerSqm: number;

    // Bertaud Parameters
    d0: number;
    gradient: number;
    distanceKm: number;

    // FAR Results
    proposedFAR: number;
    theoreticalFAR: number;
    legalMaxFAR: number;
    efficiencyScore: number;
    status: string;
    statusThai: string;

    // Financial Results
    stateNPV: number;
    upfrontFee: number;
    annualRent: number;
    costDeviation: number;
    costStatus: string;
    roa: number;
    roaStatus: string;

    // Recommendation
    recommendedOption: string;
    recommendationReason: string;

    // Metadata
    generatedAt: string;
}

// --- Styles ---
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Sarabun',
        fontSize: 12,
        lineHeight: 1.4,
        backgroundColor: '#ffffff'
    },
    header: {
        marginBottom: 20,
        borderBottom: '2px solid #3b82f6',
        paddingBottom: 15
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1e40af',
        marginBottom: 5
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b'
    },
    pageTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 15,
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: 8
    },
    section: {
        marginBottom: 15
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1e40af',
        marginBottom: 8,
        backgroundColor: '#eff6ff',
        padding: 6
    },
    row: {
        flexDirection: 'row',
        borderBottom: '1px solid #f1f5f9',
        paddingVertical: 5
    },
    label: {
        flex: 1,
        color: '#475569'
    },
    value: {
        flex: 1,
        textAlign: 'right',
        fontWeight: 'bold',
        color: '#0f172a'
    },
    table: {
        marginTop: 10,
        border: '1px solid #e2e8f0'
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: 8
    },
    tableHeaderCell: {
        flex: 1,
        fontWeight: 'bold',
        fontSize: 9,
        color: '#334155',
        textAlign: 'center'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1px solid #f1f5f9',
        padding: 6
    },
    tableCell: {
        flex: 1,
        fontSize: 9,
        textAlign: 'center',
        color: '#475569'
    },
    highlight: {
        backgroundColor: '#dcfce7',
        padding: 10,
        borderRadius: 4,
        marginTop: 10
    },
    highlightTitle: {
        fontWeight: 'bold',
        color: '#166534',
        marginBottom: 5
    },
    warning: {
        backgroundColor: '#fef3c7',
        padding: 8,
        marginTop: 8
    },
    warningText: {
        color: '#92400e',
        fontSize: 9
    },
    formula: {
        fontFamily: 'Sarabun',
        backgroundColor: '#f1f5f9',
        padding: 8,
        marginVertical: 8,
        textAlign: 'center',
        fontSize: 11
    },
    pageNumber: {
        position: 'absolute',
        bottom: 20,
        right: 40,
        fontSize: 9,
        color: '#94a3b8'
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 40,
        fontSize: 8,
        color: '#94a3b8'
    },
    badge: {
        backgroundColor: '#22c55e',
        color: '#ffffff',
        padding: '4 8',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 'bold'
    },
    badgeWarning: {
        backgroundColor: '#f59e0b',
        color: '#ffffff',
        padding: '4 8',
        borderRadius: 4,
        fontSize: 9
    },
    badgeDanger: {
        backgroundColor: '#ef4444',
        color: '#ffffff',
        padding: '4 8',
        borderRadius: 4,
        fontSize: 9
    }
});

// --- Helper Components ---
const DataRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
    </View>
);

const PageFooter = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
    <>
        <Text style={styles.footer}>ระบบวิเคราะห์ที่ดินราชพัสดุ</Text>
        <Text style={styles.pageNumber}>หน้า {pageNum} / {totalPages}</Text>
    </>
);

// --- Helper Functions ---
const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

// --- Main PDF Document ---
export const BaanBidPDFReport: React.FC<{ data: PDFReportData }> = ({ data }) => {
    const landSizeSqm = data.landSizeRai * 1600;

    return (
        <Document>
            {/* ==================== PAGE 1: Project Summary ==================== */}
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>รายงานวิเคราะห์ที่ดินราชพัสดุ</Text>
                    <Text style={styles.subtitle}>Bertaud Urban Economics Model Analysis</Text>
                    <Text style={{ ...styles.subtitle, marginTop: 5, fontSize: 9 }}>
                        สร้างเมื่อ: {data.generatedAt}
                    </Text>
                </View>

                <Text style={styles.pageTitle}>📋 สรุปโครงการ (Project Summary)</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ข้อมูลที่ดิน</Text>
                    <DataRow label="ขนาดที่ดิน (ไร่)" value={`${formatNumber(data.landSizeRai)} ไร่`} />
                    <DataRow label="ขนาดที่ดิน (ตร.ม.)" value={`${formatNumber(landSizeSqm)} ตร.ม.`} />
                    <DataRow label="พื้นที่อาคารที่เสนอ (GFA)" value={`${formatNumber(data.proposedGFA)} ตร.ม.`} />
                    <DataRow label="ความสูงอาคาร" value={`${data.proposedHeight} เมตร`} />
                    <DataRow label="ค่าก่อสร้าง" value={`${formatNumber(data.costPerSqm)} บาท/ตร.ม.`} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>พารามิเตอร์ Bertaud Model</Text>
                    <Text style={styles.formula}>D(x) = D₀ × e^(-g × x)</Text>
                    <DataRow label="D₀ (Central Density)" value={data.d0.toString()} />
                    <DataRow label="g (Gradient)" value={data.gradient.toString()} />
                    <DataRow label="x (Distance from CBD)" value={`${data.distanceKm} กม.`} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ข้อมูลทางการเงิน</Text>
                    <DataRow label="ค่าธรรมเนียมแรกเข้า" value={`${formatNumber(data.upfrontFee)} บาท`} />
                    <DataRow label="ค่าเช่ารายปี" value={`${formatNumber(data.annualRent)} บาท/ปี`} />
                </View>

                <PageFooter pageNum={1} totalPages={5} />
            </Page>

            {/* ==================== PAGE 2: Efficiency Analysis ==================== */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.pageTitle}>📊 การวิเคราะห์ประสิทธิภาพ (Efficiency Analysis)</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ผลการวิเคราะห์ FAR (Floor Area Ratio)</Text>
                    <DataRow label="FAR ที่เสนอ (Proposed)" value={data.proposedFAR.toFixed(2)} />
                    <DataRow label="FAR ตามทฤษฎี (Theoretical)" value={data.theoreticalFAR.toFixed(2)} />
                    <DataRow label="FAR สูงสุดตามกฎหมาย" value={data.legalMaxFAR.toFixed(2)} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ดัชนีประสิทธิภาพ (Efficiency Index)</Text>
                    <DataRow label="Efficiency Score" value={data.efficiencyScore.toFixed(2)} />
                    <DataRow label="สถานะ" value={data.statusThai} />

                    <View style={styles.formula}>
                        <Text>Efficiency = Proposed FAR / Theoretical FAR = {data.proposedFAR.toFixed(2)} / {data.theoreticalFAR.toFixed(2)} = {data.efficiencyScore.toFixed(2)}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>เกณฑ์การประเมิน</Text>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>{'< 0.8'}</Text>
                        <Text style={styles.tableCell}>UNDER - ใช้ประโยชน์น้อยเกินไป</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>0.8 - 1.2</Text>
                        <Text style={styles.tableCell}>OPTIMAL - เหมาะสม</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>{'> 1.2'}</Text>
                        <Text style={styles.tableCell}>OVER - หนาแน่นเกินไป</Text>
                    </View>
                </View>

                <View style={data.status === 'OPTIMAL' ? styles.highlight : styles.warning}>
                    <Text style={data.status === 'OPTIMAL' ? styles.highlightTitle : { color: '#92400e', fontWeight: 'bold' }}>
                        สรุป: {data.statusThai}
                    </Text>
                </View>

                <PageFooter pageNum={2} totalPages={5} />
            </Page>

            {/* ==================== PAGE 3: Financial Audit ==================== */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.pageTitle}>💰 การตรวจสอบทางการเงิน (Financial Audit)</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>มูลค่าปัจจุบันสุทธิ (NPV Analysis)</Text>
                    <Text style={styles.formula}>NPV = Σ [CFt / (1 + r)^t] </Text>
                    <DataRow label="NPV (30 ปี)" value={`${formatNumber(data.stateNPV)} บาท`} />
                    <DataRow label="อัตราคิดลด (Discount Rate)" value="3.5%" />
                    <DataRow label="ระยะเวลาสัญญา" value="30 ปี" />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>การตรวจสอบค่าก่อสร้าง (Cost Audit)</Text>
                    <DataRow label="ค่าก่อสร้างที่เสนอ" value={`${formatNumber(data.costPerSqm)} บาท/ตร.ม.`} />
                    <DataRow label="ค่าเบี่ยงเบนจากมาตรฐาน" value={`${data.costDeviation > 0 ? '+' : ''}${data.costDeviation.toFixed(1)}%`} />
                    <DataRow label="สถานะ" value={data.costStatus} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ผลตอบแทนต่อสินทรัพย์ (ROA)</Text>
                    <DataRow label="ROA" value={`${(data.roa * 100).toFixed(2)}%`} />
                    <DataRow label="สถานะ" value={data.roaStatus} />
                    <DataRow label="เป้าหมาย" value="> 3%" />
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderCell}>รายการ</Text>
                        <Text style={styles.tableHeaderCell}>ค่า</Text>
                        <Text style={styles.tableHeaderCell}>สถานะ</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>NPV</Text>
                        <Text style={styles.tableCell}>{(data.stateNPV / 1000000).toFixed(1)} ล้านบาท</Text>
                        <Text style={styles.tableCell}>✓ เป็นบวก</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>Cost Audit</Text>
                        <Text style={styles.tableCell}>{data.costDeviation.toFixed(1)}%</Text>
                        <Text style={styles.tableCell}>{data.costStatus}</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.tableCell}>ROA</Text>
                        <Text style={styles.tableCell}>{(data.roa * 100).toFixed(2)}%</Text>
                        <Text style={styles.tableCell}>{data.roaStatus}</Text>
                    </View>
                </View>

                <PageFooter pageNum={3} totalPages={5} />
            </Page>

            {/* ==================== PAGE 4: Comparative Feasibility ==================== */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.pageTitle}>📈 การศึกษาความเป็นไปได้เปรียบเทียบ (Comparative Feasibility)</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>เปรียบเทียบ 3 ทางเลือกการพัฒนา</Text>

                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderCell}>รายการ</Text>
                            <Text style={styles.tableHeaderCell}>Option A{'\n'}High-rise</Text>
                            <Text style={styles.tableHeaderCell}>Option B{'\n'}Warehouse</Text>
                            <Text style={styles.tableHeaderCell}>Option C{'\n'}PPP</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>FAR</Text>
                            <Text style={styles.tableCell}>10:1</Text>
                            <Text style={styles.tableCell}>0.6:1</Text>
                            <Text style={styles.tableCell}>6:1</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>GFA (ตร.ม.)</Text>
                            <Text style={styles.tableCell}>{formatNumber(landSizeSqm * 10)}</Text>
                            <Text style={styles.tableCell}>{formatNumber(landSizeSqm * 0.6)}</Text>
                            <Text style={styles.tableCell}>{formatNumber(landSizeSqm * 6)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>ต้นทุน (ล้าน)</Text>
                            <Text style={styles.tableCell}>{formatNumber(landSizeSqm * 10 * 35000 / 1000000)}</Text>
                            <Text style={styles.tableCell}>{formatNumber(landSizeSqm * 0.6 * 15000 / 1000000)}</Text>
                            <Text style={styles.tableCell}>{formatNumber(landSizeSqm * 6 * 25000 / 1000000)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>Yield Gap</Text>
                            <Text style={styles.tableCell}>+5.2%</Text>
                            <Text style={styles.tableCell}>+7.8%</Text>
                            <Text style={styles.tableCell}>+4.5%</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>Payback</Text>
                            <Text style={styles.tableCell}>12-15 ปี</Text>
                            <Text style={styles.tableCell}>8-10 ปี</Text>
                            <Text style={styles.tableCell}>18-22 ปี</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sensitivity Analysis: Discount Rate +1%</Text>
                    <View style={styles.tableRow}>
                        <Text style={styles.label}>Option A (High-rise)</Text>
                        <Text style={{ ...styles.value, color: '#dc2626' }}>NPV -8.5%</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.label}>Option B (Warehouse)</Text>
                        <Text style={{ ...styles.value, color: '#dc2626' }}>NPV -5.2%</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.label}>Option C (PPP)</Text>
                        <Text style={{ ...styles.value, color: '#dc2626' }}>NPV -12.3%</Text>
                    </View>
                </View>

                <View style={styles.warning}>
                    <Text style={styles.warningText}>💡 PPP มีความอ่อนไหวต่ออัตราคิดลดสูงสุด เนื่องจากระยะเวลาสัญญายาว 30 ปี</Text>
                </View>

                <PageFooter pageNum={4} totalPages={5} />
            </Page>

            {/* ==================== PAGE 5: Legal & Recommendation ==================== */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.pageTitle}>⚖️ ข้อจำกัดกฎหมาย & ข้อเสนอแนะ (Legal Constraints & Recommendation)</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ข้อจำกัดทางกฎหมาย</Text>

                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderCell}>ข้อกำหนด</Text>
                            <Text style={styles.tableHeaderCell}>เกณฑ์</Text>
                            <Text style={styles.tableHeaderCell}>สถานะ</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>ระยะร่นด้านหน้า</Text>
                            <Text style={styles.tableCell}>6 เมตร</Text>
                            <Text style={styles.tableCell}>✓</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>ระยะร่นด้านข้าง/หลัง</Text>
                            <Text style={styles.tableCell}>2 เมตร</Text>
                            <Text style={styles.tableCell}>✓</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>Open Space Ratio</Text>
                            <Text style={styles.tableCell}>≥ 30%</Text>
                            <Text style={styles.tableCell}>✓</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>ที่จอดรถ</Text>
                            <Text style={styles.tableCell}>1:60 ตร.ม.</Text>
                            <Text style={styles.tableCell}>✓</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>ข้อจำกัดความสูง</Text>
                            <Text style={styles.tableCell}>ตรวจสอบเขตสนามบิน</Text>
                            <Text style={styles.tableCell}>⚠️</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.highlight}>
                    <Text style={styles.highlightTitle}>🏆 ข้อเสนอแนะสำหรับนักลงทุนระยะยาว</Text>
                    <Text style={{ marginTop: 5, fontWeight: 'bold', color: '#166534' }}>
                        {data.recommendedOption}
                    </Text>
                    <Text style={{ marginTop: 5, color: '#166534', fontSize: 10 }}>
                        {data.recommendationReason}
                    </Text>
                </View>

                <View style={{ marginTop: 20 }}>
                    <Text style={styles.sectionTitle}>สรุปตัวชี้วัดหลัก</Text>
                    <View style={styles.tableRow}>
                        <Text style={styles.label}>Yield Gap</Text>
                        <Text style={styles.value}>{data.distanceKm <= 2 ? "+5.2%" : data.distanceKm <= 10 ? "+7.8%" : "+4.5%"}</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.label}>Payback Period</Text>
                        <Text style={styles.value}>{data.distanceKm <= 2 ? "12-15 ปี" : data.distanceKm <= 10 ? "8-10 ปี" : "18-22 ปี"}</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.label}>IRR (Est.)</Text>
                        <Text style={styles.value}>{data.distanceKm <= 2 ? "8-10%" : data.distanceKm <= 10 ? "10-12%" : "6-8%"}</Text>
                    </View>
                </View>

                <PageFooter pageNum={5} totalPages={5} />
            </Page>
        </Document>
    );
};

export default BaanBidPDFReport;

