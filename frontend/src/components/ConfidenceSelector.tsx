const LEVELS = [1, 2, 3, 4, 5];
const HINTS: Record<number, string> = {
  1: "Just guessing",
  2: "Not very sure",
  3: "Somewhat sure",
  4: "Pretty sure",
  5: "Certain",
};

export default function ConfidenceSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-[#8A8F9C]">
        <span>How confident are you?</span>
        <span>{HINTS[value]}</span>
      </div>
      <div className="flex gap-2">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            aria-label={`Confidence ${level} of 5: ${HINTS[level]}`}
            aria-pressed={value === level}
            className={`h-10 flex-1 rounded-lg border text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none ${
              level <= value
                ? "border-white/20 bg-white/[0.12] text-[#F2F0EA]"
                : "border-white/[0.08] bg-white/[0.03] text-[#8A8F9C] hover:bg-white/[0.06]"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}
