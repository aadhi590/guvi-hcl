import { useState } from "react";
import { ChevronDown } from "lucide-react";
import GlassCard from "./GlassCard";
import { useInView } from "../lib/useInView";

// Answers reflect how the backend actually behaves — anonymous voterToken
// + IP-hash dedupe, resultsHidden/reveal flow, close/expiry semantics, and
// quiz-mode scoring — not aspirational copy.
const FAQS = [
  {
    question: "Does the audience need an account?",
    answer:
      "No. Voting is anonymous — your browser gets a random token the first time you vote, and that's all the backend uses to make sure you don't vote twice on the same poll.",
  },
  {
    question: "How many people can vote on one poll?",
    answer:
      "There's no cap. Each person can vote once per poll from their browser; the only limit is a light rate limit on rapid-fire requests to stop spam-clicking.",
  },
  {
    question: "Can I hide results until I'm ready?",
    answer:
      "Yes. Turn on hidden results and your audience votes blind, with no running tally to bandwagon off of — you reveal the results yourself, live, whenever you choose.",
  },
  {
    question: "What happens when a poll closes?",
    answer:
      "Once a poll is closed — by you, or automatically if it reaches its expiry — voting stops immediately, and everyone watching sees it close in real time with no refresh needed.",
  },
  {
    question: "Can I run a quiz with a leaderboard?",
    answer:
      "Yes. Quiz mode marks one option as correct and scores answers by speed — faster correct answers score higher — with a live leaderboard that updates as people answer.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section id="faq" className="relative bg-[#0A0D12] px-6 py-24 font-sora text-[#F2F0EA] md:py-32">
      <div ref={ref} className="mx-auto max-w-2xl">
        <h2
          style={inView ? { animation: "fade-up 0.6s ease-out both" } : { opacity: 0 }}
          className="mb-14 text-center text-3xl font-medium tracking-tight md:text-4xl"
        >
          Frequently asked questions
        </h2>

        <div className="flex flex-col gap-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <GlassCard
                key={faq.question}
                className="overflow-hidden"
                style={
                  inView
                    ? { animation: `fade-up 0.5s ease-out ${0.08 + index * 0.06}s both` }
                    : { opacity: 0 }
                }
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                >
                  <span className="font-medium">{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[#8A8F9C] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="border-t border-white/[0.08] px-6 py-4 text-sm leading-relaxed text-[#8A8F9C]">
                    {faq.answer}
                  </p>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
