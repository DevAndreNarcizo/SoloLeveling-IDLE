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

## Configuração (variáveis de ambiente)

| Variável | Para quê | Sem ela |
|---|---|---|
| `DATABASE_URL` | PostgreSQL de produção (Supabase: Project Settings → Database → Connection string, modo *Session pooler*) | Postgres embutido (PGlite) em `data/pg` |
| `DATABASE_CA` | Caminho do certificado `.crt` do Supabase, para verificar o servidor do banco | Conexão cifrada, mas sem verificar o certificado |
| `PORT` | Porta HTTP | 3000 |
| `PUBLIC_URL` | Endereço público do jogo, usado no link de troca de senha | Usa o host da requisição |
| `RESEND_API_KEY`, `MAIL_FROM` | Envio do e-mail de troca de senha pelo Resend | O link só aparece no console do servidor |
| `PAYMENTS=dev` | Simula compras de cristais aprovadas na hora (só para desenvolver) | Compras desabilitadas |

O esquema do banco está em `server/migrations/` e é aplicado sozinho quando o servidor sobe.
Para dar papel de moderador ou administrador: `update accounts set role = 'mod' where username_lower = '...'` (ou `'admin'`).

## O que existe

- **Conta:** usuário e senha, e-mail opcional, recuperação de senha por link, uma sessão por conta.
- **Cidade compartilhada (Vértice):** jogadores se veem, andam e conversam; NPCs abrem Fendas, Loja, Forja e Ranking.
- **Progressão:** 4 classes, 5 atributos, nível 1–60, ranks E–B com teste de promoção, 12 talentos em 3 sendas,
  3 habilidades ativas por classe (uso automático).
- **Fendas:** 4 fendas, 12 faixas, 12 monstros e 12 chefes; combate simulado no servidor; se o caçador cai, volta em segundos.
- **Grupo:** até 4 caçadores na mesma fenda, com EXP e ouro divididos.
- **Arena (PvP):** duelo 1×1 automático com pontuação e ranking.
- **Equipamento:** 6 espaços, 5 raridades, forja até +10, loja de consumíveis.
- **Ecos:** evocar, pôr em campo conforme o rank, fundir 3→1 em 5 graus.
- **Economia entre jogadores:** mercado com taxa de 5% e troca direta com dupla confirmação.
- **Guildas:** cargos, doações, nível com bônus de EXP, mural e chat próprio.
- **Chat:** canais geral, guilda, grupo e sussurro; filtro de ofensas e links, anti-repetição, denúncia e
  comandos de moderação (`/mute`, `/unmute`, `/kick`, `/ban`).
- **Cristais:** moeda premium só de conveniência, com pedidos e extrato; ver pendências abaixo.
- **Descanso:** sair do jogo durante uma caçada solo de 3+ minutos rende EXP e ouro por até 8 horas.

## Pendências antes de abrir ao público

- **Pagamento real:** o fluxo de pedido, confirmação idempotente e extrato está pronto e testado com um provedor
  simulado. Falta o adaptador de um provedor real (Pix ou cartão), que depende de credenciais e de empresa formalizada.
  Preços dos pacotes em `shared/content.ts` são provisórios.
- **E-mail:** configurar `RESEND_API_KEY`/`MAIL_FROM` (ou trocar o provedor em `server/src/mail.ts`).
- **Jurídico e LGPD:** termos de uso, política de privacidade, regras para menores e para compras; validar com advogado.
  O chat é registrado por 30 dias para apurar denúncias (sussurros não são registrados).
- **Escala:** um único processo guarda o estado do jogo em memória; para muitos jogadores simultâneos será preciso
  dividir em mais processos.
- **Arte:** personagens e monstros são imagens únicas animadas pelo motor; ver `tools/ai-assets/README.md`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `shared/content.ts` | Todas as regras e números do jogo |
| `shared/assets.ts` | Manifesto de assets: caminho, formato e descrição de cada um |
| `shared/protocol.ts` | Mensagens entre cliente e servidor |
| `server/src` | Contas, banco, mundo, simulação, moderação, e-mail e pagamentos (o servidor decide tudo) |
| `server/migrations` | Esquema do PostgreSQL |
| `client/src` | Cena em Phaser e interface em HTML |
| `tools/ai-assets` | Scripts que geram os assets |
| `docs/prompts-assets` | Um prompt por asset, para refazer em outra ferramenta |
