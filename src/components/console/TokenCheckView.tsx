"use client";

import { useEffect, useState } from "react";
import { explorerAddress, isAddress, shortAddress } from "@/config/brand";
import { LiveBadge } from "@/components/site/PageHead";
import { dateText } from "@/lib/format";
import type { TokenCheck } from "@/lib/tokencheck/types";

/** The live token check shown next to a proposal: every row with its tone, source and the block it was read at. */
export function TokenCheckView({ token }: { token: string }) {
  // Answers are keyed by token, so a stale answer for another token is never shown.
  const [answer, setAnswer] = useState<{ token: string; data: TokenCheck | null; error: string | null } | null>(null);
  const key = token.toLowerCase();

  useEffect(() => {
    if (!isAddress(key)) return;
    let dead = false;
    fetch(`/api/token-check?token=${key}`, { cache: "no-store" })
      .then(async (r) => {
        const b = (await r.json().catch(() => null)) as (TokenCheck & { error?: string }) | null;
        if (dead) return;
        if (!r.ok || !b) setAnswer({ token: key, data: null, error: b?.error ?? `Check failed (${r.status}).` });
        else setAnswer({ token: key, data: b, error: null });
      })
      .catch(() => !dead && setAnswer({ token: key, data: null, error: "Network error." }));
    return () => {
      dead = true;
    };
  }, [key]);
  const mine = answer && answer.token === key ? answer : null;
  const data = mine?.data ?? null;
  const error = mine?.error ?? null;
  const loading = isAddress(key) && !mine;

  return (
    <div className="panel" data-testid="token-check">
      <div className="panel-h">
        <span className="eyebrow">Token check</span>
        <span className="flex flex-wrap items-center gap-2">
          <LiveBadge label="Read from chain" />
          {data ? (
            <span className="font-mono text-[10.5px] text-[var(--faint)]" data-testid="token-check-block">
              block {data.block.toLocaleString("en-US")} · {dateText(data.checkedAt)}
            </span>
          ) : null}
        </span>
      </div>
      <div className="panel-b">
        {!isAddress(token) ? <p className="small">Pick a token to read it from {"Robinhood Chain"}.</p> : null}
        {loading && !data ? <p className="small">Reading {shortAddress(token)} at the head block…</p> : null}
        {error ? (
          <p className="rq-alert" role="status">
            {error} Nothing below is a result.
          </p>
        ) : null}
        {data && data.token === token.toLowerCase() ? (
          <>
            <p className="text-[15px] font-semibold">
              {data.symbol ?? "Unknown symbol"} <span className="font-mono text-[12px] font-normal text-[var(--faint)]">{data.token}</span>
            </p>
            <div className="rows mt-2">
              {data.rows.map((r) => (
                <div className="row" key={r.key} data-testid={`row-${r.key}`}>
                  <span className="text-[13px]">
                    <span className={`tone t-${r.tone}`}>{r.tone === "unknown" ? "Not known" : r.tone}</span>
                    <br />
                    {r.label}
                  </span>
                  <span className="text-[13px] [overflow-wrap:anywhere]">
                    {r.address ? (
                      <a className="underline decoration-[var(--line-2)]" href={explorerAddress(r.address)} target="_blank" rel="noreferrer">
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </span>
                  <span className="src">
                    {r.source.method}
                    <br />
                    <a className="underline" href={explorerAddress(r.source.address)} target="_blank" rel="noreferrer">
                      {shortAddress(r.source.address)}
                    </a>
                  </span>
                </div>
              ))}
            </div>
            <p className="note mt-4">
              A check lists what the chain says at one block. A selector found means the code can do it, not that it will; none found is not proof of
              absence. A clean check does not make a token safe.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
