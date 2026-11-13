# Umbral Idle (título de trabalho)

MMO idle 2D no navegador: o caçador entra nas fendas, luta sozinho, sobe de nível e de rank, junta equipamento
e evoca **ecos** dos monstros derrotados para lutar ao seu lado. Universo original (nomes, criaturas e números próprios).

## Rodar

```bash
npm install
npm run build      # compila o cliente
npm start          # servidor em http://localhost:3000
```

Desenvolvimento (dois terminais): `npm run dev:server` e `npm run dev:client` (abre em http://localhost:5173).
Testes: `npm test`. Tipos: `npm run typecheck`.

Variáveis: `PORT` (padrão 3000) e `DB_FILE` (padrão `data/umbral.db`).

## O que já existe (v0.1)

- Conta com usuário e senha (sem e-mail), sessão por token, uma sessão por conta.
- Cidade compartilhada (Vértice): jogadores se veem, andam e conversam; NPCs abrem Fendas, Loja, Forja e Ranking.
- 4 classes, 5 atributos, nível 1–60, ranks E–B com teste de promoção e limite de nível por rank.
- 4 fendas, 12 faixas, 12 monstros e 12 chefes; combate automático simulado no servidor; elites e chefe a cada 40 abates.
- Equipamento em 6 espaços e 5 raridades, mochila, venda, aprimoramento até +10.
- Ecos: evocar (tecla E) de resquícios, time em campo conforme o rank, fusão 3→1 em 5 graus.
- Descanso: sair do jogo durante uma caçada de 3+ minutos rende EXP e ouro por até 8 horas.

## Fora desta versão

Mercado, troca entre jogadores, guildas, PvP, grupos, talentos e habilidades ativas, loja com dinheiro real,
recuperação de senha, moderação do chat e PostgreSQL (hoje é SQLite, adequado para testes e poucos jogadores).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `shared/content.ts` | Todas as regras e números do jogo (classes, monstros, fendas, itens, fórmulas) |
| `shared/assets.ts` | Manifesto de assets: caminho, formato e descrição de cada um |
| `shared/protocol.ts` | Mensagens entre cliente e servidor |
| `server/src` | Contas, banco, cidade e simulação das caçadas (o servidor decide tudo) |
| `client/src` | Cena em Phaser e interface em HTML |
| `docs/prompts-assets` | Um prompt por asset, gerado por `npm run prompts` |

## Assets

O jogo roda sem arte: cada asset ausente vira um marcador desenhado por código. Para usar a sua arte, gere a imagem
com o prompt correspondente em [`docs/prompts-assets`](docs/prompts-assets/README.md) e salve o PNG no caminho
indicado, dentro de `client/public/assets/`. Depois rode `npm run build` (ou reinicie o `npm run dev:client`).
