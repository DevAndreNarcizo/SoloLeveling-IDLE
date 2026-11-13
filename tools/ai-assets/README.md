# Geração dos assets

Três scripts produzem tudo o que está em `client/public/assets/`:

| Script | O que gera | Como |
|---|---|---|
| `fetch.py` | Caçadores, NPCs, monstros, chefes, ícones, objetos de cenário, portal, logo e fundo de entrada | Gerador de imagens gratuito (Pollinations, modelo Sana) + recorte de fundo local (rembg) |
| `tiles.py` | Os 6 chãos repetíveis | Ruído contínuo por código (sem emenda) |
| `effects.py` | Golpe, evocação, subir de nível, projétil e flecha | Desenho por código com brilho |

```bash
python -m venv .venv && .venv/bin/pip install "rembg[cpu]" pillow numpy
npm run prompts                                   # atualiza tools/ai-assets/manifest.json
.venv/bin/python tools/ai-assets/fetch.py --all --skip-existing
.venv/bin/python tools/ai-assets/tiles.py
.venv/bin/python tools/ai-assets/effects.py
```

Para refazer um asset: apague o PNG e rode `fetch.py <id>` (ex.: `monstros/lobo-de-nevoa`), ou troque `--seed`
para obter outra variação. As descrições ficam em `shared/assets.ts`.

Pontos de atenção:

- O gerador é um serviço de terceiros, gratuito e sem chave: pode sair do ar, limitar o uso ou mudar de modelo.
- Confira os termos de uso do serviço antes de uso comercial dos resultados.
- Personagens e monstros são imagens únicas; o jogo anima o andar com balanço e espelhamento.
