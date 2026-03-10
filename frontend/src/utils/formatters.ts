/**
 * Format large numbers for display
 * e.g., 1234567 -> "1.23M"
 */
export function formatCompactNumber(value: bigint | number): string {
  const num = typeof value === "bigint" ? Number(value) : value;

  if (num === 0) return "0";
  if (num < 1000) return num.toFixed(2);
  if (num < 1_000_000) return (num / 1000).toFixed(2) + "K";
  if (num < 1_000_000_000) return (num / 1_000_000).toFixed(2) + "M";
  return (num / 1_000_000_000).toFixed(2) + "B";
}

/**
 * Format number with commas and decimals
 * e.g., 1234567.89 -> "1,234,567.89"
 */
export function formatNumber(
  value: bigint | number,
  decimals: number = 2,
): string {
  const num = typeof value === "bigint" ? Number(value) : value;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format BTC with 8 decimals
 * e.g., 100000000 (1 BTC in 8 decimals) -> "1.00000000 BTC"
 */
export function formatBTC(value: bigint | number, decimals: number = 7): string {
  const num = typeof value === "bigint" ? Number(value) : value;
  const btcValue = num / 1e8; // wBTC has 8 decimals
  return formatNumber(btcValue, decimals) + " BTC";
}

/**
 * Format USD value from BTC amount
 * Uses BTC price in USD
 * e.g., 100000000 (1 BTC in 8 decimals) -> "$28,000.00"
 */
export function formatUSD(value: bigint | number, btcPriceUSD: number = 28000): string {
  const num = typeof value === "bigint" ? Number(value) : value;
  const btcValue = num / 1e8; // wBTC has 8 decimals
  const usdValue = btcValue * btcPriceUSD;
  return "$" + formatNumber(usdValue, 2);
}

/**
 * Format timestamp to readable date
 * e.g., 1609459200 -> "Jan 1, 2021"
 */
export function formatDate(timestamp: bigint | number): string {
  const num = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  const date = new Date(num * 1000); // Convert to milliseconds
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time remaining using blockchain timestamp
 * e.g., returns "4 days 3 hours 25 minutes" or "Completed"
 * @param endTime - The end timestamp from the blockchain
 * @param currentBlockTime - The current blockchain timestamp (in seconds)
 */
export function formatTimeRemaining(
  endTime: bigint | number,
  currentBlockTime: bigint | number,
): {
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
  isCompleted: boolean;
} {
  const end = typeof endTime === "bigint" ? Number(endTime) : endTime;
  const now = typeof currentBlockTime === "bigint" ? Number(currentBlockTime) : currentBlockTime;
  const secondsRemaining = Math.max(0, end - now);
  const isCompleted = end <= now;

  const days = Math.floor(secondsRemaining / (24 * 60 * 60));
  const hours = Math.floor((secondsRemaining % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((secondsRemaining % (60 * 60)) / 60);

  return {
    days,
    hours,
    minutes,
    formatted: isCompleted ? "Completed" : `${days} days ${hours} hours ${minutes} minutes`,
    isCompleted,
  };
}

/**
 * Calculate progress percentage based on time
 * Returns percentage complete (0-100)
 * @param startTime - The start timestamp
 * @param endTime - The end timestamp
 * @param currentBlockTime - Optional current block timestamp (defaults to now if not provided)
 */
export function calculateTimeProgress(
  startTime: bigint | number,
  endTime: bigint | number,
  currentBlockTime?: bigint | number,
): number {
  const start = typeof startTime === "bigint" ? Number(startTime) : startTime;
  const end = typeof endTime === "bigint" ? Number(endTime) : endTime;
  const now = currentBlockTime
    ? (typeof currentBlockTime === "bigint" ? Number(currentBlockTime) : currentBlockTime)
    : Math.floor(Date.now() / 1000);

  if (now <= start) return 0;
  if (now >= end) return 100;

  const totalDuration = end - start;
  const elapsed = now - start;
  return Math.round((elapsed / totalDuration) * 100);
}

/**
 * Format date range
 * e.g., "Jan 1, 2021 - Jan 15, 2021"
 */
export function formatDateRange(
  startTime: bigint | number,
  endTime: bigint | number,
): string {
  return `${formatDate(startTime)} → ${formatDate(endTime)}`;
}

/**
 * Format date range with time in UTC
 * e.g., "Jan 1, 2021 10:30 AM - Jan 15, 2021 3:45 PM (UTC)"
 */
export function formatDateTimeRange(
  startTime: bigint | number,
  endTime: bigint | number,
): string {
  const start = typeof startTime === "bigint" ? Number(startTime) : startTime;
  const end = typeof endTime === "bigint" ? Number(endTime) : endTime;

  const startDate = new Date(start * 1000);
  const endDate = new Date(end * 1000);

  const startStr = startDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const startTime_ = startDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  const endStr = endDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endTime_ = endDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  return `${startStr} ${startTime_} → ${endStr} ${endTime_} (UTC)`;
}

/**
 * Convert Felt252 hex string to UTF-8 string
 * e.g., "0x5661636174696f6e" -> "Vacation"
 * Also handles if input is already a string or a number
 */
export function felt252ToString(felt: string | number | bigint): string {
  if (!felt) return "";

  const feltStr = String(felt).trim();

  // If it's already a readable string (contains spaces, special chars, non-hex letters), return as is
  if (!feltStr.startsWith("0x") && !/^[0-9a-fA-F]*$/.test(feltStr)) {
    return feltStr;
  }

  if (feltStr === "0x0" || feltStr === "0") return "";

  // Convert number to hex if needed
  let hex = feltStr;
  if (feltStr.startsWith("0x")) {
    hex = feltStr.slice(2);
  } else if (/^[0-9]+$/.test(feltStr)) {
    // It's a decimal number, convert to hex
    try {
      hex = BigInt(feltStr).toString(16);
    } catch (e) {
      return feltStr;
    }
  }

  // Convert hex to ASCII string
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.slice(i, i + 2), 16);
    if (charCode === 0) break; // Stop at null terminator
    if (charCode < 32 || charCode > 126) break; // Stop at non-printable characters
    result += String.fromCharCode(charCode);
  }

  return result || feltStr; // Return original if decode failed
}
