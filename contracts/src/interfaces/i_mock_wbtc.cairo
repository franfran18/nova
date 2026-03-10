use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockWBTC<TContractState> {
    // free mints wBTC token to the caller address
    fn free_mint(ref self: TContractState, amount: u256);

    // free mints wBTC token to a recipient address
    fn mint_to(ref self: TContractState, recipient: ContractAddress, amount: u256);

    // the decimals for the wbTC token - 8 decimals
    fn decimals(self: @TContractState) -> u8;
}
