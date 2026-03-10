// ─────────────────────────────────────────────────────────────────────────────
// NOVA CORE CONTRACT
//
// Yield-bearing commitment savings protocol with dual accounting model.
//
// KEY CONCEPTS:
// • Principal Pool: Protected capital tracked via nova_shares (share-based NAV pricing)
//   - Value only decreases on actual losses (socialized across all holders)
// • Yield Pool: Accumulated yield from deployed capital + early exit penalties
//   - Distributed pro-rata to users based on position_weight (amount^1.5 × duration)
// • Positions: User-specific, non-transferable savings goals
//   - Position value = principal_share + yield_share
//   - Early exit penalty = principal_share × (remaining_time / total_time)
// ─────────────────────────────────────────────────────────────────────────────

#[starknet::contract]
pub mod NovaCore {
    use core::num::traits::Zero;
    use nova::interfaces::i_gate::{IGateDispatcher, IGateDispatcherTrait};
    use nova::interfaces::i_nova::INova;
    use nova::math::{
        calculate_early_exit_penalty, calculate_nova_shares_to_create, calculate_nova_shares_value,
        calculate_position_weight_value, calculate_position_weight_yield,
    };
    use nova::types::{
        BASIS_POINTS, CHECKPOINT_INTERVAL, MAX_DURATION, MAX_POSITIONS, MAX_YIELD_CHECKPOINTS,
        MIN_DURATION, Position, ProtocolState, STABLE_GATE_LIQUIDITY_CONFIDENCE,
        STABLE_GATE_LIQUIDITY_WINDOW, YieldCheckpoint,
    };
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};

    /// Fraction of total_assets to keep in gate by continuous rebalancing, in basis points.
    const DEPLOYMENT_RATIO: u256 = 2_500; // 25% in basis points

    // ─────────────────────────────────────────────────────────────────────────
    // STORAGE
    // ─────────────────────────────────────────────────────────────────────────

    #[storage]
    struct Storage {
        // ── Protocol Assets
        // ──────────────────────────────────────────────────────────
        /// wBTC token address (the asset users deposit)
        asset: ContractAddress,
        // ── Principal Pool (Share-Based Accounting)
        // ──────────────────────────────────────────────────────────
        /// Total nova shares issued across all positions.
        /// nova_share_value = (position.nova_shares / total_nova_shares) × principal_pool
        total_nova_shares: u256,
        // ── Yield Pool & Distribution
        // ───────────────────────────────────────────────────────
        /// Accumulated yield from gate harvests + early exit penalties
        total_yield_pool: u256,
        // ── Yield History (for frontend charting & analytics)
        // ───────────────────────────────────────────────────────
        /// Circular buffer storing yield checkpoints (max 6, one per hour, 6-hour history)
        yield_checkpoints: Map<u32, YieldCheckpoint>,
        /// Number of checkpoints stored (0-6)
        yield_checkpoints_len: u32,
        /// Next checkpoint write position (circular buffer head pointer)
        yield_checkpoints_head: u32,
        /// Timestamp of the most recent checkpoint
        last_yield_checkpoint_timestamp: u64,
        // ── Yield Distribution Weight (determines yield share allocation)
        // ───────────────────────────────────────────────────────
        /// Sum of all position weights: Σ(amount^1.5 × duration)
        /// User's yield_share = (position.position_weight / total_weight) × total_yield_pool
        total_weight: u256,
        // ── Yield Generation (Gate/Strategy)
        // ──────────────────────────────────────────────────────────
        /// Address of the current yield-generating adapter (strategy/gate contract)
        active_gate: ContractAddress,
        // ── Position Storage (keyed by user and slot)
        // ──────────────────────────────────────────────────────
        /// All position data, keyed by (user_address, slot_id) for efficient lookup
        positions: Map<(ContractAddress, u32), Position>,
        // ── Access Control
        // ──────────────────────────────────────────────────────────
        /// Address authorized to admin operations (set_active_gate)
        admin: ContractAddress,
        // ── Stable Gate Liquidity (14-day locked commitment tracking)
        // ──────────────────────────────────────────────────────────
        /// Sum of nova_shares for positions with duration > 14 days, scaled by 0.25 × 0.75
        /// Represents locked capital available to gate for next 14 days
        stable_gate_liquidity_shares: u256,
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    #[constructor]
    fn constructor(ref self: ContractState, asset: ContractAddress, admin: ContractAddress) {
        self.asset.write(asset);
        self.admin.write(admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC IMPLEMENTATION
    // ─────────────────────────────────────────────────────────────────────────

    #[abi(embed_v0)]
    impl NovaCoreImpl of INova<ContractState> {
        // ── deposit
        // ───────────────────────────────────────────────────────
        /// Create a new savings position.
        ///
        /// Transfers wBTC from caller, mints nova_shares based on current principal,
        /// and assigns position_weight for yield distribution.
        ///
        /// Returns the slot index (0-6) of the created position.
        fn deposit(
            ref self: ContractState, amount: u256, commitment_duration: u64, goal_name: felt252,
        ) -> u32 {
            assert(amount > 0, 'Amount must be > 0');
            assert(commitment_duration >= MIN_DURATION, 'Duration too short');
            assert(commitment_duration <= MAX_DURATION, 'Duration too long');

            let caller = get_caller_address();
            let slot = self._find_available_slot(caller);
            assert(slot < MAX_POSITIONS, 'Max 7 positions reached');

            // Harvest gate yield before accounting
            self._try_harvest();

            let now = get_block_timestamp();
            // Calculate principal pool BEFORE pulling funds (to avoid inflating the pool)
            let total_principal = self.get_principal_pool();
            let total_shares = self.total_nova_shares.read();

            // Pull funds
            let ok = IERC20Dispatcher { contract_address: self.asset.read() }
                .transfer_from(caller, get_contract_address(), amount);
            assert(ok, 'Transfer failed');

            let nova_shares: u256 = calculate_nova_shares_to_create(
                amount, total_principal, total_shares,
            );
            let position_weight = calculate_position_weight_yield(amount, commitment_duration);

            // Calculate stable gate liquidity shares (only for 14+ day commitments)
            let stable_gate_liquidity_shares_counted =
                if commitment_duration > STABLE_GATE_LIQUIDITY_WINDOW {
                (nova_shares * DEPLOYMENT_RATIO / BASIS_POINTS)
                    * STABLE_GATE_LIQUIDITY_CONFIDENCE
                    / BASIS_POINTS
            } else {
                0
            };

            // Store position
            let position = Position {
                position_id: slot,
                is_active: true,
                goal_name,
                nova_shares,
                original_deposit: amount,
                commitment_start: now,
                commitment_end: now + commitment_duration,
                position_weight,
                stable_gate_liquidity_shares_counted,
            };
            self.positions.write((caller, slot), position);

            self.total_nova_shares.write(total_shares + nova_shares);
            self.total_weight.write(self.total_weight.read() + position_weight);

            // Update stable_gate_liquidity with the position's tracked amount
            self
                .stable_gate_liquidity_shares
                .write(
                    self.stable_gate_liquidity_shares.read() + stable_gate_liquidity_shares_counted,
                );

            self._rebalance_deployment();

            slot
        }

        // ── top_up
        // ────────────────────────────────────────────────────────
        /// Add additional wBTC to an existing active position.
        ///
        /// New nova_shares minted proportionally to the current principal pool NAV.
        /// New position_weight calculated using remaining commitment duration (not original).
        /// This incentivizes late deposits to smaller commitments.
        fn top_up(ref self: ContractState, position_id: u32, amount: u256) {
            assert(amount > 0, 'Amount must be > 0');
            assert(position_id < MAX_POSITIONS, 'Invalid position id');

            let caller = get_caller_address();
            let mut position = self.positions.read((caller, position_id));
            assert(position.is_active, 'Position not active');

            let now = get_block_timestamp();
            assert(now < position.commitment_end, 'Commitment already ended');

            self._try_harvest();

            // Calculate principal pool BEFORE pulling funds (to avoid inflating the pool)
            let total_principal = self.get_principal_pool();
            let total_shares = self.total_nova_shares.read();

            let ok = IERC20Dispatcher { contract_address: self.asset.read() }
                .transfer_from(caller, get_contract_address(), amount);
            assert(ok, 'Transfer failed');
            let new_nova_shares: u256 = calculate_nova_shares_to_create(
                amount, total_principal, total_shares,
            );
            position.nova_shares += new_nova_shares;

            // Weight with remaining duration
            let remaining_duration = position.commitment_end - now;
            let new_weight = calculate_position_weight_yield(amount, remaining_duration);
            position.position_weight += new_weight;

            position.original_deposit += amount;
            self.positions.write((caller, position_id), position);

            self.total_nova_shares.write(total_shares + new_nova_shares);
            self.total_weight.write(self.total_weight.read() + new_weight);

            // Note: top-ups do NOT add to stable_gate_liquidity. Only the original deposit counts.

            self._rebalance_deployment();
        }

        // ── withdraw
        // ──────────────────────────────────────────────────────
        /// Withdraw from a savings position (full withdrawal only).
        ///
        /// On-time withdrawal (commitment met):
        ///   • User receives full position value: principal_share + yield_share
        ///   • No penalties applied
        ///
        /// Early withdrawal (commitment not met):
        ///   • Penalty applied: principal_share × (remaining_seconds / total_seconds)
        ///   • User receives: principal_share - penalty + yield_share
        ///   • Penalty flows to yield pool and benefits remaining holders
        ///   • Position weight is destroyed (removed from yield distribution)
        fn withdraw(ref self: ContractState, position_id: u32) {
            assert(position_id < MAX_POSITIONS, 'Invalid position id');

            let caller = get_caller_address();
            let position = self.positions.read((caller, position_id));
            assert(position.is_active, 'Position not active');

            self._try_harvest();
            let now = get_block_timestamp();

            if now >= position.commitment_end {
                self._full_withdrawal(caller, position_id, position);
            } else {
                self._early_withdrawal(caller, position_id, position, now);
            }
            self._rebalance_deployment();
        }

        // ── update_yield_from_gate
        // ──────────────────────────────────────────────────────
        /// Updates the yield pool when the active gate accrues yield.
        /// Must be called only by the active gate adapter.
        fn update_yield_from_gate(ref self: ContractState, amount: u256) {
            let gate_addr = self.active_gate.read();
            assert(!gate_addr.is_zero(), 'No active gate');
            assert(get_caller_address() == gate_addr, 'Only gate can call');

            self.total_yield_pool.write(self.total_yield_pool.read() + amount);
            self._maybe_record_yield_checkpoint();
        }

        ////////// Getter Functions //////////

        // ── get_position
        // ─────────────────────────────────────────────
        /// Get a single position by user and position_id.
        fn get_position(self: @ContractState, user: ContractAddress, position_id: u32) -> Position {
            assert(position_id < MAX_POSITIONS, 'Invalid position id');
            self.positions.read((user, position_id))
        }

        // ── get_all_positions
        // ─────────────────────────────────────────────
        /// Returns all active positions for a user.
        /// Always reads exactly 7 slots — fixed gas cost.
        fn get_all_positions(self: @ContractState, user: ContractAddress) -> Array<Position> {
            let mut result: Array<Position> = ArrayTrait::new();
            let mut i: u32 = 0;

            while i < MAX_POSITIONS {
                let pos = self.positions.read((user, i));
                if pos.is_active {
                    result.append(pos);
                }
                i += 1;
            }
            result
        }

        // ── get_withdrawwal_quote
        // ──────────────────────────────────────────
        /// Get withdrawal details for a position without actually withdrawing.
        ///
        /// Returns (initial_deposit, position_weight, principal_value, yield_value,
        /// early_exit_penalty)
        /// - initial_deposit: Original amount deposited for reference
        /// - position_weight: The weight used for yield distribution (amount^1.5 × duration)
        /// - principal_value: Current value of deposited capital (may be less than initial_deposit
        /// if losses occurred)
        /// - yield_value: Pro-rata share of accumulated yield pool
        /// - early_exit_penalty: Amount deducted if withdrawn before commitment deadline (0 if
        /// deadline passed)
        fn get_withdrawwal_quote(
            self: @ContractState, user: ContractAddress, position_id: u32,
        ) -> (u256, u256, u256, u256, u256) {
            if position_id > MAX_POSITIONS {
                return (0, 0, 0, 0, 0);
            }
            let position = self.positions.read((user, position_id));
            if !position.is_active {
                return (0, 0, 0, 0, 0);
            }

            let now = get_block_timestamp();
            let total_principal = self.get_principal_pool();

            let nova_shares_value = calculate_nova_shares_value(
                position.nova_shares, self.total_nova_shares.read(), total_principal,
            );
            let position_weight_value = calculate_position_weight_value(
                position.position_weight, self.total_weight.read(), self.total_yield_pool.read(),
            );

            if now >= position.commitment_end {
                return (
                    position.original_deposit,
                    position.position_weight,
                    nova_shares_value,
                    position_weight_value,
                    0,
                );
            }

            let penalty = calculate_early_exit_penalty(
                nova_shares_value, position.commitment_start, position.commitment_end, now,
            );
            // Early exit: user receives yield but forfeits future yield (position_weight becomes
            // irrelevant)
            (
                position.original_deposit,
                position.position_weight,
                nova_shares_value,
                position_weight_value,
                penalty,
            )
        }

        // ── get_total_assets
        // ────────────────────────────────────────────
        /// Get the total assets controlled by Nova Core.
        /// Includes both capital held directly and capital deployed to yield strategies.
        /// total_assets = principal_pool + yield_pool
        fn get_total_assets(self: @ContractState) -> u256 {
            self.get_principal_pool() + self.total_yield_pool.read()
        }

        // ── get_principal_pool
        // ────────────────────────────────────────────
        /// Get the principal pool value (excludes yield).
        /// Calculated as: (wBTC balance in Nova) - (yield pool) + (capital deployed in gate)
        /// Used for:
        /// - Determining nova_shares value (NAV pricing)
        /// - Computing how many shares to mint on deposits
        /// - Calculating deployment targets (25% of principal)
        fn get_principal_pool(self: @ContractState) -> u256 {
            let wBTC = IERC20Dispatcher { contract_address: self.asset.read() };
            let active_gate = IGateDispatcher { contract_address: self.active_gate.read() };

            let balance = wBTC.balance_of(get_contract_address());
            let yield_pool = self.total_yield_pool.read();
            let gate_value = active_gate.current_value();

            // Safeguard: ensure balance >= yield_pool before subtraction to prevent underflow
            // If balance < yield_pool, principal_pool should reflect only the gate deployed capital
            let principal_pool = if balance >= yield_pool {
                balance + gate_value - yield_pool
            } else {
                // Edge case: yield pool exceeds balance, return only gate deployed capital as
                // principal
                gate_value
            };

            principal_pool
        }

        // ── get_protocol_state
        // ────────────────────────────────────────────
        /// Returns protocol state snapshot.
        /// Includes total nova share value, total yield pool, total position weight, active gate,
        /// and deployed amount.
        fn get_protocol_state(self: @ContractState) -> ProtocolState {
            let gate_addr = self.active_gate.read();
            let deployed = IGateDispatcher { contract_address: self.active_gate.read() }
                .current_value();

            ProtocolState {
                total_nova_share_value: self.get_principal_pool(),
                total_yield_pool: self.total_yield_pool.read(),
                total_position_weight: self.total_weight.read(),
                active_gate_address: gate_addr,
                gate_deployed: deployed,
            }
        }

        // ── get_yield_history
        // ──────────────────────────────────────────────────
        /// Get historical yield accumulation data for charting and analytics.
        ///
        /// Returns (checkpoints, current_yield_pool) where:
        /// - checkpoints: Array of up to 6 historical yield snapshots (1-hour intervals, 6-hour max
        /// history)
        ///   Each checkpoint stores (timestamp, cumulative_yield_at_that_time)
        /// - current_yield_pool: Real-time yield pool balance for current period
        ///
        /// Frontend can calculate per-period yield by computing differences between consecutive
        /// checkpoints.
        fn get_yield_history(self: @ContractState) -> (Array<YieldCheckpoint>, u256) {
            let mut checkpoints = ArrayTrait::new();
            let len = self.yield_checkpoints_len.read();
            let head = self.yield_checkpoints_head.read();

            if len < MAX_YIELD_CHECKPOINTS {
                for i in 0..len {
                    let checkpoint = self.yield_checkpoints.read(i);
                    checkpoints.append(checkpoint);
                }
            } else {
                for i in 0..MAX_YIELD_CHECKPOINTS {
                    let idx = (head + i) % MAX_YIELD_CHECKPOINTS;
                    let checkpoint = self.yield_checkpoints.read(idx);
                    checkpoints.append(checkpoint);
                }
            }

            (checkpoints, self.total_yield_pool.read())
        }

        // ── set_active_gate
        // ────────────────────────────────────────────
        /// Set a new active yield gate adapter.
        /// Pulls all capital from the current gate first.
        /// Redeploys into the new gate via _rebalance_deployment().
        /// Pass zero address to disable yield deployment entirely.
        fn set_active_gate(ref self: ContractState, new_gate: ContractAddress) {
            self._assert_admin();
            let old_gate_addr = self.active_gate.read();

            if !old_gate_addr.is_zero() {
                let old_gate = IGateDispatcher { contract_address: old_gate_addr };
                let amount_in_old_gate = old_gate.current_value();
                if amount_in_old_gate > 0 {
                    old_gate.withdraw(amount_in_old_gate);
                }
            }

            self.active_gate.write(new_gate);
            self._rebalance_deployment();
        }

        // ── get_stable_gate_liquidity_shares
        // ────────────────────────────────────────────
        /// Get the share count for stable gate liquidity (14-day window).
        /// This is the raw share amount tracking locked capital for the gate.
        fn get_stable_gate_liquidity_shares(self: @ContractState) -> u256 {
            self.stable_gate_liquidity_shares.read()
        }

        // ── get_stable_gate_liquidity_btc
        // ────────────────────────────────────────────
        /// Get the wBTC value of stable gate liquidity (14-day window).
        /// Converts shares to BTC using current share price, accounting for gate losses.
        /// Returns the amount of wBTC locked for the next 14 days (with confidence factor).
        fn get_stable_gate_liquidity_btc(self: @ContractState) -> u256 {
            let shares = self.stable_gate_liquidity_shares.read();
            if shares == 0 {
                return 0;
            }

            let total_shares = self.total_nova_shares.read();
            let principal_pool = self.get_principal_pool();

            if total_shares == 0 {
                return 0;
            }

            // Convert shares to BTC: shares × (principal_pool / total_nova_shares)
            (shares * principal_pool) / total_shares
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL
    // ─────────────────────────────────────────────────────────────────────────

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), 'Not admin');
        }

        /// Find the first available slot (0-6) for a user's new position.
        /// Returns MAX_POSITIONS (7) if all slots are full.
        fn _find_available_slot(self: @ContractState, user: ContractAddress) -> u32 {
            let mut i: u32 = 0;
            let mut found: u32 = MAX_POSITIONS;

            while i < MAX_POSITIONS {
                let pos = self.positions.read((user, i));
                // A position with is_active=false means the slot is empty
                if !pos.is_active {
                    found = i;
                    break;
                }
                i += 1;
            }
            found
        }

        // ── _full_withdrawal
        // ──────────────────────────────────────────────
        /// Internal: Process full withdrawal when commitment deadline is met.
        /// User receives principal_share + yield_share with no penalties.
        /// Position is marked inactive and completely removed from yield distribution.
        fn _full_withdrawal(
            ref self: ContractState,
            user: ContractAddress,
            position_id: u32,
            mut position: Position,
        ) {
            let total_weight = self.total_weight.read();
            let total_yield = self.total_yield_pool.read();
            let total_principal = self.get_principal_pool();

            let nova_shares_value = calculate_nova_shares_value(
                position.nova_shares, self.total_nova_shares.read(), total_principal,
            );
            let position_yield = calculate_position_weight_value(
                position.position_weight, total_weight, total_yield,
            );
            let position_value = nova_shares_value + position_yield;

            // Close position
            position.is_active = false;
            self.positions.write((user, position_id), position);

            // Reduce totals
            self.total_nova_shares.write(self.total_nova_shares.read() - position.nova_shares);
            self.total_weight.write(total_weight - position.position_weight);
            self.total_yield_pool.write(total_yield - position_yield);

            // Remove stable_gate_liquidity shares that were tracked for this position
            self
                .stable_gate_liquidity_shares
                .write(
                    self.stable_gate_liquidity_shares.read()
                        - position.stable_gate_liquidity_shares_counted,
                );

            self._ensure_liquidity(position_value);
            IERC20Dispatcher { contract_address: self.asset.read() }.transfer(user, position_value);
        }

        // ── _early_withdrawal
        // ─────────────────────────────────────────────
        /// Internal: Process early withdrawal (before commitment deadline).
        /// Penalty calculated as: principal_share × (remaining_seconds / total_seconds)
        /// User receives: principal_share - penalty (forfeits all yield)
        /// Penalty + forfeited yield are redistributed to remaining holders via yield pool.
        /// Position weight is destroyed (user forfeits all yield from this position).
        fn _early_withdrawal(
            ref self: ContractState,
            user: ContractAddress,
            position_id: u32,
            mut position: Position,
            now: u64,
        ) {
            let total_weight = self.total_weight.read();
            let total_yield = self.total_yield_pool.read();
            let total_principal = self.get_principal_pool();

            let nova_shares_value = calculate_nova_shares_value(
                position.nova_shares, self.total_nova_shares.read(), total_principal,
            );

            let penalty = calculate_early_exit_penalty(
                nova_shares_value, position.commitment_start, position.commitment_end, now,
            );

            // Calculate yield share that user would have earned (but forfeits on early exit)
            // let position_yield = calculate_position_weight_value(
            //     position.position_weight, total_weight, total_yield,
            // );

            // User receives: principal - penalty (NO yield on early exit)
            let user_receives = nova_shares_value - penalty;

            // Close position
            position.is_active = false;
            self.positions.write((user, position_id), position);

            // Remove from totals, add penalty to yield pool
            // position_yield stays in total_yield (we don't subtract it, so it remains for other
            // users)
            self.total_nova_shares.write(self.total_nova_shares.read() - position.nova_shares);
            self.total_weight.write(total_weight - position.position_weight);
            self.total_yield_pool.write(total_yield + penalty);

            // Remove stable_gate_liquidity shares that were tracked for this position
            self
                .stable_gate_liquidity_shares
                .write(
                    self.stable_gate_liquidity_shares.read()
                        - position.stable_gate_liquidity_shares_counted,
                );

            self._ensure_liquidity(user_receives);

            if user_receives > 0 {
                IERC20Dispatcher { contract_address: self.asset.read() }
                    .transfer(user, user_receives);
            }
        }

        // ── _try_harvest
        // ──────────────────────────────────────────────────
        /// Harvest pending yield from the active gate and record a yield checkpoint.
        /// This is called before every major operation (deposit, top_up, withdraw)
        /// to ensure the yield pool is up-to-date before share calculations.
        fn _try_harvest(ref self: ContractState) {
            let gate_addr = self.active_gate.read();
            if gate_addr.is_zero() {
                return;
            }

            let gate = IGateDispatcher { contract_address: gate_addr };
            let pending = gate.pending_yield();
            if pending == 0 {
                return;
            }
            gate.harvest();
            self._maybe_record_yield_checkpoint();
        }

        // ── _maybe_record_yield_checkpoint
        // ──────────────────────────────────────────────────
        /// Record a yield checkpoint every CHECKPOINT_INTERVAL in a circular buffer
        /// for frontend charting and analytics purposes.
        fn _maybe_record_yield_checkpoint(ref self: ContractState) {
            let now = get_block_timestamp();
            let last_checkpoint = self.last_yield_checkpoint_timestamp.read();

            if now < last_checkpoint + CHECKPOINT_INTERVAL {
                return;
            }

            let checkpoint = YieldCheckpoint {
                timestamp: now, cumulative_yield: self.total_yield_pool.read(),
            };

            let head = self.yield_checkpoints_head.read();
            self.yield_checkpoints.write(head, checkpoint);

            let current_len = self.yield_checkpoints_len.read();
            if current_len >= MAX_YIELD_CHECKPOINTS {
                self.yield_checkpoints_head.write((head + 1) % MAX_YIELD_CHECKPOINTS);
            } else {
                self.yield_checkpoints_head.write(head + 1);
                self.yield_checkpoints_len.write(current_len + 1);
            }

            self.last_yield_checkpoint_timestamp.write(now);
        }

        // ── _rebalance_deployment
        // ─────────────────────────────────────────
        /// Maintain the deployment target (25% of principal) in the active yield gate.
        /// Called after deposits/withdrawals to ensure capital is efficiently allocated:
        /// - If deployed < target: move additional capital to gate
        /// - If deployed > target: withdraw excess capital from gate
        /// This ensures consistent yield generation without over-concentration.
        fn _rebalance_deployment(ref self: ContractState) {
            let gate_addr = self.active_gate.read();
            if gate_addr.is_zero() {
                return;
            }

            let principal_pool = self.get_principal_pool();
            let target = (principal_pool * DEPLOYMENT_RATIO) / BASIS_POINTS;
            let deployed = IGateDispatcher { contract_address: self.active_gate.read() }
                .current_value();

            if deployed < target {
                let to_deploy = target - deployed;
                let gate = IGateDispatcher { contract_address: gate_addr };
                IERC20Dispatcher { contract_address: self.asset.read() }
                    .approve(gate_addr, to_deploy);
                gate.deposit(to_deploy);
            } else if deployed > target {
                let to_withdraw = deployed - target;
                IGateDispatcher { contract_address: gate_addr }.withdraw(to_withdraw);
            }
        }

        /// Get the current wBTC balance held in Nova Core (not deployed to gate).
        fn _liquidity_buffer(self: @ContractState) -> u256 {
            IERC20Dispatcher { contract_address: self.asset.read() }
                .balance_of(get_contract_address())
        }

        /// Ensure sufficient liquidity is available to transfer `amount` to user.
        /// If the Nova Core buffer doesn't have enough, withdraw from the active gate.
        /// Panics if no active gate is set and buffer is insufficient.
        fn _ensure_liquidity(ref self: ContractState, amount: u256) {
            let buffer = self._liquidity_buffer();
            if buffer >= amount {
                return;
            }

            let shortfall = amount - buffer;
            let gate_addr = self.active_gate.read();
            assert(!gate_addr.is_zero(), 'Insufficient liquidity');

            IGateDispatcher { contract_address: gate_addr }.withdraw(shortfall);
        }
    }
}
