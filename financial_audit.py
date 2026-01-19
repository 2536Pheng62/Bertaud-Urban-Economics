from typing import Dict, Union, Tuple, List, Optional
import math
from pydantic import BaseModel, Field, field_validator, ValidationError

class FinancialParams(BaseModel):
    """
    Data model for Financial Audit parameters with strict validation.
    """
    upfront_fee: float = Field(..., ge=0, description="Upfront fee paid at T=0 (THB)")
    initial_annual_rent: float = Field(..., ge=0, description="Initial annual rent (THB)")
    lease_term_years: int = Field(..., gt=0, le=100, description="Lease term in years")
    discount_rate: float = Field(..., ge=0, le=1.0, description="Discount rate (decimal, e.g. 0.035)")
    investment_cost: float = Field(..., ge=0, description="Total investment cost (THB)")
    asset_useful_life_years: int = Field(..., gt=0, description="Useful life of the asset for depreciation")
    rent_escalation_rate: float = Field(0.15, ge=0, description="Rent increase rate (decimal)")
    escalation_interval_years: int = Field(3, gt=0, description="Years between rent increases")

    @field_validator('lease_term_years')
    @classmethod # Fixed: field_validator is a classmethod implicitly or needs mode='before'? No, usually works on field.
    def check_lease_logic(cls, v):
        if v > 100:
            raise ValueError("Lease term is unusually long (>100 years). Please verify.")
        return v

class FinancialAudit:
    """
    Implements financial feasibility analysis for land audit projects (BaanBid SaaS).
    Based on Thai Treasury Department regulations.
    """

    def calculate_state_npv(self, params: FinancialParams) -> float:
        """
        Calculates the Net Present Value (NPV) of the state's potential return.
        Uses Pydantic model for validation.
        """
        npv = 0.0
        
        # 1. Cash Inflows: Upfront Fee (T=0)
        npv += params.upfront_fee
        
        # 2. Cash Inflows: Annual Rent (T=1 to T=lease_term)
        current_rent = params.initial_annual_rent
        lease_term = params.lease_term_years
        
        for year in range(1, lease_term + 1):
            # Apply rent escalation
            if year > 1 and (year - 1) % params.escalation_interval_years == 0:
                current_rent *= (1 + params.rent_escalation_rate)
            
            # Discount back to T=0
            discount_factor = (1 + params.discount_rate) ** year
            discounted_rent = current_rent / discount_factor
            npv += discounted_rent

        # 3. Terminal Value (Asset transfer at end of lease)
        # Residual Value = Cost * (Remaining Life / Useful Life)
        if lease_term < params.asset_useful_life_years:
            remaining_life = params.asset_useful_life_years - lease_term
            # Straight-line depreciation basis
            residual_value = params.investment_cost * (remaining_life / params.asset_useful_life_years)
        else:
            residual_value = 0.0

        # Discount Terminal Value
        discounted_terminal_value = residual_value / ((1 + params.discount_rate) ** lease_term)
        npv += discounted_terminal_value
        
        return npv

        return npv

    def validate_construction_cost(
        self,
        proposed_cost_per_sqm: float,
        building_type: str,
        province: str = "Bangkok" # Default context
    ) -> Dict[str, Union[str, float]]:
        """
        Validates proposed construction cost against standard benchmarks.
        Uses Regional Cost Index (Location Factors) for accurate comparison.
        Benchmarks source: Comptroller General's Dept (Simulated).
        """
        
        # Base Benchmarks (Bangkok 2024 Basis)
        base_benchmarks = {
            'low-rise': 15000.0,
            'high-rise': 30000.0
        }
        
        # Regional Cost Indices (Location Factors)
        # Bangkok = 1.0
        # Provinces might be higher due to logistics or lower due to labor.
        # Example: Phuket (1.15), Chiang Mai (1.05), Udon Thani (0.95)
        location_factors = {
            "bangkok": 1.0,
            "phuket": 1.15,
            "chiang mai": 1.05,
            "chonburi": 1.02,
            "udon thani": 0.95
        }
        
        normalized_province = province.lower()
        location_factor = location_factors.get(normalized_province, 1.0) # Default to 1.0 if unknown
        
        base_standard = base_benchmarks.get(building_type.lower())
        
        if base_standard is None:
            return {
                "status": "Unknown Type",
                "deviation_percent": 0.0,
                "message": f"Building type '{building_type}' not recognized."
            }
            
        # Adjust for Location
        adjusted_standard_cost = base_standard * location_factor
            
        deviation = (proposed_cost_per_sqm - adjusted_standard_cost) / adjusted_standard_cost
        deviation_percent = deviation * 100.0
        
        status = "Pass"
        if abs(deviation) > 0.20:
             status = "Cost Anomaly Detected"
             
        return {
            "status": status,
            "deviation_percent": deviation_percent,
            "base_standard_cost": base_standard,
            "location_factor": location_factor,
            "adjusted_standard_cost": adjusted_standard_cost,
            "province_context": province
        }

    def calculate_return_on_asset(self, params: FinancialParams) -> Dict[str, Union[str, float]]:
        """
        Calculates ROA based on Average Annual Benefit / Asset Value.
        Uses validated FinancialParams.
        
        Benefit approximation = (Upfront Fee + Total Nominal Rent + Terminal Value) / Term
        This is a simplified metric often used in rough feasibility checks.
        """
        
        # Re-calculate total nominal flow
        current_rent = params.initial_annual_rent
        total_nominal_rent = 0.0
        
        for year in range(1, params.lease_term_years + 1):
            if year > 1 and (year - 1) % params.escalation_interval_years == 0:
                current_rent *= (1 + params.rent_escalation_rate)
            total_nominal_rent += current_rent

        # Terminal Value (Nominal at end of lease)
        # Residual Value logic
        if params.lease_term_years < params.asset_useful_life_years:
             terminal_value = params.investment_cost * ((params.asset_useful_life_years - params.lease_term_years) / params.asset_useful_life_years)
        else:
             terminal_value = 0.0

        total_benefit = params.upfront_fee + total_nominal_rent + terminal_value
        average_annual_benefit = total_benefit / params.lease_term_years
        
        roa = average_annual_benefit / params.investment_cost if params.investment_cost > 0 else 0.0
        roa_percent = roa * 100.0
        
        status = "On Target"
        if roa_percent < 3.0:
            status = "Below Target"
            
        return {
            "roa_percent": roa_percent,
            "average_annual_benefit": average_annual_benefit,
            "status": status
        }

    def calculate_breakeven_lease_term(
        self,
        investment_cost: float,
        annual_net_cashflow: float,
        discount_rate: float
    ) -> Union[float, str]:
        """
        Calculates the break-even lease term (Payback Period) considering the time value of money.
        Formula: n = -ln(1 - (Investment * r / Cashflow)) / ln(1 + r)
        This is derived from the Present Value of an Annuity formula.
        """
        if annual_net_cashflow <= 0:
            return float('inf')
            
        ratio = (investment_cost * discount_rate) / annual_net_cashflow
        
        # If the investment earns more interest than the cashflow covers, it surely never breaks even
        if ratio >= 1.0:
            return float('inf')
            
        years = -math.log(1 - ratio) / math.log(1 + discount_rate)
        return years

    def perform_sensitivity_analysis(self, base_params: Dict) -> Dict[str, Union[float, Dict[str, float]]]:
        """
        Performs a sensitivity analysis on the NPV calculation.
        Varied parameter: Discount Rate (+/- 2%).
        """
        # Extract base parameters
        upfront = base_params.get("upfront_fee", 0)
        initial_rent = base_params.get("initial_annual_rent", 0)
        lease_years = base_params.get("lease_years", 30)
        invest_cost = base_params.get("investment_cost", 0.0)
        asset_life = 50
        base_discount = 0.05
        
        def run_scenario(rate):
            # Instantiate FinancialParams for validation and calculation
            params = FinancialParams(
                upfront_fee=upfront,
                initial_annual_rent=initial_rent,
                lease_term_years=lease_years,
                discount_rate=rate,
                investment_cost=invest_cost,
                asset_useful_life_years=asset_life
            )
            return self.calculate_state_npv(params)
            
        base_npv = run_scenario(base_discount)
        
        return {
            "Base Case": base_npv,
            "Discount Rate Sensitivity": {
                "+2% Rate": run_scenario(base_discount + 0.02),
                "-2% Rate": run_scenario(base_discount - 0.02)
            }
        }


