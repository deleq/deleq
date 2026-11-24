import "server-only";
import { decodeEventLog, getAddress, pad, toHex } from "viem";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { GUARD_ABI } from "@/lib/abi";
import { headBlock, logReader, reads, type RawLog, type Read } from "@/lib/server/chainread";
import { scanBack } from "@/lib/logscan";

/*
 * Mandates of one owner or agent, read from DeleqMandateGuard (views), plus every event of those mandates from the guard's logs
 * (executed transfers and swaps with their amounts, pauses, revokes, limit changes). Logs are what a receipt is built from:
 * a reverted action leaves no log, which is why the console records rejections from the pre-check instead.
 */

const MAX_MANDATES = 20;

export type MandateView = {
  id: number;
  owner: string;
  agent: string;
  validFrom: number;
  expiry: number;
  maxActionsPerDay: number;
  version: number;
  paused: boolean;
  revoked: boolean;
  label: string;
  createdAt: number;
  actions: number;
  tokens: { token: string; perTxCap: string; dailyCap: string; listed: boolean; spentToday: string; leftToday: string }[];
  recipients: string[];
  routers: string[];
  actionsToday: number;
};

export type GuardEvent = { name: string; id: number; block: number; tx: string; logIndex: number; args: Record<string, string> };

export type Activity = {
  deployed: boolean;
  guard: string;
  head: number | null;
  mandates: MandateView[];
  events: GuardEvent[];
  scanned: { fromBlock: number; toBlock: number; gaps: [number, number][]; complete: boolean } | null;
};

const r = (fn: string, args: readonly unknown[] = []): Read => ({ to: CONTRACTS.guard, abi: GUARD_ABI, fn, args });
const str = (v: unknown): string => (typeof v === "bigint" ? v.toString() : typeof v === "string" ? v : String(v));
const label = (b: string) => {
  try {
    return Buffer.from(b.slice(2), "hex").toString("utf8").replace(/\u0000+$/, "").replace(/[^\x20-\x7e]/g, "");
  } catch {
    return "";
  }
};

export async function readActivity(who: { owner?: string; agent?: string }): Promise<Activity> {
  if (!guardLive()) return { deployed: false, guard: CONTRACTS.guard, head: null, mandates: [], events: [], scanned: null };
  const head = await headBlock();
  const [ids] = await reads([who.owner ? r("mandatesOfOwner", [getAddress(who.owner)]) : r("mandatesOfAgent", [getAddress(who.agent!)])]);
  if (ids.kind !== "ok") throw new Error("The guard did not answer.");
  const list = (ids.value as bigint[]).slice(-MAX_MANDATES).map(Number);
  const mandates: MandateView[] = [];
  for (const id of list) {
    const base = await reads([r("getMandate", [BigInt(id)]), r("tokensOf", [BigInt(id)]), r("recipientsOf", [BigInt(id)]), r("routersOf", [BigInt(id)]), r("actionsToday", [BigInt(id)])]);
    if (base.some((a) => a.kind !== "ok")) throw new Error("A mandate read failed.");
    const m = (base[0] as { value: Record<string, unknown> }).value;
    const tokens = (base[1] as { value: string[] }).value;
    const rules = await reads(tokens.flatMap((t) => [r("tokenRule", [BigInt(id), t]), r("spentToday", [BigInt(id), t])]));
    if (rules.some((a) => a.kind !== "ok")) throw new Error("A token rule read failed.");
    mandates.push({
      id,
      owner: str(m.owner).toLowerCase(),
      agent: str(m.agent).toLowerCase(),
      validFrom: Number(m.validFrom),
      expiry: Number(m.expiry),
      maxActionsPerDay: Number(m.maxActionsPerDay),
      version: Number(m.version),
      paused: Boolean(m.paused),
      revoked: Boolean(m.revoked),
      label: label(str(m.label)),
      createdAt: Number(m.createdAt),
      actions: Number(m.actions),
      tokens: tokens.map((t, k) => {
        const rule = (rules[2 * k] as { value: { perTxCap: bigint; dailyCap: bigint; listed: boolean } }).value;
        const [spent, left] = (rules[2 * k + 1] as { value: [bigint, bigint] }).value;
        return { token: t.toLowerCase(), perTxCap: str(rule.perTxCap), dailyCap: str(rule.dailyCap), listed: rule.listed, spentToday: str(spent), leftToday: str(left) };
      }),
      recipients: (base[2] as { value: string[] }).value.map((a) => a.toLowerCase()),
      routers: (base[3] as { value: string[] }).value.map((a) => a.toLowerCase()),
      actionsToday: Number((base[4] as { value: [number, number] }).value[0]),
    });
  }
  if (list.length === 0) return { deployed: true, guard: CONTRACTS.guard, head, mandates, events: [], scanned: { fromBlock: CONTRACTS.block, toBlock: head, gaps: [], complete: true } };

  const topicIds = list.map((id) => pad(toHex(id), { size: 32 }));
  const scan = await scanBack<RawLog>(logReader({ address: CONTRACTS.guard, topics: [null, topicIds] }), Math.max(0, CONTRACTS.block), head, { maxCalls: 24 });
  const events: GuardEvent[] = [];
  for (const l of scan.logs) {
    if ((l as RawLog & { removed?: boolean }).removed) continue;
    try {
      const d = decodeEventLog({ abi: GUARD_ABI, data: l.data as `0x${string}`, topics: l.topics as [`0x${string}`, ...`0x${string}`[]] });
      const args = Object.fromEntries(Object.entries((d.args ?? {}) as Record<string, unknown>).map(([k, v]) => [k, str(v)]));
      events.push({ name: String(d.eventName), id: Number(args.id ?? 0), block: Number(BigInt(l.blockNumber)), tx: l.transactionHash, logIndex: Number(BigInt(l.logIndex)), args });
    } catch {
      // not one of the guard's events
    }
  }
  events.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
  return { deployed: true, guard: CONTRACTS.guard, head, mandates, events: events.slice(0, 300), scanned: { fromBlock: CONTRACTS.block, toBlock: head, gaps: scan.gaps, complete: scan.gaps.length === 0 } };
}
