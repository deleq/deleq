# Deleq

Deleq is for people who want a trading agent to act on their behalf without handing it their keys. Instead of a private key or an unlimited approval, the agent gets a mandate: which ERC-20 tokens it may spend, a per-transaction cap and a daily cap for each, which addresses it may pay, which swap router it may use, and until when. Every proposal is checked against that mandate (and against what Robinhood Chain says about the token) before anything is signed, and a guard contract enforces the same rules on chain, moving tokens straight from the owner's wallet.

Delegate with Limits. Agent permissions & spending controls for Robinhood Chain.

## Read this before anything else

This repository is the working code behind https://deleq.xyz.

- **What runs today.** The console (`/console`) with a practice mode that runs the guard's rules on sample data in the browser, the on-chain mode that creates mandates and asks the guard's own check view, the dashboard (`/dashboard`) with executed actions, rejected proposals, pause and revoke, and an example agent script (`examples/agent.mjs`).
- **What reads live data.** The token check next to each proposal reads the token from Robinhood Chain at one block (code, ERC-20 metadata, proxy slots, `owner()`, function selectors in the bytecode, Pons launch, Uniswap v3 pools). The home page ticker reads the head block, gas price and the Chainlink ETH / USD feed. The dashboard reads the guard's events.
- **The contract.** `DeleqMandateGuard` is written and tested (unit, fuzz, invariant and Robinhood Chain fork tests) but **not deployed yet**. It never holds a balance between transactions, has no admin, no fee and no upgrade path, and has not had an outside security review.
- **Planned, not built.** Swaps through Pons launch curves, and advanced risk checks and alerts paid with $DELEQ. Both are labelled Concept on the site.
- **What nothing here claims.** A limit bounds how much an agent can lose per transaction and per day; it does not make its trades good. A clean token check does not make a token safe. $DELEQ has no promised value.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages (`/`, `/console`, `/dashboard`, `/method`, `/token`, local-only `/deploy`) and API routes (`/api/chain`, `/api/rpc`, `/api/token-check`, `/api/activity`). |
| `src/components/` | Interface components: home sections, console, dashboard, wallet dialog. |
| `src/config/` | `brand.ts` (name, ticker, token address, links), `contracts.ts` (guard address), `dex.ts` (Robinhood Chain addresses read on chain). |
| `src/lib/mandate/` | The mandate rules in TypeScript (`engine.ts`, `bits.ts`), the same as the contract, plus practice-mode storage. |
| `src/lib/server/` | Server-side chain reads: token check, mandate activity from logs, live chain snapshot. |
| `contracts/` | Solidity sources (`src/DeleqMandateGuard.sol`, `src/DeleqLimitMath.sol`) and Foundry tests (`test/`). |
| `examples/` | `agent.mjs`: a minimal agent that reads its mandate, checks a proposal and executes it. |
| `scripts/` | `verify-deployment` and the contract artifact builder. |
| `public/` | Brand images and wallet logos. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
```

Fork tests against Robinhood Chain (they skip on any other chain):

```
forge test --match-contract Fork --fork-url https://rpc.mainnet.chain.robinhood.com --evm-version cancun
```

### What was checked for this snapshot

2026-11-24 (UTC), Node.js 25.8.2, forge 1.5.1: typecheck exit 0; `npm test` 32 pass / 0 fail; `next build` 19 routes; `forge test` 32 passed (27 unit and fuzz tests in `DeleqMandateGuardTest`, 4 invariants plus 1 handler test in `DeleqMandateGuardInvariantTest`); fork suite 6 passed against Robinhood Chain mainnet state (a real WETH to USDG swap through Uniswap v3 SwapRouter02 paid the owner and left nothing in the guard). An end-to-end browser run on a local fork of Robinhood Chain (chain id 4663) with injected test wallets and the example agent is kept with the project's working notes, not in this repository.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:6650. Without any configuration the site reads Robinhood Chain through its public RPC: the console, practice mode, token check, method and token pages work. The on-chain mode and the dashboard say the guard is not deployed until `src/config/contracts.ts` has an address. WalletConnect shows "Not configured on this site yet" until `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (32 hex characters) is set.

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| `DeleqMandateGuard` (with the internal library `DeleqLimitMath`) | not deployed yet | — |

The guard stores mandates (owner, agent, window, per-token caps, recipients, routers, actions per day), answers `checkTransfer` and `checkSwap` with a bitmask of 19 reasons, and executes `executeTransfer` (transferFrom owner → allowlisted recipient) and `executeSwapV3` (exactInputSingle on an allowlisted router, output forced to the owner, approval reset to zero, leftover check). Daily caps use calendar UTC days. It has no owner of the contract, no admin, no fee and no upgrade, and it holds no funds between transactions. Native ETH is not supported (wrap to WETH); fee-on-transfer tokens are refused.

## Verify a deployment

```
npm run verify-deployment -- --guard <address> --guard-tx <creation tx hash>
```

The script compares the bytecode on Robinhood Chain with the build in this repository and prints MATCH or the first difference.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- Robinhood Chain JSON-RPC (the official endpoint, then public fallbacks). The browser reads through the site's relay `/api/rpc`, which only forwards a short list of read methods and targets and is rate limited.
- Chainlink ETH / USD on Robinhood Chain for the ticker, with its update time.
- Token check: complete answers are cached 60 seconds per token; answers with an unread row and failures are never cached. Anything not read is shown as "Not known".
- Dashboard: guard events from `eth_getLogs`; if part of the block range cannot be read, the page says the list may be incomplete. Rejected proposals are kept in the visitor's browser only, because a reverted transaction leaves no log.

## Token

$DELEQ is the community token of Deleq on Robinhood Chain. Contract address: announced on https://deleq.xyz at launch. It has no promised value. Its planned use is advanced risk checks and alerts for mandates, which do not exist yet.

## Deploy your own

1. Import the repository into a Next.js host (framework preset Next.js, root `./`).
2. Optional environment variables:

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Server-side RPC with `eth_getLogs` for the dashboard | `https://…` |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Browser RPC override (public) | `https://…` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect in the wallet dialog | 32 hex characters |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared rate-limit store | `https://…`, token string |
| `STORE_KEY_PREFIX` | Key prefix in that store | short string, default `deleq:` |

3. Contracts: deploy `DeleqMandateGuard` (no constructor arguments, nothing to link), put its address, block and creation transaction into `src/config/contracts.ts`, and run `npm run verify-deployment -- --guard <address> --guard-tx <tx>`.
4. After the deploy, check that `/` answers 200, `/api/chain` returns JSON with a block number, and `/deploy` answers 404 on the public host.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The guard contract, the API routes and the transaction building in the console are in scope; wallets, RPC providers, explorers and launchpads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). Fonts shipped in `src/fonts/` (Archivo, Instrument Sans, Chivo Mono, Geist Pixel Square) are under the SIL Open Font License; their license files sit next to them. Wallet logos in `public/wallets/` belong to their projects and are used only to identify each wallet. The Deleq name, logo and artwork belong to the project and are not licensed for reuse as a brand.
