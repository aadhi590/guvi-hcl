import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { getToken } from "../api/client";
import AmbientGlow from "./AmbientGlow";
import PollBarsCanvas from "./PollBarsCanvas";
import ScrambleText from "./ScrambleText";
import { buttonVariants } from "./ui/Button";

const DEMO_POLL_ID = import.meta.env.VITE_DEMO_POLL_ID as string;

type NavItem =
  | { label: string; kind: "anchor"; href: string }
  | { label: string; kind: "route"; to: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Live demo", kind: "route", to: `/polls/${DEMO_POLL_ID}` },
  { label: "How it works", kind: "anchor", href: "#how-it-works" },
  { label: "FAQ", kind: "anchor", href: "#faq" },
];

export default function Hero() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const isAuthed = Boolean(getToken());

  return (
    <div className="min-h-screen bg-[#0A0D12] font-sora">
      <section className="relative h-screen w-full overflow-hidden">
        <PollBarsCanvas />
        <AmbientGlow position="center" className="h-[720px] w-[720px]" />

        <div className="relative z-10 flex h-full flex-col">
          <nav
            style={{ animation: "fade-in 0.6s ease-out both" }}
            className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-8"
          >
            <Link to="/" className="text-2xl font-semibold tracking-tight text-[#F2F0EA]">
              Pulse
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_ITEMS.map((item) =>
                item.kind === "anchor" ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-sm font-medium text-gray-400 transition-colors duration-200 hover:text-white"
                  >
                    <ScrambleText text={item.label} />
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="text-sm font-medium text-gray-400 transition-colors duration-200 hover:text-white"
                  >
                    <ScrambleText text={item.label} />
                  </Link>
                ),
              )}
              <Link
                to="/login"
                className="text-sm text-gray-300 transition-colors duration-200 hover:text-white"
              >
                <ScrambleText text="Sign in" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="text-gray-200 md:hidden"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default md:hidden"
                />
                <div className="absolute inset-x-4 top-full z-50 mt-2 flex animate-[dropdown-in_180ms_ease-out] flex-col gap-4 rounded-xl border border-white/10 bg-black/80 p-6 shadow-lg backdrop-blur-md md:hidden">
                  {NAV_ITEMS.map((item) =>
                    item.kind === "anchor" ? (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="text-base text-gray-200 transition-colors duration-200 hover:text-white"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className="text-base text-gray-200 transition-colors duration-200 hover:text-white"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="border-t border-white/10 pt-4 text-base text-gray-200 transition-colors duration-200 hover:text-white"
                  >
                    Sign in
                  </Link>
                </div>
              </>
            )}
          </nav>

          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p
              style={{ animation: "fade-up 0.7s ease-out 0.05s both" }}
              className="mb-5 text-sm font-medium tracking-wide text-gray-400"
            >
              live audience polling
            </p>

            <div>
              <div
                style={{ animation: "fade-up 0.8s ease-out 0.15s both" }}
                className="text-6xl leading-[0.95] font-normal tracking-tighter text-gray-500 sm:text-7xl md:text-8xl lg:text-9xl"
              >
                Ask.
              </div>
              <div
                style={{ animation: "fade-up 0.8s ease-out 0.28s both" }}
                className="-mt-2 text-6xl leading-[0.95] font-medium tracking-tighter text-[#F2F0EA] sm:-mt-3 sm:text-7xl md:-mt-4 md:text-8xl lg:text-9xl"
              >
                Watch it move.
              </div>
            </div>

            <p
              style={{ animation: "fade-up 0.7s ease-out 0.42s both" }}
              className="mt-7 mb-9 max-w-xl text-lg leading-relaxed text-gray-400 md:text-xl"
            >
              Votes land and results shift before anyone looks away.
            </p>

            <div
              style={{ animation: "fade-up 0.7s ease-out 0.54s both" }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Link to={`/polls/${DEMO_POLL_ID}`} className={buttonVariants("secondary")}>
                See a live poll
              </Link>
              <Link to={isAuthed ? "/create" : "/signup"} className={buttonVariants("primary")}>
                Create a poll
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
