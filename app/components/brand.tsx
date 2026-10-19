export default function Brand({ vertical = false }: { vertical?: boolean }) {
  return (
    <span className={vertical ? "lt-brand lt-brand-vertical" : "lt-brand"}>
      <span className="lt-monogram" aria-hidden="true">L<span>T</span></span>
      <span className={vertical ? "lt-wordmark" : "sr-only"}>Lima Toralla Living</span>
    </span>
  );
}
