# ITC NoteScan v2.0 — Prompt Claude Code (Completo)

## Contexto do Projeto

Você está construindo o **ITC NoteScan v2.0** do zero — reescrita completa do
sistema ScanPRO, sistema de conferência de ativos (notebooks) via QR Code
utilizado por técnicos de campo da ITC Brasil no projeto Brasil.IA.

O repositório original (`github.com/ITC-Brasil/scanpro`) existe e está em
produção, mas **não é base de código**. Serve apenas como referência de
comportamento e regras de negócio. Toda a fundação técnica é nova.

---

## Stack Tecnológica

```
Next.js 16.2.x        App Router, proxy.ts, Turbopack
React 19.2            com React Compiler
TypeScript 5.x        strict: true, sem exceções
Tailwind CSS 4.x
shadcn/ui             sistema de design único
NextAuth.js 5.x       Credentials provider, JWT com roles
Prisma 6.x            ORM para PostgreSQL
PostgreSQL 16         banco de dados principal
React Query 5.x       TanStack Query — cache e fetching
Zod 3.x               validação em todas as API Routes
@serwist/next         PWA e Service Worker (substitui @ducanh2912/next-pwa)
web-push              push notifications VAPID
Sentry                observabilidade
Vitest                testes unitários
Playwright            testes E2E
```

---

## Identidade Visual ITC Brasil

### Paleta Completa — Tokens Tailwind

Configure todos os tokens abaixo em `globals.css` e `tailwind.config.ts`.

#### Ciano (cor principal da marca)
```css
--itc-ciano-1:  #97DDE0;  /* fundos muito suaves */
--itc-ciano-2:  #65D2D8;  /* destaque sutil sobre branco */
--itc-ciano-3:  #55C3C9;  /* hover, estados interativos leves */
--itc-ciano-4:  #43B4BA;  /* bordas, divisores com presença */
--itc-ciano-5:  #30A5AB;  /* ícones, badges secundários */
--itc-ciano-6:  #17969C;  /* elementos de interface ativos */
--itc-ciano-7:  #008F95;  /* COR PRINCIPAL DA MARCA ★ */
--itc-ciano-8:  #007A80;  /* hover sobre botão primário */
--itc-ciano-9:  #006C72;  /* estados pressed, foco */
--itc-ciano-10: #005D63;  /* texto sobre fundo ciano claro */
--itc-ciano-11: #004F54;  /* fundos de seção escuros */
--itc-ciano-12: #004145;  /* contraste máximo, navbar escura */
```

#### Bordô (destaque institucional)
```css
--itc-bordo-1:  #FFE8F1;  /* fundos muito suaves */
--itc-bordo-2:  #FFCEDC;  /* fundos de alerta institucional leve */
--itc-bordo-3:  #ECBAC8;  /* destaque sutil sobre branco */
--itc-bordo-4:  #E6A0B4;  /* hover, estados interativos leves */
--itc-bordo-5:  #D18DA1;  /* bordas e divisores com presença */
--itc-bordo-6:  #BC7A8E;  /* ícones e badges secundários */
--itc-bordo-7:  #A8677B;  /* elementos de interface ativos */
--itc-bordo-8:  #945569;  /* hover sobre elementos bordô */
--itc-bordo-9:  #814458;  /* estados pressed, foco */
--itc-bordo-10: #6E3247;  /* texto sobre fundo bordô claro */
--itc-bordo-11: #5B2137;  /* fundos de seção escuros */
--itc-bordo-12: #491027;  /* COR PRINCIPAL BORDÔ ★ */
```

#### Neutros — Escala Branco (modo claro)
```css
--itc-branco:   #FFFFFF;  /* fundos principais */
--itc-branco-2: #E7E7E7;  /* fundos de card, superfícies elevadas */
--itc-branco-3: #D0D0D0;  /* bordas suaves, divisores leves */
--itc-branco-4: #BABABA;  /* bordas com presença, placeholders */
--itc-branco-5: #A4A4A4;  /* texto desabilitado, ícones inativos */
--itc-branco-6: #8E8E8E;  /* texto auxiliar, metadados */
--itc-branco-7: #797979;  /* texto secundário */
--itc-branco-8: #656565;  /* texto de apoio em fundos claros */
--itc-branco-9: #515151;  /* corpo de texto em modo escuro */
--itc-branco-10: #3E3E3E; /* texto principal em modo escuro */
--itc-branco-11: #2C2C2C; /* fundos de painel escuro */
--itc-branco-12: #1B1B1B; /* fundos muito escuros */
```

#### Neutros — Escala Preto
```css
--itc-preto-1:  #E2E2E2;  /* fundos de card neutros */
--itc-preto-2:  #CBCBCB;  /* bordas e divisores neutros */
--itc-preto-3:  #B5B5B5;  /* bordas com presença */
--itc-preto-4:  #9F9F9F;  /* texto desabilitado */
--itc-preto-5:  #898989;  /* texto auxiliar */
--itc-preto-6:  #757575;  /* texto secundário */
--itc-preto-7:  #606060;  /* texto de apoio */
--itc-preto-8:  #4D4D4D;  /* corpo de texto */
--itc-preto-9:  #3A3A3A;  /* texto principal */
--itc-preto-10: #292929;  /* fundos escuros */
--itc-preto-11: #181818;  /* fundos muito escuros */
--itc-preto:    #000000;  /* preto puro */
```

#### Cores Funcionais
```css
--itc-sucesso:  #1A7F3C;  /* confirmação, escaneado, online */
--itc-atencao:  #CC7A00;  /* em andamento, prazo próximo */
--itc-erro:     #C0392B;  /* crítico, faltante, falha */
--itc-info:     #1565C0;  /* informativo, novo item */
```

### Tipografia

```
Interface principal:  Inter (Google Fonts) — pesos 400, 500, 600
Código e monospace:   JetBrains Mono
```

Inter foi escolhida por legibilidade superior em telas pequenas (mobile-first),
excelente suporte a caracteres latinos e performance comprovada em SaaS modernos.
Não usar as fontes da identidade visual ITC para interface — reservar para
materiais institucionais.

### Aplicação de Cores no Design

```
Modo claro:
  Background:   --itc-branco
  Surface:      --itc-branco-2
  Border:       --itc-branco-3
  Text primary: --itc-branco-12
  Text muted:   --itc-branco-8

Modo escuro:
  Background:   --itc-branco-12
  Surface:      --itc-branco-11
  Border:       --itc-branco-10
  Text primary: --itc-branco
  Text muted:   --itc-branco-6

Ações primárias:  --itc-ciano-7  (hover: --itc-ciano-8, pressed: --itc-ciano-9)
Ações destrutivas: --itc-erro
Sucesso:           --itc-sucesso
Atenção:           --itc-atencao
```

---

## Arquitetura Obrigatória

```
app/
  (admin)/            rotas ADMIN e MASTER
  (user)/             rotas USER — somente mobile
  api/                API Routes protegidas

components/
  ui/                 shadcn + customizados
  layout/             AuthGuard, layouts por role

hooks/                um hook por entidade
  useConference.ts
  useNotebooks.ts
  useProjects.ts
  useUMs.ts
  useUsers.ts

lib/
  auth/config.ts      NextAuth
  db/prisma.ts        instância Prisma singleton
  offline/db.ts       Dexie schema
  offline/sync.ts     syncQueue
  services/           lógica de negócio
  validations/        schemas Zod reutilizáveis
  logger.ts           logging estruturado

prisma/
  schema.prisma
  migrations/

providers/
  QueryProvider.tsx
  SessionProvider.tsx
  ThemeProvider.tsx

__tests__/
  unit/
  e2e/
```

**Regra crítica:**
- Services → lógica de negócio
- Hooks → controle de estado via React Query
- Componentes → interface apenas, zero lógica
- Nunca fetch direto em componentes
- Nunca `any` em TypeScript
- Nunca `$queryRaw` com interpolação de string

---

## Schema Prisma Completo

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  nome          String
  email         String    @unique
  passwordHash  String
  role          Role      @default(USER)
  metaDiaria    Int       @default(2)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  conferences   Conference[]
  lifecycleEvents LifecycleEvent[]
  pushSubscription PushSubscription?
}

enum Role {
  USER
  ADMIN
  MASTER
}

model Project {
  id        String   @id @default(cuid())
  nome      String
  cor       String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ums       UM[]
}

model UM {
  id                 String     @id @default(cuid())
  nome               String
  projectId          String
  project            Project    @relation(fields: [projectId], references: [id])
  quantidadeEsperada Int
  perifericos        Boolean    @default(false)
  mouses             Boolean    @default(false)
  carregadores       Boolean    @default(false)
  fones              Boolean    @default(false)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  notebooks          Notebook[]
  conferences        Conference[]
}

model Notebook {
  id              String          @id @default(cuid())
  hostname        String          @unique
  serial          String?
  patrimonio      String?
  status          NotebookStatus  @default(ATIVO)
  umId            String
  um              UM              @relation(fields: [umId], references: [id])
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  conferenceItems ConferenceItem[]
  lifecycleEvents LifecycleEvent[]
}

enum NotebookStatus {
  ATIVO
  MANUTENCAO
}

model Conference {
  id         String           @id @default(cuid())
  userId     String
  user       User             @relation(fields: [userId], references: [id])
  umId       String
  um         UM               @relation(fields: [umId], references: [id])
  dataInicio DateTime
  dataFim    DateTime
  localizacao String?
  status     ConferenceStatus
  createdAt  DateTime         @default(now())
  items      ConferenceItem[]
}

enum ConferenceStatus {
  CONCLUIDO_OK
  CONCLUIDO_FALTANTES
}

model ConferenceItem {
  id           String     @id @default(cuid())
  conferenceId String
  conference   Conference @relation(fields: [conferenceId], references: [id])
  notebookId   String
  notebook     Notebook   @relation(fields: [notebookId], references: [id])
  status       ItemStatus
}

enum ItemStatus {
  ESCANEADO
  FALTANTE
  MANUTENCAO
}

model LifecycleEvent {
  id         String   @id @default(cuid())
  notebookId String
  notebook   Notebook @relation(fields: [notebookId], references: [id])
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  tipo       String
  descricao  String
  createdAt  DateTime @default(now())
  @@map("lifecycle_events")
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  endpoint  String
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Adicionar Prisma middleware para bloquear update e delete em LifecycleEvent:
```typescript
// lib/db/prisma.ts
prisma.$use(async (params, next) => {
  if (params.model === 'LifecycleEvent' &&
      ['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
    throw new Error('LifecycleEvent é imutável')
  }
  return next(params)
})
```

---

## Autenticação — NextAuth.js 5

```typescript
// lib/auth/config.ts
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db/prisma'

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })
        if (!user) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null
        return { id: user.id, email: user.email, nome: user.nome, role: user.role }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.nome = user.nome
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.nome = token.nome as string
      return session
    }
  }
}
```

Proteção de rotas via `proxy.ts` (Next.js 16 — substitui middleware.ts):
```typescript
// proxy.ts
import { auth } from '@/lib/auth/config'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  const publicRoutes = ['/']
  if (publicRoutes.includes(pathname)) return

  if (!session) {
    return Response.redirect(new URL('/', req.url))
  }

  const adminRoutes = ['/dashboard', '/notebooks', '/projetos',
                       '/ums', '/notificacoes', '/relatorios']
  const masterRoutes = ['/usuarios']

  if (masterRoutes.some(r => pathname.startsWith(r)) &&
      session.user.role !== 'MASTER') {
    return Response.redirect(new URL('/inicio', req.url))
  }

  if (adminRoutes.some(r => pathname.startsWith(r)) &&
      !['ADMIN', 'MASTER'].includes(session.user.role)) {
    return Response.redirect(new URL('/inicio', req.url))
  }
})
```

---

## PWA e Service Worker — @serwist/next

**Atenção:** @ducanh2912/next-pwa foi substituído por @serwist/next.

```typescript
// next.config.ts
import withSerwist from '@serwist/next'

const withPWA = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig = withPWA({
  output: 'standalone',
  // security headers e restante da config
})

export default nextConfig
```

```typescript
// app/sw.ts
import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,  // nunca true — notificar usuário sobre nova versão
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
```

**Regra crítica:** `skipWaiting` deve ser sempre `false`. Quando nova versão
disponível, notificar o usuário via toast e aguardar confirmação.

---

## Sincronização Offline — Dexie + syncQueue

```typescript
// lib/offline/db.ts
import Dexie, { Table } from 'dexie'

export interface ConferenceOutbox {
  id?: number
  data: object
  timestamp: number
  retryCount: number
  nextRetry: number
}

class NoteScanDB extends Dexie {
  conferencesOutbox!: Table<ConferenceOutbox>

  constructor() {
    super('NoteScanDB')
    this.version(1).stores({
      conferencesOutbox: '++id, timestamp, retryCount, nextRetry'
    })
  }
}

export const db = new NoteScanDB()
```

Backoff exponencial obrigatório:
```typescript
// lib/offline/sync.ts
const RETRY_DELAYS = [60000, 300000, 900000] // 1min, 5min, 15min

export async function processOutbox() {
  const now = Date.now()
  const items = await db.conferencesOutbox
    .where('nextRetry').belowOrEqual(now)
    .sortBy('timestamp')

  for (const item of items) {
    try {
      await fetch('/api/conferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      })
      await db.conferencesOutbox.delete(item.id!)
    } catch {
      const delay = RETRY_DELAYS[Math.min(item.retryCount, RETRY_DELAYS.length - 1)]
      await db.conferencesOutbox.update(item.id!, {
        retryCount: item.retryCount + 1,
        nextRetry: now + delay
      })
    }
  }
}
```

---

## Segurança — Padrão Obrigatório

### API Routes
```typescript
export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return Response.json({ message: 'Não autorizado' }, { status: 401 })
  }
  if (!(['ADMIN', 'MASTER'].includes(session.user.role))) {
    return Response.json({ message: 'Proibido' }, { status: 403 })
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      { message: 'Dados inválidos', errors: parsed.error.issues },
      { status: 400 }
    )
  }
  // lógica de negócio
}
```

### Security Headers (next.config.ts)
```typescript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://o*.ingest.sentry.io https://*.sentry.io",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
      ].join('; ')
    }
  ]
}]
```

### Rate Limiting
```typescript
// lib/rate-limit.ts
const requests = new Map<string, { count: number; reset: number }>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const record = requests.get(key)

  if (!record || now > record.reset) {
    requests.set(key, { count: 1, reset: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= limit) {
    return { allowed: false }
  }

  record.count++
  return { allowed: true }
}
```

### OWASP Top 10
- Broken Access Control → `auth()` em toda API Route
- Injection → Prisma ORM, nunca `$queryRaw` com interpolação
- Security Misconfiguration → headers configurados acima
- Cryptographic Failures → bcrypt rounds 12
- Insecure Design → Zod em todos os inputs
- Rate limiting → rotas de auth max 5/min por IP

---

## Regras de Negócio Críticas

### Fluxo de Conferência
1. Técnico seleciona UM — obrigatório
2. Sistema carrega notebooks ativos da UM via React Query
3. Scan válido → move para escaneados, remove de pendentes
4. Scan duplicado → bloquear com erro imediato
5. Notebook em manutenção → registrado, não conta como faltante
6. Finalização → sempre via `/api/conferences`, nunca direto no banco
7. API salva no PostgreSQL E notifica Telegram
8. Online → API direto | Offline → Dexie + syncQueue

### Regras de Exclusão
- Projeto → não pode ter UMs associadas
- UM → não pode ter Notebooks associados
- Usuário → sempre modal de confirmação
- Toda exclusão irreversível exige confirmação

### Notebooks em Lote
- Formato: PREFIXO + número sequencial (BSBIA01-EST01)
- 1–9: zero à esquerda | 10+: sem zero
- Listagem em ordem alfabética

---

## Testes

### Vitest
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 70 }
    }
  }
})
```

Cobertura mínima obrigatória:
- Fluxo de scan (válido, duplicado, manutenção, UM errada)
- syncQueue (retry, backoff, deduplicação)
- Schemas Zod de todas as API Routes
- Lógica de roles e permissões

### Playwright
Fluxos críticos E2E:
- Login válido e inválido
- Fluxo completo de conferência online
- Fluxo completo de conferência offline
- CRUD de notebooks
- Proteção de rotas por role

---

## Variáveis de Ambiente

```env
DATABASE_URL="postgresql://notescan:notescan_dev@localhost:5432/notescan"
NEXTAUTH_SECRET=
NEXTAUTH_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

---

## Docker (Módulo 2.5)

`output: 'standalone'` obrigatório desde o início no next.config.ts.

---

## Referência de Comportamento

Para regras de negócio e edge cases, consultar:
`github.com/ITC-Brasil/scanpro`

Nunca copiar código — apenas entender comportamento.

---

## Restrições Absolutas

- Nunca `any` em TypeScript
- Nunca fetch direto em componentes
- Nunca `$queryRaw` com interpolação no Prisma
- Nunca logar senhas, tokens ou dados sensíveis
- Nunca `skipWaiting: true` no Service Worker
- Nunca commitar `.env` ou `.env.local`
- Nunca instalar biblioteca de componentes além do shadcn/ui
- Nunca pular validação Zod em API Routes
- Nunca gravar conferência direto no banco pelo cliente

---


## Padrão de Commit por Tarefa

Após concluir cada tarefa, fazer commit com a mensagem no formato:

```
chore(m1): configure next.config.ts with standalone output and security headers
chore(m1): setup prisma schema and initial migration
feat(m1): add nextauth credentials provider with jwt callbacks
```

Formato: `tipo(mN): descrição em inglês lowercase`
- `m1`, `m2`, `m3` indicam o módulo
- Tipos: `feat`, `fix`, `chore`, `refactor`, `test`, `security`
- Sempre fazer push após o commit: `git add . && git commit -m "..." && git push origin develop`

---

# MÓDULO 1 — Base e Infraestrutura

## Objetivo
Construir toda a fundação técnica do projeto: configurações, schema do banco,
autenticação, sistema de design, estrutura de pastas e componentes base.

## Ordem de Execução

**Fazer commit após cada tarefa concluída. Continuar automaticamente para a próxima tarefa do mesmo módulo.**

### T1 — Configurar next.config.ts
- `output: 'standalone'`
- Security headers completos
- Integração com @serwist/next
- Integração com Sentry (já configurado pelo wizard)

### T2 — Configurar Prisma
- Substituir conteúdo de `prisma/schema.prisma` pelo schema completo acima
- Configurar `prisma.config.ts` com `DATABASE_URL`
- Criar `lib/db/prisma.ts` com instância singleton + middleware de imutabilidade
- Rodar `npx prisma migrate dev --name init`
- Rodar `npx prisma generate`

### T3 — Configurar NextAuth
- Criar `lib/auth/config.ts` com Credentials provider e callbacks de JWT
- Criar `app/api/auth/[...nextauth]/route.ts`
- Criar `proxy.ts` com proteção de rotas por role
- Instalar `bcryptjs` e `@types/bcryptjs`
- Criar tipos em `types/next-auth.d.ts`

### T4 — Configurar Tailwind + tokens ITC
- Atualizar `tailwind.config.ts` com todos os tokens de cor da paleta ITC
- Atualizar `globals.css` com variáveis CSS da paleta completa
- Configurar Inter (Google Fonts) e JetBrains Mono no `app/layout.tsx`
- Configurar dark mode via `class`

### T5 — Instalar e configurar shadcn/ui
```bash
npx shadcn@latest add button input label card table badge
npx shadcn@latest add dialog alert-dialog dropdown-menu
npx shadcn@latest add select toast sonner separator
npx shadcn@latest add form popover calendar
```
Customizar tema do shadcn para usar os tokens ITC.

### T6 — Criar componentes base
- `components/ui/DataTable.tsx` — genérico com TanStack Table, paginação, ordenação
- `components/ui/Skeleton.tsx` — skeleton loader padronizado
- `components/ui/EmptyState.tsx` — estado vazio padronizado
- `components/ui/ErrorBoundary.tsx` — boundary global
- `components/ui/PageHeader.tsx` — cabeçalho de página padrão
- `components/ui/ConfirmationDialog.tsx` — modal de confirmação para exclusões

### T7 — Criar layouts
- `components/layout/AdminLayout.tsx` — sidebar + navbar para ADMIN/MASTER
- `components/layout/UserLayout.tsx` — layout mobile-first para técnicos
- `components/layout/AuthGuard.tsx` — proteção client-side por role
- `app/(admin)/layout.tsx` — usa AdminLayout
- `app/(user)/layout.tsx` — usa UserLayout

### T8 — Configurar providers
- `providers/QueryProvider.tsx` — React Query com configuração padrão
- `providers/SessionProvider.tsx` — NextAuth session
- `providers/ThemeProvider.tsx` — dark/light mode
- `app/layout.tsx` — compor todos os providers

### T9 — Configurar Dexie + syncQueue
- `lib/offline/db.ts` — schema Dexie com versionamento
- `lib/offline/sync.ts` — processOutbox com backoff exponencial
- `app/sw.ts` — Service Worker com @serwist/next, skipWaiting: false

### T10 — Configurar logging e rate limiting
- `lib/logger.ts` — logging estruturado integrado ao Sentry
- `lib/rate-limit.ts` — implementação in-memory para desenvolvimento

### T11 — Configurar testes
- `vitest.config.ts` — configuração completa com coverage
- `playwright.config.ts` — configuração E2E
- `__tests__/setup.ts` — setup global dos testes
- Primeiro teste unitário: validação do schema Zod de conferência

### T12 — Configurar ESLint security
```bash
npm install -D eslint-plugin-security
```
Atualizar `eslint.config.mjs` com regras de segurança.

### T13 — Configurar Husky + lint-staged
```bash
npx husky init
```
- `.husky/pre-commit`: lint + type-check + audit
- `package.json`: scripts `type-check`, `lint`, `test`, `audit:security`

### T14 — Criar página de login
- `app/page.tsx` — página de login com identidade ITC
- Formulário com email e senha
- Validação Zod client-side
- Feedback de erro inline
- Rate limiting server-side na rota de auth

### T15 — Criar primeiro usuário MASTER via script
- `scripts/create-admin.ts` — script para criar usuário MASTER inicial
- Usar bcrypt rounds 12 para hash da senha

---

# MÓDULO 2 — Funcionalidades Admin

## Objetivo
Implementar todas as páginas e fluxos do painel administrativo.

**Fazer commit após cada página concluída. Continuar automaticamente para a próxima página do mesmo módulo.**

### Dashboard
- Cards: total de conferências hoje, técnicos ativos, notebooks em manutenção,
  conferências com faltantes
- Tabela das 10 últimas conferências com status visual
- Polling automático com React Query (refetchInterval: 30000)
- Skeleton loaders durante carregamento
- Hook: `hooks/useDashboard.ts`

### Projetos
- Listagem com cor visual de cada projeto
- CRUD completo com modal
- Seletor de cor hex com preview em tempo real
- Validação: não excluir projeto com UMs associadas
- Hook: `hooks/useProjects.ts`
- API Routes: `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`

### UMs (Unidades Móveis)
- Listagem agrupada por projeto com herança de cor
- CRUD completo
- Configuração de periféricos (mouses, carregadores, fones)
- Validação: não excluir UM com notebooks associados
- Hook: `hooks/useUMs.ts`
- API Routes: `app/api/ums/route.ts`, `app/api/ums/[id]/route.ts`

### Notebooks
- Listagem agrupada por UM > Projeto
- CRUD individual
- Cadastro em lote (prefixo + sequencial)
- Import via CSV com validação e preview antes de confirmar
- Filtro por status (ativo/manutenção)
- Hook: `hooks/useNotebooks.ts`
- API Routes: `app/api/notebooks/route.ts`, `app/api/notebooks/[id]/route.ts`
- `app/api/notebooks/batch/route.ts` — cadastro em lote
- `app/api/notebooks/import/route.ts` — import CSV

### Relatórios
- Histórico completo de conferências com filtros:
  - Por período (date range picker)
  - Por técnico
  - Por projeto/UM
  - Por status
- Exportação CSV
- Hook: `hooks/useConferences.ts`
- API Routes: `app/api/conferences/route.ts`

### Notificações Push
- Envio para técnico individual ou broadcast
- Histórico de envios
- Hook: `hooks/useNotifications.ts`
- API Routes: `app/api/notifications/send/route.ts`
- `app/api/notifications/subscribe/route.ts`
- `app/api/notifications/dispatch/route.ts`

### Usuários (apenas MASTER)
- CRUD completo
- Seleção de role com descrição de permissões
- Reset de senha
- Confirmação obrigatória para exclusão
- Hook: `hooks/useUsers.ts`
- API Routes: `app/api/users/route.ts`, `app/api/users/[id]/route.ts`

---

# MÓDULO 3 — Fluxo do Técnico (Mobile)

## Objetivo
Implementar as páginas do técnico — mobile-first, zero fricção, fluxo offline.

**Fazer commit após cada página concluída. Continuar automaticamente para a próxima página do mesmo módulo.**

### Página Início (`app/(user)/inicio/page.tsx`)
- Card com meta diária e progresso (conferências feitas / meta)
- Botão INICIAR CONFERÊNCIA — visível apenas em mobile
- Histórico pessoal das últimas 10 conferências
- Status visual de cada conferência (OK / faltantes)
- Polling a cada 30s com React Query

### Página Scanner (`app/(user)/scanner/page.tsx`)

**Estado 1 — Seleção de UM:**
- Lista de UMs disponíveis
- Busca por nome
- Sem UM selecionada → não avança

**Estado 2 — Scanning:**
- Câmera ativa com @yudiel/react-qr-scanner
- Contador: pendentes / escaneados / manutenção
- Lista de pendentes (rolável)
- Lista de escaneados (rolável)
- Feedback visual imediato após cada scan:
  - Verde → escaneado com sucesso
  - Vermelho → duplicado ou erro
  - Amarelo → manutenção
- Botão FINALIZAR (sempre visível)

**Estado 3 — Periféricos (se UM configurada):**
- Checklist de periféricos a conferir
- Apenas se a UM tiver periféricos configurados

**Estado 4 — Resumo:**
- Total esperado, escaneados, faltantes, manutenção
- Lista de faltantes com hostname
- Botão CONFIRMAR E ENVIAR

**Lógica de envio:**
```typescript
const handleSend = async (summaryData) => {
  if (!navigator.onLine) {
    await saveToOutbox(summaryData)
    toast.success('Conferência salva. Será enviada quando houver conexão.')
    router.push('/inicio')
    return
  }

  try {
    await fetch('/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summaryData)
    })
    toast.success('Conferência enviada com sucesso!')
    router.push('/inicio')
  } catch {
    await saveToOutbox(summaryData)
    toast.warning('Erro ao enviar. Salvo para sincronização posterior.')
    router.push('/inicio')
  }
}
```

### API `/api/conferences` (POST)
- Autenticar usuário
- Validar body com Zod
- Salvar Conference + ConferenceItems no PostgreSQL
- Criar LifecycleEvents para cada notebook faltante
- Notificar Telegram com resumo formatado
- Retornar conferência criada

### Telegram — Formato da mensagem
```
🔍 *Conferência Concluída*

👤 Técnico: {nome}
📦 UM: {umNome} ({projectNome})
📅 Data: {data} às {hora}
📍 Local: {localizacao}

✅ Escaneados: {escaneados}/{total}
❌ Faltantes: {faltantes}
🔧 Manutenção: {manutencao}

Status: {CONCLUÍDO ✅ | FALTANTES ⚠️}
```

---
---

## Ordem Global de Execução

```
Módulo 1  → Base e infraestrutura (T1 a T15)
Módulo 2  → Funcionalidades admin
Módulo 3  → Fluxo do técnico mobile
```

**Regra global:** fazer commit após cada tarefa concluída e continuar automaticamente dentro do mesmo módulo. Parar apenas ao concluir um módulo inteiro e aguardar confirmação antes de iniciar o próximo.

---

## Referência de Comportamento

Para entender regras de negócio e edge cases:
`github.com/ITC-Brasil/scanpro`

Nunca copiar código — apenas entender comportamento.
