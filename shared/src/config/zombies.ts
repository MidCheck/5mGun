import { ZombieDef, ZombieTier } from '../types.js';

// 丧尸分级表（GDD §6）
export const ZOMBIES: Record<ZombieTier, ZombieDef> = {
  [ZombieTier.Walker]: {
    tier: ZombieTier.Walker, name: '普通尸',
    hp: 60, damage: 8, speed: 2.0, coins: 10,
    attackRange: 1.6, scale: 1.0, color: 0x6b8e5a,
  },
  [ZombieTier.Runner]: {
    tier: ZombieTier.Runner, name: '奔尸',
    hp: 45, damage: 10, speed: 4.5, coins: 15,
    attackRange: 1.6, scale: 0.9, color: 0x9aa84a,
  },
  [ZombieTier.Brute]: {
    tier: ZombieTier.Brute, name: '精英·肥尸',
    hp: 320, damage: 26, speed: 1.6, coins: 45,
    attackRange: 2.0, scale: 1.6, color: 0x8a5a3a,
  },
  [ZombieTier.Spitter]: {
    tier: ZombieTier.Spitter, name: '特感·吐酸',
    hp: 120, damage: 14, speed: 2.4, coins: 40,
    attackRange: 12, scale: 1.1, color: 0x5aa88a,
  },
  [ZombieTier.Boss]: {
    tier: ZombieTier.Boss, name: 'BOSS·尸王',
    hp: 4000, damage: 40, speed: 2.2, coins: 300,
    attackRange: 3.0, scale: 3.0, color: 0x6a2a2a,
  },
};
