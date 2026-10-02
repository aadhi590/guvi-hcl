import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { ApiError, api, type PollSummary } from "../api/client";
import AmbientGlow from "../components/AmbientGlow";
import GlassCard from "../components/GlassCard";
import { StatusBadge, Tag } from "../components/ui/Badge";
import { buttonVariants } from "../components/ui/Button";
import { clearSession, getStoredUser } from "../lib/auth";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [polls, setPolls] = useState<PollSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = getStoredUser();

  useEffect(() => {
    let cancelled = false;
    api
      .myPolls()
      .then((res) => {
        if (!cancelled) setPolls(res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          navigate("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Could not load your polls.");
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function handleSignOut() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#0A0D12] px-6 py-10 font-sora text-[#F2F0EA] md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/" className="text-2xl font-semibold tracking-tight">
            Pulse
          </Link>
          <div className="flex items-center gap-4">
            {user && <span className="hidden text-sm text-[#8A8F9C] sm:inline">{user.email}</span>}
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-gray-300 transition-colors duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="relative mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your polls</h1>
            {polls && polls.length > 0 && (
              <p className="mt-1 text-sm text-[#8A8F9C]">
                {polls.length} poll{polls.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="relative">
            <AmbientGlow position="right" className="h-[300px] w-[300px]" />
            <Link to="/create" className={buttonVariants("primary", "md", "relative")}>
              Create a poll
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {polls === null && !error && <p className="text-sm text-[#8A8F9C]">Loading…</p>}

        {polls !== null && polls.length === 0 && (
          <GlassCard className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
              <Sparkles size={20} className="text-[#8A8F9C]" />
            </div>
            <div>
              <p className="font-medium">No polls yet</p>
              <p className="mt-1 max-w-sm text-sm text-[#8A8F9C]">
                Create your first poll and get a shareable link, QR code, and join code in seconds.
              </p>
            </div>
            <Link to="/create" className={buttonVariants("primary")}>
              Create your first poll
            </Link>
          </GlassCard>
        )}

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {polls?.map((poll, i) => (
            <li
              key={poll.id}
              style={{ animation: `fade-up 0.4s ease-out ${i * 0.04}s both` }}
            >
              <Link to={`/polls/${poll.id}/manage`} className="block h-full">
                <GlassCard className="flex h-full flex-col justify-between p-5 transition-colors duration-200 hover:bg-white/[0.06]">
                  <span className="font-medium leading-snug">{poll.question}</span>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusBadge dot={poll.closed ? "gray" : "emerald"} label={poll.closed ? "Closed" : "Open"} />
                    <span className="text-sm text-[#8A8F9C]">{poll.total} votes</span>
                    {poll.quizMode && <Tag>Quiz</Tag>}
                  </div>
                </GlassCard>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
