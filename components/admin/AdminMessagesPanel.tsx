"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface User {
  id: number;
  username: string;
  character: string | null;
}

interface KankaEntity {
  entityId: number;
  name: string;
  type: string;
  imageUrl: string | null;
  title: string | null;
}

interface MessageRow {
  id: number;
  kankaEntityId: number | null;
  senderUserId: number | null;
  subject: string;
  body: string;
  sendToAll: boolean;
  createdAt: string;
  recipientUserIds: number[];
}

interface EditForm {
  id: number | null;
  kankaEntityId: number | null;
  subject: string;
  body: string;
  sendToAll: boolean;
  recipientUserIds: number[];
}

const emptyForm: EditForm = {
  id: null,
  kankaEntityId: null,
  subject: "",
  body: "",
  sendToAll: false,
  recipientUserIds: [],
};

export default function AdminMessagesPanel({ users }: { users: User[] }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [kankaEntities, setKankaEntities] = useState<KankaEntity[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entityDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    fetch("/api/admin/messages")
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => {});
  }, []);

  // Fetch kanka entities on mount
  useEffect(() => {
    fetch("/api/admin/kanka/entities")
      .then((r) => r.json())
      .then(setKankaEntities)
      .catch(() => {});
  }, []);

  // Close entity dropdown on outside click
  useEffect(() => {
    if (!entityDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(e.target as Node)) {
        setEntityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [entityDropdownOpen]);

  const selectedEntity = kankaEntities.find((e) => e.entityId === editing?.kankaEntityId) ?? null;

  const filteredEntities = entitySearch
    ? kankaEntities.filter((e) => e.name.toLowerCase().includes(entitySearch.toLowerCase()))
    : kankaEntities;

  function openNew() {
    setEditing({ ...emptyForm });
    setEntitySearch("");
    setError(null);
  }

  function openEdit(msg: MessageRow) {
    setEditing({
      id: msg.id,
      kankaEntityId: msg.kankaEntityId,
      subject: msg.subject,
      body: msg.body,
      sendToAll: msg.sendToAll,
      recipientUserIds: msg.recipientUserIds,
    });
    setEntitySearch("");
    setError(null);
  }

  const handleSave = useCallback(async () => {
    if (!editing) return;
    setError(null);

    const method = editing.id ? "PUT" : "POST";
    const payload = {
      ...(editing.id ? { id: editing.id } : {}),
      kankaEntityId: editing.kankaEntityId,
      subject: editing.subject,
      body: editing.body,
      sendToAll: editing.sendToAll,
      recipientUserIds: editing.sendToAll ? [] : editing.recipientUserIds,
    };

    const res = await fetch("/api/admin/messages", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      return;
    }

    // Refresh list
    const listRes = await fetch("/api/admin/messages");
    if (listRes.ok) setMessages(await listRes.json());
    setEditing(null);
  }, [editing]);

  async function handleDelete(id: number) {
    const res = await fetch("/api/admin/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    setConfirmDeleteId(null);
  }

  function toggleRecipient(userId: number) {
    if (!editing) return;
    const ids = editing.recipientUserIds.includes(userId)
      ? editing.recipientUserIds.filter((id) => id !== userId)
      : [...editing.recipientUserIds, userId];
    setEditing({ ...editing, recipientUserIds: ids });
  }

  // Resolve entity name for message list
  function entityName(kankaEntityId: number | null): string {
    if (!kankaEntityId) return "—";
    return kankaEntities.find((e) => e.entityId === kankaEntityId)?.name ?? `Entity #${kankaEntityId}`;
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Message list */}
      <div className="border border-white/10 rounded-lg overflow-hidden bg-black/40 backdrop-blur-sm">
        {messages.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/30 text-xs" style={cinzel}>No messages</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-center border-b border-white/5 hover:bg-white/[0.04] transition-colors"
            >
              <button
                onClick={() => openEdit(msg)}
                className="flex-1 text-left px-4 py-3"
              >
                <div className="flex gap-3 items-center">
                  <div className="shrink-0 w-8 h-8 rounded border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                    {(() => {
                      const ent = kankaEntities.find((e) => e.entityId === msg.kankaEntityId);
                      return ent?.imageUrl ? (
                        <img src={ent.imageUrl} alt="" className="w-full h-full object-cover object-top" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-white/70 font-semibold" style={cinzel}>{entityName(msg.kankaEntityId)}</span>
                      <span className="text-[9px] text-white/25">
                        {msg.sendToAll ? "All users" : `${msg.recipientUserIds.length} recipient${msg.recipientUserIds.length !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 truncate mt-0.5">{msg.subject}</div>
                    <div className="text-[10px] text-white/25 truncate mt-0.5">{msg.body.slice(0, 100)}</div>
                  </div>
                </div>
              </button>
              {/* Delete */}
              <div className="px-3">
                {confirmDeleteId === msg.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="px-2 py-1 text-xs rounded bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(msg.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={openNew}
        className="mt-4 px-4 py-2 text-sm rounded border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Message
      </button>

      {/* Edit/Add modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900/95 border border-white/10 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2
              className="text-sm tracking-[0.3em] uppercase text-white/70 mb-4"
              style={cinzel}
            >
              {editing.id ? "Edit Message" : "New Message"}
            </h2>

            <div className="flex flex-col gap-4 mb-4">
              {/* Kanka entity search dropdown */}
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1 block" style={cinzel}>Sender (Kanka Entity)</label>
                <div className="relative" ref={entityDropdownRef}>
                  <input
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                    placeholder="Search entities..."
                    value={entityDropdownOpen ? entitySearch : (selectedEntity ? `${selectedEntity.name} (${selectedEntity.type})` : "")}
                    onChange={(e) => { setEntitySearch(e.target.value); setEntityDropdownOpen(true); }}
                    onFocus={() => setEntityDropdownOpen(true)}
                  />
                  {selectedEntity && !entityDropdownOpen && (
                    <button
                      onClick={() => { setEditing({ ...editing, kankaEntityId: null }); setEntitySearch(""); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                  {entityDropdownOpen && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-xl">
                      {filteredEntities.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-white/30">No entities found</div>
                      ) : (
                        filteredEntities.slice(0, 50).map((entity) => (
                          <button
                            key={entity.entityId}
                            onClick={() => {
                              setEditing({ ...editing, kankaEntityId: entity.entityId });
                              setEntityDropdownOpen(false);
                              setEntitySearch("");
                            }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.06] transition-colors"
                          >
                            <div className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                              {entity.imageUrl ? (
                                <img src={entity.imageUrl} alt="" className="w-full h-full object-cover object-top" />
                              ) : (
                                <span className="text-[8px] text-white/20">{entity.type[0].toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-white/70 truncate">{entity.name}</div>
                              <div className="text-[9px] text-white/30">{entity.type}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1 block" style={cinzel}>Recipients</label>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.sendToAll}
                    onChange={(e) => setEditing({ ...editing, sendToAll: e.target.checked })}
                    className="rounded border-white/20 bg-white/10"
                  />
                  <span className="text-xs text-white/60">Send to all users</span>
                </label>
                {!editing.sendToAll && (
                  <div className="flex flex-wrap gap-2">
                    {users.map((user) => {
                      const selected = editing.recipientUserIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          onClick={() => toggleRecipient(user.id)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                            selected
                              ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                              : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10"
                          }`}
                        >
                          {user.character ?? user.username}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1 block" style={cinzel}>Subject</label>
                <input
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1 block" style={cinzel}>Message</label>
                <textarea
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 min-h-[120px] resize-y"
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editing.subject || !editing.body || (!editing.sendToAll && editing.recipientUserIds.length === 0)}
                className="px-3 py-1.5 text-sm rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {editing.id ? "Save" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
