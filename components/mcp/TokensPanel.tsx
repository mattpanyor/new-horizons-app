"use client";

import { useState } from "react";
import type { McpToken } from "@/lib/db/mcpTokens";
import type { ScopeInfo } from "@/lib/mcp/registry";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface Props {
  initialTokens: McpToken[];
  scopes: ScopeInfo[];
  username: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TokensPanel({ initialTokens, scopes, username }: Props) {
  const [tokens, setTokens] = useState<McpToken[]>(initialTokens);
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<string[]>(scopes.map((s) => s.scope));
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const endpoint = `${origin}/api/mcp/server`;

  const toggleScope = (scope: string) => {
    setSelected((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed || selected.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed, scopes: selected }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? "Failed to create token");
        return;
      }
      setTokens((prev) => [data.token, ...prev]);
      setFresh(data.plaintext);
      setCopied(false);
      setLabel("");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (token: McpToken) => {
    if (!confirm(`Revoke "${token.label}"? Any AI client using it stops working immediately.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/mcp/tokens?id=${token.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? "Failed to revoke token");
        return;
      }
      setTokens((prev) =>
        prev.map((t) => (t.id === token.id ? { ...t, revokedAt: new Date().toISOString() } : t))
      );
    } finally {
      setBusy(false);
    }
  };

  const copyFresh = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    setCopied(true);
  };

  return (
    <main className="relative z-10 mx-auto w-full max-w-4xl px-5 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl text-white/90" style={cinzel}>
          MCP Access
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          Connect an AI assistant to New Horizons. A token lets a client such as Claude read and
          write campaign data <em>as you</em> — it can never do anything you could not do yourself in
          the app.
        </p>
      </header>

      {/* Freshly minted token — shown exactly once */}
      {fresh && (
        <section className="rounded-lg border border-amber-400/30 bg-amber-500/[0.06] p-5 space-y-3">
          <h2 className="text-sm tracking-[0.2em] uppercase text-amber-300/80" style={cinzel}>
            Copy this now
          </h2>
          <p className="text-xs text-white/60">
            This is the only time the token is shown. If you lose it, revoke it and create another.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-black/50 px-3 py-2 font-mono text-xs text-amber-200/90">
              {fresh}
            </code>
            <button
              onClick={copyFresh}
              className="shrink-0 rounded border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setFresh(null)}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Dismiss
          </button>
        </section>
      )}

      {/* Create */}
      <section className="rounded-lg border border-white/10 bg-black/30 backdrop-blur-sm p-5 space-y-4">
        <h2 className="text-sm tracking-[0.2em] uppercase text-white/60" style={cinzel}>
          New token
        </h2>

        <div className="space-y-2">
          <label className="block text-xs text-white/50">What is it for?</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Claude on my laptop"
            maxLength={60}
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:border-indigo-400/50"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-white/50">
            What may it touch? Anything unchecked is invisible to the client.
          </label>
          <div className="space-y-2">
            {scopes.map((s) => (
              <label
                key={s.scope}
                className="flex items-start gap-3 rounded border border-white/[0.07] bg-white/[0.02] px-3 py-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.scope)}
                  onChange={() => toggleScope(s.scope)}
                  className="mt-0.5 accent-indigo-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-white/80">{s.title}</span>
                  <span className="block text-xs text-white/40">{s.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={busy || label.trim().length === 0 || selected.length === 0}
          className="rounded border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm text-indigo-200/90 hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={cinzel}
        >
          Create token
        </button>
      </section>

      {/* How to connect */}
      <section className="rounded-lg border border-white/10 bg-black/30 backdrop-blur-sm p-5 space-y-4">
        <h2 className="text-sm tracking-[0.2em] uppercase text-white/60" style={cinzel}>
          How to connect
        </h2>

        <div className="space-y-2">
          <p className="text-xs text-white/50">
            <strong className="text-white/70">Preferred</strong> — the client sends the token as a
            header. In Claude Code:
          </p>
          <pre className="overflow-x-auto rounded bg-black/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/70">
{`claude mcp add --transport http new-horizons \\
  ${endpoint} \\
  --header "Authorization: Bearer YOUR_TOKEN"`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-white/50">
            <strong className="text-white/70">Fallback</strong> — for clients that only accept a URL,
            put the token in the path instead:
          </p>
          <pre className="overflow-x-auto rounded bg-black/50 px-3 py-2 font-mono text-[11px] text-white/70">
{`${endpoint}/t/YOUR_TOKEN`}
          </pre>
          <p className="text-xs text-amber-300/60">
            A token in a URL can end up in server logs and browser history. Prefer the header form
            where the client supports it.
          </p>
        </div>
      </section>

      {/* Existing tokens */}
      <section className="space-y-3">
        <h2 className="text-sm tracking-[0.2em] uppercase text-white/60" style={cinzel}>
          Your tokens
        </h2>

        {tokens.length === 0 ? (
          <p className="text-sm text-white/35">
            No tokens yet. Create one above to connect an assistant as {username}.
          </p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((token) => {
              const revoked = token.revokedAt !== null;
              return (
                <li
                  key={token.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3 ${
                    revoked
                      ? "border-white/[0.05] bg-black/20 opacity-50"
                      : "border-white/10 bg-black/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/80 truncate">{token.label}</span>
                      {revoked && (
                        <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300/70">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/35">
                      {token.scopes.join(", ") || "no scopes"} · created {formatDate(token.createdAt)} ·
                      last used {formatDate(token.lastUsedAt)}
                    </div>
                  </div>
                  {!revoked && (
                    <button
                      onClick={() => handleRevoke(token)}
                      disabled={busy}
                      className="shrink-0 rounded border border-red-400/30 px-3 py-1.5 text-xs text-red-300/70 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
