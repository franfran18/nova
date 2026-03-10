"use client";

import { useState } from "react";
import { useAccount, useSendTransaction, useReadContract } from "@starknet-react/core";
import { SkeletonLoader } from "../components/SkeletonLoader";
import styles from "../styles/pages/Faucet.module.css";
import { MOCK_WBTC_ADDRESS, MOCK_WBTC_ABI } from "../utils/contract";
import { formatBTC } from "../utils/formatters";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function Faucet() {
  const { address } = useAccount();
  const { sendAsync, isPending } = useSendTransaction({});

  const [formData, setFormData] = useState({
    amount: "",
    recipient: address || "",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch wBTC balance using useReadContract directly
  const { data: wbtcBalance, isLoading: balanceLoading } = useReadContract({
    address: MOCK_WBTC_ADDRESS,
    abi: MOCK_WBTC_ABI,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
    watch: true,
  } as any);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    if (!formData.recipient.trim()) {
      newErrors.recipient = "Recipient address is required";
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
      const amountWei = BigInt(parseFloat(formData.amount) * 1e8); // 8 decimals for wBTC

      // Split u256 into low and high u128 parts
      const low = amountWei & ((1n << 128n) - 1n);
      const high = amountWei >> 128n;

      const calls = [
        {
          contractAddress: MOCK_WBTC_ADDRESS,
          entrypoint: "mint_to",
          calldata: [formData.recipient, low.toString(), high.toString()],
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
        errorMsg.toLowerCase().includes("cancel") ||
        errorMsg.toLowerCase().includes("denied") ||
        errorMsg.toLowerCase().includes("declined") ||
        errorMsg.toLowerCase().includes("execute failed");

      if (!isUserRejection) {
        setError(errorMsg || "Failed to mint wBTC");
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>wBTC faucet</h1>
          <p className={styles.subtitle}>
            Mint free wBTC tokens to test Nova's savings features
          </p>

          {/* Current Balance */}
          <div className={styles.balanceSection}>
            <span className={styles.balanceLabel}>Your wBTC Balance</span>
            {balanceLoading ? (
              <SkeletonLoader height="18px" width="60px" className={styles.balanceSkeleton} />
            ) : (
              <span className={styles.balanceValue}>
                {formatBTC(
                  typeof wbtcBalance === 'bigint'
                    ? wbtcBalance
                    : typeof wbtcBalance === 'number'
                    ? BigInt(wbtcBalance)
                    : typeof wbtcBalance === 'string'
                    ? BigInt(wbtcBalance)
                    : Array.isArray(wbtcBalance) && wbtcBalance.length >= 2
                    ? BigInt(wbtcBalance[0]) + (BigInt(wbtcBalance[1]) << 128n)
                    : BigInt(0)
                )}
              </span>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className={styles.successAlert}>
              <CheckCircle size={20} />
              <span>wBTC minted successfully!</span>
            </div>
          )}

          {/* Form */}
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
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className={`${styles.input} ${
                  errors.amount ? styles.inputError : ""
                }`}
                disabled={isPending && !error}
              />
              {errors.amount && (
                <span className={styles.errorText}>{errors.amount}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="recipient" className={styles.label}>
                Recipient Address
              </label>
              <input
                id="recipient"
                type="text"
                placeholder="0x..."
                value={formData.recipient}
                onChange={(e) =>
                  setFormData({ ...formData, recipient: e.target.value })
                }
                className={`${styles.input} ${
                  errors.recipient ? styles.inputError : ""
                }`}
                disabled={isPending && !error}
              />
              {errors.recipient && (
                <span className={styles.errorText}>{errors.recipient}</span>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isPending && !error}
            >
              {isPending && !error ? "Minting..." : "Mint Asset >"}
            </button>
          </form>

          {/* Info */}
          <div className={styles.infoSection}>
            <p className={styles.infoText}>
              Use the faucet to mint free wBTC tokens for testing purposes. You
              can mint as much as you need to interact with Nova's features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
