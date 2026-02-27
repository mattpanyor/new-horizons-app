"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StarSystemBackground from "@/components/StarSystemBackground";

const DELAY = 5;
const AUTO_REDIRECT = true;

interface Props {
  username: string;
  character?: string;
  role?: string;
  group: string;
}

export default function WelcomeScreen({ username, character, role, group }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(DELAY);

  useEffect(() => {
    if (!AUTO_REDIRECT) return;
    const id = setInterval(() => {
      setCount((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (AUTO_REDIRECT && count === 0) {
      router.push("/sectors");
    }
  }, [count, router]);

  const progress = ((DELAY - count) / DELAY) * 100;
  const isGM = !character && !role;
  const lastName = character ? character.split(" ").at(-1) : undefined;

  return (
    <>
      <StarSystemBackground />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center text-center w-full max-w-lg gap-3">

          <p
            className="text-[9px] tracking-[0.55em] uppercase text-white/20 mb-4"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            Identity Verified
          </p>

          {isGM ? (
            <>
              <p
                className="text-sm tracking-[0.3em] uppercase text-white/30"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                Welcome,
              </p>
              <h1
                className="text-5xl font-semibold text-white/90 tracking-wide"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                {group}
              </h1>
            </>
          ) : (
            <>
              <p
                className="text-xl tracking-[0.3em] text-white/30"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                Welcome to the
              </p>

              <h1
                className="text-4xl font-semibold text-white/90 leading-snug"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                {group}
              </h1>

              <p
                className="text-2xl font-bold tracking-[0.7em] uppercase text-white/25 mt-1"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                Archives
              </p>

              {/* Sci-fi deco frame around role + name */}
              <div className="relative inline-flex items-center justify-center gap-4 px-8 py-3 mt-4">

                {/* Inner fill */}
                <div className="absolute inset-0 bg-indigo-950/30" />

                {/* Gradient edge lines */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

                {/* Corner L-brackets */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-indigo-400/70" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t border-r border-indigo-400/70" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-indigo-400/70" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-indigo-400/70" />

                {/* Corner diamonds */}
                <div className="absolute top-0 left-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 -translate-x-1/2 -translate-y-1/2"
                  style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
                <div className="absolute top-0 right-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 translate-x-1/2 -translate-y-1/2"
                  style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
                <div className="absolute bottom-0 left-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 -translate-x-1/2 translate-y-1/2"
                  style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
                <div className="absolute bottom-0 right-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 translate-x-1/2 translate-y-1/2"
                  style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />

                {/* Side whiskers */}
                <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 w-3 h-px bg-indigo-400/30" />
                <div className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 w-3 h-px bg-indigo-400/30" />

                {/* Top/bottom center ticks */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full flex items-center gap-1">
                  <div className="w-3 h-px bg-indigo-400/30" />
                  <div className="w-[4px] h-[4px] rotate-45 bg-indigo-400/50" />
                  <div className="w-3 h-px bg-indigo-400/30" />
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full flex items-center gap-1">
                  <div className="w-3 h-px bg-indigo-400/30" />
                  <div className="w-[4px] h-[4px] rotate-45 bg-indigo-400/50" />
                  <div className="w-3 h-px bg-indigo-400/30" />
                </div>

                {role && (
                  <span
                    className="relative text-2xl text-indigo-300/60 tracking-widest"
                    style={{ fontFamily: "var(--font-cinzel), serif" }}
                  >
                    {role}
                  </span>
                )}
                {role && character && (
                  <span className="relative text-white/15 text-xs">·</span>
                )}
                {lastName && (
                  <span
                    className="relative text-2xl font-semibold text-white/90"
                    style={{ fontFamily: "var(--font-cinzel), serif" }}
                  >
                    {lastName}
                  </span>
                )}
              </div>
            </>
          )}

          <div className="w-full flex flex-col gap-2 mt-10">
            <div className="w-full h-px bg-white/10 overflow-hidden">
              <div
                className="h-full bg-indigo-400/40 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p
              className="text-[9px] tracking-[0.35em] uppercase text-white/20"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              Entering Galactic Map in {count}
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
