import { Button, GAME, InputCommand, BotSkill, WEAPONS, dirFromAngles } from '@5mgun/shared';
import { Player, GameState } from '../state/GameState.js';
import { MapDef } from './map.js';

// 难度档位参数：反应间隔(ms)、瞄准噪声(弧度)、开火概率、追击系数、交战距离
const SKILL: Record<BotSkill, { react: number; noise: number; fireProb: number; pursue: number; engage: number }> = {
  [BotSkill.Rookie]: { react: 650, noise: 0.04, fireProb: 0.62, pursue: 0.7, engage: 14 },
  [BotSkill.Normal]: { react: 380, noise: 0.018, fireProb: 0.82, pursue: 0.95, engage: 18 },
  [BotSkill.Veteran]: { react: 220, noise: 0.008, fireProb: 0.96, pursue: 1.0, engage: 24 },
};

export interface BotIntent {
  cmd: InputCommand;
  fire: boolean;
}

function nearestEnemy(bot: Player, state: GameState): Player | null {
  let best: Player | null = null;
  let bestD = Infinity;
  state.players.forEach((p) => {
    if (p === bot || !p.alive || p.team === bot.team) return;
    const d = (p.x - bot.x) ** 2 + (p.z - bot.z) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  });
  return best;
}

export function botThink(
  bot: Player, state: GameState, _map: MapDef, now: number, skill: BotSkill, dt: number,
): BotIntent {
  const cfg = SKILL[skill];
  const cmd: InputCommand = { seq: 0, moveX: 0, moveZ: 0, yaw: bot.yaw, pitch: bot.pitch, buttons: 0, dt };
  let fire = false;

  const target = nearestEnemy(bot, state);
  if (!target) {
    // 无目标：随机巡逻
    if (now > bot.botNextDecision) {
      bot.botTargetId = `${(Math.sin(now * 0.001 + bot.x) * 0.5)}`;
      bot.botNextDecision = now + 1500;
    }
    cmd.moveZ = 0.4;
    cmd.yaw = bot.yaw + 0.3 * dt;
    return { cmd, fire };
  }

  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const dy = (target.y + GAME.player.headY) - (bot.y + GAME.player.headY);
  const horiz = Math.hypot(dx, dz);
  const desiredYaw = Math.atan2(-dx, -dz); // 与 dirFromAngles 一致：前向 -Z
  const desiredPitch = Math.atan2(dy, horiz);

  // 平滑转向 + 噪声
  const noise = (Math.sin(now * 0.005 + bot.x) ) * cfg.noise;
  let yawErr = desiredYaw + noise - bot.yaw;
  while (yawErr > Math.PI) yawErr -= Math.PI * 2;
  while (yawErr < -Math.PI) yawErr += Math.PI * 2;
  const turn = Math.sign(yawErr) * Math.min(Math.abs(yawErr), 9 * dt);
  cmd.yaw = bot.yaw + turn;
  cmd.pitch = bot.pitch + (desiredPitch - bot.pitch) * Math.min(1, 8 * dt);

  const w = WEAPONS[bot.weapon as keyof typeof WEAPONS] ?? WEAPONS.ar;
  // 接近到交战距离再开火：远了追、近了拉、中距走位时保持轻微前压
  if (horiz > cfg.engage) cmd.moveZ = cfg.pursue;
  else if (horiz < 5) cmd.moveZ = -0.6;
  else { cmd.moveX = Math.sin(now * 0.0015 + bot.x) > 0 ? 0.7 : -0.7; cmd.moveZ = 0.25; } // 横向走位+前压

  // 开火条件：朝向落在目标角直径内（按距离收紧）+ 冷却 + 概率
  const targetAngularRadius = Math.atan2(0.5, Math.max(2, horiz)); // 躯干半宽 ~0.5m
  const aimTol = targetAngularRadius + cfg.noise;
  const aligned = Math.abs(yawErr) < aimTol;
  if (aligned && horiz < cfg.engage * 1.3 && now > bot.botNextDecision) {
    if (Math.sin(now * 0.013 + bot.z) * 0.5 + 0.5 < cfg.fireProb) fire = true;
    bot.botNextDecision = now + cfg.react * 0.25;
  }
  if (fire) cmd.buttons |= Button.Fire;
  return { cmd, fire };
}

export function botFireDir(bot: Player): { origin: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number } } {
  const origin = { x: bot.x, y: bot.y + GAME.player.headY, z: bot.z };
  const dir = dirFromAngles(bot.yaw, bot.pitch);
  return { origin, dir };
}
