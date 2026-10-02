// A fixed, full-screen, 3%-opacity noise texture so dark surfaces never
// read as flat dead color. Rendered once at the app root so every page
// gets it for free. Purely decorative: pointer-events-none, aria-hidden.
export default function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03]"
    >
      <svg className="h-full w-full">
        <filter id="pulse-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#pulse-grain)" />
      </svg>
    </div>
  );
}
