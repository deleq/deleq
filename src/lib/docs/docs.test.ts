import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAbi, toFunctionSelector } from "viem";
import { ERRORS, ERROR_DOCS, EVENTS, EVENT_DOCS, FN_DOCS, FUNCTIONS } from "@/lib/docs/abi";
import { DOC_PAGES } from "@/lib/docs/nav";
import { VIEM_FUNCTIONS, VIEM_SNIPPET, humanAbi } from "@/lib/docs/snippets";

test("every ABI function, event and error is documented, and nothing documented is gone", () => {
  assert.deepEqual(FUNCTIONS.map((f) => f.name).sort(), Object.keys(FN_DOCS).sort());
  assert.deepEqual(EVENTS.map((e) => e.name).sort(), Object.keys(EVENT_DOCS).sort());
  assert.deepEqual(ERRORS.map((e) => e.name).sort(), Object.keys(ERROR_DOCS).sort());
});

test("the viem snippet's ABI lines parse and match the compiled selectors", () => {
  const abi = parseAbi(VIEM_FUNCTIONS.map(humanAbi));
  for (const item of abi) {
    const real = FUNCTIONS.find((f) => f.name === (item as { name: string }).name)!;
    assert.equal(toFunctionSelector(item as never), real.selector, real.name);
  }
  for (const m of VIEM_SNIPPET.matchAll(/functionName: "(\w+)"/g)) assert.ok((VIEM_FUNCTIONS as readonly string[]).includes(m[1]), m[1]);
});

test("docs pages have unique slugs and section ids", () => {
  assert.equal(new Set(DOC_PAGES.map((p) => p.slug)).size, DOC_PAGES.length);
  for (const p of DOC_PAGES) assert.equal(new Set(p.toc.map((s) => s.id)).size, p.toc.length, p.slug);
});
