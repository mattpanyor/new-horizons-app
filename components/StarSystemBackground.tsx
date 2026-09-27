interface Props {
  /** Take the field out of rendering while something opaque covers it. The
   *  twinkle layers animate forever, and under an opaque canvas that is a
   *  full-screen layer composited every frame for nothing — on a GPU the
   *  canvas is already saturating, that is not free. */
  covered?: boolean;
}

export default function StarSystemBackground({ covered = false }: Props) {
  // `invisible` drops the layer from paint; pausing the animation stops it
  // from ticking at all. Both lift the moment `covered` goes false.
  const play = covered ? "paused" : undefined;
  return (
    <div className={`fixed inset-0 -z-10 space-bg${covered ? " invisible" : ""}`}>
      <div className="space-stars" style={{ animationPlayState: play }}></div>
      <div className="space-stars" style={{ opacity: 0.5, backgroundSize: "350px 350px", animationDelay: "2s", animationPlayState: play }}></div>
    </div>
  );
}
