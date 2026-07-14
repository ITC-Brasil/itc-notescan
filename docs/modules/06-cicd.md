# Módulo 6 — CI/CD

**Data de conclusão:** 2026-06-26

---

## O que foi implementado

### `.github/workflows/ci.yml` — Quality Check

Roda em todo push e PR para qualquer branch.

**Etapas em sequência:**

1. **type-check** — `npx tsc --noEmit`
2. **lint** — `npx eslint src/`
3. **test** — `npm run test` (Vitest unitários, banco `notescan_test` via service PostgreSQL)
4. **audit** — `npm audit --audit-level=high`

**Service PostgreSQL no CI:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: notescan
      POSTGRES_DB: notescan_test
      POSTGRES_PASSWORD: test
    ports: ["5432:5432"]
```

**Secrets/env necessários no CI:**
- `DATABASE_URL` apontando para o service (`postgresql://notescan:test@localhost:5432/notescan_test`)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `SENTRY_AUTH_TOKEN` (opcional para CI)

### `.github/workflows/deploy.yml` — CD Deploy

Configurado, aguardando secrets:

```yaml
on:
  push:
    branches: [main]
steps:
  - SSH para GLPI-SRV (porta 2222)
  - git pull origin main
  - docker compose down && docker compose up -d --build
```

**Secrets necessários:**
- `DEPLOY_HOST`: hostname do servidor
- `DEPLOY_USER`: `github-deploy`
- `DEPLOY_SSH_KEY`: chave privada ed25519

---

## Problemas encontrados e resolvidos

| Problema | Causa | Solução |
|---|---|---|
| Playwright specs rodando no Vitest | Vitest sem `include` explícito pegava `__tests__/e2e/` | `include: ['__tests__/unit/**']` no `vitest.config.ts` |
| 24 erros ESLint bloqueando lint | Regras `@typescript-eslint` e `eslint-plugin-security` com warnings tratados como erros | Corrigidos individualmente: tipos explícitos, regras de segurança |
| Shadcn components ausentes | `input-group` não instalado, bloqueava type-check | `npx shadcn@latest add input-group` + commit |
| CodeQL removido | GitHub CodeQL Action falhou com Next.js 16 (incompatibilidade) | Job removido do workflow; Semgrep pode ser adicionado futuramente |

---

## Status atual

| Workflow | Status |
|---|---|
| Quality Check (type-check, lint, test, audit) | ✅ Passando |
| Deploy automático via SSH | ⏳ Pendente (secrets não configurados) |

---

## Pontos de atenção

- O CD está configurado mas não operacional — usar deploy manual enquanto isso
- `npm audit` com `--audit-level=high`: vulnerabilidades críticas e altas bloqueiam o CI
- Se adicionar dependência com vulnerabilidade conhecida, avaliar se tem fix disponível antes de aceitar
- O job de deploy usa SSH porta 2222 (não padrão) — garantir que o runner do GitHub Actions permite conexões de saída nessa porta

---

## Commits

```
db9d2bb ci: add GitHub Actions CI pipeline with type-check, lint, tests and CodeQL
6c07ce5 ci: fix pipeline order and commit missing shadcn components
215dc17 ci: add missing input-group component and remove CodeQL job
ef78354 ci: fix all 24 ESLint problems blocking CI lint step
5f0707c fix: scope Vitest to __tests__/unit/ to prevent Playwright spec conflict
4abea97 ci: add Dockerfile and CD deploy workflow for GLPI-SRV
52426e2 ci: set SSH port 2222 for GLPI-SRV deployment
55467ee docs: add CI/CD section and finalize testing documentation
```
