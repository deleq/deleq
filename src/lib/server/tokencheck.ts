import "server-only";
import { decodeAbiParameters, encodeFunctionData, getAddress, parseAbi } from "viem";
import { PONS, SLOTS, STOCK_BEACON, UNISWAP_V3, USDG, V3_FEES, WETH } from "@/config/dex";
import { rpc, rpcBatchAnswers, type BatchAnswer } from "@/lib/feeds/rpc";
import { findPowers, minimalProxyTarget, POWERS } from "@/lib/tokencheck/selectors";
import type { CheckRow, TokenCheck } from "@/lib/tokencheck/types";

/*
 * The token check shown next to every agent proposal. Everything is read from Robinhood Chain at ONE block (the head when the
 * check starts), each row says where its value came from, and anything that could not be read stays "Not known". A clean check
 * does not make a token safe: it lists what the chain says, nothing more.
 */

const ERC20 = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
]);
const FACTORY = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const ZERO = "0x0000000000000000000000000000000000000000";

const call = (to: string, data: string, tag: string) => ({ method: "eth_call", params: [{ to, data, gas: "0x30d40" }, tag] });
const ok = (a: BatchAnswer | undefined): string | null => (a && a.kind === "ok" && typeof a.result === "string" ? a.result : null);
const slotAddr = (v: string | null) => (v && v.length >= 66 && !/^0x0*$/.test(v) ? `0x${v.slice(-40).toLowerCase()}` : null);

function str(raw: string | null): string | null {
  if (!raw || raw.length <= 2) return null;
  try {
    return decodeAbiParameters([{ type: "string" }], raw as `0x${string}`)[0].replace(/[\u0000-\u001f‪-‮⁦-⁩]/g, "").slice(0, 64);
  } catch {
    // bytes32-style names
    try {
      const b = Buffer.from(raw.slice(2, 66), "hex").toString("utf8").replace(/\u0000+$/, "");
      return b && /^[\x20-\x7e]+$/.test(b) ? b : null;
    } catch {
      return null;
    }
  }
}
const uintOf = (raw: string | null) => (raw && raw.length >= 66 ? BigInt(raw.slice(0, 66)) : null);
const addrOf = (raw: string | null) => (raw && raw.length >= 66 ? `0x${raw.slice(26, 66).toLowerCase()}` : null);

export async function checkToken(tokenIn: string): Promise<TokenCheck> {
  const token = tokenIn.toLowerCase();
  const head = await rpc<{ number: string; timestamp: string } | null>("eth_getBlockByNumber", ["latest", false]);
  if (!head?.number) throw new Error("The chain head could not be read.");
  const tag = head.number;
  const block = Number(BigInt(head.number));
  const at = Number(BigInt(head.timestamp));

  const pairs = [WETH, USDG].filter((p) => p !== token);
  const poolCalls = pairs.flatMap((p) => V3_FEES.map((fee) => ({ p, fee })));
  const batch = [
    { method: "eth_getCode", params: [token, tag] },
    { method: "eth_getStorageAt", params: [token, SLOTS.impl, tag] },
    { method: "eth_getStorageAt", params: [token, SLOTS.admin, tag] },
    { method: "eth_getStorageAt", params: [token, SLOTS.beacon, tag] },
    call(token, encodeFunctionData({ abi: ERC20, functionName: "name" }), tag),
    call(token, encodeFunctionData({ abi: ERC20, functionName: "symbol" }), tag),
    call(token, encodeFunctionData({ abi: ERC20, functionName: "decimals" }), tag),
    call(token, encodeFunctionData({ abi: ERC20, functionName: "totalSupply" }), tag),
    call(token, encodeFunctionData({ abi: ERC20, functionName: "owner" }), tag),
    call(PONS.factory, `${PONS.launchSelector}${token.slice(2).padStart(64, "0")}`, tag),
    ...poolCalls.map((x) => call(UNISWAP_V3.factory, encodeFunctionData({ abi: FACTORY, functionName: "getPool", args: [getAddress(token), getAddress(x.p), x.fee] }), tag)),
  ];
  const r = await rpcBatchAnswers(batch);
  const code = ok(r[0]);
  if (code === null) throw new Error("The token's code could not be read. Try again.");

  const rows: CheckRow[] = [];
  const src = (method: string, address = token) => ({ method, address });
  const isContract = code.length > 2;
  rows.push({
    key: "code",
    label: "Contract code",
    value: isContract ? `${(code.length - 2) / 2} bytes` : "No code: not a token contract",
    tone: isContract ? "ok" : "risk",
    source: src("eth_getCode"),
  });
  if (!isContract) return { token, block, checkedAt: at, name: null, symbol: null, decimals: null, rows, flags: ["no-code"] };

  const flags: string[] = [];
  const name = str(ok(r[4]));
  const symbol = str(ok(r[5]));
  const decRaw = uintOf(ok(r[6]));
  const decimals = decRaw !== null && decRaw <= 36n ? Number(decRaw) : null;
  const supply = uintOf(ok(r[7]));
  const erc20 = symbol !== null && decimals !== null && supply !== null;
  rows.push({
    key: "erc20",
    label: "ERC-20 metadata",
    value: erc20 ? `${name ?? "(no name)"} · ${symbol} · ${decimals} decimals` : "Not known: name/symbol/decimals/totalSupply did not all answer",
    tone: erc20 ? "ok" : "warn",
    source: src("name() symbol() decimals() totalSupply()"),
  });
  if (supply !== null) rows.push({ key: "supply", label: "Total supply (raw)", value: supply.toString(), tone: "info", source: src("totalSupply()"), decimals: decimals ?? undefined });
  if (!erc20) flags.push("not-erc20");

  // Proxy: ERC-1967 slots, beacon, minimal proxy.
  const impl = slotAddr(ok(r[1]));
  const admin = slotAddr(ok(r[2]));
  const beacon = slotAddr(ok(r[3]));
  const minimal = minimalProxyTarget(code);
  const proxyKnown = r[1].kind === "ok" && r[2].kind === "ok" && r[3].kind === "ok";
  let proxyValue = "No proxy slots set";
  let tone: CheckRow["tone"] = "ok";
  if (impl || beacon || minimal) {
    tone = "warn";
    proxyValue = impl ? `ERC-1967 proxy → implementation ${impl}` : beacon ? `Beacon proxy → beacon ${beacon}` : `Minimal proxy → ${minimal}`;
    flags.push("proxy");
  } else if (!proxyKnown) {
    tone = "unknown";
    proxyValue = "Not known: storage slots did not answer";
  }
  rows.push({ key: "proxy", label: "Upgradeable proxy", value: proxyValue, tone, source: src("eth_getStorageAt (ERC-1967 implementation / admin / beacon slots)") });
  if (admin) rows.push({ key: "proxyAdmin", label: "Proxy admin", value: admin, tone: "warn", source: src("eth_getStorageAt (ERC-1967 admin slot)"), address: admin });
  if (beacon && beacon === STOCK_BEACON) {
    rows.push({
      key: "stock",
      label: "Stock-token beacon",
      value: "Points at the beacon Robinhood stock tokens use. This alone does not prove which share the token tracks; the issuer can pause, block and burn.",
      tone: "info",
      source: src("ERC-1967 beacon slot", beacon),
    });
    flags.push("stock-beacon");
  }

  // Owner + powers from bytecode (and the implementation behind a proxy).
  const owner = addrOf(ok(r[8]));
  rows.push({
    key: "owner",
    label: "owner()",
    value: owner === null ? "Not known: owner() is absent or reverted" : owner === ZERO ? "Renounced (zero address)" : owner,
    tone: owner === null ? "unknown" : owner === ZERO ? "ok" : "warn",
    source: src("owner()"),
    address: owner && owner !== ZERO ? owner : undefined,
  });
  const codes = [code];
  let implNote = "";
  const target = beacon ? null : impl ?? minimal;
  if (target) {
    const ic = await rpc<string>("eth_getCode", [target, tag]).catch(() => null);
    if (ic && ic.length > 2) codes.push(ic);
    else implNote = " (implementation code could not be read: powers behind the proxy are Not known)";
  } else if (beacon) {
    implNote = " (beacon proxy: the implementation is chosen by the beacon, not scanned)";
  }
  const powers = findPowers(codes);
  for (const [key, p] of Object.entries(POWERS)) {
    const hit = powers[key];
    rows.push({
      key: `power-${key}`,
      label: p.label,
      value: hit ? `Selector found: ${hit.join(", ")}` : `No known selector${implNote}`,
      tone: hit ? (key === "owner" ? "warn" : "risk") : implNote ? "unknown" : "ok",
      source: src(`PUSH4 scan of runtime code${target ? " + implementation" : ""}`),
    });
    if (hit && key !== "owner") flags.push(`power-${key}`);
  }

  // Launch + pools.
  const launch = ok(r[9]);
  const exists = launch && launch.length >= 2 + 64 * 15 ? BigInt(`0x${launch.slice(2 + 64 * 14, 2 + 64 * 15)}`) !== 0n : false;
  rows.push({
    key: "pons",
    label: "Pons launch",
    value: launch === null ? "Not known: the Pons factory did not answer" : exists ? `Launched through Pons (phase ${Number(BigInt(`0x${launch.slice(2 + 64 * 10, 2 + 64 * 11)}`))})` : "Not a Pons launch",
    tone: launch === null ? "unknown" : "info",
    source: src("getLaunchedToken(token)", PONS.factory),
  });
  const pools: { pool: string; pair: string; fee: number }[] = [];
  poolCalls.forEach((x, k) => {
    const a = addrOf(ok(r[10 + k]));
    if (a && a !== ZERO) pools.push({ pool: a, pair: x.p, fee: x.fee });
  });
  const poolUnknown = poolCalls.some((_, k) => r[10 + k].kind !== "ok");
  if (pools.length) {
    const bal = await rpcBatchAnswers(
      pools.flatMap((p) => [
        call(token, encodeFunctionData({ abi: ERC20, functionName: "balanceOf", args: [getAddress(p.pool)] }), tag),
        call(p.pair, encodeFunctionData({ abi: ERC20, functionName: "balanceOf", args: [getAddress(p.pool)] }), tag),
      ]),
    ).catch(() => [] as BatchAnswer[]);
    pools.forEach((p, k) => {
      const t = uintOf(ok(bal[2 * k]));
      const q = uintOf(ok(bal[2 * k + 1]));
      const pairSym = p.pair === WETH ? "WETH" : "USDG";
      const pairDec = p.pair === WETH ? 18 : 6;
      rows.push({
        key: `pool-${p.pool}`,
        label: `Uniswap v3 pool ${symbol ?? "token"}/${pairSym} ${p.fee / 10_000}%`,
        value: q === null ? "Pool found; depth Not known" : `${pairSym} in pool: ${(Number(q) / 10 ** pairDec).toLocaleString("en-US", { maximumFractionDigits: 4 })}${t !== null && decimals !== null ? ` · token in pool: ${(Number(t) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}`,
        tone: "info",
        source: src("factory.getPool + balanceOf(pool)", p.pool),
        address: p.pool,
      });
    });
  } else {
    rows.push({
      key: "pools",
      label: "Uniswap v3 pools vs WETH / USDG",
      value: poolUnknown ? "Not known: the factory did not answer" : "None found at the four fee tiers",
      tone: poolUnknown ? "unknown" : "warn",
      source: src("getPool(token, WETH|USDG, 100|500|3000|10000)", UNISWAP_V3.factory),
    });
    if (!poolUnknown) flags.push("no-v3-pool");
  }
  return { token, block, checkedAt: at, name, symbol, decimals, rows, flags };
}
