# CLAUDE.md — ITC NoteScan v2.0

## Visão Geral

ITC NoteScan é um sistema de conferência de ativos (notebooks) via leitura de QR
Code, desenvolvido para a ITC Brasil.

Foi criado para resolver um problema real: furtos de notebooks nas carretas do
projeto Brasil.IA (BSBIA), onde cada uma das 4 carretas opera com 106 notebooks
(100 alunos, 5 professores, 1 pedagoga).

O sistema substitui conferências manuais por um fluxo digital. Técnicos usam a
câmera do celular para conferir os ativos. Gestores acompanham via dashboard.
A cada conferência concluída, um resumo é enviado automaticamente ao Telegram.

**TL;DR:** ITC NoteScan é um sistema offline-first onde o sistema já sabe o que
deveria existir e o usuário valida via scan, enquanto o sistema garante
consistência entre dados locais (Dexie) e remotos (PostgreSQL via API) através
de uma fila de sincronização.

> Esta é a v2.0 — reescrita completa do ScanPRO. O repositório original
> (`github.com/ITC-Brasil/scanpro`) serve apenas como referência de
> comportamento e regras de negócio. Nenhum código foi copiado diretamente.

---

## Contexto Operacional

**Empresa:** ITC Brasil — Unidades Móveis de Atendimento via contratos públicos

**Projeto atendido:** Brasil.IA (BSBIA)

- 4 carretas itinerantes, rotação a cada 20 dias
- 106 notebooks por carreta (100 alunos, 5 professores, 1 pedagoga)
- Técnicos de campo realizam conferências diárias via celular
- 7 técnicos ativos, ~14 conferências/dia

---

## Modelo Mental do Sistema (CRÍTICO)

O sistema garante consistência entre três estados:

1. **Estado remoto (PostgreSQL via API)** — fonte oficial dos dados
2. **Estado local (Dexie / IndexedDB)** — dados offline e conferências em andamento
3. **Estado observado (Scanner)** — o que foi escaneado pelo usuário

**Regra principal:** o sistema existe para alinhar esses três estados com máxima
confiabilidade. Nunca perder dados. Nunca duplicar registros.

---

## Stack de Tecnologia

| Camada               | Tecnologia                                       |
| -------------------- | ------------------------------------------------ |
| Framework            | Next.js 16.2.9 (App Router, Turbopack, proxy.ts) |
| Linguagem            | TypeScript 5.x — strict: true sem exceções       |
| Estilização          | Tailwind CSS 4.x (tokens via @theme; usar `text-itc-*`, nunca `[--itc-*]`) |
| Componentes          | shadcn/ui — único sistema de componentes         |
| Tabelas              | TanStack Table (via DataTable genérico)          |
| Ícones               | Lucide React                                     |
| Autenticação         | NextAuth.js 5.x — Credentials provider           |
| ORM                  | Prisma 7.x — driver adapter @prisma/adapter-pg   |
| Banco de Dados       | PostgreSQL 16                                    |
| Cache e Fetching     | React Query 5.x (TanStack Query)                 |
| Validação            | Zod 4.x — obrigatório em todas as API Routes     |
| Scanner web          | @yudiel/react-qr-scanner + zxing-wasm            |
| Scanner nativo (APK) | @capacitor-mlkit/barcode-scanning 7.5 (ML Kit)   |
| Mobile nativo        | Capacitor 7.x (APK carrega server.url remoto)    |
| Biometria (APK)      | @capgo/capacitor-native-biometric                |
| PWA / Service Worker | @serwist/next                                   |
| Banco Offline        | Dexie.js 4.x (IndexedDB)                         |
| Sincronização        | syncQueue + background sync                      |
| Notificações Push    | web-push (VAPID)                                 |
| Observabilidade      | Sentry                                           |
| Testes Unitários     | Vitest                                           |
| Testes E2E           | Playwright                                       |
| Deploy               | Docker + Nginx no GLPI-SRV (Dell R250)           |

---

## Arquitetura — Separação Obrigatória

```
Services   → lógica de negócio (lib/services/)
Hooks      → controle de estado (hooks/)
Componentes → interface apenas — zero lógica de negócio
```

**Regras críticas:**

- Nenhuma lógica de negócio em componentes
- Nenhum fetch direto em componentes — sempre via React Query hooks
- Nenhum `any` em TypeScript
- Nenhum `$queryRaw` com interpolação de string no Prisma

---

## Perfis de Usuário

| Perfil           | Permissões                                                    |
| ---------------- | ------------------------------------------------------------- |
| `USER` (Técnico) | Executar conferências, escanear, ver histórico próprio        |
| `ADMIN` (Gestão) | Gerenciar Projetos, UMs, Notebooks, Notificações + Relatórios |
| `MASTER`         | Tudo do ADMIN + gerenciar Usuários                            |

Perfis são implementados via **NextAuth JWT callbacks** — a `role` entra no token
e é verificada nas API Routes via `auth()`. Sem leitura extra no banco para
verificar permissões.

---

## Proteção de Rotas

No Next.js 16, o `middleware.ts` foi substituído por `proxy.ts`.

```
(user)/     → requer role USER, ADMIN ou MASTER
(admin)/    → requer role ADMIN ou MASTER
/usuarios   → requer role MASTER
```

Toda API Route verifica autenticação com `auth()` antes de qualquer operação.

---

## Fluxo Principal de Conferência

### 1. Início

- Técnico autenticado seleciona uma UM — obrigatório, sem UM não inicia

### 2. Carregamento

- Sistema carrega todos os notebooks ativos da UM via React Query

### 3. Scan

- Leitura válida → move para "escaneados", remove de "pendentes"
- Leitura duplicada → bloqueada com feedback de erro imediato
- Leitura de outra UM → bloqueada com mensagem específica

### 4. Estados dos Dispositivos

- **Ativo** → obrigatório na conferência
- **Em manutenção** → registrado mas não contabilizado como faltante

### 5. Finalização

- Sistema gera resumo: total esperado, escaneados, faltantes, manutenção,
  técnico, projeto/UM, data/hora, localização

### 6. Status

- **CONCLUIDO_OK** → todos os ativos escaneados
- **CONCLUIDO_FALTANTES** → existem dispositivos faltantes

### 7. Envio

- **Sempre via `/api/conferences`** — nunca gravar direto no banco pelo cliente
- API salva no PostgreSQL via Prisma e notifica o Telegram
- Regra crítica: conferências são imutáveis após criação

### 8. Offline

- Sem internet: salva no Dexie e adiciona na syncQueue
- Com internet: sincronização automática via background sync
- Retry com backoff exponencial: 1min → 5min → 15min

---

## Sincronização (CRÍTICO)

Todas as ações offline entram na `syncQueue`. A execução ocorre automaticamente
em background.

**Regras que nunca podem ser quebradas:**

- Nunca perder dados
- Nunca duplicar registros
- Respeitar a ordem da fila
- PostgreSQL via API é sempre a fonte final de verdade
- Schema Dexie só pode ser alterado com versionamento correto (`this.version(N)`)

---

## Segurança — Padrão Obrigatório

### API Routes

Toda rota deve seguir este padrão sem exceção:

```typescript
export async function POST(request: Request) {
  // 1. Verificar autenticação
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  // 2. Verificar role quando necessário
  if (!["ADMIN", "MASTER"].includes(session.user.role)) {
    return Response.json({ message: "Proibido" }, { status: 403 });
  }

  // 3. Validar body com Zod
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );
  }

  // 4. Lógica de negócio
}
```

### Headers de Segurança

Configurados em `next.config.ts`:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Permissions-Policy`

### Rate Limiting

- Rota de login: máximo 5 tentativas por IP por minuto
- API Routes sensíveis: máximo 30 req/min por usuário

### Senhas

- bcrypt com rounds 12
- Nunca logar senhas, tokens ou dados sensíveis

---

## Entidades do Sistema

### User

```
id, nome, email, passwordHash, role (USER|ADMIN|MASTER), metaDiaria
```

### Project

```
id, nome, cor (hex)
```

### UM (Unidade Móvel)

```
id, nome, projectId, quantidadeEsperada, perifericos, mouses, carregadores, fones
```

### Notebook

```
id, hostname, serial, patrimonio, status (ATIVO|MANUTENCAO), umId
```

### Conference

```
id, userId, umId, dataInicio, dataFim, localizacao, status (CONCLUIDO_OK|CONCLUIDO_FALTANTES)
```

### ConferenceItem

```
id, conferenceId, notebookId, status (ESCANEADO|FALTANTE|MANUTENCAO)
```

### LifecycleEvent

```
Imutável — apenas criação permitida. Registra histórico de eventos do ativo.
id, notebookId, tipo, descricao, userId, createdAt
```

### PushSubscription

```
id, userId, endpoint, p256dh, auth
```

---

## Estrutura do Projeto

```
itc-notescan/
├── app/
│   ├── (admin)/                    # Rotas ADMIN e MASTER
│   │   ├── dashboard/page.tsx
│   │   ├── notebooks/page.tsx
│   │   ├── notificacoes/page.tsx
│   │   ├── projetos/page.tsx
│   │   ├── relatorios/page.tsx
│   │   ├── ums/page.tsx
│   │   ├── usuarios/page.tsx       # Apenas MASTER
│   │   └── layout.tsx
│   ├── (user)/                     # Rotas USER (técnico) — apenas mobile
│   │   ├── inicio/page.tsx
│   │   ├── scanner/page.tsx
│   │   └── layout.tsx
│   ├── alterar-senha/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── conferences/route.ts
│   │   ├── notifications/
│   │   │   ├── dispatch/route.ts
│   │   │   ├── send/route.ts
│   │   │   └── subscribe/route.ts
│   │   ├── notebooks/route.ts
│   │   ├── projects/route.ts
│   │   ├── ums/route.ts
│   │   └── users/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Login / root
│
├── components/
│   ├── layout/
│   │   ├── AdminLayout.tsx
│   │   ├── AuthGuard.tsx
│   │   └── UserLayout.tsx
│   ├── scanner/
│   │   └── QRScanner.tsx
│   └── ui/
│       ├── DataTable.tsx           # Tabela genérica — TanStack Table
│       ├── Skeleton.tsx
│       ├── EmptyState.tsx
│       ├── ErrorBoundary.tsx
│       ├── Modal.tsx
│       ├── Navbar.tsx
│       ├── Toast.tsx
│       └── [shadcn: button, calendar, dialog, popover, select, ...]
│
├── hooks/                          # Um hook por entidade
│   ├── useConference.ts
│   ├── useNotebooks.ts
│   ├── useProjects.ts
│   ├── useUMs.ts
│   └── useUsers.ts
│
├── lib/
│   ├── auth/                       # Configuração NextAuth
│   │   └── config.ts
│   ├── db/                         # Instância Prisma
│   │   └── prisma.ts
│   ├── offline/                    # Dexie schema e syncQueue
│   │   ├── db.ts
│   │   └── sync.ts
│   ├── services/                   # Lógica de negócio
│   │   ├── conference.service.ts
│   │   ├── notebook.service.ts
│   │   └── notification.service.ts
│   ├── validations/                # Schemas Zod reutilizáveis
│   │   └── index.ts
│   └── logger.ts                   # Logging estruturado
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── providers/
│   ├── QueryProvider.tsx           # React Query
│   ├── SessionProvider.tsx         # NextAuth
│   └── ThemeProvider.tsx
│
├── public/
│   ├── icons/
│   └── manifest.json
│
├── __tests__/
│   ├── unit/                       # Vitest
│   └── e2e/                        # Playwright
│
├── types/
│   └── index.ts
│
├── proxy.ts                        # Proteção de rotas (Next.js 16)
├── next.config.ts                  # output: standalone, security headers
├── tailwind.config.ts
└── tsconfig.json
```

---

## Páginas e Funcionalidades

### ADMIN e MASTER

| Página       | Funcionalidades principais                                             |
| ------------ | ---------------------------------------------------------------------- |
| Dashboard    | Cards resumo + tabela das 10 últimas conferências (polling 30s)        |
| Relatórios   | Histórico completo com filtros e exportação CSV                        |
| Projetos     | CRUD com seletor de cor (hex)                                          |
| UMs          | CRUD agrupado por projeto, herança de cor, configuração de periféricos |
| Notebooks    | CRUD individual, em lote e via CSV, agrupados por UM > Projeto         |
| Notificações | Push notifications para técnicos individuais ou todos                  |
| Usuários     | CRUD completo — apenas MASTER                                          |

### USER (Técnico) — Apenas Mobile

| Página  | Funcionalidades principais                                  |
| ------- | ----------------------------------------------------------- |
| Início  | Cards contagens diárias + botão INICIAR + histórico pessoal |
| Scanner | Câmera + listas pendentes/escaneados + fluxo de finalização |

**Regra:** técnico em desktop **não vê** o botão INICIAR CONFERÊNCIA.

---

## Regras de UI/UX

- **Mobile-first** — interface projetada para uso em celular em campo
- **Zero fricção** — redução máxima de decisões do usuário
- **Feedback imediato** — toda ação tem resposta visual instantânea
- **Dark mode** completo e consistente em todas as páginas
- **Toasts:** verde = sucesso | vermelho = erro | centralizados na parte inferior
- **Skeleton loaders** em todos os estados de carregamento
- **EmptyState** para todas as listas vazias
- **ErrorBoundary** no layout raiz
- Tabelas com cantos arredondados
- Hover nos cards apenas em desktop
- Design SaaS moderno — inspiração Linear, Vercel Dashboard

---

## Regras de Exclusão

| Entidade | Condição                          |
| -------- | --------------------------------- |
| Projeto  | Não pode ter UMs associadas       |
| UM       | Não pode ter Notebooks associados |
| Usuário  | Sempre exige confirmação          |

Toda exclusão irreversível exige modal de confirmação antes de executar.

---

## Notebooks — Cadastro em Lote

- Formato: `PREFIXO` + número sequencial (ex: `BSBIA01-EST01`)
- Números 1–9: zero à esquerda (`01`, `02` ... `09`)
- Números 10+: sem zero à esquerda
- Listagem em ordem alfabética

---

## Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL="postgresql://notescan:password@localhost:5432/notescan"

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL="http://localhost:3000"

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

⚠️ Nunca commitar `.env.local`. Variáveis de produção ficam nas variáveis de
ambiente do Docker no GLPI-SRV.

---

## Deploy

- **Plataforma:** Docker + Nginx no GLPI-SRV (Dell R250)
- **CI/CD:** push na branch `main` → GitHub Actions → build e deploy
- **Branches:** desenvolver em branches de feature → merge em `develop` → merge em `main`
- **`output: 'standalone'`** obrigatório no next.config.ts para compatibilidade Docker

---

## Ferramentas Ativas

| Ferramenta | Propósito |
|---|---|
| Ponytail | Anti-over-engineering — força a solução mais simples que funciona |
| interface-design | Design engineering — consistência visual e decisões de UI/UX |
| Context7 | Documentação atualizada de bibliotecas em tempo real |

**Ponytail** — instalado globalmente no Claude Code. Ativo em todas as sessões.
Usar `/ponytail` para revisar diffs, `/ponytail-audit` para auditar o repositório.
Repositório: https://github.com/DietrichGebert/ponytail

**interface-design** — instalado globalmente no Claude Code. Usar `/interface-design`
para construir ou auditar interfaces. O sistema de design fica em `.interface-design/system.md`.
Repositório: https://github.com/Dammyjay93/interface-design

---

## O que Não Mexer Sem Entender Bem

| Arquivo / Área        | Risco                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `proxy.ts`            | Protege todas as rotas — erro pode expor ou bloquear acesso        |
| `lib/offline/db.ts`   | Alterações no schema Dexie podem corromper dados locais            |
| `lib/offline/sync.ts` | Nunca alterar ordem ou limpar sem garantir sincronização completa  |
| Configuração VAPID    | Alterar invalida todas as assinaturas de push existentes           |
| `prisma/migrations/`  | Nunca editar migrations já aplicadas — criar nova migration sempre |
| `lib/auth/config.ts`  | Erro pode derrubar autenticação de todos os usuários               |

---

## Checklist para Qualquer Nova Implementação

Antes de implementar qualquer feature ou correção, validar:

- [ ] Funciona offline?
- [ ] Impacta a sincronização ou a syncQueue?
- [ ] Pode gerar inconsistência entre Dexie e PostgreSQL?
- [ ] Respeita a separação services / hooks / componentes?
- [ ] A API Route tem autenticação, autorização e validação Zod?
- [ ] Aumenta ou reduz fricção para o usuário?
- [ ] Tem teste unitário ou E2E cobrindo o caminho crítico?

Se houver risco em qualquer item: ajustar abordagem antes de implementar.

---

## Padrão de Commits

```
feat:      nova funcionalidade
fix:       correção de bug
security:  correção de segurança
refactor:  refatoração sem mudança de comportamento
test:      testes
docs:      documentação
chore:     manutenção
perf:      performance
ci:        pipeline
style:     formatação
```

Exemplo: `feat: add generic DataTable with TanStack Table`
