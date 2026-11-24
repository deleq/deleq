import Link from "next/link";
import { PageHead } from "@/components/site/PageHead";

export default function NotFound() {
  return (
    <>
      <PageHead eyebrow="404" title="Outside the mandate.">
        <p>This page does not exist. The console does.</p>
      </PageHead>
      <div className="wrap flex flex-wrap gap-3 py-16">
        <Link href="/console" className="btn btn-blue">
          Open the console
        </Link>
        <Link href="/" className="btn btn-line">
          Home
        </Link>
      </div>
    </>
  );
}
