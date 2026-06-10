import * as THREE from 'three';
import { MapDef, GAME, ZOMBIES, ZombieTier, Team } from '@5mgun/shared';
import { Assets, RiggedInstance } from './assets.js';

interface Ent { group: THREE.Group; rig: RiggedInstance | null; px: number; pz: number; }

export class World {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private players = new Map<string, Ent>();
  private zombies = new Map<string, Ent>();
  private tracers: { line: THREE.Line; life: number }[] = [];
  private particles: { mesh: THREE.Points; vel: Float32Array; life: number }[] = [];
  private muzzle: THREE.PointLight;
  private viewmodel: THREE.Group;
  private shake = 0;
  private recoil = 0;
  freezeUntil = 0; // 顿帧

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene.background = new THREE.Color(0x6b7890);
    this.scene.fog = new THREE.Fog(0x6b7890, 55, 140);

    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, GAME.player.height, 0);

    const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x6a5a48, 1.25);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff2e0, 2.0);
    dir.position.set(30, 50, 18);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8090b0, 0.5);
    fill.position.set(-20, 20, -15);
    this.scene.add(fill);

    this.muzzle = new THREE.PointLight(0xffcc66, 0, 12);
    this.scene.add(this.muzzle);

    this.viewmodel = this.makeViewmodel();
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  buildMap(map: MapDef) {
    this.addSky();

    // 地面（CC0 沥青贴图，回退纯色）
    const gTex = Assets.textures.ground;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(map.halfSize * 2, map.halfSize * 2),
      new THREE.MeshStandardMaterial(gTex ? { map: gTex, roughness: 0.95 } : { color: 0x2a2f3a, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 障碍（混凝土墙贴图）
    const wTex = Assets.textures.wall;
    const wallMat = new THREE.MeshStandardMaterial(wTex ? { map: wTex, roughness: 0.85 } : { color: 0x4a5266, roughness: 0.8 });
    const mTex = Assets.textures.metal;
    const crateMat = new THREE.MeshStandardMaterial(mTex ? { map: mTex, roughness: 0.6, metalness: 0.3 } : { color: 0x6a6e58, roughness: 0.7 });
    for (const b of map.obstacles) {
      // 低矮的当作集装箱(金属)，高的当作墙(混凝土)
      const mat = b.height <= 1.6 ? crateMat : wallMat;
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.height, b.hz * 2), mat);
      m.position.set(b.cx, b.height / 2, b.cz);
      this.scene.add(m);
    }
    // 外墙
    const wallH = 4;
    const s = map.halfSize;
    const edgeMat = new THREE.MeshStandardMaterial(wTex ? { map: wTex, roughness: 0.9, color: 0x9099a8 } : { color: 0x333a4a });
    const edges: [number, number, number, number][] = [
      [0, -s, s * 2, 0.4], [0, s, s * 2, 0.4], [-s, 0, 0.4, s * 2], [s, 0, 0.4, s * 2],
    ];
    for (const [x, z, w, d] of edges) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), edgeMat);
      m.position.set(x, wallH / 2, z);
      this.scene.add(m);
    }
  }

  private addSky() {
    // 程序化渐变天空（顶深蓝→地平线暖灰）
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { top: { value: new THREE.Color(0x4a6da8) }, bot: { value: new THREE.Color(0x9aa3b0) } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bot;
          void main(){ float h = clamp((normalize(vP).y*0.5+0.5),0.0,1.0); gl_FragColor = vec4(mix(bot, top, h),1.0); }`,
      }),
    );
    this.scene.add(sky);
  }

  private makeViewmodel(): THREE.Group {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x26282e, metalness: 0.7, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.5, roughness: 0.5 });
    const poly = new THREE.MeshStandardMaterial({ color: 0x33363d, metalness: 0.2, roughness: 0.7 });
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m;
    };
    part(new THREE.BoxGeometry(0.07, 0.11, 0.5), metal, 0, 0, 0);          // 机匣
    part(new THREE.BoxGeometry(0.055, 0.06, 0.42), poly, 0, -0.01, -0.42); // 护木
    part(new THREE.CylinderGeometry(0.016, 0.016, 0.45), dark, 0, 0.02, -0.62, Math.PI / 2); // 枪管
    part(new THREE.BoxGeometry(0.05, 0.16, 0.07), dark, 0, -0.13, 0.06);   // 弹匣
    part(new THREE.BoxGeometry(0.045, 0.12, 0.06), poly, 0, -0.1, 0.16, 0.5); // 握把
    part(new THREE.BoxGeometry(0.05, 0.09, 0.18), poly, 0, -0.02, 0.32);   // 枪托
    part(new THREE.BoxGeometry(0.012, 0.04, 0.012), dark, 0, 0.09, -0.2);  // 准星
    g.position.set(0.18, -0.18, -0.4);
    return g;
  }

  // 玩家共享资源（按队伍缓存材质；几何全局共享）
  private pGeo?: { body: THREE.BufferGeometry; head: THREE.BufferGeometry; gun: THREE.BufferGeometry; ring: THREE.BufferGeometry };
  private pMat = new Map<number, THREE.Material>();
  private headMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd });
  private gunMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide });

  private makePlayerMesh(team: number, isBot: boolean): THREE.Group {
    const g = new THREE.Group();
    const bodyH = GAME.player.height - GAME.player.headRadius * 2;
    if (!this.pGeo) this.pGeo = {
      body: new THREE.CapsuleGeometry(GAME.player.radius, bodyH * 0.7, 4, 8),
      head: new THREE.SphereGeometry(GAME.player.headRadius, 10, 8),
      gun: new THREE.BoxGeometry(0.1, 0.1, 0.5),
      ring: new THREE.RingGeometry(0.5, 0.6, 16),
    };
    let mat = this.pMat.get(team);
    if (!mat) {
      const color = team === Team.A ? 0x3c7cff : team === Team.B ? 0xff5a3c : 0x888888;
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      this.pMat.set(team, mat);
    }
    const body = new THREE.Mesh(this.pGeo.body, mat); body.position.y = bodyH * 0.5 + 0.2;
    const head = new THREE.Mesh(this.pGeo.head, this.headMat); head.position.y = GAME.player.headY; head.name = 'head';
    const gun = new THREE.Mesh(this.pGeo.gun, this.gunMat); gun.position.set(0.2, GAME.player.headY - 0.3, -0.3);
    g.add(body, head, gun);
    if (isBot) {
      const ring = new THREE.Mesh(this.pGeo.ring, this.ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
      g.add(ring);
    }
    return g;
  }

  // 按等级缓存几何/材质：同等级所有丧尸共用，避免每只单独分配（移动端性能关键）
  private zRes = new Map<string, { body: THREE.BufferGeometry; head: THREE.BufferGeometry;
    arm: THREE.BufferGeometry; bodyMat: THREE.Material; headMat: THREE.Material }>();
  private hpMat = new THREE.SpriteMaterial({ color: 0xff3030 });

  private getZRes(tier: string, scale: number, color: number) {
    let r = this.zRes.get(tier);
    if (!r) {
      r = {
        body: new THREE.CapsuleGeometry(0.4 * scale, 1.0 * scale, 3, 6),
        head: new THREE.SphereGeometry(0.3 * scale, 8, 6),
        arm: new THREE.BoxGeometry(0.6 * scale, 0.15, 0.5),
        bodyMat: new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
        headMat: new THREE.MeshStandardMaterial({ color: 0x5a6a3a }),
      };
      this.zRes.set(tier, r);
    }
    return r;
  }

  private addHpBar(g: THREE.Group, scale: number, y: number) {
    const bar = new THREE.Sprite(this.hpMat);
    bar.scale.set(1.2 * scale, 0.1, 1); bar.position.y = y; bar.name = 'hp';
    bar.raycast = () => {}; // 不参与射线检测
    g.add(bar);
  }

  /** 几何体占位丧尸（模型加载失败时回退） */
  private makeZombiePrim(tier: string, scale: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const r = this.getZRes(tier, scale, color);
    const body = new THREE.Mesh(r.body, r.bodyMat); body.position.y = 0.9 * scale; body.name = 'body';
    const head = new THREE.Mesh(r.head, r.headMat); head.position.y = 1.5 * scale; head.name = 'head';
    const arm = new THREE.Mesh(r.arm, r.bodyMat); arm.position.set(0, 1.1 * scale, -0.4 * scale); arm.name = 'arm';
    g.add(body, head, arm);
    return g;
  }

  syncPlayers(statePlayers: any, localId: string) {
    const seen = new Set<string>();
    statePlayers.forEach((p: any, id: string) => {
      if (id === localId) return; // 第一人称不渲染自身
      seen.add(id);
      let ent = this.players.get(id);
      if (!ent) {
        const group = new THREE.Group();
        const color = p.team === Team.A ? 0x3c7cff : p.team === Team.B ? 0xff5a3c : 0x888888;
        const rig = Assets.makeSoldier(color);
        if (rig) group.add(rig.object); else group.add(...this.makePlayerMesh(p.team, p.isBot).children);
        ent = { group, rig, px: p.x, pz: p.z };
        this.players.set(id, ent);
        this.scene.add(group);
      }
      ent.group.visible = p.alive && !p.downed;
      const g = ent.group;
      g.position.x += (p.x - g.position.x) * 0.3;
      g.position.z += (p.z - g.position.z) * 0.3;
      g.position.y = p.y;
      g.rotation.y = p.yaw + Math.PI; // 士兵模型默认面向 +Z，校正到前向
      // 动画：按移动速度选 Idle/Walk/Run
      if (ent.rig) {
        const sp = Math.hypot(p.x - ent.px, p.z - ent.pz);
        ent.rig.play(sp > 0.18 ? 'Running' : sp > 0.02 ? 'Walking' : 'Idle');
      }
      ent.px = p.x; ent.pz = p.z;
    });
    for (const [id, ent] of this.players) {
      if (!seen.has(id)) { this.scene.remove(ent.group); this.players.delete(id); }
    }
  }

  syncZombies(stateZombies: any) {
    const seen = new Set<string>();
    stateZombies.forEach((z: any, id: string) => {
      seen.add(id);
      let ent = this.zombies.get(id);
      const def = ZOMBIES[z.tier as ZombieTier];
      if (!ent) {
        const group = new THREE.Group();
        const rig = Assets.makeZombie(z.tier, def.scale, def.color);
        if (rig) group.add(rig.object); else group.add(...this.makeZombiePrim(z.tier, def.scale, def.color).children);
        this.addHpBar(group, def.scale, (rig ? 1.95 : 1.95) * def.scale + 0.2);
        ent = { group, rig, px: z.x, pz: z.z };
        this.zombies.set(id, ent);
        this.scene.add(group);
      }
      const g = ent.group;
      const dx = z.x - g.position.x, dz = z.z - g.position.z;
      g.position.x += dx * 0.4; g.position.z += dz * 0.4;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetYaw = Math.atan2(dx, dz);
        let d = targetYaw - g.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        g.rotation.y += d * 0.2;
      }
      const hp = g.getObjectByName('hp') as THREE.Sprite;
      if (hp) hp.scale.x = (1.2 * def.scale) * Math.max(0, z.hp / z.maxHp);

      if (ent.rig) {
        // 骨骼动画：攻击→Punch，移动→Running(奔尸)/Walking
        if (z.anim === 'attack') ent.rig.play('Punch', 0.12);
        else ent.rig.play(z.tier === 't2' ? 'Running' : 'Walking', 0.2);
      } else {
        // 占位：前扑脉冲
        const ud = g.userData as any;
        if (z.anim === 'attack' && ud.anim !== 'attack') ud.attackAt = performance.now();
        ud.anim = z.anim;
        const since = performance.now() - (ud.attackAt ?? -1e9);
        const lunge = since < 320 ? Math.sin((since / 320) * Math.PI) : 0;
        g.children.forEach((c) => { if (c.name === 'body' || c.name === 'arm') c.rotation.x = lunge * 0.5; });
      }
    });
    for (const [id, ent] of this.zombies) {
      if (!seen.has(id)) { this.scene.remove(ent.group); this.zombies.delete(id); }
    }
  }

  // ---- FX ----
  fireFX(weapon: string) {
    this.muzzle.intensity = 4;
    this.muzzle.position.copy(this.muzzleWorldPos());
    this.recoil = weapon === 'sniper' ? 0.06 : weapon === 'shotgun' ? 0.05 : 0.02;
    this.shake = Math.min(this.shake + (weapon === 'sniper' ? 0.04 : 0.015), 0.08);
  }

  private muzzleWorldPos(): THREE.Vector3 {
    const v = new THREE.Vector3(0.18, -0.12, -0.9);
    return v.applyMatrix4(this.camera.matrixWorld);
  }

  spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.06 });
  }

  bloodFX(pos: THREE.Vector3, head: boolean) {
    const n = head ? 40 : 18;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
      vel[i * 3] = (Math.random() - 0.5) * 6;
      vel[i * 3 + 1] = Math.random() * 5;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color: head ? 0xff2020 : 0xaa1010, size: head ? 0.18 : 0.12, transparent: true });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.particles.push({ mesh: pts, vel, life: 0.6 });
    if (head) this.freezeUntil = performance.now() + 90; // 顿帧
  }

  private eyeHeight = GAME.player.headY;
  private reloadStart = 0;
  private reloadDur = 0;
  private aimT = 0; // 0=腰射 1=开镜
  private aimTarget = 0;
  private readonly baseFov = 78;
  private readonly adsFov = 50;

  setAim(on: boolean) { this.aimTarget = on ? 1 : 0; }
  get aiming() { return this.aimT > 0.5; }

  setLocalView(x: number, y: number, z: number, yaw: number, pitch: number, crouch = false) {
    // 蹲下平滑降低视点
    const targetEye = crouch ? GAME.player.headY - 0.55 : GAME.player.headY;
    this.eyeHeight += (targetEye - this.eyeHeight) * 0.25;
    this.camera.position.set(x, y + this.eyeHeight, z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch + this.recoil;
  }

  /** 触发换弹动画（持续 ms） */
  playReload(ms: number) { this.reloadStart = performance.now(); this.reloadDur = ms; }

  render(dt: number) {
    // 骨骼动画推进
    this.zombies.forEach((e) => e.rig?.mixer.update(dt));
    this.players.forEach((e) => e.rig?.mixer.update(dt));

    // 开镜 FOV 过渡
    this.aimT += (this.aimTarget - this.aimT) * Math.min(1, dt * 14);
    const fov = this.baseFov + (this.adsFov - this.baseFov) * this.aimT;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    // 衰减
    this.recoil *= Math.pow(0.001, dt);
    if (this.muzzle.intensity > 0) this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 30);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.3);
    }
    // 换弹动画：枪下沉 + 翻转 + 横移；否则恢复 + 轻微后坐
    const rt = (performance.now() - this.reloadStart) / this.reloadDur;
    if (rt >= 0 && rt < 1) {
      const e = Math.sin(rt * Math.PI); // 0→1→0
      this.viewmodel.position.set(0.18 + e * 0.08, -0.18 - e * 0.18, -0.4 - this.recoil * 2);
      this.viewmodel.rotation.set(e * 0.9, e * 0.5, e * 0.3);
    } else {
      // 开镜时枪移向中心下沉一点
      this.viewmodel.position.set(0.18 - this.aimT * 0.16, -0.18 - this.aimT * 0.02, -0.4 - this.recoil * 2);
      this.viewmodel.rotation.set(this.recoil * 1.5, 0, 0);
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.06);
      if (t.life <= 0) { this.scene.remove(t.line); this.tracers.splice(i, 1); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const pos = p.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let j = 0; j < pos.count; j++) {
        p.vel[j * 3 + 1] -= 12 * dt;
        pos.setX(j, pos.getX(j) + p.vel[j * 3] * dt);
        pos.setY(j, pos.getY(j) + p.vel[j * 3 + 1] * dt);
        pos.setZ(j, pos.getZ(j) + p.vel[j * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      (p.mesh.material as THREE.PointsMaterial).opacity = Math.max(0, p.life / 0.6);
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }

    this.renderer.render(this.scene, this.camera);
  }

  cameraForward(): THREE.Vector3 {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyQuaternion(this.camera.quaternion);
    return v.normalize();
  }
  cameraPos(): THREE.Vector3 { return this.camera.position.clone(); }

  // ---- 死亡镜头 ----
  setViewmodelVisible(v: boolean) { this.viewmodel.visible = v; }

  /** 死亡观察镜头：从死亡点上方后侧看向凶手 */
  setDeathCam(deathX: number, deathZ: number, lookX: number, lookY: number, lookZ: number) {
    const dx = lookX - deathX, dz = lookZ - deathZ;
    const l = Math.hypot(dx, dz) || 1;
    // 相机退到死亡点远离凶手一侧的后上方，俯视凶手
    const ex = deathX - (dx / l) * 3.5;
    const ez = deathZ - (dz / l) * 3.5;
    this.camera.position.set(ex, 3.2, ez);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  private killLine: THREE.Line | null = null;
  /** 最后一击的弹道线（凶手 → 死亡点）；传 null 清除 */
  setKillLine(from: { x: number; y: number; z: number } | null, to?: { x: number; y: number; z: number }) {
    if (this.killLine) { this.scene.remove(this.killLine); this.killLine.geometry.dispose(); this.killLine = null; }
    if (!from || !to) return;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z),
    ]);
    this.killLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff4040 }));
    this.scene.add(this.killLine);
  }
}
