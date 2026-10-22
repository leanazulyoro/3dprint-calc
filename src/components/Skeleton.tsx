/** Placeholder block while something loads. Size it with className. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton ${className}`} />;
}
