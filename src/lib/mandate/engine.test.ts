import { test } from "node:test";
import assert from "node:assert/strict";
import { BITS } from "@/lib/mandate/bits";
import { DAY, apply, emptyUsage, evaluate, remainingToday, type MandateModel, type OwnerWallet } from "@/lib/mandate/engine";

// The same scenarios as contracts/test/DeleqMandateGuard.t.sol, so site and contract are pinned to one rule set.
const T0 = 1_800_000_000;
const USD = "0x00000000000000000000000000000000000000a1";
const WETH = "0x00000000000000000000000000000000000000a2";
const ROUTER = "0x00000000000000000000000000000000000000c1";
const AGENT = "0x0000000000000000000000000000000000000b0b";
const SHOP = "0x0000000000000000000000000000000000005409";
const STRANGER = "0x0000000000000000000000000000000000000bad";

const mandate = (over: Partial<MandateModel> = {}): MandateModel => ({
  id: 1,
  owner: "0x00000000000000000000000000000000000a11ce",
  agent: AGENT,
  validFrom: T0,
  expiry: T0 + 30 * DAY,
  maxActionsPerDay: 0,
  paused: false,
  revoked: false,
  label: "test",
  tokens: [
    { token: USD, symbol: "TUSD", decimals: 6, perTxCap: 100_000_000n, dailyCap: 250_000_000n, listed: true },
    { token: WETH, symbol: "WETH", decimals: 18, perTxCap: 0n, dailyCap: 0n, listed: true },
  ],
  recipients: [SHOP],
  routers: [ROUTER],
  ...over,
});
const rich: OwnerWallet = { [USD]: { balance: 10n ** 15n, allowance: 2n ** 255n }, [WETH]: { balance: 0n, allowance: 0n } };
const pay = (amount: bigint, caller = AGENT, to = SHOP, token = USD) => ({ kind: "transfer" as const, caller, token, to, amount });

test("per-tx cap, daily cap and the UTC midnight reset", () => {
  const m = mandate();
  let u = emptyUsage();
  assert.equal(evaluate(m, u, rich, pay(101_000_000n), T0), BITS.OVER_PER_TX);
  u = apply(m, u, rich, pay(100_000_000n), T0);
  u = apply(m, u, rich, pay(100_000_000n), T0);
  assert.equal(evaluate(m, u, rich, pay(51_000_000n), T0), BITS.OVER_DAILY);
  u = apply(m, u, rich, pay(50_000_000n), T0);
  const midnight = (Math.floor(T0 / DAY) + 1) * DAY;
  assert.equal(evaluate(m, u, rich, pay(1n), midnight - 1), BITS.OVER_DAILY);
  assert.equal(evaluate(m, u, rich, pay(100_000_000n), midnight), 0n);
  assert.equal(remainingToday(m, u, USD, midnight), 250_000_000n);
  assert.equal(u.actions, 3);
});

test("bits combine exactly like the contract", () => {
  const m = mandate();
  const u = emptyUsage();
  assert.equal(evaluate(m, u, rich, pay(5n, STRANGER, STRANGER, WETH), T0), BITS.NOT_AGENT | BITS.RECIPIENT_NOT_ALLOWED | BITS.OVER_PER_TX | BITS.OVER_DAILY | BITS.LOW_ALLOWANCE | BITS.LOW_BALANCE);
  assert.equal(evaluate(m, u, rich, pay(5n, AGENT, SHOP, "0x0000000000000000000000000000000000001234"), T0), BITS.TOKEN_NOT_ALLOWED);
  assert.equal(evaluate(m, u, rich, pay(0n), T0), BITS.ZERO_AMOUNT);
  assert.equal(evaluate(null, u, rich, pay(1n), T0), BITS.UNKNOWN_MANDATE);
  assert.equal(evaluate(m, u, { [USD]: null }, pay(1n), T0), BITS.TOKEN_UNREADABLE);
});

test("state: paused, revoked, window", () => {
  const u = emptyUsage();
  assert.equal(evaluate(mandate({ paused: true }), u, rich, pay(1n), T0), BITS.PAUSED);
  assert.equal(evaluate(mandate({ revoked: true }), u, rich, pay(1n), T0), BITS.REVOKED);
  assert.equal(evaluate(mandate({ validFrom: T0 + 3600 }), u, rich, pay(1n), T0), BITS.NOT_STARTED);
  assert.equal(evaluate(mandate(), u, rich, pay(1n), T0 + 30 * DAY), BITS.EXPIRED);
});

test("actions per day", () => {
  const m = mandate({ maxActionsPerDay: 2 });
  let u = emptyUsage();
  u = apply(m, u, rich, pay(1n), T0);
  u = apply(m, u, rich, pay(1n), T0);
  assert.equal(evaluate(m, u, rich, pay(1n), T0), BITS.DAILY_COUNT);
  assert.equal(evaluate(m, u, rich, pay(1n), T0 + DAY), 0n);
});

test("swap checks", () => {
  const m = mandate();
  const u = emptyUsage();
  const sw = (o: Partial<{ router: string; tokenIn: string; tokenOut: string; amountIn: bigint; minOut: bigint }>) => ({
    kind: "swap" as const, caller: AGENT, router: ROUTER, tokenIn: USD, tokenOut: WETH, fee: 500, amountIn: 10_000_000n, minOut: 1n, ...o,
  });
  assert.equal(evaluate(m, u, rich, sw({}), T0), 0n);
  assert.equal(evaluate(m, u, rich, sw({ minOut: 0n }), T0), BITS.NO_MIN_OUT);
  assert.equal(evaluate(m, u, rich, sw({ router: USD }), T0), BITS.ROUTER_NOT_ALLOWED);
  assert.equal(evaluate(m, u, rich, sw({ tokenOut: USD }), T0), BITS.SAME_TOKEN);
  assert.equal(evaluate(m, u, rich, sw({ tokenOut: ROUTER }), T0), BITS.TOKEN_OUT_NOT_ALLOWED);
  assert.equal(evaluate(m, u, rich, sw({ amountIn: 500_000_000n }), T0), BITS.OVER_PER_TX | BITS.OVER_DAILY);
});

test("apply refuses what evaluate rejects", () => {
  assert.throws(() => apply(mandate(), emptyUsage(), rich, pay(101_000_000n), T0));
});
