import { test } from "node:test";
import assert from "node:assert/strict";
import { toFunctionSelector } from "viem";
import { findPowers, minimalProxyTarget, push4s } from "@/lib/tokencheck/selectors";

const sel = (s: string) => toFunctionSelector(`function ${s}`).slice(2);

test("PUSH4 operands are found, PUSH data is never read as code", () => {
  // PUSH4 <mint(address,uint256)> ; PUSH5 that contains 63<pause()> inside its data must not count.
  const code = `0x63${sel("mint(address,uint256)")}64${"63"}${sel("pause()")}00`;
  const found = push4s(code);
  assert.ok(found.has(sel("mint(address,uint256)")));
  assert.ok(!found.has(sel("pause()")));
  const powers = findPowers([code]);
  assert.deepEqual(powers.mint, ["mint(address,uint256)"]);
  assert.equal(powers.pause, undefined);
});

test("implementation code adds its powers", () => {
  const proxy = `0x63${sel("upgradeTo(address)")}`;
  const impl = `0x63${sel("blacklist(address)")}63${sel("owner()")}`;
  const p = findPowers([proxy, impl]);
  assert.ok(p.upgrade && p.blocklist && p.owner);
});

test("EIP-1167 minimal proxies are recognised", () => {
  const t = "bebebebebebebebebebebebebebebebebebebebe";
  assert.equal(minimalProxyTarget(`0x363d3d373d3d3d363d73${t}5af43d82803e903d91602b57fd5bf3`), `0x${t}`);
  assert.equal(minimalProxyTarget("0x6080"), null);
});
