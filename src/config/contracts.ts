import { isAddress } from "@/config/brand";

/*
 * Deleq's own contract on Robinhood Chain (chain 4663), deployed by the owner on 24 Nov 2026 (block 122213192, 2,955,030 gas).
 * Check it yourself: `npm run verify-deployment -- --guard <address> --guard-tx <tx>` (values below) prints MATCH.
 *   guard  DeleqMandateGuard (+ internal library DeleqLimitMath, inlined, nothing to link): mandates per owner and agent,
 *          checkTransfer / checkSwap reason bits, executeTransfer (owner -> allowlisted recipient) and executeSwapV3
 *          (output forced to the owner). No admin, no fee, no upgrade, never holds a balance at rest.
 */
const DEPLOYED = {
  guard: "0x57dd851d840b1f0a2896dc1524c398c4574ff3c1",
  /** Block of the deployment transaction. */
  block: 122213192,
  /** Creation transaction. */
  tx: "0xc7cad03d8f45fef6cc0833d85bcb90bfa167b3d8b76cef4a5cfb89aaa17de403",
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
