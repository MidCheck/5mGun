import { GAME, HitZone, Vec3, raySphere, rayCapsule, WeaponDef } from '@5mgun/shared';
import { MapDef, Box } from './map.js';

export interface RayTarget {
  id: string;
  x: number; y: number; z: number;
  /** 头部中心 Y（相对 y） */
  headY: number;
  headR: number;
  bodyHeight: number;
  bodyR: number;
}

export interface HitResult {
  id: string;
  zone: HitZone;
  dist: number;
}

/** 射线 vs AABB（slab 法），返回进入距离或 -1 */
function rayBox(o: Vec3, d: Vec3, b: Box): number {
  const min = [b.cx - b.hx, 0, b.cz - b.hz];
  const max = [b.cx + b.hx, b.height, b.cz + b.hz];
  const ro = [o.x, o.y, o.z];
  const rd = [d.x, d.y, d.z];
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(rd[i]) < 1e-6) {
      if (ro[i] < min[i] || ro[i] > max[i]) return -1;
    } else {
      let t1 = (min[i] - ro[i]) / rd[i];
      let t2 = (max[i] - ro[i]) / rd[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

/** 障碍遮挡：在 maxDist 前是否被墙挡住 */
function occludedBefore(o: Vec3, d: Vec3, map: MapDef, maxDist: number): number {
  let best = Infinity;
  for (const b of map.obstacles) {
    const t = rayBox(o, d, b);
    if (t >= 0 && t < best) best = t;
  }
  return best < maxDist ? best : Infinity;
}

/** 对一组胶囊目标做命中判定，返回最近的命中（先判遮挡） */
export function raycastTargets(
  origin: Vec3, dir: Vec3, targets: RayTarget[], map: MapDef, maxRange: number,
): HitResult | null {
  const wallT = occludedBefore(origin, dir, map, maxRange);
  let best: HitResult | null = null;
  let bestT = Math.min(wallT, maxRange);

  for (const t of targets) {
    const headC: Vec3 = { x: t.x, y: t.y + t.headY, z: t.z };
    const tHead = raySphere(origin, dir, headC, t.headR);
    if (tHead >= 0 && tHead < bestT) {
      best = { id: t.id, zone: HitZone.Head, dist: tHead };
      bestT = tHead;
      continue;
    }
    const base: Vec3 = { x: t.x, y: t.y + 0.2, z: t.z };
    const tBody = rayCapsule(origin, dir, base, t.bodyHeight, t.bodyR);
    if (tBody >= 0 && tBody < bestT) {
      // 简单按命中高度区分躯干/四肢
      const hitY = origin.y + dir.y * tBody - t.y;
      const zone = hitY > t.bodyHeight * 0.55 ? HitZone.Body : HitZone.Limb;
      best = { id: t.id, zone, dist: tBody };
      bestT = tBody;
    }
  }
  return best;
}

/** 伤害计算：按部位倍率 + 距离衰减 + 暴击加成（爆头） */
export function damageFor(w: WeaponDef, zone: HitZone, dist: number, critBonus = 0): number {
  let base = w.damage;
  if (zone === HitZone.Head) base *= w.headMult * (1 + critBonus);
  else if (zone === HitZone.Limb) base *= w.limbMult;
  // 超出有效射程线性衰减到 50%
  if (dist > w.range) {
    const over = Math.min(1, (dist - w.range) / w.range);
    base *= 1 - 0.5 * over;
  }
  return base;
}

export const playerRayTarget = (id: string, p: { x: number; y: number; z: number }): RayTarget => ({
  id, x: p.x, y: p.y, z: p.z,
  headY: GAME.player.headY, headR: GAME.player.headRadius,
  bodyHeight: GAME.player.height, bodyR: GAME.player.radius + 0.15,
});
