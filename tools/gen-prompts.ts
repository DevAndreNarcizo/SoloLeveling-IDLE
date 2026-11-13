// Gera um arquivo de prompt por asset em docs/prompts-assets/, a partir de shared/assets.ts.
// Uso: npm run prompts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSETS, type AssetDef, type AssetFormat } from '../shared/assets.ts'
import { GAME_NAME } from '../shared/content.ts'

const OUT = resolve(fileURLToPath(import.meta.url), '../../docs/prompts-assets')

const STYLE = [
  '2D pixel art game asset in 16-bit JRPG style.',
  'Crisp hard-edged pixels, visible pixel grid, no anti-aliasing, no blur, no smooth gradients, no photorealism, no 3D render.',
  'Limited palette of about 24 colors: near-black, charcoal, deep violet and indigo as base, with small cyan, violet or amber glowing accents.',
  'Dark modern-fantasy mood. 1-pixel dark outline around every shape. Light source from the top-left.',
  'No text, no letters, no numbers, no watermark, no signature, no UI frame.',
].join(' ')
const TRANSPARENT = 'Fully transparent background (PNG with alpha). No ground shadow, no floor, no backdrop.'

const FORMAT: Record<AssetFormat, { size: string; pt: string; spec: (a: AssetDef) => string; check: string[] }> = {
  sheet: {
    size: '1024x1024', pt: 'Folha de sprites 4×4 (andar em 4 direções), fundo transparente',
    spec: () => [
      'Output: one sprite sheet, square 1024x1024 canvas, divided into an exact 4 columns x 4 rows grid of equal 256x256 cells, no gaps, no grid lines, no borders.',
      'Top-down 3/4 view (classic RPG overworld camera). The same character in every cell, same size, same proportions, same colors, centered in its cell with its feet near the bottom of the cell and at least 16 pixels of empty margin on every side.',
      'Row 1: walking toward the camera (facing down). Row 2: walking left. Row 3: walking right. Row 4: walking away from the camera (facing up).',
      'Each row has 4 walk-cycle frames from left to right: contact, passing, contact with the other leg, passing.',
      TRANSPARENT,
    ].join(' '),
    check: [
      'A imagem é quadrada e tem exatamente 4 colunas × 4 linhas, sem linhas de grade desenhadas.',
      'Linhas na ordem: baixo, esquerda, direita, cima.',
      'O personagem tem o mesmo tamanho em todas as células e não encosta nas bordas da célula.',
      'O fundo é transparente (não é xadrez pintado nem branco).',
    ],
  },
  image: {
    size: '1024x1024', pt: 'Sprite único, fundo transparente',
    spec: () => `Output: a single sprite centered on a square 1024x1024 canvas, top-down 3/4 view (classic RPG overworld camera), occupying about 70% of the canvas. ${TRANSPARENT}`,
    check: ['Um único objeto centralizado.', 'O fundo é transparente.'],
  },
  tile: {
    size: '1024x1024', pt: 'Textura de chão contínua (repetível), opaca',
    spec: () => 'Output: a seamless tileable ground texture seen from directly above, square 1024x1024, fully opaque, edge to edge. The left edge must match the right edge and the top edge must match the bottom edge so it repeats with no visible seam. Low contrast and no large unique landmarks, because characters must stay readable on top of it. No objects, no characters, no shadows of objects.',
    check: ['Lado a lado, a textura repete sem emenda visível.', 'Contraste baixo: os personagens continuam legíveis por cima.', 'Sem objetos grandes nem personagens.'],
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

1. **Comece pela âncora de estilo.** Gere primeiro \`cacadores/lamina\`. Refaça até gostar: ele define a paleta e o traço.
2. **Use a âncora como referência.** Em cada novo pedido, anexe o PNG aprovado e acrescente no início do prompt:
   \`Match the exact pixel art style, palette and outline of the attached reference image.\`
3. **Peça fundo transparente** (já está em todos os prompts que precisam). Se vier fundo pintado, peça:
   \`Regenerate with a real transparent background (alpha channel).\`
4. **Um asset por conversa de imagem.** Não peça vários arquivos numa mesma imagem, exceto as folhas descritas no prompt.
5. **Confira a grade das folhas.** O jogo divide a imagem em partes iguais (4×4 ou 2×2). Se um quadro sair fora da
   célula, peça a correção ou ajuste num editor de pixel art (Aseprite, LibreSprite, Piskel).
6. **Não precisa redimensionar.** O jogo aceita qualquer resolução, desde que a grade seja a pedida.

## Limites conhecidos

- Geradores de imagem nem sempre entregam grade exata nem pixel art "de verdade" (pixels alinhados). Para sprites
  animados, espere retoques manuais. Os prompts reduzem o problema, mas não o eliminam.
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
writeFileSync(resolve(OUT, '../../tools/ai-assets/manifest.json'), JSON.stringify(ASSETS.map(({ id, path, format, subject }) => ({ id, path, format, subject })), null, 1))
console.log(`${ASSETS.length} prompts gerados em docs/prompts-assets/`)
