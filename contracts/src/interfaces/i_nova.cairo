use nova::types::{Position, ProtocolState, YieldCheckpoint};
use starknet::ContractAddress;

#[starknet::interface]
pub trait INova<TContractState> {
    // ─────────────────────────────────────────────────────────────────
    // USER WRITES
    // ─────────────────────────────────────────────────────────────────

    /// Create a new savings goal position.
    ///
    /// Transfers `amount` from the caller into Nova Core.
    ///
    /// Nova shares minted is 1:1 on first deposit but after first deposit becomes
    /// nova_shares_to_mint = (amount_deposited * total_nova_shares) / (total_principal)
    /// Position weight for yield distribution = amount^1.5 * duration
    ///   Longer and larger commitments receive more yield distribution weight.
    ///   Commitment duration must be 30 minutes (1800s) to 2 years (63,072,000s).
    ///
    /// Gate yield is harvested and losses detected before position is created.
    ///
    /// Returns the slot index (0–6) assigned to this position.
    fn deposit(
        ref self: TContractState, amount: u256, commitment_duration: u64, goal_name: felt252,
    ) -> u32;

    /// Add more deposit amount (wBTC) to an existing active position.
    ///
    /// nova_shares: mint more nova shares for the position based on the amount deposited
    /// position_weight: increase the position weight only by amount^1.5 * remaining_duration
    ///   Weight uses REMAINING duration (not original), so topping up late earns position weight
    ///   only for the remaining duration
    /// original_deposit: increased for accurate reference tracking.
    fn top_up(ref self: TContractState, position_id: u32, amount: u256);

    /// Withdraw from a savings position.
    ///
    /// Commitment met (now >= commitment_end):
    ///   User receives full position_value with no penalty.
    ///   nova_shares-value = (position_nova_shares * total_principal) / total_nova_shares
    ///   position_value = nova_shares_value + (position_weight / total_weight) * total_yield_pool
    ///   This includes principal + their pro-rata share of yield pool based on the weight
    ///
    /// Early exit (now < commitment_end):
    ///   Penalty is calculated from nova_shares_value based on remaining time.
    ///   penalty = nova_shares_value * (remaining_seconds / total_seconds)
    ///   user_receives = position_value - penalty
    ///   penalty goes to total_yield_pool and is distributed to remaining holders
    ///   Yield gathered from the weight is forfeited for other users with weights
    fn withdraw(ref self: TContractState, position_id: u32);

    /// Updates the yield pool when the active gate accrues yield.
    /// Must be called only by the active gate adapter.
    fn update_yield_from_gate(ref self: TContractState, amount: u256);

    // ─────────────────────────────────────────────────────────────────
    // USER READS
    // ─────────────────────────────────────────────────────────────────

    /// Get withdrawal details for a position without actually withdrawing.
    ///
    /// Returns (initial_deposit, position_weight, principal_value, yield_value, early_exit_penalty)
    /// - initial_deposit: Original amount deposited for reference
    /// - position_weight: The weight used for yield distribution (amount^1.5 × duration)
    /// - principal_value: Current value of deposited capital (may be less than initial_deposit if
    /// losses occurred)
    /// - yield_value: Pro-rata share of accumulated yield pool
    /// - early_exit_penal ty: Amount deducted if withdrawn before commitment deadline (0 if
    /// deadline passed)
    fn get_withdrawwal_quote(
        self: @TContractState, user: ContractAddress, position_id: u32,
    ) -> (u256, u256, u256, u256, u256);

    /// Get a single position by user and position_id.
    fn get_position(self: @TContractState, user: ContractAddress, position_id: u32) -> Position;

    /// All active positions for a user.
    /// Always reads exactly 7 storage slots
    /// Inactive slots are filtered out of the returned array.
    fn get_all_positions(self: @TContractState, user: ContractAddress) -> Array<Position>;

    /// Get the total assets controlled by Nova Core.
    /// Includes both capital held directly and capital deployed to yield strategies.
    /// total_assets = principal_pool + yield_pool
    fn get_total_assets(self: @TContractState) -> u256;

    /// Get the principal pool value (excludes yield).
    /// Calculated as: (wBTC balance in Nova) - (yield pool) + (capital deployed in gate)
    /// Used for:
    /// - Determining nova_shares value (NAV pricing)
    /// - Computing how many shares to mint on deposits
    /// - Calculating deployment targets (25% of principal)
    fn get_principal_pool(self: @TContractState) -> u256;

    /// Returns protocol state snapshot.
    /// Includes total nova share value, total yield pool, total position weight, active gate, and
    /// deployed amount.
    fn get_protocol_state(self: @TContractState) -> ProtocolState;

    /// Get historical yield accumulation data for charting a nd analytics.
    ///
    /// Returns (checkpoints, current_yield_pool) where:
    /// - checkpoints: Array of up to 6 historical yield snapshots (1-hour intervals, 6-hour max
    /// history)
    ///   Each checkpoint stores (timestamp, cumulative_yield_at_that_time)
    /// - current_yield_pool: Real-time yield pool balance for current period
    ///
    /// Frontend can calculate per-period yield by computing differences between consecutive
    /// checkpoints.
    fn get_yield_history(self: @TContractState) -> (Array<YieldCheckpoint>, u256);

    /// Get the share count for stable gate liquidity (14-day commitment window).
    /// Returns raw share amount tracking locked capital (positions with duration > 14 days).
    /// Use get_stable_gate_liquidity_btc() to convert to wBTC value for display.
    fn get_stable_gate_liquidity_shares(self: @TContractState) -> u256;

    /// Get the wBTC value of stable gate liquidity (14-day commitment window).
    /// Converts shares to BTC using current share price, accounting for any gate losses.
    /// This represents the amount of wBTC locked in 14+ day commitments,
    /// scaled by deployment ratio (25%) and confidence factor (75%).
    fn get_stable_gate_liquidity_btc(self: @TContractState) -> u256;

    // ─────────────────────────────────────────────────────────────────
    // ADMIN WRITES
    // ─────────────────────────────────────────────────────────────────

    /// Set a new active yield gate adapter.
    /// Pulls all capital from the current gate first.
    /// Redeploys into the new gate via _rebalance_deployment().
    /// Pass zero address to disable yield deployment entirely.
    fn set_active_gate(ref self: TContractState, new_gate: ContractAddress);
}
