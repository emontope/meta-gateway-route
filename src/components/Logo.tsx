import { cn } from "@/lib/utils";

/** Embossed metal badge mark + wordmark. size="xl" is the massive hero logo. */
export function Logo({ size = "sm", className }: { size?: "sm" | "xl"; className?: string }) {
  const xl = size === "xl";
  return (
    <div className={cn("flex flex-wrap items-center", xl ? "gap-6 md:gap-8" : "gap-3", className)}>
      <svg
        viewBox="0 0 120 120"
        width={xl ? 176 : 40}
        height={xl ? 176 : 40}
        className={xl ? "size-28 md:size-44 shrink-0" : "size-10 shrink-0"}
        aria-hidden
      >
        <defs>
          <linearGradient id="tr-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--metal-highlight)" />
            <stop offset="1" stopColor="var(--metal-edge)" />
          </linearGradient>
          <linearGradient id="tr-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--purple-highlight)" />
            <stop offset="1" stopColor="var(--purple-edge)" />
          </linearGradient>
          <linearGradient id="tr-chrome" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="90">
            <stop offset="0" stopColor="var(--foreground)" />
            <stop offset="1" stopColor="var(--muted-foreground)" />
          </linearGradient>
        </defs>
        <rect x="4" y="6" width="112" height="112" rx="28" fill="var(--lo)" />
        <rect x="4" y="2" width="112" height="112" rx="28" fill="url(#tr-rim)" />
        <rect x="12" y="10" width="96" height="96" rx="21" fill="url(#tr-face)" />
        <rect x="12" y="10" width="96" height="96" rx="21" fill="none" stroke="var(--purple-edge)" strokeWidth="1.5" />
        {/* routing glyph: three upstream lines merging into one */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="var(--purple-edge)" strokeWidth="9" transform="translate(0 2)">
            <path d="M32 36 H52 Q60 36 64 46 L66 58 H90" />
            <path d="M32 58 H90" />
            <path d="M32 80 H52 Q60 80 64 70 L66 58" />
          </g>
          <g stroke="url(#tr-chrome)" strokeWidth="9">
            <path d="M32 36 H52 Q60 36 64 46 L66 58 H90" />
            <path d="M32 58 H90" />
            <path d="M32 80 H52 Q60 80 64 70 L66 58" />
          </g>
        </g>
        <circle cx="90" cy="58" r="8" fill="url(#tr-chrome)" stroke="var(--purple-edge)" strokeWidth="1.5" />
      </svg>
      <div className="leading-none">
        <div
          className={cn(
            "font-display font-black engraved",
            xl ? "logo-wordmark" : "text-xl",
          )}
        >
          tope<span className="text-primary">router</span>
        </div>
        {xl && (
          <div className="label-plate mt-4 md:mt-6 text-xs md:text-sm">
            meta-gateway · one key · every gateway · every model
          </div>
        )}
      </div>
    </div>
  );
}
