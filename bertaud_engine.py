import math
from typing import Dict, Union, Callable

class BertaudAuditEngine:
    """
    Implements the Alain Bertaud Urban Economic Model for land audit.
    Focuses on calculating optimal density and auditing efficiency.
    """
    
    def __init__(self, d0_center_density: float, density_gradient_g: float):
        """
        Initialize the engine with theoretical model parameters.
        
        Args:
            d0_center_density: The theoretical density at the CBD center (D0). 
                               Unit: Floor Area Ratio (FAR) or equivalent.
            density_gradient_g: The density gradient coefficient (g).
        """
        # Guardrails: Check for Realistic Gradient Values
        if density_gradient_g > 0.5:
            print(f"Warning: Gradient g={density_gradient_g} is unusually high. This implies extremely rapid density decay (Urban Sprawl error potential).")
        if density_gradient_g < 0.01:
            print(f"Warning: Gradient g={density_gradient_g} is unusually low. This implies almost uniform density (unrealistic for monocentric cities).")

        self.d0 = d0_center_density
        self.g = density_gradient_g

    @staticmethod
    def validate_inputs(d0: float, g: float, distance_km: float) -> list[str]:
        """
        Validates input parameters before calculation or persistence.
        Returns a list of error messages. Empty list means valid.
        """
        errors = []
        if d0 < 0:
            errors.append(f"D0 (Center Density) cannot be negative: {d0}")
        if g < 0:
            errors.append(f"Gradient (g) cannot be negative: {g}")
        if distance_km < 0:
            errors.append(f"Distance (x) cannot be negative: {distance_km}")
        return errors

    def calculate_optimal_density(
        self,
        capital_k: float,
        land_cost_e: float,
        transport_cost: Union[float, Callable[[float], float]],
        distance_km: float,
        proposed_density: float,
        legal_far_limit: float = None,
        zone_color: str = None
    ) -> Dict[str, Union[float, str]]:
        """
        Calculates optimal density using Bertaud's gradient formula and audits the proposal.
        Includes Checks against Legal Limits (Gap Analysis) and Contextual Status Logic.
        
        Formula: D_x = D0 * e^(-g * x)
        """
        
        # 1. Calculate Theoretical Optimal Density (Dx)
        # Dx = D0 * e^(-g * x)
        theoretical_density = self.d0 * math.exp(-self.g * distance_km)
        
        # 2. Calculate Efficiency Index
        if theoretical_density == 0:
            efficiency_index = 0.0
        else:
            efficiency_index = proposed_density / theoretical_density
            
        # 3. Determine Audit Status (Context Aware)
        # Default Thresholds
        lower_limit = 0.8
        upper_limit = 1.2
        
        # Contextual Overrides
        if zone_color:
            color = zone_color.lower()
            if "yellow" in color: # Low Densitiy Residential
                upper_limit = 1.1 # Stricter upper limit
            # Red (Commercial) keeps default 1.2 or could be higher
        
        # Granular Status Logic
        status = "Optimal"
        
        if efficiency_index < (lower_limit - 0.1): # < 0.7 by default
            status = "Under-utilization"
        elif efficiency_index < lower_limit: # 0.7 - 0.8
            status = "Low Density Warning"
        elif efficiency_index > (upper_limit + 0.1): # > 1.3 (if limit 1.2)
            status = "Over-densification"
        elif efficiency_index > upper_limit: # 1.2 - 1.3
            status = "High Density Warning"
        # Else remains "Optimal" (0.8 - 1.2) - wait, math check below
        
        # Logic Recap for Default (0.8 - 1.2):
        # < 0.7: Under
        # 0.7 - 0.8: Warning Low
        # 0.8 - 1.2: Optimal
        # 1.2 - 1.3: Warning High (Wait, user said 1.1-1.2 is warning)
        
        # Let's adjust to match user request explicitly:
        # "0.7 - 0.8: Low Density Warning"
        # "1.1 - 1.2: High Density Warning" (Implies Optimal is 0.8 - 1.1 or the warning is PART of optimal?)
        # Usually Warning means "Acceptable but watch out". 
        # But if > 1.2 is Over, then 1.1-1.2 as Warning implies Optimal is 0.8-1.1.
        
        # Let's try this logic structure:
        # Critical Low: < 0.7
        # Warning Low: 0.7 - 0.8
        # Optimal: 0.8 - 1.1 (Safe)
        # Warning High: 1.1 - 1.2
        # Critical High: > 1.2
        
        # Adjusting for Zone Override (Yellow: Max 1.1)
        # If max is 1.1, then Warning High might be 1.0 - 1.1, and > 1.1 is Critical.
        
        # Dynamic Logic:
        optimal_low = lower_limit # 0.8
        optimal_high = upper_limit - 0.1 # 1.1 (if 1.2 limit)
        
        if efficiency_index < (optimal_low - 0.1):
            status = "Under-utilization"
        elif efficiency_index < optimal_low:
            status = "Low Density Warning"
        elif efficiency_index <= optimal_high:
            status = "Optimal"
        elif efficiency_index <= upper_limit:
            status = "High Density Warning"
        else:
            status = "Over-densification"

        # 4. Gap Analysis (Supply-Demand Mismatch)
        gap_analysis = {}
        if legal_far_limit is not None:
            # If Theoretical Demand > Legal Limit => Mismatch
            # Example: Optimal is FAR 12, but Law allows FAR 8. Market wants to build more than allowed.
            far_gap = theoretical_density - legal_far_limit
            is_constrained = far_gap > 0
            
            policy_recommendation = "None"
            if is_constrained and far_gap > 1.0: # Significant gap
                policy_recommendation = "Request Zoning Upgrade (Upsize)"
            elif not is_constrained and (legal_far_limit - theoretical_density) > 2.0:
                policy_recommendation = "Zone Over-supply (Focus on infrastructure)"

            gap_analysis = {
                "legal_max_far": legal_far_limit,
                "theoretical_demand_far": theoretical_density,
                "far_mismatch_gap": far_gap,
                "is_constraint_active": is_constrained,
                "policy_recommendation": policy_recommendation
            }
            
        return {
            "distance_km": distance_km,
            "theoretical_density": theoretical_density,
            "proposed_density": proposed_density,
            "efficiency_index": efficiency_index,
            "status": status,
            "gap_analysis": gap_analysis,
            "input_land_cost": land_cost_e,
            "input_capital_k": capital_k
        }

    def calculate_polycentric_density(
        self,
        distance_map: Dict[str, float], # { "center_id": distance_km }
        centers_config: Dict[str, Dict[str, float]] # { "center_id": { "d0": ..., "g": ... } }
    ) -> float:
        """
        Calculates density for a location affected by multiple centers (Polycentric).
        Formula: D_x = Sum(D0_i * e^(-g_i * x_i))
        """
        total_density = 0.0
        for center_id, dist_km in distance_map.items():
            if center_id in centers_config:
                params = centers_config[center_id]
                d0_i = params.get('d0', 0)
                g_i = params.get('g', 0)
                total_density += d0_i * math.exp(-g_i * dist_km)
        
        return total_density

    @staticmethod
    def calibrate_parameters(samples: list[tuple[float, float]]) -> tuple[float, float]:
        """
        Estimates D0 and g from empirical data samples [(distance, density), ...].
        Linearizes the exponential function: ln(Dx) = ln(D0) - g*x
        Returns (estimated_d0, estimated_g)
        """
        import statistics
        
        # Filter valid samples (density > 0)
        valid_samples = [(x, math.log(y)) for x, y in samples if y > 0]
        
        if len(valid_samples) < 2:
            return (0.0, 0.0) # Insufficient data
            
        xs = [s[0] for s in valid_samples]
        ln_ys = [s[1] for s in valid_samples]
        
        # Simple Linear Regression
        x_mean = statistics.mean(xs)
        y_mean = statistics.mean(ln_ys)
        
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ln_ys))
        denominator = sum((x - x_mean) ** 2 for x in xs)
        
        if denominator == 0:
            return (0.0, 0.0)
            
        slope = numerator / denominator # This is -g
        intercept = y_mean - slope * x_mean # This is ln(D0)
        
        estimated_g = -slope
        estimated_d0 = math.exp(intercept)
        
        return (estimated_d0, estimated_g)

    @staticmethod
    def convert_rai_to_sqm(rai: float) -> float:
        """Converts Rai to Square Meters."""
        return rai * 1600.0

    @staticmethod
    def convert_wah_to_sqm(wah: float) -> float:
        """Converts Square Wah to Square Meters."""
        return wah * 4.0
