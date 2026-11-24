import { DocsSidebar } from "@/components/docs/Sidebar";

/* Docs shell: sidebar (collapsible on phones) + page (article and "On this page"). */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap doc-shell">
      <DocsSidebar />
      {children}
    </div>
  );
}
