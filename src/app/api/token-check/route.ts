import { isAddress } from "@/config/brand";
import { allowPublic, tooMany } from "@/lib/guard";
import { bad, fail, ok } from "@/lib/server/respond";
import { getStore } from "@/lib/server/store";
import { checkToken } from "@/lib/server/tokencheck";
import type { TokenCheck } from "@/lib/tokencheck/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/*
 * GET /api/token-check?token=0x… → the token rows Deleq shows next to a proposal. Rate limited per network and site-wide
 * (each check is ~2 batched RPC requests). A complete answer is kept 60 s per token; an answer with any "Not known" row,
 * or a failure, is never cached.
 */
const cache = new Map<string, { at: number; value: TokenCheck }>();
const flying = new Map<string, Promise<TokenCheck>>();
const TTL = 60_000;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!isAddress(token)) return bad("Give ?token= as a 0x address (40 hex characters).");
  const key = token.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return ok(hit.value, 30);
  if (!(await allowPublic(getStore(), request, "token-check", 30, 1500))) return tooMany();
  try {
    let p = flying.get(key);
    if (!p) {
      p = checkToken(key).finally(() => flying.delete(key));
      flying.set(key, p);
    }
    const value = await p;
    if (!value.rows.some((r) => r.tone === "unknown")) {
      if (cache.size > 300) cache.clear();
      cache.set(key, { at: Date.now(), value });
    }
    return ok(value, 30);
  } catch (e) {
    return fail(e);
  }
}
