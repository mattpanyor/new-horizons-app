"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface BlobItem {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

// ─── File type helpers ───

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "avi", "mkv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);
const TEXT_EXT = new Set(["txt", "md", "csv", "log", "json", "xml", "yaml", "yml", "html", "css", "js", "ts", "tsx"]);

function getExt(pathname: string): string {
  return pathname.split(".").pop()?.toLowerCase() ?? "";
}

function getFileType(pathname: string): "image" | "video" | "audio" | "text" | "other" {
  const ext = getExt(pathname);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (TEXT_EXT.has(ext)) return "text";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileName(pathname: string): string {
  return pathname.split("/").pop() ?? pathname;
}

// ─── Type-based SVG icons ───

function VideoIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <rect x="4" y="10" width="40" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05" />
      <polygon points="20,17 33,24 20,31" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05" />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1" fillOpacity="0" />
      <circle cx="24" cy="24" r="2" fill="currentColor" fillOpacity="0.4" />
      <path d="M24 6 L24 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 38 L24 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 24 L10 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M38 24 L42 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <rect x="8" y="4" width="32" height="40" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05" />
      <line x1="14" y1="14" x2="34" y2="14" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round" />
      <line x1="14" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3" strokeLinecap="round" />
      <line x1="14" y1="26" x2="32" y2="26" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round" />
      <line x1="14" y1="32" x2="24" y2="32" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <path d="M12 4 L30 4 L38 12 L38 44 L12 44 Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.05" strokeLinejoin="round" />
      <path d="M30 4 L30 12 L38 12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="25" cy="28" r="5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}

function FolderIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Subcomponents ───

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split("/").filter(Boolean);
  return (
    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-white/40 flex-wrap">
      <button
        onClick={() => onNavigate("")}
        className="hover:text-white/70 transition-colors cursor-pointer tracking-[0.15em] uppercase"
        style={cinzel}
      >
        Root
      </button>
      {parts.map((part, i) => {
        const fullPath = parts.slice(0, i + 1).join("/");
        return (
          <span key={fullPath} className="flex items-center gap-1">
            <span className="text-white/15">/</span>
            <button
              onClick={() => onNavigate(fullPath)}
              className="hover:text-white/70 transition-colors cursor-pointer"
              style={cinzel}
            >
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function FileCard({
  blob,
  onDelete,
  onRename,
  onCopyUrl,
}: {
  blob: BlobItem;
  onDelete: () => void;
  onRename: () => void;
  onCopyUrl: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const type = getFileType(blob.pathname);
  const name = fileName(blob.pathname);

  return (
    <div
      className="relative flex flex-col rounded-lg border border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-all overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Preview area */}
      <div className="aspect-square flex items-center justify-center p-3 relative overflow-hidden">
        {type === "image" ? (
          <img
            src={blob.url}
            alt={name}
            className="w-full h-full object-contain rounded"
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 text-white/20">
            {type === "video" && <VideoIcon />}
            {type === "audio" && <AudioIcon />}
            {type === "text" && <TextIcon />}
            {type === "other" && <FileIcon />}
          </div>
        )}

        {/* Hover actions */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <button
            onClick={onCopyUrl}
            title="Copy URL"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            onClick={onRename}
            title="Rename"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-300 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-2.5 pb-2.5 pt-1">
        <p className="text-[9px] sm:text-[10px] text-white/50 truncate" title={name}>
          {name}
        </p>
        <p className="text-[8px] text-white/20 mt-0.5">
          {formatSize(blob.size)} &middot; {getExt(blob.pathname).toUpperCase()}
        </p>
      </div>
    </div>
  );
}

function FolderCard({
  name,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] hover:border-indigo-400/25 hover:bg-white/[0.04] transition-all cursor-pointer aspect-square"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`transition-colors mb-1 ${hovered ? "text-indigo-400/50" : "text-indigo-400/30"}`}>
        <FolderIcon className="w-10 h-10" />
      </div>
      <p className="text-[9px] sm:text-[10px] text-white/50 truncate max-w-[90%] text-center" title={name}>
        {name}
      </p>

      {/* Hover actions */}
      <div className={`absolute top-1.5 right-1.5 flex items-center gap-1 transition-opacity ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          title="Rename folder"
          className="p-1 rounded bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete folder"
          className="p-1 rounded bg-white/10 hover:bg-red-500/30 text-white/50 hover:text-red-300 transition-colors cursor-pointer"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ───

export default function CdnPanel() {
  const [currentPath, setCurrentPath] = useState("");
  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prefix = currentPath ? currentPath + "/" : "";

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const fetchBlobs = useCallback(async (cursor?: string) => {
    if (!cursor) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (prefix) params.set("prefix", prefix);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/cdn?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast(data?.error ?? "Failed to load files", "error");
        return;
      }
      const data = await res.json();
      const allBlobs: BlobItem[] = data.blobs ?? [];
      const allFolders: string[] = data.folders ?? [];

      // Filter blobs: only show files directly in current folder (not nested)
      const directBlobs = allBlobs.filter((b: BlobItem) => {
        const relative = b.pathname.slice(prefix.length);
        return relative.length > 0 && !relative.includes("/");
      });

      // Get immediate child folders
      const folderSet = new Set<string>();
      for (const f of allFolders) {
        const relative = f.slice(prefix.length).replace(/\/$/, "");
        const first = relative.split("/")[0];
        if (first) folderSet.add(first);
      }
      for (const b of allBlobs) {
        const relative = b.pathname.slice(prefix.length);
        if (relative.includes("/")) {
          folderSet.add(relative.split("/")[0]);
        }
      }

      if (cursor) {
        setBlobs((prev) => [...prev, ...directBlobs]);
      } else {
        setBlobs(directBlobs);
        setFolders(Array.from(folderSet).sort());
      }
      setHasMore(data.hasMore);
      setNextCursor(data.cursor ?? null);
    } finally {
      setLoading(false);
    }
  }, [prefix, showToast]);

  useEffect(() => {
    fetchBlobs();
  }, [fetchBlobs]);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    let failed = 0;
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", currentPath);
        const res = await fetch("/api/admin/cdn", { method: "POST", body: formData });
        if (!res.ok) failed++;
      }
      await fetchBlobs();
      if (failed > 0) {
        showToast(`${failed} file(s) failed to upload`, "error");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBlob = async (blob: BlobItem) => {
    if (!confirm(`Delete "${fileName(blob.pathname)}"?`)) return;
    const res = await fetch("/api/admin/cdn", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: blob.url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error ?? "Delete failed", "error");
      return;
    }
    await fetchBlobs();
  };

  const handleRenameBlob = async (blob: BlobItem) => {
    const oldName = fileName(blob.pathname);
    const newName = prompt("Rename file:", oldName);
    if (!newName || newName === oldName) return;

    const sanitized = newName.replace(/[/\\]/g, "");
    if (!sanitized || sanitized.includes("..")) {
      showToast("Invalid file name", "error");
      return;
    }

    const folder = blob.pathname.substring(0, blob.pathname.lastIndexOf("/"));
    const toPathname = folder ? `${folder}/${sanitized}` : sanitized;
    const res = await fetch("/api/admin/cdn", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUrl: blob.url, toPathname }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error ?? "Rename failed", "error");
      return;
    }
    await fetchBlobs();
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast("URL Copied");
  };

  const handleCreateFolder = async () => {
    const name = prompt("New folder name:");
    if (!name || !name.trim()) return;

    const sanitized = name.trim().replace(/[/\\]/g, "");
    if (!sanitized || sanitized.includes("..")) {
      showToast("Invalid folder name", "error");
      return;
    }

    const path = currentPath ? `${currentPath}/${sanitized}` : sanitized;
    const res = await fetch("/api/admin/cdn/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error ?? "Failed to create folder", "error");
      return;
    }
    await fetchBlobs();
  };

  const handleRenameFolder = async (folderName: string) => {
    const newName = prompt("Rename folder:", folderName);
    if (!newName || newName === folderName) return;

    const sanitized = newName.trim().replace(/[/\\]/g, "");
    if (!sanitized || sanitized.includes("..")) {
      showToast("Invalid folder name", "error");
      return;
    }

    const oldPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    const newPath = currentPath ? `${currentPath}/${sanitized}` : sanitized;
    const res = await fetch("/api/admin/cdn/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error ?? "Folder rename failed", "error");
      return;
    }
    await fetchBlobs();
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`Delete folder "${folderName}" and all its contents?`)) return;
    const path = currentPath ? `${currentPath}/${folderName}` : folderName;
    const res = await fetch("/api/admin/cdn/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error ?? "Folder delete failed", "error");
      return;
    }
    await fetchBlobs();
  };

  const isEmpty = !loading && folders.length === 0 && blobs.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <Breadcrumb path={currentPath} onNavigate={setCurrentPath} />

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/5 transition-all cursor-pointer text-[9px] tracking-[0.15em] uppercase"
            style={cinzel}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Folder
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-400/20 text-indigo-400/50 hover:text-indigo-400/80 hover:border-indigo-400/40 hover:bg-indigo-400/5 disabled:opacity-30 transition-all cursor-pointer text-[9px] tracking-[0.15em] uppercase"
            style={cinzel}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg border text-xs tracking-[0.15em] uppercase ${
            toast.type === "error"
              ? "border-red-400/30 bg-[rgba(28,8,8,0.95)] text-red-300/80"
              : "border-indigo-400/30 bg-[rgba(8,12,28,0.95)] text-indigo-300/80"
          }`}
          style={cinzel}
        >
          {toast.message}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase" style={cinzel}>
            Loading...
          </p>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-white/10">
            <FolderIcon className="w-12 h-12" />
          </div>
          <p className="text-white/20 text-xs tracking-[0.2em] uppercase" style={cinzel}>
            {currentPath ? "Empty folder" : "No files yet"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {/* Folders first */}
            {folders.map((f) => (
              <FolderCard
                key={f}
                name={f}
                onOpen={() => setCurrentPath(currentPath ? `${currentPath}/${f}` : f)}
                onRename={() => handleRenameFolder(f)}
                onDelete={() => handleDeleteFolder(f)}
              />
            ))}
            {/* Then files */}
            {blobs.map((blob) => (
              <FileCard
                key={blob.url}
                blob={blob}
                onDelete={() => handleDeleteBlob(blob)}
                onRename={() => handleRenameBlob(blob)}
                onCopyUrl={() => handleCopyUrl(blob.url)}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && nextCursor && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={() => fetchBlobs(nextCursor)}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/5 transition-all cursor-pointer text-[9px] tracking-[0.15em] uppercase"
                style={cinzel}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
