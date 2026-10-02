import { clearToken, setToken, type User } from "../api/client";

const USER_KEY = "pulse_user";

export function storeSession(token: string, user: User): void {
  setToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  clearToken();
  localStorage.removeItem(USER_KEY);
}
