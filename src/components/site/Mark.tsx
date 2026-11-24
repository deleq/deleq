/*
 * Deleq's mark: public/brand/mark.webp (placeholder from referensi/tools/make-assets.mjs until the owner's logo arrives; then
 * referensi/tools/apply-owner-assets.mjs). Drawn as a CSS mask filled with currentColor, so it follows the ink of its surface.
 * Bump ?v= when the file changes so cached copies are replaced.
 */
const MARK_URL = "/brand/mark.webp?v=ab77342b";

export function MarkGlyph({ size = 22 }: { size?: number }) {
  const mask = `url(${MARK_URL}) center / contain no-repeat`;
  return <span aria-hidden="true" data-testid="brand-mark" className="block shrink-0 bg-current" style={{ width: size, height: size, WebkitMask: mask, mask }} />;
}

/** Wordmark: the mark + the name in the bold display face, like the reference's logotype. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <MarkGlyph size={Math.round(size * 1.2)} />
      <span>Deleq</span>
    </span>
  );
}
