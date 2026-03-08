export const toRad = (deg: number) => (deg * Math.PI) / 180;

const f = (n: number) => n.toFixed(2);

export function annularSectorPath(
  cx: number, cy: number,
  r1: number, r2: number,
  startDeg: number, endDeg: number,
): string {
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = f(cx + r1 * Math.cos(s)), y1 = f(cy + r1 * Math.sin(s));
  const x2 = f(cx + r2 * Math.cos(s)), y2 = f(cy + r2 * Math.sin(s));
  const x3 = f(cx + r2 * Math.cos(e)), y3 = f(cy + r2 * Math.sin(e));
  const x4 = f(cx + r1 * Math.cos(e)), y4 = f(cy + r1 * Math.sin(e));
  return [
    `M ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${x3} ${y3}`,
    `L ${x4} ${y4}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${x1} ${y1}`,
    `Z`,
  ].join(" ");
}

export function arcStrokePath(
  cx: number, cy: number,
  r: number,
  startDeg: number, endDeg: number,
): string {
  const s = toRad(startDeg), e = toRad(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = f(cx + r * Math.cos(s)), y1 = f(cy + r * Math.sin(s));
  const x2 = f(cx + r * Math.cos(e)), y2 = f(cy + r * Math.sin(e));
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}
