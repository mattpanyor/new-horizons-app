"use client";

import { useState, useRef, useCallback } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default function KankaSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setLines([]);

    try {
      const res = await fetch("/api/admin/kanka/sync", { method: "POST" });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setLines([`ERROR: ${data.error ?? res.statusText}`]);
        setSyncing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";

        setLines((prev) => {
          const next = [...prev, ...parts];
          // Auto-scroll
          requestAnimationFrame(() => {
            if (consoleRef.current) {
              consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
            }
          });
          return next;
        });
      }

      if (buffer) {
        setLines((prev) => [...prev, buffer]);
      }
    } catch (err) {
      setLines((prev) => [...prev, `ERROR: ${String(err)}`]);
    }

    setSyncing(false);
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <p className="text-sm text-white/40 mb-4" style={cinzel}>
        Sync characters, locations, and organisations from your Kanka campaign into the local database.
        This must be run from a network where the Kanka API is accessible.
      </p>

      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 text-sm rounded border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        style={cinzel}
      >
        {syncing ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" />
            </svg>
            Syncing...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Sync from Kanka
          </>
        )}
      </button>

      {/* Console */}
      {lines.length > 0 && (
        <div
          ref={consoleRef}
          className="mt-4 rounded-lg border border-white/10 bg-black/60 p-4 max-h-[60vh] overflow-y-auto font-mono"
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed ${
                line.startsWith("  ✓") ? "text-green-400/70" :
                line.startsWith("  ✗") || line.includes("ERROR") ? "text-red-400/70" :
                line.startsWith("──") || line.startsWith("Sync complete") || line.startsWith("Starting") ? "text-white/60" :
                "text-white/35"
              }`}
            >
              {line || "\u00A0"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
