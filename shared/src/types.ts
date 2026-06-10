// 共享类型与枚举：客户端与服务器同源，保证预测与权威一致

export type Vec3 = { x: number; y: number; z: number };

export enum GameMode {
  TDM = 'tdm', // PvP 团队歼灭
  Zombie = 'zombie', // PvE 刷丧尸
}

export enum Team {
  None = 0,
  A = 1,
  B = 2,
}

export enum HitZone {
  Head = 'head',
  Body = 'body',
  Limb = 'limb',
}

export enum BotSkill {
  Rookie = 'rookie', // 萌新
  Normal = 'normal', // 普通
  Veteran = 'veteran', // 老兵
}

export enum ZombieTier {
  Walker = 't1', // 普通尸
  Runner = 't2', // 奔尸
  Brute = 't3', // 精英·肥尸
  Spitter = 't4', // 特感·吐酸
  Boss = 't5', // BOSS·尸王
}

export type WeaponId = 'ar' | 'smg' | 'shotgun' | 'sniper' | 'pistol';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** 全自动 / 半自动 / 栓动泵动 */
  auto: boolean;
  /** 每发胸口伤害 */
  damage: number;
  /** 爆头倍率 */
  headMult: number;
  /** 四肢倍率 */
  limbMult: number;
  /** 射速：发/分钟 */
  rpm: number;
  /** 弹匣容量 */
  magazine: number;
  /** 备弹 */
  reserve: number;
  /** 换弹时间 ms */
  reloadMs: number;
  /** 每发弹丸数（霰弹 > 1） */
  pellets: number;
  /** 扩散角（度），影响散布 */
  spreadDeg: number;
  /** 有效射程（米），超出后伤害衰减 */
  range: number;
  /** 移速修正系数 */
  moveMult: number;
}

export interface ZombieDef {
  tier: ZombieTier;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  /** 击杀基础金币 */
  coins: number;
  /** 攻击范围（米） */
  attackRange: number;
  /** 缩放/体型 */
  scale: number;
  color: number;
}

export interface InputCommand {
  seq: number;
  /** 移动意图，-1..1 */
  moveX: number;
  moveZ: number;
  /** 朝向（弧度） */
  yaw: number;
  pitch: number;
  buttons: number; // 位掩码
  dt: number; // 该帧时长（秒）
}

export const Button = {
  Jump: 1 << 0,
  Crouch: 1 << 1,
  Sprint: 1 << 2,
  Fire: 1 << 3,
  Aim: 1 << 4,
  Reload: 1 << 5,
  Interact: 1 << 6,
} as const;

export interface FireRequest {
  /** 客户端开火时刻（用于滞后补偿回溯） */
  clientTime: number;
  origin: Vec3;
  dir: Vec3;
  seq: number;
}
