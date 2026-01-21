import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, Calculator, Building, Coins, FileText, CheckCircle2, XCircle, AlertTriangle, Download, HelpCircle, X, BookOpen, TrendingUp, MapPin, Scale, Landmark, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { calculateFAR, isFARError, type FARInputs } from './utils/farCalculation';
import { downloadBaanBidPDF, type PDFReportData } from './components/pdfExportUtils';

// --- NumberInput Component with comma formatting ---
interface NumberInputProps {
    id: string;
    value: number;
    onChange: (value: number) => void;
    className: string; // Make className required
    min?: number;
}

function NumberInput({ id, value, onChange, className, min = 0 }: NumberInputProps) {
    const [displayValue, setDisplayValue] = useState(value.toLocaleString('en-US'));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_isFocused, setIsFocused] = useState(false);

    // Format number with commas
    const formatNumber = (num: number) => num.toLocaleString('en-US');

    // Parse string to number (remove commas)
    const parseNumber = (str: string) => {
        const cleaned = str.replace(/,/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        // Allow only numbers and commas
        const cleaned = rawValue.replace(/[^0-9.,]/g, '');
        setDisplayValue(cleaned);
        
        const numValue = parseNumber(cleaned);
        if (numValue >= min) {
            onChange(numValue);
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
        // Show raw number on focus for easier editing
        setDisplayValue(value.toString());
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Format with commas on blur
        setDisplayValue(formatNumber(value));
    };

    // Sync display value when value prop changes (from outside)
    React.useEffect(() => {
        setDisplayValue(formatNumber(value));
    }, [value]);

    return (
        <input
            id={id}
            type="text"
            inputMode="numeric"
            value={displayValue}
            title={id} // Add title attribute
            placeholder={id} // Add placeholder attribute
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={className}
        />
    );
}

// --- Types ---
interface AuditResult {
    efficiencyIndex: number;
    status: 'ใช้ประโยชน์น้อยเกินไป (Under)' | 'เหมาะสม (Optimal)' | 'หนาแน่นเกินไป (Over)';
    stateNPV: number;
    costStatus: 'ผ่านเกณฑ์ (Pass)' | 'พบความผิดปกติ (Anomaly)';
    costDeviation: number;
    roa: number;
    roaStatus: 'ต่ำกว่าเป้าหมาย (Low)' | 'ตามเป้าหมาย (Target)';
}

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export default function ProjectAuditDashboard() {
    // --- State: Project Inputs ---
    const [landSizeRai, setLandSizeRai] = useState<number>(5);
    const [proposedHeight, setProposedHeight] = useState<number>(30); // Meters
    const [costPerSqm, setCostPerSqm] = useState<number>(25000);
    const [upfrontFee, setUpfrontFee] = useState<number>(50000000);
    const [annualRent, setAnnualRent] = useState<number>(12000000);
    const [proposedGFA, setProposedGFA] = useState<number>(40000); // Gross Floor Area
    
    // --- State: Help Modal ---
    const [showHelp, setShowHelp] = useState<boolean>(false);
    const [helpSection, setHelpSection] = useState<string>('overview');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    // --- State: Bertaud Model Parameters ---
    // D(x) = D₀ × e^(-g × x)
    const [d0, setD0] = useState<number>(10);       // D₀: Central Density (FAR at CBD)
    const [gradient, setGradient] = useState<number>(0.1); // g: Density Gradient
    const [distanceKm, setDistanceKm] = useState<number>(2); // x: Distance from CBD (km)

    // --- Derived State (Memoized Calculations) ---
    const result = React.useMemo<AuditResult & { proposedFAR: number; theoreticalFAR: number } | null>(() => {
        // Guard: Zero Division / Invalid Inputs
        if (landSizeRai <= 0 || proposedGFA <= 0) return null;

        // 1. Use FAR Calculation Utility (Bertaud Model)
        const farInputs: FARInputs = {
            landSizeRai,
            proposedGFA,
            d0,
            g: gradient,
            distanceKm,
            legalMaxFAR: d0  // Legal Max = D₀
        };

        const farResult = calculateFAR(farInputs);

        // Handle error case
        if (isFARError(farResult)) {
            console.error('FAR Calculation Error:', farResult.messageThai);
            return null;
        }

        // Extract values from utility result
        const { proposedFar: proposedFAR, theoreticalFar: theoreticalFAR, efficiencyScore: efficiencyIndex } = farResult;

        // Map status from utility to component status type
        let status: AuditResult['status'] = 'เหมาะสม (Optimal)';
        if (farResult.status === 'UNDER') status = 'ใช้ประโยชน์น้อยเกินไป (Under)';
        if (farResult.status === 'OVER') status = 'หนาแน่นเกินไป (Over)';

        // 2. Financial Logic - NPV
        // Simplified 30 year calculation
        let npv = upfrontFee;
        let currentRent = annualRent;
        const discountRate = 0.035;
        for (let yr = 1; yr <= 30; yr++) {
            if (yr > 1 && (yr - 1) % 5 === 0) currentRent *= 1.15;
            npv += currentRent / Math.pow(1 + discountRate, yr);
        }
        // Terminal value mock
        npv += (costPerSqm * proposedGFA * 0.2) / Math.pow(1 + discountRate, 30); // 20% residual

        // 3. Cost Validation
        const isHighRise = proposedHeight > 23;
        const standardCost = isHighRise ? 30000 : 15000;
        const deviation = (costPerSqm - standardCost) / standardCost;
        const costStatus = Math.abs(deviation) > 0.2 ? 'พบความผิดปกติ (Anomaly)' : 'ผ่านเกณฑ์ (Pass)';

        // 4. ROA
        const investment = costPerSqm * proposedGFA;
        // Zero Division Guard for investment
        const roa = investment > 0 ? (npv / 30) / investment : 0;
        const roaStatus = roa < 0.03 ? 'ต่ำกว่าเป้าหมาย (Low)' : 'ตามเป้าหมาย (Target)';

        return {
            efficiencyIndex,
            status,
            stateNPV: npv,
            costStatus,
            costDeviation: deviation * 100,
            roa,
            roaStatus,
            proposedFAR,
            theoreticalFAR
        };
    }, [landSizeRai, proposedHeight, costPerSqm, upfrontFee, annualRent, proposedGFA, d0, gradient, distanceKm]);

    // --- Visual Helpers ---
    const getStatusColor = (status: string) => {
        if (status === 'เหมาะสม (Optimal)' || status === 'ผ่านเกณฑ์ (Pass)' || status === 'ตามเป้าหมาย (Target)') return 'text-green-600 bg-green-50 border-green-200';
        if (status === 'ใช้ประโยชน์น้อยเกินไป (Under)') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const chartData = React.useMemo(() => {
        if (!result) return [];
        // Use the calculated FAR values from the result object for clarity and traceability
        return [
            { name: 'ที่เสนอ (Proposed)', far: result.proposedFAR.toFixed(2) },
            { name: 'ตามทฤษฎี (Optimal)', far: result.theoreticalFAR.toFixed(2) }, // Dynamically calculated
            { name: 'กฎหมาย (Legal Max)', far: d0.toFixed(2) }, // Legal Max = D₀ (FAR at CBD)
        ];
    }, [result, d0]);

    // --- PDF Export Handler ---
    const handleExportPDF = async () => {
        if (!result) return;

        const reportData: PDFReportData = {
            // Project Info
            landSizeRai,
            proposedGFA,
            proposedHeight,
            costPerSqm,

            // Bertaud Parameters
            d0,
            gradient,
            distanceKm,

            // FAR Results
            proposedFAR: result.proposedFAR,
            theoreticalFAR: result.theoreticalFAR,
            legalMaxFAR: d0,
            efficiencyScore: result.efficiencyIndex,
            status: result.efficiencyIndex < 0.8 ? 'UNDER' : result.efficiencyIndex > 1.2 ? 'OVER' : 'OPTIMAL',
            statusThai: result.status,

            // Financial Results
            stateNPV: result.stateNPV,
            upfrontFee,
            annualRent,
            costDeviation: result.costDeviation,
            costStatus: result.costStatus,
            roa: result.roa,
            roaStatus: result.roaStatus,

            // Recommendation
            recommendedOption: distanceKm <= 2 ? 'Option A: High-rise Development' :
                distanceKm <= 10 ? 'Option B: Premium Warehouse' :
                    'Option C: PPP Partnership',
            recommendationReason: distanceKm <= 2 ? 'ที่ดินใกล้ CBD (≤2 กม.) มีศักยภาพสูงสุดในการพัฒนาแนวดิ่ง เพื่อใช้ประโยชน์จาก Land Value สูงสุด' :
                distanceKm <= 10 ? 'ที่ดินชานเมือง (2-10 กม.) เหมาะกับ Warehouse ที่มี Yield สูงและ Payback Period สั้น' :
                    'ที่ดินห่างไกล (>10 กม.) เหมาะกับ PPP เพื่อลดความเสี่ยงและใช้ประโยชน์จากเงินทุนรัฐ',

            // Metadata
            generatedAt: new Date().toLocaleString('th-TH')
        };

        await downloadBaanBidPDF(reportData);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex items-center justify-between pb-6 border-b border-slate-200">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg">
                            <Building className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">ระบบวิเคราะห์เศรษฐศาสตร์เมืองและความเป็นไปได้ทางการเงิน</h1>
                            <p className="text-slate-500">Bertaud Urban Economics & Financial Feasibility Analysis</p>
                            <p className="text-xs text-slate-400 mt-1">พัฒนาโดย <span className="font-semibold text-blue-600">A.THONGCHART</span></p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setShowHelp(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
                            title="คู่มือการใช้งาน"
                        >
                            <HelpCircle className="w-5 h-5" />
                            <span>Help</span>
                        </button>
                        {result && (
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
                            >
                                <Download className="w-5 h-5" />
                                <span>ส่งออก PDF</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Help Modal */}
                {showHelp && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-emerald-600 rounded-lg">
                                        <BookOpen className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">คู่มือการใช้งาน</h2>
                                        <p className="text-sm text-slate-500">Bertaud Urban Economics & Financial Feasibility Analysis</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowHelp(false)}
                                    className="p-2 hover:bg-slate-200 rounded-lg transition"
                                    aria-label="ปิด"
                                >
                                    <X className="w-6 h-6 text-slate-500" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex flex-1 overflow-hidden">
                                {/* Sidebar Navigation */}
                                <nav className="w-64 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto">
                                    <ul className="space-y-1">
                                        {[
                                            { id: 'overview', label: 'ภาพรวมแอปพลิเคชัน', icon: Building },
                                            { id: 'bertaud', label: 'ทฤษฎี Bertaud Model', icon: TrendingUp },
                                            { id: 'variables', label: 'ตัวแปรและพารามิเตอร์', icon: Scale },
                                            { id: 'financial', label: 'การวิเคราะห์การเงิน', icon: Coins },
                                            { id: 'options', label: 'ทางเลือกการพัฒนา', icon: MapPin },
                                            { id: 'legal', label: 'ข้อจำกัดทางกฎหมาย', icon: Landmark },
                                            { id: 'faq', label: 'คำถามที่พบบ่อย', icon: HelpCircle },
                                        ].map(({ id, label, icon: Icon }) => (
                                            <li key={id}>
                                                <button
                                                    onClick={() => setHelpSection(id)}
                                                    className={cn(
                                                        "w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition",
                                                        helpSection === id
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "text-slate-600 hover:bg-slate-100"
                                                    )}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                    <span>{label}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </nav>

                                {/* Content Area */}
                                <div className="flex-1 p-6 overflow-y-auto">
                                    {/* Overview Section */}
                                    {helpSection === 'overview' && (
                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-800 mb-3">ภาพรวมแอปพลิเคชัน</h3>
                                                <p className="text-slate-600 leading-relaxed">
                                                    ระบบวิเคราะห์เศรษฐศาสตร์เมืองและความเป็นไปได้ทางการเงิน (Bertaud Urban Economics & Financial Feasibility Analysis) 
                                                    เป็นเครื่องมือวิเคราะห์ที่ใช้หลักการ <strong>Monocentric City Model</strong> ของ <strong>Alain Bertaud</strong> 
                                                    เพื่อประเมินความเหมาะสมของโครงการพัฒนาอสังหาริมทรัพย์
                                                </p>
                                            </div>

                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                                                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                                                    <AlertCircle className="w-5 h-5 mr-2" />
                                                    จุดประสงค์หลักของระบบ
                                                </h4>
                                                <ul className="space-y-2 text-blue-700">
                                                    <li className="flex items-start space-x-2">
                                                        <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0" />
                                                        <span><strong>วิเคราะห์ความหนาแน่น (FAR)</strong> - คำนวณ Floor Area Ratio ที่เหมาะสมตามทำเลที่ตั้ง</span>
                                                    </li>
                                                    <li className="flex items-start space-x-2">
                                                        <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0" />
                                                        <span><strong>ตรวจสอบความเป็นไปได้ทางการเงิน</strong> - คำนวณ NPV, ROA, และตรวจสอบค่าก่อสร้าง</span>
                                                    </li>
                                                    <li className="flex items-start space-x-2">
                                                        <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0" />
                                                        <span><strong>เปรียบเทียบทางเลือกการพัฒนา</strong> - High-rise, Warehouse, หรือ PPP</span>
                                                    </li>
                                                    <li className="flex items-start space-x-2">
                                                        <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0" />
                                                        <span><strong>ออกรายงาน PDF</strong> - สร้างรายงานวิเคราะห์โครงการอย่างเป็นระบบ</span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 text-center">
                                                    <Calculator className="w-10 h-10 text-purple-600 mx-auto mb-2" />
                                                    <h5 className="font-semibold text-purple-800">วิเคราะห์ FAR</h5>
                                                    <p className="text-sm text-purple-600 mt-1">ตามทฤษฎี Bertaud</p>
                                                </div>
                                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center">
                                                    <Coins className="w-10 h-10 text-green-600 mx-auto mb-2" />
                                                    <h5 className="font-semibold text-green-800">ตรวจสอบการเงิน</h5>
                                                    <p className="text-sm text-green-600 mt-1">NPV, ROA, Cost Audit</p>
                                                </div>
                                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
                                                    <FileText className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                                                    <h5 className="font-semibold text-amber-800">ออกรายงาน</h5>
                                                    <p className="text-sm text-amber-600 mt-1">PDF Report</p>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-semibold text-slate-700 mb-3">ขั้นตอนการใช้งาน</h4>
                                                <ol className="space-y-3">
                                                    {[
                                                        'กรอกข้อมูลโครงการ: ขนาดที่ดิน, พื้นที่อาคาร, ความสูง, ค่าก่อสร้าง',
                                                        'กรอกข้อเสนอการเงิน: ค่าธรรมเนียมแรกเข้า, ค่าเช่ารายปี',
                                                        'ตั้งค่าพารามิเตอร์ Bertaud: D₀, g, และระยะห่างจาก CBD',
                                                        'ดูผลการวิเคราะห์: ดัชนีประสิทธิภาพ, NPV, ROA, และทางเลือกที่เหมาะสม',
                                                        'ส่งออกรายงาน PDF เพื่อใช้ประกอบการตัดสินใจ'
                                                    ].map((step, idx) => (
                                                        <li key={idx} className="flex items-start space-x-3">
                                                            <span className="flex-shrink-0 w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-slate-600">{step}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bertaud Model Section */}
                                    {helpSection === 'bertaud' && (
                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-800 mb-3">ทฤษฎี Bertaud Model</h3>
                                                <p className="text-slate-600 leading-relaxed">
                                                    <strong>Alain Bertaud</strong> เป็นนักเศรษฐศาสตร์เมืองและนักวางผังเมืองชาวฝรั่งเศส 
                                                    ผู้พัฒนาแบบจำลอง <strong>Monocentric City Model</strong> ที่อธิบายรูปแบบความหนาแน่นของเมืองตามระยะทางจากศูนย์กลาง
                                                </p>
                                            </div>

                                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                                                <h4 className="font-bold text-blue-800 mb-4">สมการหลัก: Density Gradient Function</h4>
                                                <div className="bg-white p-4 rounded-lg border border-blue-200 text-center mb-4">
                                                    <p className="text-2xl font-mono text-slate-800">
                                                        D(x) = D<sub>0</sub> × e<sup>−gx</sup>
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div className="bg-white/50 p-3 rounded-lg">
                                                        <p className="font-semibold text-blue-700">D(x) = Theoretical FAR</p>
                                                        <p className="text-slate-600">ความหนาแน่นที่เหมาะสม ณ ระยะ x จาก CBD</p>
                                                    </div>
                                                    <div className="bg-white/50 p-3 rounded-lg">
                                                        <p className="font-semibold text-blue-700">D₀ = Central Density</p>
                                                        <p className="text-slate-600">ความหนาแน่นสูงสุดที่ศูนย์กลางเมือง (CBD)</p>
                                                    </div>
                                                    <div className="bg-white/50 p-3 rounded-lg">
                                                        <p className="font-semibold text-blue-700">g = Density Gradient</p>
                                                        <p className="text-slate-600">ค่าสัมประสิทธิ์อัตราการลดลงของความหนาแน่น</p>
                                                    </div>
                                                    <div className="bg-white/50 p-3 rounded-lg">
                                                        <p className="font-semibold text-blue-700">x = Distance from CBD</p>
                                                        <p className="text-slate-600">ระยะทางจากศูนย์กลางธุรกิจ (กิโลเมตร)</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-semibold text-slate-700 mb-3">หลักการสำคัญ</h4>
                                                <ul className="space-y-3 text-slate-600">
                                                    <li className="flex items-start space-x-3">
                                                        <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</span>
                                                        <div>
                                                            <strong>ยิ่งใกล้ CBD ยิ่งหนาแน่น:</strong> ความหนาแน่นของการใช้ที่ดินสูงสุดที่ศูนย์กลางเมือง 
                                                            และลดลงแบบ Exponential เมื่อห่างออกไป
                                                        </div>
                                                    </li>
                                                    <li className="flex items-start space-x-3">
                                                        <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</span>
                                                        <div>
                                                            <strong>ราคาที่ดินกำหนดความหนาแน่น:</strong> ที่ดินใกล้ CBD มีราคาสูง 
                                                            จึงต้องสร้างอาคารสูงเพื่อให้คุ้มค่าการลงทุน
                                                        </div>
                                                    </li>
                                                    <li className="flex items-start space-x-3">
                                                        <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</span>
                                                        <div>
                                                            <strong>ดัชนีประสิทธิภาพ:</strong> เปรียบเทียบ FAR ที่เสนอกับ FAR ตามทฤษฎี 
                                                            หากต่ำกว่า 0.8 = Under (ใช้ที่ดินไม่คุ้ม), 0.8-1.2 = Optimal, มากกว่า 1.2 = Over (หนาแน่นเกิน)
                                                        </div>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                                                <h4 className="font-semibold text-amber-800 mb-3 flex items-center">
                                                    <AlertTriangle className="w-5 h-5 mr-2" />
                                                    ตัวอย่างการคำนวณ
                                                </h4>
                                                <div className="bg-white p-4 rounded-lg border border-amber-200 font-mono text-sm mb-3">
                                                    <p>สมมติ: D₀ = 10, g = 0.1, x = 2 กม.</p>
                                                    <p className="mt-2">D(2) = 10 × e<sup>−0.1×2</sup> = 10 × e<sup>−0.2</sup> = 10 × 0.8187 = <strong>8.19</strong></p>
                                                    <p className="mt-2 text-emerald-700">ความหนาแน่นที่เหมาะสม ณ ระยะ 2 กม. จาก CBD คือ FAR 8.19</p>
                                                </div>
                                                <p className="text-sm text-amber-700">
                                                    หากโครงการเสนอ FAR = 5.00 → ดัชนีประสิทธิภาพ = 5.00 / 8.19 = 0.61 (UNDER - ใช้ที่ดินไม่เต็มศักยภาพ)
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variables Section */}
                                    {helpSection === 'variables' && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-3">ตัวแปรและพารามิเตอร์</h3>
                                            
                                            {/* Project Variables */}
                                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                                                <h4 className="font-bold text-slate-700 mb-4 flex items-center">
                                                    <FileText className="w-5 h-5 mr-2 text-blue-600" />
                                                    ข้อมูลโครงการ
                                                </h4>
                                                <div className="space-y-4">
                                                    {[
                                                        { name: 'ขนาดที่ดิน (ไร่)', desc: 'พื้นที่ที่ดินทั้งหมดของโครงการ โดย 1 ไร่ = 1,600 ตร.ม.', example: '5 ไร่ = 8,000 ตร.ม.' },
                                                        { name: 'พื้นที่อาคารรวม (GFA)', desc: 'Gross Floor Area - พื้นที่อาคารทุกชั้นรวมกัน ใช้คำนวณ FAR ที่เสนอ', example: '40,000 ตร.ม.' },
                                                        { name: 'ความสูงอาคาร (ม.)', desc: 'ความสูงอาคารจากพื้นดินถึงยอด ใช้กำหนดมาตรฐานค่าก่อสร้าง (>23ม. = อาคารสูง)', example: '30 เมตร = อาคารสูง' },
                                                        { name: 'ค่าก่อสร้าง (บาท/ตร.ม.)', desc: 'ต้นทุนการก่อสร้างต่อตารางเมตร ใช้ตรวจสอบความผิดปกติของราคา', example: '25,000 บาท/ตร.ม.' },
                                                    ].map(({ name, desc, example }, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100">
                                                            <p className="font-semibold text-slate-800">{name}</p>
                                                            <p className="text-sm text-slate-600 mt-1">{desc}</p>
                                                            <p className="text-xs text-emerald-600 mt-1">ตัวอย่าง: {example}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Financial Variables */}
                                            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                                                <h4 className="font-bold text-green-700 mb-4 flex items-center">
                                                    <Coins className="w-5 h-5 mr-2" />
                                                    ข้อเสนอด้านการเงิน
                                                </h4>
                                                <div className="space-y-4">
                                                    {[
                                                        { name: 'ค่าธรรมเนียมแรกเข้า', desc: 'เงินก้อนที่ผู้เช่าจ่ายครั้งเดียวตอนเริ่มสัญญา', example: '50,000,000 บาท' },
                                                        { name: 'ค่าเช่ารายปี', desc: 'ค่าเช่าที่จ่ายทุกปี (ปรับขึ้น 15% ทุก 5 ปี)', example: '12,000,000 บาท/ปี' },
                                                    ].map(({ name, desc, example }, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-lg border border-green-100">
                                                            <p className="font-semibold text-green-800">{name}</p>
                                                            <p className="text-sm text-slate-600 mt-1">{desc}</p>
                                                            <p className="text-xs text-emerald-600 mt-1">ตัวอย่าง: {example}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Bertaud Parameters */}
                                            <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
                                                <h4 className="font-bold text-orange-700 mb-4 flex items-center">
                                                    <TrendingUp className="w-5 h-5 mr-2" />
                                                    พารามิเตอร์ Bertaud Model
                                                </h4>
                                                <div className="space-y-4">
                                                    <div className="bg-white p-4 rounded-lg border border-orange-100">
                                                        <p className="font-semibold text-orange-800">D₀ (ความหนาแน่นศูนย์กลาง)</p>
                                                        <p className="text-sm text-slate-600 mt-1">FAR สูงสุดที่ศูนย์กลางเมือง (CBD) - แสดงระดับการพัฒนาของเมือง</p>
                                                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                            <span className="bg-orange-100 px-2 py-1 rounded">8 = เมืองขนาดเล็ก</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">10 = เมืองขนาดกลาง</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">12 = มหานครใหญ่</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">15 = มหานครหนาแน่นมาก</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-lg border border-orange-100">
                                                        <p className="font-semibold text-orange-800">g (อัตราลดความหนาแน่น)</p>
                                                        <p className="text-sm text-slate-600 mt-1">Density Gradient - ค่ายิ่งสูง ความหนาแน่นยิ่งลดเร็วเมื่อห่างจาก CBD</p>
                                                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                            <span className="bg-orange-100 px-2 py-1 rounded">0.05 = Sprawl (เมืองกระจาย)</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">0.10 = ปกติ (Default)</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">0.15 = Compact (เมืองกระชับ)</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">0.20 = เข้มข้นมาก</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-lg border border-orange-100">
                                                        <p className="font-semibold text-orange-800">x (ระยะห่างจาก CBD)</p>
                                                        <p className="text-sm text-slate-600 mt-1">ระยะทางจากศูนย์กลางธุรกิจ (Central Business District) หน่วยกิโลเมตร</p>
                                                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                                            <span className="bg-orange-100 px-2 py-1 rounded">0 กม. = CBD</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">2 กม. = ใกล้ศูนย์กลาง</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">5 กม. = ชานเมืองใน</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">10 กม. = ชานเมืองนอก</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">15 กม. = ห่างไกล</span>
                                                            <span className="bg-orange-100 px-2 py-1 rounded">20 กม. = นอกเขตเมือง</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Financial Analysis Section */}
                                    {helpSection === 'financial' && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-3">การวิเคราะห์ความเป็นไปได้ทางการเงิน</h3>
                                            
                                            {/* NPV */}
                                            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                                                <h4 className="font-bold text-green-700 mb-3">1. มูลค่าปัจจุบันสุทธิ (NPV - Net Present Value)</h4>
                                                <div className="bg-white p-4 rounded-lg border border-green-200 text-center mb-3">
                                                    <p className="text-xl font-mono text-slate-800">NPV = Σ [ CFₜ / (1 + r)ᵗ ]</p>
                                                </div>
                                                <ul className="space-y-2 text-sm text-slate-600">
                                                    <li><strong>CFₜ</strong> = กระแสเงินสดสุทธิในปีที่ t (ค่าธรรมเนียม + ค่าเช่า)</li>
                                                    <li><strong>r</strong> = อัตราคิดลด (Discount Rate) ใช้ 3.5% สำหรับโครงการรัฐ</li>
                                                    <li><strong>t</strong> = ปีที่คำนวณ (1 ถึง 30 ปี)</li>
                                                </ul>
                                                <p className="text-sm text-green-700 mt-3">
                                                    💡 NPV เป็นบวก หมายความว่าโครงการให้ผลตอบแทนสูงกว่าอัตราคิดลดที่กำหนด
                                                </p>
                                            </div>

                                            {/* Cost Audit */}
                                            <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                                                <h4 className="font-bold text-amber-700 mb-3">2. ตรวจสอบค่าก่อสร้าง (Cost Audit)</h4>
                                                <p className="text-slate-600 mb-3">เปรียบเทียบค่าก่อสร้างที่เสนอกับมาตรฐาน:</p>
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div className="bg-white p-3 rounded-lg border border-amber-100">
                                                        <p className="font-semibold text-amber-800">อาคารสูง (&gt;23ม.)</p>
                                                        <p className="text-sm text-slate-600">มาตรฐาน: 30,000 บาท/ตร.ม.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-amber-100">
                                                        <p className="font-semibold text-amber-800">อาคารต่ำ (≤23ม.)</p>
                                                        <p className="text-sm text-slate-600">มาตรฐาน: 15,000 บาท/ตร.ม.</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-amber-700">
                                                    ⚠️ หากเบี่ยงเบน &gt;20% จากมาตรฐาน จะแจ้งเตือน "พบความผิดปกติ"
                                                </p>
                                            </div>

                                            {/* ROA */}
                                            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                                                <h4 className="font-bold text-blue-700 mb-3">3. ผลตอบแทนต่อสินทรัพย์ (ROA)</h4>
                                                <div className="bg-white p-4 rounded-lg border border-blue-200 text-center mb-3">
                                                    <p className="text-xl font-mono text-slate-800">ROA = (NPV ÷ 30 ปี) ÷ มูลค่าลงทุน</p>
                                                </div>
                                                <p className="text-slate-600 mb-2">มูลค่าลงทุน = ค่าก่อสร้าง × พื้นที่อาคาร</p>
                                                <p className="text-sm text-blue-700">
                                                    ✅ เป้าหมาย: ROA ≥ 3% ถือว่าตามเป้าหมาย
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Development Options Section */}
                                    {helpSection === 'options' && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-3">ทางเลือกการพัฒนา 3 รูปแบบ</h3>
                                            
                                            <div className="grid gap-4">
                                                {/* Option A */}
                                                <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
                                                    <h4 className="font-bold text-purple-700 mb-2 flex items-center">
                                                        <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center mr-2 text-sm">A</span>
                                                        High-rise Development (FAR 10:1)
                                                    </h4>
                                                    <p className="text-slate-600 mb-3">เหมาะสำหรับที่ดินใกล้ CBD (≤2 กม.)</p>
                                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">ค่าก่อสร้าง</p>
                                                            <p className="font-semibold text-purple-700">35,000 บาท/ตร.ม.</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">รายได้ค่าเช่า</p>
                                                            <p className="font-semibold text-purple-700">600-800 บาท/ตร.ม.</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">Payback</p>
                                                            <p className="font-semibold text-purple-700">12-15 ปี</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Option B */}
                                                <div className="bg-cyan-50 rounded-xl p-5 border border-cyan-200">
                                                    <h4 className="font-bold text-cyan-700 mb-2 flex items-center">
                                                        <span className="w-8 h-8 bg-cyan-600 text-white rounded-full flex items-center justify-center mr-2 text-sm">B</span>
                                                        Premium Warehouse (BCR 60%)
                                                    </h4>
                                                    <p className="text-slate-600 mb-3">เหมาะสำหรับที่ดินชานเมือง (2-10 กม.)</p>
                                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">ค่าก่อสร้าง</p>
                                                            <p className="font-semibold text-cyan-700">15,000 บาท/ตร.ม.</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">รายได้ค่าเช่า</p>
                                                            <p className="font-semibold text-cyan-700">150-200 บาท/ตร.ม.</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">Payback</p>
                                                            <p className="font-semibold text-cyan-700">8-10 ปี</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Option C */}
                                                <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                                                    <h4 className="font-bold text-amber-700 mb-2 flex items-center">
                                                        <span className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center mr-2 text-sm">C</span>
                                                        PPP Partnership (เช่า 30 ปี)
                                                    </h4>
                                                    <p className="text-slate-600 mb-3">เหมาะสำหรับที่ดินห่างไกล (&gt;10 กม.)</p>
                                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">ค่าก่อสร้าง</p>
                                                            <p className="font-semibold text-amber-700">25,000 บาท/ตร.ม.</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">รายได้ค่าเช่า</p>
                                                            <p className="font-semibold text-amber-700">400-500 บาท/ตร.ม.</p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded text-center">
                                                            <p className="text-slate-500">Payback</p>
                                                            <p className="font-semibold text-amber-700">18-22 ปี</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                                                <h4 className="font-semibold text-slate-700 mb-3">Sensitivity Analysis</h4>
                                                <p className="text-slate-600 text-sm mb-3">ผลกระทบเมื่ออัตราคิดลดเพิ่มขึ้น 1% (3.5% → 4.5%)</p>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-white p-3 rounded-lg border text-center">
                                                        <p className="text-purple-600 font-semibold">Option A</p>
                                                        <p className="text-red-600 font-mono">NPV -8.5%</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border text-center">
                                                        <p className="text-cyan-600 font-semibold">Option B</p>
                                                        <p className="text-red-600 font-mono">NPV -5.2%</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border text-center">
                                                        <p className="text-amber-600 font-semibold">Option C</p>
                                                        <p className="text-red-600 font-mono">NPV -12.3%</p>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-3 italic">
                                                    💡 PPP มีความอ่อนไหวต่ออัตราคิดลดสูงสุด เนื่องจากระยะเวลาสัญญายาว 30 ปี
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Legal Constraints Section */}
                                    {helpSection === 'legal' && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-3">ข้อจำกัดทางกฎหมาย</h3>
                                            
                                            <div className="grid gap-4">
                                                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                                                    <h4 className="font-bold text-slate-700 mb-3 flex items-center">
                                                        <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" />
                                                        ระยะร่น (Setback)
                                                    </h4>
                                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                                        <div className="bg-white p-3 rounded-lg border text-center">
                                                            <p className="text-slate-500">ด้านหน้า</p>
                                                            <p className="font-semibold text-slate-800">6 เมตร</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-lg border text-center">
                                                            <p className="text-slate-500">ด้านข้าง</p>
                                                            <p className="font-semibold text-slate-800">2 เมตร</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-lg border text-center">
                                                            <p className="text-slate-500">ด้านหลัง</p>
                                                            <p className="font-semibold text-slate-800">2 เมตร</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                                                    <h4 className="font-bold text-green-700 mb-3 flex items-center">
                                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                                        Open Space Ratio (OSR)
                                                    </h4>
                                                    <p className="text-slate-600">ต้องมีพื้นที่ว่าง ≥30% ของที่ดิน เพื่อเป็นพื้นที่สีเขียวและทางเดิน</p>
                                                </div>

                                                <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                                                    <h4 className="font-bold text-amber-700 mb-3 flex items-center">
                                                        <AlertTriangle className="w-5 h-5 mr-2" />
                                                        ข้อจำกัดความสูง
                                                    </h4>
                                                    <p className="text-slate-600">ตรวจสอบเขตปลอดภัยสนามบิน / เส้นทางบิน ก่อนออกแบบอาคารสูง</p>
                                                </div>

                                                <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                                                    <h4 className="font-bold text-blue-700 mb-3 flex items-center">
                                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                                        ที่จอดรถ
                                                    </h4>
                                                    <p className="text-slate-600">อัตราส่วน 1 คัน : 60 ตร.ม. พื้นที่ใช้สอย</p>
                                                    <p className="text-sm text-blue-600 mt-2">
                                                        ตัวอย่าง: อาคาร 40,000 ตร.ม. ต้องมีที่จอดรถ ≈ 667 คัน
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* FAQ Section */}
                                    {helpSection === 'faq' && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-3">คำถามที่พบบ่อย</h3>
                                            
                                            <div className="space-y-3">
                                                {[
                                                    { 
                                                        q: 'FAR คืออะไร?', 
                                                        a: 'FAR (Floor Area Ratio) คืออัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน เช่น FAR 5:1 หมายถึงพื้นที่อาคาร 5 เท่าของพื้นที่ดิน ที่ดิน 1,600 ตร.ม. สามารถมีอาคาร 8,000 ตร.ม.' 
                                                    },
                                                    { 
                                                        q: 'ทำไมต้องใช้ Bertaud Model?', 
                                                        a: 'Bertaud Model ช่วยหาความหนาแน่นที่ "เหมาะสม" ตามทำเลที่ตั้ง ไม่ใช่แค่ใช้ FAR สูงสุดตามกฎหมาย เพราะการพัฒนาเกินหรือต่ำกว่าศักยภาพของพื้นที่อาจทำให้ไม่คุ้มค่าการลงทุน' 
                                                    },
                                                    { 
                                                        q: 'ดัชนีประสิทธิภาพ (Efficiency Index) แปลว่าอะไร?', 
                                                        a: 'เป็นอัตราส่วน FAR ที่เสนอ ÷ FAR ตามทฤษฎี Bertaud\n• < 0.8 = UNDER (ใช้ที่ดินไม่เต็มศักยภาพ)\n• 0.8-1.2 = OPTIMAL (เหมาะสม)\n• > 1.2 = OVER (หนาแน่นเกินไป)' 
                                                    },
                                                    { 
                                                        q: 'อัตราคิดลด 3.5% มาจากไหน?', 
                                                        a: 'เป็นอัตราคิดลดมาตรฐานสำหรับโครงการภาครัฐ ใกล้เคียงกับอัตราผลตอบแทนพันธบัตรรัฐบาลระยะยาว + Risk Premium เล็กน้อย' 
                                                    },
                                                    { 
                                                        q: 'ทำไมค่าเช่าปรับขึ้น 15% ทุก 5 ปี?', 
                                                        a: 'เป็นเงื่อนไขมาตรฐานในสัญญาเช่าที่ดินราชพัสดุ เพื่อชดเชยเงินเฟ้อและรักษามูลค่าที่แท้จริงของค่าเช่า' 
                                                    },
                                                    { 
                                                        q: 'D₀ กับ Legal Max FAR ต่างกันอย่างไร?', 
                                                        a: 'D₀ คือความหนาแน่นสูงสุดตามทฤษฎีที่ศูนย์กลางเมือง ส่วน Legal Max FAR คือข้อจำกัดตามกฎหมายผังเมือง ซึ่งอาจน้อยกว่าหรือมากกว่า D₀ ได้' 
                                                    },
                                                    { 
                                                        q: 'ถ้าต้องการค่าเฉพาะของเมืองในประเทศไทยควรใช้ค่าอะไร?', 
                                                        a: 'สำหรับกรุงเทพฯ แนะนำ D₀ = 10-12, g = 0.1\nสำหรับเมืองภูมิภาค แนะนำ D₀ = 8, g = 0.15\nค่าเหล่านี้สามารถปรับได้ตามการศึกษาความหนาแน่นจริงของพื้นที่' 
                                                    },
                                                ].map((faq, idx) => (
                                                    <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                                        <button
                                                            onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                                                            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-100 transition"
                                                        >
                                                            <span className="font-semibold text-slate-700">{faq.q}</span>
                                                            {expandedFaq === idx ? (
                                                                <ChevronUp className="w-5 h-5 text-slate-400" />
                                                            ) : (
                                                                <ChevronDown className="w-5 h-5 text-slate-400" />
                                                            )}
                                                        </button>
                                                        {expandedFaq === idx && (
                                                            <div className="px-5 py-4 bg-white border-t border-slate-200">
                                                                <p className="text-slate-600 whitespace-pre-line">{faq.a}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                                <p className="text-sm text-slate-500">
                                    พัฒนาโดย <span className="font-semibold text-blue-600">A.THONGCHART</span>
                                </p>
                                <button
                                    onClick={() => setShowHelp(false)}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                                >
                                    เข้าใจแล้ว
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Input Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h2 className="flex items-center text-lg font-semibold mb-4 text-slate-800">
                                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                                รายละเอียดโครงการ
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="land-size" className="block text-sm font-medium text-slate-600 mb-1">ขนาดที่ดิน (ไร่)</label>
                                    <NumberInput
                                        id="land-size"
                                        value={landSizeRai}
                                        onChange={setLandSizeRai}
                                        className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">= {(landSizeRai * 1600).toLocaleString()} ตร.ม.</p>
                                </div>

                                <div>
                                    <label htmlFor="proposed-gfa" className="block text-sm font-medium text-slate-600 mb-1">พื้นที่อาคารรวม (ตร.ม.)</label>
                                    <NumberInput
                                        id="proposed-gfa"
                                        value={proposedGFA}
                                        onChange={setProposedGFA}
                                        className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="building-height" className="block text-sm font-medium text-slate-600 mb-1">ความสูงอาคาร (เมตร)</label>
                                    <NumberInput
                                        id="building-height"
                                        value={proposedHeight}
                                        onChange={setProposedHeight}
                                        className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="cost-per-sqm" className="block text-sm font-medium text-slate-600 mb-1">ค่าก่อสร้าง (บาท/ตร.ม.)</label>
                                    <NumberInput
                                        id="cost-per-sqm"
                                        value={costPerSqm}
                                        onChange={setCostPerSqm}
                                        className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-2">ข้อเสนอด้านการเงิน (Financial Offer)</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label htmlFor="upfront-fee" className="block text-xs font-medium text-slate-500 mb-1">ค่าธรรมเนียมแรกเข้า (บาท)</label>
                                            <NumberInput
                                                id="upfront-fee"
                                                value={upfrontFee}
                                                onChange={setUpfrontFee}
                                                className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="annual-rent" className="block text-xs font-medium text-slate-500 mb-1">ค่าเช่ารายปี (บาท)</label>
                                            <NumberInput
                                                id="annual-rent"
                                                value={annualRent}
                                                onChange={setAnnualRent}
                                                className="w-full px-3 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bertaud Model Parameters Section */}
                                <div className="pt-4 border-t border-slate-100">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-2">
                                        พารามิเตอร์ Bertaud Model
                                    </h3>
                                    <p className="text-xs text-slate-400 mb-3">D(x) = D₀ × e^(-g × x)</p>
                                    <div className="space-y-4">
                                        {/* D₀ - Central Density */}
                                        <div>
                                            <label htmlFor="d0" className="block text-xs font-medium text-slate-600 mb-1">
                                                D₀ (ความหนาแน่นศูนย์กลาง)
                                            </label>
                                            <select
                                                id="d0"
                                                value={d0}
                                                onChange={(e) => setD0(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-sm"
                                            >
                                                <option value={8}>8 - เมืองขนาดเล็ก</option>
                                                <option value={10}>10 - เมืองขนาดกลาง (Default)</option>
                                                <option value={12}>12 - มหานครขนาดใหญ่</option>
                                                <option value={15}>15 - มหานครหนาแน่นมาก (เช่น ฮ่องกง)</option>
                                            </select>
                                            <p className="text-xs text-slate-400 mt-1 italic">
                                                📌 FAR สูงสุดที่ศูนย์กลางเมือง (CBD)
                                            </p>
                                        </div>

                                        {/* g - Density Gradient */}
                                        <div>
                                            <label htmlFor="gradient" className="block text-xs font-medium text-slate-600 mb-1">
                                                g (อัตราลดความหนาแน่น)
                                            </label>
                                            <select
                                                id="gradient"
                                                value={gradient}
                                                onChange={(e) => setGradient(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-sm"
                                            >
                                                <option value={0.05}>0.05 - Sprawl (ลดช้า เมืองกระจาย)</option>
                                                <option value={0.1}>0.10 - ปกติ (Default)</option>
                                                <option value={0.15}>0.15 - Compact (ลดเร็ว เมืองกระชับ)</option>
                                                <option value={0.2}>0.20 - เข้มข้นมาก</option>
                                            </select>
                                            <p className="text-xs text-slate-400 mt-1 italic">
                                                📌 ค่ายิ่งสูง ความหนาแน่นยิ่งลดเร็วตามระยะทาง
                                            </p>
                                        </div>

                                        {/* x - Distance from CBD */}
                                        <div>
                                            <label htmlFor="distanceKm" className="block text-xs font-medium text-slate-600 mb-1">
                                                x (ระยะห่างจาก CBD)
                                            </label>
                                            <select
                                                id="distanceKm"
                                                value={distanceKm}
                                                onChange={(e) => setDistanceKm(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-sm"
                                            >
                                                <option value={0}>0 กม. - ใจกลางเมือง (CBD)</option>
                                                <option value={2}>2 กม. - ย่านใกล้ศูนย์กลาง</option>
                                                <option value={5}>5 กม. - ชานเมืองชั้นใน</option>
                                                <option value={10}>10 กม. - ชานเมืองชั้นนอก</option>
                                                <option value={15}>15 กม. - ชานเมืองห่างไกล</option>
                                                <option value={20}>20 กม. - นอกเขตเมือง</option>
                                            </select>
                                            <p className="text-xs text-slate-400 mt-1 italic">
                                                📌 ระยะทางจากศูนย์กลางธุรกิจ (Central Business District)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Results */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 1. Bertaud Efficiency Indicator */}
                        {result && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h2 className="flex items-center text-lg font-semibold mb-6 text-slate-800">
                                    <Calculator className="w-5 h-5 mr-2 text-blue-600" />
                                    การวิเคราะห์ประสิทธิภาพ (Bertaud Efficiency)
                                </h2>

                                {/* Technical Note: Bertaud Model */}
                                <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-slate-700">
                                    <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-2" />
                                        หลักการ: แบบจำลองเมืองที่มีศูนย์กลางเดียว (Monocentric City Model)
                                    </h3>
                                    <p className="mb-2">
                                        แบบจำลองของ Alain Bertaud ใช้สมการการลดลงของความหนาแน่น (Density Gradient) เพื่อหาความหนาแน่นที่เหมาะสม ณ ระยะทางห่างจากศูนย์กลางเมือง (CBD)
                                    </p>
                                    <div className="bg-white p-3 rounded border border-blue-100 font-mono text-center my-3 text-slate-900">
                                        D(x) = D<sub>0</sub> × e<sup>−gx</sup> = {d0} × e<sup>−{gradient}×{distanceKm}</sup> = <strong>{result?.theoreticalFAR.toFixed(2) ?? '—'}</strong>
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-slate-600 ml-2">
                                        <li><strong>D(x)</strong>: ความหนาแน่นที่ระยะทาง x = <strong>{result?.theoreticalFAR.toFixed(2) ?? '—'}</strong></li>
                                        <li><strong>D<sub>0</sub></strong>: ความหนาแน่นสูงสุดที่ศูนย์กลาง (CBD) = <strong>{d0}</strong></li>
                                        <li><strong>g</strong>: ค่าสัมประสิทธิ์การกระจายตัว (Density Gradient) = <strong>{gradient}</strong></li>
                                        <li><strong>x</strong>: ระยะทางจากศูนย์กลาง = <strong>{distanceKm} กม.</strong></li>
                                    </ul>
                                </div>

                                <div className="flex items-center space-x-6 mb-8">
                                    <div className={cn("flex-1 p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center", getStatusColor(result.status))}>
                                        {result.status === 'เหมาะสม (Optimal)' ? <CheckCircle2 className="w-12 h-12 mb-2" /> :
                                            result.status === 'ใช้ประโยชน์น้อยเกินไป (Under)' ? <AlertTriangle className="w-12 h-12 mb-2" /> :
                                                <XCircle className="w-12 h-12 mb-2" />}
                                        <span className="text-3xl font-bold">{result.efficiencyIndex.toFixed(2)}</span>
                                        <span className="text-sm font-medium uppercase tracking-wider mt-1">{result.status}</span>
                                    </div>

                                    <div className="flex-1 h-32">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis />
                                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="far" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-slate-500 mb-1">FAR ที่เสนอ</p>
                                        <p className="font-semibold text-slate-900 text-lg">{chartData[0].far}</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <p className="text-blue-600 mb-1">FAR ตามทฤษฎี</p>
                                        <p className="font-semibold text-blue-900 text-lg">{chartData[1].far}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-slate-500 mb-1">FAR สูงสุดกฎหมาย</p>
                                        <p className="font-semibold text-slate-900 text-lg">{chartData[2].far}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. Financial Audit Table */}
                        {result && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="flex items-center text-lg font-semibold text-slate-800">
                                        <Coins className="w-5 h-5 mr-2 text-green-600" />
                                        การตรวจสอบความเป็นไปได้ทางการเงิน (Financial Audit)
                                    </h2>
                                </div>

                                {/* Technical Note: Financial Logic */}
                                <div className="mx-6 mt-6 mb-2 bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-slate-700">
                                    <h3 className="font-semibold text-green-800 mb-2 flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-2" />
                                        หลักการ: มูลค่าเงินตามเวลา (Time Value of Money)
                                    </h3>
                                    <p className="mb-2">
                                        การคำนวณผลตอบแทนของรัฐ (NPV) คิดลดกระแสเงินสดในอนาคตกลับมาเป็นมูลค่าปัจจุบัน เพื่อเปรียบเทียบค่าธรรมเนียมและค่าเช่าที่ได้รับ
                                    </p>
                                    <div className="bg-white p-3 rounded border border-green-100 font-mono text-center my-3 text-slate-900">
                                        NPV = Σ [ CFₜ / (1 + r)ᵗ ]
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-slate-600 ml-2">
                                        <li><strong>CFₜ</strong>: กระแสเงินสดสุทธิในปีที่ t (ค่าธรรมเนียม + ค่าเช่า)</li>
                                        <li><strong>r</strong>: อัตราคิดลด (Discount Rate) ใช้ 3.5% สำหรับโครงการรัฐ</li>
                                        <li><strong>t</strong>: ปีที่คำนวณ (1 ถึง 30 ปี)</li>
                                    </ul>
                                </div>

                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-4">ตัวชี้วัด (Metric)</th>
                                            <th className="px-6 py-4 text-right">ค่า (Value)</th>
                                            <th className="px-6 py-4">สถานะ (Status)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        <tr className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 font-medium">มูลค่าปัจจุบันสุทธิ (NPV รัฐ)</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-900">
                                                {result.stateNPV.toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    เป็นบวก (Positive)
                                                </span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 font-medium">ตรวจสอบค่าก่อสร้าง (Cost Audit)</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-900">
                                                {result.costDeviation > 0 ? '+' : ''}{result.costDeviation.toFixed(1)}% (เบี่ยงเบน)
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    result.costStatus === 'ผ่านเกณฑ์ (Pass)' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                    {result.costStatus}
                                                </span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 font-medium">ผลตอบแทนต่อสินทรัพย์ (ROA)</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-900">
                                                {(result.roa * 100).toFixed(2)}%
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    result.roaStatus === 'ตามเป้าหมาย (Target)' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                    {result.roaStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* 3. Comparative Feasibility Study */}
                        {result && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                                    <h2 className="flex items-center text-lg font-semibold text-slate-800">
                                        <Building className="w-5 h-5 mr-2 text-purple-600" />
                                        การศึกษาความเป็นไปได้เชิงเปรียบเทียบ (Comparative Feasibility Study)
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">ที่ดินขนาด {landSizeRai} ไร่ ({(landSizeRai * 1600).toLocaleString()} ตร.ม.) | ระยะห่างจาก CBD: {distanceKm} กม.</p>
                                </div>

                                {/* Three Options Comparison */}
                                <div className="p-6">
                                    <h3 className="font-semibold text-slate-700 mb-4">📊 เปรียบเทียบ 3 ทางเลือกการพัฒนา</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">รายการ</th>
                                                    <th className="px-4 py-3 text-center font-semibold text-purple-700 bg-purple-50">Option A<br />High-rise (FAR 10:1)</th>
                                                    <th className="px-4 py-3 text-center font-semibold text-cyan-700 bg-cyan-50">Option B<br />Warehouse (BCR 60%)</th>
                                                    <th className="px-4 py-3 text-center font-semibold text-amber-700 bg-amber-50">Option C<br />PPP (เช่า 30 ปี)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                <tr>
                                                    <td className="px-4 py-3 font-medium">พื้นที่อาคารรวม (GFA)</td>
                                                    <td className="px-4 py-3 text-center font-mono">{(landSizeRai * 1600 * 10).toLocaleString()} ตร.ม.</td>
                                                    <td className="px-4 py-3 text-center font-mono">{(landSizeRai * 1600 * 0.6).toLocaleString()} ตร.ม.</td>
                                                    <td className="px-4 py-3 text-center font-mono">{(landSizeRai * 1600 * 6).toLocaleString()} ตร.ม.</td>
                                                </tr>
                                                <tr className="bg-slate-50">
                                                    <td className="px-4 py-3 font-medium">ต้นทุนก่อสร้าง (Est.)</td>
                                                    <td className="px-4 py-3 text-center font-mono">{(landSizeRai * 1600 * 10 * 35000 / 1000000).toFixed(0)} ล้านบาท</td>
                                                    <td className="px-4 py-3 text-center font-mono">{(landSizeRai * 1600 * 0.6 * 15000 / 1000000).toFixed(0)} ล้านบาท</td>
                                                    <td className="px-4 py-3 text-center font-mono">{(landSizeRai * 1600 * 6 * 25000 / 1000000).toFixed(0)} ล้านบาท</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-3 font-medium">รายได้ค่าเช่า/ตร.ม./เดือน</td>
                                                    <td className="px-4 py-3 text-center">600-800 บาท</td>
                                                    <td className="px-4 py-3 text-center">150-200 บาท</td>
                                                    <td className="px-4 py-3 text-center">400-500 บาท</td>
                                                </tr>
                                                <tr className="bg-slate-50">
                                                    <td className="px-4 py-3 font-medium">Yield Gap (ค่าเช่า vs ต้นทุน)</td>
                                                    <td className="px-4 py-3 text-center text-green-600 font-semibold">+5.2%</td>
                                                    <td className="px-4 py-3 text-center text-green-600 font-semibold">+7.8%</td>
                                                    <td className="px-4 py-3 text-center text-amber-600 font-semibold">+4.5%</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-3 font-medium">Payback Period (Est.)</td>
                                                    <td className="px-4 py-3 text-center">12-15 ปี</td>
                                                    <td className="px-4 py-3 text-center">8-10 ปี</td>
                                                    <td className="px-4 py-3 text-center">18-22 ปี</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Sensitivity Analysis */}
                                <div className="p-6 border-t border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
                                    <h3 className="font-semibold text-slate-700 mb-3">📈 Sensitivity Analysis: ผลกระทบจากอัตราคิดลด +1%</h3>
                                    <p className="text-xs text-slate-500 mb-3">Discount Rate เปลี่ยนจาก 3.5% เป็น 4.5%</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                                            <p className="text-xs text-purple-600 mb-1">Option A: High-rise</p>
                                            <p className="font-mono text-lg text-red-600">NPV -8.5%</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-cyan-100">
                                            <p className="text-xs text-cyan-600 mb-1">Option B: Warehouse</p>
                                            <p className="font-mono text-lg text-red-600">NPV -5.2%</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-amber-100">
                                            <p className="text-xs text-amber-600 mb-1">Option C: PPP</p>
                                            <p className="font-mono text-lg text-red-600">NPV -12.3%</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3 italic">💡 PPP มีความอ่อนไหวต่ออัตราคิดลดสูงสุด เนื่องจากระยะเวลาสัญญายาว 30 ปี</p>
                                </div>

                                {/* Legal Constraints */}
                                <div className="p-6 border-t border-slate-100">
                                    <h3 className="font-semibold text-slate-700 mb-3">⚖️ ข้อจำกัดทางกฎหมาย (Legal Constraints)</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium">ระยะร่น (Setback)</p>
                                                <p className="text-slate-500 text-xs">ด้านหน้า 6ม. / ด้านข้าง 2ม. / ด้านหลัง 2ม.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium">Open Space Ratio (OSR)</p>
                                                <p className="text-slate-500 text-xs">ต้องมีพื้นที่ว่าง ≥30% ของที่ดิน</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium">ข้อจำกัดความสูง</p>
                                                <p className="text-slate-500 text-xs">ตรวจสอบเขตปลอดภัยสนามบิน / เส้นทางบิน</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium">ที่จอดรถ</p>
                                                <p className="text-slate-500 text-xs">1 คัน : 60 ตร.ม. พื้นที่ใช้สอย</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Optimal Recommendation */}
                                <div className="p-6 border-t-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                                    <h3 className="font-semibold text-green-800 mb-3 flex items-center">
                                        🏆 สรุป: ทางเลือกที่เหมาะสมที่สุดสำหรับนักลงทุนระยะยาว
                                    </h3>
                                    <div className="bg-white rounded-lg p-4 border border-green-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-lg font-bold text-green-700">
                                                {distanceKm <= 2 ? "Option A: High-rise Development" :
                                                    distanceKm <= 10 ? "Option B: Premium Warehouse" :
                                                        "Option C: PPP Partnership"}
                                            </span>
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                                แนะนำ
                                            </span>
                                        </div>
                                        <p className="text-slate-600 text-sm mb-2">
                                            {distanceKm <= 2 && "ที่ดินใกล้ CBD (≤2 กม.) มีศักยภาพสูงสุดในการพัฒนาแนวดิ่ง เพื่อใช้ประโยชน์จาก Land Value สูงสุด"}
                                            {distanceKm > 2 && distanceKm <= 10 && "ที่ดินชานเมือง (2-10 กม.) เหมาะกับ Warehouse ที่มี Yield สูงและ Payback Period สั้น"}
                                            {distanceKm > 10 && "ที่ดินห่างไกล (>10 กม.) เหมาะกับ PPP เพื่อลดความเสี่ยงและใช้ประโยชน์จากเงินทุนรัฐ"}
                                        </p>
                                        <div className="flex items-center space-x-4 text-xs text-slate-500 mt-3">
                                            <span>📊 Yield Gap: {distanceKm <= 2 ? "+5.2%" : distanceKm <= 10 ? "+7.8%" : "+4.5%"}</span>
                                            <span>⏱️ Payback: {distanceKm <= 2 ? "12-15 ปี" : distanceKm <= 10 ? "8-10 ปี" : "18-22 ปี"}</span>
                                            <span>📈 IRR Est: {distanceKm <= 2 ? "8-10%" : distanceKm <= 10 ? "10-12%" : "6-8%"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
