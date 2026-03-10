import { useState, useEffect } from "react";

export function useBTCPrice() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBTCPrice = async () => {
      try {
        setIsLoading(true);

        // Use Alchemy Prices API with Bearer token
        const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
        if (alchemyApiKey && alchemyApiKey !== "demo") {
          const alchemyResponse = await fetch(
            `https://api.g.alchemy.com/prices/v1/tokens/by-symbol?symbols=BTC`,
            {
              headers: {
                "Authorization": `Bearer ${alchemyApiKey}`,
              },
            }
          );

          if (alchemyResponse.ok) {
            const data = await alchemyResponse.json();

            if (data.data?.[0]?.prices?.[0]?.value) {
              const btcPriceUSD = parseFloat(data.data[0].prices[0].value);
              setBtcPrice(btcPriceUSD);
              setError(null);
              setIsLoading(false);
              return;
            }
          }
        }

        // Fallback to Binance API if Alchemy fails
        const binanceResponse = await fetch(
          "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
        );
        if (binanceResponse.ok) {
          const data = await binanceResponse.json();
          if (data.price) {
            const btcPrice = parseFloat(data.price);
            setBtcPrice(btcPrice);
            setError(null);
            return;
          }
        }

        // Fallback to CoinGecko API if both fail
        const coingeckoResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        if (coingeckoResponse.ok) {
          const data = await coingeckoResponse.json();
          if (data.bitcoin?.usd) {
            setBtcPrice(data.bitcoin.usd);
            setError(null);
            return;
          }
        }

        throw new Error("Failed to fetch BTC price from all sources");
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchBTCPrice();
    // Refresh every 60 seconds for price updates
    const interval = setInterval(fetchBTCPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  return { btcPrice, isLoading, error };
}

export function formatBTCtoUSD(btcAmount: bigint, btcPrice: number | null): string {
  if (!btcPrice) return "N/A";

  try {
    // Convert bigint to BTC (1e8 satoshis = 1 BTC)
    const btcValue = Number(btcAmount) / 1e8;
    const usdValue = btcValue * btcPrice;

    // Handle edge cases
    if (!isFinite(usdValue)) return "N/A";

    return `$${usdValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch (error) {
    return "N/A";
  }
}
