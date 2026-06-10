import { Vec3 } from '../types.js';

// 轴对齐盒障碍（掩体/集装箱）。x,z 中心 + 半宽；y 从 0 起到 height
export interface Box {
  cx: number; cz: number; hx: number; hz: number; height: number;
}

export interface MapDef {
  id: string;
  halfSize: number; // 地图为 [-halfSize, halfSize]^2 的方形
  obstacles: Box[];
  spawnsA: Vec3[]; // TDM A 队出生
  spawnsB: Vec3[]; // TDM B 队出生
  zombieSpawns: Vec3[]; // PvE 刷怪点
  playerSpawnsPvE: Vec3[]; // PvE 玩家出生
}

function grid(boxes: [number, number, number, number, number][]): Box[] {
  return boxes.map(([cx, cz, hx, hz, h]) => ({ cx, cz, hx, hz, height: h }));
}

// 仓库（PvP 对称图）
export const WAREHOUSE: MapDef = {
  id: 'warehouse',
  halfSize: 28,
  obstacles: grid([
    [0, 0, 3, 1, 2],
    [-10, 6, 2, 2, 2.5], [10, -6, 2, 2, 2.5],
    [-10, -6, 2, 2, 2.5], [10, 6, 2, 2, 2.5],
    [0, 14, 4, 1, 3], [0, -14, 4, 1, 3],
    [-16, 0, 1, 4, 2.5], [16, 0, 1, 4, 2.5],
  ]),
  spawnsA: [
    { x: -22, y: 0, z: -22 }, { x: -20, y: 0, z: -24 }, { x: -24, y: 0, z: -20 },
    { x: -18, y: 0, z: -22 }, { x: -22, y: 0, z: -18 },
  ],
  spawnsB: [
    { x: 22, y: 0, z: 22 }, { x: 20, y: 0, z: 24 }, { x: 24, y: 0, z: 20 },
    { x: 18, y: 0, z: 22 }, { x: 22, y: 0, z: 18 },
  ],
  zombieSpawns: [],
  playerSpawnsPvE: [],
};

// 废街（PvE 线性推进 + 守点）
export const DEAD_STREET: MapDef = {
  id: 'dead_street',
  halfSize: 26,
  obstacles: grid([
    [-8, 0, 1, 6, 2.5], [8, 0, 1, 6, 2.5],
    [-8, 16, 1, 4, 2.5], [8, 16, 1, 4, 2.5],
    [0, 8, 3, 1, 1.2],
  ]),
  spawnsA: [],
  spawnsB: [],
  zombieSpawns: [
    { x: -20, y: 0, z: 20 }, { x: 0, y: 0, z: 22 }, { x: 20, y: 0, z: 20 },
    { x: -22, y: 0, z: 0 }, { x: 22, y: 0, z: 0 },
  ],
  playerSpawnsPvE: [
    { x: -2, y: 0, z: -18 }, { x: 2, y: 0, z: -18 },
    { x: -4, y: 0, z: -16 }, { x: 4, y: 0, z: -16 },
    { x: 0, y: 0, z: -20 }, { x: -2, y: 0, z: -14 },
    { x: 2, y: 0, z: -14 }, { x: 0, y: 0, z: -16 },
  ],
};

/** 点是否在某障碍内（含半径膨胀），用于碰撞推回 */
export function resolveCircle(map: MapDef, x: number, z: number, r: number): { x: number; z: number } {
  let px = x, pz = z;
  const lim = map.halfSize - r;
  px = Math.max(-lim, Math.min(lim, px));
  pz = Math.max(-lim, Math.min(lim, pz));
  for (const b of map.obstacles) {
    const minX = b.cx - b.hx - r, maxX = b.cx + b.hx + r;
    const minZ = b.cz - b.hz - r, maxZ = b.cz + b.hz + r;
    if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
      const dl = px - minX, dr = maxX - px, dd = pz - minZ, du = maxZ - pz;
      const m = Math.min(dl, dr, dd, du);
      if (m === dl) px = minX;
      else if (m === dr) px = maxX;
      else if (m === dd) pz = minZ;
      else pz = maxZ;
    }
  }
  return { x: px, z: pz };
}
