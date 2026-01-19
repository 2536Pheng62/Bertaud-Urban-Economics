from bertaud_engine import BertaudAuditEngine

def verify_bertaud_engine():
    print("--- Verifying Bertaud Audit Engine ---")

    # 1. Setup Engine
    # Assume D0 (Center Density) = 10.0 (e.g., FAR)
    # Assume g (Gradient) = 0.1
    engine = BertaudAuditEngine(d0_center_density=10.0, density_gradient_g=0.1)
    print(f"Engine Initialized: D0={engine.d0}, g={engine.g}")

    # 2. Test Cases
    test_cases = [
        {
            "description": "Close to CBD (2km), Proposed FAR 8.0 (Likely Optimal)",
            "distance_km": 2.0,
            "proposed_density": 8.0
        },
        {
            "description": "Far from CBD (10km), Proposed FAR 1.0 (Likely Under-utilized if theoretical is higher)",
            "distance_km": 10.0,
            "proposed_density": 1.0 
        },
        {
            "description": "Medium Distance (5km), Proposed FAR 12.0 (Likely Over-densification)",
            "distance_km": 5.0,
            "proposed_density": 12.0
        }
    ]

    for case in test_cases:
        print(f"\nTesting: {case['description']}")
        result = engine.calculate_optimal_density(
            capital_k=100000, # Dummy value
            land_cost_e=5000000, # Dummy value
            transport_cost=50, # Dummy value
            distance_km=case['distance_km'],
            proposed_density=case['proposed_density']
        )
        
        print(f"  Distance: {result['distance_km']} km")
        print(f"  Proposed Density: {result['proposed_density']}")
        print(f"  Theoretical Density: {result['theoretical_density']:.4f}")
        print(f"  Efficiency Index: {result['efficiency_index']:.4f}")
        print(f"  Status: {result['status']}")

    # 3. Verify Unit Conversions
    print("\n--- Verifying Unit Conversions ---")
    rai = 1.0
    sqm = BertaudAuditEngine.convert_rai_to_sqm(rai)
    print(f"1 Rai = {sqm} sq.m. (Expected: 1600.0)")
    assert sqm == 1600.0
    
    wah = 10.0
    sqm_wah = BertaudAuditEngine.convert_wah_to_sqm(wah)
    print(f"10 Wah = {sqm_wah} sq.m. (Expected: 40.0)")
    assert sqm_wah == 40.0

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    verify_bertaud_engine()
