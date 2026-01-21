import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, XCircle, Sparkles, Building2, Ruler, Trees, Car, Shield, Settings, Key } from 'lucide-react';

// --- Types ---
interface AnalysisResult {
    overallScore: number; // 0-100
    overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    summary: string;
    categories: {
        buildingDesign: CategoryScore;
        spaceUtilization: CategoryScore;
        greenSpace: CategoryScore;
        parking: CategoryScore;
        safety: CategoryScore;
    };
    recommendations: string[];
    risks: string[];
}

interface CategoryScore {
    score: number;
    status: 'ดีเยี่ยม' | 'ดี' | 'พอใช้' | 'ต้องปรับปรุง';
    details: string;
}

interface BlueprintAnalyzerProps {
    proposedGFA: number;
    landSizeRai: number;
    proposedHeight: number;
    costPerSqm: number;
}

type AIProvider = 'mock' | 'gemini' | 'huggingface' | 'groq' | 'ollama';

// --- Convert PDF to Base64 ---
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
    });
}

// --- Gemini API (Free Tier: 60 requests/min) ---
async function analyzeWithGemini(
    file: File,
    apiKey: string,
    context: { proposedGFA: number; landSizeRai: number; proposedHeight: number; costPerSqm: number }
): Promise<AnalysisResult> {
    const base64Data = await fileToBase64(file);
    
    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการตรวจสอบแบบแปลนอาคารสำหรับโครงการบนที่ดินราชพัสดุประเทศไทย

ข้อมูลโครงการ:
- พื้นที่อาคารรวม (GFA): ${context.proposedGFA.toLocaleString()} ตร.ม.
- ขนาดที่ดิน: ${context.landSizeRai} ไร่ (${(context.landSizeRai * 1600).toLocaleString()} ตร.ม.)
- ความสูงอาคาร: ${context.proposedHeight} เมตร
- ค่าก่อสร้าง: ${context.costPerSqm.toLocaleString()} บาท/ตร.ม.
- FAR ที่เสนอ: ${(context.proposedGFA / (context.landSizeRai * 1600)).toFixed(2)}

วิเคราะห์แบบแปลน PDF ที่แนบมาและให้คะแนนใน 5 หมวด:
1. การออกแบบอาคาร (buildingDesign)
2. การใช้พื้นที่ (spaceUtilization) 
3. พื้นที่สีเขียว (greenSpace)
4. ที่จอดรถ (parking)
5. ความปลอดภัย (safety)

ตอบเป็น JSON เท่านั้น ตามรูปแบบนี้:
{
  "overallScore": 75,
  "summary": "สรุปภาพรวม...",
  "categories": {
    "buildingDesign": { "score": 80, "details": "รายละเอียด..." },
    "spaceUtilization": { "score": 75, "details": "รายละเอียด..." },
    "greenSpace": { "score": 70, "details": "รายละเอียด..." },
    "parking": { "score": 72, "details": "รายละเอียด..." },
    "safety": { "score": 78, "details": "รายละเอียด..." }
  },
  "recommendations": ["ข้อเสนอแนะ 1", "ข้อเสนอแนะ 2"],
  "risks": ["ความเสี่ยง 1", "ความเสี่ยง 2"]
}`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'application/pdf',
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gemini API Error');
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('ไม่สามารถแปลผลการวิเคราะห์ได้');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return formatAnalysisResult(parsed);
}

// --- Hugging Face API (Free Tier: Limited) ---
async function analyzeWithHuggingFace(
    file: File,
    _apiKey: string,
    context: { proposedGFA: number; landSizeRai: number; proposedHeight: number; costPerSqm: number }
): Promise<AnalysisResult> {
    // HuggingFace doesn't support PDF directly, use mock with context
    console.log('HuggingFace: Using context-based analysis (PDF not directly supported)');
    return analyzeWithMock(file, context);
}

// --- Groq API (FREE - Llama 3.3 70B) ---
// Get free API key at: https://console.groq.com/keys
async function analyzeWithGroq(
    _file: File,
    apiKey: string,
    context: { proposedGFA: number; landSizeRai: number; proposedHeight: number; costPerSqm: number }
): Promise<AnalysisResult> {
    const landAreaSqm = context.landSizeRai * 1600;
    const proposedFAR = context.proposedGFA / landAreaSqm;

    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการตรวจสอบแบบแปลนอาคารสำหรับโครงการบนที่ดินราชพัสดุประเทศไทย

ข้อมูลโครงการ:
- พื้นที่อาคารรวม (GFA): ${context.proposedGFA.toLocaleString()} ตร.ม.
- ขนาดที่ดิน: ${context.landSizeRai} ไร่ (${landAreaSqm.toLocaleString()} ตร.ม.)
- ความสูงอาคาร: ${context.proposedHeight} เมตร
- ค่าก่อสร้าง: ${context.costPerSqm.toLocaleString()} บาท/ตร.ม.
- FAR ที่เสนอ: ${proposedFAR.toFixed(2)}

วิเคราะห์โครงการและให้คะแนน 0-100 ใน 5 หมวด พร้อมข้อเสนอแนะ
ตอบเป็น JSON เท่านั้น:
{
  "overallScore": 75,
  "summary": "สรุปภาพรวม...",
  "categories": {
    "buildingDesign": { "score": 80, "details": "..." },
    "spaceUtilization": { "score": 75, "details": "..." },
    "greenSpace": { "score": 70, "details": "..." },
    "parking": { "score": 72, "details": "..." },
    "safety": { "score": 78, "details": "..." }
  },
  "recommendations": ["ข้อเสนอแนะ 1", "ข้อเสนอแนะ 2"],
  "risks": ["ความเสี่ยง 1"]
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 2048
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Groq API Error');
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('ไม่สามารถแปลผลการวิเคราะห์ได้');
    }

    return formatAnalysisResult(JSON.parse(jsonMatch[0]));
}

// --- Ollama (FREE - Local Llama) ---
// Install: https://ollama.com then run: ollama pull llama3.2
async function analyzeWithOllama(
    _file: File,
    _apiKey: string,
    context: { proposedGFA: number; landSizeRai: number; proposedHeight: number; costPerSqm: number }
): Promise<AnalysisResult> {
    const landAreaSqm = context.landSizeRai * 1600;
    const proposedFAR = context.proposedGFA / landAreaSqm;

    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการตรวจสอบแบบแปลนอาคาร วิเคราะห์โครงการนี้:
- GFA: ${context.proposedGFA.toLocaleString()} ตร.ม.
- ที่ดิน: ${context.landSizeRai} ไร่
- ความสูง: ${context.proposedHeight} ม.
- ค่าก่อสร้าง: ${context.costPerSqm.toLocaleString()} บาท/ตร.ม.
- FAR: ${proposedFAR.toFixed(2)}

ตอบเป็น JSON เท่านั้น:
{"overallScore":75,"summary":"สรุป","categories":{"buildingDesign":{"score":80,"details":"..."},"spaceUtilization":{"score":75,"details":"..."},"greenSpace":{"score":70,"details":"..."},"parking":{"score":72,"details":"..."},"safety":{"score":78,"details":"..."}},"recommendations":["ข้อเสนอแนะ"],"risks":["ความเสี่ยง"]}`;

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2',
                prompt: prompt,
                stream: false,
                options: { temperature: 0.3 }
            })
        });

        if (!response.ok) {
            throw new Error('Ollama ไม่ตอบสนอง - ตรวจสอบว่า Ollama กำลังทำงานอยู่');
        }

        const data = await response.json();
        const textContent = data.response || '';
        
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('ไม่สามารถแปลผลการวิเคราะห์ได้');
        }

        return formatAnalysisResult(JSON.parse(jsonMatch[0]));
    } catch (err) {
        if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
            throw new Error('ไม่สามารถเชื่อมต่อ Ollama ได้ - กรุณาติดตั้งและรัน Ollama ก่อน (ollama.com)');
        }
        throw err;
    }
}

// --- Mock Analysis (Offline/Demo) ---
async function analyzeWithMock(
    _file: File,
    context: { proposedGFA: number; landSizeRai: number; proposedHeight: number; costPerSqm: number }
): Promise<AnalysisResult> {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const landAreaSqm = context.landSizeRai * 1600;
    const proposedFAR = context.proposedGFA / landAreaSqm;
    const isHighRise = context.proposedHeight > 23;
    const isHighDensity = proposedFAR > 5;
    const hasReasonableCost = context.costPerSqm >= 20000 && context.costPerSqm <= 35000;

    const buildingScore = isHighRise ? (hasReasonableCost ? 85 : 70) : 75;
    const spaceScore = isHighDensity ? 65 : 82;
    const greenScore = proposedFAR > 6 ? 55 : proposedFAR > 4 ? 70 : 85;
    const parkingScore = context.proposedGFA > 30000 ? 72 : 80;
    const safetyScore = isHighRise ? 78 : 85;

    const overallScore = Math.round(
        (buildingScore * 0.25) + (spaceScore * 0.25) + (greenScore * 0.2) + (parkingScore * 0.15) + (safetyScore * 0.15)
    );

    return formatAnalysisResult({
        overallScore,
        summary: `แบบแปลนโครงการ${isHighRise ? 'อาคารสูง' : 'อาคารทั่วไป'} พื้นที่ ${context.proposedGFA.toLocaleString()} ตร.ม. บนที่ดิน ${context.landSizeRai} ไร่ มีคุณภาพโดยรวม${overallScore >= 75 ? 'อยู่ในเกณฑ์ดี' : 'ต้องพิจารณาปรับปรุง'} FAR = ${proposedFAR.toFixed(2)}`,
        categories: {
            buildingDesign: { score: buildingScore, details: isHighRise ? `อาคารสูง ${context.proposedHeight} ม.` : 'อาคารความสูงปานกลาง' },
            spaceUtilization: { score: spaceScore, details: `FAR = ${proposedFAR.toFixed(2)}` },
            greenSpace: { score: greenScore, details: proposedFAR > 5 ? 'พื้นที่สีเขียวน้อย' : 'พื้นที่สีเขียวเพียงพอ' },
            parking: { score: parkingScore, details: `ต้องการ ~${Math.ceil(context.proposedGFA / 60)} คัน` },
            safety: { score: safetyScore, details: isHighRise ? 'ต้องมีระบบดับเพลิงครบ' : 'ระบบความปลอดภัยพื้นฐาน' }
        },
        recommendations: [
            proposedFAR > 5 ? 'พิจารณาลดพื้นที่อาคาร' : null,
            greenScore < 75 ? 'เพิ่มพื้นที่สีเขียว Roof Garden' : null,
            'ควรมีระบบบำบัดน้ำเสีย'
        ].filter(Boolean) as string[],
        risks: [
            proposedFAR > 6 ? '⚠️ FAR เกินเกณฑ์มาตรฐาน' : null,
            !hasReasonableCost && context.costPerSqm > 35000 ? '⚠️ ค่าก่อสร้างสูงกว่าค่าเฉลี่ย' : null
        ].filter(Boolean) as string[]
    });
}

// --- Format Analysis Result ---
interface RawCategoryScore {
    score: number;
    details: string;
}

interface RawAnalysisInput {
    overallScore?: number;
    summary?: string;
    categories: Record<string, RawCategoryScore>;
    recommendations?: string[];
    risks?: string[];
}

function formatAnalysisResult(parsed: RawAnalysisInput): AnalysisResult {
    const getGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
        if (score >= 85) return 'A';
        if (score >= 75) return 'B';
        if (score >= 65) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    };

    const getStatus = (score: number): 'ดีเยี่ยม' | 'ดี' | 'พอใช้' | 'ต้องปรับปรุง' => {
        if (score >= 85) return 'ดีเยี่ยม';
        if (score >= 75) return 'ดี';
        if (score >= 60) return 'พอใช้';
        return 'ต้องปรับปรุง';
    };

    const formatCategory = (cat: RawCategoryScore): CategoryScore => ({
        score: cat.score,
        status: getStatus(cat.score),
        details: cat.details
    });

    const defaultCat: RawCategoryScore = { score: 70, details: '-' };

    return {
        overallScore: parsed.overallScore || 70,
        overallGrade: getGrade(parsed.overallScore || 70),
        summary: parsed.summary || 'การวิเคราะห์เสร็จสิ้น',
        categories: {
            buildingDesign: formatCategory(parsed.categories.buildingDesign || defaultCat),
            spaceUtilization: formatCategory(parsed.categories.spaceUtilization || defaultCat),
            greenSpace: formatCategory(parsed.categories.greenSpace || defaultCat),
            parking: formatCategory(parsed.categories.parking || defaultCat),
            safety: formatCategory(parsed.categories.safety || defaultCat)
        },
        recommendations: parsed.recommendations || [],
        risks: parsed.risks || []
    };
}

// --- Component ---
// API Key should be set via environment variable or user input
const DEFAULT_GROQ_KEY = '';

export default function BlueprintAnalyzer({ proposedGFA, landSizeRai, proposedHeight, costPerSqm }: BlueprintAnalyzerProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [aiProvider, setAiProvider] = useState<AIProvider>('mock');
    const [apiKey, setApiKey] = useState(DEFAULT_GROQ_KEY);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load saved settings from localStorage (or use defaults)
    React.useEffect(() => {
        const savedProvider = localStorage.getItem('baanbid_ai_provider') as AIProvider;
        const savedKey = localStorage.getItem('baanbid_api_key');
        if (savedProvider) setAiProvider(savedProvider);
        setApiKey(savedKey || DEFAULT_GROQ_KEY);
    }, []);

    // Save settings to localStorage
    const saveSettings = () => {
        localStorage.setItem('baanbid_ai_provider', aiProvider);
        if (apiKey) localStorage.setItem('baanbid_api_key', apiKey);
        setShowSettings(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf') {
                setError('กรุณาอัปโหลดไฟล์ PDF เท่านั้น');
                return;
            }
            if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
                setError('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 50MB)');
                return;
            }
            setFile(selectedFile);
            setError(null);
            setAnalysisResult(null);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (droppedFile.type !== 'application/pdf') {
                setError('กรุณาอัปโหลดไฟล์ PDF เท่านั้น');
                return;
            }
            setFile(droppedFile);
            setError(null);
            setAnalysisResult(null);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleAnalyze = async () => {
        if (!file) return;

        // Validate API key for providers that need it
        if (aiProvider !== 'mock' && aiProvider !== 'ollama' && !apiKey) {
            setError('กรุณาใส่ API Key ในการตั้งค่า');
            setShowSettings(true);
            return;
        }

        setIsAnalyzing(true);
        setError(null);

        const context = { proposedGFA, landSizeRai, proposedHeight, costPerSqm };

        try {
            let result: AnalysisResult;
            
            switch (aiProvider) {
                case 'gemini':
                    result = await analyzeWithGemini(file, apiKey, context);
                    break;
                case 'huggingface':
                    result = await analyzeWithHuggingFace(file, apiKey, context);
                    break;
                case 'groq':
                    result = await analyzeWithGroq(file, apiKey, context);
                    break;
                case 'ollama':
                    result = await analyzeWithOllama(file, apiKey, context);
                    break;
                default:
                    result = await analyzeWithMock(file, context);
            }
            setAnalysisResult(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการวิเคราะห์';
            setError(errorMessage);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setAnalysisResult(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getGradeColor = (grade: string) => {
        switch (grade) {
            case 'A': return 'text-green-600 bg-green-100';
            case 'B': return 'text-blue-600 bg-blue-100';
            case 'C': return 'text-yellow-600 bg-yellow-100';
            case 'D': return 'text-orange-600 bg-orange-100';
            default: return 'text-red-600 bg-red-100';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 85) return 'bg-green-500';
        if (score >= 75) return 'bg-blue-500';
        if (score >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'buildingDesign': return <Building2 className="w-4 h-4" />;
            case 'spaceUtilization': return <Ruler className="w-4 h-4" />;
            case 'greenSpace': return <Trees className="w-4 h-4" />;
            case 'parking': return <Car className="w-4 h-4" />;
            case 'safety': return <Shield className="w-4 h-4" />;
            default: return null;
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'buildingDesign': return 'การออกแบบอาคาร';
            case 'spaceUtilization': return 'การใช้พื้นที่';
            case 'greenSpace': return 'พื้นที่สีเขียว';
            case 'parking': return 'ที่จอดรถ';
            case 'safety': return 'ความปลอดภัย';
            default: return category;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center text-lg font-semibold text-slate-800">
                    <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                    AI วิเคราะห์แบบแปลน
                </h2>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    title="ตั้งค่า AI"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {/* AI Settings Panel */}
            {showSettings && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center">
                        <Key className="w-4 h-4 mr-1" />
                        ตั้งค่า AI Provider
                    </h3>
                    
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">เลือก AI</label>
                        <select
                            value={aiProvider}
                            onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        >
                            <option value="mock">🎭 Demo Mode (ไม่ต้องใช้ API Key)</option>
                            <option value="groq">🦙 Groq Llama 3.3 (ฟรี! แนะนำ)</option>
                            <option value="ollama">💻 Ollama Local (ฟรี! รันบนเครื่อง)</option>
                            <option value="gemini">✨ Google Gemini (ต้องเปิด Billing)</option>
                            <option value="huggingface">🤗 Hugging Face (ฟรี จำกัด)</option>
                        </select>
                    </div>

                    {aiProvider === 'groq' && (
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Groq API Key (ฟรี!)
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="gsk_..."
                                className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                📌 รับ API Key ฟรีที่ <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-purple-600 hover:underline">console.groq.com/keys</a>
                            </p>
                        </div>
                    )}

                    {aiProvider === 'ollama' && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-800 font-medium">🦙 Ollama - รัน Llama บนเครื่องคุณเอง (ฟรี!)</p>
                            <ol className="text-xs text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                                <li>ดาวน์โหลด Ollama จาก <a href="https://ollama.com" target="_blank" rel="noopener" className="underline">ollama.com</a></li>
                                <li>เปิด Terminal แล้วรัน: <code className="bg-blue-100 px-1 rounded">ollama pull llama3.2</code></li>
                                <li>รัน Ollama: <code className="bg-blue-100 px-1 rounded">ollama serve</code></li>
                            </ol>
                        </div>
                    )}

                    {(aiProvider === 'gemini' || aiProvider === 'huggingface') && (
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                API Key {aiProvider === 'gemini' ? '(Google AI Studio)' : '(Hugging Face)'}
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={aiProvider === 'gemini' ? 'AIzaSy...' : 'hf_...'}
                                className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                {aiProvider === 'gemini' 
                                    ? '⚠️ Gemini ต้องเปิด Billing ถึงจะใช้งานได้' 
                                    : '📌 รับ API Key ที่ huggingface.co/settings/tokens'}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={saveSettings}
                        className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                    >
                        บันทึกการตั้งค่า
                    </button>
                </div>
            )}

            {/* Current AI Status */}
            <div className="mb-4 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                    กำลังใช้: {aiProvider === 'mock' ? '🎭 Demo Mode' : aiProvider === 'gemini' ? '✨ Gemini' : '🤗 HuggingFace'}
                </span>
                {aiProvider !== 'mock' && apiKey && (
                    <span className="text-green-500 flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        API Key พร้อมใช้งาน
                    </span>
                )}
            </div>

            {/* Upload Area */}
            {!file && (
                <div
                    className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    <p className="text-slate-600 font-medium mb-1">อัปโหลดแบบแปลนโครงการ</p>
                    <p className="text-sm text-slate-400">ลากไฟล์มาวางหรือคลิกเพื่อเลือก (PDF, สูงสุด 50MB)</p>
                </div>
            )}

            {/* File Selected */}
            {file && !analysisResult && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-3">
                            <FileText className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="font-medium text-slate-700">{file.name}</p>
                                <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="text-slate-400 hover:text-red-500 transition"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>กำลังวิเคราะห์ด้วย AI...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                <span>วิเคราะห์แบบแปลน</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-600">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Analysis Result */}
            {analysisResult && (
                <div className="space-y-6">
                    {/* Overall Score */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">คะแนนคุณภาพโดยรวม</p>
                            <p className="text-3xl font-bold text-slate-800">{analysisResult.overallScore}<span className="text-lg text-slate-400">/100</span></p>
                        </div>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${getGradeColor(analysisResult.overallGrade)}`}>
                            {analysisResult.overallGrade}
                        </div>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <strong>สรุป:</strong> {analysisResult.summary}
                    </p>

                    {/* Category Scores */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700">คะแนนรายหมวด</h3>
                        {Object.entries(analysisResult.categories).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-2 text-slate-600">
                                        {getCategoryIcon(key)}
                                        <span>{getCategoryLabel(key)}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            value.status === 'ดีเยี่ยม' ? 'bg-green-100 text-green-700' :
                                            value.status === 'ดี' ? 'bg-blue-100 text-blue-700' :
                                            value.status === 'พอใช้' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {value.status}
                                        </span>
                                        <span className="font-medium w-8 text-right">{value.score}</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${getScoreColor(value.score)}`}
                                        style={{ width: `${value.score}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400">{value.details}</p>
                            </div>
                        ))}
                    </div>

                    {/* Recommendations */}
                    {analysisResult.recommendations.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center">
                                <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                                ข้อเสนอแนะ
                            </h3>
                            <ul className="space-y-1">
                                {analysisResult.recommendations.map((rec, idx) => (
                                    <li key={idx} className="text-sm text-slate-600 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-green-500">
                                        {rec}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Risks */}
                    {analysisResult.risks.length > 0 && (
                        <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-100">
                            <h3 className="text-sm font-semibold text-red-700 flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                ความเสี่ยงที่ตรวจพบ
                            </h3>
                            <ul className="space-y-1">
                                {analysisResult.risks.map((risk, idx) => (
                                    <li key={idx} className="text-sm text-red-600">{risk}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        className="w-full py-2 px-4 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition flex items-center justify-center space-x-2"
                    >
                        <Upload className="w-4 h-4" />
                        <span>อัปโหลดแบบแปลนใหม่</span>
                    </button>
                </div>
            )}
        </div>
    );
}
