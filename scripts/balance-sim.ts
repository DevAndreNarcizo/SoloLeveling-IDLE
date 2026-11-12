/**
 * Simulador de balanceamento: um bot joga 30h com cada classe (distribui
 * atributos 2:1 primário/VIT, equipa o melhor item, aprimora, funde ecos e
 * recua de fenda após derrotas seguidas) e imprime a linha do tempo de
 * desbloqueios. Use após alterar `src/game/data/*` para detectar muros ou
 * atalhos de progressão.
 *
 * Uso: npm run balance:sim
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { CLASS_IDS, CLASSES } from '../src/game/data/classes';
import { ZONES } from '../src/game/data/zones';
import { allocateAttribute, changeZone, enhanceItem, equipItem, fuseEcho, sellAllUpTo } from '../src/game/engine/actions';
import { step } from '../src/game/engine/combat';
import type { GameEvent } from '../src/game/types';
import { getItemStats } from '../src/game/engine/formulas';
import { createNewGame } from '../src/game/engine/state';

for (const classId of CLASS_IDS) {
  const s = createNewGame('Bot', classId, 1234, 0);
  const primary = CLASSES[classId].primary;
  let t = 0; let recentDeaths = 0; let retreatUntil = 0; let lastDeaths = 0;
  const marks: string[] = [];
  let timeouts = 0;
  const sink = (e: GameEvent) => { if (e.type === 'death' && e.reason === 'timeout') timeouts++; };
  let lastTier = 1;
  const HOURS = 30;
  for (let i = 0; i < HOURS * 36000; i++) {
    step(s, 100, sink); t += 100;
    if (i % 50 === 0) {
      while (s.hunter.attributePoints >= 3) { allocateAttribute(s, primary, 2); allocateAttribute(s, 'vit', 1); }
      for (const it of [...s.inventory]) {
        const cur = s.equipment[it.slot];
        const a = getItemStats(it), b = cur ? getItemStats(cur) : { attack: 0, defense: 0, hp: 0 };
        if (a.attack + a.defense + a.hp > b.attack + b.defense + b.hp) equipItem(s, it.uid);
      }
      for (const id of Object.keys(s.echoes)) fuseEcho(s, id);
      if (s.inventory.length > 20) sellAllUpTo(s, 'legendary');
      for (const slot of ['weapon', 'armor', 'accessory'] as const) { const it = s.equipment[slot]; if (it && it.tier === s.highestUnlockedTier) enhanceItem(s, it.uid); }
      if (s.stats.deaths > lastDeaths) { recentDeaths += s.stats.deaths - lastDeaths; lastDeaths = s.stats.deaths; }
      if (recentDeaths >= 3 && t > retreatUntil) { retreatUntil = t + 15 * 60000; recentDeaths = 0; }
      const target = Math.max(1, s.highestUnlockedTier - (t < retreatUntil ? 1 : 0));
      const z = ZONES.find((z) => z.tier === target)!;
      if (z.id !== s.combat.zoneId) changeZone(s, z.id);
      if (s.hunter.level === 100 && !marks.some((m) => m.startsWith('MAX'))) marks.push(`MAX@${(t / 3600000).toFixed(1)}h`);
      if (s.highestUnlockedTier !== lastTier) { lastTier = s.highestUnlockedTier; marks.push(`T${lastTier}@${(t / 3600000).toFixed(2)}h L${s.hunter.level}`); }
    }
  }
  const boss6 = s.bossKillsByZone['void_threshold'] ?? 0;
  console.log(classId.padEnd(9), marks.join(' | '), `=> L${s.hunter.level} deaths ${s.stats.deaths} (timeout ${timeouts}) kills ${s.stats.kills} S-boss ${boss6} echoes ${Object.keys(s.echoes).length} enh ${(['weapon','armor','accessory'] as const).map((k) => s.equipment[k]?.enhance).join('/')} gold ${s.gold}`);
}
