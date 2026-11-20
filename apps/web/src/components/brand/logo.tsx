import Link from "next/link";
import { cn } from "@/lib/utils";

/** Brand mark: an orbit ring with a champagne point — "everything you own, held in one place". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2.25" />
      <circle cx="16" cy="16" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.45" />
      <circle cx="24.2" cy="8.6" r="3" fill="var(--gold)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-sm text-foreground", className)}
      aria-label="ORVELIA, inicio"
    >
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[0.28em]">ORVELIA</span>
    </Link>
  );
}
