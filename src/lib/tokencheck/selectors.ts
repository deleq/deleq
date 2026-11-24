import { toFunctionSelector } from "viem";

/*
 * Function signatures whose 4-byte selector, found as a PUSH4 in a token's runtime code (or its proxy implementation), tells
 * that the code CAN do something to holders. Finding a selector is not proof the function is reachable or used, and a missing
 * selector is not proof of absence (code can be written without it). The page says this next to the rows.
 */
export const POWERS: Record<string, { label: string; signatures: string[] }> = {
  owner: { label: "Owner / admin role", signatures: ["owner()", "getOwner()", "transferOwnership(address)", "grantRole(bytes32,address)", "admin()"] },
  mint: { label: "Mint new supply", signatures: ["mint(address,uint256)", "mint(uint256)", "mintTo(address,uint256)", "issue(uint256)"] },
  pause: { label: "Pause transfers", signatures: ["pause()", "unpause()", "setPaused(bool)"] },
  blocklist: {
    label: "Block addresses",
    signatures: ["blacklist(address)", "addBlackList(address)", "addToBlacklist(address)", "setBlacklist(address,bool)", "isBlacklisted(address)", "isBlocked(address)", "blockAccount(address)", "freeze(address)"],
  },
  burnFrom: { label: "Burn from any holder", signatures: ["adminBurn(address,uint256)", "burnFrom(address,uint256)", "destroyBlackFunds(address)"] },
  fees: { label: "Change transfer fees / tax", signatures: ["setFee(uint256)", "setFees(uint256,uint256)", "setTaxFee(uint256)", "setBuyTax(uint256)", "setSellTax(uint256)", "setTax(uint256,uint256)", "updateFees(uint256,uint256)"] },
  limits: { label: "Change max tx / wallet limits", signatures: ["setMaxTxAmount(uint256)", "setMaxWalletSize(uint256)", "setMaxWallet(uint256)", "removeLimits()"] },
  upgrade: { label: "Upgrade the code", signatures: ["upgradeTo(address)", "upgradeToAndCall(address,bytes)"] },
};

export type PowerKey = keyof typeof POWERS;

const SELECTOR_OF = new Map<string, { key: string; signature: string }>();
for (const [key, p] of Object.entries(POWERS)) for (const s of p.signatures) SELECTOR_OF.set(toFunctionSelector(`function ${s}`).slice(2), { key, signature: s });

/** Every PUSH4 operand in runtime code, walking opcodes so PUSH data is never read as code. */
export function push4s(code: string): Set<string> {
  const hex = code.replace(/^0x/, "").toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i < hex.length; i += 2) {
    const op = parseInt(hex.slice(i, i + 2), 16);
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      if (op === 0x63) out.add(hex.slice(i + 2, i + 10));
      i += n * 2;
    }
  }
  return out;
}

/** Powers found in one or more runtime codes, with the matching signatures. */
export function findPowers(codes: string[]): Record<string, string[]> {
  const seen = new Set<string>();
  for (const c of codes) for (const s of push4s(c)) seen.add(s);
  const found: Record<string, string[]> = {};
  for (const s of seen) {
    const hit = SELECTOR_OF.get(s);
    if (hit) (found[hit.key] ??= []).push(hit.signature);
  }
  return found;
}

/** EIP-1167 minimal proxy: 363d3d373d3d3d363d73<addr>5af43d82803e903d91602b57fd5bf3. Returns the target or null. */
export function minimalProxyTarget(code: string): string | null {
  const m = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(code);
  return m ? `0x${m[1].toLowerCase()}` : null;
}
