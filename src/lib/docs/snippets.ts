import { CONTRACTS } from "@/config/contracts";
import { CHAIN } from "@/config/brand";
import { USDG } from "@/config/dex";
import { FUNCTIONS } from "@/lib/docs/abi";

/* Code shown on /docs. Signatures come from the compiled ABI (lib/docs/abi.ts); docs.test.ts parses them back with viem and compares selectors. */

/** Human-readable ABI line for viem's parseAbi, generated from the artifact. */
export function humanAbi(name: string): string {
  const f = FUNCTIONS.find((x) => x.name === name);
  if (!f) throw new Error(`no function ${name} in the ABI`);
  const mut = f.mutability === "nonpayable" ? "" : ` ${f.mutability}`;
  return `function ${f.name}(${f.inputs.join(", ")})${mut}${f.outputs.length ? ` returns (${f.outputs.join(", ")})` : ""}`;
}

export const VIEM_FUNCTIONS = ["mandatesOfAgent", "getMandate", "spentToday", "checkTransfer", "executeTransfer"] as const;

export const VIEM_SNIPPET = `import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseUnits, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhood = defineChain({
  id: ${CHAIN.id},
  name: "${CHAIN.name}",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["${CHAIN.publicRpc}"] } },
});
const GUARD = "${CONTRACTS.guard || "<guard address>"}";
const USDG = "${USDG}"; // 6 decimals
const abi = parseAbi([
${VIEM_FUNCTIONS.map((n) => `  "${humanAbi(n)}",`).join("\n")}
]);

const agent = privateKeyToAccount(process.env.AGENT_KEY); // the agent's key, from its own machine
const pub = createPublicClient({ chain: robinhood, transport: http() });
const wallet = createWalletClient({ account: agent, chain: robinhood, transport: http() });

// 1. Read the mandate that names this agent.
const ids = await pub.readContract({ address: GUARD, abi, functionName: "mandatesOfAgent", args: [agent.address] });
const id = ids[ids.length - 1];
const mandate = await pub.readContract({ address: GUARD, abi, functionName: "getMandate", args: [id] });
const [spent, left] = await pub.readContract({ address: GUARD, abi, functionName: "spentToday", args: [id, USDG] });

// 2. Ask the guard before sending anything. 0 = inside the mandate.
const to = "0x…";            // an allowlisted recipient
const amount = parseUnits("8", 6);
const reasons = await pub.readContract({ address: GUARD, abi, functionName: "checkTransfer", args: [id, agent.address, USDG, to, amount] });
if (reasons !== 0n) throw new Error(\`refused, reason bits \${reasons}\`);

// 3. Execute. The tokens go from the owner's wallet straight to the recipient.
const ref = stringToHex("invoice-118", { size: 32 }); // free reference, only logged
const { request } = await pub.simulateContract({ account: agent, address: GUARD, abi, functionName: "executeTransfer", args: [id, USDG, to, amount, ref] });
const hash = await wallet.writeContract(request);
await pub.waitForTransactionReceipt({ hash });`;

export const AGENT_ENV = `export GUARD=${CONTRACTS.guard || "<guard address>"}
export AGENT_KEY=…          # the AGENT's private key, set in your own terminal only
export RPC_URL=${CHAIN.publicRpc}   # optional, this is the default
export MANDATE=1            # optional, default: newest mandate naming this agent`;

export const AGENT_COMMANDS = `node examples/agent.mjs status
node examples/agent.mjs pay  ${USDG} <recipient> 8
node examples/agent.mjs swap <tokenIn> <tokenOut> 100 <amountIn> <minOut>`;

export const AGENT_OUTPUT = `mandate #1 owner 0xA… agent 0xB… active until 2026-12-24T…
  USDG: per tx 10, per UTC day 25, spent today 0, left 25
EXECUTED pay 8 USDG to 0xC… · action #1 · spent today 8 · tx 0x…
REFUSED by the check (bits 512): OVER_PER_TX. Nothing sent.`;
