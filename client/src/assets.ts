import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// 资源管理：加载 CC0 骨骼动画模型(丧尸/玩家) + CC0 贴图。
// 任一加载失败时对应 getter 返回 null，渲染层回退到几何体占位。

export interface RiggedInstance {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  play: (name: string, fade?: number) => void;
  current: string;
}

class AssetManager {
  private gltfLoader = new GLTFLoader();
  private texLoader = new THREE.TextureLoader();
  ready = false;

  // 丧尸：Quaternius「Animated Zombie」(CC-BY)；玩家：RobotExpressive(CC0) 按队伍着色
  private zombieGltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[]; h: number } | null = null;
  private playerGltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[]; h: number } | null = null;
  private weaponGltf: THREE.Object3D | null = null;
  private tierMat = new Map<string, THREE.Material>();

  textures: { ground?: THREE.Texture; wall?: THREE.Texture; metal?: THREE.Texture } = {};
  hdr: THREE.DataTexture | null = null;

  async load(): Promise<void> {
    const tasks: Promise<any>[] = [];

    const measure = (g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) => {
      const box = new THREE.Box3().setFromObject(g.scene);
      return { ...g, h: Math.max(0.1, box.max.y - box.min.y) };
    };
    tasks.push(this.loadGltf('/assets/models/characters/zombie.glb').then((g) => { this.zombieGltf = measure(g); }).catch(() => {}));
    tasks.push(this.loadGltf('/assets/models/characters/player.glb').then((g) => { this.playerGltf = measure(g); }).catch(() => {}));
    tasks.push(this.loadGltf('/assets/models/weapons/rifle.glb').then((g) => { this.weaponGltf = g.scene; }).catch(() => {}));

    const tex = (url: string, repeat: number) => this.loadTex(url, repeat).catch(() => undefined);
    tasks.push(tex('/assets/textures/ground.jpg', 16).then((t) => { this.textures.ground = t; }));
    tasks.push(tex('/assets/textures/wall.jpg', 2).then((t) => { this.textures.wall = t; }));
    tasks.push(tex('/assets/textures/metal.jpg', 1).then((t) => { this.textures.metal = t; }));
    tasks.push(new Promise<void>((resolve) => {
      new RGBELoader().load('/assets/textures/sky.hdr', (t) => { this.hdr = t; resolve(); }, undefined, () => resolve());
    }));

    await Promise.all(tasks);
    this.ready = true;
  }

  private loadGltf(url: string): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (g) => resolve({ scene: g.scene, animations: g.animations }), undefined, reject);
    });
  }

  private loadTex(url: string, repeat: number): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.texLoader.load(url, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat, repeat);
        t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      }, undefined, reject);
    });
  }

  hasZombie() { return !!this.zombieGltf; }
  hasSoldier() { return !!this.playerGltf; }
  makeWeapon(): THREE.Object3D | null { return this.weaponGltf ? this.weaponGltf.clone(true) : null; }

  /** 创建一只骨骼动画丧尸（保留原贴图；按等级缩放，特感/精英叠加微调色）。失败返回 null */
  makeZombie(tier: string, scale: number, _color: number): RiggedInstance | null {
    if (!this.zombieGltf) return null;
    const object = cloneSkinned(this.zombieGltf.scene);
    object.traverse((o: any) => { if (o.isMesh) o.frustumCulled = true; });
    // 特殊等级叠加色调（精英偏红、特感偏绿、BOSS 暗红）
    const tint = tier === 't3' ? 0xffb0b0 : tier === 't4' ? 0xb0ffd0 : tier === 't5' ? 0xff8080 : null;
    if (tint) object.traverse((o: any) => { if (o.isMesh) { o.material = (o.material as THREE.Material).clone(); (o.material as any).color?.multiplyScalar?.(1); (o.material as any).emissive = new THREE.Color(tint).multiplyScalar(0.18); } });
    const targetH = 1.7 * scale;
    object.scale.setScalar(targetH / this.zombieGltf.h);
    const mixer = new THREE.AnimationMixer(object);
    return this.wrap(object, mixer, this.zombieGltf.animations);
  }

  /** 创建一名骨骼动画玩家（RobotExpressive，按队伍着色）。失败返回 null */
  makeSoldier(color: number): RiggedInstance | null {
    if (!this.playerGltf) return null;
    const object = cloneSkinned(this.playerGltf.scene);
    let mat = this.tierMat.get('p_' + color);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 }); this.tierMat.set('p_' + color, mat); }
    object.traverse((o: any) => { if (o.isMesh) { o.material = mat; o.frustumCulled = true; } });
    object.scale.setScalar(1.7 / this.playerGltf.h);
    const mixer = new THREE.AnimationMixer(object);
    return this.wrap(object, mixer, this.playerGltf.animations);
  }

  // 语义动画名 → 实际片段（兼容 RobotExpressive 的 "Walking" 与 Zombie 的 "Zombie|ZombieWalk"）
  private wrap(object: THREE.Object3D, mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]): RiggedInstance {
    const find = (subs: string[]) => clips.find((c) => subs.some((s) => c.name.toLowerCase().includes(s)));
    const sem: Record<string, THREE.AnimationAction | undefined> = {
      idle: mkAction(find(['idle'])),
      walk: mkAction(find(['walk'])),
      run: mkAction(find(['run'])),
      attack: mkAction(find(['attack', 'bite', 'punch'])),
    };
    function mkAction(clip?: THREE.AnimationClip) { return clip ? mixer.clipAction(clip) : undefined; }
    const inst: RiggedInstance = {
      object, mixer, current: '',
      play(name: string, fade = 0.25) {
        if (this.current === name) return;
        const next = sem[name] || sem.walk || sem.idle;
        if (!next) return;
        const prev = sem[this.current];
        next.reset().fadeIn(fade).play();
        if (prev && prev !== next) prev.fadeOut(fade);
        this.current = name;
      },
    };
    inst.play('idle', 0);
    return inst;
  }
}

export const Assets = new AssetManager();
