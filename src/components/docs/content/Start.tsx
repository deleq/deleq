import { StatusBadge } from "@/components/site/PageHead";
import { BRAND, CHAIN, isAddress } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { UNISWAP_V3, USDG } from "@/config/dex";
import { Addr, Callout, DocLink, H2, UI } from "@/components/docs/Prims";
import { EditorSketch, FlowSketch, VerdictSketch } from "@/components/docs/Sketches";
import { BIT_WORDS, BITS, type BitName } from "@/lib/mandate/bits";

const BLOCKSCOUT = (a: string) => `${CHAIN.explorer}/address/${a}?tab=contract`;

export function Introduction() {
  return (
    <>
      <H2 id="what">What Deleq is</H2>
      <p>
        Deleq lets you give a trading agent a <strong>mandate</strong> instead of your keys. A mandate names one agent address and says which ERC-20 tokens it may spend, how
        much per transaction and per UTC day, which addresses it may pay, which swap router it may use, and until when. A contract on {CHAIN.name},{" "}
        <strong>DeleqMandateGuard</strong>, enforces every rule each time the agent acts, and moves tokens straight from the owner&apos;s wallet. Before anything is signed, the
        site asks the guard&apos;s own check view and reads the token from chain, so you see why an action would pass or fail.
      </p>
      <H2 id="not">What it is not</H2>
      <ul>
        <li>Not a wallet and not custody: the guard never keeps a balance between transactions.</li>
        <li>Not a trading bot: it does not decide what to buy. A limit bounds how much an agent can lose; it does not make its trades good.</li>
        <li>Not a safety verdict on tokens: the token check lists what the chain says, and &ldquo;nothing found&rdquo; is not &ldquo;safe&rdquo;.</li>
        <li>Not financial advice, and not affiliated with Robinhood.</li>
      </ul>
      <H2 id="status">Status</H2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <tbody>
            <tr>
              <td>DeleqMandateGuard</td>
              <td>
                {guardLive() ? (
                  <>
                    <Addr a={CONTRACTS.guard} /> · block {CONTRACTS.block.toLocaleString("en-US")} ·{" "}
                    <a className="doc-link" href={BLOCKSCOUT(CONTRACTS.guard)} target="_blank" rel="noreferrer">
                      verified source on Blockscout
                    </a>{" "}
                    <StatusBadge status="Prototype" />
                  </>
                ) : (
                  "not deployed yet"
                )}
              </td>
            </tr>
            <tr>
              <td>{BRAND.symbol}</td>
              <td>{isAddress(BRAND.ca) ? <Addr a={BRAND.ca} /> : "not launched yet"} · not needed for anything on this site</td>
            </tr>
            <tr>
              <td>Console, dashboard, token check, example agent</td>
              <td>
                <StatusBadge status="Prototype" /> running today
              </td>
            </tr>
            <tr>
              <td>Swaps through Uniswap v3 SwapRouter02</td>
              <td>
                <StatusBadge status="Prototype" /> <Addr a={UNISWAP_V3.swapRouter02} />
              </td>
            </tr>
            <tr>
              <td>Swaps through Pons launch curves</td>
              <td>
                <StatusBadge status="Concept" /> native ETH, no recipient the guard can force
              </td>
            </tr>
            <tr>
              <td>Advanced risk checks and alerts with {BRAND.symbol}</td>
              <td>
                <StatusBadge status="Concept" /> planned, not built
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout tone="warn" title="No outside security review yet">
        The contract has unit, fuzz, invariant and fork tests and a written self-review. Start with small amounts.
      </Callout>
      <H2 id="next">Where to go next</H2>
      <ul>
        <li>
          <DocLink href="/docs/quickstart">Quickstart</DocLink>: practice mode in two minutes, then a real mandate in five steps.
        </li>
        <li>
          <DocLink href="/docs/concepts">Concepts</DocLink>: what every rule means.
        </li>
        <li>
          <DocLink href="/docs/agent">Agent integration</DocLink> and the <DocLink href="/docs/contract">contract reference</DocLink> if you are building a bot.
        </li>
      </ul>
    </>
  );
}

export function Quickstart() {
  return (
    <>
      <H2 id="practice">Practice mode in 2 minutes</H2>
      <p>
        Open <DocLink href="/console">/console</DocLink>. It starts in <UI>Practice</UI>: the guard&apos;s exact rules run in your browser on sample data. No wallet, no token,
        nothing is sent. The token check on the right is live already.
      </p>
      <ol>
        <li>
          Click <UI>Over the cap</UI>, then <UI>Check</UI>. The answer: <UI>Rejected · 1 reason</UI>, <UI>Over per-tx cap</UI>.
        </li>
        <li>
          Click <UI>Inside the limits</UI>, then <UI>Execute (practice)</UI>. The meter under USDG moves (<UI>… left today</UI>).
        </li>
        <li>
          Try <UI>Unknown recipient</UI> and <UI>Not the agent</UI>, then <UI>Jump to next UTC day</UI> to watch the daily cap reset. <UI>Reset sample</UI> starts over.
        </li>
      </ol>
      <H2 id="need">What you need on chain</H2>
      <ul>
        <li>
          An <strong>owner wallet</strong> with a little ETH on {CHAIN.name} for gas and the token the agent may spend, e.g. USDG <Addr a={USDG} />. Native ETH cannot be spent
          by the agent in this version: wrap it to WETH.
        </li>
        <li>
          An <strong>agent wallet</strong>: a separate address with a little ETH for gas. It needs no tokens. Never use the owner wallet as the agent.
        </li>
        <li>
          A <strong>recipient</strong> the agent may pay. The owner itself cannot be a recipient.
        </li>
        <li>
          A browser wallet. <UI>Connect wallet</UI> adds {CHAIN.name} (chain {CHAIN.id}) for you.
        </li>
      </ul>
      <H2 id="onchain">On chain in 5 steps</H2>
      <div className="doc-split">
        <ol>
          <li>
            <strong>Connect as owner.</strong> In <DocLink href="/console">/console</DocLink> switch to <UI>On chain</UI> and <UI>Connect wallet</UI> with the owner. If
            mandates exist already, click <UI>+ New mandate</UI>.
          </li>
          <li>
            <strong>Fill the mandate.</strong> <UI>Agent address (the key that may act)</UI>, a <UI>Label</UI>, caps under the token row (<UI>Per transaction</UI>,{" "}
            <UI>Per UTC day</UI>), one or more <UI>Recipients the agent may pay</UI>, then <UI>Create mandate on chain</UI> and confirm.
          </li>
          <li>
            <strong>Approve.</strong> With the new mandate selected, type the most the guard may ever pull into <UI>Approve USDG amount</UI> and click <UI>Approve</UI>.
          </li>
          <li>
            <strong>Act as the agent.</strong> Switch the wallet to the agent account. In <UI>Agent proposal</UI>: <UI>Pay</UI>, <UI>Token</UI>, <UI>Recipient</UI>,{" "}
            <UI>Amount (USDG)</UI>, then <UI>Check with the guard</UI>. On <UI>Inside the mandate</UI>, click <UI>Execute as agent</UI>.
          </li>
          <li>
            <strong>Watch and stop.</strong> <DocLink href="/dashboard">/dashboard</DocLink> lists every executed action with its transaction; the owner can{" "}
            <UI>Pause agent</UI> or <UI>Revoke</UI> there.
          </li>
        </ol>
        <EditorSketch />
      </div>
    </>
  );
}

const BitRow = ({ n }: { n: BitName }) => (
  <tr>
    <td className="font-mono">{BITS[n].toString(2).length - 1}</td>
    <td className="font-mono">{n}</td>
    <td>
      <span className="chip bad">{BIT_WORDS[n].label}</span>
    </td>
    <td>{BIT_WORDS[n].why}</td>
  </tr>
);

export function BitsTable() {
  return (
    <div className="overflow-x-auto" data-reveal="">
      <table className="tbl" data-testid="bits-table">
        <thead>
          <tr>
            <th>Bit</th>
            <th>Name</th>
            <th>Shown as</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(BITS) as BitName[]).map((n) => (
            <BitRow key={n} n={n} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Concepts() {
  return (
    <>
      <H2 id="mandate">Mandate</H2>
      <p>
        A mandate is a numbered record in DeleqMandateGuard: one owner, one agent, a list of token rules, allowlisted recipients and routers, a validity window, an optional
        number of actions per day, a label, a version that grows with every change, and two switches (paused, revoked). An owner can hold up to 64 mandates.
      </p>
      <H2 id="roles">Owner and agent</H2>
      <ul>
        <li>
          <strong>Owner</strong>: the wallet that created the mandate. Only the owner changes it, pauses, unpauses or revokes it. The owner&apos;s tokens are what the agent
          spends.
        </li>
        <li>
          <strong>Agent</strong>: the one address that may execute under the mandate. It can never change a limit; it can only pause itself.
        </li>
      </ul>
      <H2 id="caps">Caps</H2>
      <ul>
        <li>
          <strong>Per transaction</strong>: the most one action may move of a token.
        </li>
        <li>
          <strong>Per UTC day</strong>: the most all actions together may move of a token on one calendar day in UTC (timestamp / 86,400). It resets at 00:00 UTC, so up to
          twice a cap can move around one midnight.
        </li>
        <li>
          <strong>Actions per UTC day</strong>: how many payments and swaps the agent may make per day, across all tokens. 0 = no count limit.
        </li>
      </ul>
      <H2 id="allowlists">Allowlists</H2>
      <ul>
        <li>
          <strong>Tokens</strong> (up to 16): a token without a rule cannot be spent. For a swap, the token bought must be listed too (caps 0 is fine for a token the agent only
          receives).
        </li>
        <li>
          <strong>Recipients</strong> (up to 32): the only addresses a payment may go to.
        </li>
        <li>
          <strong>Routers</strong> (up to 4): swap routers the agent may use. The output always goes to the owner, never to the agent.
        </li>
      </ul>
      <H2 id="window">Validity window</H2>
      <p>Every mandate has a start (validFrom, default: now) and an expiry, at most 730 days apart. Outside the window every action is refused.</p>
      <H2 id="pause">Pause and revoke</H2>
      <p>
        The guard reads the mandate on every call, so a pause or revoke applies from the next transaction, in the same block if it comes later. A pause can be lifted by the
        owner; a revoke is final.
      </p>
      <H2 id="allowance">Non-custodial allowance model</H2>
      <div className="doc-split">
        <div>
          <p>
            The owner approves the guard for an ERC-20 amount, the usual way. That approval is a ceiling; the mandate&apos;s caps apply on top. Nothing is deposited: a payment is{" "}
            <code className="doc-ic">transferFrom(owner → recipient)</code>, and a swap pulls the amount into the guard, swaps it with the output sent to the owner and checks
            that nothing is left, inside one transaction.
          </p>
          <p>The allowance belongs to the owner and the guard, not to one mandate: two mandates of the same owner share it. Approve 0 to stop everything at the token level.</p>
        </div>
        <FlowSketch />
      </div>
      <H2 id="bits">Reason bitmask</H2>
      <p>
        <code className="doc-ic">checkTransfer</code> and <code className="doc-ic">checkSwap</code> return one bit per broken rule; 0 means the guard would let the action
        through. The execute functions run the same checks and revert with <code className="doc-ic">Rejected(reasons)</code>. The site uses the same positions (a test reads
        them from the Solidity library).
      </p>
      <VerdictSketch />
      <BitsTable />
      <p>
        The <DocLink href="/docs/contract#bits">contract reference</DocLink> shows how the bits are computed.
      </p>
    </>
  );
}
