import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** Private image served through a short-lived signed URL (hence a plain <img>). */
export function ProductThumb({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket; not optimizable
        <img src={url} alt={name} className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <Package className="size-1/3 text-muted-foreground" aria-hidden strokeWidth={1.5} />
      )}
    </div>
  );
}
