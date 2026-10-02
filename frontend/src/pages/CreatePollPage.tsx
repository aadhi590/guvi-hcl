import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Plus, X } from "lucide-react";
import { ApiError, api } from "../api/client";
import AmbientGlow from "../components/AmbientGlow";
import GlassCard from "../components/GlassCard";
import Button from "../components/ui/Button";

const EXPIRY_OPTIONS = [
  { label: "No expiry", minutes: 0 },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "3 hours", minutes: 180 },
  { label: "1 day", minutes: 1440 },
];

export default function CreatePollPage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validOptionCount = options.filter((o) => o.trim().length > 0).length;

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => (prev.length < 10 ? [...prev, ""] : prev));
  }

  function removeOption(index: number) {
    setOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
    setCorrectIndex((prev) => (prev === index ? null : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (quizMode && correctIndex === null) {
      setError("Pick which option is correct, or turn off quiz mode.");
      return;
    }

    setLoading(true);
    try {
      const poll = await api.createPoll({
        question,
        options: options.filter((o) => o.trim().length > 0),
        quizMode: quizMode || undefined,
        correctOptionId: quizMode && correctIndex !== null ? `o${correctIndex + 1}` : undefined,
        expiresAt:
          expiryMinutes > 0
            ? new Date(Date.now() + expiryMinutes * 60_000).toISOString()
            : undefined,
      });
      navigate(`/polls/${poll.id}/manage`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0D12] px-6 py-10 font-sora text-[#F2F0EA]">
      <div className="mx-auto max-w-lg">
        <Link to="/dashboard" className="mb-8 block text-2xl font-semibold tracking-tight">
          Pulse
        </Link>

        <div className="relative">
          <AmbientGlow position="center" />

          <GlassCard className="p-6 md:p-7">
            <h1 className="mb-6 text-xl font-medium">Create a poll</h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* The question is the most important field — larger and more prominent than everything below it. */}
              <div>
                <label htmlFor="question" className="mb-1.5 block text-sm font-medium text-[#8A8F9C]">
                  Your question
                </label>
                <textarea
                  id="question"
                  required
                  maxLength={200}
                  rows={2}
                  placeholder="What should we ask the room?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-lg leading-snug text-[#F2F0EA] outline-none transition-colors duration-200 placeholder:text-gray-600 focus:border-[#7C6CF0]/60 focus-visible:ring-2 focus-visible:ring-white/20"
                />
              </div>

              {/* Options are a quieter, repeated input pattern — visibly one step down from the question. */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-[#8A8F9C]">Options</span>
                  <span className="text-xs text-[#8A8F9C]">{validOptionCount}/10</span>
                </div>
                <div className="flex flex-col gap-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="flex h-9 w-6 shrink-0 items-center justify-center text-sm text-[#8A8F9C]">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-gray-100 outline-none transition-colors duration-200 placeholder:text-gray-600 focus:border-[#7C6CF0]/60 focus-visible:ring-2 focus-visible:ring-white/20"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          aria-label={`Remove option ${index + 1}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8A8F9C] transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {options.length < 10 ? (
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-300 transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
                  >
                    <Plus size={15} /> Add option
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-[#8A8F9C]">Maximum of 10 options reached.</p>
                )}
              </div>

              {/* Advanced settings — collapsed by default, since most polls need none of this. */}
              <div className="border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  aria-expanded={advancedOpen}
                  className="flex w-full items-center justify-between text-sm font-medium text-[#8A8F9C] transition-colors duration-200 hover:text-white"
                >
                  Advanced settings
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {advancedOpen && (
                  <div
                    style={{ animation: "fade-up 0.25s ease-out both" }}
                    className="mt-4 flex flex-col gap-4"
                  >
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[#F2F0EA]">
                        Quiz mode
                        <span className="mt-0.5 block text-xs text-[#8A8F9C]">
                          Mark a correct answer and score fast, correct responses
                        </span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={quizMode}
                        onClick={() => setQuizMode((v) => !v)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none ${
                          quizMode ? "bg-white/40" : "bg-white/15"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                            quizMode ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </label>

                    {quizMode && (
                      <div style={{ animation: "fade-up 0.25s ease-out both" }}>
                        <span className="mb-2 block text-sm text-[#8A8F9C]">Correct answer</span>
                        <div className="flex flex-col gap-1.5">
                          {options.map((option, index) => (
                            <label
                              key={index}
                              className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm"
                            >
                              <input
                                type="radio"
                                name="correctOption"
                                checked={correctIndex === index}
                                onChange={() => setCorrectIndex(index)}
                                className="accent-gray-400"
                              />
                              <span className="truncate">{option.trim() || `Option ${index + 1}`}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="expiry" className="mb-1.5 block text-sm text-[#8A8F9C]">
                        Auto-close after
                      </label>
                      <select
                        id="expiry"
                        value={expiryMinutes}
                        onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                        className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-gray-100 outline-none transition-colors duration-200 focus:border-[#7C6CF0]/60 focus-visible:ring-2 focus-visible:ring-white/20"
                      >
                        {EXPIRY_OPTIONS.map((opt) => (
                          <option key={opt.minutes} value={opt.minutes} className="bg-[#0A0D12]">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create poll"}
              </Button>
            </form>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
