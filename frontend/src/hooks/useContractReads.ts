import { useReadContract } from "@starknet-react/core";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";

// Interface Definitions

export interface Position {
  position_id: number;
  is_active: boolean;
  goal_name: string;
  nova_shares: bigint;
  position_weight: bigint;
  original_deposit: bigint;
  commitment_start: bigint;
  commitment_end: bigint;
}

export interface ProtocolState {
  total_nova_share_value: bigint;
  total_yield_pool: bigint;
  total_position_weight: bigint;
  active_gate_address: string;
  gate_deployed: bigint;
}

export interface YieldCheckpoint {
  timestamp: bigint;
  cumulative_yield: bigint;
}

export interface WithdrawalQuote {
  initial_deposit: bigint;
  position_weight: bigint;
  principal_value: bigint;
  yield_value: bigint;
  early_exit_penalty: bigint;
}

// Hook Return Type

interface UseContractReadResult<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error?: Error;
  isFetching: boolean;
}

// Contract Read Hooks

export function useGetPosition(
  userAddress?: string,
  positionId?: number,
): UseContractReadResult<Position> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_position",
    args:
      userAddress && positionId !== undefined
        ? [userAddress, positionId]
        : undefined,
    enabled: !!userAddress && positionId !== undefined,
    watch: true,
  } as any);

  return {
    data: data as Position | undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

export function useGetAllPositions(
  userAddress?: string,
): UseContractReadResult<Position[]> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_all_positions",
    args: userAddress ? [userAddress] : undefined,
    enabled: !!userAddress,
    watch: true,
  } as any);

  return {
    data: data as Position[] | undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

export function useGetWithdrawalQuote(
  userAddress?: string,
  positionId?: number,
): UseContractReadResult<WithdrawalQuote> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_withdrawwal_quote",
    args:
      userAddress && positionId !== undefined
        ? [userAddress, positionId]
        : undefined,
    enabled: !!userAddress && positionId !== undefined,
    watch: true,
  } as any);

  return {
    data: data
      ? {
          initial_deposit: (data as unknown as any[])[0],
          position_weight: (data as unknown as any[])[1],
          principal_value: (data as unknown as any[])[2],
          yield_value: (data as unknown as any[])[3],
          early_exit_penalty: (data as unknown as any[])[4],
        }
      : undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

export function useGetProtocolState(): UseContractReadResult<ProtocolState> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_protocol_state",
    args: [],
    watch: true,
  } as any);

  const parsedState = data
    ? {
        total_nova_share_value: parseU256((data as any).total_nova_share_value),
        total_yield_pool: parseU256((data as any).total_yield_pool),
        total_position_weight: parseU256((data as any).total_position_weight),
        active_gate_address: (data as any).active_gate_address,
        gate_deployed: parseU256((data as any).gate_deployed),
      }
    : undefined;

  return {
    data: parsedState,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

/**
 * Helper function to parse u256 values that may come back as [low, high] arrays or bigints
 */
function parseU256(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    return BigInt(value);
  }
  if (Array.isArray(value) && value.length >= 2) {
    const low = BigInt(value[0] || 0);
    const high = BigInt(value[1] || 0);
    return low + (high << 128n);
  }
  return BigInt(0);
}

export function useGetTotalAssets(): UseContractReadResult<bigint> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_total_assets",
    args: [],
    watch: true,
  } as any);

  return {
    data: data as bigint | undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

export function useGetPrincipalPool(): UseContractReadResult<bigint> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_principal_pool",
    args: [],
    watch: true,
  } as any);

  return {
    data: data as bigint | undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

export function useGetYieldHistory(): UseContractReadResult<{
  checkpoints: YieldCheckpoint[];
  current_yield_pool: bigint;
}> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_yield_history",
    args: [],
    watch: true,
  } as any);

  return {
    data: data
      ? {
          checkpoints: ((data as unknown as any[])[0] || []).map((cp: any) => ({
            timestamp: cp.timestamp || cp[0],
            cumulative_yield: cp.cumulative_yield || cp[1],
          })),
          current_yield_pool: parseU256((data as unknown as any[])[1]),
        }
      : undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

export function useGetStableGateLiquidityBtc(): UseContractReadResult<bigint> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_stable_gate_liquidity_btc",
    args: [],
    watch: true,
  } as any);

  return {
    data: data as bigint | undefined,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}

/**
 * Get balance of a token for a user
 * @param tokenAddress - Token contract address
 * @param userAddress - User's wallet address
 * @param tokenABI - Token contract ABI (ERC20)
 */
export function useBalance(
  tokenAddress?: string,
  userAddress?: string,
  tokenABI?: any,
): UseContractReadResult<bigint> {
  const { data, isLoading, isError, error, isFetching } = useReadContract({
    address: tokenAddress,
    abi: tokenABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    enabled: !!tokenAddress && !!userAddress && !!tokenABI,
    watch: true,
  } as any);

  // Extract the balance value, handling different response formats
  let balanceData: bigint | undefined = undefined;
  if (data) {
    if (typeof data === 'bigint') {
      balanceData = data;
    } else if (typeof data === 'number') {
      balanceData = BigInt(data);
    } else if (typeof data === 'string') {
      balanceData = BigInt(data);
    } else if (Array.isArray(data) && data.length > 0) {
      // Handle case where balance is returned as array [low, high]
      const low = BigInt(data[0]);
      const high = BigInt(data[1] || 0);
      balanceData = low + (high << 128n);
    }
  }

  return {
    data: balanceData,
    isLoading,
    isError,
    error: error as Error | undefined,
    isFetching,
  };
}
