import { toEventSelector, toFunctionSelector, type AbiParameter } from "viem";
import { GUARD_ABI } from "@/lib/abi";

/*
 * Contract reference generated from the compiled artifact (src/lib/contracts/artifacts.json): every signature, selector and
 * parameter list on /docs/contract comes from the ABI, never typed by hand. The prose per item lives in the maps below;
 * docs.test.ts fails when the ABI has an item without prose (or prose for an item that no longer exists).
 */

type Param = AbiParameter & { components?: readonly AbiParameter[]; indexed?: boolean };
type Item = { type: string; name?: string; inputs?: readonly Param[]; outputs?: readonly Param[]; stateMutability?: string };

const ITEMS = GUARD_ABI as unknown as Item[];

function typeOf(p: Param): string {
  if (p.type.startsWith("tuple")) {
    const inner = (p.components ?? []).map((c) => `${typeOf(c as Param)}${c.name ? ` ${c.name}` : ""}`).join(", ");
    return `(${inner})${p.type.slice(5)}`;
  }
  return p.type;
}
const param = (p: Param, event = false) => `${typeOf(p)}${event && p.indexed ? " indexed" : ""}${p.name ? ` ${p.name}` : ""}`;

export type FnRef = { name: string; signature: string; selector: string; mutability: string; inputs: string[]; outputs: string[] };
export type EventRef = { name: string; signature: string; topic0: string; fields: string[] };
export type ErrorRef = { name: string; signature: string };

export const FUNCTIONS: FnRef[] = ITEMS.filter((x) => x.type === "function").map((x) => {
  const ins = (x.inputs ?? []).map((p) => param(p));
  const outs = (x.outputs ?? []).map((p) => param(p));
  const mut = x.stateMutability ?? "nonpayable";
  return {
    name: x.name!,
    signature: `function ${x.name}(${ins.join(", ")}) external${mut === "nonpayable" ? "" : ` ${mut}`}${outs.length ? ` returns (${outs.join(", ")})` : ""}`,
    selector: toFunctionSelector(x as never),
    mutability: mut,
    inputs: ins,
    outputs: outs,
  };
});

export const EVENTS: EventRef[] = ITEMS.filter((x) => x.type === "event").map((x) => ({
  name: x.name!,
  signature: `event ${x.name}(${(x.inputs ?? []).map((p) => param(p, true)).join(", ")})`,
  topic0: toEventSelector(x as never),
  fields: (x.inputs ?? []).map((p) => param(p, true)),
}));

export const ERRORS: ErrorRef[] = ITEMS.filter((x) => x.type === "error").map((x) => ({
  name: x.name!,
  signature: `error ${x.name}(${(x.inputs ?? []).map((p) => param(p)).join(", ")})`,
}));

/** Who may call each function and what it does. Every ABI function needs an entry (docs.test.ts). */
export const FN_DOCS: Record<string, { who: string; does: string; emits?: string; reverts?: string }> = {
  createMandate: {
    who: "Anyone (the caller becomes the owner)",
    does: "Creates a mandate for init.agent with tokens and caps, recipients, routers, window (validFrom 0 = now), actions per day and a label. Returns the new id.",
    emits: "MandateCreated, then TokenRuleSet / RecipientSet / RouterSet per entry",
    reverts: "BadAgent (zero, the caller or the guard), BadWindow, BadCaps (perTx > daily), BadAddress (no code, zero, owner as recipient), TooMany (16 tokens, 32 recipients, 4 routers, 64 mandates per owner)",
  },
  setTokenRule: { who: "Owner of the mandate", does: "Adds, changes or removes (listed = false, caps 0) a token rule.", emits: "TokenRuleSet", reverts: "NotOwner, AlreadyRevoked, BadAddress, BadCaps, TooMany" },
  setRecipient: { who: "Owner of the mandate", does: "Allows or removes a recipient.", emits: "RecipientSet", reverts: "NotOwner, AlreadyRevoked, BadAddress, TooMany" },
  setRouter: { who: "Owner of the mandate", does: "Allows or removes a swap router (must have code).", emits: "RouterSet", reverts: "NotOwner, AlreadyRevoked, BadAddress, TooMany" },
  setWindow: { who: "Owner of the mandate", does: "Changes validFrom and expiry (expiry in the future, at most 730 days after validFrom).", emits: "WindowSet", reverts: "NotOwner, AlreadyRevoked, BadWindow" },
  setMaxActionsPerDay: { who: "Owner of the mandate", does: "Sets the number of actions per UTC day (0 = no count limit).", emits: "MaxActionsSet", reverts: "NotOwner, AlreadyRevoked" },
  pause: { who: "Owner of the mandate", does: "Stops every execute from the next call on. No-op when already paused.", emits: "Paused", reverts: "NotOwner, AlreadyRevoked" },
  unpause: { who: "Owner of the mandate", does: "Lifts a pause (the owner's or the agent's).", emits: "Unpaused", reverts: "NotOwner, AlreadyRevoked" },
  revoke: { who: "Owner of the mandate", does: "Ends the mandate for good. Nothing can execute or change under it afterwards.", emits: "Revoked", reverts: "NotOwner, AlreadyRevoked" },
  agentPause: { who: "Agent of the mandate", does: "The agent's own kill switch: pauses the mandate. Only the owner can unpause.", emits: "Paused", reverts: "NotAgent, AlreadyRevoked" },
  executeTransfer: {
    who: "Agent of the mandate",
    does: "Moves amount of token from the owner to an allowlisted recipient with transferFrom, after the same checks as checkTransfer. The recipient must receive exactly amount. ref is only logged.",
    emits: "TransferExecuted",
    reverts: "Rejected(reasons), Reentrancy, TokenCallFailed, FeeOnTransferNotSupported",
  },
  executeSwapV3: {
    who: "Agent of the mandate",
    does: "Pulls amountIn from the owner, approves exactly that to an allowlisted SwapRouter02-compatible router, calls exactInputSingle with recipient = owner, measures what the owner received, resets the approval to 0 and reverts if anything is left in the guard.",
    emits: "SwapExecuted",
    reverts: "Rejected(reasons), Reentrancy, TokenCallFailed, FeeOnTransferNotSupported, SwapShortfall, LeftoverBalance (and the router's own revert)",
  },
  checkTransfer: { who: "Anyone (view)", does: "Reason bits executeTransfer would fail with right now if sent by caller. 0 = it would pass the guard." },
  checkSwap: { who: "Anyone (view)", does: "Reason bits executeSwapV3 would fail with right now if sent by caller." },
  getMandate: { who: "Anyone (view)", does: "The Mandate struct (owner, agent, window, maxActionsPerDay, version, paused, revoked, label, createdAt, actions)." },
  tokenRule: { who: "Anyone (view)", does: "perTxCap, dailyCap and listed for one token." },
  isRecipient: { who: "Anyone (view)", does: "Whether an address is an allowed recipient." },
  isRouter: { who: "Anyone (view)", does: "Whether an address is an allowed router." },
  tokensOf: { who: "Anyone (view)", does: "Listed tokens of a mandate." },
  recipientsOf: { who: "Anyone (view)", does: "Allowed recipients of a mandate." },
  routersOf: { who: "Anyone (view)", does: "Allowed routers of a mandate." },
  mandatesOfOwner: { who: "Anyone (view)", does: "Ids of every mandate an owner created (revoked ones included)." },
  mandatesOfAgent: { who: "Anyone (view)", does: "Ids of every mandate naming an agent." },
  spentToday: { who: "Anyone (view)", does: "Spent on the current UTC day and what is left under the daily cap, for one token." },
  actionsToday: { who: "Anyone (view)", does: "Actions executed today and the per-day limit (0 = none)." },
  mandateCount: { who: "Anyone (view)", does: "Number of mandates ever created (ids start at 1)." },
  MAX_TOKENS: { who: "Constant", does: "16 tokens per mandate." },
  MAX_RECIPIENTS: { who: "Constant", does: "32 recipients per mandate." },
  MAX_ROUTERS: { who: "Constant", does: "4 routers per mandate." },
  MAX_DURATION: { who: "Constant", does: "730 days from validFrom to expiry." },
  MAX_MANDATES_PER_OWNER: { who: "Constant", does: "64 mandates per owner address, revoked ones included." },
};

export const EVENT_DOCS: Record<string, string> = {
  MandateCreated: "A mandate was created. Indexed by id, owner and agent.",
  TokenRuleSet: "A token rule was added, changed or removed; version is the mandate's version after the change.",
  RecipientSet: "A recipient was allowed or removed.",
  RouterSet: "A router was allowed or removed.",
  WindowSet: "The validity window changed.",
  MaxActionsSet: "The actions-per-day limit changed.",
  Paused: "Paused by the owner or the agent (by).",
  Unpaused: "The owner lifted a pause.",
  Revoked: "The mandate ended for good.",
  TransferExecuted: "An agent payment. actionNo counts the mandate's actions, day is the UTC day, spentToday includes this amount. Everything a receipt needs.",
  SwapExecuted: "An agent swap. amountOut is what the owner actually received (measured, not the router's return value).",
};

export const ERROR_DOCS: Record<string, string> = {
  NotOwner: "The caller is not the mandate's owner (or the mandate does not exist).",
  NotAgent: "The caller is not the mandate's agent (agentPause).",
  Reentrancy: "A token or router called back into an execute.",
  BadAgent: "Agent is zero, the owner, or the guard.",
  BadWindow: "Expiry not after validFrom, not in the future, or more than 730 days after validFrom.",
  BadCaps: "perTxCap above dailyCap, or caps on a removed token.",
  BadAddress: "Zero address, the guard, the owner as recipient, or a token/router without code.",
  TooMany: "A list or the per-owner mandate limit is full.",
  AlreadyRevoked: "The mandate is revoked.",
  Rejected: "An execute failed the checks; reasons is the same bitmask checkTransfer / checkSwap return.",
  TokenCallFailed: "The token reverted, returned false, or did not answer balanceOf.",
  FeeOnTransferNotSupported: "The receiver got a different amount than was sent.",
  SwapShortfall: "The owner received less than minOut.",
  LeftoverBalance: "The router did not take the whole amountIn.",
};

/** forge gas report (DeleqMandateGuardTest, 24 Nov 2026). Medians of successful paths; setter minimums include refused calls. */
export const GAS: { fn: string; gas: string; note: string }[] = [
  { fn: "deployment", gas: "2,955,030", note: "mainnet creation transaction (forge estimate 2,954,194); runtime 13,365 bytes" },
  { fn: "createMandate", gas: "638,824", note: "2 tokens, 1 recipient, 1 router" },
  { fn: "executeTransfer", gas: "57,434", note: "median; up to 167,905 on a first spend of the day with cold storage" },
  { fn: "executeSwapV3", gas: "250,572", note: "median with the test router; 240–280 k on the Robinhood Chain fork with SwapRouter02" },
  { fn: "checkTransfer", gas: "30,422", note: "view (free through eth_call)" },
  { fn: "checkSwap", gas: "33,562", note: "view" },
  { fn: "pause / unpause / revoke", gas: "≈ 31,000", note: "state change" },
  { fn: "setRecipient", gas: "104,815", note: "adding a new recipient" },
  { fn: "setTokenRule", gas: "≈ 28,600–48,500", note: "change / add" },
];
