// ─────────────────────────────────────────────────────────────────────────────
// MOCK GATE — For testnet and local development only
//
// Adapter implementation that simulates an external yield protocol.
// Separates principal from yield: current_value tracks principal only,
// while yield is harvested and sent to Nova Core's yield pool.
//
// Storage model:
//   - `current_value`     — real-time value of wBTC in the gate. Reflects wBTC - losses
//                           (yield is NOT stored here, it's sent to Nova yield pool on harvest)
//
// Yield flow: accrues continuously -> pending_yield() shows pending amount -> harvest() sends
//            to Nova yield pool and returns the amount sent
// ─────────────────────────────────────────────────────────────────────────────

#[starknet::contract]
pub mod MockGate {
    use nova::interfaces::i_gate::IGate;
    use nova::interfaces::i_mock_wbtc::{IMockWBTCDispatcher, IMockWBTCDispatcherTrait};
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use crate::interfaces::i_nova::{INovaDispatcher, INovaDispatcherTrait};

    // 0.00001 wBTC per minute = 1000 per minute (8 decimals)
    // 1000 / 60 = 16.666... per sec → rounded down to 16
    const YIELD_PER_SECOND: u256 = 16;

    // To burn the tokens whenm we apply loss
    const DEAD_ADDRESS: felt252 =
        0x000000000000000000000000000000000000000000000000000000000000dEaD;

    #[storage]
    struct Storage {
        asset: ContractAddress,
        nova_core: ContractAddress,
        admin: ContractAddress,
        /// Tracks everything the gate holds in real time:
        ///   - increases on deposit()
        ///   - decreases on apply_loss() (tokens burned to dead address)
        ///   - decreases on withdraw() (tokens sent to Nova Core)
        current_value: u256,
        /// Timestamp of the last _accrue_yield() call.
        last_update: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        asset: ContractAddress,
        nova_core: ContractAddress,
        admin: ContractAddress,
    ) {
        self.asset.write(asset);
        self.nova_core.write(nova_core);
        self.admin.write(admin);
        self.last_update.write(get_block_timestamp());
    }

    #[abi(embed_v0)]
    impl MockGateImpl of IGate<ContractState> {
        // ── deposit
        // ───────────────────────────────────────────────────────
        // Pulls wBTC from Nova Core into the gate.
        // Increases current_value by amount.
        fn deposit(ref self: ContractState, amount: u256) -> bool {
            assert(get_caller_address() == self.nova_core.read(), 'Only nova core');
            self._accrue_yield();

            let asset = IERC20Dispatcher { contract_address: self.asset.read() };
            asset.transfer_from(self.nova_core.read(), get_contract_address(), amount);

            self.current_value.write(self.current_value.read() + amount);
            true
        }

        // ── withdraw
        // ──────────────────────────────────────────────────────
        // Sends wBTC back to Nova Core.
        // Decreases current_value by amount (wBTC deposit only, yield
        // already harvested and sent to nova yield pool).
        fn withdraw(ref self: ContractState, amount: u256) -> bool {
            assert(get_caller_address() == self.nova_core.read(), 'Only nova core');
            self._accrue_yield();

            assert(self.current_value.read() >= amount, 'Insufficient balance');

            self.current_value.write(self.current_value.read() - amount);
            let asset = IERC20Dispatcher { contract_address: self.asset.read() };
            asset.transfer(self.nova_core.read(), amount);
            true
        }

        // ── current_value
        // ─────────────────────────────────────────────────
        // Returns the current value in the gate.
        // Reflects principal - losses. Yield is harvested and sent to Nova's yield pool,
        // not stored in current_value.
        fn current_value(self: @ContractState) -> u256 {
            self.current_value.read()
        }

        // ── pending_yield
        // ─────────────────────────────────────────────────
        // Yield that has accrued in the external protocol since the last
        // harvest() or yield accrual call but has not yet been sent to the nova yield pool.
        fn pending_yield(self: @ContractState) -> u256 {
            let now = get_block_timestamp();
            let last = self.last_update.read();
            if now <= last || self.current_value.read() == 0 {
                return 0;
            }
            let elapsed: u256 = (now - last).into();
            YIELD_PER_SECOND * elapsed
        }


        // ── harvest
        // ───────────────────────────────────────────────────────
        // Collects pending yield from the external protocol and sends it to the yield pool in Nova
        // core. Baically a manaul way of accruing yield to the no
        // Returns the amount harvested in this call.
        fn harvest(ref self: ContractState) -> u256 {
            let accrued = self._accrue_yield();
            accrued
        }

        // -- asset
        // ────────────────────────────────────────────────────
        // Returns the address of the asset, in this case the wBTC
        fn asset(self: @ContractState) -> ContractAddress {
            self.asset.read()
        }

        // ── apply_loss
        // ────────────────────────────────────────────────────
        // Simulate a loss by burning `amount` tokens to the dead address and reducing the
        // current value. Admin only.
        // Implemented this way for local testnetd evelopment purposes
        fn apply_loss(ref self: ContractState, amount: u256) {
            assert(get_caller_address() == self.admin.read(), 'Only admin');
            assert(self.current_value.read() >= amount, 'Loss exceeds current value');

            self.current_value.write(self.current_value.read() - amount);

            let dead: ContractAddress = DEAD_ADDRESS.try_into().unwrap();
            let asset = IERC20Dispatcher { contract_address: self.asset.read() };
            asset.transfer(dead, amount);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        // ── _accrue_yield
        // ─────────────────────────────────────────────────
        // Calculates elapsed yield since last harvest and mints it from MockWBTC straight into the
        // nova yield pool Yield is held temporarily in the gate and sent to Nova yield pool on
        // Returns the amount accrued (0 if nothing to accrue).
        fn _accrue_yield(ref self: ContractState) -> u256 {
            let now = get_block_timestamp();
            let last = self.last_update.read();
            if now <= last {
                return 0;
            }
            if self.current_value.read() == 0 {
                self.last_update.write(now);
                return 0;
            }
            let elapsed: u256 = (now - last).into();
            let new_yield = YIELD_PER_SECOND * elapsed;

            // Mint yield tokens into the nova contract and call the function that updates the nova
            // yield pool value
            let mock_wbtc = IMockWBTCDispatcher { contract_address: self.asset.read() };
            let nova = INovaDispatcher { contract_address: self.nova_core.read() };

            mock_wbtc.mint_to(self.nova_core.read(), new_yield);
            nova.update_yield_from_gate(new_yield);

            self.last_update.write(now);
            new_yield
        }
    }
}
