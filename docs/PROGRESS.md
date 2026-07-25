# Progress Log — ITC NoteScan v2.0

Log cronológico de módulos e versões. Entrada mais recente no topo.
Nunca editar entradas existentes.

---

| Data | Módulo | Resumo |
|---|---|---|
| 2026-07-24 | Design System v3.1 | Conformação completa do app ao DS v3.1 (Rota B — só valores de superfície off-white, tokens preservados). Fundação (tabular-nums, manutenção amarela, sombras `shadow-1/2`), Login (mobile + desktop admin responsivo, Archivo na marca), Início, Seleção de UM, Scanner (pills + faixa de manutenção "Ver"), Periféricos, Resumo (`ConferenceSummary` compartilhado), Dashboard/Relatórios (tabela com Localidade/Resumo/Status pills), Usuários. Review geral sem violações de token. Pendente: rebuild do APK para o overlay nativo. Ver DECISIONS [ds-01](DECISIONS.md). |
| 2026-07-21 | Sessão APK + Auditoria docs | Persistência de sessão em 2 camadas: `MainActivity` (`setAcceptCookie` + `flush()` em onPause/onStop) e cliente (`SessionProvider` sem refetch no foco/offline; `AuthGuard` só redireciona em `unauthenticated` confirmado). Auditoria completa da documentação. |
| 2026-07-21 | UI — polimento fluxo do técnico | Ícones nas badges COMPLETO/INCOMPLETO, botões do histórico, card de seleção de UM e resumo (Laptop p/ Ativos). Backdrop do dialog opaco sobre a câmera. Header "ITC NoteScan". Ícone de sair vermelho + confirmação. |
| 2026-07-20 | Features — meta, offline, biometria | Trava de meta diária (409 no servidor + isenção da syncQueue via `X-Sync-Replay`; bloqueio no cliente). Paginação do histórico ("Carregar mais"). Retomada da câmera no foreground. Biometria no cold start (`BiometricGate`). Página `offline.html` via `errorPath`. `ConferenceSummary` compartilhado. |
| 2026-07-18 | Tailwind v4 — auditoria | Migração sistemática de sintaxe v3→v4: `[--itc-x]`→utilitário de tema `itc-x`, `flex-shrink-0`→`shrink-0`; `@source not "**/*.md"`. Badges verdes (online, COMPLETO). |
| 2026-07-17 | Módulo 7 — Capacitor 7 + ML Kit | Migração Capacitor 5→7 e scanner para `@capacitor-mlkit/barcode-scanning@7.5` (leitura em lote via `barcodesScanned` + 1080p). Botão de flash (torch). Safe-area da status bar. Fix do deploy (caminho absoluto `/home/glpissh/docker/notescan` + `set -e`). Escaping MarkdownV2 do Telegram. |
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
