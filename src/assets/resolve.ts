/**
 * Resolve, em tempo de build, quais sprites do manifesto já foram
 * entregues. `import.meta.glob` é avaliado pelo Vite: arquivos presentes
 * viram URLs com hash; ausentes simplesmente não aparecem no mapa, e a UI
 * recorre ao placeholder — sem requisições 404 em runtime.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { findAsset } from './manifest';

const spriteUrls = import.meta.glob<string>('./sprites/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** URL do sprite se o arquivo existir no projeto; caso contrário, null. */
export function getAssetUrl(assetId: string): string | null {
  const asset = findAsset(assetId);
  if (!asset) return null;
  return spriteUrls[`./sprites/${asset.file}`] ?? null;
}
