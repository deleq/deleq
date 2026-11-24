import { CodeBlock } from "@/components/docs/CodeBlock";
import { Addr, Callout, Code, DocLink, H2, Tx } from "@/components/docs/Prims";
import { BitsTable } from "@/components/docs/content/Start";
import { BRAND, CHAIN, hasGithub } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { ERRORS, ERROR_DOCS, EVENTS, EVENT_DOCS, FN_DOCS, FUNCTIONS, GAS } from "@/lib/docs/abi";
import { AGENT_COMMANDS, AGENT_ENV, AGENT_OUTPUT, VIEM_SNIPPET } from "@/lib/docs/snippets";
import { COST, BUDGET } from "@/lib/relay";
import { FAQ } from "@/lib/faq";

const BLOCKSCOUT = `${CHAIN.explorer}/address/${CONTRACTS.guard}?tab=contract`;
const SOURCIFY = `https://repo.sourcify.dev/${CHAIN.id}/${CONTRACTS.guard}`;

function FnList({ write }: { write: boolean }) {
  const list = FUNCTIONS.filter((f) => (f.mutability === "nonpayable") === write);
  return (
    <div className="grid gap-4">
      {list.map((f) => {
        const d = FN_DOCS[f.name];
        return (
          <div key={f.name} className="doc-ref" id={`fn-${f.name}`} data-reveal="">
            <p className="doc-ref-h">
              <a href={`#fn-${f.name}`} className="doc-anchor" aria-label={`Link to ${f.name}`}>
                #
              </a>
              <span className="font-mono">{f.name}</span>
              <span className="chip">{f.selector}</span>
              <span className="chip">{f.mutability}</span>
            </p>
            <pre className="doc-sig">
              <code>{f.signature}</code>
            </pre>
            <dl className="doc-dl compact">
              <dt>Who may call</dt>
              <dd>{d.who}</dd>
              <dt>Effect</dt>
              <dd>{d.does}</dd>
              {d.emits ? (
                <>
                  <dt>Emits</dt>
                  <dd>{d.emits}</dd>
                </>
              ) : null}
              {d.reverts ? (
                <>
                  <dt>Reverts with</dt>
                  <dd>{d.reverts}</dd>
                </>
              ) : null}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

export function ContractRef() {
  return (
    <>
      <H2 id="deployment">Deployment</H2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <tbody>
            <tr>
              <td>Contract</td>
              <td>DeleqMandateGuard (with the internal library DeleqLimitMath, inlined)</td>
            </tr>
            <tr>
              <td>Network</td>
              <td>
                {CHAIN.name}, chain id {CHAIN.id}
              </td>
            </tr>
            <tr>
              <td>Address</td>
              <td>{guardLive() ? <Addr a={CONTRACTS.guard} /> : "not deployed yet"}</td>
            </tr>
            {guardLive() ? (
              <>
                <tr>
                  <td>Creation</td>
                  <td>
                    block {CONTRACTS.block.toLocaleString("en-US")} · <Tx h={CONTRACTS.tx} />
                  </td>
                </tr>
                <tr>
                  <td>Verification</td>
                  <td>
                    <a className="doc-link" href={BLOCKSCOUT} target="_blank" rel="noreferrer">
                      Blockscout (verified source)
                    </a>{" "}
                    ·{" "}
                    <a className="doc-link" href={SOURCIFY} target="_blank" rel="noreferrer">
                      Sourcify (exact match, creation and runtime)
                    </a>
                  </td>
                </tr>
              </>
            ) : null}
            <tr>
              <td>Compiler</td>
              <td>solc 0.8.28, optimizer 200 runs, EVM paris, no via-IR, no metadata hash</td>
            </tr>
            <tr>
              <td>Admin, fee, upgrade</td>
              <td>None. No constructor arguments, no payable function, no receive().</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Check that the address runs exactly this repository&apos;s build:</p>
      <CodeBlock
        lang="shell"
        code={`npm run verify-deployment -- --guard ${CONTRACTS.guard || "<address>"} --guard-tx ${CONTRACTS.tx || "<creation tx>"}
# prints MATCH when the runtime code and the creation input equal this build`}
      />
      <H2 id="types">Types</H2>
      <CodeBlock
        lang="solidity"
        code={`struct MandateInit {
    address agent;
    uint64 validFrom;          // 0 = now
    uint64 expiry;
    uint32 maxActionsPerDay;   // 0 = no count limit
    bytes32 label;
    TokenInit[] tokens;        // { address token; uint128 perTxCap; uint128 dailyCap; }
    address[] recipients;
    address[] routers;
}

struct SwapOrder {
    address router;
    address tokenIn;
    address tokenOut;
    uint24 fee;                // Uniswap v3 fee tier
    uint256 amountIn;
    uint256 minOut;            // must be > 0
    bytes32 ref;               // free reference, only logged
}`}
      />
      <p>
        These match the tuples in the signatures below, which are generated from the compiled ABI (selectors included). <Code>getMandate</Code> returns{" "}
        <Code>Mandate</Code>: owner, agent, validFrom, expiry, maxActionsPerDay, version, paused, revoked, label, createdAt, actions.
      </p>
      <H2 id="write">Write functions</H2>
      <FnList write />
      <H2 id="read">Read functions</H2>
      <FnList write={false} />
      <H2 id="events">Events</H2>
      <div className="grid gap-3">
        {EVENTS.map((e) => (
          <div key={e.name} className="doc-ref" data-reveal="">
            <p className="doc-ref-h">
              <span className="font-mono">{e.name}</span>
            </p>
            <pre className="doc-sig">
              <code>{e.signature}</code>
            </pre>
            <p className="small">{EVENT_DOCS[e.name]}</p>
            <p className="font-mono text-[10.5px] text-[var(--faint)] [overflow-wrap:anywhere]">topic0 {e.topic0}</p>
          </div>
        ))}
      </div>
      <H2 id="errors">Errors</H2>
      <div className="overflow-x-auto" data-reveal="">
        <table className="tbl">
          <thead>
            <tr>
              <th>Error</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {ERRORS.map((e) => (
              <tr key={e.name}>
                <td className="font-mono">{e.signature.replace(/^error /, "")}</td>
                <td>{ERROR_DOCS[e.name]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H2 id="bits">Reason bits</H2>
      <p>
        Order of evaluation: unknown mandate (stops), revoked, paused, not started, expired, not the agent, daily action count; then for a payment the recipient, for a swap
        the router, same token, output token listed and minimum output; then the spent token: listed, zero amount, per-tx cap, daily cap, and the owner&apos;s allowance and
        balance (read with staticcall; a token that does not answer sets TOKEN_UNREADABLE). Several bits can be set at once.
      </p>
      <BitsTable />
      <H2 id="gas">Gas</H2>
      <div className="overflow-x-auto" data-reveal="">
        <table className="tbl">
          <thead>
            <tr>
              <th>Call</th>
              <th>Gas</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {GAS.map((g) => (
              <tr key={g.fn}>
                <td className="font-mono">{g.fn}</td>
                <td className="font-mono">{g.gas}</td>
                <td>{g.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Gas is paid in ETH; at the gas prices seen on {CHAIN.name} on 24 Nov 2026 (about 0.02 gwei) these are tiny amounts.</p>
      <H2 id="invariants">Invariants</H2>
      <p>Checked by an invariant suite (random owners, agents, strangers, pauses and time jumps across UTC days, 64 runs × 48 calls) and by unit and fork tests:</p>
      <ul>
        <li>The guard holds no token balance and no router allowance between transactions.</li>
        <li>No UTC day ever moves more than the daily cap of a token.</li>
        <li>Nothing moves while the mandate is paused, and nobody but the agent ever moves anything.</li>
        <li>Owner funds only leave to an allowlisted recipient or into a swap whose output returns to the owner.</li>
      </ul>
      <H2 id="library">DeleqLimitMath</H2>
      <p>
        An internal library (inlined into the guard): the reason-bit constants (<Code>R_UNKNOWN_MANDATE</Code> … <Code>R_TOKEN_UNREADABLE</Code>), <Code>dayOf(ts)</Code>{" "}
        (timestamp / 86,400), <Code>spentOn</Code> (a stale day reads as 0), <Code>amountBits</Code>, <Code>stateBits</Code>, <Code>countBits</Code> and{" "}
        <Code>remaining</Code>. The site&apos;s TypeScript engine mirrors it; a unit test reads the bit positions from the Solidity file.
      </p>
    </>
  );
}

export function AgentRef() {
  return (
    <>
      <H2 id="example">examples/agent.mjs</H2>
      <p>
        A small agent in the repository (Node.js and viem). It reads its mandate, asks the guard&apos;s check view, and sends a transaction only when the answer is 0. Run it
        from the project folder after <Code>npm install</Code>.
      </p>
      <CodeBlock lang="shell · environment" code={AGENT_ENV} />
      <CodeBlock lang="shell · commands" code={AGENT_COMMANDS} />
      <CodeBlock lang="output (sample)" code={AGENT_OUTPUT} />
      <div className="overflow-x-auto" data-reveal="">
        <table className="tbl">
          <thead>
            <tr>
              <th>Exit code</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-mono">0</td>
              <td>Executed (or status printed).</td>
            </tr>
            <tr>
              <td className="font-mono">3</td>
              <td>Refused by the check: the reasons are printed, nothing was sent.</td>
            </tr>
            <tr>
              <td className="font-mono">1</td>
              <td>Error (missing variables, RPC failure, a revert in simulation).</td>
            </tr>
          </tbody>
        </table>
      </div>
      <H2 id="viem">Minimal viem integration</H2>
      <p>The ABI lines below are generated from the compiled contract; a test parses them and compares every selector with the artifact.</p>
      <CodeBlock lang="javascript" code={VIEM_SNIPPET} />
      <p>
        For swaps call <Code>checkSwap(id, caller, order)</Code> and <Code>executeSwapV3(id, order)</Code> with a <DocLink href="/docs/contract#types">SwapOrder</DocLink>. The
        guard forces the output to the owner; set <Code>minOut</Code> from your own quote.
      </p>
      <H2 id="keys">Keys</H2>
      <Callout tone="warn" title="Never paste a private key into a website">
        Not this one, not any other. Deleq never asks for one: the owner signs in their own wallet, and a bot keeps the agent key on its own machine (an environment variable
        set in its own terminal). Use a separate agent key with only a little ETH for gas.
      </Callout>
    </>
  );
}

export function ApiRef() {
  const methods = Object.entries(COST)
    .map(([m, c]) => `${m} (${c})`)
    .join(", ");
  return (
    <>
      <H2 id="overview">Overview</H2>
      <p>
        Base URL <Code>{BRAND.url}</Code>. JSON over HTTPS, no key, read-only: nothing here signs or sends a transaction. Big numbers are decimal strings. Limits are per
        network per minute (IPv6 counted per /64); a refused call answers 429 with <Code>{`{"error": "…"}`}</Code>. Errors are 400 (bad input) or 503 (the chain did not
        answer).
      </p>
      <H2 id="chain">GET /api/chain</H2>
      <p>Live facts for the whole site, refreshed at most every 8 seconds. 60 requests per minute.</p>
      <CodeBlock
        lang="json"
        code={`{
  "block": 122219359,            // head block
  "time": 1795522889,            // its timestamp (unix seconds)
  "blockSeconds": 0.106,         // average over the last 100,000 blocks
  "gasPriceWei": "20000000",
  "ethUsd": { "price": 1701.87, "updatedAt": 1795521358, "feed": "0x78f3…d3a9" },  // Chainlink, or null
  "guardCode": true,             // DeleqMandateGuard has code, or null when not configured
  "readAt": 1795522890863
}`}
      />
      <H2 id="token-check">GET /api/token-check</H2>
      <p>
        <Code>?token=0x…</Code> (40 hex characters). The rows of the <DocLink href="/docs/token-check">token check</DocLink>. 30 requests per minute; a complete answer is
        cached 60 seconds per token.
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "token": "0x5fc5…d168", "block": 121971140, "checkedAt": 1795495865,
  "name": "Global Dollar", "symbol": "USDG", "decimals": 6,
  "rows": [
    { "key": "erc20", "label": "ERC-20 metadata", "value": "Global Dollar · USDG · 6 decimals",
      "tone": "ok", "source": { "method": "name() symbol() decimals() totalSupply()", "address": "0x5fc5…d168" } }
    // … tone is ok | info | warn | risk | unknown
  ],
  "flags": ["proxy", "power-mint", "power-upgrade"]
}`}
      />
      <H2 id="activity">GET /api/activity</H2>
      <p>
        <Code>?owner=0x…</Code> or <Code>?agent=0x…</Code> (one of them). Mandates from the guard&apos;s views and every guard event for them from its logs (newest first, up to
        300). 30 requests per minute; a complete answer is cached 8 seconds (<Code>&amp;fresh=1</Code> skips the cache after your own transaction).
      </p>
      <CodeBlock
        lang="json"
        code={`{
  "deployed": true, "guard": "${CONTRACTS.guard || "0x…"}", "head": 122220130,
  "mandates": [{
    "id": 1, "owner": "0x…", "agent": "0x…", "validFrom": 1795496543, "expiry": 1798088545,
    "maxActionsPerDay": 10, "version": 5, "paused": false, "revoked": false, "label": "demo bot",
    "createdAt": 1795496543, "actions": 2, "actionsToday": 2,
    "tokens": [{ "token": "0x5fc5…d168", "perTxCap": "10000000", "dailyCap": "25000000",
                 "listed": true, "spentToday": "8000000", "leftToday": "17000000" }],
    "recipients": ["0x…"], "routers": []
  }],
  "events": [{ "name": "TransferExecuted", "id": 1, "block": 122220001, "tx": "0x…", "logIndex": 3,
               "args": { "amount": "8000000", "to": "0x…", "spentToday": "8000000", "ref": "0x…" } }],
  "scanned": { "fromBlock": ${CONTRACTS.block || 0}, "toBlock": 122220130, "gaps": [], "complete": true }
}`}
      />
      <H2 id="rpc">POST /api/rpc</H2>
      <p>
        A JSON-RPC relay for the browser (some networks intercept the public RPC host). It forwards only these read methods, priced in units: {methods}. Calls go to the
        guard, USDG, WETH, the ETH/USD feed and {BRAND.symbol}, or to any address for a short list of plain ERC-20 reads; at most 20 calls per batch, no state overrides, gas
        capped. Budget: {BUDGET.units.toLocaleString("en-US")} units per network per {BUDGET.windowSec / 60} minutes. It never forwards a signed transaction.
      </p>
    </>
  );
}

export function SecurityRef() {
  return (
    <>
      <H2 id="trust">Trust assumptions</H2>
      <ul>
        <li>
          <strong>Routers</strong> are trusted with one swap&apos;s amount. The site offers only Uniswap v3 SwapRouter02, tested with the guard on a fork. A router an owner adds
          by hand could keep the input of a swap; the guard only checks that the owner received at least minOut.
        </li>
        <li>
          <strong>minOut is the agent&apos;s choice.</strong> A careless or compromised agent can accept a bad price, bounded by its caps. There is no price oracle check.
        </li>
        <li>
          <strong>The allowance is shared per owner.</strong> Two mandates of one owner draw on the same ERC-20 approval to the guard; each mandate&apos;s caps still bound its
          own agent.
        </li>
        <li>
          <strong>UTC days.</strong> Daily caps reset at 00:00 UTC; up to twice a cap can move around one midnight.
        </li>
        <li>
          <strong>64 mandates per owner</strong>, revoked ones included.
        </li>
        <li>
          <strong>Tokens can refuse.</strong> A stock token can block an address or pause; a fee-on-transfer token is refused by the guard. Native ETH is not supported.
        </li>
      </ul>
      <H2 id="operator">What the site can and cannot do</H2>
      <ul>
        <li>
          It <strong>cannot</strong> move your tokens, change your mandates, pause anyone, or upgrade the contract: the guard has no admin.
        </li>
        <li>
          It <strong>can</strong> show you wrong information, like any website. Before signing, read your wallet&apos;s prompt (target is the guard, the agent address is yours),
          and cross-check the guard&apos;s views on the explorer.
        </li>
        <li>Rejections are kept in your browser only; the site&apos;s server keeps short caches of chain reads and rate-limit counters, nothing about your wallet beyond that.</li>
      </ul>
      <H2 id="review">Self-review findings</H2>
      <ol>
        <li>F1 · minOut chosen by the agent (accepted, documented above).</li>
        <li>F2 · routers added by hand are trusted with one swap (accepted; the site offers one tested router).</li>
        <li>F3 · UTC days allow 2× a cap around midnight (by design, documented).</li>
        <li>F4 · one allowance per owner for all mandates (documented).</li>
        <li>F5 · 64 mandates per owner including revoked ones (accepted for v1).</li>
        <li>Also checked: reentrancy (blocked and tested), no-return and false-return tokens, fee-on-transfer (refused), lying routers, leftover balances, pause in the same block.</li>
      </ol>
      <p>No outside security review yet. Start with small amounts.</p>
      <H2 id="report">Report a problem</H2>
      <p>
        Please do not post a suspected vulnerability publicly.{" "}
        {hasGithub ? (
          <>
            Use private vulnerability reporting on GitHub: open the <strong>Security</strong> tab of{" "}
            <a className="doc-link" href={BRAND.github} target="_blank" rel="noreferrer">
              the repository
            </a>{" "}
            and choose <strong>Report a vulnerability</strong>.
          </>
        ) : (
          <>Send a direct message to {BRAND.xHandle} on X asking for a private channel; do not include details in public.</>
        )}{" "}
        There is no bug bounty.
      </p>
    </>
  );
}

export function FaqRef() {
  return (
    <>
      <H2 id="faq">Questions</H2>
      <div className="faq">
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
    </>
  );
}

export function Changelog() {
  return (
    <>
      <H2 id="2026-11-24">24 Nov 2026</H2>
      <ul>
        <li>
          DeleqMandateGuard deployed on {CHAIN.name}
          {guardLive() ? (
            <>
              {" "}
              at <Addr a={CONTRACTS.guard} /> (block {CONTRACTS.block.toLocaleString("en-US")}), source verified on Blockscout and Sourcify, bytecode matched with{" "}
              <Code>verify-deployment</Code>
            </>
          ) : null}
          .
        </li>
        <li>{BRAND.symbol} launched{BRAND.ca.startsWith("0x") ? <> at <Addr a={BRAND.ca} /></> : null}. Nothing on the site requires it.</li>
        <li>Site live: console with practice and on-chain modes, live token check, dashboard with pause and revoke, example agent, and these docs.</li>
      </ul>
    </>
  );
}
