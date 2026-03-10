// ─────────────────────────────────────────────────────────────────────────────
// NOVA TYPES
// ─────────────────────────────────────────────────────────────────────────────

// All ratios in basis points (10_000 = 100%)
use starknet::ContractAddress;

pub const BASIS_POINTS: u256 = 10_000;

// Maximum savings positions per user
pub const MAX_POSITIONS: u32 = 7;

// Minimum commitment duration — 30 minutes
pub const MIN_DURATION: u64 = 1_800;

// Maximum commitment duration — 2 years
pub const MAX_DURATION: u64 = 63_072_000; // 2 years in seconds

// Yield checkpoint storage: 6 points (6 hours of history at 1-hour intervals)
pub const MAX_YIELD_CHECKPOINTS: u32 = 6;
// 1 hour in seconds
pub const CHECKPOINT_INTERVAL: u64 = 3_600;

// Stable gate liquidity tracking window — 14 days in seconds
pub const STABLE_GATE_LIQUIDITY_WINDOW: u64 = 1_209_600; // 14 days
// Confidence factor for stable gate liquidity (as basis points)
pub const STABLE_GATE_LIQUIDITY_CONFIDENCE: u256 = 7_500; // 75% (7500 basis points)


/// Yield checkpoint for historical tracking (1-hour buckets).
/// Stores cumulative yield at specific timestamps for charting.
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct YieldCheckpoint {
    pub timestamp: u64,
    pub cumulative_yield: u256,
}


/// A single savings position.
///
/// Share-based accounting model (Feb 2026):
/// - nova_shares: share count representing position's claim on principal pool
/// - nova_shares_value (derived): (nova_shares / total_nova_shares) * (principal_pool - yield_pool)
///   Fair NAV pricing ensures deposits after losses get proper share count
/// - position_weight: amount^1.5 * duration, used ONLY for yield distribution
/// - position_value = nova_shares_value + (position_weight / total_weight) * total_yield
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct Position {
    // ── Slot
    pub position_id: u32,
    pub is_active: bool,
    pub goal_name: felt252,
    // ── Principal tracking (share-based accounting)
    // principal pool would be tracked via a function accouunting for both assets in the nova -
    // yield pool and assets in the gate
    // ───────────────────────────────────────────────────────
    /// Nova shares: share count for proportional principal claim
    /// Calculated as: (deposit_amount / principal pool) * total_nova_shares)
    /// or 1:1 if empty
    /// Nova shares Value = (nova_shares / total_nova_shares) * (principal pool)
    pub nova_shares: u256,
    // ── Yield distribution weight
    // ─────────────────────────────────────────────────────────
    /// weight = amount^1.5 * duration
    /// Used ONLY for distributing yield from gate and early exits
    pub position_weight: u256,
    /// Original amount deposited (for reference)
    pub original_deposit: u256,
    // ── Commitment info
    pub commitment_start: u64,
    pub commitment_end: u64,
    // ── Stable gate liquidity tracking
    /// How many shares from this position are counted toward stable gate liquidity
    /// (14+ day locked commitments). Set at deposit, never updated on top-ups.
    pub stable_gate_liquidity_shares_counted: u256,
}


// For View Purposes Only
#[derive(Drop, Serde)]
pub struct ProtocolState {
    // ── Principal & Yield
    // ─────────────────────────────────────────────────────
    /// total nova share value, that is the amount of principal in the protocol minus the yield
    pub total_nova_share_value: u256,
    /// Accumulated yield from gate + early exit penalties
    pub total_yield_pool: u256,
    // ── Position Weights
    // ─────────────────────────────────────────────────────
    /// Total position weight: sum of all position weights (amount^1.5 * duration)
    pub total_position_weight: u256,
    // ── Gate & Deployment
    // ─────────────────────────────────────────────────────
    /// Active gate address
    pub active_gate_address: ContractAddress,
    /// wBTC deployed in gate (yield adapter) (target, roughly 25%)
    pub gate_deployed: u256,
}

