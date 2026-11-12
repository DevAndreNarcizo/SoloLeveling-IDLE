import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../game/data/classes';
import { MONSTERS, ZONES } from '../game/data/zones';
import { ATTRIBUTE_INFO } from '../ui/format';
import { ASSETS, buildPrompt, findAsset } from './manifest';
import { buildPromptDocument } from './promptDoc';

describe('manifesto de assets', () => {
  it('possui ids e caminhos únicos, em minúsculas, apontando para PNG', () => {
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(ASSETS.length);
    expect(new Set(ASSETS.map((a) => a.file)).size).toBe(ASSETS.length);
    for (const asset of ASSETS) {
      expect(asset.id).toMatch(/^[a-z0-9_]+$/);
      expect(asset.file).toBe(`${asset.file.split('/')[0]}/${asset.id}.png`);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.chroma).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('cobre todos os assets referenciados pelo jogo', () => {
    const referenced = [
      ...Object.values(CLASSES).flatMap((c) => [c.assetId, c.weaponAssetId]),
      ...Object.values(MONSTERS).map((m) => m.assetId),
      ...ZONES.map((z) => z.backgroundAssetId),
      ...Object.values(ATTRIBUTE_INFO).map((a) => a.icon),
      'item_armor',
      'item_accessory',
      'icon_gold',
      'icon_essence',
      'ui_logo',
    ];
    for (const id of referenced) expect(findAsset(id), `asset ausente no manifesto: ${id}`).toBeDefined();
  });

  it('guardiões usam o canvas de chefe e monstros comuns o canvas padrão', () => {
    for (const monster of Object.values(MONSTERS)) {
      expect(findAsset(monster.assetId)?.category).toBe(monster.isBoss ? 'boss' : 'monster');
    }
  });

  it('gera prompts autossuficientes com orientação e fundo corretos', () => {
    for (const asset of ASSETS) {
      const prompt = buildPrompt(asset);
      expect(prompt).toContain(asset.subject);
      expect(prompt).toContain('Avoid:');
      if (asset.category === 'hunter') expect(prompt).toContain('facing RIGHT');
      if (asset.category === 'monster' || asset.category === 'boss') expect(prompt).toContain('facing LEFT');
      if (asset.transparent) expect(prompt).toContain(asset.chroma);
      else expect(prompt).not.toContain('transparent');
    }
  });

  it('docs/ASSET_PROMPTS.md está sincronizado com o manifesto (rode npm run assets:prompts)', () => {
    const committed = readFileSync(resolve(process.cwd(), 'docs/ASSET_PROMPTS.md'), 'utf8');
    expect(committed).toBe(buildPromptDocument());
  });
});
