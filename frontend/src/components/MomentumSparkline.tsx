import { useId } from "react";
import type { MomentumPoint } from "../api/client";

// Secondary supporting data on the manage page — deliberately quiet (thin
// line, soft fill, no axis labels) so it never competes with the live
// results above it.
export default function MomentumSparkline({ points }: { points: MomentumPoint[] }) {
  const gradientId = useId();
  const width = 100;
  const height = 36;
  const max = Math.max(1, ...points.map((p) => p.count));

  const coords = points.map((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * width;
    const y = height - (p.count / max) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? `${linePath} L${width},${height} L0,${height} Z`
      : "";

  const hasActivity = points.some((p) => p.count > 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C6CF0" stopOpacity={hasActivity ? 0.25 : 0.08} />
          <stop offset="100%" stopColor="#7C6CF0" stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
      <path
        d={linePath}
        fill="none"
        stroke="#7C6CF0"
        strokeOpacity={hasActivity ? 0.9 : 0.35}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
