"use client";

import { useState, useEffect } from "react";
import type { ShipItem } from "@/types/ship";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface AddItemModalProps {
  open: boolean;
  category: "cargo" | "isolation" | null;
  onClose: () => void;
  onSubmit: (fields: { name: string; quantity: number; description: string }) => Promise<void>;
  editItem?: ShipItem | null;
}

export default function AddItemModal({ open, category, onClose, onSubmit, editItem }: AddItemModalProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editItem;

  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.name);
        setQuantity(editItem.quantity);
        setDescription(editItem.description ?? "");
      } else {
        setName("");
        setQuantity(1);
        setDescription("");
      }
      setSubmitting(false);
    }
  }, [open, editItem]);

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
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), quantity, description: description.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-sm overflow-hidden"
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
              autoFocus
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
              disabled={!name.trim() || submitting}
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
