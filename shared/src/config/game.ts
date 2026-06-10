import { ZombieTier } from '../types.js';

// 全局游戏数值（GDD §11） —— 全部可热调
export const GAME = {
  tickRate: 20, // 服务器模拟频率 Hz
  snapshotRate: 20, // 快照下行 Hz

  player: {
    maxHp: 100,
    maxArmor: 50,
    moveSpeed: 5, // m/s
    sprintSpeed: 7,
    crouchSpeed: 2.5,
    jumpSpeed: 6,
    gravity: 18,
    height: 1.7,
    crouchHeight: 1.1,
    radius: 0.4,
    headY: 1.55, // 头部中心高度（站立）
    headRadius: 0.28,
    bodyHalf: 0.6, // 躯干半高
  },

  tdm: {
    maxPlayers: 20, // PvP 上限
    durationSec: 360, // 6 分钟
    killsToWinPerPlayer: 8, // 目标杀数 ≈ 人数 * 此值（夹在 30..120）
    respawnSec: 3,
    spawnProtectSec: 2,
  },

  zombie: {
    maxPlayers: 8, // PvE 上限
    waves: 5, // 5 大波 + 1 BOSS
    waveBreakSec: 20,
    soloReviveCharges: 1, // 单人限次自救
    downedBleedoutSec: 20,
  },
} as const;

// PvE 按真人数（1..8）动态难度缩放（技术文档 §6.2）
export interface ScaleRow {
  count: number; // 怪量倍率
  hp: number;
  dmg: number;
  eliteBonus: number; // 高级怪占比加成
  boss: number; // BOSS 倍率
  coin: number; // 金币倍率
}

export const ZOMBIE_SCALE: Record<number, ScaleRow> = {
  1: { count: 0.6, hp: 1.0, dmg: 0.9, eliteBonus: 0.0, boss: 0.7, coin: 1.0 },
  2: { count: 1.0, hp: 1.05, dmg: 1.0, eliteBonus: 0.05, boss: 1.0, coin: 1.0 },
  3: { count: 1.4, hp: 1.1, dmg: 1.05, eliteBonus: 0.08, boss: 1.3, coin: 0.95 },
  4: { count: 1.8, hp: 1.15, dmg: 1.1, eliteBonus: 0.12, boss: 1.6, coin: 0.92 },
  5: { count: 2.2, hp: 1.2, dmg: 1.12, eliteBonus: 0.15, boss: 1.9, coin: 0.9 },
  6: { count: 2.5, hp: 1.25, dmg: 1.15, eliteBonus: 0.18, boss: 2.2, coin: 0.88 },
  7: { count: 2.8, hp: 1.3, dmg: 1.18, eliteBonus: 0.2, boss: 2.5, coin: 0.86 },
  8: { count: 3.0, hp: 1.35, dmg: 1.2, eliteBonus: 0.22, boss: 2.8, coin: 0.85 },
};

export function scaleFor(players: number): ScaleRow {
  const n = Math.max(1, Math.min(8, Math.round(players)));
  return ZOMBIE_SCALE[n];
}

// 每波基础配置：基础怪量 + 可出现的等级池（精英占比由缩放叠加）
export interface WaveDef {
  baseCount: number;
  pool: { tier: ZombieTier; weight: number }[];
  boss?: boolean;
}

export const WAVES: WaveDef[] = [
  { baseCount: 10, pool: [{ tier: ZombieTier.Walker, weight: 1 }] },
  { baseCount: 14, pool: [{ tier: ZombieTier.Walker, weight: 0.7 }, { tier: ZombieTier.Runner, weight: 0.3 }] },
  { baseCount: 18, pool: [{ tier: ZombieTier.Walker, weight: 0.5 }, { tier: ZombieTier.Runner, weight: 0.35 }, { tier: ZombieTier.Brute, weight: 0.15 }] },
  { baseCount: 22, pool: [{ tier: ZombieTier.Runner, weight: 0.45 }, { tier: ZombieTier.Brute, weight: 0.25 }, { tier: ZombieTier.Spitter, weight: 0.3 }] },
  { baseCount: 26, pool: [{ tier: ZombieTier.Runner, weight: 0.4 }, { tier: ZombieTier.Brute, weight: 0.3 }, { tier: ZombieTier.Spitter, weight: 0.3 }] },
  { baseCount: 0, pool: [{ tier: ZombieTier.Boss, weight: 1 }], boss: true },
];

// 同屏丧尸实体上限（性能预算 §11）；单人额外下调
export function liveCap(players: number): number {
  return players <= 1 ? 28 : Math.min(60, 32 + players * 4);
}

// 局内升级商店（PvE 本局生效）
export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  maxLevel: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'damage', name: '伤害强化', desc: '武器伤害 +15%/级', cost: 150, maxLevel: 5 },
  { id: 'firerate', name: '射速强化', desc: '射速 +10%/级', cost: 150, maxLevel: 4 },
  { id: 'magazine', name: '弹匣扩容', desc: '弹匣 +25%/级', cost: 120, maxLevel: 4 },
  { id: 'speed', name: '疾行', desc: '移速 +8%/级', cost: 120, maxLevel: 3 },
  { id: 'health', name: '强体', desc: '最大生命 +25/级', cost: 180, maxLevel: 4 },
  { id: 'crit', name: '暴击', desc: '爆头伤害 +20%/级', cost: 200, maxLevel: 3 },
];
