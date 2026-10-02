import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL as string;
const WS_URL = API_URL.replace(/^http/, "ws");

export interface PollStreamEvent {
  type: "snapshot" | "update" | "closed" | "revealed" | "reaction" | "leaderboard" | "deleted";
  counts?: Record<string, number>;
  weighted?: Record<string, number>;
  total?: number;
  emoji?: string;
  top?: { nickname: string; score: number }[];
}

// Opens one real WebSocket connection to the backend's GET /polls/:id/ws —
// driven by the same Redis pub/sub + hub as the SSE endpoint, just pushed
// as WS text frames. The backend also pings every 20s to keep the
// connection alive; the browser's WebSocket implementation answers those
// automatically, so there's nothing to do here but read messages.
export function usePollStream(pollId: string | undefined) {
  const [lastEvent, setLastEvent] = useState<PollStreamEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!pollId) return;

    const ws = new WebSocket(`${WS_URL}/polls/${pollId}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (ev: MessageEvent<string>) => {
      try {
        const data = JSON.parse(ev.data) as PollStreamEvent;
        setLastEvent(data);
      } catch {
        // Not JSON — ignore rather than crash the stream handler.
      }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [pollId]);

  return { lastEvent, connected };
}
