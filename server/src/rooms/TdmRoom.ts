import colyseus from 'colyseus';
const { Room } = colyseus;
import type { Client } from 'colyseus';
import {
  GAME, WEAPONS, DEFAULT_LOADOUT, InputCommand, Team, BotSkill, HitZone, clamp,
} from '@5mgun/shared';
import { GameState, Player } from '../state/GameState.js';
import { WAREHOUSE } from '../sim/map.js';
import { applyMovement } from '../sim/movement.js';
import { raycastTargets, playerRayTarget, damageFor, RayTarget } from '../sim/combat.js';
import { botThink, botFireDir } from '../sim/bots.js';

const map = WAREHOUSE;

export class TdmRoom extends Room<GameState> {
  maxClients = GAME.tdm.maxPlayers;
  private inputs = new Map<string, InputCommand[]>();
  private botSkill: BotSkill = BotSkill.Normal;
  private botSeq = 0;
  private lastTick = 0;

  onCreate(options: any) {
    this.setState(new GameState());
    this.state.mode = 'tdm';
    this.state.phase = 'playing';
    this.state.timeLeft = GAME.tdm.durationSec;
    if (options?.botSkill && Object.values(BotSkill).includes(options.botSkill)) {
      this.botSkill = options.botSkill;
    }
    this.maxClients = GAME.tdm.maxPlayers;

    this.onMessage('input', (client, cmd: InputCommand) => {
      const q = this.inputs.get(client.sessionId);
      if (q) { q.push(cmd); if (q.length > 8) q.splice(0, q.length - 8); }
    });
    this.onMessage('fire', (client, msg: { origin: any; dir: any; seq: number }) => {
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

    this.lastTick = Date.now();
    this.setSimulationInterval(() => this.tick(), 1000 / GAME.tickRate);
  }

  onJoin(client: Client, options: any) {
    const p = new Player();
    p.name = (options?.name || '玩家').slice(0, 16);
    p.isBot = false;
    this.assignTeam(p);
    this.equip(p, DEFAULT_LOADOUT[0]);
    this.respawn(p, true);
    this.state.players.set(client.sessionId, p);
    this.inputs.set(client.sessionId, []);
    this.rebalanceBots();
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.rebalanceBots();
  }

  // ---- 队伍与人机补位 ----
  private humanCount(): number {
    let n = 0;
    this.state.players.forEach((p) => { if (!p.isBot) n++; });
    return n;
  }

  private teamCounts(): [number, number] {
    let a = 0, b = 0;
    this.state.players.forEach((p) => { if (p.team === Team.A) a++; else if (p.team === Team.B) b++; });
    return [a, b];
  }

  private assignTeam(p: Player) {
    const [a, b] = this.teamCounts();
    p.team = a <= b ? Team.A : Team.B;
  }

  /** 维持总人数为偶数且 ≥6 ≤20，不足用机器人补，真人多了就裁机器人 */
  private rebalanceBots() {
    const humans = this.humanCount();
    this.state.humanCount = humans;
    const target = clamp(humans <= 1 ? 6 : humans + (humans % 2), 6, GAME.tdm.maxPlayers);

    // 先按需删除机器人（优先删多的一队）
    const bots: { id: string; p: Player }[] = [];
    this.state.players.forEach((p, id) => { if (p.isBot) bots.push({ id, p }); });
    let total = this.state.players.size;
    while (total > target && bots.length) {
      const [a, b] = this.teamCounts();
      const dropTeam = a >= b ? Team.A : Team.B;
      const idx = bots.findIndex((x) => x.p.team === dropTeam);
      const victim = idx >= 0 ? bots.splice(idx, 1)[0] : bots.pop()!;
      this.state.players.delete(victim.id);
      total--;
    }
    // 再补机器人
    while (total < target) {
      const id = `bot_${this.botSeq++}`;
      const p = new Player();
      p.isBot = true;
      p.name = '机器人' + this.botSeq;
      this.assignTeam(p);
      this.equip(p, DEFAULT_LOADOUT[0]);
      this.respawn(p, true);
      this.state.players.set(id, p);
      total++;
    }
    // 更新目标杀数
    this.state.killsToWin = clamp(Math.max(humans, 1) * GAME.tdm.killsToWinPerPlayer, 30, 120);
  }

  // ---- 武器/复活 ----
  private equip(p: Player, id: string) {
    const w = WEAPONS[id as keyof typeof WEAPONS];
    p.weapon = id;
    p.ammo = w.magazine;
    p.reserve = w.reserve;
    p.reloadingUntil = 0;
  }

  private respawn(p: Player, instant = false) {
    const spots = p.team === Team.A ? map.spawnsA : map.spawnsB;
    const s = spots[Math.floor(Math.random() * spots.length)];
    p.x = s.x; p.y = 0; p.z = s.z; p.vy = 0;
    p.yaw = Math.atan2(s.x, s.z); // 朝向地图中心(0,0)
    p.hp = GAME.player.maxHp; p.armor = 0; p.alive = true; p.downed = false;
    p.protectedUntil = Date.now() + GAME.tdm.spawnProtectSec * 1000;
    const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
    p.ammo = w.magazine; p.reserve = w.reserve;
    if (!instant) p.respawnAt = 0;
  }

  private startReload(p: Player) {
    if (!p.alive || p.reloadingUntil > Date.now()) return;
    const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
    if (p.ammo >= w.magazine || p.reserve <= 0) return;
    p.reloadingUntil = Date.now() + w.reloadMs;
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

  // ---- 开火与命中 ----
  private tryFire(shooterId: string, p: Player, origin: any, dir: any) {
    if (!p.alive || p.reloadingUntil > Date.now()) return;
    const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
    const now = Date.now();
    const minGap = 60000 / w.rpm;
    if (now - p.lastFireAt < minGap * 0.85) return; // 射速节流（防加速开火）
    if (p.ammo <= 0) { this.startReload(p); return; }
    p.lastFireAt = now;
    p.ammo--;

    // 候选目标：敌方存活玩家
    const targets: RayTarget[] = [];
    this.state.players.forEach((t, id) => {
      if (id === shooterId || !t.alive || t.team === p.team) return;
      targets.push(playerRayTarget(id, t));
    });

    for (let pellet = 0; pellet < w.pellets; pellet++) {
      const d = this.spread(dir, w.spreadDeg);
      const hit = raycastTargets(origin, d, targets, map, w.range * 1.5);
      if (!hit) continue;
      const victim = this.state.players.get(hit.id);
      if (!victim || !victim.alive) continue;
      if (victim.protectedUntil > now) continue; // 出生保护
      const dmg = damageFor(w, hit.zone, hit.dist);
      this.applyDamage(victim, hit.id, dmg, shooterId, hit.zone);
    }
  }

  private spread(dir: any, deg: number) {
    if (deg <= 0.01) return dir;
    const r = (deg * Math.PI) / 180;
    const ax = (Math.random() - 0.5) * r;
    const ay = (Math.random() - 0.5) * r;
    // 近似：在前向附近加微小扰动
    return {
      x: dir.x + ax,
      y: dir.y + ay,
      z: dir.z,
    };
  }

  private applyDamage(victim: Player, victimId: string, dmg: number, shooterId: string, zone: HitZone) {
    let remain = dmg;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, remain * 0.5);
      victim.armor -= absorbed; remain -= absorbed;
    }
    victim.hp -= remain;
    // 通知客户端命中反馈（含爆头）
    const shooter = this.state.players.get(shooterId);
    this.broadcast('hit', {
      by: shooterId, target: victimId, zone, dmg: Math.round(dmg),
      headshot: zone === HitZone.Head, x: victim.x, y: victim.y + GAME.player.headY, z: victim.z,
    });
    if (victim.hp <= 0 && victim.alive) {
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = Date.now() + GAME.tdm.respawnSec * 1000;
      if (shooter && shooter !== victim) {
        shooter.kills++;
        if (shooter.team === Team.A) this.state.scoreA++; else this.state.scoreB++;
      }
      this.broadcast('kill', {
        by: shooterId, byName: shooter?.name ?? '?', target: victimId,
        targetName: victim.name, headshot: zone === HitZone.Head,
        byBot: shooter?.isBot ?? false,
        byX: shooter?.x ?? 0, byY: shooter?.y ?? 0, byZ: shooter?.z ?? 0,
        tx: victim.x, ty: victim.y, tz: victim.z,
      });
      this.checkWin();
    }
  }

  private checkWin() {
    if (this.state.phase === 'ended') return;
    if (this.state.scoreA >= this.state.killsToWin) this.end(Team.A);
    else if (this.state.scoreB >= this.state.killsToWin) this.end(Team.B);
  }

  private end(winner: Team) {
    this.state.phase = 'ended';
    this.state.winner = winner === Team.A ? 'A' : 'B';
    this.broadcast('matchEnd', { winner: this.state.winner });
  }

  // ---- 主循环 ----
  private tick() {
    const now = Date.now();
    const dt = clamp((now - this.lastTick) / 1000, 0, 0.1);
    this.lastTick = now;

    if (this.state.phase === 'playing') {
      this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
      if (this.state.timeLeft <= 0) this.end(this.state.scoreA >= this.state.scoreB ? Team.A : Team.B);
    }

    // 真人：消费输入队列
    this.state.players.forEach((p, id) => {
      if (p.isBot) return;
      if (!p.alive) { this.tryRespawn(p); return; }
      const q = this.inputs.get(id);
      if (q && q.length) {
        for (const cmd of q) { applyMovement(p, cmd, map); p.ackSeq = cmd.seq; }
        q.length = 0;
      }
    });

    // 机器人：思考 + 移动 + 开火
    if (this.state.phase === 'playing') {
      this.state.players.forEach((p, id) => {
        if (!p.isBot) return;
        if (!p.alive) { this.tryRespawn(p); return; }
        const intent = botThink(p, this.state, map, now, this.botSkill, dt);
        applyMovement(p, intent.cmd, map);
        if (intent.fire) {
          const w = WEAPONS[p.weapon as keyof typeof WEAPONS];
          const gap = 60000 / w.rpm;
          if (now - p.lastFireAt >= gap && p.ammo > 0) {
            const { origin, dir } = botFireDir(p);
            this.tryFire(id, p, origin, dir);
          } else if (p.ammo <= 0) this.startReload(p);
        }
      });
    }

    this.finishReloads();
  }

  private tryRespawn(p: Player) {
    if (p.respawnAt && Date.now() >= p.respawnAt) {
      this.respawn(p);
      p.respawnAt = 0;
    }
  }
}
