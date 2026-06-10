import { Vec3 } from './types.js';

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: Vec3): number => Math.sqrt(dot(a, a));
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
export const dist2 = (a: Vec3, b: Vec3): number => {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};
export const normalize = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
});
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** 由 yaw/pitch 得到前向单位向量（Three.js 右手系，-Z 为前） */
export const dirFromAngles = (yaw: number, pitch: number): Vec3 => ({
  x: -Math.sin(yaw) * Math.cos(pitch),
  y: Math.sin(pitch),
  z: -Math.cos(yaw) * Math.cos(pitch),
});

/** 射线 vs 球：返回最近正向交点距离，未命中返回 -1 */
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const cc = dot(oc, oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : -1;
}

/** 射线 vs 竖直胶囊（沿 Y 轴，从 a 到 b，半径 r）的近似：用两端球 + 中段圆柱的最近距离判定 */
export function rayCapsule(o: Vec3, d: Vec3, base: Vec3, height: number, r: number): number {
  // 近似为以中心的球序列检测，足够命中判定用；返回最近命中距离或 -1
  const steps = 4;
  let best = -1;
  for (let i = 0; i <= steps; i++) {
    const c = { x: base.x, y: base.y + (height * i) / steps, z: base.z };
    const t = raySphere(o, d, c, r);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}
