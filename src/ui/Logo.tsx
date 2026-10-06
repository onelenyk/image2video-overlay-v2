/**
 * The mark: a floor plan with one room filled in highlighter yellow.
 * Same drawing as public/favicon.svg; colours are fixed so it reads on any surface.
 */
export function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#1c1c1e" />
      <rect x="16" y="14" width="10" height="12" fill="#ffd60a" />
      <path d="M6 6h20v20H6zM16 6v11.5M16 22.5V26M16 14h10" fill="none" stroke="#f2f2f2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SIZES = {
  sm: { mark: "w-7 h-7", text: "text-[16px]" },
  md: { mark: "w-9 h-9", text: "text-[19px]" },
  lg: { mark: "w-12 h-12", text: "text-[26px]" },
};

/** Mark plus wordmark. The second word sits on a marker swipe, the way the app highlights things. */
export function Logo({ size = "md", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={`${s.mark} shrink-0`} />
      <span className={`${s.text} font-bold tracking-tight leading-none whitespace-nowrap text-fg`}>
        Plan <span className="text-brand">Highlighter</span>
      </span>
    </span>
  );
}
