import { WeaponDef, WeaponId } from '../types.js';

// 武器表（数值进配置，便于热调，详见 GDD §5）
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ar: {
    id: 'ar', name: '突击步枪', auto: true,
    damage: 25, headMult: 2.0, limbMult: 0.8,
    rpm: 600, magazine: 30, reserve: 120, reloadMs: 2000,
    pellets: 1, spreadDeg: 1.5, range: 60, moveMult: 1.0,
  },
  smg: {
    id: 'smg', name: '冲锋枪', auto: true,
    damage: 18, headMult: 1.8, limbMult: 0.85,
    rpm: 850, magazine: 35, reserve: 140, reloadMs: 1800,
    pellets: 1, spreadDeg: 2.2, range: 35, moveMult: 1.1,
  },
  shotgun: {
    id: 'shotgun', name: '霰弹枪', auto: false,
    damage: 12, headMult: 1.6, limbMult: 0.9,
    rpm: 75, magazine: 8, reserve: 40, reloadMs: 2600,
    pellets: 9, spreadDeg: 7, range: 18, moveMult: 0.95,
  },
  sniper: {
    id: 'sniper', name: '狙击枪', auto: false,
    damage: 95, headMult: 2.2, limbMult: 0.7,
    rpm: 50, magazine: 5, reserve: 30, reloadMs: 3000,
    pellets: 1, spreadDeg: 0.2, range: 200, moveMult: 0.9,
  },
  pistol: {
    id: 'pistol', name: '手枪', auto: false,
    damage: 22, headMult: 2.0, limbMult: 0.85,
    rpm: 360, magazine: 12, reserve: 999, reloadMs: 1400,
    pellets: 1, spreadDeg: 1.8, range: 40, moveMult: 1.05,
  },
};

export const DEFAULT_LOADOUT: WeaponId[] = ['ar', 'pistol'];
