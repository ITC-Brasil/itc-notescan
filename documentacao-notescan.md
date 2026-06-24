# ITC NoteScan v2.0 — Documentação Técnica

> **Destino:** BookStack — ITC Brasil / TI / Projetos / NoteScan  
> **Versão do documento:** 1.0  
> **Data:** Junho 2026  
> **Responsável técnico:** TI ITC Brasil

---

## 1. Visão Geral

O **ITC NoteScan** é um sistema web PWA para conferência de ativos (notebooks) via leitura de QR Code. Foi desenvolvido para resolver um problema operacional real: furtos e desaparecimento de notebooks nas carretas do projeto **Brasil.IA (BSBIA)**.

### Contexto Operacional

| Elemento | Detalhe |
|---|---|
| Projeto atendido | Brasil.IA (BSBIA) |
| Carretas | 4 unidades móveis itinerantes |
| Notebooks por carreta | 106 (100 alunos, 5 professores, 1 pedagoga) |
| Rotação | A cada 20 dias |
| Técnicos ativos | 7 |
| Conferências/dia | ~14 |

### Problema Resolvido

Antes do NoteScan, as conferências eram feitas manualmente com papel. O processo era lento, sujeito a erros e não gerava histórico digital. Com o sistema:

- Técnicos usam a câmera do celular para escanear QR Codes dos notebooks
- O sistema valida cada scan em tempo real (duplicatas, UM errada, manutenção)
- Ao finalizar, um resumo é enviado automaticamente ao Telegram
- Gestores acompanham tudo via dashboard com atualização a cada 30 segundos

### Versão

Esta é a **v2.0** — reescrita completa do sistema ScanPRO. O repositório original (`github.com/ITC-Brasil/scanpro`) serviu apenas como referência de regras de negócio. Nenhum código foi reaproveitado.

---

## 2. Stack de Tecnologia

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.2.9 |
| Linguagem | TypeScript | 5.x (strict: true) |
| Runtime | Node.js | 20.x |
| Estilização | Tailwind CSS | 4.x |
| Componentes | shadcn/ui (estilo radix-nova) | 4.x |
| Tabelas | TanStack Table | 8.21.x |
| Ícones | Lucide React | 1.21.x |
| Autenticação | NextAuth.js | 5.0.0-beta.31 |
| ORM | Prisma | 7.8.x |
| Driver DB | @prisma/adapter-pg + pg | 7.8.x / 8.22.x |
| Banco de Dados | PostgreSQL | 16 |
| Cache/Fetching | TanStack Query (React Query) | 5.101.x |
| Validação | Zod | 4.4.x |
| Formulários | React Hook Form | 7.80.x |
| Scanner QR | @yudiel/react-qr-scanner + zxing-wasm | 2.6.x / 3.1.x |
| Tema (dark/light) | next-themes | 0.4.x |
| PWA / SW | @serwist/next | 9.5.x |
| Banco Offline | Dexie.js (IndexedDB) | 4.4.x |
| Notificações Push | web-push (VAPID) | 3.6.x |
| Observabilidade | Sentry | 10.59.x |
| Testes Unitários | Vitest | 4.1.x |
| Testes E2E | Playwright | 1.61.x |
| Deploy | Docker + Nginx no GLPI-SRV (Dell R250) | — |

---

## 3. Estrutura de Pastas

```
itc-notescan/
│
├── prisma/
│   ├── schema.prisma              # Schema de banco — 8 modelos, 4 enums
│   ├── migrations/                # Migrations aplicadas (nunca editar)
│   └── prisma.config.ts           # URL do banco lida via dotenv
│
├── proxy.ts                       # Middleware de proteção de rotas (Edge Runtime)
│
├── src/
│   ├── app/
│   │   ├── (admin)/               # Rotas protegidas: ADMIN ou MASTER
│   │   │   ├── dashboard/
│   │   │   ├── notebooks/
│   │   │   ├── notificacoes/
│   │   │   ├── projetos/
│   │   │   ├── relatorios/
│   │   │   ├── ums/
│   │   │   ├── usuarios/          # Exclusivo MASTER
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (user)/                # Rotas protegidas: USER (técnico) — mobile only
│   │   │   ├── inicio/
│   │   │   ├── scanner/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/  # Handlers NextAuth
│   │   │   ├── conferences/         # GET (filtrado) + POST (imutável)
│   │   │   │   └── dashboard/       # GET stats para o dashboard
│   │   │   ├── notebooks/           # GET + POST individual
│   │   │   │   ├── [id]/            # PUT + DELETE
│   │   │   │   │   └── history/     # GET histórico de conferências do notebook
│   │   │   │   ├── batch/           # POST lote (prefixo + sequência)
│   │   │   │   ├── bulk-delete/     # POST exclusão de todos os notebooks de uma UM
│   │   │   │   └── import/          # POST CSV
│   │   │   ├── notifications/
│   │   │   │   ├── subscribe/       # POST/DELETE assinatura VAPID
│   │   │   │   ├── send/            # POST broadcast
│   │   │   │   └── dispatch/        # POST para usuários selecionados
│   │   │   ├── projects/            # GET + POST
│   │   │   │   └── [id]/            # PUT + DELETE (guardado)
│   │   │   ├── ums/                 # GET + POST
│   │   │   │   └── [id]/            # PUT + DELETE (guardado)
│   │   │   └── users/               # GET + POST (MASTER)
│   │   │       └── [id]/            # PUT + DELETE (MASTER)
│   │   │
│   │   ├── page.tsx               # Login / root
│   │   ├── layout.tsx             # Layout raiz com providers
│   │   ├── globals.css            # Paleta ITC + tokens shadcn
│   │   └── sw.ts                  # Service Worker (compilado pelo serwist)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx    # Sidebar desktop + hamburger mobile
│   │   │   ├── UserLayout.tsx     # Bottom navigation mobile
│   │   │   └── AuthGuard.tsx      # Proteção client-side por role
│   │   ├── scanner/
│   │   │   └── QRScanner.tsx      # Câmera com viewfinder overlay
│   │   └── ui/                    # Componentes shadcn + customizados
│   │       ├── DataTable.tsx      # Tabela genérica TanStack Table
│   │       ├── Skeleton.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── PageHeader.tsx
│   │       ├── ConfirmationDialog.tsx
│   │       ├── sidebar.tsx        # shadcn Sidebar (colapsável)
│   │       └── [shadcn: button, badge, checkbox, collapsible, command, dialog, form, input, ...]
│   │
│   ├── hooks/                     # Um hook por entidade (React Query)
│   │   ├── useConference.ts       # State machine do scanner
│   │   ├── useConferences.ts      # Listagem + filtros
│   │   ├── useDashboard.ts
│   │   ├── useNotebooks.ts
│   │   ├── useNotifications.ts
│   │   ├── useProjects.ts
│   │   ├── useUMs.ts
│   │   └── useUsers.ts
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── config.ts          # Edge-safe: só callbacks JWT/session
│   │   │   └── index.ts           # Node.js: Prisma adapter + Credentials
│   │   ├── db/
│   │   │   └── prisma.ts          # Singleton Prisma com PrismaPg adapter
│   │   ├── offline/
│   │   │   ├── db.ts              # Schema Dexie (IndexedDB)
│   │   │   └── sync.ts            # processOutbox + saveToOutbox + retry
│   │   ├── services/
│   │   │   └── conference.service.ts  # getDashboardStats
│   │   ├── validations/
│   │   │   └── index.ts           # Todos os schemas Zod
│   │   ├── logger.ts              # Logging estruturado + Sentry
│   │   └── rate-limit.ts          # Rate limiting em memória
│   │
│   ├── providers/
│   │   ├── QueryProvider.tsx      # React Query (staleTime: 30s)
│   │   ├── SessionProvider.tsx    # NextAuth
│   │   └── ThemeProvider.tsx      # Dark mode (class-based)
│   │
│   ├── types/
│   │   └── next-auth.d.ts         # Extensão: id, nome, role, metaDiaria no JWT
│   │
│   └── generated/
│       └── prisma/                # Cliente Prisma gerado (não commitar)
│
├── scripts/
│   └── create-admin.ts            # Seed do primeiro usuário MASTER
│
├── __tests__/
│   ├── unit/                      # Vitest
│   └── e2e/                       # Playwright
│
├── next.config.ts                 # Serwist PWA + Sentry + headers segurança
├── proxy.ts                       # Middleware Next.js (Edge Runtime)
├── tsconfig.json
├── vitest.config.ts
└── playwright.config.ts
```

---

## 4. Schema do Banco de Dados

### Diagrama de Entidades

```
Project (1) ──── (N) UM (1) ──── (N) Notebook
                  UM (1) ──── (N) Conference
                User (1) ──── (N) Conference
                User (1) ──── (1) PushSubscription
             Notebook (1) ──── (N) ConferenceItem
          Conference (1) ──── (N) ConferenceItem
             Notebook (1) ──── (N) LifecycleEvent
                User (1) ──── (N) LifecycleEvent
```

### Modelos

#### User
```prisma
model User {
  id               String            @id @default(cuid())
  nome             String
  email            String            @unique
  passwordHash     String
  role             Role              @default(USER)
  metaDiaria       Int               @default(2)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
}

enum Role { USER | ADMIN | MASTER }
```

#### Project
```prisma
model Project {
  id        String   @id @default(cuid())
  nome      String
  cor       String   // hex: ex. "#008F95"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### UM (Unidade Móvel)
```prisma
model UM {
  id                 String   @id @default(cuid())
  nome               String
  projectId          String
  quantidadeEsperada Int
  perifericos        Boolean  @default(false)
  mouses             Boolean  @default(false)
  carregadores       Boolean  @default(false)
  fones              Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

#### Notebook
```prisma
model Notebook {
  id         String         @id @default(cuid())
  hostname   String         @unique   // identificador para o QR Code
  serial     String?
  patrimonio String?
  status     NotebookStatus @default(ATIVO)
  umId       String
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
}

enum NotebookStatus { ATIVO | MANUTENCAO }
```

#### Conference
```prisma
model Conference {
  id          String           @id @default(cuid())
  userId      String
  umId        String
  dataInicio  DateTime
  dataFim     DateTime
  localizacao String?          // "lat,lon" via Geolocation API
  status      ConferenceStatus
  createdAt   DateTime         @default(now())
}

enum ConferenceStatus { CONCLUIDO_OK | CONCLUIDO_FALTANTES }
```

#### ConferenceItem
```prisma
model ConferenceItem {
  id           String     @id @default(cuid())
  conferenceId String
  notebookId   String
  status       ItemStatus
}

enum ItemStatus { ESCANEADO | FALTANTE | MANUTENCAO }
```

#### LifecycleEvent (imutável)
```prisma
model LifecycleEvent {
  id         String   @id @default(cuid())
  notebookId String
  userId     String
  tipo       String   // ex. "FALTANTE"
  descricao  String
  createdAt  DateTime @default(now())

  @@map("lifecycle_events")
}
```
> **Imutabilidade garantida em código:** o singleton Prisma usa uma extensão que lança erro em `update`, `updateMany`, `delete` e `deleteMany` neste modelo.

#### PushSubscription
```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String   @unique   // 1 assinatura por usuário
  endpoint  String
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 5. Arquitetura

### Separação em Camadas

```
┌─────────────────────────────────────────────────────┐
│  Componentes / Páginas  (UI apenas — zero lógica)   │
│         ↕ via props e hooks                         │
├─────────────────────────────────────────────────────┤
│  Hooks (hooks/)                                     │
│  React Query + estado local — orquestração          │
│         ↕ fetch para API Routes                     │
├─────────────────────────────────────────────────────┤
│  API Routes (app/api/)                              │
│  auth() → role → Zod → service                      │
│         ↕ Prisma Client                             │
├─────────────────────────────────────────────────────┤
│  Services (lib/services/)                           │
│  Lógica de negócio — sem acesso HTTP direto         │
│         ↕                                           │
├─────────────────────────────────────────────────────┤
│  PostgreSQL 16 (via Prisma + @prisma/adapter-pg)    │
└─────────────────────────────────────────────────────┘
```

**Regras que não podem ser quebradas:**

- Nenhum `fetch` direto em componentes — sempre via hook React Query
- Nenhuma lógica de negócio em componentes
- Nenhum `any` em TypeScript
- Nenhum `$queryRaw` com interpolação no Prisma
- Toda API Route segue o padrão: `auth()` → verificar role → Zod → lógica

### Modelo Mental: Três Estados

O sistema garante consistência entre três fontes de verdade:

```
┌──────────────┐     sync      ┌───────────────────┐
│  PostgreSQL  │ ◄──────────► │  Dexie (IndexedDB) │
│  (remoto)    │               │  (local offline)   │
└──────────────┘               └───────────────────┘
        ▲                               ▲
        │                               │
        └────── Scanner (observado) ────┘
                  (QR Code lido)
```

### Fluxo Offline-First

```
Técnico finaliza conferência
        │
        ▼
   Tem internet?
   ┌────┴────┐
  Sim       Não
   │         │
   ▼         ▼
POST     saveToOutbox()
/api/    (Dexie +
conf.    syncQueue)
   │         │
   └────┬────┘
        │
   Retorna sucesso
   para o usuário
        │
   (background sync)
   processOutbox()
   com retry:
   1min → 5min → 15min
```

---

## 6. Autenticação e Autorização

### Estratégia JWT

O NextAuth.js usa estratégia JWT pura (sem sessões no banco). O token carrega:

```typescript
{
  id: string;
  nome: string;
  role: "USER" | "ADMIN" | "MASTER";
  metaDiaria: number;
}
```

### Split Edge / Node.js

A configuração de auth é dividida em dois arquivos por necessidade de compatibilidade com o Edge Runtime:

| Arquivo | Runtime | Contém |
|---|---|---|
| `lib/auth/config.ts` | Edge-safe | Callbacks JWT e session apenas |
| `lib/auth/index.ts` | Node.js | PrismaAdapter + bcrypt + Credentials |

O `proxy.ts` (middleware) usa o `config.ts` edge-safe. As API Routes usam `lib/auth/index.ts`.

### Proteção de Rotas

```
proxy.ts (Edge Runtime)
│
├── / (login)           → público
├── /inicio, /scanner   → qualquer usuário autenticado
├── /dashboard, /ums,
│   /notebooks, etc.    → ADMIN ou MASTER
└── /usuarios           → MASTER apenas
```

### Padrão Obrigatório em API Routes

```typescript
export async function POST(request: Request) {
  // 1. Autenticação
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  // 2. Autorização por role
  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  // 3. Validação com Zod
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ message: "Dados inválidos", errors: parsed.error.issues }, { status: 400 });

  // 4. Lógica de negócio
}
```

### Senhas

- Hash com bcrypt, **12 rounds**
- Nunca logar senhas, tokens ou dados sensíveis

### Rate Limiting

Implementado em memória (`lib/rate-limit.ts`):

- Rota de login: máximo 5 tentativas por IP por minuto
- API Routes sensíveis: máximo 30 req/min por usuário

---

## 7. Fluxo Principal de Conferência

### Sequência Completa

```
1. Técnico acessa /scanner
2. Seleciona a UM (obrigatório)
3. Sistema carrega todos os notebooks da UM via React Query
4. Câmera abre → técnico escaneia QR Codes
   ├── QR válido (notebook da UM, não duplicado, não em manutenção)
   │     → move de "pendentes" para "escaneados"
   ├── QR duplicado
   │     → erro imediato "já foi escaneado"
   ├── QR de outra UM
   │     → erro "não pertence a esta UM"
   └── QR em manutenção
         → erro "está em manutenção"
5. Técnico finaliza (todos ou com faltantes)
6. Tela de resumo: escaneados / faltantes / manutenção
7. Confirmação → useConference.finalize()
   ├── Online  → POST /api/conferences
   └── Offline → saveToOutbox(Dexie) + retry automático
8. Conferência imutável — nunca pode ser editada após criação
9. API cria LifecycleEvent para cada notebook FALTANTE
10. Notificação Telegram enviada automaticamente
```

### Status da Conferência

| Status | Condição |
|---|---|
| `CONCLUIDO_OK` | Todos os notebooks ATIVO foram escaneados |
| `CONCLUIDO_FALTANTES` | Pelo menos um notebook ATIVO não foi encontrado |

> Notebooks com status `MANUTENCAO` são registrados como `ItemStatus.MANUTENCAO` e **não contam como faltantes**.

---

## 8. Perfis de Usuário

| Role | Acesso |
|---|---|
| `USER` (Técnico) | `/inicio`, `/scanner` — mobile only |
| `ADMIN` (Gestão) | Dashboard, Projetos, UMs, Notebooks, Relatórios, Notificações |
| `MASTER` | Tudo do ADMIN + gerenciamento de Usuários |

**Regra UX:** o botão "Iniciar Conferência" na página `/inicio` tem classe `sm:hidden` — ele desaparece em telas ≥ 640px (desktop). Técnicos em desktop não veem essa opção.

---

## 9. Módulos Implementados

### Módulo 1 — Infraestrutura

- Configuração completa do Next.js 16 (output: standalone, headers de segurança, CSP)
- Schema Prisma com 8 modelos + 4 enums + migration inicial aplicada
- Singleton Prisma com `@prisma/adapter-pg` (obrigatório no Prisma 7)
- Extensão Prisma bloqueando operações de escrita em `LifecycleEvent`
- NextAuth.js 5 com split edge-safe/Node.js
- `proxy.ts` (middleware de rotas)
- Dexie + syncQueue com backoff exponencial (1min / 5min / 15min)
- Schemas Zod para todas as entidades
- Logger estruturado com integração Sentry
- Rate limiter em memória
- Componentes base: DataTable, Skeleton, EmptyState, ErrorBoundary, PageHeader, ConfirmationDialog
- AdminLayout (sidebar + hamburger) e UserLayout (bottom nav)
- AuthGuard client-side
- Providers: QueryProvider, SessionProvider, ThemeProvider
- Service Worker com `skipWaiting: false` (serwist — **nunca alterar**)
- Script `create-admin.ts` para seed do primeiro MASTER
- Configuração Vitest + Playwright + Husky + lint-staged

### Módulo 2 — Interface Admin

| Página | Funcionalidades |
|---|---|
| Dashboard | 4 cards de stats + tabela das últimas 10 conferências + polling 30s |
| Projetos | CRUD + seletor de cor (native + hex) + guard de exclusão |
| UMs | CRUD agrupado por projeto + configuração de periféricos + guard |
| Notebooks | CRUD individual + lote (prefixo + sequência) + importação CSV |
| Relatórios | Histórico completo + 5 filtros + exportação CSV com BOM UTF-8 |
| Notificações | Push para todos os técnicos ou individuais via VAPID |
| Usuários | CRUD completo + troca de senha + guard self-delete (MASTER only) |

### Módulo 3 — Interface Técnico (Mobile)

| Componente | Descrição |
|---|---|
| `hooks/useConference.ts` | Máquina de estados com `useReducer`: `idle → scanning → summary → saving → done` |
| `QRScanner.tsx` | Import dinâmico do scanner, viewfinder overlay com cantos, fallback de erro |
| `/inicio` | Cards diários (total, OK, faltantes), INICIAR oculto em desktop, histórico pessoal, indicador online/offline |
| `/scanner` | Seleção de UM → scan → resumo com faltantes/manutenção → confirmar → offline fallback |

### Correções e Melhorias — Pós Módulo 3

Aplicadas após a entrega dos três módulos principais, organizadas por área:

#### Dashboard (itens 1–3)

- **Ícones padronizados** (`dashboard/page.tsx`): todos os ícones dos `StatCard` usam `text-[--itc-ciano-7]` uniformemente — apenas o fundo varia por variante.
- **Card "Notebooks cadastrados"** (`dashboard/page.tsx`, `useDashboard.ts`, `conference.service.ts`): novo card com ícone `Laptop` exibindo o total de notebooks no banco.
- **Modal "Em manutenção"** (`dashboard/page.tsx`): card de manutenção tornou-se clicável; abre modal com lista detalhada de notebooks em manutenção, agrupados por UM/Projeto, com badge amarelo `--itc-atencao`.

#### Relatórios (itens 4–5)

- **DatePicker Range** (`relatorios/page.tsx`): componente `DateRangeFilter` com `Popover` + `Calendar mode="range"` (react-day-picker v9 — sem prop `initialFocus`). Limpa o filtro de data com botão X embutido.
- **Comboboxes com busca** (`relatorios/page.tsx`): componente `ComboboxFilter` usando `Command + Popover` para todos os filtros (Técnico, Projeto, UM, Status) com campo de busca por texto e opção de limpar seleção. Filtro de Projeto cascateia o filtro de UM.

#### Projetos (itens 6–7)

- **Hex removido do card** (`projetos/page.tsx`): o código hexadecimal da cor não é mais exibido no card do projeto — apenas o dot colorido.
- **Modal de edição corrigido** (`projetos/page.tsx`): `key={editingProject?.id ?? "new"}` no `ProjectFormDialog` força remount ao trocar de projeto, garantindo `defaultValues` atualizados.

#### UMs (itens 8–10)

- **Campo "Periféricos" removido** (`ums/page.tsx`): formulário reduzido para três periféricos — Mouses, Carregadores e Fones — com grid `grid-cols-3`.
- **Checkbox shadcn** (`ums/page.tsx`): inputs nativos `<input type="checkbox">` substituídos pelo componente `<Checkbox>` do shadcn/ui com `checked`/`onCheckedChange` (controlado via React Hook Form).
- **Modal de edição corrigido** (`ums/page.tsx`): `key={editingUM?.id ?? "new"}` no `UMFormDialog`.

#### Usuários (item 11)

- **metaDiaria condicional** (`usuarios/page.tsx`): campo `metaDiaria` exibido inline ao lado do seletor de role — visível somente quando `role === "USER"` via `form.watch("role")`.

#### Notebooks (itens 12–22)

- **Hierarquia colapsável dois níveis** (`notebooks/page.tsx`): Projeto → UM → Notebooks com shadcn `Collapsible`. Estados independentes `expandedProjects: Set<string>` e `expandedUMs: Set<string>`.
- **Ordenação natural** (`notebooks/page.tsx`): função `naturalSort` usando `localeCompare` com `{ numeric: true, sensitivity: "base" }` — `EST9` antes de `EST10`.
- **UMCombobox** (`notebooks/page.tsx`): seletor de UM com `Command + Popover` — nome da UM em negrito e projeto abaixo, com busca por texto.
- **Histórico por notebook** (`notebooks/page.tsx`, `useNotebooks.ts`, `api/notebooks/[id]/history/route.ts`): botão com ícone `History` abre `HistoryModal` com timeline das conferências que incluíram o notebook, com ícones coloridos por status (verde/vermelho/âmbar).
- **Toggle de status** (`notebooks/page.tsx`): botão com ícone `Wrench` alterna `ATIVO ↔ MANUTENCAO` passando todos os campos obrigatórios para o `updateMutation`.
- **Excluir todos por UM** (`notebooks/page.tsx`, `useNotebooks.ts`, `api/notebooks/bulk-delete/route.ts`): botão no cabeçalho de cada UM com `ConfirmationDialog` chama `POST /api/notebooks/bulk-delete` com `{ umId }`.
- **Importação CSV melhorada** (`notebooks/page.tsx`): `ImportDialog` usa `UMCombobox` e botão "Baixar modelo" gera CSV template com cabeçalho correto.
- **Label "N/S"** (`notebooks/page.tsx`): campo Serial renomeado de "Serial" para "N/S".
- **Modal de edição corrigido** (`notebooks/page.tsx`): `key={editingNotebook?.id ?? "new"}` no `NotebookFormDialog`.

#### Geral (itens 23–27)

- **shadcn Sidebar** (`AdminLayout.tsx`, `components/ui/sidebar.tsx`): layout admin reescrito com `SidebarProvider`, `Sidebar collapsible="icon"`, `SidebarRail` e mobile via Sheet embutido. Substitui o hamburger/drawer customizado anterior.
- **ThemeToggle next-themes** (`AdminLayout.tsx`, `providers/ThemeProvider.tsx`): `ThemeProvider` migrado para re-export do `next-themes`. Botão no rodapé da sidebar com `DropdownMenu` oferece opções Claro / Escuro / Sistema via `useTheme()`.
- **AlertDialog**: `ConfirmationDialog` já usava `AlertDialog` do shadcn — nenhuma alteração necessária.
- **DataTable pageSize**: Dashboard usa `pageSize={10}`, Relatórios usa `pageSize={20}` — sem alterações estruturais no `DataTable`.
- **Animação de transição** (`globals.css`, `next.config.ts`): `page-enter` aplica `opacity 0→1 + translateY 8px→0` em 0.2s em todos os `<main>`. `experimental.viewTransition: true` habilitado no Next.js.
- **Fundo off-white** (`globals.css`): modo claro com `--background: #FAF7F2` (âmbar suave) — `--card` permanecia `#FFFFFF` (corrigido na v2).

### Correções e Melhorias v2

#### Unidades Móveis (item 1)

- **Layout de periféricos corrigido** (`ums/page.tsx`): grid de periféricos alterado para `grid-cols-3` fixo garantindo que Mouses, Carregadores e Fones sempre caibam na mesma linha sem overflow.

#### Notebooks (itens 2–4)

- **Badge de status em todos os notebooks** (`notebooks/page.tsx`): exibida em todos os notebooks — verde com texto "Ativo" para ATIVO, âmbar `#CC7A00` com texto "Manutenção" para MANUTENCAO.
- **Ícone de manutenção com cor amarela** (`notebooks/page.tsx`): ícone Wrench aplica `color: var(--itc-atencao)` via `style` inline quando `status === 'MANUTENCAO'`.
- **Histórico de ciclo de vida completo** (`notebooks/page.tsx`, `api/notebooks/[id]/history/route.ts`, `api/notebooks/[id]/route.ts`): modal de histórico exibe todos os LifecycleEvents — conferências, mudanças de status e cadastro. `PUT /api/notebooks/[id]` cria LifecycleEvent automaticamente via `prisma.$transaction` ao detectar mudança de status: tipo "Manutenção" (ATIVO→MANUTENCAO) ou "Retorno" (MANUTENCAO→ATIVO).

#### Usuários (item 5)

- **metaDiaria ocultada para ADMIN e MASTER** (`usuarios/page.tsx`): campo "Meta: X/dia" no card e no modal de edição exibido somente quando `user.role === 'USER'`.

#### Theme Switcher (itens 6–7)

- **Toggle dark/light sem opção Sistema** (`AdminLayout.tsx`): seletor simplificado para alternar diretamente entre 'dark' e 'light' via `resolvedTheme` do next-themes — opção 'system' removida.
- **Fundo off-white no modo claro** (`globals.css`): variáveis CSS do tema claro atualizadas: `--card: #F2EDE6`, `--popover: #F2EDE6`, `--sidebar: #EDE8E0`, `--muted: #E8E2D9`, `--border: #D4CEC5`, `--input: #D4CEC5`. Contraste verificado em sidebar, cards, tabelas, modais e inputs.

#### Menu Perfil — Alterar Senha (item 8)

- **Modal de alteração de senha** (`components/ui/ChangePasswordModal.tsx`, `api/users/change-password/route.ts`): opção "Alterar senha" adicionada no dropdown do perfil na sidebar. Abre modal com campos: senha atual, nova senha (mín. 8 chars) e confirmação. API `PUT /api/users/change-password` verifica senha atual com `bcrypt.compare` e faz hash da nova com rounds 12. Sair movido para dentro do mesmo dropdown de perfil.

#### Geral — Transições (item 9)

- **Animação fadeInUp aprimorada** (`globals.css`): keyframe `fadeInUp` com `translateY(12px → 0)` em 200ms, aplicado via classe `page-transition` no `<div>` raiz de cada página — substituiu a animação global em `<main>`.

---

## 10. Decisões Técnicas

### Prisma 7 — Driver Adapter Obrigatório

O Prisma 7 mudou para o novo gerador `prisma-client` (não mais `prisma-client-js`). Este gerador exige um driver adapter — `new PrismaClient()` sem adapter lança erro. A URL do banco **não vai** no `datasource` do `schema.prisma`; vai apenas no `prisma.config.ts` via `dotenv`.

```typescript
// lib/db/prisma.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
return new PrismaClient({ adapter });
```

A pasta `src/generated/` está no `.gitignore`. É necessário rodar `npx prisma generate` após um clone fresco.

### NextAuth v5 + Edge Runtime

O middleware Next.js roda no Edge Runtime, que não tem acesso a APIs Node.js como `pg` e `bcrypt`. A solução é manter dois arquivos de auth:

- `lib/auth/config.ts` — edge-safe, só callbacks, sem imports Node.js
- `lib/auth/index.ts` — Node.js, com PrismaAdapter e Credentials

### Serwist + `skipWaiting: false`

A configuração `skipWaiting: false` é crítica para evitar que o Service Worker se ative durante uma sessão ativa do usuário, potencialmente servindo assets de versões diferentes ao mesmo tempo. **Nunca alterar para `true`.**

### Dexie — Versionamento de Schema

O schema do Dexie IndexedDB só pode ser alterado com versionamento correto:

```typescript
this.version(1).stores({ conferencesOutbox: "..." });
// Para alterar: adicionar this.version(2).stores({ ... })
// NUNCA modificar a versão existente
```

### Notebooks — Hostname como Chave de Identificação

O QR Code contém apenas o `hostname` do notebook (ex: `BSBIA01-EST01`). O hostname tem constraint `@unique` no banco. O sistema faz o match pelo hostname normalizado (case-insensitive).

### Cadastro em Lote — Formato de Numeração

- Números 1–9: zero à esquerda (`EST01`, `EST02` ... `EST09`)
- Números 10+: sem zero (`EST10`, `EST11`)
- Exemplo com prefixo `BSBIA01-EST` de 1 a 106: `BSBIA01-EST01` ... `BSBIA01-EST09`, `BSBIA01-EST10` ... `BSBIA01-EST106`

### Conferências São Imutáveis

Uma vez criada via `POST /api/conferences`, uma conferência não pode ser alterada. Não existe `PUT /api/conferences/[id]`. Isso é intencional para garantir integridade do histórico.

### Segurança de Headers

Configurado em `next.config.ts` para todas as rotas:

- `X-Frame-Options: DENY` — previne clickjacking
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), geolocation=(self), microphone=()` — restringe APIs ao próprio domínio
- `Strict-Transport-Security` — HSTS 2 anos
- `Content-Security-Policy` — bloqueia recursos externos (exceto Sentry e Google Fonts)

---

## 11. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz (nunca commitar):

```env
# Banco de dados
DATABASE_URL="postgresql://notescan:SENHA@localhost:5432/notescan"

# NextAuth
NEXTAUTH_SECRET="gere_com_openssl_rand_base64_32"
NEXTAUTH_URL="http://localhost:3000"

# Telegram
TELEGRAM_BOT_TOKEN="token_do_bot"
TELEGRAM_CHAT_ID="id_do_grupo"

# Push Notifications (VAPID)
# Gerar com: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="chave_publica_base64"
VAPID_PRIVATE_KEY="chave_privada_base64"

# Sentry
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_AUTH_TOKEN="..."
```

> **Produção:** as variáveis ficam nas configurações do container Docker no GLPI-SRV. Nunca adicionar `.env.local` ao git.

---

## 12. Como Rodar Localmente

### Pré-requisitos

- Node.js 20.x
- Docker (para o PostgreSQL) ou PostgreSQL 16 instalado localmente

### 1. Clonar e instalar

```bash
git clone https://github.com/ITC-Brasil/itc-notescan.git
cd itc-notescan
npm install
```

### 2. Configurar banco de dados

Com Docker:

```bash
docker run -d \
  --name notescan-db \
  -e POSTGRES_USER=notescan \
  -e POSTGRES_PASSWORD=notescan_dev \
  -e POSTGRES_DB=notescan \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
# Editar .env.local com os valores corretos
# DATABASE_URL=postgresql://notescan:notescan_dev@localhost:5432/notescan
```

### 4. Gerar cliente Prisma e aplicar migrations

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Criar o primeiro usuário MASTER

```bash
npx tsx scripts/create-admin.ts
```

> O script cria o usuário com as credenciais padrão definidas no arquivo. **Alterar a senha imediatamente após o primeiro login.**

### 6. Rodar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`.

### Comandos úteis

```bash
npm run type-check       # TypeScript sem emitir
npm run lint             # ESLint
npm run test             # Vitest (unit)
npm run test:coverage    # Coverage (mín. 80% lines/functions, 70% branches)
npm run test:e2e         # Playwright
npm run audit:security   # npm audit --audit-level=high
```

---

## 13. Deploy em Produção

### Infraestrutura

- **Servidor:** GLPI-SRV (Dell PowerEdge R250)
- **Container:** Docker + Nginx (reverse proxy)
- **CI/CD:** Push na branch `main` → GitHub Actions → build + deploy
- **Build:** `output: 'standalone'` no `next.config.ts` (obrigatório para Docker)

### Branches

```
feature/xxx  → develop → main
```

- Desenvolvimento em branches de feature
- Merge em `develop` para integração
- Merge em `main` aciona o pipeline de produção

### Processo de Deploy

```bash
# 1. Build da imagem
docker build -t itc-notescan:latest .

# 2. Subir container
docker run -d \
  --name itc-notescan \
  -p 3000:3000 \
  --env-file /etc/notescan/.env.production \
  itc-notescan:latest

# 3. Nginx faz proxy para localhost:3000
```

---

## 14. Arquivos Críticos — Não Alterar Sem Entender

| Arquivo / Área | Risco |
|---|---|
| `proxy.ts` | Protege todas as rotas — erro expõe ou bloqueia tudo |
| `lib/auth/config.ts` | Erro pode derrubar autenticação de todos os usuários |
| `lib/offline/db.ts` | Alterações no schema Dexie sem versionamento corrompem dados locais |
| `lib/offline/sync.ts` | Nunca alterar ordem ou limpar fila sem garantir sync completa |
| `src/app/sw.ts` | `skipWaiting: false` é crítico — não alterar |
| `prisma/migrations/` | Nunca editar migrations aplicadas — sempre criar nova |
| VAPID keys | Alterar invalida todas as assinaturas de push existentes |
| `components/layout/AdminLayout.tsx` | Contém toda a estrutura da sidebar — alterações afetam nav de todas as páginas admin |
| `providers/ThemeProvider.tsx` | Re-export do next-themes — mudança quebra tema em toda a aplicação |
| `components/ui/sidebar.tsx` | Componente base shadcn — não editar manualmente; atualizar via `npx shadcn@latest add sidebar` |

---

## 15. Troubleshooting Comum

### `prisma generate` falha

O Prisma 7 usa o novo gerador `prisma-client`. Certifique-se de ter `@prisma/adapter-pg` e `pg` instalados. A URL do banco vai em `prisma.config.ts`, não no `schema.prisma`.

### "Prisma Client not found" após clone

```bash
npx prisma generate
```

A pasta `src/generated/` está no `.gitignore` por convenção. O cliente deve ser gerado localmente.

### Middleware causando erro 500

O `proxy.ts` usa apenas `lib/auth/config.ts` (edge-safe). Se houver imports de Prisma ou bcrypt nesse fluxo, o Edge Runtime vai falhar. Verificar que nenhuma função chamada pelo proxy importa `lib/db/prisma.ts` ou `lib/auth/index.ts`.

### Dexie error: "version must be greater than previous version"

Não altere a versão existente do schema Dexie. Adicione uma nova versão:

```typescript
this.version(1).stores({ conferencesOutbox: "..." }); // existente
this.version(2).stores({ conferencesOutbox: "...", novaTabela: "..." }); // nova
```

### Push notifications não chegam

1. Verificar se as VAPID keys estão corretas no `.env.local`
2. Verificar se o usuário concedeu permissão no browser
3. O SW precisa estar registrado — verificar DevTools > Application > Service Workers
4. `skipWaiting: false` é intencional — o SW só ativa após fechar todas as abas da versão anterior

---

## 16. Fluxo Git e Padrão de Desenvolvimento

### Estrutura de Branches

```
main        → produção — protegida, exige PR com 1 aprovação
  └── develop → integração — onde as branches se juntam
        ├── feat/nome-da-feature
        ├── fix/nome-do-bug
        └── chore/nome-da-tarefa
```

### Fluxo de uma Tarefa

```bash
# 1. Sempre partir do develop atualizado
git checkout develop
git pull origin develop

# 2. Criar branch da tarefa
git checkout -b feat/nome-descritivo

# 3. Desenvolver e commitar
git add .
git commit -m "feat(escopo): descrição em lowercase"

# 4. Push e Pull Request
git push origin feat/nome-descritivo
# Abrir PR para develop no GitHub
# Aguardar revisão e aprovação
# Merge em develop

# 5. Quando develop estável → PR para main → deploy
```

### Padrão de Commits — Conventional Commits

| Prefixo | Uso | Exemplo |
|---|---|---|
| `feat:` | Nova funcionalidade | `feat(notebooks): add batch delete per UM` |
| `fix:` | Correção de bug | `fix(scanner): prevent duplicate scan on fast tap` |
| `security:` | Correção de segurança | `security(api): add rate limiting to auth route` |
| `refactor:` | Refatoração sem mudança de comportamento | `refactor(hooks): extract scan logic to useConference` |
| `test:` | Testes | `test(conference): add unit tests for offline fallback` |
| `docs:` | Documentação | `docs: update architecture section in README` |
| `chore:` | Manutenção e dependências | `chore: update prisma to 7.9.x` |
| `perf:` | Performance | `perf(dashboard): reduce polling interval on blur` |
| `ci:` | Pipeline CI/CD | `ci: add CodeQL security scan on PR` |
| `style:` | Formatação, sem mudança de lógica | `style: run prettier on lib folder` |

O escopo entre parênteses é opcional mas recomendado para indicar a área afetada:
`feat(notebooks)`, `fix(scanner)`, `security(api)`, etc.

### Segurança do Repositório

- `main` protegida com Branch Protection Rule — exige PR com 1 aprovação
- Push direto na `main` bloqueado para todos (inclusive administradores)
- Secret Scanning ativo — detecta credenciais acidentalmente commitadas
- Dependabot ativo — PRs automáticos para atualização de dependências com vulnerabilidades
- CodeQL (SAST) rodando a cada PR e push nas branches principais

### CI/CD — GitHub Actions

Pipeline configurado em `.github/workflows/ci.yml`:

1. Type check (`npm run type-check`)
2. Lint (`npm run lint`)
3. Testes unitários (`npm run test`)
4. Audit de segurança (`npm audit --audit-level=high`)

O pipeline deve passar antes de qualquer merge em `develop` ou `main`.

### Responsáveis

| Responsável | Área |
|---|---|
| Matheus Nobre | Front-end, infra, deploy |
| Matheus Santos | Back-end, API Routes, segurança |

---

*Última atualização: Junho de 2026 — v2 de correções aplicada. Para atualizações, editar este arquivo e reimportar no BookStack.*
