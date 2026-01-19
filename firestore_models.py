from dataclasses import dataclass, asdict
from typing import Optional, Dict

@dataclass
class LandParcel:
    """
    Represents a land parcel in the Bertaud Land Audit model.
    Collection: 'land_parcels'
    """
    id: str  # Firestore Document ID
    gps_coordinates: str # In production, use Firestore GeoPoint(lat, long)
    land_area_rai: float # 1 Rai = 1600 sq.m. Needs conversion for Bertaud calculations.
    appraisal_price_per_wah: float # Price per square wah (4 sq.m.)
    distance_from_cbd_km: float
    current_far: float # Current Floor Area Ratio
    legal_far_limit: float # Maximum legally allowed FAR
    parent_parcel_id: Optional[str] = None # Parent parcel ID if this is a sub-division
    ownership_type: str = "T.Ratchaphatsadu" # e.g. "T.Ratchaphatsadu" (Treasury), "Private", "Other"
    land_title_no: Optional[str] = None # Title Deed Number (Chanote)
    zone_color: Optional[str] = None # City Planning Zone Color (e.g. "Red", "Orange")
    gps_coordinates: str # In production, use Firestore GeoPoint(lat, long)
    
    # Audit Trail
    created_at: str = "" # ISO Format
    updated_at: str = "" # ISO Format
    version: int = 1

    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class EconomicParameters:
    """
    Economic parameters for the Bertaud model calculation.
    Collection: 'economic_parameters'
    """
    id: str # e.g. "tax_year_2025"
    year: int
    effective_date: str # ISO format YYYY-MM-DD
    is_active: bool = True
    discount_rate_state: float = 0.05 # Discount rate for State NPV (Treasury Dept standard)
    discount_rate: float = 0.05 # General discount rate (can be same as state or market)
    construction_cost_index_high_rise: float = 1.0 # Index relative to base year
    construction_cost_index_low_rise: float = 1.0 # Index relative to base year
    bertaud_density_gradient_coefficient: float = 0.0 # Gradient coefficient

    # Audit Trail
    created_at: str = "" # ISO Format
    updated_at: str = "" # ISO Format
    version: int = 1

    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class ProjectProposal:
    """
    A proposed development project on a specific land parcel.
    Collection: 'project_proposals'
    """
    id: str # Firestore Document ID
    parcel_id: str # Reference to LandParcel ID
    param_id: str # Reference to EconomicParameters ID (Origin)
    economic_parameters_snapshot: Dict # Full snapshot of the parameters used at calculation time
    proposed_gfa: float # Gross Floor Area in sq.m.
    proposed_building_type: str # 'high-rise' or 'low-rise'
    proposed_investment_cost: float # Total investment cost in THB
    proposed_upfront_fee: float # Upfront fee paid to Treasury Dept
    proposed_annual_rent: float # Annual rent paid to Treasury Dept
    
    # Optional / Default Fields
    calculation_inputs: Dict = None # Inputs used for audit: { "d0": ..., "g": ..., "distance_km": ... }
    efficiency_score: Optional[float] = None # Bertaud Efficiency Index (0.8 - 1.2 is Optimal)
    audit_status: str = "Pending" # e.g. "Pending", "Approved", "Rejected"
    analyst_id: Optional[str] = None # User ID of the auditor

    # Audit Trail
    created_at: str = "" # ISO Format
    updated_at: str = "" # ISO Format
    version: int = 1

    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class ProposalHistory:
    """
    Log of changes for a ProjectProposal.
    Sub-collection: 'project_proposals/{proposal_id}/history'
    """
    id: str # Auto-generated ID
    proposal_id: str # Parent Proposal ID
    changed_by: str # User ID who made the change
    changed_at: str # ISO Format timestamp
    change_summary: str # Description of changes
    previous_snapshot: Dict # Snapshot of the proposal BEFORE this change
    
    def to_dict(self) -> Dict:
        return asdict(self)
