export type CheckRow = {
  key: string;
  label: string;
  value: string;
  /** ok = nothing found that the check looks for; info = a fact; warn = worth reading; risk = a power over holders; unknown = not read. */
  tone: "ok" | "info" | "warn" | "risk" | "unknown";
  source: { method: string; address: string };
  address?: string;
  decimals?: number;
};

export type TokenCheck = {
  token: string;
  /** Block every row was read at, and its timestamp (unix seconds). */
  block: number;
  checkedAt: number;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  rows: CheckRow[];
  flags: string[];
};
