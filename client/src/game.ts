import * as THREE from 'three';
import { Room } from 'colyseus.js';
import {
  Button, GAME, WEAPONS, DEFAULT_LOADOUT, WeaponId, resolveCircle, MapDef,
  WAREHOUSE, DEAD_STREET, dirFromAngles, clamp,
} from '@5mgun/shared';
import { World } from './world.js';
import { InputController } from './input.js';
import { Hud } from './ui.js';
import * as A from './audio.js';

interface Pred { x: number; y: number; z: number; vy: number; }

export class Game {
  private map: MapDef;
  private pred: Pred = { x: 0, y: 0, z: 0, vy: 0 };
  private seq = 0;
  private inited = false;
  private lastInputSent = 0;
  private lastFire = 0;
  private weaponIdx = 0;
  private loadout: WeaponId[] = [...DEFAULT_LOADOUT];
  private raycaster = new THREE.Raycaster();
  private running = true;
  private streak = 0;
  private lastKillAt = 0;
  private prevTime = performance.now();
  private deathInfo: any = null;
  private prevAliveUp = true;
  private invincibleUntil = 0;

  constructor(
    private world: World,
    private input: InputController,
    private room: Room,
    private hud: Hud,
    private sessionId: string,
    private mode: string,
  ) {
    this.map = mode === 'zombie' ? DEAD_STREET : WAREHOUSE;
    this.world.buildMap(this.map);
    this.wireInput();
    this.wireRoom();
    requestAnimationFrame(() => this.loop());
  }

  private get me() { return (this.room.state as any).players.get(this.sessionId); }
  private get weapon() { return WEAPONS[this.loadout[this.weaponIdx]]; }

  private reloadUntil = 0;
  private doReload() {
    const me = this.me;
    if (!me || !me.alive || me.downed) return;
    if (performance.now() < this.reloadUntil) return; // 已在换弹中，避免每帧重置动画/音效
    if (me.ammo >= this.weapon.magazine || me.reserve <= 0) return;
    this.reloadUntil = performance.now() + this.weapon.reloadMs;
    this.room.send('reload');
    A.reloadSound();
    this.world.playReload(this.weapon.reloadMs);
  }

  private wireInput() {
    this.input.onReload = () => this.doReload();
    this.input.onSwitch = () => {
      this.weaponIdx = (this.weaponIdx + 1) % this.loadout.length;
      this.room.send('switchWeapon', this.loadout[this.weaponIdx]);
      A.uiClick();
    };
    this.input.onShopToggle = () => { if (this.mode === 'zombie') this.hud.toggleShop(); };
    this.input.onInteract = () => this.tryRevive();
    this.input.onFireOnce = () => { if (!this.weapon.auto) this.fire(); };
  }

  private wireRoom() {
    this.room.onMessage('hit', (m: any) => {
      if (m.by === this.sessionId) {
        this.hud.hitmarker(m.headshot);
        A.hitSound(m.headshot);
        this.world.bloodFX(new THREE.Vector3(m.x, m.y, m.z), m.headshot);
      }
    });
    this.room.onMessage('kill', (m: any) => {
      this.hud.killfeed(m.byName, m.targetName, m.headshot);
      if (m.by === this.sessionId) {
        A.killSound();
        if (m.headshot) this.hud.headshotBanner();
        this.bumpStreak();
      }
      if (m.target === this.sessionId) {
        // 进入死亡镜头：记录凶手与最后一击弹道
        this.deathInfo = m;
        this.world.setKillLine(
          { x: m.byX, y: m.byY + 1.4, z: m.byZ },
          { x: m.tx, y: m.ty + 1.0, z: m.tz },
        );
      }
    });
    this.room.onMessage('zkill', (m: any) => {
      if (m.by === this.sessionId) {
        A.coinSound();
        if (m.headshot) this.hud.headshotBanner();
        if (m.boss) this.hud.centerMsg('击杀 BOSS！');
        this.bumpStreak();
      }
      this.world.bloodFX(new THREE.Vector3(m.x, m.y + 1, m.z), m.headshot);
    });
    this.room.onMessage('playerHit', (m: any) => {
      if (m.target !== this.sessionId) return;
      // 计算攻击者相对玩家视角的方向角，显示受击指示
      const dx = m.ax - this.pred.x, dz = m.az - this.pred.z;
      const worldAng = Math.atan2(dx, dz);
      const rel = worldAng - this.input.state.yaw; // 相对朝向
      this.hud.damageDir(rel, m.ranged);
      this.hud.bloodFlash();
      A.damageSound();
    });
    this.room.onMessage('revived', (m: any) => {
      if (m.target === this.sessionId) this.hud.centerMsg('被救起！');
    });
    this.room.onMessage('matchEnd', (m: any) => this.endMatch(m));

    // 监听自身血量变化做受击反馈
    let lastHp = GAME.player.maxHp;
    this.room.onStateChange(() => {
      const me = this.me;
      if (me) {
        if (me.hp < lastHp - 0.5 && me.alive) { this.hud.bloodFlash(); A.damageSound(); }
        lastHp = me.hp;
      }
    });
  }

  private bumpStreak() {
    const now = performance.now();
    if (now - this.lastKillAt < 4000) this.streak++; else this.streak = 1;
    this.lastKillAt = now;
    this.hud.showStreak(this.streak);
    if (this.streak === 2) this.hud.centerMsg('双杀！');
    else if (this.streak === 3) this.hud.centerMsg('三杀！');
    else if (this.streak === 4) this.hud.centerMsg('暴走！');
    else if (this.streak >= 5) this.hud.centerMsg('无人能挡！');
  }

  private tryRevive() {
    if (this.mode !== 'zombie') return;
    // 找最近倒地队友
    let best: string | null = null, bestD = 99;
    (this.room.state as any).players.forEach((p: any, id: string) => {
      if (id === this.sessionId || !p.downed) return;
      const d = Math.hypot(p.x - this.pred.x, p.z - this.pred.z);
      if (d < bestD) { bestD = d; best = id; }
    });
    if (best && bestD < 2.5) this.room.send('revive', best);
  }

  private fire() {
    const me = this.me;
    if (!me || !me.alive || me.downed) return;
    const now = performance.now();
    const gap = 60000 / this.weapon.rpm;
    if (now - this.lastFire < gap) return;
    if (me.ammo <= 0) { this.doReload(); return; }
    this.lastFire = now;

    const origin = this.world.cameraPos();
    const dir = this.world.cameraForward();
    // 本地即时表现
    A.gunshot(this.loadout[this.weaponIdx]);
    this.world.fireFX(this.loadout[this.weaponIdx]);
    // tracer 终点：raycast 命中场景（Sprite.raycast 需要相机，否则报错冻结）
    this.raycaster.camera = this.world.camera;
    this.raycaster.set(origin, dir);
    this.raycaster.far = this.weapon.range * 1.5;
    const hits = this.raycaster.intersectObjects(this.world.scene.children, true);
    const end = hits.length ? hits[0].point : origin.clone().add(dir.clone().multiplyScalar(this.weapon.range));
    const muzzle = origin.clone().add(dir.clone().multiplyScalar(0.6)).add(new THREE.Vector3(0.1, -0.1, 0));
    this.world.spawnTracer(muzzle, end);

    // 发送权威开火请求
    this.room.send('fire', {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: dir.x, y: dir.y, z: dir.z },
      seq: this.seq,
    });
  }

  private predictMovement(dt: number) {
    const me = this.me;
    if (!me) return;
    if (!this.inited) {
      this.pred = { x: me.x, y: me.y, z: me.z, vy: 0 };
      this.input.state.yaw = me.yaw; this.input.state.pitch = me.pitch;
      this.inited = true;
    }
    if (!me.alive || me.downed) {
      // 死亡/倒地：跟随服务器位置
      this.pred.x = me.x; this.pred.y = me.y; this.pred.z = me.z;
      return;
    }
    const s = this.input.sample();
    const G = GAME.player;
    const sprint = (s.buttons & Button.Sprint) !== 0;
    const crouch = (s.buttons & Button.Crouch) !== 0;
    let speed = sprint ? G.sprintSpeed : crouch ? G.crouchSpeed : G.moveSpeed;

    const ml = Math.hypot(s.moveX, s.moveZ) || 1;
    const nx = clamp(s.moveX, -1, 1) / (ml > 1 ? ml : 1);
    const nz = clamp(s.moveZ, -1, 1) / (ml > 1 ? ml : 1);
    const moving = Math.abs(s.moveX) > 0.01 || Math.abs(s.moveZ) > 0.01;
    const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
    let wx = 0, wz = 0;
    if (moving) {
      wx = nx * cos - nz * sin;
      wz = -nx * sin - nz * cos;
      const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
    }
    const onGround = this.pred.y <= 0.001;
    if (onGround && (s.buttons & Button.Jump)) this.pred.vy = G.jumpSpeed;
    this.pred.vy -= G.gravity * dt;
    this.pred.y += this.pred.vy * dt;
    if (this.pred.y < 0) { this.pred.y = 0; this.pred.vy = 0; }

    const r = resolveCircle(this.map, this.pred.x + wx * speed * dt, this.pred.z + wz * speed * dt, G.radius);
    this.pred.x = r.x; this.pred.z = r.z;

    // 服务器校正（软）
    const dx = me.x - this.pred.x, dz = me.z - this.pred.z;
    const err = Math.hypot(dx, dz);
    if (err > 2.5) { this.pred.x = me.x; this.pred.z = me.z; }
    else if (err > 0.05) { this.pred.x += dx * 0.12; this.pred.z += dz * 0.12; }
  }

  private sendInput(now: number) {
    if (now - this.lastInputSent < 1000 / 30) return;
    this.lastInputSent = now;
    const s = this.input.state;
    this.room.send('input', {
      seq: ++this.seq,
      moveX: s.moveX, moveZ: s.moveZ,
      yaw: s.yaw, pitch: s.pitch,
      buttons: s.buttons,
      dt: clamp((now - this.prevTime) / 1000 + 0.001, 0.001, 0.1),
    });
  }

  private endMatch(m: any) {
    this.running = false;
    this.hud.showEnd(this.mode, m, this.room.state, this.sessionId);
  }

  private loop() {
    // 安全网：任何一帧内的异常都不得让渲染循环永久停摆（否则画面冻结无法动弹）
    try {
      this.tickFrame();
    } catch (e) {
      console.error('[loop] 帧内异常已捕获，循环继续：', e);
    }
    requestAnimationFrame(() => this.loop());
  }

  private tickFrame() {
    if (!this.running) { this.world.render(0.016); return; }
    const now = performance.now();
    if (now < this.world.freezeUntil) return; // 顿帧
    let dt = (now - this.prevTime) / 1000;
    dt = clamp(dt, 0, 0.05);

    this.input.sample();
    this.predictMovement(dt);
    this.sendInput(now);

    const me = this.me;
    const aliveUp = !!(me && me.alive && !me.downed);
    // 复活/救起瞬间：开启短暂无敌视觉 + 清除死亡镜头与弹道线
    if (me && aliveUp && !this.prevAliveUp) {
      this.invincibleUntil = now + 1500;
      this.deathInfo = null;
      this.world.setKillLine(null);
    }
    this.prevAliveUp = aliveUp;

    const inDeathCam = !!(me && !aliveUp);
    if (inDeathCam) {
      this.world.setViewmodelVisible(false);
      this.updateDeathCam(me);
      this.showDeathHud(me);
    } else {
      this.world.setViewmodelVisible(true);
      this.hud.setDeath(null);
      if (this.weapon.auto && this.input.fireHeld) this.fire();
      const crouching = (this.input.state.buttons & Button.Crouch) !== 0;
      this.world.setAim((this.input.state.buttons & Button.Aim) !== 0);
      this.world.setLocalView(this.pred.x, this.pred.y, this.pred.z, this.input.state.yaw, this.input.state.pitch, crouching);
    }
    this.hud.setShield(now < this.invincibleUntil || (!!me && me.protectedUntil > Date.now()));

    this.world.syncPlayers((this.room.state as any).players, this.sessionId);
    this.world.syncZombies((this.room.state as any).zombies);
    this.world.render(dt);
    this.hud.update(this.room.state, this.sessionId, this.mode, this.loadout[this.weaponIdx]);

    this.prevTime = now;
  }

  /** 死亡观察镜头：看向凶手（PvP）或最近的丧尸（PvE） */
  private updateDeathCam(me: any) {
    let lx = me.x, ly = me.y + 1, lz = me.z;
    if (this.mode === 'tdm') {
      const killer = this.deathInfo ? (this.room.state as any).players.get(this.deathInfo.by) : null;
      if (killer) { lx = killer.x; ly = killer.y + 1.4; lz = killer.z; }
      else if (this.deathInfo) { lx = this.deathInfo.byX; ly = this.deathInfo.byY + 1.4; lz = this.deathInfo.byZ; }
    } else {
      let best: any = null, bd = 1e9;
      (this.room.state as any).zombies.forEach((z: any) => {
        const d = (z.x - me.x) ** 2 + (z.z - me.z) ** 2;
        if (d < bd) { bd = d; best = z; }
      });
      if (best) { lx = best.x; ly = best.y + 1.2; lz = best.z; }
    }
    this.world.setDeathCam(me.x, me.z, lx, ly, lz);
  }

  private showDeathHud(me: any) {
    if (this.mode === 'tdm') {
      const left = Math.max(0, Math.ceil((me.respawnAt - Date.now()) / 1000));
      const killer = this.deathInfo?.byName ?? '?';
      const hs = this.deathInfo?.headshot ? '（爆头）' : '';
      this.hud.setDeath('已阵亡', `凶手：<span class="dead-killer">${killer}</span>${hs} · ${left}s 后复活`);
    } else {
      const reviving = me.reviveCharges > 0 ? '自救中…' : '等待队友救援';
      this.hud.setDeath('倒地', `${reviving}（队友靠近按 F 扶起）`);
    }
  }

  buyUpgrade(id: string) { this.room.send('buyUpgrade', id); A.uiClick(); }
  stop() { this.running = false; }
}
