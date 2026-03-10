"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { CONTRACT_ADDRESS, MOCK_WBTC_ADDRESS } from "../utils/contract";
import styles from "../styles/components/TopUpModal.module.css";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import type { Position } from "../hooks/useContractReads";
import { felt252ToString } from "../utils/formatters";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
  onSuccess?: () => void;
}

// Helper function to convert decimal amount string to BigInt (8 decimals)
function amountToBigInt(amountStr: string): bigint {
  const parts = amountStr.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = (parts[1] || "0").padEnd(8, "0").slice(0, 8);
  return BigInt(integerPart + decimalPart);
}

export const TopUpModal = ({ isOpen, onClose, position }: TopUpModalProps) => {
  const { address } = useAccount();
  const { sendAsync, isPending } = useSendTransaction({});

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!amount || parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      const amountWei = amountToBigInt(amount);
      const approveLow = amountWei & ((1n << 128n) - 1n);
      const approveHigh = amountWei >> 128n;

      const calls = [
        {
          contractAddress: MOCK_WBTC_ADDRESS,
          entrypoint: "approve",
          calldata: [
            CONTRACT_ADDRESS,
            approveLow.toString(),
            approveHigh.toString(),
          ],
        },
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: "top_up",
          calldata: [
            position.position_id.toString(),
            approveLow.toString(),
            approveHigh.toString(),
          ],
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
        setError(errorMsg || "Failed to top up position");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Top Up Saving</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.subtitle}>
            Top up the amount you're saving. Yield weights are only given based
            on the duration left for the savings.
          </p>

          <div className={styles.goalSection}>
            <div className={styles.goalBadge}>
              <span className={styles.goalName}>
                {felt252ToString(String(position.goal_name))}
              </span>
            </div>
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
              <span>Savings topped up successfully!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="amount" className={styles.label}>
                Amount
              </label>
              <input
                id="amount"
                type="number"
                placeholder="0.00"
                step="0.00000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={styles.input}
                disabled={isPending}
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isPending && !error}
            >
              {isPending && !error ? "Topping Up..." : "Top Up"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
