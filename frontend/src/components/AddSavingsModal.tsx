"use client";

import { useState } from "react";
import {
  useAccount,
  useSendTransaction,
  useReadContract,
} from "@starknet-react/core";
import styles from "../styles/components/AddSavingsModal.module.css";
import {
  CONTRACT_ADDRESS,
  MOCK_WBTC_ADDRESS,
  MOCK_WBTC_ABI,
} from "../utils/contract";
import { X } from "lucide-react";
import { formatBTC } from "../utils/formatters";

interface AddSavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Helper function to convert decimal amount string to BigInt (8 decimals)
function amountToBigInt(amountStr: string): bigint {
  const parts = amountStr.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = (parts[1] || "0").padEnd(8, "0").slice(0, 8);
  return BigInt(integerPart + decimalPart);
}

export const AddSavingsModal = ({ isOpen, onClose }: AddSavingsModalProps) => {
  const { address } = useAccount();
  const { sendAsync, isPending } = useSendTransaction({});

  const [formData, setFormData] = useState({
    goalName: "",
    amount: "",
    durationDays: "",
    durationHours: "",
    durationMinutes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch wBTC balance using useReadContract directly
  const { data: wbtcBalanceRaw } = useReadContract({
    address: MOCK_WBTC_ADDRESS,
    abi: MOCK_WBTC_ABI,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
    watch: true,
  } as any);

  // Convert raw balance to proper BigInt format
  let wbtcBalance: bigint | undefined;
  if (typeof wbtcBalanceRaw === "bigint") {
    wbtcBalance = wbtcBalanceRaw;
  } else if (typeof wbtcBalanceRaw === "number") {
    wbtcBalance = BigInt(wbtcBalanceRaw);
  } else if (typeof wbtcBalanceRaw === "string") {
    wbtcBalance = BigInt(wbtcBalanceRaw);
  } else if (Array.isArray(wbtcBalanceRaw) && wbtcBalanceRaw.length >= 2) {
    // Handle case where balance is returned as array [low, high]
    wbtcBalance =
      BigInt(wbtcBalanceRaw[0]) + (BigInt(wbtcBalanceRaw[1]) << 128n);
  }

  const calculateCommitmentDuration = (): bigint => {
    const days = parseInt(formData.durationDays) || 0;
    const hours = parseInt(formData.durationHours) || 0;
    const minutes = parseInt(formData.durationMinutes) || 0;

    const totalSeconds = BigInt(days * 86400 + hours * 3600 + minutes * 60);
    return totalSeconds;
  };

  const formatTotalTime = (): string => {
    const days = parseInt(formData.durationDays) || 0;
    const hours = parseInt(formData.durationHours) || 0;
    const minutes = parseInt(formData.durationMinutes) || 0;

    // Convert everything to total seconds
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60;

    if (totalSeconds === 0) return "0 minutes";

    // Convert back to days, hours, minutes
    const finalDays = Math.floor(totalSeconds / 86400);
    const remainingAfterDays = totalSeconds % 86400;
    const finalHours = Math.floor(remainingAfterDays / 3600);
    const finalMinutes = Math.floor((remainingAfterDays % 3600) / 60);

    const parts = [];
    if (finalDays > 0)
      parts.push(`${finalDays} day${finalDays > 1 ? "s" : ""}`);
    if (finalHours > 0)
      parts.push(`${finalHours} hour${finalHours > 1 ? "s" : ""}`);
    if (finalMinutes > 0)
      parts.push(`${finalMinutes} minute${finalMinutes > 1 ? "s" : ""}`);

    if (parts.length === 0) return "0 minutes";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  };

  const stringToFelt252 = (str: string): string => {
    let hex = "0x";
    for (let i = 0; i < Math.min(str.length, 31); i++) {
      hex += str.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.goalName.trim()) {
      newErrors.goalName = "Savings goal is required";
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    const days = parseInt(formData.durationDays) || 0;
    const hours = parseInt(formData.durationHours) || 0;
    const minutes = parseInt(formData.durationMinutes) || 0;
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60;

    if (totalSeconds === 0) {
      newErrors.duration = "Commitment duration must be greater than 0";
    } else if (totalSeconds < 1800) {
      newErrors.duration = "Commitment duration must be at least 30 minutes";
    }

    // Check wBTC balance - must check before allowing submission
    if (formData.amount && parseFloat(formData.amount) > 0) {
      const amountWei = amountToBigInt(formData.amount); // Safe conversion without floating-point errors

      if (!wbtcBalance) {
        newErrors.amount = "Insufficient balance";
      } else if (amountWei > wbtcBalance) {
        newErrors.amount = `Insufficient balance. You have ${formatBTC(wbtcBalance)}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validateForm()) return;
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      const amountWei = amountToBigInt(formData.amount); // Safe conversion without floating-point errors
      const duration = calculateCommitmentDuration();
      const goalNameFelt = stringToFelt252(formData.goalName);

      // Split u256 into low and high u128 parts for approve
      const approveLow = amountWei & ((1n << 128n) - 1n);
      const approveHigh = amountWei >> 128n;

      // Split u256 into low and high u128 parts for deposit
      const depositLow = amountWei & ((1n << 128n) - 1n);
      const depositHigh = amountWei >> 128n;

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
          entrypoint: "deposit",
          calldata: [
            depositLow.toString(),
            depositHigh.toString(),
            duration.toString(),
            goalNameFelt,
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
      // Check if this is a user rejection/cancellation - if so, don't show error
      let isUserRejection = false;

      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();
        isUserRejection =
          errMsg.includes("rejected") ||
          errMsg.includes("user rejected") ||
          errMsg.includes("user reused op") ||
          errMsg.includes("cancelled") ||
          errMsg.includes("cancel") ||
          errMsg.includes("denied") ||
          errMsg.includes("declined") ||
          errMsg.includes("user deny") ||
          errMsg.includes("execution was rejected") ||
          errMsg.includes("execution reverted: user") ||
          errMsg.includes("failed to send") ||
          errMsg.includes("execute failed");
      } else if (typeof err === "string") {
        const errStr = err.toLowerCase();
        isUserRejection =
          errStr.includes("rejected") ||
          errStr.includes("user rejected") ||
          errStr.includes("user reused op") ||
          errStr.includes("cancelled") ||
          errStr.includes("cancel") ||
          errStr.includes("denied") ||
          errStr.includes("declined") ||
          errStr.includes("user deny") ||
          errStr.includes("execution was rejected") ||
          errStr.includes("execution reverted: user") ||
          errStr.includes("failed to send") ||
          errStr.includes("execute failed");
      }

      // Only show error if it's not a user rejection
      if (!isUserRejection) {
        let errorMessage = "Failed to create savings";

        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === "string") {
          errorMessage = err;
        }

        setError(errorMessage);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Add New Savings</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.subtitle}>
            Create a new wBTC saving with a commitment duration.
          </p>

          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && (
            <div className={styles.successMessage}>
              Savings created successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="goalName" className={styles.label}>
                  Savings goal
                </label>
                <span className={styles.charCount}>
                  {formData.goalName.length}/31
                </span>
              </div>
              <input
                id="goalName"
                type="text"
                placeholder="e.g., Emergency Fund, Vacation"
                value={formData.goalName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    goalName: e.target.value.slice(0, 31),
                  })
                }
                maxLength={31}
                className={`${styles.input} ${errors.goalName ? styles.inputError : ""}`}
                disabled={isPending}
              />
              {errors.goalName && (
                <span className={styles.errorText}>{errors.goalName}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="amount" className={styles.label}>
                Amount
              </label>
              <input
                id="amount"
                type="number"
                placeholder="0.00"
                step="0.00000001"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className={`${styles.input} ${errors.amount ? styles.inputError : ""}`}
                disabled={isPending}
              />
              {errors.amount && (
                <span className={styles.errorText}>{errors.amount}</span>
              )}
            </div>

            <div className={styles.durationSection}>
              <div className={styles.dateTimeRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="durationDays" className={styles.label}>
                    Days
                  </label>
                  <input
                    id="durationDays"
                    type="number"
                    placeholder="0"
                    min="0"
                    value={formData.durationDays}
                    onChange={(e) =>
                      setFormData({ ...formData, durationDays: e.target.value })
                    }
                    className={styles.input}
                    disabled={isPending}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="durationHours" className={styles.label}>
                    Hours
                  </label>
                  <input
                    id="durationHours"
                    type="number"
                    placeholder="0"
                    min="0"
                    max="23"
                    value={formData.durationHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        durationHours: e.target.value,
                      })
                    }
                    className={styles.input}
                    disabled={isPending}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="durationMinutes" className={styles.label}>
                    Minutes
                  </label>
                  <input
                    id="durationMinutes"
                    type="number"
                    placeholder="0"
                    min="0"
                    max="59"
                    value={formData.durationMinutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        durationMinutes: e.target.value,
                      })
                    }
                    className={styles.input}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className={styles.totalTimeDisplay}>
                Total Time:{" "}
                <span className={styles.totalTimeValue}>
                  {formatTotalTime()}
                </span>
              </div>

              {errors.duration && (
                <span className={styles.errorText}>{errors.duration}</span>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={
                (isPending && !error) || Object.keys(errors).length > 0
              }
            >
              {isPending && !error ? "Creating Savings..." : "Create Savings"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
