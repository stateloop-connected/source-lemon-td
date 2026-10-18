const g = (type, count, gap, delay = 0) => ({ type, count, gap, delay });

export const WAVES = [
  { name: '史莱姆试探', groups: [g('slime', 8, 0.9)] },
  { name: '黏液涌动', groups: [g('slime', 14, 0.65)] },
  { name: '哥布林小队', groups: [g('goblin', 10, 0.55), g('slime', 6, 0.8, 3)] },
  { name: '夜蝠来袭', groups: [g('bat', 8, 0.55), g('slime', 10, 0.65, 2)] },
  { name: '铁甲前哨', groups: [g('knight', 3, 1.8), g('goblin', 12, 0.5, 2)] },
  { name: '空中骚扰', groups: [g('bat', 12, 0.45), g('goblin', 8, 0.6, 4)] },
  { name: '重装推进', groups: [g('knight', 5, 1.5), g('slime', 12, 0.55, 2)] },
  { name: '萨满仪式', groups: [g('shaman', 2, 2), g('goblin', 14, 0.45, 1)] },
  { name: '暮色群蝠', groups: [g('bat', 16, 0.38), g('knight', 3, 2, 3)] },
  {
    name: '酋长降临', boss: true,
    groups: [g('ogre', 1, 0), g('slime', 12, 0.5, 2), g('goblin', 8, 0.5, 4)],
  },
  { name: '钢铁洪流', groups: [g('knight', 6, 1.2), g('shaman', 2, 1.5, 1)] },
  { name: '蝠群风暴', groups: [g('bat', 18, 0.34), g('goblin', 12, 0.45, 3)] },
  { name: '双线压迫', groups: [g('ogre', 1, 0), g('knight', 4, 1.4, 1), g('bat', 10, 0.4, 2)] },
  { name: '萨满议会', groups: [g('shaman', 4, 1.4), g('knight', 6, 1.2, 1)] },
  { name: '巨人的脚步', boss: true, groups: [g('ogre', 2, 3), g('goblin', 16, 0.4, 2)] },
  { name: '黑翼', groups: [g('bat', 22, 0.3), g('shaman', 3, 1.6, 2)] },
  { name: '铁与雷霆', groups: [g('knight', 8, 1.0), g('ogre', 1, 0, 3)] },
  { name: '全面进攻', groups: [g('bat', 24, 0.28), g('goblin', 18, 0.35, 2), g('shaman', 4, 1.2, 4)] },
  { name: '双王', boss: true, groups: [g('ogre', 2, 2.5), g('knight', 8, 0.9, 1), g('shaman', 4, 1.2, 2)] },
  {
    name: '最终决战', final: true,
    groups: [g('ogre', 3, 3), g('knight', 10, 0.8, 2), g('bat', 20, 0.3, 4), g('shaman', 4, 1, 6)],
  },
];

export const WAVE_COUNT = WAVES.length;

function endlessWave(n) {
  const groups = [];
  groups.push(g('knight', Math.min(16, 4 + Math.floor(n / 3)), 0.7));
  groups.push(g('bat', Math.min(32, 10 + Math.floor(n / 2)), 0.28, 2));
  groups.push(g('goblin', Math.min(30, 8 + Math.floor(n / 2)), 0.3, 2.2));
  groups.push(g('shaman', Math.min(8, 2 + Math.floor(n / 12)), 1.2, 3));
  if (n % 3 === 0) groups.push(g('ogre', 1 + Math.floor((n - 20) / 6), 2.6, 4));
  return { name: '无尽 · 第 ' + n + ' 波', groups, endless: true };
}

export function buildWave(wave) {
  const def = wave <= WAVES.length ? WAVES[wave - 1] : endlessWave(wave);
  const spawns = [];
  let cursor = 0;
  for (const group of def.groups) {
    let t = cursor + (group.delay ?? 0);
    for (let i = 0; i < group.count; i++) {
      const elite = wave >= 6 && i > 0 && Math.random() < Math.min(0.18, 0.02 + wave * 0.004);
      spawns.push({ t, type: group.type, elite });
      t += group.gap ?? 0.7;
    }
    cursor = t + 1.1;
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    wave,
    name: def.name,
    boss: !!def.boss,
    final: !!def.final,
    endless: !!def.endless,
    spawns,
    duration: spawns.length ? spawns[spawns.length - 1].t : 0,
    count: spawns.length,
    hpMul: wave <= WAVES.length ? 1 : Math.pow(1.28, wave - WAVES.length),
  };
}
