"use client";

import { useState } from "react";
import type { McpTokenRevealed } from "@/lib/db/mcpTokens";
import type { ScopeInfo } from "@/lib/mcp/registry";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface IssuableUser {
  username: string;
  character: string | null;
  accessLevel: number;
}

interface Props {
  initialTokens: McpTokenRevealed[];
  users: IssuableUser[];
  scopes: ScopeInfo[];
  secretConfigured: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function McpTokensPanel({
  initialTokens,
  users,
  scopes,
  secretConfigured,
}: Props) {
  const [tokens, setTokens] = useState<McpTokenRevealed[]>(initialTokens);
  const [username, setUsername] = useState(users[0]?.username ?? "");
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<string[]>(scopes.map((s) => s.scope));
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const endpoint = `${origin}/api/mcp/server`;

  const toggleScope = (scope: string) =>
    setSelected((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );

  const toggleReveal = (id: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!username || !trimmed || selected.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, label: trimmed, scopes: selected }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? "Failed to issue token");
        return;
      }
      setTokens((prev) => [data.token, ...prev]);
      setRevealed((prev) => new Set(prev).add(data.token.id));
      setLabel("");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (token: McpTokenRevealed) => {
    const who = token.username;
    if (
      !confirm(
        `Revoke "${token.label}" belonging to ${who}?\n\nAny AI client using it stops working immediately.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/mcp/tokens?id=${token.id}`, { method: "DELETE" });
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

  const copyUrl = async (token: McpTokenRevealed) => {
    if (!token.plaintext) return;
    await navigator.clipboard.writeText(`${endpoint}/t/${token.plaintext}`);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <main className="relative z-10 mx-auto w-full max-w-5xl px-5 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl text-white/90" style={cinzel}>
          MCP Access
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          Issue a token so a player can connect an AI assistant to the campaign. The token acts as
          that player — it can never do more than they could do themselves in the app. Send them the
          connection URL; they never need to visit this page.
        </p>
      </header>

      {!secretConfigured && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/[0.08] p-4 text-sm text-red-200/80">
          <strong>MCP_TOKEN_SECRET is not set on this server.</strong> New tokens cannot be issued,
          and existing ones cannot be shown. Set it in the environment and redeploy.
        </div>
      )}

      {/* Issue */}
      <section className="rounded-lg border border-white/10 bg-black/30 backdrop-blur-sm p-5 space-y-4">
        <h2 className="text-sm tracking-[0.2em] uppercase text-white/60" style={cinzel}>
          Issue a token
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs text-white/50">For whom?</label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 focus:outline-none focus:border-indigo-400/50"
            >
              {users.map((u) => (
                <option key={u.username} value={u.username} className="bg-gray-950">
                  {u.character ? `${u.character} (${u.username})` : u.username} — level{" "}
                  {u.accessLevel}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-white/50">What is it for?</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Claude on their laptop"
              maxLength={60}
              className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:border-indigo-400/50"
            />
          </div>
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
          disabled={busy || !secretConfigured || !username || !label.trim() || selected.length === 0}
          className="rounded border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm text-indigo-200/90 hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={cinzel}
        >
          Issue token
        </button>
      </section>

      {/* Tokens */}
      <section className="space-y-3">
        <h2 className="text-sm tracking-[0.2em] uppercase text-white/60" style={cinzel}>
          Issued tokens
        </h2>

        {tokens.length === 0 ? (
          <p className="text-sm text-white/35">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((token) => {
              const revoked = token.revokedAt !== null;
              const isOpen = revealed.has(token.id);
              return (
                <li
                  key={token.id}
                  className={`rounded-lg border px-4 py-3 space-y-2 ${
                    revoked
                      ? "border-white/[0.05] bg-black/20 opacity-50"
                      : "border-white/10 bg-black/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/85 truncate">{token.username}</span>
                        <span className="text-xs text-white/35 truncate">— {token.label}</span>
                        {revoked && (
                          <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300/70">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/35">
                        {token.scopes.join(", ") || "no scopes"} · issued{" "}
                        {formatDate(token.createdAt)}
                        {token.issuedBy ? ` by ${token.issuedBy}` : ""} · last used{" "}
                        {formatDate(token.lastUsedAt)}
                      </div>
                    </div>

                    {!revoked && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => toggleReveal(token.id)}
                          disabled={!token.plaintext}
                          title={token.plaintext ? undefined : "Token cannot be decrypted"}
                          className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-30 transition-colors"
                        >
                          {isOpen ? "Hide" : "Show URL"}
                        </button>
                        <button
                          onClick={() => handleRevoke(token)}
                          disabled={busy}
                          className="rounded border border-red-400/30 px-3 py-1.5 text-xs text-red-300/70 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>

                  {isOpen && token.plaintext && (
                    <div className="space-y-2 border-t border-white/[0.07] pt-2">
                      <div className="space-y-1">
                        <p className="text-[11px] text-white/40">
                          Send this URL to {token.username} — it works in any client that takes a
                          plain URL:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 overflow-x-auto rounded bg-black/50 px-3 py-2 font-mono text-[11px] text-amber-200/85">
                            {endpoint}/t/{token.plaintext}
                          </code>
                          <button
                            onClick={() => copyUrl(token)}
                            className="shrink-0 rounded border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-colors"
                          >
                            {copiedId === token.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] text-white/40">
                          Or, for Claude Code — safer, keeps the token out of logs:
                        </p>
                        <pre className="overflow-x-auto rounded bg-black/50 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/60">
{`claude mcp add --transport http new-horizons ${endpoint} \\
  --header "Authorization: Bearer ${token.plaintext}"`}
                        </pre>
                      </div>

                      <p className="text-[11px] text-amber-300/50">
                        Treat this like a password — anyone holding it acts as {token.username}. If
                        it leaks, revoke it here.
                      </p>
                    </div>
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
