// 音效：优先用加载的 CC0 真实采样（来自 OpenGameArt，详见 assets/CREDITS.md），
// 加载失败则回退到程序化合成，保证任何情况下都有反馈。
let ctx: AudioContext | null = null;
let master: GainNode;
let noiseBuf: AudioBuffer;

// 已加载的采样 buffer（key -> AudioBuffer）
const samples: Record<string, AudioBuffer> = {};
const SAMPLE_URLS: Record<string, string> = {
  ar: '/assets/audio/weapons/ar.mp3',
  smg: '/assets/audio/weapons/smg.mp3',
  pistol: '/assets/audio/weapons/pistol.mp3',
  sniper: '/assets/audio/weapons/sniper.mp3',
  shotgun: '/assets/audio/weapons/shotgun.mp3',
  reload: '/assets/audio/weapons/reload.mp3',
};

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  // 预生成白噪声（合成兜底用）
  const len = ctx.sampleRate * 1;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // 异步加载真实采样
  for (const [key, url] of Object.entries(SAMPLE_URLS)) {
    fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((buf) => ctx!.decodeAudioData(buf))
      .then((decoded) => { samples[key] = decoded; })
      .catch(() => { /* 回退到合成 */ });
  }
}

function playSample(key: string, gain = 1, rate = 1): boolean {
  const buf = samples[key];
  if (!buf || !ctx) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(master);
  src.start();
  return true;
}

function now() { return ctx!.currentTime; }

function noise(dur: number, gain: number, lp: number, hp = 0): AudioNode {
  const src = ctx!.createBufferSource();
  src.buffer = noiseBuf;
  const g = ctx!.createGain();
  g.gain.setValueAtTime(gain, now());
  g.gain.exponentialRampToValueAtTime(0.001, now() + dur);
  let node: AudioNode = src;
  const filt = ctx!.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = lp;
  node.connect(filt); node = filt;
  if (hp > 0) {
    const h = ctx!.createBiquadFilter();
    h.type = 'highpass'; h.frequency.value = hp;
    node.connect(h); node = h;
  }
  node.connect(g); g.connect(master);
  src.start(); src.stop(now() + dur);
  return g;
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  const o = ctx!.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, now());
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now() + dur);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(gain, now());
  g.gain.exponentialRampToValueAtTime(0.001, now() + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(now() + dur);
}

// 不同枪有不同音色：优先真实采样，失败回退合成
export function gunshot(weapon: string) {
  if (!ctx) return;
  // 轻微随机音高，避免连发机械重复感
  const rate = 0.96 + Math.random() * 0.08;
  if (playSample(weapon, weapon === 'shotgun' ? 0.9 : 0.7, rate)) return;
  switch (weapon) {
    case 'shotgun':
      noise(0.28, 0.9, 2200); tone(90, 0.18, 0.6, 'square', 50); break;
    case 'sniper':
      noise(0.35, 0.8, 4000, 300); tone(140, 0.25, 0.5, 'sawtooth', 60); break;
    case 'smg':
      noise(0.09, 0.5, 3500, 400); tone(220, 0.05, 0.3, 'square'); break;
    case 'pistol':
      noise(0.12, 0.55, 3000, 350); tone(180, 0.07, 0.35, 'square', 90); break;
    default: // ar
      noise(0.13, 0.6, 3200, 300); tone(160, 0.08, 0.4, 'square', 80);
  }
}

export function reloadSound() {
  if (!ctx) return;
  if (playSample('reload', 0.8)) return;
  tone(800, 0.04, 0.25, 'square'); // 退弹匣
  setTimeout(() => tone(400, 0.05, 0.2, 'square'), 220); // 插弹匣
  setTimeout(() => { tone(1200, 0.03, 0.3, 'square'); noise(0.04, 0.2, 4000, 800); }, 480); // 拉栓
}

export function hitSound(head: boolean) {
  if (!ctx) return;
  if (head) {
    tone(1400, 0.06, 0.4, 'square', 2200); // 清脆爆头叮
    setTimeout(() => tone(300, 0.12, 0.5, 'sine', 90), 30); // 低频确认
    noise(0.05, 0.3, 3000, 1000);
  } else {
    tone(600, 0.04, 0.25, 'triangle', 400);
    noise(0.03, 0.15, 2000);
  }
}

export function damageSound() {
  if (!ctx) return;
  noise(0.12, 0.4, 1200); tone(120, 0.15, 0.4, 'sawtooth', 60);
}

export function killSound() {
  if (!ctx) return;
  tone(523, 0.08, 0.3, 'square'); setTimeout(() => tone(784, 0.12, 0.3, 'square'), 70);
}

export function coinSound() {
  if (!ctx) return;
  tone(988, 0.05, 0.18, 'square'); setTimeout(() => tone(1319, 0.06, 0.16, 'square'), 50);
}

export function zombieGrowl() {
  if (!ctx) return;
  tone(70 + Math.random() * 30, 0.4, 0.18, 'sawtooth', 50);
}

export function uiClick() { if (!ctx) return; tone(660, 0.04, 0.15, 'square'); }
