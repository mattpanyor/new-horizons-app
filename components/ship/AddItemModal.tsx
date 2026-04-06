"use client";

import { useState, useEffect, useRef } from "react";
import type { ShipItem, ShipItemType } from "@/types/ship";
import { CARGO_TYPES, ISOLATION_TYPES } from "@/types/ship";
import { ITEM_TYPE_ICONS } from "./itemTypeIcons";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface AddItemModalProps {
  open: boolean;
  category: "cargo" | "isolation" | null;
  onClose: () => void;
  onSubmit: (fields: { name: string; quantity: number; description: string; itemType: ShipItemType; imageFile?: File | null }) => Promise<void>;
  editItem?: ShipItem | null;
}

export default function AddItemModal({ open, category, onClose, onSubmit, editItem }: AddItemModalProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<ShipItemType | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editItem;
  const types = category === "cargo" ? CARGO_TYPES : category === "isolation" ? ISOLATION_TYPES : [];

  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.name);
        setQuantity(editItem.quantity);
        setDescription(editItem.description ?? "");
        setItemType(editItem.itemType);
        setImagePreview(editItem.imageUrl ?? null);
      } else {
        setName("");
        setQuantity(1);
        setDescription("");
        setItemType("");
        setImagePreview(null);
      }
      setImageFile(null);
      setSubmitting(false);
    }
  }, [open, editItem]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !category) return null;

  const label = category === "cargo" ? "Cargo Item" : "Specimen";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !itemType) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), quantity, description: description.trim(), itemType, imageFile });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto scifi-scroll"
        style={{
          background: "linear-gradient(145deg, rgba(8, 12, 28, 0.98), rgba(4, 6, 18, 0.98))",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "0.5rem",
          boxShadow: "0 0 30px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          animation: "addItemFadeIn 0.2s ease-out",
        }}
      >
        <style>{`@keyframes addItemFadeIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

        {/* Top edge line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

        {/* Corner brackets */}
        <div className="absolute top-1 left-1 w-4 h-4 border-t border-l border-indigo-500/30" />
        <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-indigo-500/30" />
        <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l border-indigo-500/30" />
        <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r border-indigo-500/30" />

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="text-center">
            <p
              className="text-[9px] tracking-[0.5em] uppercase text-white/30 mb-1"
              style={cinzel}
            >
              {isEdit ? `Edit ${label}` : `Add ${label}`}
            </p>
            <div className="w-16 h-px mx-auto bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
          </div>

          {/* Type selector */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[8px] tracking-[0.2em] uppercase text-white/30"
              style={cinzel}
            >
              Type *
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {types.map((t) => {
                const Icon = ITEM_TYPE_ICONS[t.slug];
                const selected = itemType === t.slug;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setItemType(t.slug)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded border transition-all cursor-pointer ${
                      selected
                        ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                        : "border-white/8 bg-white/[0.02] text-white/30 hover:border-white/15 hover:bg-white/[0.04] hover:text-white/50"
                    }`}
                  >
                    <div className="w-6 h-6">
                      {Icon && <Icon />}
                    </div>
                    <span className="text-[7px] tracking-[0.1em] uppercase leading-tight text-center" style={cinzel}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name field */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[8px] tracking-[0.2em] uppercase text-white/30"
              style={cinzel}
            >
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/15 focus:border-indigo-400/40 focus:outline-none transition-colors"
              placeholder={category === "cargo" ? "e.g. Lathanium Missiles" : "e.g. Vereen Core"}
            />
          </div>

          {/* Quantity field */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[8px] tracking-[0.2em] uppercase text-white/30"
              style={cinzel}
            >
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/15 focus:border-indigo-400/40 focus:outline-none transition-colors"
            />
          </div>

          {/* Description field */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[8px] tracking-[0.2em] uppercase text-white/30"
              style={cinzel}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/15 focus:border-indigo-400/40 focus:outline-none transition-colors resize-none"
              placeholder="Optional description..."
            />
          </div>

          {/* Image upload */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[8px] tracking-[0.2em] uppercase text-white/30"
              style={cinzel}
            >
              Image
            </label>
            {imagePreview ? (
              <div className="relative w-full aspect-[16/10] rounded border border-white/10 overflow-hidden bg-white/[0.02]">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(isEdit && editItem?.imageUrl ? editItem.imageUrl : null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 hover:bg-black/80 text-white/50 hover:text-white/90 transition-colors cursor-pointer"
                  title={imageFile ? "Remove selection" : "Remove image"}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[16/10] rounded border border-dashed border-white/10 hover:border-indigo-400/30 bg-white/[0.02] hover:bg-white/[0.04] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/15">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-[7px] tracking-[0.2em] uppercase text-white/20" style={cinzel}>
                  Choose image
                </span>
              </button>
            )}
            {imagePreview && !imageFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[7px] tracking-[0.15em] uppercase text-indigo-400/40 hover:text-indigo-400/70 transition-colors cursor-pointer text-center mt-0.5"
                style={cinzel}
              >
                Replace image
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setImageFile(file);
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[9px] tracking-[0.15em] uppercase text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              style={cinzel}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !itemType || submitting}
              className="px-4 py-1.5 rounded border border-indigo-400/30 text-[9px] tracking-[0.15em] uppercase text-indigo-300/70 hover:text-indigo-300 hover:border-indigo-400/50 hover:bg-indigo-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              style={cinzel}
            >
              {submitting ? (isEdit ? "Saving..." : "Adding...") : (isEdit ? "Save" : "Add")}
            </button>
          </div>
        </form>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
