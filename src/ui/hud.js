import { TOWERS, TOWER_ORDER, TARGET_LABEL, MAX_WAVES, towerStats } from '../game/config.js';
import { clamp } from '../core/utils.js';

const pct = (v) => Math.round(v * 100);

export class HUD {
  constructor(game) {
    this.game = game;
    this.icons = {};
    this.lastGold = -1;
    this.lastLives = -1;
    this.lastWave = -1;
    this.overlayMode = null;

    this.el = {
      hud: document.getElementById('hud'),
      overlay: document.getElementById('overlay'),
      loading: document.getElementById('loading'),
      lives: document.getElementById('lives'),
      gold: document.getElementById('gold'),
      wave: document.getElementById('wave'),
      waveTotal: document.getElementById('waveTotal'),
      statLives: document.getElementById('stat-lives'),
      statGold: document.getElementById('stat-gold'),
      statWave: document.getElementById('stat-wave'),
      shop: document.getElementById('shop'),
      towerPanel: document.getElementById('towerpanel'),
      banner: document.getElementById('banner'),
      toasts: document.getElementById('toasts'),
      bossbar: document.getElementById('bossbar'),
      bossName: document.getElementById('bossName'),
      bossFill: document.getElementById('bossFill'),
      waveBtn: document.getElementById('btn-wave'),
      speed: document.getElementById('btn-speed'),
      pause: document.getElementById('btn-pause'),
      sound: document.getElementById('btn-sound'),
      help: document.getElementById('btn-help'),
    };

    this.buildShop();
    this.bind();
  }

  setIcons(icons) {
    this.icons = icons;
    this.el.shop.querySelectorAll('.card').forEach((card) => {
      const img = card.querySelector('img');
      if (icons[card.dataset.type]) img.src = icons[card.dataset.type];
    });
  }

  buildShop() {
    this.el.shop.innerHTML = TOWER_ORDER.map((type, i) => {
      const t = TOWERS[type];
      return `
        <button class="card" data-type="${type}" title="${t.desc}">
          <span class="key">${i + 1}</span>
          <span class="tag">${t.tag}</span>
          <span class="art"><img alt="${t.name}" /></span>
          <span class="cname">${t.name}</span>
          <span class="ccost">${t.cost}</span>
        </button>`;
    }).join('');

    this.cards = {};
    this.el.shop.querySelectorAll('.card').forEach((card) => {
      this.cards[card.dataset.type] = card;
      card.addEventListener('click', () => this.game.chooseBuild(card.dataset.type));
    });
  }

  bind() {
    document.getElementById('btn-speed').addEventListener('click', () => this.game.cycleSpeed());
    this.el.pause.addEventListener('click', () => this.game.togglePause());
    this.el.sound.addEventListener('click', () => this.game.toggleSound());
    this.el.help.addEventListener('click', () => this.showHelp());
    this.el.waveBtn.addEventListener('click', () => this.game.callWave());
    this.el.towerPanel.querySelector('.tp-close').addEventListener('click', () => this.game.deselect());
    this.el.towerPanel.querySelector('.upgrade').addEventListener('click', () => this.game.upgradeSelected());
    this.el.towerPanel.querySelector('.sell').addEventListener('click', () => this.game.sellSelected());
    this.el.towerPanel.querySelector('.target').addEventListener('click', () => this.game.cycleTarget());
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }

  hide() {
    this.el.hud.classList.add('hidden');
  }

  hideLoading() {
    this.el.loading.classList.add('out');
    setTimeout(() => this.el.loading.remove(), 600);
  }

  /* ------------------------------------------------------------------ */
  refresh() {
    const g = this.game;
    const gold = Math.floor(g.gold);
    if (gold !== this.lastGold) {
      if (this.lastGold >= 0 && gold > this.lastGold) this.pulse(this.el.statGold);
      this.el.gold.textContent = gold;
      this.lastGold = gold;
    }
    if (g.lives !== this.lastLives) {
      if (this.lastLives >= 0 && g.lives < this.lastLives) this.pulse(this.el.statLives);
      this.el.lives.textContent = Math.max(0, g.lives);
      this.lastLives = g.lives;
    }
    if (g.wave !== this.lastWave) {
      this.el.wave.textContent = g.wave;
      this.lastWave = g.wave;
    }
    this.el.waveTotal.textContent = g.endless ? '/ ∞ 波' : `/ ${MAX_WAVES} 波`;

    for (const type of TOWER_ORDER) {
      const card = this.cards[type];
      card.classList.toggle('poor', g.gold < TOWERS[type].cost);
      card.classList.toggle('active', g.buildType === type);
    }

    const t = g.selected;
    if (!t) {
      this.el.towerPanel.classList.add('hidden');
    } else {
      this.el.towerPanel.classList.remove('hidden');
      const s = t.stats;
      const img = this.el.towerPanel.querySelector('.tp-icon img');
      if (img.src !== this.icons[t.type]) img.src = this.icons[t.type] || '';
      this.el.towerPanel.querySelector('.tp-name').textContent = t.def.name;
      this.el.towerPanel.querySelector('.tp-level').textContent = `Lv.${t.level} · ${t.def.tag}`;
      this.el.towerPanel.querySelector('.tp-stats').innerHTML = `
        <div><span>伤害</span><b>${Math.round(s.damage)}</b></div>
        <div><span>射速</span><b>${s.rate.toFixed(2)}/s</b></div>
        <div><span>射程</span><b>${s.range.toFixed(1)}</b></div>
        <div><span>DPS</span><b>${Math.round(t.dps)}</b></div>`;
      const up = this.el.towerPanel.querySelector('.upgrade');
      const can = t.canUpgrade();
      up.disabled = !can || g.gold < t.upgradePrice;
      up.innerHTML = can
        ? `<b>升级</b><span>◈ ${t.upgradePrice}</span>`
        : `<b>已满级</b><span>MAX</span>`;
      const sell = this.el.towerPanel.querySelector('.sell');
      sell.innerHTML = `<b>出售</b><span>+${t.sellPrice}</span>`;
      this.el.towerPanel.querySelector('.target').textContent = `目标：${TARGET_LABEL[t.mode]}`;
    }

    // wave button
    const wb = this.el.waveBtn;
    if (g.waveActive) {
      wb.classList.add('waiting');
      wb.disabled = false;
      wb.innerHTML = `<b>战斗中</b><span>第 ${g.wave} 波 · 剩余 ${g.enemies.length}</span>`;
    } else if (g.state === 'playing') {
      wb.classList.remove('waiting');
      wb.disabled = false;
      const cd = Math.ceil(g.waveCountdown);
      const bonus = Math.max(0, Math.floor(g.waveCountdown * 2));
      wb.innerHTML = `<b>下一波</b><span>${cd > 0 ? `${cd}s · 提前 +${bonus}◈` : '立即出发'}</span>`;
    }
  }

  pulse(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  toast(msg, kind = '') {
    const div = document.createElement('div');
    div.className = 'toast ' + kind;
    div.textContent = msg;
    this.el.toasts.appendChild(div);
    setTimeout(() => div.remove(), 2300);
  }

  banner(title, sub = '') {
    const b = this.el.banner;
    b.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  setBoss(enemy) {
    if (!enemy) {
      this.el.bossbar.classList.add('hidden');
      return;
    }
    this.el.bossbar.classList.remove('hidden');
    this.el.bossName.textContent = `${enemy.def.name} · 第 ${enemy.wave} 波`;
    this.el.bossFill.style.width = `${(clamp(enemy.hp / enemy.maxHp, 0, 1) * 100).toFixed(1)}%`;
  }

  setSpeed(speed) {
    this.el.speed.textContent = speed + '×';
    this.el.speed.classList.toggle('off', speed === 1);
  }

  setMuted(muted) {
    this.el.sound.classList.toggle('off', muted);
    this.el.sound.textContent = muted ? '✕' : '♪';
  }

  /* ------------------------------------------------------------------ */
  showStart() {
    const best = this.getBest();
    this.el.overlay.classList.remove('hidden');
    this.overlayMode = 'start';
    this.el.overlay.innerHTML = `
      <div class="screen">
        <div class="titlekicker">A CARTOON TOWER DEFENSE</div>
        <h1 class="gametitle">柠檬塔防</h1>
        <div class="gamesub">L E M O N &nbsp; T D &nbsp;·&nbsp; 3 D</div>
        <div class="startcard">
          <button class="bigbtn" id="btn-start">开 始 守 卫</button>
          <div class="bestline">最高分 <b>${best.score || 0}</b> &nbsp;·&nbsp; 最远 <b>${best.wave || 0}</b> 波</div>
        </div>
        <div class="helprow">
          <div class="helpchip"><i>1–5</i> 选塔建造</div>
          <div class="helpchip"><i>拖</i> 旋转视角</div>
          <div class="helpchip"><i>滚</i> 缩放</div>
          <div class="helpchip"><i>空格</i> 暂停</div>
        </div>
      </div>`;
    this.el.overlay.querySelector('#btn-start').addEventListener('click', () => this.game.start());
  }

  showPause() {
    this.el.overlay.classList.remove('hidden');
    this.overlayMode = 'pause';
    this.el.overlay.innerHTML = `
      <div class="resultcard">
        <h2>暂 停</h2>
        <p class="sub">PAUSED</p>
        <div class="resultbtns">
          <button class="bigbtn" id="btn-resume">继续守卫</button>
          <button class="bigbtn" id="btn-restart">重新开始</button>
          <button class="bigbtn" id="btn-help2">玩法说明</button>
        </div>
      </div>`;
    this.el.overlay.querySelector('#btn-resume').addEventListener('click', () => this.game.togglePause());
    this.el.overlay.querySelector('#btn-restart').addEventListener('click', () => this.game.restart());
    this.el.overlay.querySelector('#btn-help2').addEventListener('click', () => this.showHelp());
  }

  showResult(win, stats) {
    this.el.overlay.classList.remove('hidden');
    this.overlayMode = 'result';
    this.el.overlay.innerHTML = `
      <div class="resultcard">
        <h2>${win ? '守 住 了' : '防 线 失 守'}</h2>
        <p class="sub">${win ? 'VICTORY · LEMON GUARD PREVAILS' : 'DEFEAT · THE HORDE BROKE THROUGH'}</p>
        <div class="scoregrid">
          <div><span>得分</span><b>${stats.score}</b></div>
          <div><span>波次</span><b>${stats.wave}</b></div>
          <div><span>击杀</span><b>${stats.kills}</b></div>
        </div>
        <div class="resultbtns">
          ${win ? '<button class="bigbtn" id="btn-endless">继续无尽</button>' : ''}
          <button class="bigbtn" id="btn-again">再来一局</button>
          <button class="bigbtn" id="btn-help3">玩法说明</button>
        </div>
      </div>`;
    this.el.overlay.querySelector('#btn-again').addEventListener('click', () => this.game.restart());
    if (win) this.el.overlay.querySelector('#btn-endless').addEventListener('click', () => this.game.continueEndless());
    this.el.overlay.querySelector('#btn-help3').addEventListener('click', () => this.showHelp());
  }

  showHelp() {
    this.helpWasPlaying = this.game.state === 'playing';
    if (this.helpWasPlaying) this.game.setPaused(true);
    this.el.overlay.classList.remove('hidden');
    this.overlayMode = 'help';
    this.el.overlay.innerHTML = `
      <div class="helppanel">
        <h3>玩法说明</h3>
        <p>沿着小路，敌人会从紫色传送门一路冲向右侧城堡。在草地上建造防御塔，把它们全部拦下来。</p>
        <h4>建造与升级</h4>
        <ul>
          <li>按 <kbd>1</kbd>–<kbd>5</kbd> 或点底部卡片选塔，再点草地空格建造。</li>
          <li>点击已建成的塔可以查看属性、升级（3 级）或出售（返还 70%）。</li>
          <li>升级会提高伤害、射速与射程，并解锁金色装饰。</li>
        </ul>
        <h4>五种防御塔</h4>
        <ul>
          <li><b>箭塔</b>：便宜、射速快，能打空中。</li>
          <li><b>炮塔</b>：范围爆炸，只打地面，适合密集的小怪。</li>
          <li><b>冰霜塔</b>：范围减速，控场核心。</li>
          <li><b>奥术塔</b>：魔法伤害无视护甲。</li>
          <li><b>电磁塔</b>：闪电连锁 3 个目标，清群利器。</li>
        </ul>
        <h4>波次与金币</h4>
        <ul>
          <li>挡住一波会获得金币奖励；提前召唤下一波有额外金币。</li>
          <li>漏怪会扣生命，生命归零即失败。</li>
          <li>撑过 20 波获胜，之后可以继续挑战无尽模式。</li>
        </ul>
        <h4>操作</h4>
        <ul>
          <li>拖动旋转视角，滚轮缩放，<kbd>空格</kbd> 暂停，<kbd>Esc</kbd> 取消选择。</li>
          <li><kbd>F</kbd> 切换 1× / 2× 速度，<kbd>M</kbd> 静音。</li>
        </ul>
        <div style="margin-top:18px;text-align:center">
          <button class="bigbtn" id="btn-help-close" style="min-width:160px;font-size:14px">知道了</button>
        </div>
      </div>`;
    this.el.overlay.querySelector('#btn-help-close').addEventListener('click', () => {
      this.el.overlay.classList.add('hidden');
      this.el.overlay.innerHTML = '';
      this.overlayMode = null;
      if (this.helpWasPlaying) this.game.setPaused(false);
      else if (this.game.state === 'menu') this.showStart();
      else if (this.game.state === 'paused') this.showPause();
      else if (this.game.state === 'over' || this.game.state === 'won') this.game.showResult(this.game.won);
    });
  }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
    this.el.overlay.innerHTML = '';
    this.overlayMode = null;
  }

  getBest() {
    try {
      return {
        score: Number(localStorage.getItem('lemonTdBest') || 0),
        wave: Number(localStorage.getItem('lemonTdBestWave') || 0),
      };
    } catch (e) {
      return { score: 0, wave: 0 };
    }
  }

  saveBest(score, wave) {
    const best = this.getBest();
    try {
      if (score > best.score) localStorage.setItem('lemonTdBest', String(score));
      if (wave > best.wave) localStorage.setItem('lemonTdBestWave', String(wave));
    } catch (e) { /* ignore */ }
  }
}
