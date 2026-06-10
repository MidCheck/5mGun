import nipplejs from 'nipplejs';
import { Button } from '@5mgun/shared';

export interface InputState {
  moveX: number; moveZ: number;
  yaw: number; pitch: number;
  buttons: number;
}

export class InputController {
  state: InputState = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, buttons: 0 };
  isMobile = false;
  fireHeld = false;
  private keys = new Set<string>();
  private sens = 0.0022;
  onReload = () => {};
  onSwitch = () => {};
  onShopToggle = () => {};
  onInteract = () => {};
  onFireOnce = () => {}; // 半自动单发
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 'ontouchstart' in window;
    if (this.isMobile) this.setupMobile();
    else this.setupDesktop();
  }

  private setupDesktop() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.onReload();
      if (e.code === 'KeyB') this.onShopToggle();
      if (e.code === 'KeyF') this.onInteract();
      if (e.code === 'KeyQ' || e.code === 'Digit2' || e.code === 'Digit1') this.onSwitch();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.canvas.addEventListener('click', () => {
      if (!this.locked) this.canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.state.yaw -= e.movementX * this.sens;
      this.state.pitch -= e.movementY * this.sens;
      this.state.pitch = Math.max(-1.5, Math.min(1.5, this.state.pitch));
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.fireHeld = true; this.onFireOnce(); }
      if (e.button === 2) this.state.buttons |= Button.Aim;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.state.buttons &= ~Button.Aim;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private setupMobile() {
    const zone = document.getElementById('joystick')!;
    // 动态模式：在左区任意位置按下即生成摇杆，跟手更灵敏
    const joy = nipplejs.create({ zone, mode: 'dynamic',
      color: 'rgba(255,255,255,0.45)', size: 120, fadeTime: 80, threshold: 0.05 });
    joy.on('move', (_e, d) => {
      const a = d.angle.radian; const f = Math.min(d.distance / 50, 1);
      this.state.moveX = Math.cos(a) * f;
      this.state.moveZ = Math.sin(a) * f; // 上为前
    });
    joy.on('end', () => { this.state.moveX = 0; this.state.moveZ = 0; });

    // 右屏滑动转视角
    let lastX = 0, lastY = 0, touchId = -1;
    const lookArea = this.canvas;
    lookArea.addEventListener('touchstart', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX > window.innerWidth * 0.45 && touchId === -1) {
          touchId = t.identifier; lastX = t.clientX; lastY = t.clientY;
        }
      }
    });
    lookArea.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId) {
          this.state.yaw -= (t.clientX - lastX) * 0.005;
          this.state.pitch -= (t.clientY - lastY) * 0.005;
          this.state.pitch = Math.max(-1.5, Math.min(1.5, this.state.pitch));
          lastX = t.clientX; lastY = t.clientY;
        }
      }
    });
    lookArea.addEventListener('touchend', (e) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) touchId = -1;
    });

    const btn = (id: string, on: () => void, off?: () => void) => {
      const el = document.getElementById(id)!;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); });
      if (off) el.addEventListener('touchend', (e) => { e.preventDefault(); off(); });
    };
    btn('mFire', () => { this.fireHeld = true; this.onFireOnce(); }, () => { this.fireHeld = false; });
    btn('mReload', () => this.onReload());
    btn('mJump', () => { this.state.buttons |= Button.Jump; setTimeout(() => (this.state.buttons &= ~Button.Jump), 120); });
    btn('mAim', () => this.state.buttons |= Button.Aim, () => this.state.buttons &= ~Button.Aim);
    btn('mSwitch', () => this.onSwitch());
    // 蹲：点按切换
    const crouchEl = document.getElementById('mCrouch')!;
    crouchEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.state.buttons ^= Button.Crouch;
      crouchEl.classList.toggle('on', (this.state.buttons & Button.Crouch) !== 0);
    });
  }

  /** 每帧采样：把键盘状态合成进 InputState（移动 + 按钮位） */
  sample() {
    if (!this.isMobile) {
      let x = 0, z = 0;
      if (this.keys.has('KeyW')) z += 1;
      if (this.keys.has('KeyS')) z -= 1;
      if (this.keys.has('KeyD')) x += 1;
      if (this.keys.has('KeyA')) x -= 1;
      this.state.moveX = x; this.state.moveZ = z;
      let b = this.state.buttons & Button.Aim;
      if (this.keys.has('Space')) b |= Button.Jump;
      if (this.keys.has('ShiftLeft')) b |= Button.Sprint;
      if (this.keys.has('ControlLeft') || this.keys.has('KeyC')) b |= Button.Crouch;
      if (this.fireHeld) b |= Button.Fire;
      this.state.buttons = b;
    } else {
      // 保留 瞄准/跳/蹲（蹲为切换态），叠加开火
      let b = this.state.buttons & (Button.Aim | Button.Jump | Button.Crouch);
      if (this.fireHeld) b |= Button.Fire;
      this.state.buttons = b;
    }
    return this.state;
  }
}
