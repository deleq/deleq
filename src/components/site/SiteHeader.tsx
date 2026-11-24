"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NAV } from "@/config/nav";
import { Wordmark } from "@/components/site/Mark";
import { CloseIcon } from "@/components/site/Icons";
import { NavWallet } from "@/components/wallet/WalletButton";
import { CaBox } from "@/components/site/CaCopy";
import { useFocusTrap } from "@/components/site/useFocusTrap";

/* The reference's header: wordmark left, plain text links and one chamfered dark button right, sitting on the blue hero
   (static, not sticky). App pages get the same bar on the dark ground. */
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const onHome = path === "/";
  return (
    <>
      <header className={`hd ${onHome ? "" : "solid"}`}>
        <div className="wrap">
          <div className="hd-bar">
            <Link href="/" aria-label="Deleq home" className={`shrink-0 ${onHome ? "text-[var(--deep)]" : "text-ink"}`}>
              <Wordmark size={24} />
            </Link>
            <nav aria-label="Main" className="hd-nav">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={path === n.href || path.startsWith(`${n.href}/`) ? "page" : undefined}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex min-w-0 items-center gap-2 lg:ml-2">
              <NavWallet label="Connect wallet" />
              <button type="button" className="rq-iconbtn lg:hidden" aria-label="Open the menu" aria-expanded={open} onClick={() => setOpen(true)} data-testid="menu-open">
                <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      {open ? <MobileMenu onClose={() => setOpen(false)} path={path} /> : null}
    </>
  );
}

function MobileMenu({ onClose, path }: { onClose: () => void; path: string }) {
  const trap = useRef<HTMLDivElement>(null);
  useFocusTrap(trap, true, onClose);
  return createPortal(
    <div className="hd-menu" role="dialog" aria-modal="true" aria-label="Menu" ref={trap} data-testid="menu">
      <div className="wrap flex h-[94px] items-center justify-between">
        <Wordmark size={24} />
        <button type="button" className="rq-iconbtn" aria-label="Close the menu" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      <nav className="wrap mt-2" aria-label="Main">
        {[{ href: "/", label: "Home" }, ...NAV].map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose} className="big" aria-current={path === n.href ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="wrap mt-8 grid gap-3 pb-10">
        <Link href="/console" className="btn btn-blue w-full" onClick={onClose}>
          Open the console
        </Link>
        <CaBox testid="menu-ca" />
      </div>
    </div>,
    document.body,
  );
}
