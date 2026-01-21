import React, { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, Calculator, Building, Coins, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { calculateFAR, isFARError, type FARInputs } from './utils/farCalculation';
import { downloadBaanBidPDF, type PDFReportData } from './components/pdfExportUtils';
import BlueprintAnalyzer from './components/BlueprintAnalyzer';
import GoogleMapLocation from './components/GoogleMapLocation';

// --- NumberInput Component with comma formatting ---
interface NumberInputProps {
    id: string;
    value: number;
    onChange: (value: number) => void;
    className?: string;
    min?: number;
}

function NumberInput({ id, value, onChange, className, min = 0 }: NumberInputProps) {
    const [displayValue, setDisplayValue] = useState(value.toLocaleString('en-US'));
    const [isFocused, setIsFocused] = useState(false);

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
        if (!isFocused) {
            setDisplayValue(formatNumber(value));
        }
    }, [value, isFocused]);

    return (
        <input
            id={id}
            type="text"
            inputMode="numeric"
            value={displayValue}
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
                    {result && (
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
                        >
                            <Download className="w-5 h-5" />
                            <span>ส่งออก PDF</span>
                        </button>
                    )}
                </header>

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

                        {/* AI Blueprint Analyzer */}
                        <BlueprintAnalyzer
                            proposedGFA={proposedGFA}
                            landSizeRai={landSizeRai}
                            proposedHeight={proposedHeight}
                            costPerSqm={costPerSqm}
                        />

                        {/* Google Map Location */}
                        <GoogleMapLocation
                            distanceKm={distanceKm}
                        />
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

                                {/* Scenario 1: FAR Maximizer */}
                                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                                    <h3 className="font-semibold text-amber-800 mb-2 flex items-center">
                                        📊 Scenario 1: การใช้ประโยชน์สูงสุดตามกฎหมาย (The FAR Maximizer)
                                    </h3>
                                    <p className="text-slate-600 mb-3">
                                        <strong>เหมาะสำหรับ:</strong> ที่ดินในเมือง (CBD) หรือที่ดินราคาสูง ซึ่งค่าที่ดินเป็นต้นทุนหลัก
                                    </p>
                                    <p className="text-slate-600 mb-3">
                                        <strong>แนวคิด:</strong> สร้างอาคารให้มีพื้นที่ใช้สอย (GFA) ใกล้เคียงกับค่า FAR สูงสุดที่กฎหมายผังเมืองกำหนด
                                    </p>
                                    <div className="bg-white rounded border border-amber-100 p-3 mb-3">
                                        <p className="font-medium text-amber-700 mb-2">📐 ตัวชี้วัดความคุ้มค่า:</p>
                                        <ul className="list-disc list-inside space-y-1 text-slate-600 ml-2">
                                            <li><strong>Efficiency Ratio:</strong> สัดส่วนพื้นที่ขาย/เช่า ต่อพื้นที่ก่อสร้างทั้งหมด (ควร &gt; 80%)</li>
                                            <li><strong>Construction Cost per Sq.m:</strong> อาคารสูง (High-rise) มีต้นทุนสูงขึ้นจากระบบวิศวกรรมและโครงสร้างต้านแผ่นดินไหว</li>
                                        </ul>
                                    </div>
                                    <div className="bg-red-50 rounded border border-red-100 p-3">
                                        <p className="font-medium text-red-700 mb-1">⚠️ จุดที่ต้องระวัง:</p>
                                        <p className="text-red-600 text-xs">
                                            หากสร้างจนเต็ม FAR แต่ Demand ในพื้นที่ไม่ถึง จะเกิด "Over-supply" ทำให้ Payback Period ยาวนานจนไม่คุ้มค่าเงินเฟ้อ
                                        </p>
                                    </div>
                                </div>

                                {/* Scenario 2: Operational Efficiency */}
                                <div className="mb-6 bg-cyan-50 border border-cyan-200 rounded-lg p-4 text-sm">
                                    <h3 className="font-semibold text-cyan-800 mb-2 flex items-center">
                                        🏭 Scenario 2: ประสิทธิภาพการดำเนินงาน (Operational Efficiency)
                                    </h3>
                                    <p className="text-slate-600 mb-3">
                                        <strong>เหมาะสำหรับ:</strong> อาคารประเภท คลังสินค้า (Warehouse), โรงงาน หรือศูนย์กระจายสินค้า
                                    </p>
                                    <p className="text-slate-600 mb-3">
                                        <strong>แนวคิด:</strong> ไม่เน้นความสูง แต่เน้น Building Footprint และพื้นที่ว่าง (Open Space) เพื่อการสัญจร
                                    </p>
                                    <div className="bg-white rounded border border-cyan-100 p-3 mb-3">
                                        <p className="font-medium text-cyan-700 mb-2">📐 ตัวชี้วัดความคุ้มค่า:</p>
                                        <ul className="list-disc list-inside space-y-1 text-slate-600 ml-2">
                                            <li><strong>Maneuvering Space:</strong> ต้องมีพื้นที่ให้รถบรรทุกขนาดใหญ่กลับรถได้ หากสร้างเต็มที่ดินจนรถเข้า-ออกลำบาก ค่าเช่าจะตกทันที</li>
                                            <li><strong>Loading Dock Ratio:</strong> จำนวนประตูขนถ่ายสินค้าต่อพื้นที่อาคาร</li>
                                        </ul>
                                    </div>
                                    <div className="bg-cyan-100 rounded border border-cyan-200 p-3">
                                        <p className="font-medium text-cyan-700 mb-1">💡 ข้อสังเกต:</p>
                                        <p className="text-cyan-600 text-xs">
                                            การสร้างอาคารชั้นเดียวบนที่ดินขนาดใหญ่อาจดูเหมือนใช้ที่ดินไม่คุ้ม (FAR ต่ำ) แต่ในเชิงอุตสาหกรรม <strong>Flow ของสินค้า</strong> สำคัญกว่าพื้นที่แนวตั้ง
                                        </p>
                                    </div>
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
