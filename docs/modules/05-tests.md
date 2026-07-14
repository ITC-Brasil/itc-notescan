# Módulo 5 — Testes

**Data de conclusão:** 2026-06-25

---

## O que foi implementado

### Vitest — Testes Unitários e de Integração

**Configuração:**
- `vitest.config.ts`: banco de teste isolado (`notescan_test`), `fileParallelism: false`
- Escopo: `__tests__/unit/**` (isolado para não conflitar com specs do Playwright)
- Cobertura restrita a `lib/**` (excluindo código gerado, singletons, configurações)
- Thresholds: 80% linhas, 80% funções, 70% branches

**Banco de teste:**
- `DATABASE_URL` sobrescrito no `vitest.config.ts` para `postgresql://.../notescan_test`
- Nunca testar contra o banco de desenvolvimento
- `beforeAll`: aplica migrations; `afterEach`: limpa dados; `afterAll`: fecha conexão

**O que é coberto (110+ testes, 93%+ cobertura):**

| Arquivo | Tipo | O que cobre |
|---|---|---|
| `lib/validations/index.ts` | Unitário | Todos os schemas Zod: campos obrigatórios, formatos, limites |
| `lib/rate-limit.ts` | Unitário | Window de 1min, contador, reset |
| `lib/offline/sync.ts` | Unitário | `saveToOutbox`, `processOutbox`, backoff exponencial |
| `lib/services/conference.service.ts` | Integração | `getDashboardStats` com banco real |
| `app/api/conferences/route.ts` | Integração | POST com auth, validação Zod, criação de items e events |
| `app/api/notebooks/route.ts` | Integração | GET/POST com verificação de role |
| `app/api/users/route.ts` | Integração | CRUD com verificação MASTER |

### Playwright — Testes E2E

**Configuração:**
- `playwright.config.ts`: baseURL `http://localhost:3000`, browser Chromium
- Roda contra servidor `next dev` (não o build de produção)
- Screenshots e videos em falhas

**70 testes cobrindo:**

| Suíte | Testes | O que verifica |
|---|---|---|
| `auth.spec.ts` | 8 | Login válido, inválido, redirecionamento por role, logout |
| `conference.spec.ts` | 12 | Fluxo completo: seleção UM → scan → resumo → confirmar |
| `projects.spec.ts` | 10 | CRUD, guard de exclusão, seletor de cor |
| `ums.spec.ts` | 10 | CRUD, periféricos, guard de exclusão |
| `notebooks.spec.ts` | 15 | CRUD, lote, CSV, histórico, toggle status |
| `users.spec.ts` | 8 | CRUD MASTER, guard self-delete, troca de senha |
| `reports.spec.ts` | 7 | Filtros combinados, exportação CSV |

---

## Verificação executada

```bash
npm run test:coverage
# → 110+ testes, 93.2% lines, 91.8% functions, 78.4% branches

npm run test:e2e
# → 70 testes passando, 0 falhas
```

---

## Pontos de atenção

- `fileParallelism: false` obrigatório para testes de integração que compartilham banco
- O banco `notescan_test` deve existir antes de rodar testes — criado uma vez com `createdb notescan_test`
- Playwright usa usuário de teste criado no `beforeAll` com `create-admin` adaptado
- Testes E2E dependem do servidor rodando (`npm run dev` em paralelo ou `webServer` no config)
- Cobertura exclui `src/generated/` — não incluir no threshold

---

## Commits

```
c358a87 test: add unit tests for critical flows with 80%+ coverage
ef9ede3 docs: add testing section with Vitest unit tests documentation
0634220 test: add E2E tests with Playwright covering auth, conference and CRUD flows
5fbbd65 test: implement 70 Playwright E2E tests (all passing)
d5d8657 docs: update testing section with Playwright E2E documentation
5f0707c fix: scope Vitest to __tests__/unit/ to prevent Playwright spec conflict
```
