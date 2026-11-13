# Prompts de assets — Umbral Idle

79 assets, um arquivo de prompt para cada. Estes arquivos são gerados por `npm run prompts` a partir de
`shared/assets.ts`: para mudar um prompt, edite o manifesto e gere de novo.

O jogo funciona sem nenhum asset (usa marcadores desenhados por código). Cada PNG salvo no caminho indicado
passa a ser usado automaticamente na próxima vez que a página carregar.

## Como gerar com consistência no ChatGPT

0. **Já existe uma versão gerada.** Os assets atuais foram feitos por `tools/ai-assets/fetch.py` (gerador gratuito
   Pollinations + recorte de fundo local) e `tools/ai-assets/effects.py`. Use os prompts abaixo para refazer qualquer
   um em outra ferramenta, com mais qualidade.
1. **Comece pela âncora de estilo.** Gere primeiro `cacadores/lamina`. Refaça até gostar: ele define a paleta e o traço.
2. **Use a âncora como referência.** Em cada novo pedido, anexe o PNG aprovado e acrescente no início do prompt:
   `Match the exact pixel art style, palette and outline of the attached reference image.`
3. **Peça fundo transparente** (já está em todos os prompts que precisam). Se vier fundo pintado, peça:
   `Regenerate with a real transparent background (alpha channel).`
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

### Caçadores (classes) (4)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Caçador Lâmina | `cacadores/lamina.png` | [cacadores/lamina.md](cacadores/lamina.md) |
| Caçador Vulto | `cacadores/vulto.png` | [cacadores/vulto.md](cacadores/vulto.md) |
| Caçador Arcanista | `cacadores/arcanista.png` | [cacadores/arcanista.md](cacadores/arcanista.md) |
| Caçador Atirador | `cacadores/atirador.png` | [cacadores/atirador.md](cacadores/atirador.md) |

### NPCs da cidade (4)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Ísis, Guardiã das Fendas | `npcs/guardia-das-fendas.png` | [npcs/guardia-das-fendas.md](npcs/guardia-das-fendas.md) |
| Tobias, o Mercador | `npcs/mercador.png` | [npcs/mercador.md](npcs/mercador.md) |
| Dária, a Ferreira | `npcs/ferreira.png` | [npcs/ferreira.md](npcs/ferreira.md) |
| Noé, o Arquivista | `npcs/arquivista.png` | [npcs/arquivista.md](npcs/arquivista.md) |

### Monstros comuns (12)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Larva de Ferrugem | `monstros/larva-de-ferrugem.png` | [monstros/larva-de-ferrugem.md](monstros/larva-de-ferrugem.md) |
| Morcego de Cinza | `monstros/morcego-de-cinza.png` | [monstros/morcego-de-cinza.md](monstros/morcego-de-cinza.md) |
| Catador Oco | `monstros/catador-oco.png` | [monstros/catador-oco.md](monstros/catador-oco.md) |
| Lobo de Névoa | `monstros/lobo-de-nevoa.png` | [monstros/lobo-de-nevoa.md](monstros/lobo-de-nevoa.md) |
| Espinheiro Vivo | `monstros/espinheiro-vivo.png` | [monstros/espinheiro-vivo.md](monstros/espinheiro-vivo.md) |
| Cervo Espectral | `monstros/cervo-espectral.png` | [monstros/cervo-espectral.md](monstros/cervo-espectral.md) |
| Sentinela Afogada | `monstros/sentinela-afogada.png` | [monstros/sentinela-afogada.md](monstros/sentinela-afogada.md) |
| Sacerdote do Lodo | `monstros/sacerdote-do-lodo.png` | [monstros/sacerdote-do-lodo.md](monstros/sacerdote-do-lodo.md) |
| Armadura Vazia | `monstros/armadura-vazia.png` | [monstros/armadura-vazia.md](monstros/armadura-vazia.md) |
| Brasa Errante | `monstros/brasa-errante.png` | [monstros/brasa-errante.md](monstros/brasa-errante.md) |
| Golem de Escória | `monstros/golem-de-escoria.png` | [monstros/golem-de-escoria.md](monstros/golem-de-escoria.md) |
| Serpe de Cinza | `monstros/serpe-de-cinza.png` | [monstros/serpe-de-cinza.md](monstros/serpe-de-cinza.md) |

### Chefes (opcionais) (12)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Larva-Mãe (opcional) | `monstros/larva-mae.png` | [monstros/larva-mae.md](monstros/larva-mae.md) |
| Asa Anciã (opcional) | `monstros/asa-ancia.png` | [monstros/asa-ancia.md](monstros/asa-ancia.md) |
| Capataz Oco (opcional) | `monstros/capataz-oco.png` | [monstros/capataz-oco.md](monstros/capataz-oco.md) |
| Alfa da Névoa (opcional) | `monstros/alfa-da-nevoa.png` | [monstros/alfa-da-nevoa.md](monstros/alfa-da-nevoa.md) |
| Raiz Anciã (opcional) | `monstros/raiz-ancia.png` | [monstros/raiz-ancia.md](monstros/raiz-ancia.md) |
| Rei Galhado (opcional) | `monstros/rei-galhado.png` | [monstros/rei-galhado.md](monstros/rei-galhado.md) |
| Capitão das Marés (opcional) | `monstros/capitao-das-mares.png` | [monstros/capitao-das-mares.md](monstros/capitao-das-mares.md) |
| Hierofante do Lodo (opcional) | `monstros/hierofante-do-lodo.png` | [monstros/hierofante-do-lodo.md](monstros/hierofante-do-lodo.md) |
| Guardião do Selo (opcional) | `monstros/guardiao-do-selo.png` | [monstros/guardiao-do-selo.md](monstros/guardiao-do-selo.md) |
| Coração de Fornalha (opcional) | `monstros/coracao-de-fornalha.png` | [monstros/coracao-de-fornalha.md](monstros/coracao-de-fornalha.md) |
| Colosso de Escória (opcional) | `monstros/colosso-de-escoria.png` | [monstros/colosso-de-escoria.md](monstros/colosso-de-escoria.md) |
| Serpe Matriarca (opcional) | `monstros/serpe-matriarca.png` | [monstros/serpe-matriarca.md](monstros/serpe-matriarca.md) |

### Mapas: chão (textura contínua) (6)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Chão da cidade | `mapas/cidade-chao.png` | [mapas/cidade-chao.md](mapas/cidade-chao.md) |
| Chão das Minas Ocas | `mapas/minas-ocas-chao.png` | [mapas/minas-ocas-chao.md](mapas/minas-ocas-chao.md) |
| Chão do Bosque Cinzento | `mapas/bosque-cinzento-chao.png` | [mapas/bosque-cinzento-chao.md](mapas/bosque-cinzento-chao.md) |
| Chão da Cidadela Afundada | `mapas/cidadela-afundada-chao.png` | [mapas/cidadela-afundada-chao.md](mapas/cidadela-afundada-chao.md) |
| Chão da Forja Extinta | `mapas/forja-extinta-chao.png` | [mapas/forja-extinta-chao.md](mapas/forja-extinta-chao.md) |
| Chão da arena de promoção | `mapas/arena-chao.png` | [mapas/arena-chao.md](mapas/arena-chao.md) |

### Mapas: objetos de cenário (5)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Objetos da cidade | `mapas/cidade-objetos.png` | [mapas/cidade-objetos.md](mapas/cidade-objetos.md) |
| Objetos das Minas Ocas | `mapas/minas-ocas-objetos.png` | [mapas/minas-ocas-objetos.md](mapas/minas-ocas-objetos.md) |
| Objetos do Bosque Cinzento | `mapas/bosque-cinzento-objetos.png` | [mapas/bosque-cinzento-objetos.md](mapas/bosque-cinzento-objetos.md) |
| Objetos da Cidadela Afundada | `mapas/cidadela-afundada-objetos.png` | [mapas/cidadela-afundada-objetos.md](mapas/cidadela-afundada-objetos.md) |
| Objetos da Forja Extinta | `mapas/forja-extinta-objetos.png` | [mapas/forja-extinta-objetos.md](mapas/forja-extinta-objetos.md) |

### Objetos do mundo (2)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Fenda (portal) | `objetos/fenda.png` | [objetos/fenda.md](objetos/fenda.md) |
| Resquício (corpo para evocar) | `objetos/resquicio.png` | [objetos/resquicio.md](objetos/resquicio.md) |

### Efeitos (5)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Golpe corpo a corpo | `efeitos/golpe.png` | [efeitos/golpe.md](efeitos/golpe.md) |
| Evocação de eco | `efeitos/evocacao.png` | [efeitos/evocacao.md](efeitos/evocacao.md) |
| Subir de nível | `efeitos/subir-nivel.png` | [efeitos/subir-nivel.md](efeitos/subir-nivel.md) |
| Projétil arcano | `efeitos/projetil-arcano.png` | [efeitos/projetil-arcano.md](efeitos/projetil-arcano.md) |
| Flecha | `efeitos/flecha.png` | [efeitos/flecha.md](efeitos/flecha.md) |

### Ícones de itens (13)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Espada (Lâmina) | `icones/itens/arma-lamina.png` | [icones/itens/arma-lamina.md](icones/itens/arma-lamina.md) |
| Adagas (Vulto) | `icones/itens/arma-vulto.png` | [icones/itens/arma-vulto.md](icones/itens/arma-vulto.md) |
| Cajado (Arcanista) | `icones/itens/arma-arcanista.png` | [icones/itens/arma-arcanista.md](icones/itens/arma-arcanista.md) |
| Arco (Atirador) | `icones/itens/arma-atirador.png` | [icones/itens/arma-atirador.md](icones/itens/arma-atirador.md) |
| Elmo | `icones/itens/elmo.png` | [icones/itens/elmo.md](icones/itens/elmo.md) |
| Armadura | `icones/itens/armadura.png` | [icones/itens/armadura.md](icones/itens/armadura.md) |
| Luvas | `icones/itens/luvas.png` | [icones/itens/luvas.md](icones/itens/luvas.md) |
| Botas | `icones/itens/botas.png` | [icones/itens/botas.md](icones/itens/botas.md) |
| Anel | `icones/itens/anel.png` | [icones/itens/anel.md](icones/itens/anel.md) |
| Poção de Vida | `icones/itens/pocao.png` | [icones/itens/pocao.md](icones/itens/pocao.md) |
| Fragmento de Eco | `icones/itens/fragmento.png` | [icones/itens/fragmento.md](icones/itens/fragmento.md) |
| Lasca de Fenda | `icones/itens/lasca.png` | [icones/itens/lasca.md](icones/itens/lasca.md) |
| Ouro | `icones/itens/ouro.png` | [icones/itens/ouro.md](icones/itens/ouro.md) |

### Ícones de atributos (5)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Força | `icones/atributos/for.png` | [icones/atributos/for.md](icones/atributos/for.md) |
| Agilidade | `icones/atributos/agi.png` | [icones/atributos/agi.md](icones/atributos/agi.md) |
| Vitalidade | `icones/atributos/vit.png` | [icones/atributos/vit.md](icones/atributos/vit.md) |
| Intelecto | `icones/atributos/int.png` | [icones/atributos/int.md](icones/atributos/int.md) |
| Percepção | `icones/atributos/per.png` | [icones/atributos/per.md](icones/atributos/per.md) |

### Emblemas de classe (4)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Emblema Lâmina | `icones/classes/lamina.png` | [icones/classes/lamina.md](icones/classes/lamina.md) |
| Emblema Vulto | `icones/classes/vulto.png` | [icones/classes/vulto.md](icones/classes/vulto.md) |
| Emblema Arcanista | `icones/classes/arcanista.png` | [icones/classes/arcanista.md](icones/classes/arcanista.md) |
| Emblema Atirador | `icones/classes/atirador.png` | [icones/classes/atirador.md](icones/classes/atirador.md) |

### Ícones do menu (4)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Status | `icones/menu/status.png` | [icones/menu/status.md](icones/menu/status.md) |
| Mochila | `icones/menu/mochila.png` | [icones/menu/mochila.md](icones/menu/mochila.md) |
| Ecos | `icones/menu/ecos.png` | [icones/menu/ecos.md](icones/menu/ecos.md) |
| Fendas | `icones/menu/fendas.png` | [icones/menu/fendas.md](icones/menu/fendas.md) |

### Interface (3)

| Asset | Arquivo do jogo | Prompt |
|---|---|---|
| Logotipo do jogo | `ui/logo.png` | [ui/logo.md](ui/logo.md) |
| Fundo da tela de entrada | `ui/fundo-login.png` | [ui/fundo-login.md](ui/fundo-login.md) |
| Favicon | `ui/favicon.png` | [ui/favicon.md](ui/favicon.md) |
