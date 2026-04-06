import CdnPanel from "@/components/admin/CdnPanel";

export default function AdminCdnPage() {
  return (
    <main className="flex-1 p-3 sm:p-6">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase mb-6"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        CDN Manager
      </h1>
      <CdnPanel />
    </main>
  );
}
