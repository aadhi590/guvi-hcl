import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import AmbientGlow from "../components/AmbientGlow";
import GlassCard from "../components/GlassCard";
import PollBarsCanvas from "../components/PollBarsCanvas";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { storeSession } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side pre-check for immediate inline feedback only — the real
    // validation (and the actual signup call below) is unchanged.
    const nextFieldErrors: typeof fieldErrors = {};
    if (!EMAIL_RE.test(email)) nextFieldErrors.email = "Enter a valid email address.";
    if (password.length < 8) nextFieldErrors.password = "Password must be at least 8 characters.";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await api.signup(email, password);
      storeSession(res.token, res.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0A0D12] px-6 py-16 font-sora text-[#F2F0EA]">
      <PollBarsCanvas opacityScale={0.45} speedScale={0.4} />

      <div
        style={{ animation: "fade-up 0.6s ease-out both" }}
        className="relative z-10 w-full max-w-sm"
      >
        <Link to="/" className="mb-8 block text-center text-2xl font-semibold tracking-tight">
          Pulse
        </Link>

        <div className="relative">
          <AmbientGlow position="center" />

          <GlassCard className="p-7">
            <h1 className="mb-1 text-center text-xl font-medium">Create your account</h1>
            <p className="mb-6 text-center text-sm text-[#8A8F9C]">
              Hosts need an account. Voting never does.
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" disabled={loading} className="mt-2">
                {loading ? "Creating account…" : "Sign up"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-[#8A8F9C]">
              Already have an account?{" "}
              <Link to="/login" className="text-gray-200 transition-colors duration-200 hover:text-white">
                Sign in
              </Link>
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
