// ─────────────────────────────────────────────────────────────────────────────
// IGATE — Standard adapter interface
//
// Adapter interface to allow external yield protocols to plug into Nova and
// supply its users extra yield on their locked commitments.
//
// Storage model every gate must follow:
//
//   current_value     — real-time value the gate holds. Increases on deposit()
//                       Decreases on withdraw()
//                       and when a loss occurs. Reflects everything i.e the real time value of what
//                       is currently available
// ─────────────────────────────────────────────────────────────────────────────

use starknet::ContractAddress;

#[starknet::interface]
pub trait IGate<TContractState> {
    /// Deploy `amount` of the underlying asset(wBTC) into the external protocol.
    /// Increases current_value by amount.
    /// Caller must be Nova Core.
    /// Returns true on success.
    fn deposit(ref self: TContractState, amount: u256) -> bool;

    /// Withdraw `amount` from the external protocol back to Nova Core.
    /// Decreases current_value by amount.
    /// Returns true on success.
    fn withdraw(ref self: TContractState, amount: u256) -> bool;

    /// Real-time value of everything the gate holds.
    /// Reflects principal - any losses.
    fn current_value(self: @TContractState) -> u256;


    /// Yield that has accrued in the external protocol since the last
    /// harvest() or yield accrual call but has not yet been sent to the nova yield pool.
    fn pending_yield(self: @TContractState) -> u256;


    /// Collects pending yield from the external protocol and sends it to the yield pool in Nova
    /// core.
    /// Returns the amount harvested in this call.
    fn harvest(ref self: TContractState) -> u256;

    /// The ERC-20 token address this gate accepts and returns.
    fn asset(self: @TContractState) -> ContractAddress;


    /// Simulate a loss by burning `amount` tokens to the dead address abd reducing the current
    /// value
    fn apply_loss(ref self: TContractState, amount: u256);
}
