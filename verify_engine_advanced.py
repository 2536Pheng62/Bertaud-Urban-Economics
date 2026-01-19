from bertaud_engine import BertaudAuditEngine

def verify_advanced_features():
    print("--- Verifying Advanced Bertaud Engine Features ---")

    # 1. Initialize with Guardrails Check
    # Scenario: High gradient (should print warning)
    print("\n[Test 1] Guardrails Verification:")
    engine = BertaudAuditEngine(d0_center_density=10.0, density_gradient_g=0.6)
    
    # 2. Gap Analysis (Legal FAR)
    print("\n[Test 2] Gap Analysis (Supply-Demand Mismatch):")
    # Distance 5km, D0=10, g=0.1 => Dx = 10 * exp(-0.5) = 6.06
    # Legal Limit = 4.0 => Gap of +2.06 (Demand > Legal)
    engine_normal = BertaudAuditEngine(d0_center_density=10.0, density_gradient_g=0.1)
    
    result = engine_normal.calculate_optimal_density(
        capital_k=0, land_cost_e=0, transport_cost=0, # Not used for density calc directly
        distance_km=5.0,
        proposed_density=6.0,
        legal_far_limit=4.0
    )
    
    gap_analysis = result.get('gap_analysis', {})
    print(f"Distance: 5km, Theoretical FAR: {result['theoretical_density']:.2f}")
    print(f"Legal Max FAR: {gap_analysis.get('legal_max_far')}")
    print(f"Mismatch Gap: {gap_analysis.get('far_mismatch_gap'):.2f}")
    print(f"Recommendation: {gap_analysis.get('policy_recommendation')}")
    
    if gap_analysis.get('is_constraint_active') and gap_analysis.get('far_mismatch_gap') > 0:
        print("PASS: Correctly identified supply-demand mismatch.")
    else:
        print("FAIL: Did not identify mismatch.")

    # 3. Polycentric City Calculation
    print("\n[Test 3] Polycentric Density:")
    centers_config = {
        "CBD_1": {"d0": 10.0, "g": 0.1}, # Main CBD
        "CBD_2": {"d0": 5.0, "g": 0.2}   # Secondary Center
    }
    # Location is 5km from CBD 1 and 2km from CBD 2
    distance_map = { "CBD_1": 5.0, "CBD_2": 2.0 }
    
    poly_density = engine_normal.calculate_polycentric_density(distance_map, centers_config)
    # Expected: (10 * e^-0.5) + (5 * e^-0.4) = 6.065 + 3.351 = 9.416
    print(f"Polycentric Density: {poly_density:.3f}")
    
    if 9.0 < poly_density < 10.0:
        print("PASS: Polycentric calculation within expected range.")
    else:
        print("FAIL: Polycentric calculation incorrect.")

    # 4. Auto-Calibration (Linear Regression)
    print("\n[Test 4] Auto-Calibration:")
    # Data: D0=10, g=0.1
    # x=0 -> y=10
    # x=10 -> y=10*e^-1 = 3.678
    samples = [
        (0.0, 10.0),
        (5.0, 6.065),
        (10.0, 3.678)
    ]
    
    d0_est, g_est = BertaudAuditEngine.calibrate_parameters(samples)
    print(f"Estimated D0: {d0_est:.2f} (Expected ~10)")
    print(f"Estimated g: {g_est:.3f} (Expected ~0.1)")
    
    if 9.9 < d0_est < 10.1 and 0.09 < g_est < 0.11:
        print("PASS: Calibration accurate.")
    else:
        print("FAIL: Calibration inaccurate.")

    # 5. Status Logic (Granularity & Context)
    print("\n[Test 5] Status Logic Granularity:")
    # Base: D0=10, g=0 -> Dx=10 everyday
    engine_status = BertaudAuditEngine(d0_center_density=10.0, density_gradient_g=0.0)
    
    # helper
    def check_status(name, density, zone, expected):
        res = engine_status.calculate_optimal_density(0,0,0,0, density, zone_color=zone)
        actual = res['status']
        print(f"  {name} (Index={res['efficiency_index']:.2f}, Zone={zone}): {actual} [{'PASS' if actual == expected else 'FAIL'}]")
    
    # Default Zone (Red/None): Low Warn 0.7-0.8, High Warn 1.1-1.2, Over > 1.2
    # D_opt = 10
    check_status("Critical Low", 6.0, None, "Under-utilization") # 0.6
    check_status("Warn Low", 7.5, None, "Low Density Warning") # 0.75
    check_status("Optimal", 9.0, None, "Optimal") # 0.9
    check_status("Warn High", 11.5, None, "High Density Warning") # 1.15
    check_status("Over", 13.0, None, "Over-densification") # 1.3
    
    # Yellow Zone: Stricter Upper (Over > 1.1)
    # Warn High becomes 1.0 - 1.1? Assuming logic adjustments.
    # Logic: optimal_high = 1.1 - 0.1 = 1.0. Warn High = 1.0 - 1.1. Over > 1.1
    print("  --- Yellow Zone Context ---")
    check_status("Yellow Warn High", 10.5, "Yellow", "High Density Warning") # 1.05
    check_status("Yellow Over", 11.5, "Yellow", "Over-densification") # 1.15 (Would be Warn in Red)

if __name__ == "__main__":
    verify_advanced_features()
