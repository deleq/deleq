"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/site/Icons";

/** A code block with a Copy button. `lang` is only a label. */
export function CodeBlock({ code, lang = "" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused: the text stays selectable.
    }
  };
  return (
    <div className="doc-code" data-reveal="">
      <div className="doc-code-h">
        <span>{lang}</span>
        <button type="button" onClick={copy} aria-label="Copy the code" data-testid="copy-code">
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
