# Caçador de Fendas — Idle

Idle RPG 2D para navegador: um caçador entra em fendas, enfrenta monstros
automaticamente, derrota guardiões para subir de rank (E → S), forja
equipamentos e comanda um esquadrão de **ecos** — sombras dos monstros que
abateu. O progresso continua com o jogo fechado.

> **Propriedade intelectual.** O projeto pertence ao gênero "caçadores e
> portais", mas é uma obra original: nomes, personagens, monstros, textos e
> direção de arte são próprios. Nenhum prompt de asset pede personagens,
> logotipos ou o visual de obras existentes — mantenha essa regra ao evoluir
> o manifesto.

## Stack

| Camada | Tecnologia |
| --- | --- |
| UI | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Testes | Vitest |
| Persistência | `localStorage` versionado, com saneamento e exportação Base64 |

Sem backend nesta fase. O motor (`src/game`) é TypeScript puro e
determinístico, pronto para ser executado em um servidor autoritativo.

## Comandos

```bash
npm install
npm run dev             # ambiente de desenvolvimento
npm run build           # typecheck + build de produção em dist/
npm run test            # suíte de testes (motor, persistência, manifesto)
npm run assets:prompts  # regenera docs/ASSET_PROMPTS.md a partir do manifesto
npm run assets:check    # valida os PNGs entregues (-- --strict reprova ausentes)
npm run balance:sim     # bot que joga 30h por classe e imprime a progressão
```

## Assets: prompts em vez de arte

Nenhuma imagem é criada pelo código. O fluxo é:

1. `src/assets/manifest.ts` descreve cada asset (id, pasta, dimensões, fundo e
   o *subject* do prompt). É a **única fonte de verdade**.
2. `npm run assets:prompts` gera **[docs/ASSET_PROMPTS.md](docs/ASSET_PROMPTS.md)**
   com 44 prompts autossuficientes, regras globais, fluxo de trabalho e
   checklist de aceite.
3. Você gera as imagens na ferramenta de sua preferência e salva em
   `src/assets/sprites/<pasta>/<id>.png`.
4. `npm run assets:check` acusa arquivo ausente, dimensão incorreta, falta de
   canal alfa e arquivos fora do manifesto.
5. O jogo detecta os arquivos em tempo de build (`import.meta.glob`). O que
   ainda não existe aparece como **placeholder identificado com o id** — o jogo
   é totalmente jogável sem arte.

Decisões que reduzem erro na geração:

- **1 frame estático por asset**; movimento (respiração, dano, queda) é CSS.
  Geradores de imagem não produzem spritesheets consistentes.
- **Ilustração cel-shaded** em vez de pixel art: tolera redimensionamento sem
  quebrar a grade de pixels.
- **Orientação fixa** (caçador → direita, monstro → esquerda): sem espelhamento.
- **Ecos reutilizam o sprite do monstro** com filtro CSS: zero assets extras.
- **Chroma de contingência por asset** (verde ou magenta) escolhido para não
  colidir com as cores do próprio desenho.
- Um teste falha se `docs/ASSET_PROMPTS.md` divergir do manifesto ou se o jogo
  referenciar um asset não catalogado.

## Arquitetura

```
src/
├── game/                 Domínio puro (sem DOM, sem React)
│   ├── types.ts          Tipos do estado e dos eventos do motor
│   ├── rng.ts            PRNG determinístico (estado dentro do save)
│   ├── data/             Catálogos: classes, fendas/monstros, balanceamento
│   ├── engine/
│   │   ├── formulas.ts   Atributos derivados, XP, itens, ecos
│   │   ├── combat.ts     step(state, dt, emit): o único avanço de simulação
│   │   ├── actions.ts    Ações do jogador, todas com validação
│   │   ├── simulate.ts   Progresso offline (mesmo step, com relatório)
│   │   └── state.ts      Criação de novo jogo
│   ├── persistence/save.ts  Serialização, saneamento, backup, export/import
│   └── store.ts          Sessão: relógio → ticks, eventos → UI, autosave
├── assets/               Manifesto, gerador de prompts, resolução de sprites
└── ui/                   Componentes React (somente leitura do estado + ações)
```

Princípios:

- **Um único caminho de simulação.** Tempo real e offline chamam o mesmo
  `step`, em ticks fixos de 100 ms; um teste garante resultado idêntico.
- **Determinismo.** Nenhum `Math.random` no motor; a seed é persistida.
- **Save não confiável.** Todo save passa por `sanitizeState`, que rejeita o
  ilegível (preservando backup) e reimpõe invariantes no restante.
- **Itens derivados.** O save guarda `(slot, tier, raridade, +N)`; os atributos
  são calculados — rebalancear não exige migração.
- **Tempo por relógio, não por timer.** O loop mede o tempo decorrido real,
  então abas em segundo plano e suspensão do computador são compensadas
  (teto de 8 h; relógio retrocedido é ignorado).
- **Uma aba por vez** (Web Locks) para evitar que duas sessões sobrescrevam o
  mesmo save.

## Sistemas de jogo

| Sistema | Resumo |
| --- | --- |
| Classes | Guardião, Lâmina, Arcanista, Atirador e Clérigo — uma passiva cada |
| Progressão | Nível 1–100, 3 pontos de atributo por nível, redistribuição paga em ouro |
| Fendas | 6 fendas (rank E–S), 2 monstros + 1 guardião cada |
| Guardiões | Surgem a cada 25 abates; devem cair em 60 s; liberam a fenda seguinte |
| Equipamento | 3 slots, 5 raridades, tier pela fenda de origem |
| Forja | Até +15, +6% por nível; falha consome ouro, sem rebaixar |
| Ecos | 1 essência por tentativa de vínculo; 3 ativos; fusão de 3 cópias até tier 5 |
| Offline | Até 8 h simuladas com relatório ao retornar |

Todos os números ficam em `src/game/data/balance.ts` e `zones.ts`. Referência
do simulador com o balanceamento atual: rank S em ~7–10 h e nível máximo em
~20–24 h de jogo, para todas as classes.

## Dívidas técnicas e próximos passos

- **Backend autoritativo.** O save local é editável pelo jogador. Ranking,
  troca ou PvP exigem mover `step`/`actions` para o servidor (o motor já é
  isolado para isso) e tratar o cliente apenas como visualização.
- **Migrações de save.** `SAVE_VERSION = 1`; ao alterar o formato, adicionar
  uma cadeia de migrações antes de `sanitizeState` em vez de rejeitar versões
  antigas.
- **Granularidade de render.** A UI re-renderiza por inteiro a 10 Hz. É barato
  hoje; se a tela crescer, introduzir seletores por fatia do estado.
- **Lint e CI.** Ainda sem ESLint e sem pipeline; recomendado rodar
  `build`, `test` e `assets:check` em cada PR.
- **Conteúdo.** Talentos, missões diárias e eventos de fenda são extensões
  naturais sobre o sistema de eventos do motor.
