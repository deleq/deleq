import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.slogan} ${BRAND.tagline} Mandates for trading agents on ${CHAIN.name} (chain ${CHAIN.id}): allowed tokens with per-transaction and daily (UTC) caps, allowlisted recipients and swap routers, validity window, actions per day, pause and revoke. DeleqMandateGuard enforces them on chain and never holds a balance at rest (transferFrom from the owner's wallet). Each proposal is checked first: checkTransfer / checkSwap return a reason bitmask, and a token check reads code, ERC-20 metadata, proxy slots, owner powers and pools from chain. Prototype; no token needed. Not affiliated with Robinhood.`,
    "",
    `Console: ${BRAND.url}/console`,
    `Dashboard: ${BRAND.url}/dashboard`,
    `Docs: ${BRAND.url}/docs (contract reference: ${BRAND.url}/docs/contract, HTTP API: ${BRAND.url}/docs/api)`,
    `Token check API (JSON): ${BRAND.url}/api/token-check?token=<address>`,
    `Mandate activity API (JSON): ${BRAND.url}/api/activity?owner=<address> or ?agent=<address>`,
    `DeleqMandateGuard: ${guardLive() ? CONTRACTS.guard : "not deployed yet"}`,
    `Method and limits: ${BRAND.url}/method`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
