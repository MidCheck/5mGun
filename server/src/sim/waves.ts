import {
  WAVES, ZOMBIES, ZombieTier, scaleFor, ScaleRow, GAME, clamp,
} from '@5mgun/shared';
import { Zombie, Player, GameState } from '../state/GameState.js';
import { MapDef, resolveCircle } from './map.js';

let zid = 1;

/** 构造某波的丧尸队列（按人数缩放怪量 + 精英占比） */
export function buildWaveQueue(waveIndex: number, humans: number): ZombieTier[] {
  const def = WAVES[waveIndex];
  if (!def) return [];
  const s = scaleFor(humans);
  if (def.boss) {
    // BOSS 波：1 BOSS + 少量护卫
    const q: ZombieTier[] = [ZombieTier.Boss];
    const guards = Math.round(4 * s.count);
    for (let i = 0; i < guards; i++) q.push(ZombieTier.Runner);
    return q;
  }
  const total = Math.max(1, Math.round(def.baseCount * s.count));
  // 加权随机抽取，精英权重按 eliteBonus 提升
  const pool = def.pool.map((p) => ({
    tier: p.tier,
    w: p.tier === ZombieTier.Brute || p.tier === ZombieTier.Spitter
      ? p.weight + s.eliteBonus : p.weight,
  }));
  const q: ZombieTier[] = [];
  for (let i = 0; i < total; i++) q.push(weightedPick(pool, i));
  return q;
}

function weightedPick(pool: { tier: ZombieTier; w: number }[], salt: number): ZombieTier {
  const sum = pool.reduce((a, b) => a + b.w, 0);
  // 确定性伪随机（避免 Math.random，便于回放）
  const r = ((Math.sin(salt * 12.9898) * 43758.5453) % 1 + 1) % 1 * sum;
  let acc = 0;
  for (const p of pool) { acc += p.w; if (r <= acc) return p.tier; }
  return pool[0].tier;
}

export function spawnZombie(state: GameState, tier: ZombieTier, map: MapDef, humans: number): void {
  const def = ZOMBIES[tier];
  const s = scaleFor(humans);
  const hpMul = tier === ZombieTier.Boss ? s.boss : s.hp;
  const z = new Zombie();
  z.tier = tier;
  z.hp = Math.round(def.hp * hpMul);
  z.maxHp = z.hp;
  const sp = map.zombieSpawns[zid % map.zombieSpawns.length];
  z.x = sp.x + (Math.sin(zid * 7.1) * 2);
  z.z = sp.z + (Math.cos(zid * 3.3) * 2);
  z.y = 0;
  state.zombies.set(`z${zid++}`, z);
}

function nearestPlayer(z: Zombie, state: GameState): Player | null {
  let best: Player | null = null, bestD = Infinity;
  state.players.forEach((p) => {
    if (!p.alive || p.downed) return;
    const d = (p.x - z.x) ** 2 + (p.z - z.z) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  });
  return best;
}

/** 推进所有丧尸 AI：寻敌、移动、攻击。返回造成的玩家伤害事件 */
export function updateZombies(
  state: GameState, map: MapDef, dt: number, now: number, s: ScaleRow,
  onAttack: (p: Player, dmg: number, z: Zombie) => void,
): void {
  state.zombies.forEach((z) => {
    const def = ZOMBIES[z.tier as ZombieTier];
    const target = nearestPlayer(z, state);
    if (!target) { z.anim = 'walk'; return; }
    const dx = target.x - z.x, dz = target.z - z.z;
    const d = Math.hypot(dx, dz) || 1;

    if (d > def.attackRange) {
      // 朝玩家移动（流场近似：直接朝向 + 碰撞推回）
      const sp = def.speed * dt;
      const nx = z.x + (dx / d) * sp;
      const nz = z.z + (dz / d) * sp;
      const r = resolveCircle(map, nx, nz, 0.5 * def.scale);
      z.x = r.x; z.z = r.z;
      z.anim = z.anim === 'attack' && now - z.lastAttackAt < 350 ? 'attack' : 'walk';
    } else {
      // 攻击：进入攻击姿态，按冷却造成伤害
      const cd = 1000; // ms
      if (now - z.lastAttackAt > cd) {
        z.lastAttackAt = now;
        z.anim = 'attack';
        onAttack(target, def.damage * s.dmg, z);
      } else if (now - z.lastAttackAt > 350) {
        z.anim = 'walk';
      }
    }
  });
}

/** 当前存活丧尸数 */
export function aliveZombies(state: GameState): number {
  return state.zombies.size;
}

export function clampHumans(n: number): number {
  return clamp(Math.round(n), 1, GAME.zombie.maxPlayers);
}
