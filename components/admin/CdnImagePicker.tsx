"use client";

import { useState, useEffect, useRef } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"]);

interface BlobItem {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

function isImage(pathname: string): boolean {
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

function fileName(pathname: string): string {
  return pathname.split("/").pop() ?? pathname;
}

interface Props {
  // Folder to open on, without a trailing slash, e.g. "storybook/3" or "messages".
  // Created on open if missing. The breadcrumb lets the user browse the whole CDN from there.
  folder: string;
  title: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

// Pick (or upload) an image from Vercel Blob, opening on `folder`.
export default function CdnImagePicker({ folder, title, onSelect, onClose }: Props) {
  const [current, setCurrent] = useState(folder); // "" = CDN root
  const [images, setImages] = useState<BlobItem[]>([]);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [ensured, setEnsured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // On open: ensure the home folder exists, creating it if missing.
  useEffect(() => {
    let cancelled = false;
    const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/") + 1) : "";
    (async () => {
      try {
        const res = await fetch(`/api/admin/cdn?prefix=${encodeURIComponent(parent)}`);
        const data = await res.json().catch(() => null);
        if (!(data?.folders ?? []).includes(`${folder}/`)) {
          await fetch("/api/admin/cdn/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: folder }),
          });
        }
      } catch {
        if (!cancelled) setError("Could not reach the CDN");
      } finally {
        if (!cancelled) setEnsured(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  // List the current folder. `cancelled` drops a slow response for a folder the user already left.
  useEffect(() => {
    if (!ensured) return;
    let cancelled = false;
    const prefix = current ? `${current}/` : "";
    (async () => {
      setLoading(true);
      try {
        // shortcut: first 200 entries only (API page size), add "load more" if a folder outgrows it.
        const res = await fetch(`/api/admin/cdn?prefix=${encodeURIComponent(prefix)}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? "Failed to load images");
          return;
        }
        setError(null);
        setSubfolders(((data.folders ?? []) as string[]).filter((f) => f !== prefix));
        setImages(
          ((data.blobs ?? []) as BlobItem[]).filter(
            (b) => b.pathname !== prefix && !b.pathname.endsWith("/") && isImage(b.pathname)
          )
        );
      } catch {
        if (!cancelled) setError("Could not reach the CDN");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, ensured, reloadKey]);

  // Esc closes the picker (capture phase, so it wins over the editor's Esc).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isImage(file.name)) {
      setError("Only image files are allowed");
      return;
    }
    // Uploads use the raw filename with no random suffix, so a same-named file
    // silently overwrites the existing one (and hijacks any embedded token).
    if (images.some((b) => fileName(b.pathname) === file.name)) {
      if (!confirm(`An image named "${file.name}" already exists in this folder. Replace it?`)) {
        return;
      }
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", current);
    const res = await fetch("/api/admin/cdn", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) {
      setError(data?.error ?? "Upload failed");
      return;
    }
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(blob: BlobItem) {
    if (!confirm(`Delete ${fileName(blob.pathname)}? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/cdn", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: blob.url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Delete failed");
      return;
    }
    setImages((prev) => prev.filter((b) => b.url !== blob.url));
  }

  const segments = current ? current.split("/") : [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col p-5 rounded border border-amber-400/30"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(145deg, rgba(14,11,6,0.98), rgba(6,5,3,0.98))",
          boxShadow: "0 0 30px rgba(180,150,80,0.18)",
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-[10px] tracking-[0.3em] uppercase text-white/65" style={cinzel}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
            style={cinzel}
          >
            Close
          </button>
        </div>
        <nav aria-label="CDN folder" className="flex items-center flex-wrap gap-1 text-[10px] font-mono mb-3">
          <button
            onClick={() => setCurrent("")}
            className={`cursor-pointer ${current === "" ? "text-amber-200/90" : "text-white/40 hover:text-amber-200/80"}`}
          >
            CDN
          </button>
          {segments.map((seg, i) => {
            const path = segments.slice(0, i + 1).join("/");
            return (
              <span key={path} className="flex items-center gap-1">
                <span className="text-white/20">/</span>
                <button
                  onClick={() => setCurrent(path)}
                  className={`cursor-pointer ${path === current ? "text-amber-200/90" : "text-white/40 hover:text-amber-200/80"}`}
                >
                  {seg}
                </button>
              </span>
            );
          })}
          {current !== folder && (
            <button
              onClick={() => setCurrent(folder)}
              className="ml-auto text-[9px] tracking-[0.15em] uppercase text-white/35 hover:text-amber-200/80 cursor-pointer"
              style={cinzel}
            >
              ↺ Back to {folder}
            </button>
          )}
        </nav>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !ensured || loading}
            className="px-4 py-2 rounded border border-amber-400/30 text-amber-200/85 hover:text-amber-200 hover:border-amber-400/60 hover:bg-amber-400/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={cinzel}
          >
            <span className="text-[10px] tracking-[0.25em] uppercase">
              {uploading ? "Uploading…" : `Upload to ${current || "CDN root"}`}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>

        {error && (
          <div className="px-3 py-2 mb-3 bg-red-500/15 border border-red-500/30 rounded text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!ensured || loading ? (
            <p className="py-10 text-center text-[10px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Loading…
            </p>
          ) : subfolders.length === 0 && images.length === 0 ? (
            <p className="py-10 text-center text-[10px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Empty folder — upload an image above
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {subfolders.map((f) => {
                const name = f.slice(0, -1).split("/").pop();
                return (
                  <button
                    key={f}
                    onClick={() => setCurrent(f.slice(0, -1))}
                    title={`Open ${f}`}
                    className="flex flex-col items-center justify-center gap-1.5 aspect-video rounded border border-white/12 hover:border-amber-400/60 bg-white/[0.03] hover:bg-amber-400/[0.06] cursor-pointer transition-colors"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-amber-200/50">
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    <span className="text-[10px] text-white/60 truncate max-w-[90%]">{name}</span>
                  </button>
                );
              })}
              {images.map((blob) => (
                <div key={blob.url} className="group relative">
                  <button
                    onClick={() => onSelect(blob.url)}
                    title="Insert this image"
                    className="block w-full aspect-video rounded border border-white/12 hover:border-amber-400/60 overflow-hidden bg-black/40 cursor-pointer transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={blob.url}
                      alt={fileName(blob.pathname)}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(blob)}
                    title="Delete"
                    className="absolute top-1 right-1 w-6 h-6 rounded bg-black/70 text-white/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                  <p className="mt-1 text-[9px] text-white/35 truncate" title={fileName(blob.pathname)}>
                    {fileName(blob.pathname)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
