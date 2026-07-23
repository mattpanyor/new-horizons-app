"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
// Typewriter feel for the record values — sells the "typed file" look.
const mono = { fontFamily: "var(--font-geist-mono, ui-monospace), monospace" };

export interface DossierUser {
  id: number;
  username: string;
  character?: string;
  role?: string;
  group: string;
  accessLevel: number;
  imageUrl?: string;
  color?: string;
}

function clearanceLabel(level: number): string {
  if (level >= 127) return "Command";
  if (level >= 66) return "Officer";
  return "Crew";
}

// Pads the user id into a flavorful record number, e.g. 42 -> "REC-0042".
function fileNumber(id: number): string {
  return `REC-${String(id).padStart(4, "0")}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b border-white/[0.06] last:border-b-0">
      <div
        className="text-[10px] tracking-[0.25em] uppercase text-indigo-300/40 mb-1"
        style={cinzel}
      >
        {label}
      </div>
      <div className="text-base text-white/80" style={mono}>
        {children}
      </div>
    </div>
  );
}

export function DossierModal({ user, onClose }: { user: DossierUser; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Esc to close + focus management + focus trap + body scroll lock.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  const displayName = user.character ?? user.username;
  const letter = displayName[0] ?? "?";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px] px-4 py-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Character dossier"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden outline-none"
        style={{
          background: "rgba(10, 10, 30, 0.94)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "0.5rem",
          boxShadow:
            "0 0 40px rgba(99, 102, 241, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Top / bottom gradient edge lines */}
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent z-10"
        />
        <div
          aria-hidden
          className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent z-10"
        />

        {/* Corner L-brackets */}
        <div aria-hidden className="absolute top-0 left-0 w-5 h-5 border-t border-l border-indigo-400/70 z-10" />
        <div aria-hidden className="absolute top-0 right-0 w-5 h-5 border-t border-r border-indigo-400/70 z-10" />
        <div aria-hidden className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-indigo-400/70 z-10" />
        <div aria-hidden className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-indigo-400/70 z-10" />

        {/* Faint scanline texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05] z-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 4px)",
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close dossier"
          className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* File header bar */}
        <div className="relative z-10 px-6 pt-5 pb-4 shrink-0">
          <div className="flex items-center justify-between pr-10">
            <span className="text-sm tracking-[0.3em] uppercase text-white/85" style={cinzel}>
              Personnel Dossier
            </span>
            <span className="text-[11px] tracking-[0.15em] text-indigo-300/50" style={mono}>
              {fileNumber(user.id)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="text-[9px] tracking-[0.3em] uppercase px-1.5 py-0.5 rounded-sm"
              style={{
                ...cinzel,
                color: "rgba(251, 191, 36, 0.75)",
                border: "1px solid rgba(251, 191, 36, 0.35)",
                background: "rgba(251, 191, 36, 0.06)",
              }}
            >
              Classified
            </span>
          </div>
        </div>

        {/* Divider */}
        <div aria-hidden className="relative z-10 px-6 shrink-0">
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
        </div>

        {/* Body: image + record (scrollable) */}
        <div className="relative z-10 flex-1 overflow-y-auto scifi-scroll">
          <div className="flex flex-col sm:flex-row gap-6 p-6">
            {/* Full subject image */}
            <div className="shrink-0 w-full sm:w-[46%] flex flex-col gap-2">
              <div
                className="relative w-full bg-slate-900/70 rounded overflow-hidden flex items-center justify-center"
                style={{
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  boxShadow: "0 0 14px rgba(99, 102, 241, 0.12)",
                  minHeight: "200px",
                }}
              >
                {/* Image-plate corner brackets */}
                <div aria-hidden className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-indigo-400/60 z-10" />
                <div aria-hidden className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-indigo-400/60 z-10" />
                <div aria-hidden className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-indigo-400/60 z-10" />
                <div aria-hidden className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-indigo-400/60 z-10" />

                {user.imageUrl ? (
                  // Full, uncropped subject image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.imageUrl}
                    alt={`${displayName} — subject image`}
                    className="w-full h-auto max-h-[340px] object-contain"
                  />
                ) : (
                  <span className="text-6xl text-slate-600 uppercase py-12" style={cinzel}>
                    {letter}
                  </span>
                )}
              </div>
              <span className="text-[9px] tracking-[0.25em] uppercase text-white/25 text-center" style={cinzel}>
                Subject Image
              </span>
            </div>

            {/* Record */}
            <div className="min-w-0 flex-1 flex flex-col">
              {/* Designation */}
              <div className="pb-2">
                <div className="text-[10px] tracking-[0.3em] uppercase text-indigo-300/40 mb-1" style={cinzel}>
                  Designation
                </div>
                <div className="text-2xl text-white/90 font-semibold leading-tight" style={cinzel}>
                  {displayName}
                </div>
              </div>

              <div className="mt-1">
                {user.role && <Field label="Function">{user.role}</Field>}
                <Field label="Affiliation">{user.group}</Field>
                <Field label="Clearance">{clearanceLabel(user.accessLevel)}</Field>
              </div>

              {/* Status stamp */}
              <div className="mt-auto pt-6 flex justify-end">
                <span
                  aria-hidden
                  className="text-base tracking-[0.3em] uppercase font-bold select-none"
                  style={{
                    ...cinzel,
                    color: "rgba(74, 222, 128, 0.2)",
                    border: "2px solid rgba(74, 222, 128, 0.2)",
                    borderRadius: "3px",
                    padding: "3px 12px",
                    transform: "rotate(-6deg)",
                  }}
                >
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
