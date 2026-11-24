import { StatusBadge } from "@/components/site/PageHead";
import { CHAIN } from "@/config/brand";
import { PONS, UNISWAP_V3, USDG, WETH } from "@/config/dex";
import { Addr, Callout, Code, DocLink, H2, UI } from "@/components/docs/Prims";
import { VerdictSketch } from "@/components/docs/Sketches";
import { POWERS } from "@/lib/tokencheck/selectors";

const Field = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <>
    <dt>{k}</dt>
    <dd>{children}</dd>
  </>
);

export function ConsoleGuide() {
  return (
    <>
      <H2 id="modes">Practice and On chain</H2>
      <p>
        The switch at the top of <DocLink href="/console">/console</DocLink> picks the mode. <UI>Practice</UI> keeps a sample mandate, sample balances and the usage counters
        in your browser (<UI>Sample data · nothing is sent</UI>). <UI>On chain</UI> reads and writes the live guard; connect a wallet to load the mandates you own or are the
        agent of, listed under <UI>Your mandates on chain</UI> (<UI>+ New mandate</UI> drafts another, <UI>Reload</UI> re-reads).
      </p>
      <H2 id="editor">Mandate panel</H2>
      <dl className="doc-dl">
        <Field k="Agent address (the key that may act)">The only address that may execute. Read-only once a mandate exists.</Field>
        <Field k="Label">Up to 31 ASCII characters, stored on chain.</Field>
        <Field k="Actions per UTC day (0 = no limit)">Counts every payment and swap.</Field>
        <Field k="Valid for (days, max 730)">Shown while drafting; an existing mandate shows its dates and state instead.</Field>
        <Field k="Tokens the agent may spend">
          One card per token with <UI>Per transaction</UI> and <UI>Per UTC day</UI>, a meter and <UI>… left today</UI>. Add one with <UI>Add a token address 0x…</UI> +{" "}
          <UI>Add</UI> (symbol and decimals are read from the token), drop it with <UI>Remove</UI>. The heading says when caps reset.
        </Field>
        <Field k="Recipients the agent may pay">
          Chips with <UI>×</UI> to remove; paste an address and <UI>Add</UI>.
        </Field>
        <Field k="Swap routers (output always goes to the owner)">
          <UI>Uniswap v3 SwapRouter02</UI> <StatusBadge status="Prototype" />. Pons launch curves are <StatusBadge status="Concept" />.
        </Field>
        <Field k="Jump to next UTC day / Reset sample">Practice only: move the practice clock past midnight UTC, or start the sample again.</Field>
        <Field k="Create mandate on chain">On chain, while drafting: sends createMandate from your wallet; you become the owner.</Field>
      </dl>
      <H2 id="approve">Approvals</H2>
      <p>
        With an on-chain mandate selected, each token card shows <UI>Owner allowance to the guard</UI>, a field <UI>Approve USDG amount</UI> (named after the token) and an{" "}
        <UI>Approve</UI> button. It sends a plain ERC-20 approve to the token for the guard address. See the{" "}
        <DocLink href="/docs/concepts#allowance">allowance model</DocLink>.
      </p>
      <H2 id="proposal">Agent proposal</H2>
      <dl className="doc-dl">
        <Field k="Pay / Swap">The kind of action.</Field>
        <Field k="Practice presets">
          <UI>Over the cap</UI>, <UI>Unknown recipient</UI>, <UI>Not the agent</UI>, <UI>Inside the limits</UI> fill the form with a typical case.
        </Field>
        <Field k="Sent by (caller)">The address the check is run for. On chain it starts as the mandate&apos;s agent.</Field>
        <Field k="Token / Sell token">Listed tokens plus USDG and WETH; <UI>Other token address…</UI> for anything else.</Field>
        <Field k="Recipient">Payments only.</Field>
        <Field k="Buy token (output goes to the owner), Router, Pool fee tier, Minimum output">
          Swaps only. The fee tier picks the Uniswap v3 pool (0.01 %, 0.05 %, 0.3 %, 1 %). Minimum output must be above 0.
        </Field>
        <Field k="Amount">In token units, as typed (e.g. 12.5).</Field>
        <Field k="Check / Check with the guard">Practice: runs the rules locally. On chain: calls the guard&apos;s checkTransfer / checkSwap view.</Field>
        <Field k="Execute (practice) / Execute as agent">
          Practice updates the sample counters. On chain it works only when the connected wallet is the agent; it simulates first, then asks your wallet to sign, then shows{" "}
          <UI>View the transaction</UI>.
        </Field>
      </dl>
      <H2 id="answer">The answer</H2>
      <div className="doc-split">
        <p>
          <UI>Inside the mandate</UI> or <UI>Rejected · N reasons</UI> with one chip and one sentence per reason. On chain, the line below compares the contract&apos;s bits with
          the site&apos;s engine (<UI>match</UI> or <UI>differ</UI> — a difference usually means a balance or allowance changed between the two reads). Every check is also written
          to the dashboard&apos;s local log.
        </p>
        <VerdictSketch />
      </div>
    </>
  );
}

export function DashboardGuide() {
  return (
    <>
      <H2 id="executed">Executed actions</H2>
      <p>
        The panel <UI>Executed actions · from the guard&apos;s events</UI> reads the guard on {CHAIN.name} for the owner in <UI>Owner address (empty = your connected wallet)</UI>.
        Any address can be looked up; only its owner sees the buttons.
      </p>
      <ul>
        <li>One card per mandate: label, agent, actions, version, state (<UI>Active</UI>, <UI>Paused</UI>, <UI>Revoked</UI>), and today&apos;s spend per token with a meter.</li>
        <li>
          A table of events (block, mandate, event, receipt link): <Code>TransferExecuted</Code>, <Code>SwapExecuted</Code> and every change, newest first. The{" "}
          <Code>ref</Code> an agent attached is shown when set.
        </li>
        <li>It re-reads every 15 seconds while the tab is visible. If part of the block range could not be read, it says the list may be incomplete.</li>
      </ul>
      <H2 id="log">Checks and rejections</H2>
      <p>
        <UI>Checks and rejections · this browser</UI> keeps every check and practice execution from the console, with its reasons. A transaction that reverts leaves no event,
        so refusals live here only, in this browser. Filter with <UI>all</UI>, <UI>rejected</UI>, <UI>executed</UI>; <UI>Clear</UI> empties it.
      </p>
      <H2 id="controls">Pause, unpause, revoke</H2>
      <dl className="doc-dl">
        <Field k="Pause agent">Every execute is refused from the next transaction on. The agent can also pause itself (agentPause).</Field>
        <Field k="Unpause">Owner only.</Field>
        <Field k="Revoke">After a confirmation prompt. Final: nothing can execute or change under the mandate again. Create a new one instead.</Field>
      </dl>
    </>
  );
}

export function TokenCheckGuide() {
  const powers = Object.values(POWERS);
  return (
    <>
      <H2 id="how">How a check is read</H2>
      <p>
        The server reads the token at the head block of {CHAIN.name} in one batch and shows that block and its time at the top of the panel. Every row names the method and
        the contract it came from. The same answer is available as JSON from <DocLink href="/docs/api#token-check">/api/token-check</DocLink>. Complete answers are kept 60
        seconds; answers with an unread row are never cached.
      </p>
      <H2 id="rows">Rows</H2>
      <div className="overflow-x-auto" data-reveal="">
        <table className="tbl">
          <thead>
            <tr>
              <th>Row</th>
              <th>Read with</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Contract code</td>
              <td>eth_getCode</td>
              <td>No code = not a token contract.</td>
            </tr>
            <tr>
              <td>ERC-20 metadata · Total supply (raw)</td>
              <td>name(), symbol(), decimals(), totalSupply()</td>
              <td>Answers as an ERC-20, or Not known.</td>
            </tr>
            <tr>
              <td>Upgradeable proxy · Proxy admin</td>
              <td>ERC-1967 implementation, admin and beacon slots; EIP-1167 minimal proxy</td>
              <td>The code can be replaced or delegates elsewhere.</td>
            </tr>
            <tr>
              <td>Stock-token beacon</td>
              <td>ERC-1967 beacon slot</td>
              <td>Uses the beacon Robinhood stock tokens use. Not proof of which share it tracks; the issuer can pause, block and burn.</td>
            </tr>
            <tr>
              <td>owner()</td>
              <td>owner()</td>
              <td>An address, renounced (zero), or Not known.</td>
            </tr>
            {powers.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td className="font-mono text-[11.5px]">{p.signatures.join(", ")}</td>
                <td>Selector found in the runtime code (and the implementation behind a plain proxy).</td>
              </tr>
            ))}
            <tr>
              <td>Pons launch</td>
              <td>
                getLaunchedToken on <Addr a={PONS.factory} />
              </td>
              <td>Launched through Pons, and its phase.</td>
            </tr>
            <tr>
              <td>Uniswap v3 pool …</td>
              <td>
                getPool on <Addr a={UNISWAP_V3.factory} /> vs <Addr a={WETH}>WETH</Addr> / <Addr a={USDG}>USDG</Addr> at 4 fee tiers, then balanceOf(pool)
              </td>
              <td>Where it trades and how much sits in each pool.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <H2 id="tones">Tones and Not known</H2>
      <p>
        <span className="tone t-ok">ok</span> nothing found that the row looks for · <span className="tone t-info">info</span> a fact ·{" "}
        <span className="tone t-warn">warn</span> worth reading · <span className="tone t-risk">risk</span> a power over holders exists ·{" "}
        <span className="tone t-unknown">Not known</span> the read failed; it is never counted as clear.
      </p>
      <H2 id="limits">Limits</H2>
      <Callout tone="warn" title="A clean check is not a safe token">
        A selector in the bytecode means the code can do something, not that it will; &ldquo;No known selector&rdquo; is not proof of absence. Behind a beacon proxy the
        implementation is not scanned. Holders, liquidity locks and off-chain promises are not checked.
      </Callout>
    </>
  );
}
