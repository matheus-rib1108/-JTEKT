# StockFlow B2B

Plataforma B2B para gestão, redistribuição e comercialização de estoque
empresarial. Veja `docs/ARCHITECTURE.md` para a visão geral de arquitetura
e `docs/ROADMAP.md` para o plano de fases — este repositório está na
**Fase 1** (arquitetura, banco de dados e autenticação).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS · PostgreSQL + Prisma ·
Zod · bcrypt · Vitest.

## Setup local

1. Instale dependências:

   ```bash
   npm install
   ```

2. Configure o banco (requer PostgreSQL rodando localmente):

   ```bash
   cp .env.example .env
   # edite DATABASE_URL/APP_SECRET/APP_URL se necessário
   npx prisma migrate dev
   npm run db:seed
   ```

   O seed cria os papéis/permissões (RBAC), um tenant de demonstração
   (`jtekt`) e um usuário Super Admin:

   - E-mail: `admin@jtekt.demo`
   - Senha: `TrocarSenha#2026` (defina `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
     no `.env` para outro valor)

3. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   - `/` — landing page
   - `/login`, `/register` — autenticação e cadastro de empresa cliente
   - `/admin/dashboard` — painel interno (após login com conta interna)
   - `/portal` — portal do cliente B2B (após login com conta de cliente)

## Scripts

| Script              | Descrição                                   |
| -------------------- | -------------------------------------------- |
| `npm run dev`         | Servidor de desenvolvimento                  |
| `npm run build`       | Build de produção                            |
| `npm run lint`        | ESLint                                       |
| `npm run typecheck`   | `tsc --noEmit`                               |
| `npm run test`        | Testes unitários (Vitest)                    |
| `npm run db:migrate`  | `prisma migrate dev`                         |
| `npm run db:seed`     | Popula papéis, permissões e usuário demo     |

## Segurança

Sessões via cookie `HttpOnly`/`SameSite=Lax`/`Secure` (produção), senha com
bcrypt, CSRF por double-submit cookie, rate limiting e bloqueio de conta
persistidos em banco, RBAC verificado no servidor em toda rota, auditoria
append-only. Detalhes em `docs/ARCHITECTURE.md` §7.
