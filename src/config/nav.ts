import { BRAND } from "@/config/brand";
import { DOC_PAGES, docHref } from "@/lib/docs/nav";

export const NAV = [
  { href: "/console", label: "Console" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
  { href: "/method", label: "Method" },
  { href: "/token", label: BRAND.symbol },
] as const;

/** Every public route, for the sitemap. */
export const ROUTES = ["/", "/console", "/dashboard", "/method", "/token", ...DOC_PAGES.map((p) => docHref(p.slug))] as const;
