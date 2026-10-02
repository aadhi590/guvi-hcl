import { useEffect, useRef } from "react";

const BASE_BAR_ALPHA = 0.2;
const BAR_HEIGHT = 12;

interface Bar {
  yFrac: number;
  base: number;
  amp: number;
  speed: number;
  phase: number;
}

// Five "poll options" racing behind the content. Phases and speeds are
// deliberately mismatched so the bars never fall into obvious lock-step —
// it should read as live, slightly chaotic data, not a mechanical loop.
const BARS: Bar[] = [
  { yFrac: 0.34, base: 0.46, amp: 0.22, speed: 0.55, phase: 0 },
  { yFrac: 0.45, base: 0.4, amp: 0.2, speed: 0.4, phase: 1.1 },
  { yFrac: 0.56, base: 0.5, amp: 0.18, speed: 0.65, phase: 2.4 },
  { yFrac: 0.67, base: 0.38, amp: 0.22, speed: 0.48, phase: 3.6 },
  { yFrac: 0.78, base: 0.44, amp: 0.2, speed: 0.6, phase: 5.0 },
];

interface PollBarsCanvasProps {
  /** Multiplier on the base bar alpha (0.2). 1 = Hero intensity. */
  opacityScale?: number;
  /** Multiplier on each bar's oscillation speed. 1 = Hero speed. */
  speedScale?: number;
  className?: string;
}

export default function PollBarsCanvas({
  opacityScale = 1,
  speedScale = 1,
  className = "",
}: PollBarsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const barColor = `rgba(124, 108, 240, ${BASE_BAR_ALPHA * opacityScale})`;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;

    function drawBar(yFrac: number, widthFrac: number) {
      const y = yFrac * height;
      const w = Math.max(widthFrac * width, BAR_HEIGHT);
      const r = BAR_HEIGHT / 2;

      ctx!.beginPath();
      ctx!.moveTo(r, y);
      ctx!.lineTo(w - r, y);
      ctx!.arc(w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      ctx!.lineTo(r, y + BAR_HEIGHT);
      ctx!.arc(r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
      ctx!.closePath();
      ctx!.fillStyle = barColor;
      ctx!.fill();
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, width, height);
      for (const bar of BARS) {
        const widthFrac = bar.base + bar.amp * Math.sin(bar.phase);
        drawBar(bar.yFrac, widthFrac);
      }
    }

    function render(time: number) {
      ctx!.clearRect(0, 0, width, height);
      const t = time / 1000;
      for (const bar of BARS) {
        const osc = Math.sin(t * bar.speed * speedScale + bar.phase);
        const widthFrac = bar.base + bar.amp * osc;
        drawBar(bar.yFrac, widthFrac);
      }
      frameRef.current = requestAnimationFrame(render);
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (prefersReducedMotion) {
        drawStatic();
      }
    }

    resize();
    window.addEventListener("resize", resize);

    if (prefersReducedMotion) {
      drawStatic();
    } else {
      frameRef.current = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [opacityScale, speedScale]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
    />
  );
}
