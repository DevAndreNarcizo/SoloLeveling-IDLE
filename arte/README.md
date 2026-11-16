# Arte gerada

- `cloudflare/<grupo>/<id>.png`: imagens originais devolvidas pelo Cloudflare Workers AI (FLUX), antes de qualquer tratamento.
- `../client/public/assets/fx/<id>.png`: as mesmas, prontas para o jogo (fundo transparente, quadros na horizontal).
- `../shared/fx.json`: tamanho do quadro e número de quadros de cada sprite.

Para gerar de novo ou acrescentar itens: `python tools/ai-assets/cloudflare_gen.py <prefixo>` e depois
`python tools/ai-assets/import_fx.py <prefixo>`. A lista de itens e os prompts ficam em `tools/ai-assets/cloudflare_gen.py`.
O pacote `pacotes/umbral-efeitos.zip` é gerado para download e não vai para o git.
