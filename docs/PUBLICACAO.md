# Publicação do Umbral Idle

O jogo está criado no Render como **umbral-idle** (https://umbral-idle.onrender.com), plano gratuito, região Virgínia (EUA),
publicando a branch `feat/busy-ritchie-ua5f9c` a cada envio. Configuração em `render.yaml`.

## 1. Banco de dados (obrigatório)

Sem banco externo o servidor tenta usar o Postgres embutido, que na primeira subida passa de 512 MB de memória
e é derrubado pelo plano gratuito. Por isso o jogo só sobe com o Supabase ligado:

1. No Supabase, abra o projeto **umbral-idle** → botão **Connect** → aba **Session pooler** e copie a *connection string*
   (começa com `postgresql://postgres.czzikqzgixcdlwqkeobp:`). Troque `[YOUR-PASSWORD]` pela senha do banco.
   Se não lembrar a senha: Project Settings → Database → *Reset database password*.
2. No Render, abra **umbral-idle** → **Environment** → **Add Environment Variable**:
   `DATABASE_URL` = a connection string. Salve: o Render publica de novo sozinho.
3. As tabelas são criadas sozinhas na primeira subida (`server/migrations/`).

Nunca cole essa string no chat nem no código.

## 2. E-mail de recuperação de senha (opcional, recomendado)

1. Crie uma conta em resend.com (o plano grátis basta para começar) e gere uma **API key**.
2. Para enviar de um endereço próprio, verifique um domínio no Resend. Sem domínio, use o remetente de teste que o Resend
   oferece (ele só entrega para o seu próprio e-mail, bom para testar).
3. No Render → Environment: `RESEND_API_KEY` = a chave; `MAIL_FROM` = `Umbral Idle <nao-responda@seudominio.com>`.

Sem isso, o link de troca de senha só aparece no registro (log) do servidor.

## 3. Pagamento dos cristais com Pix (só depois da empresa e da revisão jurídica)

O adaptador do Mercado Pago está pronto (`server/src/payments.ts`) e testado com um provedor simulado. Para ligar:

1. Conta de vendedor no Mercado Pago (PJ, com o CNPJ da empresa) e uma aplicação em *Suas integrações*.
2. Teste primeiro com as **credenciais de teste**: no Render, `MP_ACCESS_TOKEN` = access token de teste e
   `PUBLIC_URL` = `https://umbral-idle.onrender.com` (já configurado). Faça uma compra de teste no jogo.
3. Em *Suas integrações → Webhooks*, cadastre `https://umbral-idle.onrender.com/api/pagamento/mercadopago` para o evento
   **Pagamentos**. O servidor não confia no aviso: consulta o pagamento na API do Mercado Pago antes de creditar.
4. Só então troque para o access token de produção.

O comprador precisa ter e-mail cadastrado (exigência do Mercado Pago para Pix). Preços em `shared/content.ts` (`CRYSTAL_PACKS`).

## Limites do plano gratuito do Render

- O serviço **dorme após 15 minutos sem visitas** e leva cerca de 1 minuto para acordar. Enquanto dorme, ninguém caça
  (o estado do jogo fica na memória do servidor; o descanso offline continua valendo).
- 512 MB de memória e CPU compartilhada: suficiente para testes com poucas pessoas.
- Para jogar de verdade com outras pessoas, o plano pago mais simples do Render mantém o servidor sempre ligado
  (confira o preço atual em render.com/pricing antes de assinar).
