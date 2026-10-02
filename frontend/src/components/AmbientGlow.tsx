type GlowPosition = "top" | "center" | "bottom" | "left" | "right";

interface AmbientGlowProps {
  position?: GlowPosition;
  className?: string;
}

const POSITION_CLASSES: Record<GlowPosition, string> = {
  top: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  left: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2",
  right: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2",
};

// One soft radial violet glow, placed behind the single focal element on a
// screen. The parent should be `relative` (and usually `overflow-hidden`)
// so this never forces a scrollbar.
export default function AmbientGlow({ position = "center", className = "" }: AmbientGlowProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 h-[560px] w-[560px] ${POSITION_CLASSES[position]} ${className}`}
      style={{
        background:
          "radial-gradient(circle, rgba(124,108,240,0.08) 0%, rgba(124,108,240,0) 70%)",
      }}
    />
  );
}
