import { useState } from "react";
import { api } from "../api/client";

const REACTIONS = ["🔥", "👏", "🤯", "😂", "❤️"];

// Reactions are intentionally ephemeral — pub/sub only, never stored — so
// this bar has no local "my reactions" state beyond a brief disabled pulse
// per button to stop accidental double-taps.
export default function ReactionBar({ pollId }: { pollId: string }) {
  const [cooling, setCooling] = useState<Record<string, boolean>>({});

  function sendReaction(emoji: string) {
    if (cooling[emoji]) return;
    setCooling((prev) => ({ ...prev, [emoji]: true }));
    api.react(pollId, emoji).catch(() => {});
    window.setTimeout(() => {
      setCooling((prev) => ({ ...prev, [emoji]: false }));
    }, 600);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => sendReaction(emoji)}
          aria-label={`React with ${emoji}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-lg transition-transform duration-150 hover:scale-110 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
