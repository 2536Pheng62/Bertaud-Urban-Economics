/**
 * FAR Calculation Utilities for BaanBid Dashboard
 * Based on Alain Bertaud's Monocentric City Model
 * 
 * Formula: D(x) = D₀ × e^(-gx)
 * where:
 *   D(x) = Theoretical FAR at distance x
 *   D₀   = Central Density (FAR at CBD)
 *   g    = Density Gradient coefficient
 *   x    = Distance from CBD (km)
 */

// --- Type Definitions ---
export interface FARInputs {
    landSizeRai: number;      // ขนาดที่ดิน (ไร่)
    proposedGFA: number;      // พื้นที่อาคารรวมที่เสนอ (ตร.ม.)
    d0: number;               // ความหนาแน่นสูงสุดที่ศูนย์กลาง (D₀)
    g: number;                // ค่าสัมประสิทธิ์การลดลง (Density Gradient)
    distanceKm: number;       // ระยะห่างจาก CBD (กม.)
    legalMaxFAR?: number;     // FAR สูงสุดตามกฎหมาย (default: 10.00)
}

export interface FARResult {
    proposedFar: number;      // FAR ที่เสนอ
    theoreticalFar: number;   // FAR ตามทฤษฎี Bertaud
    legalMaxFar: number;      // FAR สูงสุดตามกฎหมาย
    efficiencyScore: number;  // ดัชนีประสิทธิภาพ (Proposed / Theoretical)
    status: 'UNDER' | 'OPTIMAL' | 'OVER';
    statusThai: string;       // สถานะภาษาไทย
    landSizeSqm: number;      // ขนาดที่ดิน (ตร.ม.)
}

export interface FARError {
    error: true;
    code: 'ZERO_LAND_SIZE' | 'ZERO_GFA' | 'INVALID_PARAMS';
    message: string;
    messageThai: string;
}

// --- Constants ---
const SQM_PER_RAI = 1600;
const DEFAULT_LEGAL_MAX_FAR = 10.00;

// --- Main Calculation Function ---
/**
 * คำนวณค่า FAR 3 รูปแบบตาม Bertaud Model
 * 
 * @param inputs - ข้อมูล Input สำหรับการคำนวณ
 * @returns FARResult หรือ FARError กรณีมีข้อผิดพลาด
 * 
 * @example
 * const result = calculateFAR({
 *   landSizeRai: 5,
 *   proposedGFA: 40000,
 *   d0: 10,
 *   g: 0.1,
 *   distanceKm: 2
 * });
 * // Returns: { proposedFar: 5.00, theoreticalFar: 8.19, ... }
 */
export function calculateFAR(inputs: FARInputs): FARResult | FARError {
    const { landSizeRai, proposedGFA, d0, g, distanceKm, legalMaxFAR } = inputs;

    // --- Error Guards ---
    // Guard 1: Zero Land Size (Division by Zero)
    if (landSizeRai <= 0) {
        return {
            error: true,
            code: 'ZERO_LAND_SIZE',
            message: 'Land size must be greater than 0',
            messageThai: 'ขนาดที่ดินต้องมากกว่า 0'
        };
    }

    // Guard 2: Zero or Negative GFA
    if (proposedGFA < 0) {
        return {
            error: true,
            code: 'ZERO_GFA',
            message: 'Proposed GFA cannot be negative',
            messageThai: 'พื้นที่อาคารต้องไม่ติดลบ'
        };
    }

    // Guard 3: Invalid Parameters
    if (d0 <= 0 || g < 0 || distanceKm < 0) {
        return {
            error: true,
            code: 'INVALID_PARAMS',
            message: 'D0 must be positive, g and distanceKm must be non-negative',
            messageThai: 'D₀ ต้องเป็นบวก, g และระยะทางต้องไม่ติดลบ'
        };
    }

    // --- Calculations ---
    const landSizeSqm = landSizeRai * SQM_PER_RAI;
    const legalMaxFar = legalMaxFAR ?? DEFAULT_LEGAL_MAX_FAR;

    // 1. Proposed FAR = GFA / Land Area
    const proposedFar = proposedGFA / landSizeSqm;

    // 2. Theoretical FAR (Bertaud Model): D(x) = D₀ × e^(-gx)
    const theoreticalFar = d0 * Math.exp(-g * distanceKm);

    // 3. Efficiency Score = Proposed / Theoretical
    // Guard against theoreticalFar being 0 (edge case when g is very large)
    const efficiencyScore = theoreticalFar > 0 ? proposedFar / theoreticalFar : 0;

    // 4. Determine Status
    let status: 'UNDER' | 'OPTIMAL' | 'OVER';
    let statusThai: string;

    if (efficiencyScore < 0.8) {
        status = 'UNDER';
        statusThai = 'ใช้ประโยชน์น้อยเกินไป (UNDER)';
    } else if (efficiencyScore <= 1.2) {
        status = 'OPTIMAL';
        statusThai = 'เหมาะสม (OPTIMAL)';
    } else {
        status = 'OVER';
        statusThai = 'หนาแน่นเกินไป (OVER)';
    }

    return {
        proposedFar: parseFloat(proposedFar.toFixed(2)),
        theoreticalFar: parseFloat(theoreticalFar.toFixed(2)),
        legalMaxFar: parseFloat(legalMaxFar.toFixed(2)),
        efficiencyScore: parseFloat(efficiencyScore.toFixed(2)),
        status,
        statusThai,
        landSizeSqm
    };
}

// --- Utility: Type Guard ---
export function isFARError(result: FARResult | FARError): result is FARError {
    return 'error' in result && result.error === true;
}

// --- Utility: Quick Status Check ---
export function getFARStatus(efficiencyScore: number): { status: string; statusThai: string } {
    if (efficiencyScore < 0.8) {
        return { status: 'UNDER', statusThai: 'ใช้ประโยชน์น้อยเกินไป (UNDER)' };
    } else if (efficiencyScore <= 1.2) {
        return { status: 'OPTIMAL', statusThai: 'เหมาะสม (OPTIMAL)' };
    } else {
        return { status: 'OVER', statusThai: 'หนาแน่นเกินไป (OVER)' };
    }
}

// --- Utility: Calculate Theoretical FAR Only ---
export function calculateTheoreticalFAR(d0: number, g: number, distanceKm: number): number {
    return d0 * Math.exp(-g * distanceKm);
}

// --- Example Usage (for documentation) ---
/*
const result = calculateFAR({
    landSizeRai: 5,        // 5 ไร่ = 8,000 ตร.ม.
    proposedGFA: 40000,    // 40,000 ตร.ม.
    d0: 10,                // FAR สูงสุดที่ CBD
    g: 0.1,                // ค่าลดลงปกติ
    distanceKm: 2          // ห่างจาก CBD 2 กม.
});

if (!isFARError(result)) {
    console.log(result);
    // Output:
    // {
    //   proposedFar: 5.00,
    //   theoreticalFar: 8.19,
    //   legalMaxFar: 10.00,
    //   efficiencyScore: 0.61,
    //   status: 'UNDER',
    //   statusThai: 'ใช้ประโยชน์น้อยเกินไป (UNDER)',
    //   landSizeSqm: 8000
    // }
}
*/
