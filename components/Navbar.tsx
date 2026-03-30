"use client";

import { useState, useRef, useEffect } from "react";
import { InboxDropdown } from "@/components/inbox/InboxDropdown";

interface Props {
  username: string;
  character?: string;
  role?: string;
  group: string;
  accessLevel?: number;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const adminPages = [
  { label: "User Management", href: "/admin/users" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Kanka Sync", href: "/admin/kanka" },
];

export default function Navbar({ username, character, role, group, accessLevel = 0 }: Props) {
  const displayName = character ?? username;
  const showAdmin = accessLevel >= 66;
  const [adminOpen, setAdminOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adminOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [adminOpen]);

  return (
    <header className="h-16 w-full grid grid-cols-2 md:grid-cols-3 items-center px-5 border-b border-white/5 bg-black/40 backdrop-blur-sm shrink-0 relative z-50">

      {/* Left — character + role */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold text-white/75 leading-none truncate" style={cinzel}>
          {displayName}
        </span>
        {role && (
          <span
            className="text-[10px] tracking-[0.5em] uppercase text-white/70 leading-none truncate"
            style={{ ...cinzel, textShadow: "0 0 6px rgba(255,255,255,1), 0 0 14px rgba(255,255,255,0.8)" }}
          >
            {role}
          </span>
        )}
      </div>

      {/* Centre — faction + Archives (hidden on mobile) */}
      <div className="hidden md:flex flex-col items-center justify-center gap-1.5 min-w-0 px-2">
        <span className="text-sm font-semibold text-white/75 leading-none text-center tracking-[0.2em] truncate w-full text-center" style={cinzel}>
          {group}
        </span>
        <span
          className="text-[10px] tracking-[0.8em] uppercase text-white/70 leading-none"
          style={{ ...cinzel, textShadow: "0 0 6px rgba(255,255,255,1), 0 0 14px rgba(255,255,255,0.8)" }}
        >
          Archives
        </span>
      </div>

      {/* Right — inbox + admin */}
      <div className="flex items-center justify-end gap-4">
        <InboxDropdown />

        {showAdmin && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              onMouseEnter={() => setAdminOpen(true)}
              className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300"
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-white/30 group-hover:text-white/60 transition-colors duration-300"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span
                className="text-[10px] tracking-[0.25em] uppercase text-white/30 group-hover:text-white/60 transition-colors duration-300 hidden sm:inline"
                style={cinzel}
              >
                Admin
              </span>
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`text-white/20 group-hover:text-white/50 transition-all duration-300 ${adminOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {adminOpen && (
              <div
                className="absolute right-0 top-full mt-2 min-w-[180px] rounded-lg border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden z-50"
                onMouseLeave={() => setAdminOpen(false)}
              >
                {adminPages.map((page) => (
                  <a
                    key={page.href}
                    href={page.href}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-200"
                    style={cinzel}
                  >
                    <span className="text-[11px] tracking-[0.15em]">{page.label}</span>
                  </a>
                ))}
                <div className="border-t border-white/10" />
                <a
                  href="/logout"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200"
                  style={cinzel}
                >
                  <span className="text-[11px] tracking-[0.15em]">Logout</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>

    </header>
  );
}
