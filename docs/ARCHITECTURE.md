# Arquitetura — ITC NoteScan v2.0

## Visão Geral

ITC NoteScan é um sistema offline-first de conferência de ativos via QR Code. O
cliente (PWA ou APK Android) opera sem internet e sincroniza com o servidor
quando a conexão retorna. O backend é uma aplicação Next.js com banco PostgreSQL,
acessível via Cloudflare Tunnel sem exposição direta de porta.

---

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.2.9 |
| Linguagem | TypeScript (strict: true) | 5.x |
| Estilização | Tailwind CSS | 4.x |
| Componentes | shadcn/ui | 4.x |
| Autenticação | NextAuth.js | 5.0.0-beta.31 |
| ORM | Prisma + @prisma/adapter-pg | 7.8.x |
| Banco de dados | PostgreSQL | 16 |
| Cache/Fetching | TanStack Query (React Query) | 5.x |
| Validação | Zod | 4.x |
| Scanner web | @yudiel/react-qr-scanner + zxing-wasm | — |
| Scanner nativo | @capacitor-mlkit/barcode-scanning | 7.5.x |
| Biometria (APK) | @capgo/capacitor-native-biometric | 7.x |
| PWA / SW | @serwist/next | 9.5.x |
| Banco offline | Dexie.js (IndexedDB) | 4.x |
| Notificações push | web-push (VAPID) | 3.6.x |
| Observabilidade | Sentry | 10.x |
| Testes unitários | Vitest | 4.x |
| Testes E2E | Playwright | 1.61.x |
| Mobile nativo | Capacitor | 7.x |
| Deploy | Docker + Nginx, GLPI-SRV (Dell R250) | — |

---

## Decisões Estruturais

- **Separação de camadas obrigatória:** Componentes → Hooks → API Routes → Services → Prisma. Nenhum fetch direto em componentes.
- **Nenhum `any` em TypeScript.** TypeScript strict sem exceções.
- **Nenhum `$queryRaw` com interpolação.** Previne SQL injection via Prisma.
- **Toda API Route segue o padrão:** `auth()` → verificar role → Zod → lógica.
- **Conferências são imutáveis.** Não existe PUT/DELETE em `/api/conferences`.
- **PostgreSQL via API é sempre a fonte final de verdade.** Dexie é cache temporário.
- **Schema Dexie só pode ser alterado com versionamento correto** (`this.version(N)`).
- **`proxy.ts` usa matcher explícito** (lista de rotas incluídas), não regex de exclusão — evita o bug de o middleware rodar em `/api/auth/*`.
- **Split auth Edge/Node.js:** `lib/auth/config.ts` (edge-safe, só callbacks) e `lib/auth/index.ts` (Node.js, PrismaAdapter + bcrypt).
- **Prisma 7 exige driver adapter:** `new PrismaClient({ adapter: new PrismaPg(...) })`. URL do banco vai em `prisma.config.ts`, não no `schema.prisma`.
- **`@serwist/next` substitui `@ducanh2912/next-pwa`** — API compatível, sem manutenção ativa do pacote antigo.
- **`skipWaiting: false` no SW é crítico** — nunca alterar. Impede ativação durante sessão ativa.
- **Scanner nativo é o `@capacitor-mlkit/barcode-scanning`** (ML Kit) — o evento `barcodesScanned` entrega todos os QR de um frame e `resolution: 1920x1080` viabiliza leitura em lote. Substituiu o `@capacitor-community/barcode-scanner` (ver DECISIONS m7-05).
- **APK é um WebView sobre `server.url` remoto** — não há bundle local do app; sem rede, cai no `capacitor-shell/offline.html` (via `server.errorPath`).
- **Sessão de 7 dias no WebView** depende de persistência de cookie: `MainActivity` faz `flush()` do `CookieManager` em `onPause`/`onStop`, e o `SessionProvider` não revalida no foco (ver DECISIONS m7-08).
- **Tailwind v4:** cores semânticas via utilitário de tema (`text-itc-sucesso`), registrado em `@theme inline` — nunca a sintaxe de colchete `text-[--itc-x]` (não compila no v4).

---

## Fluxo de Dados

```
Usuário (browser/APK)
    │
    ├─ Autenticação → POST /api/auth (NextAuth Credentials)
    │                  └─ JWT gerado → cookie httpOnly
    │
    ├─ Leitura → React Query → GET /api/* → Prisma → PostgreSQL
    │
    ├─ Conferência online → POST /api/conferences → Prisma → PG → Telegram
    │                        (409 se metaDiaria atingida — bloqueio interativo)
    │
    └─ Conferência offline → saveToOutbox (Dexie)
                              └─ SW background sync
                                  └─ processOutbox → POST /api/conferences
                                      (header X-Sync-Replay isenta da meta —
                                       nunca descartar dado; retry 1→5→15min)
```

---

## Infra Local

```bash
# 1. PostgreSQL via Docker
docker run -d --name notescan-db \
  -e POSTGRES_USER=notescan \
  -e POSTGRES_PASSWORD=notescan_dev \
  -e POSTGRES_DB=notescan \
  -p 5432:5432 postgres:16-alpine

# 2. Instalar dependências e gerar client Prisma
npm install
npx prisma generate
npx prisma migrate dev

# 3. Criar usuário MASTER inicial
npx tsx scripts/create-admin.ts

# 4. Servidor de desenvolvimento
npm run dev  # http://localhost:3000
```

---

## Infra de Produção

| Campo | Valor |
|---|---|
| Servidor | GLPI-SRV — Dell PowerEdge R250 |
| SO | Ubuntu 24.04.4 LTS |
| IP externo | glpi.grupoitcbrasil.com.br (SSH porta 2222) |
| IP Tailscale | 100.68.161.44 |
| Tunnel | Cloudflare Tunnel itcbr-tunnel |
| Domínio | notescan.itcbr.xyz |
| App container | notescan-app (Next.js standalone, porta 3010) |
| DB container | notescan-db (PostgreSQL 16, porta interna 5432) |
