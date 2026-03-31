"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageModal } from "./MessageModal";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface Sender {
  name: string;
  image: string | null;
  title: string | null;
}

export interface InboxMessage {
  id: number;
  kankaEntityId: number | null;
  senderUserId: number | null;
  subject: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  sender: Sender | null;
}

export function InboxDropdown() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll unread count
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/messages/unread-count");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch { /* ignore */ }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data: InboxMessage[] = await res.json();
        setMessages(data);
        setUnreadCount(data.filter((m) => !m.isRead).length);
        setLoaded(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch messages when dropdown opens
  useEffect(() => {
    if (open) fetchMessages();
  }, [open, fetchMessages]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpenMessage(msg: InboxMessage) {
    setSelectedMessage(msg);
  }

  async function handleAcknowledge(msg: InboxMessage) {
    await fetch("/api/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msg.id }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setSelectedMessage(null);
  }

  const filtered = tab === "unread" ? messages.filter((m) => !m.isRead) : messages;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Inbox button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative group flex items-center justify-center w-9 h-9 rounded border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="text-white/30 group-hover:text-white/60 transition-colors duration-300"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-indigo-500 text-[9px] text-white font-bold px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(360px,calc(100vw-1rem))] max-h-[480px] rounded-lg border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden z-50 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setTab("unread")}
              className={`flex-1 px-4 py-2.5 text-[10px] tracking-[0.3em] uppercase transition-colors ${
                tab === "unread" ? "text-white/80 border-b-2 border-indigo-500" : "text-white/40 hover:text-white/60"
              }`}
              style={cinzel}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
            <button
              onClick={() => setTab("all")}
              className={`flex-1 px-4 py-2.5 text-[10px] tracking-[0.3em] uppercase transition-colors ${
                tab === "all" ? "text-white/80 border-b-2 border-indigo-500" : "text-white/40 hover:text-white/60"
              }`}
              style={cinzel}
            >
              All
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto">
            {!loaded ? (
              <div className="px-4 py-8 text-center text-white/30 text-xs" style={cinzel}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/30 text-xs" style={cinzel}>
                {tab === "unread" ? "No unread messages" : "No messages"}
              </div>
            ) : (
              filtered.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleOpenMessage(msg)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] transition-colors ${
                    !msg.isRead ? "bg-indigo-500/[0.04]" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="shrink-0 w-10 h-10 rounded border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                      {msg.sender?.image ? (
                        <img src={msg.sender.image} alt="" className="w-full h-full object-cover object-top" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs truncate ${!msg.isRead ? "text-white/90 font-semibold" : "text-white/60"}`} style={cinzel}>
                          {msg.sender?.name ?? "Unknown"}
                        </span>
                        {msg.sender?.title && (
                          <span className="text-[9px] text-white/30 truncate">{msg.sender.title}</span>
                        )}
                      </div>
                      <div className={`text-[11px] truncate mt-0.5 ${!msg.isRead ? "text-white/70" : "text-white/45"}`}>
                        {msg.subject}
                      </div>
                      <div className="text-[10px] text-white/25 truncate mt-0.5">
                        {msg.body.slice(0, 80)}{msg.body.length > 80 ? "..." : ""}
                      </div>
                    </div>
                    {/* Unread dot */}
                    {!msg.isRead && (
                      <div className="shrink-0 flex items-center">
                        <div className="w-2 h-2 rounded-full bg-indigo-400" />
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Message modal */}
      {selectedMessage && (
        <MessageModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onAcknowledge={!selectedMessage.isRead ? () => handleAcknowledge(selectedMessage) : undefined}
        />
      )}
    </div>
  );
}
