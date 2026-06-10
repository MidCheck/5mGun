import { GAME, UPGRADES, WEAPONS, Team } from '@5mgun/shared';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  onBuy: (id: string) => void = () => {};
  private shopOpen = false;
  private lastWave = -1;
  private upgradeLevels: Record<string, number> = {};

  show(mobile: boolean) {
    $('hud').classList.remove('hidden');
    $('crosshair').classList.remove('hidden');
    $('menu').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    if (mobile) $('mobile').classList.remove('hidden');
  }

  update(state: any, sessionId: string, mode: string, weaponId: string) {
    const me = state.players.get(sessionId);
    if (me) {
      const pct = Math.max(0, me.hp / me.maxHp) * 100;
      ($('healthfill') as HTMLElement).style.width = pct + '%';
      $('healthtext').textContent = String(Math.max(0, Math.ceil(me.hp)));
      $('ammomag').textContent = String(me.ammo);
      $('ammoreserve').textContent = String(me.reserve);
      $('weaponname').textContent = WEAPONS[weaponId as keyof typeof WEAPONS]?.name ?? '';
      $('coinval').textContent = String(me.coins);
    }

    if (mode === 'tdm') {
      $('coins').classList.add('hidden');
      $('waveinfo').textContent = '';
      $('scoreboard').innerHTML =
        `<span class="team-score team-a">${state.scoreA}</span>` +
        `<span class="team-score team-b">${state.scoreB}</span>`;
      const t = Math.max(0, state.timeLeft);
      $('timer').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    } else {
      $('coins').classList.remove('hidden');
      $('scoreboard').innerHTML = '';
      $('timer').textContent = '';
      const phase = state.phase;
      let info = '';
      if (phase === 'warmup' || phase === 'intermission') {
        info = `下一波 ${Math.ceil(state.intermissionLeft)}s`;
      } else if (state.wave >= 6) info = '☠ BOSS 波';
      else info = `第 ${state.wave} 波 · 剩 ${state.zombies.size}`;
      $('waveinfo').textContent = info;
      if (state.wave !== this.lastWave && state.wave > 0) {
        this.lastWave = state.wave;
        if (state.wave <= 6) this.centerMsg(state.wave === 6 ? 'BOSS 来袭！' : `第 ${state.wave} 波`);
      }
    }
  }

  hitmarker(head: boolean) {
    const hm = $('hitmarker');
    hm.classList.remove('show', 'head');
    void hm.offsetWidth;
    hm.classList.add('show');
    if (head) hm.classList.add('head');
  }

  killfeed(by: string, target: string, head: boolean) {
    const el = document.createElement('div');
    el.className = 'kf';
    el.innerHTML = `${by} ${head ? '<span class="hs">☠爆头☠</span>' : '➤'} ${target}`;
    $('killfeed').prepend(el);
    while ($('killfeed').children.length > 5) $('killfeed').lastChild!.remove();
    setTimeout(() => el.remove(), 5000);
  }

  headshotBanner() {
    const b = $('killBanner');
    b.textContent = 'HEADSHOT';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  centerMsg(text: string) {
    const c = $('centerMsg');
    c.textContent = text;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  }

  showStreak(n: number) {
    if (n < 2) { $('streak').textContent = ''; return; }
    const labels: Record<number, string> = { 2: '双杀', 3: '三杀', 4: '暴走' };
    $('streak').textContent = '🔥 ' + (labels[n] ?? `${n} 连杀`);
    setTimeout(() => { if ($('streak').textContent?.includes(String(n))) $('streak').textContent = ''; }, 3000);
  }

  bloodFlash() {
    const o = $('bloodOverlay');
    o.style.opacity = '0.85';
    setTimeout(() => { o.style.opacity = '0'; }, 120);
  }

  setShield(on: boolean) { $('shield').classList.toggle('hidden', !on); }

  setDeath(title: string | null, sub = '') {
    const el = $('deathBanner');
    if (!title) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="dead-title">${title}</div><div class="dead-sub">${sub}</div>`;
  }

  /** 受击方向：rel 为攻击者相对玩家朝向的角度（0=正前） */
  damageDir(rel: number, ranged = false) {
    const el = $('dmgDir');
    el.style.transform = `rotate(${rel}rad)`;
    (el.querySelector('.dmg-arrow') as HTMLElement).style.filter = ranged ? 'hue-rotate(60deg)' : 'none';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  toggleShop(force?: boolean) {
    this.shopOpen = force ?? !this.shopOpen;
    $('shop').classList.toggle('hidden', !this.shopOpen);
    if (this.shopOpen) this.renderShop();
  }

  setUpgradeLevels(lv: Record<string, number>) { this.upgradeLevels = lv; }

  private renderShop() {
    const grid = $('shopGrid');
    grid.innerHTML = '';
    for (const u of UPGRADES) {
      const lv = this.upgradeLevels[u.id] ?? 0;
      const maxed = lv >= u.maxLevel;
      const cost = Math.round(u.cost * (1 + lv * 0.5));
      const card = document.createElement('div');
      card.className = 'up-card' + (maxed ? ' maxed' : '');
      card.innerHTML = `<h3>${u.name}</h3><div class="desc">${u.desc}</div>` +
        `<div class="lvl">等级 ${lv}/${u.maxLevel}</div>` +
        `<div class="cost">${maxed ? '已满级' : '🪙 ' + cost}</div>`;
      if (!maxed) card.onclick = () => {
        this.upgradeLevels[u.id] = (this.upgradeLevels[u.id] ?? 0) + 1;
        this.onBuy(u.id);
        this.renderShop();
      };
      grid.appendChild(card);
    }
  }

  showEnd(mode: string, m: any, state: any, sessionId: string) {
    document.exitPointerLock?.();
    $('hud').classList.add('hidden');
    $('crosshair').classList.add('hidden');
    $('shop').classList.add('hidden');
    $('mobile').classList.add('hidden');
    $('endScreen').classList.remove('hidden');
    const me = state.players.get(sessionId);
    let title = '对局结束';
    if (mode === 'tdm') {
      const myTeam = me?.team === Team.A ? 'A' : 'B';
      title = m.winner === myTeam ? '🏆 胜利！' : '失败';
    } else {
      title = m.result === 'win' ? '🏆 守关成功！' : '☠ 全军覆没';
    }
    $('endTitle').textContent = title;
    $('endStats').innerHTML =
      `<div>击杀 <span class="big">${me?.kills ?? 0}</span> · 死亡 ${me?.deaths ?? 0}</div>` +
      (mode === 'zombie' ? `<div>金币 <span class="big">${me?.coins ?? 0}</span></div>` : '') +
      `<div>${mode === 'tdm' ? `比分 ${state.scoreA} : ${state.scoreB}` : `坚持到第 ${state.wave} 波`}</div>`;
  }
}
