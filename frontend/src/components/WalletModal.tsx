"use client";

import { ready, braavos, useConnect } from "@starknet-react/core";
import styles from "../styles/components/WalletModal.module.css";
import readyImg from "../assets/ready.png";
import braavosImg from "../assets/braavos.png";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal = ({ isOpen, onClose }: WalletModalProps) => {
  const { connectAsync } = useConnect();

  if (!isOpen) return null;

  const handleConnectReady = async () => {
    try {
      const readyConnector = ready();
      if (readyConnector) {
        await connectAsync({ connector: readyConnector });
        localStorage.setItem("lastConnector", "ready");
        onClose();
      } else {
        alert("Ready wallet not detected. Please install it.");
      }
    } catch (error) {
      alert("Failed to connect Ready wallet. Please try again.");
    }
  };

  const handleConnectBraavos = async () => {
    try {
      const braavosConnector = braavos();
      if (braavosConnector) {
        await connectAsync({ connector: braavosConnector });
        localStorage.setItem("lastConnector", "braavos");
        onClose();
      } else {
        alert("Braavos wallet not detected. Please install it.");
      }
    } catch (error) {
      alert("Failed to connect Braavos wallet. Please try again.");
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Connect Wallet</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <p>Choose a wallet to connect:</p>

          <div className={styles.walletOptions}>
            <button
              className={styles.walletButton}
              onClick={handleConnectReady}
            >
              <img src={readyImg} alt="Ready" className={styles.walletIcon} />
              <div className={styles.walletName}>Ready</div>
              <div className={styles.walletDescription}>
                Connect with Ready wallet
              </div>
            </button>

            <button
              className={styles.walletButton}
              onClick={handleConnectBraavos}
            >
              <img
                src={braavosImg}
                alt="Braavos"
                className={styles.walletIcon}
              />
              <div className={styles.walletName}>Braavos</div>
              <div className={styles.walletDescription}>
                Connect with Braavos wallet
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
