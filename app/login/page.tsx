"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import StarSystemBackground from "@/components/StarSystemBackground";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/");
    } else {
      setError("Invalid username or password.");
    }
  }

  return (
    <>
      <StarSystemBackground />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Title */}
          <div className="text-center mb-8">
            <p
              className="text-[10px] tracking-[0.5em] text-white/25 uppercase mb-2"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              New Horizons
            </p>
            <h1
              className="text-2xl font-semibold text-white/80"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              Crew Access
            </h1>
          </div>

          {/* Card */}
          <form onSubmit={handleSubmit} className="scifi-card p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-[10px] tracking-[0.3em] uppercase text-slate-400"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-slate-900/60 border border-indigo-500/30 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400/60 transition-colors"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-[10px] tracking-[0.3em] uppercase text-slate-400"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900/60 border border-indigo-500/30 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400/60 transition-colors"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              />
            </div>

            {error && (
              <p
                className="text-xs text-red-400/80 text-center"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 py-2 rounded bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-500/50 text-white/90 text-sm tracking-widest uppercase transition-colors disabled:opacity-50"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              {loading ? "Verifying…" : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
