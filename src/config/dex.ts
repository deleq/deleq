/*
 * Robinhood Chain (4663) contracts Deleq reads or routes through. Each address was read on chain on 24 Nov 2026 through the
 * official RPC: code present and the cross-checks noted on each line answered as shown. None of them is a Deleq contract.
 */

/** Wrapped ether, 18 decimals (SwapRouter02 WETH9() returns it). Native ETH is not supported by the guard in v1: wrap first. */
export const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
/** Global Dollar (USDG): name() "Global Dollar", symbol() "USDG", decimals() 6, ERC-1967 proxy, supply ~633.08 M on 24 Nov 2026.
 *  Many lookalikes use the same symbol; only this address is used. */
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

/** Uniswap v3 on Robinhood Chain. SwapRouter02 factory() returns V3_FACTORY and WETH9() returns WETH. */
export const UNISWAP_V3 = {
  factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  /** SwapRouter02: exactInputSingle(tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96), no deadline. */
  swapRouter02: "0xcaf681a66d020601342297493863e78c959e5cb2",
} as const;

/** Uniswap v3 fee tiers (hundredths of a basis point). The deepest WETH/USDG pool on 24 Nov 2026 was the 100 tier. */
export const V3_FEES = [100, 500, 3000, 10000] as const;

/** Routers the site offers for swap mandates. Only routers that were fork-tested with DeleqMandateGuard are listed. */
export const VERIFIED_ROUTERS = [{ address: UNISWAP_V3.swapRouter02, label: "Uniswap v3 SwapRouter02" }] as const;

/** Pons V2 launch factory: getLaunchedToken(token) (0x3cf28b5a) → curve (word 1), creator (word 2), phase (word 10), exists (word 14). */
export const PONS = {
  factory: "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e",
  launchSelector: "0x3cf28b5a",
  page: (token: string) => `https://ponsfamily.com/launchpad/${token.toLowerCase()}`,
} as const;

/** Chainlink ETH / USD standard proxy on Robinhood Chain, 8 decimals (description() "ETH / USD"). */
export const ETH_USD_FEED = "0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9";

/** Robinhood stock tokens are beacon proxies; this is the beacon their ERC-1967 beacon slot points at. */
export const STOCK_BEACON = "0xe10b6f6b275de231345c20d14ab812db62151b00";

export const SLOTS = {
  /** ERC-1967 implementation slot. */
  impl: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  /** ERC-1967 admin slot. */
  admin: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  /** ERC-1967 beacon slot. */
  beacon: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
} as const;

/** Tokens offered as one-click picks in the console (both proven above). */
export const KNOWN_TOKENS = [
  { address: USDG, symbol: "USDG", decimals: 6 },
  { address: WETH, symbol: "WETH", decimals: 18 },
] as const;
