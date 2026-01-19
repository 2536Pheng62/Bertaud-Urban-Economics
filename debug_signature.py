import inspect
from financial_audit import FinancialAudit

print("Signature of calculate_state_npv:")
print(inspect.signature(FinancialAudit.calculate_state_npv))

try:
    from verify_finance import verify_financial_audit
    verify_financial_audit()
except Exception as e:
    print(f"\nCaught Exception: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
