import { ASSETS, AVOID_LINE, CATEGORY_RULES, STYLE_BIBLE, buildPrompt } from './manifest';
import type { AssetCategory } from './manifest';

const SECTION_ORDER: readonly { category: AssetCategory; heading: string; note: string }[] = [
  {
    category: 'hunter',
    heading: 'Caçadores (classes jogáveis)',
    note: 'Sempre voltados para a DIREITA. Gere `hunter_guardian` primeiro e use-o como referência de estilo para todos os demais assets.',
  },
  {
    category: 'monster',
    heading: 'Monstros',
    note: 'Sempre voltados para a ESQUERDA (encaram o caçador). Os ecos reutilizam estes mesmos sprites com filtro aplicado em runtime — não é necessário gerar versões "sombra".',
  },
  {
    category: 'boss',
    heading: 'Guardiões (chefes)',
    note: 'Voltados para a ESQUERDA, canvas maior (384x384) para parecerem imponentes ao lado do caçador.',
  },
  {
    category: 'background',
    heading: 'Cenários',
    note: 'Opacos, 16:9. O terço inferior precisa de um chão plano e livre: é onde os sprites são posicionados.',
  },
  {
    category: 'item',
    heading: 'Itens (ícones de inventário)',
    note: 'A raridade e o aprimoramento são indicados pela moldura/etiqueta da UI; o ícone em si é único por tipo.',
  },
  { category: 'icon', heading: 'Ícones de interface', note: 'Precisam permanecer legíveis a 24px.' },
  { category: 'ui', heading: 'Identidade', note: 'Sem qualquer texto: o nome do jogo é renderizado pela UI.' },
];

/**
 * Gera o conteúdo de docs/ASSET_PROMPTS.md a partir do manifesto. Função
 * pura e determinística: um teste garante que o arquivo versionado está
 * sempre sincronizado com o manifesto.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildPromptDocument(): string {
  const lines: string[] = [];
  const push = (...chunk: string[]) => lines.push(...chunk);

  push(
    '# Prompts de geração de assets — Caçador de Fendas',
    '',
    '> Arquivo GERADO a partir de `src/assets/manifest.ts`. Não edite manualmente:',
    '> altere o manifesto e rode `npm run assets:prompts`.',
    '',
    `Total de assets: **${ASSETS.length}**. O jogo funciona sem nenhum deles (usa placeholders) e passa a exibir cada arquivo automaticamente assim que ele é colocado no caminho indicado.`,
    '',
    '## 1. Regras globais (valem para todos os prompts)',
    '',
    '| Regra | Valor |',
    '| --- | --- |',
    '| Formato final | PNG (sRGB, 8 bits por canal) |',
    '| Nome do arquivo | exatamente o `id` do asset + `.png`, em minúsculas |',
    '| Pasta de destino | `src/assets/sprites/<pasta da categoria>/` |',
    '| Orientação | caçadores olham para a **direita**; monstros e guardiões para a **esquerda** |',
    '| Texto na imagem | proibido em qualquer asset |',
    '| Animação | não gerar spritesheets: 1 frame estático por asset (o movimento é feito por CSS) |',
    '',
    'Dimensões por categoria:',
    '',
    '| Categoria | Pasta | Geração recomendada | Tamanho final | Fundo |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const section of SECTION_ORDER) {
    const rule = CATEGORY_RULES[section.category];
    push(
      `| ${section.heading} | \`${rule.folder}/\` | ${rule.generation} | ${rule.width}x${rule.height} | ${rule.transparent ? 'transparente' : 'opaco'} |`,
    );
  }

  push(
    '',
    '### Direção de arte (já embutida em cada prompt)',
    '',
    '```text',
    STYLE_BIBLE,
    '```',
    '',
    '### Restrições (já embutidas em cada prompt)',
    '',
    'Se a ferramenta tiver campo separado de *negative prompt*, mova esta linha para lá (sem o prefixo "Avoid:").',
    '',
    '```text',
    AVOID_LINE,
    '```',
    '',
    '## 2. Fluxo de trabalho para não errar',
    '',
    '1. **Âncora de estilo:** gere `hunter_guardian` até ficar satisfeito. Ele define traço, paleta e proporção.',
    '2. **Referência em todos os demais:** anexe a âncora como imagem de referência de estilo em cada geração seguinte (ex.: "use the attached image only as art style reference"). É o que mais reduz inconsistência entre assets.',
    '3. **Um asset por geração.** Copie o bloco de prompt inteiro, sem editar; cada bloco é autossuficiente.',
    '4. **Confira antes de aceitar** (checklist da seção 3). Se falhar em qualquer item, gere novamente em vez de corrigir à mão.',
    '5. **Pós-processamento:**',
    '   - se o fundo veio em cor sólida (chroma), remova-o; a cor de chroma indicada em cada asset foi escolhida para não colidir com as cores do próprio desenho;',
    '   - recorte as sobras e centralize o desenho mantendo uma margem de ~5%; personagens e monstros devem encostar os pés próximo à borda inferior;',
    '   - redimensione para o **tamanho final exato** da tabela (interpolação bicúbica/Lanczos) — não distorça: preencha com transparência se a proporção diferir;',
    '   - exporte como PNG com o nome e a pasta indicados.',
    '6. **Valide:** rode `npm run assets:check`. O script acusa arquivo ausente, dimensão errada, falta de canal alfa e arquivos fora do manifesto.',
    '',
    '## 3. Checklist de aceite por imagem',
    '',
    '- [ ] Um único sujeito, inteiro, sem partes cortadas.',
    '- [ ] Orientação correta (caçador → direita, monstro/guardião → esquerda).',
    '- [ ] Sem texto, marca d\'água, moldura ou elementos de UI.',
    '- [ ] Sem sombra projetada no chão (sprites) e sem personagens (cenários).',
    '- [ ] Contorno escuro e paleta coerentes com a âncora de estilo.',
    '- [ ] Legível quando reduzido ao tamanho final.',
    '- [ ] Design original: nada que reproduza personagens, logotipos ou obras existentes.',
    '',
    '## 4. Índice',
    '',
    '| # | ID | Descrição | Arquivo final | Tamanho |',
    '| --- | --- | --- | --- | --- |',
  );
  ASSETS.forEach((asset, index) => {
    push(
      `| ${index + 1} | \`${asset.id}\` | ${asset.title} | \`src/assets/sprites/${asset.file}\` | ${asset.width}x${asset.height} |`,
    );
  });

  push('', '## 5. Prompts');
  for (const section of SECTION_ORDER) {
    const assets = ASSETS.filter((asset) => asset.category === section.category);
    if (assets.length === 0) continue;
    const rule = CATEGORY_RULES[section.category];
    push('', `### ${section.heading}`, '', section.note);
    for (const asset of assets) {
      push(
        '',
        `#### \`${asset.id}\` — ${asset.title}`,
        '',
        `- **Arquivo final:** \`src/assets/sprites/${asset.file}\``,
        `- **Tamanho final:** ${asset.width}x${asset.height} px — **Geração:** ${rule.generation}`,
        asset.transparent
          ? `- **Fundo:** transparente (chroma de contingência: \`${asset.chroma}\`)`
          : '- **Fundo:** opaco, ocupa todo o quadro',
        '',
        '```text',
        buildPrompt(asset),
        '```',
      );
    }
  }
  push('');
  return lines.join('\n');
}
