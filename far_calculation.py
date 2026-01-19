"""
FAR Calculation Utilities for BaanBid Backend
Based on Alain Bertaud's Monocentric City Model

Formula: D(x) = D₀ × e^(-gx)
where:
    D(x) = Theoretical FAR at distance x
    D₀   = Central Density (FAR at CBD)
    g    = Density Gradient coefficient
    x    = Distance from CBD (km)

Author: BaanBid Development Team
"""

import math
from dataclasses import dataclass
from enum import Enum
from typing import Union


# --- Constants ---
SQM_PER_RAI = 1600
DEFAULT_LEGAL_MAX_FAR = 10.00


# --- Enums ---
class FARStatus(Enum):
    """สถานะการใช้ประโยชน์ที่ดิน"""
    UNDER = "ใช้ประโยชน์น้อยเกินไป (UNDER)"
    OPTIMAL = "เหมาะสม (OPTIMAL)"
    OVER = "หนาแน่นเกินไป (OVER)"


# --- Data Classes ---
@dataclass
class FARInputs:
    """ข้อมูล Input สำหรับการคำนวณ FAR"""
    land_size_rai: float      # ขนาดที่ดิน (ไร่)
    proposed_gfa: float       # พื้นที่อาคารรวมที่เสนอ (ตร.ม.)
    d0: float                 # ความหนาแน่นสูงสุดที่ศูนย์กลาง (D₀)
    g: float                  # ค่าสัมประสิทธิ์การลดลง (Density Gradient)
    distance_km: float        # ระยะห่างจาก CBD (กม.)
    legal_max_far: float = DEFAULT_LEGAL_MAX_FAR  # FAR สูงสุดตามกฎหมาย


@dataclass
class FARResult:
    """ผลลัพธ์การคำนวณ FAR"""
    proposed_far: float       # FAR ที่เสนอ
    theoretical_far: float    # FAR ตามทฤษฎี Bertaud
    legal_max_far: float      # FAR สูงสุดตามกฎหมาย
    efficiency_score: float   # ดัชนีประสิทธิภาพ (Proposed / Theoretical)
    status: FARStatus         # สถานะ (Enum)
    status_thai: str          # สถานะภาษาไทย
    land_size_sqm: float      # ขนาดที่ดิน (ตร.ม.)
    
    def to_dict(self) -> dict:
        """แปลงเป็น dictionary สำหรับ JSON response"""
        return {
            "proposedFar": round(self.proposed_far, 2),
            "theoreticalFar": round(self.theoretical_far, 2),
            "legalMaxFar": round(self.legal_max_far, 2),
            "efficiencyScore": round(self.efficiency_score, 2),
            "status": self.status.name,
            "statusThai": self.status_thai,
            "landSizeSqm": self.land_size_sqm
        }


class FARCalculationError(Exception):
    """Custom exception for FAR calculation errors"""
    def __init__(self, code: str, message: str, message_thai: str):
        self.code = code
        self.message = message
        self.message_thai = message_thai
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """แปลงเป็น dictionary สำหรับ JSON response"""
        return {
            "error": True,
            "code": self.code,
            "message": self.message,
            "messageThai": self.message_thai
        }


# --- Main Calculation Function ---
def calculate_far(inputs: FARInputs) -> FARResult:
    """
    คำนวณค่า FAR 3 รูปแบบตาม Bertaud Model
    
    Args:
        inputs: ข้อมูล FARInputs สำหรับการคำนวณ
    
    Returns:
        FARResult: ผลลัพธ์การคำนวณ
    
    Raises:
        FARCalculationError: กรณีมีข้อผิดพลาด (เช่น division by zero)
    
    Example:
        >>> inputs = FARInputs(
        ...     land_size_rai=5,
        ...     proposed_gfa=40000,
        ...     d0=10,
        ...     g=0.1,
        ...     distance_km=2
        ... )
        >>> result = calculate_far(inputs)
        >>> print(result.proposed_far)  # 5.0
        >>> print(result.theoretical_far)  # 8.19
    """
    # --- Error Guards ---
    # Guard 1: Zero Land Size (Division by Zero)
    if inputs.land_size_rai <= 0:
        raise FARCalculationError(
            code="ZERO_LAND_SIZE",
            message="Land size must be greater than 0",
            message_thai="ขนาดที่ดินต้องมากกว่า 0"
        )
    
    # Guard 2: Zero or Negative GFA
    if inputs.proposed_gfa < 0:
        raise FARCalculationError(
            code="ZERO_GFA",
            message="Proposed GFA cannot be negative",
            message_thai="พื้นที่อาคารต้องไม่ติดลบ"
        )
    
    # Guard 3: Invalid Parameters
    if inputs.d0 <= 0 or inputs.g < 0 or inputs.distance_km < 0:
        raise FARCalculationError(
            code="INVALID_PARAMS",
            message="D0 must be positive, g and distance_km must be non-negative",
            message_thai="D₀ ต้องเป็นบวก, g และระยะทางต้องไม่ติดลบ"
        )
    
    # --- Calculations ---
    land_size_sqm = inputs.land_size_rai * SQM_PER_RAI
    
    # 1. Proposed FAR = GFA / Land Area
    proposed_far = inputs.proposed_gfa / land_size_sqm
    
    # 2. Theoretical FAR (Bertaud Model): D(x) = D₀ × e^(-gx)
    theoretical_far = inputs.d0 * math.exp(-inputs.g * inputs.distance_km)
    
    # 3. Efficiency Score = Proposed / Theoretical
    # Guard against theoretical_far being 0 (edge case)
    efficiency_score = proposed_far / theoretical_far if theoretical_far > 0 else 0
    
    # 4. Determine Status
    if efficiency_score < 0.8:
        status = FARStatus.UNDER
    elif efficiency_score <= 1.2:
        status = FARStatus.OPTIMAL
    else:
        status = FARStatus.OVER
    
    return FARResult(
        proposed_far=proposed_far,
        theoretical_far=theoretical_far,
        legal_max_far=inputs.legal_max_far,
        efficiency_score=efficiency_score,
        status=status,
        status_thai=status.value,
        land_size_sqm=land_size_sqm
    )


# --- Utility Functions ---
def calculate_theoretical_far(d0: float, g: float, distance_km: float) -> float:
    """
    คำนวณ Theoretical FAR ตาม Bertaud Model
    
    Formula: D(x) = D₀ × e^(-gx)
    """
    return d0 * math.exp(-g * distance_km)


def get_far_status(efficiency_score: float) -> FARStatus:
    """
    หาสถานะจาก Efficiency Score
    
    - < 0.8: UNDER
    - 0.8 - 1.2: OPTIMAL
    - > 1.2: OVER
    """
    if efficiency_score < 0.8:
        return FARStatus.UNDER
    elif efficiency_score <= 1.2:
        return FARStatus.OPTIMAL
    else:
        return FARStatus.OVER


def calculate_far_safe(inputs: FARInputs) -> Union[dict, dict]:
    """
    Safe wrapper สำหรับ calculate_far ที่คืนค่า dict เสมอ (ไม่ raise exception)
    เหมาะสำหรับใช้กับ API endpoints
    
    Returns:
        dict: ผลลัพธ์หรือ error ในรูปแบบ dictionary
    """
    try:
        result = calculate_far(inputs)
        return result.to_dict()
    except FARCalculationError as e:
        return e.to_dict()


# --- Example Usage ---
if __name__ == "__main__":
    # Example calculation
    inputs = FARInputs(
        land_size_rai=5,        # 5 ไร่ = 8,000 ตร.ม.
        proposed_gfa=40000,     # 40,000 ตร.ม.
        d0=10,                  # FAR สูงสุดที่ CBD
        g=0.1,                  # ค่าลดลงปกติ
        distance_km=2           # ห่างจาก CBD 2 กม.
    )
    
    result = calculate_far(inputs)
    print("=== FAR Calculation Result ===")
    print(f"ขนาดที่ดิน: {result.land_size_sqm:,.0f} ตร.ม. ({inputs.land_size_rai} ไร่)")
    print(f"Proposed FAR: {result.proposed_far:.2f}")
    print(f"Theoretical FAR (Bertaud): {result.theoretical_far:.2f}")
    print(f"Legal Max FAR: {result.legal_max_far:.2f}")
    print(f"Efficiency Score: {result.efficiency_score:.2f}")
    print(f"Status: {result.status_thai}")
    print()
    print("=== JSON Output ===")
    print(result.to_dict())
