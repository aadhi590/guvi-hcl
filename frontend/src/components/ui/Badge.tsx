import type { ReactNode } from "react";

type DotColor = "emerald" | "gray" | "red";

const DOT_COLORS: Record<DotColor, string> = {
  emerald: "bg-emerald-400",
  gray: "bg-[#8A8F9C]",
  red: "bg-red-400",
};

/** A dot + label status indicator — never color alone, always paired with text. */
export function StatusBadge({ dot, label }: { dot: DotColor; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-[#8A8F9C]">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[dot]}`} />
      {label}
    </span>
  );
}

/** A neutral outlined tag for metadata (e.g. "Quiz") — never the accent color, which is reserved for the one primary action per screen. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-[#8A8F9C]">
      {children}
    </span>
  );
}
