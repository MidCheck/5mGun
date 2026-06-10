import { World } from './world.js';
import { InputController } from './input.js';
import { Hud } from './ui.js';
import { Game } from './game.js';
import { makeClient, quickStart, createRoom, joinByCode } from './net.js';
import { initAudio, uiClick } from './audio.js';
import { Assets } from './assets.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const canvas = document.getElementById('game') as HTMLCanvasElement;

let mode = 'tdm';
let botSkill = 'normal';
let game: Game | null = null;
const client = makeClient();

// 菜单交互
document.querySelectorAll('.mode-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    mode = (b as HTMLElement).dataset.mode!;
    $('botSkillRow').style.display = mode === 'tdm' ? 'flex' : 'none';
    uiClick();
  });
});
document.querySelectorAll('.skill-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.skill-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    botSkill = (b as HTMLElement).dataset.skill!;
    uiClick();
  });
});

function nick(): string {
  const v = ($('nick') as HTMLInputElement).value.trim();
  return v || '玩家' + Math.floor(Math.random() * 1000);
}

function status(msg: string) { $('menuStatus').textContent = msg; }

const isTouch = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 'ontouchstart' in window;
const fsSupported = !!(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen);

// 阻止移动端双击缩放 / 双指缩放
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 320) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

function fsToast(msg: string) {
  const b = $('fsBtn');
  const prev = b.textContent;
  b.textContent = msg;
  setTimeout(() => { b.textContent = prev || '⛶ 全屏'; }, 2200);
}

function lockLandscape() {
  try {
    const o: any = (screen as any).orientation;
    const p = o?.lock?.('landscape');
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* iOS 不支持，忽略 */ }
}

function fsActive(): boolean {
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

async function goFullscreen() {
  if (fsActive()) { lockLandscape(); return; }
  const el = document.documentElement as any;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!req) { fsToast('iOS 请用 Safari「分享→添加到主屏幕」全屏'); return; } // iOS Safari/Chrome 无全屏 API
  try {
    const p = req.call(el);
    if (p && typeof p.then === 'function') await p;
    lockLandscape();
  } catch (e: any) {
    fsToast('全屏失败:' + (e?.name || e?.message || e));
  }
}

// 移动端首个触摸即尝试进入全屏（最可靠的用户手势）
let fsTried = false;
function armFirstTouchFullscreen() {
  if (!isTouch || fsTried) return;
  const handler = () => { fsTried = true; goFullscreen(); window.removeEventListener('touchend', handler); window.removeEventListener('click', handler); };
  window.addEventListener('touchend', handler, { once: true });
  window.addEventListener('click', handler, { once: true });
}

async function launch(getJoin: () => Promise<{ room: any; sessionId: string }>) {
  initAudio();
  if (isTouch) {
    $('fsBtn').classList.remove('hidden');
    if (fsSupported) { goFullscreen(); armFirstTouchFullscreen(); }
    else $('fsBtn').textContent = '＋ 加主屏全屏'; // iOS：提示添加到主屏幕
  }
  status('连接服务器中…');
  try {
    const { room, sessionId } = await getJoin();
    if (!Assets.ready) { status('加载素材中…'); await Assets.load(); }
    status('');
    const world = new World(canvas);
    const input = new InputController(canvas);
    const hud = new Hud();
    hud.show(input.isMobile);
    game = new Game(world, input, room, hud, sessionId, mode);
    hud.onBuy = (id: string) => game!.buyUpgrade(id);
    (window as any).__dbg = { world, game, room }; // 调试句柄

    // 房间码徽标
    $('roomCodeBadge').classList.remove('hidden');
    $('roomCodeVal').textContent = room.roomId;

    room.onLeave(() => status('已断开连接'));
  } catch (e: any) {
    console.error(e);
    status('连接失败：' + (e?.message || e) + '（请确认服务器已启动）');
  }
}

$('quickStart').addEventListener('click', () =>
  launch(() => quickStart(client, mode, { name: nick(), botSkill })));

$('createRoom').addEventListener('click', () =>
  launch(() => createRoom(client, mode, { name: nick(), botSkill })));

$('joinRoom').addEventListener('click', () => {
  const code = ($('roomCode') as HTMLInputElement).value.trim();
  if (!code) { status('请输入房间码'); return; }
  launch(() => joinByCode(client, code, { name: nick() }));
});

$('copyCode').addEventListener('click', () => {
  navigator.clipboard?.writeText($('roomCodeVal').textContent || '');
  $('copyCode').textContent = '已复制';
  setTimeout(() => ($('copyCode').textContent = '复制'), 1500);
});

$('againBtn').addEventListener('click', () => location.reload());
$('menuBtn').addEventListener('click', () => location.reload());
$('fsBtn').addEventListener('click', () => goFullscreen());

$('botSkillRow').style.display = 'flex';
