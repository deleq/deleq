"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { encodeFunctionData } from "viem";
import { CHAIN, explorerAddress, explorerTx, isAddress, shortAddress } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { KNOWN_TOKENS } from "@/config/dex";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { LiveBadge, SampleBadge } from "@/components/site/PageHead";
import { GUARD_ABI } from "@/lib/abi";
import { explain, simulate, waitForReceipt } from "@/lib/client";
import { BIT_WORDS, bitNames } from "@/lib/mandate/bits";
import { KEYS, fmt, type LogEntry } from "@/lib/mandate/practice";
import type { Activity, GuardEvent, MandateView } from "@/lib/server/activity";

const meta = (t: string) => KNOWN_TOKENS.find((k) => k.address === t.toLowerCase()) ?? { symbol: shortAddress(t), decimals: 18 };
const amt = (raw: string, token: string) => `${fmt(BigInt(raw), meta(token).decimals)} ${meta(token).symbol}`;

function describe(e: GuardEvent): string {
  const a = e.args;
  switch (e.name) {
    case "TransferExecuted":
      return `Paid ${amt(a.amount, a.token)} to ${shortAddress(a.to)} · day spend ${amt(a.spentToday, a.token)}`;
    case "SwapExecuted":
      return `Swapped ${amt(a.amountIn, a.tokenIn)} → ${amt(a.amountOut, a.tokenOut)} (fee ${Number(a.fee) / 10_000}%) · output to owner`;
    case "MandateCreated":
      return `Mandate created for agent ${shortAddress(a.agent)}, valid until ${new Date(Number(a.expiry) * 1000).toISOString().slice(0, 10)}`;
    case "TokenRuleSet":
      return a.listed === "true" ? `${meta(a.token).symbol} caps: ${amt(a.perTxCap, a.token)} per tx, ${amt(a.dailyCap, a.token)} per day` : `${meta(a.token).symbol} removed`;
    case "RecipientSet":
      return `Recipient ${shortAddress(a.recipient)} ${a.allowed === "true" ? "allowed" : "removed"}`;
    case "RouterSet":
      return `Router ${shortAddress(a.router)} ${a.allowed === "true" ? "allowed" : "removed"}`;
    case "Paused":
      return `Paused by ${shortAddress(a.by)}`;
    case "Unpaused":
      return "Unpaused by the owner";
    case "Revoked":
      return "Revoked for good";
    case "WindowSet":
      return `Window changed: until ${new Date(Number(a.expiry) * 1000).toISOString().slice(0, 10)}`;
    case "MaxActionsSet":
      return `Actions per day set to ${a.maxActionsPerDay}`;
    default:
      return e.name;
  }
}

export function Dashboard() {
  const wallet = useWallet();
  const { open } = useWalletModal();
  const [log, setLog] = useLocalStore<LogEntry[]>(KEYS.log, []);
  const [lookup, setLookup] = useState("");
  const who = isAddress(lookup) ? lookup : wallet.address ?? "";
  const [data, setData] = useState<Activity | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "rejected" | "executed">("all");
  // Re-read every 15 s while the tab is visible (served from the short server cache).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!guardLive() || !isAddress(who)) return;
    let dead = false;
    fetch(`/api/activity?owner=${who}${reload ? "&fresh=1" : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const b = (await r.json()) as Activity & { error?: string };
        if (dead) return;
        if (!r.ok) setErr(b.error ?? "Activity failed.");
        else {
          setData(b);
          setErr(null);
        }
      })
      .catch(() => !dead && setErr("Network error."));
    return () => {
      dead = true;
    };
  }, [who, reload, tick]);

  async function act(m: MandateView, fn: "pause" | "unpause" | "revoke") {
    if (!wallet.address) return open();
    if (!wallet.onChain) return wallet.switchNetwork();
    if (fn === "revoke" && !window.confirm(`Revoke mandate #${m.id} for good? It cannot be undone.`)) return;
    setBusy(`${fn}-${m.id}`);
    setMsg(null);
    try {
      const data = encodeFunctionData({ abi: GUARD_ABI, functionName: fn, args: [BigInt(m.id)] });
      await simulate(wallet.address, CONTRACTS.guard, data);
      const hash = await wallet.sendTransaction({ to: CONTRACTS.guard, data });
      const rc = await waitForReceipt(hash);
      setMsg(rc.ok ? `${fn === "pause" ? "Paused" : fn === "unpause" ? "Unpaused" : "Revoked"} mandate #${m.id}. It applies from the next transaction.` : "The transaction reverted.");
      setReload((x) => x + 1);
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(null);
    }
  }

  const entries = (log ?? []).filter((e) => filter === "all" || e.result === filter);
  const isOwner = (m: MandateView) => wallet.address && wallet.address.toLowerCase() === m.owner;

  return (
    <div className="grid gap-8">
      <section className="panel" data-testid="chain-activity">
        <div className="panel-h">
          <span className="eyebrow">Executed actions · from the guard&apos;s events</span>
          <span className="flex flex-wrap items-center gap-2">
            <LiveBadge label={`${CHAIN.name}`} />
            {data?.head ? <span className="font-mono text-[10.5px] text-[var(--faint)]">head {data.head.toLocaleString("en-US")}</span> : null}
          </span>
        </div>
        <div className="panel-b grid gap-4">
          {!guardLive() ? (
            <p className="note" data-testid="guard-missing">
              DeleqMandateGuard is not deployed on {CHAIN.name} yet, so there are no on-chain mandates or receipts to show. The local log below works now, in
              practice mode. Once the owner deploys the guard, this panel reads its events (and only its events) for any owner address.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="field min-w-[260px] flex-1">
                  <span>Owner address (empty = your connected wallet)</span>
                  <input className="inp" value={lookup} onChange={(e) => setLookup(e.target.value.trim())} placeholder={wallet.address ?? "0x…"} spellCheck={false} data-testid="lookup" />
                </label>
                {!wallet.address ? (
                  <button type="button" className="btn btn-line btn-sm" onClick={open}>
                    Connect wallet
                  </button>
                ) : null}
                <button type="button" className="btn btn-line btn-sm" onClick={() => setReload((x) => x + 1)}>
                  Reload
                </button>
              </div>
              {err ? <p className="rq-alert">{err}</p> : null}
              {msg ? (
                <p className="rq-alert !bg-[var(--deep)] !text-[var(--ink)]" role="status" data-testid="dash-msg">
                  {msg}
                </p>
              ) : null}
              {data && isAddress(who) && data.mandates.length === 0 ? <p className="small">No mandates owned by {shortAddress(who)}.</p> : null}
              {data?.mandates.map((m) => (
                <div key={m.id} className="border border-[var(--line)]" data-testid={`dash-mandate-${m.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-3">
                    <span className="font-semibold">
                      #{m.id} {m.label || "mandate"}{" "}
                      <span className="font-mono text-[11px] font-normal text-[var(--muted)]">
                        agent{" "}
                        <a className="underline" href={explorerAddress(m.agent)} target="_blank" rel="noreferrer">
                          {shortAddress(m.agent)}
                        </a>{" "}
                        · {m.actions} actions · v{m.version}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${m.revoked ? "bad" : m.paused ? "" : "good"}`} data-testid={`state-${m.id}`}>
                        {m.revoked ? "Revoked" : m.paused ? "Paused" : "Active"}
                      </span>
                      {isOwner(m) && !m.revoked ? (
                        <>
                          <button type="button" className="btn btn-line btn-sm" disabled={busy !== null} onClick={() => act(m, m.paused ? "unpause" : "pause")} data-testid={`toggle-${m.id}`}>
                            {busy === `pause-${m.id}` || busy === `unpause-${m.id}` ? "…" : m.paused ? "Unpause" : "Pause agent"}
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => act(m, "revoke")} data-testid={`revoke-${m.id}`}>
                            {busy === `revoke-${m.id}` ? "…" : "Revoke"}
                          </button>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="grid gap-3 p-3 md:grid-cols-2">
                    {m.tokens.map((t) => (
                      <div key={t.token}>
                        <p className="font-mono text-[11px] text-[var(--muted)]">
                          {meta(t.token).symbol} · {amt(t.spentToday, t.token)} spent today of {amt(t.dailyCap, t.token)} · per tx {amt(t.perTxCap, t.token)}
                        </p>
                        <div className="meter mt-1">
                          <i style={{ width: `${BigInt(t.dailyCap) > 0n ? Number((BigInt(t.spentToday) * 100n) / BigInt(t.dailyCap)) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {data && data.events.length ? (
                <div className="overflow-x-auto">
                  <table className="tbl" data-testid="events">
                    <thead>
                      <tr>
                        <th>Block</th>
                        <th>Mandate</th>
                        <th>Event</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((e) => (
                        <tr key={`${e.tx}-${e.logIndex}`} data-testid={`event-${e.name}`}>
                          <td className="font-mono">{e.block.toLocaleString("en-US")}</td>
                          <td>#{e.id}</td>
                          <td>
                            <span className={`tone ${e.name.endsWith("Executed") ? "t-ok" : e.name === "Revoked" || e.name === "Paused" ? "t-risk" : "t-info"}`}>{e.name}</span>
                            <br />
                            {describe(e)}
                            {e.args.ref && !/^0x0+$/.test(e.args.ref) ? <span className="block font-mono text-[10.5px] text-[var(--faint)]">ref {shortAddress(e.args.ref, 10, 6)}</span> : null}
                          </td>
                          <td>
                            <a className="underline" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">
                              {shortAddress(e.tx, 8, 6)}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : data && data.mandates.length ? (
                <p className="small">No guard events for these mandates yet.</p>
              ) : null}
              {data?.scanned && !data.scanned.complete ? <p className="note">Some blocks could not be read ({data.scanned.gaps.length} gap(s)); the list may be incomplete. Reload to try again.</p> : null}
            </>
          )}
        </div>
      </section>

      <section className="panel" data-testid="local-log">
        <div className="panel-h">
          <span className="eyebrow">Checks and rejections · this browser</span>
          <span className="flex flex-wrap items-center gap-2">
            <div className="seg" role="group" aria-label="Filter">
              {(["all", "rejected", "executed"] as const).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            <button type="button" className="chip" onClick={() => setLog([])}>
              Clear
            </button>
          </span>
        </div>
        <div className="panel-b">
          <p className="small">
            A transaction that reverts leaves no event, so rejected proposals are recorded here from the pre-check (the guard&apos;s own check view on chain, or the same rules in
            practice). Stored in this browser only.
          </p>
          {entries.length === 0 ? (
            <p className="small mt-4">
              Nothing yet. Run a check in the <Link className="underline" href="/console">console</Link>.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Time (UTC)</th>
                    <th>Proposal</th>
                    <th>Result</th>
                    <th>Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const names = bitNames(BigInt(e.bits));
                    return (
                      <tr key={e.id} data-testid={`log-${e.result}`}>
                        <td className="font-mono whitespace-nowrap">{new Date(e.at * 1000).toISOString().slice(5, 16).replace("T", " ")}</td>
                        <td>
                          {e.summary}
                          <span className="block">{e.mode === "practice" ? <SampleBadge label="Practice" /> : <span className="font-mono text-[10.5px] text-[var(--faint)]">mandate #{e.mandateId}</span>}</span>
                        </td>
                        <td>
                          <span className={`tone ${e.result === "rejected" ? "t-risk" : "t-ok"}`}>{e.result}</span>
                          {e.tx ? (
                            <a className="block font-mono text-[11px] underline" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">
                              {shortAddress(e.tx, 8, 6)}
                            </a>
                          ) : null}
                        </td>
                        <td>
                          <div className="chips">
                            {names.length ? (
                              names.map((n) => (
                                <span key={n} className="chip bad" title={BIT_WORDS[n].why}>
                                  {BIT_WORDS[n].label}
                                </span>
                              ))
                            ) : (
                              <span className="chip good">none</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
