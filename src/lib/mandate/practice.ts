import { formatUnits, parseUnits, stringToHex } from "viem";
import { DAY, type MandateModel, type OwnerWallet, type UsageState } from "@/lib/mandate/engine";
import { UNISWAP_V3, USDG, WETH } from "@/config/dex";
import { storageKey } from "@/config/storage";

/*
 * Practice mode: a mandate, a usage state and an owner wallet held in the browser (localStorage), all SAMPLE DATA, run through
 * the same engine as the guard. The tokens are the real USDG and WETH on Robinhood Chain, so the token check next to a
 * proposal is live; the balances and the addresses of owner, agent and recipients are invented and labelled as such.
 */

export const KEYS = {
  mandate: storageKey("deleq", "practice", "mandate"),
  usage: storageKey("deleq", "practice", "usage"),
  clock: storageKey("deleq", "practice", "clock"),
  log: storageKey("deleq", "log"),
};

/** JSON-safe token rule: caps in token units as typed ("100"), parsed with the token's decimals. */
export type StoredRule = { token: string; symbol: string; decimals: number; perTx: string; daily: string; listed: boolean };
export type StoredMandate = Omit<MandateModel, "tokens"> & { tokens: StoredRule[] };
export type StoredUsage = { spent: Record<string, { day: number; spent: string }>; count: { day: number; count: number }; actions: number };

const rep = (h: string) => `0x${h.repeat(40 / h.length)}`;
export const SAMPLE = {
  owner: rep("0a11ce0a11"),
  agent: rep("a9e7"),
  supplier: rep("51c0"),
  payroll: rep("7a11"),
  stranger: rep("dead"),
};

export function sampleMandate(now = Math.floor(Date.now() / 1000)): StoredMandate {
  return {
    id: 7,
    owner: SAMPLE.owner,
    agent: SAMPLE.agent,
    validFrom: now - 3600,
    expiry: now + 30 * DAY,
    maxActionsPerDay: 10,
    paused: false,
    revoked: false,
    label: "desk-bot",
    tokens: [
      { token: USDG, symbol: "USDG", decimals: 6, perTx: "100", daily: "250", listed: true },
      { token: WETH, symbol: "WETH", decimals: 18, perTx: "0.05", daily: "0.2", listed: true },
    ],
    recipients: [SAMPLE.supplier, SAMPLE.payroll],
    routers: [UNISWAP_V3.swapRouter02],
  };
}

/** Sample owner wallet: 5,000 USDG and 2 WETH, each approved to the guard for 1,000 USDG / 1 WETH. */
export function sampleWallet(): OwnerWallet {
  return {
    [USDG]: { balance: parseUnits("5000", 6), allowance: parseUnits("1000", 6) },
    [WETH]: { balance: parseUnits("2", 18), allowance: parseUnits("1", 18) },
  };
}

export const safeUnits = (v: string, decimals: number): bigint | null => {
  try {
    if (!/^\d+(\.\d+)?$/.test(v.trim())) return null;
    return parseUnits(v.trim(), decimals);
  } catch {
    return null;
  }
};

export function toModel(m: StoredMandate): MandateModel {
  return {
    ...m,
    tokens: m.tokens.map((t) => ({ token: t.token, symbol: t.symbol, decimals: t.decimals, perTxCap: safeUnits(t.perTx, t.decimals) ?? 0n, dailyCap: safeUnits(t.daily, t.decimals) ?? 0n, listed: t.listed })),
  };
}

export const toUsage = (u: StoredUsage | null): UsageState => ({
  spent: Object.fromEntries(Object.entries(u?.spent ?? {}).map(([k, v]) => [k, { day: v.day, spent: BigInt(v.spent) }])),
  count: u?.count ?? { day: 0, count: 0 },
  actions: u?.actions ?? 0,
});
export const fromUsage = (u: UsageState): StoredUsage => ({
  spent: Object.fromEntries(Object.entries(u.spent).map(([k, v]) => [k, { day: v.day, spent: v.spent.toString() }])),
  count: u.count,
  actions: u.actions,
});

export const fmt = (raw: bigint, decimals: number, digits = 4) => {
  const s = formatUnits(raw, decimals);
  const [a, b = ""] = s.split(".");
  const t = b.slice(0, digits).replace(/0+$/, "");
  return `${Number(a).toLocaleString("en-US")}${t ? `.${t}` : ""}`;
};

/** bytes32 label for the contract (ASCII, at most 31 characters). */
export const labelBytes = (s: string) => stringToHex(s.replace(/[^\x20-\x7e]/g, "").slice(0, 31), { size: 32 });

/** One line of the local log: rejections from pre-checks (which leave no trace on chain) and practice executions. */
export type LogEntry = {
  id: string;
  at: number;
  mode: "practice" | "chain";
  mandateId: number;
  kind: "transfer" | "swap";
  summary: string;
  /** Reason bits as a decimal string; "0" = passed. */
  bits: string;
  result: "rejected" | "executed" | "checked";
  tx?: string;
};
