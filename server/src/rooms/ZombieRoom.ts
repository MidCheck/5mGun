import colyseus from 'colyseus';
const { Room } = colyseus;
import type { Client } from 'colyseus';
import {
  GAME, WEAPONS, DEFAULT_LOADOUT, InputCommand, HitZone, ZombieTier, ZOMBIES,
  UPGRADES, scaleFor, clamp,
} from '@5mgun/shared';
import { GameState, Player } from '../state/GameState.js';
import { DEAD_STREET } from '../sim/map.js';
import { applyMovement } from '../sim/movement.js';
import { raycastTargets, RayTarget, damageFor } from '../sim/combat.js';
import { buildWaveQueue, spawnZombie, updateZombies, clampHumans } from '../sim/waves.js';

const map = DEAD_STREET;

export class ZombieRoom extends Room<GameState> {
  maxClients = GAME.zombie.maxPlayers;
  private inputs = new Map<string, InputCommand[]>();
  private upgrades = new Map<string, Record<string, number>>();
  private queue: ZombieTier[] = [];
  private spawnTimer = 0;
  private lastTick = 0;

  onCreate() {
    this.setState(new GameState());
    this.state.mode = 'zombie';
    this.state.phase = 'warmup';
    this.state.wave = 0;
    this.state.intermissionLeft = 3;
    this.maxClients = GAME.zombie.maxPlayers;

    this.onMessage('input', (client, cmd: InputCommand) => {
      const q = this.inputs.get(client.sessionId);
      if (q) { q.push(cmd); if (q.length > 8) q.splice(0, q.length - 8); }
    });
    this.onMessage('fire', (client, msg: { origin: any; dir: any }) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.tryFire(client.sessionId, p, msg.origin, msg.dir);
    });
    this.onMessage('reload', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.startReload(p);
    });
    this.onMessage('switchWeapon', (client, id: string) => {
      const p = this.state.players.get(client.sessionId);
      if (p && WEAPONS[id as keyof typeof WEAPONS]) this.equip(p, id);
    });
    this.onMessage('buyUpgrade', (client, id: string) => this.buyUpgrade(client.sessionId, id));
    this.onMessage('revive', (client, targetId: string) => this.tryReviveTeammate(client.sessionId, targetId));

    this.lastTick = Date.now();
    this.setSimulationInterval(() => this.tick(), 1000 / GAME.tickRate);
  }

  onJoin(client: Client, options: any) {
    const p = new Player();
    p.name = (options?.name || '玩家').slice(0, 16);
    this.equip(p, DEFAULT_LOADOUT[0]);
    this.spawnPlayer(p);
    p.reviveCharges = GAME.zombie.soloReviveCharges;
    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, []);
    this.upgrades.set(client.sessionId, {});
    this.state.humanCount = clampHumans(this.state.players.size);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.upgrades.delete(client.sessionId);
    this.state.humanCount = clampHumans(Math.max(1, this.state.players.size));
  }

  private humans() { return clampHumans(Math.max(1, this.state.players.size)); }

  private equip(p: Player, id: string) {
    const w = WEAPONS[id as keyof typeof WEAPONS];
    p.weapon = id; p.ammo = w.magazine; p.reserve = w.reserve; p.reloadingUntil = 0;
  }

  private spawnPlayer(p: Player) {
    const spots = map.playerSpawnsPvE;
    const s = spots[this.state.players.size % spots.length];
    p.x = s.x; p.y = 0; p.z = s.z; p.vy = 0;
    p.yaw = Math.PI; // 朝向 +Z（刷怪区方向）
    p.hp = this.maxHpOf(''); p.maxHp = p.hp; p.alive = true; p.downed = false;
    p.protectedUntil = Date.now() + 1500; // 入场短暂保护
  }

  // ---- 升级 ----
  private lvl(id: string, up: string) { return this.upgrades.get(id)?.[up] ?? 0; }
  private maxHpOf(id: string) { return GAME.player.maxHp + this.lvl(id, 'health') * 25; }

  private buyUpgrade(id: string, upId: string) {
    const p = this.state.players.get(id);
    const def = UPGRADES.find((u) => u.id === upId);
    if (!p || !def) return;
    const cur = this.lvl(id, upId);
    if (cur >= def.maxLevel) return;
    const cost = Math.round(def.cost * (1 + cur * 0.5));
    if (p.coins < cost) return;
    p.coins -= cost;
    const u = this.upgrades.get(id)!;
    u[upId] = cur + 1;
    if (upId === 'health') { p.maxHp = this.maxHpOf(id); p.hp = Math.min(p.maxHp, p.hp + 25); }
    if (upId === 'magazine') {
      const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
      p.ammo = Math.round(w.magazine * (1 + (cur + 1) * 0.25));
    }
  }

  // ---- 开火 vs 丧尸 ----
  private startReload(p: Player) {
    if (!p.alive || p.downed || p.reloadingUntil > Date.now()) return;
    const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
    if (p.ammo >= w.magazine || p.reserve <= 0) return;
    p.reloadingUntil = Date.now() + w.reloadMs;
  }

  private tryFire(id: string, p: Player, origin: any, dir: any) {
    if (!p.alive || p.downed || p.reloadingUntil > Date.now()) return;
    const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
    const now = Date.now();
    const fireMult = 1 - this.lvl(id, 'firerate') * 0.1;
    const minGap = (60000 / w.rpm) * fireMult;
    if (now - p.lastFireAt < minGap * 0.85) return;
    if (p.ammo <= 0) { this.startReload(p); return; }
    p.lastFireAt = now; p.ammo--;

    const targets: RayTarget[] = [];
    this.state.zombies.forEach((z, zid) => {
      const def = ZOMBIES[z.tier as ZombieTier];
      targets.push({
        id: zid, x: z.x, y: z.y, z: z.z,
        headY: 1.5 * def.scale, headR: 0.3 * def.scale,
        bodyHeight: 1.7 * def.scale, bodyR: 0.45 * def.scale,
      });
    });

    const dmgMult = 1 + this.lvl(id, 'damage') * 0.15;
    const critBonus = this.lvl(id, 'crit') * 0.2;
    for (let pellet = 0; pellet < w.pellets; pellet++) {
      const d = this.spread(dir, w.spreadDeg);
      const hit = raycastTargets(origin, d, targets, map, w.range * 1.5);
      if (!hit) continue;
      const z = this.state.zombies.get(hit.id);
      if (!z) continue;
      const dmg = damageFor(w, hit.zone, hit.dist, critBonus) * dmgMult;
      z.hp -= dmg;
      this.broadcast('hit', {
        by: id, target: hit.id, zone: hit.zone, dmg: Math.round(dmg),
        headshot: hit.zone === HitZone.Head,
        x: z.x, y: z.y + 1.4 * ZOMBIES[z.tier as ZombieTier].scale, z: z.z,
      });
      if (z.hp <= 0) this.killZombie(hit.id, z, id, p, hit.zone);
    }
  }

  private spread(dir: any, deg: number) {
    if (deg <= 0.01) return dir;
    const r = (deg * Math.PI) / 180;
    return { x: dir.x + (Math.random() - 0.5) * r, y: dir.y + (Math.random() - 0.5) * r, z: dir.z };
  }

  private killZombie(zid: string, z: any, shooterId: string, shooter: Player, zone: HitZone) {
    const def = ZOMBIES[z.tier as ZombieTier];
    const coins = Math.round(def.coins * scaleFor(this.humans()).coin);
    shooter.coins += coins;
    shooter.kills++;
    this.state.zombies.delete(zid);
    this.broadcast('zkill', {
      by: shooterId, tier: z.tier, coins, headshot: zone === HitZone.Head,
      x: z.x, y: z.y, z: z.z, boss: z.tier === ZombieTier.Boss,
    });
  }

  // ---- 倒地/复活 ----
  private downPlayer(p: Player) {
    p.downed = true; p.hp = 0;
    p.respawnAt = Date.now() + GAME.zombie.downedBleedoutSec * 1000;
  }

  private tryReviveTeammate(reviverId: string, targetId: string) {
    const r = this.state.players.get(reviverId);
    const t = this.state.players.get(targetId);
    if (!r || !t || !t.downed || !r.alive || r.downed) return;
    const d = Math.hypot(r.x - t.x, r.z - t.z);
    if (d > 2.5) return;
    t.downed = false; t.hp = Math.round(t.maxHp * 0.5); t.respawnAt = 0;
    t.protectedUntil = Date.now() + 1500;
    this.broadcast('revived', { target: targetId });
  }

  private selfReviveCheck(p: Player) {
    // 单人或无人可救：消耗自救次数
    if (p.downed && p.reviveCharges > 0 && this.state.players.size <= 1) {
      if (Date.now() - (p.respawnAt - GAME.zombie.downedBleedoutSec * 1000) > 4000) {
        p.reviveCharges--; p.downed = false; p.hp = Math.round(p.maxHp * 0.5); p.respawnAt = 0;
        p.protectedUntil = Date.now() + 1500;
      }
    }
  }

  // ---- 主循环 ----
  private tick() {
    const now = Date.now();
    const dt = clamp((now - this.lastTick) / 1000, 0, 0.1);
    this.lastTick = now;
    const s = scaleFor(this.humans());

    // 输入
    this.state.players.forEach((p, id) => {
      if (!p.alive || p.downed) { this.selfReviveCheck(p); return; }
      const q = this.inputs.get(id);
      if (q && q.length) {
        const spd = 1 + this.lvl(id, 'speed') * 0.08;
        for (const cmd of q) { applyMovement(p, cmd, map, spd); p.ackSeq = cmd.seq; }
        q.length = 0;
      }
    });

    this.runWaves(dt, now);

    if (this.state.phase === 'playing' || this.state.phase === 'boss') {
      updateZombies(this.state, map, dt, now, s, (victim, dmg, z) => {
        if (victim.protectedUntil > Date.now()) return; // 复活/入场保护
        victim.hp -= dmg;
        // 找到受害者 sessionId，告知其受击方向（攻击者位置）
        let vid = '';
        this.state.players.forEach((p, id) => { if (p === victim) vid = id; });
        this.broadcast('playerHit', {
          target: vid, ax: z.x, az: z.z, ranged: z.tier === 't4',
          x: victim.x, y: victim.y, z: victim.z,
        });
        if (victim.hp <= 0 && !victim.downed && victim.alive) this.downPlayer(victim);
      });
    }

    this.finishReloads();
    this.checkFailWin();
  }

  private runWaves(dt: number, now: number) {
    const st = this.state;
    if (st.phase === 'warmup' || st.phase === 'intermission') {
      st.intermissionLeft = Math.max(0, st.intermissionLeft - dt);
      if (st.intermissionLeft <= 0) this.startNextWave();
      return;
    }
    // playing / boss：放出队列里的怪
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const cap = this.humans() <= 1 ? 28 : Math.min(60, 32 + this.humans() * 4);
        if (st.zombies.size < cap) {
          const tier = this.queue.shift()!;
          spawnZombie(st, tier, map, this.humans());
        }
        this.spawnTimer = 0.35;
      }
    } else if (st.zombies.size === 0) {
      // 本波清空 → 间歇或结束
      if (st.wave >= 6) { this.win(); return; }
      st.phase = 'intermission';
      st.intermissionLeft = GAME.zombie.waveBreakSec;
    }
  }

  private startNextWave() {
    const st = this.state;
    st.wave++;
    if (st.wave > 6) { this.win(); return; }
    this.queue = buildWaveQueue(st.wave - 1, this.humans());
    this.spawnTimer = 0;
    st.phase = st.wave === 6 ? 'boss' : 'playing';
  }

  private finishReloads() {
    const now = Date.now();
    this.state.players.forEach((p) => {
      if (p.reloadingUntil && now >= p.reloadingUntil) {
        const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
        const need = w.magazine - p.ammo;
        const take = Math.min(need, p.reserve);
        p.ammo += take; p.reserve -= take; p.reloadingUntil = 0;
      }
    });
  }

  private checkFailWin() {
    if (this.state.phase === 'ended') return;
    // 全员倒地/死亡 → 失败
    let anyUp = false;
    this.state.players.forEach((p) => { if (p.alive && !p.downed) anyUp = true; });
    if (this.state.players.size > 0 && !anyUp) {
      // 倒地者超时未救 → 真死
      const now = Date.now();
      let allDead = true;
      this.state.players.forEach((p) => {
        if (p.downed && p.respawnAt > now && p.reviveCharges > 0) allDead = false;
        if (p.downed && p.respawnAt > now) allDead = false;
      });
      if (allDead) this.fail();
    }
  }

  private win() {
    this.state.phase = 'ended'; this.state.winner = 'players';
    this.broadcast('matchEnd', { winner: 'players', result: 'win' });
  }
  private fail() {
    this.state.phase = 'ended'; this.state.winner = 'zombies';
    this.broadcast('matchEnd', { winner: 'zombies', result: 'lose' });
  }
}
