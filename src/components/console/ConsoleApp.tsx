"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { encodeFunctionData, getAddress } from "viem";
import { CHAIN, explorerTx, isAddress, shortAddress } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { KNOWN_TOKENS, UNISWAP_V3, V3_FEES, VERIFIED_ROUTERS } from "@/config/dex";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { LiveBadge, SampleBadge, StatusBadge } from "@/components/site/PageHead";
import { TokenCheckView } from "@/components/console/TokenCheckView";
import { ERC20_ABI, ERC20_WRITE_ABI, GUARD_ABI } from "@/lib/abi";
import { explain, read, readMany, simulate, waitForReceipt } from "@/lib/client";
import { BIT_WORDS, bitNames, KNOWN_MASK } from "@/lib/mandate/bits";
import { apply, dayOf, evaluate, remainingToday, ruleOf, untilReset, type MandateModel, type OwnerWallet, type Proposal, type UsageState } from "@/lib/mandate/engine";
import {
  KEYS,
  SAMPLE,
  fmt,
  fromUsage,
  labelBytes,
  safeUnits,
  sampleMandate,
  sampleWallet,
  toModel,
  toUsage,
  type LogEntry,
  type StoredMandate,
  type StoredUsage,
} from "@/lib/mandate/practice";
import type { Activity, MandateView } from "@/lib/server/activity";

type Mode = "practice" | "chain";
type Draft = { kind: "transfer" | "swap"; caller: string; token: string; to: string; amount: string; tokenOut: string; fee: number; minOut: string; router: string };

const nowSec = () => Math.floor(Date.now() / 1000);
const lc = (a: string) => a.toLowerCase();
const symbolOf = (m: MandateModel, t: string) => ruleOf(m, t)?.symbol ?? KNOWN_TOKENS.find((k) => k.address === lc(t))?.symbol ?? shortAddress(t);
const decimalsOf = (m: MandateModel, t: string) => ruleOf(m, t)?.decimals ?? KNOWN_TOKENS.find((k) => k.address === lc(t))?.decimals ?? 18;

function chainModel(v: MandateView, decimals: Record<string, { symbol: string; decimals: number }>): MandateModel {
  return {
    id: v.id,
    owner: v.owner,
    agent: v.agent,
    validFrom: v.validFrom,
    expiry: v.expiry,
    maxActionsPerDay: v.maxActionsPerDay,
    paused: v.paused,
    revoked: v.revoked,
    label: v.label,
    tokens: v.tokens.map((t) => ({ token: t.token, symbol: decimals[t.token]?.symbol ?? shortAddress(t.token), decimals: decimals[t.token]?.decimals ?? 18, perTxCap: BigInt(t.perTxCap), dailyCap: BigInt(t.dailyCap), listed: t.listed })),
    recipients: v.recipients,
    routers: v.routers,
  };
}

const noop = () => () => {};
/** The console depends on the clock and on browser storage: it renders after hydration only, so server HTML never disagrees. */
export function ConsoleApp() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted)
    return (
      <div className="panel panel-b" data-testid="console-loading">
        <p className="small">Loading the console…</p>
      </div>
    );
  return <ConsoleInner />;
}

function ConsoleInner() {
  const wallet = useWallet();
  const { open } = useWalletModal();
  const [mode, setMode] = useState<Mode>("practice");
  const [stored, setStored] = useLocalStore<StoredMandate | null>(KEYS.mandate, null);
  const [usageRaw, setUsageRaw] = useLocalStore<StoredUsage | null>(KEYS.usage, null);
  const [offset, setOffset] = useLocalStore<number>(KEYS.clock, 0);
  const [, setLog] = useLocalStore<LogEntry[]>(KEYS.log, []);
  const [sample] = useState(() => sampleMandate());
  const draftMandate = stored ?? sample;
  const practice = useMemo(() => toModel(draftMandate), [draftMandate]);
  const practiceUsage = useMemo(() => toUsage(usageRaw), [usageRaw]);
  const [tick, setTick] = useState(nowSec());
  useEffect(() => {
    const t = setInterval(() => setTick(nowSec()), 15_000);
    return () => clearInterval(t);
  }, []);
  const practiceNow = tick + (offset ?? 0);

  // ---- chain mode: mandates of the connected wallet (as owner or as agent) ----
  const [activity, setActivity] = useState<Activity | null>(null);
  const [chainErr, setChainErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tokenMeta, setTokenMeta] = useState<Record<string, { symbol: string; decimals: number }>>({});
  const [ownerWallet, setOwnerWallet] = useState<OwnerWallet>({});
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (mode !== "chain" || !wallet.address || !guardLive()) return;
    let dead = false;
    (async () => {
      try {
        const [o, a] = await Promise.all(
          [`owner=${wallet.address}`, `agent=${wallet.address}`].map(async (q) => {
            const r = await fetch(`/api/activity?${q}${reload ? "&fresh=1" : ""}`, { cache: "no-store" });
            const b = (await r.json()) as Activity & { error?: string };
            if (!r.ok) throw new Error(b.error ?? "Activity failed.");
            return b;
          }),
        );
        if (dead) return;
        const all = [...o.mandates, ...a.mandates.filter((m) => !o.mandates.some((x) => x.id === m.id))];
        setActivity({ ...o, mandates: all });
        setChainErr(null);
        const tokens = [...new Set(all.flatMap((m) => m.tokens.map((t) => t.token)))];
        const meta = await readMany(tokens.flatMap((t) => [{ to: t, abi: ERC20_ABI, fn: "symbol" }, { to: t, abi: ERC20_ABI, fn: "decimals" }]));
        if (dead) return;
        setTokenMeta(Object.fromEntries(tokens.map((t, k) => [t, { symbol: (meta[2 * k] as string) ?? shortAddress(t), decimals: Number(meta[2 * k + 1] ?? 18) }])));
        // 0 = drafting a new mandate; null = pick the newest.
        setSelected((s) => (s === 0 ? 0 : s && all.some((m) => m.id === s) ? s : (all.at(-1)?.id ?? null)));
      } catch (e) {
        if (!dead) setChainErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      dead = true;
    };
  }, [mode, wallet.address, reload]);
  const view = activity?.mandates.find((m) => m.id === selected) ?? null;
  const chainM = useMemo(() => (view ? chainModel(view, tokenMeta) : null), [view, tokenMeta]);
  const chainUsage: UsageState = useMemo(() => {
    const today = dayOf(nowSec());
    return {
      spent: Object.fromEntries((view?.tokens ?? []).map((t) => [t.token, { day: today, spent: BigInt(t.spentToday) }])),
      count: { day: today, count: view?.actionsToday ?? 0 },
      actions: view?.actions ?? 0,
    };
  }, [view]);
  useEffect(() => {
    if (!view || !guardLive()) return;
    let dead = false;
    readMany(view.tokens.flatMap((t) => [{ to: t.token, abi: ERC20_ABI, fn: "balanceOf", args: [view.owner] }, { to: t.token, abi: ERC20_WRITE_ABI, fn: "allowance", args: [view.owner, CONTRACTS.guard] }])).then((r) => {
      if (dead) return;
      setOwnerWallet(Object.fromEntries(view.tokens.map((t, k) => [t.token, r[2 * k] === null || r[2 * k + 1] === null ? null : { balance: r[2 * k] as bigint, allowance: r[2 * k + 1] as bigint }])));
    });
    return () => {
      dead = true;
    };
  }, [view, reload]);

  const m = mode === "practice" ? practice : chainM;
  const usage = mode === "practice" ? practiceUsage : chainUsage;
  const w = mode === "practice" ? sampleWallet() : ownerWallet;
  const now = mode === "practice" ? practiceNow : nowSec();

  // ---- proposal ----
  const [d, setD] = useState<Draft>({ kind: "transfer", caller: SAMPLE.agent, token: KNOWN_TOKENS[0].address, to: SAMPLE.supplier, amount: "140", tokenOut: KNOWN_TOKENS[0].address, fee: 100, minOut: "1", router: UNISWAP_V3.swapRouter02 });
  // When the mandate in view changes (mode switch, another on-chain mandate), start the proposal from its agent and first rule.
  const mandateKey = `${mode}:${chainM?.id ?? 0}:${mode === "practice" ? practice.agent : chainM?.agent ?? ""}`;
  const [seenKey, setSeenKey] = useState(mandateKey);
  if (seenKey !== mandateKey) {
    setSeenKey(mandateKey);
    if (mode === "chain" && chainM) setD((x) => ({ ...x, caller: chainM.agent, to: chainM.recipients[0] ?? x.to, token: chainM.tokens[0]?.token ?? x.token }));
    if (mode === "practice") setD((x) => ({ ...x, caller: practice.agent }));
  }
  const proposal: Proposal | null = useMemo(() => {
    if (!m) return null;
    const amt = safeUnits(d.amount, decimalsOf(m, d.token));
    if (amt === null || !isAddress(d.caller) || !isAddress(d.token)) return null;
    if (d.kind === "transfer") return isAddress(d.to) ? { kind: "transfer", caller: d.caller, token: d.token, to: d.to, amount: amt } : null;
    const min = safeUnits(d.minOut, decimalsOf(m, d.tokenOut));
    if (min === null || !isAddress(d.tokenOut) || !isAddress(d.router)) return null;
    return { kind: "swap", caller: d.caller, router: d.router, tokenIn: d.token, tokenOut: d.tokenOut, fee: d.fee, amountIn: amt, minOut: min };
  }, [m, d]);
  const localBits = m && proposal ? evaluate(m, usage, w, proposal, now) : null;

  // The guard's answer belongs to one exact proposal; any edit makes it stale.
  const proposalKey = `${mode}:${selected}:${JSON.stringify(d)}`;
  const [contractAnswer, setContractAnswer] = useState<{ key: string; bits: bigint } | null>(null);
  const contractBits = contractAnswer && contractAnswer.key === proposalKey ? contractAnswer.bits : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  function summary(p: Proposal) {
    if (!m) return "";
    return p.kind === "transfer"
      ? `Pay ${fmt(p.amount, decimalsOf(m, p.token))} ${symbolOf(m, p.token)} to ${shortAddress(p.to)}`
      : `Swap ${fmt(p.amountIn, decimalsOf(m, p.tokenIn))} ${symbolOf(m, p.tokenIn)} → ${symbolOf(m, p.tokenOut)} (min ${fmt(p.minOut, decimalsOf(m, p.tokenOut))})`;
  }
  function logIt(bits: bigint, result: LogEntry["result"], tx?: string) {
    if (!m || !proposal) return;
    const e: LogEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: nowSec(), mode, mandateId: m.id, kind: proposal.kind, summary: summary(proposal), bits: bits.toString(), result, tx };
    setLog((l) => [e, ...(l ?? [])].slice(0, 200));
  }

  async function runCheck() {
    if (!m || !proposal || localBits === null) return;
    setMsg(null);
    if (mode === "practice") {
      logIt(localBits, localBits === 0n ? "checked" : "rejected");
      return;
    }
    setBusy("check");
    try {
      const args =
        proposal.kind === "transfer"
          ? [BigInt(m.id), getAddress(proposal.caller), getAddress(proposal.token), getAddress(proposal.to), proposal.amount]
          : [BigInt(m.id), getAddress(proposal.caller), { router: getAddress(proposal.router), tokenIn: getAddress(proposal.tokenIn), tokenOut: getAddress(proposal.tokenOut), fee: proposal.fee, amountIn: proposal.amountIn, minOut: proposal.minOut, ref: labelBytes("check") }];
      const bits = await read<bigint>({ to: CONTRACTS.guard, abi: GUARD_ABI, fn: proposal.kind === "transfer" ? "checkTransfer" : "checkSwap", args });
      setContractAnswer({ key: proposalKey, bits });
      logIt(bits, bits === 0n ? "checked" : "rejected");
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(null);
    }
  }

  async function execute() {
    if (!m || !proposal || localBits === null) return;
    setMsg(null);
    if (mode === "practice") {
      if (localBits !== 0n) {
        logIt(localBits, "rejected");
        setMsg("Rejected: the guard would revert with these reasons. Nothing moved.");
        return;
      }
      const next = apply(m, usage, w, proposal, now);
      setUsageRaw(fromUsage(next));
      logIt(0n, "executed");
      setMsg(`Executed in practice: action #${next.actions}. Nothing was sent; the sample wallet and caps were updated.`);
      return;
    }
    if (!wallet.address) return open();
    if (!wallet.onChain) return wallet.switchNetwork();
    if (lc(wallet.address) !== lc(m.agent)) {
      setMsg(`Only the agent ${shortAddress(m.agent)} can execute. Connect that key, or run examples/agent.mjs with it.`);
      return;
    }
    setBusy("execute");
    try {
      const ref = labelBytes(`console-${Date.now()}`);
      const data =
        proposal.kind === "transfer"
          ? encodeFunctionData({ abi: GUARD_ABI, functionName: "executeTransfer", args: [BigInt(m.id), getAddress(proposal.token), getAddress(proposal.to), proposal.amount, ref] })
          : encodeFunctionData({
              abi: GUARD_ABI,
              functionName: "executeSwapV3",
              args: [BigInt(m.id), { router: getAddress(proposal.router), tokenIn: getAddress(proposal.tokenIn), tokenOut: getAddress(proposal.tokenOut), fee: proposal.fee, amountIn: proposal.amountIn, minOut: proposal.minOut, ref }],
            });
      await simulate(wallet.address, CONTRACTS.guard, data);
      const hash = await wallet.sendTransaction({ to: CONTRACTS.guard, data });
      setLastTx(hash);
      const rc = await waitForReceipt(hash);
      if (!rc.ok) throw new Error("The transaction reverted.");
      logIt(0n, "executed", hash);
      setMsg("Executed on chain.");
      setReload((x) => x + 1);
    } catch (e) {
      const text = explain(e);
      setMsg(text);
      if (/rejected it/i.test(text) && localBits !== null) logIt(localBits, "rejected");
    } finally {
      setBusy(null);
    }
  }

  const bits = mode === "chain" && contractBits !== null ? contractBits : localBits;
  const unknownBits = bits !== null && (bits & ~KNOWN_MASK) !== 0n;
  const names = bits !== null ? bitNames(bits) : [];
  const setPreset = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label="Mode">
          <button type="button" aria-pressed={mode === "practice"} onClick={() => setMode("practice")} data-testid="mode-practice">
            Practice
          </button>
          <button type="button" aria-pressed={mode === "chain"} onClick={() => setMode("chain")} data-testid="mode-chain">
            On chain
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "practice" ? <SampleBadge label="Sample data · nothing is sent" /> : <LiveBadge label={`${CHAIN.name} · chain ${CHAIN.id}`} />}
          <StatusBadge status="Prototype" />
        </div>
      </div>

      {mode === "chain" ? <ChainBar activity={activity} error={chainErr} selected={selected} onSelect={setSelected} onReload={() => setReload((x) => x + 1)} /> : null}
      {mode === "chain" && guardLive() && wallet.address && selected === 0 ? (
        <p className="note" data-testid="drafting">
          Drafting a new mandate: edit it below, then create it on chain. You become its owner.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <MandateEditor
          mode={mode}
          stored={draftMandate}
          onChange={(next) => setStored(next)}
          onReset={() => {
            setStored(null);
            setUsageRaw(null);
            setOffset(0);
          }}
          chainModel={chainM}
          usage={usage}
          now={now}
          onCreated={(fresh) => {
            if (fresh) setSelected(null);
            setReload((x) => x + 1);
          }}
          onNextDay={() => setOffset((o) => (o ?? 0) + untilReset(practiceNow) + 60)}
        />

        <div className="grid min-w-0 content-start gap-6">
          <div className="panel" data-testid="proposal">
            <div className="panel-h">
              <span className="eyebrow">Agent proposal</span>
              <div className="seg" role="group" aria-label="Kind">
                <button type="button" aria-pressed={d.kind === "transfer"} onClick={() => setPreset({ kind: "transfer" })}>
                  Pay
                </button>
                <button type="button" aria-pressed={d.kind === "swap"} onClick={() => setPreset({ kind: "swap", token: KNOWN_TOKENS[1].address, tokenOut: KNOWN_TOKENS[0].address, amount: "0.02", minOut: "1" })} data-testid="kind-swap">
                  Swap
                </button>
              </div>
            </div>
            <div className="panel-b grid gap-4">
              {mode === "practice" ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="chip" onClick={() => setPreset({ kind: "transfer", caller: practice.agent, token: KNOWN_TOKENS[0].address, to: SAMPLE.supplier, amount: "140" })} data-testid="preset-over">
                    Over the cap
                  </button>
                  <button type="button" className="chip" onClick={() => setPreset({ kind: "transfer", caller: practice.agent, token: KNOWN_TOKENS[0].address, to: SAMPLE.stranger, amount: "20" })}>
                    Unknown recipient
                  </button>
                  <button type="button" className="chip" onClick={() => setPreset({ kind: "transfer", caller: SAMPLE.stranger, token: KNOWN_TOKENS[0].address, to: SAMPLE.supplier, amount: "20" })}>
                    Not the agent
                  </button>
                  <button type="button" className="chip" onClick={() => setPreset({ kind: "transfer", caller: practice.agent, token: KNOWN_TOKENS[0].address, to: SAMPLE.supplier, amount: "90" })} data-testid="preset-ok">
                    Inside the limits
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="field">
                  <span>Sent by (caller)</span>
                  <input className="inp" value={d.caller} onChange={(e) => setPreset({ caller: e.target.value.trim() })} spellCheck={false} data-testid="p-caller" />
                </label>
                <label className="field">
                  <span>{d.kind === "transfer" ? "Token" : "Sell token"}</span>
                  <TokenSelect value={d.token} m={m} onChange={(v) => setPreset({ token: v })} testid="p-token" />
                </label>
                {d.kind === "transfer" ? (
                  <label className="field sm:col-span-2">
                    <span>Recipient</span>
                    <input className="inp" value={d.to} onChange={(e) => setPreset({ to: e.target.value.trim() })} spellCheck={false} data-testid="p-to" />
                  </label>
                ) : (
                  <>
                    <label className="field">
                      <span>Buy token (output goes to the owner)</span>
                      <TokenSelect value={d.tokenOut} m={m} onChange={(v) => setPreset({ tokenOut: v })} testid="p-tokenout" />
                    </label>
                    <label className="field">
                      <span>Router</span>
                      <select className="inp" value={d.router} onChange={(e) => setPreset({ router: e.target.value })}>
                        {VERIFIED_ROUTERS.map((r) => (
                          <option key={r.address} value={r.address}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Pool fee tier</span>
                      <select className="inp" value={d.fee} onChange={(e) => setPreset({ fee: Number(e.target.value) })}>
                        {V3_FEES.map((f) => (
                          <option key={f} value={f}>
                            {f / 10_000}%
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Minimum output ({m ? symbolOf(m, d.tokenOut) : ""})</span>
                      <input className="inp" value={d.minOut} onChange={(e) => setPreset({ minOut: e.target.value })} inputMode="decimal" />
                    </label>
                  </>
                )}
                <label className="field">
                  <span>Amount ({m ? symbolOf(m, d.token) : ""})</span>
                  <input className="inp" value={d.amount} onChange={(e) => setPreset({ amount: e.target.value })} inputMode="decimal" data-testid="p-amount" />
                </label>
              </div>
              {!proposal ? <p className="small text-[var(--amber)]">Fill in valid addresses and a plain number to check.</p> : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-line btn-sm" disabled={!proposal || busy !== null || (mode === "chain" && !chainM)} onClick={runCheck} data-testid="run-check">
                  {busy === "check" ? "Asking the guard…" : mode === "chain" ? "Check with the guard" : "Check"}
                </button>
                <button type="button" className="btn btn-blue btn-sm" disabled={!proposal || busy !== null || (mode === "chain" && !chainM)} onClick={execute} data-testid="run-execute">
                  <span className="gl">{busy === "execute" ? "Confirm in wallet…" : mode === "practice" ? "Execute (practice)" : "Execute as agent"}</span>
                </button>
              </div>
              {msg ? (
                <p className="rq-alert !bg-[var(--deep)] !text-[var(--ink)]" role="status" data-testid="console-msg">
                  {msg}
                  {lastTx && mode === "chain" ? (
                    <>
                      {" "}
                      <a className="underline" href={explorerTx(lastTx)} target="_blank" rel="noreferrer">
                        View the transaction
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          {bits !== null ? (
            <div className={`verdict ${bits === 0n ? "pass" : "fail"}`} data-testid="verdict" data-bits={bits.toString()}>
              <p className="eyebrow !text-current">{mode === "chain" && contractBits !== null ? "Answer from DeleqMandateGuard.check view" : "Mandate check (same rules as the guard)"}</p>
              <p className="display mt-2 text-[26px] tracking-[-0.02em]" data-testid="verdict-title">
                {bits === 0n ? "Inside the mandate" : `Rejected · ${names.length} reason${names.length === 1 ? "" : "s"}`}
              </p>
              {names.length ? (
                <ul className="mt-3 grid gap-2">
                  {names.map((n) => (
                    <li key={n} className="flex flex-wrap items-baseline gap-2 text-[13.6px]">
                      <span className="chip bad">{BIT_WORDS[n].label}</span>
                      <span className="text-[var(--muted)]">{BIT_WORDS[n].why}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small mt-2">Every rule passed. The guard would execute it now; the token itself can still refuse (a blocked address, for example).</p>
              )}
              {unknownBits ? <p className="rq-alert mt-3">The contract set a bit this site does not know. Do not trust this answer.</p> : null}
              {mode === "chain" && contractBits !== null && localBits !== null ? (
                <p className="mt-3 font-mono text-[11px] text-[var(--faint)]" data-testid="parity">
                  contract bits {contractBits.toString()} · site engine bits {localBits.toString()} · {contractBits === localBits ? "match" : "differ (balances may have changed)"}
                </p>
              ) : (
                <p className="mt-3 font-mono text-[11px] text-[var(--faint)]">bits {bits.toString()} · checked {new Date(now * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              )}
            </div>
          ) : null}

          <TokenCheckView token={d.token} />
        </div>
      </div>
    </div>
  );
}

function TokenSelect({ value, m, onChange, testid }: { value: string; m: MandateModel | null; onChange: (v: string) => void; testid: string }) {
  const options = [...(m?.tokens ?? []).map((t) => ({ address: lc(t.token), symbol: t.symbol })), ...KNOWN_TOKENS.map((k) => ({ address: k.address, symbol: k.symbol }))].filter((o, i, all) => all.findIndex((x) => x.address === o.address) === i);
  const custom = !options.some((o) => o.address === lc(value));
  return (
    <div className="grid gap-2">
      <select className="inp" value={custom ? "custom" : lc(value)} onChange={(e) => onChange(e.target.value === "custom" ? "" : e.target.value)} data-testid={testid}>
        {options.map((o) => (
          <option key={o.address} value={o.address}>
            {o.symbol} · {shortAddress(o.address)}
          </option>
        ))}
        <option value="custom">Other token address…</option>
      </select>
      {custom ? <input className="inp" placeholder="0x…" value={value} onChange={(e) => onChange(e.target.value.trim())} spellCheck={false} /> : null}
    </div>
  );
}

function ChainBar({ activity, error, selected, onSelect, onReload }: { activity: Activity | null; error: string | null; selected: number | null; onSelect: (id: number) => void; onReload: () => void }) {
  const wallet = useWallet();
  const { open } = useWalletModal();
  if (!guardLive())
    return (
      <div className="note" data-testid="guard-missing">
        DeleqMandateGuard is not deployed on {CHAIN.name} yet, so on-chain mandates cannot be created here. Practice mode runs the same rules on sample data. The owner deploys the
        guard from a local-only tool; then this tab turns on. See <Link className="underline" href="/method#contract">the contract</Link>.
      </div>
    );
  if (!wallet.address)
    return (
      <div className="note">
        Connect the owner wallet (or the agent wallet) to load its mandates.{" "}
        <button type="button" className="underline" onClick={open}>
          Connect wallet
        </button>
      </div>
    );
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="eyebrow">Your mandates on chain</span>
        <span className="flex gap-2">
          <button type="button" className={`chip ${selected === 0 ? "good" : ""}`} onClick={() => onSelect(0)} data-testid="new-mandate">
            + New mandate
          </button>
          <button type="button" className="chip" onClick={onReload}>
            Reload
          </button>
        </span>
      </div>
      <div className="panel-b">
        {error ? <p className="rq-alert">{error}</p> : null}
        {!activity ? <p className="small">Reading the guard…</p> : null}
        {activity && activity.mandates.length === 0 ? <p className="small">No mandate for {shortAddress(wallet.address)} yet. Create one with the editor below.</p> : null}
        <div className="chips">
          {activity?.mandates.map((m) => (
            <button key={m.id} type="button" className={`chip ${m.id === selected ? "good" : ""}`} onClick={() => onSelect(m.id)} data-testid={`mandate-${m.id}`}>
              #{m.id} {m.label || "mandate"} · agent {shortAddress(m.agent)} {m.revoked ? "· revoked" : m.paused ? "· paused" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MandateEditor({
  mode,
  stored,
  onChange,
  onReset,
  chainModel: cm,
  usage,
  now,
  onCreated,
  onNextDay,
}: {
  mode: Mode;
  stored: StoredMandate;
  onChange: (m: StoredMandate) => void;
  onReset: () => void;
  chainModel: MandateModel | null;
  usage: UsageState;
  now: number;
  onCreated: (fresh: boolean) => void;
  onNextDay: () => void;
}) {
  const wallet = useWallet();
  const { open } = useWalletModal();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState("");
  const [newToken, setNewToken] = useState("");
  const [days, setDays] = useState("30");
  const set = (p: Partial<StoredMandate>) => onChange({ ...stored, ...p });
  const shown = mode === "chain" && cm ? cm : toModel(stored);
  // The draft is editable in Practice, and in On chain while no existing mandate is selected ("+ New mandate").
  const editable = !(mode === "chain" && cm);

  async function addToken() {
    if (!isAddress(newToken) || stored.tokens.some((t) => lc(t.token) === lc(newToken))) return;
    const [sym, dec] = await readMany([
      { to: newToken, abi: ERC20_ABI, fn: "symbol" },
      { to: newToken, abi: ERC20_ABI, fn: "decimals" },
    ]).catch(() => [null, null]);
    set({ tokens: [...stored.tokens, { token: lc(newToken), symbol: (sym as string) ?? shortAddress(newToken), decimals: Number(dec ?? 18), perTx: "0", daily: "0", listed: true }] });
    setNewToken("");
  }

  async function createOnChain() {
    if (!wallet.address) return open();
    if (!wallet.onChain) return wallet.switchNetwork();
    if (!isAddress(stored.agent)) return setMsg("Set the agent address first.");
    setBusy("create");
    setMsg(null);
    try {
      const t = Math.floor(Date.now() / 1000);
      const span = Math.max(1, Math.min(730, Number(days) || 30));
      const tokens = stored.tokens
        .filter((x) => x.listed)
        .map((x) => ({ token: getAddress(x.token), perTxCap: safeUnits(x.perTx, x.decimals) ?? 0n, dailyCap: safeUnits(x.daily, x.decimals) ?? 0n }));
      const data = encodeFunctionData({
        abi: GUARD_ABI,
        functionName: "createMandate",
        args: [{ agent: getAddress(stored.agent), validFrom: 0n, expiry: BigInt(t + span * 86400), maxActionsPerDay: stored.maxActionsPerDay, label: labelBytes(stored.label || "mandate"), tokens, recipients: stored.recipients.filter(isAddress).map((a) => getAddress(a)), routers: stored.routers.filter(isAddress).map((a) => getAddress(a)) }],
      });
      await simulate(wallet.address, CONTRACTS.guard, data);
      const hash = await wallet.sendTransaction({ to: CONTRACTS.guard, data });
      setMsg(`Sent ${shortAddress(hash, 10, 6)}. Waiting for the block…`);
      const rc = await waitForReceipt(hash);
      if (!rc.ok) throw new Error("The transaction reverted.");
      setMsg("Mandate created. Next: approve the guard for each token (below) so it can move them from your wallet.");
      onCreated(true);
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(null);
    }
  }

  async function approve(token: string, decimals: number, amount: string) {
    if (!wallet.address) return open();
    if (!wallet.onChain) return wallet.switchNetwork();
    const raw = safeUnits(amount, decimals);
    if (raw === null) return setMsg("Approval amount must be a plain number.");
    setBusy(`approve-${token}`);
    setMsg(null);
    try {
      const hash = await wallet.sendTransaction({ to: token, data: encodeFunctionData({ abi: ERC20_WRITE_ABI, functionName: "approve", args: [getAddress(CONTRACTS.guard), raw] }) });
      const rc = await waitForReceipt(hash);
      setMsg(rc.ok ? `Approved ${amount} for the guard.` : "The approval reverted.");
      onCreated(false);
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel min-w-0" data-testid="mandate-editor">
      <div className="panel-h">
        <span className="eyebrow">{mode === "chain" && cm ? `Mandate #${cm.id} on chain` : "Mandate"}</span>
        <span className="flex flex-wrap gap-2">
          {mode === "practice" ? (
            <>
              <button type="button" className="chip" onClick={onNextDay} data-testid="next-day">
                Jump to next UTC day
              </button>
              <button type="button" className="chip" onClick={onReset}>
                Reset sample
              </button>
            </>
          ) : null}
        </span>
      </div>
      <div className="panel-b grid gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span>Agent address (the key that may act)</span>
            <input className="inp" value={mode === "chain" && cm ? cm.agent : stored.agent} readOnly={mode === "chain" && Boolean(cm)} onChange={(e) => set({ agent: e.target.value.trim() })} spellCheck={false} data-testid="m-agent" />
          </label>
          <label className="field">
            <span>Label</span>
            <input className="inp" value={mode === "chain" && cm ? cm.label : stored.label} readOnly={mode === "chain" && Boolean(cm)} onChange={(e) => set({ label: e.target.value.slice(0, 31) })} />
          </label>
          <label className="field">
            <span>Actions per UTC day (0 = no limit)</span>
            <input className="inp" value={String(mode === "chain" && cm ? cm.maxActionsPerDay : stored.maxActionsPerDay)} readOnly={mode === "chain" && Boolean(cm)} onChange={(e) => set({ maxActionsPerDay: Math.max(0, Math.min(10_000, Number(e.target.value.replace(/\D/g, "")) || 0)) })} inputMode="numeric" />
          </label>
          {mode === "practice" || !cm ? (
            <label className="field">
              <span>Valid for (days, max 730)</span>
              <input className="inp" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
            </label>
          ) : (
            <p className="small sm:col-span-2">
              Valid {new Date(cm.validFrom * 1000).toISOString().slice(0, 10)} → {new Date(cm.expiry * 1000).toISOString().slice(0, 10)} · {cm.revoked ? "revoked" : cm.paused ? "paused" : "active"}
            </p>
          )}
        </div>

        <div>
          <p className="field">
            <span>Tokens the agent may spend · caps reset 00:00 UTC (in {Math.floor(untilReset(now) / 3600)} h)</span>
          </p>
          <div className="mt-2 grid gap-3">
            {shown.tokens.map((t, k) => {
              const left = remainingToday(shown, usage, t.token, now);
              const used = t.dailyCap > 0n ? Number(((t.dailyCap - left) * 1000n) / t.dailyCap) / 10 : 0;
              const st = stored.tokens[k];
              return (
                <div key={t.token} className="border border-[var(--line)] p-3" data-testid={`rule-${t.symbol}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {t.symbol} <span className="font-mono text-[11px] font-normal text-[var(--faint)]">{shortAddress(t.token)}</span>
                    </span>
                    {editable ? (
                      <button type="button" className="chip" onClick={() => set({ tokens: stored.tokens.filter((_, i) => i !== k) })}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="field">
                      <span>Per transaction</span>
                      <input className="inp" value={mode === "chain" && cm ? fmt(t.perTxCap, t.decimals, 6) : st?.perTx ?? ""} readOnly={mode === "chain" && Boolean(cm)} onChange={(e) => set({ tokens: stored.tokens.map((x, i) => (i === k ? { ...x, perTx: e.target.value } : x)) })} inputMode="decimal" data-testid={`cap-pertx-${t.symbol}`} />
                    </label>
                    <label className="field">
                      <span>Per UTC day</span>
                      <input className="inp" value={mode === "chain" && cm ? fmt(t.dailyCap, t.decimals, 6) : st?.daily ?? ""} readOnly={mode === "chain" && Boolean(cm)} onChange={(e) => set({ tokens: stored.tokens.map((x, i) => (i === k ? { ...x, daily: e.target.value } : x)) })} inputMode="decimal" data-testid={`cap-daily-${t.symbol}`} />
                    </label>
                  </div>
                  <div className="mt-3">
                    <div className="meter" aria-hidden="true">
                      <i className={left === 0n && t.dailyCap > 0n ? "full" : ""} style={{ width: `${Math.min(100, used)}%` }} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-[var(--muted)]" data-testid={`left-${t.symbol}`}>
                      {fmt(left, t.decimals)} of {fmt(t.dailyCap, t.decimals)} {t.symbol} left today
                    </p>
                  </div>
                  {mode === "chain" && cm ? <ApproveRow token={t.token} decimals={t.decimals} symbol={t.symbol} busy={busy === `approve-${t.token}`} onApprove={approve} owner={cm.owner} /> : null}
                </div>
              );
            })}
          </div>
          {editable ? (
            <div className="mt-3 flex gap-2">
              <input className="inp" placeholder="Add a token address 0x…" value={newToken} onChange={(e) => setNewToken(e.target.value.trim())} spellCheck={false} />
              <button type="button" className="btn btn-line btn-sm" onClick={addToken} disabled={!isAddress(newToken)}>
                Add
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <p className="field">
            <span>Recipients the agent may pay</span>
          </p>
          <div className="chips mt-2">
            {shown.recipients.map((r) => (
              <span key={r} className="chip">
                {shortAddress(r, 8, 6)}
                {editable ? (
                  <button type="button" aria-label={`Remove ${r}`} onClick={() => set({ recipients: stored.recipients.filter((x) => x !== r) })}>
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          {editable ? (
            <div className="mt-3 flex gap-2">
              <input className="inp" placeholder="0x… recipient" value={newRecipient} onChange={(e) => setNewRecipient(e.target.value.trim())} spellCheck={false} />
              <button
                type="button"
                className="btn btn-line btn-sm"
                disabled={!isAddress(newRecipient)}
                onClick={() => {
                  if (!stored.recipients.some((x) => lc(x) === lc(newRecipient))) set({ recipients: [...stored.recipients, lc(newRecipient)] });
                  setNewRecipient("");
                }}
              >
                Add
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <p className="field">
            <span>Swap routers (output always goes to the owner)</span>
          </p>
          <div className="mt-2 grid gap-2">
            {VERIFIED_ROUTERS.map((r) => {
              const on = shown.routers.some((x) => lc(x) === r.address);
              return (
                <label key={r.address} className="flex items-center gap-2 text-[13.6px]">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={mode === "chain" && Boolean(cm)}
                    onChange={() => set({ routers: on ? stored.routers.filter((x) => lc(x) !== r.address) : [...stored.routers, r.address] })}
                  />
                  {r.label} <span className="font-mono text-[11px] text-[var(--faint)]">{shortAddress(r.address)}</span> <StatusBadge status="Prototype" />
                </label>
              );
            })}
            <p className="small">Pons launch curves need native ETH and have no recipient lock the guard can force: Concept.</p>
          </div>
        </div>

        {mode === "chain" && guardLive() && editable ? (
          <div className="grid gap-2 border-t border-[var(--line)] pt-4">
            <p className="small">Create a new mandate on {CHAIN.name} from the draft above (agent, tokens and caps, recipients, routers, days). You become its owner.</p>
            <button type="button" className="btn btn-blue btn-sm w-fit" onClick={createOnChain} disabled={busy !== null} data-testid="create-onchain">
              <span className="gl">{busy === "create" ? "Confirm in wallet…" : "Create mandate on chain"}</span>
            </button>
          </div>
        ) : null}
        {msg ? (
          <p className="rq-alert !bg-[var(--deep)] !text-[var(--ink)]" role="status" data-testid="editor-msg">
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ApproveRow({ token, decimals, symbol, busy, onApprove, owner }: { token: string; decimals: number; symbol: string; busy: boolean; onApprove: (t: string, d: number, a: string) => void; owner: string }) {
  const [amount, setAmount] = useState("");
  const [allow, setAllow] = useState<bigint | null>(null);
  useEffect(() => {
    let dead = false;
    readMany([{ to: token, abi: ERC20_WRITE_ABI, fn: "allowance", args: [owner, CONTRACTS.guard] }]).then(([a]) => !dead && setAllow((a as bigint) ?? null));
    return () => {
      dead = true;
    };
  }, [token, owner, busy]);
  return (
    <div className="mt-3 grid gap-2">
      <p className="font-mono text-[11px] text-[var(--muted)]">
        Owner allowance to the guard: {allow === null ? "Not known" : `${fmt(allow, decimals)} ${symbol}`}
      </p>
      <div className="flex gap-2">
        <input className="inp" placeholder={`Approve ${symbol} amount`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" data-testid={`approve-amt-${symbol}`} />
        <button type="button" className="btn btn-line btn-sm" disabled={busy || !amount} onClick={() => onApprove(token, decimals, amount)} data-testid={`approve-${symbol}`}>
          {busy ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
