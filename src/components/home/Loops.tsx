"use client";

import { useEffect, useState } from "react";

/* The two looping product scenes of the reference, rebuilt for Deleq: the console loop (four steps with progress bars, prev / next,
   pause) and the how-it-works list (three steps with a 6 s progress line). The content is an illustration with sample values. */

type Line = { n: number; text: React.ReactNode; tone?: "hot" | "bad" | "good" };

const K = ({ children }: { children: React.ReactNode }) => <span className="k-key">{children}</span>;
const S = ({ children }: { children: React.ReactNode }) => <span className="k-str">{children}</span>;
const N = ({ children }: { children: React.ReactNode }) => <span className="k-num">{children}</span>;

const MANDATE: Line[] = [
  { n: 1, text: <>{"{"}</> },
  { n: 2, text: <>  <K>&quot;agent&quot;</K>: <S>&quot;0x9c1e…41a0&quot;</S>,</> },
  { n: 3, text: <>  <K>&quot;tokens&quot;</K>: {"{"} <S>&quot;USDG&quot;</S>: {"{"} <K>perTx</K>: <N>100</N>, <K>daily</K>: <N>250</N> {"}"} {"}"},</> },
  { n: 4, text: <>  <K>&quot;recipients&quot;</K>: [<S>&quot;0x51c0…09aa&quot;</S>],</> },
  { n: 5, text: <>  <K>&quot;routers&quot;</K>: [<S>&quot;SwapRouter02&quot;</S>],</> },
  { n: 6, text: <>  <K>&quot;actionsPerDay&quot;</K>: <N>10</N>,</> },
  { n: 7, text: <>  <K>&quot;expiry&quot;</K>: <S>&quot;30 days&quot;</S></> },
  { n: 8, text: <>{"}"}</> },
];

const STEPS = [
  {
    key: "Propose",
    title: "The agent proposes an action. Deleq reads the mandate.",
    body: "The agent asks to pay 140 USDG to a supplier. Nothing is signed yet: the proposal is only data.",
    hot: [3, 4],
    chat: [{ who: "Agent", text: "Pay 140 USDG to 0x51c0…09aa for invoice 118." }],
  },
  {
    key: "Check",
    title: "The guard's check view answers with reason bits.",
    body: "140 is above the 100 USDG per-transaction cap, so checkTransfer returns OVER_PER_TX. The token check reads the token from chain next to it.",
    hot: [3],
    bad: [3],
    chat: [
      { who: "Agent", text: "Pay 140 USDG to 0x51c0…09aa for invoice 118." },
      { who: "Deleq", text: "Rejected before signing: over the per-transaction cap (100 USDG).", tone: "reject" as const },
    ],
  },
  {
    key: "Execute",
    title: "A proposal inside the limits executes from the owner's wallet.",
    body: "The agent splits it: 90 USDG now. The guard moves it straight from the owner to the allowlisted recipient with transferFrom.",
    hot: [3, 4],
    good: [3],
    chat: [
      { who: "Agent", text: "Pay 90 USDG to 0x51c0…09aa (part 1 of invoice 118)." },
      { who: "Deleq", text: "Passed all 19 checks. Executed: 90 of 250 USDG used today.", tone: "pass" as const },
    ],
  },
  {
    key: "Log",
    title: "Every executed action is an event; every rejection is in the log.",
    body: "The dashboard rebuilds receipts from the guard's events and keeps rejected proposals with their reasons. Pause or revoke counts from the next transaction.",
    hot: [6, 7],
    chat: [
      { who: "Deleq", text: "TransferExecuted #12 · 90 USDG · day spend 90 / 250 · tx 0x7f3a…", tone: "pass" as const },
      { who: "Owner", text: "Pause the agent until Monday." },
    ],
  },
];

export function ConsoleLoop() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const STEP_MS = 5200;
  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((v) => (v + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, paused]);
  const s = STEPS[i];
  return (
    <div>
      <div className="mock" data-testid="console-mock">
        <div className="mock-top">
          <span className="status-dot" aria-hidden="true" /> console / mandate #7 <span className="ml-auto">practice mode · sample data</span>
        </div>
        <div className="mock-grid">
          <div>
            <div className="mock-top" style={{ borderBottom: "1px solid var(--line)" }}>
              <span>× mandate.json</span>
              <span className="ml-auto">version 4</span>
            </div>
            <div className="mock-code scene" key={`c${i}`}>
              {MANDATE.map((l) => (
                <div key={l.n} className={`ln ${s.bad?.includes(l.n) ? "bad" : s.good?.includes(l.n) ? "good" : s.hot.includes(l.n) ? "hot" : ""}`}>
                  <i>{l.n}</i>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="mock-top">›_ Agent channel</div>
            <div className="chat scene" key={`h${i}`}>
              {s.chat.map((m, k) => (
                <div key={k} className={`bubble ${m.who === "Agent" || m.who === "Owner" ? "me" : ""} ${"tone" in m ? m.tone : ""}`}>
                  <small>{m.who}</small>
                  {m.text}
                </div>
              ))}
              <div className="mt-1 text-[11px] text-[var(--faint)]">
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>{" "}
                {i === 0 ? "Checking the mandate…" : i === 1 ? "Reading the token at the head block…" : i === 2 ? "Waiting for the receipt…" : "Watching the guard's events…"}
              </div>
              <div className="progress-sweep mt-auto" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className={`steps min-w-0 flex-1 basis-full sm:basis-0 ${paused ? "paused" : ""}`} role="tablist" aria-label="Console steps" style={{ "--step": `${STEP_MS}ms` } as React.CSSProperties}>
          {STEPS.map((st, k) => (
            <button key={st.key} type="button" role="tab" aria-selected={k === i} className={k < i ? "done" : ""} onClick={() => setI(k)}>
              <span className="bar">
                <i key={`${k}-${i}`} />
              </span>
              <span className="lbl">
                <span>0{k + 1}</span>
                <span>{st.key}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="sq-btn" aria-label="Previous step" onClick={() => setI((v) => (v + STEPS.length - 1) % STEPS.length)}>
            ←
          </button>
          <button type="button" className="sq-btn" aria-label="Next step" onClick={() => setI((v) => (v + 1) % STEPS.length)}>
            →
          </button>
          <button type="button" className="sq-btn !w-auto px-4 text-[11.5px]" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? "Play ▶" : "Pause Ⅱ"}
          </button>
        </div>
      </div>
      <div className="scene mt-10 grid grid-cols-1 gap-6 md:grid-cols-2" key={`t${i}`}>
        <div>
          <p className="eyebrow">The loop / 0{i + 1}</p>
          <h3 className="mt-3 font-sans text-[28px] leading-[1.18] font-medium tracking-[-0.03em] md:text-[32px]">{s.title}</h3>
        </div>
        <p className="lede self-end">{s.body}</p>
      </div>
    </div>
  );
}

const HOW = [
  { title: "Set the mandate", body: "Pick the agent address, the tokens it may spend with a per-transaction and a daily cap each, the recipients and routers it may use, and an end date. Approve the guard for the ERC-20 amount you are comfortable with." },
  { title: "Check every proposal", body: "The agent's proposal runs through the guard's check view and a token check read from chain. The answer is a list of reasons, shown before anything is signed." },
  { title: "Execute or refuse", body: "Inside the limits, the guard moves the tokens from your wallet in one transaction. Outside them, it reverts with the same reasons. Pause or revoke at any time." },
];

export function HowLoop() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((v) => (v + 1) % HOW.length), 6000);
    return () => clearTimeout(t);
  }, [i, paused]);
  return (
    <div className={`how ${paused ? "how-paused" : ""}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div role="tablist" aria-label="How it works">
        {HOW.map((h, k) => (
          <button key={h.title} type="button" role="tab" aria-selected={k === i} className="how-step" onClick={() => setI(k)}>
            <span className="rail" aria-hidden="true">
              <i key={`r${k}-${i}`} />
            </span>
            <span className="eyebrow">Step 0{k + 1}</span>
            <span className="display t mt-2 block">{h.title}</span>
            <span className="body">
              <span className="small mt-3 block pr-4">{h.body}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flow">
        <svg viewBox="0 0 460 420" aria-label="Flow: proposal, checks, guard, owner wallet to recipient">
          <path d="M230 70 V150" stroke="var(--line-2)" />
          <path d="M230 210 V290" stroke="var(--line-2)" />
          <path className="dash-flow" pathLength={100} d="M230 70 V150" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
          <path className="dash-flow" pathLength={100} d="M230 210 V290" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" style={{ animationDuration: "16s" }} />
          <path d="M120 350 H340" stroke="var(--line-2)" />
          <path className="dash-flow" pathLength={100} d="M120 350 H340" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" style={{ animationDuration: "18s" }} />
          {[
            { y: 20, t: "01   Mandate + proposal", on: i === 0 },
            { y: 160, t: "02   checkTransfer → reasons", on: i === 1 },
          ].map((b) => (
            <g key={b.y}>
              <rect className={`flow-box ${b.on ? "on" : ""}`} x="110" y={b.y} width="240" height="50" />
              <text x="130" y={b.y + 30}>
                {b.t}
              </text>
            </g>
          ))}
          <rect className={`flow-box ${i === 2 ? "on" : ""}`} x="20" y="300" width="160" height="50" />
          <text x="40" y="330">
            Owner wallet
          </text>
          <rect className={`flow-box ${i === 2 ? "on" : ""}`} x="280" y="300" width="160" height="50" />
          <text x="300" y="330">
            Recipient
          </text>
          <text x="186" y="390" fill="var(--faint)" style={{ fontSize: 10 }}>
            03 guard · transferFrom
          </text>
        </svg>
      </div>
    </div>
  );
}
