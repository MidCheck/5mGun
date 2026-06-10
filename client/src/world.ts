import * as THREE from 'three';
import { MapDef, GAME, ZOMBIES, ZombieTier, Team } from '@5mgun/shared';

export class World {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private players = new Map<string, THREE.Group>();
  private zombies = new Map<string, THREE.Group>();
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
    this.scene.background = new THREE.Color(0x10131c);
    this.scene.fog = new THREE.Fog(0x10131c, 40, 90);

    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, GAME.player.height, 0);

    const hemi = new THREE.HemisphereLight(0x99aaff, 0x223322, 0.7);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(20, 40, 10);
    this.scene.add(dir);

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
    // 清场景中的地图层（保留灯光/相机）
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(map.halfSize * 2, map.halfSize * 2),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // 网格地面线
    const grid = new THREE.GridHelper(map.halfSize * 2, map.halfSize, 0x3a4256, 0x232938);
    (grid.material as THREE.Material).opacity = 0.4;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 0.8 });
    for (const b of map.obstacles) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.height, b.hz * 2), wallMat);
      m.position.set(b.cx, b.height / 2, b.cz);
      this.scene.add(m);
    }
    // 外墙
    const wallH = 4;
    const s = map.halfSize;
    const edges: [number, number, number, number][] = [
      [0, -s, s * 2, 0.4], [0, s, s * 2, 0.4], [-s, 0, 0.4, s * 2], [s, 0, 0.4, s * 2],
    ];
    for (const [x, z, w, d] of edges) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d),
        new THREE.MeshStandardMaterial({ color: 0x333a4a }));
      m.position.set(x, wallH / 2, z);
      this.scene.add(m);
    }
  }

  private makeViewmodel(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.6, roughness: 0.4 }),
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 }),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.4);
    g.add(body, barrel);
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

  private makeZombieMesh(tier: string, scale: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const r = this.getZRes(tier, scale, color);
    const body = new THREE.Mesh(r.body, r.bodyMat); body.position.y = 0.9 * scale; body.name = 'body';
    const head = new THREE.Mesh(r.head, r.headMat); head.position.y = 1.5 * scale; head.name = 'head';
    const arm = new THREE.Mesh(r.arm, r.bodyMat); arm.position.set(0, 1.1 * scale, -0.4 * scale); arm.name = 'arm';
    g.add(body, head, arm);
    // 血条（共用材质，仅 scale/position 个体化）
    const bar = new THREE.Sprite(this.hpMat);
    bar.scale.set(1.2 * scale, 0.1, 1); bar.position.y = 1.95 * scale; bar.name = 'hp';
    bar.raycast = () => {}; // 不参与射线检测（否则曳光弹会停在血条上，且 Sprite.raycast 需要相机）
    g.add(bar);
    return g;
  }

  syncPlayers(statePlayers: any, localId: string) {
    const seen = new Set<string>();
    statePlayers.forEach((p: any, id: string) => {
      if (id === localId) return; // 本地玩家是第一人称，不渲染自身
      seen.add(id);
      let mesh = this.players.get(id);
      if (!mesh) {
        mesh = this.makePlayerMesh(p.team, p.isBot);
        this.players.set(id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = p.alive && !p.downed;
      // 平滑插值
      mesh.position.x += (p.x - mesh.position.x) * 0.3;
      mesh.position.z += (p.z - mesh.position.z) * 0.3;
      mesh.position.y = p.y;
      mesh.rotation.y = p.yaw;
    });
    for (const [id, mesh] of this.players) {
      if (!seen.has(id)) { this.scene.remove(mesh); this.players.delete(id); }
    }
  }

  syncZombies(stateZombies: any) {
    const seen = new Set<string>();
    stateZombies.forEach((z: any, id: string) => {
      seen.add(id);
      let mesh = this.zombies.get(id);
      const def = ZOMBIES[z.tier as ZombieTier];
      if (!mesh) {
        mesh = this.makeZombieMesh(z.tier, def.scale, def.color);
        this.zombies.set(id, mesh);
        this.scene.add(mesh);
      }
      const dx = z.x - mesh.position.x, dz = z.z - mesh.position.z;
      mesh.position.x += dx * 0.4;
      mesh.position.z += dz * 0.4;
      // 面向移动方向
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetYaw = Math.atan2(dx, dz);
        let d = targetYaw - mesh.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        mesh.rotation.y += d * 0.2;
      }
      const hp = mesh.getObjectByName('hp') as THREE.Sprite;
      if (hp) hp.scale.x = (1.2 * def.scale) * Math.max(0, z.hp / z.maxHp);
      // 攻击姿态：前扑（身体前倾脉冲）作为攻击预兆/反馈
      const ud = mesh.userData as any;
      if (z.anim === 'attack' && ud.anim !== 'attack') ud.attackAt = performance.now();
      ud.anim = z.anim;
      const since = performance.now() - (ud.attackAt ?? -1e9);
      const lunge = since < 320 ? Math.sin((since / 320) * Math.PI) : 0;
      mesh.children.forEach((c) => { if (c.name === 'body' || c.name === 'arm') c.rotation.x = lunge * 0.5; });
    });
    for (const [id, mesh] of this.zombies) {
      if (!seen.has(id)) { this.scene.remove(mesh); this.zombies.delete(id); }
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
