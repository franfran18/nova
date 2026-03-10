import { useEffect, useRef, useState } from "react";
import { useConnect, useAccount } from "@starknet-react/core";
import { ready, braavos } from "@starknet-react/core";

export function useAutoConnect() {
  const { connectAsync } = useConnect();
  const { address } = useAccount();
  const [isAutoConnecting, setIsAutoConnecting] = useState(true);
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Don't attempt if already connected
    if (address) {
      setIsAutoConnecting(false);
      hasAttempted.current = true;
      return;
    }

    // Don't attempt multiple times
    if (hasAttempted.current) {
      setIsAutoConnecting(false);
      return;
    }

    const autoConnect = async () => {
      try {
        const lastConnector = localStorage.getItem("lastConnector");

        if (!lastConnector) {
          setIsAutoConnecting(false);
          hasAttempted.current = true;
          return;
        }

        // Determine which connector to use based on saved preference
        let connectorToUse;

        if (lastConnector === "ready") {
          connectorToUse = ready();
        } else if (lastConnector === "braavos") {
          connectorToUse = braavos();
        }

        if (connectorToUse) {
          await connectAsync({ connector: connectorToUse });
        }

        hasAttempted.current = true;
      } catch (error) {
        // Auto-connect failed silently
        // Clear the saved connector if reconnection fails
        localStorage.removeItem("lastConnector");
        hasAttempted.current = true;
      } finally {
        setIsAutoConnecting(false);
      }
    };

    // Small delay to ensure starknet-react is fully initialized
    const timer = setTimeout(() => {
      autoConnect();
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - run once on mount

  return { isAutoConnecting };
}
