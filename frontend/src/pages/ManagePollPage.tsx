import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import QRCode from "react-qr-code";
import {
  ApiError,
  api,
  type LeaderboardEntry,
  type MomentumPoint,
  type PollDetail,
} from "../api/client";
import AmbientGlow from "../components/AmbientGlow";
import FloatingReactions, { type FloatingReaction } from "../components/FloatingReactions";
import GlassCard from "../components/GlassCard";
import MomentumSparkline from "../components/MomentumSparkline";
import { StatusBadge, Tag } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { usePollStream } from "../hooks/usePollStream";

export default function ManagePollPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [momentum, setMomentum] = useState<MomentumPoint[]>([]);
  const { lastEvent, connected } = usePollStream(id);
  const momentumInterval = useRef<number | undefined>(undefined);

  // Purely presentational additions — none of this changes what's fetched
  // or how it's fetched, only how it's displayed.
  const [showWeighted, setShowWeighted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const reactionId = useRef(0);

  useEffect(() => {
    if (!id) return;
    api
      .getPoll(id)
      .then(setPoll)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this poll."));
  }, [id]);

  // Live results + leaderboard arrive over SSE; momentum has no push event
  // so it's polled on a light interval while this page is open.
  useEffect(() => {
    if (!id || !poll?.quizMode) return;
    api.leaderboard(id).then(setLeaderboard).catch(() => {});
  }, [id, poll?.quizMode]);

  useEffect(() => {
    if (!id) return;
    const fetchMomentum = () => api.momentum(id).then(setMomentum).catch(() => {});
    fetchMomentum();
    momentumInterval.current = window.setInterval(fetchMomentum, 5000);
    return () => window.clearInterval(momentumInterval.current);
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
      setPoll((prev) => (prev ? { ...prev, resultsHidden: false } : prev));
      api.getPoll(id).then(setPoll).catch(() => {});
    } else if (lastEvent.type === "leaderboard" && lastEvent.top) {
      setLeaderboard(lastEvent.top);
    } else if (lastEvent.type === "deleted") {
      navigate("/dashboard");
    } else if (lastEvent.type === "reaction" && lastEvent.emoji) {
      const nextId = reactionId.current++;
      setReactions((prev) => [
        ...prev,
        { id: nextId, emoji: lastEvent.emoji as string, x: 15 + Math.random() * 70 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  function dismissReaction(reactionIdToRemove: number) {
    setReactions((prev) => prev.filter((r) => r.id !== reactionIdToRemove));
  }

  async function handleClose() {
    if (!id) return;
    setActionError(null);
    try {
      const res = await api.closePoll(id);
      setPoll((prev) => (prev ? { ...prev, closed: res.closed } : prev));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not close the poll.");
    }
  }

  async function handleReveal() {
    if (!id) return;
    setActionError(null);
    try {
      const res = await api.revealPoll(id);
      setPoll((prev) => (prev ? { ...prev, resultsHidden: res.resultsHidden } : prev));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not reveal results.");
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm("Delete this poll permanently? This can't be undone.")) return;
    setActionError(null);
    setDeleting(true);
    try {
      await api.deletePoll(id);
      navigate("/dashboard");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete the poll.");
      setDeleting(false);
    }
  }

  function handleCopyLink() {
    if (!poll) return;
    navigator.clipboard.writeText(voteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  const voteUrl = useMemo(() => {
    if (!poll) return "";
    const base = (import.meta.env.VITE_PUBLIC_URL as string)?.replace(/\/+$/, "") || window.location.origin;
    return `${base}/polls/${poll.id}`;
  }, [poll]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0D12] px-6 font-sora text-[#F2F0EA]">
        <p className="text-sm text-red-400">{error}</p>
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
  const sortedOptions = [...poll.options].sort((a, b) => {
    const av = showWeighted ? (poll.weighted?.[a.id] ?? 0) : (poll.counts?.[a.id] ?? 0);
    const bv = showWeighted ? (poll.weighted?.[b.id] ?? 0) : (poll.counts?.[b.id] ?? 0);
    return bv - av;
  });
  const leadingId = total > 0 ? sortedOptions[0]?.id : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0D12] px-6 py-10 font-sora text-[#F2F0EA] md:py-12">
      <FloatingReactions reactions={reactions} onDone={dismissReaction} />

      <div className="relative mx-auto max-w-2xl">
        <Link to="/dashboard" className="mb-6 block text-2xl font-semibold tracking-tight">
          Pulse
        </Link>

        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl leading-snug font-semibold tracking-tight">{poll.question}</h1>
          <span
            className={`flex shrink-0 items-center gap-2 pt-1.5 text-sm ${connected ? "text-[#8A8F9C]" : "text-red-400"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
              style={connected ? { animation: "pulse-soft 2s ease-in-out infinite" } : undefined}
            />
            {connected ? "Live" : "Connecting…"}
          </span>
        </div>

        <div className="mb-7 flex flex-wrap items-center gap-3">
          <StatusBadge dot={poll.closed ? "gray" : "emerald"} label={poll.closed ? "Closed" : "Open"} />
          <span className="text-sm text-[#8A8F9C]">{total} total votes</span>
          {poll.quizMode && <Tag>Quiz mode</Tag>}
        </div>

        {/* Share — often the first thing a host needs mid-session */}
        <div className="relative mb-5">
          <AmbientGlow position="top" />
          <GlassCard className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-1 text-sm text-[#8A8F9C]">Join code</div>
              <div className="text-3xl font-semibold tracking-wide">{poll.joinCode}</div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-2 flex items-center gap-1.5 text-sm text-[#8A8F9C] transition-colors duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="truncate">{copied ? "Copied" : voteUrl}</span>
              </button>
            </div>
            <div className="shrink-0 rounded-xl bg-white p-3">
              <QRCode value={voteUrl} size={104} bgColor="#FFFFFF" fgColor="#0A0D12" />
            </div>
          </GlassCard>
        </div>

        {/* Live results — the dominant visual element on this screen */}
        <GlassCard className="mb-5 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#8A8F9C]">Live results</h2>
            <div className="flex gap-1 rounded-full border border-white/[0.08] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setShowWeighted(false)}
                className={`rounded-full px-2.5 py-1 transition-colors duration-200 ${!showWeighted ? "bg-white/10 text-[#F2F0EA]" : "text-[#8A8F9C] hover:text-white"}`}
              >
                Votes
              </button>
              <button
                type="button"
                onClick={() => setShowWeighted(true)}
                className={`rounded-full px-2.5 py-1 transition-colors duration-200 ${showWeighted ? "bg-white/10 text-[#F2F0EA]" : "text-[#8A8F9C] hover:text-white"}`}
              >
                Weighted
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {sortedOptions.map((option) => {
              const count = poll.counts?.[option.id] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const weightedPct = poll.weightedPercent?.[option.id] ?? 0;
              const displayPct = showWeighted ? weightedPct : pct;
              const isLeading = option.id === leadingId && total > 0;

              return (
                <div key={option.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                    <span className={isLeading ? "font-semibold" : ""}>{option.text}</span>
                    <span className="shrink-0 tabular-nums text-[#8A8F9C]">
                      {poll.resultsHidden
                        ? "hidden"
                        : showWeighted
                          ? `${weightedPct.toFixed(0)}%`
                          : `${count} · ${pct}%`}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[#7C6CF0] transition-[width] duration-700 ease-out"
                      style={{ width: poll.resultsHidden ? "0%" : `${displayPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Momentum — secondary, quiet */}
        <GlassCard className="mb-5 p-6">
          <h2 className="mb-3 text-sm font-medium text-[#8A8F9C]">Momentum, last 60 seconds</h2>
          <MomentumSparkline points={momentum} />
        </GlassCard>

        {/* Leaderboard — quiz mode only, top 3 given more weight */}
        {poll.quizMode && (
          <GlassCard className="mb-5 p-6">
            <h2 className="mb-4 text-sm font-medium text-[#8A8F9C]">Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-[#8A8F9C]">No correct answers yet.</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {leaderboard.map((entry, i) => (
                  <li
                    key={`${entry.nickname}-${i}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      i < 3 ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <span className={`flex items-center gap-3 ${i < 3 ? "text-base font-medium" : "text-sm"}`}>
                      <span className="w-4 text-[#8A8F9C]">{i + 1}</span>
                      {entry.nickname}
                    </span>
                    <span className={`tabular-nums text-[#8A8F9C] ${i < 3 ? "text-base" : "text-sm"}`}>
                      {entry.score}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        )}

        {actionError && <p className="mb-4 text-sm text-red-400">{actionError}</p>}

        {/* Host actions — visually distinct from the passive display above */}
        <div className="flex flex-wrap gap-3">
          {poll.resultsHidden && (
            <Button variant="secondary" onClick={handleReveal}>
              Reveal results
            </Button>
          )}
          {!poll.closed && (
            <Button variant="secondary" onClick={handleClose}>
              Close poll
            </Button>
          )}
          <Button variant="danger" onClick={handleDelete} disabled={deleting} className="ml-auto">
            {deleting ? "Deleting…" : "Delete poll"}
          </Button>
        </div>
      </div>
    </div>
  );
}
