import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') name = '玩家';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') yaw = 0;
  @type('number') pitch = 0;
  @type('number') vy = 0; // 竖直速度（跳跃/重力）
  @type('uint8') team = 0;
  @type('boolean') isBot = false;
  @type('boolean') alive = true;
  @type('boolean') downed = false; // PvE 倒地
  @type('number') hp = 100;
  @type('number') maxHp = 100;
  @type('number') armor = 0;
  @type('string') weapon = 'ar';
  @type('uint16') ammo = 30;
  @type('uint16') reserve = 120;
  @type('uint16') kills = 0;
  @type('uint16') deaths = 0;
  @type('uint16') coins = 0;
  @type('uint32') reviveCharges = 0;
  @type('number') ackSeq = 0; // 已处理到的输入序号（用于客户端校正）
  @type('number') respawnAt = 0; // 复活时间戳（ms）
  @type('number') protectedUntil = 0; // 出生保护

  // 非同步的服务器内部字段
  lastFireAt = 0;
  reloadingUntil = 0;
  botState = 'patrol';
  botTargetId = '';
  botNextDecision = 0;
}

export class Zombie extends Schema {
  @type('string') tier = 't1';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') hp = 60;
  @type('number') maxHp = 60;
  @type('string') anim = 'walk'; // walk / attack / die

  lastAttackAt = 0;
  targetId = '';
}

export class GameState extends Schema {
  @type('string') mode = 'tdm';
  @type('string') phase = 'warmup'; // warmup / playing / intermission / boss / ended
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Zombie }) zombies = new MapSchema<Zombie>();

  @type('uint16') scoreA = 0;
  @type('uint16') scoreB = 0;
  @type('uint16') killsToWin = 40;
  @type('number') timeLeft = 360; // 秒
  @type('uint8') wave = 0;
  @type('number') intermissionLeft = 0;
  @type('uint8') humanCount = 1;
  @type('string') winner = '';
}
