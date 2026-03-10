"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import { RpcProvider } from "starknet";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Position } from "../hooks/useContractReads";
import {
  useGetProtocolState,
  useGetAllPositions,
  useGetYieldHistory,
  useGetStableGateLiquidityBtc,
  useGetTotalAssets,
} from "../hooks/useContractReads";
import { useBTCPrice, formatBTCtoUSD } from "../hooks/useBTCPrice";
import styles from "../styles/pages/Dashboard.module.css";
import { SkeletonLoader, SkeletonCard } from "../components/SkeletonLoader";
import {
  formatBTC,
  calculateTimeProgress,
  formatTimeRemaining,
  formatDateTimeRange,
  felt252ToString,
} from "../utils/formatters";
import {
  MOCK_WBTC_ADDRESS,
  MOCK_WBTC_ABI,
  MOCK_GATE_ADDRESS,
} from "../utils/contract";
import { AddSavingsModal } from "../components/AddSavingsModal";
import { TopUpModal } from "../components/TopUpModal";
import { WithdrawModal } from "../components/WithdrawModal";
import {
  TrendingUp,
  Target,
  Activity,
  Heart,
  PlusCircle,
} from "lucide-react";

export default function Dashboard() {
  const { address } = useAccount();
  const [isAddSavingsModalOpen, setIsAddSavingsModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null,
  );
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [currentBlockTimestamp, setCurrentBlockTimestamp] = useState<bigint>(
    BigInt(0),
  );

  // Fetch current block timestamp from Starknet using RpcProvider
  useEffect(() => {
    const fetchBlockTimestamp = async () => {
      try {
        const provider = new RpcProvider({
          nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia",
        });

        const block = await provider.getBlockWithTxHashes("latest");
        const timestamp = BigInt(block.timestamp);
        setCurrentBlockTimestamp(timestamp);
      } catch (error) {
        // Failed to fetch block timestamp, will retry on next interval
      }
    };

    fetchBlockTimestamp();
    // Refresh every 10 seconds to keep timestamp updated
    const interval = setInterval(fetchBlockTimestamp, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch contract data
  const { data: protocolState, isLoading: protocolLoading } =
    useGetProtocolState();
  const { data: totalAssets, isLoading: totalAssetsLoading } =
    useGetTotalAssets();
  const { data: yieldHistory, isLoading: yieldHistoryLoading } =
    useGetYieldHistory();
  const { data: stableGateLiquidity, isLoading: stableGateLiquidityLoading } =
    useGetStableGateLiquidityBtc();
  const { data: positions, isLoading: positionsLoading } =
    useGetAllPositions(address);


  // Fetch BTC price for USD conversion
  const { btcPrice, isLoading: priceLoading } = useBTCPrice();

  // Fetch wBTC balance using useReadContract directly
  const { data: wbtcBalance, isLoading: balanceLoading } = useReadContract({
    address: MOCK_WBTC_ADDRESS,
    abi: MOCK_WBTC_ABI,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
    watch: true,
  } as any);

  const handleSavingsCreated = () => {
    // Modal will close and positions should refetch on next poll
    setIsAddSavingsModalOpen(false);
  };

  // Prepare chart data
  const chartData = (yieldHistory?.checkpoints || [])
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    .map((checkpoint) => ({
      timestamp: new Date(Number(checkpoint.timestamp) * 1000).toLocaleString(
        "en-US",
        {
          timeZone: "UTC",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      ),
      yield: Number(checkpoint.cumulative_yield) / 1e8, // Convert from u256 to wBTC
    }));

  // Add current yield to chart
  if (yieldHistory?.current_yield_pool) {
    chartData.push({
      timestamp: "Now",
      yield: Number(yieldHistory.current_yield_pool) / 1e8,
    });
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        {/* Protocol Stats Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Protocol Stats.</h2>

          {/* Top Row: 4 Main Stats */}
          <div className={styles.statsGrid}>
            {/* Total Value Locked */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Total Value Locked</span>
                <TrendingUp size={20} className={styles.statIcon} />
              </div>
              {totalAssetsLoading ? (
                <SkeletonLoader height="32px" width="80%" />
              ) : (
                <>
                  <div className={styles.statValue}>
                    {formatBTC(totalAssets || BigInt(0))}
                  </div>
                  {priceLoading ? (
                    <SkeletonLoader height="20px" width="45%" />
                  ) : (
                    <div className={styles.statUSDValue}>
                      {formatBTCtoUSD(totalAssets || BigInt(0), btcPrice)}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Principal Pool */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Principal Pool</span>
                <Target size={20} className={styles.statIcon} />
              </div>
              {protocolLoading ? (
                <SkeletonLoader height="32px" width="80%" />
              ) : (
                <>
                  <div className={styles.statValue}>
                    {formatBTC(
                      protocolState?.total_nova_share_value || BigInt(0),
                    )}
                  </div>
                  {priceLoading ? (
                    <SkeletonLoader height="20px" width="45%" />
                  ) : (
                    <div className={styles.statUSDValue}>
                      {formatBTCtoUSD(
                        protocolState?.total_nova_share_value || BigInt(0),
                        btcPrice,
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Total Yield Pool */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Yield Pool</span>
                <Activity size={20} className={styles.statIcon} />
              </div>
              {protocolLoading ? (
                <SkeletonLoader height="32px" width="80%" />
              ) : (
                <>
                  <div className={styles.statValue}>
                    {formatBTC(protocolState?.total_yield_pool || BigInt(0))}
                  </div>
                  {priceLoading ? (
                    <SkeletonLoader height="20px" width="45%" />
                  ) : (
                    <div className={styles.statUSDValue}>
                      {formatBTCtoUSD(
                        protocolState?.total_yield_pool || BigInt(0),
                        btcPrice,
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Stable Gate Liquidity */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>
                  Stable Gate Liquidity (14d)
                </span>
                <Heart size={20} className={styles.statIcon} />
              </div>
              {stableGateLiquidityLoading ? (
                <SkeletonLoader height="32px" width="80%" />
              ) : (
                <>
                  <div className={styles.statValue}>
                    {formatBTC(stableGateLiquidity || BigInt(0))}
                  </div>
                  {priceLoading ? (
                    <SkeletonLoader height="20px" width="45%" />
                  ) : (
                    <div className={styles.statUSDValue}>
                      {formatBTCtoUSD(stableGateLiquidity || BigInt(0), btcPrice)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Gate Info Section */}
          <div className={styles.gateInfoSection}>
            {/* Nova Nexus Gate Box */}
            <div className={styles.gateCard}>
              <div className={styles.gateLabel}>Active Gate</div>
              <div className={styles.gateName}>Nova Nexus Gate</div>
              <div className={styles.gateAddress}>
                {`${MOCK_GATE_ADDRESS.substring(0, 6)}...${MOCK_GATE_ADDRESS.substring(
                  MOCK_GATE_ADDRESS.length - 6,
                )}`}
              </div>
            </div>

            {/* Deployment Stats */}
            <div className={styles.deploymentStatsGrid}>
              {/* Deployed Capital */}
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Deployed Capital</span>
                  <TrendingUp size={20} className={styles.statIcon} />
                </div>
                {protocolLoading ? (
                  <SkeletonLoader height="32px" width="80%" />
                ) : (
                  <>
                    <div className={styles.statValue}>
                      {formatBTC(protocolState?.gate_deployed || BigInt(0))}
                    </div>
                    {priceLoading ? (
                      <SkeletonLoader height="20px" width="60%" />
                    ) : (
                      <div className={styles.statUSDValue}>
                        {formatBTCtoUSD(
                          protocolState?.gate_deployed || BigInt(0),
                          btcPrice,
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Deployment Ratio */}
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Deployment Ratio</span>
                  <Activity size={20} className={styles.statIcon} />
                </div>
                {protocolLoading ? (
                  <SkeletonLoader height="32px" width="60%" />
                ) : (
                  <div className={styles.statValue}>
                    {protocolState?.total_nova_share_value &&
                    protocolState.total_nova_share_value > 0n
                      ? `${(
                          (Number(protocolState.gate_deployed || 0n) /
                            Number(protocolState.total_nova_share_value)) *
                          100
                        ).toFixed(2)}%`
                      : "0%"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className={styles.divider}></div>

        {/* Yield History Chart Section */}
        <section className={styles.section}>
          <h2 className={styles.chartSectionTitle}>
            Recent Yield Pool History (UTC)
          </h2>
          {yieldHistoryLoading ? (
            <div className={styles.chartSkeletonContainer}>
              <div className={styles.chartSkeleton} />
            </div>
          ) : chartData && chartData.length > 0 ? (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#BCF49D" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#BCF49D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#a0a0a0"
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#a0a0a0", dy: 15 }}
                  />
                  <YAxis
                    stroke="#a0a0a0"
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#a0a0a0", dx: -10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#2a2a2a",
                      border: "1px solid #444",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value: any) => {
                      if (typeof value === "number") {
                        return [`${value.toFixed(8)} BTC`, "Yield"];
                      }
                      return ["N/A", "Yield"];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="yield"
                    stroke="#BCF49D"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorYield)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#a0a0a0" }}
            >
              No yield data available yet
            </div>
          )}
        </section>

        {/* Divider */}
        <div className={styles.divider}></div>

        {/* User Stats Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>User stats.</h2>
          <div className={styles.userStatsContainer}>
            {/* Total Savings with Button */}
            <div className={styles.totalSavingsSection}>
              <div className={styles.totalSavingsContent}>
                <span className={styles.totalSavingsLabel}>Total Savings</span>
                {positionsLoading ? (
                  <SkeletonLoader height="36px" width="70%" />
                ) : (
                  <span className={styles.totalSavingsAmount}>
                    {formatBTC(
                      positions?.reduce(
                        (sum, pos) => sum + pos.original_deposit,
                        BigInt(0),
                      ) || BigInt(0),
                    )}
                  </span>
                )}
                {positionsLoading || priceLoading ? (
                  <SkeletonLoader height="20px" width="40%" />
                ) : (
                  <span className={styles.totalSavingsUSD}>
                    {formatBTCtoUSD(
                      positions?.reduce(
                        (sum, pos) => sum + pos.original_deposit,
                        BigInt(0),
                      ) || BigInt(0),
                      btcPrice,
                    )}
                  </span>
                )}
                <p className={styles.totalSavingsDescription}>
                  Add new savings to utilize your BTC to compound yield and
                  achieve saving target and duration
                </p>
              </div>
              <button
                className={styles.userStatsAddBtn}
                onClick={() => setIsAddSavingsModalOpen(true)}
              >
                <PlusCircle size={20} />
                Add Savings
              </button>
            </div>

            {/* Active Positions & Wallet Balance */}
            <div className={styles.userStatsRightSection}>
              <div className={styles.userInfoCard}>
                <span className={styles.userInfoLabel}>Active Positions</span>
                {positionsLoading ? (
                  <SkeletonLoader height="28px" width="50%" />
                ) : (
                  <span className={styles.userInfoValue}>
                    {positions?.filter((p) => p.is_active).length || 0} /{" "}
                    {positions?.length || 0}
                  </span>
                )}
              </div>

              <div className={styles.userInfoCard}>
                <span className={styles.userInfoLabel}>Wallet Balance</span>
                {balanceLoading ? (
                  <SkeletonLoader height="28px" width="70%" />
                ) : (
                  <span className={styles.userInfoValue}>
                    {formatBTC(
                      typeof wbtcBalance === "bigint"
                        ? wbtcBalance
                        : typeof wbtcBalance === "number"
                          ? BigInt(wbtcBalance)
                          : typeof wbtcBalance === "string"
                            ? BigInt(wbtcBalance)
                            : Array.isArray(wbtcBalance) &&
                                wbtcBalance.length >= 2
                              ? BigInt(wbtcBalance[0]) +
                                (BigInt(wbtcBalance[1]) << 128n)
                              : BigInt(0),
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Saving Positions Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>My Positions.</h2>

          {positionsLoading ? (
            <div className={styles.positionsGrid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : positions && positions.length > 0 ? (
            <div className={styles.positionsGrid}>
              {positions.map((position) => (
                <PositionCard
                  key={position.position_id}
                  position={position}
                  currentBlockTimestamp={currentBlockTimestamp}
                  onTopUpClick={() => {
                    setSelectedPosition(position);
                    setIsTopUpModalOpen(true);
                  }}
                  onWithdrawClick={() => {
                    setSelectedPosition(position);
                    setIsWithdrawModalOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>No savings positions yet. Create one to get started!</p>
            </div>
          )}
        </section>
      </div>

      <AddSavingsModal
        isOpen={isAddSavingsModalOpen}
        onClose={() => setIsAddSavingsModalOpen(false)}
        onSuccess={handleSavingsCreated}
      />

      {selectedPosition && (
        <>
          <TopUpModal
            isOpen={isTopUpModalOpen}
            onClose={() => {
              setIsTopUpModalOpen(false);
              setSelectedPosition(null);
            }}
            position={selectedPosition}
            onSuccess={handleSavingsCreated}
          />

          <WithdrawModal
            isOpen={isWithdrawModalOpen}
            onClose={() => {
              setIsWithdrawModalOpen(false);
              setSelectedPosition(null);
            }}
            position={selectedPosition}
            onSuccess={handleSavingsCreated}
          />
        </>
      )}
    </div>
  );
}

interface PositionCardProps {
  position: Position;
  currentBlockTimestamp: bigint;
  onTopUpClick?: () => void;
  onWithdrawClick?: () => void;
}

function PositionCard({
  position,
  currentBlockTimestamp,
  onTopUpClick,
  onWithdrawClick,
}: PositionCardProps) {
  const progress = calculateTimeProgress(
    position.commitment_start,
    position.commitment_end,
    currentBlockTimestamp,
  );
  const timeRemaining = formatTimeRemaining(
    position.commitment_end,
    currentBlockTimestamp,
  );

  return (
    <div className={styles.positionCard}>
      {/* Card Header */}
      <div className={styles.positionHeader}>
        <div className={styles.positionBadge}>
          <span
            className={styles.positionColor}
            style={{ backgroundColor: "#BCF49D" }}
          />
          <span className={styles.positionName}>
            {felt252ToString(String(position.goal_name))}
          </span>
        </div>
        {position.is_active ? (
          <span className={styles.activeBadge}>Active</span>
        ) : (
          <span className={styles.inactiveBadge}>Completed</span>
        )}
      </div>

      {/* Amount */}
      <div className={styles.positionAmount}>
        {formatBTC(position.original_deposit)}
      </div>

      {/* Progress Bar */}
      <div className={styles.progressSection}>
        <span className={styles.progressLabel}>Progress</span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* Time Info */}
      <div className={styles.positionInfo}>
        <span className={styles.timeRemaining}>
          {timeRemaining.isCompleted
            ? "Completed"
            : `${timeRemaining.days} days ${timeRemaining.hours}h ${timeRemaining.minutes || 0}m left`}
        </span>
        <span className={styles.dateRange}>
          {formatDateTimeRange(
            position.commitment_start,
            position.commitment_end,
          )}
        </span>
      </div>

      {/* Actions */}
      <div className={styles.positionActions}>
        <button
          className={`${styles.actionBtn} ${styles.withdraw}`}
          onClick={onWithdrawClick}
        >
          Withdraw
        </button>
        <button
          className={`${styles.actionBtn} ${styles.topup}`}
          onClick={onTopUpClick}
        >
          Top Up
        </button>
      </div>
    </div>
  );
}
