# Deploy — Vercel

Este guia cobre o deploy da StockFlow B2B na Vercel. Os passos que dependem
da sua conta (criar o projeto, o Postgres, o Blob Store) precisam ser feitos
por você no painel da Vercel — nenhuma ferramenta usada para construir este
projeto tem acesso à sua conta Vercel.

## 1. Banco de dados (PostgreSQL)

A Vercel não fornece Postgres nativamente — use um provedor do
[Marketplace da Vercel](https://vercel.com/marketplace) (Neon é o mais
simples de configurar) ou qualquer Postgres gerenciado (Supabase, RDS...).

Provedores com pooling embutido (Neon, Supabase) normalmente fornecem duas
strings de conexão:

- Uma **pooled** (via PgBouncer) — vai em `DATABASE_URL`.
- Uma **direta** (sem pool) — vai em `DIRECT_URL`, usada só por
  `prisma migrate`.

Se o seu provedor não distinguir as duas, use a mesma string em ambas.

## 2. Object storage (uploads de produto)

Imagens e documentos de produto usam [Vercel Blob](https://vercel.com/docs/storage/vercel-blob):

1. No painel do projeto na Vercel: **Storage → Create → Blob**.
2. A Vercel injeta `BLOB_READ_WRITE_TOKEN` automaticamente nas variáveis de
   ambiente do projeto depois que o Blob Store é conectado — não precisa
   copiar manualmente.
3. Sem esse token configurado, o app usa disco local como fallback (só
   funciona em desenvolvimento — funções serverless da Vercel não
   compartilham nem persistem sistema de arquivos entre invocações. Ver
   `src/server/uploads/storage.ts`).

## 3. Variáveis de ambiente

Configure em **Project Settings → Environment Variables** na Vercel:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | String de conexão Postgres (pooled). |
| `DIRECT_URL` | Sim | String de conexão Postgres direta (sem pool), para migrations. |
| `APP_SECRET` | Sim | Segredo longo e aleatório (`openssl rand -base64 48`). Usado para derivar a chave de criptografia dos segredos MFA — nunca reutilize o valor de exemplo do repositório. |
| `APP_URL` | Sim | URL pública de produção (ex.: `https://seu-dominio.com`) — usada em links de redefinição de senha. |
| `BLOB_READ_WRITE_TOKEN` | Sim (produção) | Injetada automaticamente ao conectar um Blob Store (passo 2). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Não | Credenciais do Super Admin criado pelo seed. Se não definidas, usa os valores padrão do `prisma/seed.ts` — troque a senha assim que logar pela primeira vez em produção. |
| `SEED_COMERCIAL_EMAIL` / `SEED_COMERCIAL_PASSWORD` | Não | Mesma ideia, para o segundo administrador demo (aprovação em duas pessoas, §12/§26). |

Nunca commite `.env` com valores reais — `.env.example` documenta o formato
esperado de cada uma.

## 4. Primeiro deploy

1. Conecte o repositório GitHub ao seu projeto na Vercel (import normal —
   a Vercel detecta Next.js automaticamente, nenhuma configuração de build
   customizada é necessária).
2. Configure as variáveis de ambiente do passo 3.
3. Antes do primeiro deploy ficar acessível de verdade, aplique as
   migrations e rode o seed **uma vez**, apontando para o banco de
   produção — a partir da sua máquina local, não como parte do build da
   Vercel (rodar migrations automaticamente em todo build é arriscado sob
   deploys concorrentes):
   ```bash
   DATABASE_URL="<sua DATABASE_URL de produção>" \
   DIRECT_URL="<sua DIRECT_URL de produção>" \
     npx prisma migrate deploy

   DATABASE_URL="<sua DATABASE_URL de produção>" \
   DIRECT_URL="<sua DIRECT_URL de produção>" \
   SEED_ADMIN_PASSWORD="<uma senha forte, não a padrão>" \
     npx tsx prisma/seed.ts
   ```
4. Depois disso, cada novo deploy na Vercel só precisa buildar o app; novas
   migrations (quando o schema mudar) são aplicadas do mesmo jeito — rodando
   `prisma migrate deploy` manualmente contra o banco de produção antes ou
   depois do deploy do código que as introduziu, nunca escondido dentro do
   comando de build.

## 5. Depois do deploy

- Troque a senha do Super Admin (`SEED_ADMIN_PASSWORD`) assim que logar por
  ativação em duas etapas (`/admin/conta`, §27).
- O e-mail transacional (redefinição de senha, convite de funcionário)
  ainda é um stub que só registra a intenção de envio
  (`src/server/notifications/email.ts`) — nenhum provedor real está
  conectado. Ver "Débitos técnicos conhecidos" em `docs/ROADMAP.md`.
- Rate limiting é por banco de dados, correto para uma única instância;
  sob múltiplas regiões/instâncias simultâneas da Vercel, considere migrar
  para um contador compartilhado (Redis) — também já registrado como
  débito técnico conhecido.
