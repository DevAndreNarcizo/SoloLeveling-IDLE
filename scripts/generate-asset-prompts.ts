/**
 * Regenera docs/ASSET_PROMPTS.md a partir do manifesto de assets.
 * Uso: npm run assets:prompts
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS } from '../src/assets/manifest';
import { buildPromptDocument } from '../src/assets/promptDoc';

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/ASSET_PROMPTS.md');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, buildPromptDocument(), 'utf8');
console.log(`docs/ASSET_PROMPTS.md atualizado (${ASSETS.length} assets).`);
