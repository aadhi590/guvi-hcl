import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { getToken } from "../api/client";

export default function RequireAuth({ children }: { children: ReactElement }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
