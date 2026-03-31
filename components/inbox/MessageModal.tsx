"use client";

import { createPortal } from "react-dom";
import type { InboxMessage } from "./InboxDropdown";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface MessageModalProps {
  message: InboxMessage;
  onClose: () => void;
  onAcknowledge?: () => void;
}

function renderMessageBody(body: string): React.ReactNode[] {
  const parts = body.split(/(\[yt=[^\]]+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[yt=([^\]]+)\]$/);
    if (match) {
      return (
        <div key={i} className="my-3 rounded overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.2)" }}>
          <iframe
            src={`https://www.youtube.com/embed/${match[1]}`}
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

export function MessageModal({ message, onClose, onAcknowledge }: MessageModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(10, 10, 30, 0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "0.5rem",
          boxShadow: "0 0 30px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Top gradient edge line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
        {/* Bottom gradient edge line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

        {/* Corner L-brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-indigo-400/70" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-indigo-400/70" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-indigo-400/70" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-indigo-400/70" />

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

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          {/* Avatar with sci-fi frame */}
          <div
            className="relative shrink-0 w-24 rounded overflow-hidden"
            style={{
              border: "1px solid rgba(99, 102, 241, 0.4)",
              boxShadow: "0 0 12px rgba(99, 102, 241, 0.15)",
            }}
          >
            {message.sender?.image ? (
              <img src={message.sender.image} alt="" className="w-full h-auto" />
            ) : (
              <div className="w-full h-24 flex items-center justify-center bg-indigo-950/30">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400/30">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
          {/* Sender info */}
          <div className="flex-1 min-w-0 pt-1">
            <span className="text-2xl text-white/90 font-semibold block" style={cinzel}>
              {message.sender?.name ?? "Unknown"}
            </span>
            {message.sender?.title && (
              <span
                className="text-sm tracking-[0.15em] text-indigo-300/40 mt-1 block"
                style={cinzel}
              >
                {message.sender.title}
              </span>
            )}
          </div>
        </div>

        {/* Divider with center tick */}
        <div className="relative px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
            <div className="w-2 h-px bg-indigo-400/40" />
            <div className="w-[3px] h-[3px] rotate-45 bg-indigo-400/50" />
            <div className="w-2 h-px bg-indigo-400/40" />
          </div>
        </div>

        {/* Subject */}
        <div className="px-6 pt-4 pb-2">
          <h2
            className="text-lg text-white/80 tracking-[0.05em]"
            style={cinzel}
          >
            {message.subject}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 pt-2 max-h-[40vh] overflow-y-auto">
          <div className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap">
            {renderMessageBody(message.body)}
          </div>
        </div>

        {/* Acknowledge button */}
        <div className="px-6 py-5 flex justify-center">
          {onAcknowledge ? (
            <button
              onClick={onAcknowledge}
              className="w-[40%] py-2.5 text-xs tracking-[0.3em] uppercase rounded transition-colors"
              style={{
                ...cinzel,
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                color: "rgba(165, 180, 252, 0.8)",
                boxShadow: "0 0 10px rgba(99, 102, 241, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.25)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.15)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.35)";
              }}
            >
              Acknowledged
            </button>
          ) : (
            <div
              className="w-[40%] py-2.5 text-xs tracking-[0.3em] uppercase rounded text-center"
              style={{
                ...cinzel,
                color: "rgba(255, 255, 255, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              Acknowledged
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
