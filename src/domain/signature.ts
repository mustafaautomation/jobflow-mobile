import type { Stroke } from '@/domain/types';

export function scriptSignature(name: string): Stroke[] {
  const letters = name.trim().slice(0, 28);
  const points = [];
  for (let index = 0; index < letters.length; index += 1) {
    const code = letters.charCodeAt(index);
    points.push({
      x: 16 + index * 12,
      y: 46 + Math.sin(index / 1.7) * 12 + (code % 5),
    });
  }
  if (points.length === 1) {
    const only = points[0];
    if (only) points.push({ x: only.x + 18, y: only.y - 8 });
  }
  return [{ points }];
}
