/* Docs structure: order drives the sidebar, prev/next links, the sitemap and the "On this page" lists. */

export type DocSection = { id: string; title: string };
export type DocPage = { slug: string; title: string; group: string; description: string; toc: DocSection[] };

export const DOC_PAGES: DocPage[] = [
  {
    slug: "",
    title: "Introduction",
    group: "Getting started",
    description: "What Deleq is, what it is not, and what runs today.",
    toc: [
      { id: "what", title: "What Deleq is" },
      { id: "not", title: "What it is not" },
      { id: "status", title: "Status" },
      { id: "next", title: "Where to go next" },
    ],
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    group: "Getting started",
    description: "Practice mode in two minutes, then a real mandate on Robinhood Chain in five steps.",
    toc: [
      { id: "practice", title: "Practice mode in 2 minutes" },
      { id: "need", title: "What you need on chain" },
      { id: "onchain", title: "On chain in 5 steps" },
    ],
  },
  {
    slug: "concepts",
    title: "Concepts",
    group: "Getting started",
    description: "Mandates, roles, caps, allowlists, expiry, pause and revoke, the allowance model and reason bits.",
    toc: [
      { id: "mandate", title: "Mandate" },
      { id: "roles", title: "Owner and agent" },
      { id: "caps", title: "Caps" },
      { id: "allowlists", title: "Allowlists" },
      { id: "window", title: "Validity window" },
      { id: "pause", title: "Pause and revoke" },
      { id: "allowance", title: "Non-custodial allowance model" },
      { id: "bits", title: "Reason bitmask" },
    ],
  },
  {
    slug: "console",
    title: "Console guide",
    group: "Using the app",
    description: "Every field and button of /console.",
    toc: [
      { id: "modes", title: "Practice and On chain" },
      { id: "editor", title: "Mandate panel" },
      { id: "approve", title: "Approvals" },
      { id: "proposal", title: "Agent proposal" },
      { id: "answer", title: "The answer" },
    ],
  },
  {
    slug: "dashboard",
    title: "Dashboard guide",
    group: "Using the app",
    description: "Executed actions from the guard's events, the local refusal log, pause, unpause and revoke.",
    toc: [
      { id: "executed", title: "Executed actions" },
      { id: "log", title: "Checks and rejections" },
      { id: "controls", title: "Pause, unpause, revoke" },
    ],
  },
  {
    slug: "token-check",
    title: "Token check",
    group: "Using the app",
    description: "Every row of the token check, where it comes from, and what it cannot tell you.",
    toc: [
      { id: "how", title: "How a check is read" },
      { id: "rows", title: "Rows" },
      { id: "tones", title: "Tones and Not known" },
      { id: "limits", title: "Limits" },
    ],
  },
  {
    slug: "contract",
    title: "Smart contract reference",
    group: "Reference",
    description: "DeleqMandateGuard: address, verification, every function, event, error and reason bit, gas and invariants.",
    toc: [
      { id: "deployment", title: "Deployment" },
      { id: "types", title: "Types" },
      { id: "write", title: "Write functions" },
      { id: "read", title: "Read functions" },
      { id: "events", title: "Events" },
      { id: "errors", title: "Errors" },
      { id: "bits", title: "Reason bits" },
      { id: "gas", title: "Gas" },
      { id: "invariants", title: "Invariants" },
      { id: "library", title: "DeleqLimitMath" },
    ],
  },
  {
    slug: "agent",
    title: "Agent integration",
    group: "Reference",
    description: "Run the example agent, or call the guard from your own bot with viem.",
    toc: [
      { id: "example", title: "examples/agent.mjs" },
      { id: "viem", title: "Minimal viem integration" },
      { id: "keys", title: "Keys" },
    ],
  },
  {
    slug: "api",
    title: "HTTP API",
    group: "Reference",
    description: "The site's public JSON routes: chain snapshot, token check, mandate activity and the read relay.",
    toc: [
      { id: "overview", title: "Overview" },
      { id: "chain", title: "GET /api/chain" },
      { id: "token-check", title: "GET /api/token-check" },
      { id: "activity", title: "GET /api/activity" },
      { id: "rpc", title: "POST /api/rpc" },
    ],
  },
  {
    slug: "security",
    title: "Security model & limits",
    group: "Reference",
    description: "Trust assumptions, what the site and its operator can and cannot do, self-review findings, private reporting.",
    toc: [
      { id: "trust", title: "Trust assumptions" },
      { id: "operator", title: "What the site can and cannot do" },
      { id: "review", title: "Self-review findings" },
      { id: "report", title: "Report a problem" },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    group: "More",
    description: "Short answers to common questions.",
    toc: [{ id: "faq", title: "Questions" }],
  },
  {
    slug: "changelog",
    title: "Changelog",
    group: "More",
    description: "What changed, by date.",
    toc: [{ id: "2026-11-24", title: "24 Nov 2026" }],
  },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
export const docBySlug = (slug: string) => DOC_PAGES.find((p) => p.slug === slug);
export const DOC_GROUPS = [...new Set(DOC_PAGES.map((p) => p.group))];
