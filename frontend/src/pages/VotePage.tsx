import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { ApiError, api, type PollDetail } from "../api/client";
import ConfidenceSelector from "../components/ConfidenceSelector";
import GlassCard from "../components/GlassCard";
import ReactionBar from "../components/ReactionBar";
import Button from "../components/ui/Button";
import { usePollStream } from "../hooks/usePollStream";
import { getVoterToken } from "../lib/voterToken";

export default function VotePage() {
  const { id } = useParams<{ id: string }>();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const { lastEvent } = usePollStream(id);

  useEffect(() => {
    if (!id) return;
    api
      .getPoll(id)
      .then(setPoll)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this poll."));
  }, [id]);

  useEffect(() => {
    if (!lastEvent || !poll) return;
    if (lastEvent.type === "snapshot" || lastEvent.type === "update") {
      setPoll((prev) =>
        prev
          ? {
              ...prev,
              counts: lastEvent.counts ?? prev.counts,
              weighted: lastEvent.weighted ?? prev.weighted,
              total: lastEvent.total ?? prev.total,
            }
          : prev,
      );
    } else if (lastEvent.type === "closed") {
      setPoll((prev) => (prev ? { ...prev, closed: true } : prev));
    } else if (lastEvent.type === "revealed" && id) {
      api.getPoll(id).then(setPoll).catch(() => {});
    } else if (lastEvent.type === "deleted") {
      setDeleted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  async function handleConfirmVote() {
    if (!id || !selectedOptionId) return;
    setVoteError(null);

    if (poll?.quizMode && nickname.trim().length === 0) {
      setVoteError("Enter a nickname before voting on this quiz.");
      return;
    }

    setVoting(true);
    try {
      await api.vote(id, {
        optionId: selectedOptionId,
        voterToken: getVoterToken(),
        confidence,
        ...(poll?.quizMode ? { nickname: nickname.trim() } : {}),
      });
      setVoted(true);
      // Hidden-results polls omit counts entirely for non-owners — refetch
      // in case the host already revealed between load and this vote.
      api.getPoll(id).then(setPoll).catch(() => {});
    } catch (err) {
      setVoteError(err instanceof ApiError ? err.message : "Could not cast your vote.");
    } finally {
      setVoting(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0D12] px-6 font-sora text-[#F2F0EA]">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0D12] px-6 font-sora text-[#F2F0EA]">
        <p className="text-sm text-[#8A8F9C]">This poll has been deleted by its host.</p>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0D12] font-sora text-[#F2F0EA]">
        <p className="text-sm text-[#8A8F9C]">Loading…</p>
      </div>
    );
  }

  const total = poll.total ?? 0;
  // The backend omits `counts` entirely for non-owners while results are
  // hidden, so "results exist but are empty" and "results are hidden" must
  // be told apart by the presence of the field, not just resultsHidden.
  const resultsAvailable = poll.counts !== undefined;
  const showResults = resultsAvailable && (!poll.resultsHidden || poll.closed);

  // Quiz polls need a nickname before anything else is tappable at all.
  const needsNicknameGate = poll.quizMode && !nicknameConfirmed && !voted && !poll.closed;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0D12] px-5 py-10 font-sora text-[#F2F0EA]">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-7 block text-center text-xl font-semibold tracking-tight">
          Pulse
        </Link>

        {poll.closed && !voted && (
          <GlassCard className="mb-5 border-white/15 px-4 py-3 text-center text-sm text-[#8A8F9C]">
            This poll is closed.
          </GlassCard>
        )}

        <h1 className="mb-7 text-center text-2xl leading-tight font-semibold md:text-3xl">
          {poll.question}
        </h1>

        {needsNicknameGate ? (
          <div style={{ animation: "fade-up 0.35s ease-out both" }}>
            <p className="mb-3 text-center text-sm text-[#8A8F9C]">
              This is a quiz — enter a nickname to appear on the leaderboard.
            </p>
            <input
              type="text"
              maxLength={30}
              autoFocus
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nickname.trim()) setNicknameConfirmed(true);
              }}
              className="mb-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-base text-gray-100 outline-none transition-colors duration-200 focus:border-white/25 focus-visible:ring-2 focus-visible:ring-white/20"
            />
            <Button
              className="w-full"
              disabled={nickname.trim().length === 0}
              onClick={() => setNicknameConfirmed(true)}
            >
              Continue
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {poll.options.map((option) => {
                const count = poll.counts?.[option.id] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isSelected = selectedOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={voting || voted || poll.closed}
                    onClick={() => setSelectedOptionId(option.id)}
                    className="text-left focus-visible:outline-none disabled:cursor-not-allowed"
                  >
                    <GlassCard
                      className={`relative overflow-hidden px-5 py-5 text-base transition-colors duration-200 ${
                        isSelected
                          ? "border-white/30 bg-white/[0.08]"
                          : voting || voted || poll.closed
                            ? ""
                            : "hover:bg-white/[0.06]"
                      } focus-visible:ring-2 focus-visible:ring-white/40`}
                    >
                      {showResults && (
                        <div
                          className="absolute inset-y-0 left-0 bg-[#7C6CF0]/15 transition-[width] duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3 font-medium">
                          {isSelected && !voted && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                              <Check size={13} />
                            </span>
                          )}
                          {option.text}
                        </span>
                        {showResults && (
                          <span className="shrink-0 tabular-nums text-[#8A8F9C]">
                            {count} ({pct}%)
                          </span>
                        )}
                      </div>
                    </GlassCard>
                  </button>
                );
              })}
            </div>

            {/* Confidence is a quick second step right after picking an option, not a separate form. */}
            {selectedOptionId && !voted && !poll.closed && (
              <div style={{ animation: "fade-up 0.3s ease-out both" }} className="mt-5">
                <ConfidenceSelector value={confidence} onChange={setConfidence} />
                <Button className="mt-4 w-full" onClick={handleConfirmVote} disabled={voting}>
                  {voting ? "Casting vote…" : "Cast vote"}
                </Button>
              </div>
            )}

            {!poll.closed && poll.resultsHidden && !voted && !selectedOptionId && (
              <p className="mt-5 text-center text-sm text-[#8A8F9C]">
                Results are hidden for now — they'll appear the moment your host reveals them.
              </p>
            )}

            {voteError && <p className="mt-4 text-center text-sm text-red-400">{voteError}</p>}

            {voted && (
              <div style={{ animation: "fade-up 0.4s ease-out both" }} className="mt-6 flex flex-col items-center gap-5">
                <p className="flex items-center gap-1.5 text-sm text-[#8A8F9C]">
                  <Check size={15} className="text-emerald-400" /> Your vote has been counted
                </p>
                <ReactionBar pollId={id as string} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
