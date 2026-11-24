import { JsonLd } from "@/components/JsonLd";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { BRAND, CHAIN, explorerAddress, explorerTx } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { ETH_USD_FEED, PONS, UNISWAP_V3, USDG, WETH } from "@/config/dex";
import { BIT_ORDER, BIT_WORDS, BITS } from "@/lib/mandate/bits";
import { POWERS } from "@/lib/tokencheck/selectors";
import { FAQ } from "@/lib/faq";
import { faqLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/method",
  title: "Method and limits",
  description: `How ${BRAND.name} enforces an agent mandate on ${CHAIN.name}: the rules, the nineteen reason bits, the non-custodial guard contract, the token check, and what none of it can promise.`,
});

const A = ({ a, children }: { a: string; children: React.ReactNode }) => (
  <a className="underline decoration-[var(--line-2)]" href={explorerAddress(a)} target="_blank" rel="noreferrer">
    {children}
  </a>
);

const STATUS: { s: "Prototype" | "Concept"; what: string }[] = [
  { s: "Prototype", what: "Mandate editor and checks in practice mode (sample data, same rules as the contract)" },
  { s: "Prototype", what: "Token check read from Robinhood Chain at one block (code, ERC-20, proxy slots, owner, selectors, Pons launch, Uniswap v3 pools)" },
  { s: "Prototype", what: "DeleqMandateGuard: mandates, check views, transfers and Uniswap v3 swaps (live on Robinhood Chain, source verified, bytecode checked against this build)" },
  { s: "Prototype", what: "Dashboard: executed actions from the guard's events, rejections from pre-checks, pause / unpause / revoke" },
  { s: "Prototype", what: "Example agent script (examples/agent.mjs): reads its mandate, checks, executes" },
  { s: "Concept", what: "Swaps through Pons launch curves (native ETH, no recipient the guard can force)" },
  { s: "Concept", what: `Advanced risk checks and alerts paid with ${BRAND.symbol}` },
];

export default function MethodPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHead eyebrow="Method" title="How the limits hold, and what they cannot do.">
        <p>Everything below describes the code as it is. Where the chain cannot answer, the site says &ldquo;Not known&rdquo; and never counts it as clear.</p>
      </PageHead>
      <div className="wrap doc py-12 pb-24">
        <section className="panel">
          <div className="panel-h">
            <span className="eyebrow">What runs today</span>
          </div>
          <div className="panel-b grid gap-2" data-testid="status-list">
            {STATUS.map((x) => (
              <p key={x.what} className="flex flex-wrap items-start gap-3 text-[14px]">
                <StatusBadge status={x.s} />
                <span className="min-w-0 flex-1">{x.what}</span>
              </p>
            ))}
          </div>
        </section>

        <h2 id="rules">The mandate</h2>
        <p>
          An owner creates a mandate for one agent address. It lists the ERC-20 tokens the agent may spend, each with a per-transaction cap and a daily cap; the recipients it may pay;
          the swap routers it may use; a start and an end time (at most 730 days); and optionally a number of actions per day. Daily caps and the action count use calendar UTC
          days (timestamp / 86,400): they reset at 00:00 UTC, so up to twice a cap can move across one midnight. That is a choice made for clarity, stated here and next to the caps.
        </p>
        <p>
          Only the owner can change a mandate. Every change bumps its version and emits an event. Pause and revoke are read on every call, so they apply from the next transaction,
          in the same block if it comes later. Revoke is final. The agent cannot change any limit; it can only pause itself.
        </p>

        <h2 id="bits">Reason bits</h2>
        <p>
          Before anything is signed, the proposal goes through <code>checkTransfer</code> or <code>checkSwap</code>, view functions of the guard that return one bit per broken rule.
          The site runs the same rules in TypeScript; a test reads the bit positions from the Solidity library, and the end-to-end test compares both answers on a chain.
        </p>
        <div className="overflow-x-auto">
          <table className="tbl mt-4" data-testid="bits-table">
            <thead>
              <tr>
                <th>Bit</th>
                <th>Name</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {BIT_ORDER.map((n) => (
                <tr key={n}>
                  <td className="font-mono">{BITS[n].toString(2).length - 1}</td>
                  <td className="font-mono">{n}</td>
                  <td>{BIT_WORDS[n].why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="contract">The contract</h2>
        <p>
          <strong>DeleqMandateGuard</strong> (with the internal library DeleqLimitMath) is{" "}
          {guardLive() ? (
            <>
              deployed at <A a={CONTRACTS.guard}>{CONTRACTS.guard}</A> (block {CONTRACTS.block.toLocaleString("en-US")}, creation transaction{" "}
              <a className="underline decoration-[var(--line-2)]" href={explorerTx(CONTRACTS.tx)} target="_blank" rel="noreferrer">
                {CONTRACTS.tx.slice(0, 10)}…
              </a>
              ). Its source is verified on the explorer (exact match on Sourcify), and <code>npm run verify-deployment</code> in the repository prints MATCH for it: the code at that address is this build.
            </>
          ) : (
            <>not deployed on {CHAIN.name} yet. The owner deploys it from a local-only tool; this page will then link it.</>
          )}{" "}
          It is non-custodial: a transfer is <code>transferFrom(owner → recipient)</code> under the owner&apos;s own allowance to the guard. A swap pulls the amount from the owner,
          approves exactly that amount to an allowlisted router, calls Uniswap v3 <code>exactInputSingle</code> with the recipient forced to the owner and a non-zero minimum output,
          resets the approval to zero, measures what the owner received, and reverts if anything is left in the guard. No admin, no fee, no upgrade, no owner over other
          people&apos;s mandates.
        </p>
        <ul className="list-disc pl-5">
          <li>Native ETH is not supported in this version: wrap it to WETH first.</li>
          <li>Fee-on-transfer tokens are refused: the recipient must receive exactly the amount sent, or the whole call reverts.</li>
          <li>Tokens that return nothing from transfer and approve are handled; a token that returns false is refused.</li>
          <li>Reentrancy is blocked by a lock and by recording the spend before any token call.</li>
          <li>
            The only router offered by the site is Uniswap v3 SwapRouter02 at <A a={UNISWAP_V3.swapRouter02}>{UNISWAP_V3.swapRouter02}</A> (its <code>factory()</code> and{" "}
            <code>WETH9()</code> answer <A a={UNISWAP_V3.factory}>the v3 factory</A> and <A a={WETH}>WETH</A>). It was tested with the guard on a fork of {CHAIN.name}: swapping WETH
            for <A a={USDG}>USDG</A> paid the owner and left nothing in the guard.
          </li>
          <li>
            A router the owner allowlists can take at most the amount of one approved swap; the minimum output is the agent&apos;s choice, so a careless agent can still get a bad
            price inside its caps.
          </li>
        </ul>
        <p>
          Tests: unit, fuzz and invariant tests with hostile tokens (no-return, false-return, fee-on-transfer, reentrant) and lying routers, plus fork tests against {CHAIN.name}.
          A written self-review is in the repository. The contract has not had an outside security review: use small amounts first.
        </p>

        <h2 id="token-check">The token check</h2>
        <p>
          Next to each proposal the site reads the token at the head block: contract code; <code>name</code>, <code>symbol</code>, <code>decimals</code>, <code>totalSupply</code>;
          the ERC-1967 implementation, admin and beacon slots and minimal proxies; <code>owner()</code>; a scan of the runtime code (and the implementation behind a plain proxy) for
          the selectors of {Object.values(POWERS).length} kinds of power ({Object.values(POWERS).map((p) => p.label.toLowerCase()).join(", ")}); whether it launched through the
          Pons factory <A a={PONS.factory}>{PONS.factory}</A>; and Uniswap v3 pools against WETH or USDG at the four fee tiers with their balances. Each row shows the method and
          the address it came from.
        </p>
        <p>
          The live ticker on the home page reads the head block, the gas price and the Chainlink ETH / USD feed <A a={ETH_USD_FEED}>{ETH_USD_FEED}</A> with its update time.
        </p>

        <h2 id="limits">Limits</h2>
        <ul className="list-disc pl-5">
          <li>A limit bounds how much an agent can lose per transaction and per day; it does not make the agent&apos;s decisions good.</li>
          <li>A clean token check means only that the check found nothing it looks for. A token can still lose its value; an issuer can still block or pause.</li>
          <li>Rejections are recorded from pre-checks in your browser; a transaction someone sends anyway and that reverts leaves no event.</li>
          <li>Executed actions are read from the guard&apos;s logs. If the RPC cannot read part of the range, the dashboard says the list may be incomplete.</li>
        </ul>

        <h2 id="faq">Questions</h2>
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
    </>
  );
}
