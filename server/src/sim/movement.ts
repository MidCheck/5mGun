import { Button, GAME, InputCommand, clamp } from '@5mgun/shared';
import { Player } from '../state/GameState.js';
import { MapDef, resolveCircle } from './map.js';

const G = GAME.player;

/** 权威应用一帧输入到玩家（含碰撞与跳跃重力），speedMult 为局内升级加成 */
export function applyMovement(p: Player, cmd: InputCommand, map: MapDef, speedMult = 1): void {
  const dt = clamp(cmd.dt, 0, 0.1);
  p.yaw = cmd.yaw;
  p.pitch = clamp(cmd.pitch, -1.5, 1.5);

  const sprint = (cmd.buttons & Button.Sprint) !== 0;
  const crouch = (cmd.buttons & Button.Crouch) !== 0;
  let speed = sprint ? G.sprintSpeed : crouch ? G.crouchSpeed : G.moveSpeed;
  speed *= speedMult;

  // 输入向量（本地） → 世界（绕 Y 旋转 yaw）
  const ix = clamp(cmd.moveX, -1, 1);
  const iz = clamp(cmd.moveZ, -1, 1);
  const ml = Math.hypot(ix, iz) || 1;
  const nx = ix / ml, nz = iz / ml;
  const moving = Math.abs(ix) > 0.01 || Math.abs(iz) > 0.01;

  // 前向为 -Z，右向为 +X（与客户端一致）
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  let wx = 0, wz = 0;
  if (moving) {
    // nz>0 表示前进
    wx = (nx * cos - nz * sin);
    wz = (-nx * sin - nz * cos);
    const wl = Math.hypot(wx, wz) || 1;
    wx /= wl; wz /= wl;
  }

  const onGround = p.y <= 0.001;
  if (onGround && (cmd.buttons & Button.Jump)) {
    p.vy = G.jumpSpeed;
  }
  p.vy -= G.gravity * dt;
  p.y += p.vy * dt;
  if (p.y < 0) { p.y = 0; p.vy = 0; }

  // 防作弊：水平位移上限
  const maxStep = speed * dt * 1.4 + 0.05;
  let dx = wx * speed * dt;
  let dz = wz * speed * dt;
  const stepLen = Math.hypot(dx, dz);
  if (stepLen > maxStep) { dx *= maxStep / stepLen; dz *= maxStep / stepLen; }

  const resolved = resolveCircle(map, p.x + dx, p.z + dz, G.radius);
  p.x = resolved.x;
  p.z = resolved.z;
}
