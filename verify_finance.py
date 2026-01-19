from financial_audit import FinancialAudit, FinancialParams

def verify_financial_audit():
    print("--- Verifying Financial Audit Module (Refactored) ---")
    
    auditor = FinancialAudit()
    
    # 1. Test NPV Calculation
    print("\n[Test 1] State NPV Calculation")
    # Scenario: 50M Upfront, 10M Annual Rent, 1B Investment
    # Rent escalates 15% every 5 years.
    
    params_test_1 = FinancialParams(
        upfront_fee=50_000_000,
        initial_annual_rent=10_000_000,
        lease_term_years=30,
        discount_rate=0.035,
        investment_cost=1_000_000_000,
        asset_useful_life_years=50
    )
    
    npv = auditor.calculate_state_npv(params_test_1)
    print(f"  Calculated NPV: {npv:,.2f} THB")
    
    # 2. Test Cost Validation
    print("\n[Test 2] Construction Cost Validation")
    test_cases_cost = [
        {"type": "high-rise", "cost": 32000, "desc": "Slightly High (Normal)"}, # 6.67% dev
        {"type": "high-rise", "cost": 40000, "desc": "Very High (>20%)"}, # 33% dev
        {"type": "low-rise", "cost": 10000, "desc": "Very Low (>20%)"}  # -33% dev
    ]
    
    for case in test_cases_cost:
        res = auditor.validate_construction_cost(case['cost'], case['type'])
        print(f"  Case {case['desc']} ({case['cost']}): Status='{res['status']}', Deviation={res['deviation_percent']:.2f}%")

    # 2. Test Contextual Construction Cost Validation
    print("\n[Test 2] Construction Cost Validation (Contextual):")
    # Base High-Rise: 30,000
    # Scenario: Phuket (Factor 1.15) -> Standard = 34,500
    # Proposed: 35,000 (Should Pass, as it matches adjusted standard)
    
    # Case A: Phuktet
    res_phuket = auditor.validate_construction_cost(35000, "high-rise", province="Phuket")
    print(f"  Phuket (Prop: 35k, AdjStd: {res_phuket['adjusted_standard_cost']:,.0f}): {res_phuket['status']}")
    
    # Case B: Udon Thani Anomaly
    res_udon = auditor.validate_construction_cost(40000, "high-rise", province="Udon Thani")
    print(f"  Udon Thani (Prop: 40k, AdjStd: {res_udon['adjusted_standard_cost']:,.0f}): {res_udon['status']}")
    
    if res_phuket['status'] == "Pass" and res_udon['status'] == "Cost Anomaly Detected":
        print("PASS: Contextual benchmarking correctly adjusts for location.")
    else:
        print("FAIL: Contextual logic incorrect.")

    # 3. Sensitivity Analysis
    print("\n[Test 3] Sensitivity Analysis:")
    # Using dictionary as input for perform_sensitivity_analysis which internally creates FinancialParams
    base_params_dict = {
        "upfront_fee": 50000000,
        "initial_annual_rent": 12000000,
        "lease_years": 30,
        "investment_cost": 0 # Explicit for sensitivity
    }
    
    sensitivity = auditor.perform_sensitivity_analysis(base_params_dict)
    base_npv = sensitivity['Base Case']
    print(f"  Base NPV: {base_npv:,.2f}")
    
    # Check Discount Rate Sensitivity
    rates = sensitivity['Discount Rate Sensitivity']
    print("  Interest Rate Impact:")
    for shift, val in rates.items():
        diff = ((val - base_npv) / base_npv) * 100
        print(f"    {shift}: {val:,.2f} ({diff:+.2f}%)")
        
    # Validation
    if rates['+2% Rate'] < base_npv:
        print("PASS: Higher interest reduces NPV.")
    else:
        print("FAIL: Interest logic inconsistent.")

    # 4. Break-even Lease Term
    print("\n[Test 4] Investor Break-even Lease Term:")
    invest_cost = 500000000
    net_cf = 40000000
    discount = 0.05
    
    years = auditor.calculate_breakeven_lease_term(invest_cost, net_cf, discount)
    print(f"  Break-even Year: {years}")
    
    if 15 < years < 25:
        print(f"PASS: Break-even {years} years is realistic.")
    else:
        print(f"FAIL: Break-even {years} seems off.")
    
    # 5. Test ROA Calculation
    print("\n[Test 5] Return on Asset (ROA)")
    
    # Scenario A: Low Return
    params_a = FinancialParams(
        upfront_fee=0,
        initial_annual_rent=10_000_000,
        lease_term_years=30,
        discount_rate=0.035, # Dummy for ROA calc
        investment_cost=1_000_000_000,
        asset_useful_life_years=50
    )
    res_a = auditor.calculate_return_on_asset(params_a)
    print(f"  Scenario A (Low Return): ROA={res_a['roa_percent']:.2f}%, Status='{res_a['status']}'")
    
    # Scenario B: High Return
    params_b = FinancialParams(
        upfront_fee=0,
        initial_annual_rent=10_000_000,
        lease_term_years=30,
        discount_rate=0.035, 
        investment_cost=100_000_000,
        asset_useful_life_years=50
    )
    res_b = auditor.calculate_return_on_asset(params_b)
    print(f"  Scenario B (High Return): ROA={res_b['roa_percent']:.2f}%, Status='{res_b['status']}'")

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    verify_financial_audit()
