// Resolve quais assets existem em public/assets e cria ícones para a interface.
import { ASSET_BY_ID } from '../../shared/assets.ts'
import { MONSTERS } from '../../shared/content.ts'

declare const __ASSET_FILES__: string[]
const HAVE = new Set(__ASSET_FILES__)
export const hasAsset = (id: string) => !!ASSET_BY_ID[id] && HAVE.has(ASSET_BY_ID[id].path)
export const assetUrl = (id: string) => `/assets/${ASSET_BY_ID[id].path}`

/** Chave de textura de um monstro: a arte própria, ou a do monstro comum quando o chefe não tem arte. */
export function monsterKey(species: string): string {
  const id = `monstros/${species}`
  const fb = MONSTERS[species]?.fallback
  return hasAsset(id) || !fb ? id : `monstros/${fb}`
}

/** Ícone da interface: a imagem, se existir; senão, um quadrado com as iniciais. */
export function icon(id: string, label: string): HTMLElement {
  if (hasAsset(id)) {
    const img = document.createElement('img')
    img.className = 'ico'; img.src = assetUrl(id); img.alt = ''
    return img
  }
  const s = document.createElement('span')
  s.className = 'ico'; s.setAttribute('aria-hidden', 'true')
  s.textContent = label.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return s
}
