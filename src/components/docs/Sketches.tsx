import { BIT_WORDS } from "@/lib/mandate/bits";

/* Illustrations for the docs, drawn with the site's own CSS and SVG (sample values, labels as on /console). */

/** Small drawn copy of the mandate editor, labels as on /console. Illustration with sample values. */
export function EditorSketch() {
  const rows: [string, string][] = [
    ["Agent address (the key that may act)", "0xB… (your agent wallet)"],
    ["Label", "demo bot"],
    ["Actions per UTC day (0 = no limit)", "10"],
    ["Valid for (days, max 730)", "30"],
  ];
  return (
    <figure className="sketch" aria-label="Sketch of the mandate editor">
      <div className="sketch-h">
        <span className="eyebrow">Mandate</span>
        <span className="chip">+ New mandate</span>
      </div>
      <div className="grid gap-3 p-4">
        {rows.map(([k, v]) => (
          <div key={k} className="field">
            <span>{k}</span>
            <span className="inp flex items-center">{v}</span>
          </div>
        ))}
        <div className="border border-[var(--line)] p-3">
          <p className="font-semibold">USDG</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="field">
              <span>Per transaction</span>
              <span className="inp flex items-center">10</span>
            </div>
            <div className="field">
              <span>Per UTC day</span>
              <span className="inp flex items-center">25</span>
            </div>
          </div>
          <div className="meter mt-3" aria-hidden="true">
            <i className="tut-meter" style={{ width: "32%" }} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">17 of 25 USDG left today</p>
        </div>
        <div className="field">
          <span>Recipients the agent may pay</span>
          <span className="chips">
            <span className="chip">0xC… ×</span>
          </span>
        </div>
        <span className="btn btn-blue btn-sm w-fit">Create mandate on chain</span>
      </div>
      <figcaption className="sketch-cap">Illustration · sample values</figcaption>
    </figure>
  );
}

/** The check answer as the console shows it. */
export function VerdictSketch() {
  return (
    <figure className="grid gap-3" aria-label="Sketch of a passed and a refused check">
      <div className="verdict pass">
        <p className="eyebrow !text-current">Answer from DeleqMandateGuard.check view</p>
        <p className="display mt-1 text-[22px]">Inside the mandate</p>
        <p className="mt-1 font-mono text-[11px] text-[var(--faint)]">contract bits 0 · site engine bits 0 · match</p>
      </div>
      <div className="verdict fail">
        <p className="eyebrow !text-current">Answer from DeleqMandateGuard.check view</p>
        <p className="display mt-1 text-[22px]">Rejected · 1 reason</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-2 text-[13px]">
          <span className="chip bad">Over per-tx cap</span>
          <span className="text-[var(--muted)]">{BIT_WORDS.OVER_PER_TX.why}</span>
        </p>
      </div>
      <figcaption className="sketch-cap">Illustration · sample values</figcaption>
    </figure>
  );
}

/** Who pays what, drawn: owner wallet → guard check → recipient; the guard never keeps a balance. */
export function FlowSketch() {
  return (
    <figure className="sketch p-4" aria-label="Tokens go from the owner wallet straight to the recipient; the guard only checks">
      <svg viewBox="0 0 520 150" className="w-full" fill="none">
        <rect className="flow-box" x="10" y="45" width="140" height="60" />
        <text x="26" y="72" className="tut-svg">
          Owner wallet
        </text>
        <text x="26" y="92" className="tut-svg tut-dim">
          holds the USDG
        </text>
        <rect className="flow-box on" x="190" y="45" width="140" height="60" />
        <text x="206" y="72" className="tut-svg">
          Guard
        </text>
        <text x="206" y="92" className="tut-svg tut-dim">
          checks, holds nothing
        </text>
        <rect className="flow-box" x="370" y="45" width="140" height="60" />
        <text x="386" y="72" className="tut-svg">
          Recipient
        </text>
        <text x="386" y="92" className="tut-svg tut-dim">
          allowlisted
        </text>
        <path d="M150 75 H190 M330 75 H370" stroke="var(--line-2)" />
        <path className="dash-flow" pathLength={100} d="M80 105 C 80 140, 440 140, 440 105" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" />
        <text x="196" y="146" className="tut-svg tut-dim">
          transferFrom(owner → recipient)
        </text>
      </svg>
      <figcaption className="sketch-cap">The approval caps what the guard may pull; nothing is deposited.</figcaption>
    </figure>
  );
}

