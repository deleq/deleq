import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { UNISWAP_V3, USDG, WETH } from "@/config/dex";
import { ConsoleLoop, HowLoop } from "@/components/home/Loops";
import { StatusBadge } from "@/components/site/PageHead";
import { FAQ } from "@/lib/faq";

/* Home sections after the hero, in the reference's order: problem, introducing, difference, how it works, benefits, get started,
   FAQ, closing call. Our own copy, diagrams and data; the layout grid and motion follow referensi/recon-ui. */

const Pill = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <p className="pill" data-reveal="">
    <span aria-hidden="true">{icon}</span>
    {children}
  </p>
);

function Head({ pill, icon, title, lede }: { pill: string; icon: string; title: React.ReactNode; lede?: string }) {
  return (
    <div className="sec-head">
      <Pill icon={icon}>{pill}</Pill>
      <h2 className="display h-sec mt-8" data-reveal="" style={{ "--delay": "80ms" } as React.CSSProperties}>
        {title}
      </h2>
      {lede ? (
        <p className="lede" data-reveal="" style={{ "--delay": "160ms" } as React.CSSProperties}>
          {lede}
        </p>
      ) : null}
    </div>
  );
}

/** The problem diagram: proposals drop into a queue, one turns red at the guard and never reaches the wallet (12 s loop). */
function QueueDiagram() {
  const items = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 300 340" aria-label="Agent proposals queue at the guard; one is refused" fill="none">
      <rect x="10" y="10" width="280" height="320" stroke="var(--line-2)" strokeDasharray="3 5" />
      <text x="128" y="34" fill="var(--faint)" style={{ fontSize: 10 }}>
        AGENT
      </text>
      {items.map((k) => (
        <g key={k} className="q-item" style={{ animationDelay: `${k * 0.35}s` }}>
          <rect x={k % 2 ? 180 : 70} y={56 + Math.floor(k / 2) * 30} width="50" height="20" stroke="var(--ink)" strokeOpacity="0.5" />
          <text x={(k % 2 ? 180 : 70) + 13} y={70 + Math.floor(k / 2) * 30} fill="var(--ink)" style={{ fontSize: 9 }}>
            tx {k + 1}
          </text>
        </g>
      ))}
      <path d="M95 150 L150 190 M205 150 L150 190" stroke="var(--line-2)" />
      <rect x="95" y="190" width="110" height="34" stroke="var(--blue)" />
      <text x="128" y="211" fill="var(--blue)" style={{ fontSize: 10 }}>
        GUARD
      </text>
      <g className="q-risk">
        <path d="M205 207 H262 V250" stroke="var(--red)" />
        <text x="214" y="268" fill="var(--red)" style={{ fontSize: 9 }}>
          REFUSED
        </text>
      </g>
      <path d="M150 224 V292" stroke="var(--line-2)" />
      <rect x="100" y="292" width="100" height="24" stroke="var(--line-2)" />
      <text x="114" y="308" fill="var(--faint)" style={{ fontSize: 9 }}>
        OWNER WALLET
      </text>
      <g className="q-token">
        <rect x="-6" y="-6" width="12" height="12" fill="var(--blue)" />
      </g>
    </svg>
  );
}

const PROBLEMS = [
  { tag: "Keys", n: "001", title: "Bots want your keys", body: "Most trading agents ask for a private key or an unlimited approval. One bad decision then reaches everything the wallet holds." },
  { tag: "Mistakes", n: "002", title: "Wrong amount, wrong address", body: "A parsing bug or a confused model can send ten times the amount, or pay an address you never meant to pay." },
  { tag: "Loops", n: "003", title: "Runaway repeats", body: "An agent stuck in a retry loop spends again and again. Without a daily cap there is no natural stop." },
  { tag: "Tokens", n: "004", title: "Unknown tokens", body: "Fresh tokens can carry mint, pause, blocklist or upgrade powers. An agent rarely reads the bytecode before it buys." },
];

export function Problem() {
  return (
    <section className="frame" aria-labelledby="problem-title">
      <div className="sec pb-0">
        <Head pill="The problem" icon="×" title={<span id="problem-title">Agents are useful. Mistakes are expensive.</span>} />
      </div>
      <div className="problem mt-16">
        <div className="diag" data-reveal="">
          <QueueDiagram />
        </div>
        <div className="four">
          {PROBLEMS.map((p, k) => (
            <div key={p.n} className="cell" data-reveal="" style={{ "--delay": `${k * 70}ms` } as React.CSSProperties}>
              <p className="cell-tag">
                <span>{p.tag}</span>
                <span className="n">{p.n}</span>
              </p>
              <h3 className="display h-card mt-3">{p.title}</h3>
              <p className="small mt-3">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Intro() {
  return (
    <section className="frame rule" aria-labelledby="intro-title">
      <div className="sec">
        <Head
          pill="Introducing Deleq"
          icon="◧"
          title={
            <span id="intro-title">
              Limits Inside
              <br />
              the Agent Loop
            </span>
          }
          lede="The agent proposes, Deleq checks the proposal against your mandate and against the token's code, and only an action inside the limits can move your tokens."
        />
        <div className="mx-auto mt-16 max-w-[1040px] px-4 md:px-8" data-reveal="">
          <ConsoleLoop />
        </div>
      </div>
    </section>
  );
}

export function Difference() {
  return (
    <section className="frame rule" aria-labelledby="diff-title">
      <div className="sec">
        <Head
          pill="The difference"
          icon="◎"
          title={
            <span id="diff-title">
              Clear Reasons.
              <br />
              Hard Limits.
            </span>
          }
          lede="A rejection is not a vague error. The guard returns one bit per broken rule, and the same rules decide on chain."
        />
        <div className="mx-auto mt-14 max-w-[1000px] px-4 md:px-8">
          <div className="diff" data-reveal="">
            <div>
              <p className="top">
                <span>01 / The proposal</span>
                <span>From the agent</span>
              </p>
              <div className="mock-code">
                <div className="ln">
                  <i>1</i>executeTransfer(
                </div>
                <div className="ln">
                  <i>2</i>
                  {"  "}mandate <span className="k-num">7</span>, token <span className="k-str">USDG</span>,
                </div>
                <div className="ln bad">
                  <i>3</i>
                  {"  "}to <span className="k-str">0x7777…dEaD</span>,
                </div>
                <div className="ln bad">
                  <i>4</i>
                  {"  "}amount <span className="k-num">400</span>
                </div>
                <div className="ln">
                  <i>5</i>)
                </div>
              </div>
              <div className="foot">
                <span className="ic text-[var(--red)]">!</span>
                <div>
                  <p className="font-semibold">Three rules broken</p>
                  <p className="small">Recipient not allowed · over the per-transaction cap · over the daily cap.</p>
                </div>
              </div>
            </div>
            <div className="fix-side">
              <p className="top">
                <span>02 / The answer</span>
                <span>checkTransfer view</span>
              </p>
              <div className="mock-code">
                <div className="ln">
                  <i>1</i>reasons = <span className="k-num">0b11100000000</span>
                </div>
                <div className="ln good">
                  <i>2</i>RECIPIENT_NOT_ALLOWED <span className="text-[var(--faint)]">bit 8</span>
                </div>
                <div className="ln good">
                  <i>3</i>OVER_PER_TX <span className="text-[var(--faint)]">bit 9 · cap 100</span>
                </div>
                <div className="ln good">
                  <i>4</i>OVER_DAILY <span className="text-[var(--faint)]">bit 10 · 250 / day</span>
                </div>
                <div className="ln">
                  <i>5</i>→ nothing signed, logged as rejected
                </div>
              </div>
              <div className="foot">
                <span className="ic text-[var(--blue)]">→</span>
                <div>
                  <p className="font-semibold">Refused before the wallet opens</p>
                  <p className="small">The same bits would revert the transaction if anyone sent it anyway.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-right font-mono text-[10.4px] text-[var(--faint)]">Illustrative example · sample values</p>
        </div>
        <div className="cells c3 mt-14">
          {[
            { n: "01", t: "Know what was refused.", b: "Each reason has a name and a sentence: unknown recipient, over a cap, paused, expired, low allowance." },
            { n: "02", t: "Know what the token can do.", b: "Next to the reasons, a token check read from chain: proxy, owner, mint, pause, blocklist and fee functions, pools." },
            { n: "03", t: "Know it holds on chain.", b: "The guard runs the same rules when the transaction executes. A skipped check in the UI changes nothing." },
          ].map((c, k) => (
            <div key={c.n} className="cell" data-reveal="" style={{ "--delay": `${k * 80}ms` } as React.CSSProperties}>
              <p className="num">{c.n}</p>
              <h3 className="display mt-3 text-[24px] leading-[1.15] tracking-[-0.02em]">{c.t}</h3>
              <p className="small mt-3">{c.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function How() {
  return (
    <section className="frame rule" aria-labelledby="how-title">
      <div className="sec pb-0">
        <Head
          pill="How it works"
          icon="⚙"
          title={<span id="how-title">Spending Rules That Hold Under Pressure</span>}
          lede="Three steps, one contract. Nothing about an agent's intelligence needs to be trusted for the limits to hold."
        />
      </div>
      <div className="mt-14" data-reveal="">
        <HowLoop />
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <section className="frame rule" aria-labelledby="ben-title">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
        <div className="diag border-b border-[var(--line)] md:border-r md:border-b-0" data-reveal="">
          <svg viewBox="0 0 260 260" aria-label="Spend meter under a daily cap" fill="none">
            <text x="96" y="22" fill="var(--faint)" style={{ fontSize: 10 }}>
              DAILY CAP
            </text>
            <rect x="40" y="36" width="180" height="190" stroke="var(--line-2)" />
            <path d="M40 76 H220" stroke="var(--red)" strokeDasharray="4 4" />
            <rect className="q-item" x="60" y="160" width="40" height="66" fill="var(--blue)" fillOpacity="0.55" />
            <rect className="q-item" style={{ animationDelay: "0.6s" }} x="110" y="120" width="40" height="106" fill="var(--blue)" fillOpacity="0.7" />
            <rect className="q-item" style={{ animationDelay: "1.2s" }} x="160" y="80" width="40" height="146" fill="var(--blue)" />
            <text x="62" y="246" fill="var(--faint)" style={{ fontSize: 9 }}>
              09:00 · 12:00 · 16:00 UTC
            </text>
          </svg>
        </div>
        <div className="flex flex-col justify-center p-8 md:p-12">
          <p className="pill w-fit" data-reveal="">
            ▣ Benefits
          </p>
          <h2 id="ben-title" className="display h-mid mt-6" data-reveal="">
            A Smaller Blast Radius
          </h2>
          <p className="lede mt-5" data-reveal="">
            The worst day an agent can have is the daily cap you set, paid only to addresses you chose. Not your whole wallet.
          </p>
        </div>
      </div>
      <div className="cells c3">
        {[
          { t: "Cap more", b: "Per token, per transaction and per UTC day, plus a number of actions per day." },
          { t: "Explain more", b: "Every refusal carries reasons, every execution is an event you can link to." },
          { t: "Stop faster", b: "Pause, or revoke for good, in one transaction. The agent can pause itself too." },
        ].map((c, k) => (
          <div key={c.t} className="cell text-center" data-reveal="" style={{ "--delay": `${k * 80}ms` } as React.CSSProperties}>
            <h3 className="display text-[28px] tracking-[-0.02em]">{c.t}</h3>
            <p className="small mx-auto mt-3 max-w-[300px]">{c.b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GetStarted() {
  return (
    <section className="frame rule" aria-labelledby="start-title">
      <div className="sec">
        <Head
          pill="Get started"
          icon="↳"
          title={
            <span id="start-title">
              Set up Deleq where
              <br />
              the agent signs.
            </span>
          }
        />
        <div className="mx-auto mt-14 max-w-[1040px] px-4 md:px-8">
          <div className="grid grid-cols-1 gap-8 border-t border-[var(--line)] pt-8 md:grid-cols-3">
            {[
              { k: "01 / Practice", t: "Try it on sample data.", b: "The console runs the same rules in your browser. No wallet, no token, nothing sent." },
              { k: "02 / Mandate", t: "Create a mandate.", b: "Connect a wallet, name the agent address, set caps, recipients and routers, approve the guard for an ERC-20 amount." },
              { k: "03 / Agent", t: "Point the agent at it.", b: "The agent calls checkTransfer first, then executeTransfer or executeSwapV3 with its own key. A runnable example ships in the repository." },
            ].map((s, k) => (
              <div key={s.k} data-reveal="" style={{ "--delay": `${k * 80}ms` } as React.CSSProperties}>
                <p className="eyebrow">{s.k}</p>
                <h3 className="display mt-3 text-[26px] leading-[1.1] tracking-[-0.02em]">{s.t}</h3>
                <p className="small mt-3">{s.b}</p>
              </div>
            ))}
          </div>
          <div className="cli mt-10" data-reveal="">
            <span aria-hidden="true">›_</span>
            <span>
              Building an agent? <code>examples/agent.mjs</code> reads its mandate, checks a proposal and executes it (viem, any HTTP RPC).
            </span>
          </div>
          <h3 className="display mt-12 text-center text-[18px]">Works with what is real today.</h3>
          <div className="works mt-6" data-reveal="">
            <div>
              <h4>Wallets</h4>
              <ul>
                <li>Browser wallets (EIP-6963)</li>
                <li>WalletConnect, when configured</li>
              </ul>
            </div>
            <div>
              <h4>Agents</h4>
              <ul>
                <li>Any script that can call a contract</li>
                <li>Example agent with viem</li>
              </ul>
            </div>
            <div>
              <h4>Tokens on {CHAIN.name}</h4>
              <ul>
                <li>
                  <a className="underline decoration-[var(--line-2)]" href={`${CHAIN.explorer}/token/${USDG}`} target="_blank" rel="noreferrer">
                    USDG
                  </a>{" "}
                  ·{" "}
                  <a className="underline decoration-[var(--line-2)]" href={`${CHAIN.explorer}/token/${WETH}`} target="_blank" rel="noreferrer">
                    WETH
                  </a>
                </li>
                <li>Any plain ERC-20 you list</li>
              </ul>
            </div>
            <div>
              <h4>Swap routers</h4>
              <ul>
                <li>
                  <a className="underline decoration-[var(--line-2)]" href={`${CHAIN.explorer}/address/${UNISWAP_V3.swapRouter02}`} target="_blank" rel="noreferrer">
                    Uniswap v3 SwapRouter02
                  </a>{" "}
                  <StatusBadge status="Prototype" />
                </li>
                <li>
                  Pons launch curves <StatusBadge status="Concept" />
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="frame rule" aria-labelledby="faq-title">
      <div className="sec">
        <Head pill="FAQ" icon="?" title={<span id="faq-title">Frequently asked questions.</span>} />
        <div className="faq mx-auto mt-12 max-w-[1000px] border-t border-[var(--line)] px-4 md:px-0" data-reveal="">
          {FAQ.map((f, k) => (
            <details key={f.q}>
              <summary>
                <span className="num">0{k + 1}</span>
                <span>{f.q}</span>
                <span className="chev" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Wave() {
  const rows = Array.from({ length: 14 }, (_, r) => r);
  const cols = Array.from({ length: 30 }, (_, c) => c);
  const y = (r: number, x: number) => 120 + r * 20 + Math.sin(x / 140 + r * 0.35) * (26 + r * 2.2);
  return (
    <svg viewBox="0 0 2400 420" preserveAspectRatio="none" aria-hidden="true" fill="none">
      {rows.map((r) => (
        <path key={`r${r}`} d={`M0 ${y(r, 0)} ${Array.from({ length: 61 }, (_, k) => `L${k * 40} ${y(r, k * 40)}`).join(" ")}`} stroke="var(--blue)" strokeOpacity={0.18 + r * 0.04} />
      ))}
      {cols.map((c) => (
        <path key={`c${c}`} d={`M${c * 80} ${y(0, c * 80)} L${c * 80 + 30} ${y(13, c * 80 + 30)}`} stroke="var(--blue)" strokeOpacity="0.25" />
      ))}
      {[300, 900, 1500, 2100].map((x) => (
        <circle key={x} cx={x} cy={y(6, x)} r="3" fill="var(--amber)" />
      ))}
    </svg>
  );
}

export function Cta() {
  return (
    <section className="cta rule" aria-labelledby="cta-title">
      <div className="glow" aria-hidden="true" />
      <div className="relative wrap">
        <h2 id="cta-title" className="display glitch" data-text="Delegate with Limits.">
          Delegate with Limits.
        </h2>
        <p className="lede mx-auto mt-6 max-w-[560px]">{BRAND.tagline}</p>
        <div className="mt-10 flex justify-center">
          <Link href="/console" className="btn btn-blue min-h-[56px] px-14 text-[18px]">
            <span className="gl">Open the console ↵</span>
          </Link>
        </div>
      </div>
      <div className="cta-wave">
        <Wave />
      </div>
    </section>
  );
}
