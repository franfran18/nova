"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { CONTRACT_ADDRESS } from "../utils/contract";
import { formatBTC, felt252ToString } from "../utils/formatters";
import { useBTCPrice, formatBTCtoUSD } from "../hooks/useBTCPrice";
import {
  useGetWithdrawalQuote,
} from "../hooks/useContractReads";
import styles from "../styles/components/WithdrawModal.module.css";
import { X, AlertCircle, CheckCircle, Loader } from "lucide-react";
import type { Position } from "../hooks/useContractReads";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
  onSuccess?: () => void;
}

export const WithdrawModal = ({
  isOpen,
  onClose,
  position,
}: WithdrawModalProps) => {
  const { address } = useAccount();
  const { sendAsync, isPending } = useSendTransaction({});
  const { btcPrice } = useBTCPrice();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch withdrawal quote to get principal value, yield value, and penalty
  const { data: withdrawalQuote, isLoading: quoteLoading } = useGetWithdrawalQuote(
    address,
    position.position_id,
  );


  const initialDeposit = withdrawalQuote?.initial_deposit || BigInt(0);
  const principalValue = withdrawalQuote?.principal_value || BigInt(0);
  const yieldValue = withdrawalQuote?.yield_value || BigInt(0);
  const earlyExitPenalty = withdrawalQuote?.early_exit_penalty || BigInt(0);

  // Determine if there's a penalty (early withdrawal) or not (commitment ended)
  const hasEarlyPenalty = earlyExitPenalty > BigInt(0);

  // Calculate withdrawable amount based on whether there's a penalty
  // Early withdrawal: principal - penalty
  // Completed: principal + yield
  const receivable = hasEarlyPenalty ? principalValue - earlyExitPenalty : principalValue + yieldValue;

  // For early withdrawals, yield is zero
  const displayYield = hasEarlyPenalty ? BigInt(0) : yieldValue;

  const handleWithdraw = async () => {
    setError(null);
    setSuccess(false);

    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      const calls = [
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: "withdraw",
          calldata: [position.position_id.toString()],
        },
      ];

      const response = await sendAsync(calls);

      if (response) {
        setSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 4200);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check if this is a user rejection
      const isUserRejection =
        errorMsg.toLowerCase().includes("rejected") ||
        errorMsg.toLowerCase().includes("cancelled") ||
        errorMsg.toLowerCase().includes("user") ||
        errorMsg.toLowerCase().includes("execute failed");

      if (!isUserRejection) {
        setError(errorMsg || "Failed to withdraw position");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Withdraw Savings</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.subtitle}>
            {hasEarlyPenalty
              ? "Early withdrawal with penalty"
              : "Commitment period completed. Claim your savings!"}
          </p>

          <div className={styles.withdrawGoalBadge}>
            <span className={styles.goalNameText}>{felt252ToString(String(position.goal_name))}</span>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.successAlert}>
              <CheckCircle size={20} />
              <span>Savings withdrawn successfully!</span>
            </div>
          )}

          {quoteLoading ? (
            <div className={styles.loadingState}>
              <Loader size={24} className={styles.spinner} />
              <p>Loading position details...</p>
            </div>
          ) : (
            <>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Initial Savings Deposit</span>
                  <span className={styles.detailValueLarge}>
                    {formatBTC(initialDeposit)}
                  </span>
                  <span className={styles.detailValueUSD}>
                    {formatBTCtoUSD(initialDeposit, btcPrice)}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Current Principal Value</span>
                  <span className={styles.detailValueLarge}>
                    {formatBTC(principalValue)}
                  </span>
                  <span className={styles.detailValueUSD}>
                    {formatBTCtoUSD(principalValue, btcPrice)}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Yield Gained</span>
                  <span className={styles.detailValueLarge}>
                    {formatBTC(displayYield)}
                  </span>
                  <span className={styles.detailValueUSD}>
                    {formatBTCtoUSD(displayYield, btcPrice)}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Early Exit Penalty</span>
                  <span className={styles.detailValueLarge}>
                    {formatBTC(earlyExitPenalty)}
                  </span>
                  <span className={`${styles.detailValueUSD} ${hasEarlyPenalty ? styles.penaltyUSD : ''}`}>
                    {formatBTCtoUSD(earlyExitPenalty, btcPrice)}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Withdrawable</span>
                  <span className={styles.detailValueLarge}>
                    {formatBTC(receivable)}
                  </span>
                  <span className={styles.detailValueUSD}>
                    {formatBTCtoUSD(receivable, btcPrice)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleWithdraw}
                className={styles.submitButton}
                disabled={isPending && !error}
              >
                {isPending && !error ? "Withdrawing..." : "Withdraw"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
