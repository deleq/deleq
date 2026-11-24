import { isAddress } from "@/config/brand";

/*
 * Deleq's own contract on Robinhood Chain (chain 4663). Not deployed yet: the owner deploys it from /deploy (localhost only),
 * then pastes the three values below and runs `npm run verify-deployment -- --guard <address> --guard-tx <tx>`.
 *   guard  DeleqMandateGuard (+ internal library DeleqLimitMath, inlined, nothing to link): mandates per owner and agent,
 *          checkTransfer / checkSwap reason bits, executeTransfer (owner -> allowlisted recipient) and executeSwapV3
 *          (output forced to the owner). No admin, no fee, no upgrade, never holds a balance at rest.
 */
const DEPLOYED = {
  guard: "",
  /** Block of the deployment transaction. */
  block: 0,
  /** Creation transaction. */
  tx: "",
};

/**
 * Local tests only: NEXT_PUBLIC_DELEQ_TEST_CONTRACTS='{"guard":"0x…","block":1}' at build time points a second build at a
 * contract on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_DELEQ_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.guard) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;
export const guardLive = () => isAddress(CONTRACTS.guard);
export const CONTRACT_NAME = "DeleqMandateGuard" as const;
