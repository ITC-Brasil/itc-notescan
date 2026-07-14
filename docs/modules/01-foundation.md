# Módulo 1 — Fundação e Infraestrutura

**Data de conclusão:** 2026-06-22

---

## O que foi implementado

### Configuração do projeto
- `next.config.ts`: `output: 'standalone'`, Serwist PWA, Sentry, headers de segurança (CSP, X-Frame-Options, HSTS, Permissions-Policy)
- `tsconfig.json`: strict, path alias `@/` para `./src/`
- `tailwind.config.ts` → migrado para tokens CSS em `globals.css` (Tailwind 4)
- Paleta ITC completa como tokens CSS (`--itc-ciano-*`, `--itc-bordo-*`, etc.)
- Fontes: Inter (sans) e JetBrains Mono (mono) via `next/font`

### Banco de dados
- `prisma/schema.prisma`: 8 modelos (`User`, `Project`, `UM`, `Notebook`, `Conference`, `ConferenceItem`, `LifecycleEvent`, `PushSubscription`), 4 enums
- `prisma.config.ts`: URL do banco via `dotenv` (obrigatório no Prisma 7)
- `lib/db/prisma.ts`: singleton com `@prisma/adapter-pg` + extensão de imutabilidade em `LifecycleEvent`
- Migration inicial aplicada

### Autenticação
- `lib/auth/config.ts`: edge-safe, callbacks JWT/session
- `lib/auth/index.ts`: Node.js, PrismaAdapter + bcrypt Credentials
- `proxy.ts`: proteção de rotas no Edge Runtime com matcher explícito
- Perfis: USER (`/inicio`, `/scanner`), ADMIN (dashboard em diante), MASTER (todos + `/usuarios`)

### Infraestrutura offline
- `lib/offline/db.ts`: schema Dexie com `conferencesOutbox`
- `lib/offline/sync.ts`: `saveToOutbox`, `processOutbox`, retry com backoff exponencial (1min → 5min → 15min)
- `src/app/sw.ts`: Service Worker via `@serwist/next` com `skipWaiting: false`

### Observabilidade e segurança
- `lib/logger.ts`: logging estruturado com integração Sentry
- `lib/rate-limit.ts`: rate limiter em memória (5 req/min login, 30 req/min API)
- `security(m1)`: `eslint-plugin-security` no ESLint config

### Validação
- `lib/validations/index.ts`: schemas Zod para todas as entidades

### Componentes base
- `DataTable.tsx`: tabela genérica TanStack Table com paginação, sorting, pageSize configurável
- `Skeleton.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `PageHeader.tsx`, `ConfirmationDialog.tsx`
- shadcn/ui configurado com tema ITC (estilo `radix-nova`)

### Layouts e providers
- `AdminLayout.tsx`: sidebar desktop + hamburger mobile
- `UserLayout.tsx`: bottom navigation mobile
- `AuthGuard.tsx`: proteção client-side por role
- `QueryProvider.tsx`: React Query com `staleTime: 30s`
- `SessionProvider.tsx`: NextAuth
- `ThemeProvider.tsx`: dark mode via next-themes

### Scripts e ferramentas de desenvolvimento
- `scripts/create-admin.ts`: seed do primeiro usuário MASTER com bcrypt rounds 12
- Husky + lint-staged: pre-commit com `eslint --fix` e `tsc`
- Vitest + Playwright: configuração inicial com 15 testes de schema Zod passando

---

## Verificação executada

- Login e logout funcionando no browser
- Redirecionamento correto por role (USER → /inicio, ADMIN → /dashboard)
- `/usuarios` bloqueada para ADMIN (redireciona para /dashboard)
- Schemas Zod: 15 testes Vitest passando
- Dexie: verificado via DevTools IndexedDB

---

## Decisões

- Prisma 7 com driver adapter obrigatório → ver [DECISIONS.md m1-01](../DECISIONS.md)
- `@serwist/next` em vez de `@ducanh2912/next-pwa` → ver [DECISIONS.md m1-02](../DECISIONS.md)
- proxy.ts com matcher explícito → ver [DECISIONS.md m1-04](../DECISIONS.md)

---

## Pontos de atenção

- `src/generated/` no `.gitignore` — sempre rodar `npx prisma generate` após clone
- `prisma.config.ts` na raiz — necessário para o CLI do Prisma (não é lido pelo Next.js)
- `skipWaiting: false` no SW — nunca alterar
- Schema Dexie: qualquer alteração requer incremento de versão (`this.version(N+1)`)
- `lib/auth/config.ts` e `lib/auth/index.ts` são intencionalmente separados — não mesclar

---

## Commits

```
231c5f3 chore: initial project setup with full stack dependencies
1bd337c chore(m1): configure next.config.ts with standalone output and security headers
4db6ea9 chore(m1): setup prisma schema and singleton client with immutability extension
ba867c1 feat(m1): add nextauth credentials provider with jwt callbacks and route protection
70ee3cd chore(m1): configure tailwind tokens ITC brand palette and Inter/JetBrains fonts
096fb36 chore(m1): install and configure shadcn/ui components with ITC theme
f737512 feat(m1): add base UI components DataTable Skeleton EmptyState ErrorBoundary PageHeader ConfirmationDialog
c18fb89 feat(m1): add AdminLayout UserLayout AuthGuard and route group layouts
4a4af47 chore(m1): configure QueryProvider SessionProvider ThemeProvider and compose in root layout
9626473 chore(m1): configure Dexie offline db syncQueue with exponential backoff and serwist service worker
d576823 chore(m1): add structured logger with Sentry integration and in-memory rate limiter
5eb30ef test(m1): configure vitest and playwright with zod schema unit tests (15 passing)
41a12ac security(m1): add eslint-plugin-security rules to ESLint config
3f8ba5d chore(m1): configure husky pre-commit lint-staged and fix prisma7 pg adapter driver and ts errors
fb2bdae feat(m1): add login page with react-hook-form zod validation and nextauth credentials
6684e76 feat(m1): add create-admin script to seed initial MASTER user with bcrypt rounds 12
e8daa69 chore(m1): add initial database migration
```
