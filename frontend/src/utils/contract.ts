// Your Nova & WBTC contract details on Sepolia
export const CONTRACT_ADDRESS =
  "0x0693dcf1e10bcc08db60e8b9d7b1d0a4021c2aa3424f827fb0f4445b10f11dbb" as const;
export const MOCK_WBTC_ADDRESS =
  "0x0478a6aaf233fac4a640fc43e3e2de6dc0ff5cc5b354354ccfbc02f441695ec8" as const;
export const MOCK_GATE_ADDRESS =
  "0x01709635602b0d427dbbea4dee3d824807c58541cbf2db2c890398a648c6f5a6" as const;

// Contract ABI - For the Nova Core
export const CONTRACT_ABI = [
  {
    type: "impl",
    name: "NovaCoreImpl",
    interface_name: "nova::interfaces::i_nova::INova",
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      { name: "False", type: "()" },
      { name: "True", type: "()" },
    ],
  },
  {
    type: "struct",
    name: "nova::types::types::Position",
    members: [
      { name: "position_id", type: "core::integer::u32" },
      { name: "is_active", type: "core::bool" },
      { name: "goal_name", type: "core::felt252" },
      { name: "nova_shares", type: "core::integer::u256" },
      { name: "position_weight", type: "core::integer::u256" },
      { name: "original_deposit", type: "core::integer::u256" },
      { name: "commitment_start", type: "core::integer::u64" },
      { name: "commitment_end", type: "core::integer::u64" },
      {
        name: "stable_gate_liquidity_shares_counted",
        type: "core::integer::u256",
      },
    ],
  },
  {
    type: "struct",
    name: "nova::types::types::ProtocolState",
    members: [
      { name: "total_nova_share_value", type: "core::integer::u256" },
      { name: "total_yield_pool", type: "core::integer::u256" },
      { name: "total_position_weight", type: "core::integer::u256" },
      {
        name: "active_gate_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
      { name: "gate_deployed", type: "core::integer::u256" },
    ],
  },
  {
    type: "struct",
    name: "nova::types::types::YieldCheckpoint",
    members: [
      { name: "timestamp", type: "core::integer::u64" },
      { name: "cumulative_yield", type: "core::integer::u256" },
    ],
  },
  {
    type: "interface",
    name: "nova::interfaces::i_nova::INova",
    items: [
      {
        type: "function",
        name: "deposit",
        inputs: [
          { name: "amount", type: "core::integer::u256" },
          { name: "commitment_duration", type: "core::integer::u64" },
          { name: "goal_name", type: "core::felt252" },
        ],
        outputs: [{ type: "core::integer::u32" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "top_up",
        inputs: [
          { name: "position_id", type: "core::integer::u32" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "withdraw",
        inputs: [{ name: "position_id", type: "core::integer::u32" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "update_yield_from_gate",
        inputs: [{ name: "amount", type: "core::integer::u256" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_withdrawwal_quote",
        inputs: [
          {
            name: "user",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "position_id", type: "core::integer::u32" },
        ],
        outputs: [
          {
            type: "(core::integer::u256, core::integer::u256, core::integer::u256, core::integer::u256, core::integer::u256)",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_position",
        inputs: [
          {
            name: "user",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "position_id", type: "core::integer::u32" },
        ],
        outputs: [{ type: "nova::types::types::Position" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_all_positions",
        inputs: [
          {
            name: "user",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          { type: "core::array::Array::<nova::types::types::Position>" },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_total_assets",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_principal_pool",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_protocol_state",
        inputs: [],
        outputs: [{ type: "nova::types::types::ProtocolState" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_yield_history",
        inputs: [],
        outputs: [
          {
            type: "(core::array::Array::<nova::types::types::YieldCheckpoint>, core::integer::u256)",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_stable_gate_liquidity_shares",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_stable_gate_liquidity_btc",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "set_active_gate",
        inputs: [
          {
            name: "new_gate",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      {
        name: "asset",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "admin",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    type: "event",
    name: "nova::contracts::nova::NovaCore::Event",
    kind: "enum",
    variants: [],
  },
] as const;

export const MOCK_WBTC_ABI = [
  {
    type: "impl",
    name: "FakeWBTCImpl",
    interface_name: "nova::interfaces::i_mock_wbtc::IMockWBTC",
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "interface",
    name: "nova::interfaces::i_mock_wbtc::IMockWBTC",
    items: [
      {
        type: "function",
        name: "free_mint",
        inputs: [{ name: "amount", type: "core::integer::u256" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "mint_to",
        inputs: [
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "decimals",
        inputs: [],
        outputs: [{ type: "core::integer::u8" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "impl",
    name: "ERC20Impl",
    interface_name: "openzeppelin_interfaces::token::erc20::IERC20",
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      { name: "False", type: "()" },
      { name: "True", type: "()" },
    ],
  },
  {
    type: "interface",
    name: "openzeppelin_interfaces::token::erc20::IERC20",
    items: [
      {
        type: "function",
        name: "total_supply",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "balance_of",
        inputs: [
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "allowance",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "spender",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "transfer",
        inputs: [
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "transfer_from",
        inputs: [
          {
            name: "sender",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "approve",
        inputs: [
          {
            name: "spender",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
    ],
  },
  { type: "constructor", name: "constructor", inputs: [] },
  {
    type: "event",
    name: "openzeppelin_token::erc20::erc20::ERC20Component::Transfer",
    kind: "struct",
    members: [
      {
        name: "from",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "to",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      { name: "value", type: "core::integer::u256", kind: "data" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_token::erc20::erc20::ERC20Component::Approval",
    kind: "struct",
    members: [
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "spender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      { name: "value", type: "core::integer::u256", kind: "data" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_token::erc20::erc20::ERC20Component::Event",
    kind: "enum",
    variants: [
      {
        name: "Transfer",
        type: "openzeppelin_token::erc20::erc20::ERC20Component::Transfer",
        kind: "nested",
      },
      {
        name: "Approval",
        type: "openzeppelin_token::erc20::erc20::ERC20Component::Approval",
        kind: "nested",
      },
    ],
  },
  {
    type: "event",
    name: "nova::contracts::mock_wbtc::MockWBTC::Event",
    kind: "enum",
    variants: [
      {
        name: "ERC20Event",
        type: "openzeppelin_token::erc20::erc20::ERC20Component::Event",
        kind: "flat",
      },
    ],
  },
] as const;
