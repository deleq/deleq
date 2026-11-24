import Link from "next/link";
import { explorerAddress, explorerTx } from "@/config/brand";

/* Small building blocks for docs pages. Server components. */

/** Section heading with an anchor link. The id must match the page's toc entry in lib/docs/nav.ts. */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="doc-h2" data-reveal="">
      <a href={`#${id}`} className="doc-anchor" aria-label="Link to this section">
        #
      </a>
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="doc-h3">
      {id ? (
        <a href={`#${id}`} className="doc-anchor" aria-label="Link to this heading">
          #
        </a>
      ) : null}
      {children}
    </h3>
  );
}

/** A label exactly as it appears on the site's buttons and fields. */
export const UI = ({ children }: { children: React.ReactNode }) => <span className="ui-label">{children}</span>;

export const Code = ({ children }: { children: React.ReactNode }) => <code className="doc-ic">{children}</code>;

export function Callout({ tone = "note", title, children }: { tone?: "note" | "warn" | "info"; title?: string; children: React.ReactNode }) {
  return (
    <div className={`doc-callout ${tone}`} data-reveal="">
      {title ? <p className="doc-callout-t">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export const Addr = ({ a, children }: { a: string; children?: React.ReactNode }) => (
  <a className="doc-link font-mono text-[12.5px]" href={explorerAddress(a)} target="_blank" rel="noreferrer">
    {children ?? a}
  </a>
);

export const Tx = ({ h, children }: { h: string; children?: React.ReactNode }) => (
  <a className="doc-link font-mono text-[12.5px]" href={explorerTx(h)} target="_blank" rel="noreferrer">
    {children ?? h}
  </a>
);

export const DocLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link className="doc-link" href={href}>
    {children}
  </Link>
);
