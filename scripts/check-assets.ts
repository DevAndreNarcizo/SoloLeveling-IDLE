/**
 * Valida os sprites entregues contra o manifesto: presença, assinatura PNG,
 * dimensões exatas, canal alfa quando exigido e arquivos órfãos.
 *
 * Uso: npm run assets:check            (ausentes são apenas listados)
 *      npm run assets:check -- --strict (ausentes também reprovam)
 * Código de saída 1 quando há arquivo incorreto — adequado para CI.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS } from '../src/assets/manifest';

const spritesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/assets/sprites');
const strict = process.argv.includes('--strict');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface PngInfo {
  width: number;
  height: number;
  hasAlpha: boolean;
}

/** Lê o cabeçalho IHDR e detecta transparência (tipo de cor 4/6 ou chunk tRNS). */
function readPngInfo(path: string): PngInfo | null {
  const data = readFileSync(path);
  if (data.length < 33 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (data.toString('latin1', 12, 16) !== 'IHDR') return null;
  const colorType = data.readUInt8(25);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    hasAlpha: colorType === 4 || colorType === 6 || data.includes(Buffer.from('tRNS', 'latin1')),
  };
}

function listPngFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listPngFiles(full);
    return name.toLowerCase().endsWith('.png') ? [full] : [];
  });
}

const missing: string[] = [];
const errors: string[] = [];
let valid = 0;

for (const asset of ASSETS) {
  const path = join(spritesDir, asset.file);
  if (!existsSync(path)) {
    missing.push(asset.file);
    continue;
  }
  const info = readPngInfo(path);
  if (!info) {
    errors.push(`${asset.file}: não é um PNG válido`);
  } else if (info.width !== asset.width || info.height !== asset.height) {
    errors.push(`${asset.file}: ${info.width}x${info.height}, esperado ${asset.width}x${asset.height}`);
  } else if (asset.transparent && !info.hasAlpha) {
    errors.push(`${asset.file}: sem canal alfa (o fundo deve ser transparente)`);
  } else {
    valid += 1;
  }
}

const expected = new Set(ASSETS.map((asset) => asset.file));
const orphans = listPngFiles(spritesDir)
  .map((file) => relative(spritesDir, file).split('\\').join('/'))
  .filter((file) => !expected.has(file));
for (const orphan of orphans) errors.push(`${orphan}: fora do manifesto (nome ou pasta incorretos?)`);

console.log(`Assets válidos: ${valid}/${ASSETS.length}`);
if (missing.length > 0) {
  console.log(`\nAusentes (${missing.length}) — o jogo usa placeholder:`);
  for (const file of missing) console.log(`  - ${file}`);
}
if (errors.length > 0) {
  console.log(`\nProblemas (${errors.length}):`);
  for (const error of errors) console.log(`  ✗ ${error}`);
}
if (errors.length > 0 || (strict && missing.length > 0)) process.exit(1);
