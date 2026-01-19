# import firebase_admin
# from firebase_admin import credentials, firestore
from firestore_models import LandParcel, EconomicParameters, ProjectProposal

def initialize_firestore_example():
    print("--- Initializing Firestore Data Setup (Simulation) ---")

    # NOTE: In a real environment, you would provide the path to your service account key
    # cred = credentials.Certificate("path/to/serviceAccountKey.json")
    # firebase_admin.initialize_app(cred)
    # db = firestore.client()
    
    print("MOCK: Connected to Firestore.")

    # 1. Create Economic Parameters
    econ_params = EconomicParameters(
        id="tax_year_2024",
        year=2024,
        effective_date="2024-01-01",
        is_active=True,
        discount_rate_state=0.05,
        discount_rate=0.05,
        construction_cost_index_high_rise=1.02,
        construction_cost_index_low_rise=1.01,
        bertaud_density_gradient_coefficient=0.15,
        created_at="2024-01-01T09:00:00Z",
        updated_at="2024-01-01T09:00:00Z",
        version=1
    )
    
    # db.collection("economic_parameters").document(econ_params.id).set(econ_params.to_dict())
    print(f"MOCK: Created EconomicParameters: {econ_params.to_dict()}")

    # 2. Create a Land Parcel
    parcel = LandParcel(
        id="parcel_001",
        gps_coordinates="13.7563, 100.5018",
        land_area_rai=5.0,
        appraisal_price_per_wah=150000.0,
        distance_from_cbd_km=2.5,
        current_far=4.5,
        legal_far_limit=8.0,
        ownership_type="T.Ratchaphatsadu",
        land_title_no="12345",
        zone_color="Red",
        created_at="2024-01-01T10:00:00Z",
        updated_at="2024-01-01T10:00:00Z",
        version=1
    )
    
    # db.collection("land_parcels").document(parcel.id).set(parcel.to_dict())
    print(f"MOCK: Created LandParcel: {parcel.to_dict()}")

    # 3. Create a Project Proposal (With Snapshot & Audit Info & Input Versioning)
    # Simulate Engine Calculation
    # Inputs
    sim_d0 = 20.0 # From hypothetical city model
    sim_g = 0.15
    sim_dist = 2.5
    
    # 3.1 Validate Inputs
    from bertaud_engine import BertaudAuditEngine
    errors = BertaudAuditEngine.validate_inputs(sim_d0, sim_g, sim_dist)
    if errors:
        print(f"ERROR: Validation failed: {errors}")
        exit(1)

    proposal = ProjectProposal(
        id="proposal_alpha",
        parcel_id=parcel.id,
        param_id=econ_params.id,
        economic_parameters_snapshot=econ_params.to_dict(), # SNAPSHOT
        calculation_inputs={ # INPUT VERSIONING
            "d0": sim_d0,
            "g": sim_g,
            "distance_km": sim_dist,
            "formula_version": "v1.0"
        },
        proposed_gfa=45000.0,
        proposed_building_type="high-rise",
        proposed_investment_cost=1200000000.0,
        proposed_upfront_fee=50000000.0,
        proposed_annual_rent=12000000.0,
        efficiency_score=1.05,
        audit_status="Approved",
        analyst_id="auditor_007",
        created_at="2024-01-02T14:30:00Z",
        updated_at="2024-01-02T14:30:00Z",
        version=1
    )
    
    # db.collection("project_proposals").document(proposal.id).set(proposal.to_dict())
    print(f"MOCK: Created ProjectProposal: {proposal.to_dict()}")

    # 4. Create Proposal History (Mock)
    # Import locally to avoid top-level circular issues if moved later, but fine here
    from firestore_models import ProposalHistory
    
    history_entry = ProposalHistory(
        id="hist_001",
        proposal_id=proposal.id,
        changed_by="auditor_007",
        changed_at="2024-01-02T14:30:00Z",
        change_summary="Initial Creation",
        previous_snapshot={} # Empty for creation
    )
    # db.collection("project_proposals").document(proposal.id).collection("history").document(history_entry.id).set(history_entry.to_dict())
    print(f"MOCK: Created ProposalHistory: {history_entry.to_dict()}")
    
    print("--- Setup Complete ---")

if __name__ == "__main__":
    initialize_firestore_example()
