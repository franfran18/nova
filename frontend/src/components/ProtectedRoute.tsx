"use client";

import { useAccount } from "@starknet-react/core";
import { useState } from "react";
import { WalletModal } from "./WalletModal";
import styles from "../styles/components/ProtectedRoute.module.css";
import novaLogo from "../assets/nova-logo.svg";
import { useAutoConnect } from "../hooks/useAutoConnect";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { address, status } = useAccount();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAutoConnecting } = useAutoConnect();

  // Show children if connected
  if (status === "connected" && address) {
    return <>{children}</>;
  }

  // Show loading state while auto-connecting
  if (isAutoConnecting) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loadingSpinner}></div>
          <h1 className={styles.title}>Reconnecting...</h1>
          <p className={styles.description}>
            We're restoring your wallet connection
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <img src={novaLogo} alt="Nova Logo" className={styles.logo} />
        </div>

        <h1 className={styles.title}>Wallet Connection Required</h1>

        <p className={styles.description}>
          You need to connect your wallet to access the dashboard. Choose your
          preferred wallet below to get started.
        </p>

        <button
          className={styles.connectButton}
          onClick={() => setIsModalOpen(true)}
        >
          Connect Wallet
        </button>
      </div>

      <WalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
