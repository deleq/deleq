"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOC_GROUPS, DOC_PAGES, docHref } from "@/lib/docs/nav";

/** Docs navigation: a sticky sidebar on desktop, a collapsible menu on phones. Active page from the URL. */
export function DocsSidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = DOC_PAGES.find((p) => docHref(p.slug) === path);
  return (
    <aside className="doc-side" aria-label="Documentation">
      <button type="button" className="doc-side-toggle" aria-expanded={open} aria-controls="doc-nav" onClick={() => setOpen((o) => !o)} data-testid="docs-menu">
        <span>
          <span className="eyebrow">Docs</span> <span className="ml-2">{current?.title ?? "Contents"}</span>
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav id="doc-nav" className={`doc-nav ${open ? "open" : ""}`} data-testid="docs-nav">
        {DOC_GROUPS.map((g) => (
          <div key={g} className="doc-nav-group">
            <p className="doc-nav-g">{g}</p>
            <ul>
              {DOC_PAGES.filter((p) => p.group === g).map((p) => {
                const href = docHref(p.slug);
                const active = href === path;
                return (
                  <li key={href}>
                    <Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
