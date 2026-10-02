import { Activity, PenLine, QrCode } from "lucide-react";
import GlassCard from "./GlassCard";
import { useInView } from "../lib/useInView";

const STEPS = [
  {
    icon: PenLine,
    title: "Create your poll",
    description: "Write a question, add up to ten options, done in seconds.",
  },
  {
    icon: QrCode,
    title: "Share the link or QR",
    description: "Send the join code, the link, or let people scan to jump straight in.",
  },
  {
    icon: Activity,
    title: "Watch results update live",
    description: "Every vote lands instantly, no refresh, for you and everyone watching.",
  },
];

export default function HowItWorksSection() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="relative bg-[#0A0D12] px-6 py-24 font-sora text-[#F2F0EA] md:py-32"
    >
      <div ref={ref} className="mx-auto max-w-5xl">
        <h2
          style={inView ? { animation: "fade-up 0.6s ease-out both" } : { opacity: 0 }}
          className="mb-14 text-center text-3xl font-medium tracking-tight md:text-4xl"
        >
          How it works
        </h2>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <GlassCard
              key={step.title}
              className="p-6"
              style={
                inView
                  ? { animation: `fade-up 0.6s ease-out ${0.1 + i * 0.1}s both` }
                  : { opacity: 0 }
              }
            >
              <step.icon size={22} className="mb-4 text-[#7C6CF0]" strokeWidth={1.75} />
              <h3 className="mb-2 font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-[#8A8F9C]">{step.description}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
