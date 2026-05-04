"use client";

import { useState } from "react";

interface User {
  id: number;
  username: string;
  group: string;
  role: string | null;
  character: string | null;
  accessLevel: number;
  imageUrl: string | null;
  color: string | null;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorSwatch({ color }: { color: string | null }) {
  if (!color) return <span className="text-white/25">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-4 h-4 rounded-sm border border-white/15"
        style={{ background: color }}
      />
      <span className="text-white/55 tabular-nums text-[11px] uppercase">{color}</span>
    </span>
  );
}

function ColorEditor({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const isValid = value === null || value === "" || HEX_RE.test(value ?? "");
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value && HEX_RE.test(value) ? value : "#6366f1"}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer p-0"
        title="Pick color"
      />
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="#aabbcc"
        maxLength={7}
        className={`w-24 bg-white/10 border rounded px-2 py-1 text-white text-sm focus:outline-none ${isValid ? "border-white/20 focus:border-white/40" : "border-red-500/50"}`}
      />
    </div>
  );
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default function UsersTable({ initialUsers, canEditAccessLevel }: { initialUsers: User[]; canEditAccessLevel: boolean }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<User | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [addForm, setAddForm] = useState<{ username: string; password: string; group: string; role: string; character: string; accessLevel: number; imageUrl: string | null; color: string | null }>({ username: "", password: "", group: "", role: "", character: "", accessLevel: 0, imageUrl: null, color: null });
  const [error, setError] = useState<string | null>(null);

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({ ...user });
    setConfirmDeleteId(null);
    setResetPasswordUser(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editForm) return;
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update user");
      return;
    }

    const updated: User = await res.json();
    setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
    setEditingId(null);
    setEditForm(null);
  }

  async function confirmDelete(user: User) {
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete user");
      setConfirmDeleteId(null);
      return;
    }

    setUsers(users.filter((u) => u.id !== user.id));
    setConfirmDeleteId(null);
  }

  async function submitResetPassword() {
    if (!resetPasswordUser || !newPassword) return;
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetPasswordUser.id, password: newPassword }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to reset password");
      return;
    }

    setResetPasswordUser(null);
    setNewPassword("");
  }

  function startAdd() {
    setAddingUser(true);
    setAddForm({ username: "", password: "", group: "", role: "", character: "", accessLevel: 0, imageUrl: null, color: null });
    setEditingId(null);
    setConfirmDeleteId(null);
    setResetPasswordUser(null);
    setError(null);
  }

  function cancelAdd() {
    setAddingUser(false);
  }

  async function submitAdd() {
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add user");
      return;
    }

    const created: User = await res.json();
    setUsers([...users, created]);
    setAddingUser(false);
  }

  const columns = canEditAccessLevel
    ? ["Username", "Group", "Role", "Character", "Image", "Color", "Access Level", ""]
    : ["Username", "Group", "Role", "Character", "Image", "Color", ""];

  return (
    <div className="w-full max-w-6xl mx-auto">
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="border border-white/10 rounded-lg overflow-x-auto bg-black/40 backdrop-blur-sm">
        <table className="w-full text-sm text-left min-w-[600px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-[11px] tracking-[0.3em] uppercase text-white/50 font-normal"
                  style={cinzel}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                {editingId === user.id && editForm ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
                        value={editForm.group}
                        onChange={(e) => setEditForm({ ...editForm, group: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
                        value={editForm.role ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value || null })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
                        value={editForm.character ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, character: e.target.value || null })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
                        placeholder="https://…"
                        value={editForm.imageUrl ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value || null })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <ColorEditor
                        value={editForm.color}
                        onChange={(v) => setEditForm({ ...editForm, color: v })}
                      />
                    </td>
                    {canEditAccessLevel && (
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
                          value={editForm.accessLevel}
                          onChange={(e) => setEditForm({ ...editForm, accessLevel: parseInt(e.target.value) || 0 })}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={saveEdit}
                          className="p-1.5 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                          title="Save"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded hover:bg-white/10 text-white/50 transition-colors"
                          title="Cancel"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-white/80">{user.username}</td>
                    <td className="px-4 py-3 text-white/80">{user.group}</td>
                    <td className="px-4 py-3 text-white/60">{user.role ?? "—"}</td>
                    <td className="px-4 py-3 text-white/60">{user.character ?? "—"}</td>
                    <td className="px-4 py-3">
                      {user.imageUrl ? (
                        <img src={user.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-white/15" />
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><ColorSwatch color={user.color} /></td>
                    {canEditAccessLevel && (
                      <td className="px-4 py-3 text-white/60">{user.accessLevel}</td>
                    )}
                    <td className="px-4 py-3">
                      {confirmDeleteId === user.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-red-400 whitespace-nowrap">Delete {user.username}?</span>
                          <button
                            onClick={() => confirmDelete(user)}
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
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => startEdit(user)}
                            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                            title="Edit"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setResetPasswordUser(user); setNewPassword(""); setEditingId(null); setConfirmDeleteId(null); setError(null); }}
                            className="p-1.5 rounded hover:bg-amber-500/20 text-white/40 hover:text-amber-400 transition-colors"
                            title="Reset Password"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(user.id); setEditingId(null); setResetPasswordUser(null); setError(null); }}
                            className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={startAdd}
        className="mt-4 px-4 py-2 text-sm rounded border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add User
      </button>

      {addingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900/95 border border-white/10 rounded-lg p-6 w-full max-w-sm">
            <h2
              className="text-sm tracking-[0.3em] uppercase text-white/70 mb-4"
              style={cinzel}
            >
              Add User
            </h2>
            <div className="flex flex-col gap-3 mb-4">
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Username"
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                autoFocus
              />
              <input
                type="password"
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              />
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Group"
                value={addForm.group}
                onChange={(e) => setAddForm({ ...addForm, group: e.target.value })}
              />
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Role (optional)"
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              />
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Character (optional)"
                value={addForm.character}
                onChange={(e) => setAddForm({ ...addForm, character: e.target.value })}
              />
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Image URL (optional)"
                value={addForm.imageUrl ?? ""}
                onChange={(e) => setAddForm({ ...addForm, imageUrl: e.target.value || null })}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-white/50 whitespace-nowrap">Color (optional)</label>
                <ColorEditor
                  value={addForm.color}
                  onChange={(v) => setAddForm({ ...addForm, color: v })}
                />
              </div>
              {canEditAccessLevel && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-white/50 whitespace-nowrap">Access Level</label>
                  <input
                    type="number"
                    className="w-20 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                    value={addForm.accessLevel}
                    onChange={(e) => setAddForm({ ...addForm, accessLevel: parseInt(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelAdd}
                className="px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAdd}
                disabled={!addForm.username || !addForm.password || !addForm.group}
                className="px-3 py-1.5 text-sm rounded bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900/95 border border-white/10 rounded-lg p-6 w-full max-w-sm">
            <h2
              className="text-sm tracking-[0.3em] uppercase text-white/70 mb-4"
              style={cinzel}
            >
              Reset Password
            </h2>
            <p className="text-sm text-white/50 mb-4">
              Set a new password for <span className="text-white/80">{resetPasswordUser.username}</span>
            </p>
            <input
              type="password"
              placeholder="New password"
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 mb-4"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newPassword) submitResetPassword(); }}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setResetPasswordUser(null); setNewPassword(""); }}
                className="px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitResetPassword}
                disabled={!newPassword}
                className="px-3 py-1.5 text-sm rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
