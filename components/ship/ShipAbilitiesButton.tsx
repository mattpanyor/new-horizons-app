"use client";

import { useState, useEffect, useCallback } from "react";
import type { ShipAbility, ShipItem } from "@/types/ship";
import ShipAbilitiesModal from "./ShipAbilitiesModal";
import AddItemModal from "./AddItemModal";
import ItemDetailModal from "./ItemDetailModal";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
const LIIX_LOGO = "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/liix_logo.jpeg";

const btnClass =
  "flex items-center gap-2.5 px-4 py-2 rounded-lg border border-white/10 md:border-white/20 text-white/40 md:text-white/60 hover:text-white/70 md:hover:text-white/90 hover:border-white/25 md:hover:border-white/40 hover:bg-white/5 md:hover:bg-white/10 transition-all cursor-pointer";
const btnStyle = { ...cinzel, backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" };

type ModalId = "cargo" | "isolation" | "abilities" | null;

const ITEM_ICONS: Record<string, React.ReactNode> = {
  "Lathanium Missiles": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 2 L14 8 L12 20 L10 8 Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 10 L12 20 L16 10" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" fillOpacity="0.2" />
    </svg>
  ),
  "Vereen Core": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-full h-full">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="12" r="1" fill="currentColor" fillOpacity="0.4" />
      <path d="M12 5 L12 2" />
      <path d="M12 22 L12 19" />
      <path d="M5 12 L2 12" />
      <path d="M22 12 L19 12" />
      <circle cx="12" cy="12" r="10" strokeDasharray="2 3" strokeOpacity="0.4" />
    </svg>
  ),
};

function DefaultItemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ItemTile({
  item,
  canEdit,
  onEdit,
  onDelete,
  onClick,
}: {
  item: ShipItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  return (
    <div className="group/tile flex items-center gap-3 px-3 py-2 rounded border border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="w-8 h-8 shrink-0 text-indigo-400/60">
        {ITEM_ICONS[item.name] ?? <DefaultItemIcon />}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span
          className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-white/45"
          style={cinzel}
        >
          {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}
        </span>
        {item.description && (
          <span className="text-[8px] text-white/25 mt-0.5 leading-tight truncate">
            {item.description}
          </span>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 group-hover/tile:opacity-100 transition-opacity shrink-0">
          {/* Edit button */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-indigo-400/80 transition-colors cursor-pointer"
            title="Edit"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-red-400/80 transition-colors cursor-pointer"
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

interface ShipAbilitiesButtonProps {
  abilities: ShipAbility[];
  shipName: string;
  shipClass: string;
  accessLevel: number;
}

export default function ShipAbilitiesButton({ abilities, shipName, shipClass, accessLevel }: ShipAbilitiesButtonProps) {
  const [openModal, setOpenModal] = useState<ModalId>(null);
  const [addingTo, setAddingTo] = useState<"cargo" | "isolation" | null>(null);
  const [editingItem, setEditingItem] = useState<ShipItem | null>(null);
  const [viewingItem, setViewingItem] = useState<ShipItem | null>(null);
  const [cargo, setCargo] = useState<ShipItem[]>([]);
  const [isolation, setIsolation] = useState<ShipItem[]>([]);
  const [loadingCargo, setLoadingCargo] = useState(false);
  const [loadingIsolation, setLoadingIsolation] = useState(false);

  const canEditCargo = accessLevel >= 0;
  const canEditIsolation = accessLevel >= 1;

  const fetchItems = useCallback(async (category: "cargo" | "isolation") => {
    const setLoading = category === "cargo" ? setLoadingCargo : setLoadingIsolation;
    const setItems = category === "cargo" ? setCargo : setIsolation;
    setLoading(true);
    try {
      const res = await fetch(`/api/ship/items?category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems("cargo");
    if (accessLevel >= 1) {
      fetchItems("isolation");
    }
  }, [fetchItems, accessLevel]);

  const handleAddItem = async (fields: { name: string; quantity: number; description: string }) => {
    if (!addingTo) return;
    const res = await fetch("/api/ship/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: addingTo, ...fields }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to add item");
      return;
    }
    await fetchItems(addingTo);
    setAddingTo(null);
  };

  const handleEditItem = async (fields: { name: string; quantity: number; description: string }) => {
    if (!editingItem) return;
    const res = await fetch("/api/ship/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingItem.id,
        name: fields.name,
        quantity: fields.quantity,
        description: fields.description,
        imageUrl: editingItem.imageUrl,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to update item");
      return;
    }
    await fetchItems(editingItem.category);
    if (viewingItem?.id === editingItem.id) setViewingItem(null);
    setEditingItem(null);
  };

  const handleDeleteItem = async (item: ShipItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const res = await fetch("/api/ship/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to delete item");
      return;
    }
    if (viewingItem?.id === item.id) setViewingItem(null);
    await fetchItems(item.category);
  };

  function renderItemList(
    items: ShipItem[],
    loading: boolean,
    canEdit: boolean,
    category: "cargo" | "isolation",
    emptyLabel: string,
  ) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {loading ? (
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase text-center" style={cinzel}>
            Loading...
          </p>
        ) : items.length > 0 ? (
          items.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              canEdit={canEdit}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDeleteItem(item)}
              onClick={() => setViewingItem(item)}
            />
          ))
        ) : (
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase text-center" style={cinzel}>
            {emptyLabel}
          </p>
        )}
        {canEdit && (
          <button
            onClick={() => setAddingTo(category)}
            className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-indigo-400/20 text-indigo-400/50 hover:text-indigo-400/80 hover:border-indigo-400/40 hover:bg-indigo-400/5 transition-all cursor-pointer"
            style={cinzel}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-[8px] tracking-[0.2em] uppercase">Add Item</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 left-3 sm:left-6 md:left-10 z-40 flex flex-col gap-3">
        <button onClick={() => setOpenModal("cargo")} className={btnClass} style={btnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a4 4 0 0 0-8 0v2" />
          </svg>
          <span className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase">
            Cargo
          </span>
        </button>

        {accessLevel >= 1 && (
          <button onClick={() => setOpenModal("isolation")} className={btnClass} style={btnStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="3" x2="12" y2="1" />
              <line x1="12" y1="23" x2="12" y2="21" />
              <line x1="3" y1="12" x2="1" y2="12" />
              <line x1="23" y1="12" x2="21" y2="12" />
            </svg>
            <span className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase">
              Isolation
            </span>
          </button>
        )}

        <button onClick={() => setOpenModal("abilities")} className={btnClass} style={btnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase">
            Abilities
          </span>
        </button>
      </div>

      {/* Abilities modal */}
      <ShipAbilitiesModal
        abilities={abilities}
        shipName={shipName}
        shipClass={shipClass}
        open={openModal === "abilities"}
        onClose={() => setOpenModal(null)}
      />

      {/* Cargo modal */}
      <ShipAbilitiesModal
        abilities={[]}
        shipName={shipName}
        shipClass={shipClass}
        open={openModal === "cargo"}
        onClose={() => setOpenModal(null)}
        terminalLabel={`${shipClass} — ${shipName} — Cargo Hold`}
        statusLabel="Cargo Manifest"
        headerLabel="Cargo Hold"
      >
        {renderItemList(cargo, loadingCargo, canEditCargo, "cargo", "No cargo loaded")}
      </ShipAbilitiesModal>

      {/* Isolation modal */}
      <ShipAbilitiesModal
        abilities={[]}
        shipName={shipName}
        shipClass={shipClass}
        open={openModal === "isolation"}
        onClose={() => setOpenModal(null)}
        backgroundLogo={LIIX_LOGO}
        terminalLabel={`${shipClass} — ${shipName} — Isolation Protocol`}
        statusLabel="L.I.I.X. Clearance"
        headerLabel="Xeno-specimen Storage"
      >
        {renderItemList(isolation, loadingIsolation, canEditIsolation, "isolation", "No specimens stored")}
      </ShipAbilitiesModal>

      {/* Add item modal */}
      <AddItemModal
        open={addingTo !== null}
        category={addingTo}
        onClose={() => setAddingTo(null)}
        onSubmit={handleAddItem}
      />

      {/* Edit item modal */}
      <AddItemModal
        open={editingItem !== null}
        category={editingItem?.category ?? null}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditItem}
        editItem={editingItem}
      />

      {/* Detail modal */}
      <ItemDetailModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        itemIcons={ITEM_ICONS}
      />
    </>
  );
}
