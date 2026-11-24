/*
 * Reason bits, the same positions as contracts/src/DeleqLimitMath.sol (bits.test.ts reads the .sol and compares).
 * A check returns a bitmask: 0 means the guard would let the action through; every set bit is one reason it would not.
 */

export const BITS = {
  UNKNOWN_MANDATE: 1n << 0n,
  REVOKED: 1n << 1n,
  PAUSED: 1n << 2n,
  NOT_STARTED: 1n << 3n,
  EXPIRED: 1n << 4n,
  NOT_AGENT: 1n << 5n,
  ZERO_AMOUNT: 1n << 6n,
  TOKEN_NOT_ALLOWED: 1n << 7n,
  RECIPIENT_NOT_ALLOWED: 1n << 8n,
  OVER_PER_TX: 1n << 9n,
  OVER_DAILY: 1n << 10n,
  DAILY_COUNT: 1n << 11n,
  ROUTER_NOT_ALLOWED: 1n << 12n,
  TOKEN_OUT_NOT_ALLOWED: 1n << 13n,
  LOW_ALLOWANCE: 1n << 14n,
  LOW_BALANCE: 1n << 15n,
  NO_MIN_OUT: 1n << 16n,
  SAME_TOKEN: 1n << 17n,
  TOKEN_UNREADABLE: 1n << 18n,
} as const;

export type BitName = keyof typeof BITS;

/** Plain words per bit: a short label for chips and one sentence for the explanation. */
export const BIT_WORDS: Record<BitName, { label: string; why: string }> = {
  UNKNOWN_MANDATE: { label: "Unknown mandate", why: "There is no mandate with this number." },
  REVOKED: { label: "Revoked", why: "The owner revoked this mandate. Nothing can run under it again." },
  PAUSED: { label: "Paused", why: "The mandate is paused by the owner (or by the agent itself)." },
  NOT_STARTED: { label: "Not started", why: "The mandate's start time has not been reached." },
  EXPIRED: { label: "Expired", why: "The mandate's end time has passed." },
  NOT_AGENT: { label: "Not the agent", why: "Only the agent address named in the mandate can act under it." },
  ZERO_AMOUNT: { label: "Zero amount", why: "The amount is zero." },
  TOKEN_NOT_ALLOWED: { label: "Token not allowed", why: "The mandate does not list this token for spending." },
  RECIPIENT_NOT_ALLOWED: { label: "Recipient not allowed", why: "The recipient is not on the mandate's allowlist." },
  OVER_PER_TX: { label: "Over per-tx cap", why: "The amount is above the per-transaction cap for this token." },
  OVER_DAILY: { label: "Over daily cap", why: "Today's spend plus this amount would pass the daily cap (UTC day)." },
  DAILY_COUNT: { label: "Daily action limit", why: "The mandate's number of actions per UTC day is used up." },
  ROUTER_NOT_ALLOWED: { label: "Router not allowed", why: "The swap router is not on the mandate's allowlist." },
  TOKEN_OUT_NOT_ALLOWED: { label: "Output token not allowed", why: "The token the swap would buy is not listed in the mandate." },
  LOW_ALLOWANCE: { label: "Allowance too low", why: "The owner's ERC-20 allowance to the guard is below the amount." },
  LOW_BALANCE: { label: "Balance too low", why: "The owner's wallet holds less than the amount." },
  NO_MIN_OUT: { label: "No minimum output", why: "A swap needs a minimum output above zero." },
  SAME_TOKEN: { label: "Same token", why: "The swap sells and buys the same token." },
  TOKEN_UNREADABLE: { label: "Token unreadable", why: "The token did not answer balanceOf / allowance like an ERC-20." },
};

export const BIT_ORDER = Object.keys(BITS) as BitName[];

/** Names of the bits set in `mask`, lowest first. */
export function bitNames(mask: bigint): BitName[] {
  return BIT_ORDER.filter((n) => (mask & BITS[n]) !== 0n);
}

/** Highest bit in use; any bit above it in an answer means the contract and the site disagree. */
export const KNOWN_MASK = BIT_ORDER.reduce((m, n) => m | BITS[n], 0n);
