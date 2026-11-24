import { BITS } from "@/lib/mandate/bits";

/*
 * The mandate check, line for line the same rules as DeleqMandateGuard._checkTransfer / _checkSwap. The console runs it in
 * practice mode (sample data, no chain) and next to the contract's own checkTransfer/checkSwap view when a guard is
 * deployed; engine.test.ts pins the semantics, and the end-to-end test compares both answers on anvil.
 * Days are calendar UTC days (unix seconds / 86400).
 */

export const DAY = 86_400;
export const dayOf = (ts: number) => Math.floor(ts / DAY);

export type TokenRule = { token: string; symbol: string; decimals: number; perTxCap: bigint; dailyCap: bigint; listed: boolean };

export type MandateModel = {
  id: number;
  owner: string;
  agent: string;
  validFrom: number;
  expiry: number;
  /** 0 = no count limit. */
  maxActionsPerDay: number;
  paused: boolean;
  revoked: boolean;
  label: string;
  tokens: TokenRule[];
  recipients: string[];
  routers: string[];
};

export type UsageState = {
  spent: Record<string, { day: number; spent: bigint }>;
  count: { day: number; count: number };
  actions: number;
};

/** The owner's wallet as the guard would read it: balance and allowance to the guard, per token. null = unreadable. */
export type OwnerWallet = Record<string, { balance: bigint; allowance: bigint } | null>;

export type TransferProposal = { kind: "transfer"; caller: string; token: string; to: string; amount: bigint };
export type SwapProposal = { kind: "swap"; caller: string; router: string; tokenIn: string; tokenOut: string; fee: number; amountIn: bigint; minOut: bigint };
export type Proposal = TransferProposal | SwapProposal;

const lc = (a: string) => a.toLowerCase();
export const emptyUsage = (): UsageState => ({ spent: {}, count: { day: 0, count: 0 }, actions: 0 });

export function ruleOf(m: MandateModel, token: string): TokenRule | undefined {
  return m.tokens.find((t) => lc(t.token) === lc(token));
}

export function spentOn(u: UsageState, token: string, today: number): bigint {
  const s = u.spent[lc(token)];
  return s && s.day === today ? s.spent : 0n;
}

function stateBits(m: MandateModel | null, now: number): bigint {
  if (!m) return BITS.UNKNOWN_MANDATE;
  let b = 0n;
  if (m.revoked) b |= BITS.REVOKED;
  if (m.paused) b |= BITS.PAUSED;
  if (now < m.validFrom) b |= BITS.NOT_STARTED;
  if (now >= m.expiry) b |= BITS.EXPIRED;
  return b;
}

function baseBits(m: MandateModel | null, u: UsageState, caller: string, now: number): bigint {
  let b = stateBits(m, now);
  if (!m) return b;
  if (lc(caller) !== lc(m.agent)) b |= BITS.NOT_AGENT;
  if (m.maxActionsPerDay > 0) {
    const used = u.count.day === dayOf(now) ? u.count.count : 0;
    if (used >= m.maxActionsPerDay) b |= BITS.DAILY_COUNT;
  }
  return b;
}

function spendBits(m: MandateModel, u: UsageState, w: OwnerWallet, token: string, amount: bigint, now: number): bigint {
  const r = ruleOf(m, token);
  if (!r || !r.listed) return BITS.TOKEN_NOT_ALLOWED | (amount === 0n ? BITS.ZERO_AMOUNT : 0n);
  if (amount === 0n) return BITS.ZERO_AMOUNT;
  let b = 0n;
  if (amount > r.perTxCap) b |= BITS.OVER_PER_TX;
  const spent = spentOn(u, token, dayOf(now));
  if (amount > r.dailyCap || spent + amount > r.dailyCap) b |= BITS.OVER_DAILY;
  const wallet = w[lc(token)];
  if (!wallet) return b | BITS.TOKEN_UNREADABLE;
  if (wallet.allowance < amount) b |= BITS.LOW_ALLOWANCE;
  if (wallet.balance < amount) b |= BITS.LOW_BALANCE;
  return b;
}

/** Reason bits for a proposal at time `now` (unix seconds). 0n = the guard would let it through. */
export function evaluate(m: MandateModel | null, u: UsageState, w: OwnerWallet, p: Proposal, now: number): bigint {
  let b = baseBits(m, u, p.caller, now);
  if (!m || (b & BITS.UNKNOWN_MANDATE) !== 0n) return b;
  if (p.kind === "transfer") {
    if (!m.recipients.some((r) => lc(r) === lc(p.to))) b |= BITS.RECIPIENT_NOT_ALLOWED;
    return b | spendBits(m, u, w, p.token, p.amount, now);
  }
  if (!m.routers.some((r) => lc(r) === lc(p.router))) b |= BITS.ROUTER_NOT_ALLOWED;
  if (lc(p.tokenIn) === lc(p.tokenOut)) b |= BITS.SAME_TOKEN;
  const out = ruleOf(m, p.tokenOut);
  if (!out || !out.listed) b |= BITS.TOKEN_OUT_NOT_ALLOWED;
  if (p.minOut === 0n) b |= BITS.NO_MIN_OUT;
  return b | spendBits(m, u, w, p.tokenIn, p.amountIn, now);
}

/** The state after an executed proposal (practice mode). Throws when the proposal would be rejected. */
export function apply(m: MandateModel, u: UsageState, w: OwnerWallet, p: Proposal, now: number): UsageState {
  const bits = evaluate(m, u, w, p, now);
  if (bits !== 0n) throw new Error(`rejected ${bits}`);
  const token = lc(p.kind === "transfer" ? p.token : p.tokenIn);
  const amount = p.kind === "transfer" ? p.amount : p.amountIn;
  const today = dayOf(now);
  const used = u.count.day === today ? u.count.count : 0;
  return {
    spent: { ...u.spent, [token]: { day: today, spent: spentOn(u, token, today) + amount } },
    count: { day: today, count: used + 1 },
    actions: u.actions + 1,
  };
}

/** What is left under the daily cap for a token today. */
export function remainingToday(m: MandateModel, u: UsageState, token: string, now: number): bigint {
  const r = ruleOf(m, token);
  if (!r) return 0n;
  const spent = spentOn(u, token, dayOf(now));
  return spent >= r.dailyCap ? 0n : r.dailyCap - spent;
}

/** Seconds until the next UTC midnight, when daily caps reset. */
export const untilReset = (now: number) => DAY - (now % DAY);
