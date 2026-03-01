export default function StarSystemBackground() {
  return (
    <div className="fixed inset-0 -z-10 space-bg">
      <div className="space-stars"></div>
      <div className="space-stars" style={{ opacity: 0.5, backgroundSize: "350px 350px", animationDelay: "2s" }}></div>
    </div>
  );
}
