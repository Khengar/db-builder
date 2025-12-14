// utils/arrow.ts

export function barPath(
  x: number,
  y: number,
  angle: number,
  size = 10
) {
  const dx = Math.cos(angle + Math.PI / 2) * size;
  const dy = Math.sin(angle + Math.PI / 2) * size;
  return `M ${x - dx} ${y - dy} L ${x + dx} ${y + dy}`;
}

export function crowFootPath(
  x: number,
  y: number,
  angle: number,
  size = 12
) {
  const a1 = angle + Math.PI / 6;
  const a2 = angle - Math.PI / 6;

  const x1 = x - size * Math.cos(a1);
  const y1 = y - size * Math.sin(a1);

  const x2 = x - size * Math.cos(a2);
  const y2 = y - size * Math.sin(a2);

  const xm = x - size * 0.7 * Math.cos(angle);
  const ym = y - size * 0.7 * Math.sin(angle);

  return `
    M ${x1} ${y1} L ${x} ${y}
    M ${x2} ${y2} L ${x} ${y}
    M ${xm} ${ym} L ${x} ${y}
  `;
}
