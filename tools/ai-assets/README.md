# Geração dos assets

Três scripts produzem tudo o que está em `client/public/assets/`:

| Script | O que gera | Como |
|---|---|---|
| `fetch.py` | Caçadores, NPCs, monstros, chefes, ícones, objetos de cenário, portal, logo e fundo de entrada | Gerador de imagens gratuito (Pollinations) desenha em estilo chibi; o recorte de fundo é local (rembg); o script converte para pixel art (grade final, paleta limitada, contorno escuro) |
| `maps.py` | Os 6 mapas (cidade, 4 fendas e arena) | Terreno em pixel art gerado por código, com os objetos de cenário nas bordas |
| `effects.py` | Golpe, evocação, subir de nível, projétil e flecha | Desenho por código, pixelado |

```bash
python -m venv .venv && .venv/bin/pip install "rembg[cpu]" pillow numpy
npm run prompts                                   # atualiza tools/ai-assets/manifest.json
.venv/bin/python tools/ai-assets/fetch.py --all --skip-existing
.venv/bin/python tools/ai-assets/maps.py          # depois do fetch: usa os objetos de cenário
.venv/bin/python tools/ai-assets/effects.py
```

Para refazer um sprite: apague o PNG e rode `fetch.py <id>` (ex.: `monstros/lobo-de-nevoa`), ou passe outro
`--seed` para obter outra variação. As descrições ficam em `shared/assets.ts`. Para mudar um mapa, edite a
função dele em `maps.py` (cores, trilhas, manchas, quantidade de objetos).

Tamanhos: sprites comuns têm 52 px de altura e chefes 84 px; o jogo amplia 2x. Mapas têm metade do tamanho do
mundo e também são ampliados 2x.

Pontos de atenção:

- O gerador é um serviço de terceiros, gratuito e sem chave: pode sair do ar, limitar o uso ou mudar de modelo.
- Confira os termos de uso do serviço antes de uso comercial dos resultados.
- Personagens e monstros são imagens únicas, vistas de frente; o jogo anima o andar com balanço e espelhamento.
  Animação quadro a quadro em 4 direções pede uma ferramenta própria de sprites ou um artista.
