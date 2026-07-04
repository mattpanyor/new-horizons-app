"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  chapter: number;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function StoryImagePicker({ chapter, onSelect, onClose }: Props) {
  const prefix = `storybook/${chapter}/`;
  const [images, setImages] = useState<BlobItem[]>([]);
  const [status, setStatus] = useState<"init" | "ready">("init");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    const res = await fetch(`/api/admin/cdn?prefix=${encodeURIComponent(prefix)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Failed to load images");
      return;
    }
    const blobs: BlobItem[] = (data.blobs ?? []).filter(
      (b: BlobItem) => b.pathname !== prefix && !b.pathname.endsWith("/") && isImage(b.pathname)
    );
    setImages(blobs);
  }, [prefix]);

  // On open: ensure storybook/<chapter>/ exists, creating it if missing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("init");
      setError(null);
      try {
        const res = await fetch(`/api/admin/cdn?prefix=${encodeURIComponent("storybook/")}`);
        const data = await res.json().catch(() => null);
        const folders: string[] = data?.folders ?? [];
        if (!folders.includes(prefix)) {
          await fetch("/api/admin/cdn/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: `storybook/${chapter}` }),
          });
        }
        await loadImages();
      } catch {
        if (!cancelled) setError("Could not reach the CDN");
      } finally {
        if (!cancelled) setStatus("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapter, prefix, loadImages]);

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
      if (!confirm(`An image named "${file.name}" already exists in this chapter. Replace it?`)) {
        return;
      }
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", `storybook/${chapter}`);
    const res = await fetch("/api/admin/cdn", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) {
      setError(data?.error ?? "Upload failed");
      return;
    }
    await loadImages();
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
            Chapter {chapter} Images
          </h3>
          <button
            onClick={onClose}
            className="text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
            style={cinzel}
          >
            Close
          </button>
        </div>
        <p className="text-[9px] text-white/30 font-mono mb-3">{prefix}</p>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || status === "init"}
            className="px-4 py-2 rounded border border-amber-400/30 text-amber-200/85 hover:text-amber-200 hover:border-amber-400/60 hover:bg-amber-400/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={cinzel}
          >
            <span className="text-[10px] tracking-[0.25em] uppercase">
              {uploading ? "Uploading…" : "Upload image"}
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
          {status === "init" ? (
            <p className="py-10 text-center text-[10px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Preparing folder…
            </p>
          ) : images.length === 0 ? (
            <p className="py-10 text-center text-[10px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              No images yet — upload one above
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
