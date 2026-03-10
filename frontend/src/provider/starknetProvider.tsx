"use client";
import React from "react";
import { sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  ready,
  braavos,
  useInjectedConnectors,
  voyager,
  jsonRpcProvider,
} from "@starknet-react/core";

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [ready(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
    order: "random",
  });

  function rpc() {
    return {
      nodeUrl: `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/BbMSXON3d5uhREnZWvIVxwwnXjtyljKl`,
    };
  }
  const provider = jsonRpcProvider({ rpc });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={provider}
      connectors={connectors}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
