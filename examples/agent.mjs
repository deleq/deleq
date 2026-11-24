#!/usr/bin/env node
// A tiny trading-agent loop that lives inside a Deleq mandate. It never holds the owner's tokens: it asks DeleqMandateGuard
// to move them, and only after the guard's own check view says the proposal is inside the mandate.
//
//   GUARD=0x… AGENT_KEY=0x… [RPC_URL=…] [MANDATE=<id>] node examples/agent.mjs status
//   … node examples/agent.mjs pay  <token> <to> <amount>                  (amount in token units, e.g. 12.5)
//   … node examples/agent.mjs swap <tokenIn> <tokenOut> <fee> <amountIn> <minOut>
//
// AGENT_KEY is the agent's own private key, passed in the environment of this one command (never the owner's key, never written
// to a file by this script). Without MANDATE the newest mandate naming this agent is used.
// Exit codes: 0 executed (or status printed), 3 refused by the check (nothing sent), 1 error.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, decodeEventLog, defineChain, formatUnits, getAddress, http, parseUnits, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ART = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts.DeleqMandateGuard;
const ABI = ART.abi;
const ERC20 = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];
// Reason bits, same positions as contracts/src/DeleqLimitMath.sol.
const BITS = [
  "UNKNOWN_MANDATE", "REVOKED", "PAUSED", "NOT_STARTED", "EXPIRED", "NOT_AGENT", "ZERO_AMOUNT", "TOKEN_NOT_ALLOWED", "RECIPIENT_NOT_ALLOWED",
  "OVER_PER_TX", "OVER_DAILY", "DAILY_COUNT", "ROUTER_NOT_ALLOWED", "TOKEN_OUT_NOT_ALLOWED", "LOW_ALLOWANCE", "LOW_BALANCE", "NO_MIN_OUT", "SAME_TOKEN", "TOKEN_UNREADABLE",
];
const reasons = (bits) => BITS.filter((_, i) => (BigInt(bits) >> BigInt(i)) & 1n);

const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const GUARD = process.env.GUARD;
const KEY = process.env.AGENT_KEY;
if (!/^0x[0-9a-fA-F]{40}$/.test(GUARD ?? "") || !/^0x[0-9a-fA-F]{64}$/.test(KEY ?? "")) {
  console.error("Set GUARD=<DeleqMandateGuard address> and AGENT_KEY=<agent private key> (and RPC_URL for a local chain).");
  process.exit(1);
}

const probe = createPublicClient({ transport: http(RPC) });
const chainId = await probe.getChainId();
const chain = defineChain({ id: chainId, name: `chain ${chainId}`, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC) });
const agent = privateKeyToAccount(KEY);
const wallet = createWalletClient({ account: agent, chain, transport: http(RPC) });
const guard = getAddress(GUARD);

async function mandateId() {
  if (process.env.MANDATE) return BigInt(process.env.MANDATE);
  const ids = await pub.readContract({ address: guard, abi: ABI, functionName: "mandatesOfAgent", args: [agent.address] });
  if (!ids.length) throw new Error(`No mandate names ${agent.address} as its agent.`);
  return ids[ids.length - 1];
}
const tokenInfo = async (t) => ({
  decimals: Number(await pub.readContract({ address: t, abi: ERC20, functionName: "decimals" })),
  symbol: await pub.readContract({ address: t, abi: ERC20, functionName: "symbol" }).catch(() => t.slice(0, 8)),
});

async function send(functionName, args) {
  // Simulate first: a revert here costs nothing and returns the guard's own error.
  const { request } = await pub.simulateContract({ account: agent, address: guard, abi: ABI, functionName, args });
  const hash = await wallet.writeContract(request);
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
  for (const l of rc.logs) {
    try {
      const d = decodeEventLog({ abi: ABI, data: l.data, topics: l.topics });
      if (d.eventName.endsWith("Executed")) return { hash, event: d };
    } catch {
      // another contract's log
    }
  }
  return { hash, event: null };
}

const [cmd, ...a] = process.argv.slice(2);
try {
  const id = await mandateId();
  const m = await pub.readContract({ address: guard, abi: ABI, functionName: "getMandate", args: [id] });
  if (cmd === "status" || !cmd) {
    const tokens = await pub.readContract({ address: guard, abi: ABI, functionName: "tokensOf", args: [id] });
    console.log(`mandate #${id} owner ${m.owner} agent ${m.agent} ${m.revoked ? "REVOKED" : m.paused ? "PAUSED" : "active"} until ${new Date(Number(m.expiry) * 1000).toISOString()}`);
    for (const t of tokens) {
      const info = await tokenInfo(t);
      const r = await pub.readContract({ address: guard, abi: ABI, functionName: "tokenRule", args: [id, t] });
      const [spent, left] = await pub.readContract({ address: guard, abi: ABI, functionName: "spentToday", args: [id, t] });
      console.log(`  ${info.symbol}: per tx ${formatUnits(r.perTxCap, info.decimals)}, per UTC day ${formatUnits(r.dailyCap, info.decimals)}, spent today ${formatUnits(spent, info.decimals)}, left ${formatUnits(left, info.decimals)}`);
    }
    process.exit(0);
  }
  const ref = stringToHex(`agent-${Date.now()}`.slice(0, 31), { size: 32 });
  if (cmd === "pay") {
    const [token, to, amount] = [getAddress(a[0]), getAddress(a[1]), a[2]];
    const info = await tokenInfo(token);
    const raw = parseUnits(amount, info.decimals);
    const bits = await pub.readContract({ address: guard, abi: ABI, functionName: "checkTransfer", args: [id, agent.address, token, to, raw] });
    if (bits !== 0n) {
      console.log(`REFUSED by the check (bits ${bits}): ${reasons(bits).join(", ")}. Nothing sent.`);
      process.exit(3);
    }
    const { hash, event } = await send("executeTransfer", [id, token, to, raw, ref]);
    console.log(`EXECUTED pay ${amount} ${info.symbol} to ${to} · action #${event?.args.actionNo} · spent today ${formatUnits(event?.args.spentToday ?? 0n, info.decimals)} · tx ${hash}`);
    process.exit(0);
  }
  if (cmd === "swap") {
    const [tokenIn, tokenOut, fee, amountIn, minOut] = [getAddress(a[0]), getAddress(a[1]), Number(a[2]), a[3], a[4]];
    const [inInfo, outInfo] = await Promise.all([tokenInfo(tokenIn), tokenInfo(tokenOut)]);
    const routers = await pub.readContract({ address: guard, abi: ABI, functionName: "routersOf", args: [id] });
    if (!routers.length) throw new Error("This mandate allows no router.");
    const order = { router: routers[0], tokenIn, tokenOut, fee, amountIn: parseUnits(amountIn, inInfo.decimals), minOut: parseUnits(minOut, outInfo.decimals), ref };
    const bits = await pub.readContract({ address: guard, abi: ABI, functionName: "checkSwap", args: [id, agent.address, order] });
    if (bits !== 0n) {
      console.log(`REFUSED by the check (bits ${bits}): ${reasons(bits).join(", ")}. Nothing sent.`);
      process.exit(3);
    }
    const { hash, event } = await send("executeSwapV3", [id, order]);
    console.log(`EXECUTED swap ${amountIn} ${inInfo.symbol} -> ${formatUnits(event?.args.amountOut ?? 0n, outInfo.decimals)} ${outInfo.symbol} to the owner · action #${event?.args.actionNo} · tx ${hash}`);
    process.exit(0);
  }
  console.error("Commands: status | pay <token> <to> <amount> | swap <tokenIn> <tokenOut> <fee> <amountIn> <minOut>");
  process.exit(1);
} catch (e) {
  console.error(`ERROR ${e.shortMessage ?? e.message}`);
  process.exit(1);
}
