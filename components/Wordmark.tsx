/**
 * Wordmark: weight-contrast lowercase ("prenota" light + "easy" extrabold,
 * accent-colored), plus a spaced small-caps tagline (defaults to the product
 * motto, the public booking page passes the salon name instead).
 */
export function Wordmark({ tagline = "Il tuo salone, semplice" }: { tagline?: string | null }) {
  return (
    <span className="flex flex-col leading-none select-none min-w-0">
      <span className="text-[22px] tracking-[-0.02em] whitespace-nowrap">
        <span className="font-light text-[var(--ink)]">prenota</span>
        <span className="font-extrabold text-[var(--accent)]">easy</span>
      </span>
      {tagline && (
        <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-[var(--ink-2)] truncate">
          {tagline}
        </span>
      )}
    </span>
  );
}
