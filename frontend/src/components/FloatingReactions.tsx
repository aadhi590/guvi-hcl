export interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

// Reaction events are event-driven motion, not ambient decoration — they
// only appear in direct response to something a real person just did.
// Absolutely positioned over a `relative overflow-hidden` parent.
export default function FloatingReactions({
  reactions,
  onDone,
}: {
  reactions: FloatingReaction[];
  onDone: (id: number) => void;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {reactions.map((r) => (
        <span
          key={r.id}
          onAnimationEnd={() => onDone(r.id)}
          className="absolute bottom-24 text-3xl [animation:float-up_2.2s_ease-out_forwards]"
          style={{ left: `${r.x}%` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
