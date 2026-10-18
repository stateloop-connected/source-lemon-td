export const START_GOLD = 340;
export const START_LIVES = 20;
export const MAX_WAVES = 20;
export const PREP_TIME = 12;

export const TOWERS = {
  arrow: {
    id: 'arrow', name: '箭塔', en: 'ARROW', tag: '单体',
    cost: 70, damage: 16, rate: 1.55, range: 13, speed: 46,
    kind: 'physical', air: true, ground: true, splash: 0,
    color: 0x7ee06a,
    desc: '射速快，可攻击空中单位',
  },
  cannon: {
    id: 'cannon', name: '炮塔', en: 'CANNON', tag: '范围',
    cost: 120, damage: 46, rate: 0.62, range: 14, speed: 27,
    kind: 'physical', air: false, ground: true, splash: 4.4,
    color: 0xffa94d,
    desc: '炮弹爆炸，只打地面',
  },
  frost: {
    id: 'frost', name: '冰霜塔', en: 'FROST', tag: '减速',
    cost: 110, damage: 10, rate: 1.15, range: 11.5, speed: 25,
    kind: 'magic', air: true, ground: true, splash: 3.0,
    slow: 0.45, slowTime: 2.6,
    color: 0x6fe8ff,
    desc: '范围冰冻，大幅减速',
  },
  arcane: {
    id: 'arcane', name: '奥术塔', en: 'ARCANE', tag: '穿透',
    cost: 170, damage: 38, rate: 0.95, range: 13.5, speed: 31,
    kind: 'magic', air: true, ground: true, splash: 0,
    color: 0xb07bff,
    desc: '奥术弹无视护甲',
  },
  tesla: {
    id: 'tesla', name: '电磁塔', en: 'TESLA', tag: '连锁',
    cost: 220, damage: 31, rate: 1.05, range: 12.5, speed: 0,
    kind: 'magic', air: true, ground: true, chain: 3,
    color: 0x7ad7ff,
    desc: '闪电连锁 3 个目标',
  },
};

export const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'arcane', 'tesla'];
export const MAX_LEVEL = 3;
export const LEVEL_DMG = [1, 1.7, 2.9];

export function towerStats(type, level) {
  const d = TOWERS[type];
  const m = LEVEL_DMG[level - 1];
  return {
    ...d,
    damage: d.damage * m,
    range: d.range * (1 + 0.075 * (level - 1)),
    rate: d.rate * (1 + 0.1 * (level - 1)),
    level,
  };
}

export function upgradeCost(type, level) {
  const d = TOWERS[type];
  return Math.round(d.cost * (level === 1 ? 0.95 : 1.55));
}

export function sellValue(invested) {
  return Math.round(invested * 0.7);
}

export const ENEMIES = {
  slime: {
    id: 'slime', name: '史莱姆', hp: 72, speed: 6.4, armor: 0, gold: 9,
    flying: false, height: 1.5, radius: 0.62,
  },
  goblin: {
    id: 'goblin', name: '哥布林', hp: 58, speed: 9.0, armor: 0, gold: 8,
    flying: false, height: 1.9, radius: 0.55,
  },
  bat: {
    id: 'bat', name: '夜蝠', hp: 48, speed: 10.4, armor: 0, gold: 10,
    flying: true, height: 1.0, radius: 0.55, flyY: 4.6,
  },
  knight: {
    id: 'knight', name: '铁甲卫', hp: 250, speed: 4.7, armor: 0.35, gold: 22,
    flying: false, height: 2.05, radius: 0.72,
  },
  shaman: {
    id: 'shaman', name: '萨满', hp: 160, speed: 5.5, armor: 0.12, gold: 20,
    flying: false, height: 2.1, radius: 0.62, heal: 16, healRadius: 7.5,
  },
  ogre: {
    id: 'ogre', name: '食人魔', hp: 2300, speed: 3.3, armor: 0.22, gold: 150,
    flying: false, height: 3.7, radius: 1.25, boss: true,
  },
};

export function hpScale(wave) {
  return 1 + (wave - 1) * 0.135;
}

export const TARGET_MODES = ['first', 'strong', 'close'];
export const TARGET_LABEL = { first: '最前方', strong: '最强壮', close: '最近处' };
