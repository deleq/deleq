import Link from "next/link";
import { DOC_PAGES, docBySlug, docHref } from "@/lib/docs/nav";

/** One docs page: title, body, "On this page" (desktop) and prev / next. */
export function DocPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const page = docBySlug(slug)!;
  const i = DOC_PAGES.indexOf(page);
  const prev = DOC_PAGES[i - 1];
  const next = DOC_PAGES[i + 1];
  return (
    <div className="doc-main">
      <article className="doc-article min-w-0" data-testid="doc-article">
        <p className="eyebrow" data-reveal="">
          {page.group}
        </p>
        <h1 className="display doc-h1" data-reveal="">
          {page.title}
        </h1>
        <p className="lede mt-3" data-reveal="">
          {page.description}
        </p>
        <div className="doc-body">{children}</div>
        <nav className="doc-pn" aria-label="Previous and next page">
          {prev ? (
            <Link href={docHref(prev.slug)} className="doc-pn-a" data-testid="doc-prev">
              <span className="eyebrow">← Previous</span>
              <span>{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={docHref(next.slug)} className="doc-pn-a right" data-testid="doc-next">
              <span className="eyebrow">Next →</span>
              <span>{next.title}</span>
            </Link>
          ) : null}
        </nav>
      </article>
      <aside className="doc-toc" aria-label="On this page">
        <p className="eyebrow">On this page</p>
        <ul>
          {page.toc.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
