import type { CSSProperties, ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section";
}

// The one reusable surface for every panel in the app — the dashboard's
// poll cards, the create form, the manage page's sections, vote buttons,
// the auth forms. Padding is deliberately not baked in here so each use
// site can size it to its own content. The inset top highlight is a subtle
// light-catch, like a real pane of glass, not a shadow — shadows are
// reserved for genuinely floating overlays (the mobile nav dropdown).
export default function GlassCard({ children, className = "", style, as = "div" }: GlassCardProps) {
  const Tag = as;
  return (
    <Tag
      style={style}
      className={`relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[20px] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent ${className}`}
    >
      {children}
    </Tag>
  );
}
