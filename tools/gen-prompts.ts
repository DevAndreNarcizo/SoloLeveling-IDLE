// Gera um arquivo de prompt por asset em docs/prompts-assets/, a partir de shared/assets.ts.
// Uso: npm run prompts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSETS, type AssetDef, type AssetFormat } from '../shared/assets.ts'
import { GAME_NAME } from '../shared/content.ts'

const OUT = resolve(fileURLToPath(import.meta.url), '../../docs/prompts-assets')

const STYLE = [
  'Professional 16-bit pixel art for a top-down 2D RPG, in the style of classic JRPG overworld art.',
  'Characters and monsters about three heads tall (not super chibi). Detailed shading, muted dark fantasy palette with violet, cyan or amber glowing accents.',
  'Crisp hard-edged pixels, 1-pixel dark outline, no anti-aliasing. No text, no letters, no numbers, no watermark, no UI frame.',
].join(' ')
const TRANSPARENT = 'Fully transparent background (PNG with alpha). No ground shadow, no floor, no backdrop.'

const FORMAT: Record<AssetFormat, { size: string; pt: string; spec: (a: AssetDef) => string; check: string[] }> = {
  sheet: {
    size: '1024x1024', pt: 'Folha de sprites 4×4 (andar em 4 direções), fundo magenta. Depois rode tools/ai-assets/import_sheet.py',
    spec: () => [
      'Professional 16-bit pixel art sprite sheet for a top-down 2D RPG, in the style of classic JRPG overworld sprites.',
      'Proportions about three heads tall (not super chibi), detailed shading, muted dark fantasy palette, crisp hard-edged pixels, 1-pixel dark outline, no anti-aliasing.',
      'Layout: exact grid of 4 columns x 4 rows of equal square cells on a square canvas. Row 1: walking toward the camera. Row 2: walking left. Row 3: walking right. Row 4: walking away from the camera. Each row has 4 walk-cycle frames.',
      'Same character, same size and same colors in every cell, centered, feet near the bottom of the cell, with empty margin around.',
      'Background: plain solid magenta (#FF00FF), no grid lines, no text, no shadows.',
    ].join(' '),
    check: [
      'A imagem é quadrada e tem exatamente 4 colunas × 4 linhas, sem linhas de grade desenhadas.',
      'Linhas na ordem: baixo, esquerda, direita, cima.',
      'O personagem tem o mesmo tamanho em todas as células e não encosta nas bordas da célula.',
      'O fundo é magenta liso (#FF00FF) ou transparente de verdade.',
    ],
  },
  image: {
    size: '1024x1024', pt: 'Imagem única de corpo inteiro, fundo transparente',
    spec: () => `Output: a single full-body subject centered on a square 1024x1024 canvas, standing, front three-quarter view, feet near the bottom edge, occupying about 85% of the canvas height. ${TRANSPARENT}`,
    check: ['Um único personagem ou objeto, de corpo inteiro, sem cortes.', 'O fundo é transparente.', 'Legível em tamanho pequeno (cerca de 96 px de altura).'],
  },
  tile: {
    size: '1024x1024', pt: 'Textura de chão contínua (repetível), opaca',
    spec: () => 'Output: a seamless tileable ground texture seen from directly above, square 1024x1024, fully opaque, edge to edge. The left edge must match the right edge and the top edge must match the bottom edge so it repeats with no visible seam. Low contrast and no large unique landmarks, because characters must stay readable on top of it. No objects, no characters, no shadows of objects.',
    check: ['Lado a lado, a textura repete sem emenda visível.', 'Contraste baixo: os personagens continuam legíveis por cima.', 'Sem objetos grandes nem personagens.'],
  },
  map: {
    size: '1536x1024', pt: 'Mapa inteiro visto de cima (campo de jogo)',
    spec: () => 'Output: one complete top-down 2D game map, orthographic view from directly above (no perspective, no isometric angle), landscape 3:2, fully opaque. Scenery and walls only near the edges, with a large flat open walkable area in the center. No characters, no text.',
    check: ['Visto exatamente de cima, sem perspectiva.', 'Centro livre e plano para os personagens andarem.', 'Sem personagens nem texto.'],
  },
  props: {
    size: '1024x1024', pt: 'Folha 2×2 com quatro objetos de cenário, fundo transparente',
    spec: () => `Output: one sheet, square 1024x1024 canvas, divided into an exact 2 columns x 2 rows grid of equal 512x512 cells, no grid lines. Exactly one prop per cell, centered, top-down 3/4 view, with at least 32 pixels of empty margin on every side of its cell. ${TRANSPARENT}`,
    check: ['Exatamente quatro objetos, um por célula, sem invadir a célula vizinha.', 'O fundo é transparente.'],
  },
  fx: {
    size: '1024x1024', pt: 'Folha 2×2 com quatro quadros de animação, fundo transparente',
    spec: () => `Output: one sheet, square 1024x1024 canvas, divided into an exact 2 columns x 2 rows grid of equal 512x512 cells, no grid lines. Four animation frames of the same effect in reading order (top-left, top-right, bottom-left, bottom-right), each centered in its cell. ${TRANSPARENT}`,
    check: ['Quatro quadros na ordem de leitura.', 'Cada quadro centralizado na sua célula.', 'O fundo é transparente.'],
  },
  icon: {
    size: '1024x1024', pt: 'Ícone único, fundo transparente',
    spec: () => `Output: a single icon centered on a square 1024x1024 canvas, front view, bold simple silhouette that stays readable when scaled down to 48x48 pixels, occupying about 80% of the canvas. ${TRANSPARENT}`,
    check: ['Reduzido a 48×48 px, o ícone continua reconhecível.', 'O fundo é transparente.'],
  },
  wide: {
    size: '1536x1024', pt: 'Ilustração horizontal',
    spec: () => 'Output: a single wide illustration on a 1536x1024 landscape canvas.',
    check: ['Sem letras nem números na imagem.', 'Proporção horizontal 3:2.'],
  },
}

function promptFor(a: AssetDef): string {
  const f = FORMAT[a.format]
  return `${STYLE}\n\nSubject: ${a.subject}.\n\n${f.spec(a)}`
}

function page(a: AssetDef): string {
  const f = FORMAT[a.format]
  return `# ${a.title}

- **Categoria:** ${a.category}
- **Salvar em:** \`client/public/assets/${a.path}\`
- **Formato:** ${f.pt}
- **Tamanho a pedir:** ${f.size}${a.optional ? '\n- **Opcional:** sem este arquivo, o jogo usa o sprite do monstro comum da mesma fenda, ampliado.' : ''}

## Prompt (copie e cole no ChatGPT)

\`\`\`text
${promptFor(a)}
\`\`\`

## Antes de salvar, confira

${f.check.map((c) => `- [ ] ${c}`).join('\n')}
- [ ] O estilo bate com os assets já aprovados (mesma paleta e mesmo contorno).
`
}

rmSync(OUT, { recursive: true, force: true })
const byCat = new Map<string, AssetDef[]>()
for (const a of ASSETS) {
  const file = join(OUT, `${a.id}.md`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page(a))
  byCat.set(a.category, [...(byCat.get(a.category) ?? []), a])
}

const index = `# Prompts de assets — ${GAME_NAME}

${ASSETS.length} assets, um arquivo de prompt para cada. Estes arquivos são gerados por \`npm run prompts\` a partir de
\`shared/assets.ts\`: para mudar um prompt, edite o manifesto e gere de novo.

O jogo funciona sem nenhum asset (usa marcadores desenhados por código). Cada PNG salvo no caminho indicado
passa a ser usado automaticamente na próxima vez que a página carregar.

## Como gerar com consistência no ChatGPT

0. **Já existe uma versão gerada.** Os assets atuais foram feitos por \`tools/ai-assets/fetch.py\` (gerador gratuito
   Pollinations + recorte de fundo local) e \`tools/ai-assets/effects.py\`. Use os prompts abaixo para refazer qualquer
   um em outra ferramenta, com mais qualidade.
1. **Comece pela âncora de estilo.** Gere primeiro \`cacadores/lamina\`. Refaça até gostar: ele define a paleta e o traço.
2. **Use a âncora como referência.** Em cada novo pedido, anexe o PNG aprovado e acrescente no início do prompt:
   \`Match the exact pixel art style, palette and outline of the attached reference image.\`
3. **Peça fundo transparente** (já está em todos os prompts que precisam). Se vier fundo pintado, peça:
   \`Regenerate with a real transparent background (alpha channel).\`
4. **Um asset por conversa de imagem.** Não peça vários arquivos numa mesma imagem, exceto as folhas descritas no prompt.
5. **Confira a grade das folhas.** O jogo divide a imagem em partes iguais (4×4 ou 2×2). Se um quadro sair fora da
   célula, peça a correção ou ajuste num editor de imagem.
6. **Não precisa redimensionar.** O jogo aceita qualquer resolução, desde que a grade seja a pedida.

## Limites conhecidos

- Personagens e monstros são uma imagem única: o jogo anima o andar com balanço e espelhamento. Animação quadro a
  quadro exigiria folhas de sprites consistentes, que geradores de imagem genéricos não entregam bem.
- Os prompts descrevem criaturas e personagens originais deste jogo. Não acrescente nomes de obras, personagens ou
  artistas existentes ao prompt.
- Confira os termos de uso da ferramenta de imagem para uso comercial antes de publicar o jogo.

## Ordem sugerida

1. Caçadores (4) e chão das fendas (6): o jogo já muda de cara.
2. Monstros comuns (12).
3. Ícones de itens, atributos e menu (26).
4. NPCs, objetos, efeitos e interface.
5. Chefes (12, opcionais).

## Lista completa

${[...byCat].map(([cat, items]) => `### ${cat} (${items.length})\n\n| Asset | Arquivo do jogo | Prompt |\n|---|---|---|\n${items.map((a) => `| ${a.title}${a.optional ? ' (opcional)' : ''} | \`${a.path}\` | [${a.id}.md](${a.id}.md) |`).join('\n')}`).join('\n\n')}
`
writeFileSync(join(OUT, 'README.md'), index)
// Manifesto em JSON para o gerador local de imagens (tools/ai-assets/generate.py).
writeFileSync(resolve(OUT, '../../tools/ai-assets/manifest.json'), JSON.stringify(ASSETS.map(({ id, path, format, subject, optional }) => ({ id, path, format, subject, ...(optional ? { optional } : {}) })), null, 1))
console.log(`${ASSETS.length} prompts gerados em docs/prompts-assets/`)
