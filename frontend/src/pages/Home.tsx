import { motion } from "motion/react";
import styles from "../styles/Home.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Animated Background Orbs */}
        <div className={styles.orbsContainer}>
          <motion.div
            className={styles.orb1}
            initial={{ y: 0, x: 0 }}
            animate={{
              y: [0, -40, 0],
              x: [0, 20, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className={styles.orb2}
            initial={{ y: 0, x: 0 }}
            animate={{
              y: [0, 35, 0],
              x: [0, -30, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          />
          <motion.div
            className={styles.orb3}
            initial={{ y: 0, x: 0 }}
            animate={{
              y: [0, -30, 0],
              x: [0, 15, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
          <motion.div
            className={styles.orb4}
            initial={{ y: 0, x: 0 }}
            animate={{
              y: [0, 25, 0],
              x: [0, -20, 0],
            }}
            transition={{
              duration: 11,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5,
            }}
          />
        </div>

        {/* Main Content */}
        <div className={styles.content}>
          <motion.div
            className={styles.donutCircle}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 1,
              ease: "easeOut",
            }}
          />
          <h1 className={styles.headline}>Save your BTC with commitments.</h1>

          <h2 className={styles.subheading}>
            Earn Higher Yield For Longer Commitments.
          </h2>

          <div className={styles.divider}></div>

          <p className={styles.description}>
            Nova turns your savings goals into yield-bearing commitments. Set a
            target, lock your timeline, and watch your money work — every goal
            earns yield from day one, and the longer you stay committed, the
            more you earn.
          </p>

          <p className={styles.description}>
            Create a goal. Deposit. Earn. Nova puts your savings to work in the
            background and distributes yield back to you continuously. Withdraw
            anytime — or stay committed and earn more.
          </p>

          <button className={styles.learnMoreButton}>Learn more &gt;</button>
        </div>
      </div>
    </div>
  );
}
