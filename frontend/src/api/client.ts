// Single source of truth for every HTTP call this frontend makes to the
// Pulse backend. Nothing outside this file should call fetch()/axios
// directly against the API — route new calls through `api` below so the
// base URL, auth header, and error shape stay consistent everywhere.

const API_URL = import.meta.env.VITE_API_URL as string;

if (!API_URL) {
  // Fail loud in dev rather than silently hitting a relative/undefined URL.
  // eslint-disable-next-line no-console
  console.error(
    "VITE_API_URL is not set — API calls will fail. Check frontend/.env.",
  );
}

const TOKEN_KEY = "pulse_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Could not reach the server. Is the backend running?", 0);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// ---- Shared response/request shapes (mirrors backend/internal/models + handlers) ----

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface PollSummary {
  id: string;
  question: string;
  options: PollOption[];
  joinCode: string;
  resultsHidden: boolean;
  closed: boolean;
  createdAt: string;
  quizMode: boolean;
  total: number;
}

export interface PollDetail {
  id: string;
  question: string;
  options: PollOption[];
  joinCode: string;
  resultsHidden: boolean;
  closed: boolean;
  expiresAt: string | null;
  createdAt: string;
  quizMode: boolean;
  correctOptionId?: string;
  counts?: Record<string, number>;
  weighted?: Record<string, number>;
  weightedPercent?: Record<string, number>;
  total?: number;
}

export interface CreatedPoll {
  id: string;
  question: string;
  options: PollOption[];
  joinCode: string;
  path: string;
  closed: boolean;
  quizMode: boolean;
  correctOptionId?: string;
}

export interface CreatePollInput {
  question: string;
  options: string[];
  expiresAt?: string;
  quizMode?: boolean;
  correctOptionId?: string;
}

export interface VoteInput {
  optionId: string;
  voterToken: string;
  nickname?: string;
  confidence?: number;
}

export interface MomentumPoint {
  second: number;
  count: number;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
}

export interface JoinByCodeResponse {
  id: string;
  question: string;
  closed: boolean;
}

// What POST /polls/:id/close and PATCH /polls/:id/reveal actually return —
// a smaller shape than PollDetail, no counts/expiresAt/createdAt.
export interface PollMutationResponse {
  id: string;
  question: string;
  options: PollOption[];
  joinCode: string;
  resultsHidden: boolean;
  closed: boolean;
}

export const api = {
  signup: (email: string, password: string) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: { email, password } }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } }),

  myPolls: () => request<PollSummary[]>("/polls/mine"),

  createPoll: (input: CreatePollInput) =>
    request<CreatedPoll>("/polls", { method: "POST", body: input }),

  getPoll: (id: string) => request<PollDetail>(`/polls/${id}`),

  joinByCode: (joinCode: string) =>
    request<JoinByCodeResponse>(`/polls/join/${joinCode}`),

  vote: (id: string, input: VoteInput) =>
    request<{ status: string }>(`/polls/${id}/vote`, { method: "POST", body: input }),

  react: (id: string, emoji: string) =>
    request<{ status: string }>(`/polls/${id}/react`, { method: "POST", body: { emoji } }),

  closePoll: (id: string) =>
    request<PollMutationResponse>(`/polls/${id}/close`, { method: "POST" }),

  revealPoll: (id: string) =>
    request<PollMutationResponse>(`/polls/${id}/reveal`, { method: "PATCH" }),

  deletePoll: (id: string) =>
    request<{ status: string }>(`/polls/${id}`, { method: "DELETE" }),

  momentum: (id: string) => request<MomentumPoint[]>(`/polls/${id}/momentum`),

  leaderboard: (id: string) => request<LeaderboardEntry[]>(`/polls/${id}/leaderboard`),
};
