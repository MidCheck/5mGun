import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

  // 角色统一用 CC0 的 RobotExpressive（丧尸绿色，玩家按队伍着色）
  private charGltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null = null;
  private tierMat = new Map<string, THREE.Material>();

  textures: { ground?: THREE.Texture; wall?: THREE.Texture; metal?: THREE.Texture } = {};

  async load(): Promise<void> {
    const tasks: Promise<any>[] = [];

    tasks.push(this.loadGltf('/assets/models/characters/zombie.glb').then((g) => { this.charGltf = g; }).catch(() => {}));

    const tex = (url: string, repeat: number) => this.loadTex(url, repeat).catch(() => undefined);
    tasks.push(tex('/assets/textures/ground.jpg', 16).then((t) => { this.textures.ground = t; }));
    tasks.push(tex('/assets/textures/wall.jpg', 2).then((t) => { this.textures.wall = t; }));
    tasks.push(tex('/assets/textures/metal.jpg', 1).then((t) => { this.textures.metal = t; }));

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

  hasZombie() { return !!this.charGltf; }
  hasSoldier() { return !!this.charGltf; }

  private tintedClone(key: string, color: number, roughness: number): THREE.Object3D {
    const object = cloneSkinned(this.charGltf!.scene);
    let mat = this.tierMat.get(key);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 }); this.tierMat.set(key, mat); }
    object.traverse((o: any) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.frustumCulled = true; } });
    return object;
  }

  /** 创建一只骨骼动画丧尸（按等级着色、缩放）。失败返回 null */
  makeZombie(tier: string, scale: number, color: number): RiggedInstance | null {
    if (!this.charGltf) return null;
    const object = this.tintedClone('z_' + tier, color, 0.85);
    object.scale.setScalar(scale * 0.92); // RobotExpressive 原始高约 1.8
    const mixer = new THREE.AnimationMixer(object);
    return this.wrap(object, mixer, this.charGltf.animations, 'Walking');
  }

  /** 创建一名骨骼动画玩家/士兵（按队伍着色）。失败返回 null */
  makeSoldier(color: number): RiggedInstance | null {
    if (!this.charGltf) return null;
    const object = this.tintedClone('p_' + color, color, 0.55);
    object.scale.setScalar(0.95);
    const mixer = new THREE.AnimationMixer(object);
    return this.wrap(object, mixer, this.charGltf.animations, 'Idle');
  }

  private wrap(object: THREE.Object3D, mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[], initial: string): RiggedInstance {
    const actions = new Map<string, THREE.AnimationAction>();
    for (const c of clips) actions.set(c.name, mixer.clipAction(c));
    const inst: RiggedInstance = {
      object, mixer, current: '',
      play(name: string, fade = 0.25) {
        if (this.current === name) return;
        const next = actions.get(name);
        if (!next) return;
        const prev = this.current ? actions.get(this.current) : undefined;
        next.reset().fadeIn(fade).play();
        if (prev) prev.fadeOut(fade);
        this.current = name;
      },
    };
    inst.play(initial, 0);
    return inst;
  }
}

export const Assets = new AssetManager();
