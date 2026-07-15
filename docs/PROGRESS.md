# Progress Log — ITC NoteScan v2.0

Log cronológico de módulos e versões. Entrada mais recente no topo.
Nunca editar entradas existentes.

---

| Data | Módulo | Resumo |
|---|---|---|
| 2026-07-14 | Módulo 7 — Scanner APK (correções) | Corrigido split-screen com câmera nativa + listas simultaneamente. Removido `prepare()` que bloqueava callback do `startScanning`. Camera não aparecia por falta de transparência nos wrappers do layout. Botões não respondiam por falta de `pointer-events: none` no overlay. Package-lock.json regenerado com todas as dependências transitivas. |
| 2026-06-29 | Módulo 7 — Scanner APK | `CapacitorHttp: false` para preservar cookie jar do NextAuth. `allowNavigation` expandido para cobrir subdomínios. |
| 2026-06-26 | Módulo 7 — Capacitor APK | Suporte Android com câmera nativa via `@capacitor-community/barcode-scanner@4.0.1`. `NativeQRScanner` com overlay transparente. `PermissionsGate` para fluxo de permissão na primeira abertura. Plugins downgraded para v5 para compatibilidade com `@capacitor/core@5.7.8`. |
| 2026-06-26 | Módulo 4 — Docker/Deploy | Dockerfile multi-stage finalizado. Entrypoint com `prisma migrate deploy`. Resolvidos: path do Prisma 7, node_modules completo, prisma.config.ts no runner, trustHost no NextAuth. Deploy manual via SSH documentado. |
| 2026-06-26 | Módulo 6 — CI/CD | Workflow Quality Check: type-check, lint, testes unitários, npm audit. Workflow Deploy: SSH para GLPI-SRV (porta 2222). ESLint: corrigidos 24 erros bloqueantes. Vitest isolado em `__tests__/unit/`. |
| 2026-06-25 | Módulo 5 — Testes E2E | 70 testes Playwright cobrindo: auth, conferências, CRUD completo. Suítes: auth.spec, conference.spec, projects.spec, ums.spec, notebooks.spec, users.spec, reports.spec. |
| 2026-06-24 | Módulo 5 — Testes unitários | 110+ testes Vitest com 93%+ cobertura. Banco de teste isolado (`notescan_test`). Schemas Zod, services, hooks, utils, API routes. |
| 2026-06-24 | Correções v6-v7 | Corrigido `ClientFetchError` do NextAuth (proxy.ts matcher explícito). Fundo do `<main>` via classe `.admin-main` com hex literal. Calibração final de tons creme do modo claro (main `#F5EFE6`, cards `#EDE8DE`, sidebar `#E5DDD4`). |
| 2026-06-23 | Correções v3-v4-v5 | Hydration error corrigido (`CollapsibleTrigger` com `asChild`). Fundo do main via `var(--background)` inline e depois via `.admin-main`. Modal UMs alargado. Badge Ativo restaurada. |
| 2026-06-22 | Correções v1-v2 | sidebar shadcn, next-themes, transições fadeInUp. Modal alterar senha. Toggle dark/light sem opção Sistema. metaDiaria condicional por role. Badges de status nos notebooks. Histórico de ciclo de vida. DatePicker Range e Comboboxes nos Relatórios. |
| 2026-06-22 | Módulo 3 — Técnico (Mobile) | Fluxo completo do técnico: `/inicio` (cards diários, histórico pessoal), `/scanner` (seleção UM → scan → periféricos → resumo → confirmar), `useConference` state machine, QRScanner com viewfinder, suporte offline com Dexie + syncQueue. |
| 2026-06-22 | Módulo 2 — Interface Admin | Dashboard (4 cards + polling 30s), Projetos, UMs, Notebooks (CRUD + lote + CSV), Relatórios (filtros + export CSV), Notificações push, Usuários (MASTER only). |
| 2026-06-22 | Módulo 1 — Fundação | Setup completo: Next.js 16, Prisma 7, shadcn/ui, NextAuth 5, proxy.ts, Dexie + syncQueue, Sentry, Husky, Vitest, Playwright, create-admin. Layouts AdminLayout/UserLayout/AuthGuard. Providers React Query/Session/Theme. |
