"use client";

import { useAccount, useDisconnect } from "@starknet-react/core";
import { useState } from "react";
import styles from "../styles/components/Navbar.module.css";
import logo from "../assets/nova-logo.svg";
import { Link } from "react-router-dom";
import { truncateAddress } from "../utils/helpers";
import { WalletModal } from "./WalletModal";

export const Nabvbar = () => {
  const { address, status } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDisconnect = async () => {
    try {
      await disconnectAsync();
      localStorage.removeItem("lastConnector");
    } catch (error) {
      // Disconnect failed silently
    }
  };

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.container}>
          {/* Logo */}
          <Link to="/" className={styles.logo}>
            <img src={logo} alt="Logo" />
            <span className={styles.logoText}>nova.</span>
          </Link>

          {/* Nav Links */}
          <div className={styles.navLinks}>
            <Link to="/dashboard" className={styles.navLink}>
              dashboard
            </Link>
            <Link to="/faucet" className={styles.navLink}>
              faucet
            </Link>
          </div>

          {/* Connect Button */}
          <div className={styles.connectContainer}>
            {status === "connected" && address ? (
              <div className={styles.accountContainer}>
                <button className={styles.addressButton}>
                  {truncateAddress(address)}
                </button>
                <button
                  className={styles.disconnectButton}
                  onClick={handleDisconnect}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                className={styles.connectButton}
                onClick={() => setIsModalOpen(true)}
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </nav>
      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
